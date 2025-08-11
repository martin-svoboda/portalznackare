<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Add missing cislo_zp column to reports table
 */
final class Version20250806145000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add missing cislo_zp column and other missing columns to reports table';
    }

    public function up(Schema $schema): void
    {
        // Add missing columns to reports table
        $this->addSql('ALTER TABLE reports ADD COLUMN IF NOT EXISTS cislo_zp VARCHAR(255) NOT NULL DEFAULT \'\'');
        $this->addSql('ALTER TABLE reports ADD COLUMN IF NOT EXISTS calculation JSON DEFAULT NULL');
        $this->addSql('ALTER TABLE reports ADD COLUMN IF NOT EXISTS date_send TIMESTAMP DEFAULT NULL');
        $this->addSql('ALTER TABLE reports ADD COLUMN IF NOT EXISTS date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        $this->addSql('ALTER TABLE reports ADD COLUMN IF NOT EXISTS date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        
        // Check if old columns exist and rename them
        $this->addSql('
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = \'reports\' AND column_name = \'created_at\') THEN
                    ALTER TABLE reports RENAME COLUMN created_at TO date_created_old;
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name = \'reports\' AND column_name = \'updated_at\') THEN
                    ALTER TABLE reports RENAME COLUMN updated_at TO date_updated_old;
                END IF;
            END $$;
        ');
    }

    public function down(Schema $schema): void
    {
        // Remove added columns
        $this->addSql('ALTER TABLE reports DROP COLUMN IF EXISTS cislo_zp');
        $this->addSql('ALTER TABLE reports DROP COLUMN IF EXISTS calculation');
        $this->addSql('ALTER TABLE reports DROP COLUMN IF EXISTS date_send');
        $this->addSql('ALTER TABLE reports DROP COLUMN IF EXISTS date_created');
        $this->addSql('ALTER TABLE reports DROP COLUMN IF EXISTS date_updated');
        
        // Restore old column names
        $this->addSql('ALTER TABLE reports RENAME COLUMN date_created_old TO created_at');
        $this->addSql('ALTER TABLE reports RENAME COLUMN date_updated_old TO updated_at');
    }
}