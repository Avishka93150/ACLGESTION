#!/bin/bash
#############################################
# ACL GESTION - Script de déploiement Plesk
# Usage: ./deploy-plesk.sh
#
# Ce script:
# - Pull les dernières modifications de GitHub
# - Déploie sans interruption de service
# - Préserve toutes les données de la BDD
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
echo "   ACL GESTION - Déploiement automatique"
echo "=================================================="
echo -e "${NC}"

# Configuration - À MODIFIER SI NÉCESSAIRE
GITHUB_REPO="https://github.com/Avishka93150/ACLGESTION.git"
GITHUB_BRANCH="claude/analyze-project-structure-X9EW8"
DOMAIN="acl-gestion.com"
SUBDOMAIN="app.acl-gestion.com"
PLESK_USER="acl-gestion.com_prref8d1l6f"

# Chemins
LANDING_PATH="/var/www/vhosts/${DOMAIN}/httpdocs"
APP_PATH="/var/www/vhosts/${DOMAIN}/${SUBDOMAIN}"
TEMP_DIR="/tmp/aclgestion_deploy_$(date +%Y%m%d%H%M%S)"
BACKUP_DIR="/var/www/vhosts/${DOMAIN}/backups/$(date +%Y%m%d%H%M%S)"

# Base de données
DB_NAME="acl_gestion"
DB_USER="acl_user"
DB_PASS="Akseaneser123!"

echo -e "${YELLOW}[1/8] Vérification des prérequis...${NC}"

# Vérifier si on est root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Erreur: Ce script doit être exécuté en root${NC}"
    exit 1
fi

# Vérifier les chemins
if [ ! -d "$LANDING_PATH" ]; then
    echo -e "${RED}Erreur: $LANDING_PATH n'existe pas${NC}"
    exit 1
fi

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Erreur: $APP_PATH n'existe pas${NC}"
    exit 1
fi

echo -e "${GREEN}OK${NC}"

echo -e "${YELLOW}[2/8] Création du backup...${NC}"

# Créer le dossier de backup
mkdir -p "$BACKUP_DIR"

# Backup de la base de données (sans perte de données)
echo "  - Backup BDD..."
mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_DIR/database.sql" 2>/dev/null || {
    echo -e "${YELLOW}  Warning: Impossible de sauvegarder la BDD (peut-être vide)${NC}"
}

# Backup des fichiers uploadés
if [ -d "$APP_PATH/uploads" ] && [ "$(ls -A $APP_PATH/uploads 2>/dev/null)" ]; then
    echo "  - Backup uploads..."
    cp -r "$APP_PATH/uploads" "$BACKUP_DIR/"
fi

# Backup du .env
if [ -f "$APP_PATH/api/.env" ]; then
    echo "  - Backup .env..."
    cp "$APP_PATH/api/.env" "$BACKUP_DIR/"
fi

echo -e "${GREEN}Backup créé: $BACKUP_DIR${NC}"

echo -e "${YELLOW}[3/8] Clonage du repository...${NC}"

# Cloner dans un dossier temporaire
rm -rf "$TEMP_DIR"
git clone -b "$GITHUB_BRANCH" "$GITHUB_REPO" "$TEMP_DIR" --depth 1

echo -e "${GREEN}Repository cloné${NC}"

echo -e "${YELLOW}[4/8] Mise à jour de la landing page...${NC}"

# Mettre à jour la landing page (sans supprimer l'existant d'abord)
cp -r "$TEMP_DIR/landing/"* "$LANDING_PATH/"
chown -R "$PLESK_USER":psaserv "$LANDING_PATH/"

echo -e "${GREEN}Landing page mise à jour${NC}"

echo -e "${YELLOW}[5/8] Mise à jour de l'application...${NC}"

# Mettre à jour les fichiers frontend
cp -r "$TEMP_DIR/v2/public/"* "$APP_PATH/"

# Mettre à jour les fichiers API (sans écraser .env et node_modules)
cp -r "$TEMP_DIR/v2/src" "$APP_PATH/api/"
cp "$TEMP_DIR/v2/package.json" "$APP_PATH/api/"

# Restaurer le .env depuis le backup si nécessaire
if [ -f "$BACKUP_DIR/.env" ]; then
    cp "$BACKUP_DIR/.env" "$APP_PATH/api/.env"
fi

# Recréer le lien symbolique si nécessaire
if [ ! -L "$APP_PATH/api/public" ]; then
    ln -sf "$APP_PATH" "$APP_PATH/api/public"
fi

# Permissions
chown -R "$PLESK_USER":psaserv "$APP_PATH/"

echo -e "${GREEN}Application mise à jour${NC}"

echo -e "${YELLOW}[6/8] Installation des dépendances Node.js...${NC}"

cd "$APP_PATH/api"

# Vérifier si package.json a changé
if [ ! -f "node_modules/.package-lock.json" ] || ! diff -q package.json node_modules/.package-lock.json > /dev/null 2>&1; then
    npm install --production
    cp package.json node_modules/.package-lock.json 2>/dev/null || true
else
    echo "  Dépendances déjà à jour"
fi

echo -e "${GREEN}Dépendances OK${NC}"

echo -e "${YELLOW}[7/8] Redémarrage de l'API...${NC}"

# Redémarrer PM2 sans downtime
if pm2 describe acl-gestion-api > /dev/null 2>&1; then
    pm2 reload acl-gestion-api
else
    pm2 start src/server.js --name "acl-gestion-api"
fi
pm2 save

echo -e "${GREEN}API redémarrée${NC}"

echo -e "${YELLOW}[8/8] Vérification finale...${NC}"

# Attendre que l'API soit prête
sleep 3

# Test de santé
HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"OK"'; then
    echo -e "${GREEN}API OK${NC}"
else
    echo -e "${RED}Warning: L'API ne répond pas correctement${NC}"
    echo "$HEALTH"
fi

# Nettoyer
rm -rf "$TEMP_DIR"

echo ""
echo -e "${BLUE}=================================================="
echo "   DÉPLOIEMENT TERMINÉ"
echo "==================================================${NC}"
echo ""
echo -e "${GREEN}URLs:${NC}"
echo "  - Landing: https://${DOMAIN}"
echo "  - App:     https://${SUBDOMAIN}"
echo ""
echo -e "${GREEN}Backup:${NC} $BACKUP_DIR"
echo ""
echo -e "${YELLOW}En cas de problème, restaurez avec:${NC}"
echo "  mysql -u $DB_USER -p'$DB_PASS' $DB_NAME < $BACKUP_DIR/database.sql"
echo ""
