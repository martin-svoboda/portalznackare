<?php

namespace App\Service;

use App\Entity\User;
use App\Repository\UserRepository;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Yaml\Yaml;
use Symfony\Component\HttpKernel\KernelInterface;

class UserPreferenceService
{
    private ?array $defaultPreferences = null;

    public function __construct(
        private KernelInterface $kernel,
        private UserRepository $userRepository
    ) {}

    /**
     * Získání definice defaultních preferencí z config souboru
     */
    public function getDefaultPreferences(): array
    {
        if ($this->defaultPreferences === null) {
            $configFile = $this->kernel->getProjectDir() . '/config/user_preferences.yaml';

            if (file_exists($configFile)) {
                $config = Yaml::parseFile($configFile);
                $this->defaultPreferences = $config['preferences'] ?? [];
            } else {
                $this->defaultPreferences = [];
            }
        }

        return $this->defaultPreferences;
    }

    /**
     * Zajistí, že uživatel má všechny požadované preference
     */
    public function ensureUserPreferences(User $user, ?Request $request = null): bool
    {
        $defaultPreferences = $this->getDefaultPreferences();
        $currentPreferences = $user->getPreferences();
        $hasChanges = false;

        foreach ($defaultPreferences as $key => $config) {
            if (!isset($currentPreferences[$key])) {
                $defaultValue = $config['default'];

                // Speciální logika pro theme_mode - detekce systémového nastavení
                if ($key === 'theme_mode' && $defaultValue === 'auto' && $request) {
                    $defaultValue = $this->detectSystemTheme($request);
                }

                $currentPreferences[$key] = $defaultValue;
                $hasChanges = true;
            }
        }

        if ($hasChanges) {
            $user->setPreferences($currentPreferences);
            $this->userRepository->save($user, true);
            return true;
        }

        return false;
    }

    /**
     * Detekce systémového dark/light mode z HTTP hlaviček
     */
    public function detectSystemTheme(Request $request): string
    {
        // Zjistit z User-Agent nebo Accept hlaviček
        $userAgent = $request->headers->get('User-Agent', '');

        // Pro moderní prohlížeče můžeme zkusit detekovat z dalších hlaviček
        // Fallback na 'light' jako bezpečnou volbu
        return 'light';
    }

    /**
     * Validace preference podle její definice
     */
    public function validatePreference(string $key, mixed $value): bool
    {
        $defaultPreferences = $this->getDefaultPreferences();

        if (!isset($defaultPreferences[$key])) {
            return false;
        }

        $config = $defaultPreferences[$key];

        // Validace typu
        switch ($config['type']) {
            case 'string':
                if (!is_string($value)) return false;
                // Kontrola povolených hodnot
                if (isset($config['values']) && !in_array($value, $config['values'])) {
                    return false;
                }
                break;

            case 'boolean':
                // Přijmout boolean nebo string reprezentaci
                if (!is_bool($value) && !in_array($value, ['true', 'false', '1', '0', 1, 0], true)) {
                    return false;
                }
                break;

            case 'integer':
                if (!is_int($value)) return false;
                if (isset($config['min']) && $value < $config['min']) return false;
                if (isset($config['max']) && $value > $config['max']) return false;
                break;

            default:
                return false;
        }

        return true;
    }

    /**
     * Aktualizace jedné preference uživatele
     */
    public function updateUserPreference(User $user, string $key, mixed $value): bool
    {
        if (!$this->validatePreference($key, $value)) {
            return false;
        }

        // Zkontrolovat, zda preference není zakázaná
        $defaultPreferences = $this->getDefaultPreferences();
        if (isset($defaultPreferences[$key]) && ($defaultPreferences[$key]['disabled'] ?? false)) {
            return false; // Nelze upravit zakázanou preferenci
        }

        // Normalizovat hodnotu podle typu
        $normalizedValue = $this->normalizePreferenceValue($key, $value);

        // Načíst fresh managed entity z databáze
        $managedUser = $this->userRepository->find($user->getId());
        if (!$managedUser) {
            throw new \RuntimeException('User not found in database');
        }

        $managedUser->setPreference($key, $normalizedValue);
        $this->userRepository->save($managedUser, true);

        return true;
    }

    /**
     * Získání všech preferencí uživatele s fallback na defaultní hodnoty
     */
    public function getUserPreferencesWithDefaults(User $user): array
    {
        $defaultPreferences = $this->getDefaultPreferences();

        // Načíst fresh user z databáze pro aktuální preference
        $freshUser = $this->userRepository->find($user->getId());
        $userPreferences = $freshUser ? $freshUser->getPreferences() : $user->getPreferences();
        $result = [];

        foreach ($defaultPreferences as $key => $config) {
            $result[$key] = [
                'value' => $userPreferences[$key] ?? $config['default'],
                'type' => $config['type'],
                'description' => $config['description'],
                'default' => $config['default'],
                'label' => $config['label'] ?? $key,
                'disabled' => $config['disabled'] ?? false
            ];

            // Přidat dodatečné metadata
            if (isset($config['values'])) {
                $result[$key]['values'] = $config['values'];
            }
            if (isset($config['options'])) {
                $result[$key]['options'] = $config['options'];
            }
            if (isset($config['min'])) {
                $result[$key]['min'] = $config['min'];
            }
            if (isset($config['max'])) {
                $result[$key]['max'] = $config['max'];
            }
        }

        return $result;
    }

    /**
     * Normalizace hodnoty preference podle jejího typu
     */
    private function normalizePreferenceValue(string $key, mixed $value): mixed
    {
        $defaultPreferences = $this->getDefaultPreferences();

        if (!isset($defaultPreferences[$key])) {
            return $value;
        }

        $config = $defaultPreferences[$key];

        switch ($config['type']) {
            case 'boolean':
                // Převést na skutečný boolean
                if (is_bool($value)) {
                    return $value;
                }
                return in_array($value, ['true', '1', 1], true);

            case 'integer':
                return (int)$value;

            case 'string':
            default:
                return (string)$value;
        }
    }
}