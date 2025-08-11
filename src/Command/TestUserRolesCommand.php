<?php

namespace App\Command;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Security\Core\Security;

#[AsCommand(name: 'app:test-user-roles')]
class TestUserRolesCommand extends Command
{
    public function __construct(
        private Security $security
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $user = $this->security->getUser();
        
        if (!$user) {
            $output->writeln('No user logged in');
            return Command::FAILURE;
        }
        
        $output->writeln('Current user: ' . $user->getUserIdentifier());
        $output->writeln('Roles: ' . json_encode($user->getRoles()));
        $output->writeln('Has ROLE_ADMIN: ' . ($this->security->isGranted('ROLE_ADMIN') ? 'YES' : 'NO'));
        $output->writeln('Has ROLE_SUPER_ADMIN: ' . ($this->security->isGranted('ROLE_SUPER_ADMIN') ? 'YES' : 'NO'));
        
        return Command::SUCCESS;
    }
}