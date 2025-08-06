#!/bin/bash

# Monitoring script pro Messenger Worker
# Spouštět každých 5 minut přes cron

SERVICE_NAME="portal-messenger"
LOG_FILE="/var/log/portal-messenger-monitor.log"
MAX_MEMORY_MB=512

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Kontrola zda běží
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    log_message "WARNING: Worker není spuštěný, spouštím..."
    systemctl start "$SERVICE_NAME"
    
    # Čekání na start a kontrola
    sleep 5
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_message "INFO: Worker úspěšně restartován"
    else
        log_message "ERROR: Nepodařilo se restartovat worker!"
        # Poslat notifikaci (email, Slack, etc.)
    fi
fi

# Kontrola paměti (pokud worker spotřebovává více než MAX_MEMORY_MB, restartuj)
MEMORY_USAGE=$(ps aux | grep "messenger:consume" | grep -v grep | awk '{sum += $6} END {print int(sum/1024)}')
if [ ! -z "$MEMORY_USAGE" ] && [ "$MEMORY_USAGE" -gt "$MAX_MEMORY_MB" ]; then
    log_message "WARNING: Worker používá ${MEMORY_USAGE}MB paměti, restartуji..."
    systemctl restart "$SERVICE_NAME"
    log_message "INFO: Worker restartován kvůli vysoké spotřebě paměti"
fi

# Kontrola počtu zpráv v queue (upozornění na nahromadění)
QUEUE_COUNT=$(cd /var/www/portalznackare && php bin/console messenger:stats | grep -o '[0-9]\+' | head -n1 || echo "0")
if [ "$QUEUE_COUNT" -gt 100 ]; then
    log_message "WARNING: Vysoký počet zpráv v queue: $QUEUE_COUNT"
fi