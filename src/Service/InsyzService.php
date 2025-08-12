<?php

namespace App\Service;

use App\Entity\User;
use Exception;
use Symfony\Component\HttpKernel\KernelInterface;

class InsyzService
{
    private ?array $testData = null;

    public function __construct(
        private MssqlConnector $connector,
        private KernelInterface $kernel,
        private ApiCacheService $cacheService
    ) {
    }

    public function connect(string $procedure, array $args, bool $multiple = false): array
    {
        if ($multiple) {
            return $this->connector->callProcedureMultiple($procedure, $args);
        }

        return $this->connector->callProcedure($procedure, $args);
    }

    public function loginUser(string $email, string $hash): int
    {
        if ($this->useTestData()) {
            // Pro testovací data používat MockMSSQLService logiku
            if ($email === 'test@test.com' && $hash === 'test123') {
                return 4133; // Test INT_ADR
            }
            throw new Exception('Chyba přihlášení, zkontrolujte údaje a zkuste to znovu.');
        }

        $result = $this->connect("trasy.WEB_Login", [
            '@Email' => $email,
            '@WEBPwdHash' => $hash
        ]);

        if (isset($result[0]['INT_ADR'])) {
            return (int) $result[0]['INT_ADR'];
        }

        throw new Exception('Chyba přihlášení, zkontrolujte údaje a zkuste to znovu.');
    }

    public function getUser(int $intAdr): array
    {
        if ($this->useTestData()) {
            $data = $this->getTestData();
            return $data['user'] ?? [];
        }

        return $this->cacheService->getCachedUserData($intAdr, function($intAdr) {
            return $this->connect("trasy.ZNACKAR_DETAIL", [$intAdr]);
        });
    }

    public function getPrikazy(int $intAdr, ?int $year = null): array
    {
        if ($this->useTestData()) {
            $data = $this->getTestData();
            if ($year) {
                return $data['prikazy'][$year] ?? [];
            }
            // Pokud není rok zadán, vrátíme všechny roky
            $allPrikazy = [];
            foreach ($data['prikazy'] as $yearData) {
                $allPrikazy = array_merge($allPrikazy, $yearData);
            }
            return $allPrikazy;
        }

        return $this->cacheService->getCachedPrikazy($intAdr, $year, function($intAdr, $year) {
            return $this->connect("trasy.PRIKAZY_SEZNAM", [$intAdr, $year ?? date('Y')]);
        });
    }

    public function getPrikaz(int $intAdr, int $id): array
    {
        if ($this->useTestData()) {
            $data = $this->getTestData();
            $detail = $data['detaily'][$id] ?? null;
            
            if (!$detail) {
                throw new Exception('Chybí detail pro ID ' . $id);
            }
            
            return $detail;
        }

        return $this->cacheService->getCachedPrikaz($intAdr, $id, function($intAdr, $prikazId) {
            $result = $this->connect("trasy.ZP_Detail", [$prikazId], true);

            $head = $result[0][0] ?? [];

            if (empty($head)) {
                throw new Exception('U tohoto příkazu se nenačetla žádná data.');
            }

            // Hledání hodnoty INT_ADR v hlavičce
            $found = array_filter(array_keys($head), fn($key) => str_starts_with($key, 'INT_ADR'));
            $match = false;

            foreach ($found as $key) {
                if ((int) $head[$key] === $intAdr) {
                    $match = true;
                    break;
                }
            }

            if (!$match) {
                throw new Exception('Tento příkaz vám nebyl přidělen a nemáte oprávnění k jeho nahlížení.');
            }

            return [
                'head' => $head,
                'predmety' => $result[1] ?? [],
                'useky' => $result[2] ?? [],
            ];
        });
    }

    public function getSazby(?string $datum = null): array
    {
        if ($this->useTestData()) {
            $file = $this->kernel->getProjectDir() . '/var/mock-data/api/insyz/sazby/sazby.json';
            if (file_exists($file)) {
                return json_decode(file_get_contents($file), true) ?: [];
            }
            return [];
        }

        return $this->cacheService->getCachedSazby($datum, function($datum) {
            try {
                // Příprava data ve formátu YYYY-MM-DD (poziční parametr)
                $datumProvedeni = $datum ? date('Y-m-d', strtotime($datum)) : date('Y-m-d');
                
                // Volat proceduru s multiple recordsets (jako ZP_Detail)
                $result = $this->connect("trasy.ZP_Sazby", [$datumProvedeni], true);
                
                // Zkontrolovat, zda procedura vrátila nějaká data
                if (empty($result) || !is_array($result)) {
                    throw new Exception('MSSQL procedura trasy.ZP_Sazby nevrátila žádná data pro datum: ' . $datumProvedeni);
                }
                
                // Vrátit všechny recordsety jak jsou
                return $result;
                
            } catch (Exception $e) {
                throw new Exception('Chyba při načítání sazeb z INSYZ: ' . $e->getMessage());
            }
        });
    }

    public function submitReportToInsyz(string $xmlData, string $uzivatel): array
    {
        // Uložit XML pro kontrolu při testování
        $xmlDir = $this->kernel->getProjectDir() . '/var/xml-exports';
        if (!is_dir($xmlDir)) {
            mkdir($xmlDir, 0755, true);
        }

        $filename = sprintf('report-%s-%s.xml',
            $uzivatel,
            date('Ymd-His')
        );
        $filepath = $xmlDir . '/' . $filename;
        file_put_contents($filepath, $xmlData);

        if ($this->useTestData()) {
            // V testovacím režimu pouze simulujeme úspěšné odeslání
            return [
                'success' => true,
                'message' => 'Test mode: Hlášení bylo simulovaně odesláno do INSYZ',
                'xml_length' => strlen($xmlData),
                'xml_file' => $filename,
                'user' => $uzivatel,
                'timestamp' => date('Y-m-d H:i:s')
            ];
        }

        // Volání stored procedure trasy.ZP_Zapis_XML s pojmenovanými parametry
        return $this->connect("trasy.ZP_Zapis_XML", [
            '@Data_XML' => $xmlData,
            '@Uzivatel' => $uzivatel
        ]);
    }

    private function getTestData(): array
    {
        if ($this->testData === null) {
            $file = $this->kernel->getProjectDir() . '/var/testdata.json';
            if (file_exists($file)) {
                $this->testData = json_decode(file_get_contents($file), true);
            } else {
                $this->testData = [];
            }
        }

        return $this->testData;
    }

    private function useTestData(): bool
    {
        return $_ENV['USE_TEST_DATA'] === 'true';
    }
}