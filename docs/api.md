# API portálu – přehled endpointů

Seznam všech endpointů portálu (`/api/*`, `/admin/api/*`). Detaily chování jsou v komentářích controllerů
(`src/Controller/Api/`, `src/Controller/AdminController.php`, `src/Controller/CmsApiController.php`).

## Společné

- **Přihlášení:** session (cookie) po `POST /api/auth/login`; `access_control` v `config/packages/security.yaml`
  vyžaduje pro `/api` roli `ROLE_USER`, pro `/admin` roli `ROLE_ADMIN`. Další pravidla kontroluje každý endpoint sám.
- **CSRF:** každé volání `/api/*` a `/admin/api/*` musí nést hlavičku `X-CSRF-Token` (session token). Přidává ji
  automaticky globální obal `fetch` v `templates/components/api-token.html.twig`. Bez platného tokenu
  `403` + `error_code: CSRF_INVALID` a hlavička `X-CSRF-Invalid: 1` (`src/EventListener/ApiCsrfListener.php`).
- **Výjimky z CSRF** (`ApiCsrfListener::VYJIMKY`): `/api/insyz-client/`, `/api/test/`, `/api/auth/logout`,
  `/api/auth/csrf-token`.
- **Chyby:** JSON `{"error": "text"}`, u některých endpointů navíc `error_code` (a `success: false`).
  Starší endpointy vrací místo `error` klíč `message`.
- **401** = nepřihlášený (u `/api/*` JSON z `ApiAuthenticationEntryPoint`), **403** = chybí oprávnění nebo neplatný CSRF token.
- Tělo požadavků je JSON, pokud není uvedeno jinak (upload = `multipart/form-data`).

## Přihlášení

| Metoda | Cesta | Přístup | Parametry | Popis |
|---|---|---|---|---|
| POST | `/api/auth/login` | veřejný | body `username` (e-mail), `password` (heslo nebo jeho SHA1 hash), `redirect_url` (volitelně) | Přihlášení přes `InsyzAuthenticator`; chyba 401, při blokaci 429 (5 pokusů / e-mail, 20 / IP za 15 min) |
| ANY | `/api/auth/logout` | přihlášený | – | Odhlášení (firewall, i odkazem), přesměruje na `/` |
| GET | `/api/auth/status` | veřejný | – | `authenticated` + základní údaje uživatele |
| GET | `/api/auth/me` | `ROLE_USER` | – | Uživatel z DB + přehled oprávnění |
| GET | `/api/auth/csrf-token` | veřejný | – | Nový API token pro aktuální session (obnova po vypršení) |

## INSYZ data

Controller `InsyzController` → `InsyzService` (MSSQL, lokálně mock data). Procedury viz
[insyz-integration.md](features/insyz-integration.md#insyz-stored-procedures).

| Metoda | Cesta | Přístup | Parametry | Popis |
|---|---|---|---|---|
| GET | `/api/insyz/user` | přihlášený | query `int_adr` (volitelně), `id_zp` | Profil značkaře. Vlastní / admin = plná data; kolega z týmu jen s `id_zp` společného příkazu (zúžený profil), jinak 403 |
| GET | `/api/insyz/prikazy` | přihlášený | query `year`, `raw`, `int_adr` (jen `ROLE_SUPER_ADMIN`) | Seznam příkazů uživatele (obohacený, `raw` = surová data) |
| GET | `/api/insyz/prikaz/{id}` | člen týmu příkazu nebo admin | query `raw` | Detail příkazu (`head`, `predmety`, `useky`…); cizí příkaz 403 |
| GET | `/api/insyz/zp-useky/{id}` | člen týmu příkazu nebo admin | – | Úseky příkazu (`trasy.ZP_Useky`); cizí příkaz 403 |
| GET | `/api/insyz/sazby` | přihlášený | query `date` (volitelně, výchozí dnes) | Sazby náhrad k datu |
| GET | `/api/insyz/system-parameters` | přihlášený | – | Systémové parametry INSYZ |
| POST | `/api/insyz/submit-report` | přihlášený | body `xml_data` (povinný) | Přímý zápis XML hlášení do INSYZ (běžně odesílá worker, viz hlášení) |
| POST | `/api/insyz/update-password` | přihlášený | body `Stare_Heslo`, `Nove_Heslo`, `Nove_Heslo_Potvrzeni` (vše povinné) | Změna hesla v INSYZ; 400 při neshodě hesel |
| POST | `/api/insyz/login` | `ROLE_ADMIN` | body `email`, `hash` | Ověření údajů bez přihlášení – jen pro INSYZ tester |
| POST | `/api/insyz/export` | jen prostředí dev | body `endpoint`, `response`, `params` | Uloží odpověď jako mock data do `var/mock-data/` |
| POST | `/api/insyz/export/batch-prikazy` | jen prostředí dev, přihlášený | body `year` (povinný), `int_adr` (jen `ROLE_SUPER_ADMIN`) | Hromadný export příkazů, detailů a úseků do mock dat |

## Hlášení a PDF

| Metoda | Cesta | Přístup | Parametry | Popis |
|---|---|---|---|---|
| GET | `/api/portal/report` | člen týmu příkazu nebo admin | query `id_zp` (povinný) | Hlášení k příkazu, nebo `null`, pokud neexistuje |
| POST | `/api/portal/report` | vedoucí týmu nebo admin | body `id_zp`, `cislo_zp`, `data_a`, `data_b` (povinné); `znackari`, `calculation`, `state` (`draft`\|`send`, výchozí `draft`) | Uloží koncept / odešle; při `send` se zařadí asynchronní odeslání do INSYZ (`SendToInsyzMessage`) |
| GET | `/api/portal/prikaz/{id}/control-form-pdf` | člen týmu příkazu nebo admin | – | PDF kontrolního formuláře (`application/pdf`, příloha) |

### Pravidla hlášení

(`PortalController::report`)
- Přístup jen pro členy týmu příkazu podle hlavičky příkazu v INSYZ (`INT_ADR_*`), admin vždy – jinak **403**.
- Ukládá jen vedoucí týmu (`Je_Vedouci{i}` = 1) nebo admin – jinak **403 `NOT_LEADER`**.
- Klient smí poslat jen stav `draft` nebo `send` – jinak **400**. Ostatní stavy nastavuje systém nebo admin API.
- Hlášení mimo stav `draft`/`rejected` upraví jen admin – jinak **409 `REPORT_NOT_EDITABLE`** (řádek se zamyká `findOneByIdZpForUpdate`).
- `data_a.Presmerovani_Vyplat` (`{z_INT_ADR: na_INT_ADR}`) jen mezi členy týmu (platí i pro admina) – jinak **400 `INVALID_REDIRECT`**.
- Když INSYZ nejde ověřit oprávnění k příkazu → **503** (fail-closed).
- Částky (`calculation`) počítá prohlížeč; INSYZ je po přijetí sám přepočítá a zkontroluje.

## Soubory

Controller `FileController` (`/api/portal/files`).

| Metoda | Cesta | Přístup | Parametry | Popis |
|---|---|---|---|---|
| POST | `/api/portal/files/upload` | přihlášený | multipart `files` (1–n, max 15 MB, JPEG/PNG/HEIC/PDF), `path`, `options` (JSON), `is_public`, `entity_type`, `entity_id`, `field_name` | Nahrání souborů + evidence použití |
| GET | `/api/portal/files/{id}` | veřejný soubor, autor nebo admin | – | Metadata souboru; cizí chráněný soubor → 404 |
| DELETE | `/api/portal/files/{id}` | autor nebo admin | body `force` (jen admin), `entity_type`, `entity_id`, `field_name` | Smazání / odebrání použití; neexistující soubor s kontextem entity = úklid odkazu |
| PUT | `/api/portal/files/{id}/edit` | autor nebo admin | body `operations` (povinné), `saveMode` (`overwrite`\|`copy`), `entity_type`, `entity_id`, `field_name` | Úprava obrázku (jen `image/*`) |
| POST | `/api/portal/files/usage` | kdo soubor nahrál nebo `ROLE_ADMIN` (jinak 403) | body `fileId`, `type`, `id` (povinné), `data`, `field_name` | Přidá záznam o použití souboru |
| DELETE | `/api/portal/files/usage` | kdo soubor nahrál nebo `ROLE_ADMIN` (jinak 403) | body `fileId`, `type`, `id` (povinné), `field_name` | Odebere záznam o použití |
| GET | `/api/portal/files/folders` | `ROLE_ADMIN` | – | Složky knihovny médií |
| GET | `/api/portal/files/library` | `ROLE_ADMIN` | query `folder`, `usage` (`all`\|`used`\|`unused`), `type` (`all`\|`images`\|`pdfs`\|`documents`), `search`, `uploadedBy` | Knihovna médií |
| GET | `/api/portal/files/orphaned-references` | `ROLE_ADMIN` | – | Odkazy na neexistující soubory |

## Uživatelské preference

Povolené klíče a výchozí hodnoty: `config/user_preferences.yaml`.

| Metoda | Cesta | Přístup | Parametry | Popis |
|---|---|---|---|---|
| GET | `/api/portal/user/preferences` | přihlášený | – | Preference včetně výchozích hodnot |
| PUT | `/api/portal/user/preferences` | přihlášený | body `preferences` (objekt klíč → hodnota) | Hromadná změna; neplatné klíče vrátí v `errors` |
| PUT | `/api/portal/user/preferences/{key}` | přihlášený | body `value` (povinný) | Změna jedné preference |

## Nedokončené

Vrací **501** (zatím neimplementováno, `PortalController`).

| Metoda | Cesta | Přístup | Parametry | Popis |
|---|---|---|---|---|
| GET | `/api/portal/post` | přihlášený | – | Obsah stránky/příspěvku |
| GET | `/api/portal/metodika` | přihlášený | – | Metodiky |
| GET | `/api/portal/metodika-terms` | přihlášený | – | Kategorie metodik |
| GET | `/api/portal/downloads` | přihlášený | – | Soubory ke stažení |

## Administrace

Vše `ROLE_ADMIN` (`#[IsGranted]` na controlleru + `access_control ^/admin`).

| Metoda | Cesta | Přístup | Parametry | Popis |
|---|---|---|---|---|
| GET | `/admin/api/reports` | admin | – | Všechna hlášení (od nejnověji upraveného) |
| GET | `/admin/api/reports/{id}` | admin | – | Detail hlášení vč. historie a `nahledUrl` (náhled přes INSYZ hash) |
| POST | `/admin/api/reports/{id}/state` | admin | body `state` (`draft`\|`send`\|`submitted`\|`approved`\|`rejected`) | Změna stavu; `send` vždy znovu zařadí odeslání do INSYZ |
| GET | `/admin/api/reports/{id}/xml` | admin | – | Náhled XML pro INSYZ (`application/xml`) |
| GET | `/admin/api/cms/content-types` | admin | – | Typy obsahu CMS |
| GET | `/admin/api/cms/pages` | admin | – | Všechny stránky (filtruje frontend) |
| POST | `/admin/api/cms/pages` | admin | body `title`, `content` (povinné), `content_type`, `status` a další pole stránky (`PageService::createPage`) | Nová stránka (201) |
| GET | `/admin/api/cms/pages/{id}` | admin | – | Detail stránky vč. obsahu |
| PUT | `/admin/api/cms/pages/{id}` | admin | body pole stránky (`PageService::updatePage`) | Úprava; smazaná stránka → 403 |
| DELETE | `/admin/api/cms/pages/{id}` | admin | – | Přesun do koše (soft delete) |
| PATCH | `/admin/api/cms/pages/{id}/publish` | admin | – | Publikovat |
| PATCH | `/admin/api/cms/pages/{id}/archive` | admin | – | Archivovat |
| PATCH | `/admin/api/cms/pages/{id}/restore` | admin | – | Obnovit z koše (jinak 400) |
| PATCH | `/admin/api/cms/pages/{id}/sort-order` | admin | body `sort_order` (int, povinný) | Pořadí; kolize se sourozenci se posunou |
| GET | `/admin/api/cms/search` | admin | query `q` (min. 2 znaky), `published_only` | Hledání stránek |
| GET | `/admin/api/cms/tree` | admin | query `published_only` | Strom stránek |
| GET | `/admin/api/cms/trash` | admin | – | Koš |
| GET | `/admin/api/cms/check-slug` | admin | query `slug` (povinný), `exclude_id` | Volnost slugu + návrh unikátního |

## Diagnostika

`/api/test/*` pouští firewall bez přihlášení; `TestController::denyUnlessAdminOrCi` vyžaduje admina (session)
nebo hlavičku `X-Healthcheck-Token` = `CI_HEALTHCHECK_TOKEN` – jinak 403. Bez CSRF.

| Metoda | Cesta | Přístup | Parametry | Popis |
|---|---|---|---|---|
| GET | `/api/test/insyz-user` | admin nebo CI token | – | Test `ZNACKAR_DETAIL` na pevném INT_ADR |
| GET | `/api/test/insyz-prikazy` | admin nebo CI token | – | Test `PRIKAZY_SEZNAM` na pevném INT_ADR a roce |
| GET | `/api/test/mssql-connection` | admin nebo CI token | – | Test spojení s MSSQL (při `USE_TEST_DATA=true` jen `test_mode`) |
| POST | `/api/test/login-test` | admin nebo CI token | body `email`, `hash` nebo `password` | Test `WEB_Login` |
| GET | `/test-insyz-api` | dev: kdokoli; jinak `ROLE_SUPER_ADMIN` (jinak 404) | – | Stránka INSYZ API testeru; mimo dev jen GET endpointy. Viz [insyz-api-tester.md](development/insyz-api-tester.md) |

## Desktopový klient INSYZ

| Metoda | Cesta | Přístup | Parametry | Popis |
|---|---|---|---|---|
| POST | `/api/insyz-client/db-password` | veřejný (ověření v těle), bez CSRF | body `user`, `password`, `key` (vše povinné, neprázdné) | Vydá heslo k jednomu DB účtu INSYZ pro desktopového klienta |

Kontrakt pro autora klienta (`InsyzClientController`, `InsyzClientCredentialsService`):
- `user` = přihlašovací jméno v INSYZ, `password` = heslo v otevřené podobě, `key` = identifikátor DB účtu
  (rozlišuje velikost písmen; seznam dostane autor klienta zvlášť).
- **200** `{"password": "…"}` – jen heslo, connection string si klient skládá sám. Heslo neukládat na disk.
- **401** `{"error": "Přístup byl odmítnut."}` – jediná odpověď pro všechny chyby (neznámý klíč/uživatel, špatné
  heslo, nevalidní tělo, HTTP místo HTTPS, nedostupná DB). Důvod je jen v logu (kanál `api`). Při 401 neopakovat automaticky.
- **429** `{"error": "…", "retry_after": s}` + hlavička `Retry-After` – po 10 neúspěšných pokusech za 300 s se blokuje
  IP i uživatel; hlásí už pokus, který limit přetáhl, každý další neúspěch okno posouvá. Při 429 nezkoušet.
- **Jen HTTPS** (`INSYZ_CLIENT_REQUIRE_HTTPS`, vypnout lze jen lokálně) a jen POST.
- Víc účtů = víc volání, jedno na klíč. Konfigurace účtů: `insyz_client.accounts` v `config/services.yaml`,
  kontrola na serveru: `php bin/console insyz:client:check`.

---

**Související:** [Přehled dokumentace](overview.md)
**Aktualizováno:** 2026-09-29
