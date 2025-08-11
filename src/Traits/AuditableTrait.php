<?php

namespace App\Traits;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Trait for entities that should track creation and modification timestamps
 * 
 * This trait is optional - automatic audit logging works without it.
 * Use this trait only when you need created_at/updated_at timestamps
 * directly on your entities for business logic purposes.
 */
trait AuditableTrait
{
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $updatedAt;

    /**
     * Initialize timestamps
     */
    protected function initializeAuditableTimestamps(): void
    {
        $now = new \DateTimeImmutable();
        $this->createdAt = $now;
        $this->updatedAt = $now;
    }

    /**
     * Update the updated_at timestamp
     */
    #[ORM\PreUpdate]
    public function setUpdatedAtValue(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
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
     * Set created at (useful for data migration or testing)
     */
    public function setCreatedAt(\DateTimeImmutable $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    /**
     * Set updated at (useful for data migration or testing)  
     */
    public function setUpdatedAt(\DateTimeImmutable $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    /**
     * Check if entity was recently created (within specified minutes)
     */
    public function isRecentlyCreated(int $minutes = 5): bool
    {
        $threshold = new \DateTimeImmutable("-{$minutes} minutes");
        return $this->createdAt > $threshold;
    }

    /**
     * Check if entity was recently updated (within specified minutes)
     */
    public function isRecentlyUpdated(int $minutes = 5): bool
    {
        $threshold = new \DateTimeImmutable("-{$minutes} minutes");
        return $this->updatedAt > $threshold;
    }

    /**
     * Get age in days
     */
    public function getAgeInDays(): int
    {
        $now = new \DateTimeImmutable();
        return $now->diff($this->createdAt)->days;
    }

    /**
     * Get time since last update in minutes
     */
    public function getMinutesSinceLastUpdate(): int
    {
        $now = new \DateTimeImmutable();
        $diff = $now->diff($this->updatedAt);
        return ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
    }

    /**
     * Convert timestamps to array for API responses
     */
    public function getAuditableTimestampsAsArray(): array
    {
        return [
            'created_at' => $this->createdAt->format(\DateTimeInterface::ATOM),
            'updated_at' => $this->updatedAt->format(\DateTimeInterface::ATOM),
            'is_recently_created' => $this->isRecentlyCreated(),
            'is_recently_updated' => $this->isRecentlyUpdated(),
            'age_in_days' => $this->getAgeInDays(),
        ];
    }
}