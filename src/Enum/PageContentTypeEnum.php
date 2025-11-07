<?php

namespace App\Enum;

enum PageContentTypeEnum: string
{
    case PAGE = 'page';
    case METODIKA = 'metodika';
    case NAPOVEDA = 'napoveda';

    public function getLabel(): string
    {
        return match($this) {
            self::PAGE => 'Stránka',
            self::METODIKA => 'Metodika',
            self::NAPOVEDA => 'Nápověda',
        };
    }

    public function getIcon(): string
    {
        return match($this) {
            self::PAGE => 'file-text',
            self::METODIKA => 'book',
            self::NAPOVEDA => 'help-circle',
        };
    }

    /**
     * Get URL prefix for this content type
     * Returns null for PAGE (no prefix), or slug prefix for others
     */
    public function getUrlPrefix(): ?string
    {
        return match($this) {
            self::PAGE => null,
            self::METODIKA => 'metodika',
            self::NAPOVEDA => 'napoveda',
        };
    }

    /**
     * Get all available content types with their metadata
     */
    public static function getAllOptions(): array
    {
        return array_map(fn(self $type) => [
            'value' => $type->value,
            'label' => $type->getLabel(),
            'icon' => $type->getIcon(),
            'url_prefix' => $type->getUrlPrefix(),
        ], self::cases());
    }

    /**
     * Find content type by URL prefix
     */
    public static function fromUrlPrefix(string $prefix): ?self
    {
        foreach (self::cases() as $type) {
            if ($type->getUrlPrefix() === $prefix) {
                return $type;
            }
        }
        return null;
    }
}
