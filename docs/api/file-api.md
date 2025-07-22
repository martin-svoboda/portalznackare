# File Management API Reference

> **API dokumentace** - Upload, správa a serving souborů s hash deduplikací a security tokeny

## 📁 Přehled File Management API

**Base URL:** `/api/portal/files/`  
**Účel:** Kompletní file management s automatickou deduplikací, usage tracking a security tokeny  
**Autentifikace:** Session-based (všechny endpointy vyžadují přihlášení)  
**Storage:** Hash-based deduplikace s public/private rozdělením

### Klíčové funkce
- **Hash deduplikace:** SHA-256 pro automatické odstraňování duplicit
- **Public/Private soubory:** Rozdělení podle `is_public` parametru
- **Usage tracking:** Sledování použití souborů v aplikaci
- **Soft delete:** Graceful mazání s expirací
- **Security tokens:** Hash-based tokeny pro chráněné soubory
- **File validation:** MIME type a size validace

## 📋 Endpointy

### 📤 POST `/api/portal/files/upload`

Upload jednoho nebo více souborů s metadata a automatic deduplication.

**Autentifikace:** Vyžadováno  
**Content-Type:** `multipart/form-data`

**Form parametry:**
- `files` - File(s) k uploadu (single file nebo array)
- `path` - Storage path pro organizaci (např. `reports/2025/praha/1/123`)
- `options` - JSON string s dodatečnými parametry (optional)
- `is_public` - Boolean flag pro public/private (optional, default: false)

**Request:**
```javascript
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2); // Multiple files
formData.append('path', 'reports/2025/praha/1/123');
formData.append('is_public', 'false');
formData.append('options', JSON.stringify({
    description: 'Přílohy k hlášení',
    category: 'report_attachments'
}));

const response = await fetch('/api/portal/files/upload', {
    method: 'POST',
    body: formData,
    credentials: 'same-origin'
});
```

**Response:**
```json
{
    "success": true,
    "files": [
        {
            "id": 123,
            "fileName": "hlaseni.pdf",
            "fileSize": 1048576,
            "fileType": "application/pdf",
            "url": "/uploads/reports/2025/praha/1/123/a1b2c3d4.../hlaseni.pdf",
            "uploadedAt": "2025-01-21T10:30:00+01:00",
            "uploadedBy": "Jan Novák",
            "metadata": {
                "description": "Přílohy k hlášení",
                "category": "report_attachments"
            },
            "isPublic": false
        }
    ],
    "errors": []
}
```

**Supported file types:**
- **Images:** `image/jpeg`, `image/png`, `image/heic`, `image/heif`
- **Documents:** `application/pdf`
- **Max size:** 15MB per file

**Backend processing:**
```php
// src/Controller/Api/FileController.php
public function upload(Request $request): JsonResponse {
    $user = $this->getUser();
    $files = $request->files->get('files');
    $storagePath = $request->request->get('path');
    
    // Convert single file to array
    if (!is_array($files)) {
        $files = [$files];
    }
    
    foreach ($files as $file) {
        // File validation
        $violations = $this->validator->validate($file, $constraints);
        
        // Upload with deduplication
        $attachment = $this->fileUploadService->uploadFile(
            $file, $user, $storagePath, $options
        );
    }
}
```

**Chyby:**
- `400` - Žádné soubory nebo neplatné parametry
- `401` - Nepřihlášený uživatel
- `422` - File validation failed (size, type, etc.)

---

### 📖 GET `/api/portal/files/{id}`

Načte metadata konkrétního souboru.

**Autentifikace:** Vyžadováno  
**Path parametry:**
- `id` - ID souboru

**Request:**
```bash
GET /api/portal/files/123
```

**Response:**
```json
{
    "id": 123,
    "fileName": "hlaseni.pdf",
    "fileSize": 1048576,
    "fileType": "application/pdf",
    "url": "/uploads/reports/2025/praha/1/123/a1b2c3d4.../hlaseni.pdf",
    "uploadedAt": "2025-01-21T10:30:00+01:00",
    "metadata": {
        "description": "Přílohy k hlášení",
        "width": null,
        "height": null
    }
}
```

**Backend:**
```php
public function getFile(int $id): JsonResponse {
    $user = $this->getUser();
    $file = $this->fileUploadService->getFile($id, $user);
    
    if (!$file) {
        return new JsonResponse(['error' => 'Soubor nenalezen'], 404);
    }
    
    return new JsonResponse([
        'id' => $file->getId(),
        'fileName' => $file->getOriginalName(),
        'url' => $file->getPublicUrl(),
        // ... další metadata
    ]);
}
```

**Chyby:**
- `401` - Nepřihlášený uživatel
- `404` - Soubor nenalezen nebo bez oprávnění

---

### 🗑️ DELETE `/api/portal/files/{id}`

Smaže soubor (soft delete nebo hard delete podle oprávnění).

**Autentifikace:** Vyžadováno  
**Path parametry:**
- `id` - ID souboru
**Query parametry:**
- `force` - Boolean pro hard delete (pouze admin, default: false)

**Request:**
```bash
DELETE /api/portal/files/123?force=false
```

**Response:**
```json
{
    "success": true,
    "deleted": "soft"
}
```

**Authorization logic:**
```php
public function deleteFile(int $id, Request $request): JsonResponse {
    $file = $this->fileUploadService->getFile($id, $user);
    
    // Check ownership nebo admin role
    if ($file->getUploadedBy() !== $user->getIntAdr() && !$this->isGranted('ROLE_ADMIN')) {
        return new JsonResponse(['error' => 'Nemáte oprávnění'], 403);
    }
    
    $forceDelete = $request->query->getBoolean('force', false);
    $this->fileUploadService->deleteFile($file, $forceDelete);
}
```

**Chyby:**
- `401` - Nepřihlášený uživatel
- `403` - Nemá oprávnění smazat soubor
- `404` - Soubor nenalezen

---

### 🔗 POST `/api/portal/files/usage`

Přidá usage tracking pro soubor (zvýší reference count).

**Autentifikace:** Vyžadováno  
**Content-Type:** `application/json`

**Request:**
```json
{
    "fileId": 123,
    "type": "report_attachment",
    "id": 456,
    "data": {
        "reportId": 456,
        "section": "photos"
    }
}
```

**Response:**
```json
{
    "success": true,
    "file": {
        "id": 123,
        "usageCount": 2,
        "isTemporary": false
    }
}
```

**Backend:**
```php
public function addUsage(Request $request): JsonResponse {
    $data = json_decode($request->getContent(), true);
    
    $file = $this->fileUploadService->addFileUsage(
        $data['fileId'],
        $data['type'], 
        $data['id'],
        $data['data'] ?? null
    );
    
    return new JsonResponse([
        'success' => true,
        'file' => [
            'usageCount' => $file->getUsageCount(),
            'isTemporary' => $file->isTemporary()
        ]
    ]);
}
```

**Chyby:**
- `400` - Chybí povinné parametry
- `401` - Nepřihlášený uživatel
- `404` - Soubor nenalezen

---

### 🔗 DELETE `/api/portal/files/usage`

Odebere usage tracking (sníží reference count).

**Autentifikace:** Vyžadováno  
**Content-Type:** `application/json`

**Request:**
```json
{
    "fileId": 123,
    "type": "report_attachment", 
    "id": 456
}
```

**Response:**
```json
{
    "success": true,
    "file": {
        "id": 123,
        "usageCount": 1,
        "isTemporary": false
    }
}
```

**Cleanup logic:**
- Pokud `usageCount` klesne na 0, soubor se označí jako `temporary`
- Temporary soubory se automaticky mažou po expiraci (např. 7 dní)

**Chyby:**
- `400` - Chybí povinné parametry
- `401` - Nepřihlášený uživatel
- `404` - Soubor nenalezen

## 🔧 File Serving (mimo API)

### **Public files** - bez autentifikace
```
GET /uploads/methodologies/znaceni/navod.pdf
GET /uploads/gallery/2025/akce1/foto.jpg
```

### **Private files** - s hash tokenem
```
GET /uploads/reports/2025/praha/1/123/a1b2c3d4e5f6.../hlaseni.pdf
```

**Security:**
- Hash token obsahuje SHA-256 hash souboru
- Impossible to guess bez znalosti file contents
- Token se mění při změně souboru

## 🏗️ Backend implementace

### **FileUploadService** - Core file management
```php
// src/Service/FileUploadService.php
class FileUploadService {
    public function uploadFile(
        UploadedFile $file, 
        User $user, 
        ?string $storagePath = null,
        array $options = []
    ): FileAttachment {
        
        // 1. Generate hash for deduplication
        $hash = hash_file('sha256', $file->getPathname());
        
        // 2. Check if file already exists
        $existing = $this->repository->findByHash($hash);
        if ($existing) {
            return $this->createAlias($existing, $storagePath, $options);
        }
        
        // 3. Determine public/private
        $isPublic = $this->determinePublicFlag($storagePath, $options);
        
        // 4. Generate storage path with hash token
        $finalPath = $this->generateStoragePath($storagePath, $hash, $isPublic);
        
        // 5. Move file and create database record
        $file->move($this->uploadsDirectory . '/' . dirname($finalPath), basename($finalPath));
        
        return $this->createFileAttachment($file, $hash, $finalPath, $user, $options);
    }
}
```

### **FileAttachment Entity** - Database model
```php
// src/Entity/FileAttachment.php
class FileAttachment {
    private int $id;
    private string $originalName;
    private string $storagePath;      // reports/2025/praha/1/123/abc123.../file.pdf
    private string $hash;             // SHA-256 hash
    private int $size;
    private string $mimeType;
    private bool $isPublic;
    private bool $isDeleted = false;
    private array $usageTracking = []; // JSON array
    private array $metadata = [];      // JSON array
    private \DateTimeInterface $createdAt;
    private int $uploadedBy;           // INT_ADR
    
    public function getUsageCount(): int {
        return count($this->usageTracking);
    }
    
    public function isTemporary(): bool {
        return $this->getUsageCount() === 0 && !$this->isDeleted;
    }
    
    public function getPublicUrl(): string {
        if ($this->isPublic) {
            return '/uploads/' . $this->storagePath;
        }
        return '/uploads/' . $this->storagePath; // Contains hash token
    }
}
```

### **Storage structure**
```
uploads/
├── methodologies/              # Public files
├── reports/                   # Private files  
│   └── 2025/S/BN/12345/
│       └── a1b2c3d4e5f6.../   # Hash token directory
│           ├── hlaseni.pdf
│           └── foto.jpg
├── gallery/                   # Public files
│   └── 2025/akce1/
└── downloads/                 # Public files
    └── forms/
```

## 💻 Frontend integrace

### **React File Upload komponenta**
```jsx
// Basic usage
<AdvancedFileUpload
    storagePath="reports/2025/S/BN/12345"
    isPublic={false}
    onUploadComplete={(files) => {
        setAttachments([...attachments, ...files]);
        
        // Add usage tracking
        files.forEach(file => {
            fetch('/api/portal/files/usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    fileId: file.id,
                    type: 'report_attachment',
                    id: reportId
                })
            });
        });
    }}
/>
```

### **File cleanup při rušení**
```javascript
// Remove usage tracking when removing file from UI
const removeAttachment = async (fileId) => {
    await fetch('/api/portal/files/usage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
            fileId: fileId,
            type: 'report_attachment',
            id: reportId
        })
    });
    
    setAttachments(attachments.filter(f => f.id !== fileId));
};
```

## 🧪 Testování

### **Upload testing**
```bash
# Single file upload
curl -X POST "https://portalznackare.ddev.site/api/portal/files/upload" \
  -H "Cookie: PHPSESSID=..." \
  -F "files=@test.pdf" \
  -F "path=reports/2025/test/1/123" \
  -F "is_public=false"

# Multiple files
curl -X POST "https://portalznackare.ddev.site/api/portal/files/upload" \
  -H "Cookie: PHPSESSID=..." \
  -F "files=@test1.pdf" \
  -F "files=@test2.jpg" \
  -F "path=reports/2025/test/1/123"
```

### **Usage tracking testing**
```bash
# Add usage
curl -X POST "https://portalznackare.ddev.site/api/portal/files/usage" \
  -H "Content-Type: application/json" \
  -H "Cookie: PHPSESSID=..." \
  -d '{"fileId": 123, "type": "report_attachment", "id": 456}'

# Remove usage  
curl -X DELETE "https://portalznackare.ddev.site/api/portal/files/usage" \
  -H "Content-Type: application/json" \
  -H "Cookie: PHPSESSID=..." \
  -d '{"fileId": 123, "type": "report_attachment", "id": 456}'
```

## 🛠️ Troubleshooting

### **Upload selhává**
- Zkontroluj file size limit (15MB)
- Ověř MIME type restrictions
- Kontrola disk space na serveru
- Zkontroluj write permissions na uploads složku

### **Hash collision (velmi vzácné)**
- SHA-256 kolize jsou prakticky nemožné
- Service automaticky loguje kolize
- Fallback na unique filename generation

### **File serving problémy**  
- Public files: zkontroluj web server configuration
- Private files: ověř hash token v URL
- Zkontroluj robots.txt pro indexing rules

### **Usage tracking problémy**
- Temporary files se nemažou: zkontroluj cron job
- Usage count nesstimuje: ověř JSON structure v database
- Memory leaks: optimalizace usage tracking queries

---

**Funkcionální dokumentace:** [../features/file-management.md](../features/file-management.md)  
**API přehled:** [overview.md](overview.md)  
**Aktualizováno:** 2025-07-21