<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use App\Entity\User;

#[Route('/api/auth')]
class AuthController extends AbstractController
{

    #[Route('/status', name: 'api_auth_status', methods: ['GET'])]
    public function status(): JsonResponse
    {
        // Vždy používat Symfony Security
        $user = $this->getUser();
        
        if (!$user instanceof User) {
            return new JsonResponse([
                'authenticated' => false,
                'user' => null
            ]);
        }

        try {
            $userData = [
                'INT_ADR' => $user->getIntAdr(),
                'Jmeno' => $user->getJmeno(),
                'Prijmeni' => $user->getPrijmeni(),
                'Email' => $user->getEmail(),
                'roles' => $user->getRoles()
            ];

            return new JsonResponse([
                'authenticated' => true,
                'user' => $userData
            ]);
            
        } catch (\Exception $e) {
            return new JsonResponse([
                'authenticated' => false,
                'user' => null,
                'error' => 'Chyba při načítání uživatele'
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/login', name: 'api_auth_login', methods: ['POST'])]
    public function login(): JsonResponse
    {
        // Symfony Security automaticky zpracuje přihlášení
        // díky InsysAuthenticator - tento endpoint slouží pouze pro redirect po úspěšném přihlášení
        $user = $this->getUser();
        
        if (!$user instanceof User) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Přihlášení se nezdařilo'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $userData = [
            'INT_ADR' => $user->getIntAdr(),
            'Jmeno' => $user->getJmeno(),
            'Prijmeni' => $user->getPrijmeni(),
            'Email' => $user->getEmail(),
            'roles' => $user->getRoles()
        ];

        return new JsonResponse([
            'success' => true,
            'user' => $userData,
            'message' => 'Přihlášení bylo úspěšné'
        ]);
    }

    #[Route('/logout', name: 'api_auth_logout', methods: ['POST'])]
    public function logout(): JsonResponse
    {
        // Symfony Security automaticky zneplatní autentizaci
        // díky konfiguraci v security.yaml na řádku 22-23
        return new JsonResponse([
            'success' => true,
            'message' => 'Odhlášení bylo úspěšné'
        ]);
    }

}