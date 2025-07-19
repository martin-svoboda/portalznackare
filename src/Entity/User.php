<?php

namespace App\Entity;

use Symfony\Component\Security\Core\User\UserInterface;

class User implements UserInterface
{
    private string $intAdr;
    private string $email;
    private string $jmeno;
    private string $prijmeni;
    private array $roles = [];
    private ?string $prukazZnackare = null;

    public function __construct(
        string $intAdr,
        string $email,
        string $jmeno = '',
        string $prijmeni = '',
        array $roles = []
    ) {
        $this->intAdr = $intAdr;
        $this->email = $email;
        $this->jmeno = $jmeno;
        $this->prijmeni = $prijmeni;
        $this->roles = empty($roles) ? ['ROLE_USER'] : $roles;
    }

    public function getIntAdr(): string
    {
        return $this->intAdr;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getJmeno(): string
    {
        return $this->jmeno;
    }

    public function getPrijmeni(): string
    {
        return $this->prijmeni;
    }

    public function getPrukazZnackare(): ?string
    {
        return $this->prukazZnackare;
    }

    public function setPrukazZnackare(?string $prukazZnackare): void
    {
        $this->prukazZnackare = $prukazZnackare;
    }

    /**
     * @see UserInterface
     */
    public function getUserIdentifier(): string
    {
        return $this->email;
    }

    /**
     * @deprecated since Symfony 5.3, use getUserIdentifier instead
     */
    public function getUsername(): string
    {
        return $this->email;
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

    /**
     * @see UserInterface
     */
    public function eraseCredentials(): void
    {
        // If you store any temporary, sensitive data on the user, clear it here
    }
}