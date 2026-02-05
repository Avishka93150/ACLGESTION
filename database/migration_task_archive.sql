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
