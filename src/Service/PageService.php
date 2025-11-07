<?php

namespace App\Service;

use App\Entity\Page;
use App\Entity\FileAttachment;
use App\Enum\PageStatusEnum;
use App\Repository\PageRepository;
use App\Repository\FileAttachmentRepository;
use Psr\Log\LoggerInterface;

/**
 * Service for managing CMS pages
 * Handles page lifecycle, status transitions, and file attachments
 */
class PageService
{
    public function __construct(
        private PageRepository $pageRepository,
        private FileAttachmentRepository $fileAttachmentRepository,
        private SlugService $slugService,
        private LoggerInterface $logger
    ) {
    }

    /**
     * Create new page
     * @param array $data Page data
     * @param int $authorId Author's INT_ADR
     * @return Page
     */
    public function createPage(array $data, int $authorId): Page
    {
        $page = new Page();
        $page->setAuthorId($authorId);

        // Set basic data
        $page->setTitle($data['title']);
        $page->setContent($data['content'] ?? '');
        $page->setExcerpt($data['excerpt'] ?? null);

        // Generate slug if not provided
        if (!empty($data['slug'])) {
            $slug = $this->slugService->generateSlug($data['slug']);
        } else {
            $slug = $this->slugService->generateSlug($data['title']);
        }
        $page->setSlug($this->slugService->ensureUnique($slug));

        // Set enums
        if (!empty($data['content_type'])) {
            $page->setContentType($data['content_type']);
        }
        if (!empty($data['status'])) {
            $page->setStatus($data['status']);
        }

        // Hierarchy
        if (!empty($data['parent_id'])) {
            $parent = $this->pageRepository->find($data['parent_id']);
            if ($parent) {
                $page->setParent($parent);
            }
        }

        $page->setSortOrder($data['sort_order'] ?? 0);

        // Meta
        if (!empty($data['meta'])) {
            $page->setMeta($data['meta']);
        }

        // Featured image
        if (!empty($data['featured_image_id'])) {
            $image = $this->fileAttachmentRepository->find($data['featured_image_id']);
            if ($image) {
                $page->setFeaturedImage($image);
            }
        }

        // Add creation history entry
        $page->addHistoryEntry($authorId, 'created', [
            'title' => $data['title'],
            'content_type' => $page->getContentType()->value,
        ]);

        $this->pageRepository->save($page, true);

        $this->logger->info('CMS page created', [
            'page_id' => $page->getId(),
            'slug' => $page->getSlug(),
            'author_id' => $authorId,
        ]);

        return $page;
    }

    /**
     * Update existing page
     * @param Page $page
     * @param array $data Updated data
     * @param int $userId User making the update
     * @return Page
     */
    public function updatePage(Page $page, array $data, int $userId): Page
    {
        $changes = [];

        // Title
        if (isset($data['title']) && $data['title'] !== $page->getTitle()) {
            $changes['title'] = [$page->getTitle(), $data['title']];
            $page->setTitle($data['title']);

            // Auto-update slug if it was auto-generated
            if (empty($data['slug'])) {
                $newSlug = $this->slugService->createUniqueSlug($data['title'], $page->getId());
                if ($newSlug !== $page->getSlug()) {
                    $changes['slug'] = [$page->getSlug(), $newSlug];
                    $page->setSlug($newSlug);
                }
            }
        }

        // Explicit slug update
        if (isset($data['slug']) && $data['slug'] !== $page->getSlug()) {
            $newSlug = $this->slugService->generateSlug($data['slug']);
            $newSlug = $this->slugService->ensureUnique($newSlug, $page->getId());
            $changes['slug'] = [$page->getSlug(), $newSlug];
            $page->setSlug($newSlug);
        }

        // Content
        if (isset($data['content']) && $data['content'] !== $page->getContent()) {
            $changes['content'] = ['updated'];
            $page->setContent($data['content']);
        }

        // Excerpt
        if (isset($data['excerpt']) && $data['excerpt'] !== $page->getExcerpt()) {
            $changes['excerpt'] = [$page->getExcerpt(), $data['excerpt']];
            $page->setExcerpt($data['excerpt']);
        }

        // Content type
        if (isset($data['content_type']) && $data['content_type'] !== $page->getContentType()) {
            $changes['content_type'] = [$page->getContentType()->value, $data['content_type']->value];
            $page->setContentType($data['content_type']);
        }

        // Status (use dedicated methods for status changes)
        if (isset($data['status']) && $data['status'] !== $page->getStatus()) {
            $changes['status'] = [$page->getStatus()->value, $data['status']->value];
            $page->setStatus($data['status']);
        }

        // Parent
        if (array_key_exists('parent_id', $data)) {
            $oldParentId = $page->getParent()?->getId();
            if ($data['parent_id'] !== $oldParentId) {
                $changes['parent_id'] = [$oldParentId, $data['parent_id']];
                if ($data['parent_id']) {
                    $parent = $this->pageRepository->find($data['parent_id']);
                    $page->setParent($parent);
                } else {
                    $page->setParent(null);
                }
            }
        }

        // Sort order
        if (isset($data['sort_order']) && $data['sort_order'] !== $page->getSortOrder()) {
            $changes['sort_order'] = [$page->getSortOrder(), $data['sort_order']];
            $page->setSortOrder($data['sort_order']);
        }

        // Meta
        if (isset($data['meta'])) {
            $changes['meta'] = ['updated'];
            $page->setMeta($data['meta']);
        }

        // Featured image
        if (array_key_exists('featured_image_id', $data)) {
            $oldImageId = $page->getFeaturedImage()?->getId();
            if ($data['featured_image_id'] !== $oldImageId) {
                $changes['featured_image_id'] = [$oldImageId, $data['featured_image_id']];
                if ($data['featured_image_id']) {
                    $image = $this->fileAttachmentRepository->find($data['featured_image_id']);
                    $page->setFeaturedImage($image);
                } else {
                    $page->setFeaturedImage(null);
                }
            }
        }

        // Add history entry if there were changes
        if (!empty($changes)) {
            $page->addHistoryEntry($userId, 'updated', $changes);
        }

        $this->pageRepository->save($page, true);

        $this->logger->info('CMS page updated', [
            'page_id' => $page->getId(),
            'user_id' => $userId,
            'changes' => array_keys($changes),
        ]);

        return $page;
    }

    /**
     * Publish page
     */
    public function publish(Page $page, int $userId): Page
    {
        $page->publish($userId);
        $this->pageRepository->save($page, true);

        $this->logger->info('CMS page published', [
            'page_id' => $page->getId(),
            'user_id' => $userId,
        ]);

        return $page;
    }

    /**
     * Archive page
     */
    public function archive(Page $page, int $userId): Page
    {
        $page->archive($userId);
        $this->pageRepository->save($page, true);

        $this->logger->info('CMS page archived', [
            'page_id' => $page->getId(),
            'user_id' => $userId,
        ]);

        return $page;
    }

    /**
     * Soft delete page
     */
    public function softDelete(Page $page, int $userId): Page
    {
        $page->softDelete($userId);
        $this->pageRepository->save($page, true);

        $this->logger->info('CMS page soft deleted', [
            'page_id' => $page->getId(),
            'user_id' => $userId,
        ]);

        return $page;
    }

    /**
     * Restore soft deleted page
     */
    public function restore(Page $page, int $userId): Page
    {
        $page->restore($userId);
        $this->pageRepository->save($page, true);

        $this->logger->info('CMS page restored', [
            'page_id' => $page->getId(),
            'user_id' => $userId,
        ]);

        return $page;
    }

    /**
     * Permanently delete page from database
     */
    public function permanentDelete(Page $page, int $userId): void
    {
        $pageId = $page->getId();
        $slug = $page->getSlug();

        $this->pageRepository->remove($page, true);

        $this->logger->warning('CMS page permanently deleted', [
            'page_id' => $pageId,
            'slug' => $slug,
            'user_id' => $userId,
        ]);
    }

    /**
     * Attach file to page
     * Adds usage tracking to FileAttachment
     */
    public function attachFile(Page $page, FileAttachment $file, string $context = 'content'): void
    {
        // Add usage tracking (FileAttachment pattern)
        $usageInfo = $file->getUsageInfo() ?? [];
        $key = 'page_' . $page->getId();

        $usageInfo[$key] = [
            'type' => 'page',
            'id' => $page->getId(),
            'context' => $context,
            'added_at' => (new \DateTimeImmutable())->format('c'),
        ];

        $file->setUsageInfo($usageInfo);
        $this->fileAttachmentRepository->save($file, true);

        $this->logger->debug('File attached to CMS page', [
            'page_id' => $page->getId(),
            'file_id' => $file->getId(),
            'context' => $context,
        ]);
    }

    /**
     * Detach file from page
     */
    public function detachFile(Page $page, FileAttachment $file): void
    {
        $usageInfo = $file->getUsageInfo() ?? [];
        $key = 'page_' . $page->getId();

        if (isset($usageInfo[$key])) {
            unset($usageInfo[$key]);
            $file->setUsageInfo($usageInfo);
            $this->fileAttachmentRepository->save($file, true);

            $this->logger->debug('File detached from CMS page', [
                'page_id' => $page->getId(),
                'file_id' => $file->getId(),
            ]);
        }
    }

    /**
     * Get all files attached to page
     * @return FileAttachment[]
     */
    public function getPageAttachments(Page $page): array
    {
        $pageId = $page->getId();

        return $this->fileAttachmentRepository->createQueryBuilder('f')
            ->where('JSON_EXTRACT(f.usageInfo, :usage_key) IS NOT NULL')
            ->andWhere('f.deletedAt IS NULL')
            ->setParameter('usage_key', sprintf('$."page_%d"', $pageId))
            ->orderBy('f.createdAt', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
