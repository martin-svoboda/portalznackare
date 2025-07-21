<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

class PartADto
{
    #[Assert\NotBlank]
    #[Assert\DateTime]
    public string $executionDate;

    #[Assert\Valid]
    #[Assert\Count(min: 1)]
    /**
     * @var TravelSegmentDto[]
     */
    public array $travelSegments = [];

    #[Assert\Length(max: 255)]
    public string $primaryDriver = '';

    #[Assert\Length(max: 20)]
    public string $vehicleRegistration = '';

    #[Assert\Type('boolean')]
    public bool $higherKmRate = false;

    #[Assert\Valid]
    /**
     * @var AccommodationDto[]
     */
    public array $accommodations = [];

    #[Assert\Valid]
    /**
     * @var AdditionalExpenseDto[]
     */
    public array $additionalExpenses = [];

    #[Assert\Type('boolean')]
    public bool $partACompleted = false;

    #[Assert\Type('array')]
    public array $paymentRedirects = [];
}