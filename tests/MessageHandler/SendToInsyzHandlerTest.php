<?php

namespace App\Tests\MessageHandler;

use App\Entity\Report;
use App\Enum\ReportStateEnum;
use App\Message\SendToInsyzMessage;
use App\MessageHandler\SendToInsyzHandler;
use App\Repository\ReportRepository;
use App\Service\InsyzService;
use App\Service\XmlGenerationService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * Regrese k zaseknutému hlášení S/PY/O/26029:
 * když INSYZ odeslání selže, handler NESMÍ vyhodit výjimku (jinak by
 * doctrine_transaction middleware rollbacknul zápis stavu i auditu a hlášení
 * by zůstalo viset ve stavu 'send'). Místo toho musí hlášení definitivně
 * označit jako 'rejected' a chybu zapsat do historie.
 */
class SendToInsyzHandlerTest extends TestCase
{
    private function makeReport(): Report
    {
        $report = new Report();
        $report->setIdZp(54291);
        $report->setCisloZp('S/PY/O/26029');
        $report->setIntAdr(1955);
        $report->setState(ReportStateEnum::SEND);

        return $report;
    }

    private function makeHandler(Report $report, InsyzService $insyz): SendToInsyzHandler
    {
        $repo = $this->createMock(ReportRepository::class);
        $repo->method('find')->willReturn($report);

        $em = $this->createMock(EntityManagerInterface::class);

        $xml = $this->createMock(XmlGenerationService::class);
        $xml->method('generateReportXml')->willReturn('<ZP/>');

        return new SendToInsyzHandler($repo, $em, new NullLogger(), $insyz, $xml);
    }

    public function testSelhaniOznaciHlaseniZamitnuteANeVyhodiVyjimku(): void
    {
        $report = $this->makeReport();

        $insyz = $this->createMock(InsyzService::class);
        $insyz->method('submitReportToInsyz')->willThrowException(
            new \Exception('SQL Procedure error: Převod jednoho či více znaků z XML do cílové kolace nelze provést.')
        );

        $handler = $this->makeHandler($report, $insyz);

        // Nesmí probublat žádná výjimka
        ($handler)(new SendToInsyzMessage($report->getIdZp(), ['submitted_by' => 1955], 'prod'));

        $this->assertSame(ReportStateEnum::REJECTED, $report->getState(), 'Hlášení musí být zamítnuto, ne zaseknuto v send');

        $history = $report->getHistory();
        $last = end($history);
        $this->assertSame('insyz_error', $last['action']);
        $this->assertStringContainsString('cílové kolace', $last['details']);
    }

    public function testUspechOznaciHlaseniPrijate(): void
    {
        $report = $this->makeReport();

        $insyz = $this->createMock(InsyzService::class);
        $insyz->method('submitReportToInsyz')->willReturn(['success' => true]);

        $handler = $this->makeHandler($report, $insyz);

        ($handler)(new SendToInsyzMessage($report->getIdZp(), ['submitted_by' => 1955], 'prod'));

        $this->assertSame(ReportStateEnum::SUBMITTED, $report->getState());
    }

    public function testNeníLiVeStavuSendPreskoci(): void
    {
        $report = $this->makeReport();
        $report->setState(ReportStateEnum::SUBMITTED); // už zpracované

        $insyz = $this->createMock(InsyzService::class);
        $insyz->expects($this->never())->method('submitReportToInsyz');

        $handler = $this->makeHandler($report, $insyz);

        ($handler)(new SendToInsyzMessage($report->getIdZp(), [], 'prod'));

        $this->assertSame(ReportStateEnum::SUBMITTED, $report->getState());
    }
}
