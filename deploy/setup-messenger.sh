#!/bin/bash

# Setup script for Messenger Worker on production/dev server

set -e

# Konfigurace
SERVICE_NAME="portal-messenger"
APP_PATH="/var/www/portalznackare"
SERVICE_FILE="$APP_PATH/deploy/messenger-worker.service"
SYSTEMD_PATH="/etc/systemd/system/$SERVICE_NAME.service"

echo "🚀 Nastavuji Messenger Worker pro Portal Značkaře..."

# 1. Kontrola že jsme ve správném adresáři
if [ ! -f "bin/console" ]; then
    echo "❌ Spusťte script z root adresáře aplikace"
    exit 1
fi

# 2. Kontrola systémových požadavků
if ! command -v systemctl &> /dev/null; then
    echo "❌ systemd není dostupný. Worker je potřeba spustit manuálně."
    exit 1
fi

# 3. Zastavení existujícího servisu (pokud běží)
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "📥 Zastavuji existující worker..."
    sudo systemctl stop "$SERVICE_NAME"
fi

# 4. Kopírování service souboru
echo "📋 Kopíruji systemd service soubor..."
sudo cp "$SERVICE_FILE" "$SYSTEMD_PATH"

# 5. Úprava cest v service souboru
echo "⚙️  Upravuji cesty v service souboru..."
sudo sed -i "s|/var/www/portalznackare|$APP_PATH|g" "$SYSTEMD_PATH"

# 6. Reload systemd a povolení služby
echo "🔄 Restartуji systemd..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

# 7. Spuštění služby
echo "▶️  Spouštím Messenger Worker..."
sudo systemctl start "$SERVICE_NAME"

# 8. Kontrola stavu
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ Messenger Worker běží úspěšně!"
    echo "📊 Status: $(sudo systemctl is-active $SERVICE_NAME)"
    echo ""
    echo "🔧 Užitečné příkazy:"
    echo "   sudo systemctl status $SERVICE_NAME     # Status workeru"
    echo "   sudo systemctl restart $SERVICE_NAME    # Restart workeru"
    echo "   sudo journalctl -u $SERVICE_NAME -f     # Živé logy"
    echo "   sudo systemctl stop $SERVICE_NAME       # Zastavení"
else
    echo "❌ Worker se nepodařilo spustit!"
    echo "🔍 Kontrola logů:"
    sudo journalctl -u "$SERVICE_NAME" --lines=20
    exit 1
fi

echo ""
echo "🎯 Worker je nakonfigurován pro automatické spuštění při startu serveru."