#!/bin/bash

# Hlavní deployment script
# Spouští se po git pull na serveru

set -e

APP_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="portal-messenger"

echo "🚀 Spouštím deployment..."

cd "$APP_PATH"

# 1. Git pull (pokud není automatický)
# git pull origin main

# 2. Composer install
echo "📦 Aktualizuji dependencies..."
composer install --no-dev --optimize-autoloader

# 3. Clear cache
echo "🗑️  Čistím cache..."
php bin/console cache:clear --env=prod

# 4. Database migrations
echo "🗄️  Spouštím migrace..."
php bin/console doctrine:migrations:migrate --no-interaction

# 5. Build assets (pokud není webpack už buildnutý)
if [ -f "webpack.config.js" ]; then
    echo "🏗️  Building assets..."
    npm install --production
    npm run build
fi

# 6. Kontrola a setup messenger worker
echo "⚙️  Kontroluji Messenger Worker..."

if ! systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "🔧 Messenger worker není nastaven, konfiguruji..."
    ./deploy/setup-messenger.sh
else
    echo "🔄 Restartuji Messenger Worker..."
    sudo systemctl restart "$SERVICE_NAME"
    
    # Kontrola že běží
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "✅ Messenger Worker restartován"
    else
        echo "❌ Problém s restartem workeru!"
        sudo systemctl status "$SERVICE_NAME"
    fi
fi

# 7. Finální kontroly
echo "🏁 Deployment dokončen!"
echo "📊 Status aplikace:"
echo "   - Worker: $(systemctl is-active $SERVICE_NAME 2>/dev/null || echo 'not configured')"
echo "   - Queue: $(php bin/console messenger:stats 2>/dev/null | head -n1 || echo 'N/A')"