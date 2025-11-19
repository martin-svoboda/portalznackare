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
     * Find file by hash and original name (for smart deduplication)
     */
    public function findByHashAndOriginalName(string $hash, string $originalName): ?FileAttachment
    {
        return $this->createQueryBuilder('f')
            ->andWhere('f.hash = :hash')
            ->andWhere('f.originalName = :original_name')
            ->setParameter('hash', $hash)
            ->setParameter('original_name', $originalName)
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
            ->andWhere('f.usageInfo IS NULL OR JSON_LENGTH(f.usageInfo) = 0')
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

    /**
     * Get folder structure by parsing storage_path
     * Returns hierarchical tree structure with depth for flat rendering
     */
    public function getFolderStructure(): array
    {
        $conn = $this->getEntityManager()->getConnection();

        // Get all unique storage paths
        $sql = "
            SELECT DISTINCT storage_path, COUNT(*) OVER (PARTITION BY storage_path) as count
            FROM file_attachments
            WHERE deleted_at IS NULL
            ORDER BY storage_path ASC
        ";

        $stmt = $conn->prepare($sql);
        $result = $stmt->executeQuery();
        $paths = $result->fetchAllAssociative();

        // Build flat list with depth from path segments
        $folders = [];
        $seen = [];

        foreach ($paths as $row) {
            $fullPath = $row['storage_path'];
            $parts = explode('/', $fullPath);

            // Build cumulative paths for each level
            $currentPath = '';
            foreach ($parts as $index => $part) {
                if (empty($part)) continue;

                $currentPath .= ($currentPath ? '/' : '') . $part;

                // Skip if already processed this path
                if (isset($seen[$currentPath])) {
                    continue;
                }

                $seen[$currentPath] = true;

                // Count files in this folder and subfolders
                $countSql = "
                    SELECT COUNT(*) as count
                    FROM file_attachments
                    WHERE deleted_at IS NULL
                    AND storage_path LIKE :path
                ";
                $countStmt = $conn->prepare($countSql);
                $countStmt->bindValue('path', $currentPath . '%');
                $countResult = $countStmt->executeQuery();
                $count = (int)$countResult->fetchOne();

                $folders[] = [
                    'name' => $part,
                    'path' => $currentPath,
                    'depth' => $index,
                    'count' => $count
                ];
            }
        }

        // Sort by path to ensure parent-child order
        usort($folders, fn($a, $b) => strcmp($a['path'], $b['path']));

        return $folders;
    }

    /**
     * Find files for media library with filters
     */
    public function findForLibrary(array $filters = []): array
    {
        $qb = $this->createQueryBuilder('f')
            ->where('f.deletedAt IS NULL')
            ->orderBy('f.createdAt', 'DESC');

        // Filter by folder (parse storage_path)
        if (!empty($filters['folder'])) {
            $qb->andWhere('f.storagePath LIKE :folder')
               ->setParameter('folder', $filters['folder'] . '%');
        }

        // Filter by usage
        if (isset($filters['usage'])) {
            if ($filters['usage'] === 'unused') {
                $qb->andWhere('(f.usageInfo IS NULL OR JSON_LENGTH(f.usageInfo) = 0)');
            } elseif ($filters['usage'] === 'used') {
                $qb->andWhere('f.usageInfo IS NOT NULL')
                   ->andWhere('JSON_LENGTH(f.usageInfo) > 0');
            }
        }

        // Filter by MIME type
        if (!empty($filters['type'])) {
            switch ($filters['type']) {
                case 'images':
                    $qb->andWhere('f.mimeType LIKE :mime')
                       ->setParameter('mime', 'image/%');
                    break;
                case 'pdfs':
                    $qb->andWhere('f.mimeType = :mime')
                       ->setParameter('mime', 'application/pdf');
                    break;
                case 'documents':
                    $qb->andWhere($qb->expr()->orX(
                        $qb->expr()->like('f.mimeType', ':doc1'),
                        $qb->expr()->like('f.mimeType', ':doc2'),
                        $qb->expr()->eq('f.mimeType', ':doc3')
                    ))
                    ->setParameter('doc1', 'application/msword%')
                    ->setParameter('doc2', 'application/vnd.%')
                    ->setParameter('doc3', 'text/plain');
                    break;
            }
        }

        // Search by filename
        if (!empty($filters['search'])) {
            $qb->andWhere($qb->expr()->orX(
                $qb->expr()->like('f.originalName', ':search'),
                $qb->expr()->like('f.storedName', ':search')
            ))
            ->setParameter('search', '%' . $filters['search'] . '%');
        }

        // Filter by uploader
        if (!empty($filters['uploadedBy'])) {
            $qb->andWhere('f.uploadedBy = :uploadedBy')
               ->setParameter('uploadedBy', $filters['uploadedBy']);
        }

        return $qb->getQuery()->getResult();
    }
}