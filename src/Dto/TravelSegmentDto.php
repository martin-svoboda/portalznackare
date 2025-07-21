<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

class TravelSegmentDto
{
    #[Assert\NotBlank]
    #[Assert\Uuid]
    public string $id;

    #[Assert\NotBlank]
    #[Assert\DateTime]
    public string $date;

    #[Assert\Regex('/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/')]
    public string $startTime = '';

    #[Assert\Regex('/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/')]
    public string $endTime = '';

    #[Assert\Length(max: 255)]
    public string $startPlace = '';

    #[Assert\Length(max: 255)]
    public string $endPlace = '';

    #[Assert\Choice(['AUV', 'AUV-Z', 'veřejná doprava', 'pěšky', 'kolo'])]
    public string $transportType = 'AUV';

    #[Assert\PositiveOrZero]
    public float $kilometers = 0;

    #[Assert\PositiveOrZero]
    public float $ticketCosts = 0;

    #[Assert\Type('array')]
    public array $attachments = [];
}