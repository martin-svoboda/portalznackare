<?php

namespace App\Command;

use App\Entity\Report;
use App\Service\InsyzService;
use App\Service\ReportXmlDataFixer;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Hromadná oprava uložených dat hlášení do konzistentního tvaru pro INSYZ XML.
 * Opravuje: datum noclehu, duplicitní předměty, ID úseku (EvCi_Tra → ID úseku).
 *
 * BEZPEČNOST:
 *  - Výchozí režim je DRY-RUN (nic nezapisuje). Zápis až s --force.
 *  - Před zápisem uloží zálohu původních data_a/data_b/calculation do historie hlášení.
 *  - NIKDY znovu neodesílá hlášení do INSYZ (stav se nemění).
 */
#[AsCommand(
    name: 'app:reports:fix-xml-data',
    description: 'Hromadně opraví uložená data hlášení pro správné generování INSYZ XML (dry-run; zápis s --force)',
)]
class FixReportXmlDataCommand extends Command
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ReportXmlDataFixer $fixer,
        private InsyzService $insyzService
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('ids', InputArgument::IS_ARRAY | InputArgument::OPTIONAL, 'Konkrétní ID hlášení (jinak všechna)')
            ->addOption('force', null, InputOption::VALUE_NONE, 'Skutečně zapsat změny (jinak jen dry-run)')
            ->addOption('state', null, InputOption::VALUE_REQUIRED, 'Filtr na stav hlášení (např. draft, submitted)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $force = (bool) $input->getOption('force');
        $ids = array_map('intval', (array) $input->getArgument('ids'));
        $stateFilter = $input->getOption('state');

        $io->title('Oprava dat hlášení pro INSYZ XML' . ($force ? ' (ZÁPIS)' : ' (DRY-RUN)'));

        $criteria = [];
        if ($ids) {
            $criteria['id'] = $ids;
        }
        if ($stateFilter) {
            $criteria['state'] = $stateFilter;
        }

        $repo = $this->entityManager->getRepository(Report::class);
        /** @var Report[] $reports */
        $reports = $criteria ? $repo->findBy($criteria) : $repo->findAll();

        if (!$reports) {
            $io->warning('Žádná hlášení k zpracování.');
            return Command::SUCCESS;
        }

        $io->text(sprintf('Nalezeno %d hlášení.%s', count($reports), $force ? '' : ' Režim dry-run – nic se nezapisuje.'));
        $io->newline();

        $changedCount = 0;
        $totalChanges = 0;
        $totalWarnings = 0;

        foreach ($reports as $report) {
            $useky = $this->loadUseky($report, $io);

            $result = $this->fixer->fix(
                $report->getDataA(),
                $report->getDataB(),
                $report->getCalculation(),
                $useky
            );

            if (!$result['changed'] && empty($result['warnings'])) {
                continue;
            }

            $io->section(sprintf('Hlášení #%d – %s [%s]', $report->getId(), $report->getCisloZp(), $report->getState()->value));

            foreach ($result['changes'] as $change) {
                $io->writeln('  <info>✓</info> ' . $change);
            }
            foreach ($result['warnings'] as $warning) {
                $io->writeln('  <comment>!</comment> ' . $warning);
            }

            $totalChanges += count($result['changes']);
            $totalWarnings += count($result['warnings']);

            if (!$result['changed']) {
                continue; // jen varování, žádná změna dat
            }

            $changedCount++;

            if ($force) {
                // Záloha původních dat do historie (pro případný ruční rollback)
                $report->addHistoryEntry(
                    'admin_data_fix',
                    0,
                    'Hromadná oprava dat pro INSYZ XML',
                    [
                        'changes' => $result['changes'],
                        'warnings' => $result['warnings'],
                        'backup' => [
                            'data_a' => $report->getDataA(),
                            'data_b' => $report->getDataB(),
                            'calculation' => $report->getCalculation(),
                        ],
                    ]
                );

                $report->setDataA($result['data_a']);
                $report->setDataB($result['data_b']);
                $report->setCalculation($result['calculation']);

                $this->entityManager->persist($report);
            }
        }

        if ($force) {
            $this->entityManager->flush();
        }

        $io->newline();
        $io->success(sprintf(
            '%s: %d hlášení se změnami (%d úprav, %d varování).%s',
            $force ? 'Zapsáno' : 'Dry-run',
            $changedCount,
            $totalChanges,
            $totalWarnings,
            $force ? '' : ' Spusť s --force pro zápis.'
        ));

        return Command::SUCCESS;
    }

    /**
     * Načte úseky příkazu z INSYZ pro mapu EvCi_Tra → ID úseku.
     * Při selhání vrátí null (oprava úseků se pro dané hlášení přeskočí).
     */
    private function loadUseky(Report $report, SymfonyStyle $io): ?array
    {
        try {
            $detail = $this->insyzService->getPrikaz($report->getIntAdr(), $report->getIdZp(), true);
            $useky = $detail['useky'] ?? null;
            return is_array($useky) ? $useky : null;
        } catch (\Throwable $e) {
            $io->writeln(sprintf('  <comment>!</comment> Hlášení #%d: úseky z INSYZ nedostupné (%s)', $report->getId(), $e->getMessage()));
            return null;
        }
    }
}
