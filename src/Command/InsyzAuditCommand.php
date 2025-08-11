<?php

namespace App\Command;

use App\Service\InsyzAuditLogger;
use App\Service\SystemOptionService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'insyz:audit',
    description: 'Manage INSYZ audit logging system'
)]
class InsyzAuditCommand extends Command
{
    public function __construct(
        private InsyzAuditLogger $auditLogger,
        private SystemOptionService $systemOptions
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('action', InputArgument::REQUIRED, 'Action to perform: status|config|cleanup|stats')
            ->addOption('period', 'p', InputOption::VALUE_OPTIONAL, 'Period for stats (1 hour, 24 hours, 7 days)', '24 hours')
            ->addOption('dry-run', 'd', InputOption::VALUE_NONE, 'Dry run for cleanup operations')
            ->addOption('set', 's', InputOption::VALUE_IS_ARRAY | InputOption::VALUE_REQUIRED, 'Set configuration option (key=value)')
        ;
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $action = $input->getArgument('action');

        return match ($action) {
            'status' => $this->showStatus($io),
            'config' => $this->showConfig($io, $input),
            'cleanup' => $this->cleanup($io, $input->getOption('dry-run')),
            'stats' => $this->showStats($io, $input->getOption('period')),
            default => $this->showHelp($io, $action)
        };
    }

    private function showStatus(SymfonyStyle $io): int
    {
        $io->title('INSYZ Audit System Status');

        $config = $this->systemOptions->getInsyzAuditConfiguration();
        $stats = $this->systemOptions->getInsyzAuditStats();

        // Main status
        $status = $config['enabled'] ? '<fg=green>ENABLED</fg=green>' : '<fg=red>DISABLED</fg=red>';
        $io->writeln("Status: {$status}");
        $io->newLine();

        // Configuration overview
        $io->section('Configuration Overview');
        $configTable = [
            ['Component', 'Status'],
            ['Request Logging', $config['log_requests'] ? '✓' : '✗'],
            ['Response Logging', $config['log_responses'] ? '✓' : '✗'],
            ['MSSQL Query Logging', $config['log_mssql_queries'] ? '✓' : '✗'],
            ['Cache Operation Logging', $config['log_cache_operations'] ? '✓' : '✗'],
            ['User Agent Logging', $config['log_user_agents'] ? '✓' : '✗'],
            ['IP Address Logging', $config['log_ip_addresses'] ? '✓' : '✗'],
        ];
        $io->table($configTable[0], array_slice($configTable, 1));

        // Settings
        $io->section('Settings');
        $settingsTable = [
            ['Setting', 'Value'],
            ['Retention Days', $config['retention_days'] . ' days'],
            ['Slow Query Threshold', $config['slow_query_threshold_ms'] . 'ms'],
            ['Active Features', $stats['total_active_features'] . '/4'],
        ];
        $io->table($settingsTable[0], array_slice($settingsTable, 1));

        return Command::SUCCESS;
    }

    private function showConfig(SymfonyStyle $io, InputInterface $input): int
    {
        $setOptions = $input->getOption('set');
        
        if (!empty($setOptions)) {
            return $this->updateConfig($io, $setOptions);
        }

        $io->title('INSYZ Audit Configuration');

        $config = $this->systemOptions->getInsyzAuditConfiguration();

        $configTable = [
            ['Option', 'Current Value', 'Type'],
            ['enabled', $config['enabled'] ? 'true' : 'false', 'boolean'],
            ['log_requests', $config['log_requests'] ? 'true' : 'false', 'boolean'],
            ['log_responses', $config['log_responses'] ? 'true' : 'false', 'boolean'],
            ['log_mssql_queries', $config['log_mssql_queries'] ? 'true' : 'false', 'boolean'],
            ['log_cache_operations', $config['log_cache_operations'] ? 'true' : 'false', 'boolean'],
            ['log_user_agents', $config['log_user_agents'] ? 'true' : 'false', 'boolean'],
            ['log_ip_addresses', $config['log_ip_addresses'] ? 'true' : 'false', 'boolean'],
            ['retention_days', (string)$config['retention_days'], 'integer'],
            ['slow_query_threshold_ms', (string)$config['slow_query_threshold_ms'], 'integer'],
        ];

        $io->table($configTable[0], array_slice($configTable, 1));

        $io->note([
            'To update configuration, use:',
            '  php bin/console insyz:audit config --set enabled=false',
            '  php bin/console insyz:audit config --set retention_days=60',
            '  php bin/console insyz:audit config --set log_requests=false --set log_responses=false'
        ]);

        return Command::SUCCESS;
    }

    private function updateConfig(SymfonyStyle $io, array $setOptions): int
    {
        $io->title('Updating INSYZ Audit Configuration');

        $updates = [];
        $errors = [];

        foreach ($setOptions as $option) {
            if (!str_contains($option, '=')) {
                $errors[] = "Invalid format: '{$option}'. Use key=value format.";
                continue;
            }

            [$key, $value] = explode('=', $option, 2);
            $key = trim($key);
            $value = trim($value);

            // Parse value
            $parsedValue = match (strtolower($value)) {
                'true', '1', 'yes', 'on' => true,
                'false', '0', 'no', 'off' => false,
                default => is_numeric($value) ? (int)$value : $value
            };

            $updates[$key] = $parsedValue;
        }

        if (!empty($errors)) {
            $io->error($errors);
            return Command::FAILURE;
        }

        // Validate configuration
        $validationErrors = $this->systemOptions->validateInsyzAuditConfig($updates);
        if (!empty($validationErrors)) {
            $io->error($validationErrors);
            return Command::FAILURE;
        }

        // Apply updates
        try {
            $this->systemOptions->updateInsyzAuditConfiguration($updates);
            
            $io->success('Configuration updated successfully!');
            
            $updateTable = [
                ['Option', 'New Value']
            ];
            foreach ($updates as $key => $value) {
                $displayValue = is_bool($value) ? ($value ? 'true' : 'false') : (string)$value;
                $updateTable[] = [$key, $displayValue];
            }
            $io->table($updateTable[0], array_slice($updateTable, 1));

        } catch (\Exception $e) {
            $io->error("Failed to update configuration: {$e->getMessage()}");
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    private function cleanup(SymfonyStyle $io, bool $dryRun): int
    {
        $io->title('INSYZ Audit Cleanup');

        if ($dryRun) {
            $io->note('DRY RUN: No actual cleanup will be performed');
        }

        try {
            if ($dryRun) {
                $config = $this->systemOptions->getInsyzAuditConfiguration();
                $retentionDays = $config['retention_days'];
                
                $io->writeln("Would clean up logs older than {$retentionDays} days");
                $io->writeln('Use without --dry-run to perform actual cleanup');
            } else {
                $deletedCount = $this->auditLogger->cleanupOldLogs();
                
                if ($deletedCount > 0) {
                    $io->success("Cleaned up {$deletedCount} old audit log entries");
                } else {
                    $io->info('No old audit logs found for cleanup');
                }
            }

        } catch (\Exception $e) {
            $io->error("Cleanup failed: {$e->getMessage()}");
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    private function showStats(SymfonyStyle $io, string $period): int
    {
        $io->title("INSYZ Audit Statistics ({$period})");

        try {
            $stats = $this->auditLogger->getPerformanceStatistics($period);
            
            $io->writeln("Period: {$stats['start_date']} to {$stats['end_date']}");
            $io->newLine();

            // Endpoint statistics
            if (!empty($stats['endpoint_stats'])) {
                $io->section('Top Endpoints');
                $endpointTable = [
                    ['Endpoint', 'Requests', 'Avg Duration', 'Max Duration', 'Cache Hits', 'Errors']
                ];
                
                foreach (array_slice($stats['endpoint_stats'], 0, 10) as $stat) {
                    $endpointTable[] = [
                        $stat['endpoint'],
                        $stat['request_count'],
                        round($stat['avg_duration_ms']) . 'ms',
                        $stat['max_duration_ms'] . 'ms',
                        $stat['cache_hits'],
                        $stat['error_count']
                    ];
                }
                $io->table($endpointTable[0], array_slice($endpointTable, 1));
            }

            // MSSQL statistics
            if (!empty($stats['mssql_stats'])) {
                $io->section('Top MSSQL Procedures');
                $mssqlTable = [
                    ['Procedure', 'Calls', 'Avg Duration', 'Max Duration', 'Errors']
                ];
                
                foreach (array_slice($stats['mssql_stats'], 0, 10) as $stat) {
                    $mssqlTable[] = [
                        $stat['mssqlProcedure'],
                        $stat['call_count'],
                        round($stat['avg_duration_ms']) . 'ms',
                        $stat['max_duration_ms'] . 'ms',
                        $stat['error_count']
                    ];
                }
                $io->table($mssqlTable[0], array_slice($mssqlTable, 1));
            }

            // Cache statistics
            if (!empty($stats['cache_stats'])) {
                $io->section('Cache Effectiveness');
                $cacheTable = [
                    ['Endpoint', 'Total Requests', 'Cache Hits', 'Hit Rate', 'Avg Miss Duration', 'Avg Hit Duration']
                ];
                
                foreach (array_slice($stats['cache_stats'], 0, 10) as $stat) {
                    $cacheTable[] = [
                        $stat['endpoint'],
                        $stat['total_requests'],
                        $stat['cache_hits'],
                        $stat['hit_rate_percent'] . '%',
                        $stat['avg_miss_duration_ms'] ? round($stat['avg_miss_duration_ms']) . 'ms' : 'N/A',
                        $stat['avg_hit_duration_ms'] ? round($stat['avg_hit_duration_ms']) . 'ms' : 'N/A'
                    ];
                }
                $io->table($cacheTable[0], array_slice($cacheTable, 1));
            }

        } catch (\Exception $e) {
            $io->error("Failed to get statistics: {$e->getMessage()}");
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    private function showHelp(SymfonyStyle $io, string $action): int
    {
        $io->error("Unknown action: {$action}");
        
        $io->section('Available Actions');
        $io->listing([
            'status - Show current audit system status and configuration',
            'config - Show or update configuration options',
            'cleanup - Clean up old audit logs based on retention policy',
            'stats - Show performance statistics for specified period'
        ]);

        $io->section('Examples');
        $io->listing([
            'php bin/console insyz:audit status',
            'php bin/console insyz:audit config',
            'php bin/console insyz:audit config --set enabled=false',
            'php bin/console insyz:audit cleanup --dry-run',
            'php bin/console insyz:audit stats --period="1 hour"'
        ]);

        return Command::FAILURE;
    }
}