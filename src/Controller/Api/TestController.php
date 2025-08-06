<?php

namespace App\Controller\Api;

use App\Service\InsyzService;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/test')]
class TestController extends AbstractController
{
	public function __construct(
		private InsyzService $insyzService
	) {}

	#[Route('/insyz-user', methods: ['GET'])]
	public function getInsyzUser(): JsonResponse
	{
		try {
			$user = $this->insyzService->getUser(4133);
			return new JsonResponse($user);
		} catch (Exception $e) {
			return new JsonResponse(['error' => $e->getMessage()], 500);
		}
	}

	#[Route('/insyz-prikazy', methods: ['GET'])]
	public function getInsyzPrikazy(): JsonResponse
	{
		try {
			$prikazy = $this->insyzService->getPrikazy(4133, 2025);
			return new JsonResponse($prikazy);
		} catch (Exception $e) {
			return new JsonResponse(['error' => $e->getMessage()], 500);
		}
	}

	#[Route('/mssql-connection', methods: ['GET'])]
	public function testMSSQLConnection(): JsonResponse
	{
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
			$host = $_ENV['INSYS_DB_HOST'] ?? 'not_set';
			$dbname = $_ENV['INSYS_DB_NAME'] ?? 'not_set';
			$username = $_ENV['INSYS_DB_USER'] ?? 'not_set';
			$password = $_ENV['INSYS_DB_PASS'] ?? 'not_set';

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
		$data = json_decode($request->getContent(), true);
		$email = $data['email'] ?? null;
		$hash = $data['hash'] ?? null;

		if (!$email || !$hash) {
			return new JsonResponse([
				'status' => 'error',
				'message' => 'Missing email or hash parameter'
			], 400);
		}

		try {
			$useTestData = $_ENV['USE_TEST_DATA'] ?? 'true';
			
			$result = [
				'status' => 'debug',
				'config' => [
					'USE_TEST_DATA' => $useTestData,
					'email' => $email,
					'hash_length' => strlen($hash)
				]
			];

			// Test login through InsysService
			$intAdr = $this->insyzService->loginUser($email, $hash);
			
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
					'hash_length' => strlen($hash)
				]
			], 500);
		}
	}
}