<?php

namespace App\Tests\Security;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Security\InsyzUserProvider;
use App\Security\UserChecker;
use App\Service\AuditLogger;
use App\Service\InsyzService;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAccountStatusException;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;

/**
 * Účet deaktivovaný v portálu se nepřihlásí a běžící session se ukončí.
 * (Dříve provider neaktivního uživatele znovu načetl přes INSYZ a vrátil ho.)
 */
class DeaktivovanyUzivatelTest extends TestCase
{
    public function testDeaktivovanyUcetSeNeprihlasi(): void
    {
        $this->expectException(CustomUserMessageAccountStatusException::class);
        $this->expectExceptionMessage('Účet je v portálu deaktivován');

        (new UserChecker())->checkPreAuth($this->user(false));
    }

    public function testAktivniUcetProjde(): void
    {
        (new UserChecker())->checkPreAuth($this->user(true));
        $this->addToAssertionCount(1);
    }

    public function testBeziciSessionDeaktivovanehoSeUkonci(): void
    {
        $vSession = $this->user(true);
        $this->zestarni($vSession);

        $vDb = $this->user(false);
        $this->expectException(UserNotFoundException::class);

        $this->provider($vDb)->refreshUser($vSession);
    }

    public function testBeziciSessionAktivnihoPokracuje(): void
    {
        $vSession = $this->user(true);
        $this->zestarni($vSession);

        $this->assertTrue($this->provider($this->user(true))->refreshUser($vSession)->isActive());
    }

    /** Provider, jehož DB i INSYZ vrací daného uživatele (jako findOrCreateFromInsyzData) */
    private function provider(User $zDb): InsyzUserProvider
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByIntAdr')->willReturn($zDb);
        $repo->method('findOrCreateFromInsyzData')->willReturn($zDb);

        $insyz = $this->createMock(InsyzService::class);
        $insyz->method('getUser')->willReturn([[['INT_ADR' => '4133']]]);

        return new InsyzUserProvider($insyz, $repo, $this->createMock(AuditLogger::class));
    }

    private function user(bool $aktivni): User
    {
        $user = new User();
        $user->setIntAdr(4133);
        $user->setIsActive($aktivni);

        return $user;
    }

    /** refreshUser načítá z DB až po 5 minutách od poslední změny */
    private function zestarni(User $user): void
    {
        (new \ReflectionProperty(User::class, 'updatedAt'))->setValue($user, new \DateTimeImmutable('-10 minutes'));
    }
}
