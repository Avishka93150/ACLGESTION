/**
 * ACL GESTION - Module Gestion des Automatisations
 * Accessible uniquement aux administrateurs
 */

let automationsData = [];
let hotelsData = [];
let usersData = [];
let selectedAutomation = null;
let automationLogs = [];

const MODULES = {
    housekeeping: { name: 'Housekeeping', icon: 'fa-broom', color: '#10B981' },
    maintenance: { name: 'Maintenance', icon: 'fa-tools', color: '#F59E0B' },
    tasks: { name: 'Tâches', icon: 'fa-tasks', color: '#3B82F6' },
    leaves: { name: 'Congés', icon: 'fa-calendar-alt', color: '#8B5CF6' },
    audit: { name: 'Audit', icon: 'fa-clipboard-check', color: '#EC4899' },
    closure: { name: 'Clôtures', icon: 'fa-cash-register', color: '#14B8A6' },
    revenue: { name: 'Revenue', icon: 'fa-chart-line', color: '#6366F1' },
    system: { name: 'Système', icon: 'fa-cog', color: '#6B7280' }
};

const SCHEDULE_TYPES = {
    daily: 'Quotidien',
    weekly: 'Hebdomadaire',
    monthly: 'Mensuel',
    interval: 'Intervalle'
};

const DAYS_OF_WEEK = {
    1: 'Lundi',
    2: 'Mardi',
    3: 'Mercredi',
    4: 'Jeudi',
    5: 'Vendredi',
    6: 'Samedi',
    7: 'Dimanche'
};

async function initAutomations() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2><i class="fas fa-robot"></i> Gestion des Automatisations</h2>
                <p class="text-muted">Configurez les tâches automatiques, planifications et notifications</p>
            </div>
            <div class="header-actions">
                <button class="btn btn-outline" onclick="viewAutomationLogs()">
                    <i class="fas fa-history"></i> Historique
                </button>
                <button class="btn btn-primary" onclick="runAllAutomationsNow()">
                    <i class="fas fa-play"></i> Exécuter Maintenant
                </button>
            </div>
        </div>
        
        <div class="automation-stats" id="automation-stats">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
        
        <div class="automation-filters">
            <div class="filter-group">
                <label>Module</label>
                <select id="filter-module" onchange="filterAutomations()">
                    <option value="">Tous les modules</option>
                    ${Object.entries(MODULES).map(([key, mod]) => `
                        <option value="${key}">${mod.name}</option>
                    `).join('')}
                </select>
            </div>
            <div class="filter-group">
                <label>Statut</label>
                <select id="filter-status" onchange="filterAutomations()">
                    <option value="">Tous</option>
                    <option value="active">Actives</option>
                    <option value="inactive">Inactives</option>
                </select>
            </div>
        </div>
        
        <div class="automations-grid" id="automations-grid">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
    `;
    
    await loadAutomationsData();
}

async function loadAutomationsData() {
    try {
        const [automationsRes, hotelsRes, usersRes] = await Promise.all([
            API.get('/automations'),
            API.get('/hotels'),
            API.get('/users')
        ]);
        
        automationsData = automationsRes.automations || [];
        hotelsData = hotelsRes.hotels || [];
        usersData = usersRes.users || [];
        
        // Vérifier si les tables existent
        if (automationsRes.error) {
            document.getElementById('automation-stats').innerHTML = `
                <div class="alert alert-warning" style="grid-column: 1/-1;">
                    <i class="fas fa-exclamation-triangle"></i> 
                    <strong>Configuration requise:</strong> ${automationsRes.error}
                </div>
            `;
            document.getElementById('automations-grid').innerHTML = '';
            return;
        }
        
        renderStats();
        renderAutomations();
    } catch (error) {
        console.error('Erreur loadAutomationsData:', error);
        document.getElementById('automation-stats').innerHTML = `
            <div class="alert alert-danger" style="grid-column: 1/-1;">
                <i class="fas fa-times-circle"></i> 
                Erreur: ${error.message}
            </div>
        `;
        document.getElementById('automations-grid').innerHTML = '';
    }
}

function renderStats() {
    const stats = {
        total: automationsData.length,
        active: automationsData.filter(a => a.is_active).length,
        lastRun: automationsData.filter(a => a.last_run_at).sort((a, b) => 
            new Date(b.last_run_at) - new Date(a.last_run_at)
        )[0],
        errors: automationsData.filter(a => a.last_run_status === 'error').length
    };
    
    document.getElementById('automation-stats').innerHTML = `
        <div class="stat-card">
            <div class="stat-icon blue"><i class="fas fa-robot"></i></div>
            <div class="stat-info">
                <span class="stat-value">${stats.total}</span>
                <span class="stat-label">Automatisations</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
            <div class="stat-info">
                <span class="stat-value">${stats.active}</span>
                <span class="stat-label">Actives</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon orange"><i class="fas fa-clock"></i></div>
            <div class="stat-info">
                <span class="stat-value">${stats.lastRun ? formatTimeAgo(stats.lastRun.last_run_at) : '-'}</span>
                <span class="stat-label">Dernière exécution</span>
            </div>
        </div>
        <div class="stat-card ${stats.errors > 0 ? 'stat-error' : ''}">
            <div class="stat-icon ${stats.errors > 0 ? 'red' : 'gray'}"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="stat-info">
                <span class="stat-value">${stats.errors}</span>
                <span class="stat-label">Erreurs</span>
            </div>
        </div>
    `;
}

function renderAutomations() {
    const moduleFilter = document.getElementById('filter-module').value;
    const statusFilter = document.getElementById('filter-status').value;
    
    let filtered = automationsData;
    
    if (moduleFilter) {
        filtered = filtered.filter(a => a.module === moduleFilter);
    }
    if (statusFilter === 'active') {
        filtered = filtered.filter(a => a.is_active);
    } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(a => !a.is_active);
    }
    
    // Grouper par module
    const grouped = {};
    filtered.forEach(a => {
        if (!grouped[a.module]) grouped[a.module] = [];
        grouped[a.module].push(a);
    });
    
    const container = document.getElementById('automations-grid');
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-robot"></i>
                <p>Aucune automatisation trouvée</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = Object.entries(grouped).map(([module, items]) => `
        <div class="automation-module-group">
            <div class="module-header" style="border-left-color: ${MODULES[module]?.color || '#6B7280'}">
                <i class="fas ${MODULES[module]?.icon || 'fa-cog'}"></i>
                <span>${MODULES[module]?.name || module}</span>
                <span class="module-count">${items.length}</span>
            </div>
            <div class="automation-cards">
                ${items.map(a => renderAutomationCard(a)).join('')}
            </div>
        </div>
    `).join('');
}

function renderAutomationCard(automation) {
    const mod = MODULES[automation.module] || {};
    const scheduleText = getScheduleText(automation);
    const statusClass = automation.is_active ? 'active' : 'inactive';
    const lastRunClass = automation.last_run_status === 'error' ? 'error' : 
                         automation.last_run_status === 'success' ? 'success' : '';
    
    const activeHotels = (automation.hotels || []).filter(h => h.is_active).length;
    const totalHotels = automation.is_global ? hotelsData.length : (automation.hotels || []).length;
    
    return `
        <div class="automation-card ${statusClass}" onclick="openAutomationDetail(${automation.id})">
            <div class="automation-card-header">
                <div class="automation-status">
                    <label class="switch" onclick="event.stopPropagation()">
                        <input type="checkbox" ${automation.is_active ? 'checked' : ''} 
                               onchange="toggleAutomation(${automation.id}, this.checked)">
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="automation-actions" onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="runAutomationNow(${automation.id})" title="Exécuter maintenant">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
            
            <div class="automation-card-body">
                <h4>${esc(automation.name)}</h4>
                <p class="automation-desc">${esc(automation.description || '')}</p>
                
                <div class="automation-schedule">
                    <i class="fas fa-clock"></i>
                    <span>${scheduleText}</span>
                </div>
                
                <div class="automation-meta">
                    <div class="meta-item">
                        <i class="fas fa-hotel"></i>
                        <span>${activeHotels}/${totalHotels} hôtels</span>
                    </div>
                    <div class="meta-item">
                        <i class="fas fa-bell"></i>
                        <span>${(automation.recipients || []).length} destinataires</span>
                    </div>
                </div>
            </div>
            
            <div class="automation-card-footer ${lastRunClass}">
                ${automation.last_run_at ? `
                    <span class="last-run">
                        <i class="fas ${automation.last_run_status === 'error' ? 'fa-times-circle' : 
                                       automation.last_run_status === 'success' ? 'fa-check-circle' : 'fa-clock'}"></i>
                        ${formatTimeAgo(automation.last_run_at)}
                    </span>
                    <span class="run-count">${automation.run_count || 0} exécutions</span>
                ` : `
                    <span class="text-muted">Jamais exécutée</span>
                `}
            </div>
        </div>
    `;
}

function getScheduleText(automation) {
    const time = automation.schedule_time ? automation.schedule_time.substring(0, 5) : '09:00';
    
    switch (automation.schedule_type) {
        case 'daily':
            return `Tous les jours à ${time}`;
        case 'weekly':
            const days = (automation.schedule_days || '1').split(',').map(d => DAYS_OF_WEEK[d] || d);
            return `${days.join(', ')} à ${time}`;
        case 'monthly':
            return `Le ${automation.schedule_day_of_month || 1} de chaque mois à ${time}`;
        case 'interval':
            const mins = automation.schedule_interval_minutes || 60;
            if (mins >= 60) {
                return `Toutes les ${mins / 60} heure(s)`;
            }
            return `Toutes les ${mins} minutes`;
        default:
            return 'Planification non définie';
    }
}

function filterAutomations() {
    renderAutomations();
}

async function toggleAutomation(id, isActive) {
    try {
        await API.put(`/automations/${id}`, { is_active: isActive ? 1 : 0 });
        
        const automation = automationsData.find(a => a.id === id);
        if (automation) automation.is_active = isActive;
        
        renderStats();
        toast(isActive ? 'Automatisation activée' : 'Automatisation désactivée', 'success');
    } catch (error) {
        toast(error.message, 'error');
        loadAutomationsData(); // Recharger en cas d'erreur
    }
}

async function runAutomationNow(id) {
    if (!confirm('Exécuter cette automatisation maintenant ?')) return;
    
    try {
        toast('Exécution en cours...', 'info');
        const res = await API.post(`/automations/${id}/run`);
        toast(res.message || 'Automatisation exécutée', 'success');
        loadAutomationsData();
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function runAllAutomationsNow() {
    if (!confirm('Exécuter le cycle complet des automatisations planifiées pour maintenant ?')) return;
    
    try {
        toast('Exécution du cycle en cours...', 'info');
        const res = await API.post('/automations/run-cycle');
        toast(res.message || 'Cycle exécuté', 'success');
        loadAutomationsData();
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function openAutomationDetail(id) {
    const automation = automationsData.find(a => a.id === id);
    if (!automation) return;
    
    selectedAutomation = automation;
    
    // Charger les détails complets
    try {
        const res = await API.get(`/automations/${id}`);
        selectedAutomation = res.automation;
        
        renderAutomationModal(selectedAutomation);
    } catch (error) {
        toast(error.message, 'error');
    }
}

function renderAutomationModal(automation) {
    const mod = MODULES[automation.module] || {};
    const hotels = automation.hotels || [];
    const recipients = automation.recipients || [];
    
    openModal(`<i class="fas ${mod.icon || 'fa-robot'}" style="color: ${mod.color}"></i> ${esc(automation.name)}`, `
        <div class="automation-detail">
            <ul class="tabs">
                <li class="tab active" data-tab="general" onclick="switchAutomationTab('general')">
                    <i class="fas fa-cog"></i> Général
                </li>
                <li class="tab" data-tab="hotels" onclick="switchAutomationTab('hotels')">
                    <i class="fas fa-hotel"></i> Hôtels
                </li>
                <li class="tab" data-tab="recipients" onclick="switchAutomationTab('recipients')">
                    <i class="fas fa-bell"></i> Notifications
                </li>
                <li class="tab" data-tab="logs" onclick="switchAutomationTab('logs')">
                    <i class="fas fa-history"></i> Historique
                </li>
            </ul>
            
            <div class="tab-content active" id="tab-general">
                ${renderGeneralTab(automation)}
            </div>
            
            <div class="tab-content" id="tab-hotels">
                ${renderHotelsTab(automation, hotels)}
            </div>
            
            <div class="tab-content" id="tab-recipients">
                ${renderRecipientsTab(automation, recipients)}
            </div>
            
            <div class="tab-content" id="tab-logs">
                <div id="automation-logs-content">
                    <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>
                </div>
            </div>
        </div>
        
        <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal()">Fermer</button>
            <button class="btn btn-primary" onclick="saveAutomationSettings()">
                <i class="fas fa-save"></i> Enregistrer
            </button>
        </div>
    `, 'modal-lg');
    
    // Charger les logs
    loadAutomationLogs(automation.id);
}

function renderGeneralTab(automation) {
    return `
        <div class="form-section">
            <h4><i class="fas fa-info-circle"></i> Informations</h4>
            <div class="form-group">
                <label>Nom</label>
                <input type="text" id="auto-name" class="form-control" value="${esc(automation.name)}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="auto-description" class="form-control" rows="2">${esc(automation.description || '')}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group col-md-6">
                    <label>Module</label>
                    <input type="text" class="form-control" value="${MODULES[automation.module]?.name || automation.module}" disabled>
                </div>
                <div class="form-group col-md-6">
                    <label>Code</label>
                    <input type="text" class="form-control" value="${automation.code}" disabled>
                </div>
            </div>
        </div>
        
        <div class="form-section">
            <h4><i class="fas fa-clock"></i> Planification</h4>
            <div class="form-row">
                <div class="form-group col-md-6">
                    <label>Type de planification</label>
                    <select id="auto-schedule-type" class="form-control" onchange="updateScheduleOptions()">
                        ${Object.entries(SCHEDULE_TYPES).map(([key, label]) => `
                            <option value="${key}" ${automation.schedule_type === key ? 'selected' : ''}>${label}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group col-md-6">
                    <label>Heure d'exécution</label>
                    <input type="time" id="auto-schedule-time" class="form-control" 
                           value="${automation.schedule_time ? automation.schedule_time.substring(0, 5) : '09:00'}">
                </div>
            </div>
            
            <div id="schedule-options">
                ${renderScheduleOptions(automation)}
            </div>
        </div>
        
        <div class="form-section">
            <h4><i class="fas fa-chart-bar"></i> Statistiques</h4>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Dernière exécution</span>
                    <span class="stat-value">${automation.last_run_at ? formatDateTime(automation.last_run_at) : 'Jamais'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Statut</span>
                    <span class="stat-value">
                        ${automation.last_run_status === 'success' ? '<span class="badge badge-success">Succès</span>' :
                          automation.last_run_status === 'error' ? '<span class="badge badge-danger">Erreur</span>' :
                          automation.last_run_status === 'partial' ? '<span class="badge badge-warning">Partiel</span>' :
                          '<span class="badge badge-secondary">-</span>'}
                    </span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Nombre d'exécutions</span>
                    <span class="stat-value">${automation.run_count || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Dernier message</span>
                    <span class="stat-value text-sm">${esc(automation.last_run_message || '-')}</span>
                </div>
            </div>
        </div>
    `;
}

function renderScheduleOptions(automation) {
    const type = automation.schedule_type || 'daily';
    
    if (type === 'weekly') {
        const selectedDays = (automation.schedule_days || '1').split(',');
        return `
            <div class="form-group">
                <label>Jours de la semaine</label>
                <div class="days-selector">
                    ${Object.entries(DAYS_OF_WEEK).map(([num, name]) => `
                        <label class="day-checkbox">
                            <input type="checkbox" name="schedule_days" value="${num}" 
                                   ${selectedDays.includes(num) ? 'checked' : ''}>
                            <span>${name.substring(0, 3)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (type === 'monthly') {
        return `
            <div class="form-group">
                <label>Jour du mois</label>
                <select id="auto-day-of-month" class="form-control">
                    ${Array.from({length: 31}, (_, i) => `
                        <option value="${i + 1}" ${automation.schedule_day_of_month === (i + 1) ? 'selected' : ''}>${i + 1}</option>
                    `).join('')}
                </select>
            </div>
        `;
    } else if (type === 'interval') {
        return `
            <div class="form-group">
                <label>Intervalle (minutes)</label>
                <select id="auto-interval" class="form-control">
                    <option value="15" ${automation.schedule_interval_minutes === 15 ? 'selected' : ''}>15 minutes</option>
                    <option value="30" ${automation.schedule_interval_minutes === 30 ? 'selected' : ''}>30 minutes</option>
                    <option value="60" ${automation.schedule_interval_minutes === 60 ? 'selected' : ''}>1 heure</option>
                    <option value="120" ${automation.schedule_interval_minutes === 120 ? 'selected' : ''}>2 heures</option>
                    <option value="360" ${automation.schedule_interval_minutes === 360 ? 'selected' : ''}>6 heures</option>
                    <option value="720" ${automation.schedule_interval_minutes === 720 ? 'selected' : ''}>12 heures</option>
                </select>
            </div>
        `;
    }
    
    return '';
}

function updateScheduleOptions() {
    const type = document.getElementById('auto-schedule-type').value;
    const temp = { ...selectedAutomation, schedule_type: type };
    document.getElementById('schedule-options').innerHTML = renderScheduleOptions(temp);
}

function renderHotelsTab(automation, hotels) {
    const allHotels = hotelsData;
    const hotelMap = {};
    hotels.forEach(h => hotelMap[h.hotel_id] = h);
    
    return `
        <div class="hotels-config">
            <div class="config-header">
                <div class="form-check">
                    <input type="checkbox" id="auto-is-global" ${automation.is_global ? 'checked' : ''} 
                           onchange="toggleGlobalHotels(this.checked)">
                    <label for="auto-is-global">Appliquer à tous les hôtels automatiquement</label>
                </div>
            </div>
            
            <div class="hotels-list" id="hotels-list">
                ${allHotels.map(hotel => {
                    const config = hotelMap[hotel.id];
                    const isActive = config ? config.is_active : automation.is_global;
                    return `
                        <div class="hotel-config-item">
                            <label class="switch">
                                <input type="checkbox" name="hotel_${hotel.id}" ${isActive ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                            <div class="hotel-info">
                                <span class="hotel-name">${esc(hotel.name)}</span>
                                <span class="hotel-code">${esc(hotel.code || '')}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function toggleGlobalHotels(isGlobal) {
    const checkboxes = document.querySelectorAll('#hotels-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = isGlobal);
}

function renderRecipientsTab(automation, recipients) {
    return `
        <div class="recipients-config">
            <div class="recipients-list" id="recipients-list">
                ${recipients.length > 0 ? recipients.map((r, idx) => `
                    <div class="recipient-item" data-index="${idx}">
                        <div class="recipient-type">
                            <select class="form-control" name="recipient_type_${idx}">
                                <option value="role" ${r.recipient_type === 'role' ? 'selected' : ''}>Rôle</option>
                                <option value="user" ${r.recipient_type === 'user' ? 'selected' : ''}>Utilisateur</option>
                                <option value="email" ${r.recipient_type === 'email' ? 'selected' : ''}>Email</option>
                            </select>
                        </div>
                        <div class="recipient-value">
                            ${renderRecipientValueInput(r, idx)}
                        </div>
                        <div class="recipient-channels">
                            <label class="channel-check">
                                <input type="checkbox" name="channel_email_${idx}" ${(r.notification_channels || '').includes('email') ? 'checked' : ''}>
                                <i class="fas fa-envelope"></i>
                            </label>
                        </div>
                        <button class="btn-icon btn-danger" onclick="removeRecipient(${idx})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `).join('') : '<p class="text-muted text-center">Aucun destinataire configuré</p>'}
            </div>
            
            <button class="btn btn-outline btn-block mt-15" onclick="addRecipient()">
                <i class="fas fa-plus"></i> Ajouter un destinataire
            </button>
        </div>
    `;
}

function renderRecipientValueInput(recipient, idx) {
    if (recipient.recipient_type === 'role') {
        return `
            <select class="form-control" name="recipient_value_${idx}">
                <option value="admin" ${recipient.recipient_value === 'admin' ? 'selected' : ''}>Administrateur</option>
                <option value="groupe_manager" ${recipient.recipient_value === 'groupe_manager' ? 'selected' : ''}>Responsable Groupe</option>
                <option value="hotel_manager" ${recipient.recipient_value === 'hotel_manager' ? 'selected' : ''}>Responsable Hôtel</option>
                <option value="employee" ${recipient.recipient_value === 'employee' ? 'selected' : ''}>Employé</option>
            </select>
        `;
    } else if (recipient.recipient_type === 'user') {
        return `
            <select class="form-control" name="recipient_value_${idx}">
                ${usersData.map(u => `
                    <option value="${u.id}" ${recipient.recipient_value == u.id ? 'selected' : ''}>
                        ${esc(u.first_name)} ${esc(u.last_name)}
                    </option>
                `).join('')}
            </select>
        `;
    } else {
        return `
            <input type="email" class="form-control" name="recipient_value_${idx}" 
                   value="${esc(recipient.recipient_value || '')}" placeholder="email@example.com">
        `;
    }
}

function addRecipient() {
    const list = document.getElementById('recipients-list');
    const idx = list.querySelectorAll('.recipient-item').length;
    
    const emptyMessage = list.querySelector('.text-muted');
    if (emptyMessage) emptyMessage.remove();
    
    const newRecipient = {
        recipient_type: 'role',
        recipient_value: 'hotel_manager',
        notification_channels: 'email'
    };
    
    const div = document.createElement('div');
    div.className = 'recipient-item';
    div.dataset.index = idx;
    div.innerHTML = `
        <div class="recipient-type">
            <select class="form-control" name="recipient_type_${idx}" onchange="updateRecipientValue(${idx}, this.value)">
                <option value="role">Rôle</option>
                <option value="user">Utilisateur</option>
                <option value="email">Email</option>
            </select>
        </div>
        <div class="recipient-value" id="recipient-value-${idx}">
            ${renderRecipientValueInput(newRecipient, idx)}
        </div>
        <div class="recipient-channels">
            <label class="channel-check">
                <input type="checkbox" name="channel_email_${idx}" checked>
                <i class="fas fa-envelope"></i>
            </label>
        </div>
        <button class="btn-icon btn-danger" onclick="removeRecipient(${idx})">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    list.appendChild(div);
}

function updateRecipientValue(idx, type) {
    const container = document.getElementById(`recipient-value-${idx}`);
    const recipient = { recipient_type: type, recipient_value: '' };
    container.innerHTML = renderRecipientValueInput(recipient, idx);
}

function removeRecipient(idx) {
    const item = document.querySelector(`.recipient-item[data-index="${idx}"]`);
    if (item) item.remove();
}

async function loadAutomationLogs(automationId) {
    try {
        const res = await API.get(`/automations/${automationId}/logs`);
        const logs = res.logs || [];
        
        const container = document.getElementById('automation-logs-content');
        
        if (logs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>Aucun historique disponible</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="logs-table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Statut</th>
                            <th>Durée</th>
                            <th>Déclencheur</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => `
                            <tr class="log-row-${log.status}">
                                <td>${formatDateTime(log.started_at)}</td>
                                <td>
                                    ${log.status === 'success' ? '<span class="badge badge-success">Succès</span>' :
                                      log.status === 'error' ? '<span class="badge badge-danger">Erreur</span>' :
                                      log.status === 'skipped' ? '<span class="badge badge-secondary">Ignoré</span>' :
                                      '<span class="badge badge-info">En cours</span>'}
                                </td>
                                <td>${log.duration_ms ? `${log.duration_ms}ms` : '-'}</td>
                                <td>${log.triggered_by === 'manual' ? 'Manuel' : log.triggered_by === 'cron' ? 'Cron' : 'API'}</td>
                                <td class="log-message">${esc(log.message || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        document.getElementById('automation-logs-content').innerHTML = `
            <div class="alert alert-danger">Erreur lors du chargement des logs</div>
        `;
    }
}

function switchAutomationTab(tabName) {
    document.querySelectorAll('.automation-detail .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.automation-detail .tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.automation-detail .tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

async function saveAutomationSettings() {
    if (!selectedAutomation) return;
    
    // Collecter les données générales
    const data = {
        name: document.getElementById('auto-name').value,
        description: document.getElementById('auto-description').value,
        schedule_type: document.getElementById('auto-schedule-type').value,
        schedule_time: document.getElementById('auto-schedule-time').value + ':00',
        is_global: document.getElementById('auto-is-global')?.checked ? 1 : 0
    };
    
    // Options de planification spécifiques
    if (data.schedule_type === 'weekly') {
        const days = Array.from(document.querySelectorAll('input[name="schedule_days"]:checked'))
            .map(cb => cb.value).join(',');
        data.schedule_days = days || '1';
    } else if (data.schedule_type === 'monthly') {
        data.schedule_day_of_month = document.getElementById('auto-day-of-month')?.value || 1;
    } else if (data.schedule_type === 'interval') {
        data.schedule_interval_minutes = document.getElementById('auto-interval')?.value || 60;
    }
    
    // Collecter les hôtels
    const hotels = [];
    document.querySelectorAll('#hotels-list input[type="checkbox"]').forEach(cb => {
        const hotelId = cb.name.replace('hotel_', '');
        hotels.push({ hotel_id: parseInt(hotelId), is_active: cb.checked ? 1 : 0 });
    });
    data.hotels = hotels;
    
    // Collecter les destinataires
    const recipients = [];
    document.querySelectorAll('.recipient-item').forEach(item => {
        const idx = item.dataset.index;
        const typeSelect = item.querySelector(`select[name="recipient_type_${idx}"]`);
        const valueInput = item.querySelector(`[name="recipient_value_${idx}"]`);
        const emailCheck = item.querySelector(`input[name="channel_email_${idx}"]`);
        
        if (typeSelect && valueInput) {
            recipients.push({
                recipient_type: typeSelect.value,
                recipient_value: valueInput.value,
                notification_channels: emailCheck?.checked ? 'email' : ''
            });
        }
    });
    data.recipients = recipients;
    
    try {
        await API.put(`/automations/${selectedAutomation.id}`, data);
        toast('Configuration enregistrée', 'success');
        closeModal();
        loadAutomationsData();
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function viewAutomationLogs() {
    try {
        const res = await API.get('/automations/logs?limit=100');
        const logs = res.logs || [];
        
        openModal('<i class="fas fa-history"></i> Historique des exécutions', `
            <div class="logs-filter mb-15">
                <select id="logs-filter-status" class="form-control" onchange="filterLogs()">
                    <option value="">Tous les statuts</option>
                    <option value="success">Succès</option>
                    <option value="error">Erreur</option>
                    <option value="skipped">Ignoré</option>
                </select>
            </div>
            
            <div class="logs-table-container" id="global-logs-container">
                ${renderLogsTable(logs)}
            </div>
        `, 'modal-lg');
    } catch (error) {
        toast(error.message, 'error');
    }
}

function renderLogsTable(logs) {
    if (logs.length === 0) {
        return `<div class="empty-state"><i class="fas fa-history"></i><p>Aucun historique</p></div>`;
    }
    
    return `
        <table class="table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Automatisation</th>
                    <th>Statut</th>
                    <th>Durée</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>
                ${logs.map(log => `
                    <tr class="log-row-${log.status}">
                        <td>${formatDateTime(log.started_at)}</td>
                        <td>${esc(log.automation_name || '-')}</td>
                        <td>
                            ${log.status === 'success' ? '<span class="badge badge-success">Succès</span>' :
                              log.status === 'error' ? '<span class="badge badge-danger">Erreur</span>' :
                              log.status === 'skipped' ? '<span class="badge badge-secondary">Ignoré</span>' :
                              '<span class="badge badge-info">En cours</span>'}
                        </td>
                        <td>${log.duration_ms ? `${log.duration_ms}ms` : '-'}</td>
                        <td class="log-message">${esc(log.message || '-')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Helpers
function formatTimeAgo(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;
    return formatDate(dateStr);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
