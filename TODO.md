# TODO - Portál značkaře

Přehled plánovaných funkcí a vylepšení pro systém Portál značkaře.

## 🔥 Nejvyšší priorita - CMS System

### Content Management System
- [ ] **Core CMS entities implementace**
  - AbstractContent base entity
  - Metodika, Page, Post, Download entities
  - Taxonomy entities (Categories, Tags)
  - Doctrine migrations
  - Repository classes

- [ ] **Admin Backend**
  - Base admin controller a služby
  - CRUD rozhraní pro metodiky
  - CRUD rozhraní pro stránky  
  - CRUD rozhraní pro příspěvky
  - CRUD rozhraní pro downloads
  - Správa kategorií a tagů

- [ ] **CKEditor 5 integrace**
  - Editor setup s custom toolbar
  - Upload adapter pro file management
  - Content processing pipeline
  - Preview functionality

- [ ] **Dynamic Frontend**
  - Twig templates pro content typy
  - Content API endpoints
  - SEO optimalizace (meta tags, structured data)
  - URL routing pro content

## 🔥 Vysoká priorita

### File Management - Administrace
- [ ] **Admin rozhraní pro správu souborů** (`/admin/media`)
  - Seznam všech souborů s preview/thumbnails
  - Základní CRUD operace (view, delete)
  - Storage statistiky (využité místo, počet souborů)
  - Status: Připraveno k implementaci

### Batch operace
- [ ] **Bulk upload** 
  - Drag & drop celých složek
  - Progress bar pro multiple files
  - Hromadné nastavení storage path a is_public
  
- [ ] **Bulk delete/management**
  - Multi-select v admin rozhraní
  - Hromadné smazání selected files
  - Bulk move mezi složkami

### Search & Filtering
- [ ] **Admin search/filtering**
  - Fulltext search v názvech souborů
  - Filter podle typu souboru (image/pdf)
  - Filter podle public/private
  - Filter podle storage path
  - Filter podle data uploadu
  - Filter podle uploadera

## 🔶 Střední priorita

### Cleanup & Maintenance
- [ ] **Orphaned files management**
  - Detekce souborů bez usage_info
  - Admin tools pro cleanup nepoužívaných souborů
  - Automated cleanup command (cron job)
  
- [ ] **Storage optimization**
  - Komprese starších souborů
  - Cleanup thumbnails pro smazané originály
  - Storage quota warnings

### File Analytics & Reporting
- [ ] **Basic analytics v admin rozhraní**
  - Storage usage over time
  - Most uploaded file types
  - Top uploaders statistics
  - Files growth trends
  
- [ ] **Usage reports**
  - Které soubory se používají nejvíce
  - Unused files reports
  - Storage utilization by folders

### API Improvements
- [ ] **Extended API endpoints**
  - GET `/api/portal/files/search` - search API
  - GET `/api/portal/files/stats` - storage statistics
  - POST `/api/portal/files/batch` - batch operations
  
- [ ] **Better error handling**
  - Structured error responses
  - File validation improvements
  - Upload progress callbacks

## 🔷 Nízká priorita

### Advanced Features
- [ ] **Image metadata extraction**
  - EXIF data reading
  - GPS coordinates extraction
  - Camera info display
  
- [ ] **Advanced thumbnails**
  - Multiple thumbnail sizes
  - WebP format support
  - Lazy loading thumbnails

### Performance & Scalability
- [ ] **CDN integration** (budoucnost)
  - AWS CloudFront / CloudFlare support
  - URL generation for CDN
  - Cache invalidation
  
- [ ] **Database optimization**
  - Indexing improvements
  - Query optimization
  - Pagination for large datasets

### User Experience
- [ ] **Pokročilé upload UI**
  - Upload queue management
  - Resume interrupted uploads
  - File preview před uploadem
  
- [ ] **Better file organization**
  - Folder tree view v admin
  - Drag & drop reorganization
  - Bulk folder operations

## 📋 Technické vylepšení

### Code Quality
- [ ] **Testing**
  - Unit tests pro FileUploadService
  - Integration tests pro API endpoints
  - Frontend component tests
  
- [ ] **Documentation**
  - API documentation (OpenAPI/Swagger)
  - Code documentation improvements
  - User manual pro admin rozhraní

### Security Enhancements
- [ ] **Enhanced security**
  - Rate limiting pro upload API
  - Virus scanning integration
  - File content validation
  
- [ ] **Audit logging**
  - Log všech file operations
  - Admin action logging
  - Security event monitoring

### Mobile & Accessibility
- [ ] **Mobile optimizations**
  - Touch-friendly upload interface
  - Mobile camera integration
  - Responsive admin interface
  
- [ ] **Accessibility**
  - Screen reader support
  - Keyboard navigation
  - ARIA labels

## 🚀 Budoucí vize

### Integration Possibilities
- [ ] **External integrations**
  - Export do INSYS systému
  - Import z external sources
  - Webhook notifications
  
- [ ] **Advanced workflow** (možná v budoucnu)
  - File approval workflow
  - Multi-step upload process
  - Collaborative file management

### Advanced Analytics
- [ ] **Business intelligence**
  - Reporting dashboard
  - Export analytics data
  - Custom metrics tracking

## 📝 Poznámky k implementaci

### Současný stav (✅ Hotovo)
- ✅ File upload s public/private rozlišením
- ✅ Hash security tokens pro chráněné soubory
- ✅ Usage tracking systém
- ✅ Soft delete s grace period
- ✅ Kontextová organizace souborů
- ✅ Image processing (thumbnails, optimization)
- ✅ Deduplication pomocí SHA1 hash
- ✅ React komponenty pro upload
- ✅ Hlášení příkazů (Part A + B) - kompletní funkčnost
- ✅ INSYS API integrace - plná parity s WordPress
- ✅ Autentifikace systém - Symfony Security
- ✅ User management - lepší než WordPress řešení

### 🚨 Kritické chybějící funkce (vs WordPress plugin)
- ❌ **Metodika systém** - 0% implementováno (WordPress měl kompletní)
- ❌ **Downloads management** - jen mock API (WordPress měl admin)  
- ❌ **Static pages systém** - jen statické templaty (WordPress měl dynamic)
- ❌ **News/Posts systém** - chybí kompletně
- ❌ **Admin rozhraní** - pro správu obsahu (WordPress měl kompletní)

### Architektonická rozhodnutí
- **Žádné versioning** - není potřeba pro náš use case
- **Žádný approval workflow** - přímé publikování
- **Jednoduché thumbnails** - stačí jedna velikost
- **Local storage** - CDN až v budoucnu podle potřeby

### Prioritizace (aktualizováno po analýze WP pluginu)
1. **CMS System** - metodiky, stránky, příspěvky (kritické)
2. **Admin interface** - kompletní správa obsahu
3. **File management admin** - rozšíření stávajícího systému
4. **Advanced features** - podle potřeby uživatelů

### Implementační plán (12 týdnů)
**Fáze 1 (4-6 týdnů):** Core CMS - entities, admin CRUD, CKEditor
**Fáze 2 (2-4 týdny):** Advanced features - search, SEO, performance  
**Fáze 3 (1-2 týdny):** Polish - UX, analytics, optional features

---

**Aktualizováno:** 2025-01-20  
**Verze:** 1.0  
**Status:** Draft