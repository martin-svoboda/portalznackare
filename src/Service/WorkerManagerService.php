<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Exception;

/**
 * Service pro správu on-demand messenger worker procesů
 * Zajišťuje spuštění, monitoring a cleanup worker procesů
 */
class WorkerManagerService
{
    private LoggerInterface $logger;
    private string $projectRoot;

    public function __construct(LoggerInterface $logger, string $projectDir)
    {
        $this->logger = $logger;
        $this->projectRoot = $projectDir;
    }

    /**
     * Spustí single-task worker pro zpracování jedné zprávy
     * S timeout ochranou a process monitoring
     */
    public function startSingleTaskWorker(): bool
    {
        try {
            // Nejdřív vyčistit stuck procesy
            $this->cleanupStuckWorkers();

            // Zkontrolovat jestli už worker neběží
            if ($this->isWorkerRunning()) {
                $this->logger->info('Worker již běží, nespouštím nový');
                return true;
            }

            $command = $this->buildWorkerCommand();
            
            $this->logger->info('Spouštím on-demand worker', [
                'command' => $command,
                'timeout' => '60s'
            ]);

            // Spustit proces na pozadí s timeout
            $result = exec($command, $output, $returnCode);

            if ($returnCode !== 0) {
                $this->logger->error('Worker se nepodařilo spustit', [
                    'return_code' => $returnCode,
                    'output' => $output
                ]);
                return false;
            }

            $this->logger->info('Worker úspěšně spuštěn');
            return true;

        } catch (Exception $e) {
            $this->logger->error('Chyba při spouštění workeru', [
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    /**
     * Sestaví command pro spuštění workeru s timeout ochranou
     */
    private function buildWorkerCommand(): string
    {
        $phpBinary = $this->getPhpBinary();
        $consolePath = $this->projectRoot . '/bin/console';
        
        // Timeout 60s, limit 1 zpráva, výstup do /dev/null, běh na pozadí
        return sprintf(
            'cd %s && timeout 60 %s %s messenger:consume async --limit=1 --quiet > /dev/null 2>&1 &',
            escapeshellarg($this->projectRoot),
            escapeshellarg($phpBinary),
            escapeshellarg($consolePath)
        );
    }

    /**
     * Zkontroluje jestli už worker proces běží
     */
    private function isWorkerRunning(): bool
    {
        $output = [];
        exec("pgrep -f 'messenger:consume async'", $output, $returnCode);
        
        return $returnCode === 0 && !empty($output);
    }

    /**
     * Vyčistí stuck worker procesy starší než 5 minut
     */
    public function cleanupStuckWorkers(): int
    {
        try {
            // Najít procesy starší než 5 minut
            $output = [];
            exec("ps -eo pid,etime,cmd | grep 'messenger:consume async' | grep -v grep", $output);
            
            $killedCount = 0;
            
            foreach ($output as $line) {
                if ($this->isProcessStuck($line)) {
                    $pid = $this->extractPidFromLine($line);
                    if ($pid && $this->killProcess($pid)) {
                        $killedCount++;
                        $this->logger->warning('Zabit stuck worker proces', [
                            'pid' => $pid,
                            'line' => $line
                        ]);
                    }
                }
            }

            if ($killedCount > 0) {
                $this->logger->info('Cleanup dokončen', ['killed_processes' => $killedCount]);
            }

            return $killedCount;

        } catch (Exception $e) {
            $this->logger->error('Chyba při cleanup stuck procesů', [
                'exception' => $e->getMessage()
            ]);
            return 0;
        }
    }

    /**
     * Zkontroluje jestli je proces stuck (běží déle než 5 minut)
     */
    private function isProcessStuck(string $psLine): bool
    {
        // Parse etime z ps výstupu (formát MM:SS nebo HH:MM:SS)
        if (preg_match('/\s+(\d+):(\d+):(\d+)\s+/', $psLine, $matches)) {
            // HH:MM:SS formát
            $hours = (int)$matches[1];
            $minutes = (int)$matches[2];
            return $hours > 0 || $minutes >= 5;
        } elseif (preg_match('/\s+(\d+):(\d+)\s+/', $psLine, $matches)) {
            // MM:SS formát
            $minutes = (int)$matches[1];
            return $minutes >= 5;
        }
        
        return false;
    }

    /**
     * Extrahuje PID z ps line
     */
    private function extractPidFromLine(string $line): ?int
    {
        if (preg_match('/^\s*(\d+)\s+/', $line, $matches)) {
            return (int)$matches[1];
        }
        return null;
    }

    /**
     * Zabije proces podle PID
     */
    private function killProcess(int $pid): bool
    {
        exec("kill -TERM $pid", $output, $returnCode);
        
        if ($returnCode !== 0) {
            // Pokud TERM nepomohl, zkusit KILL
            exec("kill -KILL $pid", $output, $returnCode);
        }
        
        return $returnCode === 0;
    }

    /**
     * Detekuje PHP binary cestu
     */
    private function getPhpBinary(): string
    {
        // Zkusit použít aktuální PHP binary
        $currentPhp = PHP_BINARY;
        if ($currentPhp && is_executable($currentPhp)) {
            return $currentPhp;
        }
        
        // Fallback na 'php' v PATH
        return 'php';
    }

    /**
     * Vrátí statistiky worker procesů pro monitoring
     */
    public function getWorkerStats(): array
    {
        $output = [];
        exec("pgrep -f 'messenger:consume async'", $output, $returnCode);
        
        $runningProcesses = $returnCode === 0 ? count($output) : 0;
        
        return [
            'running_workers' => $runningProcesses,
            'last_cleanup' => new \DateTime(),
            'php_binary' => $this->getPhpBinary(),
            'project_root' => $this->projectRoot
        ];
    }
}