# 🔍 KOMPLETNÍ TECHNICKÝ AUDIT - Portal Značkaře
*Datum: 2025-08-06*

> **Stav nálezů k 2026-09-27** – tento dokument je historický (08/2025) a níže se nemění.
> Ověřeno v kódu:
>
> **Vyřešeno**
> - Chybí CSRF pro API → `ApiCsrfListener` (hlavička `X-CSRF-Token` u `/api/*`)
> - No rate limiting → částečně: throttling přihlášení podle e-mailu a IP (`InsyzAuthenticator`); rate limiting ostatních API (upload) zůstává otevřený
> - No request timeouts → MSSQL `LoginTimeout=30` + `LOCK_TIMEOUT 30000` (`MssqlConnector`), PostgreSQL `statement_timeout 30s` při ukládání hlášení (`PortalController`)
> - Mantine UI duplicita → Mantine v `package.json` už není
> - Chybí monitoring → částečně: audit log (`AuditLog`), INSYZ log + `/admin/insyz-monitoring`; Prometheus/Grafana nejsou
> - Security headers → `SecurityHeadersListener` (už uvedeno v původní zprávě)
>
> **Stále otevřené**
> - SSH deployment jako root (`SSH_USER: root` v `.github/workflows/deploy.yml`)
> - `chmod -R 777 var/cache var/log public/build` v deployi
> - Deployment failures nejsou detekovány – chyby migrací se maskují (`|| echo`), neúspěšný health check jen vypíše varování a deploy pokračuje
> - Material UI pouze pro tabulky – zůstává jako závislost `material-react-table`; pravidla projektu to výslovně povolují, nepovažuje se za chybu
> - `nelmio/cors-bundle` zůstává – konfigurace je jen v `config/packages/nelmio_cors.yaml` (whitelist `CORS_ALLOW_ORIGIN`, bez credentials); duplicitní `cors.yaml` s `allow_origin: *` byl odstraněn
>
> Nálezy k výkonu (bundle size, code splitting), úniku informací v chybových hláškách, zálohám DB a infrastruktuře (Redis, Docker, blue-green) nebyly znovu ověřovány.
> Aktuální otevřené úkoly: [TODO.md](../TODO.md).

## 📋 OBSAH
1. [Executive Summary](#executive-summary)
2. [Architektura a Struktura](#architektura-a-struktura)
3. [Technologický Stack](#technologický-stack)
4. [Závislosti a Knihovny](#závislosti-a-knihovny)
5. [Performance Analýza](#performance-analýza)
6. [Bezpečnostní Audit](#bezpečnostní-audit)
7. [Stabilita a Robustnost](#stabilita-a-robustnost)
8. [Doporučení a Priority](#doporučení-a-priority)

---

## 🎯 EXECUTIVE SUMMARY

### Celkové hodnocení
- **Architektura:** 8/10 ✅ - Clean hybrid Twig+React pattern
- **Lightweight:** 6/10 ⚠️ - Některé závislosti jsou zbytečné
- **Stabilita:** 7.5/10 ✅ - Solidní základ, několik rizik
- **Bezpečnost:** 7/10 ✅ - Dobré základy, potřebuje vylepšení

### Klíčové nálezy
- ✅ **Správná volba:** Hybrid architektura místo full SPA
- ⚠️ **Overengineered:** Material UI pouze pro tabulky
- 🔴 **Zbytečné:** Duplicitní závislosti, velké bundle sizes
- ✅ **Best practice:** Separation of concerns, Czech naming

---

## 🏗️ ARCHITEKTURA A STRUKTURA

### Hybrid Pattern Analysis
```
Twig Templates (SSR) → React Micro-apps (CSR) → Symfony API
                    ↘ Tailwind CSS + BEM     ↘ PostgreSQL + Messenger
```

**✅ SPRÁVNÉ ROZHODNUTÍ:** Hybrid pattern je ideální pro tento typ aplikace
- Server-side rendering pro SEO a rychlé načítání
- React pouze kde je potřeba interaktivita
- Žádný zbytečný JavaScript pro statický obsah

### Struktura souborů
```
src/
├── Controller/      ✅ Clean separation (API vs Web)
├── Service/         ✅ Business logic oddělená
├── Entity/          ✅ Lightweight entities (pouze 3)
├── Repository/      ✅ Minimální, využívá Doctrine
└── Message/         ✅ Async processing pro těžké operace

assets/js/apps/      ✅ Micro-apps pattern
├── hlaseni-prikazu/ ⚠️ Největší app (442KB) - možná rozdělit
├── prikaz-detail/   🔴 1.2MB bundle! Overloaded
└── prikazy/         ✅ Clean implementation
```

### Architektonické problémy
1. **prikaz-detail bundle (1.2MB)** - příliš velký
2. **Material UI duplicity** - každý bundle obsahuje celé MUI
3. **Chybí lazy loading** pro těžké komponenty

---

## 💻 TECHNOLOGICKÝ STACK

### Backend Stack
| Technologie | Verze | Hodnocení | Poznámka |
|------------|-------|-----------|----------|
| PHP | 8.3 | ✅ Výborné | Latest stable |
| Symfony | 6.4 LTS | ✅ Výborné | Long-term support |
| PostgreSQL | 16 | ✅ Výborné | Moderní, JSONB support |
| Doctrine ORM | 3.2 | ✅ Dobré | Standard pro Symfony |

### Frontend Stack
| Technologie | Verze | Hodnocení | Poznámka |
|------------|-------|-----------|----------|
| React | 18.3.1 | ✅ Dobré | Stabilní, ne nejnovější |
| TypeScript | 5.6.3 | ✅ Výborné | Type safety |
| Webpack | via Encore | ✅ Dobré | Symfony standard |
| Tailwind CSS | 3.4.17 | ⚠️ Starší | v4 je dostupná |

### Problematické volby
1. **Material UI pouze pro tabulky** - 300KB+ jen pro jednu komponentu
2. **Mantine UI** - další UI knihovna, duplicita s MUI
3. **Multiple date libraries** - date-fns + native Date

---

## 📦 ZÁVISLOSTI A KNIHOVNY

### Analýza package.json

#### 🔴 ZBYTEČNÉ/DUPLICITNÍ
```json
{
  "@mui/material": "^6.3.0",      // Pouze pro tabulky - overkill
  "@mantine/core": "^7.17.8",      // Duplicita s MUI
  "@mantine/dates": "^7.17.8",     // Zbytečné, date-fns stačí
  "@mantine/hooks": "^7.17.8",     // Většina hooks nevyužita
  "material-react-table": "^3.2.0" // Těžká dependency
}
```

#### ✅ SPRÁVNĚ ZVOLENÉ
```json
{
  "@tabler/icons-react": "^2.47.0",  // Lightweight ikony
  "react-hot-toast": "^2.4.1",       // Minimální toast library
  "date-fns": "^4.1.0",              // Tree-shakeable
  "react-hook-form": "^7.54.2"       // Efektivní forms
}
```

### Composer Dependencies

#### ✅ MINIMÁLNÍ A SPRÁVNÉ
- Symfony bundles pouze necessary
- Žádné zbytečné dev dependencies v produkci
- Doctrine bundles optimální

#### ⚠️ POTENCIÁLNÍ PROBLÉMY
```json
"nelmio/cors-bundle": "^2.5"  // Možná zbytečné pro internal API
```

### Bundle Size Analysis
```
AKTUÁLNÍ STAV:
- app-prikaz-detail.js: 1.2MB
- app-prikazy.js: 1MB
- app-hlaseni-prikazu.js: 442KB

Pozn: Pro interní systém akceptovatelné - priorita je jednoduchost nad optimalizací
```

---

## ⚡ PERFORMANCE ANALÝZA

### Frontend Performance

#### Problémy
1. **No code splitting** - všechno v jednom bundle
2. **No lazy loading** - všechny komponenty načteny najednou  
3. **Material UI není tree-shaken** - celá knihovna v bundlu
4. **Chybí CDN** pro statické assety
5. **No Service Worker** - žádné offline capabilities

#### Doporučení
```javascript
// Implementovat code splitting
const PrikazDetail = lazy(() => import('./PrikazDetail'));

// Odstranit Material UI, použít lightweight alternativu
// Např. TanStack Table (20KB vs 300KB)
```

### Backend Performance

#### ✅ Dobré praktiky
- Async message processing (Symfony Messenger)
- Database indexy na klíčových sloupcích
- JSON columns pro flexibilní data
- Prepared statements všude

#### ⚠️ Potenciální bottlenecky
- Žádné query caching
- Chybí Redis/Memcached
- No connection pooling pro MSSQL

---

## 🔒 BEZPEČNOSTNÍ AUDIT

### ✅ Silné stránky
- Žádné hardcoded credentials
- SQL injection protection (prepared statements)
- XSS ochrana (htmlspecialchars)
- CSRF tokens pro formuláře
- Secure file uploads

### 🔴 Kritické problémy
1. **SSH deployment jako root**
2. **Chybí CSRF pro API endpointy**
3. **chmod 777 na var/ adresáře**

### ⚠️ Development-only rizika (nízká priorita)
- **webpack-dev-server vulnerability** - týká se pouze vývoje, nulový risk v produkci

### ⚠️ Střední rizika
- No rate limiting
- Error messages leak information
- No API versioning

---

## 🛡️ STABILITA A ROBUSTNOST

### Systémová stabilita

#### ✅ Dobré
- Systemd service pro messenger worker
- Auto-restart při failures
- Health checks v deployment
- Error boundaries v React

#### 🔴 Problémy
1. **No graceful degradation** - při výpadku API aplikace padá
2. **Missing circuit breakers** - opakované pokusy při failures
3. **No request timeouts** - může viset na pomalých requests
4. **Chybí monitoring** - nevidíme problémy v reálném čase

### Database stabilita
- ✅ PostgreSQL 16 je rock-solid
- ✅ Transactions používány správně
- ✅ Connection pooling není potřeba pro interní systém
- TODO: Automated backups (nízká priorita)

### Deployment stabilita
- ⚠️ No rollback mechanism
- ⚠️ No blue-green deployment
- 🔴 Deployment failures nejsou detekovány
- ✅ Basic health checks

---

## 📊 LIGHTWEIGHT ANALÝZA

### Co je zbytečné/overengineered

1. **Material UI pro jednu tabulku**
   - Náhrada: TanStack Table (20KB vs 300KB)
   
2. **Mantine UI duplicita**
   - Odstranit, použít Tailwind komponenty

3. **Multiple date libraries**
   - Sjednotit na date-fns

4. **Webpack polyfills**
   - Moderní browsery je nepotřebují

### Optimalizace bundle size
```bash
# Current
Total JS: 3MB

# Target
Total JS: < 500KB

# Jak toho dosáhnout:
1. Remove Material UI (-300KB)
2. Remove Mantine (-200KB)
3. Code splitting (-50%)
4. Tree shaking (-30%)
```

---

## 🎯 DOPORUČENÍ A PRIORITY

### ✅ DOKONČENÉ
1. **Security headers implementace** ✅
   - Implementován SecurityHeadersListener
   - CSP, HSTS, X-Frame-Options aktivní
   - Automatická ochrana všech stránek

2. **Security vulnerabilities cleanup** ✅
   - Odstraněna jsPDF knihovna (HIGH vulnerability)
   - Odstraněna html2canvas knihovna (nepoužívaná)
   - Vyčištěna backup složka hlaseni-prikazu_backup
   - Snížen počet vulnerabilities z 4 na 3

### 🚨 KRITICKÉ (Ihned)
1. **SSH security**
   - Non-root deployment user
   - Změnit SSH port

### ⚠️ VYSOKÉ (2 týdny)
1. **Database backup strategie**
2. **API rate limiting**
3. **Error handling improvements**
4. **Monitoring setup (Prometheus/Grafana)**

### 💡 STŘEDNÍ (1-3 měsíce)
1. **Replace Material UI s TanStack Table**
2. **Implement Redis caching**
3. **Add circuit breakers**

### 🎯 DLOUHODOBÉ (3-6 měsíců)
1. **Migrate to Docker**
2. **Implement blue-green deployment**
3. **Add API versioning**
4. **Performance monitoring**

---

## 📈 METRIKY ÚSPĚCHU

### Target metrics
- **Security score:** > 95%
- **Time to Interactive:** < 3s (aktuálně dostačující)
- **Test coverage:** > 80%
- **Zero security vulnerabilities**

### Monitoring KPIs
- Response time < 200ms (API)
- Error rate < 0.1%
- Uptime > 99.9%
- Successful deployments > 95%

---

## 🏁 ZÁVĚR

Portal Značkaře má **solidní architekturu** s několika oblastmi pro zlepšení. Hlavní problémy jsou:

1. **Overengineered frontend** - zbytečně těžké UI knihovny
2. **Chybějící optimalizace** - no code splitting, lazy loading
3. **Bezpečnostní mezery** - zejména v deployment pipeline

**Doporučení:** Prioritizovat odstranění zbytečných závislostí a optimalizaci bundle sizes. Systém je stabilní, ale může být výrazně lightweight a rychlejší.

**Časová náročnost refaktoringu:** 2-4 týdny pro kritické změny, 2-3 měsíce pro kompletní optimalizaci.