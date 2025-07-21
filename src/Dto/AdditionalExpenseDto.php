<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

class AdditionalExpenseDto
{
    #[Assert\NotBlank]
    #[Assert\Uuid]
    public string $id;

    #[Assert\NotBlank]
    #[Assert\DateTime]
    public string $date;

    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    public string $description;

    #[Assert\NotBlank]
    #[Assert\Positive]
    public float $amount;

    #[Assert\Type('array')]
    public array $attachments = [];

    #[Assert\Length(max: 255)]
    public string $paidByMember = '';
}