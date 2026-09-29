# File Management - Správa souborů a příloh

> **Funkcionální oblast** - Kompletní systém pro upload, ukládání, zabezpečení a správu souborů

## 📁 Přehled file management systému

### Architektura file managementu
```
Upload → FileUploadService → Deduplication → Storage → FileAttachment Entity
        ↓                   ↓             ↓         ↓
   React Component     Hash Check      Disk Save   Database Record
   
Protection Flow:
Public Files   → /uploads/path/filename.jpg
Private Files  → /uploads/path/token/filename.jpg (s hash tokenem)
```

**Klíčové principy:**
- **Hash-based deduplication:** Identické soubory se ukládají pouze jednou
- **Public/Private routing:** Automatické rozpoznání podle storage path
- **Security tokens:** Chráněné soubory s hash tokenem v URL
- **Thumbnail generation:** Automatické náhledy pro obrázky
- **Usage tracking:** Sledování využití souborů v různých kontextech

## 📋 API Endpointy

### POST `/api/portal/files/upload`
**Lokace:** `FileController::upload`
Upload jednoho nebo více souborů s automatickou deduplikací.

**Form parametry:**
- `files[]` - Soubor(y) k uploadu
- `path` - Storage path (např. `reports/2025/praha/1/123`)
- `is_public` - Boolean pro public/private (default: false)
- `options` - JSON s dodatečnými možnostmi (usage tracking)

**Response:**
```json
{
    "success": true,
    "files": [{
        "id": 123,
        "fileName": "hlaseni.pdf",
        "url": "/uploads/path/to/file.pdf",
        "fileSize": 1048576,
        "isPublic": false,
        "fileType": "application/pdf"
    }]
}
```

### GET `/api/portal/files/{id}`
**Lokace:** `FileController::getFile`
Načte metadata souboru včetně `url` (u chráněných souborů s tokenem).
**Přístup:** veřejný soubor – kdokoli přihlášený; chráněný – jen ten, kdo ho nahrál (`uploaded_by`), nebo `ROLE_ADMIN`.
Ostatním `404` (ID jsou postupná, nesmí jít projít všechny účtenky a fotky). Testy: `tests/Controller/Api/FileControllerGetFileTest.php`

### DELETE `/api/portal/files/{id}`
**Lokace:** `FileController::deleteFile`
Smaže soubor s inteligentní soft/hard delete logikou.

**Request Body:**
```json
{
    "context": {
        "draft": true  // Pro draft hlášení - vždy hard delete
    },
    "force": false  // true pro admin force delete
}
```

### PUT `/api/portal/files/{id}/edit`
**Lokace:** `FileController::edit`
**FUNKČNÍ** - Editace obrázků s podporou rotace a crop operací.

**Request Body:**
```json
{
    "operations": [
        {"type": "rotate", "angle": 90},
        {"type": "crop", "x": 100, "y": 50, "width": 800, "height": 600}
    ],
    "mode": "overwrite"  // nebo "copy"
}
```

### POST `/api/portal/files/usage`
Přidá usage tracking k souboru (`FileUploadService::addFileUsage()`).

**Request Body:**
```json
{
    "fileId": 123,
    "type": "reports",
    "id": 456,
    "field_name": "Prilohy_NP",
    "data": null
}
```
`fileId`, `type`, `id` jsou povinné (jinak `400`), `field_name` a `data` volitelné.
**Response:** `{"success": true, "file": {"id": 123, "usageCount": 1, "isTemporary": false}}`, `404` pokud soubor neexistuje.

### DELETE `/api/portal/files/usage`
Odstraní usage tracking ze souboru – stejné tělo (`fileId`, `type`, `id`, volitelně `field_name`) a odpověď jako POST.

### GET `/api/portal/files/orphaned-references`
**Oprávnění:** `ROLE_ADMIN` (jinak `403`)
Seznam smazaných souborů (`deleted_at` nebo `physically_deleted`), které mají stále záznam v `usage_info`.

**Response:**
```json
{
    "success": true,
    "orphanedReferences": [
        {"fileId": 12, "fileName": "foto.jpg", "deletedAt": "2025-09-14 10:00:00", "physicallyDeleted": true, "usages": {}}
    ],
    "count": 1
}
```

### GET `/api/portal/files/folders`, `/api/portal/files/library`
Admin media library (`ROLE_ADMIN`) – viz [admin-media-library.md](admin-media-library.md).

## 🛠️ Backend Services

### FileUploadService
Hlavní služba pro upload souborů s hash-based deduplikací a automatickým generováním storage paths.

### FileAttachment Entity
Database model s tabulkou `file_attachments` (ne "attachments").

**Klíčové vlastnosti:**
- `usageInfo` - JSON sloupec pro tracking použití
- Hash-based deduplication
- Soft delete s `physically_deleted` flag

### FileServeController
Controller pro serving souborů s podporou public/private přístupu a security tokenů.

### Absolutní URL příloh (INSYZ XML / worker)
[`AttachmentLookupService`](../../src/Service/AttachmentLookupService.php) staví URL z DB sloupce `public_url` (obsahuje bezpečnostní token pro neveřejné soubory) — **ne** z `path` (ten token nemá). Základ URL je host z HTTP requestu, a v CLI/worker kontextu (odeslání hlášení do INSYZ, kde request neexistuje) veřejná doména dle prostředí (`resolveBaseUrl()`):
- `dev` → `https://dev.portalznackare.cz`
- `prod` → `https://portalznackare.cz`

Bez toho by odkazy v INSYZ XML spadly na `http://localhost` (zvenku nedostupné) a bez tokenu by se neveřejné přílohy stejně nevydaly.


## ⚛️ React Frontend - AdvancedFileUpload

### Refaktorovaná upload komponenta (2025-09-14)
**Opravy provedené:**
- Sloučení `previewFile` a `fileToEdit` do `selectedFile`
- Jeden `UnifiedImageModal` místo dvou modálů
- Přidán null check proti `Cannot read properties of null` chybě
- Čistší kód bez duplicitních stavů

### Jednotná upload komponenta

```jsx
<AdvancedFileUpload
id="test-upload"
files={files}
onFilesChange={setFiles}
maxFiles={10}
accept="image/jpeg,image/png,application/pdf"
storagePath="reports/2025/test/1/123"  // Private path
isPublic={false}
// Usage tracking
usageType="report"
entityId={123}
usageData={{ section: 'route_photos' }}
/>
```

### UnifiedImageModal Komponenta
**Lokace:** `assets/js/components/shared/UnifiedImageModal.jsx`

**Vlastnosti:**
- Sloučený preview a edit modal
- Podpora rotace a crop operací
- Možnosti: 'preview' | 'edit' | null
- ImageProcessingService integrace
- Null check ochrana proti chybám

```jsx
<UnifiedImageModal
    file={selectedFile}          // FileAttachment objekt
    isOpen={modalMode !== null}
    mode={modalMode}             // 'preview' nebo 'edit'
    onClose={() => setModalMode(null)}
    onSave={(editedFile) => {
        if (editedFile?.id) {    // Null check!
            handleEditorSave(editedFile);
        }
    }}
    onRotate={(fileId, angle) => rotateImage(fileId, angle)}
/>
```

## 🔒 Security Features

### 1. **Dual Routing System**

```php
// Storage path určuje public/private status
$publicPaths = [
    'methodologies/',  // Veřejné metodiky
    'downloads/',      // Ke stažení
    'gallery/',        // Galerie
    'documentation/'   // Dokumentace
];

// Všechny ostatní jsou chráněné (reports/, users/, temp/)
if (str_starts_with($storagePath, $publicPath)) {
    $isPublic = true;
}
```

### 2. **Security Token Generation**

```php
// Pro chráněné soubory
$securityToken = substr(sha1($fileHash . $storagePath), 0, 16);

// URL struktura:
// Public:  /uploads/methodologies/znaceni/manual.pdf
// Private: /uploads/reports/2025/praha/1/123/a1b2c3d4e5f6g7h8/photo.jpg
//                                        ↑ 16-char hash token
```

### 3. **File Access Validation**

```php
// FileServeController - token ověření
$file = $this->repository->findOneBy(['path' => $relativePath]);
$expectedToken = substr(sha1($file->getHash() . $storagePath), 0, 16);

if ($providedToken !== $expectedToken) {
    throw new NotFoundHttpException('Neplatný token');
}
```

### ⚠️ Známé omezení: soubory leží v `public/uploads`
Webserver (nginx `try_files $uri`) vydá fyzicky existující soubor **přímo**, bez Symfony. Token tedy chrání
jen URL s tokenem (ta na disku neexistuje, jde přes `FileServeController`); na cestu bez tokenu
`/uploads/<path>/<stored_name>` a na náhledy `thumb_*` se kontrola neuplatní. Ochranu dnes dává jen
neuhodnutelný název (`slug-<8 hex z hashe obsahu>`). Plné řešení: přesunout chráněné soubory mimo `public/`
(např. `var/uploads`), nebo v nginx směrovat `/uploads/reports/` vždy na `index.php`.

### 4. **X-Robots Headers**

```php
// Chráněné soubory - zakázané indexování
$response->headers->set('X-Robots-Tag', 'noindex, nofollow, noarchive');

// Veřejné soubory - povolené indexování (výchozí)
$response->setPublic();
```

## 📂 Storage Structure

### Directory Layout
```
public/uploads/
├── temp/                           # Dočasné soubory (expirují za 24h)
│   └── 2025/01/abc123/
├── reports/                        # CHRÁNĚNÉ - hlášení příkazů
│   └── 2025/praha/1/123/
├── users/                          # CHRÁNĚNÉ - uživatelské soubory
│   └── 1234/
├── methodologies/                  # VEŘEJNÉ - metodiky
│   ├── znaceni/
│   └── general/
├── downloads/                      # VEŘEJNÉ - ke stažení
│   ├── forms/
│   └── manuals/
├── gallery/                        # VEŘEJNÉ - galerie
│   └── akce-2025/
└── documentation/                  # VEŘEJNÉ - dokumentace
    └── help/
```

### URL Patterns
```bash
# Veřejné soubory (bez tokenu)
/uploads/methodologies/znaceni/manual.pdf
/uploads/downloads/forms/hlaseni.pdf
/uploads/gallery/akce-2025/photo.jpg

# Chráněné soubory (s tokenem)
/uploads/reports/2025/praha/1/123/a1b2c3d4e5f6g7h8/report.jpg
/uploads/users/1234/f8e7d6c5b4a3b2c1/personal.pdf
/uploads/temp/2025/01/xyz789/c9d8e7f6g5h4i3j2/upload.jpg

# Thumbnails (vždy chráněné)
/uploads/reports/2025/praha/1/123/thumb_a1b2c3d4e5f6g7h8/report.jpg
```

## 🔄 File Lifecycle

### 1. **Upload Process**
```php
1. File přijat přes API (/api/portal/files/upload)
2. SHA1 hash calculation pro deduplikaci
3. Existing file check (hash + original_name) - pokud existuje, vrať ho
4. Path validation a category detection (public/private)
5. Unique filename generation
6. Image processing (resize, thumbnails, EXIF rotation)
7. Database záznam (FileAttachment entity)
8. Security URL generation (s/bez tokenu)
```

### 2. **Usage Tracking - JSON sloupec**
Použití souboru se ukládá jen do JSON sloupce `usage_info` entity `FileAttachment` (tabulka `file_usage`
neexistuje). Formát při sledování konkrétního pole: `{"reports": {"123": ["Prilohy_NP", "Prilohy_TIM"]}}`.

- `FileUploadService::addFileUsage(int $fileId, string $type, int $id, ?array $additionalData, ?string $fieldName)`
- `FileUploadService::removeFileUsage(int $fileId, string $entityType, int $entityId, ?string $fieldName)`
- `FileUploadService::cleanupOrphanedReference()` / `cleanupAllEntityReferences()` – úklid odkazů
- `FileUploadService::findPotentialOrphanedReferences()` – smazané soubory, které mají stále `usage_info`
  (endpoint `GET /api/portal/files/orphaned-references`)

### 3. **Physically Deleted Flag - Ochrana používaných souborů**
```php
// Speciální situace: Soubor se používá, ale někdo ho chce smazat
if (!$attachment->isTemporary() && $attachment->getUsageCount() > 0) {
    // Soubor se smaže z disku, ale záznam v DB zůstává
    $attachment->setPhysicallyDeleted(true);
    $this->repository->save($attachment, true);
} else {
    // Běžné mazání - úplné odstranění z DB
    $this->repository->remove($attachment, true);
}

// Cleanup job kontroluje physically_deleted flag
foreach ($softDeletedFiles as $file) {
    if (!$file->isPhysicallyDeleted()) {
        $this->deleteFile($file, true); // Smaž jen pokud ještě není physically deleted
    }
}

// Tři stavy souboru:
// 1. deletedAt = null → aktivní soubor
// 2. deletedAt != null + physically_deleted = false → soft delete (soubor na disku existuje)
// 3. deletedAt != null + physically_deleted = true → hard delete (soubor smazán, záznam pro usage tracking)
```

**Proč physically_deleted existuje:**
- **Ochrana integrity** - i smazané soubory můžeme trackovat kde byly použité
- **Orphaned reference cleanup** - můžeme najít a vyčistit odkazy na smazané soubory
- **Prevence duplicate deletion** - cleanup job nesmaže už smazané soubory
- **Audit trail** - historie co se s databázovými záznamy dělo

### 4. **Inteligentní Soft/Hard Delete Logic**
```php
// Kontextové mazání s potvrzením
$context = ['draft' => true]; // Kontext draftu vždy hard delete

// Aktuální logika mazání:
// - Nové soubory (<5min) = hard delete (ihned pryč z disku)
// - Staré soubory (>5min) = soft delete (pouze označí jako smazané)
// - Draft kontext = vždy hard delete (bez ohledu na věk)
// - Force delete = vždy hard delete (admin akce)
$this->fileUploadService->deleteFile($file, false, $context);

// Force delete pro admin akce
$this->fileUploadService->deleteFile($file, true); // Vždy hard delete

// Cleanup job spouštěný cronem
$deletedCount = $this->fileUploadService->cleanupFiles();
```

### 4. **Image Processing**
```php
// Automatické zpracování při uploadu
$metadata = [
    'width' => 1920,
    'height' => 1080,
    'thumbnail' => 'thumb_filename.jpg',  // 300x300px
    'optimized' => true,                  // Resize na 1920px
    'original_orientation' => 6           // EXIF data
];

// Auto-rotation podle EXIF
switch ($orientation) {
    case 3: return $image->rotate(180);   // 180°
    case 6: return $image->rotate(-90);   // 90° CW
    case 8: return $image->rotate(90);    // 90° CCW
}
```

## 🧪 Testing File Management

### Test upload scenarios
Samostatný testovací upload endpoint neexistuje – testuje se přes `POST /api/portal/files/upload`
z přihlášené session (interní API vyžaduje i hlavičku `X-CSRF-Token`, viz
[configuration.md](../configuration.md)). Nejsnáze přímo z formuláře hlášení v prohlížeči.

```bash
# Test file access
curl "https://portalznackare.ddev.site/uploads/methodologies/test/test.jpg"
curl "https://portalznackare.ddev.site/uploads/reports/2025/test/1/123/TOKEN/report.pdf"
```

### React component test
```jsx
// Test AdvancedFileUpload komponenty s usage tracking
<AdvancedFileUpload
    id="test-upload"
    files={files}
    onFilesChange={setFiles}
    maxFiles={10}
    accept="image/jpeg,image/png,application/pdf"
    storagePath="reports/2025/test/1/123"  // Private path
    isPublic={false}
    // Usage tracking
    usageType="report"
    entityId={123}
    usageData={{ section: 'route_photos' }}
/>

// Pro public files
<AdvancedFileUpload
    storagePath="methodologies/test"
    isPublic={true}  // Explicit public
    usageType="methodology"
    entityId={"methodology-123"}
/>

// Disabled stav (readonly formulář)
<AdvancedFileUpload
    files={files}
    onFilesChange={setFiles}
    disabled={isReadonly}  // Skryje upload, camera, delete, rotation tlačítka
/>
```

## 📈 Performance a Optimization

### 1. **Image Processing**
```php
// Automatic resize velkých obrázků
if ($size->getWidth() > 1920 || $size->getHeight() > 1920) {
    $image->thumbnail(new Box(1920, 1920), ImageInterface::THUMBNAIL_INSET)
        ->save($filePath, ['quality' => 85]);  // 85% JPEG kvalita
}

// Thumbnail generation (300x300px)
$image->thumbnail(new Box(300, 300), ImageInterface::THUMBNAIL_OUTBOUND)
    ->save($thumbnailPath, ['quality' => 80]);
```

### 2. **Hash-based Deduplication**
```php
// Deduplikace podle dvojice hash + original_name
$hash = sha1_file($file->getPathname());
$existingFile = $this->repository->findByHashAndOriginalName($hash, $originalName);

if ($existingFile) {
    // Vrať existující soubor, neukládej duplicitní data
    return $existingFile;
}
```

**Sloupec `hash` NENÍ unikátní.** Identický obsah nahraný pod jiným názvem souboru je
samostatný záznam - uživatel vidí název, pod kterým soubor nahrál. UNIQUE constraint
`file_attachments_hash_key` byl z tohoto důvodu odstraněn migrací
`Version20260826094500` (do té doby druhé nahrání téhož obsahu pod jiným názvem
skončilo chybou `SQLSTATE[23505]`).

### 3. **Cache Headers**
```php
// Long-term cache (1 rok)
$response->setMaxAge(31536000);
$response->setPublic();  // Pro public files

// ETags a Last-Modified (TODO)
$response->setETag(md5($file->getUpdatedAt()->format('c')));
```

### 4. **Database Indexy**
```sql
-- FileAttachment optimalizace
CREATE INDEX idx_file_hash ON file_attachments(hash);
CREATE INDEX idx_file_storage_path ON file_attachments(storage_path);
CREATE INDEX idx_file_created ON file_attachments(created_at);
```


---

## ✅ Aktuální Stav Systému (2025-09-14)

**FUNKČNOST POTVRZENA:**
- ✅ Všechny API endpointy existují a fungují
- ✅ Upload souborů s deduplikací `FileController::upload`
- ✅ Editace obrázků `FileController::edit` s ImageProcessingService
- ✅ Usage tracking v JSON sloupci `usageInfo`
- ✅ Databáze: `file_attachments` (ne "attachments")
- ✅ Soft/hard delete logika
- ✅ UnifiedImageModal refaktorizace dokončena

**OPRAVENÉ CHYBY:**
- 🔧 `null.id` chyba při editaci - přidán null check
- 🔧 Sloučení dvou modálů do jednoho UnifiedImageModal
- 🔧 Zjednodušení stavů v AdvancedFileUpload

**DOKUMENTACE AKTUALIZOVÁNA:**
- Správné názvy API endpointů s lokacemi
- Popis UnifiedImageModal komponenty
- Upřesnění databázové struktury (file_attachments)
- Usage tracking implementace (JSON sloupec, ne tabulka)

---

**Related Documentation:**
**API Reference:** [../api.md](../api.md#soubory)
**Frontend:** [../architecture.md](../architecture.md)
**Configuration:** [../configuration.md](../configuration.md)
**Aktualizováno:** 2025-09-14 - Audit dokončen, dokumentace odpovídá skutečné implementaci