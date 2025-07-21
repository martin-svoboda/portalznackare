<?php

namespace App\Controller\Api;

use App\Service\InsysService;
use App\Service\DataEnricherService;
use App\Entity\User;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/insys')]
class InsysController extends AbstractController
{
    public function __construct(
        private InsysService $insysService,
        private DataEnricherService $dataEnricher
    ) {
    }

    #[Route('/login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        
        if (!isset($data['email']) || !isset($data['hash'])) {
            return new JsonResponse(['message' => 'Vyžadované parametry: email, hash'], 400);
        }

        try {
            $intAdr = $this->insysService->loginUser($data['email'], $data['hash']);
            
            return new JsonResponse([
                'success' => true,
                'int_adr' => $intAdr
            ]);
        } catch (Exception $e) {
            return new JsonResponse(['message' => $e->getMessage()], 401);
        }
    }

    #[Route('/user', methods: ['GET'])]
    public function getInsysUser(Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $intAdr = $user->getIntAdr();

        try {
            $userData = $this->insysService->getUser((int) $intAdr);
            
            return new JsonResponse($userData);
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    #[Route('/prikazy', methods: ['GET'])]
    public function getPrikazy(Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $year = $request->query->get('year');
        $intAdr = $user->getIntAdr();

        try {
            $prikazy = $this->insysService->getPrikazy((int) $intAdr, $year ? (int) $year : null);
            
            // Obohatí data o HTML komponenty
            $enrichedPrikazy = $this->dataEnricher->enrichPrikazyList($prikazy);
            
            return new JsonResponse($enrichedPrikazy);
        } catch (Exception $e) {
            return new JsonResponse(['message' => $e->getMessage()], 500);
        }
    }

    #[Route('/prikaz/{id}', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function getPrikaz(int $id): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $intAdr = $user->getIntAdr();

        try {
            $prikaz = $this->insysService->getPrikaz((int) $intAdr, $id);
            
            // Obohatí detail o HTML komponenty
            $enrichedPrikaz = $this->dataEnricher->enrichPrikazDetail($prikaz);
            
            return new JsonResponse($enrichedPrikaz);
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    #[Route('/ceniky', methods: ['GET'])]
    public function getCeniky(Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $date = $request->query->get('date');
        
        try {
            // Mock data pro ceníky - v produkci by se načítalo z INSYS
            $ceniky = [
                'jizdne' => 6,
                'jizdneZvysene' => 8,
                'tarifDobaOd1' => 0,
                'tarifDobaDo1' => 4,
                'tarifStravne1' => 0,
                'tarifNahrada1' => 0,
                'tarifDobaOd2' => 4,
                'tarifDobaDo2' => 5,
                'tarifStravne2' => 0,
                'tarifNahrada2' => 150,
                'tarifDobaOd3' => 5,
                'tarifDobaDo3' => 8,
                'tarifStravne3' => 160,
                'tarifNahrada3' => 150,
                'tarifDobaOd4' => 8,
                'tarifDobaDo4' => 12,
                'tarifStravne4' => 160,
                'tarifNahrada4' => 300,
                'tarifDobaOd5' => 12,
                'tarifDobaDo5' => 18,
                'tarifStravne5' => 250,
                'tarifNahrada5' => 300,
                'tarifDobaOd6' => 18,
                'tarifDobaDo6' => 24,
                'tarifStravne6' => 390,
                'tarifNahrada6' => 300,
                'date' => $date ?: date('Y-m-d')
            ];
            
            return new JsonResponse($ceniky);
        } catch (Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 500);
        }
    }
}