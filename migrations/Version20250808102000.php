<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Add int_adr column to audit_logs table for cross-system user identification
 */
final class Version20250808102000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add int_adr column to audit_logs table for universal user identification across KČT systems';
    }

    public function up(Schema $schema): void
    {
        // Add int_adr column to audit_logs
        $this->addSql('ALTER TABLE audit_logs ADD COLUMN int_adr INTEGER');
        
        // Update existing records to populate int_adr from user relationship
        $this->addSql('
            UPDATE audit_logs 
            SET int_adr = u.int_adr 
            FROM users u 
            WHERE audit_logs.user_id = u.id 
            AND audit_logs.int_adr IS NULL
        ');
        
        // Add index for efficient queries by int_adr
        $this->addSql('CREATE INDEX idx_audit_logs_int_adr_created ON audit_logs(int_adr, created_at DESC)');
        
        // Add composite index for user activity queries
        $this->addSql('CREATE INDEX idx_audit_logs_int_adr_action ON audit_logs(int_adr, action)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX IF EXISTS idx_audit_logs_int_adr_created');
        $this->addSql('DROP INDEX IF EXISTS idx_audit_logs_int_adr_action');
        $this->addSql('ALTER TABLE audit_logs DROP COLUMN IF EXISTS int_adr');
    }
}