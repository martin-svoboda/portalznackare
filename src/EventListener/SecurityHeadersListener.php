<?php

namespace App\EventListener;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Automaticky přidává security headers do všech HTTP odpovědí
 * Chrání před XSS, clickjacking, MIME sniffing a dalšími útoky
 */
#[AsEventListener(event: KernelEvents::RESPONSE, priority: 0)]
class SecurityHeadersListener
{
    public function onKernelResponse(ResponseEvent $event): void
    {
        // Pouze pro main requesty, ne pro sub-requesty
        if (!$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();
        $response = $event->getResponse();

        // Základní security headers pro všechny odpovědi
        $this->addBasicSecurityHeaders($response);

        // Specifické headers podle typu odpovědi
        if ($this->isApiResponse($request)) {
            $this->addApiSecurityHeaders($response);
        } else {
            $this->addWebSecurityHeaders($response, $request);
        }
    }

    private function addBasicSecurityHeaders(Response $response): void
    {
        // Zamezuje MIME sniffing - prohlížeč respektuje Content-Type
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Chrání před clickjacking - stránka se nemůže vložit do iframe z jiné domény
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');

        // Legacy XSS ochrana (moderní prohlížeče používají CSP)
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Kontrola referrer informací
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Zakázat sniffing (detekování obsahu prohlížečem)
        $response->headers->set('X-Download-Options', 'noopen');
    }

    private function addApiSecurityHeaders(Response $response): void
    {
        // Pro API odpovědi - striktní CSP
        $response->headers->set(
            'Content-Security-Policy', 
            "default-src 'none'; frame-ancestors 'none';"
        );
    }

    private function addWebSecurityHeaders(Response $response, Request $request): void
    {
        // Pro webové stránky - CSP umožňující React a Tailwind
        $cspPolicy = implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'", // Potřeba pro React
            "style-src 'self' 'unsafe-inline'",  // Potřeba pro Tailwind
            "img-src 'self' data: https:",       // Obrázky + data URIs
            "font-src 'self'",
            "connect-src 'self'",               // AJAX calls
            "frame-ancestors 'self'",           // Pouze naše domény v iframe
            "base-uri 'self'",
            "form-action 'self'"
        ]);

        $response->headers->set('Content-Security-Policy', $cspPolicy);

        // HSTS pouze pro HTTPS (automatická detekce)
        if ($request->isSecure()) {
            $response->headers->set(
                'Strict-Transport-Security', 
                'max-age=31536000; includeSubDomains; preload'
            );
        }
    }

    private function isApiResponse(Request $request): bool
    {
        return str_starts_with($request->getPathInfo(), '/api/');
    }
}