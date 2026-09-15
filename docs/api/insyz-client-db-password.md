# Vydávání hesel k INSYZ databázím pro desktopového klienta

Endpoint, přes který si desktopový klient INSYZ (.NET) vyzvedne heslo k databázovému
účtu místo toho, aby ho měl natvrdo v binárce. Dočasné řešení, než INSYZ nahradí NG.

**Zdroj:** `src/Controller/Api/InsyzClientController.php`,
`src/Service/InsyzClientCredentialsService.php`,
`src/Service/InsyzClientConnectionPool.php`

> Tenhle dokument záměrně neobsahuje žádné identifikátory účtů, názvy serverů, názvy
> proměnných prostředí ani parametry šifrování. Konkrétní hodnoty jsou v konfiguraci
> aplikace a v kódu; komu je poslat, řeší správce Portálu mimo tenhle soubor.

---

## Kontrakt (pro autora klienta)

```
POST https://<portál>/api/insyz-client/db-password
Content-Type: application/json
```

### Požadavek

```json
{
  "user": "prihlasovaci_jmeno",
  "password": "heslo_uzivatele",
  "key": "identifikator_uctu"
}
```

| Pole | Typ | Popis |
|------|-----|-------|
| `user` | string | Přihlašovací jméno uživatele v INSYZ |
| `password` | string | Heslo uživatele v otevřené podobě |
| `key` | string | Identifikátor databázového účtu. **Rozlišují se velká a malá písmena.** Seznam platných hodnot dostane autor klienta zvlášť. |

Všechna tři pole jsou povinná a neprázdná.

### Odpověď — úspěch

```
HTTP 200
{ "password": "heslo_k_databazi" }
```

Vrací se **jen heslo** k jednomu účtu. Connection string si klient skládá sám.

### Odpověď — neúspěch

```
HTTP 401
{ "error": "Přístup byl odmítnut." }
```

Tahle jedna odpověď pokrývá **všechny** důvody selhání: neznámý klíč, neznámý uživatel,
špatné heslo, uživatel bez účtu v systému, překročený limit pokusů, nevalidní tělo
požadavku, požadavek po HTTP i nedostupná databáze. Klient z odpovědi nepozná, co přesně selhalo —
je to záměr, aby endpoint nešel použít ke zjišťování existence účtů ani k výčtu klíčů.
Konkrétní důvod je jen v logu Portálu.

### Co musí klient dodržet

- **Jen HTTPS.** Požadavek po nešifrovaném HTTP je odmítnut (401).
- **Jen POST.** Jiná metoda vrátí 404.
- **Neukládat vrácené heslo na disk** — držet ho v paměti po dobu běhu a při dalším
  spuštění si o něj říct znovu.
- **Nezkoušet opakovaně při 401.** Po deseti neúspěšných pokusech v patnáctiminutovém
  okně se blokuje jak IP adresa, tak uživatelské jméno; každý další pokus okno posouvá.
  Při 401 tedy vypiš chybu uživateli a čekej na jeho akci, nedělej automatický retry.
- Potřebuje-li klient víc účtů najednou, zavolá endpoint opakovaně, jednou na každý klíč.

---

## Co endpoint dělá na straně Portálu

1. Ověří, že požadavek přišel po HTTPS a že tělo obsahuje všechna tři pole.
2. Zkontroluje limit neúspěšných pokusů (per IP i per uživatel).
3. Přeloží klíč na účet z konfigurace. Neznámý klíč končí hned — bez pokusu o spojení.
4. Připojí se **do databáze toho účtu, kterého se klíč týká**, a jedním parametrizovaným
   dotazem načte uložené heslo uživatele a zjistí, jestli má v systému účet.
5. Dešifruje uložené heslo a porovná ho s poslaným přes `hash_equals()`.
6. Ověří, že uživatel je vedený v systémové tabulce uživatelů — kdo v ní není, nemá
   v systému žádná práva a heslo nedostane.
7. Vrátí heslo a vynuluje čítače neúspěchů.

**Nic dalšího se nekontroluje**, a to záměrně: ověření odpovídá přesně tomu, co vyžaduje
samotná desktopová aplikace. Funkce pro kontrolu zámku účtu se nepoužívá (kontroluje SQL
login a na tomhle hostingu vrací `NULL` pro každého) a sloupec s platností hesla se
nevynucuje — klient podle něj přihlášení neblokuje, takže kdyby ho endpoint vyžadoval,
odmítal by uživatele, které aplikace normálně pustí.

### Ověření je vždy v databázi daného klíče

Portál se do databáze přihlašuje tímtéž účtem, o jehož heslo klient žádá — spojení se
skládá z hesla, které už v konfiguraci je, takže nepřibývá žádné další tajemství.
Spojení se drží zvlášť pro každý klíč (`InsyzClientConnectionPool`) a jen po dobu requestu.

Když je databáze daného klíče nedostupná nebo v ní tabulka uživatelů není, požadavek
skončí stejnou generickou chybou. **Žádný fallback na produkční databázi neexistuje** —
ověřit uživatele proti jiné databázi, než které se klíč týká, endpoint neumí.

### Dešifrování uloženého hesla

Sloupec s heslem používá stávající schéma INSYZ: DES-CBC s PKCS#7 paddingem, výstup
base64, text v UTF-16LE. Klíč i IV jsou fixní parametry toho schématu — v kódu jsou
v `InsyzLegacyPasswordCipher`, v tomhle dokumentu ne.

DES není volán přes `openssl_decrypt()`: v OpenSSL 3 spadl do legacy provideru, který
na PHP 8.3 není aktivní a nejde zapnout z kódu (`digital envelope routines::unsupported`).
`InsyzLegacyPasswordCipher` proto obsahuje vlastní implementaci DES — ověřenou proti
`openssl` s ručně zapnutým legacy providerem (27 vektorů včetně diakritiky, mezer
a náhodných vstupů).

---

## Konfigurace

Účty jsou v parametru `insyz_client.accounts` v `config/services.yaml`, jeden blok na účet:
server, databáze, přihlašovací jméno a heslo. Heslo se načítá z proměnné prostředí, ostatní
položky jsou přímo v parametru — nejsou to tajemství.

```yaml
parameters:
    insyz_client.accounts:
        <identifikátor účtu>:
            host: '<server>'
            database: '<databáze>'
            user: '<přihlašovací jméno>'
            password: '%env(<proměnná s heslem>)%'
```

V `.env` jsou u proměnných s hesly jen prázdné defaulty a komentář. **Hodnoty patří
výhradně do `.env.local` nebo do prostředí serveru, nikdy do gitu.** Vedle nich je
přepínač, kterým se vyžaduje HTTPS — na produkci i dev serveru musí být zapnutý,
lokálně se dá vypnout.

Nový databázový účet = nový blok v parametru + nová proměnná s heslem + ověření
příkazem níže.

### Ověření účtů

```bash
php bin/console insyz:client:check                       # všechny nakonfigurované účty
php bin/console insyz:client:check <identifikátor účtu>  # jen jeden
```

Příkaz se do každé databáze připojí a zkontroluje, že v ní jsou obě tabulky se sloupci,
které ověření potřebuje. Když některý sloupec chybí, vypíše rovnou seznam sloupců, co
v té tabulce doopravdy jsou. Pouští se **na serveru** — lokální DDEV nemá
PDO driver `sqlsrv` ani síťovou cestu do INSYZ. Účet, který v tomhle příkazu neprojde,
nemá v konfiguraci co dělat.

### Vydávají se jen účty s omezenými právy

Každá databáze má dva účty: vlastníka databáze a účet jen pro čtení a zápis. Endpoint
vydává **výhradně ten druhý** — desktopový klient na něm běžně jede a víc nepotřebuje.
Heslo vlastníka se nevydává: kdyby si ho mohl vyzvednout kdokoli s účtem v INSYZ, měl by
plná práva na databázi, což je přesně ten stav, který endpoint zavírá.

Dřívější obava, že vlastníka vyžaduje změna hesla uživatele, na tomhle hostingu neplatí —
větev klienta, která ho k tomu používala, se tu nespustí (je to pozůstatek dřívějšího
provozu, kde měl každý uživatel vlastní databázový login).

Nový klíč se zapojuje takto: ověřit účet příkazem `insyz:client:check`, pak přidat blok
do parametru a proměnnou s heslem. Do té doby dostane klient na ten klíč stejné 401 jako
na kterýkoli neznámý.

### Předpoklad nasazení: reálná IP klienta

Endpoint bere IP z `Request::getClientIp()` a HTTPS z `Request::isSecure()`. Pokud PHP
na serveru běží za reverzní proxy, která ukončuje TLS, musí být v Symfony nastavené
`framework.trusted_proxies` — jinak endpoint uvidí IP proxy (throttling per IP by pak
platil globálně pro všechny klienty) a případně i požadavek jako nešifrovaný.
Projekt dnes `trusted_proxies` nastavené nemá; před nasazením je potřeba ověřit, jak
je server postavený.

---

## Logování

Každý požadavek jde do kanálu `api` (dev: `var/log/api.log`, prod: stderr) s poli
`time`, `ip`, `user`, `key`, `result` (`success`/`failure`) a `reason` u neúspěchu.

Důvody: `unknown_key`, `unknown_user`, `bad_password`, `no_system_account`, `throttled`,
`invalid_request`, `insecure_transport`, `internal_error: …`.

**Heslo uživatele ani vydané heslo k databázi se do logu nikdy nezapisuje** — pokryto
testem.

---

## Lokální vývoj

Při zapnutých testovacích datech se do MSSQL nechodí a ověření projde jen mock účtu
(prochází stejným dešifrováním jako produkce). Pro vyzkoušení je potřeba mít v `.env.local`
vyplněnou aspoň jednu proměnnou s heslem, jinak se každý klíč chová jako neznámý.

---

## Testy

```bash
ddev exec vendor/bin/phpunit --filter InsyzClient
ddev exec vendor/bin/phpunit --filter InsyzLegacyPasswordCipher
```

- `tests/Service/InsyzLegacyPasswordCipherTest.php` — dešifrování proti referenčním
  vektorům z `openssl`, diakritika, poškozené vstupy
- `tests/Service/InsyzClientCredentialsServiceTest.php` — klíče, ověření hesla,
  existence systémového účtu, parametrizovaný dotaz, ověření v databázi daného klíče,
  nedostupná databáze bez fallbacku, mock režim
- `tests/Controller/Api/InsyzClientControllerTest.php` — jednotná chybová odpověď,
  validace těla, HTTPS, throttling, obsah logu
