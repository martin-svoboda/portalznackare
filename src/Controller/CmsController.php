<?php

namespace App\Controller;

use App\Entity\Page;
use App\Enum\PageContentTypeEnum;
use App\Enum\PageStatusEnum;
use App\Repository\PageRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class CmsController extends AbstractController
{
    public function __construct(
        private PageRepository $pageRepository
    ) {
    }

    /**
     * Display CMS page by URL path with content type and category
     * URL Structure: /typ-obsahu/kategorie/parent-slug/slug
     *
     * Examples:
     * - /o-portalu → root page (type: page, no parent)
     * - /dokumentace/metodiky → page (type: page, slug: metodiky, parent: dokumentace)
     * - /clanky/novinky/2024 → article (type: article, category: novinky, slug: 2024)
     * - /dokumenty/metodiky/znaceni/barvy → document with hierarchy
     * - /faq/obecne/jak-zacit → FAQ in category
     */
    #[Route('/{path}', name: 'cms_page_show', requirements: ['path' => '.+'], priority: -100)]
    public function show(string $path): Response
    {
        // Parse URL path
        $segments = array_filter(explode('/', trim($path, '/')));

        if (empty($segments)) {
            throw $this->createNotFoundException('Stránka nebyla nalezena');
        }

        // Try to find page
        $page = $this->findPageByUrl($segments);

        if (!$page) {
            throw $this->createNotFoundException('Stránka nebyla nalezena');
        }

        // Routing podle typu obsahu
        return match($page->getContentType()) {
            PageContentTypeEnum::METODIKA => $this->renderMetodika($page),
            PageContentTypeEnum::NAPOVEDA => $this->renderNapoveda($page),
            default => $this->render('pages/page.html.twig', [
                'page' => $page,
                'breadcrumbs' => $page->getBreadcrumbs(),
            ]),
        };
    }

    /**
     * Find page by URL segments
     * Parses: /typ-obsahu/kategorie/parent-slug/slug
     * Uses ENUM to dynamically resolve content types
     */
    private function findPageByUrl(array $segments): mixed
    {
        $contentType = null;
        $category = null;

        // Check if first segment is content type prefix (using ENUM)
        $firstSegment = $segments[0];
        $typeFromPrefix = PageContentTypeEnum::fromUrlPrefix($firstSegment);

        if ($typeFromPrefix !== null) {
            $contentType = $typeFromPrefix->value;
            array_shift($segments); // Remove content type from segments

            // Check if second segment might be category
            if (count($segments) > 1) {
                // Try assuming first remaining segment is category
                $possibleCategory = $segments[0];
                $remainingSlugs = array_slice($segments, 1);

                // Try to find page with this structure
                $pageSlug = end($remainingSlugs);
                $page = $this->findPageWithFilters($pageSlug, $contentType, $possibleCategory, array_slice($remainingSlugs, 0, -1));

                if ($page) {
                    return $page;
                }

                // If not found, try without category (all segments are hierarchy)
                $pageSlug = end($segments);
                $page = $this->findPageWithFilters($pageSlug, $contentType, null, array_slice($segments, 0, -1));

                if ($page) {
                    return $page;
                }
            } else {
                // Single slug after type prefix
                $pageSlug = $segments[0];
                return $this->findPageWithFilters($pageSlug, $contentType, null, []);
            }
        } else {
            // No content type prefix - must be regular page
            $pageSlug = end($segments);
            $parentSlugs = array_slice($segments, 0, -1);

            return $this->findPageWithFilters($pageSlug, 'page', null, $parentSlugs);
        }

        return null;
    }

    /**
     * Find page with content type, category and hierarchy filters
     */
    private function findPageWithFilters(string $slug, ?string $contentType, ?string $category, array $parentSlugs): mixed
    {
        // Find all pages with this slug
        $qb = $this->pageRepository->createQueryBuilder('p')
            ->where('p.slug = :slug')
            ->andWhere('p.status = :status')
            ->andWhere('p.deletedAt IS NULL')
            ->setParameter('slug', $slug)
            ->setParameter('status', \App\Enum\PageStatusEnum::PUBLISHED);

        // Filter by content type if specified
        if ($contentType) {
            $qb->andWhere('p.contentType = :contentType')
               ->setParameter('contentType', $contentType);
        }

        $pages = $qb->getQuery()->getResult();

        // Filter by category and parent chain
        foreach ($pages as $page) {
            // Check category match
            if ($category !== null) {
                if (empty($page->getMeta()['category']) || $page->getMeta()['category'] !== $category) {
                    continue;
                }
            } else {
                // If no category expected, page shouldn't have category
                if (!empty($page->getMeta()['category'])) {
                    continue;
                }
            }

            // Check parent hierarchy
            if (empty($parentSlugs)) {
                // No parent expected
                if ($page->getParent() === null) {
                    return $page;
                }
            } else {
                // Verify parent chain
                $parentChain = $this->getParentChain($page);
                if (count($parentChain) !== count($parentSlugs)) {
                    continue;
                }

                $match = true;
                foreach ($parentSlugs as $index => $expectedSlug) {
                    if (!isset($parentChain[$index]) || $parentChain[$index]->getSlug() !== $expectedSlug) {
                        $match = false;
                        break;
                    }
                }

                if ($match) {
                    return $page;
                }
            }
        }

        return null;
    }

    /**
     * Get parent chain from page to root
     * Returns array of parent pages from immediate parent to root
     */
    private function getParentChain($page): array
    {
        $chain = [];
        $current = $page->getParent();

        while ($current !== null) {
            array_unshift($chain, $current);
            $current = $current->getParent();
        }

        return $chain;
    }

    /**
     * Render metodika detail page
     */
    private function renderMetodika(Page $page): Response
    {
        return $this->render('pages/metodika-detail.html.twig', [
            'page' => $page,
            'breadcrumbs' => $page->getBreadcrumbs(),
            'tocHeadings' => $this->extractHeadings($page),
            'children' => $page->getChildren()->toArray(),
            'prevNext' => $this->getTreePrevNext($page),
        ]);
    }

    /**
     * Render napoveda detail page
     */
    private function renderNapoveda(Page $page): Response
    {
        return $this->render('pages/napoveda-detail.html.twig', [
            'page' => $page,
            'breadcrumbs' => $page->getBreadcrumbs(),
            'tocHeadings' => $this->extractHeadings($page),
            'children' => $page->getChildren()->toArray(),
            'prevNext' => $this->getTreePrevNext($page),
        ]);
    }

    /**
     * Extract headings from HTML content and add IDs
     * Returns array of headings for Table of Contents
     */
    private function extractHeadings(Page $page): array
    {
        $html = $page->getContent();

        if (empty($html)) {
            return [];
        }

        $dom = new \DOMDocument();
        @$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'), LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);

        $headings = [];
        foreach (['h2', 'h3', 'h4', 'h5'] as $tag) {
            foreach ($dom->getElementsByTagName($tag) as $heading) {
                $text = $heading->textContent;
                $id = $this->slugify($text);
                $heading->setAttribute('id', $id);

                $headings[] = [
                    'id' => $id,
                    'text' => $text,
                    'level' => (int)substr($tag, 1),
                ];
            }
        }

        return $headings;
    }

    /**
     * Get previous and next page in deep tree traversal
     */
    private function getTreePrevNext(Page $page): array
    {
        $allPages = $this->flattenTree($page->getContentType());

        $ids = array_map(fn($p) => $p->getId(), $allPages);
        $index = array_search($page->getId(), $ids);

        if ($index === false) {
            return ['prev' => null, 'next' => null];
        }

        return [
            'prev' => $allPages[$index - 1] ?? null,
            'next' => $allPages[$index + 1] ?? null,
        ];
    }

    /**
     * Flatten tree structure to ordered array
     */
    private function flattenTree(PageContentTypeEnum $type): array
    {
        $roots = $this->pageRepository->findBy([
            'contentType' => $type,
            'parent' => null,
            'status' => PageStatusEnum::PUBLISHED,
        ], ['sortOrder' => 'ASC']);

        $flat = [];
        foreach ($roots as $root) {
            $this->addToFlat($root, $flat);
        }

        return $flat;
    }

    /**
     * Recursively add page and children to flat array
     */
    private function addToFlat(Page $page, array &$flat): void
    {
        $flat[] = $page;

        $children = $page->getChildren()->toArray();
        usort($children, fn($a, $b) => $a->getSortOrder() <=> $b->getSortOrder());

        foreach ($children as $child) {
            if ($child->getStatus() === PageStatusEnum::PUBLISHED && $child->getDeletedAt() === null) {
                $this->addToFlat($child, $flat);
            }
        }
    }

    /**
     * Convert text to slug (Czech diacritics support)
     */
    private function slugify(string $text): string
    {
        $text = mb_strtolower($text);

        $replace = [
            'á' => 'a', 'č' => 'c', 'ď' => 'd', 'é' => 'e', 'ě' => 'e',
            'í' => 'i', 'ň' => 'n', 'ó' => 'o', 'ř' => 'r', 'š' => 's',
            'ť' => 't', 'ú' => 'u', 'ů' => 'u', 'ý' => 'y', 'ž' => 'z'
        ];

        $text = strtr($text, $replace);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        return trim($text, '-');
    }
}
