# Dokumentace - Portál značkaře

Kompletní dokumentace webové aplikace pro správu turistického značení KČT.

## 📋 Obsah dokumentace

### 🚀 Začínáme
- [Instalace a setup](development/getting-started.md)
- [Architektura aplikace](architecture.md)
- [Konfigurace](configuration.md)

### ⭐ Funkcionalita
- [INSYS integrace](features/insys-integration.md) - Napojení na KČT databázi
- [Autentifikace](features/authentication.md) - Přihlašování a zabezpečení
- [Správa příkazů](features/prikazy-management.md) - Zobrazení a správa příkazů
- [Hlášení příkazů](features/hlaseni-prikazu.md) - Workflow hlášení práce
- [Správa souborů](features/file-management.md) - Upload a správa příloh
- [Lokalizace](features/localization.md) - České skloňování
- [Content Management](features/content-management.md) - CMS funkcionalita

### 🔌 API Reference
- [INSYS API](api/insys-api.md) - Endpointy pro KČT data
- [Portal API](api/portal-api.md) - Lokální funkcionalita

### 🛠️ Development
- [Development guide](development/development.md) - Debug nástroje a workflow
- [INSYS API Tester](development/insys-api-tester.md) - Testing nástroj
- [Vizuální komponenty](development/visual-components.md) - Značky a TIM pro vývojáře

### 🚀 Deployment & Migrace
- [Deployment](deployment.md) - Nasazení aplikace
- [Migrace](migration.md) - WordPress migrace a React refactoring

---

## 🔗 Rychlé odkazy

### Pro nové vývojáře
1. [Setup prostředí](development/getting-started.md)
2. [Architektura](architecture.md)
3. [INSYS integrace](features/insys-integration.md)

### Pro existující tým
- [API dokumentace](api/insys-api.md)
- [File management](features/file-management.md)
- [Debug nástroje](development/development.md)

### Pro deployment
- [Konfigurace](configuration.md)
- [Deployment guide](deployment.md)

---

## 📖 Struktura projektu

**Hybridní architektura:** Symfony backend + Twig templating + React micro-apps  
**Databáze:** PostgreSQL (app data) + MSSQL (INSYS data)  
**Frontend:** Tailwind CSS + BEM + Material React Table  
**Development:** DDEV + Mock INSYS data

---

**Aktualizováno:** 2025-07-31  
**Verze dokumentace:** 2.0  
**Pro projekt:** Portál značkaře