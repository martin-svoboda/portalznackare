# Development Guide

Vývojové nástroje, debug systém a programátorská pravidla pro Portál značkaře.

## Programátorská pravidla

### Konvence názvů parametrů
Všechna uživatelská data používají český Snake_Case formát podle hierarchie **část → oblast → vlastnost**.

**Detailní pravidla:** [../architecture.md](../architecture.md#konvence-názvů-parametrů-povinné)

## Debug Systém

## Konfigurace

Debug systém používá environment proměnné pro aktivaci.

**Detailní konfigurace:** [../configuration.md](../configuration.md)

### Aktivace v aplikaci

Debug stav se předává z backendu do frontendu přes Twig template:

```twig
{# V base template nebo konkrétní stránce #}
<div id="app-root" data-debug="{{ app.debug ? 'true' : 'false' }}"></div>
```

## Frontend Debug Logger

### Základní použití

```javascript
import { log } from '../../utils/debug';

const MyComponent = () => {
    log.info('Component mounted');
    
    return <div>Content</div>;
};
```

### Dostupné metody

#### 1. Info (debug mode only)
```javascript
log.info('Component mounted', { props });
log.info('Data loaded', data);
log.info('Save started', formData);
```

#### 2. API Volání (debug mode only)
```javascript
log.api('POST', '/api/endpoint', requestData);
log.api('GET', '/api/data'); // bez data
```

#### 3. Varování (debug mode only)
```javascript
log.warn('Deprecated function used', { functionName: 'oldFunction' });
log.warn('Performance issue detected');
```

#### 4. Chyby (vždy loguje)
```javascript
try {
    // risky operation
} catch (error) {
    log.error('Operation failed', error);
}
```

## Výstup v konzoli

### Formát zpráv
```
[14:32:15] ℹ️ Component mounted
[14:32:16] 🔄 GET /api/data
[14:32:17] ⚠️ Performance issue detected
[14:32:18] ❌ Operation failed
```

## Best Practices

### 1. Systematické logování
```javascript
import { log } from '../../utils/debug';

const MyComponent = ({ data }) => {
    useEffect(() => {
        log.info('Component mounted', { dataLength: data.length });
    }, []);
    
    return <div>...</div>;
};
```

### 2. API volání
```javascript
const fetchData = async () => {
    log.api('GET', '/api/data');
    
    try {
        const response = await fetch('/api/data');
        const result = await response.json();
        return result;
    } catch (error) {
        log.error('API call failed', error);
        throw error;
    }
};
```

### 3. Form handling
```javascript
const handleSubmit = (formData) => {
    log.info('Form submission started', formData);
    
    try {
        const validation = validateForm(formData);
        if (validation.isValid) {
            submitForm(formData);
        }
    } catch (error) {
        log.error('Form validation failed', error);
    }
};
```

## Debug v různých prostředích

### Development
- Všechny logy aktivní
- Podrobné informace
- Performance monitoring

### Staging  
- Pouze chyby a kritické události
- Omezené API logy

### Production
- Pouze chyby
- Minimální performance impact

## Background Jobs (Symfony Messenger)

### Přehled
Symfony Messenger poskytuje asynchronní zpracování úloh v pozadí pomocí Message Bus pattern. Používá se pro náročné operace jako je odesílání do INSYZ systému.

### On-demand Worker Systém (2025-08-06)

**Kontext:** Optimalizace pro low-volume produkci (jednotky příkazů denně)

#### WorkerManagerService
```php
class WorkerManagerService {
    public function startSingleTaskWorker(): bool {
        $this->cleanupStuckWorkers(); // Vyčistí zaseknuté procesy > 5 minut
        
        if ($this->isWorkerRunning()) {
            return true;
        }
        
        // Spustí worker s timeout 60s pro jednu úlohu
        $command = sprintf(
            'cd %s && timeout 60 %s %s messenger:consume async --limit=1 --quiet > /dev/null 2>&1 &',
            escapeshellarg($this->projectRoot),
            escapeshellarg($phpBinary),
            escapeshellarg($consolePath)
        );
        
        exec($command);
        return $this->waitForWorkerStart();
    }
}
```

#### Smart Retry Logic
```php
#[AsMessageHandler]
class SendToInsyzHandler {
    private function shouldRetry(\Exception $e): bool {
        $message = strtolower($e->getMessage());
        
        // Retry pro dočasné chyby
        if (strpos($message, 'timeout') !== false ||
            strpos($message, 'connection') !== false) {
            return true;
        }
        
        // No retry pro permanent chyby
        if (strpos($message, 'authentication') !== false ||
            strpos($message, 'invalid') !== false) {
            return false;
        }
        
        return true; // Default: retry
    }
}
```

### Timeout Protection (3-vrstvé)

1. **Frontend:** 45s timeout s AbortController (useFormSaving.js)
2. **Backend:** 30s database statement timeout (PortalController)
3. **Worker:** 60s process timeout (WorkerManagerService)

### Konfigurace
```yaml
# config/packages/messenger.yaml
framework:
    messenger:
        transports:
            async:
                dsn: 'doctrine://default'
                options:
                    auto_setup: true
            failed:
                dsn: 'doctrine://default?queue_name=failed'
        routing:
            App\Message\SendToInsyzMessage:
                senders: ['async']
                retry_strategy:
                    max_retries: 3
                    delay: 1000
                    multiplier: 2
```

### INSYZ Submission Workflow
```php
// 1. Controller: dispatch + start worker
if ($reportDto->state === 'send') {
    $this->messageBus->dispatch($message);
    $this->workerManager->startSingleTaskWorker();
}

// 2. Handler: process with smart retry
public function __invoke(SendToInsyzMessage $message): void {
    try {
        $xmlData = $this->xmlGenerator->generateReportXml($reportData);
        $result = $this->insysService->submitReportToInsys($xmlData, $userIntAdr);
        $report->setState(ReportStateEnum::SUBMITTED);
    } catch (\Exception $e) {
        if ($this->shouldRetry($e)) {
            throw $e; // Re-throw pro retry
        }
        // Permanent failure - no retry
    }
}
```

### Database Transport
- **Výhoda:** Spolehlivé ukládání jobs v PostgreSQL
- **Konzumace:** Automatická přes on-demand worker
- **Monitoring:** Jobs jsou viditelné v `messenger_messages` tabulce
- **Cleanup:** Automatické odstraňování zaseknutých procesů

## Nástroje a rozšíření

### Browser Developer Tools
1. **Console filtering**: Použij `%c[ComponentName]` pro filtrování
2. **Network tab**: Pro sledování API volání
3. **Performance tab**: Pro sledování výkonu

### Doporučená rozšíření
- React Developer Tools
- Redux DevTools (pokud používáme)
- Network Monitor

## Troubleshooting

### Debug se nezobrazuje
1. Zkontroluj ENV proměnnou `DEBUG_APPS=true` pomocí `ddev exec "printenv | grep DEBUG"`
2. Ověř `data-debug="true"` v DOM elementu aplikace
3. Zkontroluj console filtry v Developer Tools
4. Pro DDEV: debug proměnné jsou nastavené automaticky v `.env`

### Příliš mnoho logů
1. Použij browser console filtry
2. Nastav specifické komponenty
3. Dočasně vypni některé typy logů

### Performance impact
1. Debug kód se spouští pouze v debug módu
2. Produkční build má minimal impact
3. Použij lazy evaluation pro expensive operations

## Příklady implementace

### Kompletní komponenta s debuggingem
```javascript
import React, { useState, useEffect, useCallback } from 'react';
import { log } from '../../utils/debug';

const MyComponent = ({ initialData }) => {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        log.info('Component mounted', { 
            hasInitialData: !!initialData,
            dataLength: initialData?.length || 0 
        });
    }, []);
    
    const handleLoadData = useCallback(async () => {
        log.info('Data loading started');
        setLoading(true);
        
        try {
            log.api('GET', '/api/data');
            const response = await fetch('/api/data');
            const result = await response.json();
            
            setData(result);
            log.info('Data loaded successfully', { count: result.length });
            
        } catch (error) {
            log.error('Failed to load data', error);
        } finally {
            setLoading(false);
            log.info('Data loading finished');
        }
    }, []);
    
    return (
        <div>
            {loading ? 'Loading...' : `Data items: ${data.length}`}
            <button onClick={handleLoadData}>Reload</button>
        </div>
    );
};

export default MyComponent;
```

Tento debug systém umožňuje efektivní ladění a monitoring aplikací ve všech fázích vývoje.

## Hlavní řidič a kompenzace (Hlášení příkazů)

### Změna systému (2025-08-06)
**Před:** Ma_Zvysenou_Sazbu per skupina (duplicity řidičů)  
**Po:** Hlavni_Ridic globální (unikátní řidiči)

### Implementační detaily
```javascript
// TravelGroupsForm.jsx - Výběr unikátních řidičů
const uniqueDrivers = useMemo(() => {
    const driverMap = new Map();
    travelGroups.forEach(group => {
        if (group.Ridic) {
            const driver = teamMembers.find(m => m.INT_ADR === group.Ridic);
            if (driver && !driverMap.has(group.Ridic)) {
                const totalKmForDriver = travelGroups
                    .filter(g => g.Ridic === group.Ridic)
                    .reduce((total, g) => total + calculateGroupKilometers(g), 0);
                
                driverMap.set(group.Ridic, {
                    ...driver,
                    totalKm: totalKmForDriver,
                    groups: travelGroups.filter(g => g.Ridic === group.Ridic).length
                });
            }
        }
    });
    return Array.from(driverMap.values());
}, [travelGroups, teamMembers]);

// compensationCalculator.js - Hlavní řidič = zvýšená sazba na VŠECHNY AUV jízdy
const isUserMainDriver = formData.Hlavni_Ridic === userIntAdr;
const rate = isUserMainDriver ? priceList.jizdneZvysene : priceList.jizdne;

formData.Skupiny_Cest?.forEach(group => {
    if (group.Ridic === userIntAdr) {
        group.Cesty?.forEach(segment => {
            if (segment.Druh_Dopravy === 'AUV' && segment.Kilometry > 0) {
                result.transport += segment.Kilometry * rate;
            }
        });
    }
});

// useFormSaving.js - Serializace Hlavni_Ridic
data_a: {
    Datum_Provedeni: formatDateOnly(formData.Datum_Provedeni),
    Hlavni_Ridic: formData.Hlavni_Ridic || null, // Globální hlavní řidič
    Skupiny_Cest: formData.Skupiny_Cest.map(serializeTravelGroup)
}
```

### Error Handling Patterns
```javascript
// Frontend timeout protection
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 45000);

try {
    const response = await api.prikazy.saveReport(data, { 
        signal: controller.signal,
        timeout: 45000 
    });
} catch (error) {
    if (error.name === 'AbortError') {
        showNotification('warning', 'Odesílání trvá déle než obvykle...');
    }
} finally {
    clearTimeout(timeoutId);
}
```

## 🧪 Test API Endpointy

**Base URL:** `/api/test/`  
**Účel:** Development nástroje pro testování a debugging  
**Dostupné pouze v development módu**

### GET `/api/test/insys-user`
Test uživatelských dat z INSYS bez autentifikace.

**Response:**
```json
{
    "INT_ADR": 1234,
    "JMENO": "Test",
    "PRIJMENI": "Značkář",
    "EMAIL": "test@test.com"
}
```

### GET `/api/test/insys-prikazy`
Test seznam příkazů z INSYS bez autentifikace.

### GET `/api/test/mssql-connection`
Test MSSQL připojení a konfigurace.

**Response (test mode):**
```json
{
    "status": "test_mode",
    "message": "Using test data, MSSQL not tested"
}
```

### POST `/api/test/login-test`
Test login mechanismu s debug informacemi.

**Request:**
```json
{
    "email": "test@test.com",
    "hash": "test123"
}
```

### Development Health Check
```bash
# Kompletní health check
curl -s "https://portalznackare.ddev.site/api/test/insys-user"
curl -s "https://portalznackare.ddev.site/api/test/mssql-connection"

# Test messenger worker
ddev exec php bin/console messenger:consume async --limit=1

# Kontrola zaseknutých procesů
ddev exec ps aux | grep messenger:consume
```