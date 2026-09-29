<?php

namespace App\EventListener;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

/**
 * Interní API (/api/*, /admin/api/*) smí volat jen stránky portálu.
 *
 * Každý požadavek musí nést hlavičku X-CSRF-Token s tokenem vázaným na session.
 * Token vkládají layouty (meta csrf-token) a posílá ho globální obal fetch
 * v base/admin layoutu. Cizí web token nezná a přes CORS ho nepřečte.
 *
 * Neřeší oprávnění přihlášeného uživatele (ten si token vidí) – to kontroluje
 * každý endpoint sám.
 */
#[AsEventListener(event: KernelEvents::REQUEST, priority: 16)] // před firewallem (8) – i přihlášení
class ApiCsrfListener
{
    public const TOKEN_ID = 'api';
    public const HEADER = 'X-CSRF-Token';

    /** Výslovné výjimky – mají vlastní ověření nebo je nelze volat přes fetch */
    private const VYJIMKY = [
        '/api/insyz-client/',   // desktopový klient INSYZ – ověření v těle požadavku
        '/api/test/',           // CI health check – token X-Healthcheck-Token (TestController)
        '/api/auth/logout',     // odhlášení odkazem
        '/api/auth/csrf-token', // obnova tokenu po vypršení session (čtení cizí web přes CORS nedostane)
    ];

    public function __construct(
        private CsrfTokenManagerInterface $csrfTokenManager
    ) {
    }

    public function __invoke(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();
        $path = $request->getPathInfo();

        if (!preg_match('#^/(admin/)?api/#', $path) || $request->isMethod('OPTIONS')) {
            return;
        }

        foreach (self::VYJIMKY as $vyjimka) {
            if (str_starts_with($path, $vyjimka)) {
                return;
            }
        }

        $token = (string) $request->headers->get(self::HEADER, '');
        if ($token !== '' && $this->csrfTokenManager->isTokenValid(new CsrfToken(self::TOKEN_ID, $token))) {
            return;
        }

        $event->setResponse(new JsonResponse([
            'error' => 'Neplatný bezpečnostní token. Obnovte prosím stránku.',
            'error_code' => 'CSRF_INVALID',
        ], Response::HTTP_FORBIDDEN, ['X-CSRF-Invalid' => '1']));
    }
}
