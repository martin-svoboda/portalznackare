<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Messenger\MessageBusInterface;
use App\Entity\User;
use App\Entity\Report;
use App\Repository\ReportRepository;
use App\Enum\ReportStateEnum;
use App\Message\SendToInsyzMessage;
use App\MessageHandler\SendToInsyzHandler;
use App\Service\WorkerManagerService;
use App\Service\UserPreferenceService;
use App\Utils\Logger;
use Doctrine\ORM\EntityManagerInterface;
use App\Service\AttachmentLookupService;

#[Route('/api/portal')]
class PortalController extends AbstractController
{
    public function __construct(
        private ReportRepository $reportRepository,
        private EntityManagerInterface $entityManager,
        private MessageBusInterface $messageBus,
        private WorkerManagerService $workerManager,
        private SendToInsyzHandler $insyzHandler,
        private AttachmentLookupService $attachmentService,
        private UserPreferenceService $userPreferenceService
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
                        'data_a' => $report->getEnrichedDataA($this->attachmentService),
                        'data_b' => $report->getEnrichedDataB($this->attachmentService),
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
                // Nastavit database timeout pro dlouhé operace
                $this->entityManager->getConnection()->executeStatement('SET statement_timeout = \'30s\'');
                
                // Validace dat
                $requiredFields = ['id_zp', 'cislo_zp', 'data_a', 'data_b'];
                $missingFields = [];
                foreach ($requiredFields as $field) {
                    if (!isset($data[$field])) {
                        $missingFields[] = $field;
                    }
                }
                
                if (!empty($missingFields)) {
                    Logger::info("Portal Report POST - Validation failed - missing fields: " . implode(', ', $missingFields));
                    
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
                Logger::debug("PortalController: state='$state', previousState='$previousState'");
                if ($state === 'send' && $previousState !== 'send') {
                    Logger::info("PortalController: Spouštím dispatch do INSYZ pro report ID: " . $report->getId());
                    
                    // Debug data před odesláním
                    $dataA = $report->getDataA();
                    try {
                        $debugFile = __DIR__ . '/../../var/debug-portal-controller.txt';
                        $debugContent = "=== PORTAL CONTROLLER DEBUG ===\n";
                        $debugContent .= "Timestamp: " . date('Y-m-d H:i:s') . "\n";
                        $debugContent .= "Report ID: " . $report->getId() . "\n\n";
                        
                        // Raw SQL query pro porovnání
                        $conn = $this->entityManager->getConnection();
                        $sql = "SELECT data_a FROM reports WHERE id = :id";
                        $stmt = $conn->prepare($sql);
                        $result = $stmt->executeQuery(['id' => $report->getId()]);
                        $rawData = $result->fetchOne();
                        $rawDataA = json_decode($rawData, true);
                        
                        $debugContent .= "=== RAW DATABASE DATA ===\n";
                        if (isset($rawDataA['Noclezne'])) {
                            foreach ($rawDataA['Noclezne'] as $idx => $item) {
                                $debugContent .= "RAW Noclezne[$idx]: Prilohy=" . json_encode($item['Prilohy'] ?? null) . "\n";
                            }
                        }
                        
                        $debugContent .= "\n=== ENTITY DATA ===\n";
                        if (isset($dataA['Noclezne'])) {
                            foreach ($dataA['Noclezne'] as $idx => $item) {
                                $debugContent .= "ENTITY Noclezne[$idx]: Prilohy=" . json_encode($item['Prilohy'] ?? null) . "\n";
                            }
                        }
                        if (isset($dataA['Vedlejsi_Vydaje'])) {
                            foreach ($dataA['Vedlejsi_Vydaje'] as $idx => $item) {
                                $debugContent .= "ENTITY Vedlejsi_Vydaje[$idx]: Prilohy=" . json_encode($item['Prilohy'] ?? null) . "\n";
                            }
                        }
                        @file_put_contents($debugFile, $debugContent);
                    } catch (\Exception $e) {
                        // Ignore debug errors
                        @file_put_contents($debugFile, "ERROR: " . $e->getMessage());
                    }
                    
                    $message = new SendToInsyzMessage(
                        $report->getId(),
                        [
                            'id_zp' => $report->getIdZp(),
                            'cislo_zp' => $report->getCisloZp(),
                            'znackari' => $report->getTeamMembers(),
                            'data_a' => $dataA,
                            'data_b' => $report->getDataB(),
                            'calculation' => $report->getCalculation()
                        ],
                        $this->getParameter('kernel.environment')
                    );
                    
                    $this->messageBus->dispatch($message);
                    Logger::debug("PortalController: Message dispatched");
                    
                    // Pokus o spuštění on-demand worker
                    $workerStarted = $this->workerManager->startSingleTaskWorker();
                    Logger::debug("PortalController: Worker started: " . ($workerStarted ? 'SUCCESS' : 'FAILED'));
                    
                    // LIGHTWEIGHT: Vždy použít fallback pro garantovanou spolehlivost
                    // Worker v DDEV/containerech není 100% spolehlivý
                    Logger::debug("PortalController: Using sync processing for reliability");
                    try {
                        // Přímo zavolat handler pro okamžité zpracování
                        $this->insyzHandler->__invoke($message);
                        Logger::info("PortalController: Report successfully processed for INSYZ");
                    } catch (\Exception $e) {
                        Logger::error("PortalController: Sync processing failed: " . $e->getMessage());
                    }
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
                        'data_a' => $report->getEnrichedDataA($this->attachmentService),
                        'data_b' => $report->getEnrichedDataB($this->attachmentService),
                        'calculation' => $report->getCalculation(),
                        'state' => $report->getState()->value,
                        'date_send' => $report->getDateSend()?->format('Y-m-d H:i:s'),
                        'date_created' => $report->getDateCreated()->format('Y-m-d H:i:s'),
                        'date_updated' => $report->getDateUpdated()->format('Y-m-d H:i:s')
                    ]
                ]);
                
            } catch (\Doctrine\DBAL\Exception\UniqueConstraintViolationException $e) {
                Logger::error("Portal Report POST - Unique constraint violation: " . $e->getMessage());
                
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
                        Logger::error("Failed to save history entry: " . $historyError->getMessage());
                    }
                }
                
                return new JsonResponse([
                    'success' => false,
                    'error' => 'Hlášení pro tento příkaz už existuje a je v procesu zpracování.',
                    'error_code' => 'DUPLICATE_REPORT'
                ], Response::HTTP_CONFLICT);
            } catch (\Doctrine\DBAL\Exception\ConnectionException $e) {
                Logger::error("Portal Report POST - Database connection error: " . $e->getMessage());
                return new JsonResponse([
                    'success' => false,
                    'error' => 'Chyba připojení k databázi. Zkuste to prosím znovu za chvíli.',
                    'error_code' => 'DATABASE_CONNECTION_ERROR'
                ], Response::HTTP_SERVICE_UNAVAILABLE);
            } catch (\Doctrine\DBAL\Exception $e) {
                Logger::error("Portal Report POST - Database error: " . $e->getMessage());
                return new JsonResponse([
                    'success' => false,
                    'error' => 'Chyba při ukládání do databáze. Zkontrolujte prosím data a zkuste znovu.',
                    'error_code' => 'DATABASE_ERROR',
                    'details' => $e->getMessage()
                ], Response::HTTP_INTERNAL_SERVER_ERROR);
            } catch (\InvalidArgumentException $e) {
                Logger::error("Portal Report POST - Invalid argument: " . $e->getMessage());
                return new JsonResponse([
                    'success' => false,
                    'error' => 'Neplatná data v hlášení: ' . $e->getMessage(),
                    'error_code' => 'INVALID_DATA'
                ], Response::HTTP_BAD_REQUEST);
            } catch (\Exception $e) {
                Logger::exception("Portal Report POST - Unexpected error", $e);
                
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
                        Logger::error("Failed to save history entry: " . $historyError->getMessage());
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

    /**
     * Získání preferencí uživatele
     */
    #[Route('/user/preferences', name: 'api_portal_user_preferences', methods: ['GET'])]
    public function getUserPreferences(): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Nepřihlášený uživatel'], Response::HTTP_UNAUTHORIZED);
        }

        try {
            $preferences = $this->userPreferenceService->getUserPreferencesWithDefaults($user);

            return new JsonResponse([
                'preferences' => $preferences
            ]);
        } catch (\Exception $e) {
            return new JsonResponse([
                'error' => 'Chyba při načítání preferencí: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Aktualizace preferencí uživatele
     */
    #[Route('/user/preferences', name: 'api_portal_user_preferences_update', methods: ['PUT'])]
    public function updateUserPreferences(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Nepřihlášený uživatel'], Response::HTTP_UNAUTHORIZED);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data) || !isset($data['preferences'])) {
            return new JsonResponse(['error' => 'Chybí parametr preferences'], Response::HTTP_BAD_REQUEST);
        }

        $errors = [];
        $updated = 0;

        foreach ($data['preferences'] as $key => $value) {
            if ($this->userPreferenceService->updateUserPreference($user, $key, $value)) {
                $updated++;
            } else {
                $errors[] = "Neplatná preference: {$key}";
            }
        }

        if (!empty($errors) && $updated === 0) {
            return new JsonResponse([
                'error' => 'Žádná preference nebyla aktualizována',
                'details' => $errors
            ], Response::HTTP_BAD_REQUEST);
        }

        return new JsonResponse([
            'success' => true,
            'message' => "Aktualizováno {$updated} preferencí",
            'errors' => $errors
        ]);
    }

    /**
     * Aktualizace jedné preference
     */
    #[Route('/user/preferences/{key}', name: 'api_portal_user_preference_single', methods: ['PUT'])]
    public function updateSingleUserPreference(string $key, Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Nepřihlášený uživatel'], Response::HTTP_UNAUTHORIZED);
        }

        $data = json_decode($request->getContent(), true);
        if (!isset($data['value'])) {
            return new JsonResponse(['error' => 'Chybí parametr value'], Response::HTTP_BAD_REQUEST);
        }

        if ($this->userPreferenceService->updateUserPreference($user, $key, $data['value'])) {
            // Ověř že se hodnota skutečně uložila
            $updatedUser = $this->entityManager->getRepository(User::class)->find($user->getId());
            $actualValue = $updatedUser->getPreference($key);

            return new JsonResponse([
                'success' => true,
                'message' => "Preference {$key} byla aktualizována",
                'actual_value' => $actualValue
            ]);
        }

        return new JsonResponse([
            'error' => "Neplatná preference {$key} nebo hodnota"
        ], Response::HTTP_BAD_REQUEST);
    }


}