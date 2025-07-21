<?php

namespace App\Service;

/**
 * Služba pro renderování TIM arrows a náhledů
 * Vrací hotový HTML/SVG string
 */
class TimService
{
    /**
     * Vygeneruje SVG šipky pro TIM
     */
    public function renderTimArrow(
        string $cislo, 
        string $smer = 'straight', 
        int $size = 32
    ): string {
        $paths = [
            'left' => 'M2,12 L8,6 L8,9 L22,9 L22,15 L8,15 L8,18 Z',
            'right' => 'M22,12 L16,6 L16,9 L2,9 L2,15 L16,15 L16,18 Z', 
            'straight' => 'M12,2 L6,8 L9,8 L9,22 L15,22 L15,8 L18,8 Z',
            'back' => 'M12,22 L18,16 L15,16 L15,2 L9,2 L9,16 L6,16 Z'
        ];
        
        $path = $paths[strtolower($smer)] ?? $paths['straight'];
        $fontSize = $size * 0.4;
        
        return sprintf(
            '<svg width="%d" height="%d" viewBox="0 0 24 24" class="inline-block" aria-label="Tím %s směr %s">
                <!-- Žlutá výplň -->
                <path d="%s" fill="#ffdd00" stroke="#000" stroke-width="0.8"/>
                <!-- Číslo -->
                <text x="12" y="14" font-family="Arial, sans-serif" font-size="%d" font-weight="bold" text-anchor="middle" fill="black">%s</text>
            </svg>',
            $size, $size, $cislo, $smer, $path, $fontSize, $cislo
        );
    }

    /**
     * Vygeneruje náhled více TIM šipek
     */
    public function renderTimPreview(array $timy, int $size = 24): string
    {
        if (empty($timy)) {
            return '';
        }
        
        $html = '<span class="inline-flex items-center gap-1" aria-label="Náhled týmů">';
        
        foreach ($timy as $tim) {
            $cislo = $tim['cislo'] ?? $tim['number'] ?? '?';
            $smer = $tim['smer'] ?? $tim['direction'] ?? 'straight';
            
            $html .= $this->renderTimArrow($cislo, $smer, $size);
        }
        
        $html .= '</span>';
        
        return $html;
    }

    /**
     * Parsuje směr z různých formátů
     */
    public function parseSmer(string $smer): string
    {
        $smer = strtolower(trim($smer));
        
        return match($smer) {
            'l', 'left', 'vlevo', 'doleva' => 'left',
            'r', 'right', 'vpravo', 'doprava' => 'right', 
            's', 'straight', 'rovne', 'přímo' => 'straight',
            'b', 'back', 'zpet', 'zpět' => 'back',
            default => 'straight'
        };
    }

    /**
     * Převede data týmů z různých formátů na standardní
     */
    public function normalizeTimyData(array $data): array
    {
        $timy = [];
        
        foreach ($data as $item) {
            // Různé možné formáty dat
            if (is_string($item)) {
                // Formát "1L" nebo "2R" 
                preg_match('/(\d+)([LRSB]?)/', $item, $matches);
                $cislo = $matches[1] ?? '?';
                $smerKod = strtolower($matches[2] ?? 'S');
                
                $smer = match($smerKod) {
                    'l' => 'left',
                    'r' => 'right',
                    's' => 'straight', 
                    'b' => 'back',
                    default => 'straight'
                };
                
                $timy[] = ['cislo' => $cislo, 'smer' => $smer];
            } elseif (is_array($item)) {
                $timy[] = [
                    'cislo' => $item['cislo'] ?? $item['number'] ?? '?',
                    'smer' => $this->parseSmer($item['smer'] ?? $item['direction'] ?? 'straight')
                ];
            }
        }
        
        return $timy;
    }

    /**
     * Zkratka pro rychlé použití v Twig
     */
    public function timArrow(string $cislo, string $smer = 'straight', int $size = 32): string
    {
        return $this->renderTimArrow($cislo, $smer, $size);
    }

    /**
     * Zkratka pro náhled týmů
     */
    public function timPreview(array $timy, int $size = 24): string
    {
        $normalizedTimy = $this->normalizeTimyData($timy);
        return $this->renderTimPreview($normalizedTimy, $size);
    }
}