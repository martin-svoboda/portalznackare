<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class ManifestController extends AbstractController
{
    #[Route('/site.webmanifest', name: 'app_manifest')]
    public function manifest(): JsonResponse
    {
        $env = $this->getParameter('kernel.environment');
        $isDev = $env !== 'prod';

        $iconPrefix = $isDev ? 'icon_192_dev' : 'icon_192';
        $iconLargePrefix = $isDev ? 'icon_512_dev' : 'icon_512';

        $manifest = [
            'name' => 'Portál značkaře',
            'short_name' => 'Portál Znač.',
            'icons' => [
                [
                    'src' => "/{$iconPrefix}.png",
                    'sizes' => '192x192',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src' => "/{$iconLargePrefix}.png",
                    'sizes' => '512x512',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src' => "/{$iconPrefix}.png",
                    'sizes' => '192x192',
                    'type' => 'image/png',
                    'purpose' => 'maskable',
                ],
                [
                    'src' => "/{$iconLargePrefix}.png",
                    'sizes' => '512x512',
                    'type' => 'image/png',
                    'purpose' => 'maskable',
                ],
            ],
            'theme_color' => '#565139',
            'background_color' => '#565139',
            'display' => 'standalone',
        ];

        return new JsonResponse($manifest, 200, [
            'Content-Type' => 'application/manifest+json',
        ]);
    }
}
