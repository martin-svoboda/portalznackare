<?php

namespace App\Controller;

use App\Service\CzechVocativeService;
use App\Service\InsyzService;
use App\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Core\Security;

class AppController extends AbstractController
{
    #[Route('/', name: 'app_index')]
    public function index(): Response
    {
        return $this->render('pages/index.html.twig');
    }


    #[Route('/nastenka', name: 'app_dashboard')]
    public function dashboard(CzechVocativeService $vocativeService): Response
    {
        $user = $this->getUser();
        $greeting = '';
        
        if ($user) {
            // Získáme jméno uživatele z security kontextu
            $firstName = $user->getJmeno() ?? '';
            
            if (!empty($firstName)) {
                $greeting = $vocativeService->createTimeBasedGreeting($firstName);
            }
        }
        
        return $this->render('pages/dashboard.html.twig', [
            'greeting' => $greeting
        ]);
    }

    #[Route('/prikazy', name: 'app_prikazy')]
    public function prikazy(): Response
    {
        return $this->render('pages/prikazy.html.twig');
    }

    #[Route('/prikaz/{id}', name: 'app_prikaz_detail')]
    public function prikazDetail(int $id): Response
    {
        return $this->render('pages/prikaz-detail.html.twig', [
            'id' => $id
        ]);
    }

    #[Route('/prikaz/{id}/hlaseni', name: 'app_prikaz_hlaseni')]
    public function prikazHlaseni(int $id): Response
    {
        return $this->render('pages/prikaz-hlaseni.html.twig', [
            'id' => $id
        ]);
    }

    #[Route('/metodika', name: 'app_metodika')]
    public function metodika(): Response
    {
        return $this->render('pages/metodika.html.twig');
    }

    #[Route('/downloads', name: 'app_downloads')]
    public function downloads(): Response
    {
        return $this->render('pages/downloads.html.twig');
    }

    #[Route('/profil', name: 'app_profil')]
    public function profil(InsyzService $insyzService): Response
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->redirectToRoute('app_index');
        }

        try {
            // Získat multidataset z INSYZ
            $insyzData = $insyzService->getUser($user->getIntAdr());

            // Extrahovat hlavičku uživatele (první dataset)
            $userHeader = $insyzData[0][0] ?? [];

            // Extrahovat další datasety pro profil
            $odpracovano = $insyzData[1] ?? [];
            $kvalifikace = $insyzData[2] ?? [];
            $seminare = $insyzData[3] ?? [];

        } catch (\Exception $e) {
            // V případě chyby použij základní data z databáze
            $userHeader = [];
            $odpracovano = [];
            $kvalifikace = [];
            $seminare = [];
        }

        return $this->render('pages/profil.html.twig', [
            'user' => $user,
            'insyz_data' => $userHeader,
            'odpracovano' => $odpracovano,
            'kvalifikace' => $kvalifikace,
            'seminare' => $seminare
        ]);
    }

    #[Route('/{slug}', name: 'app_catch_all', requirements: ['slug' => '^(?!napoveda).*'], priority: -10)]
    public function catchAll(): Response
    {
        return $this->render('pages/404.html.twig');
    }
}