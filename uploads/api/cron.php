#!/usr/bin/env php
<?php
/**
 * ACL GESTION - Cron Jobs pour les alertes automatiques
 * 
 * Configuration dans Plesk (Tâches planifiées) :
 * 
 * | Tâche              | Horaire       | Commande                                    |
 * |--------------------|---------------|---------------------------------------------|
 * | Dispatch incomplet | 12h00 chaque jour | php /chemin/api/cron.php dispatch       |
 * | Contrôle incomplet | 19h00 chaque jour | php /chemin/api/cron.php control        |
 * | Maintenance        | 09h00 chaque jour | php /chemin/api/cron.php maintenance    |
 * | Rappel congés      | 09h00 chaque lundi| php /chemin/api/cron.php leaves_reminder|
 * | Nettoyage          | 03h00 chaque jour | php /chemin/api/cron.php cleanup        |
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Database.php';

$action = isset($argv[1]) ? $argv[1] : 'help';

echo "[" . date('Y-m-d H:i:s') . "] Exécution tâche: $action\n";

switch ($action) {
    case 'dispatch':
        checkDispatchIncomplet();
        break;
    case 'control':
        checkControleIncomplet();
        break;
    case 'maintenance':
        checkMaintenanceAlerts();
        break;
    case 'leaves_reminder':
        sendLeavesReminder();
        break;
    case 'tasks_due':
        checkTasksDue();
        break;
    case 'audit':
        checkAuditDeadlines();
        break;
    case 'closure':
        checkClosureAlerts();
        break;
    case 'cleanup':
        cleanupOldData();
        break;
    default:
        echo "Usage: php cron.php [dispatch|control|maintenance|leaves_reminder|tasks_due|audit|closure|cleanup]\n\n";
        echo "Tâches disponibles:\n";
        echo "  dispatch        - Vérifie si des chambres ont été dispatchées aujourd'hui (12h00)\n";
        echo "  control         - Vérifie si les chambres nettoyées ont été contrôlées (19h00)\n";
        echo "  maintenance     - Alertes tickets ouverts > 48h/72h (09h00)\n";
        echo "  leaves_reminder - Rappel congés en attente (lundi 09h00)\n";
        echo "  tasks_due       - Rappel tâches à échéance (09h00)\n";
        echo "  audit           - Rappel audits à réaliser et alertes retard (09h00)\n";
        echo "  cleanup         - Nettoyage tokens expirés et anciennes données (03h00)\n";
        exit(1);
}

echo "[" . date('Y-m-d H:i:s') . "] Tâche terminée.\n";

// =============================================================================
// DISPATCH - Alerte si aucune chambre dispatchée à 12h00
// =============================================================================

/**
 * Vérifie si des chambres ont été dispatchées pour chaque hôtel aujourd'hui.
 * Si AUCUNE chambre n'est dispatchée à 12h, envoie une alerte.
 * 
 * Logique : On alerte seulement si l'hôtel n'a AUCUN dispatch pour le jour,
 * car toutes les chambres ne sont pas louées tous les jours.
 */
function checkDispatchIncomplet() {
    $today = date('Y-m-d');
    
    // Récupérer tous les hôtels actifs
    $hotels = db()->query("SELECT id, name FROM hotels WHERE status = 'active'");
    
    foreach ($hotels as $hotel) {
        // Compter les dispatches du jour pour cet hôtel
        $dispatchCount = db()->count(
            "SELECT COUNT(*) FROM room_dispatch rd 
             JOIN rooms r ON rd.room_id = r.id 
             WHERE r.hotel_id = ? AND rd.dispatch_date = ?",
            [$hotel['id'], $today]
        );
        
        // Alerte seulement si AUCUN dispatch n'a été fait
        if ($dispatchCount == 0) {
            createAlert($hotel['id'], $hotel['name'], 'dispatch_incomplet', 
                "Aucune chambre n'a été dispatchée aujourd'hui pour l'hôtel {$hotel['name']}.");
            echo "  ⚠ Alerte: Aucun dispatch pour {$hotel['name']}\n";
        } else {
            echo "  ✓ {$hotel['name']}: $dispatchCount chambre(s) dispatchée(s)\n";
        }
    }
}

// =============================================================================
// CONTROL - Alerte si chambres nettoyées non contrôlées à 19h00
// =============================================================================

/**
 * Vérifie si les chambres dont le nettoyage est terminé (status = 'completed')
 * ont été contrôlées par la gouvernante.
 * 
 * Workflow des statuts :
 *   pending   → Chambre dispatchée, nettoyage en cours
 *   completed → Nettoyage terminé, EN ATTENTE de contrôle
 *   controlled → Contrôle effectué (OK ou NOK)
 */
function checkControleIncomplet() {
    $today = date('Y-m-d');
    
    $hotels = db()->query("SELECT id, name FROM hotels WHERE status = 'active'");
    
    foreach ($hotels as $hotel) {
        // Chambres nettoyées mais pas encore contrôlées
        $nonControlled = db()->count(
            "SELECT COUNT(*) FROM room_dispatch rd 
             JOIN rooms r ON rd.room_id = r.id 
             WHERE r.hotel_id = ? AND rd.dispatch_date = ? AND rd.status = 'completed'",
            [$hotel['id'], $today]
        );
        
        if ($nonControlled > 0) {
            createAlert($hotel['id'], $hotel['name'], 'controle_incomplet',
                "$nonControlled chambre(s) nettoyée(s) n'ont pas été contrôlées pour l'hôtel {$hotel['name']}.");
            echo "  ⚠ Alerte: $nonControlled chambre(s) non contrôlée(s) pour {$hotel['name']}\n";
        } else {
            // Vérifier s'il y avait des dispatches
            $totalDispatched = db()->count(
                "SELECT COUNT(*) FROM room_dispatch rd 
                 JOIN rooms r ON rd.room_id = r.id 
                 WHERE r.hotel_id = ? AND rd.dispatch_date = ?",
                [$hotel['id'], $today]
            );
            
            if ($totalDispatched > 0) {
                echo "  ✓ {$hotel['name']}: Tous les contrôles effectués\n";
            } else {
                echo "  - {$hotel['name']}: Aucun dispatch aujourd'hui\n";
            }
        }
    }
}

// =============================================================================
// SYSTÈME D'ALERTES AVEC ESCALADE
// =============================================================================

/**
 * Crée une alerte et notifie selon le système d'escalade :
 *   1 jour  → Responsable Hôtel
 *   2 jours → + Responsable Groupe
 *   5 jours → + Admin
 */
function createAlert($hotelId, $hotelName, $alertType, $message) {
    $today = date('Y-m-d');
    
    // Vérifier si alerte existe déjà aujourd'hui
    $existing = db()->queryOne(
        "SELECT * FROM dispatch_alerts WHERE hotel_id = ? AND alert_date = ? AND alert_type = ?",
        [$hotelId, $today, $alertType]
    );
    
    if ($existing) {
        echo "  (Alerte déjà créée aujourd'hui)\n";
        return;
    }
    
    // Compter jours consécutifs
    $yesterday = date('Y-m-d', strtotime('-1 day'));
    $previousAlert = db()->queryOne(
        "SELECT consecutive_count FROM dispatch_alerts WHERE hotel_id = ? AND alert_date = ? AND alert_type = ?",
        [$hotelId, $yesterday, $alertType]
    );
    
    $consecutiveCount = $previousAlert ? $previousAlert['consecutive_count'] + 1 : 1;
    
    // Déterminer qui notifier selon l'escalade
    $notifyHotelManager = true;
    $notifyGroupeManager = $consecutiveCount >= 2;
    $notifyAdmin = $consecutiveCount >= 5;
    
    // Insérer l'alerte
    db()->execute(
        "INSERT INTO dispatch_alerts (hotel_id, alert_date, alert_type, consecutive_count, notified_hotel_manager, notified_groupe_manager, notified_admin, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
        [$hotelId, $today, $alertType, $consecutiveCount, $notifyHotelManager ? 1 : 0, $notifyGroupeManager ? 1 : 0, $notifyAdmin ? 1 : 0]
    );
    
    // Préparer le sujet
    $typeLabel = $alertType === 'dispatch_incomplet' ? 'Dispatch incomplet' : 'Contrôle incomplet';
    $subject = "Alerte: $typeLabel - $hotelName";
    if ($consecutiveCount > 1) {
        $subject .= " ($consecutiveCount jours consécutifs)";
    }
    
    $fullMessage = "$message\n\nJours consécutifs: $consecutiveCount";
    
    // Notifier les responsables hôtel
    if ($notifyHotelManager) {
        $managers = db()->query(
            "SELECT DISTINCT u.id, u.email FROM users u 
             JOIN user_hotels uh ON u.id = uh.user_id 
             WHERE uh.hotel_id = ? AND u.role = 'hotel_manager' AND u.status = 'active'",
            [$hotelId]
        );
        foreach ($managers as $m) {
            sendNotification($m['id'], $m['email'], $subject, $fullMessage);
        }
    }
    
    // Notifier les responsables groupe (à partir du 2ème jour)
    if ($notifyGroupeManager) {
        $groupManagers = db()->query(
            "SELECT DISTINCT u.id, u.email FROM users u 
             JOIN user_hotels uh ON u.id = uh.user_id 
             WHERE uh.hotel_id = ? AND u.role = 'groupe_manager' AND u.status = 'active'",
            [$hotelId]
        );
        foreach ($groupManagers as $m) {
            sendNotification($m['id'], $m['email'], $subject, $fullMessage);
        }
    }
    
    // Notifier admin (à partir du 5ème jour)
    if ($notifyAdmin) {
        $admins = db()->query("SELECT id, email FROM users WHERE role = 'admin' AND status = 'active'");
        foreach ($admins as $a) {
            sendNotification($a['id'], $a['email'], "[URGENT] $subject", $fullMessage);
        }
    }
}

// =============================================================================
// MAINTENANCE - Alertes tickets ouverts trop longtemps
// =============================================================================

/**
 * Vérifie les tickets de maintenance ouverts depuis trop longtemps :
 *   > 48h → Notifie Responsable Groupe
 *   > 72h → Notifie Admin (URGENT)
 *   En cours > 7 jours → Notifie Admin (RETARD)
 */
function checkMaintenanceAlerts() {
    // ============================================
    // 1. TICKETS NON PRIS EN CHARGE DEPUIS 2 JOURS
    // ============================================
    // Tickets ouverts depuis plus de 2 jours (48h) - alerte groupe_manager + admin
    $tickets2days = db()->query(
        "SELECT t.*, h.name as hotel_name, 
                CONCAT(u.first_name, ' ', u.last_name) as reporter_name,
                u.id as reporter_id
         FROM maintenance_tickets t
         JOIN hotels h ON t.hotel_id = h.id AND h.status = 'active'
         LEFT JOIN users u ON t.reported_by = u.id
         WHERE t.status = 'open' 
         AND t.created_at <= DATE_SUB(NOW(), INTERVAL 2 DAY)
         AND (t.notified_48h IS NULL OR t.notified_48h = 0)"
    );
    
    echo "  Tickets non pris en charge > 2 jours: " . count($tickets2days) . "\n";
    
    foreach ($tickets2days as $t) {
        $subject = "⚠️ [RAPPEL] Ticket #{$t['id']} non pris en charge depuis 2 jours";
        $message = "⚠️ Le ticket #{$t['id']} n'a pas été pris en charge depuis 2 jours.\n\n";
        $message .= "🏨 Hôtel: {$t['hotel_name']}\n";
        $message .= "📍 Localisation: " . ($t['room_number'] ?: 'Parties communes') . "\n";
        $message .= "🏷️ Catégorie: {$t['category']}\n";
        $message .= "⚡ Priorité: {$t['priority']}\n";
        $message .= "📝 Description: {$t['description']}\n";
        $message .= "📅 Créé le: {$t['created_at']}\n";
        $message .= "👤 Signalé par: " . ($t['reporter_name'] ?: 'Inconnu') . "\n\n";
        $message .= "Veuillez prendre en charge ce ticket rapidement.";
        
        // Notifier les groupe_manager + admin affectés à cet hôtel
        $managers = db()->query(
            "SELECT DISTINCT u.id, u.email, u.first_name, u.last_name FROM users u 
             JOIN user_hotels uh ON u.id = uh.user_id 
             WHERE uh.hotel_id = ? AND u.role IN ('groupe_manager', 'admin') AND u.status = 'active'",
            [$t['hotel_id']]
        );
        
        foreach ($managers as $m) {
            // Notification en base
            createNotification($m['id'], 'warning', "Ticket #{$t['id']} non pris en charge", substr($message, 0, 500));
            
            // Email
            sendMaintenanceAlertEmail($m['email'], $subject, $t, '2days');
        }
        
        // Marquer comme notifié
        try {
            db()->execute("UPDATE maintenance_tickets SET notified_48h = 1 WHERE id = ?", [$t['id']]);
        } catch (Exception $e) {
            // Colonne peut ne pas exister, on continue
        }
        echo "    → Ticket #{$t['id']} - alerte 2 jours envoyée\n";
    }
    
    // ============================================
    // 2. TICKETS NON RÉSOLUS DEPUIS 5 JOURS
    // ============================================
    // Tickets en cours depuis plus de 5 jours - alerte groupe_manager + admin
    $tickets5days = db()->query(
        "SELECT t.*, h.name as hotel_name, 
                CONCAT(u.first_name, ' ', u.last_name) as reporter_name,
                CONCAT(ua.first_name, ' ', ua.last_name) as assigned_to_name,
                DATEDIFF(NOW(), t.assigned_at) as days_in_progress
         FROM maintenance_tickets t
         JOIN hotels h ON t.hotel_id = h.id AND h.status = 'active'
         LEFT JOIN users u ON t.reported_by = u.id
         LEFT JOIN users ua ON t.assigned_to = ua.id
         WHERE t.status = 'in_progress' 
         AND t.assigned_at <= DATE_SUB(NOW(), INTERVAL 5 DAY)
         AND (t.notified_72h IS NULL OR t.notified_72h = 0)"
    );
    
    echo "  Tickets non résolus > 5 jours: " . count($tickets5days) . "\n";
    
    foreach ($tickets5days as $t) {
        $subject = "🚨 [URGENT] Ticket #{$t['id']} non résolu depuis 5 jours";
        $message = "🚨 URGENT: Le ticket #{$t['id']} est en cours depuis {$t['days_in_progress']} jours sans résolution!\n\n";
        $message .= "🏨 Hôtel: {$t['hotel_name']}\n";
        $message .= "📍 Localisation: " . ($t['room_number'] ?: 'Parties communes') . "\n";
        $message .= "🏷️ Catégorie: {$t['category']}\n";
        $message .= "⚡ Priorité: {$t['priority']}\n";
        $message .= "📝 Description: {$t['description']}\n";
        $message .= "👷 Pris en charge par: " . ($t['assigned_to_name'] ?: 'Non assigné') . "\n";
        $message .= "📅 Pris en charge le: {$t['assigned_at']}\n\n";
        $message .= "Action urgente requise pour résoudre ce problème.";
        
        // Notifier les groupe_manager + admin affectés à cet hôtel
        $managers = db()->query(
            "SELECT DISTINCT u.id, u.email FROM users u 
             JOIN user_hotels uh ON u.id = uh.user_id 
             WHERE uh.hotel_id = ? AND u.role IN ('groupe_manager', 'admin') AND u.status = 'active'",
            [$t['hotel_id']]
        );
        
        foreach ($managers as $m) {
            // Notification en base
            createNotification($m['id'], 'danger', "🚨 Ticket #{$t['id']} non résolu", substr($message, 0, 500));
            
            // Email
            sendMaintenanceAlertEmail($m['email'], $subject, $t, '5days');
        }
        
        // Marquer comme notifié
        try {
            db()->execute("UPDATE maintenance_tickets SET notified_72h = 1 WHERE id = ?", [$t['id']]);
        } catch (Exception $e) {
            // Colonne peut ne pas exister, on continue
        }
        echo "    → Ticket #{$t['id']} - alerte 5 jours envoyée\n";
    }
    
    // ============================================
    // 3. ANCIENNE LOGIQUE - TICKETS > 7 JOURS (retard grave)
    // ============================================
    $ticketsOverdue = db()->query(
        "SELECT t.*, h.name as hotel_name, 
                CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name,
                DATEDIFF(NOW(), t.assigned_at) as days_in_progress
         FROM maintenance_tickets t
         JOIN hotels h ON t.hotel_id = h.id AND h.status = 'active'
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.status = 'in_progress' 
         AND t.assigned_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    
    echo "  Tickets en cours > 7 jours (retard grave): " . count($ticketsOverdue) . "\n";
    
    foreach ($ticketsOverdue as $t) {
        $subject = "[RETARD GRAVE] Ticket #{$t['id']} en cours depuis {$t['days_in_progress']} jours";
        $message = "🚨 RETARD GRAVE: Le ticket #{$t['id']} est en cours de traitement depuis {$t['days_in_progress']} jours!\n\n";
        $message .= "Hôtel: {$t['hotel_name']}\n";
        $message .= "Catégorie: {$t['category']}\n";
        $message .= "Assigné à: " . ($t['assigned_to_name'] ?: 'Non assigné') . "\n";
        $message .= "Description: {$t['description']}\n";
        $message .= "Pris en charge le: {$t['assigned_at']}\n\n";
        $message .= "Ce ticket nécessite une intervention immédiate.";
        
        // Notifier tous les admins
        $admins = db()->query("SELECT id, email FROM users WHERE role = 'admin' AND status = 'active'");
        foreach ($admins as $a) {
            sendNotification($a['id'], $a['email'], $subject, $message);
        }
        
        echo "    → Ticket #{$t['id']} en retard grave ({$t['days_in_progress']} jours)\n";
    }
}

// =============================================================================
// CONGÉS - Rappel hebdomadaire
// =============================================================================

/**
 * Envoie un rappel hebdomadaire des congés en attente de validation.
 * Alerte urgente pour les congés dont le départ est dans moins de 5 semaines.
 */
function sendLeavesReminder() {
    // Congés en attente de validation
    $pendingLeaves = db()->query(
        "SELECT l.*, CONCAT(u.first_name, ' ', u.last_name) as employee_name
         FROM leave_requests l
         JOIN users u ON l.employee_id = u.id
         WHERE l.status = 'pending'
         ORDER BY l.start_date ASC"
    );
    
    echo "  Congés en attente: " . count($pendingLeaves) . "\n";
    
    if (empty($pendingLeaves)) {
        return;
    }
    
    // Préparer le message récapitulatif
    $message = "Rappel: " . count($pendingLeaves) . " demande(s) de congés en attente de validation.\n\n";
    foreach ($pendingLeaves as $l) {
        $message .= "• {$l['employee_name']}: du {$l['start_date']} au {$l['end_date']} ({$l['leave_type']})\n";
    }
    
    // Notifier les validateurs (responsables et admin)
    $validators = db()->query(
        "SELECT id, email FROM users WHERE role IN ('admin', 'groupe_manager', 'hotel_manager') AND status = 'active'"
    );
    
    foreach ($validators as $v) {
        sendNotification($v['id'], $v['email'], 'Rappel: Congés en attente de validation', $message);
    }
    
    // Vérifier les congés URGENTS (départ dans moins de 5 semaines)
    $fiveWeeksFromNow = date('Y-m-d', strtotime('+5 weeks'));
    $urgentLeaves = array();
    foreach ($pendingLeaves as $l) {
        if ($l['start_date'] <= $fiveWeeksFromNow) {
            $urgentLeaves[] = $l;
        }
    }
    
    if (!empty($urgentLeaves)) {
        echo "  Congés urgents (< 5 semaines): " . count($urgentLeaves) . "\n";
        
        $urgentMessage = "⚠️ URGENT: Les congés suivants doivent être validés rapidement (départ dans moins de 5 semaines):\n\n";
        foreach ($urgentLeaves as $l) {
            $urgentMessage .= "• {$l['employee_name']}: du {$l['start_date']} au {$l['end_date']}\n";
        }
        
        // Notifier uniquement admin et groupe managers pour les urgents
        $urgentValidators = db()->query(
            "SELECT id, email FROM users WHERE role IN ('admin', 'groupe_manager') AND status = 'active'"
        );
        
        foreach ($urgentValidators as $v) {
            sendNotification($v['id'], $v['email'], '[URGENT] Congés à valider rapidement', $urgentMessage);
        }
    }
}

// =============================================================================
// CLEANUP - Nettoyage des anciennes données
// =============================================================================

/**
 * Nettoie les données obsolètes :
 *   - Tokens expirés
 *   - Anciennes alertes (> 90 jours)
 *   - Anciens dispatches (> 365 jours)
 */
function cleanupOldData() {
    // Supprimer les anciennes alertes (> 90 jours)
    db()->execute("DELETE FROM dispatch_alerts WHERE alert_date < DATE_SUB(NOW(), INTERVAL 90 DAY)");
    echo "  Anciennes alertes supprimées (> 90 jours)\n";
    
    // Supprimer les anciens dispatches (> 365 jours)
    db()->execute("DELETE FROM room_dispatch WHERE dispatch_date < DATE_SUB(NOW(), INTERVAL 365 DAY)");
    echo "  Anciens dispatches supprimés (> 365 jours)\n";
    
    // Marquer les anciens messages comme lus (> 30 jours)
    db()->execute("UPDATE conversation_messages SET is_read = 1 WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) AND is_read = 0");
    echo "  Anciens messages marqués comme lus (> 30 jours)\n";
}

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * Envoie une notification à un utilisateur :
 *   1. Message dans la messagerie interne (conversations)
 *   2. Email
 */
function sendNotification($userId, $email, $subject, $content) {
    // 1. Créer une conversation système ou utiliser l'existante
    $systemUser = getSystemUser();
    
    if ($systemUser && $systemUser['id'] != $userId) {
        // Chercher une conversation existante avec cet utilisateur
        $conv = db()->queryOne(
            "SELECT id FROM conversations 
             WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
            [$systemUser['id'], $userId, $userId, $systemUser['id']]
        );
        
        if (!$conv) {
            // Créer la conversation
            db()->execute(
                "INSERT INTO conversations (user1_id, user2_id, last_message, last_at, created_at) 
                 VALUES (?, ?, ?, NOW(), NOW())",
                [$systemUser['id'], $userId, substr($subject, 0, 100)]
            );
            $convId = db()->queryOne("SELECT LAST_INSERT_ID() as id");
            $convId = isset($convId['id']) ? $convId['id'] : 0;
        } else {
            $convId = $conv['id'];
        }
        
        if ($convId) {
            // Ajouter le message
            $fullContent = "📢 $subject\n\n$content";
            db()->execute(
                "INSERT INTO conversation_messages (conversation_id, sender_id, content, is_read, created_at) 
                 VALUES (?, ?, ?, 0, NOW())",
                [$convId, $systemUser['id'], $fullContent]
            );
            
            // Mettre à jour la conversation
            db()->execute(
                "UPDATE conversations SET last_message = ?, last_at = NOW() WHERE id = ?",
                [substr($subject, 0, 100), $convId]
            );
        }
    }
    
    // 2. Envoyer l'email
    sendEmail($email, $subject, $content);
}

/**
 * Récupère ou crée l'utilisateur système pour les notifications
 */
function getSystemUser() {
    // Chercher un utilisateur système existant
    $system = db()->queryOne("SELECT id FROM users WHERE email = 'system@acl-gestion.com'");
    
    if (!$system) {
        // Utiliser le premier admin comme expéditeur
        $system = db()->queryOne("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
    }
    
    return $system;
}

/**
 * Envoie un email
 */
function sendEmail($to, $subject, $message) {
    if (empty($to)) return;
    
    $headers = "From: noreply@acl-gestion.com\r\n";
    $headers .= "Reply-To: noreply@acl-gestion.com\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "X-Mailer: ACL-GESTION-CRON\r\n";
    
    $fullSubject = "ACL GESTION - $subject";
    
    $result = @mail($to, $fullSubject, $message, $headers);
    
    if ($result) {
        echo "    Email envoyé à $to\n";
    } else {
        echo "    ⚠ Échec envoi email à $to\n";
    }
}

/**
 * Envoie un email HTML formaté pour les alertes maintenance
 */
function sendMaintenanceAlertEmail($to, $subject, $ticket, $alertType = '2days') {
    if (empty($to)) return;
    
    $priorityLabels = ['low' => 'Basse', 'medium' => 'Moyenne', 'high' => 'Haute', 'critical' => 'CRITIQUE'];
    $priorityLabel = $priorityLabels[$ticket['priority']] ?? $ticket['priority'];
    $roomInfo = $ticket['room_number'] ?: 'Parties communes';
    
    // Couleur selon le type d'alerte
    if ($alertType === '5days' || $ticket['priority'] === 'critical') {
        $headerColor = '#DC2626'; // Rouge
        $alertIcon = '🚨';
        $alertText = 'Action urgente requise';
    } else {
        $headerColor = '#F59E0B'; // Orange
        $alertIcon = '⚠️';
        $alertText = 'Rappel - Action requise';
    }
    
    $htmlBody = "
    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
        <div style='background: {$headerColor}; color: white; padding: 20px; text-align: center;'>
            <h2 style='margin: 0;'>{$alertIcon} Ticket Maintenance #{$ticket['id']}</h2>
            <p style='margin: 10px 0 0 0; font-size: 14px;'>{$alertText}</p>
        </div>
        <div style='padding: 25px; background: #f9f9f9;'>
            <table style='width: 100%; border-collapse: collapse;'>
                <tr>
                    <td style='padding: 10px 0; border-bottom: 1px solid #ddd;'><strong>🏨 Hôtel</strong></td>
                    <td style='padding: 10px 0; border-bottom: 1px solid #ddd;'>{$ticket['hotel_name']}</td>
                </tr>
                <tr>
                    <td style='padding: 10px 0; border-bottom: 1px solid #ddd;'><strong>📍 Localisation</strong></td>
                    <td style='padding: 10px 0; border-bottom: 1px solid #ddd;'>{$roomInfo}</td>
                </tr>
                <tr>
                    <td style='padding: 10px 0; border-bottom: 1px solid #ddd;'><strong>🏷️ Catégorie</strong></td>
                    <td style='padding: 10px 0; border-bottom: 1px solid #ddd;'>{$ticket['category']}</td>
                </tr>
                <tr>
                    <td style='padding: 10px 0; border-bottom: 1px solid #ddd;'><strong>⚡ Priorité</strong></td>
                    <td style='padding: 10px 0; border-bottom: 1px solid #ddd;'>
                        <span style='background: " . ($ticket['priority'] === 'critical' ? '#DC2626' : ($ticket['priority'] === 'high' ? '#F59E0B' : '#3B82F6')) . "; color: white; padding: 3px 10px; border-radius: 3px;'>{$priorityLabel}</span>
                    </td>
                </tr>
                <tr>
                    <td style='padding: 10px 0;'><strong>📅 Créé le</strong></td>
                    <td style='padding: 10px 0;'>{$ticket['created_at']}</td>
                </tr>
            </table>
            
            <div style='margin-top: 20px; padding: 15px; background: white; border-radius: 5px; border-left: 4px solid {$headerColor};'>
                <strong>📝 Description:</strong>
                <p style='margin: 10px 0 0 0; color: #333;'>" . nl2br(htmlspecialchars($ticket['description'])) . "</p>
            </div>
            
            <div style='margin-top: 20px; text-align: center;'>
                <p style='color: #666;'>Connectez-vous à ACL GESTION pour traiter ce ticket.</p>
            </div>
        </div>
        <div style='padding: 15px; background: #1E3A5F; color: white; text-align: center; font-size: 12px;'>
            <p style='margin: 0;'>ACL GESTION - Système de gestion hôtelière</p>
        </div>
    </div>";
    
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";
    $headers .= "From: ACL GESTION <noreply@acl-gestion.com>\r\n";
    
    $result = @mail($to, $subject, $htmlBody, $headers);
    
    if ($result) {
        echo "    Email HTML envoyé à $to\n";
    } else {
        echo "    ⚠ Échec envoi email à $to\n";
    }
}

/**
 * Créer une notification dans la base de données
 */
function createNotification($userId, $type, $title, $message = null, $link = null, $referenceId = null) {
    try {
        $db = Database::getInstance();
        // La table notifications n'a pas de colonnes link et reference_id
        // Mapper le type sur les valeurs ENUM valides
        $validTypes = ['info', 'warning', 'danger', 'success'];
        $mappedType = 'info';
        if (in_array($type, $validTypes)) {
            $mappedType = $type;
        } elseif (strpos($type, 'critical') !== false || strpos($type, 'urgent') !== false || strpos($type, 'danger') !== false) {
            $mappedType = 'danger';
        } elseif (strpos($type, 'warning') !== false || strpos($type, 'late') !== false || strpos($type, 'due') !== false) {
            $mappedType = 'warning';
        } elseif (strpos($type, 'success') !== false) {
            $mappedType = 'success';
        }
        
        $db->execute(
            "INSERT INTO notifications (user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, NOW())",
            [$userId, $mappedType, $title, $message]
        );
    } catch (Exception $e) {
        echo "    ⚠ Erreur création notification: " . $e->getMessage() . "\n";
    }
}

// =============================================================================
// AUDIT - Vérification des échéances et rappels
// =============================================================================

/**
 * Vérifie les audits obligatoires :
 *   1. Crée les schedules pour les mois à venir
 *   2. Envoie des rappels X jours avant l'échéance
 *   3. Notifie les retards (manager hôtel, groupe, admin)
 */
function checkAuditDeadlines() {
    echo "Vérification des échéances d'audit...\n";
    
    $db = Database::getInstance();
    $today = date('Y-m-d');
    
    try {
        // 1. Créer les schedules manquants pour les grilles obligatoires
        createMissingAuditSchedules($db);
        
        // 2. Mettre à jour les status overdue
        $db->execute("UPDATE audit_schedules SET status = 'overdue' WHERE status = 'pending' AND deadline_date < ?", [$today]);
        echo "  Status mis à jour.\n";
        
        // 3. Envoyer les rappels (X jours avant deadline)
        sendAuditReminders($db, $today);
        
        // 4. Notifier les retards avec escalade
        notifyAuditOverdue($db, $today);
        
    } catch (Exception $e) {
        echo "  ⚠ Erreur: " . $e->getMessage() . "\n";
    }
}

/**
 * Crée les schedules manquants pour les 3 prochains mois
 */
function createMissingAuditSchedules($db) {
    try {
        // Récupérer les grilles obligatoires actives (table audit_grids ou evaluation_grids)
        $grids = [];
        try {
            $grids = $db->query("SELECT * FROM audit_grids WHERE is_mandatory = 1 AND is_active = 1");
        } catch (Exception $e) {
            // Table audit_grids n'existe pas, essayer evaluation_grids
            try {
                $grids = $db->query("SELECT * FROM evaluation_grids WHERE is_active = 1");
            } catch (Exception $e2) {
                echo "  Tables audit/evaluation non disponibles\n";
                return;
            }
        }
        
        if (empty($grids)) {
            echo "  Aucune grille obligatoire trouvée\n";
            return;
        }
        
        foreach ($grids as $grid) {
            // Déterminer les hôtels concernés
            if (!empty($grid['hotel_id'])) {
                $hotels = $db->query("SELECT id FROM hotels WHERE id = ? AND status = 'active'", [$grid['hotel_id']]);
            } else {
                $hotels = $db->query("SELECT id FROM hotels WHERE status = 'active'");
            }
            
            $year = date('Y');
            $month = date('n');
            
            foreach ($hotels as $hotel) {
                // Créer pour les 3 prochains mois
                for ($i = 0; $i < 3; $i++) {
                    $m = $month + $i;
                    $y = $year;
                    if ($m > 12) { $m -= 12; $y++; }
                    
                    // Vérifier si existe déjà
                    try {
                        $existing = $db->queryOne(
                            "SELECT id FROM audit_schedules WHERE grid_id = ? AND hotel_id = ? AND period_year = ? AND period_month = ?",
                            [$grid['id'], $hotel['id'], $y, $m]
                        );
                        
                        if (!$existing) {
                            $dayOfMonth = isset($grid['day_of_month']) ? $grid['day_of_month'] : 28;
                            $deadline = sprintf('%04d-%02d-%02d', $y, $m, min($dayOfMonth, 28));
                            $db->execute(
                                "INSERT INTO audit_schedules (grid_id, hotel_id, period_year, period_month, deadline_date, status, created_at)
                                 VALUES (?, ?, ?, ?, ?, 'pending', NOW())",
                                [$grid['id'], $hotel['id'], $y, $m, $deadline]
                            );
                            echo "  + Schedule créé: {$grid['name']} - Hôtel #{$hotel['id']} - $m/$y\n";
                        }
                    } catch (Exception $e) {
                        // Table audit_schedules n'existe pas
                        return;
                    }
                }
            }
        }
    } catch (Exception $e) {
        echo "  ⚠ Erreur audit schedules: " . $e->getMessage() . "\n";
    }
}

/**
 * Envoie les rappels pour les audits à venir
 */
function sendAuditReminders($db, $today) {
    try {
        // Récupérer les schedules en attente avec rappel non envoyé (hôtels actifs uniquement)
        $schedules = $db->query(
            "SELECT s.*, ag.name as grid_name, ag.reminder_days, h.name as hotel_name
             FROM audit_schedules s
             JOIN audit_grids ag ON s.grid_id = ag.id
             JOIN hotels h ON s.hotel_id = h.id AND h.status = 'active'
             WHERE s.status = 'pending' 
               AND s.reminder_sent = 0 
               AND s.audit_id IS NULL
               AND DATEDIFF(s.deadline_date, ?) <= ag.reminder_days
               AND s.deadline_date >= ?",
            [$today, $today]
        );
        
        echo "  Rappels à envoyer: " . count($schedules) . "\n";
        
        foreach ($schedules as $schedule) {
            $daysLeft = (strtotime($schedule['deadline_date']) - strtotime($today)) / 86400;
            
            // Notifier les hotel_managers de cet hôtel
            $managers = $db->query(
                "SELECT u.id, u.email FROM users u 
                 JOIN user_hotels uh ON u.id = uh.user_id 
                 WHERE uh.hotel_id = ? AND u.role = 'hotel_manager' AND u.status = 'active'",
                [$schedule['hotel_id']]
            );
            
            $subject = "Rappel: Audit à réaliser - {$schedule['grid_name']}";
            $message = "L'audit \"{$schedule['grid_name']}\" pour l'hôtel {$schedule['hotel_name']} doit être réalisé avant le " . 
                       date('d/m/Y', strtotime($schedule['deadline_date'])) . ".\n\n" .
                       "Il vous reste " . round($daysLeft) . " jour(s).";
            
            foreach ($managers as $manager) {
                // Notification dans l'app
                createNotification($manager['id'], 'warning', $subject, $message);
                
                // Email
                sendEmail($manager['email'], $subject, $message);
                
                echo "    → Rappel envoyé à manager #{$manager['id']} pour audit {$schedule['grid_name']}\n";
            }
            
            // Marquer comme rappel envoyé
            $db->execute("UPDATE audit_schedules SET reminder_sent = 1, reminder_sent_at = NOW() WHERE id = ?", [$schedule['id']]);
        }
    } catch (Exception $e) {
        echo "  ⚠ Erreur rappels audit: " . $e->getMessage() . "\n";
    }
}

/**
 * Notifie les audits en retard avec système d'escalade
 */
function notifyAuditOverdue($db, $today) {
    try {
        // Récupérer les audits en retard non notifiés aujourd'hui (hôtels actifs uniquement)
        $overdueSchedules = $db->query(
            "SELECT s.*, ag.name as grid_name, h.name as hotel_name,
             DATEDIFF(?, s.deadline_date) as days_overdue
             FROM audit_schedules s
             JOIN audit_grids ag ON s.grid_id = ag.id
             JOIN hotels h ON s.hotel_id = h.id AND h.status = 'active'
             WHERE s.status = 'overdue' 
               AND s.audit_id IS NULL
               AND (s.overdue_notified = 0 OR DATE(s.overdue_notified_at) < ?)",
            [$today, $today]
        );
        
        echo "  Audits en retard: " . count($overdueSchedules) . "\n";
        
        foreach ($overdueSchedules as $schedule) {
            $daysOverdue = $schedule['days_overdue'];
            
            $subject = "⚠️ URGENT: Audit en retard - {$schedule['grid_name']}";
            $message = "L'audit \"{$schedule['grid_name']}\" pour l'hôtel {$schedule['hotel_name']} est en retard de {$daysOverdue} jour(s).\n\n" .
                       "Date d'échéance: " . date('d/m/Y', strtotime($schedule['deadline_date'])) . "\n\n" .
                       "Veuillez réaliser cet audit dès que possible.";
            
            // Toujours notifier les hotel_managers
            $managers = $db->query(
                "SELECT u.id, u.email FROM users u 
                 JOIN user_hotels uh ON u.id = uh.user_id 
                 WHERE uh.hotel_id = ? AND u.role = 'hotel_manager' AND u.status = 'active'",
                [$schedule['hotel_id']]
            );
            
            foreach ($managers as $manager) {
                createNotification($manager['id'], 'warning', $subject, $message);
                sendEmail($manager['email'], $subject, $message);
                echo "    → Alerte retard envoyée à manager #{$manager['id']}\n";
            }
            
            // Après 2 jours, notifier aussi les groupe_managers
            if ($daysOverdue >= 2) {
                $groupeManagers = $db->query(
                    "SELECT DISTINCT u.id, u.email FROM users u 
                     JOIN user_hotels uh ON u.id = uh.user_id 
                     WHERE uh.hotel_id = ? AND u.role = 'groupe_manager' AND u.status = 'active'",
                    [$schedule['hotel_id']]
                );
                
                foreach ($groupeManagers as $gm) {
                    createNotification($gm['id'], 'warning', $subject, $message . "\n\n(Escalade: 2+ jours de retard)");
                    sendEmail($gm['email'], $subject, $message . "\n\n(Escalade: 2+ jours de retard)");
                    echo "    → Escalade groupe_manager #{$gm['id']}\n";
                }
            }
            
            // Après 5 jours, notifier les admins
            if ($daysOverdue >= 5) {
                $admins = $db->query("SELECT id, email FROM users WHERE role = 'admin' AND status = 'active'");
                
                foreach ($admins as $admin) {
                    createNotification($admin['id'], 'danger', $subject, $message . "\n\n(ESCALADE CRITIQUE: 5+ jours de retard)");
                    sendEmail($admin['email'], $subject, $message . "\n\n(ESCALADE CRITIQUE: 5+ jours de retard)");
                    echo "    → ESCALADE ADMIN #{$admin['id']}\n";
                }
            }
            
            // Marquer comme notifié
            $db->execute("UPDATE audit_schedules SET overdue_notified = 1, overdue_notified_at = NOW() WHERE id = ?", [$schedule['id']]);
        }
    } catch (Exception $e) {
        echo "  ⚠ Erreur audits en retard: " . $e->getMessage() . "\n";
    }
}

// =============================================================================
// TASKS DUE - Rappels pour tâches à échéance
// =============================================================================

/**
 * Vérifie les tâches à échéance aujourd'hui ou en retard
 * et crée des notifications pour les utilisateurs assignés
 */
function checkTasksDue() {
    echo "Vérification des tâches à échéance...\n";
    
    $db = Database::getInstance();
    
    try {
        // Tâches à échéance aujourd'hui (non complétées) sur hôtels actifs
        $tasksDueToday = $db->query(
            "SELECT t.*, b.name as board_name 
             FROM tasks t 
             JOIN task_boards b ON t.board_id = b.id 
             JOIN hotels h ON b.hotel_id = h.id AND h.status = 'active'
             WHERE t.due_date = CURDATE() 
               AND t.is_completed = 0 
               AND t.assigned_to IS NOT NULL"
        );
        
        echo "  Tâches à échéance aujourd'hui: " . count($tasksDueToday) . "\n";
        
        foreach ($tasksDueToday as $task) {
            // Vérifier si une notification n'a pas déjà été envoyée aujourd'hui
            // On vérifie par titre car reference_id n'existe pas
            $existing = $db->queryOne(
                "SELECT id FROM notifications 
                 WHERE user_id = ? AND title LIKE '%échéance%' AND message LIKE ? AND DATE(created_at) = CURDATE()",
                [$task['assigned_to'], '%' . $task['title'] . '%']
            );
            
            if (!$existing) {
                createNotification(
                    $task['assigned_to'],
                    'warning',
                    'Tâche à échéance aujourd\'hui',
                    "La tâche \"{$task['title']}\" arrive à échéance aujourd'hui"
                );
                echo "    → Notification envoyée pour tâche #{$task['id']}: {$task['title']}\n";
            }
        }
        
        // Tâches en retard (échéance passée) sur hôtels actifs
        $tasksOverdue = $db->query(
            "SELECT t.*, b.name as board_name, DATEDIFF(CURDATE(), t.due_date) as days_overdue
             FROM tasks t 
             JOIN task_boards b ON t.board_id = b.id 
             JOIN hotels h ON b.hotel_id = h.id AND h.status = 'active'
             WHERE t.due_date < CURDATE() 
               AND t.is_completed = 0 
               AND t.assigned_to IS NOT NULL"
        );
        
        echo "  Tâches en retard: " . count($tasksOverdue) . "\n";
        
        foreach ($tasksOverdue as $task) {
            // Notification une fois par semaine pour les tâches en retard
            $existing = $db->queryOne(
                "SELECT id FROM notifications 
                 WHERE user_id = ? AND title LIKE '%retard%' AND message LIKE ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)",
                [$task['assigned_to'], '%' . $task['title'] . '%']
            );
            
            if (!$existing) {
                createNotification(
                    $task['assigned_to'],
                    'danger',
                    'Tâche en retard',
                    "La tâche \"{$task['title']}\" est en retard de {$task['days_overdue']} jour(s)"
                );
                echo "    → Notification envoyée pour tâche en retard #{$task['id']}: {$task['title']} ({$task['days_overdue']} jours)\n";
            }
        }
        
    } catch (Exception $e) {
        echo "  ⚠ Erreur: " . $e->getMessage() . "\n";
    }
}

/**
 * Vérification des clôtures journalières non effectuées
 * À exécuter toutes les heures entre 13h et 23h
 * 
 * - 13h : Alerte niveau 1 → Manager de l'hôtel
 * - 48h après : Alerte niveau 2 → Admin et Groupe Manager
 */
function checkClosureAlerts() {
    echo "\n=== ALERTES CLÔTURES JOURNALIÈRES ===\n\n";
    
    try {
        $db = db();
        $yesterday = date('Y-m-d', strtotime('-1 day'));
        $twoDaysAgo = date('Y-m-d', strtotime('-2 days'));
        $currentHour = (int)date('H');
        
        // Récupérer tous les hôtels actifs
        $hotels = $db->query("SELECT id, name FROM hotels WHERE status = 'active'");
        
        echo "  Vérification pour " . count($hotels) . " hôtel(s)\n";
        
        foreach ($hotels as $hotel) {
            // Vérifier si la clôture d'hier est faite
            $closure = $db->queryOne(
                "SELECT id, status FROM daily_closures WHERE hotel_id = ? AND closure_date = ? AND status IN ('submitted', 'validated')",
                [$hotel['id'], $yesterday]
            );
            
            if (!$closure && $currentHour >= 13) {
                // Clôture non effectuée après 13h - Alerte niveau 1
                echo "  ⚠ {$hotel['name']}: Clôture du $yesterday non effectuée\n";
                
                // Vérifier si alerte niveau 1 déjà envoyée (dans une table temporaire ou via notification)
                // Note: la table closure_alerts peut ne pas exister, on utilise alors les notifications
                try {
                    $alertSent = $db->queryOne(
                        "SELECT id FROM closure_alerts WHERE hotel_id = ? AND closure_date = ? AND alert_level = 1",
                        [$hotel['id'], $yesterday]
                    );
                } catch (Exception $e) {
                    $alertSent = null;
                }
                
                if (!$alertSent) {
                    // Envoyer alerte aux managers de l'hôtel (via user_hotels)
                    $managers = $db->query(
                        "SELECT DISTINCT u.id, u.email, u.first_name FROM users u
                         JOIN user_hotels uh ON u.id = uh.user_id
                         WHERE uh.hotel_id = ? AND u.role IN ('hotel_manager', 'receptionniste') AND u.status = 'active'",
                        [$hotel['id']]
                    );
                    
                    foreach ($managers as $manager) {
                        // Notification
                        createNotification(
                            $manager['id'],
                            'warning',
                            'Clôture journalière en retard',
                            "La clôture du " . date('d/m/Y', strtotime($yesterday)) . " pour {$hotel['name']} n'a pas été effectuée."
                        );
                        
                        // Message interne via le système de conversations
                        sendNotification(
                            $manager['id'],
                            $manager['email'],
                            'URGENT: Clôture journalière en attente - ' . $hotel['name'],
                            "Bonjour {$manager['first_name']},\n\nLa clôture journalière du " . date('d/m/Y', strtotime($yesterday)) . " pour l'hôtel {$hotel['name']} n'a pas encore été effectuée.\n\nMerci de la compléter dès que possible.\n\nCordialement,\nSystème ACL Gestion"
                        );
                        
                        echo "    → Alerte niveau 1 envoyée à {$manager['email']}\n";
                    }
                    
                    // Enregistrer l'alerte si la table existe
                    try {
                        $db->insert(
                            "INSERT INTO closure_alerts (hotel_id, closure_date, alert_level, sent_at) VALUES (?, ?, 1, NOW())",
                            [$hotel['id'], $yesterday]
                        );
                    } catch (Exception $e) {
                        // Table n'existe pas, ignorer
                    }
                }
            }
            
            // Vérifier clôture de J-2 (48h de retard)
            $closureOld = $db->queryOne(
                "SELECT id, status FROM daily_closures WHERE hotel_id = ? AND closure_date = ? AND status IN ('submitted', 'validated')",
                [$hotel['id'], $twoDaysAgo]
            );
            
            if (!$closureOld) {
                // Clôture non effectuée après 48h - Alerte niveau 2
                try {
                    $alertSent = $db->queryOne(
                        "SELECT id FROM closure_alerts WHERE hotel_id = ? AND closure_date = ? AND alert_level = 2",
                        [$hotel['id'], $twoDaysAgo]
                    );
                } catch (Exception $e) {
                    $alertSent = null;
                }
                
                if (!$alertSent) {
                    echo "  🚨 {$hotel['name']}: Clôture du $twoDaysAgo toujours non effectuée (48h+)\n";
                    
                    // Envoyer aux admins et groupe managers
                    $admins = $db->query(
                        "SELECT id, email, first_name FROM users WHERE role IN ('admin', 'groupe_manager') AND status = 'active'"
                    );
                    
                    foreach ($admins as $admin) {
                        createNotification(
                            $admin['id'],
                            'danger',
                            'CRITIQUE: Clôture non effectuée depuis 48h',
                            "La clôture du " . date('d/m/Y', strtotime($twoDaysAgo)) . " pour {$hotel['name']} n'a toujours pas été effectuée."
                        );
                        
                        sendNotification(
                            $admin['id'],
                            $admin['email'],
                            'CRITIQUE: Clôture non effectuée depuis 48h - ' . $hotel['name'],
                            "Attention,\n\nLa clôture journalière du " . date('d/m/Y', strtotime($twoDaysAgo)) . " pour l'hôtel {$hotel['name']} n'a toujours pas été effectuée après plus de 48 heures.\n\nUne intervention est nécessaire.\n\nCordialement,\nSystème ACL Gestion"
                        );
                        
                        echo "    → Alerte niveau 2 (CRITIQUE) envoyée à {$admin['email']}\n";
                    }
                    
                    try {
                        $db->insert(
                            "INSERT INTO closure_alerts (hotel_id, closure_date, alert_level, sent_at) VALUES (?, ?, 2, NOW())",
                            [$hotel['id'], $twoDaysAgo]
                        );
                    } catch (Exception $e) {
                        // Table n'existe pas, ignorer
                    }
                }
            }
        }
        
        echo "\n  ✓ Vérification terminée\n";
        
    } catch (Exception $e) {
        echo "  ⚠ Erreur: " . $e->getMessage() . "\n";
    }
}
