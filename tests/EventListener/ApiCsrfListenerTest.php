<?php

namespace App\Tests\EventListener;

use App\EventListener\ApiCsrfListener;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

/**
 * Interní API smí volat jen stránky portálu (token X-CSRF-Token vázaný na session),
 * kromě výslovných výjimek.
 */
class ApiCsrfListenerTest extends TestCase
{
    private const PLATNY = 'platny-token';

    #[DataProvider('odepreno')]
    public function testBezPlatnehoTokenuOdepreno(string $method, string $path, ?string $token): void
    {
        $event = $this->zpracuj($method, $path, $token);

        $this->assertNotNull($event->getResponse());
        $this->assertSame(403, $event->getResponse()->getStatusCode());
        $this->assertSame('1', $event->getResponse()->headers->get('X-CSRF-Invalid'));
    }

    public static function odepreno(): array
    {
        return [
            'GET bez tokenu' => ['GET', '/api/portal/report', null],
            'POST se špatným tokenem' => ['POST', '/api/portal/report', 'podvrh'],
            'přihlášení bez tokenu' => ['POST', '/api/auth/login', null],
            'stav přihlášení bez tokenu' => ['GET', '/api/auth/status', null],
            'admin API bez tokenu' => ['GET', '/admin/api/reports', null],
            'prázdný token' => ['DELETE', '/api/portal/files/1', ''],
        ];
    }

    #[DataProvider('povoleno')]
    public function testPovoleno(string $method, string $path, ?string $token): void
    {
        $this->assertNull($this->zpracuj($method, $path, $token)->getResponse());
    }

    public static function povoleno(): array
    {
        return [
            'API s platným tokenem' => ['POST', '/api/portal/report', self::PLATNY],
            'admin API s platným tokenem' => ['GET', '/admin/api/cms/pages', self::PLATNY],
            'desktopový klient INSYZ' => ['POST', '/api/insyz-client/db-password', null],
            'CI health check' => ['GET', '/api/test/mssql-connection', null],
            'odhlášení odkazem' => ['GET', '/api/auth/logout', null],
            'obnova tokenu' => ['GET', '/api/auth/csrf-token', null],
            'CORS preflight' => ['OPTIONS', '/api/portal/report', null],
            'stránka mimo API' => ['GET', '/prikazy', null],
            'soubory mimo API' => ['GET', '/uploads/reports/x.jpg', null],
            'podobná cesta, ale ne API' => ['GET', '/apiary', null],
        ];
    }

    private function zpracuj(string $method, string $path, ?string $token): RequestEvent
    {
        $manager = $this->createMock(CsrfTokenManagerInterface::class);
        $manager->method('isTokenValid')->willReturnCallback(
            fn (CsrfToken $t) => $t->getId() === ApiCsrfListener::TOKEN_ID && $t->getValue() === self::PLATNY
        );

        $request = Request::create($path, $method);
        if ($token !== null) {
            $request->headers->set(ApiCsrfListener::HEADER, $token);
        }

        $event = new RequestEvent($this->createMock(HttpKernelInterface::class), $request, HttpKernelInterface::MAIN_REQUEST);
        (new ApiCsrfListener($manager))($event);

        return $event;
    }
}
