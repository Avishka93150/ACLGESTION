#!/usr/bin/env php
<?php
/**
 * ACL GESTION - Cron Runner pour les automatisations
 * 
 * Ce script doit être exécuté toutes les 30 minutes via crontab.
 * Il vérifie quelles automatisations doivent s'exécuter et les lance.
 * 
 * Configuration crontab recommandée :
 * */30 * * * * /opt/plesk/php/8.1/bin/php /var/www/vhosts/acl-gestion.com/api/cron_runner.php
 * 
 * Ou pour tester manuellement :
 * php cron_runner.php
 */

// Configuration
define('CRON_SECRET', 'acl-cron-secret-2025'); // Doit correspondre à celui dans index.php
define('API_BASE_URL', 'https://api.acl-gestion.com'); // Adapter selon votre configuration

// Si appelé en local, utiliser l'include direct
$useDirectInclude = true; // Mettre à false pour utiliser l'API HTTP

echo "[" . date('Y-m-d H:i:s') . "] Démarrage du cycle d'automatisations...\n";

if ($useDirectInclude) {
    // Méthode directe (plus rapide, recommandée)
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/Database.php';
    
    // Inclure les fonctions d'automatisation depuis index.php
    // Note: ces fonctions sont définies dans index.php
    
    try {
        // Connexion à la base de données
        $db = Database::getInstance();
        
        $now = new DateTime();
        $currentTime = $now->format('H:i');
        $currentDay = $now->format('N');
        $currentDayOfMonth = intval($now->format('j'));
        
        echo "[" . date('Y-m-d H:i:s') . "] Heure actuelle: $currentTime, Jour: $currentDay\n";
        
        // Récupérer les automatisations actives
        $automations = $db->query("SELECT * FROM automations WHERE is_active = 1");
        
        echo "[" . date('Y-m-d H:i:s') . "] " . count($automations) . " automatisation(s) active(s) trouvée(s)\n";
        
        $executed = 0;
        $skipped = 0;
        
        foreach ($automations as $auto) {
            $shouldRun = shouldRunAutomationCron($auto, $currentTime, $currentDay, $currentDayOfMonth, $db);
            
            if (!$shouldRun) {
                $skipped++;
                continue;
            }
            
            echo "[" . date('Y-m-d H:i:s') . "] Exécution: {$auto['name']} ({$auto['code']})\n";
            
            // Créer un log
            $logId = $db->insert(
                "INSERT INTO automation_logs (automation_id, started_at, status, triggered_by)
                 VALUES (?, NOW(), 'running', 'cron')",
                [$auto['id']]
            );
            
            $startTime = microtime(true);
            
            try {
                // Exécuter selon le code
                $result = executeAutomationCron($auto, $db);
                $duration = round((microtime(true) - $startTime) * 1000);
                
                $db->execute(
                    "UPDATE automation_logs SET ended_at = NOW(), status = 'success', duration_ms = ?, message = ? WHERE id = ?",
                    [$duration, $result['message'] ?? 'OK', $logId]
                );
                
                $db->execute(
                    "UPDATE automations SET last_run_at = NOW(), last_run_status = 'success', last_run_message = ?, run_count = run_count + 1 WHERE id = ?",
                    [$result['message'] ?? 'OK', $auto['id']]
                );
                
                echo "[" . date('Y-m-d H:i:s') . "] ✓ Succès: {$result['message']}\n";
                $executed++;
                
            } catch (Exception $e) {
                $duration = round((microtime(true) - $startTime) * 1000);
                
                $db->execute(
                    "UPDATE automation_logs SET ended_at = NOW(), status = 'error', duration_ms = ?, message = ? WHERE id = ?",
                    [$duration, $e->getMessage(), $logId]
                );
                
                $db->execute(
                    "UPDATE automations SET last_run_at = NOW(), last_run_status = 'error', last_run_message = ?, run_count = run_count + 1 WHERE id = ?",
                    [$e->getMessage(), $auto['id']]
                );
                
                echo "[" . date('Y-m-d H:i:s') . "] ✗ Erreur: {$e->getMessage()}\n";
            }
        }
        
        echo "[" . date('Y-m-d H:i:s') . "] Terminé. Exécutées: $executed, Ignorées: $skipped\n";
        
    } catch (Exception $e) {
        echo "[" . date('Y-m-d H:i:s') . "] ERREUR FATALE: " . $e->getMessage() . "\n";
        exit(1);
    }
    
} else {
    // Méthode via API HTTP (utile si le cron est sur un autre serveur)
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => API_BASE_URL . '/api/index.php/automations/cron',
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-Cron-Token: ' . CRON_SECRET
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 300 // 5 minutes max
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        echo "[" . date('Y-m-d H:i:s') . "] Cycle terminé. Exécutées: " . ($data['executed'] ?? 0) . "\n";
    } else {
        echo "[" . date('Y-m-d H:i:s') . "] Erreur HTTP $httpCode: $response\n";
        exit(1);
    }
}

echo "[" . date('Y-m-d H:i:s') . "] Fin du script.\n";

// =============================================================================
// FONCTIONS LOCALES
// =============================================================================

function shouldRunAutomationCron($auto, $currentTime, $currentDay, $currentDayOfMonth, $db) {
    $scheduleTime = substr($auto['schedule_time'] ?? '09:00:00', 0, 5);
    
    // Tolérance de 30 minutes
    $scheduleMinutes = timeToMinutesCron($scheduleTime);
    $currentMinutes = timeToMinutesCron($currentTime);
    $diff = abs($currentMinutes - $scheduleMinutes);
    
    if ($diff > 30 && $diff < (24 * 60 - 30)) {
        return false;
    }
    
    // Vérifier si déjà exécuté récemment
    if ($auto['last_run_at']) {
        $lastRun = new DateTime($auto['last_run_at']);
        $now = new DateTime();
        $diffMinutes = ($now->getTimestamp() - $lastRun->getTimestamp()) / 60;
        
        if ($diffMinutes < 45) {
            return false;
        }
    }
    
    switch ($auto['schedule_type']) {
        case 'daily':
            return true;
        case 'weekly':
            $scheduledDays = explode(',', $auto['schedule_days'] ?? '1');
            return in_array($currentDay, $scheduledDays);
        case 'monthly':
            return $currentDayOfMonth == ($auto['schedule_day_of_month'] ?? 1);
        case 'interval':
            $interval = intval($auto['schedule_interval_minutes'] ?? 60);
            if ($auto['last_run_at']) {
                $lastRun = new DateTime($auto['last_run_at']);
                $now = new DateTime();
                $diffMinutes = ($now->getTimestamp() - $lastRun->getTimestamp()) / 60;
                return $diffMinutes >= $interval;
            }
            return true;
        default:
            return false;
    }
}

function timeToMinutesCron($time) {
    $parts = explode(':', $time);
    return intval($parts[0]) * 60 + intval($parts[1] ?? 0);
}

function executeAutomationCron($auto, $db) {
    // Récupérer les hôtels actifs
    $hotels = $db->query(
        "SELECT h.* FROM hotels h
         JOIN automation_hotels ah ON ah.hotel_id = h.id
         WHERE ah.automation_id = ? AND ah.is_active = 1",
        [$auto['id']]
    );
    
    if (empty($hotels) && $auto['is_global']) {
        $hotels = $db->query("SELECT * FROM hotels WHERE is_active = 1");
    }
    
    $recipients = $db->query(
        "SELECT * FROM automation_recipients WHERE automation_id = ? AND is_active = 1",
        [$auto['id']]
    );
    
    switch ($auto['code']) {
        case 'dispatch_alert':
            return runDispatchAlertCron($hotels, $recipients, $db);
        case 'control_alert':
            return runControlAlertCron($hotels, $recipients, $db);
        case 'maintenance_alert':
            return runMaintenanceAlertCron($hotels, $recipients, $db);
        case 'leaves_reminder':
            return runLeavesReminderCron($recipients, $db);
        case 'tasks_due':
            return runTasksDueCron($hotels, $recipients, $db);
        case 'audit_reminder':
            return runAuditReminderCron($recipients, $db);
        case 'closure_reminder':
            return runClosureReminderCron($hotels, $recipients, $db);
        case 'revenue_update':
            return ['message' => 'Mise à jour tarifs - utiliser cron.php revenue'];
        case 'system_cleanup':
            return runSystemCleanupCron($db);
        default:
            return ['message' => 'Code inconnu: ' . $auto['code']];
    }
}

function runDispatchAlertCron($hotels, $recipients, $db) {
    $today = date('Y-m-d');
    $alertCount = 0;
    
    foreach ($hotels as $hotel) {
        $dispatched = $db->queryOne(
            "SELECT COUNT(*) as cnt FROM housekeeping_tasks WHERE hotel_id = ? AND DATE(assigned_date) = ?",
            [$hotel['id'], $today]
        );
        
        if (($dispatched['cnt'] ?? 0) == 0) {
            $alertCount++;
            // TODO: Envoyer email
        }
    }
    
    return ['message' => "$alertCount alerte(s) dispatch"];
}

function runControlAlertCron($hotels, $recipients, $db) {
    $today = date('Y-m-d');
    $alertCount = 0;
    
    foreach ($hotels as $hotel) {
        $unchecked = $db->query(
            "SELECT COUNT(*) as cnt FROM housekeeping_tasks 
             WHERE hotel_id = ? AND DATE(assigned_date) = ? AND status = 'done' AND checked_at IS NULL",
            [$hotel['id'], $today]
        );
        
        if (($unchecked[0]['cnt'] ?? 0) > 0) {
            $alertCount++;
        }
    }
    
    return ['message' => "$alertCount hôtel(s) avec chambres non contrôlées"];
}

function runMaintenanceAlertCron($hotels, $recipients, $db) {
    $count = 0;
    
    foreach ($hotels as $hotel) {
        $tickets = $db->query(
            "SELECT COUNT(*) as cnt FROM maintenance_tickets 
             WHERE hotel_id = ? AND status IN ('open', 'in_progress') 
             AND created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)",
            [$hotel['id']]
        );
        $count += $tickets[0]['cnt'] ?? 0;
    }
    
    return ['message' => "$count ticket(s) > 48h"];
}

function runLeavesReminderCron($recipients, $db) {
    $pending = $db->queryOne("SELECT COUNT(*) as cnt FROM leave_requests WHERE status = 'pending'");
    return ['message' => ($pending['cnt'] ?? 0) . " demande(s) en attente"];
}

function runTasksDueCron($hotels, $recipients, $db) {
    $today = date('Y-m-d');
    $count = 0;
    
    foreach ($hotels as $hotel) {
        $tasks = $db->queryOne(
            "SELECT COUNT(*) as cnt FROM tasks t
             JOIN task_boards b ON t.board_id = b.id
             WHERE b.hotel_id = ? AND t.due_date = ? AND t.is_completed = 0",
            [$hotel['id'], $today]
        );
        $count += $tasks['cnt'] ?? 0;
    }
    
    return ['message' => "$count tâche(s) à échéance"];
}

function runAuditReminderCron($recipients, $db) {
    $upcoming = $db->queryOne(
        "SELECT COUNT(*) as cnt FROM audits WHERE status = 'planned' AND planned_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)"
    );
    return ['message' => ($upcoming['cnt'] ?? 0) . " audit(s) à venir"];
}

function runClosureReminderCron($hotels, $recipients, $db) {
    $today = date('Y-m-d');
    $missing = 0;
    
    foreach ($hotels as $hotel) {
        $closure = $db->queryOne(
            "SELECT id FROM daily_closures WHERE hotel_id = ? AND closure_date = ? AND status != 'draft'",
            [$hotel['id'], $today]
        );
        if (!$closure) $missing++;
    }
    
    return ['message' => "$missing hôtel(s) sans clôture"];
}

function runSystemCleanupCron($db) {
    $db->execute("DELETE FROM password_resets WHERE expires_at < NOW()");
    $db->execute("DELETE FROM automation_logs WHERE started_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
    return ['message' => "Nettoyage effectué"];
}
