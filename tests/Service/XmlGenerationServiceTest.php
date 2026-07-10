<?php

namespace App\Tests\Service;

use App\Service\AttachmentLookupService;
use App\Service\XmlGenerationService;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Pokrývá opravy chyb v XML pro INSYZ:
 *  1) datum noclehu (calculation.Noclezne[].Datum)
 *  2) přesměrování výplat (data_a.Presmerovani_Vyplat)
 *  3) ID úseku z INSYZ místo EvCi_Tra (Obnovene_Useky klíčované ID_Trasy_ZU)
 *  4) předměty nesmí být v XML dvakrát (Predmety jako objekt klíčovaný ID_PREDMETY)
 */
class XmlGenerationServiceTest extends TestCase
{
    private function makeService(): XmlGenerationService
    {
        // Bez příloh se AttachmentLookupService nevolá – stačí mock.
        $attachmentLookup = $this->createMock(AttachmentLookupService::class);

        return new XmlGenerationService(new RequestStack(), $attachmentLookup);
    }

    /**
     * Data odpovídají tomu, co ukládá opravený frontend (viz useFormSaving.js):
     * Obnovene_Useky a Stavy_Tim v data_b, Presmerovani_Vyplat v data_a,
     * nocležné v calculation. Vychází z reálného příkazu 53773 (ID_Trasy_ZU = 79029).
     */
    private function sampleReportData(): array
    {
        return [
            'id_zp' => 53773,
            'cislo_zp' => 'S/BN/O/26012',
            'znackari' => [
                ['INT_ADR' => 1234, 'Znackar' => 'Jan Novák'],
            ],
            'data_a' => [
                'Datum_Provedeni' => '2026-06-20',
                'Presmerovani_Vyplat' => ['1234' => 5678],
            ],
            'data_b' => [
                'Stavy_Tim' => [
                    'BN098' => [
                        'EvCi_TIM' => 'BN098',
                        'Predmety' => [
                            '498' => ['ID_PREDMETY' => '498', 'Zachovalost' => '1', 'Rok_Vyroby' => '2025'],
                            '637951' => ['ID_PREDMETY' => '637951', 'Zachovalost' => '1', 'Rok_Vyroby' => '2025', 'Smerovani' => 'P'],
                            '637961' => ['ID_PREDMETY' => '637961', 'Zachovalost' => '1', 'Rok_Vyroby' => '2025', 'Smerovani' => 'L'],
                        ],
                    ],
                ],
                'Obnovene_Useky' => [
                    '79029' => ['Usek_Obnoven' => true, 'Usek_Delka' => 3.9],
                ],
            ],
            'calculation' => [
                '1234' => [
                    'INT_ADR' => 1234,
                    'Noclezne' => [
                        ['id' => 'n1', 'Datum' => '2026-06-20', 'Misto' => 'Praha', 'Zarizeni' => 'Hotel', 'Kc' => 500],
                    ],
                    'Noclezne_Celkem' => 500,
                ],
            ],
        ];
    }

    public function testObnoveneUsekyPouzivaIdUsekuNeEvCiTra(): void
    {
        $xml = $this->makeService()->generateReportXml($this->sampleReportData());

        $this->assertStringContainsString('<Usek id="79029">', $xml, 'Úsek musí mít ID úseku z INSYZ');
        $this->assertStringNotContainsString('id="121097"', $xml, 'V XML nesmí být EvCi_Tra jako ID úseku');
        $this->assertStringContainsString('<Usek_Delka>3.9</Usek_Delka>', $xml);
    }

    public function testUsekObnovenCiselnik(): void
    {
        // Usek_Obnoven jde do XML jako kód StavProvedeniEnum: 3=Provedena (Ano),
        // 2=Neprovedena (Ne). Zvládne i starý boolean (true→3, false→2).
        // Všechny úseky (i neprovedené) musí v XML zůstat.
        $data = $this->sampleReportData();
        $data['data_b']['Obnovene_Useky'] = [
            '79029' => ['Usek_Obnoven' => true, 'Usek_Delka' => 3.9],   // legacy boolean → 3
            '80208' => ['Usek_Obnoven' => 2, 'Usek_Delka' => 0],        // Neprovedena
            '99999' => ['Usek_Obnoven' => 3, 'Usek_Delka' => 1],        // Provedena
        ];

        $xml = $this->makeService()->generateReportXml($data);

        $this->assertStringContainsString('<Usek id="79029">', $xml);
        $this->assertStringContainsString('<Usek id="80208">', $xml, 'Neprovedený úsek musí být v XML');
        $this->assertSame(2, substr_count($xml, '<Usek_Obnoven>3</Usek_Obnoven>'), 'Provedena → 3');
        $this->assertSame(1, substr_count($xml, '<Usek_Obnoven>2</Usek_Obnoven>'), 'Neprovedena → 2');
        $this->assertStringNotContainsString('<Usek_Obnoven>1</Usek_Obnoven>', $xml);
        $this->assertStringNotContainsString('<Usek_Obnoven></Usek_Obnoven>', $xml, 'Už žádný prázdný stav');
    }

    public function testTypUsekuJenVAtributu(): void
    {
        // <Usek> nese příznak jen jako zkratku v atributu typ (U/O).
        // Element <Typ_Useku> se do XML NEvypisuje.
        $data = $this->sampleReportData();
        $data['data_b']['Obnovene_Useky'] = [
            '94488' => ['Usek_Obnoven' => true, 'Usek_Delka' => 4.35, 'Typ_Useku' => 'Úsek'],
            '14899' => ['Usek_Obnoven' => true, 'Usek_Delka' => 0.36, 'Typ_Useku' => 'Odbočka'],
        ];

        $xml = $this->makeService()->generateReportXml($data);

        $this->assertStringContainsString('<Usek id="94488" typ="U">', $xml);
        $this->assertStringContainsString('<Usek id="14899" typ="O">', $xml);
        $this->assertStringNotContainsString('<Typ_Useku>', $xml, 'Typ_Useku už není element, jen atribut');
    }

    public function testSpzRidiceVeVyuctovani(): void
    {
        // SPZ jde do Vyuctovani k řidiči (Ridic ve skupině cest), vedle Zvysena_Sazba.
        // Spolujezdec SPZ nedostane.
        $data = $this->sampleReportData();
        $data['data_a']['Skupiny_Cest'] = [
            ['id' => '001', 'Ridic' => 1990, 'SPZ' => '1CH0879', 'Cesty' => []],
        ];
        $data['calculation'] = [
            '1955' => ['INT_ADR' => 1955, 'Zvysena_Sazba' => false, 'Stravne' => 170],
            '1990' => ['INT_ADR' => 1990, 'Zvysena_Sazba' => false, 'Stravne' => 170],
        ];

        $xml = $this->makeService()->generateReportXml($data);

        $this->assertStringContainsString('<SPZ>1CH0879</SPZ>', $xml);
        $this->assertSame(1, substr_count($xml, '<SPZ>'), 'SPZ jen u řidiče, ne u spolujezdce');
        // SPZ je uvnitř bloku řidiče (Znackar 1990)
        $this->assertMatchesRegularExpression('#<Znackar id="1990">.*?<SPZ>1CH0879</SPZ>.*?</Znackar>#s', $xml);
    }

    public function testNeplatneUsekIdNejdeDoXml(): void
    {
        // Chybná data z INSYZ (N/A) nesmí protéct jako <Usek id="N/A"> – ID úseku je číselné.
        $data = $this->sampleReportData();
        $data['data_b']['Obnovene_Useky'] = [
            '79029' => ['Usek_Obnoven' => true, 'Usek_Delka' => 3.9],
            'N/A'   => ['Usek_Obnoven' => true, 'Usek_Delka' => 0],
        ];

        $xml = $this->makeService()->generateReportXml($data);

        $this->assertStringContainsString('<Usek id="79029">', $xml);
        $this->assertStringNotContainsString('id="N/A"', $xml, 'Neplatné ID úseku nesmí být v XML');
    }

    public function testPredmetyNejsouDuplicitni(): void
    {
        $xml = $this->makeService()->generateReportXml($this->sampleReportData());

        // Právě 3 předměty, ne 6
        $this->assertSame(3, substr_count($xml, '<Predmet '), 'Každý předmět smí být v XML jen jednou');

        // Žádné pozůstatkové numerické klíče z pole
        $this->assertStringNotContainsString('<Predmet id="0">', $xml);
        $this->assertStringNotContainsString('<Predmet id="1">', $xml);
        $this->assertStringNotContainsString('<Predmet id="2">', $xml);

        // Reálná ID, každé právě jednou
        $this->assertSame(1, substr_count($xml, '<Predmet id="498">'));
        $this->assertSame(1, substr_count($xml, '<Predmet id="637951">'));
        $this->assertSame(1, substr_count($xml, '<Predmet id="637961">'));
    }

    public function testNoclezneObsahujeDatum(): void
    {
        $xml = $this->makeService()->generateReportXml($this->sampleReportData());

        $this->assertStringContainsString('<Noclezne', $xml);
        $this->assertStringContainsString('<Datum>2026-06-20</Datum>', $xml, 'Nocležné musí obsahovat datum');
        $this->assertStringContainsString('<Zarizeni>Hotel</Zarizeni>', $xml);
    }

    public function testPresmerovaniVyplatVeXml(): void
    {
        $xml = $this->makeService()->generateReportXml($this->sampleReportData());

        $this->assertStringContainsString('<Presmerovani_Vyplat>', $xml);
        $this->assertStringContainsString('<Vyplatit INT_ADR="1234">5678</Vyplatit>', $xml);
    }

    public function testMetaOdeslaniVeXml(): void
    {
        $xml = $this->makeService()->generateReportXml($this->sampleReportData(), [
            'Datum_Odeslani' => '2026-07-05 10:00:30',
            'Odeslal' => 4133,
        ]);

        $this->assertStringContainsString('<Datum_Odeslani>2026-07-05 10:00:30</Datum_Odeslani>', $xml);
        $this->assertStringContainsString('<Odeslal>4133</Odeslal>', $xml);
    }

    public function testBezMetaSeElementyNevypisuji(): void
    {
        $xml = $this->makeService()->generateReportXml($this->sampleReportData());

        $this->assertStringNotContainsString('<Datum_Odeslani>', $xml);
        $this->assertStringNotContainsString('<Odeslal>', $xml);
    }

    /**
     * Znaky nepřevoditelné do kolace INSYZ (Windows-1250) musí být z textu
     * odstraněny, jinak trasy.ZP_Zapis_XML spadne na konverzi kolace.
     * Regrese k reportu S/PY/O/26029 (odrážka „●" v komentáři TIM).
     */
    public function testNeprevoditelneZnakySeOdstrani(): void
    {
        $data = $this->sampleReportData();
        $data['data_b']['Stavy_Tim']['BN098']['Koment_TIM'] = "● PY099a: nesedí km 😀 → konec";

        $xml = $this->makeService()->generateReportXml($data);

        // Text komentáře zůstane, ale bez znaků mimo CP1250
        $this->assertStringContainsString('<Koment_TIM>', $xml);
        $this->assertStringNotContainsString('●', $xml, 'Odrážka U+25CF nesmí zůstat v XML');
        $this->assertStringNotContainsString('😀', $xml, 'Emoji nesmí zůstat v XML');
        $this->assertStringContainsString('nesedí km', $xml, 'Česká diakritika se musí zachovat');
    }

    /**
     * Celá česká diakritika je v CP1250 – nesmí ji sanitizace poškodit.
     */
    public function testCeskaDiakritikaZustavaZachovana(): void
    {
        $data = $this->sampleReportData();
        $data['data_b']['Stavy_Tim']['BN098']['Predmety']['498']['metadata'] = null;
        $data['data_b']['Stavy_Tim']['BN098']['Koment_TIM'] = 'ZBOŘENÝ KOSTELEC (ZŘÍC.) ěščřžýáíé ůú';

        $xml = $this->makeService()->generateReportXml($data);

        $this->assertStringContainsString('ZBOŘENÝ KOSTELEC (ZŘÍC.) ěščřžýáíé ůú', $xml);
    }
}
