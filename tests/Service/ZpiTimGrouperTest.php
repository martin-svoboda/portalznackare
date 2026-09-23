<?php

namespace App\Tests\Service;

use App\Service\ZpiTimGrouper;
use PHPUnit\Framework\TestCase;

class ZpiTimGrouperTest extends TestCase
{
    private ZpiTimGrouper $grouper;

    protected function setUp(): void
    {
        $this->grouper = new ZpiTimGrouper();
    }

    private function predmet(string $tim, string $index, string $cinnost): array
    {
        return [
            'EvCi_TIM' => $tim,
            'Naz_TIM' => 'TIM '.$tim,
            'Predmet_Index' => $index,
            'ID_PREDMETY' => $tim.$index,
            'Cinnost' => $cinnost,
        ];
    }

    public function testSeskupiPredmetyPodleTimu(): void
    {
        $timy = $this->grouper->seskup([
            $this->predmet('BN071', 'a', 'instalace'),
            $this->predmet('BN393', 'a', 'instalace'),
            $this->predmet('BN071', 'm', 'odinstalace'),
        ], []);

        $this->assertCount(2, $timy);
        $this->assertSame('BN071', $timy[0]['EvCi_TIM']);
        $this->assertCount(2, $timy[0]['items']);
        $this->assertCount(1, $timy[1]['items']);
    }

    public function testPoradiCinnostiServisOdinstalaceInstalace(): void
    {
        $timy = $this->grouper->seskup([
            $this->predmet('BN010', 'a', 'instalace'),
            $this->predmet('BN010', 'b', 'odinstalace'),
        ], [
            ['EvCi_TIM' => 'BN010', 'Naz_TIM' => 'TIM BN010', 'TIM_Text' => 'Spravit lištu'],
        ]);

        $this->assertSame(
            ['servis', 'odinstalace', 'instalace'],
            array_column($timy[0]['items'], 'Cinnost')
        );
    }

    public function testServisniTimBezPredmetuJeSamostatnyTim(): void
    {
        $timy = $this->grouper->seskup(
            [$this->predmet('BN071', 'a', 'instalace')],
            [['EvCi_TIM' => 'BN900', 'Naz_TIM' => 'Servisní TIM', 'TIM_Text' => 'Pověsit spadlé tabulky']]
        );

        $this->assertCount(2, $timy);
        $this->assertSame('BN900', $timy[1]['EvCi_TIM']);
        $this->assertSame('servis', $timy[1]['items'][0]['Cinnost']);
        $this->assertSame('Pověsit spadlé tabulky', $timy[1]['items'][0]['TIM_Text']);
    }

    public function testPredmetBezEvidencnihoCislaSeIgnoruje(): void
    {
        $timy = $this->grouper->seskup([['Predmet_Index' => 'a', 'Cinnost' => 'instalace']], []);

        $this->assertSame([], $timy);
    }

    public function testChybejiciCinnostSeDopociteZCoProvest(): void
    {
        $timy = $this->grouper->seskup([
            ['EvCi_TIM' => 'BN071', 'Predmet_Index' => 'a', 'Co_Provest' => 'Zrušit'],
            ['EvCi_TIM' => 'BN071', 'Predmet_Index' => 'b', 'Co_Provest' => 'Instalovat'],
        ], []);

        $this->assertSame(['odinstalace', 'instalace'], array_column($timy[0]['items'], 'Cinnost'));
    }
}
