<?php

namespace App\Entity;

use App\Repository\FileAttachmentRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: FileAttachmentRepository::class)]
#[ORM\Table(name: 'file_attachments')]
#[ORM\Index(columns: ['hash'], name: 'idx_file_hash')]
#[ORM\Index(columns: ['created_at'], name: 'idx_file_created')]
#[ORM\Index(columns: ['storage_path'], name: 'idx_file_storage_path')]
#[ORM\HasLifecycleCallbacks]
class FileAttachment
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    #[Groups(['file:read', 'report:read'])]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 255, unique: true)]
    #[Groups(['file:read', 'report:read'])]
    private string $hash;

    #[ORM\Column(type: 'string', length: 255)]
    #[Groups(['file:read', 'report:read'])]
    private string $originalName;

    #[ORM\Column(type: 'string', length: 255)]
    #[Groups(['file:read', 'report:read'])]
    private string $storedName;

    #[ORM\Column(type: 'string', length: 100)]
    #[Groups(['file:read', 'report:read'])]
    private string $mimeType;

    #[ORM\Column(type: 'integer')]
    #[Groups(['file:read', 'report:read'])]
    private int $size;

    #[ORM\Column(type: 'string', length: 500)]
    #[Groups(['file:read', 'report:read'])]
    private string $path;

    #[ORM\Column(type: 'string', length: 500)]
    #[Groups(['file:read', 'report:read'])]
    private string $publicUrl;

    #[ORM\Column(type: 'string', length: 500)]
    #[Groups(['file:read'])]
    private string $storagePath;

    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['file:read'])]
    private ?array $usageInfo = [];

    #[ORM\Column(type: 'integer', nullable: true)]
    #[Groups(['file:read'])]
    private ?int $uploadedBy = null;

    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['file:read'])]
    private ?array $metadata = null;

    #[ORM\Column(type: 'datetime_immutable')]
    #[Groups(['file:read', 'report:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable')]
    #[Groups(['file:read'])]
    private \DateTimeImmutable $updatedAt;

    #[ORM\Column(type: 'boolean')]
    private bool $isTemporary = true;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $expiresAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $deletedAt = null;

    #[ORM\Column(type: 'boolean')]
    private bool $physicallyDeleted = false;

    #[ORM\Column(type: 'boolean')]
    #[Groups(['file:read', 'report:read'])]
    private bool $isPublic = false;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
        $this->metadata = [];
        $this->usageInfo = [];
    }

    #[ORM\PreUpdate]
    public function updateTimestamp(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    // Getters and setters

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getHash(): string
    {
        return $this->hash;
    }

    public function setHash(string $hash): self
    {
        $this->hash = $hash;
        return $this;
    }

    public function getOriginalName(): string
    {
        return $this->originalName;
    }

    public function setOriginalName(string $originalName): self
    {
        $this->originalName = $originalName;
        return $this;
    }

    public function getStoredName(): string
    {
        return $this->storedName;
    }

    public function setStoredName(string $storedName): self
    {
        $this->storedName = $storedName;
        return $this;
    }

    public function getMimeType(): string
    {
        return $this->mimeType;
    }

    public function setMimeType(string $mimeType): self
    {
        $this->mimeType = $mimeType;
        return $this;
    }

    public function getSize(): int
    {
        return $this->size;
    }

    public function setSize(int $size): self
    {
        $this->size = $size;
        return $this;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function setPath(string $path): self
    {
        $this->path = $path;
        return $this;
    }

    public function getPublicUrl(): string
    {
        return $this->publicUrl;
    }

    public function setPublicUrl(string $publicUrl): self
    {
        $this->publicUrl = $publicUrl;
        return $this;
    }

    public function getStoragePath(): string
    {
        return $this->storagePath;
    }

    public function setStoragePath(string $storagePath): self
    {
        $this->storagePath = $storagePath;
        return $this;
    }

    public function getUsageInfo(): ?array
    {
        return $this->usageInfo;
    }

    public function setUsageInfo(?array $usageInfo): self
    {
        $this->usageInfo = $usageInfo;
        return $this;
    }

    public function addUsage(string $type, int $id, ?array $additionalData = null): self
    {
        if (!$this->usageInfo) {
            $this->usageInfo = [];
        }
        
        $usageKey = "{$type}_{$id}";
        $this->usageInfo[$usageKey] = [
            'type' => $type,
            'id' => $id,
            'added_at' => (new \DateTimeImmutable())->format('c'),
            'data' => $additionalData
        ];
        
        return $this;
    }

    public function removeUsage(string $type, int $id): self
    {
        if (!$this->usageInfo) {
            return $this;
        }
        
        $usageKey = "{$type}_{$id}";
        unset($this->usageInfo[$usageKey]);
        
        return $this;
    }

    public function isUsedIn(string $type, int $id): bool
    {
        if (!$this->usageInfo) {
            return false;
        }
        
        $usageKey = "{$type}_{$id}";
        return isset($this->usageInfo[$usageKey]);
    }

    public function getUsageCount(): int
    {
        return $this->usageInfo ? count($this->usageInfo) : 0;
    }

    public function getUploadedBy(): ?int
    {
        return $this->uploadedBy;
    }

    public function setUploadedBy(?int $uploadedBy): self
    {
        $this->uploadedBy = $uploadedBy;
        return $this;
    }

    public function getMetadata(): ?array
    {
        return $this->metadata;
    }

    public function setMetadata(?array $metadata): self
    {
        $this->metadata = $metadata;
        return $this;
    }

    public function addMetadata(string $key, mixed $value): self
    {
        if (!$this->metadata) {
            $this->metadata = [];
        }
        $this->metadata[$key] = $value;
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

    public function isTemporary(): bool
    {
        return $this->isTemporary;
    }

    public function setIsTemporary(bool $isTemporary): self
    {
        $this->isTemporary = $isTemporary;
        return $this;
    }

    public function getExpiresAt(): ?\DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function setExpiresAt(?\DateTimeImmutable $expiresAt): self
    {
        $this->expiresAt = $expiresAt;
        return $this;
    }

    public function isExpired(): bool
    {
        return $this->expiresAt && $this->expiresAt < new \DateTimeImmutable();
    }

    public function isImage(): bool
    {
        return str_starts_with($this->mimeType, 'image/');
    }

    public function isPdf(): bool
    {
        return $this->mimeType === 'application/pdf';
    }

    public function getFileExtension(): string
    {
        return pathinfo($this->originalName, PATHINFO_EXTENSION);
    }

    public function getDeletedAt(): ?\DateTimeImmutable
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?\DateTimeImmutable $deletedAt): self
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    public function isDeleted(): bool
    {
        return $this->deletedAt !== null;
    }

    public function softDelete(): self
    {
        $this->deletedAt = new \DateTimeImmutable();
        return $this;
    }

    public function restore(): self
    {
        $this->deletedAt = null;
        $this->physicallyDeleted = false;
        return $this;
    }

    public function isPhysicallyDeleted(): bool
    {
        return $this->physicallyDeleted;
    }

    public function setPhysicallyDeleted(bool $physicallyDeleted): self
    {
        $this->physicallyDeleted = $physicallyDeleted;
        return $this;
    }

    /**
     * Check if file should be physically deleted (grace period passed)
     */
    public function shouldBePhysicallyDeleted(int $gracePeriodHours = 24): bool
    {
        if (!$this->deletedAt) {
            return false;
        }

        $gracePeriodEnd = $this->deletedAt->modify("+{$gracePeriodHours} hours");
        return new \DateTimeImmutable() > $gracePeriodEnd;
    }

    public function isPublic(): bool
    {
        return $this->isPublic;
    }

    public function setIsPublic(bool $isPublic): self
    {
        $this->isPublic = $isPublic;
        return $this;
    }
}