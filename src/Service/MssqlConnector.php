<?php

namespace App\Service;

use Exception;
use PDO;
use PDOException;

class MssqlConnector
{
    private ?PDO $conn = null;
    private ?string $lastError = null;

    public function __construct()
    {
        $server = $_ENV['INSYS_DB_HOST'] ?? 'localhost';
        $database = $_ENV['INSYS_DB_NAME'] ?? '';
        $username = $_ENV['INSYS_DB_USER'] ?? '';
        $password = $_ENV['INSYS_DB_PASS'] ?? '';

        try {
            $dsn = "sqlsrv:server=$server;Database=$database";
            $this->conn = new PDO($dsn, $username, $password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch (PDOException $e) {
            $this->conn = null;
            $this->lastError = $e->getMessage();
        }
    }

    public function hasError(): bool
    {
        return $this->conn === null;
    }

    public function getError(): string
    {
        return $this->lastError ?? 'Unknown database error';
    }

    public function callProcedure(string $procedure, array $params = []): array
    {
        if ($this->hasError()) {
            throw new Exception('Database connection error: ' . $this->getError());
        }

        try {
            $isNamed = $this->isAssoc($params);

            if ($isNamed) {
                $placeholders = implode(', ', array_map(
                    fn($key) => "$key = ?",
                    array_keys($params)
                ));
                $args = array_values($params);
            } else {
                $placeholders = implode(', ', array_fill(0, count($params), '?'));
                $args = $params;
            }

            $sql = sprintf("EXEC %s %s", $procedure, $placeholders);
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($args);

            return $stmt->fetchAll(PDO::FETCH_ASSOC);

        } catch (PDOException $e) {
            throw new Exception('SQL Procedure error: ' . $e->getMessage());
        }
    }

    public function callProcedureMultiple(string $procedure, array $params = []): array
    {
        if ($this->hasError()) {
            throw new Exception('Database connection error: ' . $this->getError());
        }

        try {
            $isNamed = $this->isAssoc($params);

            if ($isNamed) {
                $placeholders = implode(', ', array_map(
                    fn($key) => "$key = ?",
                    array_keys($params)
                ));
                $args = array_values($params);
            } else {
                $placeholders = implode(', ', array_fill(0, count($params), '?'));
                $args = $params;
            }

            $sql = sprintf("EXEC %s %s", $procedure, $placeholders);
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($args);

            $results = [];
            do {
                $results[] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } while ($stmt->nextRowset());

            return $results;

        } catch (PDOException $e) {
            throw new Exception('SQL Procedure (multi) error: ' . $e->getMessage());
        }
    }

    public function query(string $sql, array $params = []): array
    {
        if ($this->hasError()) {
            throw new Exception('Database connection error: ' . $this->getError());
        }

        try {
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);

            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            throw new Exception('SQL error: ' . $e->getMessage());
        }
    }

    private function isAssoc(array $arr): bool
    {
        if ([] === $arr) {
            return false;
        }

        return array_keys($arr) !== range(0, count($arr) - 1);
    }

    public function close(): void
    {
        $this->conn = null;
    }
}