# Portál značkaře - Claude AI Context

## O projektu
Portál značkaře je aplikace na čisté **Symfony 6.4 LTS + React 18** řešení pro správu turistického značení. Aplikace slouží značkařům KČT pro evidenci příkazů, hlášení práce a správu dokumentace.

## Technický stack
- **Backend:** Symfony 6.4 LTS, PHP 8.2
- **Frontend:** React 18, TypeScript, Mantine UI v7
- **Databáze:** PostgreSQL (nový obsah) + MSSQL (stávající data přes mock)
- **Development:** DDEV, Webpack Encore
- **URL:** https://portalznackare.ddev.site

## Architektura
```
React SPA (TypeScript) → Symfony API → Mock MSSQL Service
                       ↘ PostgreSQL (Doctrine ORM)
```

## Projektová struktura

### Backend (Symfony)
```
src/
├── Controller/Api/           # REST API endpointy
│   └── TestController.php    # Mock API pro testování
├── Entity/                   # Doctrine entity (PostgreSQL)
├── Repository/               # Database repositories
├── Service/                  # Business logika
│   └── MockMSSQLService.php  # Mock služba pro MSSQL data
└── Command/                  # Console příkazy
```

### Frontend (React + TypeScript)
```
assets/
├── js/
│   ├── app.tsx                    # Main entry point
│   ├── components/
│   │   ├── App.tsx               # Hlavní React aplikace
│   │   ├── auth/                 # Autentifikace
│   │   │   ├── AuthContext.tsx   # Context pro auth stav
│   │   │   ├── LoginForm.tsx     # Přihlašovací formulář
│   │   │   ├── RequireLogin.tsx  # HOC pro chráněné stránky
│   │   │   └── UserWidget.tsx    # Widget uživatele
│   │   ├── content/              # Obsah stránek
│   │   ├── downloads/            # Ke stažení
│   │   ├── metodika/             # Dokumentace/metodiky
│   │   ├── prikazy/              # Hlavní funkcionalita - příkazy
│   │   │   ├── components/       # Formuláře a komponenty
│   │   │   ├── hooks/           # Custom hooks
│   │   │   ├── types/           # TypeScript typy
│   │   │   └── utils/           # Utility funkce
│   │   ├── shared/              # Sdílené komponenty
│   │   └── user/                # Uživatelský profil
│   ├── services/
│   │   └── api.ts               # API služby
│   ├── utils/                   # Globální utility
│   ├── hooks/                   # Globální hooks
│   └── contexts/                # React contexts
├── css/
│   └── app.scss                 # Main stylesheet + Mantine
├── images/                      # SVG ikony značek
└── types/
    └── custom.d.ts              # TypeScript definice
```

## API Endpointy

### Test/Mock API (současné)
```
GET /api/test/insys-user          # Mock uživatelské data
GET /api/test/insys-prikazy       # Mock seznam příkazů
```

### Budoucí API struktura
```
# INSYS API (MSSQL data)
POST /api/insys/login             # Přihlášení
GET  /api/insys/user              # Detail uživatele
GET  /api/insys/prikazy           # Seznam příkazů
GET  /api/insys/prikaz            # Detail příkazu
GET  /api/insys/ceniky            # Ceníky

# Portal API (PostgreSQL data)
GET  /api/portal/methodologies    # Metodiky
GET  /api/portal/report           # Hlášení
POST /api/portal/report           # Uložení hlášení
```

## MSSQL Mock Service

Aplikace používá `MockMSSQLService` který simuluje komunikaci s MSSQL databází pomocí test dat:

### Test data struktura
```json
{
    "user": {
        "INT_ADR": 4133,
        "JMENO": "Test",
        "PRIJMENI": "Značkař"
    },
    "prikazy": {
        "2025": [
            {
                "ID_Znackarske_Prikazy": 1,
                "CISLO_ZP": "ZP001/2025",
                "NAZEV": "Test příkaz"
            }
        ]
    },
    "detaily": {
        "1": {
            "head": {...},
            "predmety": [...],
            "useky": [...]
        }
    }
}
```

## React komponenty a jejich účel

### Hlavní komponenty
- **App.tsx** - Hlavní aplikace s routing (Mantine AppShell)
- **AuthContext.tsx** - Globální auth stav a funkce
- **Dashboard.tsx** - Uživatelská nástěnka

### Prikazy (hlavní funkcionalita)
- **Prikazy.tsx** - Seznam příkazů
- **Prikaz.tsx** - Detail příkazu
- **HlaseniPrikazu.tsx** - Formulář hlášení
- **PartAForm.tsx/PartBForm.tsx** - Formuláře pro hlášení
- **CompensationSummary.tsx** - Výpočet náhrad

### Metodika
- **Metodika.tsx** - Seznam metodik
- **MetodikaDetail.tsx** - Detail metodiky
- **MetodikaContext.tsx** - Context pro metodiky

## Coding Standards

### TypeScript/React
```typescript
// Komponenty - PascalCase
const Dashboard: React.FC = () => {};

// Props interface
interface DashboardProps {
    userId: number;
    onUpdate?: () => void;
}

// Hooks - use prefix
const useAuth = () => {};

// Constants - UPPER_SNAKE_CASE
const API_BASE_URL = '/api';

// Files - PascalCase.tsx pro komponenty
// Files - camelCase.ts pro utils/services
```

### PHP (Symfony)
```php
// Entities - PascalCase
class Report
{
    #[ORM\Column]
    private int $idZp = 0;
}

// Controllers - PascalCase + Controller suffix
#[Route('/api/test')]
class TestController extends AbstractController
{
    #[Route('/insys-user', methods: ['GET'])]
    public function getInsysUser(): JsonResponse
}

// Services - PascalCase + Service suffix
class MockMSSQLService
{
    public function getUser(int $intAdr): array
}
```

### Import paths (aliasy)
```typescript
// Používej aliasy místo relativních cest
import { AuthContext } from '@/contexts/AuthContext';
import { Dashboard } from '@components/user/Dashboard';
import { apiCall } from '@services/api';
import { formatDate } from '@utils/formatting';
```

## Mantine UI použití

### Preferované komponenty
```typescript
// Layout
import { AppShell, Container, Grid, Stack, Group } from '@mantine/core';

// Forms
import { TextInput, Select, Button, Checkbox } from '@mantine/core';

// Navigation
import { NavLink, Burger, Menu } from '@mantine/core';

// Feedback
import { notifications } from '@mantine/notifications';
import { Alert, Loader } from '@mantine/core';

// Data display
import { Table, Card, Badge, Text } from '@mantine/core';
```

### Styling approach
```typescript
// Preferuj Mantine props místo custom CSS
<Button color="blue" size="md" variant="filled">
<Text size="lg" fw={700} c="blue">
<Container size="lg" py="xl">
```

## Development workflow

### Příkazy
```bash
# Development
ddev start                        # Spustí DDEV
ddev npm run watch               # Webpack watching
curl https://portalznackare.ddev.site/api/test/insys-user

# Databáze
ddev exec bin/console doctrine:migrations:migrate

# Code quality
ddev composer cs-fix             # PHP CS Fixer
ddev composer phpstan            # Statická analýza
ddev composer test               # PHPUnit

# Build
ddev npm run build               # Production build
```

### Debugging
- **Symfony Profiler:** `/_profiler` v dev módu
- **React DevTools:** pro React komponenty
- **Console logs:** pro frontend debugging
- **Xdebug:** pro PHP debugging (ddev xdebug on)

## Specifické konvence projektu

### Názvy souborů
- **React komponenty:** `PascalCase.tsx`
- **Hooks:** `useSomething.ts`
- **Utils:** `camelCase.ts`
- **Types:** `SomethingTypes.ts`
- **PHP třídy:** `PascalCase.php`

### Organizace kódu
- **Jedna komponenta = jeden soubor**
- **Types v separátních souborech nebo inline**
- **Utility funkce seskupené podle účelu**
- **API calls v services/**

### Error handling
```typescript
// Frontend
try {
    const data = await apiCall();
} catch (error) {
    notifications.show({
        title: 'Chyba',
        message: error.message,
        color: 'red'
    });
}

// Backend
try {
    $result = $this->service->doSomething();
    return new JsonResponse($result);
} catch (\Exception $e) {
    return new JsonResponse(['error' => $e->getMessage()], 500);
}
```

## Časté úkoly

### Přidání nové React komponenty
1. Vytvoř `ComponentName.tsx` v příslušné složce
2. Definuj props interface
3. Implementuj komponentu s Mantine UI
4. Přidej do routing pokud potřeba
5. Export v `index.ts` pokud je sdílená

### Přidání nového API endpointu
1. Vytvoř metodu v příslušném Controller
2. Přidej routing atribut `#[Route]`
3. Implementuj validaci a error handling
4. Aktualizuj frontend API service
5. Test pomocí curl nebo Postman

### Přidání nové entity
1. Vytvoř Entity třídu s Doctrine anotacemi
2. Vytvoř Repository
3. Vygeneruj migraci: `bin/console make:migration`
4. Spusť migraci: `bin/console doctrine:migrations:migrate`

## Migrace poznámky

### Z WordPress
- ✅ MSSQL komunikace zachována (mock)
- ✅ React struktura zachována a vyčištěna
- ✅ URL routing kompatibilní
- ✅ Mantine UI místo custom CSS

### Klíčové rozdíly
- **Auth:** Symfony Security místo WordPress sessions
- **API:** REST místo WP REST API
- **Build:** Webpack Encore místo WP Asset Pipeline
- **DB:** Doctrine ORM místo WP queries

## Při práci s kódem

### Vždy používej
1. **TypeScript** - žádný plain JavaScript
2. **Mantine komponenty** místo custom HTML
3. **Symfony best practices** - services, DI, events
4. **Error handling** - vždy ošetři chyby
5. **Import aliasy** - místo relativních cest

### Testování
- **API:** `curl` příkazy pro rychlé testování
- **Frontend:** React DevTools + console
- **Backend:** Symfony Profiler + error logs

### Performance
- **Lazy loading** React komponent
- **Memoization** těžkých výpočtů
- **Optimized queries** v Doctrine
- **Webpack optimalizace** pro produkci

Tento kontext poskytuje vše potřebné pro efektivní práci s projektem. Vždy dodržuj tyto konvence a používej aliasy pro čistší kód!