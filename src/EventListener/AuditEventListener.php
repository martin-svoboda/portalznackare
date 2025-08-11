<?php

namespace App\EventListener;

use App\Entity\AuditLog;
use App\Service\AuditLogger;
use App\Service\SystemOptionService;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsDoctrineListener;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostRemoveEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use Doctrine\ORM\Event\PrePersistEventArgs;
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Events;
use Psr\Log\LoggerInterface;

#[AsDoctrineListener(event: Events::prePersist)]
#[AsDoctrineListener(event: Events::postPersist)]
#[AsDoctrineListener(event: Events::preUpdate)]
#[AsDoctrineListener(event: Events::postUpdate)]
#[AsDoctrineListener(event: Events::postRemove)]
class AuditEventListener
{
    private array $entityDataBeforeUpdate = [];
    private array $sensitiveFieldPatterns = [
        'password',
        'token', 
        'secret',
        'api_key',
        'private_key',
        'hash',
        'salt'
    ];

    public function __construct(
        private AuditLogger $auditLogger,
        private SystemOptionService $systemOptions,
        private LoggerInterface $logger
    ) {}

    /**
     * Before entity is created - prepare data
     */
    public function prePersist(PrePersistEventArgs $args): void
    {
        $entity = $args->getObject();
        $entityName = $this->getEntityName($entity);

        if (!$this->shouldAuditEntity($entityName, 'create')) {
            return;
        }

        // Store data for post-persist logging (entity will have ID then)
        $this->entityDataBeforeUpdate[spl_object_hash($entity)] = [
            'action' => 'create',
            'data' => $this->extractEntityData($entity, $entityName)
        ];
    }

    /**
     * After entity is created
     */
    public function postPersist(PostPersistEventArgs $args): void
    {
        $entity = $args->getObject();
        $entityName = $this->getEntityName($entity);
        $objectHash = spl_object_hash($entity);

        if (!$this->shouldAuditEntity($entityName, 'create')) {
            return;
        }

        if (!isset($this->entityDataBeforeUpdate[$objectHash])) {
            return;
        }

        $storedData = $this->entityDataBeforeUpdate[$objectHash];
        unset($this->entityDataBeforeUpdate[$objectHash]);

        try {
            $this->auditLogger->log(
                AuditLog::ACTION_CREATE,
                $entityName,
                $this->getEntityId($entity),
                null,
                $storedData['data']
            );
        } catch (\Exception $e) {
            $this->logger->error('Failed to log entity creation', [
                'entity' => $entityName,
                'entity_id' => $this->getEntityId($entity),
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Before entity is updated - capture old values
     */
    public function preUpdate(PreUpdateEventArgs $args): void
    {
        $entity = $args->getObject();
        $entityName = $this->getEntityName($entity);

        if (!$this->shouldAuditEntity($entityName, 'update')) {
            return;
        }

        // Get old values from change set
        $oldData = [];
        $newData = [];

        foreach ($args->getEntityChangeSet() as $field => $change) {
            $oldData[$field] = $change[0];  // old value
            $newData[$field] = $change[1];  // new value
        }

        // Apply masking to sensitive fields
        $maskedFields = $this->systemOptions->getMaskedFields($entityName);
        $oldData = $this->maskSensitiveData($oldData, $maskedFields);
        $newData = $this->maskSensitiveData($newData, $maskedFields);

        $this->entityDataBeforeUpdate[spl_object_hash($entity)] = [
            'action' => 'update',
            'old_data' => $oldData,
            'new_data' => $newData
        ];
    }

    /**
     * After entity is updated
     */
    public function postUpdate(PostUpdateEventArgs $args): void
    {
        $entity = $args->getObject();
        $entityName = $this->getEntityName($entity);
        $objectHash = spl_object_hash($entity);

        if (!$this->shouldAuditEntity($entityName, 'update')) {
            return;
        }

        if (!isset($this->entityDataBeforeUpdate[$objectHash])) {
            return;
        }

        $storedData = $this->entityDataBeforeUpdate[$objectHash];
        unset($this->entityDataBeforeUpdate[$objectHash]);

        // Only log if there are actual changes
        if (empty($storedData['old_data']) && empty($storedData['new_data'])) {
            return;
        }

        try {
            $this->auditLogger->log(
                AuditLog::ACTION_UPDATE,
                $entityName,
                $this->getEntityId($entity),
                $storedData['old_data'],
                $storedData['new_data']
            );
        } catch (\Exception $e) {
            $this->logger->error('Failed to log entity update', [
                'entity' => $entityName,
                'entity_id' => $this->getEntityId($entity),
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * After entity is deleted
     */
    public function postRemove(PostRemoveEventArgs $args): void
    {
        $entity = $args->getObject();
        $entityName = $this->getEntityName($entity);

        if (!$this->shouldAuditEntity($entityName, 'delete')) {
            return;
        }

        try {
            $entityData = $this->extractEntityData($entity, $entityName);

            $this->auditLogger->log(
                AuditLog::ACTION_DELETE,
                $entityName,
                $this->getEntityId($entity),
                $entityData,
                null
            );
        } catch (\Exception $e) {
            $this->logger->error('Failed to log entity deletion', [
                'entity' => $entityName,
                'entity_id' => $this->getEntityId($entity),
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Check if entity should be audited
     */
    private function shouldAuditEntity(string $entityName, string $event): bool
    {
        // Skip audit log entries themselves to prevent recursion
        if ($entityName === 'AuditLog') {
            return false;
        }

        // Skip SystemOption changes to prevent recursion during config loading
        if ($entityName === 'SystemOption') {
            return false;
        }

        try {
            return $this->systemOptions->isAuditEnabled($entityName, $event);
        } catch (\Exception $e) {
            $this->logger->warning('Failed to check audit configuration, skipping audit', [
                'entity' => $entityName,
                'event' => $event,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Extract entity name from class
     */
    private function getEntityName(object $entity): string
    {
        $class = get_class($entity);
        $parts = explode('\\', $class);
        return end($parts);
    }

    /**
     * Get entity ID
     */
    private function getEntityId(object $entity): string
    {
        if (method_exists($entity, 'getId')) {
            $id = $entity->getId();
            return $id !== null ? (string) $id : 'null';
        }
        
        return spl_object_hash($entity);
    }

    /**
     * Extract entity data with masking
     */
    private function extractEntityData(object $entity, string $entityName): array
    {
        $data = [];

        // Try to use toArray method if exists
        if (method_exists($entity, 'toArray')) {
            $data = $entity->toArray();
        } else {
            // Extract using reflection
            $data = $this->extractDataViaReflection($entity);
        }

        // Apply masking
        $maskedFields = $this->systemOptions->getMaskedFields($entityName);
        return $this->maskSensitiveData($data, $maskedFields);
    }

    /**
     * Extract data using reflection
     */
    private function extractDataViaReflection(object $entity): array
    {
        $data = [];
        $reflection = new \ReflectionClass($entity);

        // Extract using getters
        foreach ($reflection->getMethods(\ReflectionMethod::IS_PUBLIC) as $method) {
            $methodName = $method->getName();
            
            if (!str_starts_with($methodName, 'get') || $method->getNumberOfParameters() > 0) {
                continue;
            }

            $propertyName = lcfirst(substr($methodName, 3));
            
            // Skip problematic getters
            if (in_array($propertyName, ['class', '__initializer__', '__cloner__', '__isInitialized__'])) {
                continue;
            }

            try {
                $value = $method->invoke($entity);
                
                // Only include scalar values, arrays, or null
                if (is_scalar($value) || is_array($value) || $value === null) {
                    $data[$propertyName] = $value;
                } elseif ($value instanceof \DateTimeInterface) {
                    $data[$propertyName] = $value->format('Y-m-d H:i:s');
                } elseif (is_object($value) && method_exists($value, 'getId')) {
                    $data[$propertyName . '_id'] = $value->getId();
                }
            } catch (\Throwable $e) {
                // Skip problematic getters
                $this->logger->debug('Skipped getter during audit data extraction', [
                    'method' => $methodName,
                    'error' => $e->getMessage()
                ]);
            }
        }

        return $data;
    }

    /**
     * Mask sensitive data
     */
    private function maskSensitiveData(array $data, array $configuredMaskedFields): array
    {
        $allMaskedFields = array_merge($this->sensitiveFieldPatterns, $configuredMaskedFields);
        
        foreach ($data as $key => $value) {
            // Check if field should be masked
            $shouldMask = false;
            
            foreach ($allMaskedFields as $pattern) {
                if (stripos($key, $pattern) !== false) {
                    $shouldMask = true;
                    break;
                }
            }
            
            if ($shouldMask) {
                if ($value === null) {
                    $data[$key] = null;
                } elseif (is_string($value) && strlen($value) > 0) {
                    $data[$key] = '***';
                } elseif (is_array($value)) {
                    $data[$key] = ['***masked_array***'];
                } else {
                    $data[$key] = '***';
                }
            } elseif (is_array($value)) {
                // Recursively mask arrays
                $data[$key] = $this->maskSensitiveData($value, $configuredMaskedFields);
            } elseif (is_string($value) && strlen($value) > 2000) {
                // Truncate very long strings
                $data[$key] = substr($value, 0, 2000) . '... (truncated)';
            }
        }

        return $data;
    }
}