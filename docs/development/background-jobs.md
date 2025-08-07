# Background Jobs (Symfony Messenger)

> **Asynchronní zpracování** úloh v pozadí pro náročné operace jako odesílání do INSYZ systému

## Přehled

Symfony Messenger poskytuje asynchronní zpracování úloh v pozadí pomocí Message Bus pattern. Systém je optimalizovaný pro low-volume produkci (jednotky příkazů denně).

## On-demand Worker Systém

**Kontext:** Optimalizace pro low-volume produkci místo trvalých workerů.

### WorkerManagerService

```php
// src/Service/WorkerManagerService.php
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

### Smart Retry Logic

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

## Timeout Protection (3-vrstvé)

1. **Frontend:** 45s timeout s AbortController (useFormSaving.js)
2. **Backend:** 30s database statement timeout (PortalController)  
3. **Worker:** 60s process timeout (WorkerManagerService)

## Konfigurace

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

## INSYZ Submission Workflow

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

## Database Transport

- **Výhoda:** Spolehlivé ukládání jobs v PostgreSQL
- **Konzumace:** Automatická přes on-demand worker
- **Monitoring:** Jobs jsou viditelné v `messenger_messages` tabulce
- **Cleanup:** Automatické odstraňování zaseknutých procesů

## Error Handling Patterns

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

## Development Commands

```bash
# Test messenger worker
php bin/console messenger:consume async --limit=1

# Kontrola zaseknutých procesů
ps aux | grep messenger:consume

# Sledování queue
php bin/console messenger:stats

# Vyčištění failed jobs
php bin/console messenger:failed:retry
```

## Production Setup

**On-demand systém funguje i v produkci** - worker se spouští automaticky při submit operacích přes `WorkerManagerService`.

### Monitoring Checklist

```bash
# 1. Zkontroluj že PHP má práva spouštět procesy
ps aux | grep php

# 2. Zkontroluj timeout nástroje jsou dostupné
which timeout

# 3. Zkontroluj write práva pro logy
ls -la var/log/

# 4. Test on-demand worker
php bin/console messenger:consume async --limit=1
```

### Production Troubleshooting

**On-demand worker se nespouští:**
```bash
# Zkontroluj zaseknuté procesy
ps aux | grep messenger:consume

# Vyčisti zaseknuté procesy (WorkerManagerService to dělá automaticky)
pkill -f "messenger:consume"
```

**Jobs se hromadí:**
```bash
# Zkontroluj queue
php bin/console messenger:stats

# Manuální zpracování při potřebě
php bin/console messenger:consume async --limit=10
```

## Troubleshooting

### Worker neběží po submit
```bash
# Zkontroluj on-demand worker
ps aux | grep messenger:consume

# Manuální spuštění
php bin/console messenger:consume async --limit=1
```

### Jobs se hromadí v queue
```bash
# Zkontroluj počet čekajících jobs
php bin/console messenger:stats

# Spusť více workerů
php bin/console messenger:consume async --limit=5
```

### Failed jobs
```bash
# Zobraz failed jobs
php bin/console messenger:failed:show

# Retry failed jobs
php bin/console messenger:failed:retry
```

---

**Related:** [Hlášení příkazů](../features/hlaseni-prikazu.md) | [Development Guide](development.md)  
**Updated:** 2025-08-07