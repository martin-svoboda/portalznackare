<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Remove foreign key constraint from uploaded_by field
 * The field contains int_adr from INSYZ system, not local user ID
 */
final class Version20250910122000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Remove foreign key constraint from uploaded_by - field contains INSYZ int_adr, not local user ID';
    }

    public function up(Schema $schema): void
    {
        // Remove the foreign key constraint if it exists
        $this->addSql('ALTER TABLE file_attachments DROP CONSTRAINT IF EXISTS fk_file_uploaded_by');
        $this->addSql('ALTER TABLE file_attachments DROP CONSTRAINT IF EXISTS FK_file_uploaded_by');
        
        // The uploaded_by field remains but now stores int_adr from INSYZ
        // without foreign key constraint to local users table
    }

    public function down(Schema $schema): void
    {
        // Don't restore the constraint - it was incorrectly added
        $this->addSql('SELECT 1'); // Dummy query to avoid empty migration
    }
}