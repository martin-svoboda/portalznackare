<?php

namespace App\Twig;

use App\Service\ZnackaService;
use App\Service\TimService;
use App\Service\ColorService;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;
use Twig\TwigFilter;

/**
 * Twig extension pro KČT komponenty
 */
class KctExtension extends AbstractExtension
{
    public function __construct(
        private ZnackaService $znackaService,
        private TimService $timService,
        private ColorService $colorService
    ) {}

    public function getFunctions(): array
    {
        return [
            // Značky
            new TwigFunction('kct_znacka', [$this->znackaService, 'znacka'], ['is_safe' => ['html']]),
            new TwigFunction('kct_znacka_css', [$this->znackaService, 'renderZnackaCSS'], ['is_safe' => ['html']]),
            
            // TIM arrows
            new TwigFunction('kct_tim_arrow', [$this->timService, 'timArrow'], ['is_safe' => ['html']]),
            new TwigFunction('kct_tim_preview', [$this->timService, 'timPreview'], ['is_safe' => ['html']]),
            
            // Barvy
            new TwigFunction('kct_barva_kod', [$this->colorService, 'barvaDleKodu']),
            new TwigFunction('kct_barva_presun', [$this->colorService, 'barvaDlePresunu']),
            new TwigFunction('kct_tailwind_barva', [$this->colorService, 'tailwindClassDleKodu']),
        ];
    }

    public function getFilters(): array
    {
        return [
            // Filtry pro zpracování dat
            new TwigFilter('kct_barva', [$this->colorService, 'barvaDleKodu']),
            new TwigFilter('kct_barva_nazev', [$this->colorService, 'nazevBarvy']),
            new TwigFilter('kct_znacka', [$this->znackaService, 'znacka'], ['is_safe' => ['html']]),
            new TwigFilter('kct_tim_arrow', [$this->timService, 'timArrow'], ['is_safe' => ['html']]),
            
            // Filtr pro nahrazení zkratek ikonami v textu
            new TwigFilter('kct_replace_icons', [$this, 'replaceIconsInText'], ['is_safe' => ['html']]),
        ];
    }

    /**
     * Nahradí zkratky v textu za ikony
     */
    public function replaceIconsInText(string $text): string
    {
        // Nahradí {ce}, {mo}, {ze}, {zl} za skutečné značky
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
}