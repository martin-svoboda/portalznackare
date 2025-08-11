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
        // Povolit pouze v dev prostředí
        if ($this->getParameter('kernel.environment') !== 'dev') {
            throw new NotFoundHttpException('Tato stránka je dostupná pouze ve vývojovém prostředí.');
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
        
        foreach ($routes as $route) {
            $path = $route->getPath();
            
            // Filtrovat pouze INSYZ API endpointy (kromě export endpointů)
            if (str_starts_with($path, '/api/insyz/') && !str_contains($path, '/export')) {
                $methods = $route->getMethods();
                
                $endpoints[] = [
                    'path' => $path,
                    'method' => !empty($methods) ? $methods[0] : 'GET'
                ];
            }
        }
        
        // Seřadit podle cesty
        usort($endpoints, fn($a, $b) => strcmp($a['path'], $b['path']));
        
        return $endpoints;
    }
}