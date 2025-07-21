<?php

namespace App\Command;

use App\Service\FileUploadService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:files:cleanup',
    description: 'Clean up expired temporary files',
)]
class CleanupFilesCommand extends Command
{
    public function __construct(
        private FileUploadService $fileUploadService
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $io->title('Cleaning up temporary files');

        try {
            $deleted = $this->fileUploadService->cleanupFiles();
            
            $io->success(sprintf('Deleted %d expired and soft-deleted files', $deleted));
            
            return Command::SUCCESS;
        } catch (\Exception $e) {
            $io->error('Error during cleanup: ' . $e->getMessage());
            
            return Command::FAILURE;
        }
    }
}