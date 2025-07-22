# Backend přehled

> **Backend dokumentace** - Přehled všech backend komponent a služeb Portálu značkaře

## 📋 Obsah

### 🎨 Vizuální komponenty
- **[Vizuální komponenty](../features/visual-components.md)** - Systém pro vykreslování turistických značek a TIM náhledů

### 🔧 Služby
- [ZnackaService](../features/visual-components.md#1-turistické-značky-znackaservice) - Turistické značky
- [TimService](../features/visual-components.md#2-tim-náhledy-timservice) - TIM náhledy  
- [TransportIconService](../features/visual-components.md#3-dopravní-ikony-transporticonservice) - Dopravní ikony
- [DataEnricherService](../features/visual-components.md#4-obohacování-dat-dataenricherservice) - Obohacování dat

### 🛠️ API
- [Workflow a datový tok](../features/visual-components.md#6-workflow-a-datový-tok) - Workflow a datový tok

---

## 🚀 Rychlý start

Pro implementaci značek a TIM náhledů:

1. **Server-side generování:** Všechny vizuální prvky jsou generované v PHP službách
2. **React integrace:** HTML/SVG se bezpečně vykresluje pomocí `dangerouslySetInnerHTML`
3. **Hybrid architektura:** Symfony/Twig + React micro-apps

```php
// Základní použití v PHP
$znackaService->znacka('CE', 'PA', 'PZT', 24);
$timService->timPreview($predmet);
$transportIconService->replaceIconsInText('Pokračuje k &BUS zastávce');
```

```javascript
// Vykreslování v React
const renderHtmlContent = (htmlString) => {
    if (!htmlString) return null;
    return <span dangerouslySetInnerHTML={{__html: htmlString}} />;
};
```

---

**Kompletní dokumentace:** [Vizuální komponenty](../features/visual-components.md)  
**Hlavní dokumentace:** [../overview.md](../overview.md)