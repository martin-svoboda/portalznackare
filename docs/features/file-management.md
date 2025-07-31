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
Upload jednoho nebo více souborů s automatickou deduplikací.

**Form parametry:**
- `files` - Soubor(y) k uploadu
- `path` - Storage path (např. `reports/2025/praha/1/123`)
- `is_public` - Boolean pro public/private (default: false)

**Response:**
```json
{
    "success": true,
    "files": [{
        "id": 123,
        "fileName": "hlaseni.pdf",
        "url": "/uploads/path/to/file.pdf",
        "fileSize": 1048576,
        "isPublic": false
    }]
}
```

### GET `/api/portal/files/{id}`
Načte metadata souboru.

### DELETE `/api/portal/files/{id}`
Smaže soubor (soft delete s 30denní expirací).

### GET `/api/portal/files/{id}/download`
Stažení souboru s kontrolou oprávnění.

### GET `/api/portal/files/usage/{id}`
Zjistí, kde všude je soubor použitý.

## 🛠️ Backend Services

### FileUploadService
Hlavní služba pro upload souborů s hash-based deduplikací a automatickým generováním storage paths.

### FileAttachment Entity
Database model pro ukládání metadat souborů včetně usage tracking a soft delete funkcí.

### FileServeController
Controller pro serving souborů s podporou public/private přístupu a security tokenů.


## ⚛️ React Frontend - AdvancedFileUpload

### Pokročilá upload komponenta

```jsx
// assets/js/apps/hlaseni-prikazu/components/AdvancedFileUpload.jsx
export const AdvancedFileUpload = ({ 
    id, 
    files = [], 
    onFilesChange, 
    maxFiles = 5, 
    accept = "image/jpeg,image/png,image/heic,application/pdf",
    storagePath = null,
    isPublic = false     // Public vs private files
}) => {
    const [uploading, setUploading] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    
    /**
     * Handle file upload s deduplication
     */
    const handleFileSelect = async (newFiles) => {
        setUploading(true);
        
        const formData = new FormData();
        Array.from(newFiles).forEach(file => {
            formData.append('files[]', file);
        });
        
        // Upload parametry
        if (storagePath) formData.append('path', storagePath);
        formData.append('is_public', isPublic.toString());
        formData.append('options', JSON.stringify({
            create_thumbnail: true,
            optimize: true
        }));
        
        try {
            const response = await fetch('/api/portal/files/upload', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'  // Session auth
            });
            
            const result = await response.json();
            
            if (result.files && result.files.length > 0) {
                const processedFiles = result.files.map(file => ({
                    ...file,
                    rotation: 0,
                    uploadedAt: new Date(file.uploadedAt)
                }));
                
                onFilesChange([...files, ...processedFiles]);
            }
            
            // Zobraz chyby pokud nějaké jsou
            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(error => {
                    alert(`${error.file}: ${error.error}`);
                });
            }
        } catch (error) {
            alert('Chyba při nahrávání souborů');
        } finally {
            setUploading(false);
        }
    };
    
    /**
     * Remove file s API voláním
     */
    const removeFile = async (fileId) => {
        const fileToRemove = files.find(f => f.id === fileId);
        if (!fileToRemove) return;
        
        try {
            // Pokud má file numeric ID, je ze serveru - smaž ho
            if (typeof fileToRemove.id === 'number') {
                const response = await fetch(`/api/portal/files/${fileToRemove.id}`, {
                    method: 'DELETE',
                    credentials: 'same-origin'
                });
                
                if (!response.ok) {
                    throw new Error('Delete failed');
                }
            }
            
            const updatedFiles = files.filter(f => f.id !== fileId);
            onFilesChange(updatedFiles);
        } catch (error) {
            alert('Chyba při mazání souboru');
        }
    };
    
    /**
     * Camera funkcionalita pro mobilní zařízení
     */
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            setStream(stream);
            setCameraOpen(true);
        } catch (error) {
            alert('Nepodařilo se spustit kameru. Zkontrolujte oprávnění.');
        }
    };
    
    return (
        <div className="space-y-3">
            {/* Drag & Drop upload area */}
            <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
                    ${disabled ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 
                        isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 cursor-pointer'}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById(`file-input-${componentInstanceId}`).click()}
            >
                <IconUpload size={32} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                    Klikněte nebo přetáhněte soubory sem
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    Maximálně {maxFiles} souborů • {accept.replace(/[^a-zA-Z,]/g, '').toUpperCase()}
                </p>
                
                <input
                    id={`file-input-${componentInstanceId}`}
                    type="file"
                    multiple
                    accept={accept}
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                />
            </div>
            
            {/* Camera button pro mobilní */}
            <div className="flex gap-2 justify-center">
                <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <IconCamera size={16} />
                    Fotoaparát
                </button>
            </div>
            
            {/* Upload progress */}
            {uploading && (
                <div className="bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                         style={{ width: `${uploadProgress}%` }}></div>
                </div>
            )}
            
            {/* Seznam nahraných souborů */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((file) => (
                        <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            {/* File icon */}
                            <div className="flex-shrink-0">
                                {file.fileType.startsWith('image/') ? (
                                    <IconPhoto size={20} className="text-blue-500" />
                                ) : (
                                    <IconFile size={20} className="text-gray-500" />
                                )}
                            </div>
                            
                            {/* File info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {file.fileName}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {formatFileSize(file.fileSize)}
                                    {file.uploadedAt && (
                                        <span className="ml-2">
                                            • {new Date(file.uploadedAt).toLocaleDateString('cs-CZ')}
                                        </span>
                                    )}
                                </p>
                            </div>
                            
                            {/* Image preview */}
                            {file.fileType.startsWith('image/') && file.url && (
                                <img 
                                    src={file.url} 
                                    alt={file.fileName}
                                    className="w-12 h-12 object-cover rounded"
                                    style={{
                                        transform: `rotate(${file.rotation || 0}deg)`,
                                        transition: 'transform 0.3s ease'
                                    }}
                                />
                            )}
                            
                            {/* Action buttons */}
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setPreviewFile(file)}
                                    className="p-1 text-blue-500 hover:text-blue-700"
                                    title="Náhled"
                                >
                                    <IconEye size={16} />
                                </button>
                                
                                {/* Rotation pro obrázky */}
                                {file.fileType.startsWith('image/') && (
                                    <>
                                        <button
                                            onClick={() => rotateImage(file.id, -90)}
                                            className="p-1 text-green-500 hover:text-green-700"
                                            title="Otočit vlevo"
                                        >
                                            <IconRotate2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => rotateImage(file.id, 90)}
                                            className="p-1 text-green-500 hover:text-green-700"
                                            title="Otočit vpravo"
                                        >
                                            <IconRotateClockwise size={16} />
                                        </button>
                                    </>
                                )}
                                
                                <button
                                    onClick={() => removeFile(file.id)}
                                    className="p-1 text-red-500 hover:text-red-700"
                                    title="Odstranit"
                                >
                                    <IconTrash size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Camera modal - implementace... */}
            {/* Preview modal - implementace... */}
        </div>
    );
};
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

### 2. **Usage Tracking**
```php
// Přidání usage tracking
$file->addUsage('report', $reportId, ['section' => 'photos']);

// File se stane permanent (není temporary)
$file->setIsTemporary(false);

// Usage removal - když se report smaže
$file->removeUsage('report', $reportId);

// Pokud žádné usage, file se stane temporary
if ($file->getUsageCount() === 0) {
    $file->setIsTemporary(true);
    $file->setExpiresAt(new DateTimeImmutable('+24 hours'));
}
```

### 3. **Soft Delete s Grace Period**
```php
// Soft delete při prvním smazání
$file->softDelete();  // Nastaví deletedAt timestamp

// Grace period check (24h default)
if ($file->shouldBePhysicallyDeleted(24)) {
    // Physical delete - smaž soubor z disku i databáze
    $this->fileUploadService->deleteFile($file, true);
}

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
    "id": 456,
    "data": {"section": "photos"}
}

// Odstraň usage
DELETE /api/portal/files/usage
{
    "file_id": 123,
    "type": "report",
    "id": 456
}
```

### React component test
```jsx
// Test AdvancedFileUpload komponenty
<AdvancedFileUpload
    id="test-upload"
    files={files}
    onFilesChange={setFiles}
    maxFiles={10}
    accept="image/jpeg,image/png,application/pdf"
    storagePath="reports/2025/test/1/123"  // Private path
    isPublic={false}
/>

// Pro public files
<AdvancedFileUpload
    storagePath="methodologies/test"
    isPublic={true}  // Explicit public
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

**Related Documentation:**  
**API Reference:** [../api/portal-api.md](../api/portal-api.md)  
**Frontend:** [../architecture.md](../architecture.md)  
**Configuration:** [../configuration.md](../configuration.md)  
**Aktualizováno:** 2025-07-22