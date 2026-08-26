<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Change reports structure to one report per order with team members
 */
final class Version20250121120001 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Change reports structure to one report per order with team members and history';
    }

    public function up(Schema $schema): void
    {
        // Drop the old unique constraint on id_zp + int_adr (PostgreSQL syntax)
        $this->addSql('ALTER TABLE reports DROP CONSTRAINT IF EXISTS unique_report_per_user_order');
        
        // Add new unique constraint only on id_zp
        // IF NOT EXISTS: migrace má v názvu starší verzi, než jaká je na DEV/PROD nasazená,
        // takže se dohání zpětně nad schématem, kde už index existuje (viz deploy 2026-08-26)
        $this->addSql('CREATE UNIQUE INDEX IF NOT EXISTS unique_report_per_order ON reports (id_zp)');
        
        // Add new columns for team members and history (PostgreSQL JSONB)
        // team_members jen tam, kde ho pozdější Version20250803210225 ještě nepřejmenovala
        // na znackari - jinak by se na DEV/PROD zavedl mrtvý sloupec
        $this->addSql(<<<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reports' AND column_name = 'znackari'
    ) THEN
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS team_members JSONB NOT NULL DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN reports.team_members IS 'Team members with their individual data';
    END IF;
END $$;
SQL);
        $this->addSql('ALTER TABLE reports ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT \'[]\'::jsonb');
        
        // Drop je_vedouci column as it's now in team_members
        $this->addSql('ALTER TABLE reports DROP COLUMN IF EXISTS je_vedouci');
        
        // Comment for clarity
        $this->addSql('COMMENT ON COLUMN reports.history IS \'Audit trail of all changes\'');
        $this->addSql('COMMENT ON COLUMN reports.int_adr IS \'Report processor/creator address\'');
    }

    public function down(Schema $schema): void
    {
        // Restore old structure (PostgreSQL syntax)
        $this->addSql('DROP INDEX IF EXISTS unique_report_per_order');
        $this->addSql('CREATE UNIQUE INDEX unique_report_per_user_order ON reports (id_zp, int_adr)');
        
        // Remove new columns
        $this->addSql('ALTER TABLE reports DROP COLUMN IF EXISTS team_members');
        $this->addSql('ALTER TABLE reports DROP COLUMN IF EXISTS history');
        
        // Restore je_vedouci column
        $this->addSql('ALTER TABLE reports ADD COLUMN je_vedouci BOOLEAN NOT NULL DEFAULT FALSE');
    }
}