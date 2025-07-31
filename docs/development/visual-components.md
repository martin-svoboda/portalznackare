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

```php
// src/Service/TimService.php
public function timPreview(array $item): string {
    $lines = $this->getItemLines($item);        // Texty z Radek1, Radek2, Radek3
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
public function replaceIconsInText(string $text, int $iconSize = 10, bool $hideIcon = false): string {
    $iconMap = [
        'BUS' => 'getBusIcon',    'MHD' => 'getBusIcon',
        'ŽST' => 'getTrainIcon',  'ZST' => 'getTrainIcon',
        'TRAM' => 'getTramIcon',  'LAN' => 'getLanIcon',
        'KAB' => 'getKabIcon',    'PARK' => 'getParkIcon'
    ];
    
    // Nahradí &BUS, &ŽST,TRAM za SVG ikony
    return preg_replace_callback('/&([A-ZÁĚŠČŘŽÝÚŮÍÓ.,]+)/ui', function($matches) {
        $iconKeys = explode(',', $matches[1]);
        $result = '';
        foreach ($iconKeys as $key) {
            $result .= $this->generateTransportIcon($key, $iconSize);
        }
        return $result;
    }, $text);
}
```

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
// assets/js/apps/prikaz-detail/App.jsx
// Funkce pro bezpečné renderování HTML z backendu
const renderHtmlContent = (htmlString) => {
    if (!htmlString) return null;
    return <span dangerouslySetInnerHTML={{__html: htmlString}} />;
};

// Použití enriched dat z API
const replaceTextWithIcons = (text) => {
    if (!text) return '';
    // Pokud text obsahuje HTML (ze serveru), render jako HTML
    if (text.includes('<')) {
        return renderHtmlContent(text);
    }
    return text;  // Jinak plain text
};

// V komponentě
<div className="flex items-center gap-2">
    {item.Znacka_HTML && renderHtmlContent(item.Znacka_HTML)}
    {item.Tim_HTML && renderHtmlContent(item.Tim_HTML)}
    <span>{replaceTextWithIcons(item.Naz_TIM)}</span>
</div>
```

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
# Testování značek přes API
curl "https://portalznackare.ddev.site/api/test/insys-prikaz/123" | jq '.predmety[0].Znacka_HTML'

# Testování TIM náhledů
curl "https://portalznackare.ddev.site/api/test/insys-prikaz/123" | jq '.predmety[0].Tim_HTML'

# Testování dopravních ikon v textech
curl "https://portalznackare.ddev.site/api/test/insys-prikaz/123" | jq '.predmety[0].Naz_TIM'
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

**Propojené funkcionality:** [Správa příkazů](prikazy-management.md) | [INSYS Integration](insys-integration.md)  
**API Reference:** [../api/insys-api.md](../api/insys-api.md)  
**Styling:** [../architecture.md](../architecture.md)  
**Aktualizováno:** 2025-07-22