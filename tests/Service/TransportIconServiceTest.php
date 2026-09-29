<?php

namespace App\Tests\Service;

use App\Service\ColorService;
use App\Service\TimService;
use App\Service\TransportIconService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Text z INSYZ (Naz_TIM, Nazev_ZU, Popis_ZP, Radek1–3…) se po nahrazení ikon vkládá
 * jako HTML na web i do PDF – musí být escapovaný, kódy ikon (&bus, &žst,bus) funkční.
 */
class TransportIconServiceTest extends TestCase
{
    private TransportIconService $service;

    protected function setUp(): void
    {
        $this->service = new TransportIconService();
    }

    #[DataProvider('nebezpecneTexty')]
    public function testTextZInsyzJeEscapovany(string $text, string $ocekavany): void
    {
        $this->assertSame($ocekavany, $this->service->replaceIconsInText($text));
    }

    public static function nebezpecneTexty(): array
    {
        return [
            'script' => ['Hrad <script>alert(1)</script>', 'Hrad &lt;script&gt;alert(1)&lt;/script&gt;'],
            'img onerror' => ['<img src=x onerror="alert(1)">', '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'],
            'uvozovky a apostrof' => ['U "Lípy" \'na\'', 'U &quot;Lípy&quot; &#039;na&#039;'],
            'samostatný ampersand' => ['Hrad & zámek', 'Hrad &amp; zámek'],
            'bez HTML beze změny' => ['SEDLEC (nám.) - JEŽOVKA', 'SEDLEC (nám.) - JEŽOVKA'],
        ];
    }

    public function testKodIkonyZustavaFunkcni(): void
    {
        $html = $this->service->replaceIconsInText('KOMORNICE <b> &žst,bus - OLBRAMOVICE');

        $this->assertStringStartsWith('KOMORNICE &lt;b&gt; <span', $html);
        $this->assertSame(2, substr_count($html, '<svg'), 'vlak + bus');
        $this->assertStringEndsWith('</span> - OLBRAMOVICE', $html);
        $this->assertStringNotContainsString('<b>', $html);
    }

    public function testNeznamyKodSeVratiEscapovanyBezAmpersandu(): void
    {
        // Neznámý kód se vrací bez & (dosavadní chování), ostatní text escapovaný
        $this->assertSame('xyz &lt;i&gt;', $this->service->replaceIconsInText('&xyz <i>'));
    }

    public function testSkrytiIkonOdeberKodAleEscapuje(): void
    {
        $this->assertSame('A &lt;u&gt; ', $this->service->replaceIconsInText('A <u> &bus', 10, true));
    }

    public function testNahledTimuEscapujeTextyZInsyz(): void
    {
        $tim = new TimService($this->service, new ColorService());

        $html = $tim->timPreview([
            'Druh_Predmetu' => 'S',
            'Smerovani' => 'L',
            'Barva_Kod' => 'CE',
            'Radek1' => 'Chata <img src=x onerror=alert`1`> (2 km)',
            'KM1' => '2.5',
            'Rok_Vyroby' => '<b>2020</b>',
            'EvCi_TIM' => '1234<script>',
            'Predmet_Index' => 'A',
        ]);

        $this->assertStringNotContainsString('<img src=x', $html);
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringNotContainsString('<b>2020', $html);
        $this->assertStringContainsString('Chata &lt;img src=x onerror=alert`1`&gt; <small>(2 km)</small>', $html);
        $this->assertStringContainsString('&lt;b&gt;2020&lt;/b&gt;', $html);
        $this->assertStringContainsString('1234&lt;script&gt;A', $html);
    }
}
