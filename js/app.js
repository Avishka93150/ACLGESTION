/**
 * ACL GESTION - Main Application
 */

let currentPage = 'dashboard';
let captchaAnswer = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (API.token && API.user) {
        showApp();
    } else {
        showLogin();
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            initLandingPage();
        }, 100);
    }
    setupEvents();
});

// Initialize landing page
function initLandingPage() {
    generateCaptcha();
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Generate math captcha
function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    captchaAnswer = num1 + num2;
    
    const questionEl = document.getElementById('captcha-question');
    if (questionEl) {
        questionEl.innerHTML = `<strong>${num1} + ${num2} = </strong>`;
    } else {
        console.warn('Captcha question element not found');
    }
}

// Show/hide login modal
function showLoginForm() {
    document.getElementById('login-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function hideLoginForm() {
    document.getElementById('login-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

// Scroll to contact section
function scrollToContact() {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Toggle mobile menu on landing page
function toggleLandingMenu() {
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.querySelector('.nav-toggle');
    
    if (navMenu) {
        const isOpen = navMenu.classList.contains('open');
        navMenu.classList.toggle('open');
        
        // Change icon
        if (navToggle) {
            navToggle.innerHTML = isOpen ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-times"></i>';
        }
    }
}

// Close landing menu when clicking a link
function closeLandingMenu() {
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.querySelector('.nav-toggle');
    
    if (navMenu) {
        navMenu.classList.remove('open');
        if (navToggle) {
            navToggle.innerHTML = '<i class="fas fa-bars"></i>';
        }
    }
}

// Submit contact form
async function submitContactForm(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const btn = document.getElementById('contact-submit-btn');
    
    // Honeypot check (anti-bot)
    if (formData.get('website')) {
        toast('Erreur de validation', 'error');
        return;
    }
    
    // Captcha check
    const userAnswer = parseInt(formData.get('captcha'));
    if (userAnswer !== captchaAnswer) {
        toast('Réponse anti-robot incorrecte', 'error');
        generateCaptcha();
        return;
    }
    
    // Prepare data
    const contactData = {
        name: formData.get('name'),
        firstname: formData.get('firstname'),
        email: formData.get('email'),
        phone: formData.get('phone') || null,
        company: formData.get('company'),
        hotels_count: formData.get('hotels_count') || null,
        message: formData.get('message') || null
    };
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            toast('Votre demande a bien été envoyée. Nous vous contacterons rapidement.', 'success');
            form.reset();
            generateCaptcha();
        } else {
            toast(result.message || 'Erreur lors de l\'envoi', 'error');
        }
    } catch (error) {
        toast('Erreur de connexion. Veuillez réessayer.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer ma demande';
    }
}

// Show forgot password (placeholder)
function showForgotPassword() {
    toast('Contactez votre administrateur pour réinitialiser votre mot de passe.', 'info');
}

// Event listeners
function setupEvents() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Navigation - use both click and touchend for better mobile support
    document.querySelectorAll('.nav-item').forEach(item => {
        const handleNavClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const page = item.dataset.page;
            if (page) {
                navigateTo(page);
                // Close sidebar on mobile after navigation
                setTimeout(() => closeSidebar(), 50);
            }
        };
        
        item.addEventListener('click', handleNavClick);
    });
    
    // Sidebar overlay click to close
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
        console.log('Tentative de connexion...', email);
        const result = await API.login(email, password);
        console.log('Résultat API:', result);
        
        if (result.success && result.token && result.user) {
            API.setAuth(result.token, result.user);
            console.log('Auth sauvegardée, token:', API.token ? 'OK' : 'ERREUR');
            console.log('User:', API.user);
            toast('Connexion réussie', 'success');
            
            // Hide login modal if open
            hideLoginForm();
            
            // Vérifier si le consentement RGPD est requis
            if (result.user.needs_gdpr_consent) {
                document.getElementById('login-page').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                showConsentModal();
            } else {
                showApp();
            }
        } else {
            console.error('Réponse invalide:', result);
            toast(result.message || 'Erreur de connexion', 'error');
        }
    } catch (error) {
        console.error('Erreur login:', error);
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
    toast('Déconnexion', 'info');
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

    // Load user permissions first
    await loadUserPermissions();

    // Hide menu items based on permissions (remplace l'ancien système data-roles)
    updateMenuByPermissions();

    // Hide header buttons based on role (settings, rgpd-admin)
    document.querySelectorAll('.header-actions [data-roles]').forEach(item => {
        const roles = item.dataset.roles.split(',');
        if (!roles.includes(API.user.role)) {
            item.style.display = 'none';
        }
    });

    // Load modules config and hide disabled modules
    await loadModulesConfig();

    // Load notifications
    loadNotifications();

    // Start real-time polling
    startPolling();

    // Initialize chatbot
    if (typeof initChatbot === 'function') {
        initChatbot();
    }

    navigateTo('dashboard');
}

/**
 * Cache les éléments du menu selon les permissions de l'utilisateur
 */
function updateMenuByPermissions() {
    // Mapping page -> permission requise pour voir le module
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

// Load modules configuration and update sidebar
let enabledModules = {};

async function loadModulesConfig() {
    try {
        const result = await API.getModulesConfig();
        enabledModules = result.modules || {};
        updateSidebarModules();
    } catch (error) {
        console.log('Modules config not available, showing all');
        enabledModules = {};
    }
}

function updateSidebarModules() {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        const page = item.dataset.page;
        // Si le module est explicitement désactivé (false ou "false"), le masquer
        if (page && (enabledModules[page] === false || enabledModules[page] === 'false')) {
            item.style.display = 'none';
        }
    });
}

// Navigation
function navigateTo(page) {
    // Vérifier les permissions pour la page demandée
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
        toast('Vous n\'avez pas accès à ce module', 'error');
        // Rediriger vers le dashboard si pas de permission
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
        hotels: 'Gestion des Hôtels',
        housekeeping: 'Module Gouvernante',
        maintenance: 'Maintenance',
        tasks: 'Gestion des Tâches',
        evaluations: 'Évaluations',
        linen: 'Gestion du Linge',
        leaves: 'Gestion des Congés',
        audit: 'Audits',
        closures: 'Clôtures & Remises',
        rgpd: 'RGPD',
        messages: 'Messagerie',
        users: 'Utilisateurs',
        settings: 'Paramètres'
    };
    document.getElementById('page-title').textContent = titles[page] || page;

    // Load page
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
        default: container.innerHTML = '<div class="card"><p>Page non trouvée</p></div>';
    }
}

function refreshPage() {
    loadPage(currentPage);
    toast('Actualisé', 'info');
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

// Update maintenance badge periodically
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

// Track last unread count to detect new messages
let lastUnreadCount = 0;

// Update messages badge
async function updateMessagesBadge() {
    try {
        const result = await API.getUnreadCount();
        if (result.success) {
            const count = result.count || 0;
            const badge = document.getElementById('messages-badge');
            if (badge) {
                badge.textContent = count || '';
                
                // Add pulse animation if new messages
                if (count > lastUnreadCount && lastUnreadCount >= 0) {
                    badge.classList.add('badge-pulse');
                    
                    // Show desktop notification if not on messages page
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

// Show notification for new messages
function showNewMessageNotification(newCount) {
    // Toast notification
    toast(`📩 ${newCount} nouveau${newCount > 1 ? 'x' : ''} message${newCount > 1 ? 's' : ''}`, 'info');
    
    // Browser notification (if permitted)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('ACL GESTION - Nouveau message', {
            body: `Vous avez ${newCount} nouveau${newCount > 1 ? 'x' : ''} message${newCount > 1 ? 's' : ''}`,
            icon: '/favicon.ico'
        });
    }
    
    // Play notification sound (optional - uncomment if you add a sound file)
    // playNotificationSound();
}

// Request notification permission on first interaction
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// Initialize polling for real-time updates
let pollingInterval = null;

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    // Initial update
    updateMaintenanceBadge();
    updateMessagesBadge();
    
    // Poll every 10 seconds for badges
    pollingInterval = setInterval(() => {
        if (API.token) {
            updateMaintenanceBadge();
            updateMessagesBadge();
            loadNotifications(); // Refresh notifications
        }
    }, 10000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// Start polling when app loads
document.addEventListener('DOMContentLoaded', () => {
    // Request notification permission after user interaction
    document.body.addEventListener('click', requestNotificationPermission, { once: true });
});

// Profile Modal
function showProfileModal() {
    const user = API.user;
    openModal('Mon profil', `
        <form onsubmit="updateProfile(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Prénom</label>
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
                <label>Téléphone</label>
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
        toast('Profil mis à jour', 'success');
        closeModal();
    } catch (error) {
        toast(error.message, 'error');
    }
}
