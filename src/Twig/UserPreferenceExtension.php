<?php

namespace App\Twig;

use App\Entity\User;
use App\Service\UserPreferenceService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class UserPreferenceExtension extends AbstractExtension
{
    public function __construct(
        private UserPreferenceService $userPreferenceService,
        private TokenStorageInterface $tokenStorage,
        private EntityManagerInterface $entityManager
    ) {}

    public function getFunctions(): array
    {
        return [
            new TwigFunction('user_preference', [$this, 'getUserPreference']),
            new TwigFunction('user_preferences', [$this, 'getAllUserPreferences']),
            new TwigFunction('user_theme_mode', [$this, 'getUserThemeMode']),
        ];
    }

    /**
     * Získá konkrétní uživatelskou preferenci
     */
    public function getUserPreference(string $key, mixed $default = null): mixed
    {
        $token = $this->tokenStorage->getToken();
        if (!$token || !($user = $token->getUser()) || !$user instanceof User) {
            return $default;
        }

        $preferences = $user->getPreferences();
        return $preferences[$key] ?? $default;
    }

    /**
     * Získá všechny preferencee uživatele s metadaty
     */
    public function getAllUserPreferences(): array
    {
        $token = $this->tokenStorage->getToken();
        if (!$token || !($user = $token->getUser()) || !$user instanceof User) {
            return [];
        }

        return $this->userPreferenceService->getUserPreferencesWithDefaults($user);
    }

    /**
     * Získá aktuální theme mode uživatele
     */
    public function getUserThemeMode(): string
    {
        $token = $this->tokenStorage->getToken();
        if (!$token || !($user = $token->getUser()) || !$user instanceof User) {
            return 'auto'; // Default pro nepřihlášené uživatele
        }

        // Načíst fresh user z databáze pro aktuální preference
        $freshUser = $this->entityManager->getRepository(User::class)->find($user->getId());
        if (!$freshUser) {
            return 'auto';
        }

        $preferences = $freshUser->getPreferences();

        // Pokud není nastaveno, použít default z konfigurace
        if (!isset($preferences['theme_mode'])) {
            $defaults = $this->userPreferenceService->getDefaultPreferences();
            return $defaults['theme_mode']['default'] ?? 'auto';
        }

        return $preferences['theme_mode'];
    }
}