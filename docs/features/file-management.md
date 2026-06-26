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
**Lokace:** `FileController.php:27`
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
**Lokace:** `FileController.php:190`
Načte metadata souboru s usage informacemi.

### DELETE `/api/portal/files/{id}`
**Lokace:** `FileController.php:219`
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
**Lokace:** `FileController.php:482`
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
**Lokace:** `FileController.php:360`
Přidá usage tracking k souboru.

**Request Body:**
```json
{
    "file_id": 123,
    "entity_type": "report",
    "entity_id": 456,
    "field_name": "route_photos"
}
```

### DELETE `/api/portal/files/usage`
**Lokace:** `FileController.php:402`
Odstraní usage tracking ze souboru.

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

### Jednotná upload komponenta (nahrazuje SimpleFileUpload)

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
**Lokace:** `assets/js/components/UnifiedImageModal.jsx`

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
3. Existing file check - pokud existuje, vrať ho
4. Path validation a category detection (public/private)
5. Unique filename generation
6. Image processing (resize, thumbnails, EXIF rotation)
7. Database záznam (FileAttachment entity)
8. Security URL generation (s/bez tokenu)
```

### 2. **Usage Tracking - JSON sloupec**
```php
// 🔴 SKUTEČNÁ IMPLEMENTACE: Vše v JSON sloupci usageInfo
// Žádná tabulka file_usage neexistuje!

// Frontend posílá do FileController.php:67-88
$usageData = [
    'entity_type' => 'report',
    'entity_id' => 123,
    'field_name' => 'route_photos'
];

// Backend ukládá do usageInfo JSON sloupce
$fileAttachment->setUsageInfo($usageData);

// FileUploadService má metody:
$fileUploadService->addFileUsage($fileId, $entityType, $entityId, $fieldName);
$fileUploadService->removeFileUsage($fileId, $entityType, $entityId);

// Cleanup orphaned references
$cleanupResult = $fileUploadService->cleanupFileReferences($file);
```

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
```bash
# Test public file upload
curl -X POST "https://portalznackare.ddev.site/api/test/file-upload" \
  -F "files[]=@test.jpg" \
  -F "path=methodologies/test" \
  -F "is_public=true"

# Test private file upload
curl -X POST "https://portalznackare.ddev.site/api/test/file-upload" \
  -F "files[]=@report.pdf" \
  -F "path=reports/2025/test/1/123" \
  -F "is_public=false"

# Test file access
curl "https://portalznackare.ddev.site/uploads/methodologies/test/test.jpg"
curl "https://portalznackare.ddev.site/uploads/reports/2025/test/1/123/TOKEN/report.pdf"
```

### Usage tracking test
```php
// Přidej file usage
POST /api/portal/files/usage
{
    "file_id": 123,
    "type": "report", 
    "entity_id": 456,
    "data": {"section": "photos"}
}

// Odstraň usage
DELETE /api/portal/files/usage
{
    "file_id": 123,
    "type": "report",
    "entity_id": 456
}

// Získej usage info
GET /api/portal/files/usage/123
Response:
{
    "usages": [
        {
            "type": "report",
            "entity_id": 456,
            "data": {"section": "photos"},
            "created_at": "2025-08-07T10:00:00Z"
        }
    ],
    "total_count": 1
}
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
// Identické soubory se ukládají pouze jednou
$hash = sha1_file($file->getPathname());
$existingFile = $this->repository->findByHash($hash);

if ($existingFile) {
    // Vrať existující soubor, neukládej duplicitní data
    return $existingFile;
}
```

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

## 🔄 Migrace z SimpleFileUpload na AdvancedFileUpload

### Důvod migrace
Komponenta `SimpleFileUpload` byla nahrazena pokročilejší `AdvancedFileUpload`, která poskytuje:
- Server-side upload s deduplikací
- Usage tracking pro sledování použití souborů
- Camera support pro mobilní zařízení  
- Progress indicators během uploadu
- Toast notifications pro lepší UX
- Jednotné API napříč celou aplikací

### Migrace kódu
```jsx
// Před (SimpleFileUpload) - DEPRECATED
<SimpleFileUpload
    files={files}
    onFilesChange={setFiles}
/>

// Po (AdvancedFileUpload)
<AdvancedFileUpload
    id="unique-id"
    files={files}
    onFilesChange={setFiles}
    storagePath={storagePath}
    usageType="report"
    entityId={reportId}
/>
```

### Usage tracking v hlášení příkazů
```jsx
// Import v hlášení příkazů
import { AdvancedFileUpload } from './components/AdvancedFileUpload';
import { generateUsageType, generateEntityId } from '../utils/fileUsageUtils';

// Použití ve StepContent.jsx
<AdvancedFileUpload
    id="hlaseni-route-attachments"
    files={getAttachmentsAsArray(formData.Prilohy_Usek || {})}
    onFilesChange={(files) => setFormData(prev => ({
        ...prev,
        Prilohy_Usek: setAttachmentsFromArray(files)
    }))}
    maxFiles={20}
    accept="image/jpeg,image/png,image/heic,application/pdf"
    disabled={disabled}
    storagePath={storagePath}
    // File usage tracking
    usageType={generateUsageType('route', prikazId)}
    entityId={generateEntityId(prikazId)}
    usageData={{
        section: 'route_report',
        reportId: prikazId
    }}
/>
```

---

## ✅ Aktuální Stav Systému (2025-09-14)

**FUNKČNOST POTVRZENA:**
- ✅ Všechny API endpointy existují a fungují
- ✅ Upload souborů s deduplikací `FileController.php:27`
- ✅ Editace obrázků `FileController.php:482` s ImageProcessingService
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
**API Reference:** [../api/portal-api.md](../api/portal-api.md)
**Frontend:** [../architecture.md](../architecture.md)
**Configuration:** [../configuration.md](../configuration.md)
**Aktualizováno:** 2025-09-14 - Audit dokončen, dokumentace odpovídá skutečné implementaci