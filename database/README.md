# 🏨 ACL GESTION

**Plateforme de gestion hôtelière multi-établissements**

## 📋 Fonctionnalités

- **Dashboard** : Vue d'ensemble avec KPIs en temps réel
- **Hôtels** : Gestion des établissements et chambres
- **Maintenance** : Tickets avec priorités et escalade automatique
- **Gouvernante** : Dispatch quotidien des chambres à nettoyer
- **Linge** : Suivi collecte/réception avec écarts hebdomadaires
- **Congés** : Demandes et validation hiérarchique
- **Utilisateurs** : Gestion des accès par rôles

## 🚀 Installation

### Prérequis
- PHP 7.4+ avec PDO MySQL
- MySQL 5.x ou supérieur
- Serveur Apache avec mod_rewrite (optionnel)

### Étapes

1. **Base de données**
   - Créer une base `acl_gestion` dans phpMyAdmin
   - Importer le fichier `database/schema.sql`

2. **Configuration**
   - Éditer `api/config.php` avec vos identifiants MySQL :
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'acl_gestion');
   define('DB_USER', 'votre_user');
   define('DB_PASS', 'votre_password');
   ```

3. **Upload**
   - Uploader TOUS les fichiers à la racine de `acl-gestion.com`

4. **Test**
   - Ouvrir https://acl-gestion.com

## 🔐 Connexion

| Email | Mot de passe |
|-------|--------------|
| admin@acl-gestion.fr | Admin@123 |

⚠️ **Changez ce mot de passe après la première connexion !**

## 📁 Structure

```
acl-gestion.com/
├── index.html          # Application SPA
├── css/style.css       # Styles
├── js/
│   ├── config.js       # Configuration
│   ├── api.js          # Module API
│   ├── utils.js        # Utilitaires
│   ├── app.js          # Application principale
│   └── pages/          # Pages (7 modules)
├── api/
│   ├── config.php      # Configuration DB
│   ├── Database.php    # Classe PDO
│   ├── Auth.php        # Authentification JWT
│   └── index.php       # API REST
├── database/
│   └── schema.sql      # Schéma MySQL
└── uploads/            # Fichiers uploadés
```

## 🔗 API Endpoints

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | /api/index.php/health | Status API |
| POST | /api/index.php/auth/login | Connexion |
| GET | /api/index.php/dashboard/stats | Statistiques |
| GET/POST | /api/index.php/hotels | Hôtels |
| GET/POST | /api/index.php/rooms | Chambres |
| GET/POST | /api/index.php/maintenance | Tickets |
| GET/POST | /api/index.php/dispatch | Gouvernante |
| GET/POST | /api/index.php/leaves | Congés |
| GET/POST | /api/index.php/linen/transactions | Linge |
| GET/POST/PUT | /api/index.php/users | Utilisateurs |

## 👥 Rôles

| Rôle | Permissions |
|------|-------------|
| Admin | Accès complet |
| Resp. Groupe | Multi-hôtels, validation |
| Resp. Hôtel | Gestion 1 hôtel |
| Gouvernante | Dispatch, linge |
| Employé | Tickets, congés |

## 🔧 Dépannage

### Erreur 500
- Vérifier les logs PHP dans Plesk
- Vérifier les identifiants MySQL dans `api/config.php`

### Page blanche
- Vérifier que tous les fichiers JS sont uploadés
- Ouvrir la console du navigateur (F12)

### Erreur de connexion
- Vérifier que la base de données est importée
- Vérifier que l'utilisateur admin existe

---

**ACL GESTION** © 2024 - Tous droits réservés
