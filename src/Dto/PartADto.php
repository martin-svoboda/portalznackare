<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

class PartADto
{
    #[Assert\NotBlank]
    #[Assert\DateTime]
    public string $Datum_Provedeni;

    #[Assert\Valid]
    #[Assert\Count(min: 1)]
    /**
     * @var TravelSegmentDto[]
     */
    public array $Skupiny_Cest = [];

    #[Assert\Length(max: 255)]
    public string $Hlavni_Ridic = '';

    #[Assert\Length(max: 20)]
    public string $SPZ = '';


    #[Assert\Valid]
    /**
     * @var AccommodationDto[]
     */
    public array $Noclezne = [];

    #[Assert\Valid]
    /**
     * @var AdditionalExpenseDto[]
     */
    public array $Vedlejsi_Vydaje = [];

    #[Assert\Type('boolean')]
    public bool $Cast_A_Dokoncena = false;

    #[Assert\Type('array')]
    public array $Presmerovani_Vyplat = [];
}