<?php

namespace App\Security;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Service\AuditLogger;
use App\Service\InsyzService;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

class InsyzUserProvider implements UserProviderInterface
{
    public function __construct(
        private InsyzService $insyzService,
        private UserRepository $userRepository,
        private AuditLogger $auditLogger
    ) {}

    /**
     * @throws UserNotFoundException if the user is not found
     */
    public function loadUserByIdentifier(string $identifier): UserInterface
    {
        // Try to load from database first if it's INT_ADR
        if (is_numeric($identifier)) {
            $user = $this->userRepository->findByIntAdr((int)$identifier);
            if ($user && $user->isActive()) {
                return $user;
            }
        }
        
        // If not found in DB or identifier is email, try INSYZ
        if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
            // Loading by email would require special INSYZ endpoint
            $user = $this->userRepository->findByEmail($identifier);
            if ($user && $user->isActive()) {
                return $user;
            }
            throw new UserNotFoundException('Loading by email from INSYZ not implemented yet');
        }
        
        // Load from INSYZ and sync to database
        try {
            $userData = $this->insyzService->getUser((int)$identifier);
            
            if (!$userData || (is_array($userData) && empty($userData))) {
                throw new UserNotFoundException(sprintf('User with INT_ADR "%s" not found in INSYZ.', $identifier));
            }
            
            // If array of users, take the first one
            if (is_array($userData) && isset($userData[0])) {
                $userData = $userData[0];
            }
            
            // Find or create user in database
            $user = $this->userRepository->findOrCreateFromInsyzData($userData);
            
            // Log login
            $this->auditLogger->logLogin($user);
            
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

        return $this->loadUserByIdentifier((string)$user->getIntAdr());
    }

    public function supportsClass(string $class): bool
    {
        return User::class === $class || is_subclass_of($class, User::class);
    }
}