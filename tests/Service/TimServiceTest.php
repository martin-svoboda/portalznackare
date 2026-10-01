<?php

namespace App\Tests\Service;

use App\Service\ColorService;
use App\Service\TimService;
use App\Service\TransportIconService;
use PHPUnit\Framework\TestCase;

/**
 * Řádky textu předmětu včetně meziřádků (INSYZ-308) a TVM (INSYZ-328).
 * Data předmětů odpovídají trasy.ZP_Detail (příkazy 54404, 56286, 51098, 54385).
 */
class TimServiceTest extends TestCase
{
    private TimService $service;

    protected function setUp(): void
    {
        $this->service = new TimService(new TransportIconService(), new ColorService());
    }

    private function texty(array $item): array
    {
        return array_map(
            fn ($r) => ($r['meziradek'] ? '~ ' : '').$r['text'].($r['km'] ? ' | '.$r['km'] : ''),
            $this->service->getItemLines($item)
        );
    }

    public function testSmerovkaMeziradkyMeziRadky(): void
    {
        // BN087a
        $item = [
            'Druh_Predmetu' => 'S',
            'Radek1' => 'ROUDNÝ (BÝV. ZLATÝ DŮL)', 'KM1' => '1.500',
            'Meziradek_12' => '',
            'Radek2' => 'KAMBERK', 'KM2' => '3.000',
            'Meziradek_23' => 'dále po červené',
            'Radek3' => 'ODLOCHOVICE', 'KM3' => '6.000',
        ];

        $this->assertSame([
            'ROUDNÝ (BÝV. ZLATÝ DŮL) | 1.500',
            'KAMBERK | 3.000',
            '~ dále po červené',
            'ODLOCHOVICE | 6.000',
        ], $this->texty($item));
    }

    public function testDoplnkovaSmerovkaBezRadek1(): void
    {
        // BN343h – INSYZ nechává Radek1 prázdný
        $item = [
            'Druh_Predmetu' => 'D',
            'Radek1' => null, 'KM1' => '.000',
            'Radek2' => 'SÁZAVA, ZASTÁVKA', 'KM2' => '.000',
            'Meziradek_23' => 'po 60 m  před viaduktem doprava',
            'Radek3' => null, 'KM3' => '.000',
        ];

        $this->assertSame(['SÁZAVA, ZASTÁVKA', '~ po 60 m  před viaduktem doprava'], $this->texty($item));
    }

    public function testTvmJenNazevAMeritko(): void
    {
        // JE175v
        $item = [
            'Druh_Predmetu' => 'V',
            'Radek1' => 'TVM: JESENICKO', 'KM1' => '.000',
            'Meziradek_12' => '1:30 000',
            'Radek2' => null,
            'Radek3' => '!! NEOBJEDNÁVAT PŘES INSYZ !!',
        ];

        $this->assertSame(['TVM: JESENICKO', '~ 1:30 000'], $this->texty($item));
    }

    public function testTmnVyskaJenJednouAPopisZMeziradku(): void
    {
        // BN343m – výška v Nadmorska_vyska, Radek2 i Meziradek_12
        $item = [
            'Druh_Predmetu' => 'M',
            'Nadmorska_vyska' => '293.0',
            'Radek1' => 'SÁZAVA, U MARTINA &ŽST',
            'Meziradek_12' => '293 m n.m.',
            'Radek2' => '293 m n.m.',
            'Meziradek_23' => 'V 18. st. prošel barokní úpravou',
            'Radek3' => 'KOSTEL SV. MARTINA',
        ];

        $this->assertSame([
            'SÁZAVA, U MARTINA &ŽST',
            '293 m n.m.',
            '~ V 18. st. prošel barokní úpravou',
            'KOSTEL SV. MARTINA',
        ], $this->texty($item));
    }

    public function testPopisnaTabulkaMeziradkyZatimNezobrazuje(): void
    {
        // BN099p – u tabulek jsou texty uložené nestandardně (Meziradek_12 opakuje Radek1)
        $item = [
            'Druh_Predmetu' => 'T',
            'Radek1' => 'ŘÍP - BLANÍK ',
            'Meziradek_12' => 'ŘÍP - BLANÍK',
            'Radek2' => '',
        ];

        $this->assertSame(['ŘÍP - BLANÍK'], $this->texty($item));
    }

    public function testMeziradekVNahleduJeEscapovany(): void
    {
        $html = $this->service->timPreview([
            'Druh_Predmetu' => 'S',
            'Smerovani' => 'L',
            'Radek1' => 'CÍL', 'KM1' => '1.000',
            'Meziradek_12' => '<script>alert(1)</script>',
        ]);

        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
    }
}
