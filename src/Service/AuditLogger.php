<?php

namespace App\Service;

use App\Entity\AuditLog;
use App\Entity\User;
use App\Repository\AuditLogRepository;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

class AuditLogger
{
    public function __construct(
        private AuditLogRepository $auditLogRepository,
        private TokenStorageInterface $tokenStorage,
        private RequestStack $requestStack
    ) {}

    /**
     * Log user action
     */
    public function log(
        string $action,
        ?string $entityType = null,
        ?string $entityId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?User $user = null,
        ?int $intAdr = null
    ): AuditLog {
        $auditLog = new AuditLog();
        $auditLog->setAction($action);

        // Set user (from parameter or current user)
        if ($user) {
            $auditLog->setUser($user);
        } else {
            $token = $this->tokenStorage->getToken();
            if ($token && $token->getUser() instanceof User) {
                $auditLog->setUser($token->getUser());
            }
        }

        // Set int_adr (explicit parameter takes precedence)
        if ($intAdr !== null) {
            $auditLog->setIntAdr($intAdr);
        } elseif ($auditLog->getUser()) {
            // int_adr is automatically set when user is set, but ensure it's correct
            $auditLog->setIntAdr($auditLog->getUser()->getIntAdr());
        }

        // Set entity info
        if ($entityType) {
            $auditLog->setEntityType($entityType);
        }
        if ($entityId) {
            $auditLog->setEntityId($entityId);
        }

        // Set changed values
        if ($oldValues) {
            $auditLog->setOldValues($this->sanitizeValues($oldValues));
        }
        if ($newValues) {
            $auditLog->setNewValues($this->sanitizeValues($newValues));
        }

        // Set request info
        $request = $this->requestStack->getCurrentRequest();
        if ($request) {
            $auditLog->setIpAddress($request->getClientIp());
            $auditLog->setUserAgent($request->headers->get('User-Agent'));
        }

        $this->auditLogRepository->save($auditLog, true);

        return $auditLog;
    }

    /**
     * Log action by INT_ADR (when User object is not available)
     */
    public function logByIntAdr(
        int $intAdr,
        string $action,
        ?string $entityType = null,
        ?string $entityId = null,
        ?array $oldValues = null,
        ?array $newValues = null
    ): AuditLog {
        return $this->log($action, $entityType, $entityId, $oldValues, $newValues, null, $intAdr);
    }

    /**
     * Log user login
     */
    public function logLogin(User $user): void
    {
        $this->log(
            AuditLog::ACTION_LOGIN,
            'User',
            (string) $user->getId(),
            null,
            null,
            $user
        );
    }

    /**
     * Log user logout
     */
    public function logLogout(User $user): void
    {
        $this->log(
            AuditLog::ACTION_LOGOUT,
            'User',
            (string) $user->getId(),
            null,
            null,
            $user
        );
    }

    /**
     * Log entity creation
     */
    public function logCreate(object $entity, ?array $data = null): void
    {
        $this->log(
            AuditLog::ACTION_CREATE,
            $this->getEntityType($entity),
            $this->getEntityId($entity),
            null,
            $data ?? $this->extractEntityData($entity)
        );
    }

    /**
     * Log entity update
     */
    public function logUpdate(object $entity, array $oldData, array $newData): void
    {
        // Only log if there are actual changes
        $changes = $this->getChangedFields($oldData, $newData);
        if (empty($changes)) {
            return;
        }

        $this->log(
            AuditLog::ACTION_UPDATE,
            $this->getEntityType($entity),
            $this->getEntityId($entity),
            $oldData,
            $newData
        );
    }

    /**
     * Log entity deletion
     */
    public function logDelete(object $entity, ?array $data = null): void
    {
        $this->log(
            AuditLog::ACTION_DELETE,
            $this->getEntityType($entity),
            $this->getEntityId($entity),
            $data ?? $this->extractEntityData($entity),
            null
        );
    }

    /**
     * Log report specific actions
     */
    public function logReportAction(string $action, object $report, ?array $additionalData = null): void
    {
        $data = $additionalData ?? [];
        
        $this->log(
            $action,
            'Report',
            (string) $report->getId(),
            null,
            $data
        );
    }

    /**
     * Log file operations
     */
    public function logFileOperation(string $action, object $file, ?array $additionalData = null): void
    {
        $data = array_merge([
            'filename' => method_exists($file, 'getOriginalName') ? $file->getOriginalName() : null,
            'size' => method_exists($file, 'getSize') ? $file->getSize() : null,
            'mime_type' => method_exists($file, 'getMimeType') ? $file->getMimeType() : null,
        ], $additionalData ?? []);

        $this->log(
            $action,
            'FileAttachment',
            (string) $file->getId(),
            null,
            $data
        );
    }

    /**
     * Get entity type from object
     */
    private function getEntityType(object $entity): string
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
            return (string) $entity->getId();
        }
        
        return spl_object_hash($entity);
    }

    /**
     * Extract data from entity
     */
    private function extractEntityData(object $entity): array
    {
        $data = [];

        // Try to use toArray method if exists
        if (method_exists($entity, 'toArray')) {
            return $entity->toArray();
        }

        // Extract public properties
        $reflection = new \ReflectionClass($entity);
        foreach ($reflection->getProperties(\ReflectionProperty::IS_PUBLIC) as $property) {
            $data[$property->getName()] = $property->getValue($entity);
        }

        // Extract using getters
        foreach ($reflection->getMethods(\ReflectionMethod::IS_PUBLIC) as $method) {
            $methodName = $method->getName();
            if (str_starts_with($methodName, 'get') && $method->getNumberOfParameters() === 0) {
                $propertyName = lcfirst(substr($methodName, 3));
                try {
                    $value = $method->invoke($entity);
                    if (is_scalar($value) || is_array($value) || $value === null) {
                        $data[$propertyName] = $value;
                    }
                } catch (\Throwable) {
                    // Skip problematic getters
                }
            }
        }

        return $data;
    }

    /**
     * Sanitize values to remove sensitive data
     */
    private function sanitizeValues(array $values): array
    {
        $sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'private_key'];
        
        foreach ($values as $key => $value) {
            // Remove sensitive fields
            foreach ($sensitiveKeys as $sensitiveKey) {
                if (stripos($key, $sensitiveKey) !== false) {
                    $values[$key] = '***REDACTED***';
                    continue 2;
                }
            }

            // Recursively sanitize arrays
            if (is_array($value)) {
                $values[$key] = $this->sanitizeValues($value);
            }

            // Limit string length to prevent excessive storage
            if (is_string($value) && strlen($value) > 1000) {
                $values[$key] = substr($value, 0, 1000) . '... (truncated)';
            }
        }

        return $values;
    }

    /**
     * Get changed fields between old and new data
     */
    private function getChangedFields(array $oldData, array $newData): array
    {
        $changes = [];
        
        foreach ($newData as $key => $newValue) {
            $oldValue = $oldData[$key] ?? null;
            
            // Skip if values are the same
            if ($oldValue === $newValue) {
                continue;
            }

            // Handle special comparison for arrays/objects
            if (is_array($oldValue) && is_array($newValue)) {
                if (json_encode($oldValue) === json_encode($newValue)) {
                    continue;
                }
            }

            $changes[$key] = [
                'old' => $oldValue,
                'new' => $newValue,
            ];
        }

        return $changes;
    }
}