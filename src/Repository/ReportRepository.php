<?php

namespace App\Repository;

use App\Entity\Report;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\LockMode;
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
     * Najde hlášení příkazu a zamkne řádek (SELECT ... FOR UPDATE) do konce transakce.
     * Volat jen uvnitř aktivní transakce.
     */
    public function findOneByIdZpForUpdate(int $idZp): ?Report
    {
        return $this->createQueryBuilder('r')
            ->where('r.idZp = :idZp')
            ->setParameter('idZp', $idZp)
            ->getQuery()
            ->setLockMode(LockMode::PESSIMISTIC_WRITE)
            ->getOneOrNullResult();
    }

    /**
     * Vrátí mapu id_zp => stav hlášení pro zadané ID příkazů
     * @param int[] $idZpList
     * @return array<int, string> mapa id_zp => stav (hodnota enumu)
     */
    public function getReportStatesForOrders(array $idZpList): array
    {
        if (empty($idZpList)) {
            return [];
        }

        $results = $this->createQueryBuilder('r')
            ->select('r.idZp', 'r.state')
            ->where('r.idZp IN (:ids)')
            ->setParameter('ids', $idZpList)
            ->getQuery()
            ->getResult();

        $map = [];
        foreach ($results as $row) {
            $map[(int) $row['idZp']] = $row['state']->value;
        }

        return $map;
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