-- =============================================
-- ACL GESTION - Module Revenue Management
-- Migration SQL
-- =============================================

SET NAMES utf8;

-- Configuration Xotelo pour chaque hôtel
ALTER TABLE hotels 
ADD COLUMN IF NOT EXISTS xotelo_hotel_key VARCHAR(100) DEFAULT NULL AFTER logo_url;

-- Table des concurrents par hôtel
CREATE TABLE IF NOT EXISTS hotel_competitors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    competitor_name VARCHAR(255) NOT NULL,
    xotelo_hotel_key VARCHAR(100) NOT NULL,
    competitor_stars TINYINT UNSIGNED DEFAULT 3,
    competitor_city VARCHAR(100),
    display_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_hotel (hotel_id),
    UNIQUE KEY unique_competitor (hotel_id, xotelo_hotel_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Cache des tarifs récupérés de Xotelo
CREATE TABLE IF NOT EXISTS xotelo_rates_cache (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    source_type ENUM('own', 'competitor') NOT NULL,
    source_hotel_key VARCHAR(100) NOT NULL,
    source_name VARCHAR(255),
    check_date DATE NOT NULL,
    guests INT DEFAULT 2,
    room_type VARCHAR(100),
    ota_name VARCHAR(100),
    rate_amount DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'EUR',
    is_available TINYINT(1) DEFAULT 1,
    raw_data JSON,
    fetched_at DATETIME,
    INDEX idx_hotel_date (hotel_id, check_date),
    INDEX idx_source (source_hotel_key, check_date),
    INDEX idx_fetched (fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Historique des requêtes Xotelo (pour limiter les appels API)
CREATE TABLE IF NOT EXISTS xotelo_api_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED,
    request_type VARCHAR(50),
    hotel_keys_requested TEXT,
    date_from DATE,
    date_to DATE,
    response_status INT,
    error_message TEXT,
    created_at DATETIME,
    INDEX idx_hotel (hotel_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Permissions pour le module Revenue Management
INSERT INTO role_permissions (role, permission, allowed, updated_at) VALUES
('admin', 'revenue.view', 1, NOW()),
('admin', 'revenue.settings', 1, NOW()),
('admin', 'revenue.fetch_rates', 1, NOW()),
('groupe_manager', 'revenue.view', 1, NOW()),
('groupe_manager', 'revenue.settings', 1, NOW()),
('groupe_manager', 'revenue.fetch_rates', 1, NOW()),
('hotel_manager', 'revenue.view', 1, NOW()),
('hotel_manager', 'revenue.settings', 0, NOW()),
('hotel_manager', 'revenue.fetch_rates', 1, NOW()),
('comptabilite', 'revenue.view', 0, NOW()),
('comptabilite', 'revenue.settings', 0, NOW()),
('comptabilite', 'revenue.fetch_rates', 0, NOW()),
('rh', 'revenue.view', 0, NOW()),
('rh', 'revenue.settings', 0, NOW()),
('rh', 'revenue.fetch_rates', 0, NOW()),
('receptionniste', 'revenue.view', 0, NOW()),
('receptionniste', 'revenue.settings', 0, NOW()),
('receptionniste', 'revenue.fetch_rates', 0, NOW()),
('employee', 'revenue.view', 0, NOW()),
('employee', 'revenue.settings', 0, NOW()),
('employee', 'revenue.fetch_rates', 0, NOW())
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);
