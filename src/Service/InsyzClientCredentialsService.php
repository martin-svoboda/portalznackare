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
     * Ověření odpovídá tomu, co vyžaduje samotná aplikace: heslo musí sedět proti
     * trasy.ptUzivatele.Uziv_Info a uživatel musí existovat ve vsichni.UserInfo.
     * Kdo ve vsichni.UserInfo není, nemá v systému žádná práva.
     *
     * Nic dalšího se nekontroluje. vsichni.UserLock kontroluje SQL login přes
     * loginproperty a na tomhle hostingu vrací NULL pro každého;
     * vsichni.DatActUser.PlatnostPasswd sice existuje, ale desktopový klient podle
     * něj přihlášení neblokuje — kdyby to endpoint vynucoval, odmítl by uživatele,
     * které aplikace normálně pustí.
     */
    private const VERIFY_SQL = 'SELECT u.Uziv_Info,
                CASE WHEN EXISTS (
                    SELECT 1 FROM vsichni.UserInfo i WHERE i.ActUser = u.ActUser
                ) THEN 1 ELSE 0 END AS Ma_Ucet
            FROM trasy.ptUzivatele u
            WHERE u.ActUser = ?';

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

        // Bez záznamu ve vsichni.UserInfo nemá uživatel v systému žádná práva
        if ((int) ($row['Ma_Ucet'] ?? 0) !== 1) {
            throw new InsyzClientAuthException(InsyzClientAuthException::REASON_NO_SYSTEM_ACCOUNT);
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
                'Ma_Ucet' => 1,
            ];
        }

        $rows = $this->connections->query($key, $account, self::VERIFY_SQL, [$user]);

        return $rows[0] ?? null;
    }

    private function useTestData(): bool
    {
        return ($_ENV['USE_TEST_DATA'] ?? 'false') === 'true';
    }
}
