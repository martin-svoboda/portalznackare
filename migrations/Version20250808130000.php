<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Add INSYZ audit system_options configuration
 */
final class Version20250808130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add INSYZ audit system_options configuration for comprehensive API monitoring';
    }

    public function up(Schema $schema): void
    {
        // Insert INSYZ audit configuration options
        $this->addSql('
            INSERT INTO system_options (option_name, option_value, autoload) 
            VALUES 
            (?, ?::json, true),
            (?, ?::json, true),
            (?, ?::json, true),
            (?, ?::json, true),
            (?, ?::json, true),
            (?, ?::json, true),
            (?, ?::json, true),
            (?, ?::json, true),
            (?, ?::json, true)
        ', [
            'insyz_audit.enabled', json_encode(true),
            'insyz_audit.log_requests', json_encode(true),
            'insyz_audit.log_responses', json_encode(true),
            'insyz_audit.log_mssql_queries', json_encode(true),
            'insyz_audit.log_cache_operations', json_encode(true),
            'insyz_audit.retention_days', json_encode(90),
            'insyz_audit.slow_query_threshold_ms', json_encode(2000),
            'insyz_audit.log_user_agents', json_encode(true),
            'insyz_audit.log_ip_addresses', json_encode(true)
        ]);
    }

    public function down(Schema $schema): void
    {
        // Remove INSYZ audit configuration options
        $this->addSql("
            DELETE FROM system_options 
            WHERE option_name LIKE 'insyz_audit.%'
        ");
    }
}