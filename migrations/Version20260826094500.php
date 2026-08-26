<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Odstranění UNIQUE constraintu na file_attachments.hash.
 *
 * Deduplikace v FileUploadService probíhá podle dvojice hash + original_name,
 * takže bajtově identický soubor nahraný pod jiným názvem je legitimní nový záznam.
 * UNIQUE na samotném hashi tento případ shazoval na SQLSTATE[23505].
 */
final class Version20260826094500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Drop UNIQUE constraint on file_attachments.hash (deduplikace je hash + original_name)';
    }

    public function up(Schema $schema): void
    {
        // UNIQUE byl vytvořen inline v Version20250121120000 -> Postgres ho pojmenoval file_attachments_hash_key
        $this->addSql('ALTER TABLE file_attachments DROP CONSTRAINT IF EXISTS file_attachments_hash_key');

        // Vyhledávací index na hash musí zůstat (deduplikační dotaz)
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_file_hash ON file_attachments (hash)');
    }

    public function down(Schema $schema): void
    {
        // Pozor: rollback selže, pokud mezitím vznikly řádky se shodným hashem pod různými názvy.
        $this->addSql('ALTER TABLE file_attachments ADD CONSTRAINT file_attachments_hash_key UNIQUE (hash)');
    }
}
