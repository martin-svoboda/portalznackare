<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use App\Service\InsysService;

class MockMSSQLService
{
	private ?array $testData = null;

	public function __construct(
		private LoggerInterface $logger,
		private string $projectDir,
		private InsysService $insysService
	) {}

	public function loginUser(string $email, string $hash): int
	{
		$this->logger->info('Mock MSSQL login', ['email' => $email]);

		// Simuluj úspěšné přihlášení
		if ($email && $hash) {
			return 4133; // Test INT_ADR
		}

		throw new \RuntimeException('Chyba přihlášení');
	}

	public function getUser(int $intAdr): array
	{
		// Zkusit načíst z endpoint struktury
		$data = $this->loadMockDataFromEndpoint('api/insys/user', [(string)$intAdr]);
		if ($data !== null) {
			return $data;
		}
		
		// Fallback na starou strukturu
		$testData = $this->getTestData();
		return $testData['user'] ?? [];
	}

	/**
	 * Získání uživatele podle INT_ADR - použije stejná data jako InsysService
	 */
	public function getUserByIntAdr(string $intAdr): ?array
	{
		try {
			// Použije stejná test data jako InsysService
			$userData = $this->insysService->getUser((int)$intAdr);
			
			if (empty($userData)) {
				return null;
			}
			
			// Pokud je pole uživatelů, vezmi prvního
			if (is_array($userData) && isset($userData[0])) {
				$user = $userData[0];
			} else {
				$user = $userData;
			}
			
			// Standardizovat formát pro AuthController
			return [
				'INT_ADR' => (string)$user['INT_ADR'],
				'Jmeno' => $user['Jmeno'] ?? $user['JMENO'] ?? '',
				'Prijmeni' => $user['Prijmeni'] ?? $user['PRIJMENI'] ?? '',
				'Email' => $user['eMail'] ?? $user['EMAIL'] ?? '',
				'Prukaz_znackare' => $user['Prukaz_znackare'] ?? $user['PRUKAZ_ZNACKARE'] ?? ''
			];
			
		} catch (\Exception $e) {
			$this->logger->error('Chyba při načítání uživatele z InsysService', [
				'int_adr' => $intAdr,
				'error' => $e->getMessage()
			]);
			return null;
		}
	}

	/**
	 * Autentizace uživatele - použije test data a jednoduché ověření
	 */
	public function authenticateUser(string $username, string $password): ?array
	{
		$this->logger->info('Mock MSSQL authentication', ['username' => $username]);
		
		try {
			// Získej test data ze stejného zdroje jako InsysService
			$userData = $this->insysService->getUser(4133); // Test user INT_ADR
			
			if (empty($userData)) {
				return null;
			}
			
			// Pokud je pole uživatelů, vezmi prvního
			if (is_array($userData) && isset($userData[0])) {
				$user = $userData[0];
			} else {
				$user = $userData;
			}
			
			// Jednoduché ověření - přijmout test/test123 nebo email uživatele
			$validCredentials = (
				($username === 'test' && $password === 'test123') ||
				($username === ($user['eMail'] ?? '') && $password === 'test123') ||
				($username === (string)($user['INT_ADR'] ?? '') && $password === 'test123')
			);
			
			if ($validCredentials) {
				// Standardizovat formát
				return [
					'INT_ADR' => (string)$user['INT_ADR'],
					'Jmeno' => $user['Jmeno'] ?? '',
					'Prijmeni' => $user['Prijmeni'] ?? '',
					'Email' => $user['eMail'] ?? '',
					'Prukaz_znackare' => $user['Prukaz_znackare'] ?? ''
				];
			}
			
		} catch (\Exception $e) {
			$this->logger->error('Chyba při autentizaci', [
				'username' => $username,
				'error' => $e->getMessage()
			]);
		}
		
		// Neplatné přihlašovací údaje
		return null;
	}

	public function getPrikazy(int $intAdr, int $year): array
	{
		// Zkusit načíst z endpoint struktury
		$data = $this->loadMockDataFromEndpoint('api/insys/prikazy', [$intAdr . '-' . $year]);
		if ($data !== null) {
			return $data;
		}
		
		// Fallback na starou strukturu
		$testData = $this->getTestData();
		return $testData['prikazy'][$year] ?? [];
	}

	public function getPrikaz(int $intAdr, int $id): array
	{
		// Zkusit načíst z endpoint struktury
		$data = $this->loadMockDataFromEndpoint('api/insys/prikaz', [(string)$id]);
		if ($data !== null) {
			return $data;
		}
		
		// Fallback na starou strukturu
		$testData = $this->getTestData();
		$detail = $testData['detaily'][$id] ?? null;

		if (!$detail) {
			throw new \RuntimeException('Chybí detail pro ID ' . $id);
		}

		return $detail;
	}
	
	/**
	 * Načte mock data podle struktury endpointu
	 */
	private function loadMockDataFromEndpoint(string $endpoint, array $filenames): ?array
	{
		// Sestavit cestu k složce
		$path = $this->projectDir . '/var/mock-data/' . $endpoint;
		
		// Pokud jsou zadané konkrétní názvy souborů, hledat je
		if (!empty($filenames)) {
			foreach ($filenames as $filename) {
				$filepath = $path . '/' . $filename . '.json';
				
				if (file_exists($filepath)) {
					$data = json_decode(file_get_contents($filepath), true);
					return $data ?: null;
				}
			}
		}
		
		// Zkusit načíst data.json jako fallback
		$filepath = $path . '/data.json';
		if (file_exists($filepath)) {
			$data = json_decode(file_get_contents($filepath), true);
			return $data ?: null;
		}
		
		return null;
	}

	private function getTestData(): array
	{
		if ($this->testData === null) {
			$file = $this->projectDir . '/var/testdata.json';
			if (file_exists($file)) {
				$this->testData = json_decode(file_get_contents($file), true);
			} else {
				$this->testData = $this->getDefaultTestData();
			}
		}
		return $this->testData;
	}

	private function getDefaultTestData(): array
	{
		// Výchozí test data pokud soubor neexistuje
		return [
			'user' => [
				'INT_ADR' => 4133,
				'JMENO' => 'Test',
				'PRIJMENI' => 'Značkař',
				'EMAIL' => 'test@znackar.cz',
				'PRUKAZ_ZNACKARE' => 'ZN4133'
			],
			'prikazy' => [
				2025 => [
					[
						'ID_Znackarske_Prikazy' => 1,
						'CISLO_ZP' => 'ZP001/2025',
						'NAZEV' => 'Údržba značení - Krkonoše',
						'DATUM_OD' => '2025-01-15',
						'DATUM_DO' => '2025-01-20'
					]
				]
			],
			'detaily' => [
				1 => [
					'head' => [
						'ID_Znackarske_Prikazy' => 1,
						'CISLO_ZP' => 'ZP001/2025',
						'INT_ADR_1' => 4133
					],
					'predmety' => [],
					'useky' => []
				]
			]
		];
	}
}