<?php

namespace App\Service;

use App\Entity\InsyzAuditLog;
use App\Entity\User;
use App\Repository\InsyzAuditLogRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;

class InsyzAuditLogger
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private InsyzAuditLogRepository $auditLogRepository,
        private SystemOptionService $systemOptions,
        private RequestStack $requestStack,
        private LoggerInterface $logger
    ) {
    }

    /**
     * Log INSYZ API call with comprehensive details
     */
    public function logApiCall(
        string $endpoint,
        string $method,
        ?User $user = null,
        ?int $intAdr = null,
        float $startTime = null,
        ?string $mssqlProcedure = null,
        ?float $mssqlStartTime = null,
        bool $cacheHit = false,
        ?array $requestParams = null,
        mixed $responseData = null,
        ?string $error = null
    ): void {
        // Check if INSYZ audit logging is enabled
        if (!$this->isInsyzAuditEnabled()) {
            return;
        }

        try {
            $auditLog = new InsyzAuditLog();

            // Set user and int_adr
            if ($user) {
                $auditLog->setUser($user);
            } elseif ($intAdr) {
                $auditLog->setIntAdr($intAdr);
            } else {
                // For login attempts, we need to log even without user identification
                // to track failed login attempts with email/credentials
                $isLoginEndpoint = (
                    str_contains($endpoint, 'login') ||
                    str_contains($mssqlProcedure ?? '', 'WEB_Login')
                );

                if (!$isLoginEndpoint) {
                    // For non-login endpoints, skip if no user identification
                    return;
                }
                // Continue logging for login attempts - use 0 to indicate no INT_ADR available yet
                $auditLog->setIntAdr(0);
            }

            // Set basic request info
            $auditLog->setEndpoint($endpoint);
            $auditLog->setMethod($method);

            // Set timing information
            if ($startTime !== null) {
                $duration = round((microtime(true) - $startTime) * 1000);
                $auditLog->setDurationMs($duration);
            }

            if ($mssqlProcedure) {
                $auditLog->setMssqlProcedure($mssqlProcedure);
                
                if ($mssqlStartTime !== null) {
                    $mssqlDuration = round((microtime(true) - $mssqlStartTime) * 1000);
                    $auditLog->setMssqlDurationMs($mssqlDuration);
                }
            }

            // Set cache information
            $auditLog->setCacheHit($cacheHit);
            
            // Determine status
            if ($error) {
                $auditLog->setStatus($cacheHit ? InsyzAuditLog::STATUS_CACHE_HIT : InsyzAuditLog::STATUS_ERROR);
                $auditLog->setErrorMessage($error);
            } else {
                $auditLog->setStatus($cacheHit ? InsyzAuditLog::STATUS_CACHE_HIT : InsyzAuditLog::STATUS_SUCCESS);
            }

            // Set request parameters (sanitized)
            if ($requestParams && $this->shouldLogRequestParams()) {
                $sanitizedParams = $auditLog->sanitizeRequestParams($requestParams);
                $auditLog->setRequestParams($sanitizedParams);
            }

            // Set response summary (not full response)
            if ($responseData && $this->shouldLogResponseSummary()) {
                $responseSummary = $auditLog->createResponseSummary($responseData);
                $auditLog->setResponseSummary($responseSummary);
            }

            // Set request context from current HTTP request
            $this->setRequestContext($auditLog);

            // Persist the audit log
            $this->entityManager->persist($auditLog);
            $this->entityManager->flush();

        } catch (\Exception $e) {
            // Never let audit logging break the application
            $this->logger->error('Failed to log INSYZ API call', [
                'endpoint' => $endpoint,
                'method' => $method,
                'int_adr' => $intAdr ?? $user?->getIntAdr(),
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Simplified logging method for quick calls
     */
    public function logApiSuccess(
        string $endpoint,
        string $method,
        User $user,
        float $startTime,
        mixed $responseData = null,
        bool $cacheHit = false,
        ?string $mssqlProcedure = null,
        ?float $mssqlStartTime = null
    ): void {
        $this->logApiCall(
            endpoint: $endpoint,
            method: $method,
            user: $user,
            startTime: $startTime,
            mssqlProcedure: $mssqlProcedure,
            mssqlStartTime: $mssqlStartTime,
            cacheHit: $cacheHit,
            responseData: $responseData
        );
    }

    /**
     * Log API error
     */
    public function logApiError(
        string $endpoint,
        string $method,
        ?User $user,
        float $startTime,
        string $error,
        ?array $requestParams = null,
        ?string $mssqlProcedure = null
    ): void {
        $this->logApiCall(
            endpoint: $endpoint,
            method: $method,
            user: $user,
            startTime: $startTime,
            mssqlProcedure: $mssqlProcedure,
            requestParams: $requestParams,
            error: $error
        );
    }

    /**
     * Log MSSQL procedure call specifically
     */
    public function logMssqlProcedureCall(
        string $endpoint,
        string $procedure,
        array $params,
        float $startTime,
        ?User $user = null,
        ?int $intAdr = null,
        mixed $result = null,
        ?string $error = null
    ): void {
        if (!$this->shouldLogMssqlQueries()) {
            return;
        }

        $this->logApiCall(
            endpoint: $endpoint,
            method: 'CALL',
            user: $user,
            intAdr: $intAdr,
            startTime: $startTime,
            mssqlProcedure: $procedure,
            mssqlStartTime: $startTime,
            requestParams: $params,
            responseData: $result,
            error: $error
        );
    }

    /**
     * Configuration methods
     */

    private function isInsyzAuditEnabled(): bool
    {
        return $this->systemOptions->get('insyz_audit.enabled', true);
    }

    private function shouldLogRequestParams(): bool
    {
        return $this->systemOptions->get('insyz_audit.log_requests', true);
    }

    private function shouldLogResponseSummary(): bool
    {
        return $this->systemOptions->get('insyz_audit.log_responses', true);
    }

    private function shouldLogMssqlQueries(): bool
    {
        return $this->systemOptions->get('insyz_audit.log_mssql_queries', true);
    }

    private function shouldLogCacheOperations(): bool
    {
        return $this->systemOptions->get('insyz_audit.log_cache_operations', true);
    }

    /**
     * Set request context information from current HTTP request
     */
    private function setRequestContext(InsyzAuditLog $auditLog): void
    {
        $request = $this->requestStack->getCurrentRequest();
        
        if ($request) {
            $auditLog->setIpAddress($request->getClientIp());
            $auditLog->setUserAgent($request->headers->get('User-Agent'));
        }
    }

    /**
     * Cleanup operations
     */

    /**
     * Clean up old audit logs based on retention policy
     */
    public function cleanupOldLogs(): int
    {
        $retentionDays = $this->systemOptions->get('insyz_audit.retention_days', 90);
        
        if ($retentionDays <= 0) {
            return 0; // Retention disabled
        }

        try {
            $deletedCount = $this->auditLogRepository->cleanupOldLogs($retentionDays);
            
            $this->logger->info('INSYZ audit logs cleanup completed', [
                'retention_days' => $retentionDays,
                'deleted_logs' => $deletedCount
            ]);
            
            return $deletedCount;
        } catch (\Exception $e) {
            $this->logger->error('Failed to cleanup INSYZ audit logs', [
                'error' => $e->getMessage()
            ]);
            
            return 0;
        }
    }

    /**
     * Statistics and reporting methods
     */

    /**
     * Get performance statistics for monitoring
     */
    public function getPerformanceStatistics(string $period = '24 hours'): array
    {
        $startDate = new \DateTime();
        $startDate->modify("-{$period}");
        $endDate = new \DateTime();

        return [
            'period' => $period,
            'start_date' => $startDate->format('Y-m-d H:i:s'),
            'end_date' => $endDate->format('Y-m-d H:i:s'),
            'endpoint_stats' => $this->auditLogRepository->getEndpointStatistics($startDate, $endDate),
            'mssql_stats' => $this->auditLogRepository->getMssqlProcedureStatistics($startDate, $endDate),
            'cache_stats' => $this->auditLogRepository->getCacheStatistics($startDate, $endDate),
            'user_stats' => $this->auditLogRepository->getUserActivityStatistics($startDate, $endDate),
        ];
    }

    /**
     * Get slow queries for performance analysis
     */
    public function getSlowQueries(int $minDurationMs = 2000, int $limit = 50): array
    {
        return $this->auditLogRepository->findSlowQueries($minDurationMs, $limit);
    }

    /**
     * Get error logs for debugging
     */
    public function getErrorLogs(int $limit = 100): array
    {
        return $this->auditLogRepository->findErrors($limit);
    }

    /**
     * Get recent activity for dashboard
     */
    public function getRecentActivity(int $limit = 20): array
    {
        return $this->auditLogRepository->getRecentActivity($limit);
    }

    /**
     * Get logs for specific user
     */
    public function getUserLogs(int $intAdr, int $limit = 50, int $offset = 0): array
    {
        return $this->auditLogRepository->findByIntAdr($intAdr, $limit, $offset);
    }

    /**
     * Get logs for specific endpoint
     */
    public function getEndpointLogs(
        string $endpoint, 
        ?\DateTimeInterface $startDate = null, 
        ?\DateTimeInterface $endDate = null,
        int $limit = 100
    ): array {
        return $this->auditLogRepository->findByEndpoint($endpoint, $startDate, $endDate, $limit);
    }
}