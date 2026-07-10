<?php

namespace App\Tests\Enum;

use App\Enum\StavProvedeniEnum;
use PHPUnit\Framework\TestCase;

class StavProvedeniEnumTest extends TestCase
{
    public function testNormalizeBoolean(): void
    {
        $this->assertSame(StavProvedeniEnum::PROVEDENA, StavProvedeniEnum::normalize(true));
        $this->assertSame(StavProvedeniEnum::NEPROVEDENA, StavProvedeniEnum::normalize(false));
    }

    public function testNormalizeKody(): void
    {
        $this->assertSame(StavProvedeniEnum::NEVYHODNOCENO, StavProvedeniEnum::normalize(0));
        $this->assertSame(StavProvedeniEnum::NEPROVEDENA, StavProvedeniEnum::normalize(2));
        $this->assertSame(StavProvedeniEnum::PROVEDENA, StavProvedeniEnum::normalize(3));
        $this->assertSame(StavProvedeniEnum::ODLOZENA, StavProvedeniEnum::normalize('4'));
    }

    public function testNormalizeNeznameHodnoty(): void
    {
        $this->assertSame(StavProvedeniEnum::NEVYHODNOCENO, StavProvedeniEnum::normalize(null));
        $this->assertSame(StavProvedeniEnum::NEVYHODNOCENO, StavProvedeniEnum::normalize('ano'));
        $this->assertSame(StavProvedeniEnum::NEVYHODNOCENO, StavProvedeniEnum::normalize(99));
    }
}
