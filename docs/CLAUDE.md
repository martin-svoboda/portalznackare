# AI Documentation Rules

## Core Principles
1. **Minimalizace a konsolidace** - Preferuj 1 velký soubor před 5 malými soubory
2. **Jediný zdroj pravdy** - Žádné duplicity, vše na jednom místě
3. **Funkční organizace** - Group by features, not by code structure  
4. **Cross-linking mandatory** - Always link related documents
5. **NIKDY nevytvářej nové soubory** pokud není absolutně nutné

## Současná konsolidovaná struktura (PO REORGANIZACI)
```
✅ AKTUÁLNÍ STAV (2025-07-31):
docs/
├── overview.md              # Hlavní index + navigace
├── architecture.md          # Konsolidace 4 souborů (1322→150 řádků)
├── configuration.md         # Konsolidace 5 souborů (1519→200 řádků) - JEDINÝ ZDROJ ENV
├── deployment.md            # Deployment proces
├── migration.md             # WordPress migrace + React refactoring (800 řádků)
├── features/               # Funkční oblasti (7 souborů)
│   ├── authentication.md
│   ├── content-management.md
│   ├── file-management.md
│   ├── hlaseni-prikazu.md  
│   ├── insys-integration.md
│   ├── localization.md
│   └── prikazy-management.md
├── api/                    # API dokumentace (2 soubory)
│   ├── insys-api.md
│   └── portal-api.md
└── development/            # Developer docs (4 soubory)
    ├── development.md      # Debug systém + workflow
    ├── getting-started.md  # Instalace
    ├── insys-api-tester.md
    └── visual-components.md

CELKEM: 11 souborů (bylo 20+)
REDUKCE: 45% méně souborů, 60% méně složek
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
□ Create/update docs/features/feature-name.md
□ Add API docs in docs/api/ if relevant
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
- API changes without docs/api/ documentation  
- New services without updating configuration.md (konsolidovaný soubor)
- Environment variables added without updating configuration.md (JEDINÝ ZDROJ)
- Broken cross-links between documents
- Code examples that don't match current implementation
- **KRITICKÉ:** Pokus o vytvoření nových .md souborů místo rozšíření existujících
- **KRITICKÉ:** Duplicity konfigurace napříč soubory

## AI Decision Rules

### When User Asks for New Feature
1. **First**: Create docs/features/new-feature.md with planned structure
2. **Then**: Implement code following the documented plan
3. **Finally**: Update documentation with actual implementation details

### When User Reports Bug/Issue
1. Check if existing docs/features/ document needs troubleshooting update
2. If fix changes API, update docs/api/ documentation
3. If fix changes configuration, update configuration.md (konsolidovaný soubor)

### When Refactoring Code
1. Identify all affected documentation files
2. Update before making code changes
3. Verify all cross-links still work after changes

## Link Management
- Internal links use relative paths: `[text](../category/file.md)`
- Always check links work locally before committing
- GitHub Wiki sync converts these automatically

## Pravidla minimalizace (NOVÁ PRAVIDLA 2025-07-31)

### Priorita konsolidace
1. **1 velký soubor > 5 malých** - Vždy preferuj rozšíření existujícího
2. **Žádné duplicity** - configuration.md je JEDINÝ zdroj pro ENV proměnné
3. **Žádné nové soubory** - Pouze pokud uživatel explicitně požádá
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
**Updated:** 2025-07-31 - Major reorganization completed