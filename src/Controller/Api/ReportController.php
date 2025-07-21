<?php

namespace App\Controller\Api;

use App\Dto\ReportDto;
use App\Entity\Report;
use App\Entity\User;
use App\Enum\ReportStateEnum;
use App\Repository\ReportRepository;
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
        private ValidatorInterface $validator
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
        $intAdr = $user->getIntAdr();

        // Validace vstupních parametrů
        if (empty($idZp)) {
            return new JsonResponse([
                'error' => 'Chybí povinný parametr id_zp'
            ], Response::HTTP_BAD_REQUEST);
        }

        try {
            $report = $this->reportRepository->findByOrderAndUser($idZp, $intAdr);

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

            // Najít existující report nebo vytvořit nový
            $report = $this->reportRepository->findByOrderAndUser($idZp, $intAdr);
            
            if (!$report) {
                $report = new Report();
                $report->setIdZp($idZp);
                $report->setIntAdr($intAdr);
            }

            // Kontrola, zda lze report editovat
            if (!$report->isEditable()) {
                return new JsonResponse([
                    'error' => 'Hlášení nelze upravovat ve stavu: ' . $report->getState()->getLabel()
                ], Response::HTTP_FORBIDDEN);
            }

            // Mapování dat z DTO na entitu
            $this->mapDtoToEntity($data, $report);

            // Automatické nastavení je_vedouci flag na základě dat z příkazu
            $this->setLeaderFlag($report, $intAdr, $idZp);

            // Uložení
            $this->reportRepository->save($report, true);

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
     * Set leader flag based on order data
     */
    private function setLeaderFlag(Report $report, int $intAdr, int $idZp): void
    {
        // TODO: Zde by měl být call na službu pro načtení příkazu z INSYS
        // Pro teď nastavíme je_vedouci na false, ale v produkci by mělo být:
        // $orderHead = $this->insysService->getPrikaz($idZp);
        // $isLeader = $this->isUserLeaderInOrder($intAdr, $orderHead);
        // $report->setJeVedouci($isLeader);
        
        $report->setJeVedouci(false); // Placeholder
    }

    /**
     * Map DTO data to entity
     */
    private function mapDtoToEntity(array $data, Report $report): void
    {
        if (isset($data['cislo_zp'])) {
            $report->setCisloZp($data['cislo_zp']);
        }

        if (isset($data['je_vedouci'])) {
            $report->setJeVedouci((bool) $data['je_vedouci']);
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
            if ($stateEnum) {
                $report->setState($stateEnum);
            }
        }
    }
}