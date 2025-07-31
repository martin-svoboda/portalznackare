<?php

namespace App\Dto;

use App\Enum\ReportStateEnum;
use Symfony\Component\Validator\Constraints as Assert;

class ReportDto
{
    #[Assert\NotBlank]
    #[Assert\Positive]
    public int $id_zp;

    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    public string $cislo_zp = '';

    #[Assert\Type('array')]
    public array $team_members = [];

    #[Assert\Valid]
    public ?PartADto $data_a = null;

    #[Assert\Valid]  
    public ?PartBDto $data_b = null;

    #[Assert\Valid]
    public ?CalculationDto $calculation = null;

    #[Assert\Choice(callback: [ReportStateEnum::class, 'cases'])]
    public string $state = 'draft';
}