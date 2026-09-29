# Dokumentace - Portál značkaře

Kompletní dokumentace webové aplikace pro správu turistického značení KČT.

## 📋 Obsah dokumentace

### 🚀 Začínáme
- [Instalace a setup](development/getting-started.md)
- [Architektura aplikace](architecture.md)
- [Konfigurace](configuration.md)

### ⭐ Funkcionalita
- [INSYZ integrace](features/insyz-integration.md) - Napojení na KČT databázi
- [Autentifikace](features/authentication.md) - Přihlašování a zabezpečení
- [Správa uživatelů](features/user-management.md) - Lokální uživatelé, synchronizace a admin stránky
- [Audit logging](features/audit-logging.md) - Dvojitý audit systém (aplikace + INSYZ API)
- [Správa příkazů](features/prikazy-management.md) - Zobrazení a správa příkazů
- [Hlášení příkazů](features/hlaseni-prikazu.md) - Workflow hlášení práce
  - sekce [Hlášení ZP-I](features/hlaseni-prikazu.md#-hlášení-zp-i-instalace-předmětů) - instalace předmětů: TIMy, servis, náhrady dle počtu TIMů
- [Admin výpis hlášení](features/admin-vypis-hlaseni.md) - Tabulka podaných hlášení v administraci
- [Náhled hlášení přes INSYZ hash](features/insyz-hash-nahled-hlaseni.md) - Read-only náhled pro správce INSYZ
- [Správa souborů](features/file-management.md) - Upload a správa příloh
- [Admin Media Library](features/admin-media-library.md) - WordPress-style správa médií
- [Lokalizace](features/localization.md) - České skloňování
- [Content Management](features/content-management.md) - CMS funkcionalita

### 🔌 API Reference
- [API portálu](api.md) - Přehled všech endpointů (INSYZ, hlášení, soubory, admin, CMS, desktopový klient INSYZ)
- [INSYZ stored procedures](features/insyz-integration.md#insyz-stored-procedures) - Procedury, které portál volá

### 🛠️ Development
- [Development guide](development/development.md) - Debug nástroje a workflow
- [Console Commands](development/commands.md) - Přehled všech konzolových příkazů
- [Background Jobs](development/background-jobs.md) - Symfony Messenger a asynchronní procesy
- [Toast Notification System](development/toast-system.md) - Jednotný systém notifikací
- [Global State Badges](development/global-state-badges.md) - Jednotné badge stavů
- [INSYZ API Tester](development/insyz-api-tester.md) - Testing nástroj
- [Vizuální komponenty](development/visual-components.md) - Značky a TIM pro vývojáře

### 🚀 Deployment & Migrace
- [Deployment](deployment.md) - Nasazení aplikace
- [Production logging](deployment/production-logging.md) - Logování v produkci
- [Migrace](migration.md) - WordPress migrace a React refactoring

---

## 🔗 Rychlé odkazy

### Pro nové vývojáře
1. [Setup prostředí](development/getting-started.md)
2. [Architektura](architecture.md)
3. [INSYZ integrace](features/insyz-integration.md)

### Pro existující tým
- [API dokumentace](api.md)
- [File management](features/file-management.md)
- [Debug nástroje](development/development.md)

### Pro deployment
- [Konfigurace](configuration.md)
- [Deployment guide](deployment.md)

---

## 📖 Struktura projektu

**Hybridní architektura:** Symfony backend + Twig templating + React micro-apps  
**Databáze:** PostgreSQL (app data) + MSSQL (INSYZ data)  
**Frontend:** Tailwind CSS + BEM + Material React Table  
**Development:** DDEV + mock INSYZ data (`USE_TEST_DATA=true`, `var/mock-data/`)

---

**Aktualizováno:** 2026-09-27
**Verze dokumentace:** 2.4
**Pro projekt:** Portál značkaře