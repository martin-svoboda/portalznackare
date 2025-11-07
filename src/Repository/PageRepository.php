<?php

namespace App\Repository;

use App\Entity\Page;
use App\Enum\PageContentTypeEnum;
use App\Enum\PageStatusEnum;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Page>
 */
class PageRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Page::class);
    }

    /**
     * Find all published pages (excluding deleted)
     * @return Page[]
     */
    public function findPublished(): array
    {
        return $this->createQueryBuilder('p')
            ->where('p.status = :status')
            ->setParameter('status', PageStatusEnum::PUBLISHED)
            ->orderBy('p.publishedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find pages by status
     * @param PageStatusEnum $status
     * @param bool $includeDeleted Deprecated - use status filter instead
     * @return Page[]
     */
    public function findByStatus(PageStatusEnum $status, bool $includeDeleted = false): array
    {
        return $this->createQueryBuilder('p')
            ->where('p.status = :status')
            ->setParameter('status', $status)
            ->orderBy('p.updatedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find pages by content type
     * @param PageContentTypeEnum $contentType
     * @param bool $publishedOnly
     * @return Page[]
     */
    public function findByContentType(PageContentTypeEnum $contentType, bool $publishedOnly = true): array
    {
        $qb = $this->createQueryBuilder('p')
            ->where('p.contentType = :contentType')
            ->andWhere('p.status != :deletedStatus')
            ->setParameter('contentType', $contentType)
            ->setParameter('deletedStatus', PageStatusEnum::DELETED);

        if ($publishedOnly) {
            $qb->andWhere('p.status = :status')
               ->setParameter('status', PageStatusEnum::PUBLISHED);
        }

        return $qb->orderBy('p.sortOrder', 'ASC')
            ->addOrderBy('p.publishedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find page by slug (active pages only)
     */
    public function findBySlug(string $slug): ?Page
    {
        return $this->createQueryBuilder('p')
            ->where('p.slug = :slug')
            ->andWhere('p.status != :deletedStatus')
            ->setParameter('slug', $slug)
            ->setParameter('deletedStatus', PageStatusEnum::DELETED)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Find published page by slug
     */
    public function findPublishedBySlug(string $slug): ?Page
    {
        return $this->createQueryBuilder('p')
            ->where('p.slug = :slug')
            ->andWhere('p.status = :status')
            ->setParameter('slug', $slug)
            ->setParameter('status', PageStatusEnum::PUBLISHED)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Fulltext search in title, content, and excerpt
     * Uses PostgreSQL trigram indexes for performance
     * @param string $query Search term
     * @param bool $publishedOnly Search only in published pages
     * @return Page[]
     */
    public function search(string $query, bool $publishedOnly = true): array
    {
        $searchTerm = '%' . trim($query) . '%';

        $qb = $this->createQueryBuilder('p')
            ->where('p.status != :deletedStatus')
            ->andWhere('(p.title LIKE :query OR p.content LIKE :query OR p.excerpt LIKE :query)')
            ->setParameter('query', $searchTerm)
            ->setParameter('deletedStatus', PageStatusEnum::DELETED);

        if ($publishedOnly) {
            $qb->andWhere('p.status = :status')
               ->setParameter('status', PageStatusEnum::PUBLISHED);
        }

        return $qb->orderBy('p.publishedAt', 'DESC')
            ->setMaxResults(50)
            ->getQuery()
            ->getResult();
    }

    /**
     * Get all pages as tree structure (for navigation, admin)
     * Returns root pages with their children loaded
     * @param bool $publishedOnly
     * @return Page[]
     */
    public function findTree(bool $publishedOnly = false): array
    {
        $qb = $this->createQueryBuilder('p')
            ->leftJoin('p.children', 'c')
            ->addSelect('c')
            ->where('p.status != :deletedStatus')
            ->andWhere('p.parent IS NULL') // Only root pages
            ->setParameter('deletedStatus', PageStatusEnum::DELETED);

        if ($publishedOnly) {
            $qb->andWhere('p.status = :status')
               ->setParameter('status', PageStatusEnum::PUBLISHED);
        }

        return $qb->orderBy('p.sortOrder', 'ASC')
            ->addOrderBy('p.title', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Get all root pages (no parent)
     * @param bool $publishedOnly
     * @return Page[]
     */
    public function findRootPages(bool $publishedOnly = false): array
    {
        $qb = $this->createQueryBuilder('p')
            ->where('p.parent IS NULL')
            ->andWhere('p.status != :deletedStatus')
            ->setParameter('deletedStatus', PageStatusEnum::DELETED);

        if ($publishedOnly) {
            $qb->andWhere('p.status = :status')
               ->setParameter('status', PageStatusEnum::PUBLISHED);
        }

        return $qb->orderBy('p.sortOrder', 'ASC')
            ->addOrderBy('p.title', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find all pages by author
     * @param int $authorId
     * @param bool $includeDeleted
     * @return Page[]
     */
    public function findByAuthor(int $authorId, bool $includeDeleted = false): array
    {
        $qb = $this->createQueryBuilder('p')
            ->where('p.authorId = :authorId')
            ->setParameter('authorId', $authorId);

        if (!$includeDeleted) {
            $qb->andWhere('p.status != :deletedStatus')
               ->setParameter('deletedStatus', PageStatusEnum::DELETED);
        }

        return $qb->orderBy('p.updatedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find deleted pages (soft deleted, for trash/restore)
     * @return Page[]
     */
    public function findDeleted(): array
    {
        return $this->createQueryBuilder('p')
            ->where('p.status = :deletedStatus')
            ->setParameter('deletedStatus', PageStatusEnum::DELETED)
            ->orderBy('p.deletedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Check if slug is unique (excluding current page if editing)
     */
    public function isSlugUnique(string $slug, ?int $excludeId = null): bool
    {
        $qb = $this->createQueryBuilder('p')
            ->select('COUNT(p.id)')
            ->where('p.slug = :slug')
            ->andWhere('p.status != :deletedStatus')
            ->setParameter('slug', $slug)
            ->setParameter('deletedStatus', PageStatusEnum::DELETED);

        if ($excludeId !== null) {
            $qb->andWhere('p.id != :excludeId')
               ->setParameter('excludeId', $excludeId);
        }

        $count = $qb->getQuery()->getSingleScalarResult();

        return $count === 0;
    }

    /**
     * Save page entity
     */
    public function save(Page $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Remove page entity (actual delete from DB)
     */
    public function remove(Page $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Flush changes to database
     */
    public function flush(): void
    {
        $this->getEntityManager()->flush();
    }
}
