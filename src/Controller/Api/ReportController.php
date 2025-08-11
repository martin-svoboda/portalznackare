<?php

namespace App\Controller\Api;

use App\Dto\ReportDto;
use App\Entity\Report;
use App\Entity\User;
use App\Enum\ReportStateEnum;
use App\Repository\ReportRepository;
use App\Service\AuditLogger;
use Doctrine\ORM\EntityManagerInterface;
use Exception;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/portal')]
class ReportController extends AbstractController
{
    public function __construct(
        private ReportRepository $reportRepository,
        private EntityManagerInterface $entityManager,
        private SerializerInterface $serializer,
        private ValidatorInterface $validator,
        private AuditLogger $auditLogger
    ) {
    }

    #[Route('/report', methods: ['GET'])]
    public function getReport(Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $idZp = $request->query->getInt('id_zp');

        // Validace vstupních parametrů
        if (empty($idZp)) {
            return new JsonResponse([
                'error' => 'Chybí povinný parametr id_zp'
            ], Response::HTTP_BAD_REQUEST);
        }

        try {
            // Najít report pouze podle id_zp (už není per user)
            $report = $this->reportRepository->findOneBy(['idZp' => $idZp]);

            if (!$report) {
                return new JsonResponse(null, Response::HTTP_NO_CONTENT);
            }

            // Serializace s podporou skupin
            $data = $this->serializer->serialize($report, 'json', [
                'groups' => ['report:read']
            ]);

            return new JsonResponse(json_decode($data), Response::HTTP_OK);

        } catch (Exception $e) {
            return new JsonResponse([
                'error' => 'Chyba při načítání hlášení: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/report', methods: ['POST'])]
    public function saveReport(Request $request): JsonResponse
    {
        // Použít Symfony Security
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        try {
            $data = json_decode($request->getContent(), true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                return new JsonResponse([
                    'error' => 'Neplatný JSON: ' . json_last_error_msg()
                ], Response::HTTP_BAD_REQUEST);
            }

            $intAdr = $user->getIntAdr();
            $idZp = $data['id_zp'] ?? null;

            // Validace základních parametrů
            if (empty($idZp)) {
                return new JsonResponse([
                    'error' => 'Chybí povinný parametr id_zp'
                ], Response::HTTP_BAD_REQUEST);
            }

            // Deserializace a validace DTO
            $reportDto = $this->serializer->deserialize(
                $request->getContent(), 
                ReportDto::class, 
                'json'
            );

            $violations = $this->validator->validate($reportDto);
            if (count($violations) > 0) {
                $errors = [];
                foreach ($violations as $violation) {
                    $errors[$violation->getPropertyPath()] = $violation->getMessage();
                }
                
                return new JsonResponse([
                    'error' => 'Chyby validace',
                    'violations' => $errors
                ], Response::HTTP_BAD_REQUEST);
            }

            // Najít existující report nebo vytvořit nový (pouze podle id_zp)
            $report = $this->reportRepository->findOneBy(['idZp' => $idZp]);
            
            $isNewReport = false;
            if (!$report) {
                $report = new Report();
                $report->setIdZp($idZp);
                $report->setIntAdr($intAdr); // Nastavit současného uživatele jako zpracovatele
                $isNewReport = true;
                
                // Přidat do historie vytvoření
                $report->addHistoryEntry(
                    'created',
                    $intAdr,
                    'Hlášení vytvořeno'
                );
                
                // Přidat prvního člena týmu
                $report->addTeamMember([
                    'int_adr' => $intAdr,
                    'jmeno' => $user->getJmeno(),
                    'je_vedouci' => true, // První člen je automaticky vedoucí
                    'data_a' => [],
                    'data_b' => []
                ]);
            }

            // Kontrola, zda lze report editovat
            if (!$report->isEditable()) {
                return new JsonResponse([
                    'error' => 'Hlášení nelze upravovat ve stavu: ' . $report->getState()->getLabel()
                ], Response::HTTP_FORBIDDEN);
            }

            // Mapování dat z DTO na entitu
            $this->mapDtoToEntity($data, $report, $user);

            // Přidat do historie změnu
            $report->addHistoryEntry(
                'data_updated',
                $intAdr,
                'Hlášení aktualizováno',
                ['updated_fields' => array_keys($data)]
            );

            // Uložení
            $this->reportRepository->save($report, true);

            // Audit logging
            if ($isNewReport) {
                $this->auditLogger->log(
                    action: 'report_create',
                    entityType: 'Report',
                    entityId: $report->getId(),
                    user: $user,
                    newValues: [
                        'id_zp' => $report->getIdZp(),
                        'cislo_zp' => $report->getCisloZp(),
                        'state' => $report->getState()->value,
                        'team_members_count' => count($report->getTeamMembers())
                    ]
                );
            } else {
                $this->auditLogger->log(
                    action: 'report_update',
                    entityType: 'Report', 
                    entityId: $report->getId(),
                    user: $user,
                    newValues: [
                        'updated_fields' => array_keys($data),
                        'current_state' => $report->getState()->value
                    ]
                );
            }

            // Vrácení aktualizované entity
            $responseData = $this->serializer->serialize($report, 'json', [
                'groups' => ['report:read']
            ]);

            return new JsonResponse(json_decode($responseData), Response::HTTP_OK);

        } catch (Exception $e) {
            return new JsonResponse([
                'error' => 'Chyba při ukládání hlášení: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/reports/user', methods: ['GET'])]
    public function getUserReports(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        $state = $request->query->get('state');
        $stateEnum = null;
        
        if ($state && ReportStateEnum::tryFrom($state)) {
            $stateEnum = ReportStateEnum::from($state);
        }

        try {
            $reports = $this->reportRepository->findByUser($user->getIntAdr(), $stateEnum);

            $data = $this->serializer->serialize($reports, 'json', [
                'groups' => ['report:read']
            ]);

            return new JsonResponse(json_decode($data), Response::HTTP_OK);

        } catch (Exception $e) {
            return new JsonResponse([
                'error' => 'Chyba při načítání seznamu hlášení: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/reports/statistics', methods: ['GET'])]
    public function getStatistics(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse([
                'error' => 'Nepřihlášený uživatel'
            ], Response::HTTP_UNAUTHORIZED);
        }

        try {
            $from = new \DateTimeImmutable($request->query->get('from', '-30 days'));
            $to = new \DateTimeImmutable($request->query->get('to', 'now'));

            $statistics = $this->reportRepository->getCompensationStatistics($from, $to);
            $summary = $this->reportRepository->getReportsSummaryByState();

            return new JsonResponse([
                'period' => [
                    'from' => $from->format('Y-m-d'),
                    'to' => $to->format('Y-m-d')
                ],
                'compensation' => $statistics,
                'summary' => $summary
            ]);

        } catch (Exception $e) {
            return new JsonResponse([
                'error' => 'Chyba při načítání statistik: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }


    /**
     * Map DTO data to entity
     */
    private function mapDtoToEntity(array $data, Report $report, User $user): void
    {
        if (isset($data['cislo_zp'])) {
            $report->setCisloZp($data['cislo_zp']);
        }

        // Zpracování dat členů týmu
        if (isset($data['znackari'])) {
            $report->setTeamMembers($data['znackari']);
        }

        if (isset($data['data_a'])) {
            $report->setDataA($data['data_a']);
        }

        if (isset($data['data_b'])) {
            $report->setDataB($data['data_b']);
        }

        if (isset($data['calculation'])) {
            $report->setCalculation($data['calculation']);
        }

        if (isset($data['state'])) {
            $stateEnum = ReportStateEnum::tryFrom($data['state']);
            if ($stateEnum && $stateEnum !== $report->getState()) {
                $oldState = $report->getState()->value;
                $report->setState($stateEnum);
                
                // Přidat do historie změnu stavu
                $report->addHistoryEntry(
                    'state_changed',
                    $user->getIntAdr(),
                    'Stav změněn na: ' . $stateEnum->getLabel(),
                    ['previous_state' => $oldState]
                );
            }
        }
    }
}