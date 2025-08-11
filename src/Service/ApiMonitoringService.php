<?php

namespace App\Service;

use App\Entity\User;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Request;

class ApiMonitoringService
{
    public function __construct(
        private LoggerInterface $logger,
        private AuditLogger $auditLogger
    ) {
    }

    /**
     * Logování API requestu s performance metrikami
     */
    public function logApiRequest(
        Request $request, 
        ?User $user, 
        float $startTime,
        ?array $responseData = null,
        ?string $errorMessage = null
    ): void {
        $duration = round((microtime(true) - $startTime) * 1000, 2); // ms
        $endpoint = $request->getPathInfo();
        $method = $request->getMethod();
        $intAdr = $user?->getIntAdr();
        
        $logData = [
            'endpoint' => $endpoint,
            'method' => $method,
            'duration_ms' => $duration,
            'user_int_adr' => $intAdr,
            'ip_address' => $request->getClientIp(),
            'user_agent' => $request->headers->get('User-Agent'),
            'params' => $this->sanitizeParams($request->query->all()),
        ];

        if ($errorMessage) {
            $logData['error'] = $errorMessage;
            $logData['status'] = 'error';
        } else {
            $logData['status'] = 'success';
            if ($responseData && is_array($responseData)) {
                $logData['response_size'] = strlen(json_encode($responseData));
                if (isset($responseData[0]) && is_array($responseData[0])) {
                    $logData['items_count'] = count($responseData);
                }
            }
        }

        // Základní API logging
        $this->logger->info('API Request', $logData);

        // Performance monitoring - upozornění na pomalé requesty
        if ($duration > 2000) { // > 2 sekundy
            $this->logger->warning('Slow API Request detected', $logData);
        }

        // Audit logging pro tracked endpointy
        if ($intAdr && $this->shouldAuditEndpoint($endpoint)) {
            $this->auditLogger->logByIntAdr(
                $intAdr,
                'api_request',
                'API',
                null,
                sprintf('%s %s', $method, $endpoint),
                array_merge($logData, ['tracked_endpoint' => true])
            );
        }
    }

    /**
     * Logování MSSQL dotazů pro monitoring
     */
    public function logMssqlQuery(
        string $procedure,
        array $params,
        float $startTime,
        ?int $resultCount = null,
        ?string $error = null
    ): void {
        $duration = round((microtime(true) - $startTime) * 1000, 2);
        
        $logData = [
            'procedure' => $procedure,
            'duration_ms' => $duration,
            'result_count' => $resultCount,
            'params_count' => count($params)
        ];

        if ($error) {
            $logData['error'] = $error;
            $this->logger->error('MSSQL Query failed', $logData);
        } else {
            $this->logger->info('MSSQL Query executed', $logData);
            
            // Warning pro pomalé queries
            if ($duration > 5000) { // > 5 sekund
                $this->logger->warning('Slow MSSQL Query detected', $logData);
            }
        }
    }

    /**
     * Logování cache hit/miss pro optimalizaci
     */
    public function logCacheOperation(string $operation, string $key, ?float $duration = null): void
    {
        $logData = [
            'cache_operation' => $operation,
            'cache_key' => $key,
        ];

        if ($duration !== null) {
            $logData['duration_ms'] = round($duration * 1000, 2);
        }

        $this->logger->info('Cache Operation', $logData);
    }

    /**
     * Agregované statistiky pro monitoring dashboard
     */
    public function getApiStatistics(string $period = '1 hour'): array
    {
        // Toto by implementovalo čtení z logů nebo metrics store
        // Prozatím mock data, později implementace dle zvolené metrics platformy
        
        return [
            'period' => $period,
            'total_requests' => 0,
            'avg_response_time' => 0,
            'error_rate' => 0,
            'top_endpoints' => [],
            'slow_queries' => [],
            'cache_hit_rate' => 0,
            'timestamp' => time()
        ];
    }

    /**
     * Detekce podezřelých aktivit (spam, abuse)
     */
    public function detectSuspiciousActivity(Request $request, ?User $user): bool
    {
        if (!$user) {
            return false;
        }

        $intAdr = $user->getIntAdr();
        $endpoint = $request->getPathInfo();
        
        // Jednoduchá detekce - v produkci by bylo sofistikovanější
        $suspiciousPatterns = [
            // Více než 100 requestů za minutu od jednoho uživatele
            'rapid_requests' => $this->checkRapidRequests($intAdr),
            // Opakované volání stejného endpointu
            'repeated_endpoint' => $this->checkRepeatedEndpoint($intAdr, $endpoint),
        ];

        $isSuspicious = array_reduce($suspiciousPatterns, fn($carry, $pattern) => $carry || $pattern, false);

        if ($isSuspicious) {
            $this->logger->warning('Suspicious API activity detected', [
                'int_adr' => $intAdr,
                'endpoint' => $endpoint,
                'ip_address' => $request->getClientIp(),
                'patterns' => $suspiciousPatterns
            ]);

            // Audit log pro security tracking
            $this->auditLogger->logByIntAdr(
                $intAdr,
                'suspicious_activity',
                'Security',
                null,
                'Podezřelá API aktivita detekována',
                $suspiciousPatterns
            );
        }

        return $isSuspicious;
    }

    private function sanitizeParams(array $params): array
    {
        // Odstranit citlivé informace z logování
        $sensitiveKeys = ['password', 'hash', 'token', 'key'];
        
        foreach ($sensitiveKeys as $key) {
            if (isset($params[$key])) {
                $params[$key] = '[REDACTED]';
            }
        }
        
        return $params;
    }

    private function shouldAuditEndpoint(string $endpoint): bool
    {
        $trackedEndpoints = [
            '/api/portal/report',
            '/api/users/',
            '/api/system-options/',
            // POZOR: /api/insyz/* endpointy mají vlastní InsyzAuditLogger - netrackovat zde!
        ];

        foreach ($trackedEndpoints as $tracked) {
            if (str_starts_with($endpoint, $tracked)) {
                return true;
            }
        }

        return false;
    }

    private function checkRapidRequests(int $intAdr): bool
    {
        // Implementace check rapid requests
        // Prozatím mock - v produkci by to četlo z cache/metrics
        return false;
    }

    private function checkRepeatedEndpoint(int $intAdr, string $endpoint): bool
    {
        // Implementace check repeated endpoint calls
        // Prozatím mock
        return false;
    }
}