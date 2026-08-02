# Externí read-only náhled hlášení přes INSYZ hash — Implementační plán

> **Pro agentní workery:** REQUIRED SUB-SKILL: použij superpowers:subagent-driven-development (doporučeno) nebo superpowers:executing-plans k provedení tohoto plánu task po tasku. Kroky používají checkbox (`- [ ]`) syntaxi.
>
> **⛔ ZÁKAZ COMMITŮ:** V tomto projektu se **nikdy** nespouští `git commit`/`git push` ani se nemění git stav (větve). Tento plán proto **neobsahuje commit kroky** — verzování provádí výhradně uživatel. Na konci každého tasku je "Checkpoint" (manuální/automatické ověření), ne commit.

**Goal:** Umožnit správcům INSYZ otevřít kompletní vyplněné hlášení příkazu přes bezpečnou hash-ověřenou URL (`/prikaz/{id}/hlaseni?insyz-hash=…`) v read-only režimu, včetně náhledů příloh a nenápadného označení nesouladu TIM dat (rok výroby, směrování) oproti INSYZ.

**Architecture:** Tatáž React aplikace `hlaseni-prikazu` (SSOT/DRY). Anonymní přístup ověří controller deterministickým SHA1 podpisem; po ověření server sestaví „bootstrap" data voláním týchž services jako blokované `/api/*` endpointy a vloží je do stránky. App místo `fetch` použije bootstrap a běží read-only (`canEdit=false`, `isLeader=true`). Detekce nesouladu TIM je always-on useMemo v App.jsx, zobrazená inline jako oranžový text.

**Tech Stack:** Symfony 6.4 / PHP 8.3 (controller, service), Twig, React 18 (micro-app), PHPUnit 11.5 (unit test hash služby).

---

## Přehled souborů

**Nové:**
- `src/Service/InsyzReportHashService.php` — generování/ověření hashe
- `tests/Service/InsyzReportHashServiceTest.php` — unit test hashe
- `phpunit.xml.dist` — minimální konfigurace pro spuštění testů
- `assets/js/apps/hlaseni-prikazu/utils/timMismatch.js` — výpočet nesouladu TIM
- `assets/js/apps/hlaseni-prikazu/components/TimMismatchNote.jsx` — inline oranžová poznámka
- `docs/features/insyz-hash-nahled-hlaseni.md` — funkční dokumentace

**Upravené:**
- `.env` + `.env.example` — `INSYZ_REPORT_HASH_SECRET`
- `config/services.yaml` — bind tajného klíče
- `config/packages/security.yaml` — výjimka access_control
- `src/Controller/AppController.php` — `prikazHlaseni` (autorizace + bootstrap)
- `templates/pages/prikaz-hlaseni.html.twig` — režim náhledu + bootstrap JSON
- `assets/js/apps/hlaseni-prikazu/App.jsx` — čtení bootstrapu, insyz-view, `timMismatch`
- `assets/js/apps/hlaseni-prikazu/components/PartBSummary.jsx` — inline nesoulad
- `assets/js/apps/hlaseni-prikazu/components/PartBForm.jsx` — inline nesoulad (editor)

---

## Task 1: Služba pro hash + konfigurace + unit test

**Files:**
- Create: `src/Service/InsyzReportHashService.php`
- Create: `tests/Service/InsyzReportHashServiceTest.php`
- Create: `phpunit.xml.dist`
- Modify: `.env`, `.env.example`, `config/services.yaml`

- [ ] **Step 1: Přidat tajný klíč do `.env` a `.env.example`**

Do obou souborů přidat (do `.env` reálnou hodnotu, do `.env.example` placeholder):

```dotenv
###> insyz report hash ###
# Sdílený tajný klíč pro podpis URL náhledu hlášení (musí být identický v INSYZ)
INSYZ_REPORT_HASH_SECRET=zmen-me-na-nahodny-retezec
###< insyz report hash ###
```

- [ ] **Step 2: Bind tajného klíče v `config/services.yaml`**

Do bloku `services > _defaults` přidat `bind` (pokud `_defaults` ještě `bind` nemá, vytvořit ho):

```yaml
    _defaults:
        autowire: true
        autoconfigure: true
        bind:
            $insyzReportHashSecret: '%env(INSYZ_REPORT_HASH_SECRET)%'
```

- [ ] **Step 3: Vytvořit službu `InsyzReportHashService`**

Create `src/Service/InsyzReportHashService.php`:

```php
<?php

namespace App\Service;

/**
 * Deterministický podpis URL pro read-only náhled hlášení (pro správce INSYZ).
 *
 * Používá stejný mechanismus jako hashování hesel v INSYZ:
 *   UPPER(CONVERT(VARCHAR(40), HASHBYTES('SHA1', @text), 2))
 * tj. strtoupper(sha1(...)). Vstupem je sdílený tajný klíč + číslo příkazu
 * (cisloZp), které NENÍ v URL (v URL je jen id příkazu).
 */
class InsyzReportHashService
{
    public function __construct(
        private readonly string $insyzReportHashSecret
    ) {
    }

    /**
     * Vygeneruje hash z čísla příkazu. (V provozu generuje URL INSYZ;
     * tady slouží k ověření a testům.)
     */
    public function generate(string $cisloZp): string
    {
        return strtoupper(sha1($this->insyzReportHashSecret . $cisloZp));
    }

    /**
     * Ověří hash proti číslu příkazu v konstantním čase.
     */
    public function verify(string $cisloZp, string $hash): bool
    {
        if ($cisloZp === '' || $hash === '') {
            return false;
        }

        return hash_equals($this->generate($cisloZp), strtoupper($hash));
    }
}
```

- [ ] **Step 4: Vytvořit `phpunit.xml.dist`**

Create `phpunit.xml.dist` (minimální, bootstrap už existuje):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="tests/bootstrap.php"
         colors="true"
         cacheDirectory=".phpunit.cache">
    <testsuites>
        <testsuite name="App Test Suite">
            <directory>tests</directory>
        </testsuite>
    </testsuites>
</phpunit>
```

- [ ] **Step 5: Napsat selhávající unit test**

Create `tests/Service/InsyzReportHashServiceTest.php`:

```php
<?php

namespace App\Tests\Service;

use App\Service\InsyzReportHashService;
use PHPUnit\Framework\TestCase;

class InsyzReportHashServiceTest extends TestCase
{
    private const SECRET = 'test-secret';

    public function testGenerateMatchesInsyzSha1Mechanism(): void
    {
        $service = new InsyzReportHashService(self::SECRET);
        $cisloZp = 'P/PS/O/26032';

        // Stejný vzorec, jaký použije INSYZ: UPPER(SHA1(secret . cislo))
        $expected = strtoupper(sha1(self::SECRET . $cisloZp));

        $this->assertSame($expected, $service->generate($cisloZp));
        $this->assertSame(40, strlen($service->generate($cisloZp)));
    }

    public function testVerifyAcceptsCorrectHashCaseInsensitive(): void
    {
        $service = new InsyzReportHashService(self::SECRET);
        $cisloZp = 'P/PS/O/26032';
        $hash = $service->generate($cisloZp);

        $this->assertTrue($service->verify($cisloZp, $hash));
        $this->assertTrue($service->verify($cisloZp, strtolower($hash)));
    }

    public function testVerifyRejectsWrongOrEmptyHash(): void
    {
        $service = new InsyzReportHashService(self::SECRET);

        $this->assertFalse($service->verify('P/PS/O/26032', 'deadbeef'));
        $this->assertFalse($service->verify('P/PS/O/26032', ''));
        $this->assertFalse($service->verify('', $service->generate('P/PS/O/26032')));
    }
}
```

- [ ] **Step 6: Spustit test — ověřit, že selže (třída ještě nebyla autoloadnuta / projde)**

Run: `ddev exec vendor/bin/phpunit tests/Service/InsyzReportHashServiceTest.php`
Expected: testy projdou (PASS), protože služba i test jsou hotové. Pokud PHPUnit hlásí chybějící konfiguraci, ověř, že `phpunit.xml.dist` existuje.

> Poznámka: jde o čistou funkci, proto píšeme test i implementaci v rámci jednoho tasku; krok „selhání" zde nahrazuje ověření, že vzorec odpovídá INSYZ mechanismu.

- [ ] **Step 7: Checkpoint**

`ddev exec vendor/bin/phpunit` projde zeleně. Soubory `.env`, `.env.example`, `config/services.yaml` upraveny. **Necommitovat.**

---

## Task 2: Controller — autorizace hashem + sestavení bootstrapu

**Files:**
- Modify: `config/packages/security.yaml`
- Modify: `src/Controller/AppController.php:84-90` (metoda `prikazHlaseni`)

- [ ] **Step 1: Výjimka v access_control**

V `config/packages/security.yaml` v sekci `access_control` přidat řádek **PŘED** `- { path: ^/prikaz/, roles: ROLE_USER }`:

```yaml
        # Náhled hlášení přes INSYZ hash – přístup řeší controller (login NEBO platný hash)
        - { path: '^/prikaz/\d+/hlaseni$', roles: PUBLIC_ACCESS }
```

- [ ] **Step 2: Přepsat metodu `prikazHlaseni`**

V `src/Controller/AppController.php` nahradit stávající metodu (řádky 84-90) následujícím. Přidat potřebné `use` importy nahoře v souboru: `use App\Service\InsyzReportHashService;`, `use App\Repository\ReportRepository;`, `use Symfony\Component\HttpFoundation\Request;`, `use Symfony\Component\Serializer\SerializerInterface;` (a `InsyzService`, `DataEnricherService` už importované jsou).

```php
    #[Route('/prikaz/{id}/hlaseni', name: 'app_prikaz_hlaseni')]
    public function prikazHlaseni(
        int $id,
        Request $request,
        ReportRepository $reportRepository,
        InsyzReportHashService $hashService,
        InsyzService $insyzService,
        DataEnricherService $dataEnricher,
        SerializerInterface $serializer
    ): Response {
        // Přihlášený uživatel → dnešní chování (plná appka, editace dle práv)
        if ($this->getUser() instanceof User) {
            return $this->render('pages/prikaz-hlaseni.html.twig', [
                'id' => $id,
                'insyz_view' => false,
                'insyz_bootstrap_json' => null,
            ]);
        }

        // Anonym → povolit pouze s platným insyz-hash
        $hash = (string) $request->query->get('insyz-hash', '');
        if ($hash === '') {
            // Žádný hash → necháme šablonu zobrazit výzvu k přihlášení
            return $this->render('pages/prikaz-hlaseni.html.twig', [
                'id' => $id,
                'insyz_view' => false,
                'insyz_bootstrap_json' => null,
            ]);
        }

        $report = $reportRepository->findOneBy(['idZp' => $id]);
        if (!$report) {
            throw $this->createNotFoundException('Hlášení nenalezeno');
        }

        if (!$hashService->verify($report->getCisloZp(), $hash)) {
            throw $this->createAccessDeniedException('Neplatný podpis URL');
        }

        // Sestavit bootstrap stejnými službami jako blokované /api/* endpointy
        $bootstrap = $this->buildInsyzBootstrap(
            $report, $insyzService, $dataEnricher, $serializer
        );

        // Bezpečné enkódování pro vložení do <script type="application/json">:
        // JSON_HEX_TAG zabrání </script> breakoutu (escapuje < a >).
        $bootstrapJson = json_encode(
            $bootstrap,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
        );

        return $this->render('pages/prikaz-hlaseni.html.twig', [
            'id' => $id,
            'insyz_view' => true,
            'insyz_bootstrap_json' => $bootstrapJson,
        ]);
    }

    /**
     * Sestaví data, která React aplikace běžně získává ze 4 chráněných
     * /api/* volání. Volá tytéž services, takže se neduplikuje logika.
     */
    private function buildInsyzBootstrap(
        \App\Entity\Report $report,
        InsyzService $insyzService,
        DataEnricherService $dataEnricher,
        SerializerInterface $serializer
    ): array {
        $ownerIntAdr = $report->getIntAdr();
        $idZp = $report->getIdZp();

        // 1) Detail příkazu z INSYZ + enrich (= GET /api/insyz/prikaz/{id})
        $orderData = $dataEnricher->enrichPrikazDetail(
            $insyzService->getPrikaz($ownerIntAdr, $idZp, true)
        );

        // 2) Uložené hlášení (= GET /api/portal/report) – stejná serializace
        $reportData = json_decode(
            $serializer->serialize($report, 'json', ['groups' => ['report:read']]),
            true
        );

        // 3) Sazby pro datum provedení (= GET /api/insyz/sazby)
        $date = $this->resolveExecutionDate($report, $orderData);
        $sazby = $insyzService->getSazby($date);

        // 4) Detaily členů týmu (= GET /api/insyz/user pro každého)
        $usersDetails = [];
        foreach (($report->getTeamMembers() ?: []) as $member) {
            $intAdr = (int) ($member['INT_ADR'] ?? 0);
            if ($intAdr > 0 && !isset($usersDetails[$intAdr])) {
                try {
                    $usersDetails[$intAdr] = $insyzService->getUser($intAdr);
                } catch (\Throwable $e) {
                    // detail jednoho uživatele není kritický
                }
            }
        }

        return [
            'orderData' => $orderData,
            'reportData' => $reportData,
            'sazby' => $sazby,
            'usersDetails' => $usersDetails,
        ];
    }

    /**
     * Datum pro načtení sazeb: nejpozdější datum segmentu z hlášení (dataA),
     * fallback Provedeni z hlavičky, fallback dnešek. Replikuje logiku
     * calculateExecutionDate() z frontendu (sazby se mění zřídka).
     */
    private function resolveExecutionDate(\App\Entity\Report $report, array $orderData): string
    {
        $latest = null;
        $dataA = $report->getDataA() ?: [];
        foreach (($dataA['Skupiny_Cest'] ?? []) as $group) {
            foreach (($group['Cesty'] ?? []) as $segment) {
                $datum = $segment['Datum'] ?? null;
                if (!$datum) {
                    continue;
                }
                $ts = strtotime((string) $datum);
                if ($ts !== false && ($latest === null || $ts > $latest)) {
                    $latest = $ts;
                }
            }
        }
        if ($latest !== null) {
            return date('Y-m-d', $latest);
        }
        $provedeni = $orderData['head']['Provedeni'] ?? null;
        if ($provedeni) {
            return date('Y-m-d', strtotime((string) $provedeni));
        }
        return date('Y-m-d');
    }
```

- [ ] **Step 3: Ověřit, že se nic nerozbilo pro přihlášený tok**

Run: `ddev exec php bin/console cache:clear` a otevřít jako přihlášený uživatel `https://portalznackare.ddev.site/prikaz/{platne_id}/hlaseni`.
Expected: hlášení se načte jako dnes (žádná regrese).

- [ ] **Step 4: Checkpoint**

Controller přeložen bez chyb (`ddev exec php bin/console lint:container`). **Necommitovat.**

---

## Task 3: Twig šablona — režim náhledu + bootstrap JSON

**Files:**
- Modify: `templates/pages/prikaz-hlaseni.html.twig`

- [ ] **Step 1: Upravit mount blok pro režim náhledu**

V `templates/pages/prikaz-hlaseni.html.twig` nahradit podmínku `{% if not app.user %} … {% else %} … {% endif %}` tak, aby pokrývala i `insyz_view`. Logika:
- `app.user` → mount jako dnes (beze změny, `data-insyz-view="false"`)
- `insyz_view` (platný hash) → mount bez přihlášení, `data-insyz-view="true"` + bootstrap `<script>`
- jinak → dnešní výzva k přihlášení

```twig
        {% if app.user or insyz_view %}
            <div data-app="hlaseni-prikazu"
                 data-prikaz-id="{{ id }}"
                 data-user="{{ app.user ? {INT_ADR: app.user.intAdr, name: app.user.fullName}|json_encode|e('html_attr') : '{}' }}"
                 data-is-admin="{{ is_granted('ROLE_ADMIN') ? 'true' : 'false' }}"
                 data-insyz-view="{{ insyz_view ? 'true' : 'false' }}"
                 data-debug="{{ app.request.server.get('DEBUG_APPS') == 'true' ? 'true' : 'false' }}">
                <div class="card">
                    {% include 'components/loader.html.twig' %}
                </div>
            </div>

            {% if insyz_view and insyz_bootstrap_json is not null %}
                {# JSON je už bezpečně zakódovaný v controlleru (JSON_HEX_TAG) #}
                <script type="application/json" id="insyz-bootstrap">{{ insyz_bootstrap_json|raw }}</script>
            {% endif %}
        {% else %}
            {% include 'components/alert.html.twig' with {
                type: 'warning',
                title: 'Přihlášení vyžadováno',
                message: 'Pro vyplnění hlášení příkazu se musíte přihlásit.',
                actions: [
                    { url: path('app_index'), text: 'Přihlásit se' }
                ]
            } %}
        {% endif %}
```

> Pozn.: ponech existující `{% block javascripts %}` s `encore_entry_script_tags('app-hlaseni-prikazu')` beze změny. Debug `<script>` blok níže v šabloně může zůstat (běží jen pro přihlášené přes `window.debugTwig`).

- [ ] **Step 2: Checkpoint**

Šablona se vyrenderuje bez Twig chyby pro oba případy (přihlášený i anonym bez hashe). **Necommitovat.**

---

## Task 4: React app — konzumace bootstrapu a režim náhledu

**Files:**
- Modify: `assets/js/apps/hlaseni-prikazu/App.jsx`

- [ ] **Step 1: Načíst bootstrap a flag insyz-view (nahoře v komponentě)**

V `App.jsx` za řádek `const isAdmin = container?.dataset?.isAdmin === 'true';` (cca ř. 22) přidat:

```javascript
    const insyzView = container?.dataset?.insyzView === 'true';

    // Bootstrap data ze serveru (anonymní INSYZ náhled) – nahrazuje /api/* volání
    const insyzBootstrap = (() => {
        if (!insyzView) return null;
        try {
            const el = document.getElementById('insyz-bootstrap');
            return el ? JSON.parse(el.textContent) : null;
        } catch (e) {
            return null;
        }
    })();
```

- [ ] **Step 2: Použít bootstrap místo API volání v `loadAllData`**

V `loadAllData` ([App.jsx:117-135]) nahradit načtení `orderData` a `reportData`:

```javascript
                // Load order data (head, predmety, useky)
                const orderData = insyzBootstrap
                    ? insyzBootstrap.orderData
                    : await api.prikazy.detail(prikazId);

                // Try to load existing report
                let reportData = null;
                if (insyzBootstrap) {
                    reportData = insyzBootstrap.reportData || null;
                } else {
                    try {
                        reportData = await api.prikazy.report(prikazId);
                        if (!reportData || !reportData.id || (reportData.id_zp && Object.keys(reportData).length === 1)) {
                            reportData = null;
                            log.info('Hlášení ještě neexistuje, bude vytvořeno nové');
                        } else {
                            log.info('Načteno existující hlášení', reportData);
                        }
                    } catch (error) {
                        log.error('Chyba při načítání reportu', error);
                        setAppData(prev => ({...prev, loading: false, error: 'Chyba při načítání dat hlášení'}));
                        return;
                    }
                }
```

- [ ] **Step 3: Použít bootstrap pro sazby**

V bloku „Load tariff rates" ([App.jsx:276-289]) nahradit fetch sazeb:

```javascript
                // Load tariff rates using shared parser
                let tariffRates = null;
                try {
                    let priceResponse;
                    if (insyzBootstrap) {
                        priceResponse = insyzBootstrap.sazby;
                    } else {
                        const executionDate = calculateExecutionDate(formData);
                        const dateParam = executionDate ? executionDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                        log.info('Načítám sazby pro datum:', dateParam);
                        priceResponse = await api.insyz.sazby(dateParam);
                    }
                    tariffRates = parseTariffRatesFromAPI(priceResponse);
                    log.info('Sazby úspěšně načteny', tariffRates);
                } catch (error) {
                    log.error('Chyba při načítání ceníku', error);
                }
```

- [ ] **Step 4: Použít bootstrap pro detaily uživatelů**

V bloku „Load user details" ([App.jsx:291-316]) nahradit paralelní fetch:

```javascript
                // Load user details for all team members
                let usersDetails = {};
                if (insyzBootstrap) {
                    usersDetails = insyzBootstrap.usersDetails || {};
                } else {
                    try {
                        const detailsPromises = teamMembers.map(member =>
                            api.insyz.user(member.INT_ADR)
                                .then(detail => ({ intAdr: member.INT_ADR, detail }))
                                .catch(error => {
                                    log.error(`Chyba při načítání detailů uživatele ${member.INT_ADR}`, error);
                                    return null;
                                })
                        );
                        const detailsArray = await Promise.all(detailsPromises);
                        usersDetails = detailsArray
                            .filter(item => item !== null)
                            .reduce((acc, item) => {
                                acc[item.intAdr] = item.detail;
                                return acc;
                            }, {});
                        log.info(`Načteny detaily ${Object.keys(usersDetails).length} uživatelů`, usersDetails);
                    } catch (error) {
                        log.error('Chyba při načítání detailů uživatelů', error);
                    }
                }
```

- [ ] **Step 5: Vynutit read-only + zobrazení všech členů v režimu náhledu**

Najít místo, kde se počítá `canEdit` a `isLeader` ([App.jsx:180-185]) a obalit je flagem:

```javascript
                // Check permissions
                const canEdit = insyzView ? false : checkUserPermissions(currentUser, teamMembers, formData.status);
                const isLeader = insyzView ? true : checkUserIsLeader(currentUser, teamMembers);
```

(Pozn.: ověřit přesné názvy proměnných v okolí ř. 180; pokud se `isLeader`/`canEdit` počítají na více místech, upravit konzistentně.)

- [ ] **Step 6: Build a manuální ověření**

Run: `ddev npm run build`
Pak otevřít platnou náhledovou URL (hash vygeneruj z Tasku 1: `strtoupper(sha1(secret . cisloZp))`) v anonymním okně:
`https://portalznackare.ddev.site/prikaz/{id}/hlaseni?insyz-hash=…`
Expected: hlášení se vyrenderuje read-only, bez editačních prvků, kompenzace všech členů, náhledy příloh viditelné, žádná 401 v konzoli.

- [ ] **Step 7: Checkpoint**

Náhled funguje, přihlášený tok beze změny. **Necommitovat.**

---

## Task 5: Výpočet nesouladu TIM (always-on)

**Files:**
- Create: `assets/js/apps/hlaseni-prikazu/utils/timMismatch.js`
- Modify: `assets/js/apps/hlaseni-prikazu/App.jsx`

- [ ] **Step 1: Vytvořit util pro výpočet nesouladu**

Create `assets/js/apps/hlaseni-prikazu/utils/timMismatch.js`:

```javascript
/**
 * Porovná hodnoty zapsané v hlášení (Stavy_Tim) proti aktuálním datům
 * z INSYZ (predmety). Porovnávají se jen pole, která pocházejí z INSYZ
 * a značkař je zároveň edituje: Rok_Vyroby a Smerovani.
 *
 * Nesoulad je informativní (hodnota od značkaře může být legitimně jiná –
 * tabulka byla v terénu vyměněna). Nenabízí se přepis.
 *
 * @param {Object} formData - hlášení (obsahuje Stavy_Tim)
 * @param {Array} predmety - INSYZ předměty
 * @returns {Object} mapa { [ID_PREDMETY]: { Rok_Vyroby?: insyzHodnota, Smerovani?: insyzHodnota } }
 */
export function computeTimMismatch(formData, predmety) {
    const result = {};
    if (!formData?.Stavy_Tim || !Array.isArray(predmety)) {
        return result;
    }

    // Index INSYZ předmětů podle ID_PREDMETY
    const insyzById = {};
    predmety.forEach(item => {
        if (item?.ID_PREDMETY != null) {
            insyzById[String(item.ID_PREDMETY)] = item;
        }
    });

    Object.values(formData.Stavy_Tim).forEach(timGroup => {
        (timGroup?.Predmety || []).forEach(status => {
            const id = String(status?.ID_PREDMETY ?? '');
            const insyz = insyzById[id];
            if (!id || !insyz) return;

            const diff = {};

            // Rok_Vyroby – porovnat jako řetězce (sjednotit prázdné/null)
            const repRok = status.Rok_Vyroby != null ? String(status.Rok_Vyroby).trim() : '';
            const insRok = insyz.Rok_Vyroby != null ? String(insyz.Rok_Vyroby).trim() : '';
            if (repRok !== '' && insRok !== '' && repRok !== insRok) {
                diff.Rok_Vyroby = insRok;
            }

            // Smerovani – porovnat kódy (L/P)
            const repSmer = (status.Smerovani ?? '').toString().trim();
            const insSmer = (insyz.Smerovani ?? '').toString().trim();
            if (repSmer !== '' && insSmer !== '' && repSmer !== insSmer) {
                diff.Smerovani = insSmer;
            }

            if (Object.keys(diff).length > 0) {
                result[id] = diff;
            }
        });
    });

    return result;
}

/** Lidsky čitelný popis směrování pro zobrazení. */
export function smerovaniLabel(kod) {
    if (kod === 'L') return 'Levá';
    if (kod === 'P') return 'Pravá';
    if (kod === 'N') return 'Nelze určit';
    return kod || '';
}
```

- [ ] **Step 2: Vypočítat `timMismatch` v App.jsx**

V `App.jsx` přidat import nahoře:

```javascript
import {computeTimMismatch} from './utils/timMismatch';
```

A vedle `teamMismatch` useMemo ([App.jsx:418]) přidat:

```javascript
    const timMismatch = useMemo(
        () => computeTimMismatch(appData.formData, appData.predmety),
        [appData.formData, appData.predmety]
    );
```

- [ ] **Step 3: Předat `timMismatch` do zobrazovacích komponent**

Najít, kde se v renderu App.jsx používá `StepContent` / `PartBSummary` / `PartBForm`, a předat jim prop `timMismatch={timMismatch}` (propojení v Tasku 6). Pokud jdou přes `StepContent`, přidat prop tam a dál.

- [ ] **Step 4: Build a ověření výpočtu**

Run: `ddev npm run build`
Manuálně: u hlášení, kde se zapsaný rok/směrování liší od INSYZ, ověřit v konzoli (`DEBUG_APPS=true`) nebo dočasným `log`, že `timMismatch` obsahuje očekávané položky.

- [ ] **Step 5: Checkpoint**

`computeTimMismatch` vrací správnou mapu. **Necommitovat.**

---

## Task 6: Inline zobrazení nesouladu (oranžový text)

**Files:**
- Create: `assets/js/apps/hlaseni-prikazu/components/TimMismatchNote.jsx`
- Modify: `assets/js/apps/hlaseni-prikazu/components/PartBSummary.jsx`
- Modify: `assets/js/apps/hlaseni-prikazu/components/PartBForm.jsx`

- [ ] **Step 1: Vytvořit komponentu poznámky**

Create `assets/js/apps/hlaseni-prikazu/components/TimMismatchNote.jsx`:

```javascript
import React from 'react';
import {smerovaniLabel} from '../utils/timMismatch';

/**
 * Nenápadná oranžová poznámka o nesouladu s INSYZ. Není to chyba –
 * jen upozornění, aby se data ověřila a případně opravila v INSYZ.
 *
 * @param {Object} diff - { Rok_Vyroby?: string, Smerovani?: string } pro daný předmět
 * @param {string} field - 'Rok_Vyroby' | 'Smerovani'
 */
export const TimMismatchNote = ({diff, field}) => {
    if (!diff || diff[field] == null || diff[field] === '') {
        return null;
    }

    const value = field === 'Smerovani' ? smerovaniLabel(diff[field]) : diff[field];

    return (
        <span className="text-xs text-orange-600 dark:text-orange-400 ml-2">
            V INSYZ je evidováno {value}
        </span>
    );
};
```

- [ ] **Step 2: Zobrazit nesoulad v read-only přehledu (`PartBSummary`)**

V `PartBSummary.jsx`:
- přidat import: `import {TimMismatchNote} from './TimMismatchNote';`
- přijmout prop `timMismatch = {}` v signatuře komponenty;
- u řádku, kde se vypisuje `itemStatus?.Rok_Vyroby` ([PartBSummary.jsx:110]), za hodnotu přidat:

```jsx
<TimMismatchNote diff={timMismatch[String(itemStatus?.ID_PREDMETY)]} field="Rok_Vyroby" />
```

- pokud je v přehledu zobrazeno i `Smerovani`, doplnit obdobně `field="Smerovani"`. (Pokud `Smerovani` přehled nezobrazuje, ponechat jen u dat, která se zobrazují.)

- [ ] **Step 3: Zobrazit nesoulad v editoru (`PartBForm`)**

V `PartBForm.jsx`:
- přidat import `TimMismatchNote`;
- přijmout prop `timMismatch = {}`;
- u inputu `Rok_Vyroby` ([PartBForm.jsx:474]) za pole přidat `<TimMismatchNote diff={timMismatch[String(itemStatus?.ID_PREDMETY)]} field="Rok_Vyroby" />`;
- u selectu `Smerovani` ([PartBForm.jsx:522]) obdobně `field="Smerovani"`.

- [ ] **Step 4: Propojit prop přes `StepContent`**

Pokud `App.jsx` renderuje `PartBSummary`/`PartBForm` přes `StepContent`, přidat `timMismatch` do props `StepContent` a předat dál na obě komponenty. Ověřit přesnou cestu props v `StepContent.jsx`.

- [ ] **Step 5: Build a vizuální ověření**

Run: `ddev npm run build`
Manuálně (light i dark mód):
- náhled hlášení s nesouladem → u dotčeného roku/směrování je drobný oranžový text „V INSYZ je evidováno …",
- text nepůsobí jako chyba (žádná ikona/rámeček), zobrazuje se jen u odlišných polí,
- stejné chování v editoru i v INSYZ náhledu.

- [ ] **Step 6: Checkpoint**

Nesoulad se zobrazuje inline, nenápadně, v obou režimech, v light i dark. **Necommitovat.**

---

## Task 7: Funkční dokumentace

**Files:**
- Create: `docs/features/insyz-hash-nahled-hlaseni.md`

- [ ] **Step 1: Napsat funkční dokumentaci**

Create `docs/features/insyz-hash-nahled-hlaseni.md` s těmito sekcemi (Czech):
- **Účel** — bezpečný read-only náhled kompletního hlášení pro správce INSYZ.
- **URL a hash** — `/prikaz/{id}/hlaseni?insyz-hash=…`; `insyz-hash = strtoupper(sha1(INSYZ_REPORT_HASH_SECRET . cisloZp))`; v URL je `id` (idZp), do hashe vstupuje `cisloZp`; klíč musí být identický v INSYZ.
- **Chování přístupu** — přihlášený = editor dle práv; anonym + platný hash = read-only náhled; jinak výzva k přihlášení.
- **Bootstrap** — server po ověření volá tytéž services jako `/api/insyz/prikaz`, `/api/portal/report`, `/api/insyz/sazby`, `/api/insyz/user` a vloží data do stránky; aplikace je čte místo `fetch`.
- **Detekce nesouladu** — porovnání `Rok_Vyroby` a `Smerovani` hlášení vs. INSYZ; inline oranžová poznámka; informativní, bez přepisu; funguje v editoru i náhledu.
- **Konfigurace** — `INSYZ_REPORT_HASH_SECRET` v `.env`.
- Cross-link na `docs/superpowers/specs/2026-06-18-insyz-hash-nahled-hlaseni-design.md`.

- [ ] **Step 2: Checkpoint**

Dokumentace vytvořena a provázaná. **Necommitovat** — předat uživateli k revizi a commitu.

---

## Závěrečné ověření (po všech taskech)

- [ ] `ddev exec vendor/bin/phpunit` — zeleně (hash služba)
- [ ] Přihlášený tok hlášení beze změny (žádná regrese)
- [ ] Anonymní náhled přes platný hash funguje, read-only, s náhledy příloh
- [ ] Neplatný/chybějící hash → 403 / výzva k přihlášení; neexistující hlášení → 404
- [ ] Nesoulad TIM se zobrazuje inline v editoru i náhledu, light i dark
- [ ] Žádné `/api/*` 401 chyby v konzoli náhledu
- [ ] **Žádné commity z mé strany** — vše předáno uživateli
