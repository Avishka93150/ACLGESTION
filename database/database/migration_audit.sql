-- =============================================
-- ACL GESTION - Module Audit
-- Migration SQL
-- =============================================

SET NAMES utf8;

-- Grilles d'audit
CREATE TABLE IF NOT EXISTS audit_grids (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    hotel_id INT UNSIGNED,  -- NULL = global (tous hôtels)
    is_mandatory TINYINT(1) DEFAULT 0,
    frequency ENUM('once', 'weekly', 'monthly', 'quarterly', 'yearly') DEFAULT 'once',
    day_of_month TINYINT DEFAULT 1,  -- Jour du mois pour les audits mensuels
    reminder_days INT DEFAULT 7,  -- Rappel X jours avant deadline
    is_active TINYINT(1) DEFAULT 1,
    created_by INT UNSIGNED NOT NULL,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_hotel (hotel_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Questions de la grille d'audit
CREATE TABLE IF NOT EXISTS audit_questions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grid_id INT UNSIGNED NOT NULL,
    section VARCHAR(255),  -- Section/catégorie de la question
    question TEXT NOT NULL,
    question_type ENUM('rating', 'yes_no', 'text', 'multiple_choice') DEFAULT 'rating',
    options TEXT,  -- Options pour multiple_choice (JSON)
    rating_min INT DEFAULT 1,
    rating_max INT DEFAULT 10,
    weight DECIMAL(5,2) DEFAULT 1.00,  -- Coefficient de pondération
    comment_required TINYINT(1) DEFAULT 0,
    comment_optional TINYINT(1) DEFAULT 1,
    photo_required TINYINT(1) DEFAULT 0,
    photo_optional TINYINT(1) DEFAULT 1,
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME,
    INDEX idx_grid (grid_id),
    INDEX idx_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Permissions d'accès aux grilles (qui peut voir/faire l'audit)
CREATE TABLE IF NOT EXISTS audit_grid_permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grid_id INT UNSIGNED NOT NULL,
    permission_type ENUM('view', 'execute') NOT NULL,  -- view = voir résultats, execute = faire l'audit
    target_type ENUM('role', 'user', 'hotel') NOT NULL,
    target_id VARCHAR(50) NOT NULL,  -- ID user, role name, ou hotel_id
    created_at DATETIME,
    INDEX idx_grid (grid_id),
    INDEX idx_permission (permission_type, target_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Audits réalisés
CREATE TABLE IF NOT EXISTS audits (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grid_id INT UNSIGNED NOT NULL,
    hotel_id INT UNSIGNED NOT NULL,
    period_start DATE,  -- Début de la période couverte
    period_end DATE,    -- Fin de la période couverte
    status ENUM('draft', 'in_progress', 'completed', 'validated') DEFAULT 'draft',
    score_total DECIMAL(5,2),  -- Score global calculé
    score_max DECIMAL(5,2),    -- Score maximum possible
    score_percentage DECIMAL(5,2),  -- Pourcentage
    started_at DATETIME,
    completed_at DATETIME,
    validated_at DATETIME,
    validated_by INT UNSIGNED,
    performed_by INT UNSIGNED NOT NULL,
    notes TEXT,  -- Notes générales sur l'audit
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_grid (grid_id),
    INDEX idx_hotel (hotel_id),
    INDEX idx_status (status),
    INDEX idx_period (period_start, period_end),
    INDEX idx_performer (performed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Réponses aux questions d'audit
CREATE TABLE IF NOT EXISTS audit_answers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    audit_id INT UNSIGNED NOT NULL,
    question_id INT UNSIGNED NOT NULL,
    answer_value VARCHAR(255),  -- Valeur de la réponse (note, oui/non, choix)
    answer_text TEXT,  -- Commentaire
    photo_url VARCHAR(500),  -- URL de la photo
    score DECIMAL(5,2),  -- Score calculé pour cette question
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_audit (audit_id),
    INDEX idx_question (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Deadlines et rappels d'audit
CREATE TABLE IF NOT EXISTS audit_schedules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grid_id INT UNSIGNED NOT NULL,
    hotel_id INT UNSIGNED NOT NULL,
    period_year INT NOT NULL,
    period_month INT,  -- NULL pour yearly/quarterly
    period_quarter INT,  -- 1-4 pour quarterly
    deadline_date DATE NOT NULL,
    reminder_sent TINYINT(1) DEFAULT 0,
    reminder_sent_at DATETIME,
    overdue_notified TINYINT(1) DEFAULT 0,
    overdue_notified_at DATETIME,
    audit_id INT UNSIGNED,  -- Lien vers l'audit réalisé (si fait)
    status ENUM('pending', 'completed', 'overdue') DEFAULT 'pending',
    created_at DATETIME,
    INDEX idx_grid_hotel (grid_id, hotel_id),
    INDEX idx_deadline (deadline_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Historique des audits par hôtel (vue dénormalisée pour rapports)
CREATE TABLE IF NOT EXISTS audit_history (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    audit_id INT UNSIGNED NOT NULL,
    hotel_id INT UNSIGNED NOT NULL,
    grid_id INT UNSIGNED NOT NULL,
    grid_name VARCHAR(255),
    performed_by INT UNSIGNED,
    performer_name VARCHAR(255),
    completed_at DATETIME,
    score_percentage DECIMAL(5,2),
    INDEX idx_hotel (hotel_id),
    INDEX idx_date (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Insertion des permissions par défaut pour le module audit
INSERT INTO role_permissions (role, permission, allowed, updated_at) VALUES
('admin', 'audit_manage', 1, NOW()),
('admin', 'audit_create_grid', 1, NOW()),
('admin', 'audit_execute', 1, NOW()),
('admin', 'audit_view_all', 1, NOW()),
('groupe_manager', 'audit_manage', 1, NOW()),
('groupe_manager', 'audit_create_grid', 1, NOW()),
('groupe_manager', 'audit_execute', 1, NOW()),
('groupe_manager', 'audit_view_all', 1, NOW()),
('hotel_manager', 'audit_execute', 1, NOW()),
('hotel_manager', 'audit_view_hotel', 1, NOW()),
('employee', 'audit_execute', 1, NOW()),
('employee', 'audit_view_own', 1, NOW())
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

-- Table de liaison grilles-hôtels (pour sélection multiple)
CREATE TABLE IF NOT EXISTS audit_grid_hotels (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grid_id INT UNSIGNED NOT NULL,
    hotel_id INT UNSIGNED NOT NULL,
    created_at DATETIME,
    UNIQUE KEY unique_grid_hotel (grid_id, hotel_id),
    INDEX idx_grid (grid_id),
    INDEX idx_hotel (hotel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Migration des données existantes (hotel_id unique vers table de liaison)
INSERT IGNORE INTO audit_grid_hotels (grid_id, hotel_id, created_at)
SELECT id, hotel_id, NOW() FROM audit_grids WHERE hotel_id IS NOT NULL;
