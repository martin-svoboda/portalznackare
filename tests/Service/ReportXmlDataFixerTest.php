<?php

namespace App\Tests\Service;

use App\Service\ReportXmlDataFixer;
use PHPUnit\Framework\TestCase;

class ReportXmlDataFixerTest extends TestCase
{
    private ReportXmlDataFixer $fixer;

    protected function setUp(): void
    {
        $this->fixer = new ReportXmlDataFixer();
    }

    private function useky(): array
    {
        return [
            ['EvCi_Tra' => '121097', 'ID_Trasy_ZU' => '79029', 'ID_TRASY_Odbocky' => null],
        ];
    }

    public function testDeduplikacePredmetu(): void
    {
        // Stav po chybě: pole rozprostřené do objektu (0,1,2) + reálná ID
        $dataB = [
            'Stavy_Tim' => [
                'BN098' => [
                    'EvCi_TIM' => 'BN098',
                    'Predmety' => [
                        '0' => ['ID_PREDMETY' => '498'],
                        '1' => ['ID_PREDMETY' => '637951', 'Smerovani' => 'P'],
                        '2' => ['ID_PREDMETY' => '637961', 'Smerovani' => 'L'],
                        '498' => ['ID_PREDMETY' => '498', 'Zachovalost' => '1', 'Rok_Vyroby' => '2025'],
                        '637951' => ['ID_PREDMETY' => '637951', 'Zachovalost' => '1', 'Smerovani' => 'P'],
                        '637961' => ['ID_PREDMETY' => '637961', 'Zachovalost' => '1', 'Smerovani' => 'L'],
                    ],
                ],
            ],
        ];

        $result = $this->fixer->fix([], $dataB, [], null);
        $predmety = $result['data_b']['Stavy_Tim']['BN098']['Predmety'];

        $this->assertTrue($result['changed']);
        $this->assertSame(['498', '637951', '637961'], array_map('strval', array_keys($predmety)));
        // Zůstaly editované záznamy (se Zachovalost), ne předvyplněné
        $this->assertSame('1', $predmety['498']['Zachovalost']);
    }

    public function testDeduplikaceZachovaPouzePredvyplnene(): void
    {
        // Předmět jen předvyplněný (číselný klíč), nikdy needitovaný → nesmí se ztratit
        $dataB = [
            'Stavy_Tim' => [
                'BN098' => [
                    'Predmety' => [
                        '0' => ['ID_PREDMETY' => '498', 'Zachovalost' => null],
                    ],
                ],
            ],
        ];

        $result = $this->fixer->fix([], $dataB, [], null);
        $predmety = $result['data_b']['Stavy_Tim']['BN098']['Predmety'];

        $this->assertSame(['498'], array_map('strval', array_keys($predmety)));
    }

    public function testPredmetyIdempotentni(): void
    {
        $dataB = [
            'Stavy_Tim' => [
                'BN098' => [
                    'Predmety' => [
                        '498' => ['ID_PREDMETY' => '498', 'Zachovalost' => '1'],
                        '637951' => ['ID_PREDMETY' => '637951', 'Zachovalost' => '1'],
                    ],
                ],
            ],
        ];

        $result = $this->fixer->fix([], $dataB, [], null);

        $this->assertFalse($result['changed'], 'Už čistá data se nemají měnit');
    }

    public function testDoplneniDataNoclehu(): void
    {
        $dataA = [
            'Noclezne' => [
                ['id' => 'n1', 'Datum' => '2026-06-20T00:00:00', 'Misto' => 'Praha'],
            ],
        ];
        $calculation = [
            '1234' => [
                'INT_ADR' => 1234,
                'Noclezne' => [
                    ['id' => 'n1', 'Misto' => 'Praha', 'Zarizeni' => 'Hotel', 'Kc' => 500],
                ],
            ],
        ];

        $result = $this->fixer->fix($dataA, [], $calculation, null);
        $nocleh = $result['calculation']['1234']['Noclezne'][0];

        $this->assertTrue($result['changed']);
        $this->assertSame('2026-06-20', $nocleh['Datum']);
        // Datum hned za id
        $this->assertSame(['id', 'Datum', 'Misto', 'Zarizeni', 'Kc'], array_keys($nocleh));
    }

    public function testNoclehSDatemSeNemeni(): void
    {
        $dataA = ['Noclezne' => [['id' => 'n1', 'Datum' => '2026-06-20']]];
        $calculation = ['1234' => ['Noclezne' => [['id' => 'n1', 'Datum' => '2026-06-20', 'Kc' => 500]]]];

        $result = $this->fixer->fix($dataA, [], $calculation, null);

        $this->assertFalse($result['changed']);
    }

    public function testPreklicovaniUseku(): void
    {
        $dataB = ['Obnovene_Useky' => ['121097' => ['Usek_Obnoven' => true, 'Usek_Delka' => 3.9]]];

        $result = $this->fixer->fix([], $dataB, [], $this->useky());
        $obnovene = $result['data_b']['Obnovene_Useky'];

        $this->assertTrue($result['changed']);
        $this->assertArrayHasKey('79029', $obnovene);
        $this->assertArrayNotHasKey('121097', $obnovene);
    }

    public function testUsekIdempotentni(): void
    {
        // Už překlíčované na ID úseku a už jako kód číselníku → žádná změna
        $dataB = ['Obnovene_Useky' => ['79029' => ['Usek_Obnoven' => 3]]];

        $result = $this->fixer->fix([], $dataB, [], $this->useky());

        $this->assertFalse($result['changed']);
        $this->assertArrayHasKey('79029', $result['data_b']['Obnovene_Useky']);
    }

    public function testMigraceUsekObnovenNaCiselnik(): void
    {
        // Report s už správným ID úseku, ale starým boolean Usek_Obnoven → migrace na kód.
        $dataB = ['Obnovene_Useky' => [
            '79029' => ['Usek_Obnoven' => true],
            '88888' => ['Usek_Obnoven' => false],
        ]];
        $useky = [
            ['EvCi_Tra' => '121097', 'ID_Trasy_ZU' => '79029', 'ID_TRASY_Odbocky' => null],
            ['EvCi_Tra' => '121098', 'ID_Trasy_ZU' => '88888', 'ID_TRASY_Odbocky' => null],
        ];

        $result = $this->fixer->fix([], $dataB, [], $useky);
        $obnovene = $result['data_b']['Obnovene_Useky'];

        $this->assertTrue($result['changed'], 'Migrace boolean→kód je změna');
        $this->assertSame(3, $obnovene['79029']['Usek_Obnoven']);
        $this->assertSame(2, $obnovene['88888']['Usek_Obnoven']);
    }

    public function testNejednoznacnaOdbockaSeRozgne(): void
    {
        // Dva úseky sdílí stejné EvCi_Tra (hlavní úsek 79029 + odbočka 88888).
        // Staré FE je slilo do jednoho záznamu; při plné obnově platí pro oba →
        // rozgnout na obě reálná ID, Usek_Delka z INSYZ (Delka_ZU).
        $useky = [
            ['EvCi_Tra' => '121097', 'ID_Trasy_ZU' => '79029', 'ID_TRASY_Odbocky' => null, 'Delka_ZU' => '.000'],
            ['EvCi_Tra' => '121097', 'ID_Trasy_ZU' => '79029', 'ID_TRASY_Odbocky' => '88888', 'Delka_ZU' => '2.5'],
        ];
        $dataB = ['Obnovene_Useky' => ['121097' => ['Usek_Obnoven' => true, 'Usek_Delka' => 4]]];

        $result = $this->fixer->fix([], $dataB, [], $useky);
        $obnovene = $result['data_b']['Obnovene_Useky'];

        $this->assertTrue($result['changed']);
        $this->assertArrayNotHasKey('121097', $obnovene, 'EvCi_Tra klíč se rozgne');
        $this->assertArrayHasKey('79029', $obnovene);
        $this->assertArrayHasKey('88888', $obnovene);
        // Usek_Obnoven jako kód číselníku: legacy true → 3 (Provedena)
        $this->assertSame(3, $obnovene['79029']['Usek_Obnoven']);
        $this->assertSame(3, $obnovene['88888']['Usek_Obnoven']);
        // Usek_Delka z INSYZ, ne z původního záznamu
        $this->assertSame(0.0, $obnovene['79029']['Usek_Delka']);
        $this->assertSame(2.5, $obnovene['88888']['Usek_Delka']);
    }

    public function testExpanzeZachovaExtraPole(): void
    {
        // Starší formát se navíc nese Usek_Obnoven_Km – expanze ho nesmí zahodit.
        $useky = [
            ['EvCi_Tra' => '121097', 'ID_Trasy_ZU' => '79029', 'ID_TRASY_Odbocky' => null, 'Delka_ZU' => '3.5'],
            ['EvCi_Tra' => '121097', 'ID_Trasy_ZU' => '79029', 'ID_TRASY_Odbocky' => '88888', 'Delka_ZU' => '.000'],
        ];
        $dataB = ['Obnovene_Useky' => ['121097' => ['Usek_Obnoven' => true, 'Usek_Obnoven_Km' => 5]]];

        $result = $this->fixer->fix([], $dataB, [], $useky);
        $obnovene = $result['data_b']['Obnovene_Useky'];

        $this->assertSame(5, $obnovene['79029']['Usek_Obnoven_Km']);
        $this->assertSame(3.5, $obnovene['79029']['Usek_Delka']);
        $this->assertSame(3, $obnovene['88888']['Usek_Obnoven']);
    }

    public function testExpanzeDoplniTypUseku(): void
    {
        $useky = [
            ['EvCi_Tra' => '130002', 'ID_Trasy_ZU' => '94488', 'ID_TRASY_Odbocky' => null, 'Delka_ZU' => '4.350', 'Typ_Useku' => 'Úsek'],
            ['EvCi_Tra' => '130002', 'ID_Trasy_ZU' => '94488', 'ID_TRASY_Odbocky' => '14899', 'Delka_ZU' => '.360', 'Typ_Useku' => 'Odbočka'],
        ];
        $dataB = ['Obnovene_Useky' => ['130002' => ['Usek_Obnoven' => true]]];

        $result = $this->fixer->fix([], $dataB, [], $useky);
        $obnovene = $result['data_b']['Obnovene_Useky'];

        $this->assertSame('Úsek', $obnovene['94488']['Typ_Useku']);
        $this->assertSame('Odbočka', $obnovene['14899']['Typ_Useku']);
    }

    public function testDoplneniTypUsekuUNeexpandovaneho(): void
    {
        // Úsek je už správné ID (neexpanduje se), ale chybí mu Typ_Useku → fixer ho
        // doplní z INSYZ, aby se do XML dostal příznak typ i u neexpandovaných úseků.
        $useky = [
            ['EvCi_Tra' => '130002', 'ID_Trasy_ZU' => '109338', 'ID_TRASY_Odbocky' => null, 'Delka_ZU' => '6.139', 'Typ_Useku' => 'Úsek'],
        ];
        $dataB = ['Obnovene_Useky' => ['109338' => ['Usek_Obnoven' => 3, 'Usek_Delka' => 6.139]]];

        $result = $this->fixer->fix([], $dataB, [], $useky);
        $obnovene = $result['data_b']['Obnovene_Useky'];

        $this->assertTrue($result['changed'], 'Doplnění Typ_Useku je změna');
        $this->assertSame('Úsek', $obnovene['109338']['Typ_Useku']);
        $this->assertSame(3, $obnovene['109338']['Usek_Obnoven']);
    }

    public function testNeplatnyNAUsekSeIgnoruje(): void
    {
        // Chybný úsek z INSYZ (Nedostupná odbočka): všechna ID null, EvCi_Tra „N/A".
        // Nesmí ovlivnit mapu ani skončit v datech.
        $useky = [
            ['EvCi_Tra' => '110002', 'ID_Trasy_ZU' => '42274', 'ID_TRASY_Odbocky' => null, 'Delka_ZU' => '.000'],
            ['EvCi_Tra' => 'N/A', 'ID_Trasy_ZU' => null, 'ID_TRASY_Odbocky' => null, 'Nazev_ZU' => 'Nedostupná odbočka'],
        ];
        $dataB = ['Obnovene_Useky' => ['110002' => ['Usek_Obnoven' => true]]];

        $result = $this->fixer->fix([], $dataB, [], $useky);
        $obnovene = $result['data_b']['Obnovene_Useky'];

        $this->assertArrayHasKey('42274', $obnovene, 'Platný úsek se překlíčuje na reálné ID');
        $this->assertArrayNotHasKey('N/A', $obnovene);
        $this->assertArrayNotHasKey('110002', $obnovene);
    }

    public function testUsekyNedostupneZachovaData(): void
    {
        $dataB = ['Obnovene_Useky' => ['121097' => ['Usek_Obnoven' => 1]]];

        $result = $this->fixer->fix([], $dataB, [], null);

        $this->assertFalse($result['changed']);
        $this->assertArrayHasKey('121097', $result['data_b']['Obnovene_Useky']);
        $this->assertNotEmpty($result['warnings']);
    }
}
