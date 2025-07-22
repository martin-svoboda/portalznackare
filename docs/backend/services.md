# Backend služby

> **Backend služby přehled** - Všechny PHP služby a jejich zodpovědnosti

## Přehled služeb

Backend aplikace je organizován do specializovaných PHP služeb s jasnou zodpovědností:

### 🎨 Vizuální služby
- **[ZnackaService](../features/visual-components.md#1-turistické-značky-znackaservice)** - SVG generování turistických značek
- **[TimService](../features/visual-components.md#2-tim-náhledy-timservice)** - TIM náhledy s HTML výstupem
- **[TransportIconService](../features/visual-components.md#3-dopravní-ikony-transporticonservice)** - Dopravní ikony (&BUS, &ŽST, atd.)
- **[ColorService](../features/visual-components.md)** - Mapování barev pro značky

### 🔧 Integrace a data
- **InsysService** - MSSQL/INSYS API wrapper  
- **MockMSSQLService** - Mock data pro development
- **[DataEnricherService](../features/visual-components.md#4-obohacování-dat-dataenricherservice)** - Obohacování API dat o HTML/SVG
- **MssqlConnector** - MSSQL database connector

### 📁 File management
- **FileUploadService** - Upload a správa souborů s hash tokeny

### 🗣️ Lokalizace
- **CzechVocativeService** - České skloňování jmen do 5. pádu
- **MarkdownService** - Markdown zpracování

### Ukázky použití

#### ZnackaService
```php
// Generování SVG značky
$znackaService->znacka('CE', 'PA', 'PZT', 24);
// → vrací SVG string s červenou pásovou značkou

$znackaService->renderZnacka('MO', 'V', 'CZT', 32);
// → vrací SVG string s modrou vyhlídkou pro cyklo
```

#### TimService  
```php
// Kompletní TIM náhled s ikonami a šipkami
$timService->timPreview($predmet);
// → vrací HTML string s TIM náhledem
```

#### CzechVocativeService
```php
// České skloňování pro oslovení
$vocativeService->createTimeBasedGreeting('Martin');
// → "Dobrý večer, Martine" (podle času)

$vocativeService->toVocative('Pavel'); 
// → "Pavle"
```

#### DataEnricherService
```php
// Obohacení API dat o HTML komponenty
$enrichedData = $dataEnricher->enrichPrikazDetail($detail);
// → přidá Znacka_HTML, Tim_HTML do každého předmětu
```

---

**Kompletní backend:** [overview.md](overview.md)  
**Hlavní dokumentace:** [../overview.md](../overview.md)  
**Aktualizováno:** 2025-07-21