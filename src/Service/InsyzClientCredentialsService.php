<?php

namespace App\Service;

use App\Exception\InsyzClientAuthException;

/**
 * Vydávání hesel k INSYZ databázím desktopovému klientovi.
 *
 * Dočasné řešení, než INSYZ nahradí NG: klient si dnes hesla nosí v binárce,
 * nově si o ně řekne Portálu, který uživatele ověří a vrátí heslo právě
 * k jednomu účtu. Connection string si skládá klient sám.
 *
 * Ověření uživatele probíhá vždy v databázi, které se požadovaný klíč týká —
 * viz InsyzClientConnectionPool. Žádný fallback na produkční databázi neexistuje:
 * nedostupná databáze nebo chybějící tabulka znamená odmítnutí požadavku.
 */
class InsyzClientCredentialsService
{
    /** Mock účet pro lokální vývoj (USE_TEST_DATA=true), kde MSSQL není dostupné */
    private const TEST_USER = 'test';

    /** Uziv_Info pro heslo "test" — stejné schéma jako v DB (DES-CBC, base64, UTF-16LE) */
    private const TEST_UZIV_INFO = '7k3kjwZo+sq5fV4GNxZz5Q==';

    /**
     * @param array<string, array{host: string, database: string, user: string, password: string}> $accounts
     *        mapa klíč účtu => parametry spojení (viz services.yaml, heslo z env)
     */
    public function __construct(
        private InsyzClientConnectionPool $connections,
        private InsyzLegacyPasswordCipher $cipher,
        private array $accounts
    ) {
    }

    /**
     * Ověří uživatele v databázi daného účtu a vrátí heslo k tomuto účtu.
     *
     * @throws InsyzClientAuthException při jakémkoli neúspěchu (důvod jen do logu)
     */
    public function getDbPassword(string $user, string $password, string $key): string
    {
        // Nejdřív klíč — neznámý klíč nesmí vést ani na pokus o spojení
        $account = $this->resolveAccount($key);

        $this->verifyUser($user, $password, $key, $account);

        return $account['password'];
    }

    /**
     * @return array{host: string, database: string, user: string, password: string}
     */
    private function resolveAccount(string $key): array
    {
        foreach ($this->accounts as $configuredKey => $account) {
            // hash_equals kvůli konstantnímu času; klíče jsou case-sensitive (Cyklo_UNI)
            if (hash_equals((string) $configuredKey, $key) && ($account['password'] ?? '') !== '') {
                return $account;
            }
        }

        throw new InsyzClientAuthException(InsyzClientAuthException::REASON_UNKNOWN_KEY);
    }

    /**
     * @param array{host: string, database: string, user: string, password: string} $account
     */
    private function verifyUser(string $user, string $password, string $key, array $account): void
    {
        $row = $this->fetchUser($user, $key, $account);

        if ($row === null) {
            throw new InsyzClientAuthException(InsyzClientAuthException::REASON_UNKNOWN_USER);
        }

        $stored = $this->cipher->decrypt((string) ($row['Uziv_Info'] ?? ''));

        if ($stored === null || !hash_equals($stored, $password)) {
            throw new InsyzClientAuthException(InsyzClientAuthException::REASON_BAD_PASSWORD);
        }

        if (!$this->isValidToday($row['Platnost_Od'] ?? null, $row['Platnost_Do'] ?? null)) {
            throw new InsyzClientAuthException(InsyzClientAuthException::REASON_ACCOUNT_NOT_VALID);
        }
    }

    /**
     * @param array{host: string, database: string, user: string, password: string} $account
     *
     * @return array<string, mixed>|null
     */
    private function fetchUser(string $user, string $key, array $account): ?array
    {
        if ($this->useTestData()) {
            if ($user !== self::TEST_USER) {
                return null;
            }

            return [
                'Uziv_Info' => self::TEST_UZIV_INFO,
                'Platnost_Od' => null,
                'Platnost_Do' => null,
            ];
        }

        $rows = $this->connections->query(
            $key,
            $account,
            'SELECT Uziv_Info, Platnost_Od, Platnost_Do FROM trasy.ptUzivatele WHERE ActUser = ?',
            [$user]
        );

        return $rows[0] ?? null;
    }

    /**
     * Platnost účtu je přímo v trasy.ptUzivatele (Platnost_Od / Platnost_Do, date, nullable).
     * Dnešek musí spadat do intervalu, NULL znamená neomezeno z dané strany.
     * Funkce vsichni.UserLock se nepoužívá — kontroluje SQL login přes loginproperty
     * a na tomto hostingu vrací NULL pro každého.
     */
    private function isValidToday(mixed $from, mixed $to): bool
    {
        $today = new \DateTimeImmutable('today');

        $fromDate = $this->toDate($from);
        if ($fromDate !== null && $fromDate > $today) {
            return false;
        }

        $toDate = $this->toDate($to);
        if ($toDate !== null && $toDate < $today) {
            return false;
        }

        return true;
    }

    private function toDate(mixed $value): ?\DateTimeImmutable
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof \DateTimeInterface) {
            return \DateTimeImmutable::createFromInterface($value)->setTime(0, 0);
        }

        try {
            return (new \DateTimeImmutable((string) $value))->setTime(0, 0);
        } catch (\Exception) {
            // Nečitelné datum nesmí platnost nechat projít
            throw new InsyzClientAuthException(InsyzClientAuthException::REASON_ACCOUNT_NOT_VALID);
        }
    }

    private function useTestData(): bool
    {
        return ($_ENV['USE_TEST_DATA'] ?? 'false') === 'true';
    }
}
