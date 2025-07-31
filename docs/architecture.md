# Architektura aplikace

> **Architektonická dokumentace** - Základní principy, hybrid architektura a datový tok v Portálu značkaře

## 🏗️ Základní principy

### 1. **Hybrid architektura**
- **Symfony 6.4 LTS** jako backend framework
- **Twig templating** pro server-side rendering a layouty  
- **React 18 micro-apps** pouze pro komplexní interaktivní komponenty
- **PostgreSQL** pro aplikační data + **MSSQL** pro INSYS integraci

### 2. **Micro-frontend přístup**
- React aplikace jako samostatné micro-apps místo monolitické SPA
- Každá React app má vlastní webpack entry point
- Twig šablony definují mount pointy pro React aplikace

### 3. **Data separation**
- **INSYS data** (MSSQL) - příkazy, uživatelé, ceníky (read-only)
- **Portal data** (PostgreSQL) - hlášení, soubory, CMS obsah (read-write)

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

### INSYS Integration (read-only)
```
Frontend → /api/insys/* → InsysController → InsysService → MSSQL/Mock
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
- **Interaktivní nástroje:** INSYS API tester

---

**Related Documentation:**  
**Features:** [features/](features/)  
**Development:** [development/getting-started.md](development/getting-started.md)  
**Aktualizováno:** 2025-07-31