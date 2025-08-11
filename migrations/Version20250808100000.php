<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Create users table for local user management
 */
final class Version20250808100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create users table for user management and preferences';
    }

    public function up(Schema $schema): void
    {
        // Create users table
        $this->addSql('CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            int_adr INTEGER UNIQUE NOT NULL,
            email VARCHAR(255) NOT NULL,
            jmeno VARCHAR(255),
            prijmeni VARCHAR(255),
            prukaz_znackare VARCHAR(50),
            roles JSON DEFAULT \'["ROLE_USER"]\' NOT NULL,
            preferences JSON DEFAULT \'{}\' NOT NULL,
            settings JSON DEFAULT \'{}\' NOT NULL,
            last_login_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT true NOT NULL
        )');
        
        // Create indexes
        $this->addSql('CREATE INDEX idx_users_email ON users(email)');
        $this->addSql('CREATE INDEX idx_users_last_login ON users(last_login_at)');
        $this->addSql('CREATE INDEX idx_users_is_active ON users(is_active)');
        
        // Add trigger for updated_at
        $this->addSql('
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language \'plpgsql\';
        ');
        
        $this->addSql('
            CREATE TRIGGER update_users_updated_at 
            BEFORE UPDATE ON users 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
        ');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TRIGGER IF EXISTS update_users_updated_at ON users');
        $this->addSql('DROP FUNCTION IF EXISTS update_updated_at_column()');
        $this->addSql('DROP TABLE users');
    }
}