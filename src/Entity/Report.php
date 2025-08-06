<?php

namespace App\Entity;

use App\Enum\ReportStateEnum;
use App\Repository\ReportRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: ReportRepository::class)]
#[ORM\Table(name: 'reports')]
#[ORM\UniqueConstraint(name: 'unique_report_per_order', columns: ['id_zp'])]
#[ORM\HasLifecycleCallbacks]
class Report
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::BIGINT)]
    #[Groups(['report:read'])]
    private ?int $id = null;

    #[ORM\Column(name: 'id_zp', type: Types::INTEGER)]
    #[Groups(['report:read', 'report:write'])]
    private int $idZp;

    #[ORM\Column(name: 'cislo_zp', type: Types::STRING, length: 255)]
    #[Groups(['report:read', 'report:write'])]
    private string $cisloZp = '';

    #[ORM\Column(name: 'int_adr', type: Types::INTEGER)]
    #[Groups(['report:read', 'report:write'])]
    private int $intAdr;

    #[ORM\Column(name: 'znackari', type: Types::JSON)]
    #[Groups(['report:read', 'report:write'])]
    private array $teamMembers = []; // Maps to 'znackari' column

    #[ORM\Column(name: 'history', type: Types::JSON)]
    #[Groups(['report:read'])]
    private array $history = [];

    #[ORM\Column(name: 'data_a', type: Types::JSON)]
    #[Groups(['report:read', 'report:write'])]
    private array $dataA = [];

    #[ORM\Column(name: 'data_b', type: Types::JSON)]
    #[Groups(['report:read', 'report:write'])]
    private array $dataB = [];

    #[ORM\Column(name: 'calculation', type: Types::JSON)]
    #[Groups(['report:read', 'report:write'])]
    private array $calculation = [];

    #[ORM\Column(name: 'state', type: Types::STRING, length: 50, enumType: ReportStateEnum::class)]
    #[Groups(['report:read', 'report:write'])]
    private ReportStateEnum $state = ReportStateEnum::DRAFT;

    #[ORM\Column(name: 'date_send', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    #[Groups(['report:read'])]
    private ?\DateTimeImmutable $dateSend = null;

    #[ORM\Column(name: 'date_created', type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['report:read'])]
    private ?\DateTimeImmutable $dateCreated = null;

    #[ORM\Column(name: 'date_updated', type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['report:read'])]
    private ?\DateTimeImmutable $dateUpdated = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getIdZp(): int
    {
        return $this->idZp;
    }

    public function setIdZp(int $idZp): static
    {
        $this->idZp = $idZp;
        return $this;
    }

    public function getCisloZp(): string
    {
        return $this->cisloZp;
    }

    public function setCisloZp(string $cisloZp): static
    {
        $this->cisloZp = $cisloZp;
        return $this;
    }

    public function getIntAdr(): int
    {
        return $this->intAdr;
    }

    public function setIntAdr(int $intAdr): static
    {
        $this->intAdr = $intAdr;
        return $this;
    }

    public function getTeamMembers(): array
    {
        return $this->teamMembers;
    }

    public function setTeamMembers(array $teamMembers): static
    {
        $this->teamMembers = $teamMembers;
        return $this;
    }

    public function addTeamMember(array $member): static
    {
        $this->teamMembers[] = $member;
        return $this;
    }

    public function removeTeamMember(int $intAdr): static
    {
        $this->teamMembers = array_values(array_filter(
            $this->teamMembers,
            fn($member) => $member['INT_ADR'] !== $intAdr
        ));
        return $this;
    }

    public function getHistory(): array
    {
        return $this->history;
    }

    public function addHistoryEntry(string $action, int $user, string $details, array $data = []): static
    {
        $this->history[] = [
            'timestamp' => (new \DateTimeImmutable())->format('c'),
            'action' => $action,
            'user' => $user,
            'state' => $this->state->value,
            'details' => $details,
            'data' => $data
        ];
        return $this;
    }

    public function getDataA(): array
    {
        return $this->dataA;
    }

    public function setDataA(array $dataA): static
    {
        $this->dataA = $dataA;
        return $this;
    }

    public function getDataB(): array
    {
        return $this->dataB;
    }

    public function setDataB(array $dataB): static
    {
        $this->dataB = $dataB;
        return $this;
    }

    public function getCalculation(): array
    {
        return $this->calculation;
    }

    public function setCalculation(array $calculation): static
    {
        $this->calculation = $calculation;
        return $this;
    }

    public function getState(): ReportStateEnum
    {
        return $this->state;
    }

    public function setState(ReportStateEnum $state): static
    {
        $this->state = $state;
        
        // Automaticky nastavit datum odeslání
        if ($state === ReportStateEnum::SEND && $this->dateSend === null) {
            $this->dateSend = new \DateTimeImmutable();
        }
        
        return $this;
    }

    public function getDateSend(): ?\DateTimeImmutable
    {
        return $this->dateSend;
    }

    public function setDateSend(?\DateTimeImmutable $dateSend): static
    {
        $this->dateSend = $dateSend;
        return $this;
    }

    public function getDateCreated(): ?\DateTimeImmutable
    {
        return $this->dateCreated;
    }

    public function getDateUpdated(): ?\DateTimeImmutable
    {
        return $this->dateUpdated;
    }

    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $this->dateCreated = new \DateTimeImmutable();
        $this->dateUpdated = new \DateTimeImmutable();
    }

    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->dateUpdated = new \DateTimeImmutable();
    }

    /**
     * Check if report can be edited
     */
    public function isEditable(): bool
    {
        return in_array($this->state, [ReportStateEnum::DRAFT, ReportStateEnum::REJECTED]);
    }

    /**
     * Check if report is submitted
     */
    public function isSubmitted(): bool
    {
        return in_array($this->state, [ReportStateEnum::SEND, ReportStateEnum::APPROVED]);
    }
}