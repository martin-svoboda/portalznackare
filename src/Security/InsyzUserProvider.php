<?php

namespace App\Security;

use App\Entity\User;
use App\Service\InsyzService;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

class InsyzUserProvider implements UserProviderInterface
{
    public function __construct(
        private InsyzService $insyzService
    ) {}

    /**
     * @throws UserNotFoundException if the user is not found
     */
    public function loadUserByIdentifier(string $identifier): UserInterface
    {
        // Identifier je email nebo INT_ADR
        if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
            // Je to email, musíme najít uživatele podle emailu
            // Toto by v produkci vyžadovalo speciální INSYS endpoint
            throw new UserNotFoundException('Loading by email not implemented yet');
        }
        
        // Předpokládáme že identifier je INT_ADR
        try {
            $userData = $this->insyzService->getUser((int)$identifier);
            
            if (!$userData || (is_array($userData) && empty($userData))) {
                throw new UserNotFoundException(sprintf('User with INT_ADR "%s" not found.', $identifier));
            }
            
            // Pokud je pole uživatelů, vezmi prvního
            if (is_array($userData) && isset($userData[0])) {
                $userData = $userData[0];
            }
            
            // Vytvoř User objekt
            $user = new User(
                (string)($userData['INT_ADR'] ?? ''),
                $userData['eMail'] ?? '',
                $userData['Jmeno'] ?? '',
                $userData['Prijmeni'] ?? ''
            );
            
            if (isset($userData['Prukaz_znackare'])) {
                $user->setPrukazZnackare($userData['Prukaz_znackare']);
            }
            
            // Určit role podle dat z INSYS
            $roles = ['ROLE_USER'];
            if (!empty($userData['Vedouci_dvojice']) && $userData['Vedouci_dvojice'] === '1') {
                $roles[] = 'ROLE_VEDOUCI';
            }
            $user->setRoles($roles);
            
            return $user;
            
        } catch (\Exception $e) {
            throw new UserNotFoundException(sprintf('User "%s" not found.', $identifier), 0, $e);
        }
    }

    public function refreshUser(UserInterface $user): UserInterface
    {
        if (!$user instanceof User) {
            throw new \InvalidArgumentException(sprintf('Instances of "%s" are not supported.', get_class($user)));
        }

        return $this->loadUserByIdentifier($user->getIntAdr());
    }

    public function supportsClass(string $class): bool
    {
        return User::class === $class || is_subclass_of($class, User::class);
    }
}