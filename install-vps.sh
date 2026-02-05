#!/bin/bash
# ============================================================
# ACL GESTION - Script d'installation VPS (Ubuntu/Debian)
# ============================================================
# Usage: sudo bash install-vps.sh
#
# Ce script installe et configure :
# - Nginx (serveur web)
# - PHP 8.1+ (FPM)
# - MySQL 8.0 / MariaDB 10.6
# - Certbot (SSL Let's Encrypt)
# - Configuration complete de l'application
# ============================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}   ACL GESTION - Installation VPS                          ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Vérifier root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Erreur: Ce script doit être exécuté en root (sudo).${NC}"
    exit 1
fi

# Variables (à personnaliser)
read -p "Nom de domaine (ex: acl-gestion.com): " DOMAIN
read -p "Email pour SSL Let's Encrypt: " SSL_EMAIL
read -p "Mot de passe MySQL root souhaité: " -s MYSQL_ROOT_PASS
echo ""
read -p "Mot de passe pour l'utilisateur MySQL 'acl_user': " -s MYSQL_APP_PASS
echo ""

APP_DIR="/var/www/${DOMAIN}"
DB_NAME="acl_gestion"
DB_USER="acl_user"

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Domaine: ${DOMAIN}"
echo "  Dossier: ${APP_DIR}"
echo "  Base: ${DB_NAME}"
echo ""
read -p "Continuer ? (o/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "Annulé."
    exit 0
fi

# ============================================================
# 1. Mise à jour système
# ============================================================
echo -e "\n${GREEN}[1/8] Mise à jour du système...${NC}"
apt update && apt upgrade -y

# ============================================================
# 2. Installation des paquets
# ============================================================
echo -e "\n${GREEN}[2/8] Installation des paquets...${NC}"
apt install -y \
    nginx \
    mysql-server \
    php8.1-fpm php8.1-mysql php8.1-mbstring php8.1-xml php8.1-curl php8.1-gd php8.1-zip \
    certbot python3-certbot-nginx \
    git unzip curl cron

# Si PHP 8.1 n'est pas dispo, essayer d'ajouter le PPA
if ! command -v php8.1 &> /dev/null; then
    echo -e "${YELLOW}PHP 8.1 non trouvé, ajout du PPA ondrej/php...${NC}"
    apt install -y software-properties-common
    add-apt-repository -y ppa:ondrej/php
    apt update
    apt install -y php8.1-fpm php8.1-mysql php8.1-mbstring php8.1-xml php8.1-curl php8.1-gd php8.1-zip
fi

# ============================================================
# 3. Configuration MySQL
# ============================================================
echo -e "\n${GREEN}[3/8] Configuration MySQL...${NC}"
systemctl start mysql
systemctl enable mysql

# Créer la base et l'utilisateur
mysql -u root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_ROOT_PASS}';
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${MYSQL_APP_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

echo -e "${GREEN}  Base de données '${DB_NAME}' créée.${NC}"

# ============================================================
# 4. Déploiement de l'application
# ============================================================
echo -e "\n${GREEN}[4/8] Déploiement de l'application...${NC}"
mkdir -p "${APP_DIR}"

# Copier les fichiers
if [ -d "/home/user/ACLGESTION" ]; then
    cp -r /home/user/ACLGESTION/* "${APP_DIR}/"
    cp -r /home/user/ACLGESTION/.gitignore "${APP_DIR}/" 2>/dev/null || true
else
    echo -e "${YELLOW}  Copiez manuellement vos fichiers dans ${APP_DIR}${NC}"
fi

# Créer les dossiers nécessaires
mkdir -p "${APP_DIR}/uploads/control"
mkdir -p "${APP_DIR}/uploads/maintenance"
mkdir -p "${APP_DIR}/uploads/evaluations"
mkdir -p "${APP_DIR}/uploads/closures"
mkdir -p "${APP_DIR}/uploads/tasks"
mkdir -p "${APP_DIR}/uploads/linen"

# Permissions
chown -R www-data:www-data "${APP_DIR}"
chmod -R 755 "${APP_DIR}"
chmod -R 775 "${APP_DIR}/uploads"

# ============================================================
# 5. Configuration de l'application
# ============================================================
echo -e "\n${GREEN}[5/8] Configuration de l'application...${NC}"
JWT_SECRET=$(openssl rand -hex 32)

cat > "${APP_DIR}/api/config.local.php" <<EOF
<?php
// Configuration locale ACL GESTION - Generee par install-vps.sh
define('DB_HOST', 'localhost');
define('DB_NAME', '${DB_NAME}');
define('DB_USER', '${DB_USER}');
define('DB_PASS', '${MYSQL_APP_PASS}');

define('APP_URL', 'https://${DOMAIN}');
define('JWT_SECRET', '${JWT_SECRET}');

define('ADMIN_EMAIL', '${SSL_EMAIL}');
define('SMTP_ENABLED', false);
define('DEBUG', false);

define('ALLOWED_ORIGINS', 'https://${DOMAIN}');
EOF

chmod 640 "${APP_DIR}/api/config.local.php"
chown www-data:www-data "${APP_DIR}/api/config.local.php"

echo -e "${GREEN}  JWT secret généré: ${JWT_SECRET:0:8}...${NC}"

# Importer le schéma
echo -e "${GREEN}  Import du schéma SQL...${NC}"
mysql -u ${DB_USER} -p"${MYSQL_APP_PASS}" ${DB_NAME} < "${APP_DIR}/database/schema.sql" 2>/dev/null || {
    echo -e "${YELLOW}  Avertissement: Certaines migrations ont pu échouer (normal si base existante)${NC}"
}

# Importer les migrations supplémentaires
for migration_file in "${APP_DIR}"/database/migration_*.sql; do
    if [ -f "$migration_file" ]; then
        mysql -u ${DB_USER} -p"${MYSQL_APP_PASS}" ${DB_NAME} < "$migration_file" 2>/dev/null || true
        echo -e "  Migration: $(basename $migration_file)"
    fi
done

# ============================================================
# 6. Configuration Nginx
# ============================================================
echo -e "\n${GREEN}[6/8] Configuration Nginx...${NC}"

cat > "/etc/nginx/sites-available/${DOMAIN}" <<'NGINX'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    root APP_DIR_PLACEHOLDER;
    index index.html;

    # Taille max upload (pour photos maintenance, evaluations, etc.)
    client_max_body_size 20M;

    # Securite headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API PHP
    location /api/ {
        try_files $uri $uri/ /api/index.php$is_args$args;

        location ~ \.php$ {
            fastcgi_pass unix:/run/php/php8.1-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
            include fastcgi_params;
            fastcgi_param PATH_INFO $fastcgi_path_info;
            fastcgi_split_path_info ^(.+\.php)(/.+)$;
        }
    }

    # SPA - Toutes les routes vers index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Uploads
    location /uploads/ {
        alias APP_DIR_PLACEHOLDER/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Cache assets statiques
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Bloquer l'acces aux fichiers sensibles
    location ~ /\.(git|env|htaccess) {
        deny all;
    }
    location ~ /(config\.local\.php|config\.php|Database\.php|Auth\.php) {
        deny all;
    }
    location /database/ {
        deny all;
    }
}
NGINX

# Remplacer les placeholders
sed -i "s|DOMAIN_PLACEHOLDER|${DOMAIN}|g" "/etc/nginx/sites-available/${DOMAIN}"
sed -i "s|APP_DIR_PLACEHOLDER|${APP_DIR}|g" "/etc/nginx/sites-available/${DOMAIN}"

# Activer le site
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default

# Tester la config
nginx -t

systemctl restart nginx

# ============================================================
# 7. SSL Let's Encrypt
# ============================================================
echo -e "\n${GREEN}[7/8] Configuration SSL...${NC}"
echo -e "${YELLOW}  Assurez-vous que le DNS pointe vers ce serveur.${NC}"
read -p "  Installer SSL maintenant ? (o/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Oo]$ ]]; then
    certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${SSL_EMAIL}" --redirect
fi

# ============================================================
# 8. Cron Jobs
# ============================================================
echo -e "\n${GREEN}[8/8] Configuration des tâches planifiées...${NC}"

PHP_BIN=$(which php8.1 || which php)

# Ajouter les crons
(crontab -l 2>/dev/null; echo "# ACL GESTION - Cron Jobs") | crontab -
(crontab -l 2>/dev/null; echo "0 12 * * * ${PHP_BIN} ${APP_DIR}/api/cron.php dispatch >> /var/log/acl-cron.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 19 * * * ${PHP_BIN} ${APP_DIR}/api/cron.php control >> /var/log/acl-cron.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 9 * * * ${PHP_BIN} ${APP_DIR}/api/cron.php maintenance >> /var/log/acl-cron.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 9 * * 1 ${PHP_BIN} ${APP_DIR}/api/cron.php leaves_reminder >> /var/log/acl-cron.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 9 * * * ${PHP_BIN} ${APP_DIR}/api/cron.php tasks_due >> /var/log/acl-cron.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 13 * * * ${PHP_BIN} ${APP_DIR}/api/cron.php closure >> /var/log/acl-cron.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 6 * * * ${PHP_BIN} ${APP_DIR}/api/cron.php revenue >> /var/log/acl-cron.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 3 * * * ${PHP_BIN} ${APP_DIR}/api/cron.php cleanup >> /var/log/acl-cron.log 2>&1") | crontab -

# ============================================================
# TERMINÉ
# ============================================================
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}   INSTALLATION TERMINEE !                                  ${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "  URL:          ${GREEN}https://${DOMAIN}${NC}"
echo -e "  Login admin:  ${GREEN}admin@acl-gestion.fr${NC}"
echo -e "  Mot de passe: ${YELLOW}Admin@123${NC} (A CHANGER IMMEDIATEMENT)"
echo ""
echo -e "  Config:       ${APP_DIR}/api/config.local.php"
echo -e "  Logs cron:    /var/log/acl-cron.log"
echo -e "  Nginx:        /etc/nginx/sites-available/${DOMAIN}"
echo ""
echo -e "  ${YELLOW}IMPORTANT:${NC}"
echo -e "    1. Changez le mot de passe admin immédiatement"
echo -e "    2. Vérifiez config.local.php"
echo -e "    3. Configurez votre SMTP pour les emails"
echo ""
