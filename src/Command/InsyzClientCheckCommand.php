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
 * je odsud dosažitelný a že v jeho databázi existuje tabulka trasy.ptUzivatele
 * s potřebnými sloupci.
 *
 * Pouští se na serveru, kde jsou vyplněná hesla a je odtud síťová cesta do INSYZ.
 */
#[AsCommand(
    name: 'insyz:client:check',
    description: 'Ověří dostupnost databází pro vydávání hesel desktopovému klientovi'
)]
class InsyzClientCheckCommand extends Command
{
    private const REQUIRED_COLUMNS = ['Uziv_Info', 'ActUser', 'Platnost_Od', 'Platnost_Do'];

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
        $failed = 0;

        foreach ($accounts as $key => $account) {
            [$status, $detail] = $this->checkAccount((string) $key, $account);

            if ($status !== 'OK') {
                $failed++;
            }

            $rows[] = [$key, $account['host'], $account['database'], $status, $detail];
        }

        $io->table(['Klíč', 'Server', 'Databáze', 'Stav', 'Detail'], $rows);

        if ($failed > 0) {
            $io->error(sprintf('Nefunkčních účtů: %d. Takový klíč nenechávej v konfiguraci.', $failed));

            return Command::FAILURE;
        }

        $io->success('Všechny nakonfigurované účty jsou dosažitelné a mají trasy.ptUzivatele.');

        return Command::SUCCESS;
    }

    /**
     * @param array{host: string, database: string, user: string, password: string} $account
     *
     * @return array{0: string, 1: string}
     */
    private function checkAccount(string $key, array $account): array
    {
        if (($account['password'] ?? '') === '') {
            return ['CHYBA', 'Prázdné heslo v env — klíč je neaktivní'];
        }

        $placeholders = implode(', ', array_fill(0, count(self::REQUIRED_COLUMNS), '?'));

        try {
            $rows = $this->connections->query(
                $key,
                $account,
                "SELECT COUNT(*) AS Pocet FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = 'trasy' AND TABLE_NAME = 'ptUzivatele'
                   AND COLUMN_NAME IN ($placeholders)",
                self::REQUIRED_COLUMNS
            );
            $found = (int) ($rows[0]['Pocet'] ?? 0);
        } catch (\Throwable $e) {
            return ['CHYBA', 'Spojení nebo dotaz selhal: ' . $this->shorten($e->getMessage())];
        }

        if ($found === 0) {
            return ['CHYBA', 'Tabulka trasy.ptUzivatele v této databázi není'];
        }

        if ($found < count(self::REQUIRED_COLUMNS)) {
            return ['CHYBA', sprintf(
                'trasy.ptUzivatele nemá všechny sloupce (%d ze %d z %s)',
                $found,
                count(self::REQUIRED_COLUMNS),
                implode(', ', self::REQUIRED_COLUMNS)
            )];
        }

        return ['OK', 'Dosažitelné, trasy.ptUzivatele v pořádku'];
    }

    private function shorten(string $message): string
    {
        $message = preg_replace('/\s+/', ' ', $message) ?? $message;

        return mb_strlen($message) > 160 ? mb_substr($message, 0, 157) . '...' : $message;
    }
}
