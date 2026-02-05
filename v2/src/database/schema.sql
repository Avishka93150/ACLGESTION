-- =============================================
-- ACL GESTION - Schema MySQL 5.x
-- Base: acl_gestion
-- =============================================

SET NAMES utf8;
SET FOREIGN_KEY_CHECKS = 0;

-- Utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('admin','groupe_manager','hotel_manager','comptabilite','rh','receptionniste','employee') DEFAULT 'employee',
    status ENUM('active','inactive') DEFAULT 'active',
    last_login DATETIME,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Affectation utilisateurs aux hôtels
CREATE TABLE IF NOT EXISTS user_hotels (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    hotel_id INT UNSIGNED NOT NULL,
    assigned_at DATETIME,
    assigned_by INT UNSIGNED,
    UNIQUE KEY unique_assignment (user_id, hotel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Permissions par rôle
CREATE TABLE IF NOT EXISTS role_permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    allowed TINYINT(1) DEFAULT 0,
    updated_at DATETIME,
    UNIQUE KEY unique_perm (role, permission)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Hôtels
CREATE TABLE IF NOT EXISTS hotels (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    city VARCHAR(100),
    postal_code VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    stars TINYINT UNSIGNED DEFAULT 3,
    total_floors INT UNSIGNED DEFAULT 1,
    checkin_time TIME DEFAULT '15:00:00',
    checkout_time TIME DEFAULT '11:00:00',
    logo_url VARCHAR(500),
    xotelo_hotel_key VARCHAR(100) DEFAULT NULL,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Chambres
CREATE TABLE IF NOT EXISTS rooms (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    room_number VARCHAR(10) NOT NULL,
    floor INT DEFAULT 1,
    room_type ENUM('standard','superieure','suite','familiale','pmr') DEFAULT 'standard',
    bed_type ENUM('single','double','twin','king','queen') DEFAULT 'double',
    status ENUM('active','hors_service','renovation') DEFAULT 'active',
    created_at DATETIME,
    updated_at DATETIME,
    UNIQUE KEY unique_room (hotel_id, room_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Dispatch Gouvernante
CREATE TABLE IF NOT EXISTS room_dispatch (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id INT UNSIGNED NOT NULL,
    dispatch_date DATE NOT NULL,
    cleaning_type ENUM('blanc','recouche') NOT NULL,
    assigned_to INT UNSIGNED,
    created_by INT UNSIGNED,
    status ENUM('pending','completed','controlled') DEFAULT 'pending',
    priority ENUM('normal','urgent') DEFAULT 'normal',
    completed_at DATETIME,
    completed_by INT UNSIGNED,
    controlled_by INT UNSIGNED,
    controlled_at DATETIME,
    control_status ENUM('pending','ok','not_ok') DEFAULT 'pending',
    control_notes TEXT,
    control_photos TEXT DEFAULT NULL,
    -- Grille de contrôle
    ctrl_literie TINYINT(1) DEFAULT NULL,
    ctrl_salle_bain TINYINT(1) DEFAULT NULL,
    ctrl_sol_surfaces TINYINT(1) DEFAULT NULL,
    ctrl_equipements TINYINT(1) DEFAULT NULL,
    ctrl_ambiance TINYINT(1) DEFAULT NULL,
    ctrl_proprete TINYINT(1) DEFAULT NULL,
    created_at DATETIME,
    updated_at DATETIME,
    UNIQUE KEY unique_dispatch (room_id, dispatch_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Suivi des alertes dispatch
CREATE TABLE IF NOT EXISTS dispatch_alerts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    alert_date DATE NOT NULL,
    alert_type ENUM('dispatch_incomplet','controle_incomplet') NOT NULL,
    consecutive_count INT DEFAULT 1,
    notified_hotel_manager TINYINT(1) DEFAULT 0,
    notified_groupe_manager TINYINT(1) DEFAULT 0,
    notified_admin TINYINT(1) DEFAULT 0,
    created_at DATETIME,
    UNIQUE KEY unique_alert (hotel_id, alert_date, alert_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Tickets Maintenance
CREATE TABLE IF NOT EXISTS maintenance_tickets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    room_number VARCHAR(10),
    category ENUM('plomberie','electricite','climatisation','mobilier','serrurerie','peinture','nettoyage','autre') NOT NULL,
    description TEXT NOT NULL,
    photo VARCHAR(255) DEFAULT NULL,
    priority ENUM('low','medium','high','critical') DEFAULT 'medium',
    status ENUM('open','in_progress','resolved') DEFAULT 'open',
    reported_by INT UNSIGNED NOT NULL,
    assigned_to INT UNSIGNED,
    resolved_by INT UNSIGNED,
    resolution_notes TEXT,
    assigned_at DATETIME,
    resolved_at DATETIME,
    created_at DATETIME,
    updated_at DATETIME,
    notified_48h TINYINT(1) DEFAULT 0,
    notified_72h TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Commentaires/Suivi des tickets maintenance
CREATE TABLE IF NOT EXISTS ticket_comments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    comment TEXT NOT NULL,
    comment_type ENUM('comment','status_change','assignment','resolution') DEFAULT 'comment',
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    created_at DATETIME,
    INDEX idx_ticket (ticket_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- =============================================
-- MODULE TÂCHES (Kanban style Trello)
-- =============================================

-- Tableaux de tâches (boards)
CREATE TABLE IF NOT EXISTS task_boards (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#1E3A5F',
    is_archived TINYINT(1) DEFAULT 0,
    created_by INT UNSIGNED NOT NULL,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_hotel (hotel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Colonnes des tableaux
CREATE TABLE IF NOT EXISTS task_columns (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    board_id INT UNSIGNED NOT NULL,
    name VARCHAR(50) NOT NULL,
    position INT DEFAULT 0,
    color VARCHAR(7) DEFAULT '#6B7280',
    created_at DATETIME,
    INDEX idx_board (board_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Tâches (cards)
CREATE TABLE IF NOT EXISTS tasks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    board_id INT UNSIGNED NOT NULL,
    column_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
    due_date DATE,
    assigned_to INT UNSIGNED,
    position INT DEFAULT 0,
    is_completed TINYINT(1) DEFAULT 0,
    completed_at DATETIME,
    completed_by INT UNSIGNED,
    created_by INT UNSIGNED NOT NULL,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_board (board_id),
    INDEX idx_column (column_id),
    INDEX idx_assigned (assigned_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Commentaires sur les tâches
CREATE TABLE IF NOT EXISTS task_comments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    task_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME,
    INDEX idx_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Checklists des tâches
CREATE TABLE IF NOT EXISTS task_checklists (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    task_id INT UNSIGNED NOT NULL,
    item_text VARCHAR(255) NOT NULL,
    is_checked TINYINT(1) DEFAULT 0,
    position INT DEFAULT 0,
    checked_by INT UNSIGNED,
    checked_at DATETIME,
    created_at DATETIME,
    INDEX idx_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Labels/Étiquettes
CREATE TABLE IF NOT EXISTS task_labels (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    board_id INT UNSIGNED NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL,
    INDEX idx_board (board_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Association tâches-labels
CREATE TABLE IF NOT EXISTS task_label_assignments (
    task_id INT UNSIGNED NOT NULL,
    label_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (task_id, label_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- =============================================
-- MODULE ÉVALUATIONS
-- =============================================

-- Grilles d'évaluation
CREATE TABLE IF NOT EXISTS evaluation_grids (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    hotel_id INT UNSIGNED NULL COMMENT 'NULL = tous les hôtels (admin)',
    target_role ENUM('admin','groupe_manager','hotel_manager','comptabilite','rh','receptionniste','employee') NOT NULL DEFAULT 'employee',
    periodicity ENUM('monthly','quarterly','annual','one_time') DEFAULT 'quarterly',
    instructions TEXT COMMENT 'Instructions affichées au début du formulaire',
    allow_attachment TINYINT(1) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_by INT UNSIGNED NOT NULL,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_hotel (hotel_id),
    INDEX idx_role (target_role),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Questions des grilles
CREATE TABLE IF NOT EXISTS evaluation_questions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grid_id INT UNSIGNED NOT NULL,
    question_text VARCHAR(500) NOT NULL,
    category VARCHAR(100) COMMENT 'Catégorie/Section: Qualité, RH, Performance...',
    weight DECIMAL(3,1) DEFAULT 1.0 COMMENT 'Poids pour score pondéré',
    response_type ENUM('score','yesno','choice','text') DEFAULT 'score' COMMENT 'Type de réponse',
    min_score INT DEFAULT 1 COMMENT 'Note minimum',
    max_score INT DEFAULT 10 COMMENT 'Note maximum',
    choices TEXT COMMENT 'Options de choix (une par ligne)',
    multiple_selection TINYINT(1) DEFAULT 0 COMMENT 'Autoriser plusieurs sélections',
    position INT DEFAULT 0,
    is_required TINYINT(1) DEFAULT 1,
    comment_required TINYINT(1) DEFAULT 0 COMMENT 'Commentaire obligatoire pour cette question',
    file_optional TINYINT(1) DEFAULT 0 COMMENT 'Pièce jointe autorisée',
    file_required TINYINT(1) DEFAULT 0 COMMENT 'Pièce jointe obligatoire',
    created_at DATETIME,
    INDEX idx_grid (grid_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Évaluations réalisées
CREATE TABLE IF NOT EXISTS evaluations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grid_id INT UNSIGNED NOT NULL,
    hotel_id INT UNSIGNED NOT NULL,
    evaluated_user_id INT UNSIGNED NOT NULL COMMENT 'Utilisateur évalué',
    evaluator_id INT UNSIGNED NOT NULL COMMENT 'Évaluateur',
    evaluation_date DATE NOT NULL,
    period_start DATE COMMENT 'Début période évaluée',
    period_end DATE COMMENT 'Fin période évaluée',
    global_comment TEXT COMMENT 'Commentaire global',
    conclusion TEXT COMMENT 'Conclusion/Synthèse',
    score_simple DECIMAL(4,2) COMMENT 'Score moyen simple (1-10)',
    score_weighted DECIMAL(4,2) COMMENT 'Score pondéré',
    attachment VARCHAR(255) COMMENT 'Fichier joint',
    status ENUM('draft','validated','archived') DEFAULT 'draft',
    validated_at DATETIME,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_grid (grid_id),
    INDEX idx_hotel (hotel_id),
    INDEX idx_evaluated (evaluated_user_id),
    INDEX idx_evaluator (evaluator_id),
    INDEX idx_status (status),
    INDEX idx_date (evaluation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ==================== MODULE CLOTURES & REMISES ====================

-- Configuration des documents de clôture par hôtel
CREATE TABLE IF NOT EXISTS closure_config (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    closure_type ENUM('daily', 'monthly') DEFAULT 'daily' COMMENT 'Type de clôture',
    document_name VARCHAR(200) NOT NULL COMMENT 'Nom du document à déposer',
    is_required TINYINT(1) DEFAULT 1 COMMENT 'Document obligatoire',
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME,
    INDEX idx_hotel (hotel_id),
    INDEX idx_type (closure_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Champs personnalisés pour les clôtures
CREATE TABLE IF NOT EXISTS closure_config_fields (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    config_id INT UNSIGNED NOT NULL COMMENT 'Référence closure_config',
    field_name VARCHAR(200) NOT NULL COMMENT 'Nom du champ/question',
    field_type ENUM('text', 'number', 'decimal', 'date', 'select') DEFAULT 'text',
    field_options TEXT COMMENT 'Options pour select (JSON)',
    is_required TINYINT(1) DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at DATETIME,
    INDEX idx_config (config_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Clôtures journalières
CREATE TABLE IF NOT EXISTS daily_closures (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    closure_date DATE NOT NULL COMMENT 'Date de la clôture (J-1)',
    cash_received DECIMAL(10,2) DEFAULT 0 COMMENT 'Montant encaissé en espèces',
    cash_spent DECIMAL(10,2) DEFAULT 0 COMMENT 'Montant dépensé',
    cash_balance DECIMAL(10,2) DEFAULT 0 COMMENT 'Solde caisse calculé',
    notes TEXT COMMENT 'Commentaires',
    status ENUM('draft', 'submitted', 'validated', 'rejected') DEFAULT 'draft',
    submitted_by INT UNSIGNED COMMENT 'Utilisateur ayant soumis',
    submitted_at DATETIME,
    validated_by INT UNSIGNED,
    validated_at DATETIME,
    created_at DATETIME,
    updated_at DATETIME,
    UNIQUE KEY unique_closure (hotel_id, closure_date),
    INDEX idx_hotel (hotel_id),
    INDEX idx_date (closure_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Documents déposés pour les clôtures
CREATE TABLE IF NOT EXISTS closure_documents (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    closure_id INT UNSIGNED NOT NULL COMMENT 'Référence daily_closures',
    config_id INT UNSIGNED NOT NULL COMMENT 'Référence closure_config',
    file_url VARCHAR(500) COMMENT 'URL du fichier déposé',
    uploaded_at DATETIME,
    INDEX idx_closure (closure_id),
    INDEX idx_config (config_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Réponses aux champs personnalisés
CREATE TABLE IF NOT EXISTS closure_field_values (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    closure_id INT UNSIGNED NOT NULL,
    field_id INT UNSIGNED NOT NULL COMMENT 'Référence closure_config_fields',
    field_value TEXT,
    INDEX idx_closure (closure_id),
    INDEX idx_field (field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Alertes de clôture non effectuées
CREATE TABLE IF NOT EXISTS closure_alerts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    closure_date DATE NOT NULL,
    alert_level TINYINT DEFAULT 1 COMMENT '1=13h (manager), 2=48h (admin)',
    sent_at DATETIME,
    INDEX idx_hotel_date (hotel_id, closure_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Suivi caisse (solde par hôtel)
CREATE TABLE IF NOT EXISTS cash_tracking (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    tracking_date DATE NOT NULL,
    opening_balance DECIMAL(10,2) DEFAULT 0 COMMENT 'Solde ouverture',
    cash_in DECIMAL(10,2) DEFAULT 0 COMMENT 'Entrées espèces',
    cash_out DECIMAL(10,2) DEFAULT 0 COMMENT 'Sorties espèces',
    closing_balance DECIMAL(10,2) DEFAULT 0 COMMENT 'Solde clôture',
    closure_id INT UNSIGNED COMMENT 'Référence clôture journalière',
    created_at DATETIME,
    UNIQUE KEY unique_tracking (hotel_id, tracking_date),
    INDEX idx_hotel (hotel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Clôtures mensuelles
CREATE TABLE IF NOT EXISTS monthly_closures (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    closure_month DATE NOT NULL COMMENT 'Premier jour du mois',
    total_cash_received DECIMAL(12,2) DEFAULT 0,
    total_cash_spent DECIMAL(12,2) DEFAULT 0,
    opening_balance DECIMAL(10,2) DEFAULT 0,
    closing_balance DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    status ENUM('draft', 'submitted', 'validated') DEFAULT 'draft',
    submitted_by INT UNSIGNED,
    submitted_at DATETIME,
    validated_by INT UNSIGNED,
    validated_at DATETIME,
    created_at DATETIME,
    UNIQUE KEY unique_monthly (hotel_id, closure_month),
    INDEX idx_hotel (hotel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Réponses aux questions d'évaluation
CREATE TABLE IF NOT EXISTS evaluation_answers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    evaluation_id INT UNSIGNED NOT NULL,
    question_id INT UNSIGNED NOT NULL,
    score TINYINT UNSIGNED COMMENT 'Note (pour type score)',
    answer_yesno ENUM('yes','no','na') COMMENT 'Réponse Oui/Non/NA',
    answer_choice TEXT COMMENT 'Choix sélectionnés (séparés par ||)',
    answer_text TEXT COMMENT 'Réponse texte libre',
    comment TEXT COMMENT 'Remarque/commentaire',
    file_url VARCHAR(500) COMMENT 'URL pièce jointe (photo/PDF)',
    INDEX idx_evaluation (evaluation_id),
    INDEX idx_question (question_id),
    UNIQUE KEY unique_answer (evaluation_id, question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- =============================================
-- NOTIFICATIONS
-- =============================================

-- Notifications (voir définition plus bas)

-- Configuration système
CREATE TABLE IF NOT EXISTS system_config (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Configuration Blanchisserie par hôtel
CREATE TABLE IF NOT EXISTS linen_config (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL UNIQUE,
    petit_draps TINYINT(1) DEFAULT 1,
    petite_housse TINYINT(1) DEFAULT 1,
    grand_draps TINYINT(1) DEFAULT 1,
    grande_housse TINYINT(1) DEFAULT 1,
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Transactions Blanchisserie
CREATE TABLE IF NOT EXISTS linen_transactions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    transaction_type ENUM('collecte','reception','stock') NOT NULL,
    transaction_date DATE NOT NULL,
    petit_draps INT DEFAULT 0,
    petite_housse INT DEFAULT 0,
    grand_draps INT DEFAULT 0,
    grande_housse INT DEFAULT 0,
    document_url VARCHAR(255),
    created_by INT UNSIGNED NOT NULL,
    created_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Demandes Congés
CREATE TABLE IF NOT EXISTS leave_requests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INT NOT NULL,
    leave_type ENUM('cp','rtt','sans_solde','maladie','autre') DEFAULT 'cp',
    comment TEXT,
    status ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
    quarter VARCHAR(5),
    year INT,
    hotel_id INT UNSIGNED,
    is_manual TINYINT(1) DEFAULT 0,
    created_by INT UNSIGNED,
    validated_by INT UNSIGNED,
    validated_at DATETIME,
    rejection_reason TEXT,
    approval_comment TEXT COMMENT 'Commentaire lors de l approbation',
    created_at DATETIME,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Solde Congés
CREATE TABLE IF NOT EXISTS leave_balance (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL,
    year INT NOT NULL,
    total_days INT DEFAULT 25,
    used_days INT DEFAULT 0,
    pending_days INT DEFAULT 0,
    updated_at DATETIME,
    UNIQUE KEY unique_balance (employee_id, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info','warning','danger','success') DEFAULT 'info',
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Messages internes (ancien système)
CREATE TABLE IF NOT EXISTS messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_id INT UNSIGNED NOT NULL,
    recipient_id INT UNSIGNED,
    hotel_id INT UNSIGNED,
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority ENUM('normal','urgent') DEFAULT 'normal',
    is_broadcast TINYINT(1) DEFAULT 0,
    is_system TINYINT(1) DEFAULT 0,
    is_read TINYINT(1) DEFAULT 0,
    read_at DATETIME,
    created_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Conversations (Messenger-style)
CREATE TABLE IF NOT EXISTS conversations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user1_id INT UNSIGNED NOT NULL,
    user2_id INT UNSIGNED NOT NULL,
    last_message VARCHAR(255),
    last_at DATETIME,
    created_at DATETIME,
    UNIQUE KEY unique_conv (user1_id, user2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Messages de conversation
CREATE TABLE IF NOT EXISTS conversation_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT UNSIGNED NOT NULL,
    sender_id INT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME,
    INDEX idx_conv (conversation_id),
    INDEX idx_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- =============================================
-- MODULE TIME (Planning, Émargement, Gestion Temps)
-- =============================================

-- Services/Départements par hôtel
CREATE TABLE IF NOT EXISTS time_services (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    color VARCHAR(7) DEFAULT '#1E3A5F',
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_hotel (hotel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Postes de travail
CREATE TABLE IF NOT EXISTS time_positions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    service_id INT UNSIGNED,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    color VARCHAR(7) DEFAULT '#2D8B6F',
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME,
    INDEX idx_hotel (hotel_id),
    INDEX idx_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Affectation employé -> poste
CREATE TABLE IF NOT EXISTS time_user_positions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    position_id INT UNSIGNED NOT NULL,
    is_primary TINYINT(1) DEFAULT 1,
    start_date DATE,
    end_date DATE,
    created_at DATETIME,
    INDEX idx_user (user_id),
    INDEX idx_position (position_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Contrats de travail
CREATE TABLE IF NOT EXISTS time_contracts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    hotel_id INT UNSIGNED NOT NULL,
    contract_type ENUM('cdi','cdd','interim','stage','apprentissage','extra') NOT NULL DEFAULT 'cdi',
    start_date DATE NOT NULL,
    end_date DATE,
    weekly_hours DECIMAL(5,2) DEFAULT 35.00,
    hourly_rate DECIMAL(8,2),
    is_active TINYINT(1) DEFAULT 1,
    notes TEXT,
    created_by INT UNSIGNED,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_user (user_id),
    INDEX idx_hotel (hotel_id),
    INDEX idx_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Planning hebdomadaire (en-tête)
CREATE TABLE IF NOT EXISTS time_schedules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED NOT NULL,
    service_id INT UNSIGNED,
    week_start DATE NOT NULL COMMENT 'Lundi de la semaine',
    status ENUM('draft','published','locked') DEFAULT 'draft',
    published_at DATETIME,
    published_by INT UNSIGNED,
    locked_at DATETIME,
    locked_by INT UNSIGNED,
    notes TEXT,
    created_by INT UNSIGNED,
    created_at DATETIME,
    updated_at DATETIME,
    UNIQUE KEY unique_week (hotel_id, service_id, week_start),
    INDEX idx_hotel_week (hotel_id, week_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Créneaux horaires planifiés
CREATE TABLE IF NOT EXISTS time_schedule_entries (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    schedule_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    work_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    break_minutes INT DEFAULT 0 COMMENT 'Pause en minutes',
    break_start TIME,
    break_end TIME,
    position_id INT UNSIGNED COMMENT 'Poste si différent du principal',
    entry_type ENUM('work','rest','absence') DEFAULT 'work',
    absence_type VARCHAR(50) COMMENT 'Type absence si entry_type=absence',
    worked_minutes INT DEFAULT 0,
    notes TEXT,
    created_by INT UNSIGNED,
    created_at DATETIME,
    updated_at DATETIME,
    INDEX idx_schedule (schedule_id),
    INDEX idx_user_date (user_id, work_date),
    INDEX idx_date (work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Émargement (heures réelles)
CREATE TABLE IF NOT EXISTS time_entries (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    hotel_id INT UNSIGNED NOT NULL,
    work_date DATE NOT NULL,
    
    -- Heures planifiées (copiées depuis schedule_entries)
    planned_start TIME,
    planned_end TIME,
    planned_break INT DEFAULT 0,
    
    -- Heures réelles
    actual_start TIME,
    actual_end TIME,
    actual_break INT DEFAULT 0,
    
    -- Calculs en minutes
    planned_minutes INT DEFAULT 0,
    actual_minutes INT DEFAULT 0,
    diff_minutes INT DEFAULT 0 COMMENT 'Écart réel vs planifié',
    
    -- Statut
    status ENUM('pending','validated','corrected','disputed') DEFAULT 'pending',
    validated_by INT UNSIGNED,
    validated_at DATETIME,
    
    -- Métadonnées
    entry_type ENUM('work','rest','absence') DEFAULT 'work',
    absence_type VARCHAR(50),
    position_id INT UNSIGNED,
    notes TEXT,
    correction_reason TEXT,
    
    created_at DATETIME,
    updated_at DATETIME,
    
    UNIQUE KEY unique_user_date (user_id, work_date),
    INDEX idx_hotel_date (hotel_id, work_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Compteurs de temps (hebdomadaires/mensuels)
CREATE TABLE IF NOT EXISTS time_counters (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    hotel_id INT UNSIGNED NOT NULL,
    period_type ENUM('weekly','monthly') NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Compteurs en minutes
    contract_minutes INT DEFAULT 0 COMMENT 'Heures contrat pour la période',
    planned_minutes INT DEFAULT 0,
    worked_minutes INT DEFAULT 0,
    absence_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    undertime_minutes INT DEFAULT 0,
    
    -- Compteurs spéciaux
    night_minutes INT DEFAULT 0,
    sunday_minutes INT DEFAULT 0,
    holiday_minutes INT DEFAULT 0,
    
    -- Jours
    worked_days INT DEFAULT 0,
    rest_days INT DEFAULT 0,
    absence_days INT DEFAULT 0,
    
    status ENUM('open','closed') DEFAULT 'open',
    closed_at DATETIME,
    closed_by INT UNSIGNED,
    
    created_at DATETIME,
    updated_at DATETIME,
    
    UNIQUE KEY unique_period (user_id, period_type, period_start),
    INDEX idx_user (user_id),
    INDEX idx_hotel (hotel_id),
    INDEX idx_period (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Modèles de planning (favoris/templates)
CREATE TABLE IF NOT EXISTS time_templates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT UNSIGNED,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INT DEFAULT 60,
    color VARCHAR(7) DEFAULT '#1E3A5F',
    is_global TINYINT(1) DEFAULT 0 COMMENT '1 = disponible pour tous les hôtels',
    created_by INT UNSIGNED,
    created_at DATETIME,
    INDEX idx_hotel (hotel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Jours fériés
CREATE TABLE IF NOT EXISTS time_holidays (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    holiday_date DATE NOT NULL,
    is_worked TINYINT(1) DEFAULT 0 COMMENT '1 = jour travaillé',
    country VARCHAR(2) DEFAULT 'FR',
    created_at DATETIME,
    UNIQUE KEY unique_date (holiday_date, country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- DONNEES INITIALES
-- =============================================

-- Admin (mot de passe: Admin@123)
INSERT INTO users (email, password, first_name, last_name, role, status, created_at) 
VALUES ('admin@acl-gestion.fr', '$2y$10$xLRsMXJ3qYfQoEIL8VNf8OzDl6VKVvLqbG1qJkF3McXa1DQXNWQW6', 'Admin', 'ACL', 'admin', 'active', NOW());

-- Note: linen_categories a ete remplacee par linen_config et linen_transactions.
-- Les types de linge sont geres directement dans les colonnes de ces tables.

-- Hôtel démo
INSERT INTO hotels (name, address, city, postal_code, phone, email, stars, total_floors, checkin_time, checkout_time, status, created_at) 
VALUES ('Hôtel Paris Centre', '15 Rue de Rivoli', 'Paris', '75001', '01 42 36 00 00', 'contact@hotel-paris-centre.fr', 4, 6, '15:00:00', '11:00:00', 'active', NOW());

-- Chambres démo
INSERT INTO rooms (hotel_id, room_number, floor, room_type, bed_type, status, created_at) VALUES 
(1, '101', 1, 'standard', 'double', 'active', NOW()),
(1, '102', 1, 'standard', 'twin', 'active', NOW()),
(1, '103', 1, 'superieure', 'double', 'active', NOW()),
(1, '201', 2, 'standard', 'double', 'active', NOW()),
(1, '202', 2, 'familiale', 'king', 'active', NOW()),
(1, '301', 3, 'superieure', 'queen', 'active', NOW()),
(1, '302', 3, 'suite', 'king', 'active', NOW()),
(1, '401', 4, 'suite', 'king', 'active', NOW()),
(1, '402', 4, 'pmr', 'double', 'active', NOW());

-- Permissions par défaut (selon matrice complète)
-- IMPORTANT: Toutes les permissions doivent être explicitement définies

-- Admin (toutes les permissions)
INSERT INTO role_permissions (role, permission, allowed, updated_at) VALUES
('admin', 'hotels.view', 1, NOW()), ('admin', 'hotels.create', 1, NOW()), ('admin', 'hotels.edit', 1, NOW()), ('admin', 'hotels.delete', 1, NOW()), ('admin', 'rooms.manage', 1, NOW()),
('admin', 'users.view', 1, NOW()), ('admin', 'users.manage', 1, NOW()),
('admin', 'dispatch.view', 1, NOW()), ('admin', 'dispatch.create', 1, NOW()), ('admin', 'dispatch.complete', 1, NOW()), ('admin', 'dispatch.control', 1, NOW()),
('admin', 'linen.view', 1, NOW()), ('admin', 'linen.manage', 1, NOW()), ('admin', 'linen.config', 1, NOW()),
('admin', 'leaves.view', 1, NOW()), ('admin', 'leaves.create', 1, NOW()), ('admin', 'leaves.validate', 1, NOW()), ('admin', 'leaves.manage_all', 1, NOW()),
('admin', 'maintenance.view', 1, NOW()), ('admin', 'maintenance.create', 1, NOW()), ('admin', 'maintenance.manage', 1, NOW()), ('admin', 'maintenance.comment', 1, NOW()),
('admin', 'tasks.view', 1, NOW()), ('admin', 'tasks.create', 1, NOW()), ('admin', 'tasks.manage', 1, NOW()), ('admin', 'tasks.assign', 1, NOW()),
('admin', 'evaluations.view', 1, NOW()), ('admin', 'evaluations.grids', 1, NOW()), ('admin', 'evaluations.evaluate', 1, NOW()), ('admin', 'evaluations.view_own', 1, NOW()),
('admin', 'audit.view', 1, NOW()), ('admin', 'audit.grids', 1, NOW()), ('admin', 'audit.execute', 1, NOW()), ('admin', 'audit.view_results', 1, NOW()),
('admin', 'closures.view', 1, NOW()), ('admin', 'closures.create', 1, NOW()), ('admin', 'closures.validate', 1, NOW()), ('admin', 'closures.edit_all', 1, NOW()), ('admin', 'closures.add_remise', 1, NOW()), ('admin', 'closures.add_comment', 1, NOW()),
('admin', 'messages.access', 1, NOW()), ('admin', 'messages.broadcast', 1, NOW()), ('admin', 'notifications.receive', 1, NOW()),
('admin', 'dashboard.view', 1, NOW()), ('admin', 'dashboard.global', 1, NOW()), ('admin', 'reports.access', 1, NOW()), ('admin', 'reports.export', 1, NOW()),
('admin', 'permissions.manage', 1, NOW());

-- Responsable Groupe
INSERT INTO role_permissions (role, permission, allowed, updated_at) VALUES
('groupe_manager', 'hotels.view', 1, NOW()), ('groupe_manager', 'hotels.create', 0, NOW()), ('groupe_manager', 'hotels.edit', 1, NOW()), ('groupe_manager', 'hotels.delete', 0, NOW()), ('groupe_manager', 'rooms.manage', 1, NOW()),
('groupe_manager', 'users.view', 1, NOW()), ('groupe_manager', 'users.manage', 1, NOW()),
('groupe_manager', 'dispatch.view', 1, NOW()), ('groupe_manager', 'dispatch.create', 1, NOW()), ('groupe_manager', 'dispatch.complete', 1, NOW()), ('groupe_manager', 'dispatch.control', 1, NOW()),
('groupe_manager', 'linen.view', 1, NOW()), ('groupe_manager', 'linen.manage', 1, NOW()), ('groupe_manager', 'linen.config', 1, NOW()),
('groupe_manager', 'leaves.view', 1, NOW()), ('groupe_manager', 'leaves.create', 1, NOW()), ('groupe_manager', 'leaves.validate', 1, NOW()), ('groupe_manager', 'leaves.manage_all', 1, NOW()),
('groupe_manager', 'maintenance.view', 1, NOW()), ('groupe_manager', 'maintenance.create', 1, NOW()), ('groupe_manager', 'maintenance.manage', 1, NOW()), ('groupe_manager', 'maintenance.comment', 1, NOW()),
('groupe_manager', 'tasks.view', 1, NOW()), ('groupe_manager', 'tasks.create', 1, NOW()), ('groupe_manager', 'tasks.manage', 1, NOW()), ('groupe_manager', 'tasks.assign', 1, NOW()),
('groupe_manager', 'evaluations.view', 1, NOW()), ('groupe_manager', 'evaluations.grids', 1, NOW()), ('groupe_manager', 'evaluations.evaluate', 1, NOW()), ('groupe_manager', 'evaluations.view_own', 1, NOW()),
('groupe_manager', 'audit.view', 1, NOW()), ('groupe_manager', 'audit.grids', 1, NOW()), ('groupe_manager', 'audit.execute', 1, NOW()), ('groupe_manager', 'audit.view_results', 1, NOW()),
('groupe_manager', 'closures.view', 1, NOW()), ('groupe_manager', 'closures.create', 1, NOW()), ('groupe_manager', 'closures.validate', 1, NOW()), ('groupe_manager', 'closures.edit_all', 1, NOW()), ('groupe_manager', 'closures.add_remise', 1, NOW()), ('groupe_manager', 'closures.add_comment', 1, NOW()),
('groupe_manager', 'messages.access', 1, NOW()), ('groupe_manager', 'messages.broadcast', 1, NOW()), ('groupe_manager', 'notifications.receive', 1, NOW()),
('groupe_manager', 'dashboard.view', 1, NOW()), ('groupe_manager', 'dashboard.global', 1, NOW()), ('groupe_manager', 'reports.access', 1, NOW()), ('groupe_manager', 'reports.export', 1, NOW()),
('groupe_manager', 'permissions.manage', 0, NOW());

-- Responsable Hôtel
INSERT INTO role_permissions (role, permission, allowed, updated_at) VALUES
('hotel_manager', 'hotels.view', 1, NOW()), ('hotel_manager', 'hotels.create', 0, NOW()), ('hotel_manager', 'hotels.edit', 1, NOW()), ('hotel_manager', 'hotels.delete', 0, NOW()), ('hotel_manager', 'rooms.manage', 1, NOW()),
('hotel_manager', 'users.view', 1, NOW()), ('hotel_manager', 'users.manage', 1, NOW()),
('hotel_manager', 'dispatch.view', 1, NOW()), ('hotel_manager', 'dispatch.create', 1, NOW()), ('hotel_manager', 'dispatch.complete', 1, NOW()), ('hotel_manager', 'dispatch.control', 1, NOW()),
('hotel_manager', 'linen.view', 1, NOW()), ('hotel_manager', 'linen.manage', 1, NOW()), ('hotel_manager', 'linen.config', 1, NOW()),
('hotel_manager', 'leaves.view', 1, NOW()), ('hotel_manager', 'leaves.create', 1, NOW()), ('hotel_manager', 'leaves.validate', 1, NOW()), ('hotel_manager', 'leaves.manage_all', 0, NOW()),
('hotel_manager', 'maintenance.view', 1, NOW()), ('hotel_manager', 'maintenance.create', 1, NOW()), ('hotel_manager', 'maintenance.manage', 1, NOW()), ('hotel_manager', 'maintenance.comment', 1, NOW()),
('hotel_manager', 'tasks.view', 1, NOW()), ('hotel_manager', 'tasks.create', 1, NOW()), ('hotel_manager', 'tasks.manage', 1, NOW()), ('hotel_manager', 'tasks.assign', 1, NOW()),
('hotel_manager', 'evaluations.view', 1, NOW()), ('hotel_manager', 'evaluations.grids', 0, NOW()), ('hotel_manager', 'evaluations.evaluate', 1, NOW()), ('hotel_manager', 'evaluations.view_own', 1, NOW()),
('hotel_manager', 'audit.view', 1, NOW()), ('hotel_manager', 'audit.grids', 0, NOW()), ('hotel_manager', 'audit.execute', 1, NOW()), ('hotel_manager', 'audit.view_results', 1, NOW()),
('hotel_manager', 'closures.view', 1, NOW()), ('hotel_manager', 'closures.create', 1, NOW()), ('hotel_manager', 'closures.validate', 1, NOW()), ('hotel_manager', 'closures.edit_all', 0, NOW()), ('hotel_manager', 'closures.add_remise', 1, NOW()), ('hotel_manager', 'closures.add_comment', 1, NOW()),
('hotel_manager', 'messages.access', 1, NOW()), ('hotel_manager', 'messages.broadcast', 1, NOW()), ('hotel_manager', 'notifications.receive', 1, NOW()),
('hotel_manager', 'dashboard.view', 1, NOW()), ('hotel_manager', 'dashboard.global', 1, NOW()), ('hotel_manager', 'reports.access', 1, NOW()), ('hotel_manager', 'reports.export', 1, NOW()),
('hotel_manager', 'permissions.manage', 0, NOW());

-- Comptabilité
INSERT INTO role_permissions (role, permission, allowed, updated_at) VALUES
('comptabilite', 'hotels.view', 1, NOW()), ('comptabilite', 'hotels.create', 0, NOW()), ('comptabilite', 'hotels.edit', 0, NOW()), ('comptabilite', 'hotels.delete', 0, NOW()), ('comptabilite', 'rooms.manage', 0, NOW()),
('comptabilite', 'users.view', 0, NOW()), ('comptabilite', 'users.manage', 0, NOW()),
('comptabilite', 'dispatch.view', 1, NOW()), ('comptabilite', 'dispatch.create', 0, NOW()), ('comptabilite', 'dispatch.complete', 0, NOW()), ('comptabilite', 'dispatch.control', 0, NOW()),
('comptabilite', 'linen.view', 1, NOW()), ('comptabilite', 'linen.manage', 0, NOW()), ('comptabilite', 'linen.config', 0, NOW()),
('comptabilite', 'leaves.view', 1, NOW()), ('comptabilite', 'leaves.create', 1, NOW()), ('comptabilite', 'leaves.validate', 0, NOW()), ('comptabilite', 'leaves.manage_all', 0, NOW()),
('comptabilite', 'maintenance.view', 1, NOW()), ('comptabilite', 'maintenance.create', 0, NOW()), ('comptabilite', 'maintenance.manage', 0, NOW()), ('comptabilite', 'maintenance.comment', 0, NOW()),
('comptabilite', 'tasks.view', 1, NOW()), ('comptabilite', 'tasks.create', 0, NOW()), ('comptabilite', 'tasks.manage', 0, NOW()), ('comptabilite', 'tasks.assign', 0, NOW()),
('comptabilite', 'evaluations.view', 0, NOW()), ('comptabilite', 'evaluations.grids', 0, NOW()), ('comptabilite', 'evaluations.evaluate', 0, NOW()), ('comptabilite', 'evaluations.view_own', 1, NOW()),
('comptabilite', 'audit.view', 0, NOW()), ('comptabilite', 'audit.grids', 0, NOW()), ('comptabilite', 'audit.execute', 0, NOW()), ('comptabilite', 'audit.view_results', 0, NOW()),
('comptabilite', 'closures.view', 1, NOW()), ('comptabilite', 'closures.create', 0, NOW()), ('comptabilite', 'closures.validate', 1, NOW()), ('comptabilite', 'closures.edit_all', 1, NOW()), ('comptabilite', 'closures.add_remise', 0, NOW()), ('comptabilite', 'closures.add_comment', 1, NOW()),
('comptabilite', 'messages.access', 1, NOW()), ('comptabilite', 'messages.broadcast', 0, NOW()), ('comptabilite', 'notifications.receive', 1, NOW()),
('comptabilite', 'dashboard.view', 1, NOW()), ('comptabilite', 'dashboard.global', 1, NOW()), ('comptabilite', 'reports.access', 1, NOW()), ('comptabilite', 'reports.export', 1, NOW()),
('comptabilite', 'permissions.manage', 0, NOW());

-- RH
INSERT INTO role_permissions (role, permission, allowed, updated_at) VALUES
('rh', 'hotels.view', 1, NOW()), ('rh', 'hotels.create', 0, NOW()), ('rh', 'hotels.edit', 0, NOW()), ('rh', 'hotels.delete', 0, NOW()), ('rh', 'rooms.manage', 0, NOW()),
('rh', 'users.view', 1, NOW()), ('rh', 'users.manage', 1, NOW()),
('rh', 'dispatch.view', 0, NOW()), ('rh', 'dispatch.create', 0, NOW()), ('rh', 'dispatch.complete', 0, NOW()), ('rh', 'dispatch.control', 0, NOW()),
('rh', 'linen.view', 0, NOW()), ('rh', 'linen.manage', 0, NOW()), ('rh', 'linen.config', 0, NOW()),
('rh', 'leaves.view', 1, NOW()), ('rh', 'leaves.create', 1, NOW()), ('rh', 'leaves.validate', 1, NOW()), ('rh', 'leaves.manage_all', 1, NOW()),
('rh', 'maintenance.view', 0, NOW()), ('rh', 'maintenance.create', 0, NOW()), ('rh', 'maintenance.manage', 0, NOW()), ('rh', 'maintenance.comment', 0, NOW()),
('rh', 'tasks.view', 1, NOW()), ('rh', 'tasks.create', 1, NOW()), ('rh', 'tasks.manage', 1, NOW()), ('rh', 'tasks.assign', 1, NOW()),
('rh', 'evaluations.view', 1, NOW()), ('rh', 'evaluations.grids', 1, NOW()), ('rh', 'evaluations.evaluate', 1, NOW()), ('rh', 'evaluations.view_own', 1, NOW()),
('rh', 'audit.view', 0, NOW()), ('rh', 'audit.grids', 0, NOW()), ('rh', 'audit.execute', 0, NOW()), ('rh', 'audit.view_results', 0, NOW()),
('rh', 'closures.view', 0, NOW()), ('rh', 'closures.create', 0, NOW()), ('rh', 'closures.validate', 0, NOW()), ('rh', 'closures.edit_all', 0, NOW()), ('rh', 'closures.add_remise', 0, NOW()), ('rh', 'closures.add_comment', 0, NOW()),
('rh', 'messages.access', 1, NOW()), ('rh', 'messages.broadcast', 1, NOW()), ('rh', 'notifications.receive', 1, NOW()),
('rh', 'dashboard.view', 1, NOW()), ('rh', 'dashboard.global', 0, NOW()), ('rh', 'reports.access', 1, NOW()), ('rh', 'reports.export', 1, NOW()),
('rh', 'permissions.manage', 0, NOW());

-- Réceptionniste
INSERT INTO role_permissions (role, permission, allowed, updated_at) VALUES
('receptionniste', 'hotels.view', 1, NOW()), ('receptionniste', 'hotels.create', 0, NOW()), ('receptionniste', 'hotels.edit', 0, NOW()), ('receptionniste', 'hotels.delete', 0, NOW()), ('receptionniste', 'rooms.manage', 0, NOW()),
('receptionniste', 'users.view', 0, NOW()), ('receptionniste', 'users.manage', 0, NOW()),
('receptionniste', 'dispatch.view', 1, NOW()), ('receptionniste', 'dispatch.create', 1, NOW()), ('receptionniste', 'dispatch.complete', 1, NOW()), ('receptionniste', 'dispatch.control', 1, NOW()),
('receptionniste', 'linen.view', 1, NOW()), ('receptionniste', 'linen.manage', 1, NOW()), ('receptionniste', 'linen.config', 0, NOW()),
('receptionniste', 'leaves.view', 1, NOW()), ('receptionniste', 'leaves.create', 1, NOW()), ('receptionniste', 'leaves.validate', 0, NOW()), ('receptionniste', 'leaves.manage_all', 0, NOW()),
('receptionniste', 'maintenance.view', 1, NOW()), ('receptionniste', 'maintenance.create', 1, NOW()), ('receptionniste', 'maintenance.manage', 0, NOW()), ('receptionniste', 'maintenance.comment', 1, NOW()),
('receptionniste', 'tasks.view', 1, NOW()), ('receptionniste', 'tasks.create', 1, NOW()), ('receptionniste', 'tasks.manage', 0, NOW()), ('receptionniste', 'tasks.assign', 0, NOW()),
('receptionniste', 'evaluations.view', 0, NOW()), ('receptionniste', 'evaluations.grids', 0, NOW()), ('receptionniste', 'evaluations.evaluate', 0, NOW()), ('receptionniste', 'evaluations.view_own', 1, NOW()),
('receptionniste', 'audit.view', 1, NOW()), ('receptionniste', 'audit.grids', 0, NOW()), ('receptionniste', 'audit.execute', 1, NOW()), ('receptionniste', 'audit.view_results', 1, NOW()),
('receptionniste', 'closures.view', 1, NOW()), ('receptionniste', 'closures.create', 1, NOW()), ('receptionniste', 'closures.validate', 0, NOW()), ('receptionniste', 'closures.edit_all', 0, NOW()), ('receptionniste', 'closures.add_remise', 1, NOW()), ('receptionniste', 'closures.add_comment', 1, NOW()),
('receptionniste', 'messages.access', 1, NOW()), ('receptionniste', 'messages.broadcast', 0, NOW()), ('receptionniste', 'notifications.receive', 1, NOW()),
('receptionniste', 'dashboard.view', 1, NOW()), ('receptionniste', 'dashboard.global', 0, NOW()), ('receptionniste', 'reports.access', 0, NOW()), ('receptionniste', 'reports.export', 0, NOW()),
('receptionniste', 'permissions.manage', 0, NOW());

-- Employé
INSERT INTO role_permissions (role, permission, allowed, updated_at) VALUES
('employee', 'hotels.view', 1, NOW()), ('employee', 'hotels.create', 0, NOW()), ('employee', 'hotels.edit', 0, NOW()), ('employee', 'hotels.delete', 0, NOW()), ('employee', 'rooms.manage', 0, NOW()),
('employee', 'users.view', 0, NOW()), ('employee', 'users.manage', 0, NOW()),
('employee', 'dispatch.view', 1, NOW()), ('employee', 'dispatch.create', 0, NOW()), ('employee', 'dispatch.complete', 1, NOW()), ('employee', 'dispatch.control', 0, NOW()),
('employee', 'linen.view', 1, NOW()), ('employee', 'linen.manage', 1, NOW()), ('employee', 'linen.config', 0, NOW()),
('employee', 'leaves.view', 1, NOW()), ('employee', 'leaves.create', 1, NOW()), ('employee', 'leaves.validate', 0, NOW()), ('employee', 'leaves.manage_all', 0, NOW()),
('employee', 'maintenance.view', 1, NOW()), ('employee', 'maintenance.create', 1, NOW()), ('employee', 'maintenance.manage', 0, NOW()), ('employee', 'maintenance.comment', 1, NOW()),
('employee', 'tasks.view', 1, NOW()), ('employee', 'tasks.create', 0, NOW()), ('employee', 'tasks.manage', 0, NOW()), ('employee', 'tasks.assign', 0, NOW()),
('employee', 'evaluations.view', 0, NOW()), ('employee', 'evaluations.grids', 0, NOW()), ('employee', 'evaluations.evaluate', 0, NOW()), ('employee', 'evaluations.view_own', 1, NOW()),
('employee', 'audit.view', 0, NOW()), ('employee', 'audit.grids', 0, NOW()), ('employee', 'audit.execute', 0, NOW()), ('employee', 'audit.view_results', 0, NOW()),
('employee', 'revenue.view', 0, NOW()), ('employee', 'revenue.settings', 0, NOW()), ('employee', 'revenue.fetch_rates', 0, NOW()),
('employee', 'closures.view', 1, NOW()), ('employee', 'closures.create', 0, NOW()), ('employee', 'closures.validate', 0, NOW()), ('employee', 'closures.edit_all', 0, NOW()), ('employee', 'closures.add_remise', 0, NOW()), ('employee', 'closures.add_comment', 0, NOW()),
('employee', 'messages.access', 1, NOW()), ('employee', 'messages.broadcast', 0, NOW()), ('employee', 'notifications.receive', 1, NOW()),
('employee', 'dashboard.view', 1, NOW()), ('employee', 'dashboard.global', 0, NOW()), ('employee', 'reports.access', 0, NOW()), ('employee', 'reports.export', 0, NOW()),
('employee', 'permissions.manage', 0, NOW());

-- Revenue Management permissions for other roles
INSERT INTO role_permissions (role, permission, allowed, updated_at) VALUES
('admin', 'revenue.view', 1, NOW()), ('admin', 'revenue.settings', 1, NOW()), ('admin', 'revenue.fetch_rates', 1, NOW()),
('groupe_manager', 'revenue.view', 1, NOW()), ('groupe_manager', 'revenue.settings', 1, NOW()), ('groupe_manager', 'revenue.fetch_rates', 1, NOW()),
('hotel_manager', 'revenue.view', 1, NOW()), ('hotel_manager', 'revenue.settings', 0, NOW()), ('hotel_manager', 'revenue.fetch_rates', 1, NOW()),
('comptabilite', 'revenue.view', 0, NOW()), ('comptabilite', 'revenue.settings', 0, NOW()), ('comptabilite', 'revenue.fetch_rates', 0, NOW()),
('rh', 'revenue.view', 0, NOW()), ('rh', 'revenue.settings', 0, NOW()), ('rh', 'revenue.fetch_rates', 0, NOW()),
('receptionniste', 'revenue.view', 0, NOW()), ('receptionniste', 'revenue.settings', 0, NOW()), ('receptionniste', 'revenue.fetch_rates', 0, NOW())
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

-- Templates horaires par défaut
INSERT INTO time_templates (hotel_id, name, start_time, end_time, break_minutes, color, is_global, created_at) VALUES
(NULL, 'Matin 7h-15h', '07:00:00', '15:00:00', 60, '#3B82F6', 1, NOW()),
(NULL, 'Journée 9h-17h', '09:00:00', '17:00:00', 60, '#10B981', 1, NOW()),
(NULL, 'Après-midi 14h-22h', '14:00:00', '22:00:00', 60, '#F59E0B', 1, NOW()),
(NULL, 'Nuit 22h-6h', '22:00:00', '06:00:00', 30, '#6366F1', 1, NOW()),
(NULL, 'Demi-journée matin', '08:00:00', '12:00:00', 0, '#8B5CF6', 1, NOW()),
(NULL, 'Demi-journée après-midi', '14:00:00', '18:00:00', 0, '#EC4899', 1, NOW());

-- Jours fériés France 2025
INSERT INTO time_holidays (name, holiday_date, is_worked, country, created_at) VALUES
('Jour de l\'An', '2025-01-01', 0, 'FR', NOW()),
('Lundi de Pâques', '2025-04-21', 0, 'FR', NOW()),
('Fête du Travail', '2025-05-01', 0, 'FR', NOW()),
('Victoire 1945', '2025-05-08', 0, 'FR', NOW()),
('Ascension', '2025-05-29', 0, 'FR', NOW()),
('Lundi de Pentecôte', '2025-06-09', 0, 'FR', NOW()),
('Fête Nationale', '2025-07-14', 0, 'FR', NOW()),
('Assomption', '2025-08-15', 0, 'FR', NOW()),
('Toussaint', '2025-11-01', 0, 'FR', NOW()),
('Armistice', '2025-11-11', 0, 'FR', NOW()),
('Noël', '2025-12-25', 0, 'FR', NOW()),
('Jour de l\'An 2026', '2026-01-01', 0, 'FR', NOW());

-- =============================================
-- MIGRATIONS - Pour bases existantes
-- Exécuter ces commandes si vous avez déjà une base en production
-- =============================================

-- Si vous avez une colonne updated_at dans conversations, vous pouvez la supprimer
-- ALTER TABLE conversations DROP COLUMN updated_at;

-- Ajouter les colonnes de congés si elles n'existent pas
-- ALTER TABLE leave_requests ADD COLUMN comment TEXT AFTER leave_type;
-- ALTER TABLE leave_requests ADD COLUMN hotel_id INT UNSIGNED AFTER year;
-- ALTER TABLE leave_requests ADD COLUMN is_manual TINYINT(1) DEFAULT 0 AFTER hotel_id;
-- ALTER TABLE leave_requests ADD COLUMN created_by INT UNSIGNED AFTER is_manual;

-- Table des commentaires de tickets maintenance (NOUVELLE)
-- CREATE TABLE IF NOT EXISTS ticket_comments (
--     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
--     ticket_id INT UNSIGNED NOT NULL,
--     user_id INT UNSIGNED NOT NULL,
--     comment TEXT NOT NULL,
--     comment_type ENUM('comment','status_change','assignment','resolution') DEFAULT 'comment',
--     old_status VARCHAR(20),
--     new_status VARCHAR(20),
--     created_at DATETIME,
--     INDEX idx_ticket (ticket_id),
--     INDEX idx_user (user_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- =============================================
-- MIGRATION: Ajout rôles Comptabilité et RH
-- =============================================
-- ALTER TABLE users MODIFY COLUMN role ENUM('admin','groupe_manager','hotel_manager','comptabilite','rh','employee') DEFAULT 'employee';

-- =============================================
-- MIGRATION: Module Tâches (Kanban)
-- =============================================
-- CREATE TABLE IF NOT EXISTS task_boards (
--     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
--     hotel_id INT UNSIGNED NOT NULL,
--     name VARCHAR(100) NOT NULL,
--     description TEXT,
--     color VARCHAR(7) DEFAULT '#1E3A5F',
--     is_archived TINYINT(1) DEFAULT 0,
--     created_by INT UNSIGNED NOT NULL,
--     created_at DATETIME,
--     updated_at DATETIME,
--     INDEX idx_hotel (hotel_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- CREATE TABLE IF NOT EXISTS task_columns (
--     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
--     board_id INT UNSIGNED NOT NULL,
--     name VARCHAR(50) NOT NULL,
--     position INT DEFAULT 0,
--     color VARCHAR(7) DEFAULT '#6B7280',
--     created_at DATETIME,
--     INDEX idx_board (board_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- CREATE TABLE IF NOT EXISTS tasks (
--     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
--     board_id INT UNSIGNED NOT NULL,
--     column_id INT UNSIGNED NOT NULL,
--     title VARCHAR(255) NOT NULL,
--     description TEXT,
--     priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
--     due_date DATE,
--     assigned_to INT UNSIGNED,
--     position INT DEFAULT 0,
--     is_completed TINYINT(1) DEFAULT 0,
--     completed_at DATETIME,
--     completed_by INT UNSIGNED,
--     created_by INT UNSIGNED NOT NULL,
--     created_at DATETIME,
--     updated_at DATETIME,
--     INDEX idx_board (board_id),
--     INDEX idx_column (column_id),
--     INDEX idx_assigned (assigned_to)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- CREATE TABLE IF NOT EXISTS task_comments (
--     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
--     task_id INT UNSIGNED NOT NULL,
--     user_id INT UNSIGNED NOT NULL,
--     comment TEXT NOT NULL,
--     created_at DATETIME,
--     INDEX idx_task (task_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- CREATE TABLE IF NOT EXISTS task_checklists (
--     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
--     task_id INT UNSIGNED NOT NULL,
--     item_text VARCHAR(255) NOT NULL,
--     is_checked TINYINT(1) DEFAULT 0,
--     position INT DEFAULT 0,
--     checked_by INT UNSIGNED,
--     checked_at DATETIME,
--     created_at DATETIME,
--     INDEX idx_task (task_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- CREATE TABLE IF NOT EXISTS task_labels (
--     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
--     board_id INT UNSIGNED NOT NULL,
--     name VARCHAR(50) NOT NULL,
--     color VARCHAR(7) NOT NULL,
--     INDEX idx_board (board_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- CREATE TABLE IF NOT EXISTS task_label_assignments (
--     task_id INT UNSIGNED NOT NULL,
--     label_id INT UNSIGNED NOT NULL,
--     PRIMARY KEY (task_id, label_id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ==================== MODULE RGPD ====================

-- Consentements utilisateurs
CREATE TABLE IF NOT EXISTS user_consents (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    consent_type ENUM('privacy_policy', 'data_processing', 'cookies', 'marketing') NOT NULL,
    consented TINYINT(1) DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    consented_at DATETIME,
    revoked_at DATETIME,
    INDEX idx_user (user_id),
    INDEX idx_type (consent_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Journal des accès (logs RGPD)
CREATE TABLE IF NOT EXISTS access_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED,
    action VARCHAR(100) NOT NULL COMMENT 'login, logout, view, create, update, delete, export',
    resource VARCHAR(100) COMMENT 'users, hotels, closures, etc.',
    resource_id INT UNSIGNED,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    details TEXT COMMENT 'Détails JSON',
    created_at DATETIME,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Demandes RGPD (accès, suppression, portabilité)
CREATE TABLE IF NOT EXISTS gdpr_requests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    request_type ENUM('access', 'rectification', 'erasure', 'portability', 'restriction', 'objection') NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'rejected') DEFAULT 'pending',
    reason TEXT COMMENT 'Motif de la demande',
    admin_notes TEXT COMMENT 'Notes admin',
    processed_by INT UNSIGNED,
    requested_at DATETIME,
    processed_at DATETIME,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Configuration RGPD
CREATE TABLE IF NOT EXISTS gdpr_settings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    updated_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Valeurs par défaut RGPD
INSERT INTO gdpr_settings (setting_key, setting_value, updated_at) VALUES
('data_retention_days', '1095', NOW()),  -- 3 ans par défaut
('company_name', 'ACL GESTION', NOW()),
('company_address', '', NOW()),
('company_email', '', NOW()),
('company_phone', '', NOW()),
('dpo_name', '', NOW()),
('dpo_email', '', NOW()),
('privacy_policy_version', '1.0', NOW()),
('privacy_policy_date', NOW(), NOW())
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- Ajouter colonnes RGPD dans users (compatible MySQL 5.x - pas de IF NOT EXISTS sur ALTER)
-- Utiliser des procedures stockees pour compatibilite MySQL 5.x
DELIMITER //
CREATE PROCEDURE add_column_if_not_exists(
    IN p_table VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_definition VARCHAR(500)
)
BEGIN
    SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column);
    IF @exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

CALL add_column_if_not_exists('users', 'gdpr_consent', 'TINYINT(1) DEFAULT 0');
CALL add_column_if_not_exists('users', 'gdpr_consent_date', 'DATETIME');

-- ==================== SUIVI CAISSE DETAILLE ====================

CALL add_column_if_not_exists('daily_closures', 'expense_receipt', 'VARCHAR(500)');
CALL add_column_if_not_exists('daily_closures', 'remise_banque', 'DECIMAL(10,2) DEFAULT 0');

-- Migration: Ajouter colonne justificatif pour les arrêts maladie
CALL add_column_if_not_exists('leave_requests', 'justificatif_url', 'VARCHAR(500)');

-- Migration: Colonnes de suivi des alertes maintenance
CALL add_column_if_not_exists('maintenance_tickets', 'notified_2days', 'TINYINT(1) DEFAULT 0');
CALL add_column_if_not_exists('maintenance_tickets', 'notified_5days', 'TINYINT(1) DEFAULT 0');

-- Migration: Colonne chambre bloquée pour tickets maintenance
CALL add_column_if_not_exists('maintenance_tickets', 'room_blocked', 'TINYINT(1) DEFAULT 0');

-- Nettoyage de la procedure temporaire
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

-- =====================================================
-- REFONTE MODULE TACHES - Multi-hôtels, membres, pièces jointes
-- =====================================================

-- Table des membres d'un tableau
CREATE TABLE IF NOT EXISTS task_board_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('viewer', 'member', 'admin') DEFAULT 'member',
    added_by INT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_board_member (board_id, user_id),
    FOREIGN KEY (board_id) REFERENCES task_boards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Table des hôtels associés à un tableau
CREATE TABLE IF NOT EXISTS task_board_hotels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    hotel_id INT NOT NULL,
    UNIQUE KEY unique_board_hotel (board_id, hotel_id),
    FOREIGN KEY (board_id) REFERENCES task_boards(id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- Table des assignations multiples sur une tâche
CREATE TABLE IF NOT EXISTS task_assignees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT,
    UNIQUE KEY unique_task_assignee (task_id, user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Table des pièces jointes des tâches
CREATE TABLE IF NOT EXISTS task_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    uploaded_by INT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Migration: Retirer la dépendance hotel_id direct sur task_boards (optionnel maintenant)
ALTER TABLE task_boards MODIFY COLUMN hotel_id INT NULL;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_board_members_user ON task_board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_board_hotels_hotel ON task_board_hotels(hotel_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);

-- =============================================
-- REVENUE MANAGEMENT - Veille concurrentielle
-- =============================================

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

-- Cache des tarifs récupérés de Xotelo (tarifs actuels)
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
    raw_data LONGTEXT,
    fetched_at DATETIME,
    INDEX idx_hotel_date (hotel_id, check_date),
    INDEX idx_source (source_hotel_key, check_date),
    INDEX idx_fetched (fetched_at),
    INDEX idx_currency (currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Historique des tarifs (pour suivre l'évolution des prix)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Historique des requêtes Xotelo
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

-- =============================================
-- MIGRATION: Ajout du rôle receptionniste
-- =============================================
-- Exécuter cette commande pour ajouter le rôle receptionniste aux tables existantes

ALTER TABLE users MODIFY COLUMN role ENUM('admin','groupe_manager','hotel_manager','comptabilite','rh','receptionniste','employee') DEFAULT 'employee';

ALTER TABLE evaluation_grids MODIFY COLUMN target_role ENUM('admin','groupe_manager','hotel_manager','comptabilite','rh','receptionniste','employee') NOT NULL DEFAULT 'employee';
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
-- ============================================================
-- Migration: Ajout des colonnes d'archivage aux tâches
-- Module Gestion des Tâches - ACL GESTION
-- ============================================================

-- Ajouter les colonnes d'archivage à la table tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_archived TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL,
ADD COLUMN IF NOT EXISTS archived_by INT NULL;

-- Index pour les requêtes sur les tâches archivées
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(board_id, is_archived);

-- Ajouter contrainte de clé étrangère (optionnel)
-- ALTER TABLE tasks ADD CONSTRAINT fk_tasks_archived_by FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;

-- Vérification
SELECT 
    'tasks' AS table_name,
    COUNT(*) AS total_tasks,
    SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END) AS archived_tasks
FROM tasks;
