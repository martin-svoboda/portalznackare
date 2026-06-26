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
        $dataB = ['Obnovene_Useky' => ['121097' => ['Usek_Obnoven' => 1, 'Usek_Delka' => 3.9]]];

        $result = $this->fixer->fix([], $dataB, [], $this->useky());
        $obnovene = $result['data_b']['Obnovene_Useky'];

        $this->assertTrue($result['changed']);
        $this->assertArrayHasKey('79029', $obnovene);
        $this->assertArrayNotHasKey('121097', $obnovene);
    }

    public function testUsekIdempotentni(): void
    {
        // Už překlíčované na ID úseku
        $dataB = ['Obnovene_Useky' => ['79029' => ['Usek_Obnoven' => 1]]];

        $result = $this->fixer->fix([], $dataB, [], $this->useky());

        $this->assertFalse($result['changed']);
        $this->assertArrayHasKey('79029', $result['data_b']['Obnovene_Useky']);
    }

    public function testNejednoznacnaOdbockaSeVynecha(): void
    {
        // Dva úseky sdílí stejné EvCi_Tra (hlavní úsek + odbočka)
        $useky = [
            ['EvCi_Tra' => '121097', 'ID_Trasy_ZU' => '79029', 'ID_TRASY_Odbocky' => null],
            ['EvCi_Tra' => '121097', 'ID_Trasy_ZU' => '79029', 'ID_TRASY_Odbocky' => '88888'],
        ];
        $dataB = ['Obnovene_Useky' => ['121097' => ['Usek_Obnoven' => 1]]];

        $result = $this->fixer->fix([], $dataB, [], $useky);

        $this->assertFalse($result['changed'], 'Nejednoznačné EvCi_Tra se nepřeklíčuje');
        $this->assertArrayHasKey('121097', $result['data_b']['Obnovene_Useky']);
        $this->assertNotEmpty($result['warnings']);
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
