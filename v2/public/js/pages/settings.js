/**
 * Settings Page - Gestion des permissions et modules (Admin only)
 */

// Définition des modules du système
const SYSTEM_MODULES = {
    'dashboard': { name: 'Dashboard', icon: 'fa-th-large', description: 'Tableau de bord et statistiques', core: true },
    'hotels': { name: 'Hôtels', icon: 'fa-building', description: 'Gestion des établissements et chambres', core: true },
    'housekeeping': { name: 'Gouvernante', icon: 'fa-broom', description: 'Dispatch et contrôle des chambres' },
    'maintenance': { name: 'Maintenance', icon: 'fa-wrench', description: 'Tickets et suivi des interventions' },
    'tasks': { name: 'Tâches', icon: 'fa-tasks', description: 'Tableaux Kanban et gestion des tâches' },
    'evaluations': { name: 'Évaluations', icon: 'fa-clipboard-check', description: 'Grilles d\'évaluation du personnel' },
    'audit': { name: 'Audits', icon: 'fa-search', description: 'Audits qualité et conformité des hôtels' },
    'linen': { name: 'Blanchisserie', icon: 'fa-tshirt', description: 'Gestion du linge et collectes' },
    'leaves': { name: 'Congés', icon: 'fa-calendar-alt', description: 'Demandes et validation des congés' },
    'closures': { name: 'Clôtures & Remises', icon: 'fa-cash-register', description: 'Clôtures journalières et suivi caisse' },
    'messages': { name: 'Messagerie', icon: 'fa-envelope', description: 'Communication interne' },
    'users': { name: 'Utilisateurs', icon: 'fa-users', description: 'Gestion des comptes utilisateurs', core: true },
    'settings': { name: 'Paramètres', icon: 'fa-cog', description: 'Configuration du système', core: true, adminOnly: true }
};

const PERMISSION_LABELS = {
    // Hôtels & Chambres
    'hotels.view': 'Voir les hôtels',
    'hotels.create': 'Créer un hôtel',
    'hotels.edit': 'Modifier un hôtel',
    'hotels.delete': 'Supprimer un hôtel',
    'rooms.manage': 'Gérer les chambres',
    
    // Utilisateurs
    'users.view': 'Voir les utilisateurs',
    'users.manage': 'Gérer les utilisateurs',
    
    // Gouvernante / Dispatch
    'dispatch.view': 'Voir le dispatch',
    'dispatch.create': 'Créer dispatch chambres',
    'dispatch.complete': 'Marquer chambre nettoyée',
    'dispatch.control': 'Contrôle qualité',
    
    // Blanchisserie
    'linen.view': 'Voir la blanchisserie',
    'linen.manage': 'Saisir collecte/réception',
    'linen.config': 'Configurer blanchisserie',
    
    // Congés
    'leaves.view': 'Voir les congés',
    'leaves.create': 'Créer demande congés',
    'leaves.validate': 'Valider/Refuser congés',
    'leaves.manage_all': 'Gérer tous les congés',
    
    // Maintenance
    'maintenance.view': 'Voir la maintenance',
    'maintenance.create': 'Créer ticket maintenance',
    'maintenance.manage': 'Gérer les tickets',
    'maintenance.comment': 'Commenter les tickets',
    
    // Tâches (Kanban)
    'tasks.view': 'Voir les tableaux tâches',
    'tasks.create': 'Créer tableaux/tâches',
    'tasks.manage': 'Gérer les tâches',
    'tasks.assign': 'Assigner des tâches',
    
    // Évaluations
    'evaluations.view': 'Accès module évaluations',
    'evaluations.view_team': 'Voir évaluations équipe',
    'evaluations.grids': 'Gérer les grilles',
    'evaluations.evaluate': 'Réaliser évaluations',
    'evaluations.view_own': 'Voir ses évaluations',
    
    // Audits
    'audit.view': 'Voir les audits',
    'audit.grids': 'Gérer les grilles d\'audit',
    'audit.execute': 'Réaliser des audits',
    'audit.view_results': 'Voir résultats audits',
    
    // Revenue Management
    'revenue.view': 'Voir veille tarifaire',
    'revenue.settings': 'Configurer concurrents',
    'revenue.fetch_rates': 'Actualiser tarifs',
    
    // Clôtures & Remises
    'closures.view': 'Voir le suivi caisse',
    'closures.create': 'Créer clôtures journalières',
    'closures.validate': 'Valider les clôtures',
    'closures.edit_all': 'Modifier toutes les données',
    'closures.add_remise': 'Ajouter remise banque',
    'closures.add_comment': 'Ajouter commentaires',
    
    // Messagerie
    'messages.access': 'Accès messagerie',
    'messages.broadcast': 'Envoyer à tous',
    
    // Notifications
    'notifications.receive': 'Recevoir notifications',
    
    // Dashboard & Rapports
    'dashboard.view': 'Voir dashboard',
    'dashboard.global': 'Dashboard multi-hôtels',
    'reports.access': 'Accès aux rapports',
    'reports.export': 'Exporter les données',
    
    // Administration
    'permissions.manage': 'Gérer les permissions'
};

const PERMISSION_CATEGORIES = {
    'Hôtels & Chambres': ['hotels.view', 'hotels.create', 'hotels.edit', 'hotels.delete', 'rooms.manage'],
    'Utilisateurs': ['users.view', 'users.manage'],
    'Gouvernante': ['dispatch.view', 'dispatch.create', 'dispatch.complete', 'dispatch.control'],
    'Blanchisserie': ['linen.view', 'linen.manage', 'linen.config'],
    'Congés': ['leaves.view', 'leaves.create', 'leaves.validate', 'leaves.manage_all'],
    'Maintenance': ['maintenance.view', 'maintenance.create', 'maintenance.manage', 'maintenance.comment'],
    'Tâches (Kanban)': ['tasks.view', 'tasks.create', 'tasks.manage', 'tasks.assign'],
    'Évaluations': ['evaluations.view', 'evaluations.view_team', 'evaluations.grids', 'evaluations.evaluate', 'evaluations.view_own'],
    'Audits': ['audit.view', 'audit.grids', 'audit.execute', 'audit.view_results'],
    'Revenue Management': ['revenue.view', 'revenue.settings', 'revenue.fetch_rates'],
    'Clôtures & Caisse': ['closures.view', 'closures.create', 'closures.validate', 'closures.edit_all', 'closures.add_remise', 'closures.add_comment'],
    'Communication': ['messages.access', 'messages.broadcast', 'notifications.receive'],
    'Dashboard & Rapports': ['dashboard.view', 'dashboard.global', 'reports.access', 'reports.export'],
    'Administration': ['permissions.manage']
};

const ROLE_LABELS = {
    'admin': 'Administrateur',
    'groupe_manager': 'Resp. Groupe',
    'hotel_manager': 'Resp. Hôtel',
    'comptabilite': 'Comptabilité',
    'rh': 'Ressources Humaines',
    'receptionniste': 'Réceptionniste',
    'employee': 'Employé'
};

const ROLE_DESCRIPTIONS = {
    'admin': 'Accès complet à toutes les fonctionnalités du système',
    'groupe_manager': 'Supervise plusieurs hôtels, valide congés, gère le personnel',
    'hotel_manager': 'Gère un hôtel : dispatch, contrôle, maintenance, équipe',
    'comptabilite': 'Accès rapports financiers, exports, suivi caisse complet',
    'rh': 'Gestion RH : congés, évaluations, suivi du personnel',
    'receptionniste': 'Réception : clôtures, gouvernante, maintenance, blanchisserie, tâches, audits',
    'employee': 'Accès limité : ses tâches, congés, maintenance, messagerie'
};

const ROLE_ICONS = {
    'admin': 'fa-crown',
    'groupe_manager': 'fa-building',
    'hotel_manager': 'fa-hotel',
    'comptabilite': 'fa-calculator',
    'rh': 'fa-users-cog',
    'receptionniste': 'fa-concierge-bell',
    'employee': 'fa-user'
};

// Permissions par défaut pour chaque rôle
const DEFAULT_PERMISSIONS = {
    'groupe_manager': {
        'hotels.view': true, 'hotels.create': false, 'hotels.edit': true, 'hotels.delete': false, 'rooms.manage': true,
        'users.view': true, 'users.manage': true,
        'dispatch.view': true, 'dispatch.create': true, 'dispatch.complete': true, 'dispatch.control': true,
        'linen.view': true, 'linen.manage': true, 'linen.config': true,
        'leaves.view': true, 'leaves.create': true, 'leaves.validate': true, 'leaves.manage_all': true,
        'maintenance.view': true, 'maintenance.create': true, 'maintenance.manage': true, 'maintenance.comment': true,
        'tasks.view': true, 'tasks.create': true, 'tasks.manage': true, 'tasks.assign': true,
        'evaluations.view': true, 'evaluations.view_team': true, 'evaluations.grids': true, 'evaluations.evaluate': true, 'evaluations.view_own': true,
        'audit.view': true, 'audit.grids': true, 'audit.execute': true, 'audit.view_results': true,
        'closures.view': true, 'closures.create': true, 'closures.validate': true, 'closures.edit_all': true, 'closures.add_remise': true, 'closures.add_comment': true,
        'messages.access': true, 'messages.broadcast': true, 'notifications.receive': true,
        'dashboard.view': true, 'dashboard.global': true, 'reports.access': true, 'reports.export': true,
        'permissions.manage': false
    },
    'hotel_manager': {
        'hotels.view': true, 'hotels.create': false, 'hotels.edit': true, 'hotels.delete': false, 'rooms.manage': true,
        'users.view': true, 'users.manage': true,
        'dispatch.view': true, 'dispatch.create': true, 'dispatch.complete': true, 'dispatch.control': true,
        'linen.view': true, 'linen.manage': true, 'linen.config': false,
        'leaves.view': true, 'leaves.create': true, 'leaves.validate': true, 'leaves.manage_all': false,
        'maintenance.view': true, 'maintenance.create': true, 'maintenance.manage': true, 'maintenance.comment': true,
        'tasks.view': true, 'tasks.create': true, 'tasks.manage': true, 'tasks.assign': true,
        'evaluations.view': true, 'evaluations.view_team': true, 'evaluations.grids': false, 'evaluations.evaluate': true, 'evaluations.view_own': true,
        'audit.view': true, 'audit.grids': false, 'audit.execute': true, 'audit.view_results': true,
        'closures.view': true, 'closures.create': true, 'closures.validate': false, 'closures.edit_all': false, 'closures.add_remise': true, 'closures.add_comment': true,
        'messages.access': true, 'messages.broadcast': false, 'notifications.receive': true,
        'dashboard.view': true, 'dashboard.global': false, 'reports.access': true, 'reports.export': true,
        'permissions.manage': false
    },
    'comptabilite': {
        'hotels.view': true, 'hotels.create': false, 'hotels.edit': false, 'hotels.delete': false, 'rooms.manage': false,
        'users.view': true, 'users.manage': false,
        'dispatch.view': true, 'dispatch.create': false, 'dispatch.complete': false, 'dispatch.control': false,
        'linen.view': true, 'linen.manage': true, 'linen.config': false,
        'leaves.view': true, 'leaves.create': true, 'leaves.validate': false, 'leaves.manage_all': false,
        'maintenance.view': true, 'maintenance.create': false, 'maintenance.manage': false, 'maintenance.comment': false,
        'tasks.view': true, 'tasks.create': false, 'tasks.manage': false, 'tasks.assign': false,
        'evaluations.view': false, 'evaluations.view_team': false, 'evaluations.grids': false, 'evaluations.evaluate': false, 'evaluations.view_own': true,
        'audit.view': true, 'audit.grids': false, 'audit.execute': false, 'audit.view_results': true,
        'closures.view': true, 'closures.create': false, 'closures.validate': true, 'closures.edit_all': true, 'closures.add_remise': true, 'closures.add_comment': true,
        'messages.access': true, 'messages.broadcast': false, 'notifications.receive': true,
        'dashboard.view': true, 'dashboard.global': true, 'reports.access': true, 'reports.export': true,
        'permissions.manage': false
    },
    'rh': {
        'hotels.view': true, 'hotels.create': false, 'hotels.edit': false, 'hotels.delete': false, 'rooms.manage': false,
        'users.view': true, 'users.manage': true,
        'dispatch.view': false, 'dispatch.create': false, 'dispatch.complete': false, 'dispatch.control': false,
        'linen.view': false, 'linen.manage': false, 'linen.config': false,
        'leaves.view': true, 'leaves.create': true, 'leaves.validate': true, 'leaves.manage_all': true,
        'maintenance.view': false, 'maintenance.create': false, 'maintenance.manage': false, 'maintenance.comment': false,
        'tasks.view': true, 'tasks.create': true, 'tasks.manage': true, 'tasks.assign': true,
        'evaluations.view': true, 'evaluations.view_team': true, 'evaluations.grids': true, 'evaluations.evaluate': true, 'evaluations.view_own': true,
        'audit.view': false, 'audit.grids': false, 'audit.execute': false, 'audit.view_results': false,
        'closures.view': false, 'closures.create': false, 'closures.validate': false, 'closures.edit_all': false, 'closures.add_remise': false, 'closures.add_comment': false,
        'messages.access': true, 'messages.broadcast': true, 'notifications.receive': true,
        'dashboard.view': true, 'dashboard.global': true, 'reports.access': true, 'reports.export': true,
        'permissions.manage': false
    },
    'receptionniste': {
        'hotels.view': true, 'hotels.create': false, 'hotels.edit': false, 'hotels.delete': false, 'rooms.manage': false,
        'users.view': false, 'users.manage': false,
        'dispatch.view': true, 'dispatch.create': true, 'dispatch.complete': true, 'dispatch.control': true,
        'linen.view': true, 'linen.manage': true, 'linen.config': false,
        'leaves.view': true, 'leaves.create': true, 'leaves.validate': false, 'leaves.manage_all': false,
        'maintenance.view': true, 'maintenance.create': true, 'maintenance.manage': false, 'maintenance.comment': true,
        'tasks.view': true, 'tasks.create': true, 'tasks.manage': false, 'tasks.assign': false,
        'evaluations.view': false, 'evaluations.view_team': false, 'evaluations.grids': false, 'evaluations.evaluate': false, 'evaluations.view_own': true,
        'audit.view': true, 'audit.grids': false, 'audit.execute': true, 'audit.view_results': true,
        'closures.view': true, 'closures.create': true, 'closures.validate': false, 'closures.edit_all': false, 'closures.add_remise': true, 'closures.add_comment': true,
        'messages.access': true, 'messages.broadcast': false, 'notifications.receive': true,
        'dashboard.view': true, 'dashboard.global': false, 'reports.access': false, 'reports.export': false,
        'permissions.manage': false
    },
    'employee': {
        'hotels.view': true, 'hotels.create': false, 'hotels.edit': false, 'hotels.delete': false, 'rooms.manage': false,
        'users.view': false, 'users.manage': false,
        'dispatch.view': true, 'dispatch.create': false, 'dispatch.complete': true, 'dispatch.control': false,
        'linen.view': true, 'linen.manage': true, 'linen.config': false,
        'leaves.view': true, 'leaves.create': true, 'leaves.validate': false, 'leaves.manage_all': false,
        'maintenance.view': true, 'maintenance.create': true, 'maintenance.manage': false, 'maintenance.comment': true,
        'tasks.view': true, 'tasks.create': false, 'tasks.manage': false, 'tasks.assign': false,
        'evaluations.view': false, 'evaluations.view_team': false, 'evaluations.grids': false, 'evaluations.evaluate': false, 'evaluations.view_own': true,
        'audit.view': false, 'audit.grids': false, 'audit.execute': false, 'audit.view_results': false,
        'closures.view': true, 'closures.create': false, 'closures.validate': false, 'closures.edit_all': false, 'closures.add_remise': false, 'closures.add_comment': false,
        'messages.access': true, 'messages.broadcast': false, 'notifications.receive': true,
        'dashboard.view': true, 'dashboard.global': false, 'reports.access': false, 'reports.export': false,
        'permissions.manage': false
    }
};

let currentPermissions = {};
let currentModules = {};

async function loadSettings(container) {
    if (API.user.role !== 'admin') {
        container.innerHTML = '<div class="card"><p class="text-danger">Accès réservé aux administrateurs</p></div>';
        return;
    }
    
    showLoading(container);

    try {
        const [permResult, modulesResult] = await Promise.all([
            API.getAllPermissions(),
            API.getModulesConfig()
        ]);
        
        currentPermissions = permResult.permissions || {};
        currentModules = modulesResult.modules || {};
        
        // Log pour debug
        console.log('Loaded modules from API:', modulesResult);
        console.log('currentModules:', currentModules);
        
        // Initialiser modules par défaut (tous actifs) SEULEMENT si undefined
        for (const moduleId of Object.keys(SYSTEM_MODULES)) {
            if (currentModules[moduleId] === undefined) {
                currentModules[moduleId] = true;
            }
        }
        
        console.log('currentModules after init:', currentModules);
        
        // Initialiser permissions par défaut
        for (const role of Object.keys(DEFAULT_PERMISSIONS)) {
            if (!currentPermissions[role]) {
                currentPermissions[role] = { ...DEFAULT_PERMISSIONS[role] };
            }
        }

        container.innerHTML = `
            <!-- Section Modules -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-puzzle-piece"></i> Modules du système</h3>
                </div>
                <p class="text-muted mb-20">
                    Activez ou désactivez les modules selon vos besoins. Les modules désactivés disparaîtront du menu pour tous les utilisateurs.
                    <br><span class="text-warning"><i class="fas fa-lock"></i> Les modules essentiels (Dashboard, Hôtels, Utilisateurs, Paramètres) ne peuvent pas être désactivés.</span>
                </p>
                
                <div class="modules-grid">
                    ${renderModulesGrid()}
                </div>
                
                <div class="mt-20">
                    <button class="btn btn-primary" onclick="saveModulesConfig()">
                        <i class="fas fa-save"></i> Enregistrer la configuration des modules
                    </button>
                </div>
            </div>
            
            <!-- Section Rôles -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-user-tag"></i> Rôles du système</h3>
                </div>
                <div class="roles-grid">
                    ${Object.entries(ROLE_LABELS).map(([role, label]) => `
                        <div class="role-card ${role === 'admin' ? 'role-admin' : ''}">
                            <div class="role-icon"><i class="fas ${ROLE_ICONS[role]}"></i></div>
                            <div class="role-info">
                                <h4>${label}</h4>
                                <p>${ROLE_DESCRIPTIONS[role] || ''}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Section Permissions -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-shield-alt"></i> Matrice des permissions</h3>
                </div>
                <p class="text-muted mb-20">
                    Configurez les permissions pour chaque rôle. Cochez/décochez pour activer/désactiver une permission.
                    <br><strong>Note:</strong> L'administrateur a toujours toutes les permissions.
                </p>
                
                <div class="permissions-grid">
                    ${renderPermissionsTable()}
                </div>
                
                <div class="mt-20" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="saveAllPermissions()">
                        <i class="fas fa-save"></i> Enregistrer les permissions
                    </button>
                    <button class="btn btn-outline" onclick="resetToDefaults()">
                        <i class="fas fa-undo"></i> Réinitialiser par défaut
                    </button>
                </div>
            </div>
            
            <!-- Section Légende -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-info-circle"></i> Légende des permissions</h3>
                </div>
                <div class="permissions-legend">
                    ${Object.entries(PERMISSION_CATEGORIES).map(([cat, perms]) => `
                        <div class="legend-category">
                            <h4><i class="fas ${getCategoryIcon(cat)}"></i> ${cat}</h4>
                            <ul>
                                ${perms.map(p => `<li><code>${p}</code> - ${PERMISSION_LABELS[p]}</li>`).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function renderModulesGrid() {
    return Object.entries(SYSTEM_MODULES).map(([moduleId, module]) => {
        // Vérifier si le module est actif (true par défaut si non défini)
        const moduleValue = currentModules[moduleId];
        const isActive = moduleValue === true || moduleValue === undefined || moduleValue === 'true';
        const isInactive = moduleValue === false || moduleValue === 'false';
        const isCore = module.core === true;
        
        return `
            <div class="module-card ${isInactive ? 'inactive' : 'active'} ${isCore ? 'core' : ''}">
                <div class="module-toggle">
                    <label class="switch">
                        <input type="checkbox" 
                            ${!isInactive ? 'checked' : ''} 
                            ${isCore ? 'disabled' : ''}
                            onchange="toggleModule('${moduleId}', this.checked)"
                            id="module-${moduleId}">
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="module-icon">
                    <i class="fas ${module.icon}"></i>
                </div>
                <div class="module-info">
                    <h4>${module.name} ${isCore ? '<span class="badge badge-gray">Essentiel</span>' : ''}</h4>
                    <p>${module.description}</p>
                </div>
                <div class="module-status">
                    ${!isInactive ? '<span class="status-active"><i class="fas fa-check-circle"></i> Actif</span>' : '<span class="status-inactive"><i class="fas fa-times-circle"></i> Inactif</span>'}
                </div>
            </div>
        `;
    }).join('');
}

function toggleModule(moduleId, enabled) {
    currentModules[moduleId] = enabled;
    
    // Mettre à jour visuellement la carte
    const card = document.querySelector(`#module-${moduleId}`).closest('.module-card');
    if (enabled) {
        card.classList.remove('inactive');
        card.classList.add('active');
        card.querySelector('.module-status').innerHTML = '<span class="status-active"><i class="fas fa-check-circle"></i> Actif</span>';
    } else {
        card.classList.remove('active');
        card.classList.add('inactive');
        card.querySelector('.module-status').innerHTML = '<span class="status-inactive"><i class="fas fa-times-circle"></i> Inactif</span>';
    }
}

async function saveModulesConfig() {
    try {
        // Log pour debug
        console.log('Saving modules config:', JSON.stringify(currentModules));
        
        const result = await API.saveModulesConfig(currentModules);
        console.log('Save result:', result);
        
        if (result.saved) {
            console.log('Server confirmed saved:', result.saved);
        }
        
        toast('Configuration des modules enregistrée', 'success');
        
        // Synchroniser avec la variable globale de app.js
        if (typeof enabledModules !== 'undefined') {
            for (const key in currentModules) {
                enabledModules[key] = currentModules[key];
            }
        }
        
        // Mettre à jour le menu immédiatement
        updateSidebarModulesFromSettings();
    } catch (error) {
        console.error('Error saving modules:', error);
        toast('Erreur: ' + error.message, 'error');
    }
}

// Fonction locale pour mettre à jour la sidebar depuis settings
function updateSidebarModulesFromSettings() {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        const page = item.dataset.page;
        if (page) {
            const isDisabled = currentModules[page] === false || currentModules[page] === 'false';
            item.style.display = isDisabled ? 'none' : '';
        }
    });
}

function getCategoryIcon(cat) {
    const icons = {
        'Hôtels & Chambres': 'fa-building',
        'Utilisateurs': 'fa-users',
        'Gouvernante': 'fa-broom',
        'Blanchisserie': 'fa-tshirt',
        'Congés': 'fa-calendar-alt',
        'Maintenance': 'fa-wrench',
        'Tâches (Kanban)': 'fa-tasks',
        'Évaluations': 'fa-clipboard-check',
        'Audits': 'fa-search',
        'Communication': 'fa-envelope',
        'Dashboard & Rapports': 'fa-chart-bar',
        'Administration': 'fa-cog'
    };
    return icons[cat] || 'fa-circle';
}

function renderPermissionsTable() {
    const roles = ['groupe_manager', 'hotel_manager', 'comptabilite', 'rh', 'receptionniste', 'employee'];
    
    let rows = '';
    for (const [category, perms] of Object.entries(PERMISSION_CATEGORIES)) {
        rows += `<tr class="category-row"><td colspan="${roles.length + 2}"><i class="fas ${getCategoryIcon(category)}"></i> <strong>${category}</strong></td></tr>`;
        for (const perm of perms) {
            rows += `
                <tr>
                    <td class="perm-label">${PERMISSION_LABELS[perm]}</td>
                    <td class="text-center">
                        <input type="checkbox" checked disabled title="Admin a toujours cette permission">
                    </td>
                    ${roles.map(role => {
                        const checked = currentPermissions[role] && currentPermissions[role][perm];
                        const isProtected = perm === 'permissions.manage';
                        return `
                            <td class="text-center">
                                <input type="checkbox" 
                                    ${checked ? 'checked' : ''} 
                                    ${isProtected ? 'disabled title="Réservé à l\'admin"' : ''}
                                    onchange="togglePermission('${role}', '${perm}', this.checked)"
                                    id="perm-${role}-${perm.replace(/\./g, '-')}"
                                >
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        }
    }
    
    return `
        <div class="table-responsive">
            <table class="permissions-table">
                <thead>
                    <tr>
                        <th style="min-width:200px">Permission</th>
                        <th class="text-center" style="min-width:80px">
                            <div class="role-header role-admin-header">
                                <i class="fas fa-crown"></i><br>Admin
                            </div>
                        </th>
                        ${roles.map(r => `
                            <th class="text-center" style="min-width:80px">
                                <div class="role-header">
                                    <i class="fas ${ROLE_ICONS[r]}"></i><br><small>${ROLE_LABELS[r]}</small>
                                </div>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function togglePermission(role, permission, allowed) {
    if (!currentPermissions[role]) {
        currentPermissions[role] = {};
    }
    currentPermissions[role][permission] = allowed;
}

async function saveAllPermissions() {
    const roles = ['groupe_manager', 'hotel_manager', 'comptabilite', 'rh', 'receptionniste', 'employee'];
    
    try {
        for (const role of roles) {
            if (currentPermissions[role]) {
                await API.updateRolePermissions(role, currentPermissions[role]);
            }
        }
        toast('Permissions enregistrées avec succès', 'success');
    } catch (error) {
        toast('Erreur: ' + error.message, 'error');
    }
}

async function resetToDefaults() {
    if (!confirm('Réinitialiser toutes les permissions aux valeurs par défaut ?\n\nCette action va écraser vos modifications actuelles.')) return;
    
    try {
        for (const [role, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
            await API.updateRolePermissions(role, perms);
        }
        toast('Permissions réinitialisées', 'success');
        loadSettings(document.getElementById('page-content'));
    } catch (error) {
        toast('Erreur: ' + error.message, 'error');
    }
}
