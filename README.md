# Portál značkaře

Moderní webová aplikace pro správu turistického značení vyvinutá pro značkaře Klubu českých turistů (KČT).

## 🎯 Účel aplikace

Portál značkaře je nástroj pro značkaře KČT, který umožňuje:
- **Správu příkazů** - zobrazení, zpracování a hlášení značkařských příkazů
- **Evidence práce** - zaznamenávání výkonů a nákladů v terénu
- **Metodiky a dokumentace** - přístup k aktuálním postupům a předpisům
- **Komunikace se systémem INSYS** - propojení s centrální databází KČT

## 🏗️ Technická architektura

```
React SPA (TypeScript) → Symfony API → INSYS Database (MSSQL)
                       ↘ PostgreSQL (metodiky, reporty)
```

### Technický stack
- **Backend:** Symfony 6.4 LTS, PHP 8.2
- **Frontend:** React 18, TypeScript, Mantine UI v7
- **Databáze:** PostgreSQL + MSSQL (INSYS)
- **Development:** DDEV, Webpack Encore
- **Styling:** Mantine UI + SCSS

## 🚀 Rychlý start

### Požadavky
- [DDEV](https://ddev.readthedocs.io/en/stable/) v2.0+
- [Docker](https://www.docker.com/)
- Git

### Instalace
```bash
# 1. Klon repository
git clone <repository-url>
cd portalznackare

# 2. Spusť DDEV
ddev start

# 3. Nainstaluj závislosti
ddev composer install
ddev npm install

# 4. Setup databáze
ddev exec bin/console doctrine:database:create --if-not-exists
ddev exec bin/console doctrine:migrations:migrate -n

# 5. Build assets
ddev npm run build

# 6. Přístup k aplikaci
open https://portalznackare.ddev.site
```

### Development
```bash
# Spuštění development prostředí
ddev start

# Webpack watching (live reload)
ddev npm run watch

# Symfony development server (pokud potřebný)
ddev exec bin/console server:start 0.0.0.0:8000
```

## 📁 Struktura projektu

```
portal-znackare/
├── assets/                    # Frontend assets
│   ├── js/                   # React aplikace (TypeScript)
│   │   ├── components/       # React komponenty
│   │   │   ├── auth/        # Autentifikace
│   │   │   ├── prikazy/     # Hlavní funkcionalita - příkazy
│   │   │   ├── metodika/    # Dokumentace
│   │   │   ├── shared/      # Sdílené komponenty
│   │   │   └── user/        # Uživatelský profil
│   │   ├── services/        # API služby
│   │   └── utils/           # Utility funkce
│   ├── css/                 # Styly (SCSS)
│   └── images/              # Obrázky a ikony
├── src/                     # Symfony backend
│   ├── Controller/Api/      # API endpointy
│   ├── Entity/             # Doctrine entity
│   ├── Repository/         # Database repositories
│   └── Service/            # Business logika
├── config/                 # Symfony konfigurace
├── templates/              # Twig šablony
├── migrations/             # Database migrace
└── tests/                  # Testy
```

## 🔌 API Reference

### INSYS API (MSSQL databáze)
```http
POST /api/insys/login         # Přihlášení uživatele
GET  /api/insys/user          # Detail uživatele
GET  /api/insys/prikazy       # Seznam příkazů
GET  /api/insys/prikaz        # Detail příkazu
GET  /api/insys/ceniky        # Aktuální ceníky
```

### Portal API (PostgreSQL)
```http
GET  /api/portal/methodologies  # Metodiky a dokumentace
GET  /api/portal/report          # Uživatelská hlášení
POST /api/portal/report          # Uložení hlášení
```

## 🔧 Development příkazy

### DDEV & Docker
```bash
ddev start              # Spustí development prostředí
ddev stop               # Zastaví prostředí
ddev restart            # Restart prostředí
ddev ssh                # SSH do web containeru
ddev logs -f            # Sledování logů
```

### Symfony
```bash
ddev exec bin/console cache:clear                    # Vyčistí cache
ddev exec bin/console doctrine:migrations:migrate    # Spustí migrace
ddev exec bin/console make:entity EntityName         # Vytvoří novou entitu
ddev exec bin/console debug:router                   # Seznam routes
```

### Frontend
```bash
ddev npm install        # Instalace NPM balíčků
ddev npm run dev        # Development build
ddev npm run watch      # Watch mode s live reload
ddev npm run build      # Production build
```

### Code Quality
```bash
ddev composer cs-fix    # PHP CS Fixer
ddev composer phpstan   # Statická analýza PHP
ddev composer test      # PHPUnit testy
```

## 🗄️ Databáze

### PostgreSQL (nová data)
- **Uživatelé** - lokální uživatelé a autentifikace
- **Metodiky** - dokumentace a postupy
- **Reporty** - uživatelská hlášení a reporty

### MSSQL (INSYS systém)
- **Turistické značení** - značky, trasy, úseky
- **Značkařské příkazy** - zadání a evidence práce
- **Uživatelé KČT** - databáze členů a značkařů
- **Ceníky** - aktuální sazby a tarify

## 🔐 Autentifikace

Aplikace podporuje hybridní autentifikaci:
1. **INSYS přihlášení** - ověření proti MSSQL databázi KČT
2. **Lokální session** - Symfony Security komponenta
3. **Role-based access** - rozdělení oprávnění podle rolí

### Výchozí přihlašovací údaje (development)
```
Email: admin@portal.local
Heslo: admin123
```

## 🎨 Frontend komponenty

### Hlavní oblasti
- **Dashboard** - přehled pro přihlášené uživatele
- **Příkazy** - správa značkařských příkazů
- **Hlášení** - formuláře pro reportování práce
- **Metodiky** - dokumentace a postupy
- **Profil** - uživatelské nastavení

### UI Framework
Aplikace používá [Mantine UI v7](https://mantine.dev/) pro konzistentní design:
- Responsive layout
- Dark/light mode podpora
- Přístupnost (accessibility)
- TypeScript podpora

## 🧪 Testování

### Jednotkové testy
```bash
# PHP testy (PHPUnit)
ddev composer test

# Frontend testy (připraveno pro Jest)
ddev npm test
```

### API testování
```bash
# Test INSYS API
curl https://portalznackare.ddev.site/api/test/insys-user
curl https://portalznackare.ddev.site/api/test/insys-prikazy

# Test s parametry
curl "https://portalznackare.ddev.site/api/insys/prikazy?int_adr=4133&year=2025"
```

## 📦 Deployment

### Production build
```bash
# Assets
ddev npm run build

# Optimalizace Symfony
ddev exec bin/console cache:clear --env=prod
ddev exec bin/console doctrine:migrations:migrate --env=prod -n
```

### Environment variables
```bash
# .env.local (production)
APP_ENV=prod
APP_SECRET=your-production-secret-here
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
MSSQL_DATABASE_URL="sqlsrv://user:pass@host:1433/INSYS"
```

## 🤝 Přispívání

### Workflow
1. **Fork** repository
2. Vytvoř **feature branch** (`git checkout -b feature/nova-funkcionalita`)
3. **Commit** změny (`git commit -m 'feat: přidána nová funkcionalita'`)
4. **Push** branch (`git push origin feature/nova-funkcionalita`)
5. Otevři **Pull Request**

### Coding Standards
- **PHP:** PSR-12 + Symfony conventions
- **TypeScript:** Strict mode, ESLint
- **Git:** [Conventional Commits](https://www.conventionalcommits.org/)
- **CSS:** Mantine UI komponenty, SCSS pro custom styly

### Code Review
- Všechny změny procházejí code review
- Automatické testy musí projít
- Dokumentace musí být aktualizována

## 🐛 Debugging & Troubleshooting

### Časté problémy

**DDEV nefunguje**
```bash
ddev restart
ddev composer install
ddev npm install
```

**Webpack build errors**
```bash
rm -rf node_modules package-lock.json
ddev npm install
ddev npm run build
```

**Database chyby**
```bash
ddev exec bin/console doctrine:database:drop --force
ddev exec bin/console doctrine:database:create
ddev exec bin/console doctrine:migrations:migrate -n
```

### Debug nástroje
- **Symfony Profiler:** `/_profiler` (dev mode)
- **React DevTools:** browser extension
- **Database:** phpMyAdmin na `https://portalznackare.ddev.site:8037`
- **Logs:** `ddev logs -f`

## 📚 Dokumentace

- **[Claude.md](Claude.md)** - Kontext pro AI asistenty
- **[Symfony Docs](https://symfony.com/doc/6.4/)** - Symfony dokumentace
- **[Mantine Docs](https://mantine.dev/)** - UI komponenty
- **[React Docs](https://react.dev/)** - React dokumentace
- **API dokumentace** - Dostupná na `/api/docs` (produkce)

## 📞 Podpora

### Pro vývojáře
- **GitHub Issues** - bug reporty a feature requests
- **Pull Requests** - příspěvky a opravy

### Pro uživatele
- **Kontakty KČT** - propojení s technickou podporou
- **Dokumentace** - uživatelské příručky v aplikaci

## 📄 Licence

Tento projekt je licencován pod [MIT licencí](LICENSE).

## 🙏 Poděkování

Děkujeme všem dobrovolníkům KČT, kteří přispěli k vývoju této aplikace.


---

**Vytvořeno s ❤️ pro dobrovolníky Klubu českých turistů**

**Verze:** 1.0.0  
**Poslední aktualizace:** Leden 2025