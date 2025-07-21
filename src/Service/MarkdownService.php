<?php

namespace App\Service;

use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

class MarkdownService
{
    private UrlGeneratorInterface $urlGenerator;
    
    public function __construct(UrlGeneratorInterface $urlGenerator)
    {
        $this->urlGenerator = $urlGenerator;
    }

    public function parse(string $markdown): string
    {
        // Odstraň první H1 nadpis (zobrazuje se už v page header)
        $html = preg_replace('/^# .+$/m', '', $markdown, 1);
        // Odstranit prázdné řádky po odebrání H1
        $html = preg_replace('/^\n+/', '', $html);
        
        // Process headers
        $html = preg_replace('/^#{6} (.+)$/m', '<h6>$1</h6>', $html);
        $html = preg_replace('/^#{5} (.+)$/m', '<h5>$1</h5>', $html);
        $html = preg_replace('/^#{4} (.+)$/m', '<h4>$1</h4>', $html);
        $html = preg_replace('/^#{3} (.+)$/m', '<h3>$1</h3>', $html);
        $html = preg_replace('/^#{2} (.+)$/m', '<h2>$1</h2>', $html);
        $html = preg_replace('/^# (.+)$/m', '<h1>$1</h1>', $html);
        
        // Process lists
        $html = $this->processLists($html);
        
        // Process inline formatting
        $html = preg_replace('/\*\*(.+?)\*\*/', '<strong>$1</strong>', $html);
        $html = preg_replace('/\*(.+?)\*/', '<em>$1</em>', $html);
        $html = preg_replace('/`(.+?)`/', '<code>$1</code>', $html);
        
        // Process code blocks
        $html = preg_replace_callback(
            '/```(\w+)?\n(.*?)\n```/s',
            function($matches) {
                $language = $matches[1] ?: 'plaintext';
                $code = htmlspecialchars($matches[2]);
                return "<pre><code class=\"language-$language\">$code</code></pre>";
            },
            $html
        );
        
        // Process links (convert internal .md links to help routes)
        $html = preg_replace_callback(
            '/\[([^\]]+)\]\(([^)]+)\)/',
            function($matches) {
                $text = $matches[1];
                $link = $matches[2];
                
                // Internal markdown link
                if (str_ends_with($link, '.md')) {
                    $link = $this->convertMarkdownLink($link);
                }
                // External link
                elseif (str_starts_with($link, 'http')) {
                    return "<a href=\"$link\" target=\"_blank\" rel=\"noopener\">$text</a>";
                }
                
                return "<a href=\"$link\">$text</a>";
            },
            $html
        );
        
        // Process images
        $html = preg_replace(
            '/!\[([^\]]*)\]\(([^)]+)\)/',
            '<img src="$2" alt="$1" class="img-fluid">',
            $html
        );
        
        // Process blockquotes
        $html = preg_replace('/^> (.+)$/m', '<blockquote>$1</blockquote>', $html);
        
        // Process horizontal rules
        $html = preg_replace('/^---$/m', '<hr>', $html);
        
        // Process paragraphs
        $html = $this->processParagraphs($html);
        
        return $html;
    }

    private function processLists(string $text): string
    {
        // Process unordered lists
        $text = preg_replace_callback(
            '/^(\* .+)$/m',
            function($matches) {
                return '<ul><li>' . substr($matches[1], 2) . '</li></ul>';
            },
            $text
        );
        
        // Process ordered lists
        $text = preg_replace_callback(
            '/^(\d+\. .+)$/m',
            function($matches) {
                return '<ol><li>' . preg_replace('/^\d+\. /', '', $matches[1]) . '</li></ol>';
            },
            $text
        );
        
        // Merge consecutive list items
        $text = preg_replace('/<\/ul>\n<ul>/', "\n", $text);
        $text = preg_replace('/<\/ol>\n<ol>/', "\n", $text);
        
        return $text;
    }

    private function processParagraphs(string $text): string
    {
        // Split by double newlines
        $blocks = preg_split('/\n\n+/', $text);
        $processed = [];
        
        foreach ($blocks as $block) {
            $block = trim($block);
            
            // Skip if already wrapped in HTML tags
            if (preg_match('/^<[^>]+>/', $block)) {
                $processed[] = $block;
            }
            // Otherwise wrap in paragraph
            elseif (!empty($block)) {
                $processed[] = '<p>' . nl2br($block) . '</p>';
            }
        }
        
        return implode("\n\n", $processed);
    }

    private function convertMarkdownLink(string $link): string
    {
        // Remove .md extension
        $link = preg_replace('/\.md$/', '', $link);
        
        // Handle relative paths
        if (str_contains($link, '/')) {
            $parts = explode('/', $link);
            
            // ../other-section/page -> /napoveda/other-section/page
            if ($parts[0] === '..') {
                array_shift($parts);
                $section = array_shift($parts);
                $page = implode('/', $parts);
                
                return $this->urlGenerator->generate('help_page', [
                    'section' => $section,
                    'page' => $page
                ]);
            }
            // section/page -> /napoveda/section/page
            else {
                $section = array_shift($parts);
                $page = implode('/', $parts);
                
                return $this->urlGenerator->generate('help_page', [
                    'section' => $section,
                    'page' => $page
                ]);
            }
        }
        
        // Just section name -> /napoveda/section
        return $this->urlGenerator->generate('help_section', ['section' => $link]);
    }
}