# TODO - Portál značkaře

Přehled plánovaných funkcí a vylepšení pro systém Portál značkaře.

## 🔥 Nejvyšší priorita - INSYS Integrace & Příkazy

### INSYS API Integrace
- [ ] **Status synchronizace**
  - Implementovat SUBMITTED status po odeslání do INSYS
  - Implementovat APPROVED status po schválení v INSYS
  - Webhook endpoint pro notifikace z INSYS
  - Error handling pro INSYS komunikaci
  - Retry mechanismus pro failed requests

- [ ] **Automatické workflow**
  - Automatické přepnutí z 'send' na 'submitted'
  - Notifikace uživatelům o změně stavu
  - Logování všech INSYS interakcí
  - Monitoring INSYS dostupnosti

### Příkazy - Rozšířené funkce
- [ ] **Bulk operace s příkazy**
  - Hromadné odeslání více hlášení
  - Export hlášení do Excel/PDF
  - Import dat z Excel pro rychlé vyplnění
  - Kopírování hlášení jako šablona

- [ ] **Vylepšení UX pro hlášení**
  - Auto-save každých 30 sekund
  - Offline mode s local storage
  - Validace v reálném čase
  - Nápověda kontextová k polím
  - Klávesové zkratky pro rychlou navigaci

- [ ] **Reporting a statistiky**
  - Dashboard s přehledem hlášení
  - Statistiky vyplacených náhrad
  - Grafy využití tras a úseků
  - Export pro účetnictví

## 🔥 Vysoká priorita

### File Management - Administrace
- [ ] **Admin rozhraní pro správu souborů** (`/admin/media`)
  - Seznam všech souborů s preview/thumbnails
  - Základní CRUD operace (view, delete)
  - Storage statistiky (využité místo, počet souborů)
  - Status: Připraveno k implementaci

### Příkazy - Admin funkce
- [ ] **Admin dashboard pro příkazy**
  - Přehled všech hlášení (všech uživatelů)
  - Rychlé schvalování/zamítání
  - Bulk operace nad hlášeními
  - Export dat pro INSYS
  
- [ ] **Šablony a automatizace**
  - Šablony pro opakující se trasy
  - Automatické vyplnění na základě historie
  - Prediktivní návrhy tras
  - Kopírování mezi příkazy

### JSON Data Cleanup
- [x] **File usage tracking** ✅ IMPLEMENTOVÁNO
  - Usage info při nahrání souborů
  - Tracking kde se soubory používají
  - API endpoints pro usage management
  
- [ ] **Automatic JSON cleanup**
  - Odstranění orphaned file references z report dat
  - Batch cleanup tool pro existující data
  - Preventivní kontroly při ukládání

## 🔶 Střední priorita

### INSYS Rozšíření
- [ ] **Rozšířené INSYS features**
  - Real-time status updates
  - Detailed error messages z INSYS
  - Retry queue pro failed submissions
  - INSYS health check endpoint
  
- [ ] **Integrace s KČT systémy**
  - Synchronizace členské základny
  - Automatické ověření oprávnění
  - Propojení s centrální evidencí tras

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

### CMS System (může počkat)
- [ ] **Core CMS entities**
  - Metodika, Page, Post entities
  - Basic admin CRUD
  - Jednoduché templates
  - Note: Statické stránky zatím stačí

- [ ] **Downloads management**
  - Správa souborů ke stažení
  - Kategorizace downloads
  - Public/private přístup
  - Note: Mock API zatím funguje

### Advanced Features
- [ ] **Image metadata extraction**
  - EXIF data reading
  - GPS coordinates extraction
  - Camera info display
  
- [ ] **Performance optimizations**
  - CDN integration
  - Database query optimization
  - Advanced caching strategies

### User Experience vylepšení
- [ ] **Pokročilé features**
  - Multi-language support
  - Advanced search
  - User preferences
  - Custom dashboards

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
- ✅ **Hlášení příkazů** - kompletní Part A + B s full workflow
- ✅ **INSYS API integrace** - základní odeslání a polling
- ✅ **File management** - upload, storage, deduplication
- ✅ **File usage tracking** - sledování použití souborů
- ✅ **Toast notifications** - jednotný systém notifikací
- ✅ **Disabled logic refactoring** - centralizovaná logika
- ✅ **Authentication** - Symfony Security s KČT LDAP
- ✅ **User permissions** - role-based access control
- ✅ **Dark mode** - kompletní podpora
- ✅ **Responsive design** - mobile-first approach

### 🎯 Aktuální priority (dle business potřeb)
- 🔥 **INSYS workflow** - dokončit submitted/approved stavy
- 🔥 **Příkazy dashboard** - přehled a statistiky
- 🔥 **Bulk operace** - hromadné zpracování hlášení
- 🟡 **Admin rozhraní** - pro správu příkazů a souborů
- 🟡 **JSON cleanup** - automatické čištění orphaned dat
- 🟢 **CMS systém** - může počkat, statické stránky stačí

### Architektonická rozhodnutí
- **Žádné versioning** - není potřeba pro náš use case
- **Žádný approval workflow** - přímé publikování
- **Jednoduché thumbnails** - stačí jedna velikost
- **Local storage** - CDN až v budoucnu podle potřeby

### Prioritizace (aktualizováno dle business potřeb)
1. **INSYS integrace** - dokončit workflow pro submitted/approved (KRITICKÉ)
2. **Příkazy features** - dashboard, bulk operace, šablony
3. **Admin rozhraní** - správa příkazů a souborů
4. **CMS System** - nízká priorita, statické stránky zatím vyhovují

### Implementační plán (8-10 týdnů)
**Fáze 1 (2-3 týdny):** INSYS workflow - status sync, webhooks, error handling
**Fáze 2 (2-3 týdny):** Příkazy dashboard - statistiky, bulk ops, export
**Fáze 3 (2 týdny):** Admin UI - file management, příkazy admin
**Fáze 4 (2 týdny):** Polish - UX vylepšení, performance, testy

### Technické TODO komentáře v kódu
- `FileUploadService.php:678` - JSON cleanup implementace (střední priorita)
- `PortalController.php` - CMS endpointy (nízká priorita, může zůstat mock)

---

**Aktualizováno:** 2025-08-07
**Verze:** 2.0  
**Status:** Aktivní development - fokus na INSYS a příkazy