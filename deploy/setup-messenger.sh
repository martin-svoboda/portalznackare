#!/bin/bash
#
# Instaluje (nebo aktualizuje) systemd unit pro Symfony Messenger worker.
#
# Použití:
#   ./deploy/setup-messenger.sh prod    # /www/hosting/portalznackare.cz/www
#   ./deploy/setup-messenger.sh dev     # /www/hosting/portalznackare.cz/dev
#
# Skript je idempotentní — pokud služba už existuje, nakopíruje aktuální
# unit soubor a službu restartuje.

set -euo pipefail

ENV_NAME="${1:-}"
if [ "$ENV_NAME" != "prod" ] && [ "$ENV_NAME" != "dev" ]; then
    echo "❌ Použití: $0 <prod|dev>"
    exit 1
fi

SERVICE_NAME="portal-messenger-${ENV_NAME}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="$SCRIPT_DIR/${SERVICE_NAME}.service"
SYSTEMD_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

if [ ! -f "$SERVICE_FILE" ]; then
    echo "❌ Service file nenalezen: $SERVICE_FILE"
    exit 1
fi

if ! command -v systemctl &> /dev/null; then
    echo "❌ systemd není dostupný"
    exit 1
fi

echo "📋 Instaluji ${SERVICE_NAME} (zdroj: ${SERVICE_FILE})"
cp "$SERVICE_FILE" "$SYSTEMD_PATH"

systemctl daemon-reload

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "🔄 Služba již povolena, restartuji"
    systemctl restart "$SERVICE_NAME"
else
    echo "▶️  Povoluji a spouštím službu"
    systemctl enable --now "$SERVICE_NAME"
fi

sleep 2

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ ${SERVICE_NAME} běží"
    systemctl is-active "$SERVICE_NAME"
else
    echo "❌ ${SERVICE_NAME} se nepodařilo spustit"
    journalctl -u "$SERVICE_NAME" --no-pager --lines=30
    exit 1
fi
