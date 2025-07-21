<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Initial migration for Portal Značkaře
 */
final class Version20250121120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Initial database schema for Portal Značkaře';
    }

    public function up(Schema $schema): void
    {
        // Create reports table
        $this->addSql('
            CREATE TABLE reports (
                id SERIAL PRIMARY KEY,
                id_zp INTEGER NOT NULL,
                int_adr INTEGER NOT NULL,
                data_a JSON NOT NULL DEFAULT \'{}\'::json,
                data_b JSON NOT NULL DEFAULT \'{}\'::json,
                state VARCHAR(50) NOT NULL DEFAULT \'draft\',
                created_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        ');

        // Create file_attachments table
        $this->addSql('
            CREATE TABLE file_attachments (
                id SERIAL PRIMARY KEY,
                hash VARCHAR(255) NOT NULL UNIQUE,
                original_name VARCHAR(255) NOT NULL,
                stored_name VARCHAR(255) NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                size INTEGER NOT NULL,
                path VARCHAR(500) NOT NULL,
                public_url VARCHAR(500) NOT NULL,
                is_public BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        ');

        // Create basic indexes
        $this->addSql('CREATE INDEX idx_reports_id_zp ON reports (id_zp)');
        $this->addSql('CREATE INDEX idx_reports_int_adr ON reports (int_adr)');
        $this->addSql('CREATE INDEX idx_reports_state ON reports (state)');
        
        $this->addSql('CREATE INDEX idx_file_hash ON file_attachments (hash)');
        $this->addSql('CREATE INDEX idx_file_public ON file_attachments (is_public)');

        // Add constraints
        $this->addSql('
            ALTER TABLE reports 
            ADD CONSTRAINT chk_report_state 
            CHECK (state IN (\'draft\', \'submitted\', \'approved\', \'rejected\'))
        ');

        $this->addSql('
            ALTER TABLE file_attachments 
            ADD CONSTRAINT chk_file_size 
            CHECK (size > 0)
        ');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE IF EXISTS file_attachments');
        $this->addSql('DROP TABLE IF EXISTS reports');
    }
}