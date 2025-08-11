<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Create insyz_audit_logs table for INSYZ API call auditing
 */
final class Version20250808120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create insyz_audit_logs table for comprehensive INSYZ API audit logging';
    }

    public function up(Schema $schema): void
    {
        // Create insyz_audit_logs table
        $this->addSql('CREATE TABLE insyz_audit_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            int_adr INTEGER NOT NULL,
            endpoint VARCHAR(255) NOT NULL,
            method VARCHAR(10) NOT NULL,
            mssql_procedure VARCHAR(100),
            request_params JSON,
            response_summary JSON,
            cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
            duration_ms INTEGER NOT NULL,
            mssql_duration_ms INTEGER,
            status VARCHAR(20) NOT NULL DEFAULT \'success\',
            error_message TEXT,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )');

        // Add foreign key constraint to users table
        $this->addSql('ALTER TABLE insyz_audit_logs 
            ADD CONSTRAINT FK_INSYZ_AUDIT_USER 
            FOREIGN KEY (user_id) REFERENCES users (id) 
            ON DELETE SET NULL');

        // Add indexes for performance
        $this->addSql('CREATE INDEX idx_insyz_audit_user_created ON insyz_audit_logs (user_id, created_at)');
        $this->addSql('CREATE INDEX idx_insyz_audit_endpoint_created ON insyz_audit_logs (endpoint, created_at)');
        $this->addSql('CREATE INDEX idx_insyz_audit_intadr_created ON insyz_audit_logs (int_adr, created_at)');
        $this->addSql('CREATE INDEX idx_insyz_audit_procedure_created ON insyz_audit_logs (mssql_procedure, created_at)');
        $this->addSql('CREATE INDEX idx_insyz_audit_status_created ON insyz_audit_logs (status, created_at)');

        // Add index for cleanup operations
        $this->addSql('CREATE INDEX idx_insyz_audit_created_at ON insyz_audit_logs (created_at)');

        // Add index for performance analysis
        $this->addSql('CREATE INDEX idx_insyz_audit_duration ON insyz_audit_logs (duration_ms, created_at)');
        $this->addSql('CREATE INDEX idx_insyz_audit_mssql_duration ON insyz_audit_logs (mssql_duration_ms, created_at)');
    }

    public function down(Schema $schema): void
    {
        // Drop indexes first
        $this->addSql('DROP INDEX IF EXISTS idx_insyz_audit_mssql_duration');
        $this->addSql('DROP INDEX IF EXISTS idx_insyz_audit_duration');
        $this->addSql('DROP INDEX IF EXISTS idx_insyz_audit_created_at');
        $this->addSql('DROP INDEX IF EXISTS idx_insyz_audit_status_created');
        $this->addSql('DROP INDEX IF EXISTS idx_insyz_audit_procedure_created');
        $this->addSql('DROP INDEX IF EXISTS idx_insyz_audit_intadr_created');
        $this->addSql('DROP INDEX IF EXISTS idx_insyz_audit_endpoint_created');
        $this->addSql('DROP INDEX IF EXISTS idx_insyz_audit_user_created');

        // Drop foreign key constraint
        $this->addSql('ALTER TABLE insyz_audit_logs DROP CONSTRAINT IF EXISTS FK_INSYZ_AUDIT_USER');

        // Drop table
        $this->addSql('DROP TABLE IF EXISTS insyz_audit_logs');
    }
}