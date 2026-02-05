#!/bin/bash
#############################################
# ACL GESTION - Installation Plesk via SSH
# Pour CentOS 7 avec Plesk Obsidian
# Domaines: acl-gestion.com + app.acl-gestion.com
#############################################

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=================================================="
echo "   ACL GESTION - Installation Plesk"
echo "=================================================="
echo -e "${NC}"

# Variables - A MODIFIER
DB_NAME="${DB_NAME:-acl_gestion}"
DB_USER="${DB_USER:-acl_user}"
DB_PASS="${DB_PASS:-CHANGEZ_CE_MOT_DE_PASSE}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
NODE_PORT="${NODE_PORT:-3000}"

# Chemins Plesk standard
LANDING_PATH="/var/www/vhosts/acl-gestion.com/httpdocs"
APP_PATH="/var/www/vhosts/app.acl-gestion.com/httpdocs"

echo -e "${YELLOW}[1/8] Verification du systeme...${NC}"

# Verifier si on est root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Erreur: Ce script doit etre execute en root${NC}"
    echo "Utilisez: sudo bash install-plesk-ssh.sh"
    exit 1
fi

# Verifier CentOS
if [ ! -f /etc/centos-release ]; then
    echo -e "${YELLOW}Attention: Ce script est optimise pour CentOS 7${NC}"
fi

echo -e "${GREEN}OK${NC}"

echo -e "${YELLOW}[2/8] Installation des dependances...${NC}"

# Installer Node.js 18 LTS si pas present
if ! command -v node &> /dev/null; then
    echo "Installation de Node.js 18..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    yum install -y nodejs
fi

# Verifier version Node
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}Node.js 16+ requis. Version actuelle: $(node -v)${NC}"
    exit 1
fi

# Installer PM2 globalement
if ! command -v pm2 &> /dev/null; then
    echo "Installation de PM2..."
    npm install -g pm2
fi

# Installer git si pas present
if ! command -v git &> /dev/null; then
    yum install -y git
fi

echo -e "${GREEN}Node.js $(node -v), npm $(npm -v), PM2 installe${NC}"

echo -e "${YELLOW}[3/8] Clonage du repository...${NC}"

# Creer repertoire temporaire
TEMP_DIR="/tmp/aclgestion_install"
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR
cd $TEMP_DIR

# Cloner le repo (branche avec les modifications)
git clone -b claude/analyze-project-structure-X9EW8 https://github.com/Avishka93150/ACLGESTION.git .

echo -e "${GREEN}Repository clone${NC}"

echo -e "${YELLOW}[4/8] Installation de la landing page (acl-gestion.com)...${NC}"

# Verifier que le dossier existe
if [ ! -d "$LANDING_PATH" ]; then
    echo -e "${RED}Erreur: $LANDING_PATH n'existe pas${NC}"
    echo "Creez d'abord le domaine acl-gestion.com dans Plesk"
    exit 1
fi

# Backup si existant
if [ -f "$LANDING_PATH/index.html" ]; then
    mv "$LANDING_PATH/index.html" "$LANDING_PATH/index.html.bak.$(date +%Y%m%d%H%M%S)"
fi

# Copier les fichiers landing
cp -r landing/* "$LANDING_PATH/"

# Permissions
chown -R $(stat -c '%U:%G' "$LANDING_PATH") "$LANDING_PATH"

echo -e "${GREEN}Landing page installee${NC}"

echo -e "${YELLOW}[5/8] Installation de l'application (app.acl-gestion.com)...${NC}"

# Verifier que le dossier existe
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Erreur: $APP_PATH n'existe pas${NC}"
    echo "Creez d'abord le sous-domaine app.acl-gestion.com dans Plesk"
    exit 1
fi

# Creer structure
mkdir -p "$APP_PATH/api"
mkdir -p "$APP_PATH/uploads"

# Copier le frontend
cp -r v2/public/* "$APP_PATH/"

# Copier l'API Node.js
cp -r v2/src "$APP_PATH/api/"
cp v2/package.json "$APP_PATH/api/"
cp v2/package-lock.json "$APP_PATH/api/" 2>/dev/null || true

echo -e "${GREEN}Fichiers copies${NC}"

echo -e "${YELLOW}[6/8] Configuration de l'application...${NC}"

# Creer le fichier .env
cat > "$APP_PATH/api/.env" << EOF
# ACL GESTION v2 - Configuration
NODE_ENV=production
PORT=$NODE_PORT

# Base de donnees MySQL
DB_HOST=localhost
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS

# JWT
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# Uploads
UPLOAD_PATH=$APP_PATH/uploads
MAX_FILE_SIZE=10485760

# CORS
CORS_ORIGIN=https://app.acl-gestion.com,https://acl-gestion.com

# Email (optionnel)
SMTP_ENABLED=false
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=noreply@acl-gestion.com
EOF

# Permissions
chmod 600 "$APP_PATH/api/.env"

echo -e "${GREEN}Configuration creee${NC}"

echo -e "${YELLOW}[7/8] Installation des dependances Node.js...${NC}"

cd "$APP_PATH/api"
npm install --production

# Permissions
chown -R $(stat -c '%U:%G' "$APP_PATH") "$APP_PATH"

echo -e "${GREEN}Dependances installees${NC}"

echo -e "${YELLOW}[8/8] Configuration de PM2...${NC}"

# Creer config PM2
cat > "$APP_PATH/api/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'acl-gestion-api',
    script: 'src/server.js',
    cwd: '$APP_PATH/api',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: $NODE_PORT
    }
  }]
};
EOF

# Arreter si deja en cours
pm2 delete acl-gestion-api 2>/dev/null || true

# Demarrer l'application
cd "$APP_PATH/api"
pm2 start ecosystem.config.js

# Sauvegarder et configurer demarrage auto
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup

echo -e "${GREEN}PM2 configure et demarre${NC}"

# Nettoyer
rm -rf $TEMP_DIR

echo ""
echo -e "${BLUE}=================================================="
echo "   INSTALLATION TERMINEE"
echo "==================================================${NC}"
echo ""
echo -e "${GREEN}Fichiers installes:${NC}"
echo "  - Landing: $LANDING_PATH"
echo "  - App:     $APP_PATH"
echo ""
echo -e "${YELLOW}ETAPES SUIVANTES:${NC}"
echo ""
echo "1. CREER LA BASE DE DONNEES MySQL dans Plesk:"
echo "   - Nom: $DB_NAME"
echo "   - User: $DB_USER"
echo "   - Pass: (celui que vous avez defini)"
echo ""
echo "2. IMPORTER LE SCHEMA SQL:"
echo "   mysql -u $DB_USER -p $DB_NAME < $APP_PATH/api/src/database/schema.sql"
echo ""
echo "3. CONFIGURER LE PROXY dans Plesk pour app.acl-gestion.com:"
echo "   - Aller dans: Domaines > app.acl-gestion.com > Apache & nginx"
echo "   - Dans 'Additional nginx directives', ajouter:"
echo ""
echo "   location /api/ {"
echo "       proxy_pass http://127.0.0.1:$NODE_PORT/;"
echo "       proxy_http_version 1.1;"
echo "       proxy_set_header Upgrade \$http_upgrade;"
echo "       proxy_set_header Connection 'upgrade';"
echo "       proxy_set_header Host \$host;"
echo "       proxy_set_header X-Real-IP \$remote_addr;"
echo "       proxy_cache_bypass \$http_upgrade;"
echo "   }"
echo ""
echo "4. METTRE A JOUR le mot de passe DB dans:"
echo "   $APP_PATH/api/.env"
echo ""
echo "5. TESTER:"
echo "   curl http://localhost:$NODE_PORT/health"
echo ""
echo -e "${GREEN}URLs:${NC}"
echo "  - https://acl-gestion.com (landing)"
echo "  - https://app.acl-gestion.com (application)"
echo ""
echo -e "${BLUE}Commandes PM2 utiles:${NC}"
echo "  pm2 status           # Voir l'etat"
echo "  pm2 logs             # Voir les logs"
echo "  pm2 restart all      # Redemarrer"
echo ""
