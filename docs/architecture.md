# Architektura aplikace

> **Architektonická dokumentace** - Základní principy, hybrid architektura a datový tok v Portálu značkaře

## 🏗️ Základní principy

### 1. **Hybrid architektura**
- **Symfony 6.4 LTS** jako backend framework
- **Twig templating** pro server-side rendering a layouty  
- **React 18 micro-apps** pouze pro komplexní interaktivní komponenty
- **PostgreSQL** pro aplikační data + **MSSQL** pro INSYZ integraci

### 2. **Micro-frontend přístup**
- React aplikace jako samostatné micro-apps místo monolitické SPA
- Každá React app má vlastní webpack entry point
- Twig šablony definují mount pointy pro React aplikace

### 3. **Data separation**
- **INSYZ data** (MSSQL) - příkazy, uživatelé, sazby (read-only)
- **Portal data** (PostgreSQL) - hlášení, soubory, CMS obsah (read-write)

### 4. **Konvence názvů parametrů (POVINNÉ)**
- **Všechna uživatelská data, formulářová pole, výpočty** používají český Snake_Case formát
- **Hierarchie:** část → oblast → vlastnost  
- **Příklady:** `Datum_Provedeni`, `Hlavni_Ridic`, `Cast_A_Dokoncena`
- **INSYZ konzistence:** Všechny parametry odpovídají vzorům pojmenování INSYZ dat

## 🎯 Hybrid Twig + React architektura

### Základní koncept
```
Symfony Router → Twig Template → React Mount Point → React App
                ↓
            Server HTML      +     Client Interactivity
```

**Proč hybrid místo SPA?**
- **SEO optimalizace:** Server-side rendering pro statický obsah
- **Performance:** Rychlé načítání, menší bundle size
- **Postupná migrace:** Možnost přidávat React postupně
- **Flexibilita:** Správná technologie pro správný úkol

### Mount pattern
```twig
{# Twig template definuje mount point #}
<div id="prikaz-detail-app" 
     data-app="prikaz-detail"
     data-id="{{ prikaz.id }}"
     data-user="{{ app.user.intAdr }}">
    
    {# Fallback obsah pro SEO a loading #}
    <h1>{{ prikaz.cisloZp }}</h1>
    <p>Načítání detailu příkazu...</p>
</div>
```

```javascript
// React app se připojí k mount pointu
const container = document.querySelector('[data-app="prikaz-detail"]');
if (container) {
    const prikazId = container.dataset.id;
    const userId = container.dataset.user;
    
    const root = createRoot(container);
    root.render(<PrikazDetailApp prikazId={prikazId} userId={userId} />);
}
```

## 📊 Datový tok

### INSYZ Integration (read-only)
```
Frontend → /api/insyz/* → InsyzController → InsyzService → MSSQL/Mock
                                        ↓
                         DataEnricherService → Enhanced Data
```

### Portal Features (read-write)
```
Frontend → /api/portal/* → PortalController → Services → PostgreSQL
```

### File Management
```
Upload → FileUploadService → Hash Deduplication → Disk Storage
                           ↓
                    Database Tracking → Usage Management
```

## 🔧 Technologické standardy

### Frontend
- **React 18** s hooks (ne class komponenty)
- **Material React Table** pro datové tabulky
- **Tailwind CSS** pro styling s BEM metodologií
- **Tabler Icons** pro ikony (SVG sprite)

### Backend
- **Symfony 6.4 LTS** s PHP 8.3
- **Doctrine ORM** pro PostgreSQL
- **Twig 3** pro templating
- **Symfony Security** pro autentifikace

### Styling
- **Tailwind** pro utility třídy
- **BEM** metodologie pro vlastní komponenty
- **CSS custom properties** pro KČT brand barvy
- **Dark mode** povinně pro všechny komponenty

## 🎨 UI architektura

### Komponentová struktura
```
Global Layout (Twig)
├── Navigation (Twig)
├── Main Content (Twig + React mount points)
│   ├── Static content (Twig)
│   └── Interactive apps (React)
└── Footer (Twig)
```

### React Apps typologie
- **Formuláře:** Hlášení příkazů, nastavení
- **Datové tabulky:** Seznam příkazů, reporty
- **File upload:** Správa příloh
- **Interaktivní nástroje:** INSYZ API tester

## 🚀 Performance a Cache architektura

### Cache strategy pro scalabilitu
**Cíl:** Optimalizace pro 50 současných uživatelů s inteligentním cachováním INSYZ dat.

#### Cache layers:
```
React App → Symfony API → Cache Service → INSYZ/MSSQL
                          ↓
                       Redis/Filesystem
```

#### TTL strategie:
- **User data**: 30 min (dlouhodobě stabilní)
- **Příkazy seznam**: 5 min (časté čtení při navigaci)
- **Příkaz detail**: 2 min (detailní data)
- **Sazby**: 1 hod (řídce se mění)

#### Cache invalidation:
- **Automatická**: TTL expiration
- **Manuální**: User data změny → `ApiCacheService->invalidateUserCache()`
- **Selektivní**: Konkrétní příkaz → `invalidatePrikazCache()`

#### Environment-specific adapters:
- **Production**: Redis cache pools (`redis://localhost:6379`)
- **Development**: Filesystem cache (rychlejší debug)
- **Testing**: Array cache (in-memory pro testy)

### API Monitoring architektura

#### Comprehensive logging:
```
Request → Controller → MonitoringService → Multiple logs
                              ↓
                    ┌─────────────────┬─────────────────┐
                    ▼                 ▼                 ▼
              Performance         Cache          Security
              (response time)   (hit/miss)    (suspicious activity)
```

#### Monitored metrics:
- **Response times** s upozorněním na >2s requesty
- **MSSQL query timing** s detekcí >5s queries  
- **Cache hit/miss ratios** pro optimalizaci
- **API usage patterns** pro detekci abuse
- **Error rates** a exception tracking

#### Logging destinations:
- **Development**: `/var/log/api.log` (human readable)
- **Production**: JSON format pro external monitoring
- **Audit trail**: Tracked requests v audit_logs tabulce

#### Performance thresholds:
- **Normal**: <500ms response
- **Warning**: 500ms-2s response
- **Alert**: >2s response (slow query investigation)

### Scalability considerations:
- **Session storage**: File-based (dostačující pro 50 users)
- **Connection pooling**: MSSQL connection reuse
- **Resource limits**: Cache memory management
- **Monitoring alerts**: Performance degradation detection

---

**Related Documentation:**  
**Features:** [features/](features/)  
**Cache details:** [features/insyz-integration.md](features/insyz-integration.md)  
**Development:** [development/getting-started.md](development/getting-started.md)  
**Aktualizováno:** 2025-08-08