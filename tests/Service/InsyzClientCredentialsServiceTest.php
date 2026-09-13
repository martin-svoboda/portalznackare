<?php

namespace App\Tests\Service;

use App\Exception\InsyzClientAuthException;
use App\Service\InsyzClientConnectionPool;
use App\Service\InsyzClientCredentialsService;
use App\Service\InsyzLegacyPasswordCipher;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class InsyzClientCredentialsServiceTest extends TestCase
{
    /** Uziv_Info pro heslo "Heslo123" (DES-CBC, base64, UTF-16LE) */
    private const UZIV_INFO = 'LC25nIxFrhEw6p+ORkSd+PD9SjKrD6vb';

    private const ACCOUNTS = [
        'db6273' => [
            'host' => 'sql8.aspone.cz',
            'database' => 'db6273',
            'user' => 'db6273',
            'password' => 'tajne-heslo-db6273',
        ],
        'Cyklo_UNI' => [
            'host' => 'vpn.elra.cz',
            'database' => 'Cyklo_UNI',
            'user' => 'Cyklo_UNI',
            'password' => 'tajne-heslo-cyklo',
        ],
        'db6266' => [
            'host' => 'sql8.aspone.cz',
            'database' => 'db6266',
            'user' => 'db6266',
            'password' => '',
        ],
    ];

    private InsyzClientConnectionPool&MockObject $connections;

    protected function setUp(): void
    {
        $_ENV['USE_TEST_DATA'] = 'false';
        $this->connections = $this->createMock(InsyzClientConnectionPool::class);
    }

    protected function tearDown(): void
    {
        unset($_ENV['USE_TEST_DATA']);
    }

    public function testReturnsPasswordForValidRequest(): void
    {
        $this->givenUserRow(['Uziv_Info' => self::UZIV_INFO, 'Platnost_Od' => null, 'Platnost_Do' => null]);

        $this->assertSame(
            'tajne-heslo-db6273',
            $this->service()->getDbPassword('znackar', 'Heslo123', 'db6273')
        );
    }

    public function testReturnsPasswordForKeyWithUnderscoresAndCase(): void
    {
        $this->givenUserRow(['Uziv_Info' => self::UZIV_INFO, 'Platnost_Od' => null, 'Platnost_Do' => null]);

        $this->assertSame(
            'tajne-heslo-cyklo',
            $this->service()->getDbPassword('znackar', 'Heslo123', 'Cyklo_UNI')
        );
    }

    public function testKeyIsCaseSensitive(): void
    {
        $this->expectAuthFailure(InsyzClientAuthException::REASON_UNKNOWN_KEY);

        $this->service()->getDbPassword('znackar', 'Heslo123', 'cyklo_uni');
    }

    public function testUnknownKeyNeverTouchesDatabase(): void
    {
        $this->connections->expects($this->never())->method('query');

        $this->expectAuthFailure(InsyzClientAuthException::REASON_UNKNOWN_KEY);

        $this->service()->getDbPassword('znackar', 'Heslo123', 'neexistujici');
    }

    public function testConfiguredButEmptyPasswordIsTreatedAsUnknownKey(): void
    {
        $this->expectAuthFailure(InsyzClientAuthException::REASON_UNKNOWN_KEY);

        $this->service()->getDbPassword('znackar', 'Heslo123', 'db6266');
    }

    public function testUnknownUserFails(): void
    {
        $this->connections->method('query')->willReturn([]);

        $this->expectAuthFailure(InsyzClientAuthException::REASON_UNKNOWN_USER);

        $this->service()->getDbPassword('neznamy', 'Heslo123', 'db6273');
    }

    public function testWrongPasswordFails(): void
    {
        $this->givenUserRow(['Uziv_Info' => self::UZIV_INFO, 'Platnost_Od' => null, 'Platnost_Do' => null]);

        $this->expectAuthFailure(InsyzClientAuthException::REASON_BAD_PASSWORD);

        $this->service()->getDbPassword('znackar', 'spatne', 'db6273');
    }

    public function testUndecryptableUzivInfoFails(): void
    {
        $this->givenUserRow(['Uziv_Info' => 'rozbity-obsah', 'Platnost_Od' => null, 'Platnost_Do' => null]);

        $this->expectAuthFailure(InsyzClientAuthException::REASON_BAD_PASSWORD);

        $this->service()->getDbPassword('znackar', 'Heslo123', 'db6273');
    }

    public function testQueryIsParametrized(): void
    {
        $this->connections->expects($this->once())
            ->method('query')
            ->with(
                'db6273',
                self::ACCOUNTS['db6273'],
                $this->callback(fn (string $sql) => str_contains($sql, '?') && !str_contains($sql, 'znackar')),
                ['znackar']
            )
            ->willReturn([['Uziv_Info' => self::UZIV_INFO, 'Platnost_Od' => null, 'Platnost_Do' => null]]);

        $this->service()->getDbPassword('znackar', 'Heslo123', 'db6273');
    }

    public function testUserIsVerifiedInDatabaseOfRequestedKey(): void
    {
        $this->connections->expects($this->once())
            ->method('query')
            ->with('Cyklo_UNI', self::ACCOUNTS['Cyklo_UNI'])
            ->willReturn([['Uziv_Info' => self::UZIV_INFO, 'Platnost_Od' => null, 'Platnost_Do' => null]]);

        $this->assertSame(
            'tajne-heslo-cyklo',
            $this->service()->getDbPassword('znackar', 'Heslo123', 'Cyklo_UNI')
        );
    }

    public function testUnreachableDatabaseFailsWithoutFallback(): void
    {
        $this->connections->expects($this->once())
            ->method('query')
            ->with('db6273')
            ->willThrowException(new \PDOException('SQLSTATE[08001]: server not reachable'));

        // Nesmí se vrátit heslo ani zkusit jiná databáze — chyba propadne ven,
        // kontroler ji zaloguje a odpoví stejnou generickou hláškou
        $this->expectException(\PDOException::class);

        $this->service()->getDbPassword('znackar', 'Heslo123', 'db6273');
    }

    /**
     * @dataProvider validityRanges
     */
    public function testAccountValidity(?string $from, ?string $to, bool $shouldPass): void
    {
        $this->givenUserRow(['Uziv_Info' => self::UZIV_INFO, 'Platnost_Od' => $from, 'Platnost_Do' => $to]);

        if (!$shouldPass) {
            $this->expectAuthFailure(InsyzClientAuthException::REASON_ACCOUNT_NOT_VALID);
        }

        $password = $this->service()->getDbPassword('znackar', 'Heslo123', 'db6273');

        $this->assertSame('tajne-heslo-db6273', $password);
    }

    public static function validityRanges(): array
    {
        $yesterday = (new \DateTimeImmutable('yesterday'))->format('Y-m-d');
        $today = (new \DateTimeImmutable('today'))->format('Y-m-d');
        $tomorrow = (new \DateTimeImmutable('tomorrow'))->format('Y-m-d');

        return [
            'bez omezení' => [null, null, true],
            'uvnitř intervalu' => [$yesterday, $tomorrow, true],
            'dnešek je první den' => [$today, $tomorrow, true],
            'dnešek je poslední den' => [$yesterday, $today, true],
            'jen jednodenní platnost dnes' => [$today, $today, true],
            'platnost ještě nezačala' => [$tomorrow, null, false],
            'platnost už skončila' => [null, $yesterday, false],
            'otevřený začátek' => [null, $tomorrow, true],
            'otevřený konec' => [$yesterday, null, true],
        ];
    }

    public function testDateTimeObjectsFromDriverAreAccepted(): void
    {
        $this->givenUserRow([
            'Uziv_Info' => self::UZIV_INFO,
            'Platnost_Od' => new \DateTimeImmutable('yesterday'),
            'Platnost_Do' => new \DateTimeImmutable('tomorrow'),
        ]);

        $this->assertSame(
            'tajne-heslo-db6273',
            $this->service()->getDbPassword('znackar', 'Heslo123', 'db6273')
        );
    }

    public function testUnparsableDateDoesNotPass(): void
    {
        $this->givenUserRow(['Uziv_Info' => self::UZIV_INFO, 'Platnost_Od' => 'nesmysl', 'Platnost_Do' => null]);

        $this->expectAuthFailure(InsyzClientAuthException::REASON_ACCOUNT_NOT_VALID);

        $this->service()->getDbPassword('znackar', 'Heslo123', 'db6273');
    }

    public function testTestDataModeAcceptsMockAccount(): void
    {
        $_ENV['USE_TEST_DATA'] = 'true';
        $this->connections->expects($this->never())->method('query');

        $this->assertSame(
            'tajne-heslo-db6273',
            $this->service()->getDbPassword('test', 'test', 'db6273')
        );
    }

    public function testTestDataModeRejectsOtherAccounts(): void
    {
        $_ENV['USE_TEST_DATA'] = 'true';

        $this->expectAuthFailure(InsyzClientAuthException::REASON_UNKNOWN_USER);

        $this->service()->getDbPassword('kdokoliv', 'test', 'db6273');
    }

    private function service(): InsyzClientCredentialsService
    {
        return new InsyzClientCredentialsService(
            $this->connections,
            new InsyzLegacyPasswordCipher(),
            self::ACCOUNTS
        );
    }

    /**
     * @param array<string, mixed> $row
     */
    private function givenUserRow(array $row): void
    {
        $this->connections->method('query')->willReturn([$row]);
    }

    private function expectAuthFailure(string $reason): void
    {
        $this->expectException(InsyzClientAuthException::class);
        $this->expectExceptionMessage($reason);
    }
}
