# Portál značkaře

> Moderní webová aplikace pro správu turistického značení vyvinutá pro značkaře Klubu českých turistů (KČT).

## 🎯 O aplikaci

Portál značkaře je nástroj pro značkaře KČT, který umožňuje:
- **Správu příkazů** - zobrazení, zpracování a hlášení značkařských příkazů
- **Evidence práce** - zaznamenávání výkonů a nákladů v terénu  
- **Metodiky a dokumentace** - přístup k aktuálním postupům a předpisům
- **Komunikace se systémem INSYS** - propojení s centrální databází KČT

## 🚀 Rychlý start

```bash
# 1. Klon repository a setup
git clone <repository-url>
cd portalznackare

# 2. DDEV prostředí  
ddev start
ddev composer install
ddev npm install

# 3. Databáze a assets
ddev exec bin/console doctrine:database:create --if-not-exists
ddev exec bin/console doctrine:migrations:migrate -n
ddev npm run build

# 4. Přístup k aplikaci
open https://portalznackare.ddev.site
```

**Výchozí přihlášení:** `admin@portal.local` / `admin123`

## 🏗️ Technologie

- **Backend:** Symfony 6.4 LTS, PHP 8.2, PostgreSQL
- **Frontend:** React 18, TypeScript, Tailwind CSS, Mantine UI
- **Development:** DDEV, Webpack Encore
- **Integrace:** MSSQL (INSYS databáze KČT)

## 📚 Dokumentace

**👨‍💻 Pro vývojáře:**
- [📖 Kompletní dokumentace](docs/) - Architektura, API, development
- [🚀 Instalace a setup](docs/getting-started/installation.md)
- [🏗️ Architektura systému](docs/architecture/)
- [🎨 Frontend development](docs/frontend/)
- [⚙️ Backend development](docs/backend/)

**🔌 API Reference:**
- [INSYS API](docs/api/insyz.md) - Integrace s databází KČT
- [Portal API](docs/api/portal.md) - Lokální funkcionalita

**📋 Pracovní dokumenty:**
- [TODO.md](TODO.md) - Plánované funkce a roadmap
- [Claude.md](Claude.md) - AI kontext pro development

## 🤝 Přispívání

1. Fork repository
2. Vytvoř feature branch (`git checkout -b feature/nova-funkcionalita`)
3. Commit změny (`git commit -m 'feat: přidána nová funkcionalita'`)
4. Push branch (`git push origin feature/nova-funkcionalita`)  
5. Otevři Pull Request

**Standards:** PSR-12, TypeScript strict, [Conventional Commits](https://www.conventionalcommits.org/)

## 📞 Podpora

- **Issues:** [GitHub Issues](../../issues) - bug reporty a feature requests
- **Wiki:** [Dokumentace](../../wiki) - automaticky synchronizovaná dokumentace
- **Kontakt:** Technická podpora KČT

## 📄 Licence

Tento projekt je licencován pod [MIT licencí](LICENSE).

---

**Vytvořeno s ❤️ pro dobrovolníky Klubu českých turistů**
