<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use App\Service\MockMSSQLService;
use App\Entity\User;

#[Route('/api/portal')]
class PortalController extends AbstractController
{
    public function __construct(
        private MockMSSQLService $mssqlService
    ) {}
    #[Route('/post', methods: ['GET'])]
    public function getPost(Request $request): JsonResponse
    {
        // TODO: Implementovat získání obsahu stránky/příspěvku
        return new JsonResponse([
            'message' => 'Endpoint /post není zatím implementován - bude implementován v další fázi'
        ], 501);
    }

    #[Route('/metodika', methods: ['GET'])]
    public function getMetodika(Request $request): JsonResponse
    {
        // TODO: Implementovat získání metodik
        return new JsonResponse([
            'message' => 'Endpoint /metodika není zatím implementován - bude implementován v další fázi'
        ], 501);
    }

    #[Route('/metodika-terms', methods: ['GET'])]
    public function getMetodikaTerms(Request $request): JsonResponse
    {
        // TODO: Implementovat získání kategorií metodik
        return new JsonResponse([
            'message' => 'Endpoint /metodika-terms není zatím implementován - bude implementován v další fázi'
        ], 501);
    }

    #[Route('/downloads', methods: ['GET'])]
    public function getDownloads(Request $request): JsonResponse
    {
        // TODO: Implementovat získání souborů ke stažení
        return new JsonResponse([
            'message' => 'Endpoint /downloads není zatím implementován - bude implementován v další fázi'
        ], 501);
    }

    #[Route('/report', name: 'api_portal_report', methods: ['GET', 'POST'])]
    public function report(Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }
        
        $intAdr = $user->getIntAdr();

        if ($request->isMethod('GET')) {
            // Načíst existující hlášení
            $idZp = $request->query->get('id_zp');
            
            if (!$idZp) {
                return new JsonResponse([
                    'error' => 'Chybí parametr id_zp'
                ], Response::HTTP_BAD_REQUEST);
            }

            try {
                // Mock data - v produkci by se načítalo z databáze
                // Pro nyní vracíme prázdnou odpověď (žádné hlášení neexistuje)
                // Pokud by hlášení existovalo, vrátili bychom:
                /*
                $reportData = [
                    'id_zp' => (int)$idZp,
                    'int_adr' => $intAdr,
                    'state' => 'draft', // draft, send
                    'data_a' => null, // Data části A
                    'data_b' => null, // Data části B
                    'calculation' => null, // Výpočet náhrad
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ];
                return new JsonResponse($reportData);
                */
                
                // Žádné hlášení neexistuje - vrátíme null s HTTP 200
                return new JsonResponse(null);
                
            } catch (\Exception $e) {
                return new JsonResponse([
                    'error' => 'Chyba při načítání hlášení'
                ], Response::HTTP_INTERNAL_SERVER_ERROR);
            }
        }

        if ($request->isMethod('POST')) {
            // Uložit/odeslat hlášení
            $data = json_decode($request->getContent(), true);
            
            if (!$data) {
                return new JsonResponse([
                    'error' => 'Neplatná data'
                ], Response::HTTP_BAD_REQUEST);
            }

            try {
                // Validace dat
                $requiredFields = ['id_zp', 'cislo_zp', 'data_a', 'data_b'];
                foreach ($requiredFields as $field) {
                    if (!isset($data[$field])) {
                        return new JsonResponse([
                            'error' => "Chybí povinné pole: {$field}"
                        ], Response::HTTP_BAD_REQUEST);
                    }
                }

                // Mock uložení - v produkci by se ukládalo do databáze
                $reportData = [
                    'id' => uniqid(),
                    'id_zp' => $data['id_zp'],
                    'cislo_zp' => $data['cislo_zp'],
                    'int_adr' => $intAdr,
                    'je_vedouci' => $data['je_vedouci'] ?? false,
                    'data_a' => $data['data_a'],
                    'data_b' => $data['data_b'],
                    'calculation' => $data['calculation'],
                    'state' => $data['state'] ?? 'draft',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ];

                return new JsonResponse([
                    'success' => true,
                    'message' => 'Hlášení bylo úspěšně uloženo',
                    'data' => $reportData
                ]);
                
            } catch (\Exception $e) {
                return new JsonResponse([
                    'error' => 'Chyba při ukládání hlášení'
                ], Response::HTTP_INTERNAL_SERVER_ERROR);
            }
        }

        return new JsonResponse([
            'error' => 'Nepodporovaná metoda'
        ], Response::HTTP_METHOD_NOT_ALLOWED);
    }

    #[Route('/prikaz', name: 'api_portal_prikaz', methods: ['GET'])]
    public function prikaz(Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $id = $request->query->get('id');
        
        if (!$id) {
            return new JsonResponse([
                'error' => 'Chybí parametr id'
            ], Response::HTTP_BAD_REQUEST);
        }

        try {
            $intAdr = $user->getIntAdr();
            $prikazData = $this->mssqlService->getPrikaz((int)$intAdr, (int)$id);
            return new JsonResponse($prikazData);
            
        } catch (\Exception $e) {
            return new JsonResponse([
                'error' => 'Chyba při načítání příkazu: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}