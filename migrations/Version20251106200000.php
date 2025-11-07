<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Create pages table for CMS functionality
 * Supports hierarchical structure, status workflow, and soft deletes
 */
final class Version20251106200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create pages table for CMS content management with hierarchical structure and soft deletes';
    }

    public function up(Schema $schema): void
    {
        // Create pages table
        $this->addSql('
            CREATE TABLE pages (
                id BIGSERIAL PRIMARY KEY,

                -- Content
                title VARCHAR(500) NOT NULL,
                slug VARCHAR(500) NOT NULL UNIQUE,
                content TEXT NOT NULL,
                excerpt TEXT NULL,

                -- Classification
                content_type VARCHAR(50) NOT NULL DEFAULT \'page\',
                status VARCHAR(50) NOT NULL DEFAULT \'draft\',

                -- Author
                author_id INTEGER NOT NULL,

                -- Hierarchy
                parent_id BIGINT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,

                -- Featured & SEO
                featured_image_id INTEGER NULL,
                meta JSON DEFAULT \'{}\'::json,

                -- Timestamps
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                published_at TIMESTAMP NULL,
                deleted_at TIMESTAMP NULL,

                -- Changelog
                history JSON DEFAULT \'[]\'::json,

                -- Foreign keys
                CONSTRAINT fk_pages_parent FOREIGN KEY (parent_id)
                    REFERENCES pages(id) ON DELETE SET NULL,
                CONSTRAINT fk_pages_featured_image FOREIGN KEY (featured_image_id)
                    REFERENCES file_attachments(id) ON DELETE SET NULL
            )
        ');

        // Indexes for performance
        $this->addSql('CREATE INDEX idx_pages_slug ON pages(slug) WHERE deleted_at IS NULL');
        $this->addSql('CREATE INDEX idx_pages_status ON pages(status)');
        $this->addSql('CREATE INDEX idx_pages_content_type ON pages(content_type)');
        $this->addSql('CREATE INDEX idx_pages_parent ON pages(parent_id)');
        $this->addSql('CREATE INDEX idx_pages_author ON pages(author_id)');
        $this->addSql('CREATE INDEX idx_pages_published_at ON pages(published_at)');
        $this->addSql('CREATE INDEX idx_pages_deleted_at ON pages(deleted_at)');
        $this->addSql('CREATE INDEX idx_pages_sort_order ON pages(sort_order)');

        // Enable pg_trgm extension for fulltext search
        $this->addSql('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        // Trigram indexes for fast LIKE queries
        $this->addSql('CREATE INDEX idx_pages_title_trgm ON pages USING gin (title gin_trgm_ops)');
        $this->addSql('CREATE INDEX idx_pages_content_trgm ON pages USING gin (content gin_trgm_ops)');
        $this->addSql('CREATE INDEX idx_pages_excerpt_trgm ON pages USING gin (excerpt gin_trgm_ops)');

        // Comments for documentation
        $this->addSql('COMMENT ON TABLE pages IS \'CMS pages with hierarchical structure and soft deletes\'');
        $this->addSql('COMMENT ON COLUMN pages.content IS \'HTML content from Tiptap WYSIWYG editor\'');
        $this->addSql('COMMENT ON COLUMN pages.excerpt IS \'Optional short summary/perex\'');
        $this->addSql('COMMENT ON COLUMN pages.meta IS \'SEO metadata: seo_title, seo_description, keywords\'');
        $this->addSql('COMMENT ON COLUMN pages.history IS \'Changelog array: [{timestamp, user_id, action, changes}]\'');
        $this->addSql('COMMENT ON COLUMN pages.content_type IS \'Content classification: page, article, document, faq\'');
        $this->addSql('COMMENT ON COLUMN pages.status IS \'Workflow status: draft, published, archived\'');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE IF EXISTS pages CASCADE');
        // pg_trgm extension může být použitá jinde, nemazat
    }
}
