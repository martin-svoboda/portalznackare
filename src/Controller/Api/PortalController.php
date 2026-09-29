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
use App\Exception\PrikazAccessDeniedException;
use App\Message\SendToInsyzMessage;
use App\Service\InsyzService;
use App\Service\UserPreferenceService;
use App\Service\PdfGeneratorService;
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
        private AttachmentLookupService $attachmentService,
        private UserPreferenceService $userPreferenceService,
        private PdfGeneratorService $pdfGenerator,
        private InsyzService $insyzService
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

            $prikaz = $this->nactiPrikazSOverenim($user, (int)$idZp);
            if ($prikaz instanceof JsonResponse) {
                return $prikaz;
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

            if (empty($data['id_zp'])) {
                return new JsonResponse([
                    'error' => 'Chybí povinné pole: id_zp'
                ], Response::HTTP_BAD_REQUEST);
            }

            $prikaz = $this->nactiPrikazSOverenim($user, (int)$data['id_zp']);
            if ($prikaz instanceof JsonResponse) {
                return $prikaz;
            }

            // Hlášení vyplňuje a odesílá vedoucí týmu (UI to jinak nedovolí); admin může vždy
            if (!$this->isAdmin($user) && !$this->jeVedouci($prikaz['head'] ?? [], $intAdr)) {
                return new JsonResponse([
                    'success' => false,
                    'error' => 'Hlášení může upravovat a odesílat jen vedoucí týmu.',
                    'error_code' => 'NOT_LEADER'
                ], Response::HTTP_FORBIDDEN);
            }

            // Přesměrování výplaty ({z_INT_ADR: na_INT_ADR}) jen mezi členy týmu příkazu – platí i pro admina
            $tym = $this->clenoveTymu($prikaz['head'] ?? []);
            foreach ((array) ($data['data_a']['Presmerovani_Vyplat'] ?? []) as $z => $na) {
                if (!in_array((int) ltrim((string) $z, '_'), $tym, true) || !in_array((int) $na, $tym, true)) {
                    return new JsonResponse([
                        'success' => false,
                        'error' => 'Výplatu lze přesměrovat jen mezi členy týmu příkazu.',
                        'error_code' => 'INVALID_REDIRECT'
                    ], Response::HTTP_BAD_REQUEST);
                }
            }

            // Klient smí hlášení jen uložit jako koncept nebo odeslat. Ostatní stavy
            // nastavuje výhradně systém (handler INSYZ) nebo admin přes admin API.
            $state = $data['state'] ?? 'draft';
            if (!in_array($state, ['draft', 'send'], true)) {
                return new JsonResponse([
                    'error' => 'Neplatný stav hlášení: ' . $state
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

                // Transakce + zámek řádku: souběžné uložení (dva členové týmu, dvojklik,
                // běžící odeslání v workeru) se serializuje, takže stav nejde přepsat
                // podle zastaralého čtení a hlášení nemůže odejít do INSYZ dvakrát.
                $this->entityManager->beginTransaction();
                try {
                    // Zkontrolovat, zda už existuje hlášení pro tento příkaz
                    $report = $this->reportRepository->findOneByIdZpForUpdate((int)$data['id_zp']);
                    $isNewReport = false;

                    // Odeslané hlášení už běžný uživatel měnit nesmí; admin může zasáhnout vždy
                    if ($report && !$this->isAdmin($user)
                        && !in_array($report->getState(), [ReportStateEnum::DRAFT, ReportStateEnum::REJECTED], true)
                    ) {
                        $this->entityManager->rollback();
                        return new JsonResponse([
                            'success' => false,
                            'error' => 'Hlášení je ve stavu „' . $report->getState()->getLabel() . '“ a už ho nelze upravovat.',
                            'error_code' => 'REPORT_NOT_EDITABLE',
                            'state' => $report->getState()->value
                        ], Response::HTTP_CONFLICT);
                    }

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

                    // Nastavit stav (povolené hodnoty ověřeny výše)
                    $report->setState($state === 'send' ? ReportStateEnum::SEND : ReportStateEnum::DRAFT);

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
                    $this->entityManager->commit();
                } catch (\Throwable $e) {
                    $this->entityManager->rollback();
                    throw $e;
                }

                // Dispatch asynchronní zpracování pro INSYZ (pouze při odesílání) –
                // až po commitu, aby worker viděl uložený stav 'send'
                Logger::debug("PortalController: state='$state', previousState='$previousState'");
                if ($state === 'send' && $previousState !== 'send') {
                    Logger::info("PortalController: Dispatch do INSYZ pro report ID: " . $report->getId());

                    $message = new SendToInsyzMessage(
                        $report->getId(),
                        [
                            'id_zp' => $report->getIdZp(),
                            'cislo_zp' => $report->getCisloZp(),
                            'znackari' => $report->getTeamMembers(),
                            'data_a' => $report->getDataA(),
                            'data_b' => $report->getDataB(),
                            'calculation' => $report->getCalculation(),
                            'submitted_by' => $intAdr, // kdo odeslal (aktuální uživatel)
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

    private function isAdmin(User $user): bool
    {
        return $user->hasRole('ROLE_ADMIN') || $user->hasRole('ROLE_SUPER_ADMIN');
    }

    /**
     * Hlášení je sdílené celým týmem příkazu, proto se oprávnění ověřuje
     * přes příkaz v INSYZ (INT_ADR* v hlavičce), ne přes autora hlášení.
     * Admin má přístup ke všem příkazům. Náhled přes insyz-hash a admin API
     * tento endpoint nepoužívají.
     *
     * @return JsonResponse|array Chybová odpověď, nebo data příkazu (head, …) pokud je přístup povolen
     */
    private function nactiPrikazSOverenim(User $user, int $idZp): JsonResponse|array
    {
        try {
            return $this->insyzService->getPrikaz($user->getIntAdr(), $idZp, $this->isAdmin($user));
        } catch (PrikazAccessDeniedException $e) {
            Logger::info("Portal Report - přístup odepřen: INT_ADR {$user->getIntAdr()}, id_zp {$idZp}");
            return new JsonResponse([
                'error' => $e->getMessage()
            ], Response::HTTP_FORBIDDEN);
        } catch (\Exception $e) {
            // Bez ověření oprávnění hlášení nevydáme ani neuložíme (fail-closed)
            Logger::error("Portal Report - nelze ověřit oprávnění k příkazu {$idZp}: " . $e->getMessage());
            return new JsonResponse([
                'error' => 'Nepodařilo se ověřit oprávnění k příkazu. Zkuste to prosím později.'
            ], Response::HTTP_SERVICE_UNAVAILABLE);
        }
    }

    /**
     * INT_ADR členů týmu z hlavičky příkazu (INT_ADR_1..3).
     *
     * @return int[]
     */
    private function clenoveTymu(array $head): array
    {
        $tym = [];
        for ($i = 1; $i <= 3; $i++) {
            if ((int) ($head["INT_ADR_$i"] ?? 0) > 0) {
                $tym[] = (int) $head["INT_ADR_$i"];
            }
        }

        return $tym;
    }

    /**
     * Je uživatel vedoucí týmu příkazu? Hlavička INSYZ: INT_ADR_{i} + Je_Vedouci{i} = "1".
     */
    private function jeVedouci(array $head, int $intAdr): bool
    {
        for ($i = 1; $i <= 3; $i++) {
            if ((int) ($head["INT_ADR_$i"] ?? 0) === $intAdr && (string) ($head["Je_Vedouci$i"] ?? '0') === '1') {
                return true;
            }
        }

        return false;
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

    /**
     * Generování kontrolního formuláře PDF pro příkaz
     */
    #[Route('/prikaz/{id}/control-form-pdf', name: 'api_portal_control_form_pdf', methods: ['GET'])]
    public function getControlFormPdf(int $id): Response
    {
        // Autentifikace
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        try {
            Logger::info('Generování kontrolního formuláře PDF', [
                'id_zp' => $id,
                'int_adr' => $user->getIntAdr()
            ]);

            // Vygenerovat PDF
            $isAdmin = in_array('ROLE_ADMIN', $user->getRoles());
            $pdfResult = $this->pdfGenerator->generateControlFormPdf($id, $user->getIntAdr(), $isAdmin);
            $pdfContent = $pdfResult['content'];

            // Název souboru z čísla příkazu a popisu
            // P/PS/O/26020 → P-PS-O-26020
            // "133604 PLASY KLÁŠTER - DVŮR LOMANY" → "plasy-klaster-dvur-lomany"
            $filename = 'kontrolni-hlaseni';
            if (!empty($pdfResult['cislo_zp'])) {
                $filename .= '_' . str_replace('/', '-', $pdfResult['cislo_zp']);
            }
            if (!empty($pdfResult['popis_zp'])) {
                // Odstranit HTML tagy (ikony dopravy apod.) a číslo na začátku
                $popis = strip_tags($pdfResult['popis_zp']);
                $popis = preg_replace('/^\d+\s*/', '', $popis);
                // Transliterace diakritiky, lowercase, nahradit ne-alfanumerické pomlčkou
                $popis = transliterator_transliterate('Any-Latin; Latin-ASCII', $popis);
                $popis = strtolower(trim($popis));
                $popis = preg_replace('/[^a-z0-9]+/', '-', $popis);
                $popis = trim($popis, '-');
                if ($popis !== '') {
                    $filename .= '_' . $popis;
                }
            }

            // Vytvořit response s PDF
            $response = new Response($pdfContent);
            $response->headers->set('Content-Type', 'application/pdf');
            $response->headers->set('Content-Disposition',
                'attachment; filename="' . $filename . '.pdf"'
            );

            Logger::info('Kontrolní formulář PDF úspěšně vygenerován', [
                'id_zp' => $id,
                'size' => strlen($pdfContent)
            ]);

            return $response;

        } catch (\Exception $e) {
            Logger::error('Chyba při generování PDF', [
                'id_zp' => $id,
                'error' => $e->getMessage()
            ]);

            return new JsonResponse([
                'error' => 'Chyba při generování PDF: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

}