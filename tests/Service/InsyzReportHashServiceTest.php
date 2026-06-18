<?php

namespace App\Tests\Service;

use App\Service\InsyzReportHashService;
use PHPUnit\Framework\TestCase;

class InsyzReportHashServiceTest extends TestCase
{
    private const SECRET = 'test-secret';

    public function testGenerateMatchesInsyzSha1Mechanism(): void
    {
        $service = new InsyzReportHashService(self::SECRET);
        $cisloZp = 'P/PS/O/26032';

        $expected = strtoupper(sha1(self::SECRET . $cisloZp));

        $this->assertSame($expected, $service->generate($cisloZp));
        $this->assertSame(40, strlen($service->generate($cisloZp)));
    }

    public function testVerifyAcceptsCorrectHashCaseInsensitive(): void
    {
        $service = new InsyzReportHashService(self::SECRET);
        $cisloZp = 'P/PS/O/26032';
        $hash = $service->generate($cisloZp);

        $this->assertTrue($service->verify($cisloZp, $hash));
        $this->assertTrue($service->verify($cisloZp, strtolower($hash)));
    }

    public function testVerifyRejectsWrongOrEmptyHash(): void
    {
        $service = new InsyzReportHashService(self::SECRET);

        $this->assertFalse($service->verify('P/PS/O/26032', 'deadbeef'));
        $this->assertFalse($service->verify('P/PS/O/26032', ''));
        $this->assertFalse($service->verify('', $service->generate('P/PS/O/26032')));
    }
}
