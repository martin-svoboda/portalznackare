<?php

namespace App\Repository;

use App\Entity\AuditLog;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AuditLog>
 *
 * @method AuditLog|null find($id, $lockMode = null, $lockVersion = null)
 * @method AuditLog|null findOneBy(array $criteria, array $orderBy = null)
 * @method AuditLog[]    findAll()
 * @method AuditLog[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class AuditLogRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AuditLog::class);
    }

    public function save(AuditLog $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Find logs by INT_ADR
     */
    public function findByIntAdr(int $intAdr, int $limit = 100): array
    {
        return $this->createQueryBuilder('a')
            ->where('a.intAdr = :intAdr')
            ->setParameter('intAdr', $intAdr)
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find logs by user
     */
    public function findByUser(User $user, int $limit = 100): array
    {
        return $this->createQueryBuilder('a')
            ->where('a.user = :user')
            ->setParameter('user', $user)
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find logs by entity
     */
    public function findByEntity(string $entityType, string $entityId, int $limit = 100): array
    {
        return $this->createQueryBuilder('a')
            ->where('a.entityType = :entityType')
            ->andWhere('a.entityId = :entityId')
            ->setParameter('entityType', $entityType)
            ->setParameter('entityId', $entityId)
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find logs by action
     */
    public function findByAction(string $action, int $limit = 100): array
    {
        return $this->createQueryBuilder('a')
            ->where('a.action = :action')
            ->setParameter('action', $action)
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Advanced search with filters
     */
    public function search(array $criteria = [], int $limit = 100, int $offset = 0): array
    {
        $qb = $this->createQueryBuilder('a')
            ->leftJoin('a.user', 'u');

        // User filter
        if (isset($criteria['user_id'])) {
            $qb->andWhere('a.user = :userId')
                ->setParameter('userId', $criteria['user_id']);
        }

        // INT_ADR filter (universal user identifier)
        if (isset($criteria['int_adr'])) {
            $qb->andWhere('a.intAdr = :intAdr')
                ->setParameter('intAdr', $criteria['int_adr']);
        }

        // Action filter
        if (isset($criteria['action'])) {
            if (is_array($criteria['action'])) {
                $qb->andWhere('a.action IN (:actions)')
                    ->setParameter('actions', $criteria['action']);
            } else {
                $qb->andWhere('a.action = :action')
                    ->setParameter('action', $criteria['action']);
            }
        }

        // Entity filter
        if (isset($criteria['entity_type'])) {
            $qb->andWhere('a.entityType = :entityType')
                ->setParameter('entityType', $criteria['entity_type']);
        }

        if (isset($criteria['entity_id'])) {
            $qb->andWhere('a.entityId = :entityId')
                ->setParameter('entityId', $criteria['entity_id']);
        }

        // Date range filter
        if (isset($criteria['date_from'])) {
            $qb->andWhere('a.createdAt >= :dateFrom')
                ->setParameter('dateFrom', $criteria['date_from']);
        }

        if (isset($criteria['date_to'])) {
            $qb->andWhere('a.createdAt <= :dateTo')
                ->setParameter('dateTo', $criteria['date_to']);
        }

        // IP address filter
        if (isset($criteria['ip_address'])) {
            $qb->andWhere('a.ipAddress = :ipAddress')
                ->setParameter('ipAddress', $criteria['ip_address']);
        }

        // Search in changed values
        if (isset($criteria['search_values'])) {
            $searchTerm = '%' . $criteria['search_values'] . '%';
            $qb->andWhere('(CAST(a.oldValues AS TEXT) LIKE :searchTerm OR CAST(a.newValues AS TEXT) LIKE :searchTerm)')
                ->setParameter('searchTerm', $searchTerm);
        }

        return $qb->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->setFirstResult($offset)
            ->getQuery()
            ->getResult();
    }

    /**
     * Count logs matching criteria
     */
    public function countSearch(array $criteria = []): int
    {
        $qb = $this->createQueryBuilder('a')
            ->select('COUNT(a.id)');

        // Apply same filters as search method
        if (isset($criteria['user_id'])) {
            $qb->andWhere('a.user = :userId')
                ->setParameter('userId', $criteria['user_id']);
        }

        if (isset($criteria['int_adr'])) {
            $qb->andWhere('a.intAdr = :intAdr')
                ->setParameter('intAdr', $criteria['int_adr']);
        }

        if (isset($criteria['action'])) {
            if (is_array($criteria['action'])) {
                $qb->andWhere('a.action IN (:actions)')
                    ->setParameter('actions', $criteria['action']);
            } else {
                $qb->andWhere('a.action = :action')
                    ->setParameter('action', $criteria['action']);
            }
        }

        if (isset($criteria['entity_type'])) {
            $qb->andWhere('a.entityType = :entityType')
                ->setParameter('entityType', $criteria['entity_type']);
        }

        if (isset($criteria['date_from'])) {
            $qb->andWhere('a.createdAt >= :dateFrom')
                ->setParameter('dateFrom', $criteria['date_from']);
        }

        if (isset($criteria['date_to'])) {
            $qb->andWhere('a.createdAt <= :dateTo')
                ->setParameter('dateTo', $criteria['date_to']);
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Get activity statistics
     */
    public function getActivityStatistics(\DateTimeInterface $since = null): array
    {
        if (!$since) {
            $since = new \DateTimeImmutable('-30 days');
        }

        // Actions count
        $actionStats = $this->createQueryBuilder('a')
            ->select('a.action, COUNT(a.id) as count')
            ->where('a.createdAt >= :since')
            ->setParameter('since', $since)
            ->groupBy('a.action')
            ->orderBy('count', 'DESC')
            ->getQuery()
            ->getResult();

        // Most active users (by INT_ADR)
        $userStats = $this->createQueryBuilder('a')
            ->select('a.intAdr, u.jmeno, u.prijmeni, COUNT(a.id) as count')
            ->leftJoin('a.user', 'u')
            ->where('a.createdAt >= :since')
            ->andWhere('a.intAdr IS NOT NULL')
            ->setParameter('since', $since)
            ->groupBy('a.intAdr, u.jmeno, u.prijmeni')
            ->orderBy('count', 'DESC')
            ->setMaxResults(10)
            ->getQuery()
            ->getResult();

        // Activity by day - používáme nativní SQL dotaz pro PostgreSQL
        $connection = $this->getEntityManager()->getConnection();
        $sql = "SELECT DATE(created_at) as day, COUNT(id) as count 
                FROM audit_logs 
                WHERE created_at >= ? 
                GROUP BY DATE(created_at) 
                ORDER BY DATE(created_at) ASC";
        $result = $connection->executeQuery($sql, [$since->format('Y-m-d H:i:s')]);
        $dailyStats = $result->fetchAllAssociative();
        
        // Převést na formát který očekává frontend
        $dailyStats = array_map(function($row) {
            return [
                'day' => $row['day'],
                'count' => (int)$row['count']
            ];
        }, $dailyStats);

        return [
            'actions' => $actionStats,
            'top_users' => $userStats,
            'daily_activity' => $dailyStats,
        ];
    }

    /**
     * Get user activity by INT_ADR across time periods
     */
    public function getUserActivityByIntAdr(int $intAdr, \DateTimeInterface $since = null): array
    {
        if (!$since) {
            $since = new \DateTimeImmutable('-30 days');
        }

        // Actions by type
        $actionStats = $this->createQueryBuilder('a')
            ->select('a.action, COUNT(a.id) as count')
            ->where('a.intAdr = :intAdr')
            ->andWhere('a.createdAt >= :since')
            ->setParameter('intAdr', $intAdr)
            ->setParameter('since', $since)
            ->groupBy('a.action')
            ->orderBy('count', 'DESC')
            ->getQuery()
            ->getResult();

        // Daily activity - používáme nativní SQL dotaz pro PostgreSQL
        $connection = $this->getEntityManager()->getConnection();
        $sql = "SELECT DATE(created_at) as day, COUNT(id) as count 
                FROM audit_logs 
                WHERE int_adr = ? AND created_at >= ? 
                GROUP BY DATE(created_at) 
                ORDER BY DATE(created_at) ASC";
        $result = $connection->executeQuery($sql, [$intAdr, $since->format('Y-m-d H:i:s')]);
        $dailyActivity = $result->fetchAllAssociative();
        
        // Převést na formát který očekává frontend
        $dailyActivity = array_map(function($row) {
            return [
                'day' => $row['day'],
                'count' => (int)$row['count']
            ];
        }, $dailyActivity);

        return [
            'int_adr' => $intAdr,
            'actions' => $actionStats,
            'daily_activity' => $dailyActivity,
        ];
    }

    /**
     * Clean up old logs
     */
    public function cleanupOldLogs(int $daysToKeep = 90): int
    {
        $cutoffDate = new \DateTimeImmutable("-{$daysToKeep} days");

        return $this->createQueryBuilder('a')
            ->delete()
            ->where('a.createdAt < :cutoffDate')
            ->setParameter('cutoffDate', $cutoffDate)
            ->getQuery()
            ->execute();
    }
}