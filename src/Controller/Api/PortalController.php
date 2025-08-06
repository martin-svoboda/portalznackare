<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Messenger\MessageBusInterface;
use App\Service\MockMSSQLService;
use App\Entity\User;
use App\Entity\Report;
use App\Repository\ReportRepository;
use App\Enum\ReportStateEnum;
use App\Message\SendToInsyzMessage;
use Doctrine\ORM\EntityManagerInterface;

#[Route('/api/portal')]
class PortalController extends AbstractController
{
    public function __construct(
        private MockMSSQLService $mssqlService,
        private ReportRepository $reportRepository,
        private EntityManagerInterface $entityManager,
        private MessageBusInterface $messageBus
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
                        'znackari' => $report->getTeamMembers(),
                        'data_a' => $report->getDataA(),
                        'data_b' => $report->getDataB(),
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
                $missingFields = [];
                foreach ($requiredFields as $field) {
                    if (!isset($data[$field])) {
                        $missingFields[] = $field;
                    }
                }
                
                if (!empty($missingFields)) {
                    // Pro validační chyby nepotřebujeme report, jen logování
                    error_log("Portal Report POST - Validation failed - missing fields: " . implode(', ', $missingFields));
                    
                    return new JsonResponse([
                        'error' => "Chybí povinné pole: " . implode(', ', $missingFields)
                    ], Response::HTTP_BAD_REQUEST);
                }

                // Zkontrolovat, zda už existuje hlášení pro tento příkaz
                $report = $this->reportRepository->findOneBy(['idZp' => (int)$data['id_zp']]);
                $isNewReport = false;
                
                if (!$report) {
                    // Vytvořit nové hlášení
                    $report = new Report();
                    $report->setIdZp((int)$data['id_zp']);
                    $report->setIntAdr($intAdr);
                    $isNewReport = true;
                }
                
                // Uložit původní stav pro porovnání
                $previousState = $report->getState()->value ?? 'draft';
                
                // Nastavit/aktualizovat data
                $report->setCisloZp($data['cislo_zp']);
                $report->setTeamMembers($data['znackari'] ?? []);
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
                
                // Přidat history entries
                if ($isNewReport) {
                    $report->addHistoryEntry(
                        'report_created',
                        $intAdr,
                        'Hlášení vytvořeno',
                        ['cislo_zp' => $data['cislo_zp']]
                    );
                }
                
                // History pro změnu dat
                $report->addHistoryEntry(
                    $state === 'draft' ? 'draft_saved' : 'data_updated',
                    $intAdr,
                    $state === 'draft' ? 'Koncept uložen' : 'Data aktualizována',
                    ['sections' => ['data_a', 'data_b', 'calculation', 'znackari']]
                );
                
                // Dispatch asynchronní zpracování pro odeslání ke schválení
                if ($state === 'send' && $previousState !== 'send') {
                    // Uložit základní history entry
                    $report->addHistoryEntry(
                        'dispatch_to_insyz',
                        $intAdr,
                        'Hlášení připraveno k odesílání do INSYZ',
                        ['previous_state' => $previousState]
                    );
                }
                
                // History pro změnu stavu
                if ($previousState !== $state && $state !== 'send') {
                    $report->addHistoryEntry(
                        'state_changed',
                        $intAdr,
                        "Stav změněn z '{$previousState}' na '{$state}'",
                        ['from' => $previousState, 'to' => $state]
                    );
                }
                
                // Uložit do databáze
                $this->entityManager->persist($report);
                $this->entityManager->flush();

                // Dispatch asynchronní zpracování pro INSYZ (pouze při odesílání)
                if ($state === 'send' && $previousState !== 'send') {
                    $message = new SendToInsyzMessage(
                        $report->getId(),
                        [
                            'id_zp' => $report->getIdZp(),
                            'cislo_zp' => $report->getCisloZp(),
                            'znackari' => $report->getTeamMembers(),
                            'data_a' => $report->getDataA(),
                            'data_b' => $report->getDataB(),
                            'calculation' => $report->getCalculation()
                        ],
                        $this->getParameter('kernel.environment')
                    );
                    
                    $this->messageBus->dispatch($message);
                }

                return new JsonResponse([
                    'success' => true,
                    'message' => 'Hlášení bylo úspěšně uloženo',
                    'data' => [
                        'id' => $report->getId(),
                        'id_zp' => $report->getIdZp(),
                        'cislo_zp' => $report->getCisloZp(),
                        'int_adr' => $report->getIntAdr(),
                        'znackari' => $report->getTeamMembers(),
                        'data_a' => $report->getDataA(),
                        'data_b' => $report->getDataB(),
                        'calculation' => $report->getCalculation(),
                        'state' => $report->getState()->value,
                        'date_send' => $report->getDateSend()?->format('Y-m-d H:i:s'),
                        'date_created' => $report->getDateCreated()->format('Y-m-d H:i:s'),
                        'date_updated' => $report->getDateUpdated()->format('Y-m-d H:i:s')
                    ]
                ]);
                
            } catch (\Doctrine\DBAL\Exception\UniqueConstraintViolationException $e) {
                error_log("Portal Report POST - Unique constraint violation: " . $e->getMessage());
                
                // History pro duplicate error (pokud máme report)
                if (isset($report) && $report instanceof Report) {
                    $report->addHistoryEntry(
                        'error_occurred',
                        $intAdr,
                        'Pokus o duplicitní vytvoření hlášení',
                        ['error_type' => 'DUPLICATE_REPORT', 'error_message' => $e->getMessage()]
                    );
                    try {
                        $this->entityManager->persist($report);
                        $this->entityManager->flush();
                    } catch (\Exception $historyError) {
                        error_log("Failed to save history entry: " . $historyError->getMessage());
                    }
                }
                
                return new JsonResponse([
                    'success' => false,
                    'error' => 'Hlášení pro tento příkaz už existuje a je v procesu zpracování.',
                    'error_code' => 'DUPLICATE_REPORT'
                ], Response::HTTP_CONFLICT);
            } catch (\Doctrine\DBAL\Exception\ConnectionException $e) {
                error_log("Portal Report POST - Database connection error: " . $e->getMessage());
                return new JsonResponse([
                    'success' => false,
                    'error' => 'Chyba připojení k databázi. Zkuste to prosím znovu za chvíli.',
                    'error_code' => 'DATABASE_CONNECTION_ERROR'
                ], Response::HTTP_SERVICE_UNAVAILABLE);
            } catch (\Doctrine\DBAL\Exception $e) {
                error_log("Portal Report POST - Database error: " . $e->getMessage());
                return new JsonResponse([
                    'success' => false,
                    'error' => 'Chyba při ukládání do databáze. Zkontrolujte prosím data a zkuste znovu.',
                    'error_code' => 'DATABASE_ERROR',
                    'details' => $e->getMessage()
                ], Response::HTTP_INTERNAL_SERVER_ERROR);
            } catch (\InvalidArgumentException $e) {
                error_log("Portal Report POST - Invalid argument: " . $e->getMessage());
                return new JsonResponse([
                    'success' => false,
                    'error' => 'Neplatná data v hlášení: ' . $e->getMessage(),
                    'error_code' => 'INVALID_DATA'
                ], Response::HTTP_BAD_REQUEST);
            } catch (\Exception $e) {
                error_log("Portal Report POST - Unexpected error: " . $e->getMessage());
                error_log("Portal Report POST - Exception trace: " . $e->getTraceAsString());
                
                // History pro neočekávané chyby (pokud máme report)
                if (isset($report) && $report instanceof Report) {
                    $report->addHistoryEntry(
                        'error_occurred',
                        $intAdr,
                        'Neočekávaná chyba při ukládání',
                        ['error_type' => 'UNEXPECTED_ERROR', 'error_message' => $e->getMessage()]
                    );
                    try {
                        $this->entityManager->persist($report);
                        $this->entityManager->flush();
                    } catch (\Exception $historyError) {
                        error_log("Failed to save history entry: " . $historyError->getMessage());
                    }
                }
                
                return new JsonResponse([
                    'success' => false,
                    'error' => 'Neočekávaná chyba při ukládání hlášení. Kontaktujte prosím administrátora.',
                    'error_code' => 'UNEXPECTED_ERROR',
                    'details' => $e->getMessage()
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