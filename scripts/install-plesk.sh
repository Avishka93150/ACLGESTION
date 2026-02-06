#!/bin/bash
#############################################
# ACL GESTION - Installation initiale Plesk
# Usage: ./install-plesk.sh
#
# Prérequis dans Plesk:
# 1. Domaine acl-gestion.com créé
# 2. Sous-domaine app.acl-gestion.com créé
# 3. Base de données acl_gestion créée
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
echo "   ACL GESTION - Installation initiale"
echo "=================================================="
echo -e "${NC}"

# Configuration - À MODIFIER
GITHUB_REPO="https://github.com/Avishka93150/ACLGESTION.git"
GITHUB_BRANCH="claude/analyze-project-structure-X9EW8"
DOMAIN="acl-gestion.com"
PLESK_USER=""  # Sera détecté automatiquement

# Base de données - À MODIFIER
DB_NAME="acl_gestion"
DB_USER="acl_user"
DB_PASS="Akseaneser123!"

# Chemins
LANDING_PATH="/var/www/vhosts/${DOMAIN}/httpdocs"
TEMP_DIR="/tmp/aclgestion_install"

echo -e "${YELLOW}[1/12] Vérification des prérequis...${NC}"

# Vérifier si on est root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Erreur: Ce script doit être exécuté en root${NC}"
    exit 1
fi

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installation de Node.js 18...${NC}"
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - 2>/dev/null || \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    yum install -y nodejs 2>/dev/null || apt-get install -y nodejs
fi

# Vérifier PM2
if ! command -v pm2 &> /dev/null; then
    echo "Installation de PM2..."
    npm install -g pm2
fi

echo -e "${GREEN}Node.js $(node -v), PM2 OK${NC}"

echo -e "${YELLOW}[2/12] Détection du document root du sous-domaine...${NC}"

# Détecter le document root de app.acl-gestion.com
APP_PATH=$(plesk bin subdomain --info app.${DOMAIN} 2>/dev/null | grep "WWW-Root" | awk '{print $2}')

if [ -z "$APP_PATH" ]; then
    echo -e "${RED}Erreur: Sous-domaine app.${DOMAIN} non trouvé${NC}"
    echo "Créez d'abord le sous-domaine dans Plesk"
    exit 1
fi

echo -e "${GREEN}Document root: $APP_PATH${NC}"

# Détecter l'utilisateur Plesk
PLESK_USER=$(stat -c '%U' "$LANDING_PATH" 2>/dev/null)
if [ -z "$PLESK_USER" ]; then
    PLESK_USER=$(ls -la "$LANDING_PATH" | head -2 | tail -1 | awk '{print $3}')
fi

echo -e "${GREEN}Utilisateur Plesk: $PLESK_USER${NC}"

echo -e "${YELLOW}[3/12] Clonage du repository...${NC}"

rm -rf "$TEMP_DIR"
git clone -b "$GITHUB_BRANCH" "$GITHUB_REPO" "$TEMP_DIR" --depth 1

echo -e "${GREEN}Repository cloné${NC}"

echo -e "${YELLOW}[4/12] Installation de la landing page...${NC}"

cp -r "$TEMP_DIR/landing/"* "$LANDING_PATH/"
chown -R "$PLESK_USER":psaserv "$LANDING_PATH/"

echo -e "${GREEN}Landing page installée${NC}"

echo -e "${YELLOW}[5/12] Installation de l'application...${NC}"

# Copier le frontend
cp -r "$TEMP_DIR/v2/public/"* "$APP_PATH/"

# Créer les dossiers
mkdir -p "$APP_PATH/api"
mkdir -p "$APP_PATH/uploads"

# Copier l'API
cp -r "$TEMP_DIR/v2/src" "$APP_PATH/api/"
cp "$TEMP_DIR/v2/package.json" "$APP_PATH/api/"

echo -e "${GREEN}Application installée${NC}"

echo -e "${YELLOW}[6/12] Configuration de l'environnement...${NC}"

# Générer un JWT secret aléatoire
JWT_SECRET=$(openssl rand -hex 32)

cat > "$APP_PATH/api/.env" << EOF
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
UPLOAD_PATH=${APP_PATH}/uploads
CORS_ORIGIN=https://app.${DOMAIN},https://${DOMAIN}
SMTP_ENABLED=false
EOF

chmod 600 "$APP_PATH/api/.env"

echo -e "${GREEN}Configuration créée${NC}"

echo -e "${YELLOW}[7/12] Création du lien symbolique...${NC}"

ln -sf "$APP_PATH" "$APP_PATH/api/public"

echo -e "${GREEN}Lien symbolique créé${NC}"

echo -e "${YELLOW}[8/12] Installation des dépendances Node.js...${NC}"

cd "$APP_PATH/api"
npm install --production

echo -e "${GREEN}Dépendances installées${NC}"

echo -e "${YELLOW}[9/12] Import du schéma de base de données...${NC}"

# Vérifier si la table users existe déjà
TABLE_EXISTS=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES LIKE 'users';" 2>/dev/null | grep -c users || echo "0")

if [ "$TABLE_EXISTS" -eq "0" ]; then
    echo "  Import du schéma..."
    mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SET FOREIGN_KEY_CHECKS=0; SOURCE $TEMP_DIR/database/schema.sql; SET FOREIGN_KEY_CHECKS=1;" 2>/dev/null || {
        echo -e "${YELLOW}  Warning: Import partiel, vérifiez phpMyAdmin${NC}"
    }

    # Ajouter les colonnes manquantes si nécessaire
    mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1;" 2>/dev/null || true
else
    echo "  Tables existantes, schéma non écrasé"
fi

echo -e "${GREEN}Base de données OK${NC}"

echo -e "${YELLOW}[10/12] Configuration des permissions...${NC}"

chown -R "$PLESK_USER":psaserv "$APP_PATH/"

echo -e "${GREEN}Permissions OK${NC}"

echo -e "${YELLOW}[11/12] Configuration du proxy Apache...${NC}"

# Créer les fichiers de configuration Apache
APACHE_CONF_DIR="/var/www/vhosts/system/app.${DOMAIN}/conf"

cat > "$APACHE_CONF_DIR/vhost.conf" << 'EOF'
ProxyPreserveHost On
ProxyPass /api/ http://127.0.0.1:3000/api/
ProxyPassReverse /api/ http://127.0.0.1:3000/api/
EOF

cat > "$APACHE_CONF_DIR/vhost_ssl.conf" << 'EOF'
ProxyPreserveHost On
ProxyPass /api/ http://127.0.0.1:3000/api/
ProxyPassReverse /api/ http://127.0.0.1:3000/api/
EOF

# Recharger Apache
plesk repair web app.${DOMAIN} -y 2>/dev/null || true
systemctl reload apache2 2>/dev/null || systemctl reload httpd 2>/dev/null || true

echo -e "${GREEN}Proxy Apache configuré${NC}"

echo -e "${YELLOW}[12/12] Démarrage de l'API...${NC}"

cd "$APP_PATH/api"

# Arrêter si déjà en cours
pm2 delete acl-gestion-api 2>/dev/null || true

# Démarrer
pm2 start src/server.js --name "acl-gestion-api"
pm2 save
pm2 startup 2>/dev/null || true

# Test
sleep 3
HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"status"'; then
    echo -e "${GREEN}API démarrée et fonctionnelle${NC}"
else
    echo -e "${YELLOW}Warning: Vérifiez l'API avec 'pm2 logs acl-gestion-api'${NC}"
fi

# Nettoyer
rm -rf "$TEMP_DIR"

echo ""
echo -e "${BLUE}=================================================="
echo "   INSTALLATION TERMINÉE"
echo "==================================================${NC}"
echo ""
echo -e "${GREEN}URLs:${NC}"
echo "  - Landing: https://${DOMAIN}"
echo "  - App:     https://app.${DOMAIN}"
echo ""
echo -e "${YELLOW}Prochaines étapes:${NC}"
echo "  1. Créez un utilisateur admin dans phpMyAdmin:"
echo ""
echo "     INSERT INTO users (email, password, first_name, last_name, role, status, is_active)"
echo "     VALUES ('admin@${DOMAIN}', '\$2a\$10\$...hash...', 'Admin', 'ACL', 'admin', 'active', 1);"
echo ""
echo "  2. Ou utilisez le script de création d'admin:"
echo "     node $APP_PATH/api/scripts/create-admin.js"
echo ""
echo -e "${BLUE}Commandes utiles:${NC}"
echo "  pm2 status              # État des services"
echo "  pm2 logs acl-gestion-api # Logs de l'API"
echo "  pm2 restart acl-gestion-api # Redémarrer"
echo ""
