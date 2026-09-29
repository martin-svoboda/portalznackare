<?php

namespace App\Tests\Security;

use App\Repository\UserRepository;
use App\Security\InsyzAuthenticator;
use App\Security\InsyzUserProvider;
use App\Service\AuditLogger;
use App\Service\InsyzClientThrottler;
use App\Service\InsyzService;
use App\Service\UserPreferenceService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Cache\Adapter\ArrayAdapter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use App\Entity\User;

/**
 * Omezení neúspěšných pokusů o přihlášení: 5 / e-mail, 20 / IP za 15 minut.
 * Simuluje firewall: authenticate() a při výjimce onAuthenticationFailure().
 */
class InsyzAuthenticatorThrottleTest extends TestCase
{
    private InsyzService&MockObject $insyz;
    private InsyzAuthenticator $authenticator;

    protected function setUp(): void
    {
        $this->insyz = $this->createMock(InsyzService::class);
        $cache = new ArrayAdapter();

        $this->authenticator = new InsyzAuthenticator(
            $this->insyz,
            $this->createMock(InsyzUserProvider::class),
            $this->createMock(AuditLogger::class),
            $this->createMock(UserRepository::class),
            $this->createMock(UserPreferenceService::class),
            new InsyzClientThrottler($cache, 5, 900),
            new InsyzClientThrottler($cache, 20, 900)
        );
    }

    public function testPoPetiChybachJeEmailBlokovanABezVolaniInsyz(): void
    {
        $this->insyz->expects($this->exactly(5))->method('loginUser')
            ->willThrowException(new \Exception('Chybné heslo.'));

        for ($i = 0; $i < 5; $i++) {
            $this->assertSame(401, $this->login('jan@x.cz')->getStatusCode());
        }

        $response = $this->login('jan@x.cz');
        $this->assertSame(Response::HTTP_TOO_MANY_REQUESTS, $response->getStatusCode());
        $this->assertStringContainsString('Příliš mnoho neúspěšných pokusů', json_decode($response->getContent(), true)['message']);
    }

    public function testEmailSeNormalizuje(): void
    {
        $this->insyz->method('loginUser')->willThrowException(new \Exception('Chybné heslo.'));

        foreach (['Jan@X.cz', 'jan@x.cz ', ' JAN@X.CZ', 'jan@x.cz', 'Jan@x.Cz'] as $email) {
            $this->login($email);
        }

        $this->assertSame(429, $this->login('jan@x.cz')->getStatusCode());
    }

    public function testBlokaceSeZaBlokovanePokusyNeprodluzujeANepocita(): void
    {
        $this->insyz->method('loginUser')->willThrowException(new \Exception('Chybné heslo.'));
        for ($i = 0; $i < 5; $i++) {
            $this->login('jan@x.cz');
        }

        // Další pokusy během blokace nesmí zvyšovat čítač IP (jinak by se zablokovala celá IP)
        for ($i = 0; $i < 30; $i++) {
            $this->assertSame(429, $this->login('jan@x.cz')->getStatusCode());
        }
        $this->assertSame(401, $this->login('jiny@x.cz')->getStatusCode());
    }

    public function testIpSeBlokujePoDvacetiChybachNapricEmaily(): void
    {
        $this->insyz->method('loginUser')->willThrowException(new \Exception('Chybné heslo.'));

        for ($i = 0; $i < 20; $i++) {
            $this->assertSame(401, $this->login("uzivatel$i@x.cz")->getStatusCode());
        }

        $this->assertSame(429, $this->login('novy@x.cz')->getStatusCode());
        $this->assertSame(401, $this->login('novy@x.cz', '10.0.0.2')->getStatusCode(), 'jiná IP blokovaná není');
    }

    public function testUspesnePrihlaseniNulujeCitacEmailu(): void
    {
        $this->insyz->method('loginUser')->willReturnCallback(function (string $email, string $heslo) {
            if ($heslo !== 'spravne') {
                throw new \Exception('Chybné heslo.');
            }
            return 4133;
        });

        for ($i = 0; $i < 4; $i++) {
            $this->login('jan@x.cz');
        }
        $this->succeed('jan@x.cz');

        for ($i = 0; $i < 4; $i++) {
            $this->assertSame(401, $this->login('jan@x.cz')->getStatusCode());
        }
    }

    public function testPrazdnyEmailSeNepocita(): void
    {
        $this->insyz->expects($this->never())->method('loginUser');

        for ($i = 0; $i < 30; $i++) {
            $this->assertSame(401, $this->login('')->getStatusCode());
        }
    }

    private function request(string $email, string $heslo, string $ip): Request
    {
        return Request::create('/api/auth/login', 'POST', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'REMOTE_ADDR' => $ip,
        ], json_encode(['username' => $email, 'password' => $heslo]));
    }

    private function login(string $email, string $ip = '10.0.0.1', string $heslo = 'spatne'): Response
    {
        $request = $this->request($email, $heslo, $ip);
        try {
            $this->authenticator->authenticate($request);
            $this->fail('Přihlášení mělo selhat');
        } catch (AuthenticationException $e) {
            return $this->authenticator->onAuthenticationFailure($request, $e);
        }
    }

    private function succeed(string $email): void
    {
        $request = $this->request($email, 'spravne', '10.0.0.1');
        $this->authenticator->authenticate($request);

        $user = new User();
        $user->setIntAdr(4133);
        $user->setEmail($email);
        $user->setJmeno('Jan');
        $user->setPrijmeni('Novák');
        $this->authenticator->onAuthenticationSuccess($request, new UsernamePasswordToken($user, 'main', ['ROLE_USER']), 'main');
    }
}
