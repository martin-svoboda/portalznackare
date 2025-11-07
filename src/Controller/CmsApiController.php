<?php

namespace App\Controller;

use App\Entity\Page;
use App\Enum\PageContentTypeEnum;
use App\Enum\PageStatusEnum;
use App\Repository\PageRepository;
use App\Service\PageService;
use App\Service\SlugService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/admin/api/cms')]
#[IsGranted('ROLE_ADMIN')]
class CmsApiController extends AbstractController
{
    public function __construct(
        private PageRepository $pageRepository,
        private PageService $pageService,
        private SlugService $slugService
    ) {
    }

    /**
     * Get available content types from ENUM
     */
    #[Route('/content-types', name: 'cms_api_content_types', methods: ['GET'])]
    public function getContentTypes(): JsonResponse
    {
        return $this->json(PageContentTypeEnum::getAllOptions());
    }

    /**
     * Get all pages (with optional filters)
     */
    #[Route('/pages', name: 'cms_api_pages', methods: ['GET'])]
    public function getPages(Request $request): JsonResponse
    {
        // Note: Filtering is now done on frontend via TanStack Table column filters
        // Backend returns all pages, frontend filters by status/content_type
        $pages = $this->pageRepository->createQueryBuilder('p')
            ->orderBy('p.updatedAt', 'DESC')
            ->getQuery()
            ->getResult();

        $data = array_map(fn(Page $page) => $this->serializePage($page, false), $pages);

        return $this->json($data);
    }

    /**
     * Get single page by ID
     */
    #[Route('/pages/{id}', name: 'cms_api_page_detail', methods: ['GET'])]
    public function getPage(int $id): JsonResponse
    {
        $page = $this->pageRepository->find($id);

        if (!$page) {
            return $this->json(['error' => 'Stránka nenalezena'], Response::HTTP_NOT_FOUND);
        }

        return $this->json($this->serializePage($page, true));
    }

    /**
     * Create new page
     */
    #[Route('/pages', name: 'cms_api_create_page', methods: ['POST'])]
    public function createPage(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        // Validation
        if (empty($data['title'])) {
            return $this->json(['error' => 'Název stránky je povinný'], Response::HTTP_BAD_REQUEST);
        }

        if (empty($data['content'])) {
            return $this->json(['error' => 'Obsah stránky je povinný'], Response::HTTP_BAD_REQUEST);
        }

        // Convert enum values if provided as strings
        if (!empty($data['content_type']) && is_string($data['content_type'])) {
            $data['content_type'] = PageContentTypeEnum::from($data['content_type']);
        }
        if (!empty($data['status']) && is_string($data['status'])) {
            $data['status'] = PageStatusEnum::from($data['status']);
        }

        $user = $this->getUser();
        $page = $this->pageService->createPage($data, $user->getIntAdr());

        return $this->json(
            $this->serializePage($page, true),
            Response::HTTP_CREATED
        );
    }

    /**
     * Update existing page
     */
    #[Route('/pages/{id}', name: 'cms_api_update_page', methods: ['PUT'])]
    public function updatePage(int $id, Request $request): JsonResponse
    {
        $page = $this->pageRepository->find($id);

        if (!$page) {
            return $this->json(['error' => 'Stránka nenalezena'], Response::HTTP_NOT_FOUND);
        }

        if (!$page->canEdit()) {
            return $this->json(['error' => 'Stránka je smazána a nelze ji upravovat'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true);

        // Convert enum values
        if (!empty($data['content_type']) && is_string($data['content_type'])) {
            $data['content_type'] = PageContentTypeEnum::from($data['content_type']);
        }
        if (!empty($data['status']) && is_string($data['status'])) {
            $data['status'] = PageStatusEnum::from($data['status']);
        }

        $user = $this->getUser();
        $page = $this->pageService->updatePage($page, $data, $user->getIntAdr());

        return $this->json($this->serializePage($page, true));
    }

    /**
     * Delete page (soft delete)
     */
    #[Route('/pages/{id}', name: 'cms_api_delete_page', methods: ['DELETE'])]
    public function deletePage(int $id): JsonResponse
    {
        $page = $this->pageRepository->find($id);

        if (!$page) {
            return $this->json(['error' => 'Stránka nenalezena'], Response::HTTP_NOT_FOUND);
        }

        $user = $this->getUser();
        $this->pageService->softDelete($page, $user->getIntAdr());

        return $this->json(['message' => 'Stránka byla přesunuta do koše']);
    }

    /**
     * Publish page
     */
    #[Route('/pages/{id}/publish', name: 'cms_api_publish_page', methods: ['PATCH'])]
    public function publishPage(int $id): JsonResponse
    {
        $page = $this->pageRepository->find($id);

        if (!$page) {
            return $this->json(['error' => 'Stránka nenalezena'], Response::HTTP_NOT_FOUND);
        }

        $user = $this->getUser();
        $this->pageService->publish($page, $user->getIntAdr());

        return $this->json($this->serializePage($page, true));
    }

    /**
     * Archive page
     */
    #[Route('/pages/{id}/archive', name: 'cms_api_archive_page', methods: ['PATCH'])]
    public function archivePage(int $id): JsonResponse
    {
        $page = $this->pageRepository->find($id);

        if (!$page) {
            return $this->json(['error' => 'Stránka nenalezena'], Response::HTTP_NOT_FOUND);
        }

        $user = $this->getUser();
        $this->pageService->archive($page, $user->getIntAdr());

        return $this->json($this->serializePage($page, true));
    }

    /**
     * Restore deleted page
     */
    #[Route('/pages/{id}/restore', name: 'cms_api_restore_page', methods: ['PATCH'])]
    public function restorePage(int $id): JsonResponse
    {
        $page = $this->pageRepository->find($id);

        if (!$page) {
            return $this->json(['error' => 'Stránka nenalezena'], Response::HTTP_NOT_FOUND);
        }

        if (!$page->isDeleted()) {
            return $this->json(['error' => 'Stránka není v koši'], Response::HTTP_BAD_REQUEST);
        }

        $user = $this->getUser();
        $this->pageService->restore($page, $user->getIntAdr());

        return $this->json($this->serializePage($page, true));
    }

    /**
     * Search pages
     */
    #[Route('/search', name: 'cms_api_search', methods: ['GET'])]
    public function search(Request $request): JsonResponse
    {
        $query = $request->query->get('q', '');
        $publishedOnly = $request->query->getBoolean('published_only', false);

        if (strlen($query) < 2) {
            return $this->json(['error' => 'Hledaný výraz musí mít alespoň 2 znaky'], Response::HTTP_BAD_REQUEST);
        }

        $pages = $this->pageRepository->search($query, $publishedOnly);
        $data = array_map(fn(Page $page) => $this->serializePage($page, false), $pages);

        return $this->json($data);
    }

    /**
     * Get page tree (for navigation/hierarchy)
     */
    #[Route('/tree', name: 'cms_api_tree', methods: ['GET'])]
    public function getTree(Request $request): JsonResponse
    {
        $publishedOnly = $request->query->getBoolean('published_only', false);
        $rootPages = $this->pageRepository->findTree($publishedOnly);

        $data = array_map(function(Page $page) {
            return $this->serializePageTree($page);
        }, $rootPages);

        return $this->json($data);
    }

    /**
     * Get deleted pages (trash)
     */
    #[Route('/trash', name: 'cms_api_trash', methods: ['GET'])]
    public function getTrash(): JsonResponse
    {
        $pages = $this->pageRepository->findDeleted();
        $data = array_map(fn(Page $page) => $this->serializePage($page, false), $pages);

        return $this->json($data);
    }

    /**
     * Check if slug is available
     */
    #[Route('/check-slug', name: 'cms_api_check_slug', methods: ['GET'])]
    public function checkSlug(Request $request): JsonResponse
    {
        $slug = $request->query->get('slug');
        $excludeId = $request->query->get('exclude_id');

        if (empty($slug)) {
            return $this->json(['error' => 'Slug je povinný'], Response::HTTP_BAD_REQUEST);
        }

        // Generate clean slug
        $cleanSlug = $this->slugService->generateSlug($slug);
        $isUnique = $this->pageRepository->isSlugUnique($cleanSlug, $excludeId);

        return $this->json([
            'slug' => $cleanSlug,
            'is_unique' => $isUnique,
            'suggested' => !$isUnique ? $this->slugService->ensureUnique($cleanSlug, $excludeId) : $cleanSlug,
        ]);
    }

    /**
     * Update page sort order - only resolve conflicts if needed
     */
    #[Route('/pages/{id}/sort-order', name: 'cms_api_update_sort_order', methods: ['PATCH'])]
    public function updateSortOrder(int $id, Request $request): JsonResponse
    {
        $page = $this->pageRepository->find($id);

        if (!$page) {
            return $this->json(['error' => 'Stránka nenalezena'], Response::HTTP_NOT_FOUND);
        }

        $data = json_decode($request->getContent(), true);
        $newSortOrder = $data['sort_order'] ?? null;

        if ($newSortOrder === null || !is_int($newSortOrder)) {
            return $this->json(['error' => 'sort_order musí být celé číslo'], Response::HTTP_BAD_REQUEST);
        }

        $user = $this->getUser();
        $oldSortOrder = $page->getSortOrder();

        // Set new sort order
        $page->setSortOrder($newSortOrder);
        $page->trackUpdate($user->getIntAdr(), "Změna pořadí z $oldSortOrder na $newSortOrder");
        $this->pageRepository->save($page, true);

        // Check for conflicts and resolve recursively
        $this->resolveOrderConflicts($page, $newSortOrder);

        return $this->json($this->serializePage($page, false));
    }

    /**
     * Resolve sort_order conflicts recursively
     * If a sibling has the same sort_order, move it to next available number
     */
    private function resolveOrderConflicts(Page $page, int $sortOrder): void
    {
        // Find conflicting sibling (same parent, content_type, sort_order, but different ID)
        $qb = $this->pageRepository->createQueryBuilder('p')
            ->where('p.contentType = :contentType')
            ->andWhere('p.status != :deletedStatus')
            ->andWhere('p.sortOrder = :sortOrder')
            ->andWhere('p.id != :pageId')
            ->setParameter('contentType', $page->getContentType())
            ->setParameter('deletedStatus', PageStatusEnum::DELETED)
            ->setParameter('sortOrder', $sortOrder)
            ->setParameter('pageId', $page->getId());

        if ($page->getParent()) {
            $qb->andWhere('p.parent = :parent')
               ->setParameter('parent', $page->getParent());
        } else {
            $qb->andWhere('p.parent IS NULL');
        }

        $conflicting = $qb->getQuery()->getOneOrNullResult();

        if ($conflicting) {
            $newOrder = $sortOrder + 1;
            $conflicting->setSortOrder($newOrder);
            $this->pageRepository->save($conflicting, true);

            // Recursively check if the new position also conflicts
            $this->resolveOrderConflicts($conflicting, $newOrder);
        }
    }

    /**
     * Serialize page for API response
     */
    private function serializePage(Page $page, bool $includeContent = false): array
    {
        $data = [
            'id' => $page->getId(),
            'title' => $page->getTitle(),
            'slug' => $page->getSlug(),
            'url_path' => $page->getUrlPath(),
            'excerpt' => $page->getExcerpt(),
            'content_type' => $page->getContentType()->value,
            'status' => $page->getStatus()->value,
            'author_id' => $page->getAuthorId(),
            'parent_id' => $page->getParent()?->getId(),
            'sort_order' => $page->getSortOrder(),
            'featured_image_id' => $page->getFeaturedImage()?->getId(),
            'meta' => $page->getMeta(),
            'created_at' => $page->getCreatedAt()?->format('c'),
            'updated_at' => $page->getUpdatedAt()?->format('c'),
            'published_at' => $page->getPublishedAt()?->format('c'),
            'deleted_at' => $page->getDeletedAt()?->format('c'),
            'breadcrumbs' => array_map(fn(Page $p) => [
                'id' => $p->getId(),
                'title' => $p->getTitle(),
                'slug' => $p->getSlug(),
            ], $page->getBreadcrumbs()),
        ];

        if ($includeContent) {
            $data['content'] = $page->getContent();
            $data['history'] = $page->getHistory();
        }

        return $data;
    }

    /**
     * Serialize page tree node
     */
    private function serializePageTree(Page $page): array
    {
        return [
            'id' => $page->getId(),
            'title' => $page->getTitle(),
            'slug' => $page->getSlug(),
            'content_type' => $page->getContentType()->value,
            'status' => $page->getStatus()->value,
            'sort_order' => $page->getSortOrder(),
            'has_children' => $page->hasChildren(),
            'children' => $page->getChildren()->map(fn(Page $child) => $this->serializePageTree($child))->toArray(),
        ];
    }
}
