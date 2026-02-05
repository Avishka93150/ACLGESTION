-- =============================================
-- Migration: Ajout table historique des tarifs
-- Date: 2026-01-13
-- =============================================

-- Table pour stocker l'historique des prix (évolution tarifaire)
CREATE TABLE IF NOT EXISTS xotelo_rates_history (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    source_type ENUM('own', 'competitor') NOT NULL,
    source_hotel_key VARCHAR(100) NOT NULL,
    source_name VARCHAR(255),
    check_date DATE NOT NULL,
    ota_name VARCHAR(100),
    rate_amount DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'EUR',
    fetched_at DATETIME NOT NULL,
    INDEX idx_hotel_date (hotel_id, check_date),
    INDEX idx_source_date (source_hotel_key, check_date),
    INDEX idx_fetched (fetched_at),
    INDEX idx_ota (ota_name),
    INDEX idx_history_lookup (hotel_id, source_hotel_key, check_date, ota_name, currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ajouter index sur currency dans la table cache si pas existant
-- ALTER TABLE xotelo_rates_cache ADD INDEX idx_currency (currency);

-- =============================================
-- Configuration du Cron Job
-- =============================================
-- 
-- Ajoutez cette tâche planifiée dans Plesk ou crontab :
-- 
-- # Actualisation automatique des tarifs Xotelo tous les jours à 6h00
-- 0 6 * * * php /chemin/vers/api/cron.php revenue >> /var/log/acl-revenue.log 2>&1
-- 
-- Alternative : deux fois par jour (6h et 18h)
-- 0 6,18 * * * php /chemin/vers/api/cron.php revenue >> /var/log/acl-revenue.log 2>&1
-- 
-- =============================================
