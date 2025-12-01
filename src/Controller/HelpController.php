<?php

namespace App\Controller;

use App\Enum\PageContentTypeEnum;
use App\Enum\PageStatusEnum;
use App\Repository\PageRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

#[Route('/napoveda')]
class HelpController extends AbstractController
{
    public function __construct(
        private PageRepository $pageRepository
    ) {
    }

    #[Route('/', name: 'help_index')]
    public function index(): Response
    {
        // Načti publikované nápovědy z databáze
        $napovedy = $this->pageRepository->findBy([
            'contentType' => PageContentTypeEnum::NAPOVEDA,
            'parent' => null,
            'status' => PageStatusEnum::PUBLISHED,
        ], ['sortOrder' => 'ASC']);

        return $this->render('pages/napoveda.html.twig', [
            'napovedy' => $napovedy,
        ]);
    }

    #[Route('/{slug}', name: 'help_page', priority: -1)]
    public function page(string $slug): Response
    {
        // Najdi stránku podle slugu
        $page = $this->pageRepository->findOneBy([
            'slug' => $slug,
            'contentType' => PageContentTypeEnum::NAPOVEDA,
            'status' => PageStatusEnum::PUBLISHED,
        ]);

        if (!$page) {
            throw $this->createNotFoundException('Stránka nápovědy nebyla nalezena');
        }

        return $this->render('pages/napoveda-detail.html.twig', [
            'page' => $page,
            'breadcrumbs' => $page->getBreadcrumbs(),
        ]);
    }
}