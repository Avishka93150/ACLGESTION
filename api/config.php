<?php
/**
 * ACL GESTION - Configuration
 *
 * IMPORTANT: Copier ce fichier en config.local.php et y mettre vos vrais identifiants.
 * Le fichier config.local.php est ignoré par git (.gitignore).
 */

// Charger la config locale si elle existe (priorité)
if (file_exists(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
}

// === BASE DE DONNÉES ===
if (!defined('DB_HOST')) define('DB_HOST', getenv('ACL_DB_HOST') ?: 'localhost');
if (!defined('DB_NAME')) define('DB_NAME', getenv('ACL_DB_NAME') ?: 'acl_gestion');
if (!defined('DB_USER')) define('DB_USER', getenv('ACL_DB_USER') ?: 'root');
if (!defined('DB_PASS')) define('DB_PASS', getenv('ACL_DB_PASS') ?: '');

// === APPLICATION ===
if (!defined('APP_URL'))  define('APP_URL', getenv('ACL_APP_URL') ?: 'https://acl-gestion.com');
if (!defined('APP_NAME')) define('APP_NAME', 'ACL GESTION');

// === JWT ===
if (!defined('JWT_SECRET')) define('JWT_SECRET', getenv('ACL_JWT_SECRET') ?: 'CHANGE_THIS_TO_A_RANDOM_64_CHAR_STRING');
if (!defined('JWT_EXPIRY')) define('JWT_EXPIRY', 86400 * 7); // 7 jours

// === EMAIL ===
if (!defined('ADMIN_EMAIL'))  define('ADMIN_EMAIL', getenv('ACL_ADMIN_EMAIL') ?: 'admin@acl-gestion.com');
if (!defined('SMTP_ENABLED')) define('SMTP_ENABLED', getenv('ACL_SMTP_ENABLED') ?: false);

// === TIMEZONE ===
date_default_timezone_set('Europe/Paris');

// === DEBUG (mettre false en production) ===
if (!defined('DEBUG')) define('DEBUG', getenv('ACL_DEBUG') === 'true' ? true : false);

// === SECURITY ===
if (!defined('ALLOWED_ORIGINS')) define('ALLOWED_ORIGINS', getenv('ACL_ALLOWED_ORIGINS') ?: APP_URL);
if (!defined('LOGIN_MAX_ATTEMPTS')) define('LOGIN_MAX_ATTEMPTS', 5);
if (!defined('LOGIN_LOCKOUT_MINUTES')) define('LOGIN_LOCKOUT_MINUTES', 15);

// === HEADERS (uniquement pour les requêtes HTTP, pas CLI) ===
if (php_sapi_name() !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');

    // CORS sécurisé - n'autoriser que les origines configurées
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowedOrigins = array_map('trim', explode(',', ALLOWED_ORIGINS));
    if (in_array($origin, $allowedOrigins) || in_array('*', $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . ($origin ?: ALLOWED_ORIGINS));
    } else {
        header('Access-Control-Allow-Origin: ' . APP_URL);
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');

    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}
