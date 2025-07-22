# AI Documentation Rules

## Core Principles
1. **No README.md inside folders** - Use specific names (overview.md, installation.md, etc.)
2. **One purpose = one file** - Each document has single, clear purpose
3. **Functional organization** - Group by features, not by code structure
4. **Cross-linking mandatory** - Always link related documents

## File Structure Rules
```
✅ CORRECT:
docs/
├── overview.md              # Main index
├── features/               # MAIN - functional areas
│   ├── feature-name.md     # Complete feature documentation
│   └── another-feature.md
├── api/
│   ├── overview.md         # API index
│   └── endpoint-name.md    # Specific endpoint
└── configuration/
    └── services.md         # Specific config topic

❌ WRONG:
docs/
├── README.md               # Generic name
├── backend/README.md       # Generic nested
└── stuff.md                # Unclear purpose
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
□ Update frontend/architecture.md overview
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

## Red Flags for AI
- New code functionality without corresponding docs/features/ update
- API changes without docs/api/ documentation
- New services without configuration/services.md entry
- Broken cross-links between documents
- Code examples that don't match current implementation

## AI Decision Rules

### When User Asks for New Feature
1. **First**: Create docs/features/new-feature.md with planned structure
2. **Then**: Implement code following the documented plan
3. **Finally**: Update documentation with actual implementation details

### When User Reports Bug/Issue
1. Check if existing docs/features/ document needs troubleshooting update
2. If fix changes API, update docs/api/ documentation
3. If fix changes configuration, update configuration/ docs

### When Refactoring Code
1. Identify all affected documentation files
2. Update before making code changes
3. Verify all cross-links still work after changes

## Link Management
- Internal links use relative paths: `[text](../category/file.md)`
- Always check links work locally before committing
- GitHub Wiki sync converts these automatically

---
**This file optimized for AI workflow automation.**
**Updated:** 2025-07-22