<?php

namespace App\Service;

use App\Entity\SystemOption;
use App\Repository\SystemOptionRepository;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

class SystemOptionService
{
    private const CACHE_KEY = 'system_options_autoload';
    private const CACHE_TTL = 3600; // 1 hour

    private ?array $cachedOptions = null;

    public function __construct(
        private SystemOptionRepository $optionRepository,
        private CacheInterface $cache,
        private LoggerInterface $logger
    ) {}

    /**
     * Get option value with caching
     */
    public function get(string $optionName, mixed $default = null): mixed
    {
        // Try to get from local cache first
        if ($this->cachedOptions !== null && array_key_exists($optionName, $this->cachedOptions)) {
            return $this->cachedOptions[$optionName];
        }

        // Try to get from Symfony cache
        $cachedOptions = $this->getCachedOptions();
        if (array_key_exists($optionName, $cachedOptions)) {
            return $cachedOptions[$optionName];
        }

        // Fallback to database
        $value = $this->optionRepository->getValue($optionName, $default);
        
        // Cache the value if it's not null and option should be autoloaded
        if ($value !== $default) {
            $option = $this->optionRepository->findByName($optionName);
            if ($option && $option->isAutoload()) {
                $this->addToCache($optionName, $value);
            }
        }

        return $value;
    }

    /**
     * Set option value and update cache
     */
    public function set(string $optionName, mixed $value, bool $autoload = true): SystemOption
    {
        $option = $this->optionRepository->setValue($optionName, $value, $autoload);
        
        // Clear cache to force reload
        $this->clearCache();
        
        $this->logger->info('System option updated', [
            'option_name' => $optionName,
            'autoload' => $autoload,
            'value_type' => gettype($value)
        ]);
        
        return $option;
    }

    /**
     * Get multiple options at once
     */
    public function getMultiple(array $optionNames, mixed $default = null): array
    {
        $result = [];
        $cachedOptions = $this->getCachedOptions();
        $uncachedNames = [];

        foreach ($optionNames as $name) {
            if (array_key_exists($name, $cachedOptions)) {
                $result[$name] = $cachedOptions[$name];
            } else {
                $uncachedNames[] = $name;
            }
        }

        // Get uncached options from database
        if (!empty($uncachedNames)) {
            foreach ($uncachedNames as $name) {
                $result[$name] = $this->optionRepository->getValue($name, $default);
            }
        }

        return $result;
    }

    /**
     * Audit-specific methods
     */
    
    public function isAuditEnabled(string $entityName, string $event = null): bool
    {
        return $this->optionRepository->isEntityAuditEnabled($entityName, $event);
    }

    public function getAuditConfiguration(): array
    {
        return [
            'log_entities' => $this->get('audit.log_entities', []),
            'retention_days' => $this->get('audit.retention_days', 90),
            'log_ip_addresses' => $this->get('audit.log_ip_addresses', true),
        ];
    }

    public function updateAuditEntityConfig(string $entityName, array $config): void
    {
        $currentConfig = $this->get('audit.log_entities', []);
        $currentConfig[$entityName] = $config;
        $this->set('audit.log_entities', $currentConfig);
    }

    public function getMaskedFields(string $entityName): array
    {
        $auditEntities = $this->get('audit.log_entities', []);
        $entityConfig = $auditEntities[$entityName] ?? [];
        return $entityConfig['masked_fields'] ?? [];
    }

    public function addMaskedField(string $entityName, string $fieldName): void
    {
        $currentConfig = $this->get('audit.log_entities', []);
        
        if (!isset($currentConfig[$entityName])) {
            $currentConfig[$entityName] = [
                'enabled' => true,
                'events' => ['create', 'update', 'delete'],
                'masked_fields' => []
            ];
        }
        
        $maskedFields = $currentConfig[$entityName]['masked_fields'] ?? [];
        if (!in_array($fieldName, $maskedFields, true)) {
            $maskedFields[] = $fieldName;
            $currentConfig[$entityName]['masked_fields'] = $maskedFields;
            $this->set('audit.log_entities', $currentConfig);
        }
    }

    public function removeMaskedField(string $entityName, string $fieldName): void
    {
        $currentConfig = $this->get('audit.log_entities', []);
        
        if (isset($currentConfig[$entityName]['masked_fields'])) {
            $maskedFields = $currentConfig[$entityName]['masked_fields'];
            $key = array_search($fieldName, $maskedFields, true);
            
            if ($key !== false) {
                unset($maskedFields[$key]);
                $currentConfig[$entityName]['masked_fields'] = array_values($maskedFields);
                $this->set('audit.log_entities', $currentConfig);
            }
        }
    }

    /**
     * Cache management
     */
    
    private function getCachedOptions(): array
    {
        if ($this->cachedOptions !== null) {
            return $this->cachedOptions;
        }

        try {
            $this->cachedOptions = $this->cache->get(self::CACHE_KEY, function (ItemInterface $item) {
                $item->expiresAfter(self::CACHE_TTL);
                return $this->optionRepository->getOptionsAsArray(true);
            });
        } catch (\Exception $e) {
            $this->logger->warning('Failed to get cached system options, using database', [
                'error' => $e->getMessage()
            ]);
            $this->cachedOptions = $this->optionRepository->getOptionsAsArray(true);
        }

        return $this->cachedOptions;
    }

    private function addToCache(string $optionName, mixed $value): void
    {
        if ($this->cachedOptions === null) {
            $this->cachedOptions = $this->getCachedOptions();
        }
        
        $this->cachedOptions[$optionName] = $value;
        
        try {
            $this->cache->delete(self::CACHE_KEY);
        } catch (\Exception $e) {
            $this->logger->warning('Failed to clear system options cache', [
                'error' => $e->getMessage()
            ]);
        }
    }

    public function clearCache(): void
    {
        $this->cachedOptions = null;
        
        try {
            $this->cache->delete(self::CACHE_KEY);
        } catch (\Exception $e) {
            $this->logger->warning('Failed to clear system options cache', [
                'error' => $e->getMessage()
            ]);
        }
    }

    public function warmCache(): void
    {
        $this->clearCache();
        $this->getCachedOptions();
        
        $this->logger->info('System options cache warmed');
    }

    /**
     * Bulk operations
     */
    
    public function bulkUpdate(array $options): void
    {
        $this->optionRepository->bulkUpdateOptions($options);
        $this->clearCache();
        
        $this->logger->info('Bulk system options update', [
            'options_count' => count($options),
            'option_names' => array_keys($options)
        ]);
    }

    /**
     * Validation and defaults
     */
    
    public function validateAuditConfig(array $config): array
    {
        $errors = [];
        
        foreach ($config as $entityName => $entityConfig) {
            if (!is_array($entityConfig)) {
                $errors[] = "Configuration for entity '$entityName' must be an array";
                continue;
            }
            
            if (!isset($entityConfig['enabled'])) {
                $errors[] = "Entity '$entityName' missing 'enabled' configuration";
            }
            
            if (isset($entityConfig['events']) && !is_array($entityConfig['events'])) {
                $errors[] = "Entity '$entityName' events must be an array";
            }
            
            if (isset($entityConfig['masked_fields']) && !is_array($entityConfig['masked_fields'])) {
                $errors[] = "Entity '$entityName' masked_fields must be an array";
            }
        }
        
        return $errors;
    }

    public function getDefaultAuditConfig(string $entityName): array
    {
        return [
            'enabled' => true,
            'events' => ['create', 'update', 'delete'],
            'masked_fields' => []
        ];
    }

    /**
     * INSYZ Audit-specific methods
     */
    
    public function getInsyzAuditConfiguration(): array
    {
        return [
            'enabled' => $this->get('insyz_audit.enabled', true),
            'log_requests' => $this->get('insyz_audit.log_requests', true),
            'log_responses' => $this->get('insyz_audit.log_responses', true),
            'log_mssql_queries' => $this->get('insyz_audit.log_mssql_queries', true),
            'log_cache_operations' => $this->get('insyz_audit.log_cache_operations', true),
            'retention_days' => $this->get('insyz_audit.retention_days', 90),
            'slow_query_threshold_ms' => $this->get('insyz_audit.slow_query_threshold_ms', 2000),
            'log_user_agents' => $this->get('insyz_audit.log_user_agents', true),
            'log_ip_addresses' => $this->get('insyz_audit.log_ip_addresses', true),
        ];
    }

    public function isInsyzAuditEnabled(): bool
    {
        return $this->get('insyz_audit.enabled', true);
    }

    public function updateInsyzAuditConfiguration(array $config): void
    {
        $validOptions = [
            'enabled', 'log_requests', 'log_responses', 'log_mssql_queries',
            'log_cache_operations', 'retention_days', 'slow_query_threshold_ms',
            'log_user_agents', 'log_ip_addresses'
        ];

        foreach ($config as $key => $value) {
            if (in_array($key, $validOptions, true)) {
                $this->set("insyz_audit.{$key}", $value);
            }
        }
    }

    public function validateInsyzAuditConfig(array $config): array
    {
        $errors = [];
        
        // Validate boolean options
        $booleanOptions = ['enabled', 'log_requests', 'log_responses', 'log_mssql_queries', 
                          'log_cache_operations', 'log_user_agents', 'log_ip_addresses'];
        
        foreach ($booleanOptions as $option) {
            if (isset($config[$option]) && !is_bool($config[$option])) {
                $errors[] = "Option '$option' must be a boolean value";
            }
        }
        
        // Validate integer options
        if (isset($config['retention_days'])) {
            if (!is_int($config['retention_days']) || $config['retention_days'] < 1) {
                $errors[] = "Option 'retention_days' must be a positive integer";
            }
        }
        
        if (isset($config['slow_query_threshold_ms'])) {
            if (!is_int($config['slow_query_threshold_ms']) || $config['slow_query_threshold_ms'] < 0) {
                $errors[] = "Option 'slow_query_threshold_ms' must be a non-negative integer";
            }
        }
        
        return $errors;
    }

    public function getInsyzAuditStats(): array
    {
        $config = $this->getInsyzAuditConfiguration();
        
        return [
            'audit_enabled' => $config['enabled'],
            'logging_components' => [
                'requests' => $config['log_requests'],
                'responses' => $config['log_responses'],
                'mssql_queries' => $config['log_mssql_queries'],
                'cache_operations' => $config['log_cache_operations'],
                'user_agents' => $config['log_user_agents'],
                'ip_addresses' => $config['log_ip_addresses'],
            ],
            'retention_days' => $config['retention_days'],
            'slow_query_threshold_ms' => $config['slow_query_threshold_ms'],
            'total_active_features' => array_sum(array_map('intval', [
                $config['log_requests'],
                $config['log_responses'], 
                $config['log_mssql_queries'],
                $config['log_cache_operations']
            ])),
        ];
    }

    /**
     * Debug and maintenance
     */
    
    public function getCacheStats(): array
    {
        $cachedCount = $this->cachedOptions ? count($this->cachedOptions) : 0;
        $totalCount = count($this->optionRepository->findAll());
        $autoloadCount = count($this->optionRepository->findAutoloadOptions());
        
        return [
            'total_options' => $totalCount,
            'autoload_options' => $autoloadCount,
            'cached_options' => $cachedCount,
            'cache_hit_ratio' => $totalCount > 0 ? ($cachedCount / $totalCount) * 100 : 0
        ];
    }
}