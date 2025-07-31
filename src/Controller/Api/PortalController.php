<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use App\Service\MockMSSQLService;
use App\Entity\User;
use App\Entity\Report;
use App\Repository\ReportRepository;
use App\Enum\ReportStateEnum;
use Doctrine\ORM\EntityManagerInterface;

#[Route('/api/portal')]
class PortalController extends AbstractController
{
    public function __construct(
        private MockMSSQLService $mssqlService,
        private ReportRepository $reportRepository,
        private EntityManagerInterface $entityManager
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
            $requestedIntAdr = $request->query->get('int_adr');
            
            if (!$idZp) {
                return new JsonResponse([
                    'error' => 'Chybí parametr id_zp'
                ], Response::HTTP_BAD_REQUEST);
            }

            try {
                // Načíst hlášení z databáze pouze podle id_zp
                $report = $this->reportRepository->findOneBy(['idZp' => (int)$idZp]);
                
                if ($report) {
                    return new JsonResponse([
                        'id' => $report->getId(),
                        'id_zp' => $report->getIdZp(),
                        'cislo_zp' => $report->getCisloZp(),
                        'int_adr' => $report->getIntAdr(),
                        'team_members' => $report->getTeamMembers(),
                        'dataA' => $report->getDataA(),
                        'dataB' => $report->getDataB(),
                        'calculation' => $report->getCalculation(),
                        'state' => $report->getState()->value,
                        'date_send' => $report->getDateSend()?->format('Y-m-d H:i:s'),
                        'date_created' => $report->getDateCreated()->format('Y-m-d H:i:s'),
                        'date_updated' => $report->getDateUpdated()->format('Y-m-d H:i:s')
                    ]);
                }
                
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

                // Zkontrolovat, zda už existuje hlášení pro tento příkaz
                $report = $this->reportRepository->findOneBy(['idZp' => (int)$data['id_zp']]);
                
                if (!$report) {
                    // Vytvořit nové hlášení
                    $report = new Report();
                    $report->setIdZp((int)$data['id_zp']);
                    $report->setIntAdr($intAdr);
                }
                
                // Nastavit/aktualizovat data
                $report->setCisloZp($data['cislo_zp']);
                $report->setTeamMembers($data['team_members'] ?? []);
                $report->setDataA($data['data_a'] ?? []);
                $report->setDataB($data['data_b'] ?? []);
                $report->setCalculation($data['calculation'] ?? []);
                
                // Nastavit stav
                $state = $data['state'] ?? 'draft';
                $reportState = match ($state) {
                    'send' => ReportStateEnum::SEND,
                    'approved' => ReportStateEnum::APPROVED,
                    'rejected' => ReportStateEnum::REJECTED,
                    default => ReportStateEnum::DRAFT
                };
                $report->setState($reportState);
                
                // Uložit do databáze
                $this->entityManager->persist($report);
                $this->entityManager->flush();

                return new JsonResponse([
                    'success' => true,
                    'message' => 'Hlášení bylo úspěšně uloženo',
                    'data' => [
                        'id' => $report->getId(),
                        'id_zp' => $report->getIdZp(),
                        'cislo_zp' => $report->getCisloZp(),
                        'int_adr' => $report->getIntAdr(),
                        'team_members' => $report->getTeamMembers(),
                        'data_a' => $report->getDataA(),
                        'data_b' => $report->getDataB(),
                        'calculation' => $report->getCalculation(),
                        'state' => $report->getState()->value,
                        'date_send' => $report->getDateSend()?->format('Y-m-d H:i:s'),
                        'date_created' => $report->getDateCreated()->format('Y-m-d H:i:s'),
                        'date_updated' => $report->getDateUpdated()->format('Y-m-d H:i:s')
                    ]
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