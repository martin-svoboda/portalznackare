# AI Documentation Rules

## Core Principles
1. **Minimalismus** - Programová dokumentace je jen pro zorientování v kódu (co kde je, jak to spolu souvisí). Podrobnosti patří do komentářů v kódu, ne do docs.
2. **Jediný zdroj pravdy** - Žádné duplicity, vše na jednom místě
3. **Funkční organizace** - Group by features, not by code structure  
4. **Cross-linking mandatory** - Always link related documents
5. **Nový soubor jen když informaci nejde zařadit do existujícího** – jinak doplnit sekci do existujícího souboru
6. **API = jeden přehled** – endpointy se nepopisují po jednom souboru; stačí výpis endpointů se základními informacemi a tabulkou parametrů

## Současná struktura dokumentace
```
✅ AKTUÁLNÍ STAV (2026-09-29, ověřeno přes ls):
docs/
├── CLAUDE.md                # Pravidla pro AI (tento soubor)
├── AUDIT-REPORT-2025.md     # Audit dokumentace 2025
├── overview.md              # Hlavní index + navigace
├── architecture.md          # Architektura (frontend + backend)
├── configuration.md         # Konfigurace - JEDINÝ ZDROJ ENV
├── deployment.md            # Deployment proces
├── migration.md             # WordPress migrace + React refactoring
├── deployment/             # (1 soubor)
│   └── production-logging.md
├── features/               # Funkční oblasti (12 souborů)
│   ├── admin-media-library.md
│   ├── admin-vypis-hlaseni.md
│   ├── audit-logging.md
│   ├── authentication.md
│   ├── content-management.md
│   ├── file-management.md
│   ├── hlaseni-prikazu.md
│   ├── insyz-hash-nahled-hlaseni.md
│   ├── insyz-integration.md
│   ├── localization.md
│   ├── prikazy-management.md
│   └── user-management.md
├── api.md                   # Přehled všech API endpointů (jediný soubor)
├── development/            # Developer docs (8 souborů)
│   ├── background-jobs.md
│   ├── commands.md
│   ├── development.md      # Debug systém + workflow
│   ├── getting-started.md  # Instalace
│   ├── global-state-badges.md
│   ├── insyz-api-tester.md
│   ├── toast-system.md
│   └── visual-components.md
└── superpowers/            # Návrhy a plány (specs/ 3 soubory, plans/ 4 soubory)

CELKEM: 29 .md souborů mimo superpowers/ (+ 7 v superpowers/)
```

## Document Template (Mandatory Structure)
```markdown
# Document Title

> **Purpose description** - What this document contains and target audience

## Content Overview
- Clear bullet points of what reader will learn
- Links to related documents

## Main Content
### Detailed sections with examples
### Practical code samples
### Troubleshooting if relevant

---

**Related documentation:** [link](link.md)  
**Main overview:** [../overview.md](../overview.md)  
**Updated:** YYYY-MM-DD
```

## Documentation Update Workflow

### New Feature Added to Codebase
```
✅ MANDATORY CHECKLIST:
□ Doplnit stručně existující docs/features/ dokument (nový soubor jen když nejde zařadit jinam)
□ Nový endpoint = řádek v přehledu endpointů v docs/api.md (metoda, cesta, oprávnění, parametry)
□ Update docs/overview.md with cross-link
□ Update related documents with cross-references
□ Test all new links work
□ Update date: "Aktualizováno: YYYY-MM-DD"
```

### Existing Feature Modified
```
✅ MANDATORY CHECKLIST:
□ Update all code examples in documentation
□ Check API documentation (parameters, responses)
□ Update workflow diagrams if changed
□ Check cross-links between documents
□ Update troubleshooting sections
□ Update modification date
```

### New React App/Component
```
✅ MANDATORY CHECKLIST:
□ Add to docs/features/ as part of relevant functionality  
□ Update architecture.md (consolidated frontend/backend info)
□ Document props and usage patterns
□ Add webpack entry to documentation
□ Show Twig integration examples
```

## Documentation Quality Checks

### Before Committing Code
```bash
# Always run these checks:
grep -r "TODO" docs/                    # Unfinished documents
grep -r "YYYY-MM-DD" docs/              # Non-updated dates
find docs/ -name "*.md" -mtime -1       # Recently changed docs
```

### Monthly Maintenance
- [ ] Test all internal links (`grep -r "\]\(" docs/`)
- [ ] Verify code examples match current API
- [ ] Check document structure is still logical
- [ ] Confirm GitHub Wiki sync works
- [ ] Verify all documents have current dates

## Red Flags for AI (AKTUALIZOVÁNY PRO NOVOU STRUKTURU)
- New code functionality without corresponding docs/features/ update
- API changes without docs/api.md update  
- New services without updating configuration.md (konsolidovaný soubor)
- Environment variables added without updating configuration.md (JEDINÝ ZDROJ)
- Broken cross-links between documents
- Code examples that don't match current implementation
- **KRITICKÉ:** Pokus o vytvoření nových .md souborů místo rozšíření existujících
- **KRITICKÉ:** Duplicity konfigurace napříč soubory

## AI Decision Rules

### When User Asks for New Feature
1. Implementovat, podrobnosti popsat komentáři v kódu
2. Stručně doplnit orientační info do existujícího docs/features/ dokumentu (nový soubor jen když nejde zařadit jinam)
3. Nové endpointy doplnit do přehledu v docs/api.md

### When User Reports Bug/Issue
1. Check if existing docs/features/ document needs troubleshooting update
2. If fix changes API, update docs/api.md
3. If fix changes configuration, update configuration.md (konsolidovaný soubor)

### When Refactoring Code
1. Identify all affected documentation files
2. Update after the code change (stručně, jen orientační info)
3. Verify all cross-links still work after changes

## Link Management
- Internal links use relative paths: `[text](../category/file.md)`
- Always check links work locally before committing
- GitHub Wiki sync converts these automatically

## Pravidla minimalizace (NOVÁ PRAVIDLA 2025-07-31)

### Priorita konsolidace
1. **Rozšiř existující** - nový soubor jen když informaci nejde zařadit do existujícího
2. **Žádné duplicity** - configuration.md je JEDINÝ zdroj pro ENV proměnné
3. **Stručnost** - žádné podrobné rozpisy a kopie kódu; detaily jsou v komentářích v kódu
4. **Chybí soubor?** - Raději přidej sekci do existujícího než vytvoř nový

### Workflow pro úpravy dokumentace
```bash
# PŘED přidáním nového obsahu:
1. Zkontroluj, zda patří do existujícího souboru
2. Rozšiř existující místo vytváření nového
3. Aktualizuj cross-odkazy
4. Zkontroluj jedinečnost informací
```

### Zkušenosti z reorganizace (2025-07-31)
- **ÚSPĚCH:** Redukce z 20+ na 11 souborů bez ztráty informací
- **ÚSPĚCH:** Eliminace 120+ řádků duplicitních ENV proměnných  
- **ÚSPĚCH:** configuration.md jako jediný zdroj pravdy
- **LESSON:** Uživatel preferuje 1 velký soubor před fragmentací

---
**This file optimized for AI workflow automation.**
**Updated:** 2026-09-29 - API sloučeno do docs/api.md