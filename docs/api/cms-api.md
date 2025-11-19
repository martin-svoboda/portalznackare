# CMS API Reference

REST API pro správu CMS stránek v administračním rozhraní.

## Base URL
```
/admin/api/cms
```

## Autentizace
Všechny endpointy vyžadují přihlášení přes Symfony Security systém.

---

## Endpoints

### 1. List Pages
Seznam všech stránek s filtry.

**Endpoint:** `GET /admin/api/cms/pages`

**Query parametry:**
- `status` (optional): Filter podle stavu (`draft`, `published`, `archived`)
- `content_type` (optional): Filter podle typu (`page`, `article`, `document`, `faq`)
- `include_deleted` (optional): `true` pro zobrazení smazaných stránek

**Request:**
```http
GET /admin/api/cms/pages?status=published&content_type=page
```

**Response:** `200 OK`
```json
[
    {
        "id": 1,
        "title": "Úvodní stránka",
        "slug": "uvodni-stranka",
        "excerpt": "Vítejte na portálu značkaře...",
        "content_type": "page",
        "status": "published",
        "author_id": 1,
        "parent_id": null,
        "sort_order": 0,
        "featured_image_id": null,
        "created_at": "2025-11-06T20:00:00+00:00",
        "updated_at": "2025-11-06T20:05:00+00:00",
        "published_at": "2025-11-06T20:05:00+00:00",
        "deleted_at": null,
        "is_deleted": false
    }
]
```

---

### 2. Get Page Detail
Detail jedné stránky včetně meta informací.

**Endpoint:** `GET /admin/api/cms/pages/{id}`

**Path parametry:**
- `id`: ID stránky

**Request:**
```http
GET /admin/api/cms/pages/1
```

**Response:** `200 OK`
```json
{
    "id": 1,
    "title": "Úvodní stránka",
    "slug": "uvodni-stranka",
    "content": "<h1>Vítejte</h1><p>Obsah stránky...</p>",
    "excerpt": "Vítejte na portálu značkaře...",
    "content_type": "page",
    "status": "published",
    "author_id": 1,
    "parent_id": null,
    "sort_order": 0,
    "featured_image_id": null,
    "meta": {
        "seo_title": "Portál značkaře KČT",
        "seo_description": "Oficiální portál pro značkaře KČT",
        "keywords": ["kčt", "značení", "turistika"]
    },
    "created_at": "2025-11-06T20:00:00+00:00",
    "updated_at": "2025-11-06T20:05:00+00:00",
    "published_at": "2025-11-06T20:05:00+00:00",
    "deleted_at": null,
    "history": [
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
}
```

**Error Response:** `404 Not Found`
```json
{
    "error": "Stránka nebyla nalezena"
}
```

---

### 3. Create Page
Vytvoření nové stránky.

**Endpoint:** `POST /admin/api/cms/pages`

**Request Body:**
```json
{
    "title": "Nová stránka",
    "slug": "nova-stranka",
    "content": "<h1>Obsah</h1><p>Text stránky...</p>",
    "excerpt": "Krátký popis",
    "content_type": "page",
    "status": "draft",
    "parent_id": null,
    "meta": {
        "seo_title": "Vlastní SEO titulek",
        "seo_description": "Meta popis",
        "keywords": ["keyword1", "keyword2"]
    }
}
```

**Response:** `201 Created`
```json
{
    "id": 2,
    "title": "Nová stránka",
    "slug": "nova-stranka",
    "status": "draft",
    "created_at": "2025-11-06T20:10:00+00:00",
    "message": "Stránka byla úspěšně vytvořena"
}
```

**Error Response:** `400 Bad Request`
```json
{
    "error": "Slug již existuje",
    "field": "slug"
}
```

**Validace:**
- `title`: povinné, max 500 znaků
- `slug`: povinné, unique, max 500 znaků, pouze a-z0-9-
- `content`: povinné
- `content_type`: enum (`page`, `article`, `document`, `faq`)
- `status`: enum (`draft`, `published`, `archived`)

---

### 4. Update Page
Aktualizace existující stránky.

**Endpoint:** `PUT /admin/api/cms/pages/{id}`

**Path parametry:**
- `id`: ID stránky

**Request Body:**
```json
{
    "title": "Upravená stránka",
    "slug": "upravena-stranka",
    "content": "<h1>Nový obsah</h1>",
    "excerpt": "Aktualizovaný popis",
    "content_type": "article",
    "status": "published",
    "parent_id": 1,
    "meta": {
        "seo_title": "Nový SEO titulek"
    }
}
```

**Response:** `200 OK`
```json
{
    "id": 2,
    "title": "Upravená stránka",
    "updated_at": "2025-11-06T20:15:00+00:00",
    "message": "Stránka byla úspěšně aktualizována"
}
```

**Error Responses:**
- `404 Not Found`: Stránka neexistuje
- `400 Bad Request`: Validační chyba

---

### 5. Delete Page (Soft)
Soft delete stránky (nastavení `deleted_at`).

**Endpoint:** `DELETE /admin/api/cms/pages/{id}`

**Path parametry:**
- `id`: ID stránky

**Request:**
```http
DELETE /admin/api/cms/pages/2
```

**Response:** `200 OK`
```json
{
    "message": "Stránka byla smazána"
}
```

**Error Response:** `404 Not Found`

---

### 6. Publish Page
Publikování stránky (změna statusu na `published`).

**Endpoint:** `PATCH /admin/api/cms/pages/{id}/publish`

**Path parametry:**
- `id`: ID stránky

**Request:**
```http
PATCH /admin/api/cms/pages/2/publish
```

**Response:** `200 OK`
```json
{
    "message": "Stránka byla publikována",
    "status": "published",
    "published_at": "2025-11-06T20:20:00+00:00"
}
```

**Notes:**
- Nastaví `status = 'published'`
- Nastaví `published_at` timestamp
- Přidá záznam do `history`

---

### 7. Archive Page
Archivace stránky (změna statusu na `archived`).

**Endpoint:** `PATCH /admin/api/cms/pages/{id}/archive`

**Path parametry:**
- `id`: ID stránky

**Request:**
```http
PATCH /admin/api/cms/pages/2/archive
```

**Response:** `200 OK`
```json
{
    "message": "Stránka byla archivována",
    "status": "archived"
}
```

---

### 8. Restore Page
Obnovení smazané stránky.

**Endpoint:** `PATCH /admin/api/cms/pages/{id}/restore`

**Path parametry:**
- `id`: ID stránky

**Request:**
```http
PATCH /admin/api/cms/pages/2/restore
```

**Response:** `200 OK`
```json
{
    "message": "Stránka byla obnovena",
    "deleted_at": null
}
```

**Error Response:** `400 Bad Request`
```json
{
    "error": "Stránka není smazána"
}
```

---

### 9. Search Pages
Full-text vyhledávání v stránkách.

**Endpoint:** `GET /admin/api/cms/search`

**Query parametry:**
- `q`: Vyhledávací dotaz (min. 3 znaky)
- `published_only` (optional): `true` pro vyhledávání pouze v publikovaných

**Request:**
```http
GET /admin/api/cms/search?q=značení&published_only=true
```

**Response:** `200 OK`
```json
[
    {
        "id": 1,
        "title": "Značení turistických tras",
        "slug": "znaceni-turistickych-tras",
        "excerpt": "Metodika značení tras v KČT...",
        "content_type": "document",
        "status": "published"
    }
]
```

**Vyhledává v:**
- `title`
- `excerpt`
- `content`

**Technologie:** PostgreSQL trigram search (pg_trgm extension)

---

### 10. Get Tree Structure
Stromová struktura stránek (hierarchie).

**Endpoint:** `GET /admin/api/cms/tree`

**Query parametry:**
- `published_only` (optional): `true` pro pouze publikované stránky

**Request:**
```http
GET /admin/api/cms/tree?published_only=false
```

**Response:** `200 OK`
```json
[
    {
        "id": 1,
        "title": "Dokumentace",
        "slug": "dokumentace",
        "parent_id": null,
        "children": [
            {
                "id": 2,
                "title": "Značení tras",
                "slug": "znaceni-tras",
                "parent_id": 1,
                "children": []
            }
        ]
    }
]
```

**Notes:**
- Vrací stránky seřazené podle `sort_order`
- Rekurzivní struktura parent-children

---

### 11. Get Trash
Seznam smazaných stránek.

**Endpoint:** `GET /admin/api/cms/trash`

**Request:**
```http
GET /admin/api/cms/trash
```

**Response:** `200 OK`
```json
[
    {
        "id": 3,
        "title": "Smazaná stránka",
        "slug": "smazana-stranka",
        "deleted_at": "2025-11-06T19:00:00+00:00",
        "content_type": "page",
        "status": "draft"
    }
]
```

---

### 12. Check Slug Availability
Kontrola dostupnosti slug (pro validaci při vytváření/editaci).

**Endpoint:** `GET /admin/api/cms/check-slug`

**Query parametry:**
- `slug`: Slug ke kontrole
- `exclude_id` (optional): ID stránky, která se ignoruje (pro editaci)

**Request:**
```http
GET /admin/api/cms/check-slug?slug=nova-stranka&exclude_id=5
```

**Response:** `200 OK`
```json
{
    "available": true,
    "slug": "nova-stranka"
}
```

nebo

```json
{
    "available": false,
    "slug": "nova-stranka",
    "suggestion": "nova-stranka-2"
}
```

---

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Úspěšná operace |
| 201 | Created - Stránka vytvořena |
| 400 | Bad Request - Validační chyba |
| 401 | Unauthorized - Nepřihlášený uživatel |
| 403 | Forbidden - Nedostatečná oprávnění |
| 404 | Not Found - Stránka neexistuje |
| 500 | Internal Server Error - Chyba serveru |

## Error Response Format

```json
{
    "error": "Popis chyby",
    "field": "nazev_pole",
    "code": "ERROR_CODE"
}
```

## Poznámky

### Bezpečnost
- Všechny endpointy kontrolují `ROLE_ADMIN`
- CSRF ochrana je součástí Symfony Security
- XSS ochrana při ukládání HTML obsahu

### Performance
- List Pages používá indexy na `status`, `content_type`, `deleted_at`
- Search používá trigram indexy pro rychlé LIKE queries
- Tree structure cachování doporučeno pro velké hierarchie

### Changelog History
Všechny mutační operace (create, update, publish, archive, delete, restore) automaticky přidávají záznam do `history` pole:

```json
{
    "action": "published",
    "user_id": 1,
    "timestamp": "2025-11-06T20:05:00+00:00"
}
```

## Příklady použití

### JavaScript Fetch
```javascript
// Create new page
const response = await fetch('/admin/api/cms/pages', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        title: 'Nová stránka',
        slug: 'nova-stranka',
        content: '<p>Obsah...</p>',
        content_type: 'page',
        status: 'draft'
    })
});

const data = await response.json();
console.log(data);

// Publish page
await fetch('/admin/api/cms/pages/1/publish', {
    method: 'PATCH'
});

// Search
const searchResponse = await fetch(
    '/admin/api/cms/search?q=značení&published_only=true'
);
const results = await searchResponse.json();
```

### cURL Examples
```bash
# List all pages
curl -X GET https://portalznackare.ddev.site/admin/api/cms/pages

# Create page
curl -X POST https://portalznackare.ddev.site/admin/api/cms/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test stránka",
    "slug": "test-stranka",
    "content": "<p>Test obsah</p>",
    "content_type": "page",
    "status": "draft"
  }'

# Publish page
curl -X PATCH https://portalznackare.ddev.site/admin/api/cms/pages/1/publish

# Delete page
curl -X DELETE https://portalznackare.ddev.site/admin/api/cms/pages/1
```

## Media Picker Integration & File Usage Tracking

### WordPress-Style Media Picker

CMS editor integruje MediaPickerModal komponentu pro snadné nahrávání a výběr obrázků.

**Komponenta:** `assets/js/components/shared/media/MediaPickerModal.jsx`

**Funkce:**
1. **Výběr z knihovny:** Grid view všech CMS souborů s filtry a search
2. **Upload nových souborů:** Drag & drop, camera support, automatická komprese
3. **Alt text input:** Povinné pole pro accessibility

**Storage:**
- Path: `/uploads/cms/pages/{pageId}/`
- Public access (bez security tokenu)

**Vložení do editoru:**
```jsx
// Tiptap vložení obrázku s usage tracking
editor.chain().focus().setImage({
    src: file.url,
    alt: altText,
    'data-file-id': file.id  // Atribut pro usage tracking
}).run();
```

**HTML výstup:**
```html
<img
    src="/uploads/cms/pages/123/obrazek.jpg"
    alt="Popis obrázku"
    data-file-id="456"
>
```

### Automatické Usage Tracking

Při uložení stránky (CREATE nebo UPDATE) se automaticky aktualizuje usage tracking pro inline obrázky.

**Backend flow:**
```php
// CmsApiController::createPage() nebo ::updatePage()
$page = $this->pageService->updatePage($page, $data, $userId);

// Automatická aktualizace usage tracking
$this->pageService->updatePageFileUsage($page);
```

**PageService::updatePageFileUsage():**
1. Parse HTML content pomocí DOMDocument
2. Extrahuj `data-file-id` atributy z `<img>` tagů
3. Porovnej s existujícím usage v DB
4. Přidej nové usage: `$file->addUsage('pages', $pageId, 'content_images')`
5. Odstraň staré usage: `$file->removeUsage('pages', $pageId)`

**Usage Info Format:**
```json
{
    "usageInfo": {
        "pages_123": {
            "type": "pages",
            "id": 123,
            "data": {
                "field": "content_images"
            },
            "added_at": "2025-11-19T20:30:00+00:00"
        }
    }
}
```

**Benefits:**
- Automatické sledování použití obrázků
- Ochrana před smazáním používaných souborů
- Cleanup orphaned files (soubory bez usage)
- Administrace může vidět, kde je soubor použit

### File Upload API

Media picker používá standardní File Upload API s CMS-specifickými parametry.

**Endpoint:** `POST /api/portal/files/upload`

**CMS Parameters:**
```javascript
formData.append('path', 'cms/pages/123');
formData.append('is_public', 'true');
formData.append('entity_type', 'pages');
formData.append('entity_id', '123');
formData.append('field_name', 'content_images');
```

**Reference:** [Admin API - Media Library](admin-api.md#media-library-api)

## Související dokumentace
- [CMS Management Feature](../features/content-management.md)
- [Media Library Feature](../features/admin-media-library.md)
- [File Management](../features/file-management.md)
- [Overview](../overview.md)
