<?php

namespace App\Enum;

enum PageStatusEnum: string
{
    case DRAFT = 'draft';
    case PUBLISHED = 'published';
    case ARCHIVED = 'archived';
    case DELETED = 'deleted';

    public function getLabel(): string
    {
        return match($this) {
            self::DRAFT => 'Koncept',
            self::PUBLISHED => 'Publikováno',
            self::ARCHIVED => 'Archivováno',
            self::DELETED => 'Smazáno',
        };
    }

    public function getColor(): string
    {
        return match($this) {
            self::DRAFT => 'gray',
            self::PUBLISHED => 'green',
            self::ARCHIVED => 'orange',
            self::DELETED => 'red',
        };
    }

    public function isVisible(): bool
    {
        return $this === self::PUBLISHED;
    }
}
