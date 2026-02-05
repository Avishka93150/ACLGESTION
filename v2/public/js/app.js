/**
 * ACL GESTION v2 - Main Application
 * For app.acl-gestion.com
 */

let currentPage = 'dashboard';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (API.token && API.user) {
        showApp();
    } else {
        showLogin();
    }
    setupEvents();
});

// Show forgot password
function showForgotPassword() {
    toast('Contactez votre administrateur pour reinitialiser votre mot de passe.', 'info');
}

// Event listeners
function setupEvents() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        const handleNavClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const page = item.dataset.page;
            if (page) {
                navigateTo(page);
                setTimeout(() => closeSidebar(), 50);
            }
        };
        item.addEventListener('click', handleNavClick);
    });

    // Sidebar overlay
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
        overlay.addEventListener('touchend', (e) => {
            e.preventDefault();
            closeSidebar();
        });
    }

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// Login handler
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion...';

    try {
        const result = await API.login(email, password);

        if (result.success && result.token && result.user) {
            API.setAuth(result.token, result.user);
            toast('Connexion reussie', 'success');

            if (result.user.needs_gdpr_consent) {
                document.getElementById('login-page').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                showConsentModal();
            } else {
                showApp();
            }
        } else {
            toast(result.message || 'Erreur de connexion', 'error');
        }
    } catch (error) {
        toast(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Se connecter <i class="fas fa-arrow-right"></i>';
    }
}

// Logout
function logout() {
    API.clearAuth();
    document.getElementById('footer-legal').style.display = 'none';
    showLogin();
    toast('Deconnexion', 'info');
}

// Show login page
function showLogin() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

// Show app
async function showApp() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('footer-legal').style.display = 'block';

    // Update user info
    document.getElementById('user-name').textContent = `${API.user.first_name} ${API.user.last_name}`;
    document.getElementById('user-role').textContent = LABELS.role[API.user.role] || API.user.role;

    // Load user permissions
    await loadUserPermissions();
    updateMenuByPermissions();

    // Hide header buttons based on role
    document.querySelectorAll('.header-actions [data-roles]').forEach(item => {
        const roles = item.dataset.roles.split(',');
        if (!roles.includes(API.user.role)) {
            item.style.display = 'none';
        }
    });

    // Load modules config
    await loadModulesConfig();

    // Load notifications
    loadNotifications();

    // Start polling
    startPolling();

    // Initialize chatbot
    if (typeof initChatbot === 'function') {
        initChatbot();
    }

    navigateTo('dashboard');
}

// Update menu by permissions
function updateMenuByPermissions() {
    const pagePermissions = {
        'housekeeping': 'dispatch.view',
        'maintenance': 'maintenance.view',
        'linen': 'linen.view',
        'tasks': 'tasks.view',
        'leaves': 'leaves.view',
        'evaluations': 'evaluations.view',
        'audit': 'audit.view',
        'closures': 'closures.view',
        'users': 'users.view',
        'hotels': 'hotels.view'
    };

    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        const page = item.dataset.page;
        const requiredPermission = pagePermissions[page];

        if (requiredPermission && !hasPermission(requiredPermission)) {
            item.style.display = 'none';
        }
    });
}

// Load modules config
let enabledModules = {};

async function loadModulesConfig() {
    try {
        const result = await API.getModulesConfig();
        enabledModules = result.modules || {};
        updateSidebarModules();
    } catch (error) {
        enabledModules = {};
    }
}

function updateSidebarModules() {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        const page = item.dataset.page;
        if (page && (enabledModules[page] === false || enabledModules[page] === 'false')) {
            item.style.display = 'none';
        }
    });
}

// Navigation
function navigateTo(page) {
    const pagePermissions = {
        'housekeeping': 'dispatch.view',
        'maintenance': 'maintenance.view',
        'linen': 'linen.view',
        'tasks': 'tasks.view',
        'leaves': 'leaves.view',
        'evaluations': 'evaluations.view',
        'audit': 'audit.view',
        'closures': 'closures.view',
        'users': 'users.view',
        'hotels': 'hotels.view',
        'settings': 'permissions.manage'
    };

    const requiredPerm = pagePermissions[page];
    if (requiredPerm && !hasPermission(requiredPerm)) {
        toast('Vous n\'avez pas acces a ce module', 'error');
        if (page !== 'dashboard') {
            navigateTo('dashboard');
        }
        return;
    }

    currentPage = page;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update title
    const titles = {
        dashboard: 'Dashboard',
        hotels: 'Gestion des Hotels',
        housekeeping: 'Module Gouvernante',
        maintenance: 'Maintenance',
        tasks: 'Gestion des Taches',
        evaluations: 'Evaluations',
        linen: 'Gestion du Linge',
        leaves: 'Gestion des Conges',
        audit: 'Audits',
        closures: 'Clotures & Remises',
        rgpd: 'RGPD',
        messages: 'Messagerie',
        users: 'Utilisateurs',
        settings: 'Parametres'
    };
    document.getElementById('page-title').textContent = titles[page] || page;

    loadPage(page);
}

function loadPage(page) {
    const container = document.getElementById('page-content');
    switch(page) {
        case 'dashboard': loadDashboard(container); break;
        case 'hotels': loadHotels(container); break;
        case 'revenue': loadRevenue(container); break;
        case 'housekeeping': loadHousekeeping(container); break;
        case 'maintenance': loadMaintenance(container); break;
        case 'tasks': loadTasks(container); break;
        case 'evaluations': loadEvaluations(container); break;
        case 'linen': loadLinen(container); break;
        case 'leaves': loadLeaves(container); break;
        case 'audit': loadAudit(container); break;
        case 'closures': loadClosures(container); break;
        case 'my-data': loadMyData(container); break;
        case 'rgpd-admin': loadRgpdAdmin(container); break;
        case 'messages': loadMessages(container); break;
        case 'users': loadUsers(container); break;
        case 'settings': loadSettings(container); break;
        default: container.innerHTML = '<div class="card"><p>Page non trouvee</p></div>';
    }
}

function refreshPage() {
    loadPage(currentPage);
    toast('Actualise', 'info');
}

// Mobile sidebar functions
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen = sidebar.classList.contains('open');

    if (isOpen) {
        closeSidebar();
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Maintenance badge
async function updateMaintenanceBadge() {
    try {
        const result = await API.getMaintenanceStats();
        if (result.success) {
            const count = result.stats.open + result.stats.in_progress;
            const badge = document.getElementById('maintenance-badge');
            if (badge) badge.textContent = count || '';
        }
    } catch (e) {}
}

// Messages badge
let lastUnreadCount = 0;

async function updateMessagesBadge() {
    try {
        const result = await API.getUnreadCount();
        if (result.success) {
            const count = result.count || 0;
            const badge = document.getElementById('messages-badge');
            if (badge) {
                badge.textContent = count || '';

                if (count > lastUnreadCount && lastUnreadCount >= 0) {
                    badge.classList.add('badge-pulse');

                    if (currentPage !== 'messages' && count > lastUnreadCount) {
                        showNewMessageNotification(count - lastUnreadCount);
                    }

                    setTimeout(() => badge.classList.remove('badge-pulse'), 2000);
                }

                lastUnreadCount = count;
            }
        }
    } catch (e) {}
}

function showNewMessageNotification(newCount) {
    toast(`${newCount} nouveau${newCount > 1 ? 'x' : ''} message${newCount > 1 ? 's' : ''}`, 'info');

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('ACL GESTION - Nouveau message', {
            body: `Vous avez ${newCount} nouveau${newCount > 1 ? 'x' : ''} message${newCount > 1 ? 's' : ''}`,
            icon: '/favicon.ico'
        });
    }
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// Polling
let pollingInterval = null;

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);

    updateMaintenanceBadge();
    updateMessagesBadge();

    pollingInterval = setInterval(() => {
        if (API.token) {
            updateMaintenanceBadge();
            updateMessagesBadge();
            loadNotifications();
        }
    }, 30000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// Request notification permission
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', requestNotificationPermission, { once: true });
});

// Profile Modal
function showProfileModal() {
    const user = API.user;
    openModal('Mon profil', `
        <form onsubmit="updateProfile(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Prenom</label>
                    <input type="text" value="${esc(user.first_name)}" disabled>
                </div>
                <div class="form-group">
                    <label>Nom</label>
                    <input type="text" value="${esc(user.last_name)}" disabled>
                </div>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" name="email" value="${esc(user.email)}" required>
            </div>
            <div class="form-group">
                <label>Telephone</label>
                <input type="tel" name="phone" value="${esc(user.phone || '')}" placeholder="06 12 34 56 78">
            </div>
            <div class="form-group">
                <label>Nouveau mot de passe</label>
                <input type="password" name="password" placeholder="Laisser vide pour ne pas changer" minlength="6">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
        </form>
    `);
}

async function updateProfile(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (!data.password) delete data.password;

    try {
        const result = await API.updateProfile(data);
        if (result.user) {
            API.user = result.user;
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(result.user));
            document.getElementById('user-name').textContent = `${result.user.first_name} ${result.user.last_name}`;
        }
        toast('Profil mis a jour', 'success');
        closeModal();
    } catch (error) {
        toast(error.message, 'error');
    }
}

// Legal modals
function showLegalNotice() {
    openModal('Mentions legales', `
        <div class="legal-content">
            <h4>Editeur du site</h4>
            <p>ACL GESTION<br>Paris, France<br>Email : contact@acl-gestion.com</p>
            <h4>Hebergement</h4>
            <p>OVH SAS<br>2 rue Kellermann<br>59100 Roubaix - France</p>
            <h4>Propriete intellectuelle</h4>
            <p>L'ensemble du contenu de ce site est protege par le droit d'auteur.</p>
        </div>
    `);
}

function showPrivacyPolicy() {
    openModal('Politique de confidentialite', `
        <div class="legal-content">
            <h4>Collecte des donnees</h4>
            <p>Nous collectons uniquement les donnees necessaires au fonctionnement du service.</p>
            <h4>Vos droits</h4>
            <p>Conformement au RGPD, vous disposez d'un droit d'acces, rectification et suppression de vos donnees.</p>
            <p>Contact : contact@acl-gestion.com</p>
        </div>
    `);
}
