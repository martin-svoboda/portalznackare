<?php

namespace App\Service;

use Exception;
use Symfony\Component\HttpKernel\KernelInterface;

class InsysService
{
    private ?array $testData = null;

    public function __construct(
        private MssqlConnector $connector,
        private KernelInterface $kernel
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

        return $this->connect("trasy.ZNACKAR_DETAIL", [$intAdr]);
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

        return $this->connect("trasy.PRIKAZY_SEZNAM", [$intAdr, $year ?? date('Y')]);
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

        $result = $this->connect("trasy.ZP_Detail", [$id], true);

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