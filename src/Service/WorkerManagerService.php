<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Exception;
use Symfony\Component\Process\Process;
use App\Utils\Logger;

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
                return true;
            }

            // Použít Symfony Process místo exec()
            $process = $this->createWorkerProcess();
            
            $this->logger->warning('Spouštím on-demand worker', [
                'command' => $process->getCommandLine(),
                'timeout' => 60
            ]);

            // Spustit proces na pozadí
            $process->start();

            // Krátké čekání aby se proces stihl nastartovat
            usleep(200000); // 200ms
            
            $isRunning = $process->isRunning();
            $exitCode = $process->getExitCode();
            $errorOutput = $process->getErrorOutput();
            $output = $process->getOutput();
            
            $this->logger->warning('Worker process status check', [
                'is_running' => $isRunning,
                'exit_code' => $exitCode,
                'has_error_output' => !empty($errorOutput),
                'has_output' => !empty($output),
                'pid' => $process->getPid()
            ]);
            
            if (!$isRunning) {
                $this->logger->error('Worker se nepodařilo spustit nebo rychle skončil', [
                    'exit_code' => $exitCode,
                    'error_output' => $errorOutput,
                    'output' => $output
                ]);
                return false;
            }

            return true;

        } catch (Exception $e) {
            $this->logger->error('Chyba při spouštění workeru', [
                'exception' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Vytvoří Symfony Process pro worker
     */
    private function createWorkerProcess(): Process
    {
        $phpBinary = $this->getPhpBinary();
        $consolePath = $this->projectRoot . '/bin/console';
        
        // Sestavit command jako array pro lepší bezpečnost
        $command = [
            $phpBinary,
            $consolePath,
            'messenger:consume',
            'async',
            '--limit=1',
            '--time-limit=60',
            '--quiet'
        ];
        
        $process = new Process($command, $this->projectRoot);
        $process->setTimeout(60);
        
        return $process;
    }

    /**
     * Zkontroluje jestli už worker proces běží
     */
    private function isWorkerRunning(): bool
    {
        try {
            $process = new Process(['pgrep', '-f', 'messenger:consume async']);
            $process->run();
            
            return $process->isSuccessful() && !empty($process->getOutput());
        } catch (\Exception $e) {
            Logger::error('Worker check failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Vyčistí stuck worker procesy starší než 5 minut
     */
    public function cleanupStuckWorkers(): int
    {
        try {
            // Najít procesy starší než 5 minut pomocí Symfony Process
            $process = new Process(['ps', '-eo', 'pid,etime,cmd']);
            $process->run();
            
            if (!$process->isSuccessful()) {
                Logger::error('Failed to get process list');
                return 0;
            }
            
            $output = explode("\n", $process->getOutput());
            $messengerLines = array_filter($output, function($line) {
                return strpos($line, 'messenger:consume async') !== false;
            });
            
            $killedCount = 0;
            
            foreach ($messengerLines as $line) {
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
            Logger::error('Chyba při cleanup stuck procesů: ' . $e->getMessage());
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
        try {
            // Zkusit TERM signal
            $process = new Process(['kill', '-TERM', (string)$pid]);
            $process->run();
            
            if (!$process->isSuccessful()) {
                // Pokud TERM nepomohl, zkusit KILL
                $killProcess = new Process(['kill', '-KILL', (string)$pid]);
                $killProcess->run();
                return $killProcess->isSuccessful();
            }
            
            return true;
        } catch (\Exception $e) {
            Logger::error('Failed to kill process: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Detekuje PHP binary cestu
     */
    private function getPhpBinary(): string
    {
        // Zkusit použít aktuální PHP binary
        $currentPhp = PHP_BINARY;
        if ($currentPhp && file_exists($currentPhp)) {
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
        try {
            $process = new Process(['pgrep', '-f', 'messenger:consume async']);
            $process->run();
            
            $runningProcesses = 0;
            if ($process->isSuccessful()) {
                $output = explode("\n", trim($process->getOutput()));
                $runningProcesses = count(array_filter($output));
            }
            
            return [
                'running_workers' => $runningProcesses,
                'last_cleanup' => new \DateTime(),
                'php_binary' => $this->getPhpBinary(),
                'project_root' => $this->projectRoot
            ];
        } catch (\Exception $e) {
            Logger::error('Worker stats failed: ' . $e->getMessage());
            return [
                'running_workers' => 0,
                'last_cleanup' => new \DateTime(),
                'php_binary' => $this->getPhpBinary(),
                'project_root' => $this->projectRoot
            ];
        }
    }
}