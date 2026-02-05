/**
 * ACL GESTION - Utilities
 */

// Toast notifications
function toast(message, type = 'info') {
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// Modal
function openModal(title, content, size = '') {
    document.getElementById('modal-title').innerHTML = title;
    document.getElementById('modal-body').innerHTML = content;
    const modalBox = document.querySelector('#modal .modal-box');
    // Reset size classes
    modalBox.classList.remove('modal-wide', 'modal-xl');
    if (size) {
        modalBox.classList.add(size);
    }
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    // Reset modal size
    const modalBox = document.querySelector('#modal .modal-box');
    if (modalBox) {
        modalBox.classList.remove('modal-wide', 'modal-xl');
    }
}

// Formatting
function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR');
}

function formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('fr-FR');
}

function daysSince(date) {
    return Math.floor((new Date() - new Date(date)) / 86400000);
}

function getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

// Escape HTML
function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Labels
const LABELS = {
    status: {
        open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé',
        pending: 'En attente', completed: 'Terminé', controlled: 'Contrôlé',
        approved: 'Approuvé', rejected: 'Refusé', cancelled: 'Annulé',
        active: 'Active', inactive: 'Inactive', 
        hors_service: 'Hors service', renovation: 'En rénovation'
    },
    priority: { critical: 'Critique', high: 'Haute', medium: 'Moyenne', low: 'Basse', urgent: 'Urgent' },
    maintenance_cat: { 
        plomberie: 'Plomberie', electricite: 'Électricité', climatisation: 'Climatisation', 
        mobilier: 'Mobilier', serrurerie: 'Serrurerie', peinture: 'Peinture', 
        nettoyage: 'Nettoyage', autre: 'Autre' 
    },
    cleaning: { blanc: 'À blanc', recouche: 'Recouche' },
    room_type: { standard: 'Standard', superieure: 'Supérieure', suite: 'Suite', familiale: 'Familiale', pmr: 'PMR' },
    role: { 
        admin: 'Administrateur', 
        groupe_manager: 'Resp. Groupe', 
        hotel_manager: 'Resp. Hôtel', 
        comptabilite: 'Comptabilité',
        rh: 'Ressources Humaines',
        receptionniste: 'Réceptionniste',
        employee: 'Employé Hôtel' 
    },
    task_priority: { urgent: 'Urgent', high: 'Haute', medium: 'Moyenne', low: 'Basse' }
};

// Badges
function statusBadge(status) {
    const colors = { open: 'danger', in_progress: 'warning', resolved: 'success', pending: 'gray', completed: 'success', controlled: 'success', approved: 'success', rejected: 'danger', active: 'success', inactive: 'gray' };
    return `<span class="badge badge-${colors[status] || 'gray'}">${LABELS.status[status] || status}</span>`;
}

function priorityBadge(priority) {
    const colors = { critical: 'danger', high: 'warning', medium: 'primary', low: 'success' };
    return `<span class="badge badge-${colors[priority] || 'gray'}">${LABELS.priority[priority] || priority}</span>`;
}

// Loading state
function showLoading(container) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Chargement...</p></div>`;
}

// ===== NOTIFICATIONS =====
let notificationDropdownOpen = false;

async function loadNotifications() {
    try {
        const res = await API.getNotifications();
        const notifications = res.notifications || [];
        const unreadCount = res.unread_count || 0;
        
        const countEl = document.getElementById('notification-count');
        const listEl = document.getElementById('notification-list');
        
        if (countEl) {
            if (unreadCount > 0) {
                countEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
                countEl.classList.remove('hidden');
            } else {
                countEl.classList.add('hidden');
            }
        }
        
        if (listEl) {
            if (notifications.length === 0) {
                listEl.innerHTML = '<div class="notification-empty"><i class="fas fa-bell-slash"></i><p>Aucune notification</p></div>';
            } else {
                listEl.innerHTML = notifications.map(n => `
                    <div class="notification-item ${n.is_read == 0 ? 'unread' : ''}" data-id="${n.id}" onclick="handleNotificationClick(${n.id}, '${n.link || ''}')">
                        <div class="notification-icon ${getNotificationIconClass(n.type)}">
                            <i class="fas ${getNotificationIcon(n.type)}"></i>
                        </div>
                        <div class="notification-content">
                            <div class="notification-title">${esc(n.title)}</div>
                            <div class="notification-message">${esc(n.message || '')}</div>
                            <div class="notification-time">${timeAgo(n.created_at)}</div>
                        </div>
                        <button class="notification-delete" onclick="event.stopPropagation(); deleteNotification(${n.id})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Erreur chargement notifications:', error);
    }
}

function getNotificationIcon(type) {
    const icons = {
        task_assigned: 'fa-tasks',
        task_due: 'fa-clock',
        message: 'fa-envelope',
        maintenance: 'fa-wrench',
        evaluation: 'fa-clipboard-check',
        leave: 'fa-calendar-alt',
        system: 'fa-info-circle'
    };
    return icons[type] || 'fa-bell';
}

function getNotificationIconClass(type) {
    const classes = {
        task_assigned: 'notif-task',
        task_due: 'notif-warning',
        message: 'notif-message',
        maintenance: 'notif-maintenance',
        evaluation: 'notif-evaluation',
        leave: 'notif-leave',
        system: 'notif-system'
    };
    return classes[type] || '';
}

function timeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return Math.floor(diff / 60) + ' min';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h';
    if (diff < 604800) return Math.floor(diff / 86400) + ' j';
    return formatDate(dateStr);
}

function toggleNotifications() {
    const dropdown = document.getElementById('notification-dropdown');
    notificationDropdownOpen = !notificationDropdownOpen;
    
    if (notificationDropdownOpen) {
        dropdown.classList.remove('hidden');
        loadNotifications();
    } else {
        dropdown.classList.add('hidden');
    }
}

// Fermer dropdown si clic ailleurs
document.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.notification-wrapper');
    if (wrapper && !wrapper.contains(e.target) && notificationDropdownOpen) {
        document.getElementById('notification-dropdown').classList.add('hidden');
        notificationDropdownOpen = false;
    }
});

async function handleNotificationClick(notifId, link) {
    try {
        await API.markNotificationRead(notifId);
        loadNotifications();
        
        if (link) {
            document.getElementById('notification-dropdown').classList.add('hidden');
            notificationDropdownOpen = false;
            navigateTo(link);
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        await API.markAllNotificationsRead();
        loadNotifications();
        toast('Toutes les notifications marquées comme lues', 'success');
    } catch (error) {
        toast('Erreur', 'error');
    }
}

async function deleteNotification(notifId) {
    try {
        await API.deleteNotification(notifId);
        loadNotifications();
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function clearAllNotifications() {
    if (!confirm('Effacer toutes les notifications ?')) return;
    try {
        await API.clearAllNotifications();
        loadNotifications();
        toast('Notifications effacées', 'success');
    } catch (error) {
        toast('Erreur', 'error');
    }
}

// =============================================================================
// SYSTÈME DE PERMISSIONS
// =============================================================================

let userPermissions = {};
let permissionsLoaded = false;

/**
 * Charge les permissions de l'utilisateur connecté depuis l'API
 * et les fusionne avec les permissions par défaut
 */
async function loadUserPermissions() {
    if (!API.user) return;
    
    // Admin a toutes les permissions - pas besoin de charger
    if (API.user.role === 'admin') {
        permissionsLoaded = true;
        return;
    }
    
    // Commencer par les permissions par défaut du rôle
    const defaults = getDefaultPermissions(API.user.role);
    userPermissions = { ...defaults };
    
    try {
        const result = await API.getMyPermissions();
        if (result.success && result.permissions) {
            // Les permissions de l'API écrasent les défauts
            // Cela permet à l'admin de modifier les permissions dans les paramètres
            for (const [perm, allowed] of Object.entries(result.permissions)) {
                userPermissions[perm] = allowed === true || allowed === 1;
            }
        }
        permissionsLoaded = true;
        console.log('Permissions chargées pour', API.user.role, ':', userPermissions);
    } catch (error) {
        console.log('Erreur chargement permissions, utilisation des défauts:', error.message);
        permissionsLoaded = true;
    }
}

/**
 * Vérifie si l'utilisateur a une permission spécifique
 * @param {string} permission - La permission à vérifier (ex: 'maintenance.create')
 * @returns {boolean}
 */
function hasPermission(permission) {
    if (!API.user) return false;
    
    // Admin a toutes les permissions
    if (API.user.role === 'admin') return true;
    
    // Vérifier dans les permissions chargées
    if (userPermissions[permission] !== undefined) {
        return userPermissions[permission] === true;
    }
    
    // Si permission non définie, vérifier dans les défauts
    const defaults = getDefaultPermissions(API.user.role);
    return defaults[permission] === true;
}

/**
 * Vérifie plusieurs permissions (toutes doivent être vraies)
 */
function hasAllPermissions(...permissions) {
    return permissions.every(p => hasPermission(p));
}

/**
 * Vérifie si au moins une permission est accordée
 */
function hasAnyPermission(...permissions) {
    return permissions.some(p => hasPermission(p));
}

/**
 * Rafraîchit les permissions (utile après changement dans les paramètres)
 */
async function refreshPermissions() {
    permissionsLoaded = false;
    userPermissions = {};
    await loadUserPermissions();
}

/**
 * Permissions par défaut par rôle
 */
function getDefaultPermissions(role) {
    const defaults = {
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
            'dashboard.view': true, 'dashboard.global': true, 'reports.access': true, 'reports.export': true
        },
        'hotel_manager': {
            'hotels.view': true, 'hotels.create': false, 'hotels.edit': true, 'hotels.delete': false, 'rooms.manage': true,
            'users.view': true, 'users.manage': true,
            'dispatch.view': true, 'dispatch.create': true, 'dispatch.complete': true, 'dispatch.control': true,
            'linen.view': true, 'linen.manage': true, 'linen.config': true,
            'leaves.view': true, 'leaves.create': true, 'leaves.validate': true, 'leaves.manage_all': false,
            'maintenance.view': true, 'maintenance.create': true, 'maintenance.manage': true, 'maintenance.comment': true,
            'tasks.view': true, 'tasks.create': true, 'tasks.manage': true, 'tasks.assign': true,
            'evaluations.view': true, 'evaluations.view_team': true, 'evaluations.grids': false, 'evaluations.evaluate': true, 'evaluations.view_own': true,
            'audit.view': true, 'audit.grids': false, 'audit.execute': true, 'audit.view_results': true,
            'closures.view': true, 'closures.create': true, 'closures.validate': true, 'closures.edit_all': false, 'closures.add_remise': true, 'closures.add_comment': true,
            'messages.access': true, 'messages.broadcast': true, 'notifications.receive': true,
            'dashboard.view': true, 'dashboard.global': true, 'reports.access': true, 'reports.export': true
        },
        'comptabilite': {
            'hotels.view': true, 'hotels.create': false, 'hotels.edit': false, 'hotels.delete': false, 'rooms.manage': false,
            'users.view': false, 'users.manage': false,
            'dispatch.view': true, 'dispatch.create': false, 'dispatch.complete': false, 'dispatch.control': false,
            'linen.view': true, 'linen.manage': false, 'linen.config': false,
            'leaves.view': true, 'leaves.create': true, 'leaves.validate': false, 'leaves.manage_all': false,
            'maintenance.view': true, 'maintenance.create': false, 'maintenance.manage': false, 'maintenance.comment': false,
            'tasks.view': true, 'tasks.create': false, 'tasks.manage': false, 'tasks.assign': false,
            'evaluations.view': false, 'evaluations.view_team': false, 'evaluations.grids': false, 'evaluations.evaluate': false, 'evaluations.view_own': true,
            'audit.view': false, 'audit.grids': false, 'audit.execute': false, 'audit.view_results': false,
            'closures.view': true, 'closures.create': false, 'closures.validate': true, 'closures.edit_all': true, 'closures.add_remise': false, 'closures.add_comment': true,
            'messages.access': true, 'messages.broadcast': false, 'notifications.receive': true,
            'dashboard.view': true, 'dashboard.global': true, 'reports.access': true, 'reports.export': true
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
            'dashboard.view': true, 'dashboard.global': false, 'reports.access': true, 'reports.export': true
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
            'dashboard.view': true, 'dashboard.global': false, 'reports.access': false, 'reports.export': false
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
            'dashboard.view': true, 'dashboard.global': false, 'reports.access': false, 'reports.export': false
        }
    };
    
    return defaults[role] || defaults['employee'];
}
