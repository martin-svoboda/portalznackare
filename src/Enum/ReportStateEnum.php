<?php

namespace App\Enum;

enum ReportStateEnum: string
{
    case DRAFT = 'draft';
    case SEND = 'send';
    case APPROVED = 'approved';
    case REJECTED = 'rejected';

    public function getLabel(): string
    {
        return match($this) {
            self::DRAFT => 'Rozpracováno',
            self::SEND => 'Odesláno',
            self::APPROVED => 'Schváleno',
            self::REJECTED => 'Zamítnuto',
        };
    }

    public function getColor(): string
    {
        return match($this) {
            self::DRAFT => 'gray',
            self::SEND => 'blue',
            self::APPROVED => 'green',
            self::REJECTED => 'red',
        };
    }
}