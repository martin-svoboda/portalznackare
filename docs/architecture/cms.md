# CMS Architektura

Návrh kompletního content management systému pro metodiky, stránky, příspěvky a downloads.

## 🏗️ Databázová struktura

### Core Content Entities

```php
// Abstraktní třída pro všechen obsah
abstract class AbstractContent extends AbstractEntity
{
    protected int $id;
    protected string $title;
    protected string $slug;           // URL slug
    protected string $content;        // HTML obsah
    protected string $excerpt;        // Krátký popis
    protected string $status;         // draft, published, archived
    protected bool $featured;         // featured content
    protected ?User $author;          // autor obsahu
    protected ?\DateTimeImmutable $publishedAt;
    protected \DateTimeImmutable $createdAt;
    protected \DateTimeImmutable $updatedAt;
    protected ?array $metadata;       // JSON pro custom fields
    protected Collection $attachments; // vztah k FileAttachment
    protected Collection $categories;  // many-to-many s kategoriemi
}

// Metodika
class Metodika extends AbstractContent
{
    private ?string $pdfFile;         // cesta k PDF souboru
    private int $downloadCount;       // počítadlo stažení
    private bool $isOfficial;        // oficiální metodika KČT
    private ?string $version;         // verze metodiky
}

// Stránka
class Page extends AbstractContent  
{
    private ?string $template;        // custom template
    private bool $showInMenu;         // zobrazit v menu
    private int $menuOrder;           // pořadí v menu
    private ?Page $parent;            // hierarchie stránek
    private Collection $children;     // sub-stránky
}

// Příspěvek/Novinka
class Post extends AbstractContent
{
    private bool $allowComments;      // povolit komentáře
    private Collection $tags;         // tagy
}

// Download (speciální typ pro soubory ke stažení)
class Download extends AbstractContent
{
    private string $filePath;         // cesta k souboru
    private string $fileType;         // typ souboru
    private int $fileSize;            // velikost souboru
    private int $downloadCount;       // počítadlo stažení
    private bool $requiresLogin;      // vyžaduje přihlášení
}
```

### Taxonomie (Kategorie & Tagy)

```php
// Abstraktní taxonomie
abstract class AbstractTaxonomy extends AbstractEntity
{
    protected string $name;
    protected string $slug;
    protected ?string $description;
    protected ?string $color;         // barva pro UI
    protected ?string $icon;          // ikona
    protected int $sortOrder;
}

// Kategorie pro metodiky
class MetodikaCategory extends AbstractTaxonomy
{
    private Collection $metodiky;     // many-to-many
}

// Kategorie pro stránky  
class PageCategory extends AbstractTaxonomy
{
    private Collection $pages;
}

// Kategorie pro příspěvky
class PostCategory extends AbstractTaxonomy
{
    private Collection $posts;
}

// Kategorie pro downloads
class DownloadCategory extends AbstractTaxonomy
{
    private Collection $downloads;
}

// Tagy (univerzální pro všechen obsah)
class Tag extends AbstractTaxonomy
{
    private Collection $metodiky;
    private Collection $pages;
    private Collection $posts;
    private Collection $downloads;
}
```

## 🎛️ Admin architektura

### Admin Controllers

```php
namespace App\Controller\Admin;

// Base admin controller
abstract class AbstractAdminController extends AbstractController
{
    protected function checkAdminAccess(): void;
    protected function renderAdmin(string $template, array $parameters = []): Response;
}

// Správa metodik
class MetodikaAdminController extends AbstractAdminController
{
    #[Route('/admin/metodiky')]
    public function index(): Response;
    
    #[Route('/admin/metodiky/new')]
    public function create(Request $request): Response;
    
    #[Route('/admin/metodiky/{id}/edit')]
    public function edit(int $id, Request $request): Response;
    
    #[Route('/admin/metodiky/{id}/delete')]
    public function delete(int $id): Response;
}

// Správa stránek
class PageAdminController extends AbstractAdminController { /* ... */ }

// Správa příspěvků  
class PostAdminController extends AbstractAdminController { /* ... */ }

// Správa downloads
class DownloadAdminController extends AbstractAdminController { /* ... */ }

// Správa kategorií
class CategoryAdminController extends AbstractAdminController { /* ... */ }

// File management (už máme navrženo)
class FileAdminController extends AbstractAdminController { /* ... */ }
```

### Admin Services

```php
// Content management service
class ContentService
{
    public function createContent(string $type, array $data): AbstractContent;
    public function updateContent(AbstractContent $content, array $data): void;
    public function publishContent(AbstractContent $content): void;
    public function archiveContent(AbstractContent $content): void;
    public function generateSlug(string $title, string $type): string;
    public function processCkeditorContent(string $content): string;
}

// SEO service  
class SeoService
{
    public function generateMetaTags(AbstractContent $content): array;
    public function generateStructuredData(AbstractContent $content): array;
    public function validateSlug(string $slug, string $type, ?int $excludeId = null): bool;
}

// Search service
class SearchService  
{
    public function indexContent(AbstractContent $content): void;
    public function search(string $query, array $types = []): array;
    public function getPopularContent(string $type, int $limit = 10): array;
}
```

## 📝 Editor řešení

### CKEditor 5 (doporučeno)

```javascript
// CKEditor konfigurace
class EditorConfig {
    static getConfig() {
        return {
            toolbar: [
                'heading', '|',
                'bold', 'italic', 'underline', '|',
                'bulletedList', 'numberedList', '|',
                'link', 'blockQuote', 'insertTable', '|',
                'imageUpload', 'mediaEmbed', '|',
                'undo', 'redo'
            ],
            image: {
                toolbar: ['imageTextAlternative', 'imageStyle:full', 'imageStyle:side'],
                upload: {
                    types: ['jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff']
                }
            },
            table: {
                contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
            },
            // Custom upload adapter pro náš file management
            simpleUpload: {
                uploadUrl: '/api/portal/files/upload?is_public=true&path=content'
            }
        };
    }
}
```

## 🌐 Frontend architektura

### Dynamic Templates

```twig
{# templates/content/metodika.html.twig #}
{% extends 'base.html.twig' %}

{% block content %}
<article class="content content--metodika">
    <header class="content__header">
        <h1 class="content__title">{{ metodika.title }}</h1>
        
        {% if metodika.categories %}
            <div class="content__categories">
                {% for category in metodika.categories %}
                    <span class="badge badge--{{ category.color }}">{{ category.name }}</span>
                {% endfor %}
            </div>
        {% endif %}
        
        <div class="content__meta">
            <time datetime="{{ metodika.publishedAt|date('c') }}">{{ metodika.publishedAt|date('j. n. Y') }}</time>
            {% if metodika.author %}
                <span>{{ metodika.author.name }}</span>
            {% endif %}
        </div>
    </header>

    <div class="content__body">
        {{ metodika.content|raw }}
        
        {% if metodika.pdfFile %}
            <div class="content__download">
                <a href="{{ asset(metodika.pdfFile) }}" class="btn btn--primary" download>
                    <i class="icon-download"></i>
                    Stáhnout PDF ({{ metodika.fileSize|format_bytes }})
                </a>
            </div>
        {% endif %}
    </div>
    
    {% if metodika.attachments %}
        <section class="content__attachments">
            <h3>Přílohy</h3>
            {% for attachment in metodika.attachments %}
                {% include 'components/file-attachment.html.twig' with {file: attachment} %}
            {% endfor %}
        </section>
    {% endif %}
</article>
{% endblock %}
```

### Content API

```php
// Frontend API pro obsah
class ContentApiController extends AbstractController
{
    #[Route('/api/content/metodiky')]
    public function getMetodiky(Request $request): JsonResponse;
    
    #[Route('/api/content/metodika/{slug}')]
    public function getMetodika(string $slug): JsonResponse;
    
    #[Route('/api/content/pages/{slug}')]
    public function getPage(string $slug): JsonResponse;
    
    #[Route('/api/content/posts')]
    public function getPosts(Request $request): JsonResponse;
    
    #[Route('/api/content/search')]
    public function search(Request $request): JsonResponse;
}
```

## 📋 Implementation TODO

### Fáze 1: Core CMS (4-6 týdnů)

#### Week 1-2: Database & Entities
- [ ] Vytvořit abstract `AbstractContent` entity
- [ ] Implementovat `Metodika`, `Page`, `Post`, `Download` entities  
- [ ] Vytvořit taxonomy entities (`MetodikaCategory`, `Tag`, atd.)
- [ ] Doctrine migrace pro nové entity
- [ ] Repository třídy s query methods

#### Week 3-4: Admin Backend
- [ ] Base admin controller a služby
- [ ] Admin rozhraní pro metodiky (CRUD)
- [ ] Admin rozhraní pro stránky (CRUD)
- [ ] Admin rozhraní pro příspěvky (CRUD)
- [ ] Admin rozhraní pro downloads (CRUD)
- [ ] Správa kategorií a tagů

#### Week 5-6: Editor & Frontend
- [ ] CKEditor 5 integrace s custom upload
- [ ] Dynamic content templaty (Twig)
- [ ] Frontend API endpointy
- [ ] Search funkcionalita
- [ ] SEO optimalizace (meta tagy, strukturovaná data)

### Fáze 2: Advanced Features (2-4 týdny)

#### Week 7-8: Polish & UX
- [ ] Bulk operations v admin
- [ ] Media library integrace
- [ ] Preview system (draft preview)
- [ ] Workflow (draft → review → published)
- [ ] Admin dashboard s analytics

#### Week 9-10: Performance & SEO
- [ ] Cache layer pro obsah
- [ ] Sitemap generování
- [ ] RSS feeds
- [ ] Performance optimization
- [ ] Search indexing

### Fáze 3: Extensions (1-2 týdny)

#### Week 11-12: Bonus Features
- [ ] Content versioning (pokud potřeba)
- [ ] Komentáře systém (pokud potřeba)
- [ ] Newsletter integrace (pokud potřeba)
- [ ] Export/Import tools

## 🎯 Architektonická rozhodnutí

### 1. Editor: CKEditor 5
- ✅ **Výhody:** Modern, rozšiřitelný, dobré UX, custom upload adaptery
- ✅ **Integrace:** Snadná integrace s naším file managementem
- ✅ **Customizace:** Můžeme přidat custom pluginy pro KČT potřeby

### 2. Content Model: Unified approach
- ✅ **AbstractContent:** Společná funkcionalita pro všechny typy obsahu
- ✅ **Specialized entities:** Specifické vlastnosti pro každý typ
- ✅ **Flexible taxonomies:** Kategorie + tagy pro organizaci

### 3. Frontend: Hybrid approach
- ✅ **Dynamic Twig:** Pro SEO a performance
- ✅ **API endpoints:** Pro interaktivní části (search, filters)
- ✅ **Micro-apps:** Tam kde potřebujeme rich interactivity

### 4. Admin: Custom built
- ✅ **Tailored UX:** Přímo pro potřeby značkařů
- ✅ **Integrace:** Seamless s file managementem
- ✅ **Performance:** Optimalizováno pro náš use case

---

**Závěr:** Custom CMS s CKEditor 5, unified content modelem a hybrid frontend přístupem poskytne plnou kontrolu při rozumné složitosti.