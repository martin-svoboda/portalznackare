<?php

namespace App\Repository;

use App\Entity\Report;
use App\Enum\ReportStateEnum;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Report>
 */
class ReportRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Report::class);
    }

    /**
     * Find report by order ID and user address
     */
    public function findByOrderAndUser(int $idZp, int $intAdr): ?Report
    {
        return $this->findOneBy(['idZp' => $idZp, 'intAdr' => $intAdr]);
    }

    /**
     * Find all reports for a specific order
     */
    public function findByOrder(int $idZp): array
    {
        return $this->findBy(['idZp' => $idZp], ['dateCreated' => 'ASC']);
    }

    /**
     * Find reports by user with optional state filter
     */
    public function findByUser(int $intAdr, ?ReportStateEnum $state = null): array
    {
        $criteria = ['intAdr' => $intAdr];
        if ($state !== null) {
            $criteria['state'] = $state;
        }

        return $this->findBy($criteria, ['dateUpdated' => 'DESC']);
    }

    /**
     * Find reports with specific transport type using PostgreSQL JSONB queries
     */
    public function findReportsWithTransportType(string $transportType): array
    {
        return $this->createQueryBuilder('r')
            ->where("JSON_EXTRACT(r.dataA, '$.travelSegments') IS NOT NULL")
            ->andWhere("JSON_SEARCH(JSON_EXTRACT(r.dataA, '$.travelSegments[*].transportType'), 'one', :transportType) IS NOT NULL")
            ->setParameter('transportType', $transportType)
            ->getQuery()
            ->getResult();
    }

    /**
     * Get compensation statistics for a date range
     */
    public function getCompensationStatistics(\DateTimeInterface $from, \DateTimeInterface $to): array
    {
        $qb = $this->createQueryBuilder('r')
            ->select([
                'AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(r.calculation, \'$.total\')) AS DECIMAL(10,2))) as avg_compensation',
                'SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(r.calculation, \'$.total\')) AS DECIMAL(10,2))) as total_compensation',
                'COUNT(r.id) as report_count'
            ])
            ->where('r.dateSend BETWEEN :from AND :to')
            ->andWhere('r.state = :state')
            ->setParameter('from', $from)
            ->setParameter('to', $to)
            ->setParameter('state', ReportStateEnum::SEND);

        $result = $qb->getQuery()->getSingleResult();

        return [
            'avg_compensation' => (float) ($result['avg_compensation'] ?? 0),
            'total_compensation' => (float) ($result['total_compensation'] ?? 0),
            'report_count' => (int) ($result['report_count'] ?? 0)
        ];
    }

    /**
     * Find reports that need approval (sent but not yet processed)
     */
    public function findPendingApproval(): array
    {
        return $this->findBy(['state' => ReportStateEnum::SEND], ['dateSend' => 'ASC']);
    }

    /**
     * Get reports summary by state
     */
    public function getReportsSummaryByState(): array
    {
        $qb = $this->createQueryBuilder('r')
            ->select(['r.state', 'COUNT(r.id) as count'])
            ->groupBy('r.state');

        $results = $qb->getQuery()->getResult();

        $summary = [];
        foreach ($results as $result) {
            $summary[$result['state']->value] = [
                'state' => $result['state'],
                'count' => (int) $result['count'],
                'label' => $result['state']->getLabel(),
                'color' => $result['state']->getColor()
            ];
        }

        return $summary;
    }

    /**
     * Find reports with missing compensation calculation
     */
    public function findReportsWithoutCalculation(): array
    {
        return $this->createQueryBuilder('r')
            ->where('JSON_LENGTH(r.calculation) = 0 OR r.calculation IS NULL')
            ->andWhere('r.state != :draft')
            ->setParameter('draft', ReportStateEnum::DRAFT)
            ->getQuery()
            ->getResult();
    }

    /**
     * Search reports by comment content (for debugging/support)
     */
    public function searchByComment(string $searchTerm): array
    {
        return $this->createQueryBuilder('r')
            ->where("JSON_UNQUOTE(JSON_EXTRACT(r.dataB, '$.routeComment')) LIKE :searchTerm")
            ->setParameter('searchTerm', '%' . $searchTerm . '%')
            ->getQuery()
            ->getResult();
    }

    /**
     * Get monthly statistics
     */
    public function getMonthlyStatistics(int $year): array
    {
        $qb = $this->createQueryBuilder('r')
            ->select([
                'MONTH(r.dateSend) as month',
                'COUNT(r.id) as total_reports',
                'SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(r.calculation, \'$.total\')) AS DECIMAL(10,2))) as total_compensation'
            ])
            ->where('YEAR(r.dateSend) = :year')
            ->andWhere('r.state = :state')
            ->groupBy('MONTH(r.dateSend)')
            ->orderBy('month', 'ASC')
            ->setParameter('year', $year)
            ->setParameter('state', ReportStateEnum::SEND);

        $results = $qb->getQuery()->getResult();

        $statistics = [];
        for ($month = 1; $month <= 12; $month++) {
            $statistics[$month] = [
                'month' => $month,
                'total_reports' => 0,
                'total_compensation' => 0.0
            ];
        }

        foreach ($results as $result) {
            $month = (int) $result['month'];
            $statistics[$month] = [
                'month' => $month,
                'total_reports' => (int) $result['total_reports'],
                'total_compensation' => (float) ($result['total_compensation'] ?? 0)
            ];
        }

        return array_values($statistics);
    }

    public function save(Report $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(Report $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }
}