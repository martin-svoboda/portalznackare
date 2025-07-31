# Content Management System

> **Topics dokumentace** - CMS funkcionalita pro metodiky, downloads a help systém

## 📚 Přehled Content Management

**Metodiky:** Kategorizované PDF dokumenty a návody  
**Downloads:** Soubory ke stažení (formuláře, templates, atd.)  
**Help systém:** Markdown-based nápověda pro uživatele  
**Static pages:** Server-rendered Twig stránky s možností rozšíření

### CMS komponenty
- **Metodiky** - Kategorizované dokumenty s PDF stahováním
- **Downloads** - File management pro veřejné soubory  
- **Help Controller** - Dynamický help systém z Markdown
- **Static pages** - Twig templating pro obsah

## 📖 Metodiky systém

### Současná implementace
```php
// src/Controller/AppController.php
#[Route('/metodika', name: 'app_metodika')]
public function metodika(): Response
{
    return $this->render('pages/metodika.html.twig');
}
```

```twig
{# templates/pages/metodika.html.twig #}
{% extends 'base.html.twig' %}

{% block title %}Metodiky - Portál značkaře{% endblock %}

{% block body %}
    <div class="container container--lg">
        {% include 'components/page-header.html.twig' with {
            title: 'Metodiky',
            subtitle: 'Návody, postupy a dokumentace pro značkaře'
        } %}
        
        {# TODO: Implementovat React app pro metodiky #}
        <div class="card">
            <div class="card__content">
                <p class="text-gray-600 dark:text-gray-400">
                    Metodiky budou implementovány v následující fázi vývoje.
                </p>
            </div>
        </div>
    </div>
{% endblock %}
```

### Plánovaná API struktura
```php
// src/Controller/Api/PortalController.php (TODO endpointy)
#[Route('/api/portal/metodika', methods: ['GET'])]
public function getMetodika(Request $request): JsonResponse
{
    // TODO: Implementovat získání metodik
    return new JsonResponse([
        'message' => 'Endpoint /metodika není zatím implementován - bude implementován v další fázi'
    ], 501);
}

#[Route('/api/portal/metodika-terms', methods: ['GET'])]
public function getMetodikaTerms(Request $request): JsonResponse
{
    // TODO: Implementovat získání kategorií metodik
    return new JsonResponse([
        'message' => 'Endpoint /metodika-terms není zatím implementován - bude implementován v další fázi'
    ], 501);
}
```

### Budoucí funkcionalita
```javascript
// assets/js/apps/metodiky/App.jsx (plánováno)
const App = () => {
    const [categories, setCategories] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    
    useEffect(() => {
        // Načíst kategorie a dokumenty
        Promise.all([
            fetch('/api/portal/metodika-terms').then(r => r.json()),
            fetch('/api/portal/metodika').then(r => r.json())
        ]).then(([categoriesData, documentsData]) => {
            setCategories(categoriesData);
            setDocuments(documentsData);
        });
    }, []);
    
    const filteredDocuments = documents.filter(doc => 
        (selectedCategory === 'all' || doc.category === selectedCategory) &&
        doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return (
        <div className="space-y-6">
            {/* Search and filters */}
            <div className="flex gap-4">
                <input
                    type="text"
                    placeholder="Hledat metodiky..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form__input flex-1"
                />
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="form__select"
                >
                    <option value="all">Všechny kategorie</option>
                    {categories.map(cat => (
                        <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                    ))}
                </select>
            </div>
            
            {/* Documents grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocuments.map(doc => (
                    <div key={doc.id} className="card">
                        <div className="card__content">
                            <h3 className="card__title">{doc.title}</h3>
                            <p className="text-sm text-gray-600 mb-4">{doc.description}</p>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">{doc.category_name}</span>
                                <a href={doc.download_url} className="btn btn--primary btn--sm">
                                    Stáhnout PDF
                                </a>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
```

## 📥 Downloads systém

### Současná implementace
```php
// src/Controller/AppController.php
#[Route('/downloads', name: 'app_downloads')]
public function downloads(): Response
{
    return $this->render('pages/downloads.html.twig');
}
```

### Plánovaná API integrace
```php
#[Route('/api/portal/downloads', methods: ['GET'])]
public function getDownloads(Request $request): JsonResponse
{
    // TODO: Implementovat získání souborů ke stažení
    return new JsonResponse([
        'message' => 'Endpoint /downloads není zatím implementován - bude implementován v další fázi'
    ], 501);
}
```

### File Management integrace
```php
// src/Service/DownloadService.php (plánováno)
class DownloadService
{
    public function __construct(
        private FileUploadService $fileService,
        private EntityManagerInterface $em
    ) {}
    
    public function getPublicDownloads(): array
    {
        // Získat veřejné soubory z kategorie "downloads"
        return $this->em->getRepository(FileAttachment::class)
            ->findBy([
                'storage_path' => 'downloads/%',
                'is_public' => true,
                'deleted_at' => null
            ]);
    }
    
    public function getDownloadsByCategory(string $category): array
    {
        return $this->em->getRepository(FileAttachment::class)
            ->findBy([
                'storage_path' => "downloads/{$category}/%",
                'is_public' => true,
                'deleted_at' => null
            ]);
    }
}
```

## 📚 Help System s podporou obrázků

### 📸 Screenshot Management
- **Složka:** `user-docs/assets/images/` - jedna složka pro všechny obrázky
- **Formáty:** PNG pro UI screenshoty, JPG pro fotografie
- **Routing:** `/napoveda/assets/images/filename.png` pro interní help systém
- **Wiki sync:** Automatické kopírování do `user-docs-assets/images/filename.png`
- **Pojmenování:** `funkce-akce.png` (např. `login-form.png`, `prikazy-filter.png`)

## 📚 Help System

### HelpController s podporou obrázků
```php
// src/Controller/HelpController.php
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
        if (!is_dir($this->userDocsPath)) {
            return $this->render('help/coming-soon.html.twig');
        }
        
        $content = $this->loadMarkdownFile('README.md');
        $navigation = $this->buildNavigation();
        
        return $this->render('help/index.html.twig', [
            'content' => $this->markdownService->parse($content, '/napoveda/assets'),
            'navigation' => $navigation
        ]);
    }
    
    #[Route('/{section}', name: 'help_section')]
    public function section(string $section): Response
    {
        $sectionPath = $this->userDocsPath . '/' . $section;
        
        if (!is_dir($sectionPath)) {
            return $this->render('help/not-found.html.twig', [
                'navigation' => $this->buildNavigation(),
                'currentSection' => $section,
                'message' => 'Tato sekce nápovědy ještě není k dispozici.'
            ]);
        }
        
        // Načti README nebo první soubor v sekci
        $indexFile = $sectionPath . '/README.md';
        if (!file_exists($indexFile)) {
            $files = glob($sectionPath . '/*.md');
            $indexFile = $files[0] ?? null;
        }
        
        $content = $indexFile ? $this->loadMarkdownFile($indexFile) : '';
        
        return $this->render('help/page.html.twig', [
            'content' => $this->markdownService->parse($content, '/napoveda/assets'),
            'navigation' => $this->buildNavigation(),
            'currentSection' => $section
        ]);
    }
    
    #[Route('/assets/{path}', name: 'help_assets', requirements: ['path' => '.+'])]
    public function assets(string $path): Response
    {
        $filePath = $this->userDocsPath . '/assets/' . $path;
        
        // Security check - pouze soubory v assets složce
        $realPath = realpath($filePath);
        $assetsPath = realpath($this->userDocsPath . '/assets');
        
        if (!$realPath || !str_starts_with($realPath, $assetsPath)) {
            throw $this->createNotFoundException('Asset not found');
        }
        
        if (!file_exists($filePath)) {
            throw $this->createNotFoundException('Asset not found');
        }
        
        // Detekce MIME typu
        $mimeType = mime_content_type($filePath) ?: 'application/octet-stream';
        
        // Cache headers pro obrázky
        $response = new BinaryFileResponse($filePath);
        $response->headers->set('Content-Type', $mimeType);
        $response->headers->set('Cache-Control', 'public, max-age=86400'); // 24 hodin
        
        return $response;
    }
}
```

### Navigation Configuration
```yaml
# user-docs/navigation.yaml
sections:
  getting-started:
    title: "Začínáme"
    description: "První kroky s aplikací"
    pages:
      - first-login: "První přihlášení"
      - dashboard: "Orientace v aplikaci"
      - basic-workflow: "Základní pracovní postup"
  
  prikazy:
    title: "Práce s příkazy"
    description: "Správa a zpracování příkazů"
    pages:
      - viewing: "Prohlížení příkazů"
      - filtering: "Filtrování a vyhledávání"
      - detail: "Detail příkazu"
      - printing: "Tisk a export"
  
  hlaseni:
    title: "Hlášení práce"
    description: "Vyplňování a odesílání hlášení"
    pages:
      - overview: "Přehled hlášení"
      - part-a: "Část A - Základní údaje"
      - part-b: "Část B - Výkaz práce"
      - attachments: "Přikládání souborů"
      - submission: "Odeslání hlášení"
```

### MarkdownService s podporou obrázků
```php
// src/Service/MarkdownService.php
class MarkdownService
{
    public function parse(string $content, string $basePath = ''): string
    {
        // Základní Markdown parsing
        // Později možno nahradit knihovnou jako commonmark/commonmark
        
        $content = preg_replace('/^# (.+)$/m', '<h1>$1</h1>', $content);
        $content = preg_replace('/^## (.+)$/m', '<h2>$1</h2>', $content);
        $content = preg_replace('/^### (.+)$/m', '<h3>$1</h3>', $content);
        
        // Images - NOVÁ FUNKCIONALITA
        $content = preg_replace_callback(
            '/!\[([^\]]*)\]\(([^)]+)\)/',
            function ($matches) use ($basePath) {
                $alt = $matches[1];
                $src = $matches[2];
                
                // Pro help systém přidat /napoveda/assets/ prefix
                if ($basePath && !preg_match('/^https?:\/\//', $src)) {
                    $src = $basePath . '/' . ltrim($src, '/');
                }
                
                return "<img src=\"{$src}\" alt=\"{$alt}\" class=\"help-image img-fluid rounded shadow-sm my-3\" loading=\"lazy\">";
            },
            $content
        );
        
        // Links
        $content = preg_replace('/\[([^\]]+)\]\(([^)]+)\)/', '<a href="$2">$1</a>', $content);
        
        // Bold and italic
        $content = preg_replace('/\*\*([^*]+)\*\*/', '<strong>$1</strong>', $content);
        $content = preg_replace('/\*([^*]+)\*/', '<em>$1</em>', $content);
        
        // Paragraphs
        $content = preg_replace('/\n\n/', '</p><p>', $content);
        $content = '<p>' . $content . '</p>';
        
        // Clean up empty paragraphs
        $content = preg_replace('/<p><\/p>/', '', $content);
        $content = preg_replace('/<p>(<h[1-6]>)/i', '$1', $content);
        $content = preg_replace('/(<\/h[1-6]>)<\/p>/i', '$1', $content);
        $content = preg_replace('/<p>(<img[^>]*>)<\/p>/i', '$1', $content);
        
        return $content;
    }
}
```

## 🎨 Template struktura

### Help Templates
```twig
{# templates/help/index.html.twig #}
{% extends 'base.html.twig' %}

{% block title %}Nápověda - Portál značkaře{% endblock %}

{% block body %}
    <div class="container container--lg">
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {# Sidebar navigation #}
            <div class="lg:col-span-1">
                {% include 'help/navigation.html.twig' with {
                    navigation: navigation,
                    currentSection: currentSection ?? null
                } %}
            </div>
            
            {# Main content #}
            <div class="lg:col-span-3">
                <div class="card">
                    <div class="card__content prose dark:prose-invert max-w-none">
                        {{ content|raw }}
                    </div>
                </div>
            </div>
        </div>
    </div>
{% endblock %}
```

```twig
{# templates/help/navigation.html.twig #}
<nav class="space-y-1">
    {% for section in navigation %}
        <div>
            <a href="{{ section.url }}" 
               class="flex items-center px-3 py-2 text-sm font-medium rounded-md {{ currentSection == section.name ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50' }}">
                {{ section.title }}
            </a>
            
            {% if section.pages and currentSection == section.name %}
                <div class="ml-3 mt-1 space-y-1">
                    {% for page in section.pages %}
                        <a href="{{ page.url }}" 
                           class="block px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md">
                            {{ page.title }}
                        </a>
                    {% endfor %}
                </div>
            {% endif %}
        </div>
    {% endfor %}
</nav>
```

## 🚀 Budoucí rozšíření

### CMS Admin Interface
```php
// src/Controller/Admin/ContentController.php (plánováno)
#[Route('/admin/content')]
class ContentController extends AbstractController
{
    #[Route('/metodiky', name: 'admin_metodiky')]
    public function metodiky(): Response
    {
        // CRUD interface pro metodiky
        return $this->render('admin/content/metodiky.html.twig');
    }
    
    #[Route('/downloads', name: 'admin_downloads')]  
    public function downloads(): Response
    {
        // CRUD interface pro downloads
        return $this->render('admin/content/downloads.html.twig');
    }
    
    #[Route('/help', name: 'admin_help')]
    public function helpManagement(): Response
    {
        // Interface pro správu help obsahu
        return $this->render('admin/content/help.html.twig');
    }
}
```

### Content Entities
```php
// src/Entity/Document.php (plánováno)
#[ORM\Entity(repositoryClass: DocumentRepository::class)]
class Document
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;
    
    #[ORM\Column(length: 255)]
    private ?string $title = null;
    
    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;
    
    #[ORM\ManyToOne(targetEntity: DocumentCategory::class)]
    private ?DocumentCategory $category = null;
    
    #[ORM\OneToOne(targetEntity: FileAttachment::class)]
    private ?FileAttachment $file = null;
    
    #[ORM\Column]
    private ?\DateTimeImmutable $created_at = null;
    
    #[ORM\Column]
    private ?\DateTimeImmutable $updated_at = null;
    
    // Getters and setters...
}
```

### Search Functionality
```php
// src/Service/ContentSearchService.php (plánováno)
class ContentSearchService
{
    public function searchDocuments(string $query, ?string $category = null): array
    {
        $qb = $this->em->getRepository(Document::class)
            ->createQueryBuilder('d')
            ->where('d.title LIKE :query OR d.description LIKE :query')
            ->setParameter('query', '%' . $query . '%');
            
        if ($category) {
            $qb->andWhere('d.category = :category')
               ->setParameter('category', $category);
        }
        
        return $qb->getQuery()->getResult();
    }
    
    public function searchHelpContent(string $query): array
    {
        // Full-text search v help markdown files
        $results = [];
        $helpDir = $this->projectDir . '/user-docs';
        
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($helpDir)
        );
        
        foreach ($iterator as $file) {
            if ($file->getExtension() === 'md') {
                $content = file_get_contents($file->getPathname());
                
                if (stripos($content, $query) !== false) {
                    $results[] = [
                        'file' => $file->getPathname(),
                        'section' => $this->extractSection($file),
                        'title' => $this->extractTitle($content),
                        'excerpt' => $this->extractExcerpt($content, $query)
                    ];
                }
            }
        }
        
        return $results;
    }
}
```

## 📊 Content Analytics

### Usage tracking
```php
// src/Service/ContentAnalyticsService.php (plánováno)
class ContentAnalyticsService
{
    public function trackDocumentView(int $documentId, ?User $user = null): void
    {
        $view = new DocumentView();
        $view->setDocument($this->em->getReference(Document::class, $documentId));
        $view->setUser($user);
        $view->setViewedAt(new \DateTimeImmutable());
        $view->setIpAddress($this->requestStack->getCurrentRequest()->getClientIp());
        
        $this->em->persist($view);
        $this->em->flush();
    }
    
    public function getPopularDocuments(int $limit = 10): array
    {
        return $this->em->getRepository(Document::class)
            ->createQueryBuilder('d')
            ->select('d, COUNT(v.id) as view_count')
            ->leftJoin('d.views', 'v')
            ->groupBy('d.id')
            ->orderBy('view_count', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }
}
```

---

**File Management:** [../features/file-management.md](../features/file-management.md)  
**Services Configuration:** [../configuration.md](../configuration.md)  
**Help System Live:** [/napoveda](/napoveda) (když aplikace běží)  
**Aktualizováno:** 2025-07-22