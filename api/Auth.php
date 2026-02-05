<?php
/**
 * ACL GESTION - Authentification JWT
 */

class Auth {
    
    public static function login($email, $password) {
        $user = db()->queryOne(
            "SELECT * FROM users WHERE email = ? AND status = 'active'", 
            [$email]
        );
        
        if (!$user || !password_verify($password, $user['password'])) {
            return null;
        }
        
        // Mise à jour last_login
        db()->execute("UPDATE users SET last_login = NOW() WHERE id = ?", [$user['id']]);
        
        // Nettoyer le user
        unset($user['password']);
        
        return $user;
    }
    
    public static function generateToken($user) {
        $header = self::base64url(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload = self::base64url(json_encode([
            'sub' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'exp' => time() + JWT_EXPIRY
        ]));
        $signature = self::base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
        
        return "$header.$payload.$signature";
    }
    
    public static function verifyToken($token) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        
        list($header, $payload, $signature) = $parts;
        
        $validSig = self::base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
        if (!hash_equals($validSig, $signature)) return null;
        
        $data = json_decode(self::base64urlDecode($payload), true);
        if (!$data || (isset($data['exp']) && $data['exp'] < time())) return null;
        
        return $data;
    }
    
    public static function getUser() {
        // Récupérer le header Authorization de plusieurs façons (compatibilité Apache/Plesk)
        $header = '';
        
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $header = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            if (isset($headers['Authorization'])) {
                $header = $headers['Authorization'];
            } elseif (isset($headers['authorization'])) {
                $header = $headers['authorization'];
            }
        }
        
        if (!preg_match('/Bearer\s+(.+)/i', $header, $matches)) return null;
        
        $tokenData = self::verifyToken($matches[1]);
        if (!$tokenData) return null;
        
        $user = db()->queryOne(
            "SELECT id, email, first_name, last_name, role, status FROM users WHERE id = ? AND status = 'active'", 
            [$tokenData['sub']]
        );
        
        return $user;
    }
    
    private static function base64url($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    private static function base64urlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
