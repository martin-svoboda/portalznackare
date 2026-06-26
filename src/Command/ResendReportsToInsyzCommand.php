<?php

namespace App\Command;

use App\Entity\Report;
use App\Enum\ReportStateEnum;
use App\Message\SendToInsyzMessage;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\HttpKernel\KernelInterface;
use Symfony\Component\Messenger\MessageBusInterface;

#[AsCommand(
    name: 'app:reports:resend-insyz',
    description: 'Hromadně znovu odešle už odeslaná hlášení do INSYZ (výpis; odeslání s --force)',
)]
class ResendReportsToInsyzCommand extends Command
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private MessageBusInterface $messageBus,
        private KernelInterface $kernel
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('force', null, InputOption::VALUE_NONE, 'Skutečně odeslat (jinak jen výpis)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $states = [ReportStateEnum::SUBMITTED, ReportStateEnum::APPROVED];
        $reports = $this->entityManager->getRepository(Report::class)->findBy(['state' => $states]);

        if (!$reports) {
            $io->warning('Žádná hlášení k odeslání.');
            return Command::SUCCESS;
        }

        $io->title('Hromadné znovuodeslání do INSYZ');
        foreach ($reports as $report) {
            $io->writeln(sprintf('#%d  %s  [%s]', $report->getId(), $report->getCisloZp(), $report->getState()->value));
        }

        if (!$input->getOption('force')) {
            $io->note(sprintf('%d hlášení. Spusť s --force pro odeslání.', count($reports)));
            return Command::SUCCESS;
        }

        if (!$io->confirm(sprintf('Opravdu znovu odeslat %d hlášení do INSYZ?', count($reports)), false)) {
            return Command::SUCCESS;
        }

        foreach ($reports as $report) {
            $report->setState(ReportStateEnum::SEND);
        }
        $this->entityManager->flush();

        foreach ($reports as $report) {
            $this->messageBus->dispatch(new SendToInsyzMessage(
                $report->getId(),
                [
                    'id_zp' => $report->getIdZp(),
                    'cislo_zp' => $report->getCisloZp(),
                    'znackari' => $report->getTeamMembers(),
                    'data_a' => $report->getDataA(),
                    'data_b' => $report->getDataB(),
                    'calculation' => $report->getCalculation(),
                ],
                $this->kernel->getEnvironment()
            ));
        }

        $io->success(sprintf('Odesláno %d hlášení do INSYZ.', count($reports)));
        return Command::SUCCESS;
    }
}
