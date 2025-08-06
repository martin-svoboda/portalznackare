<?php

namespace App\MessageHandler;

use App\Message\SendToInsyzMessage;
use App\Repository\ReportRepository;
use App\Enum\ReportStateEnum;
use App\Service\InsysService;
use App\Service\XmlGenerationService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

/**
 * Handler pro asynchronní odesílání hlášení do INSYZ
 */
#[AsMessageHandler]
class SendToInsyzHandler
{
    public function __construct(
        private ReportRepository $reportRepository,
        private EntityManagerInterface $entityManager,
        private LoggerInterface $logger,
        private InsysService $insysService,
        private XmlGenerationService $xmlGenerator
    ) {}

    public function __invoke(SendToInsyzMessage $message): void
    {
        $reportId = $message->getReportId();
        $reportData = $message->getReportData();
        $environment = $message->getEnvironment();

        $this->logger->info('Starting INSYZ processing', [
            'report_id' => $reportId,
            'environment' => $environment
        ]);

        // Načíst report z databáze
        $report = $this->reportRepository->find($reportId);
        if (!$report) {
            $this->logger->error('Report not found', ['report_id' => $reportId]);
            return;
        }

        try {
            // Generovat XML z report dat
            $xmlData = $this->xmlGenerator->generateReportXml($reportData);
            
            $this->logger->info('Generated XML for INSYZ submission', [
                'report_id' => $reportId,
                'xml_length' => strlen($xmlData)
            ]);
            
            // Volání INSYZ API přes InsysService (stejný pattern jako login)
            $result = $this->insysService->submitReportToInsys($xmlData, (string)$report->getIntAdr());
            
            // Vyhodnotit odpověď - InsysService vrací buď success response nebo vyhazuje Exception
            $report->setState(ReportStateEnum::SUBMITTED);
            $report->addHistoryEntry(
                'insyz_submitted',
                $report->getIntAdr(),
                'Hlášení úspěšně přijato systémem INSYZ',
                ['insyz_response' => $result]
            );
            
            $this->logger->info('INSYZ submission successful', [
                'report_id' => $reportId,
                'response' => $result
            ]);

            // Uložit změny
            $this->entityManager->flush();

        } catch (\Exception $e) {
            // INSYZ API chyba nebo systémová chyba
            $report->setState(ReportStateEnum::REJECTED);
            $report->addHistoryEntry(
                'insyz_error',
                $report->getIntAdr(),
                'Chyba při odesílání do INSYZ: ' . $e->getMessage(),
                ['exception' => $e->getMessage(), 'trace' => $e->getTraceAsString()]
            );

            $this->entityManager->flush();
            
            $this->logger->error('INSYZ submission failed', [
                'report_id' => $reportId,
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            // Re-throw pro retry mechanismus
            throw $e;
        }
    }

}