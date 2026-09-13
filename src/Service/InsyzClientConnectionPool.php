<?php

namespace App\Service;

use PDO;
use PDOException;

/**
 * Spojení do INSYZ databází per databázový účet.
 *
 * Uživatele ověřujeme vždy proti té databázi, které se požadovaný klíč týká
 * (db6273 v db6273, db6266 v db6266, ...) — žádný dotaz "všechno proti produkci".
 * Přihlašovací údaje spojení jsou totožné s účtem, o jehož heslo klient žádá,
 * takže se do konfigurace nepřidává žádné další tajemství.
 *
 * Spojení se drží zvlášť pro každý klíč a jen po dobu requestu.
 */
class InsyzClientConnectionPool
{
    /** @var array<string, PDO> */
    private array $connections = [];

    /**
     * Parametrizovaný dotaz do databáze daného účtu.
     *
     * @param array{host: string, database: string, user: string, password: string} $account
     * @param array<int, mixed> $params
     *
     * @return array<int, array<string, mixed>>
     *
     * @throws PDOException když se k databázi nelze připojit nebo dotaz selže
     */
    public function query(string $key, array $account, string $sql, array $params = []): array
    {
        $statement = $this->get($key, $account)->prepare($sql);
        $statement->execute($params);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * @param array{host: string, database: string, user: string, password: string} $account
     *
     * @throws PDOException když se k databázi daného účtu nelze připojit
     */
    private function get(string $key, array $account): PDO
    {
        if (isset($this->connections[$key])) {
            return $this->connections[$key];
        }

        $dsn = sprintf(
            'sqlsrv:server=%s;Database=%s;ConnectionPooling=0;LoginTimeout=10',
            $account['host'],
            $account['database']
        );

        $connection = new PDO($dsn, $account['user'], $account['password']);
        $connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        return $this->connections[$key] = $connection;
    }
}
