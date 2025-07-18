<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class AppController extends AbstractController
{
    #[Route('/', name: 'app_index')]
    #[Route('/nastenka', name: 'app_dashboard')]
    #[Route('/prikazy', name: 'app_prikazy')]
    #[Route('/prikaz/{id}', name: 'app_prikaz')]
    #[Route('/metodika', name: 'app_metodika')]
    #[Route('/downloads', name: 'app_downloads')]
    #[Route('/profil', name: 'app_profil')]
    #[Route('/{slug}', name: 'app_catch_all', requirements: ['slug' => '.*'])]
    public function index(): Response
    {
        return $this->render('base.html.twig');
    }
}