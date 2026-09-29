<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use App\Entity\User;
use App\EventListener\ApiCsrfListener;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

#[Route('/api/auth')]
class AuthController extends AbstractController
{
    /**
     * Nový API token pro aktuální session – volá ho obal fetch v layoutu, když token
     * po vypršení session přestane platit (odpověď 403 + X-CSRF-Invalid). Výjimka
     * v ApiCsrfListener; cizí web odpověď nepřečte (CORS).
     */
    #[Route('/csrf-token', name: 'api_auth_csrf_token', methods: ['GET'])]
    public function csrfToken(CsrfTokenManagerInterface $csrfTokenManager): JsonResponse
    {
        return new JsonResponse([
            'token' => $csrfTokenManager->getToken(ApiCsrfListener::TOKEN_ID)->getValue(),
        ], Response::HTTP_OK, ['Cache-Control' => 'no-store']);
    }

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
        // díky InsyzAuthenticator - tento endpoint slouží pouze pro redirect po úspěšném přihlášení
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

    #[Route('/logout', name: 'api_auth_logout')]
    public function logout(): void
    {
        // Tento method se nikdy nespustí - Symfony Security ho přebírá
        throw new \Exception('Tato metoda by měla být přebrána Symfony firewall-em.');
    }

}