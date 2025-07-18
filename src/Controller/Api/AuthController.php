<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use App\Service\MockMSSQLService;

#[Route('/api/auth')]
class AuthController extends AbstractController
{
    public function __construct(
        private MockMSSQLService $mssqlService
    ) {}

    #[Route('/status', name: 'api_auth_status', methods: ['GET'])]
    public function status(SessionInterface $session): JsonResponse
    {
        // Zkontrolovat jestli je uživatel přihlášen v session
        $intAdr = $session->get('int_adr');
        
        if (!$intAdr) {
            return new JsonResponse([
                'authenticated' => false,
                'user' => null
            ]);
        }

        try {
            // Načíst data uživatele z INSYS
            $userData = $this->mssqlService->getUserByIntAdr($intAdr);
            
            if (!$userData) {
                // Uživatel neexistuje, vyčistit session
                $session->remove('int_adr');
                $session->remove('user_roles');
                
                return new JsonResponse([
                    'authenticated' => false,
                    'user' => null
                ]);
            }

            // Přidat role z session
            $roles = $session->get('user_roles', []);
            $userData['roles'] = $roles;

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
    public function login(Request $request, SessionInterface $session): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($username) || empty($password)) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Uživatelské jméno a heslo jsou povinné'
            ], Response::HTTP_BAD_REQUEST);
        }

        try {
            // Ověřit přihlašovací údaje přes INSYS
            $userData = $this->mssqlService->authenticateUser($username, $password);
            
            if (!$userData) {
                return new JsonResponse([
                    'success' => false,
                    'message' => 'Neplatné přihlašovací údaje'
                ], Response::HTTP_UNAUTHORIZED);
            }

            // Určit role uživatele
            $roles = $this->determineUserRoles($userData);
            
            // Uložit do session
            $session->set('int_adr', $userData['INT_ADR']);
            $session->set('user_roles', $roles);
            
            
            // Přidat role do odpovědi
            $userData['roles'] = $roles;

            return new JsonResponse([
                'success' => true,
                'user' => $userData,
                'message' => 'Přihlášení bylo úspěšné'
            ]);
            
        } catch (\Exception $e) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Chyba při přihlašování'
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/logout', name: 'api_auth_logout', methods: ['POST'])]
    public function logout(SessionInterface $session): JsonResponse
    {
        // Vyčistit všechny autentizační údaje ze session
        $session->remove('int_adr');
        $session->remove('user_roles');
        
        // Případně invalidovat celou session
        // $session->invalidate();

        return new JsonResponse([
            'success' => true,
            'message' => 'Odhlášení bylo úspěšné'
        ]);
    }

    /**
     * Určí role uživatele na základě jeho údajů
     */
    private function determineUserRoles(array $userData): array
    {
        $roles = ['ROLE_USER']; // Základní role pro všechny uživatele
        
        // Zde můžete implementovat logiku pro určení admin práv
        // Například na základě konkrétních INT_ADR hodnot nebo jiných kritérií
        
        // Příklad: administrátoři podle INT_ADR
        $adminIntAdrs = [
            '12345', // Příklad admin INT_ADR
            '67890', // Další admin INT_ADR
            // Přidejte další podle potřeby
        ];
        
        if (in_array($userData['INT_ADR'], $adminIntAdrs)) {
            $roles[] = 'ROLE_ADMIN';
        }
        
        // Případně můžete přidat další role podle potřeby
        // Například vedoucí skupin, regionální správci atd.
        
        return $roles;
    }
}