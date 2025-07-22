<?php

namespace App\Controller;

use App\Service\MarkdownService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Yaml\Yaml;

#[Route('/napoveda')]
class HelpController extends AbstractController
{
    private string $userDocsPath;
    private MarkdownService $markdownService;
    
    public function __construct(string $projectDir, MarkdownService $markdownService)
    {
        $this->userDocsPath = $projectDir . '/user-docs';
        $this->markdownService = $markdownService;
    }

    #[Route('/', name: 'help_index')]
    public function index(): Response
    {
        // Pokud user-docs neexistuje, vytvoř ukázkový obsah
        if (!is_dir($this->userDocsPath)) {
            return $this->render('help/coming-soon.html.twig');
        }

        $content = $this->loadMarkdownFile('README.md');
        $navigation = $this->buildNavigation();
        
        return $this->render('help/page.html.twig', [
            'content' => $this->markdownService->parse($content),
            'navigation' => $navigation,
            'currentPage' => null,
            'pageTitle' => null  // Pro hlavní stránku
        ]);
    }

    #[Route('/{page}', name: 'help_page')]
    public function page(string $page): Response
    {
        $filePath = $this->userDocsPath . '/' . $page . '.md';
        
        if (!file_exists($filePath)) {
            // Zobrazíme přívětivou stránku pro neexistující stránku
            return $this->render('help/not-found.html.twig', [
                'navigation' => $this->buildNavigation(),
                'currentPage' => $page,
                'pageTitle' => $this->formatPageName($page),
                'message' => 'Tato stránka ještě není k dispozici.'
            ]);
        }
        
        $content = $this->loadMarkdownFile($filePath);
        $navigation = $this->buildNavigation();
        
        return $this->render('help/page.html.twig', [
            'content' => $this->markdownService->parse($content),
            'navigation' => $navigation,
            'currentPage' => $page,
            'pageTitle' => $this->extractTitle($content) ?: $this->formatPageName($page)
        ]);
    }

    private function loadMarkdownFile(string $path): string
    {
        $fullPath = $path[0] === '/' ? $path : $this->userDocsPath . '/' . $path;
        
        if (!file_exists($fullPath)) {
            return '';  // Vrátíme prázdný string místo výjimky
        }
        
        return file_get_contents($fullPath);
    }

    private function buildNavigation(): array
    {
        // Načti navigační konfiguraci
        $configFile = $this->userDocsPath . '/navigation.yaml';
        
        if (!file_exists($configFile)) {
            // Fallback na automatickou navigaci
            return $this->buildAutomaticNavigation();
        }
        
        try {
            $config = Yaml::parseFile($configFile);
        } catch (\Exception $e) {
            // Při chybě použij automatickou navigaci
            return $this->buildAutomaticNavigation();
        }
        
        $navigation = [];
        
        // Flat struktura - pouze pages
        if (isset($config['pages']) && is_array($config['pages'])) {
            foreach ($config['pages'] as $pageConfig) {
                if (is_array($pageConfig)) {
                    $pageName = key($pageConfig);
                    $pageTitle = current($pageConfig);
                } else {
                    // String format "pageName: Title"
                    if (strpos($pageConfig, ':') !== false) {
                        [$pageName, $pageTitle] = explode(':', $pageConfig, 2);
                        $pageName = trim($pageName);
                        $pageTitle = trim($pageTitle);
                    } else {
                        $pageName = $pageConfig;
                        $pageTitle = $this->formatPageName($pageConfig);
                    }
                }
                
                $pagePath = $this->userDocsPath . '/' . $pageName . '.md';
                
                // Přidej pouze existující stránky
                if (file_exists($pagePath)) {
                    $navigation[] = [
                        'name' => $pageName,
                        'title' => $pageTitle,
                        'url' => $this->generateUrl('help_page', ['page' => $pageName])
                    ];
                }
            }
        }
        
        return $navigation;
    }
    
    private function buildAutomaticNavigation(): array
    {
        // Flat automatická navigace
        if (!is_dir($this->userDocsPath)) {
            return [];
        }

        $navigation = [];
        $mdFiles = glob($this->userDocsPath . '/*.md');
        
        foreach ($mdFiles as $file) {
            $pageName = basename($file, '.md');
            
            // Skip README as it's main index
            if ($pageName === 'README') {
                continue;
            }
            
            $navigation[] = [
                'name' => $pageName,
                'title' => $this->getPageTitle($file),
                'url' => $this->generateUrl('help_page', ['page' => $pageName])
            ];
        }
        
        return $navigation;
    }

    private function getSectionTitle(string $section): string
    {
        $titles = [
            'getting-started' => 'Začínáme',
            'prikazy' => 'Práce s příkazy',
            'metodiky' => 'Metodiky a dokumentace',
            'hlaseni' => 'Hlášení práce',
            'profil' => 'Uživatelský profil',
            'faq' => 'Časté dotazy'
        ];
        
        return $titles[$section] ?? ucfirst(str_replace('-', ' ', $section));
    }

    private function getSectionIcon(string $section): string
    {
        // Ikony zrušeny dle požadavku - není to profesionální
        return '';
    }

    private function getPageTitle(string $filePath): string
    {
        $content = file_get_contents($filePath);
        
        // Extract first H1 heading
        if (preg_match('/^# (.+)$/m', $content, $matches)) {
            return trim($matches[1]);
        }
        
        // Fallback to formatted filename
        return $this->formatPageName(basename($filePath, '.md'));
    }

    private function extractTitle(string $content): ?string
    {
        if (preg_match('/^# (.+)$/m', $content, $matches)) {
            return trim($matches[1]);
        }
        
        return null;
    }

    private function formatPageName(string $name): string
    {
        return ucfirst(str_replace(['-', '_'], ' ', $name));
    }
}