/**
 * Dashboard Page - Vue d'ensemble de tous les modules
 * Intègre : Housekeeping, Maintenance, Tasks, Leaves, Evaluations, Linen, Closures, Audit, RGPD
 */
async function loadDashboard(container) {
    showLoading(container);

    try {
        // Charger les stats ET la config des modules en parallèle
        const [result, modulesResult] = await Promise.all([
            API.getStats(),
            API.getModulesConfig()
        ]);
        
        const stats = result.stats || {};
        const recent = result.recent || {};
        
        // Utiliser les modules fraîchement chargés
        const modules = modulesResult.modules || {};
        const isModuleEnabled = (mod) => modules[mod] !== false && modules[mod] !== 'false';
        
        // Vérifier si l'utilisateur a accès à des hôtels
        const hotels = recent.hotels || [];
        const noHotels = hotels.length === 0 && API.user.role !== 'admin';
        
        // Rôles qui peuvent voir certaines sections
        const canManage = ['admin', 'groupe_manager', 'hotel_manager'].includes(API.user.role);
        const isRH = ['admin', 'rh'].includes(API.user.role);
        const isCompta = ['admin', 'comptabilite'].includes(API.user.role);
        const isReception = ['admin', 'groupe_manager', 'hotel_manager', 'reception'].includes(API.user.role);
        const isAdmin = API.user.role === 'admin';

        container.innerHTML = `
            ${noHotels ? renderNoHotelsState() : `
                <!-- Message de bienvenue -->
                <div class="dashboard-welcome">
                    <h2>Bonjour ${esc(API.user.first_name)} 👋</h2>
                    <p class="text-muted">${getTodayGreeting()}</p>
                </div>

                <!-- Alertes importantes -->
                ${renderAlerts(stats, recent, isModuleEnabled)}

                <!-- KPIs principaux -->
                <div class="kpi-grid">
                    <div class="kpi-card" onclick="navigateTo('hotels')">
                        <div class="kpi-icon blue"><i class="fas fa-building"></i></div>
                        <div>
                            <div class="kpi-value">${stats.hotels || 0}</div>
                            <div class="kpi-label">Hôtels</div>
                        </div>
                    </div>
                    <div class="kpi-card" onclick="navigateTo('hotels')">
                        <div class="kpi-icon green"><i class="fas fa-door-open"></i></div>
                        <div>
                            <div class="kpi-value">${stats.rooms || 0}</div>
                            <div class="kpi-label">Chambres</div>
                        </div>
                    </div>
                    ${isModuleEnabled('maintenance') ? `
                        <div class="kpi-card ${stats.maintenance_critical > 0 ? 'kpi-alert' : ''}" onclick="navigateTo('maintenance')">
                            <div class="kpi-icon orange"><i class="fas fa-wrench"></i></div>
                            <div>
                                <div class="kpi-value">${stats.maintenance_open || 0}</div>
                                <div class="kpi-label">Tickets ouverts</div>
                            </div>
                            ${stats.maintenance_critical > 0 ? `<span class="kpi-badge">${stats.maintenance_critical} urgent${stats.maintenance_critical > 1 ? 's' : ''}</span>` : ''}
                        </div>
                    ` : ''}
                    ${isModuleEnabled('housekeeping') ? `
                        <div class="kpi-card" onclick="navigateTo('housekeeping')">
                            <div class="kpi-icon purple"><i class="fas fa-broom"></i></div>
                            <div>
                                <div class="kpi-value">${stats.dispatch_done || 0}/${stats.dispatch_today || 0}</div>
                                <div class="kpi-label">Dispatch du jour</div>
                            </div>
                        </div>
                    ` : ''}
                    ${isModuleEnabled('tasks') ? `
                        <div class="kpi-card ${stats.tasks_overdue > 0 ? 'kpi-alert' : ''}" onclick="navigateTo('tasks')">
                            <div class="kpi-icon cyan"><i class="fas fa-tasks"></i></div>
                            <div>
                                <div class="kpi-value">${stats.tasks_pending || 0}</div>
                                <div class="kpi-label">Tâches en cours</div>
                            </div>
                            ${stats.tasks_overdue > 0 ? `<span class="kpi-badge">${stats.tasks_overdue} en retard</span>` : ''}
                        </div>
                    ` : ''}
                    ${isModuleEnabled('leaves') ? `
                        <div class="kpi-card" onclick="navigateTo('leaves')">
                            <div class="kpi-icon teal"><i class="fas fa-calendar-alt"></i></div>
                            <div>
                                <div class="kpi-value">${stats.leaves_pending || 0}</div>
                                <div class="kpi-label">Congés en attente</div>
                            </div>
                        </div>
                    ` : ''}
                    ${isModuleEnabled('closures') && isReception ? `
                        <div class="kpi-card ${stats.closures_pending > 0 ? 'kpi-alert' : ''}" onclick="navigateTo('closures')">
                            <div class="kpi-icon red"><i class="fas fa-cash-register"></i></div>
                            <div>
                                <div class="kpi-value">${stats.closures_pending || 0}</div>
                                <div class="kpi-label">Clôtures en attente</div>
                            </div>
                            ${stats.closures_pending > 0 ? `<span class="kpi-badge">À faire</span>` : ''}
                        </div>
                    ` : ''}
                    ${isModuleEnabled('audit') && canManage ? `
                        <div class="kpi-card" onclick="navigateTo('audit')">
                            <div class="kpi-icon indigo"><i class="fas fa-clipboard-list"></i></div>
                            <div>
                                <div class="kpi-value">${stats.audits_month || 0}</div>
                                <div class="kpi-label">Audits ce mois</div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Grille principale -->
                <div class="dashboard-grid">
                    <!-- Colonne gauche -->
                    <div class="dashboard-col">
                        ${isModuleEnabled('closures') && isReception ? renderClosuresSection(recent.closures, stats) : ''}
                        ${isModuleEnabled('housekeeping') && canManage ? renderDispatchSection(recent.dispatch) : ''}
                        ${isModuleEnabled('maintenance') ? renderMaintenanceSection(recent.maintenance) : ''}
                        ${isModuleEnabled('tasks') ? renderTasksSection(recent.tasks) : ''}
                    </div>
                    
                    <!-- Colonne droite -->
                    <div class="dashboard-col">
                        ${renderHotelsSection(hotels)}
                        ${isModuleEnabled('audit') && canManage ? renderAuditSection(recent.audits, stats) : ''}
                        ${isModuleEnabled('leaves') && (canManage || isRH) ? renderLeavesSection(recent.leaves) : ''}
                        ${isModuleEnabled('evaluations') && (canManage || isRH) ? renderEvaluationsSection(recent.evaluations, stats) : ''}
                        ${isModuleEnabled('linen') && (canManage || isCompta) ? renderLinenSection(recent.linen) : ''}
                    </div>
                </div>

                <!-- Actions rapides -->
                ${renderQuickActions(modules, canManage, isReception)}
                
                <!-- Section RGPD pour admin -->
                ${isAdmin ? renderRgpdSection(stats) : ''}
            `}
        `;

        updateMaintenanceBadge();

    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function getTodayGreeting() {
    const hour = new Date().getHours();
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    if (hour < 12) return `Bonne matinée ! Nous sommes le ${today}`;
    if (hour < 18) return `Bon après-midi ! Nous sommes le ${today}`;
    return `Bonne soirée ! Nous sommes le ${today}`;
}

function renderAlerts(stats, recent, isModuleEnabled) {
    const alerts = [];
    
    // Clôtures en retard
    if (isModuleEnabled('closures') && stats.closures_late > 0) {
        alerts.push({
            type: 'danger',
            icon: 'fa-exclamation-triangle',
            title: 'Clôtures en retard',
            message: `${stats.closures_late} clôture(s) journalière(s) non effectuée(s)`,
            action: { label: 'Voir', onclick: "navigateTo('closures')" }
        });
    }
    
    // Tickets maintenance urgents
    if (isModuleEnabled('maintenance') && stats.maintenance_critical > 0) {
        alerts.push({
            type: 'warning',
            icon: 'fa-wrench',
            title: 'Maintenance urgente',
            message: `${stats.maintenance_critical} ticket(s) priorité haute en attente`,
            action: { label: 'Voir', onclick: "navigateTo('maintenance')" }
        });
    }
    
    // Tâches en retard
    if (isModuleEnabled('tasks') && stats.tasks_overdue > 0) {
        alerts.push({
            type: 'warning',
            icon: 'fa-clock',
            title: 'Tâches en retard',
            message: `${stats.tasks_overdue} tâche(s) en retard`,
            action: { label: 'Voir', onclick: "navigateTo('tasks')" }
        });
    }
    
    // Demandes RGPD en attente (admin)
    if (API.user.role === 'admin' && stats.rgpd_pending > 0) {
        alerts.push({
            type: 'info',
            icon: 'fa-user-shield',
            title: 'Demandes RGPD',
            message: `${stats.rgpd_pending} demande(s) en attente de traitement`,
            action: { label: 'Traiter', onclick: "navigateTo('rgpd-admin')" }
        });
    }
    
    if (alerts.length === 0) return '';
    
    return `
        <div class="dashboard-alerts">
            ${alerts.map(a => `
                <div class="alert alert-${a.type} alert-dismissible">
                    <i class="fas ${a.icon}"></i>
                    <div class="alert-content">
                        <strong>${a.title}</strong>
                        <span>${a.message}</span>
                    </div>
                    ${a.action ? `<button class="btn btn-sm btn-${a.type}" onclick="${a.action.onclick}">${a.action.label}</button>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function renderNoHotelsState() {
    return `
        <div class="card">
            <div class="empty-state">
                <i class="fas fa-building"></i>
                <h3>Aucun hôtel assigné</h3>
                <p>Contactez votre administrateur pour obtenir l'accès à un ou plusieurs hôtels.</p>
            </div>
        </div>
    `;
}

// ==================== SECTION CLOTURES ====================
function renderClosuresSection(closures, stats) {
    const items = closures || [];
    const pendingCount = stats.closures_pending || 0;
    
    return `
        <div class="card ${pendingCount > 0 ? 'card-alert' : ''}">
            <div class="card-header">
                <h3 class="card-title">
                    <i class="fas fa-cash-register"></i> Clôtures & Remises
                    ${pendingCount > 0 ? `<span class="badge badge-danger ml-10">${pendingCount} en attente</span>` : ''}
                </h3>
                <button class="btn btn-sm btn-outline" onclick="navigateTo('closures')">Voir tout</button>
            </div>
            <div class="card-body">
                ${pendingCount > 0 ? `
                    <div class="closure-alert mb-15">
                        <i class="fas fa-exclamation-circle text-danger"></i>
                        <span>Vous avez <strong>${pendingCount}</strong> clôture(s) à effectuer</span>
                        <button class="btn btn-sm btn-primary" onclick="navigateTo('closures')">Effectuer</button>
                    </div>
                ` : ''}
                
                ${items.length ? `
                    <div class="closures-mini-list">
                        ${items.slice(0, 4).map(c => `
                            <div class="closure-mini-item">
                                <div class="closure-date">
                                    <i class="fas fa-calendar"></i>
                                    ${formatDate(c.closure_date)}
                                </div>
                                <div class="closure-hotel">${esc(c.hotel_name)}</div>
                                <div class="closure-amount">
                                    <span class="text-success">+${formatMoney(c.cash_received)}</span>
                                    <span class="text-danger">-${formatMoney(c.cash_spent)}</span>
                                </div>
                                <span class="badge badge-${c.status === 'validated' ? 'success' : c.status === 'submitted' ? 'warning' : 'secondary'}">
                                    ${c.status === 'validated' ? 'Validée' : c.status === 'submitted' ? 'Soumise' : 'Brouillon'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <p class="text-muted text-center py-10">Aucune clôture récente</p>
                `}
                
                <div class="closure-summary mt-15">
                    <div class="summary-item">
                        <span class="summary-label">Solde caisse actuel</span>
                        <span class="summary-value">${formatMoney(stats.cash_balance || 0)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ==================== SECTION AUDIT ====================
function renderAuditSection(audits, stats) {
    const items = audits || [];
    
    return `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-clipboard-list"></i> Audits</h3>
                <button class="btn btn-sm btn-outline" onclick="navigateTo('audit')">Voir tout</button>
            </div>
            <div class="card-body">
                <div class="audit-summary mb-15">
                    <div class="audit-stat">
                        <div class="audit-stat-value">${stats.audits_month || 0}</div>
                        <div class="audit-stat-label">Ce mois</div>
                    </div>
                    <div class="audit-stat">
                        <div class="audit-stat-value">${stats.audits_avg_score ? parseFloat(stats.audits_avg_score).toFixed(0) + '%' : '-'}</div>
                        <div class="audit-stat-label">Score moyen</div>
                    </div>
                </div>
                
                ${items.length ? `
                    <div class="audits-mini-list">
                        ${items.slice(0, 3).map(a => {
                            const score = a.score_percentage ? parseFloat(a.score_percentage) : null;
                            return `
                            <div class="audit-mini-item">
                                <div class="audit-info">
                                    <div class="audit-title">${esc(a.grid_name || 'Audit')}</div>
                                    <div class="audit-meta">${esc(a.hotel_name)} · ${formatDate(a.completed_at || a.created_at)}</div>
                                </div>
                                <div class="audit-score ${getScoreClass(score)}">
                                    ${score !== null ? score.toFixed(0) + '%' : '-'}
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                ` : `
                    <p class="text-muted text-center py-10">Aucun audit récent</p>
                `}
            </div>
        </div>
    `;
}

// ==================== SECTION RGPD (Admin) ====================
function renderRgpdSection(stats) {
    return `
        <div class="card mt-20">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-user-shield"></i> Conformité RGPD</h3>
                <button class="btn btn-sm btn-outline" onclick="navigateTo('rgpd-admin')">Gérer</button>
            </div>
            <div class="card-body">
                <div class="rgpd-summary">
                    <div class="rgpd-stat ${stats.rgpd_pending > 0 ? 'has-pending' : ''}">
                        <i class="fas fa-inbox"></i>
                        <div class="rgpd-stat-value">${stats.rgpd_pending || 0}</div>
                        <div class="rgpd-stat-label">Demandes en attente</div>
                    </div>
                    <div class="rgpd-stat">
                        <i class="fas fa-check-circle"></i>
                        <div class="rgpd-stat-value">${stats.rgpd_completed || 0}</div>
                        <div class="rgpd-stat-label">Traitées ce mois</div>
                    </div>
                    <div class="rgpd-stat">
                        <i class="fas fa-users"></i>
                        <div class="rgpd-stat-value">${stats.users_with_consent || 0}%</div>
                        <div class="rgpd-stat-label">Utilisateurs conformes</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ==================== SECTIONS EXISTANTES ====================

function renderDispatchSection(dispatch) {
    const items = dispatch || [];
    return `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-broom"></i> Dispatch du jour</h3>
                <button class="btn btn-sm btn-outline" onclick="navigateTo('housekeeping')">Voir tout</button>
            </div>
            ${items.length ? `
                <div class="dispatch-mini-list">
                    ${items.slice(0, 6).map(d => `
                        <div class="dispatch-mini-item ${d.status}">
                            <span class="room-badge">${d.room_number}</span>
                            <span class="hotel-name">${esc(d.hotel_name)}</span>
                            <span class="assigned">${d.assigned_name || 'Non assigné'}</span>
                            <span class="status-dot ${d.status}" title="${LABELS.status[d.status] || d.status}"></span>
                        </div>
                    `).join('')}
                </div>
                ${items.length > 6 ? `<p class="text-muted text-center mt-10">+ ${items.length - 6} autres chambres</p>` : ''}
            ` : '<p class="text-muted text-center py-20">Aucun dispatch aujourd\'hui</p>'}
        </div>
    `;
}

function renderMaintenanceSection(tickets) {
    const items = tickets || [];
    return `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-wrench"></i> Tickets récents</h3>
                <button class="btn btn-sm btn-outline" onclick="navigateTo('maintenance')">Voir tout</button>
            </div>
            ${items.length ? `
                <table class="table-compact">
                    <tbody>
                        ${items.map(t => `
                            <tr onclick="navigateTo('maintenance')" style="cursor:pointer">
                                <td><strong>#${t.id}</strong></td>
                                <td>${esc(t.hotel_name)}</td>
                                <td>${LABELS.maintenance_cat[t.category] || t.category}</td>
                                <td>${priorityBadge(t.priority)}</td>
                                <td>${statusBadge(t.status)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p class="text-muted text-center py-20">Aucun ticket</p>'}
        </div>
    `;
}

function renderTasksSection(tasks) {
    const items = tasks || [];
    return `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-tasks"></i> Mes tâches</h3>
                <button class="btn btn-sm btn-outline" onclick="navigateTo('tasks')">Voir tout</button>
            </div>
            ${items.length ? `
                <div class="tasks-mini-list">
                    ${items.slice(0, 5).map(t => {
                        const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
                        return `
                            <div class="task-mini-item ${isOverdue ? 'overdue' : ''}" onclick="navigateTo('tasks')">
                                <span class="task-priority priority-${t.priority}"></span>
                                <div class="task-content">
                                    <div class="task-title">${esc(t.title)}</div>
                                    <div class="task-meta">
                                        ${t.due_date ? `<span class="${isOverdue ? 'text-danger' : ''}"><i class="fas fa-clock"></i> ${formatDate(t.due_date)}</span>` : ''}
                                    </div>
                                </div>
                                <span class="badge badge-${t.status === 'done' ? 'success' : t.status === 'in_progress' ? 'warning' : 'secondary'}">
                                    ${LABELS.status[t.status] || t.status}
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : '<p class="text-muted text-center py-20">Aucune tâche</p>'}
        </div>
    `;
}

function renderHotelsSection(hotels) {
    const items = hotels || [];
    return `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-building"></i> Mes hôtels</h3>
                ${['admin', 'groupe_manager'].includes(API.user.role) ? `
                    <button class="btn btn-sm btn-outline" onclick="navigateTo('hotels')">Gérer</button>
                ` : ''}
            </div>
            ${items.length ? `
                <div class="hotels-mini-list">
                    ${items.slice(0, 4).map(h => `
                        <div class="hotel-mini-item" onclick="navigateTo('hotels')">
                            <div class="hotel-avatar">
                                <i class="fas fa-hotel"></i>
                            </div>
                            <div class="hotel-info">
                                <div class="hotel-name-row">
                                    <span class="hotel-name">${esc(h.name)}</span>
                                    <span class="hotel-stars">${'⭐'.repeat(h.stars || 0)}</span>
                                </div>
                                <div class="hotel-meta">${esc(h.city) || 'Ville non définie'} · ${h.room_count || 0} chambres</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-muted text-center py-20">Aucun hôtel</p>'}
        </div>
    `;
}

function renderLeavesSection(leaves) {
    const items = leaves || [];
    return `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-calendar-alt"></i> Congés récents</h3>
                <button class="btn btn-sm btn-outline" onclick="navigateTo('leaves')">Voir tout</button>
            </div>
            ${items.length ? `
                <div class="leaves-mini-list">
                    ${items.slice(0, 4).map(l => `
                        <div class="leave-mini-item">
                            <div class="leave-avatar">${l.employee_name ? l.employee_name.charAt(0).toUpperCase() : '?'}</div>
                            <div class="leave-content">
                                <div class="leave-name">${esc(l.employee_name)}</div>
                                <div class="leave-dates">${formatDate(l.start_date)} → ${formatDate(l.end_date)}</div>
                            </div>
                            <span class="badge badge-${l.status === 'pending' ? 'warning' : l.status === 'approved' ? 'success' : 'danger'}">
                                ${LABELS.status[l.status] || l.status}
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-muted text-center py-20">Aucune demande</p>'}
        </div>
    `;
}

function renderEvaluationsSection(evaluations, stats) {
    const items = evaluations || [];
    return `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-clipboard-check"></i> Évaluations</h3>
                <button class="btn btn-sm btn-outline" onclick="navigateTo('evaluations')">Voir tout</button>
            </div>
            <div class="eval-summary">
                <div class="eval-stat">
                    <div class="eval-stat-value">${stats.evaluations_month || 0}</div>
                    <div class="eval-stat-label">Ce mois</div>
                </div>
            </div>
            ${items.length ? `
                <div class="evaluations-mini-list">
                    ${items.slice(0, 3).map(e => {
                        const score = e.score_weighted || e.score_simple || null;
                        const maxScore = e.score_weighted ? 100 : 10;
                        return `
                            <div class="eval-mini-item">
                                <div class="eval-avatar">${e.employee_name ? e.employee_name.charAt(0).toUpperCase() : '?'}</div>
                                <div class="eval-content">
                                    <div class="eval-employee">${esc(e.employee_name || 'Employé')}</div>
                                    <div class="eval-meta">${esc(e.grid_name || 'Grille')} · ${formatDate(e.evaluation_date)}</div>
                                </div>
                                <div class="eval-score ${getScoreClass(score)}">${score ? score.toFixed(1) : '-'}/${maxScore}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : '<p class="text-muted text-center py-10">Aucune évaluation récente</p>'}
        </div>
    `;
}

function renderLinenSection(linen) {
    const items = linen || [];
    return `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-tshirt"></i> Blanchisserie</h3>
                <button class="btn btn-sm btn-outline" onclick="navigateTo('linen')">Voir tout</button>
            </div>
            ${items.length ? `
                <div class="linen-mini-list">
                    ${items.slice(0, 4).map(l => `
                        <div class="linen-mini-item">
                            <span class="linen-type ${l.transaction_type}">
                                <i class="fas fa-${l.transaction_type === 'collecte' ? 'arrow-up' : 'arrow-down'}"></i>
                                ${l.transaction_type === 'collecte' ? 'Collecte' : 'Réception'}
                            </span>
                            <span class="linen-hotel">${esc(l.hotel_name)}</span>
                            <span class="linen-date">${formatDate(l.transaction_date)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="text-muted text-center py-20">Aucune transaction récente</p>'}
        </div>
    `;
}

function renderQuickActions(modules, canManage, isReception) {
    const actions = [];
    const isEnabled = (mod) => modules[mod] !== false && modules[mod] !== 'false';
    
    if (isEnabled('closures') && isReception) {
        actions.push({
            icon: 'fa-cash-register',
            label: 'Clôture journalière',
            color: 'red',
            onclick: "navigateTo('closures');setTimeout(closureSelectDate,100)"
        });
    }
    
    if (isEnabled('maintenance')) {
        actions.push({
            icon: 'fa-plus-circle',
            label: 'Nouveau ticket',
            color: 'orange',
            onclick: "navigateTo('maintenance');setTimeout(showNewTicketModal,100)"
        });
    }
    
    if (isEnabled('housekeeping') && canManage) {
        actions.push({
            icon: 'fa-broom',
            label: 'Dispatch',
            color: 'purple',
            onclick: "navigateTo('housekeeping')"
        });
    }
    
    if (isEnabled('audit') && canManage) {
        actions.push({
            icon: 'fa-clipboard-list',
            label: 'Nouvel audit',
            color: 'indigo',
            onclick: "navigateTo('audit')"
        });
    }
    
    if (isEnabled('tasks')) {
        actions.push({
            icon: 'fa-tasks',
            label: 'Mes tâches',
            color: 'cyan',
            onclick: "navigateTo('tasks')"
        });
    }
    
    if (isEnabled('leaves')) {
        actions.push({
            icon: 'fa-calendar-plus',
            label: 'Demander congé',
            color: 'teal',
            onclick: "navigateTo('leaves')"
        });
    }
    
    if (isEnabled('evaluations') && canManage) {
        actions.push({
            icon: 'fa-user-check',
            label: 'Évaluer',
            color: 'green',
            onclick: "navigateTo('evaluations')"
        });
    }
    
    if (actions.length === 0) return '';
    
    return `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-bolt"></i> Actions rapides</h3>
            </div>
            <div class="quick-actions">
                ${actions.map(a => `
                    <a href="#" class="quick-action ${a.color || ''}" onclick="event.preventDefault();${a.onclick}">
                        <i class="fas ${a.icon}"></i>
                        <span>${a.label}</span>
                    </a>
                `).join('')}
            </div>
        </div>
    `;
}

// ==================== HELPERS ====================

function getScoreClass(score) {
    if (!score) return '';
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-average';
    return 'score-low';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatMoney(amount) {
    return parseFloat(amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
