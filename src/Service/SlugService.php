<?php

namespace App\Service;

use App\Repository\PageRepository;

/**
 * Service for generating URL-friendly slugs from Czech text
 * Handles diacritics and ensures uniqueness
 */
class SlugService
{
    private const TRANSLITERATION_MAP = [
        // Czech diacritics
        'á' => 'a', 'Á' => 'A',
        'č' => 'c', 'Č' => 'C',
        'ď' => 'd', 'Ď' => 'D',
        'é' => 'e', 'É' => 'E',
        'ě' => 'e', 'Ě' => 'E',
        'í' => 'i', 'Í' => 'I',
        'ň' => 'n', 'Ň' => 'N',
        'ó' => 'o', 'Ó' => 'O',
        'ř' => 'r', 'Ř' => 'R',
        'š' => 's', 'Š' => 'S',
        'ť' => 't', 'Ť' => 'T',
        'ú' => 'u', 'Ú' => 'U',
        'ů' => 'u', 'Ů' => 'U',
        'ý' => 'y', 'Ý' => 'Y',
        'ž' => 'z', 'Ž' => 'Z',
        // Slovak specific
        'ľ' => 'l', 'Ľ' => 'L',
        'ŕ' => 'r', 'Ŕ' => 'R',
        // Other common
        'ô' => 'o', 'Ô' => 'O',
    ];

    public function __construct(
        private PageRepository $pageRepository
    ) {
    }

    /**
     * Generate slug from text
     * Removes Czech diacritics and creates URL-friendly string
     */
    public function generateSlug(string $text): string
    {
        // Convert to lowercase
        $slug = mb_strtolower($text, 'UTF-8');

        // Replace Czech diacritics
        $slug = strtr($slug, self::TRANSLITERATION_MAP);

        // Replace any non-alphanumeric character with dash
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);

        // Remove leading/trailing dashes
        $slug = trim($slug, '-');

        // Replace multiple consecutive dashes with single dash
        $slug = preg_replace('/-+/', '-', $slug);

        return $slug;
    }

    /**
     * Ensure slug is unique by appending number if necessary
     * @param string $slug Base slug
     * @param int|null $excludeId Page ID to exclude from uniqueness check (for updates)
     * @return string Unique slug
     */
    public function ensureUnique(string $slug, ?int $excludeId = null): string
    {
        $originalSlug = $slug;
        $counter = 1;

        while (!$this->pageRepository->isSlugUnique($slug, $excludeId)) {
            $slug = $originalSlug . '-' . $counter;
            $counter++;
        }

        return $slug;
    }

    /**
     * Generate and ensure unique slug from text
     * Convenience method combining generate and ensure unique
     */
    public function createUniqueSlug(string $text, ?int $excludeId = null): string
    {
        $slug = $this->generateSlug($text);
        return $this->ensureUnique($slug, $excludeId);
    }
}
