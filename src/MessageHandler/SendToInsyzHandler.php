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
            
            // Volání INSYZ API přes InsyzService (stejný pattern jako login)
            $result = $this->insyzService->submitReportToInsyz($xmlData, (string)$report->getIntAdr());
            
            // Vyhodnotit odpověď - InsyzService vrací buď success response nebo vyhazuje Exception
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
                [
                    'exception' => $e->getMessage(), 
                    'trace' => $e->getTraceAsString(),
                    'retry_info' => 'Worker se pokusí znovu podle retry policy'
                ]
            );

            $this->entityManager->flush();
            
            $this->logger->error('INSYZ submission failed', [
                'report_id' => $reportId,
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'will_retry' => true
            ]);

            // Rozlišit typy chyb pro retry mechanismus
            if ($this->shouldRetry($e)) {
                $this->logger->info('Exception je vhodná pro retry', ['report_id' => $reportId]);
                throw $e; // Re-throw pro retry
            } else {
                $this->logger->warning('Exception není vhodná pro retry - označuji jako final failure', [
                    'report_id' => $reportId
                ]);
                
                // Pro definitivní selhání neprovádět retry
                $report->addHistoryEntry(
                    'insyz_final_failure',
                    $report->getIntAdr(),
                    'Definitivní selhání - nebude opakováno: ' . $e->getMessage(),
                    ['no_retry_reason' => $this->getNoRetryReason($e)]
                );
                $this->entityManager->flush();
                
                // Nehodit výjimku = neprovádět retry
                return;
            }
        }
    }

    /**
     * Rozhodne jestli by se měl pokus opakovat na základě typu chyby
     */
    private function shouldRetry(\Exception $e): bool
    {
        $message = strtolower($e->getMessage());
        
        // Retry pro dočasné chyby
        if (
            strpos($message, 'timeout') !== false ||
            strpos($message, 'connection') !== false ||
            strpos($message, 'network') !== false ||
            strpos($message, 'temporary') !== false ||
            strpos($message, 'unavailable') !== false
        ) {
            return true;
        }
        
        // No retry pro trvalé chyby
        if (
            strpos($message, 'authentication') !== false ||
            strpos($message, 'authorization') !== false ||
            strpos($message, 'invalid') !== false ||
            strpos($message, 'malformed') !== false ||
            strpos($message, 'parse error') !== false
        ) {
            return false;
        }
        
        // Default: retry pro neznámé chyby
        return true;
    }

    /**
     * Vrátí důvod proč se nebude opakovat
     */
    private function getNoRetryReason(\Exception $e): string
    {
        $message = strtolower($e->getMessage());
        
        if (strpos($message, 'authentication') !== false) {
            return 'Chyba autentifikace - zkontrolujte přihlašovací údaje';
        }
        
        if (strpos($message, 'authorization') !== false) {
            return 'Nedostatečná oprávnění - kontaktujte administrátora';
        }
        
        if (strpos($message, 'invalid') !== false || strpos($message, 'malformed') !== false) {
            return 'Neplatná data - zkontrolujte obsah hlášení';
        }
        
        if (strpos($message, 'parse error') !== false) {
            return 'Chyba při zpracování XML - kontaktujte podporu';
        }
        
        return 'Trvalá chyba systému - kontaktujte podporu';
    }

}