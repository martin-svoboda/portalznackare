<?php

namespace App\Tests\Controller\Api;

use App\Controller\Api\TestController;
use App\Entity\User;
use App\Service\InsyzService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;

/**
 * /api/test/* – jen admin (session) nebo CI s tokenem v hlavičce X-Healthcheck-Token.
 */
class TestControllerAccessTest extends TestCase
{
    private const TOKEN = 'ci-token-123';

    #[DataProvider('povoleno')]
    public function testPovolenyPristup(?array $roles, ?string $hlavicka, string $nastavenyToken): void
    {
        $response = $this->call($roles, $hlavicka, $nastavenyToken);

        $this->assertSame(200, $response->getStatusCode());
    }

    public static function povoleno(): array
    {
        return [
            'admin' => [['ROLE_ADMIN'], null, self::TOKEN],
            'super admin' => [['ROLE_SUPER_ADMIN'], null, self::TOKEN],
            'admin i bez nastaveného tokenu' => [['ROLE_ADMIN'], null, ''],
            'CI se správným tokenem' => [null, self::TOKEN, self::TOKEN],
        ];
    }

    #[DataProvider('odepreno')]
    public function testOdeprenyPristup(?array $roles, ?string $hlavicka, string $nastavenyToken): void
    {
        $response = $this->call($roles, $hlavicka, $nastavenyToken);

        $this->assertSame(403, $response->getStatusCode());
        $this->assertStringNotContainsString('int_adr', $response->getContent());
    }

    public static function odepreno(): array
    {
        return [
            'anonym' => [null, null, self::TOKEN],
            'běžný značkař' => [['ROLE_USER'], null, self::TOKEN],
            'špatný token' => [null, 'jiny-token', self::TOKEN],
            'nenastavený token, prázdná hlavička' => [null, '', ''],
            'nenastavený token, bez hlavičky' => [null, null, ''],
        ];
    }

    private function call(?array $roles, ?string $hlavicka, string $nastavenyToken)
    {
        $insyz = $this->createMock(InsyzService::class);
        $insyz->method('getUser')->willReturn([['INT_ADR' => 5620]]);

        $controller = new TestController($insyz, $nastavenyToken);

        $tokenStorage = new TokenStorage();
        if ($roles !== null) {
            $user = new User();
            $user->setIntAdr(5620);
            $user->setRoles($roles);
            $tokenStorage->setToken(new UsernamePasswordToken($user, 'main', $user->getRoles()));
        }
        $container = new Container();
        $container->set('security.token_storage', $tokenStorage);
        $controller->setContainer($container);

        $request = new Request();
        if ($hlavicka !== null) {
            $request->headers->set('X-Healthcheck-Token', $hlavicka);
        }

        return $controller->getInsyzUser($request);
    }
}
