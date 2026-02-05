# ACL GESTION - Guide d'installation Plesk OVH (CentOS 7)

## Architecture des domaines

| Domaine | Contenu | Port |
|---------|---------|------|
| `acl-gestion.com` | Landing page (présentation) | 80/443 |
| `app.acl-gestion.com` | Application + API | 80/443 (proxy → Node.js 3000) |

## Prérequis

- VPS OVH avec Plesk Obsidian 18.0.74+
- CentOS 7.9
- Accès SSH root
- Domaine acl-gestion.com configuré (DNS vers IP du VPS)

---

## Étape 1 : Configuration DNS (OVH Manager)

Dans votre zone DNS OVH, ajoutez :

```
Type    Nom                 Valeur              TTL
A       @                   [IP_VPS]            3600
A       app                 [IP_VPS]            3600
A       www                 [IP_VPS]            3600
CNAME   api                 app.acl-gestion.com 3600
```

---

## Étape 2 : Installation Node.js sur le serveur

Connectez-vous en SSH et exécutez :

```bash
# Installer Node.js 20 LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Vérifier
node -v   # v20.x.x
npm -v    # 10.x.x

# Installer PM2 globalement
sudo npm install -g pm2
```

---

## Étape 3 : Créer les domaines dans Plesk

### 3.1 Domaine principal : acl-gestion.com

1. **Plesk** → **Websites & Domains** → **Add Domain**
2. Nom : `acl-gestion.com`
3. Type d'hébergement : **Website hosting**
4. Racine du document : `/var/www/vhosts/acl-gestion.com/httpdocs`

### 3.2 Sous-domaine : app.acl-gestion.com

1. **Plesk** → **Websites & Domains** → **Add Subdomain**
2. Nom : `app`
3. Racine du document : `/var/www/vhosts/acl-gestion.com/app`

---

## Étape 4 : Déployer les fichiers

### 4.1 Télécharger le projet

```bash
cd /var/www/vhosts/acl-gestion.com
git clone https://github.com/Avishka93150/ACLGESTION.git temp_clone

# Landing page → httpdocs
cp temp_clone/landing/* httpdocs/ 2>/dev/null || cp temp_clone/index.html httpdocs/
cp -r temp_clone/css httpdocs/
cp -r temp_clone/js httpdocs/

# Application v2 → app
mkdir -p app
cp -r temp_clone/v2/* app/

# Nettoyer
rm -rf temp_clone
```

### 4.2 Configurer l'application Node.js

```bash
cd /var/www/vhosts/acl-gestion.com/app

# Copier la configuration
cp .env.example .env

# Éditer la configuration
nano .env
```

Contenu du `.env` :

```env
NODE_ENV=production
PORT=3000
APP_URL=https://app.acl-gestion.com
APP_NAME=ACL GESTION

# Base de données (créée à l'étape 5)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=acl_gestion
DB_USER=acl_user
DB_PASS=VotreMotDePasse_Complexe_123!

# JWT - IMPORTANT: Générez une clé unique
JWT_SECRET=REMPLACEZ_PAR_OPENSSL_RAND_HEX_32
JWT_EXPIRY=7d

# CORS - Les deux domaines autorisés
CORS_ORIGINS=https://acl-gestion.com,https://app.acl-gestion.com

# Email admin
ADMIN_EMAIL=votre-email@acl-gestion.com
SMTP_ENABLED=false

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Logs
LOG_LEVEL=info
LOG_DIR=./logs
```

Générez le JWT_SECRET :
```bash
openssl rand -hex 32
```

### 4.3 Installer les dépendances

```bash
cd /var/www/vhosts/acl-gestion.com/app
npm install --production

# Créer les dossiers nécessaires
mkdir -p uploads/{maintenance,control,evaluations,closures,tasks,linen,avatars}
mkdir -p logs backups
```

---

## Étape 5 : Créer la base de données dans Plesk

### 5.1 Via l'interface Plesk

1. **Plesk** → **Databases** → **Add Database**
2. Nom de la base : `acl_gestion`
3. Créer un utilisateur : `acl_user`
4. Mot de passe : (celui mis dans .env)
5. Cocher : **Accès à toutes les bases de données**

### 5.2 Importer le schéma

```bash
cd /var/www/vhosts/acl-gestion.com/app

# Si vous avez les données de la v1 PHP
mysql -u acl_user -p acl_gestion < ../database/schema.sql

# Ou initialiser avec le seed
node scripts/seed.js
```

---

## Étape 6 : Configuration Nginx dans Plesk

### 6.1 Pour app.acl-gestion.com (Proxy Node.js)

1. **Plesk** → **Websites & Domains** → **app.acl-gestion.com**
2. **Apache & nginx Settings**
3. Cocher **Proxy mode**
4. Dans **Additional nginx directives**, ajoutez :

```nginx
# Proxy vers Node.js
location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
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
    alias /var/www/vhosts/acl-gestion.com/app/uploads/;
    expires 7d;
    add_header Cache-Control "public, immutable";
}

# SPA fallback - toutes les autres routes vers index.html
location / {
    root /var/www/vhosts/acl-gestion.com/app/public;
    try_files $uri $uri/ /index.html;
}

# Headers sécurité
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

5. **OK** et **Apply**

### 6.2 Pour acl-gestion.com (Landing page)

1. **Plesk** → **Websites & Domains** → **acl-gestion.com**
2. **Apache & nginx Settings**
3. Dans **Additional nginx directives**, ajoutez :

```nginx
# Rediriger /login vers app
location = /login {
    return 302 https://app.acl-gestion.com/;
}

# Cache assets
location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

---

## Étape 7 : Démarrer l'application avec PM2

```bash
cd /var/www/vhosts/acl-gestion.com/app

# Créer le fichier PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'acl-gestion',
    script: 'src/server.js',
    cwd: '/var/www/vhosts/acl-gestion.com/app',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '500M',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true
  }]
};
EOF

# Démarrer
pm2 start ecosystem.config.js

# Sauvegarder pour redémarrage auto
pm2 save
pm2 startup
```

---

## Étape 8 : Activer SSL (Let's Encrypt)

### Via Plesk

1. **Plesk** → **Websites & Domains** → **SSL/TLS Certificates**
2. **Install** → **Let's Encrypt**
3. Cocher : `acl-gestion.com` et `app.acl-gestion.com`
4. **Get it Free**

---

## Étape 9 : Vérification

```bash
# Vérifier que Node.js tourne
pm2 status

# Tester l'API
curl https://app.acl-gestion.com/api/health

# Vérifier les logs
pm2 logs acl-gestion
```

---

## Commandes utiles

```bash
# Redémarrer l'application
pm2 restart acl-gestion

# Voir les logs en temps réel
pm2 logs acl-gestion --lines 100

# Monitoring
pm2 monit

# Mise à jour du code
cd /var/www/vhosts/acl-gestion.com/app
git pull
npm install --production
pm2 restart acl-gestion
```

---

## Identifiants par défaut

- **URL App** : https://app.acl-gestion.com
- **Email** : admin@acl-gestion.fr
- **Mot de passe** : Admin@123

⚠️ **CHANGEZ CE MOT DE PASSE IMMÉDIATEMENT APRÈS LA PREMIÈRE CONNEXION !**

---

## Dépannage

### L'API ne répond pas
```bash
pm2 logs acl-gestion --err --lines 50
# Vérifier la connexion DB
mysql -u acl_user -p -e "SELECT 1"
```

### Erreur 502 Bad Gateway
```bash
# Vérifier que PM2 tourne
pm2 status
# Vérifier le port
netstat -tlnp | grep 3000
```

### Erreur CORS
Vérifiez que `CORS_ORIGINS` dans `.env` inclut bien les deux domaines.

### Problème SSL
```bash
# Renouveler manuellement
plesk bin extension --exec letsencrypt cli.php -d acl-gestion.com -d app.acl-gestion.com
```
