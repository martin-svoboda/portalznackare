<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Add missing columns to file_attachments table for production server
 */
final class Version20250910121000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add missing columns to file_attachments table (storage_path, usage_info, uploaded_by, metadata, file management)';
    }

    public function up(Schema $schema): void
    {
        // Add storage_path column for file path management
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500) NOT NULL DEFAULT \'\'');
        
        // Add usage_info column for file usage tracking
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS usage_info JSON DEFAULT NULL');
        
        // Add uploaded_by column for user tracking
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS uploaded_by INTEGER DEFAULT NULL');
        
        // Add metadata column for file metadata (thumbnails, etc.)
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT NULL');
        
        // Add file management columns
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN NOT NULL DEFAULT FALSE');
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS physically_deleted BOOLEAN NOT NULL DEFAULT FALSE');
        
        // Add thumbnail_path column for optimized thumbnail handling
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(500) DEFAULT NULL');
        
        // Update existing records to populate storage_path from path
        $this->addSql('UPDATE file_attachments SET storage_path = path WHERE storage_path = \'\'');
        
        // Update thumbnail_path from metadata if metadata exists
        $this->addSql("
            UPDATE file_attachments 
            SET thumbnail_path = CASE 
                WHEN metadata->>'thumbnail' IS NOT NULL 
                THEN CONCAT(storage_path, '/', metadata->>'thumbnail')
                ELSE NULL 
            END
            WHERE metadata IS NOT NULL 
              AND metadata->>'thumbnail' IS NOT NULL
              AND thumbnail_path IS NULL
        ");
        
        // Add indexes for better performance
        // Note: GIN indexes work only with JSONB, not JSON. Using standard btree for JSON columns
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_file_usage_info ON file_attachments USING btree ((usage_info::text))');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_file_uploaded_by ON file_attachments (uploaded_by)');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_file_metadata ON file_attachments USING btree ((metadata::text))');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_file_temporary ON file_attachments (is_temporary, expires_at)');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_file_deleted ON file_attachments (deleted_at, physically_deleted)');
        
        // Clean up invalid uploaded_by values first, then add constraint
        $this->addSql('
            UPDATE file_attachments 
            SET uploaded_by = NULL 
            WHERE uploaded_by IS NOT NULL 
              AND uploaded_by NOT IN (SELECT id FROM users)
        ');
        
        // Add foreign key constraint for uploaded_by (assuming users table exists)
        $this->addSql('
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = \'fk_file_uploaded_by\'
                ) THEN
                    ALTER TABLE file_attachments 
                    ADD CONSTRAINT FK_file_uploaded_by 
                    FOREIGN KEY (uploaded_by) 
                    REFERENCES users (id) 
                    ON DELETE SET NULL;
                END IF;
            END $$;
        ');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE file_attachments DROP CONSTRAINT IF EXISTS FK_file_uploaded_by');
        $this->addSql('DROP INDEX IF EXISTS idx_file_usage_info');
        $this->addSql('DROP INDEX IF EXISTS idx_file_uploaded_by');
        $this->addSql('DROP INDEX IF EXISTS idx_file_metadata');
        $this->addSql('DROP INDEX IF EXISTS idx_file_temporary');
        $this->addSql('DROP INDEX IF EXISTS idx_file_deleted');
        $this->addSql('ALTER TABLE file_attachments DROP COLUMN IF EXISTS thumbnail_path');
        $this->addSql('ALTER TABLE file_attachments DROP COLUMN IF EXISTS physically_deleted');
        $this->addSql('ALTER TABLE file_attachments DROP COLUMN IF EXISTS deleted_at');
        $this->addSql('ALTER TABLE file_attachments DROP COLUMN IF EXISTS expires_at');
        $this->addSql('ALTER TABLE file_attachments DROP COLUMN IF EXISTS is_temporary');
        $this->addSql('ALTER TABLE file_attachments DROP COLUMN IF EXISTS metadata');
        $this->addSql('ALTER TABLE file_attachments DROP COLUMN IF EXISTS uploaded_by');
        $this->addSql('ALTER TABLE file_attachments DROP COLUMN IF EXISTS usage_info');
        $this->addSql('ALTER TABLE file_attachments DROP COLUMN IF EXISTS storage_path');
    }
}