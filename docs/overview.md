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
- [Správa uživatelů](features/user-management.md) - Lokální uživatelé a synchronizace + **NOVÉ: Admin rozhraní**
- [Audit logging](features/audit-logging.md) - Dvojitý audit systém (aplikace + INSYZ API)
- [Správa příkazů](features/prikazy-management.md) - Zobrazení a správa příkazů
- [Hlášení příkazů](features/hlaseni-prikazu.md) - Workflow hlášení práce
- [Správa souborů](features/file-management.md) - Upload a správa příloh
- [Admin Media Library](features/admin-media-library.md) - WordPress-style správa médií
- [Lokalizace](features/localization.md) - České skloňování
- [Content Management](features/content-management.md) - CMS funkcionalita

### 🔌 API Reference
- [INSYZ API](api/insyz-api.md) - Endpointy pro KČT data
- [INSYZ Stored Procedures](api/insyz-stored-procedures.md) - Reference všech INSYZ SP
- [Portal API](api/portal-api.md) - Lokální funkcionalita
- [Admin API](api/admin-api.md) - Administrační endpointy
- [CMS API](api/cms-api.md) - CMS správa stránek

### 🛠️ Development
- [Development guide](development/development.md) - Debug nástroje a workflow
- [Console Commands](development/commands.md) - Přehled všech konzolových příkazů
- [Background Jobs](development/background-jobs.md) - Symfony Messenger a asynchronní procesy
- [Toast Notification System](development/toast-system.md) - Jednotný systém notifikací
- [INSYZ API Tester](development/insyz-api-tester.md) - Testing nástroj
- [Vizuální komponenty](development/visual-components.md) - Značky a TIM pro vývojáře

### 🚀 Deployment & Migrace
- [Deployment](deployment.md) - Nasazení aplikace
- [Migrace](migration.md) - WordPress migrace a React refactoring

---

## 🔗 Rychlé odkazy

### Pro nové vývojáře
1. [Setup prostředí](development/getting-started.md)
2. [Architektura](architecture.md)
3. [INSYZ integrace](features/insyz-integration.md)

### Pro existující tým
- [API dokumentace](api/insyz-api.md)
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
**Development:** DDEV + Mock INSYZ data

---

**Aktualizováno:** 2025-11-11
**Verze dokumentace:** 2.4
**Pro projekt:** Portál značkaře