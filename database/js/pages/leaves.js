/**
 * Module Congés - Gestion complète avec workflow de validation
 */

const TRIMESTRES = [
    { id: 'T1', label: 'T1 (Jan-Mar)', start: '01-01', end: '03-31', deadline: '11-01', deadlineYear: -1 },
    { id: 'T2', label: 'T2 (Avr-Juin)', start: '04-01', end: '06-30', deadline: '02-01', deadlineYear: 0 },
    { id: 'T3', label: 'T3 (Juil-Sep)', start: '07-01', end: '09-30', deadline: '05-01', deadlineYear: 0 },
    { id: 'T4', label: 'T4 (Oct-Déc)', start: '10-01', end: '12-31', deadline: '08-01', deadlineYear: 0 }
];

const LEAVE_TYPES = [
    { value: 'cp', label: 'Congés payés', icon: 'umbrella-beach', color: '#3498db' },
    { value: 'maladie', label: 'Arrêt maladie', icon: 'notes-medical', color: '#e74c3c', requiresJustificatif: true }
];

let lvHotels = [];

async function loadLeaves(container) {
    showLoading(container);

    try {
        const mgmtRes = await API.getManagementInfo();
        lvHotels = mgmtRes.manageable_hotels || [];

        const [leavesRes, pendingRes, hotelLeavesRes, hotelsRes] = await Promise.all([
            API.getLeaves(),
            API.getLeavesPending(),
            API.getHotelLeaves(),
            API.getHotels()
        ]);

        const leaves = leavesRes.leaves || [];
        const pending = pendingRes.leaves || [];
        const hotelLeaves = hotelLeavesRes.leaves || [];
        const hotels = hotelsRes.hotels || [];
        const canValidate = hasPermission('leaves.validate');
        const canViewHistory = hasPermission('leaves.manage_all') || hasPermission('leaves.view');
        const canCreate = hasPermission('leaves.create');

        // Séparer mes demandes et celles à valider
        const myLeaves = leaves.filter(l => l.employee_id === API.user.id);
        const toValidate = canValidate ? pending : [];
        
        // Calculer les stats personnelles
        const myStats = {
            total: myLeaves.length,
            approved: myLeaves.filter(l => l.status === 'approved').length,
            pending: myLeaves.filter(l => l.status === 'pending').length,
            rejected: myLeaves.filter(l => l.status === 'rejected').length,
            totalDaysCP: myLeaves.filter(l => l.status === 'approved' && l.leave_type === 'cp').reduce((sum, l) => sum + (l.days_count || 0), 0),
            totalDaysMaladie: myLeaves.filter(l => l.status === 'approved' && l.leave_type === 'maladie').reduce((sum, l) => sum + (l.days_count || 0), 0)
        };

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-calendar-alt"></i> Gestion des congés</h3>
                    ${canCreate ? '<button class="btn btn-primary" onclick="lvNewLeaveModal()"><i class="fas fa-plus"></i> Nouvelle demande</button>' : ''}
                </div>

                <!-- Info trimestres -->
                <div class="leave-info">
                    <h4><i class="fas fa-info-circle"></i> Dates limites de pose</h4>
                    <div class="trimestre-grid">
                        ${TRIMESTRES.map(t => {
                            const deadline = lvGetDeadline(t);
                            const isPast = new Date(deadline) < new Date();
                            return `
                                <div class="trimestre-card ${isPast ? 'trimestre-past' : ''}">
                                    <div class="trimestre-id">${t.id}</div>
                                    <div class="trimestre-period">${t.label}</div>
                                    <div class="trimestre-deadline ${isPast ? 'text-danger' : 'text-success'}">
                                        <i class="fas fa-clock"></i> Avant le ${formatDateFR(deadline)}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <p class="text-muted mt-10"><i class="fas fa-exclamation-triangle"></i> Délai standard: 2 mois avant la date de début</p>
                </div>
            </div>

            ${toValidate.length ? `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-tasks"></i> Demandes à valider</h3>
                        <span class="badge badge-warning">${toValidate.length}</span>
                    </div>
                    <table>
                        <thead><tr><th>Employé</th><th>Type</th><th>Du</th><th>Au</th><th>Jours</th><th>Justificatif</th><th>Demandé le</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${toValidate.map(l => `
                                <tr class="${l.leave_type === 'maladie' ? 'row-maladie' : ''}">
                                    <td><strong>${esc(l.employee_name)}</strong></td>
                                    <td>
                                        <span class="leave-type-pill ${l.leave_type}">
                                            <i class="fas fa-${l.leave_type === 'maladie' ? 'notes-medical' : 'umbrella-beach'}"></i>
                                            ${LEAVE_TYPES.find(t => t.value === l.leave_type)?.label || l.leave_type}
                                        </span>
                                    </td>
                                    <td>${formatDateFR(l.start_date)}</td>
                                    <td>${formatDateFR(l.end_date)}</td>
                                    <td>${l.days_count || '-'}</td>
                                    <td>
                                        ${l.justificatif_url ? `
                                            <a href="${l.justificatif_url}" target="_blank" class="btn btn-xs btn-outline" title="Voir le justificatif">
                                                <i class="fas fa-file-pdf"></i> Voir
                                            </a>
                                        ` : '<span class="text-muted">-</span>'}
                                    </td>
                                    <td>${formatDateFR(l.created_at)}</td>
                                    <td>
                                        <div class="table-actions">
                                            <button onclick="lvApprove(${l.id})" class="btn-action-success" title="Approuver"><i class="fas fa-check"></i></button>
                                            <button onclick="lvRejectModal(${l.id})" class="btn-action-danger" title="Refuser"><i class="fas fa-times"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}

            <!-- Mon historique personnel -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-user-clock"></i> Mon historique</h3>
                </div>
                
                <!-- Statistiques personnelles -->
                <div class="my-leave-stats">
                    <div class="stat-card blue">
                        <div class="stat-icon"><i class="fas fa-umbrella-beach"></i></div>
                        <div class="stat-info">
                            <span class="stat-value">${myStats.totalDaysCP}</span>
                            <span class="stat-label">Jours CP pris</span>
                        </div>
                    </div>
                    <div class="stat-card red">
                        <div class="stat-icon"><i class="fas fa-notes-medical"></i></div>
                        <div class="stat-info">
                            <span class="stat-value">${myStats.totalDaysMaladie}</span>
                            <span class="stat-label">Jours maladie</span>
                        </div>
                    </div>
                    <div class="stat-card orange">
                        <div class="stat-icon"><i class="fas fa-hourglass-half"></i></div>
                        <div class="stat-info">
                            <span class="stat-value">${myStats.pending}</span>
                            <span class="stat-label">En attente</span>
                        </div>
                    </div>
                    <div class="stat-card green">
                        <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                        <div class="stat-info">
                            <span class="stat-value">${myStats.approved}</span>
                            <span class="stat-label">Validés</span>
                        </div>
                    </div>
                </div>
                
                <!-- Filtres pour mon historique -->
                <div class="my-history-filters">
                    <div class="filter-group">
                        <select id="my-history-status" class="form-control" onchange="lvFilterMyHistory()">
                            <option value="">Tous les statuts</option>
                            <option value="pending">En attente</option>
                            <option value="approved">Validés</option>
                            <option value="rejected">Refusés</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <select id="my-history-type" class="form-control" onchange="lvFilterMyHistory()">
                            <option value="">Tous les types</option>
                            <option value="cp">Congés payés</option>
                            <option value="maladie">Arrêts maladie</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <select id="my-history-year" class="form-control" onchange="lvFilterMyHistory()">
                            <option value="">Toutes les années</option>
                            ${[0, -1, -2, -3].map(offset => {
                                const y = new Date().getFullYear() + offset;
                                return `<option value="${y}">${y}</option>`;
                            }).join('')}
                        </select>
                    </div>
                </div>
                
                <div id="my-history-container">
                    ${lvRenderMyHistory(myLeaves)}
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-users"></i> Congés validés - Mes hôtels</h3>
                </div>
                <div class="leaves-filters">
                    <div class="filter-row">
                        ${hotels.length > 1 ? `
                            <div class="filter-group">
                                <label>Hôtel</label>
                                <select id="lv-hotel-filter" onchange="lvFilterHotelLeaves()" class="select-filter">
                                    <option value="">Tous les hôtels</option>
                                    ${hotels.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}
                                </select>
                            </div>
                        ` : ''}
                        <div class="filter-group">
                            <label>Du</label>
                            <input type="date" id="lv-date-start" class="input-filter" value="${new Date().toISOString().split('T')[0]}" onchange="lvFilterHotelLeaves()">
                        </div>
                        <div class="filter-group">
                            <label>Au</label>
                            <input type="date" id="lv-date-end" class="input-filter" value="${new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0]}" onchange="lvFilterHotelLeaves()">
                        </div>
                        <div class="filter-group filter-actions">
                            <button type="button" class="btn btn-sm btn-outline" onclick="lvResetFilters()"><i class="fas fa-undo"></i> Réinitialiser</button>
                        </div>
                    </div>
                </div>
                <div id="lv-hotel-leaves-container">
                    ${lvRenderHotelLeaves(hotelLeaves)}
                </div>
            </div>

            ${canValidate ? `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-user-plus"></i> Poser des congés pour un collaborateur</h3>
                    </div>
                    <p class="text-muted mb-20">En tant que responsable, vous pouvez saisir des congés pour les collaborateurs de vos hôtels sans restriction de délai.</p>
                    <button class="btn btn-outline" onclick="lvNewLeaveForOtherModal()"><i class="fas fa-user-plus"></i> Saisir pour un collaborateur</button>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-file-pdf"></i> Rapport des congés validés</h3>
                    </div>
                    <p class="text-muted mb-20">Générez un PDF récapitulatif des congés validés pour un trimestre. Le rapport ne peut être généré que si toutes les demandes ont été traitées et que la date limite de dépôt est passée.</p>
                    <form id="leave-report-form" onsubmit="lvGenerateReport(event)" class="form-inline-report">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Année</label>
                                <select name="year">
                                    ${[0, -1, -2].map(offset => {
                                        const y = new Date().getFullYear() + offset;
                                        return `<option value="${y}" ${offset === 0 ? 'selected' : ''}>${y}</option>`;
                                    }).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Trimestre</label>
                                <select name="quarter">
                                    ${TRIMESTRES.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
                                </select>
                            </div>
                            ${lvHotels.length > 1 ? `
                                <div class="form-group">
                                    <label>Hôtel</label>
                                    <select name="hotel_id">
                                        <option value="">Tous mes hôtels</option>
                                        ${lvHotels.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}
                                    </select>
                                </div>
                            ` : ''}
                            <div class="form-group form-group-btn">
                                <button type="submit" class="btn btn-primary"><i class="fas fa-file-pdf"></i> Générer le PDF</button>
                            </div>
                        </div>
                    </form>
                </div>
            ` : ''}
            
            ${canViewHistory ? `
                <!-- Section Historique complet pour managers/RH -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-history"></i> Historique des absences - Équipe</h3>
                        <button class="btn btn-sm btn-outline" onclick="lvExportHistory()">
                            <i class="fas fa-download"></i> Exporter
                        </button>
                    </div>
                    <div class="card-body">
                        <div class="history-filters">
                            <div class="filter-row">
                                ${lvHotels.length > 1 ? `
                                    <div class="filter-group">
                                        <label><i class="fas fa-building"></i> Hôtel</label>
                                        <select id="history-hotel" class="form-control" onchange="lvLoadHistory()">
                                            <option value="">Tous les hôtels</option>
                                            ${lvHotels.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}
                                        </select>
                                    </div>
                                ` : ''}
                                <div class="filter-group">
                                    <label><i class="fas fa-filter"></i> Type</label>
                                    <select id="history-type" class="form-control" onchange="lvLoadHistory()">
                                        <option value="">Tous les types</option>
                                        <option value="cp">Congés payés</option>
                                        <option value="maladie">Arrêts maladie</option>
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label><i class="fas fa-user"></i> Collaborateur</label>
                                    <select id="history-employee" class="form-control" onchange="lvLoadHistory()">
                                        <option value="">Tous</option>
                                    </select>
                                </div>
                                <div class="filter-group">
                                    <label><i class="fas fa-calendar"></i> Du</label>
                                    <input type="date" id="history-start" class="form-control" 
                                           value="${new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]}"
                                           onchange="lvLoadHistory()">
                                </div>
                                <div class="filter-group">
                                    <label><i class="fas fa-calendar-check"></i> Au</label>
                                    <input type="date" id="history-end" class="form-control" 
                                           value="${new Date().toISOString().split('T')[0]}"
                                           onchange="lvLoadHistory()">
                                </div>
                                <div class="filter-group">
                                    <label><i class="fas fa-check-circle"></i> Statut</label>
                                    <select id="history-status" class="form-control" onchange="lvLoadHistory()">
                                        <option value="">Tous</option>
                                        <option value="approved" selected>Validés</option>
                                        <option value="pending">En attente</option>
                                        <option value="rejected">Refusés</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div id="history-summary" class="history-summary"></div>
                        <div id="history-container" class="history-table-container">
                            <div class="loading-inline"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
        
        // Charger l'historique pour les managers/RH
        if (canViewHistory) {
            lvLoadHistory();
        }
        
        // Stocker les données pour le filtrage
        window.lvMyLeaves = myLeaves;
        
    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

// Rendu des congés validés de l'hôtel
function lvRenderHotelLeaves(leaves) {
    if (!leaves || leaves.length === 0) {
        return `
            <div class="empty-state" style="padding: 30px;">
                <i class="fas fa-calendar-check"></i>
                <h3>Aucun congé prévu</h3>
                <p class="text-muted">Aucun collaborateur n'a de congés validés sur cette période</p>
            </div>
        `;
    }
    
    // Grouper par mois
    const byMonth = {};
    leaves.forEach(l => {
        const startDate = new Date(l.start_date);
        const monthKey = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        if (!byMonth[monthKey]) {
            byMonth[monthKey] = [];
        }
        byMonth[monthKey].push(l);
    });
    
    let html = '';
    
    Object.entries(byMonth).forEach(([month, monthLeaves]) => {
        html += `
            <div class="hotel-leaves-month">
                <h4 class="month-header"><i class="fas fa-calendar"></i> ${month.charAt(0).toUpperCase() + month.slice(1)}</h4>
                <div class="leaves-timeline">
                    ${monthLeaves.map(l => {
                        const typeLabel = LEAVE_TYPES.find(t => t.value === l.leave_type)?.label || l.leave_type;
                        const roleLabel = LABELS.role[l.employee_role] || l.employee_role;
                        const isOngoing = new Date(l.start_date) <= new Date() && new Date(l.end_date) >= new Date();
                        
                        return `
                            <div class="leave-item ${isOngoing ? 'leave-ongoing' : ''}">
                                <div class="leave-avatar">${getInitials(l.employee_name)}</div>
                                <div class="leave-details">
                                    <div class="leave-employee">
                                        <strong>${esc(l.employee_name)}</strong>
                                        <span class="leave-role">${roleLabel}</span>
                                        ${l.hotel_name ? `<span class="leave-hotel">${esc(l.hotel_name)}</span>` : ''}
                                    </div>
                                    <div class="leave-info-line">
                                        <span class="leave-type-badge">${typeLabel}</span>
                                        <span class="leave-dates">
                                            <i class="fas fa-calendar-alt"></i> 
                                            ${formatDateFR(l.start_date)} → ${formatDateFR(l.end_date)}
                                        </span>
                                        <span class="leave-days">${l.days_count} jour${l.days_count > 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                                ${isOngoing ? '<span class="leave-status-ongoing">En cours</span>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });
    
    return html;
}

// Rendu de l'historique personnel
function lvRenderMyHistory(leaves) {
    if (!leaves || leaves.length === 0) {
        return `
            <div class="empty-state" style="padding: 30px;">
                <i class="fas fa-calendar-check"></i>
                <h3>Aucune demande</h3>
                <p class="text-muted">Vous n'avez pas encore fait de demande de congés</p>
            </div>
        `;
    }
    
    // Grouper par année
    const byYear = {};
    leaves.forEach(l => {
        const year = new Date(l.start_date).getFullYear();
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push(l);
    });
    
    let html = '<div class="my-history-list">';
    
    // Trier les années en ordre décroissant
    const sortedYears = Object.keys(byYear).sort((a, b) => b - a);
    
    sortedYears.forEach(year => {
        const yearLeaves = byYear[year];
        html += `
            <div class="history-year-group">
                <h4 class="history-year-header"><i class="fas fa-calendar"></i> ${year}</h4>
                <div class="history-cards">
                    ${yearLeaves.map(l => {
                        const typeInfo = LEAVE_TYPES.find(t => t.value === l.leave_type) || { label: l.leave_type, color: '#999', icon: 'calendar' };
                        const isOngoing = new Date(l.start_date) <= new Date() && new Date(l.end_date) >= new Date();
                        const isFuture = new Date(l.start_date) > new Date();
                        
                        return `
                            <div class="history-card ${l.status} ${l.leave_type}">
                                <div class="history-card-header">
                                    <span class="leave-type-pill" style="background: ${typeInfo.color}">
                                        <i class="fas fa-${typeInfo.icon}"></i> ${typeInfo.label}
                                    </span>
                                    ${lvStatusBadge(l.status)}
                                    ${isOngoing ? '<span class="badge badge-info">En cours</span>' : ''}
                                    ${isFuture ? '<span class="badge badge-secondary">À venir</span>' : ''}
                                </div>
                                <div class="history-card-body">
                                    <div class="history-dates">
                                        <i class="fas fa-calendar-alt"></i>
                                        <span>${formatDateFR(l.start_date)} → ${formatDateFR(l.end_date)}</span>
                                    </div>
                                    <div class="history-days">
                                        <strong>${l.days_count}</strong> jour${l.days_count > 1 ? 's' : ''}
                                    </div>
                                </div>
                                ${l.status === 'approved' || l.status === 'rejected' ? `
                                    <div class="history-card-footer">
                                        <small class="text-muted">
                                            ${l.status === 'approved' ? 'Validé' : 'Refusé'} par ${esc(l.validated_by_name || 'N/A')}
                                            ${l.validated_at ? ' le ' + formatDateFR(l.validated_at) : ''}
                                        </small>
                                        ${l.status === 'rejected' && l.rejection_reason ? `
                                            <div class="rejection-reason">
                                                <i class="fas fa-comment-alt"></i> ${esc(l.rejection_reason)}
                                            </div>
                                        ` : ''}
                                        ${l.status === 'approved' && l.approval_comment ? `
                                            <div class="approval-comment">
                                                <i class="fas fa-comment-alt"></i> ${esc(l.approval_comment)}
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}
                                ${l.justificatif_url ? `
                                    <div class="history-card-attachment">
                                        <a href="${l.justificatif_url}" target="_blank" class="btn btn-xs btn-outline">
                                            <i class="fas fa-file-pdf"></i> Voir justificatif
                                        </a>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Filtrer l'historique personnel
function lvFilterMyHistory() {
    const status = document.getElementById('my-history-status')?.value || '';
    const type = document.getElementById('my-history-type')?.value || '';
    const year = document.getElementById('my-history-year')?.value || '';
    const container = document.getElementById('my-history-container');
    
    if (!container || !window.lvMyLeaves) return;
    
    let filtered = window.lvMyLeaves;
    
    if (status) {
        filtered = filtered.filter(l => l.status === status);
    }
    
    if (type) {
        filtered = filtered.filter(l => l.leave_type === type);
    }
    
    if (year) {
        filtered = filtered.filter(l => new Date(l.start_date).getFullYear() === parseInt(year));
    }
    
    container.innerHTML = lvRenderMyHistory(filtered);
}

// Filtrer les congés par hôtel et dates
async function lvFilterHotelLeaves() {
    const hotelId = document.getElementById('lv-hotel-filter')?.value || '';
    const startDate = document.getElementById('lv-date-start')?.value || '';
    const endDate = document.getElementById('lv-date-end')?.value || '';
    const container = document.getElementById('lv-hotel-leaves-container');
    
    if (!container) return;
    
    container.innerHTML = '<div class="loading-inline"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';
    
    try {
        const params = {};
        if (hotelId) params.hotel_id = hotelId;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        
        const res = await API.getHotelLeaves(params);
        container.innerHTML = lvRenderHotelLeaves(res.leaves || []);
    } catch (e) {
        container.innerHTML = `<p class="text-danger" style="padding: 15px;">Erreur: ${e.message}</p>`;
    }
}

// Réinitialiser les filtres
function lvResetFilters() {
    const hotelFilter = document.getElementById('lv-hotel-filter');
    const startDate = document.getElementById('lv-date-start');
    const endDate = document.getElementById('lv-date-end');
    
    if (hotelFilter) hotelFilter.value = '';
    if (startDate) startDate.value = new Date().toISOString().split('T')[0];
    if (endDate) endDate.value = new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0];
    
    lvFilterHotelLeaves();
}

// Helper pour obtenir les initiales
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(p => p.charAt(0)).join('').substring(0, 2).toUpperCase();
}

function lvGetDeadline(trimestre) {
    const year = new Date().getFullYear();
    const deadlineYear = year + trimestre.deadlineYear;
    return `${deadlineYear}-${trimestre.deadline}`;
}

function lvStatusBadge(status) {
    const badges = {
        pending: '<span class="badge badge-warning">En attente</span>',
        approved: '<span class="badge badge-success">Approuvé</span>',
        rejected: '<span class="badge badge-danger">Refusé</span>',
        cancelled: '<span class="badge badge-secondary">Annulé</span>'
    };
    return badges[status] || status;
}

// ==================== HISTORIQUE DES ABSENCES ====================

async function lvLoadHistory() {
    const container = document.getElementById('history-container');
    const summaryContainer = document.getElementById('history-summary');
    
    if (!container) return;
    
    container.innerHTML = '<div class="loading-inline"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';
    
    const hotelId = document.getElementById('history-hotel')?.value || '';
    const leaveType = document.getElementById('history-type')?.value || '';
    const employeeId = document.getElementById('history-employee')?.value || '';
    const startDate = document.getElementById('history-start')?.value || '';
    const endDate = document.getElementById('history-end')?.value || '';
    const status = document.getElementById('history-status')?.value || '';
    
    try {
        const params = new URLSearchParams();
        if (hotelId) params.append('hotel_id', hotelId);
        if (leaveType) params.append('leave_type', leaveType);
        if (employeeId) params.append('employee_id', employeeId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (status) params.append('status', status);
        
        const res = await API.get(`/leaves/history?${params.toString()}`);
        const leaves = res.leaves || [];
        const stats = res.stats || {};
        
        // Mettre à jour la liste des employés si on change d'hôtel
        if (res.employees) {
            const employeeSelect = document.getElementById('history-employee');
            if (employeeSelect) {
                const currentValue = employeeSelect.value;
                employeeSelect.innerHTML = '<option value="">Tous</option>' + 
                    res.employees.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
                employeeSelect.value = currentValue;
            }
        }
        
        // Afficher les statistiques
        summaryContainer.innerHTML = `
            <div class="history-stats">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fas fa-calendar-check"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.total_cp || 0}</span>
                        <span class="stat-label">Jours CP</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red"><i class="fas fa-notes-medical"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.total_maladie || 0}</span>
                        <span class="stat-label">Jours Maladie</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fas fa-users"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.employees_count || 0}</span>
                        <span class="stat-label">Collaborateurs</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange"><i class="fas fa-file-alt"></i></div>
                    <div class="stat-info">
                        <span class="stat-value">${leaves.length}</span>
                        <span class="stat-label">Demandes</span>
                    </div>
                </div>
            </div>
        `;
        
        if (leaves.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px;">
                    <i class="fas fa-search"></i>
                    <h3>Aucun résultat</h3>
                    <p class="text-muted">Aucune absence trouvée pour les critères sélectionnés</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <table class="table history-table">
                <thead>
                    <tr>
                        <th>Collaborateur</th>
                        <th>Hôtel</th>
                        <th>Type</th>
                        <th>Du</th>
                        <th>Au</th>
                        <th>Jours</th>
                        <th>Statut</th>
                        <th>Justificatif</th>
                        <th>Validé par</th>
                    </tr>
                </thead>
                <tbody>
                    ${leaves.map(l => {
                        const typeInfo = LEAVE_TYPES.find(t => t.value === l.leave_type) || { label: l.leave_type, color: '#999', icon: 'calendar' };
                        return `
                            <tr class="${l.leave_type === 'maladie' ? 'row-maladie' : ''}">
                                <td>
                                    <div class="employee-cell">
                                        <div class="employee-avatar">${getInitials(l.employee_name)}</div>
                                        <div class="employee-info">
                                            <strong>${esc(l.employee_name)}</strong>
                                            <small>${LABELS.role[l.employee_role] || l.employee_role}</small>
                                        </div>
                                    </div>
                                </td>
                                <td>${esc(l.hotel_name || '-')}</td>
                                <td>
                                    <span class="leave-type-badge" style="background: ${typeInfo.color}">
                                        <i class="fas fa-${typeInfo.icon}"></i> ${typeInfo.label}
                                    </span>
                                </td>
                                <td>${formatDateFR(l.start_date)}</td>
                                <td>${formatDateFR(l.end_date)}</td>
                                <td><strong>${l.days_count}</strong></td>
                                <td>${lvStatusBadge(l.status)}</td>
                                <td>
                                    ${l.justificatif_url ? `
                                        <a href="${l.justificatif_url}" target="_blank" class="btn btn-xs btn-outline" title="Voir le justificatif">
                                            <i class="fas fa-file-pdf"></i>
                                        </a>
                                    ` : '<span class="text-muted">-</span>'}
                                </td>
                                <td>${esc(l.validated_by_name || '-')}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
}

async function lvExportHistory() {
    const hotelId = document.getElementById('history-hotel')?.value || '';
    const leaveType = document.getElementById('history-type')?.value || '';
    const employeeId = document.getElementById('history-employee')?.value || '';
    const startDate = document.getElementById('history-start')?.value || '';
    const endDate = document.getElementById('history-end')?.value || '';
    const status = document.getElementById('history-status')?.value || '';
    
    const params = new URLSearchParams();
    if (hotelId) params.append('hotel_id', hotelId);
    if (leaveType) params.append('leave_type', leaveType);
    if (employeeId) params.append('employee_id', employeeId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (status) params.append('status', status);
    
    try {
        const response = await fetch(`${API.baseUrl}/leaves/history-export?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${API.token}` }
        });
        
        if (!response.ok) throw new Error('Erreur export');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historique_absences_${startDate}_${endDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast('Export téléchargé', 'success');
    } catch (e) {
        toast('Erreur lors de l\'export', 'error');
    }
}

// Charger l'historique au chargement de la page (pour les managers)
setTimeout(() => {
    if (document.getElementById('history-container')) {
        lvLoadHistory();
    }
}, 500);

function lvNewLeaveModal() {
    const today = new Date().toISOString().split('T')[0];
    const minDate = lvGetMinDate();

    openModal('Nouvelle demande', `
        <form onsubmit="lvCreateLeave(event)" id="leave-form" enctype="multipart/form-data">
            <div class="leave-type-selector">
                <label class="leave-type-label">Type de demande *</label>
                <div class="leave-type-cards">
                    ${LEAVE_TYPES.map((t, i) => `
                        <div class="leave-type-card ${i === 0 ? 'selected' : ''}" onclick="lvSelectLeaveType('${t.value}')">
                            <input type="radio" name="leave_type" value="${t.value}" ${i === 0 ? 'checked' : ''} style="display:none">
                            <div class="leave-type-icon" style="background: ${t.color}">
                                <i class="fas fa-${t.icon}"></i>
                            </div>
                            <span class="leave-type-name">${t.label}</span>
                            ${t.requiresJustificatif ? '<span class="leave-type-badge-required">Justificatif obligatoire</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label><i class="fas fa-calendar-alt"></i> Date de début *</label>
                    <input type="date" name="start_date" required min="${today}" onchange="lvUpdateEndDateMin(this)">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-calendar-check"></i> Date de fin *</label>
                    <input type="date" name="end_date" required min="${today}">
                </div>
            </div>
            
            <!-- Section Justificatif (visible uniquement pour arrêt maladie) -->
            <div class="form-group" id="justificatif-section" style="display: none;">
                <label><i class="fas fa-file-medical"></i> Justificatif médical * <span class="text-danger">(Obligatoire)</span></label>
                <div class="upload-zone" id="justificatif-upload-zone"
                     onclick="document.getElementById('justificatif-input').click()"
                     ondragover="lvHandleDragOver(event)"
                     ondragleave="lvHandleDragLeave(event)"
                     ondrop="lvHandleDrop(event)">
                    <div class="upload-zone-content" id="upload-zone-content">
                        <div class="upload-icon"><i class="fas fa-cloud-upload-alt"></i></div>
                        <div class="upload-text">
                            <span class="upload-main">Glissez votre arrêt de travail ici</span>
                            <span class="upload-sub">ou cliquez pour sélectionner</span>
                        </div>
                        <div class="upload-formats">PDF uniquement (max 5Mo)</div>
                    </div>
                    <div class="upload-preview" id="upload-preview" style="display: none;">
                        <i class="fas fa-file-pdf"></i>
                        <span class="upload-filename"></span>
                        <button type="button" class="btn-remove-upload" onclick="lvRemoveJustificatif(event)">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <input type="file" id="justificatif-input" name="justificatif" accept=".pdf" 
                       style="display: none" onchange="lvHandleFileSelect(this)">
                <small class="text-muted">Certificat médical ou arrêt de travail du médecin</small>
            </div>
            
            <div class="form-group">
                <label><i class="fas fa-comment"></i> Commentaire</label>
                <textarea name="comment" rows="2" placeholder="Précisions éventuelles..."></textarea>
            </div>
            
            <div class="leave-info-box" id="leave-info-box">
                <i class="fas fa-info-circle"></i>
                <span>Pour les congés payés, un délai de 2 mois avant la date de début est recommandé.</span>
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Soumettre la demande</button>
            </div>
        </form>
    `);
}

function lvSelectLeaveType(type) {
    // Update visual selection
    document.querySelectorAll('.leave-type-card').forEach(card => {
        card.classList.remove('selected');
        if (card.querySelector(`input[value="${type}"]`)) {
            card.classList.add('selected');
            card.querySelector('input').checked = true;
        }
    });
    
    const justificatifSection = document.getElementById('justificatif-section');
    const justificatifInput = document.getElementById('justificatif-input');
    const infoBox = document.getElementById('leave-info-box');
    
    if (type === 'maladie') {
        justificatifSection.style.display = 'block';
        justificatifInput.required = true;
        infoBox.innerHTML = '<i class="fas fa-exclamation-triangle text-warning"></i> <span>Un justificatif médical (arrêt de travail) est <strong>obligatoire</strong> pour les arrêts maladie.</span>';
        infoBox.className = 'leave-info-box warning';
        
        // Remove min date restriction for sick leave
        document.querySelector('input[name="start_date"]').min = '';
    } else {
        justificatifSection.style.display = 'none';
        justificatifInput.required = false;
        infoBox.innerHTML = '<i class="fas fa-info-circle"></i> <span>Pour les congés payés, un délai de 2 mois avant la date de début est recommandé.</span>';
        infoBox.className = 'leave-info-box';
        
        // Restore min date for CP
        document.querySelector('input[name="start_date"]').min = lvGetMinDate();
    }
}

function lvUpdateEndDateMin(startInput) {
    const endInput = document.querySelector('input[name="end_date"]');
    if (endInput && startInput.value) {
        endInput.min = startInput.value;
        if (endInput.value && endInput.value < startInput.value) {
            endInput.value = startInput.value;
        }
    }
}

function lvHandleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('justificatif-upload-zone').classList.add('drag-over');
}

function lvHandleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('justificatif-upload-zone').classList.remove('drag-over');
}

function lvHandleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('justificatif-upload-zone').classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const input = document.getElementById('justificatif-input');
        if (files[0].type === 'application/pdf') {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(files[0]);
            input.files = dataTransfer.files;
            lvHandleFileSelect(input);
        } else {
            toast('Seuls les fichiers PDF sont acceptés', 'error');
        }
    }
}

function lvHandleFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (file.type !== 'application/pdf') {
            toast('Seuls les fichiers PDF sont acceptés', 'error');
            input.value = '';
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            toast('Le fichier ne doit pas dépasser 5Mo', 'error');
            input.value = '';
            return;
        }
        
        const contentDiv = document.getElementById('upload-zone-content');
        const previewDiv = document.getElementById('upload-preview');
        
        contentDiv.style.display = 'none';
        previewDiv.style.display = 'flex';
        previewDiv.querySelector('.upload-filename').textContent = file.name;
        
        document.getElementById('justificatif-upload-zone').classList.add('has-file');
    }
}

function lvRemoveJustificatif(event) {
    event.stopPropagation();
    
    const input = document.getElementById('justificatif-input');
    const contentDiv = document.getElementById('upload-zone-content');
    const previewDiv = document.getElementById('upload-preview');
    
    input.value = '';
    contentDiv.style.display = 'flex';
    previewDiv.style.display = 'none';
    document.getElementById('justificatif-upload-zone').classList.remove('has-file');
}

function lvGetMinDate() {
    // 2 mois à partir d'aujourd'hui
    const date = new Date();
    date.setMonth(date.getMonth() + 2);
    return date.toISOString().split('T')[0];
}

async function lvCreateLeave(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const leaveType = formData.get('leave_type');
    
    // Validation pour arrêt maladie
    if (leaveType === 'maladie') {
        const justificatif = formData.get('justificatif');
        if (!justificatif || justificatif.size === 0) {
            toast('Le justificatif médical est obligatoire pour un arrêt maladie', 'error');
            return;
        }
    }

    // Vérifier le délai de 2 mois pour les CP uniquement
    if (leaveType === 'cp') {
        const startDate = new Date(formData.get('start_date'));
        const minDate = new Date();
        minDate.setMonth(minDate.getMonth() + 2);

        if (startDate < minDate && !['admin', 'groupe_manager', 'hotel_manager'].includes(API.user.role)) {
            toast('Délai de 2 mois non respecté pour les congés payés', 'error');
            return;
        }
    }

    try {
        // Utiliser l'upload si justificatif présent
        const justificatif = formData.get('justificatif');
        if (justificatif && justificatif.size > 0) {
            await API.upload('/leaves', formData);
        } else {
            const data = Object.fromEntries(formData);
            delete data.justificatif;
            await API.createLeave(data);
        }
        
        toast('Demande soumise avec succès ! Les responsables ont été notifiés.', 'success');
        closeModal();
        loadLeaves(document.getElementById('page-content'));
    } catch (e) { 
        toast(e.message, 'error'); 
    }
}

async function lvNewLeaveForOtherModal() {
    // Charger les utilisateurs des hôtels gérés
    try {
        const usersRes = await API.getUsers();
        const users = usersRes.users || [];
        const today = new Date().toISOString().split('T')[0];

        openModal('Saisir des congés pour un collaborateur', `
            <form onsubmit="lvCreateLeaveForOther(event)" id="leave-other-form" enctype="multipart/form-data">
                <div class="form-group">
                    <label><i class="fas fa-user"></i> Collaborateur *</label>
                    <select name="employee_id" required class="form-control">
                        <option value="">Sélectionner...</option>
                        ${users.map(u => `<option value="${u.id}">${esc(u.first_name)} ${esc(u.last_name)} (${LABELS.role[u.role] || u.role})</option>`).join('')}
                    </select>
                </div>
                
                <div class="leave-type-selector">
                    <label class="leave-type-label">Type de demande *</label>
                    <div class="leave-type-cards">
                        ${LEAVE_TYPES.map((t, i) => `
                            <div class="leave-type-card ${i === 0 ? 'selected' : ''}" onclick="lvSelectLeaveTypeOther('${t.value}')">
                                <input type="radio" name="leave_type" value="${t.value}" ${i === 0 ? 'checked' : ''} style="display:none">
                                <div class="leave-type-icon" style="background: ${t.color}">
                                    <i class="fas fa-${t.icon}"></i>
                                </div>
                                <span class="leave-type-name">${t.label}</span>
                                ${t.requiresJustificatif ? '<span class="leave-type-badge-required">Justificatif obligatoire</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label><i class="fas fa-calendar-alt"></i> Date de début *</label>
                        <input type="date" name="start_date" required value="${today}">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-calendar-check"></i> Date de fin *</label>
                        <input type="date" name="end_date" required value="${today}">
                    </div>
                </div>
                
                <!-- Section Justificatif pour arrêt maladie -->
                <div class="form-group" id="justificatif-section-other" style="display: none;">
                    <label><i class="fas fa-file-medical"></i> Justificatif médical * <span class="text-danger">(Obligatoire)</span></label>
                    <div class="upload-zone" id="justificatif-upload-zone-other"
                         onclick="document.getElementById('justificatif-input-other').click()">
                        <div class="upload-zone-content" id="upload-zone-content-other">
                            <div class="upload-icon"><i class="fas fa-cloud-upload-alt"></i></div>
                            <div class="upload-text">
                                <span class="upload-main">Cliquez pour sélectionner</span>
                                <span class="upload-sub">PDF uniquement (max 5Mo)</span>
                            </div>
                        </div>
                        <div class="upload-preview" id="upload-preview-other" style="display: none;">
                            <i class="fas fa-file-pdf"></i>
                            <span class="upload-filename"></span>
                            <button type="button" class="btn-remove-upload" onclick="lvRemoveJustificatifOther(event)">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <input type="file" id="justificatif-input-other" name="justificatif" accept=".pdf" 
                           style="display: none" onchange="lvHandleFileSelectOther(this)">
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-comment"></i> Commentaire</label>
                    <textarea name="comment" rows="2" placeholder="Précisions..."></textarea>
                </div>
                
                <p class="text-muted"><i class="fas fa-info-circle"></i> Pas de restriction de délai pour les responsables.</p>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
                </div>
            </form>
        `);
    } catch (e) { toast(e.message, 'error'); }
}

function lvSelectLeaveTypeOther(type) {
    document.querySelectorAll('#leave-other-form .leave-type-card').forEach(card => {
        card.classList.remove('selected');
        if (card.querySelector(`input[value="${type}"]`)) {
            card.classList.add('selected');
            card.querySelector('input').checked = true;
        }
    });
    
    const justificatifSection = document.getElementById('justificatif-section-other');
    const justificatifInput = document.getElementById('justificatif-input-other');
    
    if (type === 'maladie') {
        justificatifSection.style.display = 'block';
        justificatifInput.required = true;
    } else {
        justificatifSection.style.display = 'none';
        justificatifInput.required = false;
    }
}

function lvHandleFileSelectOther(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (file.type !== 'application/pdf') {
            toast('Seuls les fichiers PDF sont acceptés', 'error');
            input.value = '';
            return;
        }
        
        const contentDiv = document.getElementById('upload-zone-content-other');
        const previewDiv = document.getElementById('upload-preview-other');
        
        contentDiv.style.display = 'none';
        previewDiv.style.display = 'flex';
        previewDiv.querySelector('.upload-filename').textContent = file.name;
    }
}

function lvRemoveJustificatifOther(event) {
    event.stopPropagation();
    
    const input = document.getElementById('justificatif-input-other');
    const contentDiv = document.getElementById('upload-zone-content-other');
    const previewDiv = document.getElementById('upload-preview-other');
    
    input.value = '';
    contentDiv.style.display = 'flex';
    previewDiv.style.display = 'none';
}

async function lvCreateLeaveForOther(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const leaveType = formData.get('leave_type');
    
    // Validation pour arrêt maladie
    if (leaveType === 'maladie') {
        const justificatif = formData.get('justificatif');
        if (!justificatif || justificatif.size === 0) {
            toast('Le justificatif médical est obligatoire pour un arrêt maladie', 'error');
            return;
        }
    }

    try {
        const justificatif = formData.get('justificatif');
        if (justificatif && justificatif.size > 0) {
            await API.upload('/leaves/for-other', formData);
        } else {
            const data = Object.fromEntries(formData);
            delete data.justificatif;
            await API.createLeaveForOther(data);
        }
        
        toast('Congés enregistrés avec succès', 'success');
        closeModal();
        loadLeaves(document.getElementById('page-content'));
    } catch (e) { toast(e.message, 'error'); }
}

async function lvApproveSubmit(e, id) {
    e.preventDefault();
    const comment = new FormData(e.target).get('comment') || '';
    try {
        await API.approveLeave(id, comment);
        toast('Demande approuvée', 'success');
        closeModal();
        loadLeaves(document.getElementById('page-content'));
    } catch (e) { toast(e.message, 'error'); }
}

function lvApprove(id) {
    openModal('Approuver la demande', `
        <form onsubmit="lvApproveSubmit(event, ${id})">
            <div class="form-group">
                <label>Commentaire (optionnel)</label>
                <textarea name="comment" rows="3" placeholder="Ajouter un commentaire si nécessaire..."></textarea>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-success"><i class="fas fa-check"></i> Approuver</button>
            </div>
        </form>
    `);
}

function lvRejectModal(id) {
    openModal('Refuser la demande', `
        <form onsubmit="lvReject(event, ${id})">
            <div class="form-group">
                <label>Motif du refus *</label>
                <textarea name="reason" rows="3" required placeholder="Expliquez le motif du refus..."></textarea>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-danger">Refuser</button>
            </div>
        </form>
    `);
}

async function lvReject(e, id) {
    e.preventDefault();
    const reason = new FormData(e.target).get('reason');
    try {
        await API.rejectLeave(id, reason);
        toast('Demande refusée', 'success');
        closeModal();
        loadLeaves(document.getElementById('page-content'));
    } catch (e) { toast(e.message, 'error'); }
}

function formatDateFR(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR');
}

// Génération du rapport PDF
async function lvGenerateReport(e) {
    e.preventDefault();
    const form = e.target;
    const year = form.querySelector('[name="year"]').value;
    const quarter = form.querySelector('[name="quarter"]').value;
    const hotelIdEl = form.querySelector('[name="hotel_id"]');
    const hotelId = hotelIdEl ? hotelIdEl.value : null;
    
    try {
        const res = await API.getLeaveReport(year, quarter, hotelId);
        
        if (!res.can_generate) {
            toast('Impossible de générer le rapport', 'error');
            return;
        }
        
        // Générer le PDF
        lvCreateLeavesPDF(res);
        
    } catch (error) {
        toast(error.message, 'error');
    }
}

function lvCreateLeavesPDF(data) {
    const printWindow = window.open('', '_blank');
    
    const leaves = data.leaves || [];
    const stats = data.stats || {};
    const year = data.year;
    const quarter = data.quarter;
    const hotelName = data.hotel_name || 'Tous les hôtels';
    
    // Grouper par employé
    const byEmployee = {};
    leaves.forEach(l => {
        const empName = l.employee_name;
        if (!byEmployee[empName]) {
            byEmployee[empName] = {
                name: empName,
                role: l.employee_role,
                leaves: [],
                totalDays: 0
            };
        }
        byEmployee[empName].leaves.push(l);
        byEmployee[empName].totalDays += l.days_count;
    });
    
    const employees = Object.values(byEmployee).sort((a, b) => a.name.localeCompare(b.name));
    const hasManualEntries = stats.manual_count > 0;
    
    // Labels des types de congés
    const typeLabels = {
        'cp': 'Congés payés',
        'rtt': 'RTT',
        'sans_solde': 'Sans solde',
        'maladie': 'Maladie',
        'autre': 'Autre'
    };
    
    // Période du trimestre
    const quarterPeriods = {
        'T1': 'Janvier - Mars',
        'T2': 'Avril - Juin',
        'T3': 'Juillet - Septembre',
        'T4': 'Octobre - Décembre'
    };
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Rapport Congés ${quarter} ${year} - ${hotelName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 11px; line-height: 1.4; }
        
        .header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #1E3A5F; }
        .header h1 { color: #1E3A5F; font-size: 20px; margin-bottom: 5px; }
        .header h2 { color: #666; font-size: 14px; font-weight: normal; margin-bottom: 8px; }
        .header .period { background: #1E3A5F; color: white; padding: 8px 20px; border-radius: 5px; display: inline-block; font-size: 12px; }
        
        .summary { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
        .summary-box { flex: 1; min-width: 120px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 5px; padding: 12px; text-align: center; }
        .summary-box .value { font-size: 22px; font-weight: bold; color: #1E3A5F; }
        .summary-box .label { font-size: 10px; color: #666; margin-top: 3px; }
        
        .by-type { margin-bottom: 20px; }
        .by-type h4 { font-size: 12px; color: #1E3A5F; margin-bottom: 8px; }
        .type-grid { display: flex; gap: 10px; flex-wrap: wrap; }
        .type-item { background: #e3f2fd; padding: 6px 12px; border-radius: 4px; font-size: 10px; }
        .type-item strong { color: #1565c0; }
        
        .employee-section { margin-bottom: 20px; page-break-inside: avoid; }
        .employee-header { background: #1E3A5F; color: white; padding: 10px 15px; border-radius: 5px 5px 0 0; display: flex; justify-content: space-between; align-items: center; }
        .employee-name { font-size: 13px; font-weight: bold; }
        .employee-total { background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 3px; font-size: 11px; }
        
        table { width: 100%; border-collapse: collapse; }
        th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-size: 10px; color: #666; border-bottom: 2px solid #ddd; }
        td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
        tr:hover { background: #fafafa; }
        
        .manual-marker { color: #e74c3c; font-weight: bold; }
        .manual-note { font-size: 10px; color: #e74c3c; margin-left: 3px; }
        
        .footer { margin-top: 30px; padding-top: 15px; border-top: 2px solid #1E3A5F; }
        .footer-note { font-size: 10px; color: #666; margin-bottom: 10px; }
        .footer-note .asterisk { color: #e74c3c; font-weight: bold; }
        .footer-info { text-align: center; font-size: 9px; color: #999; margin-top: 15px; }
        
        @media print { 
            body { padding: 10px; }
            .employee-section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📅 Rapport des Congés Validés</h1>
        <h2>${hotelName}</h2>
        <div class="period">${quarter} ${year} - ${quarterPeriods[quarter]}</div>
    </div>
    
    <div class="summary">
        <div class="summary-box">
            <div class="value">${employees.length}</div>
            <div class="label">Collaborateurs</div>
        </div>
        <div class="summary-box">
            <div class="value">${stats.total_requests || 0}</div>
            <div class="label">Congés validés</div>
        </div>
        <div class="summary-box">
            <div class="value">${stats.total_days || 0}</div>
            <div class="label">Jours au total</div>
        </div>
        ${hasManualEntries ? `
            <div class="summary-box">
                <div class="value">${stats.manual_count}</div>
                <div class="label">Saisies manuelles*</div>
            </div>
        ` : ''}
    </div>
    
    ${Object.keys(stats.by_type || {}).length > 0 ? `
        <div class="by-type">
            <h4>Répartition par type</h4>
            <div class="type-grid">
                ${Object.entries(stats.by_type).map(([type, info]) => `
                    <div class="type-item">
                        ${typeLabels[type] || type}: <strong>${info.count}</strong> (${info.days} jours)
                    </div>
                `).join('')}
            </div>
        </div>
    ` : ''}
    
    ${employees.length === 0 ? `
        <div style="text-align: center; padding: 40px; color: #666;">
            <p>Aucun congé validé pour ce trimestre.</p>
        </div>
    ` : employees.map(emp => `
        <div class="employee-section">
            <div class="employee-header">
                <span class="employee-name">${emp.name}</span>
                <span class="employee-total">${emp.totalDays} jour${emp.totalDays > 1 ? 's' : ''}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Du</th>
                        <th>Au</th>
                        <th>Jours</th>
                        <th>Validé par</th>
                        <th>Commentaire</th>
                    </tr>
                </thead>
                <tbody>
                    ${emp.leaves.map(l => `
                        <tr>
                            <td>
                                ${typeLabels[l.leave_type] || l.leave_type}
                                ${l.is_manual == 1 ? '<span class="manual-marker">*</span>' : ''}
                            </td>
                            <td>${new Date(l.start_date).toLocaleDateString('fr-FR')}</td>
                            <td>${new Date(l.end_date).toLocaleDateString('fr-FR')}</td>
                            <td><strong>${l.days_count}</strong></td>
                            <td>${l.validated_by_name || '-'}</td>
                            <td>${l.comment || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('')}
    
    <div class="footer">
        ${hasManualEntries ? `
            <div class="footer-note">
                <span class="asterisk">*</span> Les congés marqués d'un astérisque ont été saisis manuellement par un responsable pour le compte du collaborateur.
            </div>
        ` : ''}
        <div class="footer-info">
            <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
            <p>ACL GESTION - Module Congés</p>
        </div>
    </div>
    
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
}
