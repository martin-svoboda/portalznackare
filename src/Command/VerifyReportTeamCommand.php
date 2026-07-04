<?php

namespace App\Command;

use App\Entity\Report;
use App\Service\InsyzService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * READ-ONLY diagnostika nesouladu značkařů: porovná ULOŽENÉ značkaře v hlášení
 * (jdou do XML) s AKTUÁLNÍ hlavičkou příkazu z INSYZ a ověří vnitřní konzistenci
 * uložených dat (znackari vs účastníci vs klíče kalkulace vs řidiči).
 * Nic nemění.
 */
#[AsCommand(
    name: 'app:reports:verify-team',
    description: 'READ-ONLY: porovná uložené značkaře hlášení s aktuální hlavičkou INSYZ a ověří konzistenci',
)]
class VerifyReportTeamCommand extends Command
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private InsyzService $insyzService
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('cislo_zp', InputArgument::REQUIRED, 'Číslo ZP (např. S/BN/O/25014)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $cisloZp = $input->getArgument('cislo_zp');

        $report = $this->entityManager->getRepository(Report::class)->findOneBy(['cisloZp' => $cisloZp]);
        if (!$report) {
            $io->error("Hlášení '$cisloZp' nenalezeno.");
            return Command::FAILURE;
        }

        $dataA = $report->getDataA();
        $history = $report->getHistory();

        $io->title("Diagnostika značkařů – $cisloZp");
        $io->definitionList(
            ['ID hlášení' => $report->getId()],
            ['ID_ZP (příkaz)' => $report->getIdZp()],
            ['Stav' => $report->getState()->value],
            ['Vytvořeno' => $report->getDateCreated()->format('Y-m-d H:i:s')],
            ['První history' => $history[0]['timestamp'] ?? '—'],
            ['Poslední history' => $history ? ($history[array_key_last($history)]['timestamp'] ?? '—') : '—'],
        );

        // 1) ULOŽENÍ ZNAČKAŘI (jdou do XML)
        $savedZnackari = $report->getTeamMembers();
        $io->section('Uložení značkaři v hlášení (→ XML)');
        $rows = [];
        foreach ($savedZnackari as $m) {
            $rows[] = [
                (string) ($m['INT_ADR'] ?? '?'),
                (string) ($m['Znackar'] ?? $m['name'] ?? '?'),
                (($m['Je_Vedouci'] ?? null) === '1' || ($m['Je_Vedouci'] ?? null) === true) ? 'ano' : '',
            ];
        }
        $io->table(['INT_ADR', 'Jméno', 'Vedoucí'], $rows);
        $savedAdrs = $this->intAdrSet($savedZnackari, 'INT_ADR');

        // 2) ROZPAD ULOŽENÝCH DAT (data_a)
        $cestujciAdrs = [];
        $ridici = [];
        foreach ($dataA['Skupiny_Cest'] ?? [] as $group) {
            foreach ($group['Cestujci'] ?? [] as $c) {
                $cestujciAdrs[(string) $c] = true;
            }
            if (isset($group['Ridic']) && $group['Ridic'] !== '' && $group['Ridic'] !== null) {
                $ridici[(string) $group['Ridic']] = true;
            }
        }
        if (isset($dataA['Hlavni_Ridic']) && $dataA['Hlavni_Ridic'] !== '' && $dataA['Hlavni_Ridic'] !== null) {
            $ridici[(string) $dataA['Hlavni_Ridic']] = true;
        }
        $calcAdrs = array_fill_keys(array_map('strval', array_keys($report->getCalculation())), true);

        $io->section('Rozpad uložených dat (data_a / calculation)');
        $io->listing([
            'Účastníci (Skupiny_Cest.Cestujci): ' . $this->fmt(array_keys($cestujciAdrs)),
            'Řidiči (Ridic + Hlavni_Ridic): ' . $this->fmt(array_keys($ridici)),
            'Klíče kalkulace (INT_ADR): ' . $this->fmt(array_keys($calcAdrs)),
        ]);

        // 3) VNITŘNÍ KONZISTENCE
        $io->section('Vnitřní konzistence uložených dat');
        $consistent = true;
        $consistent &= $this->compareSets($io, 'znackari', $savedAdrs, 'účastníci', $cestujciAdrs);
        if ($calcAdrs) {
            $consistent &= $this->compareSets($io, 'znackari', $savedAdrs, 'kalkulace', $calcAdrs);
        }
        // řidiči musí být podmnožinou účastníků
        $ridiciMimo = array_diff(array_keys($ridici), array_keys($cestujciAdrs));
        if ($ridiciMimo) {
            $io->warning('Řidič(i) mimo účastníky: ' . $this->fmt($ridiciMimo));
            $consistent = false;
        }
        if ($consistent) {
            $io->success('Uložená data jsou vnitřně konzistentní – celé hlášení je postavené kolem týchž značkařů (oslabuje variantu „z jiného příkazu").');
        } else {
            $io->warning('NESOULAD uvnitř uložených dat – viz výše.');
        }

        // 4) AKTUÁLNÍ HLAVIČKA Z INSYZ
        $io->section('Aktuální hlavička příkazu z INSYZ (getPrikaz – živá data)');
        try {
            $detail = $this->insyzService->getPrikaz($report->getIntAdr(), $report->getIdZp(), true);
            $head = $detail['head'] ?? [];
            $headMembers = [];
            for ($i = 1; $i <= 3; $i++) {
                $name = $head["Znackar$i"] ?? '';
                if (trim((string) $name) === '') {
                    continue;
                }
                $headMembers[] = [
                    'INT_ADR' => (string) ($head["INT_ADR_$i"] ?? ''),
                    'name' => $name,
                    'leader' => ($head["Je_Vedouci$i"] ?? '') === '1',
                ];
            }
            $io->table(
                ['INT_ADR', 'Jméno', 'Vedoucí'],
                array_map(fn($m) => [$m['INT_ADR'], $m['name'], $m['leader'] ? 'ano' : ''], $headMembers)
            );
            $headAdrs = $this->intAdrSet($headMembers, 'INT_ADR');

            $io->section('Rozdíl: aktuální hlavička INSYZ vs. uložené hlášení');
            $onlyHead = array_diff(array_keys($headAdrs), array_keys($savedAdrs));
            $onlySaved = array_diff(array_keys($savedAdrs), array_keys($headAdrs));
            $io->listing([
                'V hlavičce navíc (přiřazeni po uložení?): ' . $this->fmt($onlyHead),
                'Jen v uloženém hlášení (odebráni z příkazu?): ' . $this->fmt($onlySaved),
            ]);
            if ($onlyHead || $onlySaved) {
                $io->note('Rozdíl potvrzen. 100% důkaz „koho INSYZ vracel při vytvoření" portál neuchovává – nutná historie přiřazení ZP ' . $report->getIdZp() . ' na straně INSYZ/KČT (viz README níže).');
            } else {
                $io->success('Hlavička i uložení se aktuálně shodují – žádný rozdíl.');
            }
        } catch (\Throwable $e) {
            $io->warning('Nepodařilo se načíst aktuální hlavičku z INSYZ: ' . $e->getMessage());
        }

        return Command::SUCCESS;
    }

    /** @return array<string,bool> množina INT_ADR jako stringy */
    private function intAdrSet(array $members, string $key): array
    {
        $set = [];
        foreach ($members as $m) {
            $v = $m[$key] ?? null;
            if ($v !== null && $v !== '') {
                $set[(string) $v] = true;
            }
        }
        return $set;
    }

    private function fmt(array $adrs): string
    {
        return $adrs ? implode(', ', $adrs) : '(žádné)';
    }

    private function compareSets(SymfonyStyle $io, string $aName, array $a, string $bName, array $b): bool
    {
        $onlyA = array_diff(array_keys($a), array_keys($b));
        $onlyB = array_diff(array_keys($b), array_keys($a));
        if (!$onlyA && !$onlyB) {
            $io->writeln("  <info>✓</info> $aName = $bName");
            return true;
        }
        $io->writeln("  <comment>✗</comment> $aName ≠ $bName  (jen v $aName: " . $this->fmt($onlyA) . " | jen v $bName: " . $this->fmt($onlyB) . ')');
        return false;
    }
}
