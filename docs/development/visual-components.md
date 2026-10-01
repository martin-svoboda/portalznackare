# Vizuální komponenty - Značky a TIM náhledy

> **Funkcionální oblast** - Kompletní systém pro generování turistických značek, TIM náhledů a ikon

## 📋 Přehled vizuálních komponent

### Architektura komponent
```
Backend Services → Twig Functions/Filters → Frontend HTML/SVG
     ↓                    ↓                       ↓
ZnackaService      kct_znacka()        SVG značky <svg>
TimService         kct_tim_preview()   TIM náhledy HTML
TransportIconService  (via DataEnricher)  Dopravní ikony
```

**Klíčové principy:**
- **Server-side rendering:** Všechny komponenty generují HTML/SVG na backendu
- **SVG značky:** Matematicky přesné značky podle KČT standardů
- **Data enrichment:** Automatické obohacování dat v API vrstvě
- **Twig integrace:** Přímé použití v šablonách přes extension

## 🛠️ Backend Services

### 1. **ZnackaService** - Generování SVG značek

```php
// src/Service/ZnackaService.php
public function znacka(
    ?string $barvaKod = '',      // CE, MO, ZE, ZL, BI, etc.
    ?string $tvar = 'PA',        // PA, MI, NS, SN, Z, S, V, P, VO  
    ?string $presun = 'PZT',     // PZT, LZT, CZT, CZS, JZT, VZT
    int $size = 24
): string {
    return $this->renderZnacka($barvaKod, $tvar, $presun, $size);
}

// Podporované tvary značek:
switch ($tvar) {
    case "PA":  // Pásová (základní)
    case "CT":  // CTZ terénní  
    case "DO":  // CTZ silniční
        return $this->renderPasovaZnacka(...);
    case "Z":   // Zřícenina
        return $this->renderZriceninaZnacka(...);
    case "S":   // Studánka/pramen
        return $this->renderStudankaZnacka(...);
    case "V":   // Vrchol/vyhlídka
        return $this->renderVrcholZnacka(...);
    case "P":   // Pomník
        return $this->renderPomnikZnacka(...);
    case "MI":  // Místní značka
        return $this->renderMistniZnacka(...);
    case "NS":  case "SN":  // Naučná stezka (vždy zelená)
        return $this->renderNaucnaZnacka(...);
    case "VO":  // Vozíčkářská
        return $this->renderVozickarskaZnacka(...);
}
```

### 2. **TimService** - TIM náhledy

**Řádky textu (`getItemLines`, INSYZ-308/328)** – sdílí náhled TIM i PDF kontrolního formuláře:
- směrovky `S/D/O/Z` a TMN `M`: `Radek1` → `Meziradek_12` → `Radek2` → `Meziradek_23` → `Radek3`, meziřádky 1:1 bez km – na směrovce menším písmem vlevo, na TMN stejně velké jako řádky 2 a 3
- TMN: výška jen jednou z `Nadmorska_vyska` (INSYZ ji posílá i v `Radek2`/`Meziradek_12`)
- TVM `V`: jen `Radek1` (název) + `Meziradek_12` (měřítko); `Radek3` je servisní poznámka INSYZ
- tabulky (`T/B/I/Q/P`) zatím jen `Radek1–3`; `Zahlavi`, `Pojmenovani`, `Pomocny_radek` se zatím nezobrazují

```php
// src/Service/TimService.php
public function timPreview(array $item): string {
    $lines = $this->getItemLines($item);        // Radek1–3 + meziřádky (viz níže)
    $showArrow = ($item['Druh_Predmetu'] ?? '') === "S" || "D";
    $direction = $item['Smerovani'] ?? '';      // P = pravá, L = levá
    
    // Barva podkladu podle přesunu
    $barvaPodkladu = $this->getBarvaPodkladu($item['Druh_Presunu']);
    
    // Generuje kompletní HTML s inline styly pro TIM náhled
    return $this->generateTimHtml($item, $lines, $showArrow, $direction);
}

// Speciální zpracování pro typy TIM
private function renderTextContent(string $text, bool $hideIcon = false): string {
    // Nahradí dopravní ikony (&BUS, &ŽST → SVG)
    $text = $this->transportIconService->replaceIconsInText($text, 10, $hideIcon);
    
    // Rozdělí text podle závorek a obalí do <small>
    return preg_replace('/(\([^)]*\))/', '<small>$1</small>', $text);
}
```

### 3. **TransportIconService** - Dopravní ikony

```php
// src/Service/TransportIconService.php
public function replaceIconsInText(string $text, int $iconSize = 10, bool $hideIcon = false, bool $forPdf = false): string
```

- Nahradí `&BUS`, `&ŽST,TRAM` … za SVG ikony (`BUS/MHD`, `ŽST/ZST`, `TRAM`, `LAN`, `KAB`, `PARK`).
- **Výstup je HTML** – vkládá se bez escapování na web (`renderHtmlContent`) i do PDF (`|raw`).
  Proto se **text z INSYZ escapuje** (`htmlspecialchars`), a to **jen mimo kódy ikon** –
  escapování celého textu předem by z `&bus` udělalo `&amp;bus` a kód by se nerozpoznal.
- Neznámý kód se vrátí escapovaný bez `&` (dosavadní chování).
- Totéž platí pro `TimService::timPreview()` (řádky jdou přes `replaceIconsInText`, `Rok_Vyroby`
  a `EvCi_TIM` se escapují zvlášť).
- Testy: `tests/Service/TransportIconServiceTest.php`

## 🎨 Twig Integration

### **KctExtension** - Twig funkce a filtry

```php
// src/Twig/KctExtension.php
public function getFunctions(): array {
    return [
        // Značky
        new TwigFunction('kct_znacka', [$this->znackaService, 'znacka'], ['is_safe' => ['html']]),
        
        // TIM komponenty
        new TwigFunction('kct_tim_preview', [$this->timService, 'timPreview'], ['is_safe' => ['html']]),
        
        // Barvy
        new TwigFunction('kct_barva_kod', [$this->colorService, 'barvaDleKodu']),
        new TwigFunction('kct_barva_presun', [$this->colorService, 'barvaDlePresunu']),
    ];
}

public function getFilters(): array {
    return [
        new TwigFilter('kct_znacka', [$this->znackaService, 'znacka'], ['is_safe' => ['html']]),
        new TwigFilter('kct_replace_icons', [$this, 'replaceIconsInText'], ['is_safe' => ['html']]),
    ];
}
```

### **Použití v Twig šablonách**

```twig
{# Základní značka #}
{{ kct_znacka('CE', 'PA', 'PZT', 24) }}

{# TIM náhled z API dat #}
{{ kct_tim_preview(predmet) }}

{# Filtry #}
{{ 'CE'|kct_znacka('PA', 'PZT', 16) }}
{{ 'Trasa k &BUS a &ŽST'|kct_replace_icons }}

{# Barvy #}
<div style="color: {{ kct_barva_kod('CE') }}">Červená trasa</div>
<div class="{{ kct_tailwind_barva('MO') }}">Modrá značka</div>
```

## ⚛️ React Integration

### **HTML rendering v React komponentách**

```jsx
// assets/js/utils/htmlUtils.js – sdílené pro všechny appky
import { renderHtmlContent, replaceTextWithIcons } from '@utils/htmlUtils';

<div className="flex items-center gap-2">
    {item.Znacka_HTML && renderHtmlContent(item.Znacka_HTML)}
    {item.Tim_HTML && renderHtmlContent(item.Tim_HTML)}
    <span>{replaceTextWithIcons(item.Naz_TIM)}</span>
</div>
```

- `renderHtmlContent` **vždy sanitizuje** přes DOMPurify (`sanitizeHtml`) – odstraní skripty,
  `on*` atributy a `javascript:` URL; SVG ikony, styly a `<img>` s data URI zachová.
  Je to druhá pojistka k escapování na serveru. Jinde v appkách se `dangerouslySetInnerHTML` nepoužívá.
- `replaceTextWithIcons` vykreslí jako HTML text s tagy **nebo entitami** (`<`, `&`) – server posílá
  escapovaný text (`Hrad &amp; zámek`), který se musí dekódovat.
- **Text od uživatele** (místa, položky, poznámky) a pole, která server neobohacuje
  (např. `Poznamka` předmětu), se vypisují jako **prostý text v JSX**, nikdy přes HTML.
- Testy: `assets/js/utils/__tests__/htmlUtils.test.js`

## 🔄 Data Enrichment Flow

### **Automatické obohacování v API**

```php
// src/Service/DataEnricherService.php
public function enrichPrikazDetail(array $detail): array {
    if (isset($detail['predmety'])) {
        $detail['predmety'] = array_map(function($predmet) {
            // SVG značka podle barvy a tvaru
            $predmet['Znacka_HTML'] = $this->znackaService->znacka(
                $predmet['Barva_Kod'] ?? null,
                ($predmet['Druh_Odbocky_Kod'] ?? null) ?: ($predmet['Druh_Znaceni_Kod'] ?? null),
                $predmet['Druh_Presunu'] ?? null,
                24
            );

            // Komplexní TIM náhled
            if (isset($predmet['Radek1'])) {
                $predmet['Tim_HTML'] = $this->timService->timPreview($predmet);
            }

            // Dopravní ikony v textech
            if (isset($predmet['Naz_TIM'])) {
                $predmet['Naz_TIM'] = $this->transportIconService->replaceIconsInText($predmet['Naz_TIM']);
            }
            
            return $predmet;
        }, $detail['predmety']);
    }
    
    return $detail;
}
```

## 🎯 Typy značek a jejich kódy

### **Barvy (Barva_Kod)**
- `CE` - červená
- `MO` - modrá 
- `ZE` - zelená
- `ZL` - žlutá
- `BI` - bílá
- `KH` - khaki (podklad)
- `BE` - bezbarvá
- `CA` - černá

### **Tvary značek (Druh_Znaceni_Kod / Druh_Odbocky_Kod)**
- `PA` - pásové značky (základní)
- `MI` - místní značky
- `NS`, `SN` - naučné stezky (vždy zelené)
- `VO` - vozíčkářské (symbol vozíčkáře)
- `CT` - CTZ terénní
- `DO` - CTZ silniční
- `Z` - zřícenina
- `S` - pramen/studánka
- `V` - vrchol/vyhlídka
- `P` - pomník/zajímavé místo

### **Druhy přesunu (Druh_Presunu)**
- `PZT` - pěší turistické značení
- `LZT` - lyžařské značení
- `CZT` - cykloturistické terénní
- `CZS` - cykloturistické silniční
- `JZT` - jezdecké značení
- `VZT` - vozíčkářské značení

## 🚌 Dopravní ikony

### **Podporované ikony (TransportIconService)**
- `&BUS`, `&MHD` - autobus/městská hromadná doprava
- `&ŽST`, `&ZST` - železniční stanice
- `&TRAM` - tramvaj
- `&LAN` - lanovka
- `&KAB` - kabinková lanovka
- `&PARK` - parkoviště

### **Použití v textech**
```
"Trasa vede k &BUS a pokračuje k &ŽST,TRAM"
↓ (po zpracování)
"Trasa vede k 🚌 a pokračuje k 🚂🚋"
```

## 📊 TIM náhledy

### **Typy TIM předmětů**
- `S` - směrovka (s šipkou L/P)
- `D` - doplňková směrovka (s šipkou L/P) 
- `M` - tabulka místního názvu
- Ostatní - standardní informační tabule

### **Struktura TIM dat**
```json
{
    "EvCi_TIM": "1234",
    "Predmet_Index": "A",
    "Druh_Predmetu": "S",
    "Smerovani": "P",
    "Barva_Kod": "CE",
    "Druh_Presunu": "PZT",
    "Radek1": "Karlštejn &HRAD",
    "Radek2": "",
    "Radek3": "",
    "KM1": "2.5",
    "KM2": null,
    "KM3": null,
    "Rok_Vyroby": "2023"
}
```

## 🧪 Testing

```bash
# Detail příkazu z /api/insyz/prikaz/{id} (vyžaduje přihlášenou session a hlavičku X-CSRF-Token –
# nejsnáze v DevTools na stránce portálu: await (await fetch('/api/insyz/prikaz/123')).json())
# Značky:          .predmety[0].Znacka_HTML
# TIM náhledy:     .predmety[0].Tim_HTML
# Dopravní ikony:  .predmety[0].Naz_TIM
```

## 🛠️ Troubleshooting

### **Značky se nezobrazují**
- Zkontroluj parametry: `barvaKod`, `tvar`, `presun`
- Ověř ColorService má správné barvy
- Kontrola SVG syntaxe ve výstupu

### **TIM náhledy chybí**
- Zkontroluj existenci `Radek1`, `Radek2`, `Radek3`
- Ověř `Druh_Predmetu` pro šipky (S/D)
- Kontrola `Smerovani` (P/L) pro směr šipek

### **Dopravní ikony se nenahrazují**
- Zkontroluj formát `&TAG` (musí začínat &)
- Ověř podporované tagy v `TransportIconService`

---

**Propojené funkcionality:** [Správa příkazů](../features/prikazy-management.md) | [INSYZ Integration](../features/insyz-integration.md)  
**API Reference:** [../api.md](../api.md#insyz-data)  
**Styling:** [../architecture.md](../architecture.md)  
**Aktualizováno:** 2026-09-25