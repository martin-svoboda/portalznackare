<?php

namespace App\MessageHandler;

use App\Message\SendToInsyzMessage;
use App\Repository\ReportRepository;
use App\Enum\ReportStateEnum;
use App\Service\InsyzService;
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
        private InsyzService $insyzService,
        private XmlGenerationService $xmlGenerator
    ) {}

    public function __invoke(SendToInsyzMessage $message): void
    {
        $reportId = $message->getReportId();
        $reportData = $message->getReportData();
        $environment = $message->getEnvironment();

        $this->logger->info('Starting INSYZ processing', [
            'report_id' => $reportId,
            'environment' => $environment,
        ]);

        // Načíst report z databáze
        $report = $this->reportRepository->find($reportId);
        if (!$report) {
            $this->logger->error('Report not found', ['report_id' => $reportId]);
            return;
        }

        // Idempotency guard - zpracovat jen pokud je report skutečně ve stavu 'send'.
        // INSYZ submission NENÍ idempotentní (stored procedure vytvoří duplicitní záznam),
        // takže pokud byla zpráva omylem doručena podruhé (restart workera, manuální
        // re-dispatch), nesmíme report poslat znovu.
        if ($report->getState() !== ReportStateEnum::SEND) {
            $this->logger->warning('Skipping INSYZ submission - report not in send state', [
                'report_id' => $reportId,
                'current_state' => $report->getState()->value,
            ]);
            return;
        }

        try {
            // Metadata odeslání: timestamp = okamžik skutečného odeslání do INSYZ,
            // Odeslal = INT_ADR toho, kdo odeslání spustil (fallback vlastník hlášení).
            $meta = [
                'Datum_Odeslani' => date('Y-m-d H:i:s'),
                'Odeslal' => $reportData['submitted_by'] ?? $report->getIntAdr(),
            ];

            // Generovat XML z report dat
            $xmlData = $this->xmlGenerator->generateReportXml($reportData, $meta);

            $this->logger->info('Generated XML for INSYZ submission', [
                'report_id' => $reportId,
                'xml_length' => strlen($xmlData),
            ]);

            // Volání INSYZ API přes InsyzService (stejný pattern jako login)
            $result = $this->insyzService->submitReportToInsyz($xmlData, (string)$report->getIntAdr());

            // Úspěch - InsyzService vrací success response nebo vyhazuje výjimku
            $report->setState(ReportStateEnum::SUBMITTED);
            $report->addHistoryEntry(
                'insyz_submitted',
                $report->getIntAdr(),
                'Hlášení úspěšně přijato systémem INSYZ',
                ['insyz_response' => $result]
            );

            $this->entityManager->flush();

            $this->logger->info('INSYZ submission successful', [
                'report_id' => $reportId,
                'response' => $result,
            ]);

        } catch (\Throwable $e) {
            // INSYZ hlášení odmítl, nebo nastala systémová chyba. NEOPAKUJEME:
            // stored procedure trasy.ZP_Zapis_XML není idempotentní (viz messenger.yaml,
            // max_retries: 0), takže každý retry by v INSYZ vytvořil duplicitní záznam.
            // Chybu proto zaznamenáme jako definitivní a hlášení označíme jako zamítnuté.
            //
            // DŮLEŽITÉ: handler NESMÍ výjimku znovu vyhodit. Handler běží uvnitř
            // doctrine_transaction middleware - kdyby výjimka propadla ven, transakce
            // by se rollbackla a zápis stavu ('rejected') i INSYZ auditu by zmizel;
            // hlášení by pak natrvalo viselo ve stavu 'send' ("Odesílání probíhá...")
            // bez jakékoli stopy v auditu. Tím, že doběhneme normálně, se transakce
            // commitne a chyba je viditelná uživateli i v auditu.
            $report->setState(ReportStateEnum::REJECTED);
            $report->addHistoryEntry(
                'insyz_error',
                $report->getIntAdr(),
                'Chyba při odesílání do INSYZ: ' . $e->getMessage(),
                ['exception' => $e->getMessage()]
            );

            $this->entityManager->flush();

            $this->logger->error('INSYZ submission failed', [
                'report_id' => $reportId,
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
