<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Create audit_logs table for activity tracking
 */
final class Version20250808101000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create audit_logs table for comprehensive activity tracking';
    }

    public function up(Schema $schema): void
    {
        // Create audit_logs table
        $this->addSql('CREATE TABLE audit_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50),
            entity_id VARCHAR(50),
            old_values JSON,
            new_values JSON,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )');
        
        // Create indexes for efficient querying
        $this->addSql('CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC)');
        $this->addSql('CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id)');
        $this->addSql('CREATE INDEX idx_audit_logs_action_created ON audit_logs(action, created_at DESC)');
        $this->addSql('CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC)');
        
        // Create partial index for common queries
        $this->addSql('CREATE INDEX idx_audit_logs_entity_actions 
            ON audit_logs(entity_type, entity_id, action) 
            WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE audit_logs');
    }
}