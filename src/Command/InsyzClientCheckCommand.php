<?php

namespace App\Command;

use App\Service\InsyzClientConnectionPool;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Ověří, že každý nakonfigurovaný účet endpointu /api/insyz-client/db-password
 * je odsud dosažitelný a že v jeho databázi jsou obě tabulky, které ověření
 * uživatele potřebuje: trasy.ptUzivatele (ActUser, Uziv_Info)
 * a vsichni.UserInfo (ActUser).
 *
 * Pouští se na serveru, kde jsou vyplněná hesla a je odtud síťová cesta do INSYZ.
 */
#[AsCommand(
    name: 'insyz:client:check',
    description: 'Ověří dostupnost databází pro vydávání hesel desktopovému klientovi'
)]
class InsyzClientCheckCommand extends Command
{
    /** Tabulka => sloupce, které ověření uživatele potřebuje */
    private const REQUIRED = [
        'trasy.ptUzivatele' => ['ActUser', 'Uziv_Info'],
        'vsichni.UserInfo' => ['ActUser'],
    ];

    /**
     * @param array<string, array{host: string, database: string, user: string, password: string}> $accounts
     */
    public function __construct(
        private InsyzClientConnectionPool $connections,
        private array $accounts
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('key', InputArgument::OPTIONAL, 'Ověřit jen jeden klíč (např. db6273)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $onlyKey = $input->getArgument('key');

        if (!in_array('sqlsrv', \PDO::getAvailableDrivers(), true)) {
            $io->error('PDO driver "sqlsrv" tu není — ověření pouštěj na serveru, kde běží INSYZ integrace.');

            return Command::FAILURE;
        }

        $accounts = $this->accounts;

        if ($onlyKey !== null) {
            if (!isset($accounts[$onlyKey])) {
                $io->error(sprintf('Klíč "%s" není v konfiguraci (config/services.yaml).', $onlyKey));

                return Command::FAILURE;
            }

            $accounts = [$onlyKey => $accounts[$onlyKey]];
        }

        if ($accounts === []) {
            $io->warning('V konfiguraci není žádný účet.');

            return Command::FAILURE;
        }

        $rows = [];
        $diagnostics = [];
        $failed = 0;

        foreach ($accounts as $key => $account) {
            [$status, $detail, $tables] = $this->checkAccount((string) $key, $account);

            if ($status !== 'OK') {
                $failed++;
            }

            if ($tables !== []) {
                $diagnostics[(string) $key] = $tables;
            }

            $rows[] = [$key, $account['host'], $account['database'], $status, $detail];
        }

        $io->table(['Klíč', 'Server', 'Databáze', 'Stav', 'Detail'], $rows);

        // Když sloupce nesedí, vypiš, co v tabulce doopravdy je — ať se nemusí hádat
        foreach ($diagnostics as $key => $tables) {
            foreach ($tables as $table => $columns) {
                $io->section(sprintf('Sloupce v %s (%s)', $table, $key));
                $io->writeln(wordwrap(implode(', ', $columns), 110));
                $io->newLine();
            }
        }

        if ($failed > 0) {
            $io->error(sprintf('Nefunkčních účtů: %d. Takový klíč nenechávej v konfiguraci.', $failed));

            return Command::FAILURE;
        }

        $io->success('Všechny nakonfigurované účty jsou dosažitelné a mají obě potřebné tabulky.');

        return Command::SUCCESS;
    }

    /**
     * @param array{host: string, database: string, user: string, password: string} $account
     *
     * @return array{0: string, 1: string, 2: array<string, array<int, string>>} stav, detail,
     *         a při neshodě sloupce dotčených tabulek, aby nebylo nutné hádat jejich názvy
     */
    private function checkAccount(string $key, array $account): array
    {
        if (($account['password'] ?? '') === '') {
            return ['CHYBA', 'Prázdné heslo v env — klíč je neaktivní', []];
        }

        $problems = [];
        $diagnostics = [];

        foreach (self::REQUIRED as $table => $requiredColumns) {
            [$schema, $name] = explode('.', $table);

            try {
                $rows = $this->connections->query(
                    $key,
                    $account,
                    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                     ORDER BY COLUMN_NAME',
                    [$schema, $name]
                );
            } catch (\Throwable $e) {
                return ['CHYBA', 'Spojení nebo dotaz selhal: ' . $this->shorten($e->getMessage()), []];
            }

            $columns = array_map(static fn (array $row) => (string) $row['COLUMN_NAME'], $rows);

            if ($columns === []) {
                $problems[] = sprintf('tabulka %s v této databázi není', $table);

                continue;
            }

            $missing = array_diff($requiredColumns, $columns);

            if ($missing !== []) {
                $problems[] = sprintf('%s nemá sloupce: %s', $table, implode(', ', $missing));
                $diagnostics[$table] = $columns;
            }
        }

        if ($problems !== []) {
            return ['CHYBA', implode('; ', $problems), $diagnostics];
        }

        return ['OK', 'Dosažitelné, obě tabulky v pořádku', []];
    }

    private function shorten(string $message): string
    {
        $message = preg_replace('/\s+/', ' ', $message) ?? $message;

        return mb_strlen($message) > 160 ? mb_substr($message, 0, 157) . '...' : $message;
    }
}
