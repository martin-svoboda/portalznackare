<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

class PartBDto
{
    #[Assert\Type('array')]
    public array $timReports = [];

    #[Assert\Length(max: 5000)]
    public string $routeComment = '';

    #[Assert\Type('array')]
    public array $routeAttachments = [];

    #[Assert\Type('boolean')]
    public bool $partBCompleted = false;
}