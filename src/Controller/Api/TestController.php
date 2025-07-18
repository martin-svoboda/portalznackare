<?php

namespace App\Controller\Api;

use App\Service\InsysService;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/test')]
class TestController extends AbstractController
{
	public function __construct(
		private InsysService $insysService
	) {}

	#[Route('/insys-user', methods: ['GET'])]
	public function getInsysUser(): JsonResponse
	{
		try {
			$user = $this->insysService->getUser(4133);
			return new JsonResponse($user);
		} catch (Exception $e) {
			return new JsonResponse(['error' => $e->getMessage()], 500);
		}
	}

	#[Route('/insys-prikazy', methods: ['GET'])]
	public function getInsysPrikazy(): JsonResponse
	{
		try {
			$prikazy = $this->insysService->getPrikazy(4133, 2025);
			return new JsonResponse($prikazy);
		} catch (Exception $e) {
			return new JsonResponse(['error' => $e->getMessage()], 500);
		}
	}
}