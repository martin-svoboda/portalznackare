<?php

namespace App\Command;

use App\Entity\AuditLog;
use App\Entity\User;
use App\Repository\AuditLogRepository;
use App\Repository\UserRepository;
use App\Service\AuditLogger;
use App\Service\InsyzService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:user:manage',
    description: 'Manage users - list, sync from INSYZ, add/remove roles',
)]
class UserManageCommand extends Command
{
    public function __construct(
        private UserRepository $userRepository,
        private InsyzService $insyzService,
        private AuditLogger $auditLogger,
        private AuditLogRepository $auditLogRepository
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('action', InputArgument::REQUIRED, 'Action to perform: list|sync|role|show|activate|deactivate')
            ->addArgument('identifier', InputArgument::OPTIONAL, 'User INT_ADR or email')
            ->addOption('role', 'r', InputOption::VALUE_REQUIRED, 'Role for role actions')
            ->addOption('add', 'a', InputOption::VALUE_NONE, 'Add role (default is remove)')
            ->addOption('filter', 'f', InputOption::VALUE_REQUIRED, 'Filter for list action (active|admin|recent)')
            ->addOption('search', 's', InputOption::VALUE_REQUIRED, 'Search query for list action')
        ;
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $action = $input->getArgument('action');
        $identifier = $input->getArgument('identifier');

        return match($action) {
            'list' => $this->listUsers($io, $input),
            'sync' => $this->syncUser($io, $identifier),
            'role' => $this->manageRole($io, $identifier, $input),
            'show' => $this->showUser($io, $identifier),
            'activate' => $this->toggleUser($io, $identifier, true),
            'deactivate' => $this->toggleUser($io, $identifier, false),
            default => $this->showHelp($io),
        };
    }

    private function listUsers(SymfonyStyle $io, InputInterface $input): int
    {
        $filter = $input->getOption('filter');
        $search = $input->getOption('search');

        if ($search) {
            $users = $this->userRepository->search($search);
            $io->title("Users matching: $search");
        } elseif ($filter === 'admin') {
            $users = $this->userRepository->findAdmins();
            $io->title('Admin Users');
        } elseif ($filter === 'recent') {
            $users = $this->userRepository->findRecentlyActive();
            $io->title('Recently Active Users (30 days)');
        } else {
            $users = $this->userRepository->findBy(['isActive' => true], ['prijmeni' => 'ASC', 'jmeno' => 'ASC']);
            $io->title('Active Users');
        }

        if (empty($users)) {
            $io->warning('No users found.');
            return Command::SUCCESS;
        }

        $rows = [];
        foreach ($users as $user) {
            $rows[] = [
                $user->getId(),
                $user->getIntAdr(),
                $user->getFullName(),
                $user->getEmail(),
                implode(', ', $user->getRoles()),
                $user->getLastLoginAt()?->format('Y-m-d H:i') ?? 'Never',
                $user->isActive() ? 'Yes' : 'No',
            ];
        }

        $io->table(
            ['ID', 'INT_ADR', 'Name', 'Email', 'Roles', 'Last Login', 'Active'],
            $rows
        );

        $io->success(sprintf('Found %d users.', count($users)));

        return Command::SUCCESS;
    }

    private function syncUser(SymfonyStyle $io, ?string $identifier): int
    {
        if (!$identifier) {
            $io->error('User INT_ADR is required for sync action.');
            return Command::FAILURE;
        }

        if (!is_numeric($identifier)) {
            $io->error('Only INT_ADR is supported for sync action.');
            return Command::FAILURE;
        }

        $io->section("Syncing user INT_ADR: $identifier");

        try {
            // Load from INSYZ
            $userData = $this->insyzService->getUser((int)$identifier);
            
            if (!$userData || (is_array($userData) && empty($userData))) {
                $io->error("User not found in INSYZ.");
                return Command::FAILURE;
            }

            // If array of users, take the first one
            if (is_array($userData) && isset($userData[0])) {
                $userData = $userData[0];
            }

            // Sync to database
            $user = $this->userRepository->findOrCreateFromInsyzData($userData);

            $io->success(sprintf(
                'User synced: %s (%s) - %s',
                $user->getFullName(),
                $user->getEmail(),
                implode(', ', $user->getRoles())
            ));

            // Log the sync
            $this->auditLogger->logByIntAdr(
                $user->getIntAdr(),
                'user_sync',
                'User',
                (string) $user->getId(),
                null,
                ['source' => 'console_command']
            );

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $io->error('Failed to sync user: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }

    private function manageRole(SymfonyStyle $io, ?string $identifier, InputInterface $input): int
    {
        if (!$identifier) {
            $io->error('User identifier is required for role action.');
            return Command::FAILURE;
        }

        $role = $input->getOption('role');
        if (!$role) {
            $io->error('Role is required. Use --role option.');
            return Command::FAILURE;
        }

        $validRoles = ['ROLE_USER', 'ROLE_VEDOUCI', 'ROLE_ADMIN', 'ROLE_SUPER_ADMIN'];
        if (!in_array($role, $validRoles)) {
            $io->error(sprintf('Invalid role. Valid roles are: %s', implode(', ', $validRoles)));
            return Command::FAILURE;
        }

        $user = $this->findUser($identifier);
        if (!$user) {
            $io->error('User not found.');
            return Command::FAILURE;
        }

        $oldRoles = $user->getRoles();
        
        if ($input->getOption('add')) {
            $user->addRole($role);
            $action = 'added to';
        } else {
            $user->removeRole($role);
            $action = 'removed from';
        }

        $this->userRepository->save($user, true);

        $io->success(sprintf(
            'Role %s %s user %s (%s)',
            $role,
            $action,
            $user->getFullName(),
            $user->getEmail()
        ));

        // Log the change
        $this->auditLogger->logByIntAdr(
            $user->getIntAdr(),
            AuditLog::ACTION_USER_ROLE_CHANGE,
            'User',
            (string) $user->getId(),
            ['roles' => $oldRoles],
            ['roles' => $user->getRoles()]
        );

        return Command::SUCCESS;
    }

    private function showUser(SymfonyStyle $io, ?string $identifier): int
    {
        if (!$identifier) {
            $io->error('User identifier is required.');
            return Command::FAILURE;
        }

        $user = $this->findUser($identifier);
        if (!$user) {
            $io->error('User not found.');
            return Command::FAILURE;
        }

        $io->title('User Details');

        $io->table(
            ['Property', 'Value'],
            [
                ['ID', $user->getId()],
                ['INT_ADR', $user->getIntAdr()],
                ['Name', $user->getFullName()],
                ['Email', $user->getEmail()],
                ['Průkaz značkaře', $user->getPrukazZnackare() ?? 'N/A'],
                ['Roles', implode(', ', $user->getRoles())],
                ['Active', $user->isActive() ? 'Yes' : 'No'],
                ['Created', $user->getCreatedAt()->format('Y-m-d H:i:s')],
                ['Updated', $user->getUpdatedAt()->format('Y-m-d H:i:s')],
                ['Last Login', $user->getLastLoginAt()?->format('Y-m-d H:i:s') ?? 'Never'],
            ]
        );

        // Show preferences if any
        if (!empty($user->getPreferences())) {
            $io->section('Preferences');
            $io->listing(array_map(
                fn($key, $value) => "$key: " . json_encode($value),
                array_keys($user->getPreferences()),
                array_values($user->getPreferences())
            ));
        }

        // Show recent activity
        $io->section('Recent Activity');
        $auditLogs = $this->auditLogRepository->findByIntAdr($user->getIntAdr(), 10);
        
        if (empty($auditLogs)) {
            $io->text('No recent activity.');
        } else {
            $rows = [];
            foreach ($auditLogs as $log) {
                $rows[] = [
                    $log->getCreatedAt()->format('Y-m-d H:i'),
                    $log->getActionLabel(),
                    $log->getEntityType() ?? 'N/A',
                    $log->getIpAddress() ?? 'N/A',
                ];
            }
            $io->table(['Date', 'Action', 'Entity', 'IP'], $rows);
        }

        return Command::SUCCESS;
    }

    private function toggleUser(SymfonyStyle $io, ?string $identifier, bool $activate): int
    {
        if (!$identifier) {
            $io->error('User identifier is required.');
            return Command::FAILURE;
        }

        $user = $this->findUser($identifier);
        if (!$user) {
            $io->error('User not found.');
            return Command::FAILURE;
        }

        $user->setIsActive($activate);
        $this->userRepository->save($user, true);

        $action = $activate ? 'activated' : 'deactivated';
        $io->success(sprintf(
            'User %s (%s) has been %s.',
            $user->getFullName(),
            $user->getEmail(),
            $action
        ));

        // Log the change
        $this->auditLogger->logByIntAdr(
            $user->getIntAdr(),
            'user_status_change',
            'User',
            (string) $user->getId(),
            ['is_active' => !$activate],
            ['is_active' => $activate]
        );

        return Command::SUCCESS;
    }

    private function findUser(string $identifier): ?User
    {
        if (is_numeric($identifier)) {
            return $this->userRepository->findByIntAdr((int)$identifier);
        }
        
        if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
            return $this->userRepository->findByEmail($identifier);
        }

        return null;
    }

    private function showHelp(SymfonyStyle $io): int
    {
        $io->title('User Management Command Help');
        
        $io->section('Available Actions');
        $io->listing([
            'list - List users (use --filter=active|admin|recent or --search="query")',
            'sync <INT_ADR> - Sync user data from INSYZ',
            'role <identifier> --role=ROLE_NAME [--add] - Add or remove role',
            'show <identifier> - Show detailed user information',
            'activate <identifier> - Activate user',
            'deactivate <identifier> - Deactivate user',
        ]);

        $io->section('Examples');
        $io->listing([
            'php bin/console app:user:manage list',
            'php bin/console app:user:manage list --filter=admin',
            'php bin/console app:user:manage list --search="Jan"',
            'php bin/console app:user:manage sync 12345',
            'php bin/console app:user:manage role 12345 --role=ROLE_ADMIN --add',
            'php bin/console app:user:manage role user@example.com --role=ROLE_VEDOUCI',
            'php bin/console app:user:manage show 12345',
            'php bin/console app:user:manage deactivate user@example.com',
        ]);

        return Command::SUCCESS;
    }
}