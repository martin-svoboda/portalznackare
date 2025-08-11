<?php

namespace App\Repository;

use App\Entity\InsyzAuditLog;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<InsyzAuditLog>
 *
 * @method InsyzAuditLog|null find($id, $lockMode = null, $lockVersion = null)
 * @method InsyzAuditLog|null findOneBy(array $criteria, array $orderBy = null)
 * @method InsyzAuditLog[]    findAll()
 * @method InsyzAuditLog[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class InsyzAuditLogRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, InsyzAuditLog::class);
    }

    /**
     * Find logs by user INT_ADR with pagination
     */
    public function findByIntAdr(int $intAdr, int $limit = 50, int $offset = 0): array
    {
        return $this->createQueryBuilder('ial')
            ->andWhere('ial.intAdr = :intAdr')
            ->setParameter('intAdr', $intAdr)
            ->orderBy('ial.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->setFirstResult($offset)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find logs by endpoint with date range
     */
    public function findByEndpoint(
        string $endpoint, 
        ?\DateTimeInterface $startDate = null, 
        ?\DateTimeInterface $endDate = null,
        int $limit = 100
    ): array {
        $qb = $this->createQueryBuilder('ial')
            ->andWhere('ial.endpoint LIKE :endpoint')
            ->setParameter('endpoint', '%' . $endpoint . '%')
            ->orderBy('ial.createdAt', 'DESC')
            ->setMaxResults($limit);

        if ($startDate) {
            $qb->andWhere('ial.createdAt >= :startDate')
               ->setParameter('startDate', $startDate);
        }

        if ($endDate) {
            $qb->andWhere('ial.createdAt <= :endDate')
               ->setParameter('endDate', $endDate);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Find slow queries (for performance analysis)
     */
    public function findSlowQueries(int $minDurationMs = 2000, int $limit = 50): array
    {
        return $this->createQueryBuilder('ial')
            ->andWhere('ial.durationMs >= :minDuration')
            ->setParameter('minDuration', $minDurationMs)
            ->orderBy('ial.durationMs', 'DESC')
            ->addOrderBy('ial.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find slow MSSQL queries specifically
     */
    public function findSlowMssqlQueries(int $minDurationMs = 5000, int $limit = 50): array
    {
        return $this->createQueryBuilder('ial')
            ->andWhere('ial.mssqlDurationMs >= :minDuration')
            ->setParameter('minDuration', $minDurationMs)
            ->andWhere('ial.mssqlProcedure IS NOT NULL')
            ->orderBy('ial.mssqlDurationMs', 'DESC')
            ->addOrderBy('ial.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Get error logs for debugging
     */
    public function findErrors(int $limit = 100): array
    {
        return $this->createQueryBuilder('ial')
            ->andWhere('ial.status IN (:errorStatuses)')
            ->setParameter('errorStatuses', [InsyzAuditLog::STATUS_ERROR, InsyzAuditLog::STATUS_TIMEOUT])
            ->orderBy('ial.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Statistics methods for monitoring dashboard
     */

    /**
     * Get endpoint usage statistics
     */
    public function getEndpointStatistics(\DateTimeInterface $startDate, \DateTimeInterface $endDate): array
    {
        $qb = $this->getEntityManager()->createQueryBuilder();
        
        return $qb->select('ial.endpoint')
            ->addSelect('COUNT(ial.id) as request_count')
            ->addSelect('AVG(ial.durationMs) as avg_duration_ms')
            ->addSelect('MAX(ial.durationMs) as max_duration_ms')
            ->addSelect('SUM(CASE WHEN ial.cacheHit = true THEN 1 ELSE 0 END) as cache_hits')
            ->addSelect('SUM(CASE WHEN ial.status = :errorStatus THEN 1 ELSE 0 END) as error_count')
            ->from(InsyzAuditLog::class, 'ial')
            ->andWhere('ial.createdAt BETWEEN :startDate AND :endDate')
            ->setParameter('startDate', $startDate)
            ->setParameter('endDate', $endDate)
            ->setParameter('errorStatus', InsyzAuditLog::STATUS_ERROR)
            ->groupBy('ial.endpoint')
            ->orderBy('request_count', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Get MSSQL procedure statistics
     */
    public function getMssqlProcedureStatistics(\DateTimeInterface $startDate, \DateTimeInterface $endDate): array
    {
        $qb = $this->getEntityManager()->createQueryBuilder();
        
        return $qb->select('ial.mssqlProcedure')
            ->addSelect('COUNT(ial.id) as call_count')
            ->addSelect('AVG(ial.mssqlDurationMs) as avg_duration_ms')
            ->addSelect('MAX(ial.mssqlDurationMs) as max_duration_ms')
            ->addSelect('SUM(CASE WHEN ial.status = :errorStatus THEN 1 ELSE 0 END) as error_count')
            ->from(InsyzAuditLog::class, 'ial')
            ->andWhere('ial.createdAt BETWEEN :startDate AND :endDate')
            ->andWhere('ial.mssqlProcedure IS NOT NULL')
            ->setParameter('startDate', $startDate)
            ->setParameter('endDate', $endDate)
            ->setParameter('errorStatus', InsyzAuditLog::STATUS_ERROR)
            ->groupBy('ial.mssqlProcedure')
            ->orderBy('call_count', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Get cache effectiveness statistics
     */
    public function getCacheStatistics(\DateTimeInterface $startDate, \DateTimeInterface $endDate): array
    {
        $qb = $this->getEntityManager()->createQueryBuilder();
        
        return $qb->select('ial.endpoint')
            ->addSelect('COUNT(ial.id) as total_requests')
            ->addSelect('SUM(CASE WHEN ial.cacheHit = true THEN 1 ELSE 0 END) as cache_hits')
            ->addSelect('ROUND((SUM(CASE WHEN ial.cacheHit = true THEN 1 ELSE 0 END) * 100.0 / COUNT(ial.id)), 2) as hit_rate_percent')
            ->addSelect('AVG(CASE WHEN ial.cacheHit = false THEN ial.durationMs END) as avg_miss_duration_ms')
            ->addSelect('AVG(CASE WHEN ial.cacheHit = true THEN ial.durationMs END) as avg_hit_duration_ms')
            ->from(InsyzAuditLog::class, 'ial')
            ->andWhere('ial.createdAt BETWEEN :startDate AND :endDate')
            ->setParameter('startDate', $startDate)
            ->setParameter('endDate', $endDate)
            ->groupBy('ial.endpoint')
            ->having('total_requests > 10') // Only endpoints with significant usage
            ->orderBy('total_requests', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Get user activity statistics
     */
    public function getUserActivityStatistics(\DateTimeInterface $startDate, \DateTimeInterface $endDate): array
    {
        $qb = $this->getEntityManager()->createQueryBuilder();
        
        return $qb->select('ial.intAdr')
            ->addSelect('COUNT(ial.id) as request_count')
            ->addSelect('AVG(ial.durationMs) as avg_duration_ms')
            ->addSelect('COUNT(DISTINCT ial.endpoint) as unique_endpoints')
            ->addSelect('SUM(CASE WHEN ial.cacheHit = true THEN 1 ELSE 0 END) as cache_hits')
            ->addSelect('SUM(CASE WHEN ial.status = :errorStatus THEN 1 ELSE 0 END) as error_count')
            ->from(InsyzAuditLog::class, 'ial')
            ->andWhere('ial.createdAt BETWEEN :startDate AND :endDate')
            ->setParameter('startDate', $startDate)
            ->setParameter('endDate', $endDate)
            ->setParameter('errorStatus', InsyzAuditLog::STATUS_ERROR)
            ->groupBy('ial.intAdr')
            ->orderBy('request_count', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Cleanup old logs based on retention policy
     */
    public function cleanupOldLogs(int $retentionDays): int
    {
        $cutoffDate = new \DateTime();
        $cutoffDate->modify("-{$retentionDays} days");

        return $this->createQueryBuilder('ial')
            ->delete()
            ->andWhere('ial.createdAt < :cutoffDate')
            ->setParameter('cutoffDate', $cutoffDate)
            ->getQuery()
            ->execute();
    }

    /**
     * Count total logs for pagination
     */
    public function countByIntAdr(int $intAdr): int
    {
        return $this->createQueryBuilder('ial')
            ->select('COUNT(ial.id)')
            ->andWhere('ial.intAdr = :intAdr')
            ->setParameter('intAdr', $intAdr)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Get recent activity for dashboard
     */
    public function getRecentActivity(int $limit = 20): array
    {
        return $this->createQueryBuilder('ial')
            ->leftJoin('ial.user', 'u')
            ->addSelect('u')
            ->orderBy('ial.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }
}