<?php

namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class TablerIconExtension extends AbstractExtension
{
    public function getFunctions(): array
    {
        return [
            new TwigFunction('tabler_icon', [$this, 'renderIcon'], ['is_safe' => ['html']]),
        ];
    }

    /**
     * Render Tabler icon using SVG sprite
     * 
     * @param string $name Icon name (without .svg extension)
     * @param int $size Icon size (default: 24)
     * @param string $class Additional CSS classes
     * @param array $attributes Additional HTML attributes
     * @return string SVG markup
     */
    public function renderIcon(
        string $name, 
        int $size = 24, 
        string $class = '', 
        array $attributes = []
    ): string {
        // Build CSS classes
        $classes = ['icon', 'icon-tabler', "icon-tabler-{$name}"];
        if ($class) {
            $classes[] = $class;
        }
        
        // Build attributes
        $attrs = [
            'width' => $size,
            'height' => $size,
            'class' => implode(' ', $classes),
        ];
        
        // Merge additional attributes
        $attrs = array_merge($attrs, $attributes);
        
        // Build attribute string
        $attributeString = '';
        foreach ($attrs as $key => $value) {
            $attributeString .= ' ' . htmlspecialchars($key) . '="' . htmlspecialchars($value) . '"';
        }
        
        // Return SVG with sprite reference - use public path for direct access
        return sprintf(
            '<svg%s><use href="/images/tabler-sprite.svg#tabler-%s"></use></svg>',
            $attributeString,
            htmlspecialchars($name)
        );
    }
}