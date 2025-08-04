<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

class PartBDto
{
    #[Assert\Type('array')]
    public array $Stavy_Tim = [];

    #[Assert\Length(max: 5000)]
    public string $Trasa_Poznamka = '';

    #[Assert\Type('array')]
    public array $Trasa_Prilohy = [];

    #[Assert\Type('boolean')]
    public bool $Cast_B_Dokoncena = false;
}