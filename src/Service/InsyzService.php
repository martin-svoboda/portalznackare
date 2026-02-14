<?php

namespace App\Service;

use App\Entity\User;
use Exception;
use Symfony\Component\HttpKernel\KernelInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

class InsyzService
{

    public function __construct(
        private MssqlConnector $connector,
        private KernelInterface $kernel,
        private ApiCacheService $cacheService,
        private InsyzAuditLogger $insyzAuditLogger,
        private TokenStorageInterface $tokenStorage
    ) {
    }

    /**
     * Centralizované volání MSSQL procedur s automatickým audit logováním
     *
     * @param string $procedure Název stored procedure
     * @param array $args Parametry pro proceduru
     * @param bool $multiple Zda volat multiple recordsets
     * @param int|null $explicitIntAdr Explicitní INT_ADR pro logování (pokud známe ale nejsme authenticated)
     */
    public function connect(string $procedure, array $args, bool $multiple = false, ?int $explicitIntAdr = null): array
    {
        $startTime = microtime(true);
        // Použij explicitní INT_ADR pokud je předán, jinak zkus získat z tokenu
        $intAdr = $explicitIntAdr ?? $this->getCurrentUserIntAdr();

        try {
            if ($multiple) {
                $result = $this->connector->callProcedureMultiple($procedure, $args);
            } else {
                $result = $this->connector->callProcedure($procedure, $args);
            }

            // Detekuj prázdný result = technicky úspěch, ale logicky failure
            $isEmpty = empty($result);
            $errorMessage = $isEmpty ? 'MSSQL returned empty result' : null;

            // Automatické logování s rozlišením prázdného výsledku
            $this->logInsyzCall($procedure, $procedure, $args, $result, $errorMessage, $startTime, $intAdr);
            return $result;

        } catch (\Exception $e) {
            // Automatické logování chyby
            $this->logInsyzCall($procedure, $procedure, $args, null, $e->getMessage(), $startTime, $intAdr);
            throw $e;
        }
    }

	/**
	 * Univerzální metoda pro načítání test dat s automatickým logováním
	 *
	 * @param string $endpoint Název endpointu/souboru
	 * @param array $params Parametry pro logování
	 * @param int|null $explicitIntAdr Explicitní INT_ADR pro logování (pokud známe ale nejsme authenticated)
	 */
	public function getTestData(string $endpoint, array $params, ?int $explicitIntAdr = null): array {
		$startTime = microtime(true);
		// Použij explicitní INT_ADR pokud je předán, jinak zkus získat z tokenu
		$intAdr = $explicitIntAdr ?? $this->getCurrentUserIntAdr();

		// Pro user a prikazy endpointy zkusit nejdřív konkrétní soubor
		$specificFile = $this->kernel->getProjectDir() . '/var/mock-data/api/insyz/' . $endpoint . '.json';

		if (file_exists($specificFile)) {
			$result = json_decode(file_get_contents($specificFile), true) ?: [];
			$error = null;
		} else {
			// Fallback na složkovou strukturu s data.json
			$genericFile = $this->kernel->getProjectDir() . '/var/mock-data/api/insyz/' . $endpoint . '/data.json';

			if (file_exists($genericFile)) {
				$result = json_decode(file_get_contents($genericFile), true) ?: [];
				$error = null;
			} else {
				$result = [];
				$error = "Mock data file not found: " . $endpoint . '.json nebo ' . $endpoint . '/data.json';
			}
		}

		$this->logInsyzCall($endpoint, 'TEST_DATA', $params, $result, $error, $startTime, $intAdr);

		return $result;
	}

    public function loginUser(string $email, string $password): int
    {
        $startTime = microtime(true);

        // Detekuj, zda password je už SHA1 hash (40 hex znaků) nebo plain text
        $isAlreadyHash = (strlen($password) === 40 && ctype_xdigit($password));

        if ($this->useTestData()) {
            // Test login logic - akceptuj plain text "test123" nebo jeho SHA1 hash pro všechny test účty
            $testPasswordHash = strtoupper(sha1('test123'));

            // Definuj test scénáře pro různé bezpečnostní kontroly
            $testAccounts = [
                'test@test.com' => [
                    "INT_ADR" => "4133",
                    "Platnost" => "OK",
                    "Platnost_DO" => "2026-09-02",
                    "Zablokovano" => "0",
                    "KontrolaPlatnostiPwdWEB" => "0"
                ],
                'test@blocked.com' => [
                    "INT_ADR" => "4134",
                    "Platnost" => "OK",
                    "Platnost_DO" => "2026-09-02",
                    "Zablokovano" => "1",  // ← Zablokovaný účet
                    "KontrolaPlatnostiPwdWEB" => "0"
                ],
                'test@expired.com' => [
                    "INT_ADR" => "4135",
                    "Platnost" => "OK",
                    "Platnost_DO" => "2020-01-01",  // ← Staré datum
                    "Zablokovano" => "0",
                    "KontrolaPlatnostiPwdWEB" => "1"  // ← Kontrola zapnuta
                ],
                'test@expired-nocheck.com' => [
                    "INT_ADR" => "4136",
                    "Platnost" => "OK",
                    "Platnost_DO" => "2020-01-01",  // ← Staré datum
                    "Zablokovano" => "0",
                    "KontrolaPlatnostiPwdWEB" => "0"  // ← Kontrola vypnuta → mělo by projít
                ],
                'test@invalid.com' => [
                    "INT_ADR" => "4137",
                    "Platnost" => "EXPIRED",  // ← Neplatné heslo
                    "Platnost_DO" => "2026-09-02",
                    "Zablokovano" => "0",
                    "KontrolaPlatnostiPwdWEB" => "0"
                ]
            ];

            // Zkontroluj, zda je email z test účtů a heslo je správné
            $isValidCredentials = isset($testAccounts[$email]) &&
                ($password === 'test123' || strtoupper($password) === $testPasswordHash);

            if ($isValidCredentials) {
	            $result = array( 0 => $testAccounts[$email] );

                try {
                    // Validuj bezpečnostní parametry
                    $this->validateLoginResponse($result[0]);

                    // Log successful test login
                    $this->logInsyzCall('login', 'trasy.WEB_Login',
                        ['@Email' => $email, '@WEBPwdHash' => '[HIDDEN]'],
                        $result,
                        null,
                        $startTime,
                        null  // intAdr is NULL during login attempt
                    );

	                return (int) $result[0]['INT_ADR'];

                } catch (Exception $e) {
                    // Loguj zamítnuté přihlášení s důvodem
                    $this->logInsyzCall('login', 'trasy.WEB_Login',
                        ['@Email' => $email, '@WEBPwdHash' => '[HIDDEN]'],
                        $result,
                        $e->getMessage(), // "Účet je zablokován" atd.
                        $startTime,
                        (int) $result[0]['INT_ADR'] // INT_ADR i když zamítnuto
                    );
                    throw $e;
                }
            }

            // Log failed test login attempt
            $this->logInsyzCall('login', 'trasy.WEB_Login',
                ['@Email' => $email, '@WEBPwdHash' => '[HIDDEN]'],
                [],
                'Invalid credentials',
                $startTime,
                null  // intAdr is NULL during login attempt
            );

            throw new Exception('Chyba přihlášení, zkontrolujte údaje a zkuste to znovu.');
        }

        // Pokud už je hash, použij přímo. Jinak vytvoř hash z plain textu.
        $hash = $isAlreadyHash ? strtoupper($password) : $this->createPasswordHash($password);

        $result = $this->connect("trasy.WEB_Login", [
            '@Email' => $email,
            '@WEBPwdHash' => $hash
        ]);

        if (isset($result[0]['INT_ADR'])) {
            try {
                // Validuj bezpečnostní parametry
                $this->validateLoginResponse($result[0]);

                return (int) $result[0]['INT_ADR'];

            } catch (Exception $e) {
                // Loguj zamítnuté přihlášení s důvodem
                // connect() už zalogoval success, teď loguj zamítnutí s důvodem
                $this->logInsyzCall('login', 'trasy.WEB_Login',
                    ['@Email' => $email, '@WEBPwdHash' => '[HIDDEN]'],
                    $result,
                    $e->getMessage(), // "Účet je zablokován" atd.
                    $startTime,
                    (int) $result[0]['INT_ADR'] // INT_ADR i když zamítnuto
                );
                throw $e;
            }
        }

        throw new Exception('Chyba přihlášení, zkontrolujte údaje a zkuste to znovu.');
    }

    /**
     * Validuje sílu hesla a vrací pole chybových hlášek (prázdné = validní)
     */
    public function validatePasswordStrength(string $password): array
    {
        $errors = [];

        if (strlen($password) < 8) {
            $errors[] = 'Heslo musí mít alespoň 8 znaků';
        }
        if (!preg_match('/[A-Z]/', $password)) {
            $errors[] = 'Heslo musí obsahovat alespoň 1 velké písmeno';
        }
        if (!preg_match('/[a-z]/', $password)) {
            $errors[] = 'Heslo musí obsahovat alespoň 1 malé písmeno';
        }
        if (!preg_match('/[0-9]/', $password)) {
            $errors[] = 'Heslo musí obsahovat alespoň 1 číslici';
        }
        if (!preg_match('/[!@#$%^&*()_+\-=\[\]{};\':"\\\\|,.<>\/?~`]/', $password)) {
            $errors[] = 'Heslo musí obsahovat alespoň 1 speciální znak';
        }

        return $errors;
    }

    /**
     * Vytvoří bezpečný hash hesla kompatibilní s MSSQL HASHBYTES('SHA1', @password)
     */
    public function createPasswordHash(string $password): string
    {
        // SHA1 hash - kompatibilní s MSSQL: HASHBYTES('SHA1', @password)
        // Ve formátu UPPER CASE HEX, jak vrací MSSQL
        return strtoupper(sha1($password));
    }

    /**
     * Získá kompletní multidataset uživatele z INSYZ
     * Vrací pole datasetů: [0] = hlavička uživatele, [1+] = další sekce
     */
    public function getUser(int $intAdr): array
    {
        if ($this->useTestData()) {
            // Mock data už jsou ve správném formátu multidatasetu
            // Předej INT_ADR explicitně pro logování (důležité během login flow)
            return $this->getTestData('user/' . $intAdr, [$intAdr], $intAdr);
        }

        return $this->cacheService->getCachedUserData($intAdr, function($intAdr) {
            // Předej INT_ADR explicitně pro logování (důležité během login flow)
            return $this->connect("trasy.ZNACKAR_DETAIL", [$intAdr], true, $intAdr);
        });
    }

    /**
     * Získá pouze hlavičku uživatele (první dataset)
     * Pro zpětnou kompatibilitu a jednoduché použití
     */
    public function getUserHeader(int $intAdr): array
    {
        $datasets = $this->getUser($intAdr);

        // První dataset obsahuje hlavičku uživatele
        if (!empty($datasets) && isset($datasets[0]) && isset($datasets[0][0])) {
            return $datasets[0][0];
        }

        throw new Exception('Nepodařilo se načíst data uživatele pro INT_ADR: ' . $intAdr);
    }

    public function getPrikazy(int $intAdr, ?int $year = null): array
    {
        $yearParam = $year ?? date('Y');

        if ($this->useTestData()) {
            return $this->getTestData('prikazy/' . $intAdr . '-' . $yearParam, [$intAdr, $yearParam]);
        }

        return $this->cacheService->getCachedPrikazy($intAdr, $year, function($intAdr, $year) {
            return $this->connect("trasy.PRIKAZY_SEZNAM", [$intAdr, $year ?? date('Y')]);
        });
    }

    public function getPrikaz(int $intAdr, int $id): array
    {
        if ($this->useTestData()) {
            $result = $this->getTestData('prikaz/' . $id, [$id]);
            if (empty($result)) {
                throw new Exception('Chybí detail pro ID ' . $id);
            }

            // Ověřit, že uživatel má oprávnění k příkazu
            $head = $result['head'] ?? [];
            if (empty($head)) {
                throw new Exception('U tohoto příkazu se nenačetla žádná data v hlavičce.');
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

            return $result;
        }

        return $this->cacheService->getCachedPrikaz($intAdr, $id, function($intAdr, $prikazId) {
            $result = $this->connect("trasy.ZP_Detail", [$prikazId], true);

            // Zkontrolovat skutečnou strukturu
            if (!is_array($result) || empty($result)) {
                throw new Exception('MSSQL procedura nevrátila žádná data pro příkaz ' . $prikazId);
            }

            // Bezpečný přístup k vnořené struktuře
            if (!isset($result[0]) || !is_array($result[0]) || !isset($result[0][0])) {
                throw new Exception('U tohoto příkazu se nenačetla žádná data v hlavičce.');
            }

            $head = $result[0][0];

            if (empty($head)) {
                throw new Exception('U tohoto příkazu se nenačetla žádná data v hlavičce.');
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
        $datumParam = $datum ? date('Y-m-d', strtotime($datum)) : date('Y-m-d');

        if ($this->useTestData()) {
            return $this->getTestData('sazby/sazby', [$datumParam]);
        }

        return $this->cacheService->getCachedSazby($datum, function($datum) {
            // Příprava data ve formátu YYYY-MM-DD (poziční parametr)
            $datumProvedeni = $datum ? date('Y-m-d', strtotime($datum)) : date('Y-m-d');

            // Volat proceduru s multiple recordsets (jako ZP_Detail)
            $result = $this->connect("trasy.ZP_Sazby", [$datumProvedeni], true);

            // Zkontrolovat, zda procedura vrátila nějaká data
            if (empty($result) || !is_array($result)) {
                throw new Exception('MSSQL procedura trasy.ZP_Sazby nevrátila žádná data pro datum: ' . $datumProvedeni);
            }

            return $result;
        });
    }

    /**
     * Získá úseky pro značkařský příkaz
     */
    public function getZpUseky(int $idPrikazu): array
    {
        if ($this->useTestData()) {
            return $this->getTestData('zp-useky/' . $idPrikazu, [$idPrikazu]);
        }

        return $this->connect("trasy.ZP_Useky", [
            '@ID_Znackarske_prikazy' => $idPrikazu
        ]);
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
            $result = [
                'success' => true,
                'message' => 'Test mode: Hlášení bylo simulovaně odesláno do INSYZ',
                'xml_length' => strlen($xmlData),
                'xml_file' => $filename,
                'user' => $uzivatel,
                'timestamp' => date('Y-m-d H:i:s')
            ];

            $this->getTestData('submit', ['@Data_XML' => '[XML_TRUNCATED]', '@Uzivatel' => $uzivatel]);
            return $result;
        }

        // Volání stored procedure trasy.ZP_Zapis_XML s pojmenovanými parametry
        return $this->connect("trasy.ZP_Zapis_XML", [
            '@Data_XML' => $xmlData,
            '@Uzivatel' => $uzivatel
        ]);
    }


    private function useTestData(): bool
    {
        return $_ENV['USE_TEST_DATA'] === 'true';
    }

    /**
     * Získat INT_ADR aktuálně přihlášeného uživatele
     */
    private function getCurrentUserIntAdr(): ?int
    {
        $token = $this->tokenStorage->getToken();
        if ($token && $token->getUser() instanceof User) {
            return $token->getUser()->getIntAdr();
        }
        return null;
    }

    /**
     * Centrální INSYZ audit logging - jeden log pro každé volání
     */
    private function logInsyzCall(string $endpoint, string $procedure, array $params, ?array $result = null, ?string $error = null, ?float $startTime = null, ?int $intAdr = null): void
    {
        $this->insyzAuditLogger->logMssqlProcedureCall(
            endpoint: $endpoint,
            procedure: $procedure,
            params: $params,
            startTime: $startTime ?? microtime(true),
            intAdr: $intAdr,
            result: $result ? $this->createResultSummary($result) : null,
            error: $error
        );
    }

    /**
     * Create compact result summary for audit logging
     */
    private function createResultSummary(array $result): array
    {
        if (empty($result)) {
            return ['records' => 0, 'data' => 'empty'];
        }

        $recordCount = count($result);
        $summary = ['records' => $recordCount];

        // Mock data má strukturu {head: {}, predmety: [], useky: []}
        // Nebude to mít $result[0] jako obyčejný array
        if (isset($result['head'])) {
            $summary['structure'] = 'mock_data';
            $summary['sections'] = array_keys($result);
            // Pro mock data ukázat i sample z head
            if (!empty($result['head'])) {
                $summary['head_sample'] = $this->truncateRecord(is_array($result['head']) ? $result['head'] : []);
            }
            return $summary;
        }

        // Pro MSSQL data (array of arrays)
        if ($recordCount > 0 && is_array($result[0])) {
            $summary['columns'] = array_keys($result[0]);
            $summary['column_count'] = count($summary['columns']);

            // Vždy ukázat první 1-2 záznamy pro debugging
            $sampleSize = min(2, $recordCount);
            $summary['sample'] = array_map(
                [$this, 'truncateRecord'],
                array_slice($result, 0, $sampleSize)
            );

            // Pokud je jen jeden záznam, přidej i info o typech hodnot
            if ($recordCount === 1) {
                $summary['value_types'] = $this->getValueTypes($result[0]);
            }
        } else {
            $summary['structure'] = 'unknown';
            $summary['raw_sample'] = $this->truncateValue(json_encode($result));
        }

        return $summary;
    }

    /**
     * Truncate record data to prevent audit log bloat
     */
    private function truncateRecord(array $record): array
    {
        $truncated = [];

        foreach ($record as $key => $value) {
            $truncated[$key] = $this->truncateValue($value);
        }

        return $truncated;
    }

    /**
     * Truncate single value (string, array, etc.)
     */
    private function truncateValue(mixed $value, int $maxLength = 100): mixed
    {
        if (is_string($value) && strlen($value) > $maxLength) {
            return substr($value, 0, $maxLength) . '...[' . strlen($value) . ' chars]';
        }

        if (is_array($value)) {
            return '[array:' . count($value) . ' items]';
        }

        return $value;
    }

    /**
     * Get types of values in a record for debugging
     */
    private function getValueTypes(array $record): array
    {
        $types = [];

        foreach ($record as $key => $value) {
            $types[$key] = gettype($value);

            // Pro stringy přidej i délku
            if (is_string($value)) {
                $types[$key] .= '(' . strlen($value) . ')';
            }

            // Pro arrays přidej počet prvků
            if (is_array($value)) {
                $types[$key] .= '(' . count($value) . ')';
            }
        }

        return $types;
    }


    /**
     * Aktualizuje heslo uživatele s ověřením starého hesla a validací nového
     */
    public function updatePassword(int $intAdr, string $email, string $oldPassword, string $newPassword): array
    {
        // 1. Ověřit staré heslo přes loginUser (vyhodí Exception pokud nesedí)
        try {
            $this->loginUser($email, $oldPassword);
        } catch (Exception $e) {
            throw new Exception('Nesprávné současné heslo');
        }

        // 2. Validovat sílu nového hesla
        $errors = $this->validatePasswordStrength($newPassword);
        if (!empty($errors)) {
            throw new Exception('Nové heslo nesplňuje požadavky: ' . implode(', ', $errors));
        }

        // 3. Vytvořit hash nového hesla
        $passwordHash = $this->createPasswordHash($newPassword);

        // 4. Zapsat nové heslo
        if ($this->useTestData()) {
            $result = [
                'success' => true,
                'message' => 'Heslo bylo úspěšně aktualizováno (TEST MODE)',
                'int_adr' => $intAdr
            ];
            $this->getTestData('web-zapis-pwd', ['@INT_ADR' => $intAdr, '@WEBPwdHash' => '[HIDDEN]']);
            return $result;
        }

        $result = $this->connect("trasy.WEB_Zapis_Pwd", [
            '@INT_ADR' => $intAdr,
            '@WEBPwdHash' => $passwordHash
        ]);

        return $result;
    }

    /**
     * Získá systémové parametry
     */
    public function getSystemParameters(): array
    {
        if ($this->useTestData()) {
            return $this->getTestData('system-parameters', []);
        }

        // Volat proceduru bez parametrů
        $result = $this->connect("trasy.WEB_SystemoveParametry", []);

        if (empty($result) || !is_array($result)) {
            throw new Exception('MSSQL procedura trasy.WEB_SystemoveParametry nevrátila žádná data');
        }

        return $result;
    }

    /**
     * Validuje bezpečnostní parametry z WEB_Login odpovědi
     *
     * @param array $loginData Data z WEB_Login (jeden řádek)
     * @throws Exception Pokud účet nesplňuje bezpečnostní požadavky
     */
    private function validateLoginResponse(array $loginData): void
    {
        // 1. Je účet zablokován?
        if (isset($loginData['Zablokovano']) && $loginData['Zablokovano'] !== '0') {
            throw new Exception('Účet je zablokován. Kontaktujte správce.');
        }

        // 2. Má se kontrolovat platnost hesla?
        if (isset($loginData['KontrolaPlatnostiPwdWEB']) && $loginData['KontrolaPlatnostiPwdWEB'] !== '0') {
            // ANO - kontroluj datum platnosti
            if (isset($loginData['Platnost_DO'])) {
                $platnostDo = \DateTime::createFromFormat('Y-m-d', $loginData['Platnost_DO']);
                $dnes = new \DateTime('today');

                if ($platnostDo && $platnostDo < $dnes) {
                    throw new Exception('Platnost hesla vypršela. Kontaktujte správce.');
                }
            }
        }
        // NE - přeskočit kontrolu data

        // 3. Je heslo platné?
        if (isset($loginData['Platnost']) && $loginData['Platnost'] !== 'OK') {
            throw new Exception('Heslo není platné. Kontaktujte správce.');
        }
    }
}