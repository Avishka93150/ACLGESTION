#!/bin/bash
# ============================================================
# ACL GESTION v2 - Installation VPS (Node.js)
# ============================================================
# Ce script installe la v2 Node.js sur un VPS Ubuntu/Debian.
# Il peut coexister avec la v1 PHP ou la remplacer.
#
# Usage: sudo bash scripts/install-vps-v2.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   ACL GESTION v2 - Installation Node.js                   ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Erreur: Ce script doit etre execute en root (sudo).${NC}"
    exit 1
fi

# Variables
read -p "Nom de domaine (ex: acl-gestion.com): " DOMAIN
read -p "Email pour SSL Let's Encrypt: " SSL_EMAIL
read -p "Mot de passe MySQL pour l'utilisateur 'acl_user': " -s MYSQL_APP_PASS
echo ""
read -p "Port Node.js (defaut: 3000): " NODE_PORT
NODE_PORT=${NODE_PORT:-3000}

APP_DIR="/var/www/${DOMAIN}/v2"
DB_NAME="acl_gestion"
DB_USER="acl_user"

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Domaine:    ${DOMAIN}"
echo "  App:        ${APP_DIR}"
echo "  Port Node:  ${NODE_PORT}"
echo "  Base:       ${DB_NAME}"
echo ""
read -p "Continuer ? (o/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Oo]$ ]]; then exit 0; fi

# ============================================================
# 1. Installation Node.js 20 LTS
# ============================================================
echo -e "\n${GREEN}[1/7] Installation Node.js 20 LTS...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "  Node.js $(node -v)"
echo "  npm $(npm -v)"

# PM2 pour la gestion des processus
npm install -g pm2

# ============================================================
# 2. Deploiement
# ============================================================
echo -e "\n${GREEN}[2/7] Deploiement de l'application...${NC}"
mkdir -p "${APP_DIR}"

# Copier les fichiers v2
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "${SCRIPT_DIR}/package.json" ]; then
    cp -r "${SCRIPT_DIR}"/* "${APP_DIR}/"
    cp "${SCRIPT_DIR}/.env.example" "${APP_DIR}/.env.example" 2>/dev/null || true
else
    echo -e "${RED}Erreur: package.json non trouve dans ${SCRIPT_DIR}${NC}"
    exit 1
fi

# Creer les repertoires
mkdir -p "${APP_DIR}/uploads"/{maintenance,control,evaluations,closures,tasks,linen,avatars}
mkdir -p "${APP_DIR}/logs"
mkdir -p "${APP_DIR}/backups"
mkdir -p "${APP_DIR}/public"

# Copier le frontend (si la v1 existe)
V1_DIR="/var/www/${DOMAIN}"
if [ -f "${V1_DIR}/index.html" ]; then
    echo "  Copie du frontend v1 vers public/..."
    cp "${V1_DIR}/index.html" "${APP_DIR}/public/"
    cp -r "${V1_DIR}/css" "${APP_DIR}/public/" 2>/dev/null || true
    cp -r "${V1_DIR}/js" "${APP_DIR}/public/" 2>/dev/null || true
fi

# ============================================================
# 3. Configuration
# ============================================================
echo -e "\n${GREEN}[3/7] Configuration...${NC}"
JWT_SECRET=$(openssl rand -hex 32)

cat > "${APP_DIR}/.env" <<EOF
# ACL GESTION v2 - Configuration Production
NODE_ENV=production
PORT=${NODE_PORT}
APP_URL=https://${DOMAIN}
APP_NAME=ACL GESTION

# Base de donnees
DB_HOST=localhost
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${MYSQL_APP_PASS}
DB_POOL_MIN=2
DB_POOL_MAX=10

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=7d

# Securite
CORS_ORIGINS=https://${DOMAIN}
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15

# Email
SMTP_ENABLED=false

# Admin
ADMIN_EMAIL=${SSL_EMAIL}

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Logs
LOG_LEVEL=info
LOG_DIR=./logs
EOF

chmod 600 "${APP_DIR}/.env"

# ============================================================
# 4. Installation des dependances
# ============================================================
echo -e "\n${GREEN}[4/7] Installation des dependances npm...${NC}"
cd "${APP_DIR}"
npm install --production

# ============================================================
# 5. Migration de la base
# ============================================================
echo -e "\n${GREEN}[5/7] Migration de la base de donnees...${NC}"
node src/migrations/run.js --alter 2>/dev/null || {
    echo -e "${YELLOW}  Migration: les tables existent probablement deja (OK si upgrade)${NC}"
}

# Seed si base vide
USER_COUNT=$(mysql -u ${DB_USER} -p"${MYSQL_APP_PASS}" -N -e "SELECT COUNT(*) FROM users" ${DB_NAME} 2>/dev/null || echo "0")
if [ "$USER_COUNT" = "0" ]; then
    echo "  Base vide - execution du seed..."
    node scripts/seed.js
else
    echo "  Base existante (${USER_COUNT} utilisateurs) - seed ignore."
fi

# ============================================================
# 6. Configuration Nginx (reverse proxy)
# ============================================================
echo -e "\n${GREEN}[6/7] Configuration Nginx...${NC}"

cat > "/etc/nginx/sites-available/${DOMAIN}" <<'NGINX'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    client_max_body_size 20M;

    # Headers securite
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API - Proxy vers Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:NODE_PORT_PLACEHOLDER/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120;
    }

    # Uploads statiques
    location /uploads/ {
        alias APP_DIR_PLACEHOLDER/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Frontend SPA
    location / {
        root APP_DIR_PLACEHOLDER/public;
        try_files $uri $uri/ /index.html;
        expires 30d;
        add_header Cache-Control "public";
    }

    # Cache assets
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        root APP_DIR_PLACEHOLDER/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Bloquer acces fichiers sensibles
    location ~ /\.(git|env|htaccess) { deny all; }
    location /backups/ { deny all; }
    location /logs/ { deny all; }
}
NGINX

sed -i "s|DOMAIN_PLACEHOLDER|${DOMAIN}|g" "/etc/nginx/sites-available/${DOMAIN}"
sed -i "s|NODE_PORT_PLACEHOLDER|${NODE_PORT}|g" "/etc/nginx/sites-available/${DOMAIN}"
sed -i "s|APP_DIR_PLACEHOLDER|${APP_DIR}|g" "/etc/nginx/sites-available/${DOMAIN}"

ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl restart nginx

# ============================================================
# 7. PM2 Process Manager
# ============================================================
echo -e "\n${GREEN}[7/7] Demarrage avec PM2...${NC}"

# Creer le fichier ecosystem PM2
cat > "${APP_DIR}/ecosystem.config.js" <<EOF
module.exports = {
  apps: [{
    name: 'acl-gestion-v2',
    script: 'src/server.js',
    cwd: '${APP_DIR}',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: ${NODE_PORT}
    },
    max_memory_restart: '500M',
    error_file: '${APP_DIR}/logs/pm2-error.log',
    out_file: '${APP_DIR}/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    watch: false
  }]
};
EOF

# Permissions
chown -R www-data:www-data "${APP_DIR}"
chmod -R 755 "${APP_DIR}"
chmod -R 775 "${APP_DIR}/uploads" "${APP_DIR}/logs" "${APP_DIR}/backups"
chmod 600 "${APP_DIR}/.env"

# Demarrer
cd "${APP_DIR}"
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# SSL
echo ""
read -p "Installer SSL maintenant ? (o/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Oo]$ ]]; then
    certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect
fi

# ============================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}   INSTALLATION v2 TERMINEE !                              ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "  URL:           ${GREEN}https://${DOMAIN}${NC}"
echo -e "  API:           ${GREEN}https://${DOMAIN}/api/health${NC}"
echo -e "  Login admin:   ${GREEN}admin@acl-gestion.fr / Admin@123${NC}"
echo ""
echo -e "  Commandes PM2:"
echo -e "    pm2 status                 # Voir le statut"
echo -e "    pm2 logs acl-gestion-v2    # Voir les logs"
echo -e "    pm2 restart acl-gestion-v2 # Redemarrer"
echo -e "    pm2 monit                  # Monitoring"
echo ""
echo -e "  Migration v1 -> v2:"
echo -e "    cd ${APP_DIR}"
echo -e "    node scripts/backup.js     # Backup complet"
echo -e "    node scripts/migrate-from-php.js --dry-run  # Simulation"
echo -e "    node scripts/migrate-from-php.js            # Migration"
echo ""
