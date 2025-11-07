<?php

namespace App\Entity;

use App\Enum\PageContentTypeEnum;
use App\Enum\PageStatusEnum;
use App\Repository\PageRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: PageRepository::class)]
#[ORM\Table(name: 'pages')]
#[ORM\HasLifecycleCallbacks]
class Page
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: Types::BIGINT)]
    #[Groups(['page:read'])]
    private ?int $id = null;

    #[ORM\Column(type: Types::STRING, length: 500)]
    #[Groups(['page:read', 'page:write'])]
    private string $title;

    #[ORM\Column(type: Types::STRING, length: 500, unique: true)]
    #[Groups(['page:read', 'page:write'])]
    private string $slug;

    #[ORM\Column(type: Types::TEXT)]
    #[Groups(['page:read', 'page:write'])]
    private string $content;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['page:read', 'page:write'])]
    private ?string $excerpt = null;

    #[ORM\Column(name: 'content_type', type: Types::STRING, length: 50, enumType: PageContentTypeEnum::class)]
    #[Groups(['page:read', 'page:write'])]
    private PageContentTypeEnum $contentType = PageContentTypeEnum::PAGE;

    #[ORM\Column(type: Types::STRING, length: 50, enumType: PageStatusEnum::class)]
    #[Groups(['page:read', 'page:write'])]
    private PageStatusEnum $status = PageStatusEnum::DRAFT;

    #[ORM\Column(name: 'author_id', type: Types::INTEGER)]
    #[Groups(['page:read', 'page:write'])]
    private int $authorId;

    #[ORM\ManyToOne(targetEntity: self::class, inversedBy: 'children')]
    #[ORM\JoinColumn(name: 'parent_id', referencedColumnName: 'id', onDelete: 'SET NULL')]
    #[Groups(['page:read', 'page:write'])]
    private ?Page $parent = null;

    #[ORM\OneToMany(targetEntity: self::class, mappedBy: 'parent')]
    private Collection $children;

    #[ORM\Column(name: 'sort_order', type: Types::INTEGER)]
    #[Groups(['page:read', 'page:write'])]
    private int $sortOrder = 0;

    #[ORM\ManyToOne(targetEntity: FileAttachment::class)]
    #[ORM\JoinColumn(name: 'featured_image_id', referencedColumnName: 'id', onDelete: 'SET NULL')]
    #[Groups(['page:read', 'page:write'])]
    private ?FileAttachment $featuredImage = null;

    #[ORM\Column(type: Types::JSON)]
    #[Groups(['page:read', 'page:write'])]
    private array $meta = [];

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['page:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(name: 'updated_at', type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['page:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\Column(name: 'published_at', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    #[Groups(['page:read'])]
    private ?\DateTimeImmutable $publishedAt = null;

    #[ORM\Column(name: 'deleted_at', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    #[Groups(['page:read'])]
    private ?\DateTimeImmutable $deletedAt = null;

    #[ORM\Column(type: Types::JSON)]
    #[Groups(['page:read'])]
    private array $history = [];

    public function __construct()
    {
        $this->children = new ArrayCollection();
    }

    // ===== Getters/Setters =====

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): static
    {
        $this->title = $title;
        return $this;
    }

    public function getSlug(): string
    {
        return $this->slug;
    }

    public function setSlug(string $slug): static
    {
        $this->slug = $slug;
        return $this;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(string $content): static
    {
        $this->content = $content;
        return $this;
    }

    public function getExcerpt(): ?string
    {
        return $this->excerpt;
    }

    public function setExcerpt(?string $excerpt): static
    {
        $this->excerpt = $excerpt;
        return $this;
    }

    public function getContentType(): PageContentTypeEnum
    {
        return $this->contentType;
    }

    public function setContentType(PageContentTypeEnum $contentType): static
    {
        $this->contentType = $contentType;
        return $this;
    }

    public function getStatus(): PageStatusEnum
    {
        return $this->status;
    }

    public function setStatus(PageStatusEnum $status): static
    {
        $this->status = $status;
        return $this;
    }

    public function getAuthorId(): int
    {
        return $this->authorId;
    }

    public function setAuthorId(int $authorId): static
    {
        $this->authorId = $authorId;
        return $this;
    }

    public function getParent(): ?Page
    {
        return $this->parent;
    }

    public function setParent(?Page $parent): static
    {
        $this->parent = $parent;
        return $this;
    }

    /**
     * @return Collection<int, Page>
     */
    public function getChildren(): Collection
    {
        return $this->children;
    }

    public function addChild(Page $child): static
    {
        if (!$this->children->contains($child)) {
            $this->children->add($child);
            $child->setParent($this);
        }
        return $this;
    }

    public function removeChild(Page $child): static
    {
        if ($this->children->removeElement($child)) {
            if ($child->getParent() === $this) {
                $child->setParent(null);
            }
        }
        return $this;
    }

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(int $sortOrder): static
    {
        $this->sortOrder = $sortOrder;
        return $this;
    }

    public function getFeaturedImage(): ?FileAttachment
    {
        return $this->featuredImage;
    }

    public function setFeaturedImage(?FileAttachment $featuredImage): static
    {
        $this->featuredImage = $featuredImage;
        return $this;
    }

    public function getMeta(): array
    {
        return $this->meta;
    }

    public function setMeta(array $meta): static
    {
        $this->meta = $meta;
        return $this;
    }

    public function getMetaValue(string $key, mixed $default = null): mixed
    {
        return $this->meta[$key] ?? $default;
    }

    public function setMetaValue(string $key, mixed $value): static
    {
        $this->meta[$key] = $value;
        // Force Doctrine change tracking
        $this->meta = [...$this->meta];
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function getPublishedAt(): ?\DateTimeImmutable
    {
        return $this->publishedAt;
    }

    public function setPublishedAt(?\DateTimeImmutable $publishedAt): static
    {
        $this->publishedAt = $publishedAt;
        return $this;
    }

    public function getDeletedAt(): ?\DateTimeImmutable
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?\DateTimeImmutable $deletedAt): static
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    public function getHistory(): array
    {
        return $this->history;
    }

    public function setHistory(array $history): static
    {
        $this->history = $history;
        return $this;
    }

    // ===== Lifecycle Callbacks =====

    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    // ===== Status Workflow Methods =====

    public function publish(int $userId): static
    {
        if ($this->status !== PageStatusEnum::PUBLISHED) {
            $oldStatus = $this->status->value;
            $this->status = PageStatusEnum::PUBLISHED;

            if ($this->publishedAt === null) {
                $this->publishedAt = new \DateTimeImmutable();
            }

            $this->addHistoryEntry($userId, 'published', [
                'status' => [$oldStatus, 'published']
            ]);
        }

        return $this;
    }

    public function archive(int $userId): static
    {
        if ($this->status !== PageStatusEnum::ARCHIVED) {
            $oldStatus = $this->status->value;
            $this->status = PageStatusEnum::ARCHIVED;

            $this->addHistoryEntry($userId, 'archived', [
                'status' => [$oldStatus, 'archived']
            ]);
        }

        return $this;
    }

    public function softDelete(int $userId): static
    {
        // Save current status to restore later
        $this->setMetaValue('status_before_delete', $this->status->value);

        $oldStatus = $this->status->value;
        $this->status = PageStatusEnum::DELETED;
        $this->deletedAt = new \DateTimeImmutable();

        $this->addHistoryEntry($userId, 'deleted', [
            'status' => [$oldStatus, 'deleted'],
            'deleted_at' => $this->deletedAt->format('c')
        ]);

        return $this;
    }

    public function restore(int $userId): static
    {
        // Restore previous status or default to DRAFT
        $previousStatus = $this->getMetaValue('status_before_delete', 'draft');
        $this->status = PageStatusEnum::from($previousStatus);
        $this->deletedAt = null;

        // Remove the saved status from meta
        $meta = $this->meta;
        unset($meta['status_before_delete']);
        $this->meta = $meta;

        $this->addHistoryEntry($userId, 'restored', [
            'status' => ['deleted', $previousStatus]
        ]);

        return $this;
    }

    // ===== Status Checks =====

    public function isPublished(): bool
    {
        return $this->status === PageStatusEnum::PUBLISHED;
    }

    public function isDraft(): bool
    {
        return $this->status === PageStatusEnum::DRAFT;
    }

    public function isDeleted(): bool
    {
        return $this->status === PageStatusEnum::DELETED;
    }

    public function canEdit(): bool
    {
        return $this->status !== PageStatusEnum::DELETED;
    }

    // ===== History Management =====

    public function addHistoryEntry(int $userId, string $action, array $changes = []): static
    {
        $entry = [
            'timestamp' => (new \DateTimeImmutable())->format('c'),
            'user_id' => $userId,
            'action' => $action,
            'changes' => $changes,
        ];

        $this->history[] = $entry;
        // Force Doctrine change tracking
        $this->history = [...$this->history];

        return $this;
    }

    /**
     * Track a general update action
     */
    public function trackUpdate(int $userId, string $message, array $changes = []): static
    {
        return $this->addHistoryEntry($userId, 'updated', [
            'message' => $message,
            ...$changes
        ]);
    }

    // ===== Tree Navigation =====

    /**
     * Get breadcrumb trail from root to this page
     * @return Page[]
     */
    public function getBreadcrumbs(): array
    {
        $crumbs = [$this];
        $page = $this;

        while ($page = $page->getParent()) {
            array_unshift($crumbs, $page);
        }

        return $crumbs;
    }

    /**
     * Get full path slugs from root to this page
     * @return string[] Array of slugs
     */
    public function getPath(): array
    {
        return array_map(fn(Page $p) => $p->getSlug(), $this->getBreadcrumbs());
    }

    /**
     * Get full URL path with content type prefix
     * Format: /typ-obsahu/kategorie/parent-slug/slug
     * Examples:
     * - /metodiky/znaceni/barvy
     * - /napoveda/obecne/jak-zacit
     * - /o-portalu (pages without prefix)
     */
    public function getUrlPath(): string
    {
        $segments = [];

        // Add content type prefix from ENUM (null for PAGE type)
        $prefix = $this->contentType->getUrlPrefix();
        if ($prefix !== null) {
            $segments[] = $prefix;
        }

        // Add category if exists in meta
        if (!empty($this->meta['category'])) {
            $segments[] = $this->meta['category'];
        }

        // Add hierarchical path
        $segments = array_merge($segments, $this->getPath());

        return '/' . implode('/', $segments);
    }

    /**
     * Check if this page has children
     */
    public function hasChildren(): bool
    {
        return !$this->children->isEmpty();
    }

    /**
     * Get depth level (0 = root)
     */
    public function getDepth(): int
    {
        $depth = 0;
        $page = $this;

        while ($page = $page->getParent()) {
            $depth++;
        }

        return $depth;
    }
}
