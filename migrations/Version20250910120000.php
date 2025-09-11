<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Add thumbnail_path column for optimized attachment handling
 */
final class Version20250910120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add thumbnail_path column to file_attachments table for optimized thumbnail handling';
    }

    public function up(Schema $schema): void
    {
        // Skip if column already exists (added by Version20250910121000)
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(500) DEFAULT NULL');
        
        // Update existing records to populate thumbnail_path from metadata
        $this->addSql("
            UPDATE file_attachments 
            SET thumbnail_path = CASE 
                WHEN metadata->>'thumbnail' IS NOT NULL 
                THEN CONCAT(storage_path, '/', metadata->>'thumbnail')
                ELSE NULL 
            END
            WHERE metadata IS NOT NULL AND metadata->>'thumbnail' IS NOT NULL
              AND thumbnail_path IS NULL
        ");
    }

    public function down(Schema $schema): void
    {
        // Skip - handled by Version20250910121000
        $this->addSql('SELECT 1'); // Dummy query to avoid empty migration
    }
}