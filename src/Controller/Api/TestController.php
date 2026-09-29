<?php

namespace App\Controller\Api;

use App\Entity\User;
use App\Service\InsyzService;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Diagnostické endpointy – jen pro adminy (session) a CI health check
 * (hlavička X-Healthcheck-Token = CI_HEALTHCHECK_TOKEN z .env.local serveru).
 * Firewall je pouští bez přihlášení (CI nemá session), ověření je zde.
 */
#[Route('/api/test')]
class TestController extends AbstractController
{
	public function __construct(
		private InsyzService $insyzService,
		private string $ciHealthcheckToken
	) {}

	private function denyUnlessAdminOrCi(Request $request): ?JsonResponse
	{
		$user = $this->getUser();
		if ($user instanceof User && ($user->hasRole('ROLE_ADMIN') || $user->hasRole('ROLE_SUPER_ADMIN'))) {
			return null;
		}

		// Prázdný token (nenastavený v .env.local) nic neodemkne
		$token = (string) $request->headers->get('X-Healthcheck-Token', '');
		if ($this->ciHealthcheckToken !== '' && hash_equals($this->ciHealthcheckToken, $token)) {
			return null;
		}

		return new JsonResponse(['error' => 'Přístup odepřen'], 403);
	}

	#[Route('/insyz-user', methods: ['GET'])]
	public function getInsyzUser(Request $request): JsonResponse
	{
		if ($denied = $this->denyUnlessAdminOrCi($request)) {
			return $denied;
		}

		try {
			$user = $this->insyzService->getUser(5620);
			return new JsonResponse($user);
		} catch (Exception $e) {
			return new JsonResponse(['error' => $e->getMessage()], 500);
		}
	}

	#[Route('/insyz-prikazy', methods: ['GET'])]
	public function getInsyzPrikazy(Request $request): JsonResponse
	{
		if ($denied = $this->denyUnlessAdminOrCi($request)) {
			return $denied;
		}

		try {
			$prikazy = $this->insyzService->getPrikazy(5620, 2026);
			return new JsonResponse($prikazy);
		} catch (Exception $e) {
			return new JsonResponse(['error' => $e->getMessage()], 500);
		}
	}

	#[Route('/mssql-connection', methods: ['GET'])]
	public function testMSSQLConnection(Request $request): JsonResponse
	{
		if ($denied = $this->denyUnlessAdminOrCi($request)) {
			return $denied;
		}

		$useTestData = $_ENV['USE_TEST_DATA'] ?? 'true';
		
		if ($useTestData === 'true') {
			return new JsonResponse([
				'status' => 'test_mode',
				'message' => 'Using test data, MSSQL not tested',
				'config' => [
					'USE_TEST_DATA' => $useTestData
				]
			]);
		}

		try {
			// Test MSSQL connection parameters
			$host = $_ENV['INSYZ_DB_HOST'] ?? 'not_set';
			$dbname = $_ENV['INSYZ_DB_NAME'] ?? 'not_set';
			$username = $_ENV['INSYZ_DB_USER'] ?? 'not_set';
			$password = $_ENV['INSYZ_DB_PASS'] ?? 'not_set';

			$config = [
				'host' => $host,
				'dbname' => $dbname,
				'username' => $username,
				'password' => $password ? '***masked***' : 'not_set'
			];

			// Test actual connection
			$dsn = "sqlsrv:Server={$host};Database={$dbname}";
			$pdo = new \PDO($dsn, $username, $password);
			$pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

			// Test simple query
			$stmt = $pdo->query("SELECT 1 as test");
			$result = $stmt->fetch();

			return new JsonResponse([
				'status' => 'success',
				'message' => 'MSSQL connection successful',
				'config' => $config,
				'test_query' => $result
			]);

		} catch (Exception $e) {
			return new JsonResponse([
				'status' => 'error',
				'message' => 'MSSQL connection failed: ' . $e->getMessage(),
				'config' => $config ?? []
			], 500);
		}
	}

	#[Route('/login-test', methods: ['POST'])]
	public function testLogin(Request $request): JsonResponse
	{
		if ($denied = $this->denyUnlessAdminOrCi($request)) {
			return $denied;
		}

		$data = json_decode($request->getContent(), true);
		$email = $data['email'] ?? null;
		$password = $data['hash'] ?? $data['password'] ?? null;

		if (!$email || !$password) {
			return new JsonResponse([
				'status' => 'error',
				'message' => 'Missing email or password parameter'
			], 400);
		}

		try {
			$useTestData = $_ENV['USE_TEST_DATA'] ?? 'true';
			
			$result = [
				'status' => 'debug',
				'config' => [
					'USE_TEST_DATA' => $useTestData,
					'email' => $email,
					'password_length' => strlen($password)
				]
			];

			// Test login through InsyzService
			$intAdr = $this->insyzService->loginUser($email, $password);
			
			$result['login_result'] = [
				'success' => true,
				'int_adr' => $intAdr
			];

			return new JsonResponse($result);

		} catch (Exception $e) {
			return new JsonResponse([
				'status' => 'error',
				'message' => $e->getMessage(),
				'config' => [
					'USE_TEST_DATA' => $useTestData ?? 'unknown',
					'email' => $email,
					'password_length' => strlen($password)
				]
			], 500);
		}
	}
}