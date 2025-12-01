<?php

namespace App\Twig;

use App\Enum\PageContentTypeEnum;
use App\Enum\PageStatusEnum;
use App\Repository\PageRepository;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

/**
 * Twig extension pro generování navigačního menu
 */
class MenuExtension extends AbstractExtension
{
    public function __construct(
        private PageRepository $pageRepository,
    ) {
    }

    public function getFunctions(): array
    {
        return [
            new TwigFunction('get_menu_pages', [$this, 'getMenuPages']),
        ];
    }

    /**
     * Načte stránky pro hlavní navigační menu
     *
     * Filtr: typ PAGE, root stránky (bez rodiče), publikované, označené pro zobrazení v menu
     * Řazení: podle sortOrder (ASC)
     *
     * @return array{id: int, title: string, urlPath: string}[]
     */
    public function getMenuPages(): array
    {
        $pages = $this->pageRepository->findBy([
            'contentType' => PageContentTypeEnum::PAGE,
            'parent' => null,
            'status' => PageStatusEnum::PUBLISHED,
        ], ['sortOrder' => 'ASC']);

        // Filtruj jen stránky s meta.showInMenu = true
        $menuPages = [];
        foreach ($pages as $page) {
            $meta = $page->getMeta();
            if (isset($meta['showInMenu']) && $meta['showInMenu'] === true) {
                $menuPages[] = [
                    'id' => $page->getId(),
                    'title' => $page->getTitle(),
                    'urlPath' => $page->getUrlPath(),
                ];
            }
        }

        return $menuPages;
    }
}
