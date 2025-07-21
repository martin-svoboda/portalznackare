<?php

namespace App\Service;

use Twig\Environment;

/**
 * Služba pro renderování značek
 * Vrací hotový HTML/SVG string pro vložení do dat
 */
class ZnackaService
{
    public function __construct(
        private Environment $twig,
        private ColorService $colorService
    ) {}

    /**
     * Vygeneruje SVG značky podle parametrů
     */
    public function renderZnacka(
        string $barvaKod, 
        string $typ = 'pasova', 
        int $size = 24
    ): string {
        $barva = $this->colorService->barvaDleKodu($barvaKod);
        $nazevBarvy = $this->colorService->nazevBarvy($barvaKod);
        
        switch(strtolower($typ)) {
            case 'pasova':
                return $this->renderPasovaZnacka($barva, $nazevBarvy, $size);
                
            case 'sipka':
            case 'sip':
                return $this->renderSipkovaZnacka($barva, $nazevBarvy, $size);
                
            case 'koncova':
            case 'kon':
                return $this->renderKoncovaZnacka($barva, $nazevBarvy, $size);
                
            case 'smerovka':
            case 'smer':
                return $this->renderSmerovka($barva, $nazevBarvy, $size);
                
            default:
                return $this->renderPasovaZnacka($barva, $nazevBarvy, $size);
        }
    }

    /**
     * Pásová značka - obdélník
     */
    private function renderPasovaZnacka(string $barva, string $nazev, int $size): string
    {
        $width = $size * 2; // pásové značky jsou 2:1
        
        return sprintf(
            '<svg width="%d" height="%d" viewBox="0 0 %d %d" class="inline-block" aria-label="%s pásová značka">
                <rect width="%d" height="%d" fill="%s" stroke="#000" stroke-width="0.5" rx="1"/>
            </svg>',
            $width, $size, $width, $size, $nazev, $width, $size, $barva
        );
    }

    /**
     * Šipková značka
     */
    private function renderSipkovaZnacka(string $barva, string $nazev, int $size): string
    {
        return sprintf(
            '<svg width="%d" height="%d" viewBox="0 0 24 24" class="inline-block" aria-label="%s šipková značka">
                <path d="M5 12l5 5V7z" fill="%s" stroke="#000" stroke-width="0.5"/>
            </svg>',
            $size, $size, $nazev, $barva
        );
    }

    /**
     * Koncová značka - obdélník s kolečkem
     */
    private function renderKoncovaZnacka(string $barva, string $nazev, int $size): string
    {
        $width = $size * 2;
        $circleR = $size / 6;
        $circleX = $width / 2;
        $circleY = $size / 2;
        
        return sprintf(
            '<svg width="%d" height="%d" viewBox="0 0 %d %d" class="inline-block" aria-label="%s koncová značka">
                <rect width="%d" height="%d" fill="%s" stroke="#000" stroke-width="0.5" rx="1"/>
                <circle cx="%d" cy="%d" r="%d" fill="white" stroke="#000" stroke-width="0.5"/>
            </svg>',
            $width, $size, $width, $size, $nazev, $width, $size, $barva, $circleX, $circleY, $circleR
        );
    }

    /**
     * Směrovka - obdélník s "S"
     */
    private function renderSmerovka(string $barva, string $nazev, int $size): string
    {
        $width = $size * 2;
        $fontSize = $size * 0.6;
        $textX = $width / 2;
        $textY = $size / 2 + $fontSize / 3;
        
        return sprintf(
            '<svg width="%d" height="%d" viewBox="0 0 %d %d" class="inline-block" aria-label="%s směrovka">
                <rect width="%d" height="%d" fill="white" stroke="%s" stroke-width="2" rx="1"/>
                <text x="%d" y="%d" font-family="Arial, sans-serif" font-size="%d" font-weight="bold" text-anchor="middle" fill="%s">S</text>
            </svg>',
            $width, $size, $width, $size, $nazev, $width, $size, $barva, $textX, $textY, $fontSize, $barva
        );
    }

    /**
     * Vygeneruje HTML span s CSS třídami (alternativa k SVG)
     */
    public function renderZnackaCSS(
        string $barvaKod,
        string $typ = 'pasova', 
        string $size = 'md'
    ): string {
        $tailwindClass = $this->colorService->tailwindClassDleKodu($barvaKod);
        $nazevBarvy = $this->colorService->nazevBarvy($barvaKod);
        
        $sizeClasses = [
            'sm' => 'w-6 h-3',
            'md' => 'w-8 h-4',
            'lg' => 'w-12 h-6'
        ];
        
        $sizeClass = $sizeClasses[$size] ?? $sizeClasses['md'];
        
        switch(strtolower($typ)) {
            case 'pasova':
                return sprintf(
                    '<span class="inline-block %s %s rounded-sm border border-gray-400" aria-label="%s pásová značka"></span>',
                    $sizeClass, $tailwindClass, $nazevBarvy
                );
                
            case 'koncova':
                return sprintf(
                    '<span class="inline-flex items-center justify-center %s %s rounded-sm border border-gray-400 relative" aria-label="%s koncová značka">
                        <span class="bg-white w-1/3 h-1/3 rounded-full border border-gray-400"></span>
                    </span>',
                    $sizeClass, $tailwindClass, $nazevBarvy
                );
                
            default:
                return $this->renderZnacka($barvaKod, $typ, 24); // fallback na SVG
        }
    }

    /**
     * Zkratka pro rychlé použití v Twig
     */
    public function znacka(string $barvaKod, string $typ = 'pasova', int $size = 24): string
    {
        return $this->renderZnacka($barvaKod, $typ, $size);
    }
}