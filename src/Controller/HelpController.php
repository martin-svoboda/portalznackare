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
        
        return $this->render('help/index.html.twig', [
            'content' => $this->markdownService->parse($content),
            'navigation' => $navigation,
            'currentSection' => null,
            'currentPage' => null
        ]);
    }

    #[Route('/{section}', name: 'help_section')]
    public function section(string $section): Response
    {
        $sectionPath = $this->userDocsPath . '/' . $section;
        
        if (!is_dir($sectionPath)) {
            // Místo výjimky zobrazíme přívětivou stránku
            return $this->render('help/not-found.html.twig', [
                'navigation' => $this->buildNavigation(),
                'currentSection' => $section,
                'sectionTitle' => $this->getSectionTitle($section),
                'message' => 'Tato sekce nápovědy ještě není k dispozici.'
            ]);
        }
        
        // Najdi README nebo první soubor v sekci
        $indexFile = $sectionPath . '/README.md';
        if (!file_exists($indexFile)) {
            $files = glob($sectionPath . '/*.md');
            if (empty($files)) {
                // Zobrazíme přívětivou stránku když sekce nemá obsah
                return $this->render('help/not-found.html.twig', [
                    'navigation' => $this->buildNavigation(),
                    'currentSection' => $section,
                    'sectionTitle' => $this->getSectionTitle($section),
                    'message' => 'V této sekci zatím není žádný obsah. Pracujeme na tom!'
                ]);
            }
            $indexFile = $files[0];
        }
        
        $content = $this->loadMarkdownFile($indexFile);
        $navigation = $this->buildNavigation();
        
        return $this->render('help/page.html.twig', [
            'content' => $this->markdownService->parse($content),
            'navigation' => $navigation,
            'currentSection' => $section,
            'currentPage' => null,
            'sectionTitle' => $this->getSectionTitle($section)
        ]);
    }

    #[Route('/{section}/{page}', name: 'help_page')]
    public function page(string $section, string $page): Response
    {
        $filePath = $this->userDocsPath . '/' . $section . '/' . $page . '.md';
        
        if (!file_exists($filePath)) {
            // Zobrazíme přívětivou stránku pro neexistující stránku
            return $this->render('help/not-found.html.twig', [
                'navigation' => $this->buildNavigation(),
                'currentSection' => $section,
                'currentPage' => $page,
                'sectionTitle' => $this->getSectionTitle($section),
                'pageTitle' => $this->formatPageName($page),
                'message' => 'Tato stránka ještě není k dispozici.'
            ]);
        }
        
        $content = $this->loadMarkdownFile($filePath);
        $navigation = $this->buildNavigation();
        
        return $this->render('help/page.html.twig', [
            'content' => $this->markdownService->parse($content),
            'navigation' => $navigation,
            'currentSection' => $section,
            'currentPage' => $page,
            'sectionTitle' => $this->getSectionTitle($section),
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
        
        if (!isset($config['sections'])) {
            return $this->buildAutomaticNavigation();
        }
        
        // Projdi sekce v definovaném pořadí
        foreach ($config['sections'] as $sectionName => $sectionConfig) {
            $sectionPath = $this->userDocsPath . '/' . $sectionName;
            
            // Přeskoč sekce které neexistují
            if (!is_dir($sectionPath)) {
                continue;
            }
            
            $pages = [];
            
            // Pokud jsou definované stránky, použij je v daném pořadí
            if (isset($sectionConfig['pages']) && is_array($sectionConfig['pages'])) {
                foreach ($sectionConfig['pages'] as $pageConfig) {
                    if (is_array($pageConfig)) {
                        $pageName = key($pageConfig);
                        $pageTitle = current($pageConfig);
                    } else {
                        // Jednoduchý string
                        $pageName = $pageConfig;
                        $pageTitle = $this->formatPageName($pageConfig);
                    }
                    
                    $pagePath = $sectionPath . '/' . $pageName . '.md';
                    
                    // Přidej pouze existující stránky
                    if (file_exists($pagePath)) {
                        $pages[] = [
                            'name' => $pageName,
                            'title' => $pageTitle,
                            'url' => $this->generateUrl('help_page', [
                                'section' => $sectionName, 
                                'page' => $pageName
                            ])
                        ];
                    }
                }
            }
            
            $navigation[$sectionName] = [
                'name' => $sectionName,
                'title' => $sectionConfig['title'] ?? $this->getSectionTitle($sectionName),
                'url' => $this->generateUrl('help_section', ['section' => $sectionName]),
                'pages' => $pages,
                'icon' => $sectionConfig['icon'] ?? $this->getSectionIcon($sectionName),
                'description' => $sectionConfig['description'] ?? null
            ];
        }
        
        return $navigation;
    }
    
    private function buildAutomaticNavigation(): array
    {
        // Původní automatická navigace jako fallback
        if (!is_dir($this->userDocsPath)) {
            return [];
        }

        $navigation = [];
        $sections = glob($this->userDocsPath . '/*', GLOB_ONLYDIR);
        
        foreach ($sections as $sectionPath) {
            $sectionName = basename($sectionPath);
            
            // Skip hidden directories
            if ($sectionName[0] === '.') {
                continue;
            }
            
            $pages = [];
            $mdFiles = glob($sectionPath . '/*.md');
            
            foreach ($mdFiles as $file) {
                $pageName = basename($file, '.md');
                
                // Skip README as it's section index
                if ($pageName === 'README') {
                    continue;
                }
                
                $pages[] = [
                    'name' => $pageName,
                    'title' => $this->getPageTitle($file),
                    'url' => $this->generateUrl('help_page', [
                        'section' => $sectionName, 
                        'page' => $pageName
                    ])
                ];
            }
            
            $navigation[$sectionName] = [
                'name' => $sectionName,
                'title' => $this->getSectionTitle($sectionName),
                'url' => $this->generateUrl('help_section', ['section' => $sectionName]),
                'pages' => $pages,
                'icon' => $this->getSectionIcon($sectionName)
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