<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Update report state constraint to include 'send' value
 */
final class Version20250805204950 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Update report state constraint to include send value for asynchronous processing';
    }

    public function up(Schema $schema): void
    {
        // Drop old constraint
        $this->addSql('ALTER TABLE reports DROP CONSTRAINT IF EXISTS chk_report_state');
        
        // Add new constraint with all ReportStateEnum values
        $this->addSql("ALTER TABLE reports ADD CONSTRAINT chk_report_state CHECK (state IN ('draft', 'send', 'submitted', 'approved', 'rejected'))");
    }

    public function down(Schema $schema): void
    {
        // Update any 'send' states to 'submitted' before applying old constraint
        $this->addSql("UPDATE reports SET state = 'submitted' WHERE state = 'send'");
        
        // Drop new constraint
        $this->addSql('ALTER TABLE reports DROP CONSTRAINT IF EXISTS chk_report_state');
        
        // Restore old constraint (without 'send')
        $this->addSql("ALTER TABLE reports ADD CONSTRAINT chk_report_state CHECK (state IN ('draft', 'submitted', 'approved', 'rejected'))");
    }
}