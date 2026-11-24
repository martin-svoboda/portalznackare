<?php

namespace App\Tests\Service;

use App\Service\ApiCacheService;
use App\Service\InsyzAuditLogger;
use App\Service\InsyzService;
use App\Service\MssqlConnector;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\KernelInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;

/**
 * Kvalifikace k datu provedení – pravidlo jako v INSYZ:
 * ISNULL(Datum_Kval, '1900-01-01') <= @Dat_Prov (Honza 24. 11. 2026).
 */
class InsyzServiceKvalifikaceTest extends TestCase
{
    private function detail(array $kvalifikace): array
    {
        return [[['INT_ADR' => 100]], [], $kvalifikace, [], []];
    }

    public function testKvalifikaceZiskanaPredNeboVDenProvedeni(): void
    {
        $d = $this->detail([['Zkratka_Kval' => 'ZZ', 'Datum_Kval' => '2026-04-05T00:00:00']]);
        $this->assertTrue(InsyzService::maKvalifikaciKDatu($d, '2026-04-05'));
        $this->assertTrue(InsyzService::maKvalifikaciKDatu($d, '2026-05-01'));
    }

    public function testKvalifikaceZiskanaAzPoProvedeni(): void
    {
        $d = $this->detail([['Zkratka_Kval' => 'VZ', 'Datum_Kval' => '2026-04-06']]);
        $this->assertFalse(InsyzService::maKvalifikaciKDatu($d, '2026-04-05'));
    }

    public function testBezDataPlatiVzdy(): void
    {
        $d = $this->detail([['Zkratka_Kval' => 'IZ', 'Datum_Kval' => null]]);
        $this->assertTrue(InsyzService::maKvalifikaciKDatu($d, '2026-04-05'));
    }

    public function testKvalifikaceBezNarokuNestaci(): void
    {
        $d = $this->detail([['Zkratka_Kval' => '--', 'Datum_Kval' => null], ['Zkratka_Kval' => 'KT', 'Datum_Kval' => '2020-01-01']]);
        $this->assertFalse(InsyzService::maKvalifikaciKDatu($d, '2026-04-05'));
        $this->assertFalse(InsyzService::maKvalifikaciKDatu($this->detail([]), '2026-04-05'));
    }

    /**
     * getUser s datem provedení: kdo v cache nemá kvalifikaci k datu, tomu se cache zahodí
     * a detail načte znovu; kvalifikovaný se znovu nenačítá.
     */
    private function sluzbaSCache(array ...$odpovediCache): array
    {
        $cache = $this->createMock(ApiCacheService::class);
        $cache->method('getCachedUserData')->willReturnOnConsecutiveCalls(...$odpovediCache);
        $service = new InsyzService(
            $this->createMock(MssqlConnector::class),
            $this->createMock(KernelInterface::class),
            $cache,
            $this->createMock(InsyzAuditLogger::class),
            $this->createMock(TokenStorageInterface::class),
        );
        return [$service, $cache];
    }

    public function testNekvalifikovanemuSeDetailNacteCerstvy(): void
    {
        $stary = $this->detail([['Zkratka_Kval' => '--', 'Datum_Kval' => null]]);
        $novy = $this->detail([['Zkratka_Kval' => 'ZZ', 'Datum_Kval' => '2026-03-01']]);
        [$service, $cache] = $this->sluzbaSCache($stary, $novy);
        $cache->expects($this->once())->method('invalidateUserCache')->with(100);

        $this->assertSame($novy, $service->getUser(100, '2026-04-05'));
    }

    public function testKvalifikovanemuSeCacheNezahazuje(): void
    {
        $d = $this->detail([['Zkratka_Kval' => 'ZZ', 'Datum_Kval' => '2026-03-01']]);
        [$service, $cache] = $this->sluzbaSCache($d);
        $cache->expects($this->never())->method('invalidateUserCache');

        $this->assertSame($d, $service->getUser(100, '2026-04-05'));
    }

    public function testBezDataSeKvalifikaceNeresi(): void
    {
        $d = $this->detail([]);
        [$service, $cache] = $this->sluzbaSCache($d);
        $cache->expects($this->never())->method('invalidateUserCache');

        $this->assertSame($d, $service->getUser(100));
    }

    protected function setUp(): void
    {
        $this->puvodniTestData = $_ENV['USE_TEST_DATA'] ?? null;
        $_ENV['USE_TEST_DATA'] = 'false';
    }

    protected function tearDown(): void
    {
        $_ENV['USE_TEST_DATA'] = $this->puvodniTestData;
    }

    private ?string $puvodniTestData = null;
}
