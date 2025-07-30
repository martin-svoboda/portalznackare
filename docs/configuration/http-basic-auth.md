# HTTP Basic Authentication

> **Dev prostředí** - Podmíněná HTTP Basic autorizace

## Konfigurace

### Aktivace (dev server)
```bash
# .env.local
HTTP_AUTH_USER=developer
HTTP_AUTH_PASS=secure_password
```

### Bez autorizace (local/production)
```bash
# .env.local prázdný nebo bez HTTP_AUTH_* proměnných
```

## Použití

**Dev server:** Při přístupu se zobrazí přihlašovací dialog  
**Local/Production:** Aplikace běží normálně bez autorizace

## Implementace

- `src/EventListener/HttpBasicAuthListener.php`
- Automatická registrace přes `#[AsEventListener]`
- Výjimky: `/_wdt`, `/_profiler`

---

**Aktualizováno:** 2025-07-30