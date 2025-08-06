<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20250803210225 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE reports ADD znackari JSON NOT NULL');
        $this->addSql('ALTER TABLE reports DROP team_members');
        $this->addSql('ALTER TABLE reports ALTER int_adr TYPE INT');
        $this->addSql('ALTER TABLE reports ALTER history TYPE JSON');
        $this->addSql('ALTER TABLE reports ALTER history DROP DEFAULT');
        $this->addSql('COMMENT ON COLUMN reports.int_adr IS \'\'');
        $this->addSql('COMMENT ON COLUMN reports.history IS \'\'');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE reports ADD team_members JSONB DEFAULT \'[]\' NOT NULL');
        $this->addSql('ALTER TABLE reports DROP znackari');
        $this->addSql('ALTER TABLE reports ALTER int_adr TYPE INT');
        $this->addSql('ALTER TABLE reports ALTER history TYPE JSONB');
        $this->addSql('ALTER TABLE reports ALTER history SET DEFAULT \'[]\'');
        $this->addSql('COMMENT ON COLUMN reports.team_members IS \'Team members with their individual data\'');
        $this->addSql('COMMENT ON COLUMN reports.int_adr IS \'Report processor/creator address\'');
        $this->addSql('COMMENT ON COLUMN reports.history IS \'Audit trail of all changes\'');
    }
}
