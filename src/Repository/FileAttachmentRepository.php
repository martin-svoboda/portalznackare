<?php

namespace App\Repository;

use App\Entity\FileAttachment;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<FileAttachment>
 */
class FileAttachmentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, FileAttachment::class);
    }

    public function save(FileAttachment $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(FileAttachment $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Find file by hash (for deduplication)
     */
    public function findByHash(string $hash): ?FileAttachment
    {
        return $this->createQueryBuilder('f')
            ->andWhere('f.hash = :hash')
            ->setParameter('hash', $hash)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Find files by storage path (excluding soft-deleted)
     */
    public function findByStoragePath(string $storagePath): array
    {
        return $this->createQueryBuilder('f')
            ->andWhere('f.storagePath = :path')
            ->andWhere('f.deletedAt IS NULL')
            ->setParameter('path', $storagePath)
            ->orderBy('f.createdAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find files used in specific context (by usage tracking)
     */
    public function findUsedInContext(string $type, int $id): array
    {
        return $this->createQueryBuilder('f')
            ->andWhere('JSON_EXTRACT(f.usageInfo, :usage_key) IS NOT NULL')
            ->andWhere('f.deletedAt IS NULL')
            ->setParameter('usage_key', sprintf('$.\"%s_%d\"', $type, $id))
            ->orderBy('f.createdAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find expired temporary files
     */
    public function findExpiredTemporaryFiles(): array
    {
        return $this->createQueryBuilder('f')
            ->andWhere('f.isTemporary = :temp')
            ->andWhere('f.expiresAt IS NOT NULL')
            ->andWhere('f.expiresAt < :now')
            ->setParameter('temp', true)
            ->setParameter('now', new \DateTimeImmutable())
            ->getQuery()
            ->getResult();
    }

    /**
     * Find orphaned temporary files (older than specified hours)
     */
    public function findOrphanedTemporaryFiles(int $hoursOld = 24): array
    {
        $threshold = new \DateTimeImmutable("-{$hoursOld} hours");
        
        return $this->createQueryBuilder('f')
            ->andWhere('f.isTemporary = :temp')
            ->andWhere('f.contextType IS NULL')
            ->andWhere('f.createdAt < :threshold')
            ->setParameter('temp', true)
            ->setParameter('threshold', $threshold)
            ->getQuery()
            ->getResult();
    }


    /**
     * Find soft-deleted files past grace period
     */
    public function findSoftDeletedPastGracePeriod(int $gracePeriodHours = 24): array
    {
        $threshold = new \DateTimeImmutable("-{$gracePeriodHours} hours");
        
        return $this->createQueryBuilder('f')
            ->andWhere('f.deletedAt IS NOT NULL')
            ->andWhere('f.deletedAt < :threshold')
            ->andWhere('f.physicallyDeleted = :false')
            ->setParameter('threshold', $threshold)
            ->setParameter('false', false)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find all files for storage path (including soft-deleted for recovery)
     */
    public function findAllByStoragePath(string $storagePath): array
    {
        return $this->createQueryBuilder('f')
            ->andWhere('f.storagePath = :path')
            ->setParameter('path', $storagePath)
            ->orderBy('f.createdAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Override default find methods to exclude soft-deleted
     */
    public function findAll(): array
    {
        return $this->createQueryBuilder('f')
            ->andWhere('f.deletedAt IS NULL')
            ->getQuery()
            ->getResult();
    }

    /**
     * Get storage statistics
     */
    public function getStorageStatistics(): array
    {
        $qb = $this->createQueryBuilder('f');
        
        return [
            'totalFiles' => $qb->select('COUNT(f.id)')
                ->where('f.deletedAt IS NULL')
                ->getQuery()->getSingleScalarResult(),
            'totalSize' => $qb->select('SUM(f.size)')
                ->where('f.deletedAt IS NULL')
                ->getQuery()->getSingleScalarResult() ?? 0,
            'temporaryFiles' => $qb->select('COUNT(f.id)')
                ->where('f.isTemporary = true')
                ->andWhere('f.deletedAt IS NULL')
                ->getQuery()->getSingleScalarResult(),
            'permanentFiles' => $qb->select('COUNT(f.id)')
                ->where('f.isTemporary = false')
                ->andWhere('f.deletedAt IS NULL')
                ->getQuery()->getSingleScalarResult(),
            'softDeletedFiles' => $qb->select('COUNT(f.id)')
                ->where('f.deletedAt IS NOT NULL')
                ->andWhere('f.physicallyDeleted = false')
                ->getQuery()->getSingleScalarResult(),
        ];
    }
}