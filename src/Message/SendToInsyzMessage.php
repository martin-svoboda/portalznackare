<?php

namespace App\Message;

/**
 * Message pro asynchronní odesílání hlášení do INSYZ
 */
class SendToInsyzMessage
{
    public function __construct(
        private int $reportId,
        private array $reportData,
        private string $environment = 'test'
    ) {}

    public function getReportId(): int
    {
        return $this->reportId;
    }

    public function getReportData(): array
    {
        return $this->reportData;
    }

    public function getEnvironment(): string
    {
        return $this->environment;
    }
}