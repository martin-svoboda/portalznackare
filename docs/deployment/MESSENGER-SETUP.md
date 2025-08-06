# Nastavení Messenger Worker pro produkci

## Rychlé nasazení

```bash
# 1. Na serveru (dev/produkce)
cd /var/www/portalznackare
sudo ./deploy/setup-messenger.sh

# 2. Nastavení monitoringu (volitelné)
sudo cp deploy/messenger-monitor.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/messenger-monitor.sh
crontab -e
# Přidat řádek: */5 * * * * /usr/local/bin/messenger-monitor.sh
```

## Ruční spuštění (development)

```bash
# Spuštění workeru na pozadí
nohup php bin/console messenger:consume async --time-limit=3600 --memory-limit=128M > var/log/messenger.log 2>&1 &

# Kontrola běžícího workeru
ps aux | grep messenger

# Zastavení
pkill -f "messenger:consume"
```

## Systémové služby (produkce)

Worker je nastaven jako systemd service:

```bash
# Kontrola stavu
sudo systemctl status portal-messenger

# Restart
sudo systemctl restart portal-messenger

# Logy
sudo journalctl -u portal-messenger -f

# Zastavení/spuštění
sudo systemctl stop portal-messenger
sudo systemctl start portal-messenger
```

## Monitoring

- **Automatický restart** při pádu
- **Kontrola paměti** každých 5 minut
- **Upozornění** na vysoký počet zpráv v queue
- **Logování** všech událostí

## Důležité soubory

- `/etc/systemd/system/portal-messenger.service` - Systémová služba
- `/var/log/portal-messenger-monitor.log` - Monitoring logy
- `/var/www/portalznackare/var/xml-exports/` - XML exporty

## Řešení problémů

**Worker neběží:**
```bash
sudo systemctl status portal-messenger
sudo journalctl -u portal-messenger --lines=50
```

**Vysoká spotřeba paměti:**
```bash
# Kontrola paměti
ps aux | grep messenger
# Restart workeru
sudo systemctl restart portal-messenger
```

**Nahromadění zpráv:**
```bash
# Kontrola queue
php bin/console messenger:stats
# Spuštění dalších workerů dočasně
php bin/console messenger:consume async --limit=100
```