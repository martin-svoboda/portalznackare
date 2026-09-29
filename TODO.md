# TODO - Portál značkaře

Přehled plánovaných funkcí a vylepšení pro systém Portál značkaře.
Hotové položky jsou označené `[x]` s odkazem, kde je to v kódu; `[ ]` = stále otevřené.

## 🔥 Nejvyšší priorita - INSYZ Integrace & Příkazy

### INSYZ API Integrace
- [ ] **Status synchronizace** (částečně hotovo)
  - [x] SUBMITTED po úspěšném odeslání do INSYZ – nastavuje worker (`SendToInsyzHandler`)
  - [x] APPROVED – nastavuje se automaticky při načtení seznamu/detailu příkazů, když je příkaz v INSYZ ve stavu Provedený / Předaný KKZ / Zaúčtovaný (`DataEnricherService::syncReportStates`); admin může stav změnit i ručně (`POST /admin/api/reports/{id}/state`)
  - [ ] Webhook endpoint pro notifikace z INSYZ – neexistuje (APPROVED se dozvíme až při dalším načtení příkazu)
  - [x] Error handling pro INSYZ komunikaci – chyba odeslání → stav `rejected` + záznam v historii hlášení, hlášení lze opravit a odeslat znovu
  - [x] Retry – **záměrně bez automatického opakování** (`messenger.yaml`: `max_retries: 0`, protože `trasy.ZP_Zapis_XML` není idempotentní); selhání jde do `failed` transportu, znovu odesílá admin (stav `send` v administraci, příp. `app:reports:resend-insyz`)

- [ ] **Automatické workflow** (částečně hotovo)
  - [x] Automatické přepnutí z 'send' na 'submitted' (worker)
  - [ ] Notifikace uživatelům o změně stavu – jen toast v otevřeném formuláři (polling `useStatusPolling`), e-mailové ani jiné notifikace nejsou
  - [x] Logování všech INSYZ interakcí – `InsyzAuditLog`, přehled `/admin/insyz-monitoring`
  - [x] Monitoring INSYZ – `/admin/insyz-monitoring` (výpis INSYZ logů) + CI health check v `TestController` (hlavička `X-Healthcheck-Token`)

### Příkazy - Rozšířené funkce
- [ ] **Bulk operace s příkazy**
  - [x] Hromadné znovuodeslání hlášení do INSYZ – `app:reports:resend-insyz` (výpis, odeslání s `--force`)
  - [ ] Export hlášení do Excel/PDF
  - [ ] Import dat z Excel pro rychlé vyplnění
  - [ ] Kopírování hlášení jako šablona

- [ ] **Vylepšení UX pro hlášení**
  - [x] Auto-save – draft se ukládá 3 s po poslední změně (`useAutoSave`, jen stav `draft` a editovatelné hlášení)
  - [ ] Offline mode s local storage
  - [x] Validace v reálném čase – validační zprávy v části A i B (`ValidationMessages`)
  - [ ] Nápověda kontextová k polím
  - [ ] Klávesové zkratky pro rychlou navigaci

- [ ] **Reporting a statistiky**
  - [ ] Dashboard s přehledem hlášení (admin dashboard má jen počty hlášení podle stavu)
  - [ ] Statistiky vyplacených náhrad
  - [ ] Grafy využití tras a úseků
  - [ ] Export pro účetnictví

## 🔥 Vysoká priorita

### File Management - Administrace
- [x] **Admin rozhraní pro správu souborů** (`/admin/media`) ✅ – app `admin-media-library`, viz [docs/features/admin-media-library.md](docs/features/admin-media-library.md)
  - [x] Seznam všech souborů s náhledy, složky, filtry, hledání
  - [x] Mazání souborů
  - [ ] Storage statistiky (využité místo) – zatím jen počty souborů ve složkách

### Příkazy - Admin funkce
- [x] **Admin dashboard pro příkazy** ✅ – `/admin/hlaseni` (app `admin-reports-list`) + detail `/admin/hlaseni/{id}`, viz [docs/features/admin-vypis-hlaseni.md](docs/features/admin-vypis-hlaseni.md)
  - [x] Přehled všech hlášení (všech uživatelů)
  - [x] Ruční změna stavu hlášení adminem (vč. odeslání do INSYZ)
  - [ ] Bulk operace nad hlášeními v UI
  - [x] Náhled XML pro INSYZ (tab „XML pro INSYZ", `GET /admin/api/reports/{id}/xml`)

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

- [ ] **Automatic JSON cleanup** (částečně)
  - [x] Odstranění reference z dat hlášení při smazání souboru (`FileUploadService::cleanupAllEntityReferences`), výpis `GET /api/portal/files/orphaned-references`
  - [ ] Batch cleanup tool pro existující data (`app:files:cleanup` maže jen expirované dočasné soubory)
  - [ ] Preventivní kontroly při ukládání

## 🔶 Střední priorita

### INSYZ Rozšíření
- [ ] **Rozšířené INSYZ features**
  - [ ] Real-time status updates (dnes polling ve formuláři + synchronizace stavu při načtení příkazu)
  - [ ] Detailed error messages z INSYZ pro uživatele
  - [x] Fronta selhaných odeslání – `failed` transport Messengeru (bez automatického retry, viz výše)
  - [x] INSYZ health check endpoint – CI health check (`TestController`)

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
  - Unused files reports (knihovna médií má filtr Used / Unused)
  - Storage utilization by folders

### API Improvements
- [ ] **Extended API endpoints**
  - [x] Vyhledávání souborů – `GET /api/portal/files/library` (filtr, hledání)
  - [ ] GET `/api/portal/files/stats` - storage statistics
  - [ ] POST `/api/portal/files/batch` - batch operations

- [ ] **Better error handling**
  - Structured error responses
  - File validation improvements
  - Upload progress callbacks

### PortalController – nedokončené endpointy
- [ ] `GET /api/portal/post`, `/metodika`, `/metodika-terms`, `/downloads` vrací **501** (TODO stuby v `src/Controller/Api/PortalController.php`)

## 🔷 Nízká priorita

### CMS System
- [x] **Core CMS** ✅ – entita `Page`, admin `/admin/cms` (app `admin-cms-pages`, `admin-cms-page-editor`), API `/admin/api/cms`, veřejné zobrazení `CmsController`; viz [docs/features/content-management.md](docs/features/content-management.md)

- [ ] **Downloads management**
  - Správa souborů ke stažení
  - Kategorizace downloads
  - Public/private přístup
  - Note: API `/api/portal/downloads` je zatím stub (501)

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
- [ ] **Testing** (rozpracováno)
  - [x] První PHPUnit testy (`tests/` – CSRF listener, login throttling, `SendToInsyzHandler`, služby) a Vitest testy výpočtů hlášení
  - [ ] Unit tests pro FileUploadService
  - [ ] Integration tests pro API endpoints
  - [ ] Frontend component tests

- [ ] **Documentation**
  - API documentation (OpenAPI/Swagger)
  - Code documentation improvements
  - User manual pro admin rozhraní

### Security Enhancements
- [x] **Security headers** ✅ – `SecurityHeadersListener` (CSP, HSTS, X-Frame-Options)
- [x] **CSRF ochrana API** ✅ – `ApiCsrfListener` (hlavička `X-CSRF-Token`)
- [x] **Login throttling** ✅ – `InsyzAuthenticator` (limit podle e-mailu i IP)
- [x] **Řízení přístupu k hlášení** ✅ – číst smí jen člen týmu příkazu / admin, ukládat a odesílat jen vedoucí týmu / admin (`PortalController::report`)
- [x] **MSSQL timeouty** ✅ – `LoginTimeout=30` a `LOCK_TIMEOUT 30000` v `MssqlConnector`
- [ ] **Enhanced security**
  - Rate limiting pro upload API
  - Virus scanning integration
  - File content validation

- [x] **Audit logging** ✅ – `AuditLog` + `AuditEventListener` (CRUD entit, přihlášení), `InsyzAuditLog`; viz [docs/features/audit-logging.md](docs/features/audit-logging.md)

### Deployment
- [ ] **Bezpečnost deploye** (`.github/workflows/deploy.yml`)
  - Deploy běží přes SSH jako `root` (`SSH_USER: root`, `COMPOSER_ALLOW_SUPERUSER=1`)
  - `chmod -R 777 var/cache var/log public/build`
  - Chyby migrací se maskují (`doctrine:migrations:migrate ... || echo "⚠️ Migration skipped"`) – selhání deploye se nedetekuje

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
- ✅ **ZP-I (instalace)** - část B po TIMech, náhrady podle počtu TIMů, kontrolní formulář PDF
- ✅ **Vícedenní hlášení** - stravné a náhrady po kalendářních dnech, nocležné (scénáře I/II)
- ✅ **INSYZ API integrace** - odeslání přes worker, stavy submitted/approved/rejected
- ✅ **File management** - upload, storage, deduplication, admin knihovna médií
- ✅ **File usage tracking** - sledování použití souborů
- ✅ **Admin** - výpis a detail hlášení, CMS, audit logy, INSYZ monitoring
- ✅ **Toast notifications** - jednotný systém notifikací
- ✅ **Disabled logic refactoring** - centralizovaná logika
- ✅ **Authentication** - Symfony Security, přihlášení e-mailem a heslem ověřené proti INSYZ (`InsyzAuthenticator` → `InsyzService::loginUser`)
- ✅ **User permissions** - role-based access control
- ✅ **Dark mode** - kompletní podpora
- ✅ **Responsive design** - mobile-first approach

### Poznámka k UI knihovnám
- Material UI (`@mui/material`) se používá jen jako závislost `material-react-table` – v souladu s pravidly projektu, není to úkol k odstranění. Mantine je z `package.json` odstraněný.

### 🎯 Aktuální priority (dle business potřeb)
- 🔥 **Bezpečnost deploye** - non-root uživatel, bez `chmod 777`, nemaskovat chyby migrací
- 🔥 **Příkazy dashboard** - přehled a statistiky
- 🟡 **Notifikace o změně stavu hlášení** - mimo otevřený formulář
- 🟡 **JSON cleanup** - hromadné čištění osiřelých referencí
- 🟢 **PortalController stuby** - `/post`, `/metodika`, `/downloads`

### Architektonická rozhodnutí
- **Žádné versioning** - není potřeba pro náš use case
- **Žádný approval workflow** - přímé publikování
- **Jednoduché thumbnails** - stačí jedna velikost
- **Local storage** - CDN až v budoucnu podle potřeby
- **Žádný automatický retry odeslání do INSYZ** - `ZP_Zapis_XML` není idempotentní

### Technické TODO komentáře v kódu
- `PortalController.php` - stuby `/post`, `/metodika`, `/metodika-terms`, `/downloads` (501)

---

**Aktualizováno:** 2026-09-27
**Verze:** 3.0
**Status:** Aktivní development
