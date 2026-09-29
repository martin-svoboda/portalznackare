# Admin Media Library - WordPress-style správa médií

> **Admin Feature** - Centralizovaná administrace souborů a příloh v portálu

## 📁 Přehled admin media library

### Účel funkce
WordPress-style administrační rozhraní pro správu všech uploadovaných souborů v systému:
- **Prohlížení souborů** - Grid view s náhledy a metadata
- **Filtrování** - Podle složky, typu, použití, uploaderů
- **Operace se soubory** - Preview, editace obrázků, mazání, kopírování URL
- **Upload souborů** - Integrovaný upload přímo v administraci
- **Sidebar navigace** - Flat folder tree z existing storage_path

### Architektura
```
Admin Route → React App → API Endpoints → Repository Methods
    ↓             ↓            ↓                ↓
Twig Template  Grid View   FileController  SQL Parsing
```

**Klíčové principy:**
- **KISS (Keep It Simple)** - Žádné nové DB sloupce, parse existing storage_path
- **Reuse components** - FileGrid z AdvancedFileUpload, UnifiedImageModal
- **Real folder names** - Žádné překlady nebo přejmenovávání složek
- **Flat folder list** - Jednoduchý seznam s indentací, ne složitý strom

## 🎯 UI/UX Design

### Layout
```
┌────────────────────────────────────────────────────────────┐
│ Admin Header                                                │
├───────────────┬────────────────────────────────────────────┤
│ Sidebar       │ Main Grid Area                             │
│               │ ┌──────────────────────────────────────┐   │
│ Všechny       │ │ Upload Zone (AdvancedFileUpload)    │   │
│ soubory (45)  │ └──────────────────────────────────────┘   │
│               │                                            │
│ reports (32)  │ Filters: Type | Usage | Search             │
│ methodologies │                                            │
│ users (8)     │ ┌─────┬─────┬─────┬─────┐                 │
│ temp (5)      │ │ IMG │ PDF │ IMG │ DOC │                 │
│               │ │     │     │     │     │                 │
│ Filters:      │ └─────┴─────┴─────┴─────┘                 │
│ ◉ All         │ ┌─────┬─────┬─────┬─────┐                 │
│ ○ Used        │ │ IMG │ IMG │ PDF │ IMG │                 │
│ ○ Unused      │ └─────┴─────┴─────┴─────┘                 │
└───────────────┴────────────────────────────────────────────┘
```

### Grid View Features
- **Responsive columns**: 1-6 columns based on viewport
- **Thumbnails**: Auto-generated nebo type icons
- **File info**: Název, velikost, datum, uploader
- **Actions**: Preview, Edit (images), Delete, Copy URL
- **Loading states**: Skeleton screens během načítání

### Filter Options
1. **Folder Filter** - Sidebar navigace
2. **Type Filter** - All / Images / PDFs / Documents
3. **Usage Filter** - All / Used / Unused
4. **Search** - Fulltext v názvu souboru
5. **Uploader** - Filter podle uploadera (TODO)

## 🔧 Backend Implementation

### FileAttachmentRepository Methods

#### getFolderStructure()
**Lokace:** `FileAttachmentRepository::getFolderStructure()`

Parsuje složky z existing `storage_path` column - **ŽÁDNÁ nová DB migrace**.

```php
public function getFolderStructure(): array
{
    $conn = $this->getEntityManager()->getConnection();

    // Parse first part of storage_path (e.g., "reports/2025/..." -> "reports")
    $sql = "
        SELECT SPLIT_PART(storage_path, '/', 1) as folder, COUNT(*) as count
        FROM file_attachments
        WHERE deleted_at IS NULL
        GROUP BY folder
        ORDER BY folder ASC
    ";

    $stmt = $conn->prepare($sql);
    $result = $stmt->executeQuery();

    return array_map(function($row) {
        return [
            'name' => $row['folder'],  // Real folder name from disk
            'count' => (int)$row['count']
        ];
    }, $result->fetchAllAssociative());
}
```

**Výstup:**
```json
[
    {"name": "methodologies", "count": 12},
    {"name": "reports", "count": 32},
    {"name": "temp", "count": 5},
    {"name": "users", "count": 8}
]
```

#### findForLibrary($filters)
**Lokace:** `FileAttachmentRepository::findForLibrary()`

Filtrovaný listing souborů pro media library.

```php
public function findForLibrary(array $filters = []): array
{
    $qb = $this->createQueryBuilder('f')
        ->where('f.deletedAt IS NULL')
        ->orderBy('f.createdAt', 'DESC');

    // Filter by folder (parse storage_path)
    if (!empty($filters['folder'])) {
        $qb->andWhere('f.storagePath LIKE :folder')
           ->setParameter('folder', $filters['folder'] . '%');
    }

    // Filter by usage
    if (isset($filters['usage'])) {
        if ($filters['usage'] === 'unused') {
            $qb->andWhere('(f.usageInfo IS NULL OR JSON_LENGTH(f.usageInfo) = 0)');
        } elseif ($filters['usage'] === 'used') {
            $qb->andWhere('f.usageInfo IS NOT NULL')
               ->andWhere('JSON_LENGTH(f.usageInfo) > 0');
        }
    }

    // Filter by MIME type
    if (!empty($filters['type'])) {
        switch ($filters['type']) {
            case 'images':
                $qb->andWhere('f.mimeType LIKE :mime')
                   ->setParameter('mime', 'image/%');
                break;
            case 'pdfs':
                $qb->andWhere('f.mimeType = :mime')
                   ->setParameter('mime', 'application/pdf');
                break;
            case 'documents':
                $qb->andWhere($qb->expr()->orX(
                    $qb->expr()->like('f.mimeType', ':doc1'),
                    $qb->expr()->like('f.mimeType', ':doc2'),
                    $qb->expr()->eq('f.mimeType', ':doc3')
                ))
                ->setParameter('doc1', 'application/msword%')
                ->setParameter('doc2', 'application/vnd.%')
                ->setParameter('doc3', 'text/plain');
                break;
        }
    }

    // Search by filename
    if (!empty($filters['search'])) {
        $qb->andWhere($qb->expr()->orX(
            $qb->expr()->like('f.originalName', ':search'),
            $qb->expr()->like('f.storedName', ':search')
        ))
        ->setParameter('search', '%' . $filters['search'] . '%');
    }

    return $qb->getQuery()->getResult();
}
```

**Příklad volání:**
```php
$files = $repository->findForLibrary([
    'folder' => 'reports',
    'usage' => 'unused',
    'type' => 'images',
    'search' => 'photo'
]);
```

### API Endpoints

#### GET `/api/portal/files/folders`
**Lokace:** `FileController::getFolders()`
**Security:** `ROLE_ADMIN` required

Vrátí seznam složek s počty souborů.

**Response:**
```json
{
    "success": true,
    "folders": [
        {"name": "reports", "path": "reports", "depth": 0, "count": 32},
        {"name": "2025", "path": "reports/2025", "depth": 1, "count": 30}
    ]
}
```
Plochý seznam všech úrovní `storage_path` (seřazený podle `path`); `count` = soubory ve složce vč. podsložek.

**Curl test:**
```bash
curl -X GET "https://portalznackare.ddev.site/api/portal/files/folders" \
  --cookie "PHPSESSID=..." \
  -H "Accept: application/json"
```

#### GET `/api/portal/files/library`
**Lokace:** `FileController::getLibrary()`
**Security:** `ROLE_ADMIN` required

Vrátí seznam souborů s filtrováním.

**Query parametry:**
- `folder` - Filter podle složky (např. `reports`)
- `usage` - Filter podle použití (`all` / `used` / `unused`)
- `type` - Filter podle typu (`all` / `images` / `pdfs` / `documents`)
- `search` - Fulltext search v názvu souboru
- `uploadedBy` - Filter podle INT_ADR uploadera

**Response:**
```json
{
    "success": true,
    "files": [
        {
            "id": 123,
            "fileName": "photo.jpg",
            "storedName": "abc123def456.jpg",
            "fileSize": 1048576,
            "fileType": "image/jpeg",
            "url": "/uploads/reports/2025/praha/1/123/abc123def456/photo.jpg",
            "thumbnailUrl": "/uploads/reports/2025/praha/1/123/thumb_abc123def456.jpg",
            "storagePath": "reports/2025/praha/1/123",
            "uploadedAt": "2025-01-15T10:30:00+00:00",
            "uploadedBy": 4133,
            "usageCount": 2,
            "usageInfo": {"reports": {"123": ["Prilohy_NP"]}},
            "isTemporary": false,
            "isPublic": false,
            "metadata": {}
        }
    ],
    "count": 1
}
```

**Curl test:**
```bash
# All files
curl "https://portalznackare.ddev.site/api/portal/files/library"

# Filter by folder
curl "https://portalznackare.ddev.site/api/portal/files/library?folder=reports"

# Filter unused images
curl "https://portalznackare.ddev.site/api/portal/files/library?usage=unused&type=images"

# Search
curl "https://portalznackare.ddev.site/api/portal/files/library?search=photo"
```

## ⚛️ React Frontend

### Component Structure
```
assets/js/apps/admin-media-library/
├── App.jsx              # Main admin application (~380 lines)
└── index.jsx            # Mount logic + debug

assets/js/components/shared/media/
├── FileGrid.jsx         # Reusable grid (extracted from AdvancedFileUpload)
├── FolderList.jsx       # Flat folder sidebar
└── UnifiedImageModal.jsx # Preview/Edit modal (existing)
```

### MediaLibraryAdmin App
**Lokace:** `admin-media-library/App.jsx`

**State management:**
```javascript
const [folders, setFolders] = useState([]);
const [files, setFiles] = useState([]);
const [selectedFolder, setSelectedFolder] = useState(null);
const [filters, setFilters] = useState({
    usage: 'all',
    type: 'all',
    search: ''
});
const [loading, setLoading] = useState(false);
const [refreshing, setRefreshing] = useState(false);
const [modalFile, setModalFile] = useState(null);
const [modalMode, setModalMode] = useState(null);
```

**API Integration:**
```javascript
// Load folders
const loadFolders = async () => {
    const response = await fetch('/api/portal/files/folders');
    const data = await response.json();
    if (data.success) {
        setFolders(data.folders);
    }
};

// Load files with filters
const loadFiles = async () => {
    const params = new URLSearchParams();
    if (selectedFolder) params.append('folder', selectedFolder);
    if (filters.usage !== 'all') params.append('usage', filters.usage);
    if (filters.type !== 'all') params.append('type', filters.type);
    if (filters.search) params.append('search', filters.search);

    const response = await fetch(`/api/portal/files/library?${params}`);
    const data = await response.json();
    if (data.success) {
        setFiles(data.files);
    }
};
```

**Layout Structure:**
```jsx
<div className="media-library">
    {/* Sidebar */}
    <aside className="media-library__sidebar">
        <FolderList
            folders={folders}
            selectedFolder={selectedFolder}
            onFolderSelect={handleFolderSelect}
        />

        {/* Usage filters */}
        <div className="usage-filters">
            <label>
                <input type="radio" name="usage" value="all" />
                Všechny soubory
            </label>
            <label>
                <input type="radio" name="usage" value="used" />
                Použité
            </label>
            <label>
                <input type="radio" name="usage" value="unused" />
                Nepoužité
            </label>
        </div>
    </aside>

    {/* Main content */}
    <main className="media-library__main">
        {/* Upload zone */}
        <AdvancedFileUpload
            id="admin-media-upload"
            files={[]}
            onFilesChange={handleFilesUploaded}
            storagePath={uploadPath}
            isPublic={isPublicFolder(selectedFolder)}
        />

        {/* Top filters */}
        <div className="media-filters">
            <select value={filters.type} onChange={handleTypeChange}>
                <option value="all">Všechny typy</option>
                <option value="images">Obrázky</option>
                <option value="pdfs">PDF</option>
                <option value="documents">Dokumenty</option>
            </select>

            <input
                type="search"
                placeholder="Hledat soubory..."
                value={filters.search}
                onChange={handleSearchChange}
            />
        </div>

        {/* File grid */}
        <FileGrid
            files={files}
            gridCols={3}
            onPreview={handlePreview}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCopyUrl={handleCopyUrl}
        />
    </main>

    {/* Modal */}
    <UnifiedImageModal
        file={modalFile}
        isOpen={modalMode !== null}
        mode={modalMode}
        onClose={() => setModalMode(null)}
        onSave={handleModalSave}
        onRotate={handleRotate}
    />
</div>
```

### FileGrid Component (Reusable)
**Lokace:** `shared/media/FileGrid.jsx`

Extrahována z AdvancedFileUpload, nyní reusable component.

**Props:**
```typescript
interface FileGridProps {
    files: FileAttachment[];
    onPreview: (file) => void;
    onEdit?: (file) => void;     // Optional - jen pro images
    onDelete?: (file) => void;    // Optional - admin akce
    onCopyUrl?: (file) => void;   // Optional - copy URL to clipboard
    gridCols?: 1 | 2 | 3 | 4 | 5 | 6;
    showActions?: boolean;
    actionsMode?: 'inline' | 'overlay';
    disabled?: boolean;
}
```

**Usage:**
```jsx
// Admin media library - all actions
<FileGrid
    files={files}
    gridCols={3}
    onPreview={handlePreview}
    onEdit={handleEdit}
    onDelete={handleDelete}
    onCopyUrl={handleCopyUrl}
    actionsMode="overlay"
/>

// AdvancedFileUpload - limited actions
<FileGrid
    files={files}
    gridCols={2}
    onPreview={handlePreview}
    onEdit={handleEdit}
    onDelete={handleDelete}
    actionsMode="inline"
    disabled={disabled}
/>
```

### FolderList Component
**Lokace:** `shared/media/FolderList.jsx`

Flat list složek s indentací podle depth.

**Props:**
```typescript
interface FolderListProps {
    folders: Array<{name: string; count: number}>;
    selectedFolder: string | null;
    onFolderSelect: (folderName: string | null) => void;
    showCounts?: boolean;
}
```

**Usage:**
```jsx
<FolderList
    folders={[
        {name: "reports", count: 32},
        {name: "methodologies", count: 12},
        {name: "users", count: 8}
    ]}
    selectedFolder={selectedFolder}
    onFolderSelect={setSelectedFolder}
/>
```

**Rendering:**
```jsx
export default function FolderList({ folders, selectedFolder, onFolderSelect, showCounts = true }) {
    return (
        <div className="folder-list">
            {/* All files option */}
            <button
                className={`folder-list__item ${selectedFolder === null ? 'active' : ''}`}
                onClick={() => onFolderSelect(null)}
            >
                <IconFolder size={18} />
                Všechny soubory
                {showCounts && <span className="count">{totalCount}</span>}
            </button>

            {/* Folder list - flat with indentation */}
            {folders.map(folder => (
                <button
                    key={folder.name}
                    className={`folder-list__item ${selectedFolder === folder.name ? 'active' : ''}`}
                    onClick={() => onFolderSelect(folder.name)}
                >
                    <IconFolder size={18} />
                    {folder.name}
                    {showCounts && <span className="count">{folder.count}</span>}
                </button>
            ))}
        </div>
    );
}
```

## 🎨 Styling (BEM + Tailwind)

### Media Library Layout
```scss
// assets/css/components/admin/_media-library.scss

.media-library {
    @apply flex gap-6;
    @apply min-h-screen;

    &__sidebar {
        @apply w-64 shrink-0;
        @apply bg-white dark:bg-gray-800;
        @apply border-r border-gray-200 dark:border-gray-700;
        @apply p-4;
    }

    &__main {
        @apply flex-1;
        @apply p-6;
    }
}

// Folder list
.folder-list {
    @apply space-y-1;

    &__item {
        @apply w-full flex items-center gap-2;
        @apply px-3 py-2 rounded-md;
        @apply text-sm text-gray-700 dark:text-gray-300;
        @apply hover:bg-gray-100 dark:hover:bg-gray-700;
        @apply transition-colors;

        &.active {
            @apply bg-blue-50 dark:bg-blue-900;
            @apply text-blue-600 dark:text-blue-300;
            @apply font-medium;
        }

        .count {
            @apply ml-auto text-xs;
            @apply text-gray-500 dark:text-gray-400;
        }
    }
}

// Usage filters
.usage-filters {
    @apply mt-6 pt-6;
    @apply border-t border-gray-200 dark:border-gray-700;
    @apply space-y-2;

    label {
        @apply flex items-center gap-2;
        @apply text-sm text-gray-700 dark:text-gray-300;
        @apply cursor-pointer;

        input[type="radio"] {
            @apply text-blue-600;
        }
    }
}

// File grid (shared component)
.file-grid {
    @apply grid gap-4;

    &--cols-1 { @apply grid-cols-1; }
    &--cols-2 { @apply grid-cols-2; }
    &--cols-3 { @apply grid-cols-3; }
    &--cols-4 { @apply grid-cols-4; }
    &--cols-5 { @apply grid-cols-5; }
    &--cols-6 { @apply grid-cols-6; }

    &__item {
        @apply relative;
        @apply bg-white dark:bg-gray-800;
        @apply border border-gray-200 dark:border-gray-700;
        @apply rounded-lg overflow-hidden;
        @apply hover:shadow-lg transition-shadow;

        &:hover .file-grid__actions {
            @apply opacity-100;
        }
    }

    &__thumbnail {
        @apply aspect-square;
        @apply bg-gray-100 dark:bg-gray-900;
        @apply flex items-center justify-center;

        img {
            @apply w-full h-full object-cover;
        }
    }

    &__info {
        @apply p-3 space-y-1;

        &-name {
            @apply text-sm font-medium;
            @apply text-gray-900 dark:text-gray-100;
            @apply truncate;
        }

        &-meta {
            @apply text-xs text-gray-500 dark:text-gray-400;
        }
    }

    &__actions {
        @apply absolute inset-0;
        @apply bg-black/50;
        @apply flex items-center justify-center gap-2;
        @apply opacity-0 transition-opacity;

        &--inline {
            @apply relative opacity-100 bg-transparent;
            @apply justify-end p-2;
        }
    }
}
```

## 🔐 Security

### Admin-Only Access
```php
// FileController.php
#[Route('/folders', methods: ['GET'])]
#[IsGranted('ROLE_ADMIN')]
public function getFolders(): JsonResponse
{
    // Only admins can list folders
}

#[Route('/library', methods: ['GET'])]
#[IsGranted('ROLE_ADMIN')]
public function getLibrary(Request $request): JsonResponse
{
    // Only admins can browse media library
}
```

### File Access Validation
- **Seznamy souborů:** Pouze admins přes API
- **Preview/Download:** Standardní FileServeController s tokeny
- **Edit/Delete:** Admin privileges required

## 🧪 Testing

### Test Admin Access
```bash
# Login as admin
curl -X POST "https://portalznackare.ddev.site/api/auth/login" \
  -d "username=admin&password=admin"

# List folders
curl "https://portalznackare.ddev.site/api/portal/files/folders" \
  --cookie "PHPSESSID=..."

# List files
curl "https://portalznackare.ddev.site/api/portal/files/library" \
  --cookie "PHPSESSID=..."
```

### Test Filters
```bash
# Filter by folder
curl "https://portalznackare.ddev.site/api/portal/files/library?folder=reports"

# Filter unused files
curl "https://portalznackare.ddev.site/api/portal/files/library?usage=unused"

# Filter images
curl "https://portalznackare.ddev.site/api/portal/files/library?type=images"

# Search
curl "https://portalznackare.ddev.site/api/portal/files/library?search=photo"

# Combined filters
curl "https://portalznackare.ddev.site/api/portal/files/library?folder=reports&usage=unused&type=images"
```

### Test React App
1. Login jako admin: `/admin`
2. Navigate to: `/admin/media`
3. Test sidebar folder navigation
4. Test usage filters (All / Used / Unused)
5. Test type filters (All / Images / PDFs / Documents)
6. Test search functionality
7. Test file actions: Preview, Edit, Delete, Copy URL
8. Test upload integration
9. Check dark mode compatibility

## 🚀 Deployment Checklist

### Initial Setup
- [x] Backend: Repository methods `getFolderStructure()` a `findForLibrary()`
- [x] Backend: API endpoints `/folders` a `/library`
- [x] Backend: Security annotations `#[IsGranted('ROLE_ADMIN')]`
- [x] Frontend: React app `admin-media-library/App.jsx`
- [x] Frontend: Reusable `FileGrid.jsx` component
- [x] Frontend: Reusable `FolderList.jsx` component
- [x] Routing: AdminController route `/admin/media`
- [x] Routing: Twig template `admin/media-library.html.twig`
- [x] Routing: Navigation link v `admin.html.twig`
- [x] Webpack: Entry `admin-media-library` v `webpack.config.js`
- [x] Build: `ddev npm run build`

### Documentation
- [x] Feature documentation: `docs/features/admin-media-library.md`
- [ ] API documentation: `docs/api.md`
- [ ] Update: `docs/overview.md` with cross-links

## ✅ Aktuální Stav (2025-11-11)

**IMPLEMENTOVÁNO:**
- ✅ Backend SQL parsing existing `storage_path` - NO migration needed
- ✅ FileAttachmentRepository::getFolderStructure() - SPLIT_PART SQL
- ✅ FileAttachmentRepository::findForLibrary() - Advanced filtering
- ✅ API endpoints `/folders` a `/library` with ROLE_ADMIN security
- ✅ React app MediaLibraryAdmin (~380 lines)
- ✅ Reusable FileGrid component (extracted from AdvancedFileUpload)
- ✅ Reusable FolderList component (flat list with indentation)
- ✅ Admin routing `/admin/media`
- ✅ Webpack entry configuration
- ✅ Build completed successfully

**KNOWN ISSUES:**
- 🔧 JavaScript TypeError fixed - webpack rebuild resolved stale bundle issue
- ⚠️ Routing conflict fixed - added `requirements: ['id' => '\d+']`
- ⚠️ Table name bug fixed - `file_attachment` → `file_attachments`

**PENDING:**
- [ ] User testing in production environment
- [ ] Performance optimization (pagination for large libraries)
- [ ] Advanced features (bulk operations, move files)

---

**Related Documentation:**
- **File Management:** [file-management.md](file-management.md)
- **API Reference:** [../api.md#soubory](../api.md#soubory)
- **Admin Features:** [content-management.md](content-management.md)
- **Main Overview:** [../overview.md](../overview.md)

**Aktualizováno:** 2025-11-11 - Initial implementation completed
