<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Add storage_path column to file_attachments table
 */
final class Version20250807120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add storage_path column to file_attachments table if not exists';
    }

    public function up(Schema $schema): void
    {
        // Add storage_path column if it doesn't exist
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500) NOT NULL DEFAULT \'\'');
        
        // Update existing records to have storage_path based on path
        $this->addSql('UPDATE file_attachments SET storage_path = path WHERE storage_path = \'\'');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE file_attachments DROP COLUMN IF EXISTS storage_path');
    }
}