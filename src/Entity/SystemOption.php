<?php

namespace App\Entity;

use App\Repository\SystemOptionRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: SystemOptionRepository::class)]
#[ORM\Table(name: 'system_options')]
#[ORM\Index(columns: ['autoload'], name: 'idx_system_options_autoload')]
#[ORM\Index(columns: ['option_name', 'autoload'], name: 'idx_system_options_name_autoload')]
class SystemOption
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['option:read'])]
    private ?int $id = null;

    #[ORM\Column(type: Types::STRING, length: 255, unique: true)]
    #[Groups(['option:read', 'option:write'])]
    private string $optionName;

    #[ORM\Column(type: Types::JSON, nullable: true)]
    #[Groups(['option:read', 'option:write'])]
    private mixed $optionValue = null;

    #[ORM\Column(type: Types::BOOLEAN)]
    #[Groups(['option:read', 'option:write'])]
    private bool $autoload = true;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['option:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['option:read'])]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    #[ORM\PreUpdate]
    public function setUpdatedAtValue(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOptionName(): string
    {
        return $this->optionName;
    }

    public function setOptionName(string $optionName): self
    {
        $this->optionName = $optionName;
        return $this;
    }

    public function getOptionValue(): mixed
    {
        return $this->optionValue;
    }

    public function setOptionValue(mixed $optionValue): self
    {
        $this->optionValue = $optionValue;
        return $this;
    }

    public function isAutoload(): bool
    {
        return $this->autoload;
    }

    public function setAutoload(bool $autoload): self
    {
        $this->autoload = $autoload;
        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    /**
     * Get typed value - for common option types
     */
    public function getStringValue(): ?string
    {
        return is_string($this->optionValue) ? $this->optionValue : null;
    }

    public function getIntValue(): ?int
    {
        return is_int($this->optionValue) ? $this->optionValue : null;
    }

    public function getBoolValue(): ?bool
    {
        return is_bool($this->optionValue) ? $this->optionValue : null;
    }

    public function getArrayValue(): ?array
    {
        return is_array($this->optionValue) ? $this->optionValue : null;
    }

    /**
     * Helper for audit configuration
     */
    public function isAuditOption(): bool
    {
        return str_starts_with($this->optionName, 'audit.');
    }

    /**
     * Helper for INSYZ audit configuration
     */
    public function isInsyzAuditOption(): bool
    {
        return str_starts_with($this->optionName, 'insyz_audit.');
    }

    public function getAuditEntityConfig(string $entityName): ?array
    {
        if ($this->optionName !== 'audit.log_entities' || !is_array($this->optionValue)) {
            return null;
        }

        return $this->optionValue[$entityName] ?? null;
    }

    public function isEntityAuditEnabled(string $entityName, string $event = null): bool
    {
        $config = $this->getAuditEntityConfig($entityName);
        
        if (!$config || !($config['enabled'] ?? false)) {
            return false;
        }

        if ($event && isset($config['events']) && is_array($config['events'])) {
            return in_array($event, $config['events'], true);
        }

        return true;
    }

    public function getMaskedFields(string $entityName): array
    {
        $config = $this->getAuditEntityConfig($entityName);
        return $config['masked_fields'] ?? [];
    }
}