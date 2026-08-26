<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Doplněk k Version20260826094500.
 *
 * Předchozí migrace ruší UNIQUE nad file_attachments.hash podle konkrétního jména
 * (file_attachments_hash_key). Pokud databáze na některém prostředí vznikla jinak
 * než z migrací (doctrine:schema:create, ruční zásah), může mít stejné omezení pod
 * jiným jménem a DROP CONSTRAINT IF EXISTS ho minul.
 *
 * Tato migrace odstraní jakýkoliv jednosloupcový UNIQUE nad sloupcem hash bez ohledu
 * na jméno. Když už žádný neexistuje, neudělá nic.
 */
final class Version20260826131500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Odstranit jakýkoliv zbývající UNIQUE nad file_attachments.hash (nezávisle na jménu constraintu)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
DO $$
DECLARE
    r record;
BEGIN
    -- UNIQUE constrainty nad samotným sloupcem hash
    FOR r IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = cls.oid AND att.attnum = con.conkey[1]
        WHERE cls.relname = 'file_attachments'
          AND con.contype = 'u'
          AND array_length(con.conkey, 1) = 1
          AND att.attname = 'hash'
    LOOP
        EXECUTE format('ALTER TABLE file_attachments DROP CONSTRAINT %I', r.conname);
        RAISE NOTICE 'Odstraněn UNIQUE constraint %', r.conname;
    END LOOP;

    -- Samostatné unikátní indexy nad sloupcem hash (bez navázaného constraintu)
    FOR r IN
        SELECT idx_cls.relname AS indexname
        FROM pg_index idx
        JOIN pg_class idx_cls ON idx_cls.oid = idx.indexrelid
        JOIN pg_class tbl ON tbl.oid = idx.indrelid
        JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = idx.indkey[0]
        LEFT JOIN pg_constraint con ON con.conindid = idx.indexrelid
        WHERE tbl.relname = 'file_attachments'
          AND idx.indisunique
          AND idx.indnatts = 1
          AND att.attname = 'hash'
          AND con.oid IS NULL
    LOOP
        EXECUTE format('DROP INDEX %I', r.indexname);
        RAISE NOTICE 'Odstraněn unikátní index %', r.indexname;
    END LOOP;
END $$;
SQL);

        $this->addSql('CREATE INDEX IF NOT EXISTS idx_file_hash ON file_attachments (hash)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('-- bez rollbacku, viz Version20260826094500::down()');
    }
}
