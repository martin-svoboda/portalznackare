<?php

namespace App\Service;

/**
 * Služba pro obohacování dat o HTML komponenty
 * Používá se v API controllerech
 */
class DataEnricherService
{
    public function __construct(
        private ZnackaService $znackaService,
        private TimService $timService,
        private ColorService $colorService
    ) {}

    /**
     * Obohatí data příkazu o HTML komponenty
     */
    public function enrichPrikazData(array $prikaz): array
    {
        // Přidej HTML značky
        if (isset($prikaz['Barva_Kod'])) {
            $prikaz['znacka_html'] = $this->znackaService->znacka($prikaz['Barva_Kod'], 'pasova', 24);
            $prikaz['znacka_css'] = $this->znackaService->renderZnackaCSS($prikaz['Barva_Kod'], 'pasova', 'md');
            $prikaz['barva_hex'] = $this->colorService->barvaDleKodu($prikaz['Barva_Kod']);
            $prikaz['barva_nazev'] = $this->colorService->nazevBarvy($prikaz['Barva_Kod']);
        }

        // Obohatí popis o ikony
        if (isset($prikaz['Popis_ZP'])) {
            $prikaz['popis_html'] = $this->replaceIconsInText($prikaz['Popis_ZP']);
        }

        return $prikaz;
    }

    /**
     * Obohatí data seznamu příkazů
     */
    public function enrichPrikazyList(array $prikazy): array
    {
        return array_map([$this, 'enrichPrikazData'], $prikazy);
    }

    /**
     * Obohatí detail příkazu s předměty
     */
    public function enrichPrikazDetail(array $detail): array
    {
        // Obohatí hlavičku
        if (isset($detail['head'])) {
            $detail['head'] = $this->enrichPrikazData($detail['head']);
        }

        // Obohatí předměty
        if (isset($detail['predmety'])) {
            $detail['predmety'] = array_map(function($predmet) {
                // Značka podle barvy
                if (isset($predmet['Barva_Kod'])) {
                    $predmet['znacka_html'] = $this->znackaService->znacka(
                        $predmet['Barva_Kod'], 
                        $this->mapDruhZnaceni($predmet['Druh_Znaceni_Kod'] ?? ''), 
                        20
                    );
                }

                // TIM arrows pokud existují
                if (isset($predmet['TIM_Data'])) {
                    $predmet['tim_html'] = $this->timService->timPreview($predmet['TIM_Data'], 20);
                }

                return $predmet;
            }, $detail['predmety']);
        }

        return $detail;
    }

    /**
     * Nahradí zkratky v textu za ikony
     */
    private function replaceIconsInText(string $text): string
    {
        $patterns = [
            '/\{ce\}/' => $this->znackaService->znacka('CE', 'pasova', 16),
            '/\{mo\}/' => $this->znackaService->znacka('MO', 'pasova', 16),
            '/\{ze\}/' => $this->znackaService->znacka('ZE', 'pasova', 16),
            '/\{zl\}/' => $this->znackaService->znacka('ZL', 'pasova', 16),
            '/\{pas\}/' => '<span class="text-gray-600 text-sm">[pás]</span>',
            '/\{sip\}/' => '<span class="text-gray-600 text-sm">[→]</span>',
            '/\{kon\}/' => '<span class="text-gray-600 text-sm">[●]</span>',
        ];
        
        return preg_replace(array_keys($patterns), array_values($patterns), $text);
    }

    /**
     * Mapuje druh značení na typ značky
     */
    private function mapDruhZnaceni(?string $kod): string
    {
        return match(strtoupper($kod ?? '')) {
            'PA' => 'pasova',
            'SI' => 'sipka', 
            'KO' => 'koncova',
            'SM' => 'smerovka',
            default => 'pasova'
        };
    }
}