# Content Management System

> **Topics dokumentace** - Kompletní CMS funkcionalita včetně WYSIWYG editoru, metodik, downloads a help systému

## 📚 Přehled Content Management

### ✅ Implementováno (v produkci)
- **CMS Pages** - Plně funkční správa stránek s Tiptap WYSIWYG editorem
- **Help systém** - Markdown-based nápověda pro uživatele
- **Static pages** - Server-rendered Twig stránky

### 🚧 Plánováno
- **Metodiky** - Kategorizované PDF dokumenty a návody
- **Downloads** - Soubory ke stažení (formuláře, templates, atd.)

---

## 🎯 CMS Pages System (IMPLEMENTOVÁNO)

### Přehled
Kompletní CMS slouží ke správě statických stránek, dokumentace, metodik a FAQ položek. Poskytuje WYSIWYG editor s podporou bohatého formátování a kompletní správu životního cyklu obsahu.

**API dokumentace:** [docs/api/cms-api.md](../api/cms-api.md)

### Použité technologie
- **Backend**: Symfony 6.4 + PostgreSQL
- **Frontend**: React 18 + TanStack Table
- **Editor**: Tiptap (lightweight WYSIWYG, 100KB)
- **Styling**: BEM + Tailwind CSS

### Database Schema
```sql
CREATE TABLE pages (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    excerpt TEXT NULL,
    content_type VARCHAR(50) NOT NULL DEFAULT 'page',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    author_id INTEGER NOT NULL,
    parent_id BIGINT NULL REFERENCES pages(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    featured_image_id INTEGER NULL REFERENCES file_attachments(id),
    meta JSON DEFAULT '{}'::json,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,
    history JSON DEFAULT '[]'::json
);
```

### Klíčové komponenty

**Backend:**
- `PageStatusEnum`: Stavy stránky (draft, published, archived)
- `PageContentTypeEnum`: Typy obsahu (page, article, document, faq)
- `Page` entity: Hlavní entita s lifecycle callbacky
- `PageRepository`: Query metody pro vyhledávání a stromovou strukturu
- `PageService`: Business logika pro správu stránek
- `SlugService`: Generování URL-friendly slugů s podporou české diakritiky
- `CmsApiController`: REST API pro admin rozhraní (`/admin/api/cms/*`)
- `CmsController`: Frontend zobrazení stránek (`/cms/{slug}`)

**Frontend:**
- `admin-cms-pages`: React administrační aplikace
- `TiptapEditor`: WYSIWYG editor s toolbarem
- `PageForm`: Formulář pro vytváření/editaci stránek

### Administrační rozhraní

**URL:** `/admin/cms`

**Funkce:**
1. Seznam stránek s TanStack React Table
2. Filtry: Status, Typ obsahu, Zobrazit smazané
3. Akce: Zobrazit, Upravit, Publikovat/Archivovat, Smazat, Obnovit
4. Vytvoření nové stránky s Tiptap editorem

### Frontend zobrazení

**URL Pattern:** `/cms/{slug}`

**Features:**
- Breadcrumbs navigace (hierarchická cesta)
- SEO meta tagy (seo_title, seo_description, keywords)
- Featured image support
- Prose styling (Tailwind Typography)
- Pouze publikované stránky

### Typy obsahu (PageContentTypeEnum)

- **page** (Stránka): Standardní statická stránka
- **article** (Článek): Novinky, aktuality
- **document** (Dokument): Metodiky, návody
- **faq** (FAQ): Často kladené otázky

### Životní cyklus stránky

**Stavy (PageStatusEnum):**
- **draft** (Koncept): Výchozí stav, viditelný pouze v administraci
- **published** (Publikováno): Viditelný na frontendu
- **archived** (Archivováno): Není viditelný, ale není smazaný
- **deleted** (Smazáno): Soft delete - stránka v koši, lze obnovit

**Přechody:**
```
draft → publish() → published
published → archive() → archived
archived → publish() → published
* → softDelete() → deleted (status=DELETED, deleted_at set, previous status saved to meta)
deleted → restore() → původní status (from meta.status_before_delete)
```

**Soft Delete implementace:**
```php
// Page::softDelete() - uloží původní status do meta
public function softDelete(int $userId): static
{
    $this->setMetaValue('status_before_delete', $this->status->value);
    $oldStatus = $this->status->value;
    $this->status = PageStatusEnum::DELETED;
    $this->deletedAt = new \DateTimeImmutable();

    $this->addHistoryEntry($userId, 'deleted', [
        'status' => [$oldStatus, 'deleted'],
        'deleted_at' => $this->deletedAt->format('c')
    ]);
    return $this;
}

// Page::restore() - obnoví původní status z meta
public function restore(int $userId): static
{
    $previousStatus = $this->getMetaValue('status_before_delete', 'draft');
    $this->status = PageStatusEnum::from($previousStatus);
    $this->deletedAt = null;

    // Vymaž saved status z meta
    $meta = $this->meta;
    unset($meta['status_before_delete']);
    $this->meta = $meta;

    $this->addHistoryEntry($userId, 'restored', [
        'status' => ['deleted', $previousStatus]
    ]);
    return $this;
}
```

### WYSIWYG Editor (Tiptap)

**Podporované formátování:**
- Text: Tučné, kurzíva, přeškrtnuté, kód
- Nadpisy: H1, H2, H3
- Seznamy: Odrážkový, číslovaný
- Bloky: Citace, horizontální oddělovač
- Odkazy: URL odkazy
- Obrázky: URL obrázků (inline)
- Undo/Redo: Historie změn

**Výstup:** Čisté HTML uložené v `content` TEXT sloupci

#### WordPress-Style Media Picker

**Lokace:** `assets/js/components/shared/media/MediaPickerModal.jsx`

Integrovaný media picker v Tiptap editoru pro snadné nahrávání a výběr obrázků z knihovny médií.

**Funkce:**
- **Tab "Knihovna médií":**
  - Grid view všech CMS souborů
  - Filtry: Type (images/all/pdfs/documents), Search
  - Preview před výběrem
  - Výběr existujícího souboru

- **Tab "Nahrát nový":**
  - Drag & drop upload
  - Camera support (mobilní zařízení)
  - Automatická komprese obrázků (1920px @ 85%)
  - Vytvoření thumbnailů

- **Alt text input:**
  - Povinné pole pro accessibility
  - Auto-generovaný z názvu souboru
  - Ukládá se do `<img alt="">` atributu

**Použití v editoru:**
```jsx
// Tlačítko v toolbaru
<ToolbarButton onClick={() => setMediaPickerOpen(true)}>
    <IconPhoto size={18} />
</ToolbarButton>

// Vložení obrázku s usage tracking
editor.chain().focus().setImage({
    src: file.url,
    alt: altText,
    'data-file-id': file.id  // Pro usage tracking
}).run();
```

**Storage path:**
- CMS obrázky: `/uploads/cms/pages/{pageId}/`
- Public přístup (bez tokenu)

**Usage tracking:**
- Při save stránky se parsuje HTML obsah
- Extrahují se `data-file-id` atributy
- Automaticky se aktualizuje `FileAttachment.usageInfo`
- Usage type: `pages`, entity ID: `{pageId}`, field: `content_images`

**Backend flow:**
```php
// PageService::updatePageFileUsage()
1. Parse HTML pro <img data-file-id="123">
2. Získej current usage z DB
3. Přidej nové usage: $file->addUsage('pages', $pageId, 'content_images')
4. Odstraň staré usage: $file->removeUsage('pages', $pageId)
```

**Implementované metody:**
- `PageService::updatePageFileUsage(Page $page)` - Automatická aktualizace usage tracking
- `PageService::extractFileIdsFromContent(string $html)` - DOMDocument parsing img tagů
- Volání v `CmsApiController::createPage()` a `updatePage()`

### SEO Metadata

Metadata v JSON `meta` poli:
```json
{
    "seo_title": "Custom <title> tag",
    "seo_description": "Meta description",
    "keywords": ["keyword1", "keyword2"]
}
```

### Hierarchická struktura

```php
// Parent-Child vztah
$page->setParent($parentPage);
$page->getChildren(); // Collection

// Breadcrumbs (cesta od root)
$page->getBreadcrumbs(); // array

// Slug cesta
$page->getPath(); // ['root-slug', 'parent-slug']

// Hloubka ve stromu
$page->getDepth(); // 0 = root, 1 = první úroveň
```

### Full-text vyhledávání

```php
// Trigram search (pg_trgm extension)
$pages = $pageRepository->search('značení trasy', publishedOnly: true);
```

Vyhledává v: `title`, `excerpt`, `content`

### Slug generování

```php
// SlugService transliterace
"Značení tras v KČT" → "znaceni-tras-v-kct"

// Czech diacritics map:
'á' => 'a', 'č' => 'c', 'ř' => 'r', 'š' => 's', ...
```

### Přiložené soubory

Integrace s `FileAttachment`:
```php
$pageService->attachFile($page, $file, 'page_attachment');
$attachments = $pageService->getPageAttachments($page);
```

### History tracking

```json
[
    {
        "action": "created",
        "user_id": 1,
        "timestamp": "2025-11-06T20:00:00+00:00"
    },
    {
        "action": "published",
        "user_id": 1,
        "timestamp": "2025-11-06T20:05:00+00:00"
    }
]
```

---

## 📖 Metodiky systém (IMPLEMENTOVÁNO)

### Přehled
Metodiky používají CMS systém - stránky jsou uloženy v databázi s typem `PageContentTypeEnum::METODIKA` a zobrazeny přes standardní route.

**URL:** `/metodika/`

### AppController implementace
```php
// src/Controller/AppController.php
#[Route('/metodika', name: 'app_metodika')]
public function metodika(PageRepository $pageRepository): Response
{
    $dily = $pageRepository->findBy([
        'contentType' => PageContentTypeEnum::METODIKA,
        'parent' => null,
        'status' => PageStatusEnum::PUBLISHED,
    ], ['sortOrder' => 'ASC']);

    return $this->render('pages/metodika.html.twig', [
        'dily' => $dily,
    ]);
}
```

### Template
```twig
{# templates/pages/metodika.html.twig #}
{% extends 'base.html.twig' %}

{% block title %}Metodika značení - Portál značkaře{% endblock %}

{% block body %}
    <div class="container container--xl">
        {% include 'components/page-header.html.twig' with {
            title: 'Metodika značení',
            subtitle: 'Komplexní průvodce značením turistických tras'
        } %}

        {# Grid karet dílů metodiky #}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {% for dil in dily %}
                <a href="{{ dil.urlPath }}" class="card hover:shadow-lg transition-shadow">
                    {{ tabler_icon(dil.meta.icon ?? 'book', 32) }}
                    <h3>{{ dil.title }}</h3>
                    {% if dil.excerpt %}
                        <p>{{ dil.excerpt }}</p>
                    {% endif %}
                    <span class="badge badge--primary badge--sm">
                        {{ dil.children|length }} {{ dil.children|length == 1 ? 'kapitola' : (dil.children|length < 5 ? 'kapitoly' : 'kapitol') }}
                    </span>
                </a>
            {% endfor %}
        </div>
    </div>
{% endblock %}
```

### Hierarchická struktura
Metodiky podporují parent-child hierarchii:
- **Díly** (parent=null): Hlavní části metodiky
- **Kapitoly** (parent=dil): Podstránky pod jednotlivými díly

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

## 📚 Help System (NAPOVEDA)

### Přehled
Nápověda používá stejný CMS systém jako metodiky - stránky jsou uloženy v databázi s typem `PageContentTypeEnum::NAPOVEDA` a zobrazeny přes `HelpController`.

**URL:** `/napoveda/`

### HelpController - Database-driven
```php
// src/Controller/HelpController.php
#[Route('/napoveda')]
class HelpController extends AbstractController
{
    public function __construct(
        private PageRepository $pageRepository
    ) {
    }

    #[Route('/', name: 'help_index')]
    public function index(): Response
    {
        // Načti publikované nápovědy z databáze
        $napovedy = $this->pageRepository->findBy([
            'contentType' => PageContentTypeEnum::NAPOVEDA,
            'parent' => null,
            'status' => PageStatusEnum::PUBLISHED,
        ], ['sortOrder' => 'ASC']);

        return $this->render('pages/napoveda.html.twig', [
            'napovedy' => $napovedy,
        ]);
    }

    #[Route('/{slug}', name: 'help_page', priority: -1)]
    public function page(string $slug): Response
    {
        // Najdi stránku podle slugu
        $page = $this->pageRepository->findOneBy([
            'slug' => $slug,
            'contentType' => PageContentTypeEnum::NAPOVEDA,
            'status' => PageStatusEnum::PUBLISHED,
        ]);

        if (!$page) {
            throw $this->createNotFoundException('Stránka nápovědy nebyla nalezena');
        }

        return $this->render('pages/napoveda-detail.html.twig', [
            'page' => $page,
        ]);
    }
}
```

### Templates
```twig
{# templates/pages/napoveda.html.twig - Seznam nápověd #}
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {% for napoveda in napovedy %}
        <a href="{{ napoveda.urlPath }}" class="card hover:shadow-lg transition-shadow">
            {{ tabler_icon(napoveda.meta.icon ?? 'help-circle', 32) }}
            <h3>{{ napoveda.title }}</h3>
            <p>{{ napoveda.excerpt }}</p>
        </a>
    {% endfor %}
</div>
```

```twig
{# templates/pages/napoveda-detail.html.twig - Detail nápovědy #}
<article class="card prose prose-lg dark:prose-invert max-w-none">
    {{ page.content|raw }}
</article>

{# Zobrazit child stránky #}
{% if page.children|length > 0 %}
    <h2>Související témata</h2>
    {% for child in page.children %}
        <a href="{{ child.urlPath }}">{{ child.title }}</a>
    {% endfor %}
{% endif %}
```

---

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

**CMS API Reference:** [../api/cms-api.md](../api/cms-api.md)
**File Management:** [../features/file-management.md](../features/file-management.md)
**Services Configuration:** [../configuration.md](../configuration.md)
**Metodiky Live:** [/metodika](/metodika) (když aplikace běží)
**Nápověda Live:** [/napoveda](/napoveda) (když aplikace běží)
**Aktualizováno:** 2025-11-07

## Changelog
- **2025-11-07**:
  - Přidán DELETED status do PageStatusEnum (4 stavy místo 3)
  - Změna soft delete logiky - status-based místo timestamp-only (ukládá původní status do meta)
  - Help System změněn z markdown-based na database-driven (PageContentTypeEnum::NAPOVEDA)
  - Metodiky systém označen jako implementováno (database-driven)
- **2025-11-06**: Initial CMS documentation created