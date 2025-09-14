<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'users')]
#[ORM\HasLifecycleCallbacks]
class User implements UserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['user:read'])]
    private ?int $id = null;

    #[ORM\Column(type: Types::INTEGER, unique: true)]
    #[Groups(['user:read', 'user:write'])]
    private int $intAdr;

    #[ORM\Column(type: Types::STRING, length: 255)]
    #[Groups(['user:read', 'user:write'])]
    private string $email;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $jmeno = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $prijmeni = null;

    #[ORM\Column(type: Types::STRING, length: 50, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $prukazZnackare = null;

    #[ORM\Column(type: Types::JSON)]
    #[Groups(['user:read', 'user:write'])]
    private array $roles = ['ROLE_USER'];

    #[ORM\Column(type: Types::JSON)]
    #[Groups(['user:read', 'user:write'])]
    private array $preferences = [];

    #[ORM\Column(type: Types::JSON)]
    #[Groups(['user:read', 'user:write'])]
    private array $settings = [];

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    #[Groups(['user:read'])]
    private ?\DateTimeImmutable $lastLoginAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['user:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['user:read'])]
    private \DateTimeImmutable $updatedAt;

    #[ORM\Column(type: Types::BOOLEAN)]
    #[Groups(['user:read', 'user:write'])]
    private bool $isActive = true;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getIntAdr(): int
    {
        return $this->intAdr;
    }

    public function setIntAdr(int $intAdr): self
    {
        $this->intAdr = $intAdr;
        return $this;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): self
    {
        $this->email = $email;
        return $this;
    }

    public function getJmeno(): ?string
    {
        return $this->jmeno;
    }

    public function setJmeno(?string $jmeno): self
    {
        $this->jmeno = $jmeno;
        return $this;
    }

    public function getPrijmeni(): ?string
    {
        return $this->prijmeni;
    }

    public function setPrijmeni(?string $prijmeni): self
    {
        $this->prijmeni = $prijmeni;
        return $this;
    }

    public function getFullName(): string
    {
        return trim(($this->jmeno ?? '') . ' ' . ($this->prijmeni ?? ''));
    }

    public function getPrukazZnackare(): ?string
    {
        return $this->prukazZnackare;
    }

    public function setPrukazZnackare(?string $prukazZnackare): self
    {
        $this->prukazZnackare = $prukazZnackare;
        return $this;
    }

    /**
     * @see UserInterface
     */
    public function getUserIdentifier(): string
    {
        return (string) $this->intAdr;
    }

    /**
     * @deprecated since Symfony 5.3, use getUserIdentifier instead
     */
    public function getUsername(): string
    {
        return $this->getUserIdentifier();
    }

    /**
     * @see UserInterface
     */
    public function getRoles(): array
    {
        $roles = $this->roles;
        // guarantee every user at least has ROLE_USER
        $roles[] = 'ROLE_USER';

        return array_unique($roles);
    }

    public function setRoles(array $roles): self
    {
        $this->roles = $roles;
        return $this;
    }

    public function hasRole(string $role): bool
    {
        return in_array($role, $this->getRoles(), true);
    }

    public function addRole(string $role): self
    {
        if (!in_array($role, $this->roles, true)) {
            $this->roles[] = $role;
        }
        return $this;
    }

    public function removeRole(string $role): self
    {
        $this->roles = array_values(array_diff($this->roles, [$role]));
        return $this;
    }

    /**
     * @see UserInterface
     */
    public function eraseCredentials(): void
    {
        // If you store any temporary, sensitive data on the user, clear it here
    }

    public function getPreferences(): array
    {
        return $this->preferences;
    }

    public function setPreferences(array $preferences): self
    {
        $this->preferences = $preferences;
        return $this;
    }

    public function getPreference(string $key, mixed $default = null): mixed
    {
        return $this->preferences[$key] ?? $default;
    }

    public function setPreference(string $key, mixed $value): self
    {
        $this->preferences[$key] = $value;
        // Explicitně označ pole jako změněné pro Doctrine
        $this->preferences = [...$this->preferences];
        return $this;
    }

    public function getSettings(): array
    {
        return $this->settings;
    }

    public function setSettings(array $settings): self
    {
        $this->settings = $settings;
        return $this;
    }

    public function getSetting(string $key, mixed $default = null): mixed
    {
        return $this->settings[$key] ?? $default;
    }

    public function setSetting(string $key, mixed $value): self
    {
        $this->settings[$key] = $value;
        return $this;
    }

    public function getLastLoginAt(): ?\DateTimeImmutable
    {
        return $this->lastLoginAt;
    }

    public function setLastLoginAt(?\DateTimeImmutable $lastLoginAt): self
    {
        $this->lastLoginAt = $lastLoginAt;
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

    #[ORM\PreUpdate]
    public function setUpdatedAtValue(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function isActive(): bool
    {
        return $this->isActive;
    }

    public function setIsActive(bool $isActive): self
    {
        $this->isActive = $isActive;
        return $this;
    }

    /**
     * Create User from INSYZ data
     */
    public static function createFromInsyzData(array $data): self
    {
        $user = new self();
        $user->setIntAdr((int)($data['INT_ADR'] ?? 0));
        $user->setEmail($data['eMail'] ?? '');
        $user->setJmeno($data['Jmeno'] ?? '');
        $user->setPrijmeni($data['Prijmeni'] ?? '');
        
        if (isset($data['Prukaz_znackare'])) {
            $user->setPrukazZnackare($data['Prukaz_znackare']);
        }
        
        // Determine roles from INSYZ data
        $roles = ['ROLE_USER'];
        if (!empty($data['Vedouci_dvojice']) && $data['Vedouci_dvojice'] === '1') {
            $roles[] = 'ROLE_VEDOUCI';
        }
        $user->setRoles($roles);
        
        return $user;
    }

    /**
     * Update from INSYZ data
     */
    public function updateFromInsyzData(array $data): self
    {
        $this->setEmail($data['eMail'] ?? $this->email);
        $this->setJmeno($data['Jmeno'] ?? $this->jmeno);
        $this->setPrijmeni($data['Prijmeni'] ?? $this->prijmeni);
        
        if (isset($data['Prukaz_znackare'])) {
            $this->setPrukazZnackare($data['Prukaz_znackare']);
        }
        
        // Update roles from INSYZ data but preserve local admin roles
        $localAdminRoles = array_filter($this->roles, fn($role) => 
            in_array($role, ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'])
        );
        
        $insyzRoles = ['ROLE_USER'];
        if (!empty($data['Vedouci_dvojice']) && $data['Vedouci_dvojice'] === '1') {
            $insyzRoles[] = 'ROLE_VEDOUCI';
        }
        
        $this->setRoles(array_unique(array_merge($insyzRoles, $localAdminRoles)));
        
        return $this;
    }
}