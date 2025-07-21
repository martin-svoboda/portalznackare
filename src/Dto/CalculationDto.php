<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

class CalculationDto
{
    #[Assert\PositiveOrZero]
    public float $transport = 0;

    #[Assert\PositiveOrZero]
    public float $meals = 0;

    #[Assert\PositiveOrZero]
    public float $work = 0;

    #[Assert\PositiveOrZero]
    public float $accommodation = 0;

    #[Assert\PositiveOrZero]
    public float $additional = 0;

    #[Assert\PositiveOrZero]
    public float $total = 0;

    #[Assert\PositiveOrZero]
    public float $workHours = 0;

    #[Assert\Type('array')]
    public ?array $appliedTariff = null;

    #[Assert\Type('array')]
    public array $paymentRedirects = [];
}