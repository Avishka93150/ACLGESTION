<?php
/**
 * ACL GESTION - Configuration
 */

// === BASE DE DONNÉES ===
define('DB_HOST', 'localhost');
define('DB_NAME', 'acl_gestion');
define('DB_USER', 'root2');          // À modifier
define('DB_PASS', 'akseaneser');     // À modifier

// === APPLICATION ===
define('APP_URL', 'https://acl-gestion.com');
define('APP_NAME', 'ACL GESTION');

// === JWT ===
define('JWT_SECRET', 'ACL_SECRET_KEY_2024_CHANGE_THIS');
define('JWT_EXPIRY', 86400 * 7); // 7 jours

// === TIMEZONE ===
date_default_timezone_set('Europe/Paris');

// === DEBUG (mettre false en production) ===
define('DEBUG', true);

// === HEADERS (uniquement pour les requêtes HTTP, pas CLI) ===
if (php_sapi_name() !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}
