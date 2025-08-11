<?php

namespace App\Entity;

use App\Repository\AuditLogRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: AuditLogRepository::class)]
#[ORM\Table(name: 'audit_logs')]
#[ORM\Index(columns: ['user_id', 'created_at'], name: 'idx_audit_logs_user_created')]
#[ORM\Index(columns: ['entity_type', 'entity_id'], name: 'idx_audit_logs_entity')]
#[ORM\Index(columns: ['action', 'created_at'], name: 'idx_audit_logs_action_created')]
#[ORM\Index(columns: ['created_at'], name: 'idx_audit_logs_created_at')]
class AuditLog
{
    public const ACTION_LOGIN = 'user_login';
    public const ACTION_LOGOUT = 'user_logout';
    public const ACTION_CREATE = 'entity_create';
    public const ACTION_UPDATE = 'entity_update';
    public const ACTION_DELETE = 'entity_delete';
    public const ACTION_REPORT_CREATE = 'report_create';
    public const ACTION_REPORT_UPDATE = 'report_update';
    public const ACTION_REPORT_DELETE = 'report_delete';
    public const ACTION_REPORT_SUBMIT = 'report_submit';
    public const ACTION_REPORT_STATUS_CHANGE = 'report_status_change';
    public const ACTION_FILE_UPLOAD = 'file_upload';
    public const ACTION_FILE_DELETE = 'file_delete';
    public const ACTION_USER_ROLE_CHANGE = 'user_role_change';
    public const ACTION_USER_SETTINGS_CHANGE = 'user_settings_change';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['audit:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['audit:read'])]
    private ?User $user = null;

    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    #[Groups(['audit:read'])]
    private ?int $intAdr = null;

    #[ORM\Column(type: Types::STRING, length: 100)]
    #[Groups(['audit:read'])]
    private string $action;

    #[ORM\Column(type: Types::STRING, length: 50, nullable: true)]
    #[Groups(['audit:read'])]
    private ?string $entityType = null;

    #[ORM\Column(type: Types::STRING, length: 50, nullable: true)]
    #[Groups(['audit:read'])]
    private ?string $entityId = null;

    #[ORM\Column(type: Types::JSON, nullable: true)]
    #[Groups(['audit:read'])]
    private ?array $oldValues = null;

    #[ORM\Column(type: Types::JSON, nullable: true)]
    #[Groups(['audit:read'])]
    private ?array $newValues = null;

    #[ORM\Column(type: Types::STRING, length: 45, nullable: true)]
    #[Groups(['audit:read'])]
    private ?string $ipAddress = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['audit:read'])]
    private ?string $userAgent = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['audit:read'])]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): self
    {
        $this->user = $user;
        // Automatically set int_adr when user is set
        $this->intAdr = $user?->getIntAdr();
        return $this;
    }

    public function getAction(): string
    {
        return $this->action;
    }

    public function setAction(string $action): self
    {
        $this->action = $action;
        return $this;
    }

    public function getIntAdr(): ?int
    {
        return $this->intAdr;
    }

    public function setIntAdr(?int $intAdr): self
    {
        $this->intAdr = $intAdr;
        return $this;
    }

    public function getEntityType(): ?string
    {
        return $this->entityType;
    }

    public function setEntityType(?string $entityType): self
    {
        $this->entityType = $entityType;
        return $this;
    }

    public function getEntityId(): ?string
    {
        return $this->entityId;
    }

    public function setEntityId(?string $entityId): self
    {
        $this->entityId = $entityId;
        return $this;
    }

    public function getOldValues(): ?array
    {
        return $this->oldValues;
    }

    public function setOldValues(?array $oldValues): self
    {
        $this->oldValues = $oldValues;
        return $this;
    }

    public function getNewValues(): ?array
    {
        return $this->newValues;
    }

    public function setNewValues(?array $newValues): self
    {
        $this->newValues = $newValues;
        return $this;
    }

    public function getIpAddress(): ?string
    {
        return $this->ipAddress;
    }

    public function setIpAddress(?string $ipAddress): self
    {
        $this->ipAddress = $ipAddress;
        return $this;
    }

    public function getUserAgent(): ?string
    {
        return $this->userAgent;
    }

    public function setUserAgent(?string $userAgent): self
    {
        // Truncate user agent to prevent overflow
        $this->userAgent = $userAgent ? substr($userAgent, 0, 255) : null;
        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /**
     * Get action label for display
     */
    public function getActionLabel(): string
    {
        return match($this->action) {
            self::ACTION_LOGIN => 'Přihlášení',
            self::ACTION_LOGOUT => 'Odhlášení',
            self::ACTION_CREATE => 'Vytvoření',
            self::ACTION_UPDATE => 'Úprava',
            self::ACTION_DELETE => 'Smazání',
            self::ACTION_REPORT_CREATE => 'Vytvoření hlášení',
            self::ACTION_REPORT_UPDATE => 'Úprava hlášení',
            self::ACTION_REPORT_DELETE => 'Smazání hlášení',
            self::ACTION_REPORT_SUBMIT => 'Odeslání hlášení',
            self::ACTION_REPORT_STATUS_CHANGE => 'Změna stavu hlášení',
            self::ACTION_FILE_UPLOAD => 'Nahrání souboru',
            self::ACTION_FILE_DELETE => 'Smazání souboru',
            self::ACTION_USER_ROLE_CHANGE => 'Změna role uživatele',
            self::ACTION_USER_SETTINGS_CHANGE => 'Změna nastavení',
            default => $this->action,
        };
    }

    /**
     * Get changed fields from old/new values
     */
    public function getChangedFields(): array
    {
        if (!$this->oldValues || !$this->newValues) {
            return [];
        }

        $changed = [];
        foreach ($this->newValues as $key => $newValue) {
            $oldValue = $this->oldValues[$key] ?? null;
            if ($oldValue !== $newValue) {
                $changed[$key] = [
                    'old' => $oldValue,
                    'new' => $newValue,
                ];
            }
        }

        return $changed;
    }
}