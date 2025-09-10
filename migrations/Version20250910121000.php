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
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN storage_path VARCHAR(500) NOT NULL DEFAULT \'\'');
        
        // Add usage_info column for file usage tracking
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN usage_info JSON DEFAULT NULL');
        
        // Add uploaded_by column for user tracking
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN uploaded_by INTEGER DEFAULT NULL');
        
        // Add metadata column for file metadata (thumbnails, etc.)
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN metadata JSON DEFAULT NULL');
        
        // Add file management columns
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN is_temporary BOOLEAN NOT NULL DEFAULT FALSE');
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN expires_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN deleted_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN physically_deleted BOOLEAN NOT NULL DEFAULT FALSE');
        
        // Add thumbnail_path column for optimized thumbnail handling
        $this->addSql('ALTER TABLE file_attachments ADD COLUMN thumbnail_path VARCHAR(500) DEFAULT NULL');
        
        // Update existing records to populate storage_path from path
        $this->addSql('UPDATE file_attachments SET storage_path = path WHERE storage_path = \'\'');
        
        // Add indexes for better performance
        $this->addSql('CREATE INDEX idx_file_usage_info ON file_attachments USING GIN (usage_info)');
        $this->addSql('CREATE INDEX idx_file_uploaded_by ON file_attachments (uploaded_by)');
        $this->addSql('CREATE INDEX idx_file_metadata ON file_attachments USING GIN (metadata)');
        $this->addSql('CREATE INDEX idx_file_temporary ON file_attachments (is_temporary, expires_at)');
        $this->addSql('CREATE INDEX idx_file_deleted ON file_attachments (deleted_at, physically_deleted)');
        
        // Add foreign key constraint for uploaded_by (assuming users table exists)
        $this->addSql('ALTER TABLE file_attachments ADD CONSTRAINT FK_file_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL');
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