-- Migration: Gestion des automatisations
-- Date: 2025-01-15
-- Compatible MySQL 5.6+

-- Table principale des automatisations
CREATE TABLE IF NOT EXISTS automations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    module VARCHAR(50) NOT NULL COMMENT 'housekeeping, maintenance, tasks, leaves, audit, closure, revenue',
    is_global TINYINT(1) DEFAULT 0 COMMENT '1 = applique a tous les hotels',
    is_active TINYINT(1) DEFAULT 1,
    
    schedule_type ENUM('daily', 'weekly', 'monthly', 'interval') DEFAULT 'daily',
    schedule_time TIME DEFAULT '09:00:00' COMMENT 'Heure execution pour daily/weekly/monthly',
    schedule_days VARCHAR(20) DEFAULT NULL COMMENT 'Jours de la semaine (1-7) pour weekly, ex: 1,3,5',
    schedule_day_of_month INT DEFAULT NULL COMMENT 'Jour du mois pour monthly (1-31)',
    schedule_interval_minutes INT DEFAULT NULL COMMENT 'Intervalle en minutes pour type interval',
    
    condition_config TEXT DEFAULT NULL COMMENT 'Conditions supplementaires en JSON',
    
    last_run_at DATETIME DEFAULT NULL,
    last_run_status ENUM('success', 'error', 'partial') DEFAULT NULL,
    last_run_message TEXT DEFAULT NULL,
    run_count INT DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    
    INDEX idx_automations_active (is_active),
    INDEX idx_automations_module (module),
    INDEX idx_automations_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table de liaison automatisation <-> hotels
CREATE TABLE IF NOT EXISTS automation_hotels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    automation_id INT NOT NULL,
    hotel_id INT NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    custom_config TEXT DEFAULT NULL COMMENT 'Config specifique pour cet hotel en JSON',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_automation_hotel (automation_id, hotel_id),
    FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table des destinataires des notifications
CREATE TABLE IF NOT EXISTS automation_recipients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    automation_id INT NOT NULL,
    hotel_id INT DEFAULT NULL COMMENT 'NULL = tous les hotels de automatisation',
    
    recipient_type ENUM('user', 'role', 'email') NOT NULL,
    recipient_value VARCHAR(255) NOT NULL COMMENT 'user_id, role name, ou email',
    
    notification_channels VARCHAR(100) DEFAULT 'email' COMMENT 'email,sms,push separes par virgule',
    
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_recipients_automation (automation_id),
    FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table de logs execution
CREATE TABLE IF NOT EXISTS automation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    automation_id INT NOT NULL,
    hotel_id INT DEFAULT NULL,
    
    started_at DATETIME NOT NULL,
    ended_at DATETIME DEFAULT NULL,
    duration_ms INT DEFAULT NULL,
    
    status ENUM('running', 'success', 'error', 'skipped') NOT NULL,
    message TEXT,
    details TEXT DEFAULT NULL COMMENT 'Details en JSON: nb emails envoyes, erreurs, etc.',
    
    triggered_by ENUM('cron', 'manual', 'api') DEFAULT 'cron',
    triggered_by_user INT DEFAULT NULL,
    
    INDEX idx_logs_automation (automation_id),
    INDEX idx_logs_date (started_at),
    INDEX idx_logs_status (status),
    FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inserer les automatisations par defaut
INSERT INTO automations (name, code, description, module, is_global, schedule_type, schedule_time, schedule_days) VALUES
('Alerte Dispatch Incomplet', 'dispatch_alert', 'Verifie si des chambres ont ete dispatchees aujourd hui. Alerte si aucun dispatch.', 'housekeeping', 1, 'daily', '12:00:00', NULL),
('Alerte Controle Incomplet', 'control_alert', 'Verifie si les chambres nettoyees ont ete controlees. Alerte pour les chambres non controlees.', 'housekeeping', 1, 'daily', '19:00:00', NULL),
('Alertes Maintenance', 'maintenance_alert', 'Alerte pour les tickets de maintenance ouverts depuis plus de 48h (haute priorite) ou 72h (normale).', 'maintenance', 1, 'daily', '09:00:00', NULL),
('Rappel Conges en Attente', 'leaves_reminder', 'Rappel hebdomadaire des demandes de conges en attente de validation.', 'leaves', 1, 'weekly', '09:00:00', '1'),
('Rappel Taches a Echeance', 'tasks_due', 'Rappel des taches arrivant a echeance aujourd hui ou en retard.', 'tasks', 1, 'daily', '09:00:00', NULL),
('Rappel Audits', 'audit_reminder', 'Rappel des audits planifies a realiser et alertes pour les audits en retard.', 'audit', 1, 'daily', '09:00:00', NULL),
('Rappel Cloture Journaliere', 'closure_reminder', 'Verifie si la cloture journaliere a ete effectuee. Rappel en milieu et fin de journee.', 'closure', 1, 'daily', '13:00:00', NULL),
('Mise a Jour Tarifs', 'revenue_update', 'Actualise les tarifs depuis Xotelo pour tous les hotels configures.', 'revenue', 1, 'daily', '06:00:00', NULL),
('Nettoyage Systeme', 'system_cleanup', 'Supprime les tokens expires, anciennes donnees temporaires et logs obsoletes.', 'system', 1, 'daily', '03:00:00', NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Activer toutes les automatisations pour tous les hotels existants
INSERT INTO automation_hotels (automation_id, hotel_id, is_active)
SELECT a.id, h.id, 1
FROM automations a
CROSS JOIN hotels h
WHERE a.is_global = 1
ON DUPLICATE KEY UPDATE is_active = 1;

-- Ajouter les destinataires par defaut (roles)
INSERT INTO automation_recipients (automation_id, recipient_type, recipient_value, notification_channels)
SELECT a.id, 'role', 
    CASE 
        WHEN a.module = 'housekeeping' THEN 'hotel_manager'
        WHEN a.module = 'maintenance' THEN 'hotel_manager'
        WHEN a.module = 'leaves' THEN 'groupe_manager'
        WHEN a.module = 'tasks' THEN 'hotel_manager'
        WHEN a.module = 'audit' THEN 'groupe_manager'
        WHEN a.module = 'closure' THEN 'hotel_manager'
        WHEN a.module = 'revenue' THEN 'admin'
        ELSE 'admin'
    END,
    'email'
FROM automations a
ON DUPLICATE KEY UPDATE recipient_value = VALUES(recipient_value);
