<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\RouterInterface;

class InsyzTestController extends AbstractController
{
    public function __construct(
        private RouterInterface $router
    ) {
    }
    #[Route('/test-insyz-api', name: 'insyz_test')]
    public function index(): Response
    {
        // Ve vývoji dostupné komukoli; na produkci pouze super adminům.
        // (Nástroj volá reálné INSYZ procedury; mimo dev navíc jen čtecí endpointy,
        //  viz getInsyzEndpoints.)
        $isDev = $this->getParameter('kernel.environment') === 'dev';
        if (!$isDev && !$this->isGranted('ROLE_SUPER_ADMIN')) {
            throw new NotFoundHttpException('Tato stránka není dostupná.');
        }

        // Načíst endpointy dynamicky z routeru
        $endpoints = $this->getInsyzEndpoints();

        return $this->render('pages/insyz-test.html.twig', [
            'endpoints' => json_encode($endpoints),
        ]);
    }
    
    private function getInsyzEndpoints(): array
    {
        $routes = $this->router->getRouteCollection();
        $endpoints = [];

        // Mimo dev (tj. na produkci) povolit v testeru jen čtecí (GET) endpointy,
        // aby přes něj nešlo spustit zápis do INSYZ (submit-report, update-password, login).
        $readOnly = $this->getParameter('kernel.environment') !== 'dev';

        foreach ($routes as $route) {
            $path = $route->getPath();

            // Filtrovat pouze INSYZ API endpointy (kromě export endpointů)
            if (str_starts_with($path, '/api/insyz/') && !str_contains($path, '/export')) {
                $methods = $route->getMethods();
                $method = !empty($methods) ? $methods[0] : 'GET';

                // Na produkci vynechat zápisové endpointy
                if ($readOnly && $method !== 'GET') {
                    continue;
                }

                $endpoints[] = [
                    'path' => $path,
                    'method' => $method,
                ];
            }
        }
        
        // Seřadit podle cesty
        usort($endpoints, fn($a, $b) => strcmp($a['path'], $b['path']));
        
        return $endpoints;
    }
}