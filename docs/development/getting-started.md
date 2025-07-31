# Instalace a setup

Návod pro zprovoznění aplikace Portál značkaře v development prostředí.

## 🎯 Požadavky

- [DDEV](https://ddev.readthedocs.io/en/stable/) v2.0+
- [Docker](https://www.docker.com/)
- Git
- Node.js 18+ (pro lokální development bez DDEV)

## 🚀 Rychlá instalace

### 1. Klon repository
```bash
git clone <repository-url>
cd portalznackare
```

### 2. Spusť DDEV prostředí
```bash
ddev start
```

### 3. Nainstaluj závislosti
```bash
# Symfony závislosti
ddev composer install

# Node.js závislosti
ddev npm install
```

### 4. Setup databáze
```bash
# Vytvoř databázi
ddev exec bin/console doctrine:database:create --if-not-exists

# Spusť migrace
ddev exec bin/console doctrine:migrations:migrate -n
```

### 5. Build frontend assets
```bash
# Development build
ddev npm run dev

# Production build
ddev npm run build
```

### 6. Přístup k aplikaci
```bash
# Otevři aplikaci
open https://portalznackare.ddev.site
```

## ⚙️ Development prostředí

### DDEV příkazy
```bash
# Spustí development prostředí
ddev start

# Zastaví prostředí
ddev stop

# Restart prostředí
ddev restart

# SSH do web containeru
ddev ssh

# Sledování logů
ddev logs -f
```

### Webpack watching (live reload)
```bash
# Automatický rebuild při změnách
ddev npm run watch
```

### Database management
```bash
# Přístup k PostgreSQL databázi
ddev psql

# Database connection pro IDE (např. PhpStorm)
Host: 127.0.0.1
Port: 5433
Database: db
Username: db
Password: db
```

## 🔧 Troubleshooting

### DDEV nefunguje
```bash
ddev restart
ddev composer install
ddev npm install
```

### Webpack build errors
```bash
rm -rf node_modules package-lock.json
ddev npm install
ddev npm run build
```

### Database chyby
```bash
ddev exec bin/console doctrine:database:drop --force
ddev exec bin/console doctrine:database:create
ddev exec bin/console doctrine:migrations:migrate -n
```

## 🔐 Výchozí přihlašovací údaje

**Development prostředí (s USE_TEST_DATA=true):**
```
Email: test@test.com
Heslo: test123
```

## 📝 Environment konfigurace

Pro lokální development DDEV automaticky nakonfiguruje potřebné proměnné. 

**Detailní konfigurace:** [../configuration.md](../configuration.md)

## ✅ Ověření instalace

### Test základních funkcí
```bash
# Test Symfony
ddev exec bin/console about

# Test API
curl https://portalznackare.ddev.site/api/test/insys-user

# Test assets
curl https://portalznackare.ddev.site/build/app.js
```

### Debug nástroje
- **Symfony Profiler:** `/_profiler` (dev mode)
- **Database:** `https://portalznackare.ddev.site:8037`
- **Logs:** `ddev logs -f`

---

**Další kroky:** [Development workflow](development.md)