<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Create system_options table for configuration management
 */
final class Version20250808110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create system_options table for application configuration and audit system settings';
    }

    public function up(Schema $schema): void
    {
        // Create system_options table
        $this->addSql('
            CREATE TABLE system_options (
                id SERIAL PRIMARY KEY,
                option_name VARCHAR(255) UNIQUE NOT NULL,
                option_value JSON,
                autoload BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ');

        // Add indexes for performance
        $this->addSql('CREATE INDEX idx_system_options_autoload ON system_options(autoload)');
        $this->addSql('CREATE INDEX idx_system_options_name_autoload ON system_options(option_name, autoload)');

        // Add trigger for updated_at
        $this->addSql('
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language plpgsql;
        ');

        $this->addSql('
            CREATE TRIGGER update_system_options_updated_at 
            BEFORE UPDATE ON system_options 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
        ');

        // Insert default audit configuration
        $defaultAuditConfig = json_encode([
            'User' => [
                'enabled' => true,
                'events' => ['create', 'update', 'delete'],
                'masked_fields' => ['password', 'token']
            ],
            'HlaseniPrikazu' => [
                'enabled' => true,
                'events' => ['create', 'update', 'delete', 'submit'],
                'masked_fields' => []
            ],
            'FileAttachment' => [
                'enabled' => true,
                'events' => ['create', 'delete'],
                'masked_fields' => ['storage_path']
            ]
        ]);

        $this->addSql('
            INSERT INTO system_options (option_name, option_value, autoload) 
            VALUES (?, ?::json, true)
        ', ['audit.log_entities', $defaultAuditConfig]);

        // Insert other default system options
        $this->addSql('
            INSERT INTO system_options (option_name, option_value, autoload) 
            VALUES 
            (?, ?::json, true),
            (?, ?::json, true),
            (?, ?::json, false)
        ', [
            'audit.retention_days', json_encode(90),
            'audit.log_ip_addresses', json_encode(true),
            'maintenance.scheduled_downtime', json_encode(null)
        ]);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TRIGGER IF EXISTS update_system_options_updated_at ON system_options');
        $this->addSql('DROP FUNCTION IF EXISTS update_updated_at_column()');
        $this->addSql('DROP TABLE IF EXISTS system_options');
    }
}