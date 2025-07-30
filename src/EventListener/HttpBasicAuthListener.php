<?php

namespace App\EventListener;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * HTTP Basic Authentication Listener
 * 
 * Aktivuje se pouze pokud jsou definované environment proměnné:
 * - HTTP_AUTH_USER
 * - HTTP_AUTH_PASS
 */
#[AsEventListener(event: KernelEvents::REQUEST, priority: 1000)]
class HttpBasicAuthListener
{
    public function onKernelRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();
        
        // Zkontrolovat zda jsou definované auth credentials
        $authUser = $_ENV['HTTP_AUTH_USER'] ?? null;
        $authPass = $_ENV['HTTP_AUTH_PASS'] ?? null;
        
        // Pokud nejsou definované, neověřovat
        if (empty($authUser) || empty($authPass)) {
            return;
        }

        // Vynechat systémové cesty
        if ($this->shouldSkipAuth($request)) {
            return;
        }
        
        // Zkontrolovat HTTP Basic Auth
        $providedUser = $request->server->get('PHP_AUTH_USER');
        $providedPass = $request->server->get('PHP_AUTH_PW');
        
        if ($providedUser !== $authUser || $providedPass !== $authPass) {
            $response = new Response(
                'Development Environment - Authorization Required',
                401,
                ['WWW-Authenticate' => 'Basic realm="Development Environment"']
            );
            $event->setResponse($response);
        }
    }

    private function shouldSkipAuth($request): bool
    {
        $excludePaths = ['/_wdt', '/_profiler'];
        $path = $request->getPathInfo();
        
        foreach ($excludePaths as $excludePath) {
            if (str_starts_with($path, $excludePath)) {
                return true;
            }
        }
        
        return false;
    }
}