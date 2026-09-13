<?php

namespace App\Tests\Service;

use App\Service\InsyzClientThrottler;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Cache\Adapter\ArrayAdapter;

class InsyzClientThrottlerTest extends TestCase
{
    public function testAllowsAttemptsUnderLimit(): void
    {
        $throttler = new InsyzClientThrottler(new ArrayAdapter(), 3, 900);

        $throttler->registerFailure('ip', '10.0.0.1');
        $throttler->registerFailure('ip', '10.0.0.1');

        $this->assertFalse($throttler->isBlocked('ip', '10.0.0.1'));
    }

    public function testBlocksAfterReachingLimit(): void
    {
        $throttler = new InsyzClientThrottler(new ArrayAdapter(), 3, 900);

        for ($i = 0; $i < 3; $i++) {
            $throttler->registerFailure('ip', '10.0.0.1');
        }

        $this->assertTrue($throttler->isBlocked('ip', '10.0.0.1'));
    }

    public function testScopesAreIndependent(): void
    {
        $throttler = new InsyzClientThrottler(new ArrayAdapter(), 2, 900);

        $throttler->registerFailure('ip', 'shared-value');
        $throttler->registerFailure('ip', 'shared-value');

        $this->assertTrue($throttler->isBlocked('ip', 'shared-value'));
        $this->assertFalse($throttler->isBlocked('user', 'shared-value'));
    }

    public function testIdentifiersAreIndependentWithinScope(): void
    {
        $throttler = new InsyzClientThrottler(new ArrayAdapter(), 2, 900);

        $throttler->registerFailure('user', 'utocnik');
        $throttler->registerFailure('user', 'utocnik');

        $this->assertTrue($throttler->isBlocked('user', 'utocnik'));
        $this->assertFalse($throttler->isBlocked('user', 'bezny_uzivatel'));
    }

    public function testResetClearsCounter(): void
    {
        $throttler = new InsyzClientThrottler(new ArrayAdapter(), 2, 900);

        $throttler->registerFailure('user', 'test');
        $throttler->registerFailure('user', 'test');
        $this->assertTrue($throttler->isBlocked('user', 'test'));

        $throttler->reset('user', 'test');

        $this->assertFalse($throttler->isBlocked('user', 'test'));
    }

    public function testCounterExpiresAfterWindow(): void
    {
        $throttler = new InsyzClientThrottler(new ArrayAdapter(), 2, 1);

        $throttler->registerFailure('ip', '10.0.0.1');
        $throttler->registerFailure('ip', '10.0.0.1');
        $this->assertTrue($throttler->isBlocked('ip', '10.0.0.1'));

        sleep(2);

        $this->assertFalse($throttler->isBlocked('ip', '10.0.0.1'));
    }

    public function testIdentifierIsNotStoredInPlainText(): void
    {
        $cache = new ArrayAdapter();
        $throttler = new InsyzClientThrottler($cache, 5, 900);

        $throttler->registerFailure('user', 'jmeno.prijmeni');

        $keys = array_keys($cache->getValues());
        $this->assertCount(1, $keys);
        $this->assertStringNotContainsString('jmeno.prijmeni', $keys[0]);
    }
}
