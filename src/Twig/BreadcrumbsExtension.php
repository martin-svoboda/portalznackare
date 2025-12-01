<?php

namespace App\Twig;

use App\Entity\Page;
use App\Enum\PageContentTypeEnum;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;

/**
 * Twig extension pro generování breadcrumbs navigace
 */
class BreadcrumbsExtension extends AbstractExtension
{
    public function __construct(
        private UrlGeneratorInterface $urlGenerator,
    ) {
    }

    public function getFilters(): array
    {
        return [
            new TwigFilter('page_breadcrumbs', [$this, 'generateBreadcrumbs']),
        ];
    }

    /**
     * Generuje breadcrumbs pro danou stránku
     *
     * Struktura: Úvod → [Sekce (Metodika/Nápověda)] → Hierarchie stránek
     *
     * @param Page $page
     * @return array{text: string, url: string|null}[]
     */
    public function generateBreadcrumbs(Page $page): array
    {
        $breadcrumbs = [];

        // 1. Vždy začít s "Úvod" (homepage)
        $breadcrumbs[] = [
            'text' => 'Úvod',
            'url' => $this->urlGenerator->generate('app_index'),
        ];

        // 2. Přidat sekci (Metodika/Nápověda) pokud je to tento content type
        $contentType = $page->getContentType();

        if ($contentType === PageContentTypeEnum::METODIKA) {
            $breadcrumbs[] = [
                'text' => 'Metodika',
                'url' => '/' . $contentType->getUrlPrefix(),
            ];
        } elseif ($contentType === PageContentTypeEnum::NAPOVEDA) {
            $breadcrumbs[] = [
                'text' => 'Nápověda',
                'url' => $this->urlGenerator->generate('help_index'),
            ];
        }

        // 3. Přidat hierarchii stránek (parent → parent → ... → current)
        $pageHierarchy = $page->getBreadcrumbs();

        foreach ($pageHierarchy as $hierarchyPage) {
            $breadcrumbs[] = [
                'text' => $hierarchyPage->getTitle(),
                // Současná stránka nemá odkaz (url: null)
                'url' => $hierarchyPage->getId() === $page->getId()
                    ? null
                    : $hierarchyPage->getUrlPath(),
            ];
        }

        return $breadcrumbs;
    }
}
