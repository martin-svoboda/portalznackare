<?php

namespace App\Controller\Api;

use App\Repository\UserRepository;
use App\Service\AuditLogger;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/auth', name: 'api_auth_')]
class AuthApiController extends AbstractController
{
    public function __construct(
        private UserRepository $userRepository,
        private AuditLogger $auditLogger
    ) {}

    /**
     * Získat informace o současném uživateli
     */
    #[Route('/me', methods: ['GET'], name: 'me')]
    #[IsGranted('ROLE_USER')]
    public function me(): JsonResponse
    {
        $currentUser = $this->getUser();
        
        if (!$currentUser) {
            return $this->json(['error' => 'User not authenticated'], Response::HTTP_UNAUTHORIZED);
        }

        // Získat User entitu z databáze pro úplné informace
        $user = null;
        if (method_exists($currentUser, 'getIntAdr')) {
            $user = $this->userRepository->findByIntAdr($currentUser->getIntAdr());
        }

        if (!$user) {
            // Fallback - používáme data ze session
            return $this->json([
                'int_adr' => method_exists($currentUser, 'getIntAdr') ? $currentUser->getIntAdr() : null,
                'email' => method_exists($currentUser, 'getEmail') ? $currentUser->getEmail() : null,
                'jmeno' => method_exists($currentUser, 'getJmeno') ? $currentUser->getJmeno() : null,
                'prijmeni' => method_exists($currentUser, 'getPrijmeni') ? $currentUser->getPrijmeni() : null,
                'roles' => $currentUser->getRoles(),
                'from_session' => true,
                'database_user_found' => false,
            ]);
        }

        return $this->json([
            'user' => $user,
            'permissions' => [
                'can_manage_users' => $this->isGranted('ROLE_ADMIN'),
                'can_view_audit_logs' => $this->isGranted('ROLE_ADMIN'),
                'can_manage_system_options' => $this->isGranted('ROLE_ADMIN'),
                'can_export_data' => $this->isGranted('ROLE_SUPER_ADMIN'),
                'is_super_admin' => $this->isGranted('ROLE_SUPER_ADMIN'),
            ],
            'from_session' => false,
            'database_user_found' => true,
        ], Response::HTTP_OK, [], ['groups' => ['user:read']]);
    }

    // ✅ OPRAVA: Odebráno - konflikt s AuthController::status()
    // Použij místo toho /api/auth/me pro detailní info o uživateli

    // ✅ OPRAVA: Logout se řeší přes AuthController
    // pro konzistenci s ostatními auth operacemi
}