/**
 * Module Évaluations - Grilles personnalisables avec sections
 * Refonte complète - Style similaire au module Audit
 */

let evalHotels = [];
let evalGrids = [];
let evalCurrentGrid = null;
let evalQuestions = [];

async function loadEvaluations(container) {
    showLoading(container);
    try {
        const [mgmtRes, gridsRes, evalsRes] = await Promise.all([
            API.getManagementInfo(),
            API.getEvaluationGrids().catch(() => ({ grids: [] })),
            API.getEvaluations().catch(() => ({ evaluations: [] }))
        ]);
        
        evalHotels = mgmtRes.manageable_hotels || [];
        evalGrids = gridsRes.grids || [];
        const evaluations = evalsRes.evaluations || [];
        const canManageGrids = hasPermission('evaluations.grids');
        const canEvaluate = hasPermission('evaluations.evaluate');

        container.innerHTML = `
            <div class="tabs mb-20">
                <button class="tab-btn active" onclick="showEvalTab('list')">Évaluations</button>
                ${canManageGrids ? '<button class="tab-btn" onclick="showEvalTab(\'grids\')">Grilles</button>' : ''}
                <button class="tab-btn" onclick="showEvalTab('mine')">Mes évaluations</button>
                <button class="tab-btn" onclick="showEvalTab('stats')">Statistiques</button>
            </div>
            <div id="eval-tab-content"></div>
        `;
        
        showEvalTab('list');
    } catch (error) {
        container.innerHTML = '<div class="card"><p class="text-danger">Erreur: ' + error.message + '</p></div>';
    }
}

async function showEvalTab(tab) {
    document.querySelectorAll('.tab-btn').forEach((btn, i) => btn.classList.toggle('active', 
        (tab === 'list' && i === 0) || (tab === 'grids' && i === 1) || (tab === 'mine' && i === 2) || (tab === 'stats' && i === 3)));
    
    const content = document.getElementById('eval-tab-content');
    
    if (tab === 'list') await renderEvalList(content);
    else if (tab === 'grids') await renderGridsList(content);
    else if (tab === 'mine') await renderMyEvaluations(content);
    else if (tab === 'stats') await renderEvalStats(content);
}

// ==================== LISTE DES ÉVALUATIONS ====================

let evalFilters = {
    hotel_id: '',
    user_id: '',
    status: '',
    grid_id: '',
    date_from: '',
    date_to: ''
};
let evalListData = {
    evaluations: [],
    hotels: [],
    users: [],
    grids: []
};

async function renderEvalList(container) {
    const canEvaluate = hasPermission('evaluations.evaluate');
    const canViewTeam = hasPermission('evaluations.view_team');
    const canView = hasPermission('evaluations.view');
    
    try {
        // Charger les données pour les filtres
        const [evalRes, mgmtRes, gridsRes] = await Promise.all([
            API.getEvaluations(evalFilters),
            API.getManagementInfo(),
            API.getEvaluationGrids().catch(() => ({ grids: [] }))
        ]);
        
        const evaluations = evalRes.evaluations || [];
        evalListData.evaluations = evaluations;
        evalListData.hotels = mgmtRes.manageable_hotels || [];
        evalListData.grids = gridsRes.grids || [];
        
        // Extraire les utilisateurs uniques des évaluations pour le filtre
        const usersMap = {};
        evaluations.forEach(e => {
            if (!usersMap[e.evaluated_user_id]) {
                usersMap[e.evaluated_user_id] = { id: e.evaluated_user_id, name: e.evaluated_name, role: e.evaluated_role };
            }
        });
        evalListData.users = Object.values(usersMap);
        
        // Compter les filtres actifs
        const activeFiltersCount = Object.values(evalFilters).filter(v => v !== '').length;
        
        // Stats par statut
        const statsByStatus = {
            draft: evaluations.filter(e => e.status === 'draft').length,
            validated: evaluations.filter(e => e.status === 'validated').length,
            archived: evaluations.filter(e => e.status === 'archived').length
        };
        
        container.innerHTML = `
            <div class="eval-list-container">
                <!-- Header avec stats -->
                <div class="eval-header-card">
                    <div class="eval-header-top">
                        <div class="eval-header-title">
                            <h2><i class="fas fa-clipboard-check"></i> Évaluations${canViewTeam ? ' de l\'équipe' : ''}</h2>
                            <p class="eval-subtitle">Suivi des performances de vos collaborateurs</p>
                        </div>
                        ${canEvaluate ? `
                            <button class="btn btn-primary btn-lg" onclick="evalShowNewModal()">
                                <i class="fas fa-plus"></i> Nouvelle évaluation
                            </button>
                        ` : ''}
                    </div>
                    
                    <!-- Stats rapides -->
                    <div class="eval-quick-stats">
                        <div class="eval-stat-card" onclick="setEvalStatusFilter('')">
                            <div class="eval-stat-icon total"><i class="fas fa-layer-group"></i></div>
                            <div class="eval-stat-info">
                                <span class="eval-stat-value">${evaluations.length}</span>
                                <span class="eval-stat-label">Total</span>
                            </div>
                        </div>
                        <div class="eval-stat-card ${evalFilters.status === 'draft' ? 'active' : ''}" onclick="setEvalStatusFilter('draft')">
                            <div class="eval-stat-icon draft"><i class="fas fa-edit"></i></div>
                            <div class="eval-stat-info">
                                <span class="eval-stat-value">${statsByStatus.draft}</span>
                                <span class="eval-stat-label">Brouillons</span>
                            </div>
                        </div>
                        <div class="eval-stat-card ${evalFilters.status === 'validated' ? 'active' : ''}" onclick="setEvalStatusFilter('validated')">
                            <div class="eval-stat-icon validated"><i class="fas fa-check-circle"></i></div>
                            <div class="eval-stat-info">
                                <span class="eval-stat-value">${statsByStatus.validated}</span>
                                <span class="eval-stat-label">Validées</span>
                            </div>
                        </div>
                        <div class="eval-stat-card ${evalFilters.status === 'archived' ? 'active' : ''}" onclick="setEvalStatusFilter('archived')">
                            <div class="eval-stat-icon archived"><i class="fas fa-archive"></i></div>
                            <div class="eval-stat-info">
                                <span class="eval-stat-value">${statsByStatus.archived}</span>
                                <span class="eval-stat-label">Archivées</span>
                            </div>
                        </div>
                        ${evaluations.length > 0 ? `
                            <div class="eval-stat-card score">
                                <div class="eval-stat-icon score"><i class="fas fa-chart-line"></i></div>
                                <div class="eval-stat-info">
                                    <span class="eval-stat-value">${calcAvgScore(evaluations)}%</span>
                                    <span class="eval-stat-label">Score moyen</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Filtres modernes -->
                <div class="eval-filters-card">
                    <div class="eval-filters-header">
                        <span class="eval-filters-title">
                            <i class="fas fa-filter"></i> Filtres
                            ${activeFiltersCount > 0 ? `<span class="filter-badge">${activeFiltersCount}</span>` : ''}
                        </span>
                        ${activeFiltersCount > 0 ? `
                            <button class="btn-reset-filters" onclick="resetEvalFilters()">
                                <i class="fas fa-times"></i> Réinitialiser
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="eval-filters-grid">
                        <!-- Filtre Hôtel -->
                        <div class="eval-filter-item">
                            <div class="eval-filter-label"><i class="fas fa-building"></i> Hôtel</div>
                            <div class="eval-filter-chips" id="filter-chips-hotel">
                                <button class="filter-chip ${!evalFilters.hotel_id ? 'active' : ''}" onclick="setEvalHotelFilter('')">
                                    Tous
                                </button>
                                ${evalListData.hotels.map(h => `
                                    <button class="filter-chip ${evalFilters.hotel_id == h.id ? 'active' : ''}" onclick="setEvalHotelFilter('${h.id}')">
                                        ${esc(h.name)}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Filtre Grille -->
                        <div class="eval-filter-item">
                            <div class="eval-filter-label"><i class="fas fa-th-list"></i> Grille</div>
                            <div class="eval-filter-chips" id="filter-chips-grid">
                                <button class="filter-chip ${!evalFilters.grid_id ? 'active' : ''}" onclick="setEvalGridFilter('')">
                                    Toutes
                                </button>
                                ${evalListData.grids.slice(0, 5).map(g => `
                                    <button class="filter-chip ${evalFilters.grid_id == g.id ? 'active' : ''}" onclick="setEvalGridFilter('${g.id}')">
                                        ${esc(g.name.length > 20 ? g.name.substring(0, 20) + '...' : g.name)}
                                    </button>
                                `).join('')}
                                ${evalListData.grids.length > 5 ? `
                                    <button class="filter-chip more" onclick="showGridFilterDropdown(event)">
                                        +${evalListData.grids.length - 5} <i class="fas fa-chevron-down"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        
                        <!-- Filtre Collaborateur -->
                        <div class="eval-filter-item">
                            <div class="eval-filter-label"><i class="fas fa-user"></i> Collaborateur</div>
                            <div class="eval-filter-search">
                                <div class="search-input-wrapper">
                                    <i class="fas fa-search"></i>
                                    <input type="text" 
                                           id="eval-user-search" 
                                           placeholder="Rechercher un collaborateur..."
                                           oninput="filterUserChips(this.value)"
                                           autocomplete="off">
                                    ${evalFilters.user_id ? `
                                        <button class="search-clear" onclick="setEvalUserFilter('')">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    ` : ''}
                                </div>
                                <div class="user-chips-container" id="user-chips-container">
                                    ${evalFilters.user_id ? `
                                        <div class="selected-user-chip">
                                            <i class="fas fa-user-check"></i>
                                            ${esc(evalListData.users.find(u => u.id == evalFilters.user_id)?.name || 'Sélectionné')}
                                            <button onclick="setEvalUserFilter('')"><i class="fas fa-times"></i></button>
                                        </div>
                                    ` : `
                                        <div class="user-chips-list" id="user-chips-list">
                                            ${evalListData.users.slice(0, 8).map(u => `
                                                <button class="user-chip" onclick="setEvalUserFilter('${u.id}')">
                                                    <span class="user-chip-avatar">${u.name.charAt(0)}</span>
                                                    <span class="user-chip-name">${esc(u.name.split(' ')[0])}</span>
                                                </button>
                                            `).join('')}
                                            ${evalListData.users.length > 8 ? `<span class="more-users">+${evalListData.users.length - 8}</span>` : ''}
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Filtre Période -->
                        <div class="eval-filter-item">
                            <div class="eval-filter-label"><i class="fas fa-calendar-alt"></i> Période</div>
                            <div class="eval-date-filters">
                                <div class="date-presets">
                                    <button class="date-preset ${isCurrentMonth() ? 'active' : ''}" onclick="setEvalDatePreset('month')">
                                        Ce mois
                                    </button>
                                    <button class="date-preset ${isCurrentQuarter() ? 'active' : ''}" onclick="setEvalDatePreset('quarter')">
                                        Ce trimestre
                                    </button>
                                    <button class="date-preset ${isCurrentYear() ? 'active' : ''}" onclick="setEvalDatePreset('year')">
                                        Cette année
                                    </button>
                                    <button class="date-preset ${!evalFilters.date_from && !evalFilters.date_to ? 'active' : ''}" onclick="setEvalDatePreset('all')">
                                        Tout
                                    </button>
                                </div>
                                <div class="date-range-inputs">
                                    <div class="date-input-wrapper">
                                        <label>Du</label>
                                        <input type="date" id="eval-filter-date-from" value="${evalFilters.date_from}" onchange="applyEvalFilters()">
                                    </div>
                                    <span class="date-separator">→</span>
                                    <div class="date-input-wrapper">
                                        <label>Au</label>
                                        <input type="date" id="eval-filter-date-to" value="${evalFilters.date_to}" onchange="applyEvalFilters()">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="eval-filters-actions">
                        <button class="btn btn-outline" onclick="exportEvalList()">
                            <i class="fas fa-file-excel"></i> Exporter Excel
                        </button>
                    </div>
                </div>
                
                <!-- Liste des évaluations -->
                <div class="eval-results-card">
                    ${evaluations.length ? `
                        <div class="eval-list-grid">
                            ${evaluations.map(e => `
                                <div class="eval-item-card" onclick="evalOpen(${e.id})">
                                    <div class="eval-item-header">
                                        <span class="eval-item-date">
                                            <i class="fas fa-calendar"></i> ${formatDateEval(e.evaluation_date)}
                                        </span>
                                        ${evalStatusBadge(e.status)}
                                    </div>
                                    <div class="eval-item-body">
                                        <div class="eval-item-user">
                                            <div class="eval-user-avatar">${e.evaluated_name.charAt(0)}</div>
                                            <div class="eval-user-info">
                                                <strong>${esc(e.evaluated_name)}</strong>
                                                <small>${LABELS.role[e.evaluated_role] || e.evaluated_role}</small>
                                            </div>
                                        </div>
                                        <div class="eval-item-meta">
                                            <span class="eval-meta-item">
                                                <i class="fas fa-th-list"></i> ${esc(e.grid_name)}
                                            </span>
                                            <span class="eval-meta-item">
                                                <i class="fas fa-building"></i> ${esc(e.hotel_name)}
                                            </span>
                                            <span class="eval-meta-item">
                                                <i class="fas fa-user-edit"></i> ${esc(e.evaluator_name)}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="eval-item-footer">
                                        <div class="eval-item-score">
                                            ${e.score_weighted ? `
                                                <div class="score-circle ${evalScoreClass(e.score_weighted)}">
                                                    ${e.score_weighted.toFixed(0)}%
                                                </div>
                                            ` : (e.score_simple ? `
                                                <div class="score-circle ${evalScoreClass(e.score_simple * 10)}">
                                                    ${e.score_simple}/10
                                                </div>
                                            ` : `
                                                <div class="score-circle pending">
                                                    <i class="fas fa-hourglass-half"></i>
                                                </div>
                                            `)}
                                        </div>
                                        <div class="eval-item-actions">
                                            <button class="btn-action" onclick="event.stopPropagation(); evalOpen(${e.id})" title="Voir/Modifier">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            ${e.status === 'validated' || e.status === 'archived' ? `
                                                <button class="btn-action pdf" onclick="event.stopPropagation(); evalExportPDF(${e.id})" title="Exporter PDF">
                                                    <i class="fas fa-file-pdf"></i>
                                                </button>
                                            ` : ''}
                                            ${e.status === 'draft' && canEvaluate ? `
                                                <button class="btn-action delete" onclick="event.stopPropagation(); evalDelete(${e.id})" title="Supprimer">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="eval-empty-state">
                            <div class="empty-icon"><i class="fas fa-clipboard-list"></i></div>
                            <h3>Aucune évaluation</h3>
                            <p>Aucune évaluation ne correspond aux critères sélectionnés</p>
                            ${activeFiltersCount > 0 ? `
                                <button class="btn btn-outline" onclick="resetEvalFilters()">
                                    <i class="fas fa-times"></i> Réinitialiser les filtres
                                </button>
                            ` : (canEvaluate ? `
                                <button class="btn btn-primary" onclick="evalShowNewModal()">
                                    <i class="fas fa-plus"></i> Créer une évaluation
                                </button>
                            ` : '')}
                        </div>
                    `}
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="card"><p class="text-danger">Erreur: ' + error.message + '</p></div>';
    }
}

function calcAvgScore(evaluations) {
    const withScore = evaluations.filter(e => e.score_weighted || e.score_simple);
    if (withScore.length === 0) return '-';
    const sum = withScore.reduce((acc, e) => acc + (e.score_weighted || (e.score_simple * 10)), 0);
    return (sum / withScore.length).toFixed(1);
}

// Fonctions de filtrage
function setEvalStatusFilter(status) {
    evalFilters.status = evalFilters.status === status ? '' : status;
    renderEvalList(document.getElementById('eval-tab-content'));
}

function setEvalHotelFilter(hotelId) {
    evalFilters.hotel_id = hotelId;
    renderEvalList(document.getElementById('eval-tab-content'));
}

function setEvalGridFilter(gridId) {
    evalFilters.grid_id = gridId;
    renderEvalList(document.getElementById('eval-tab-content'));
}

function setEvalUserFilter(userId) {
    evalFilters.user_id = userId;
    renderEvalList(document.getElementById('eval-tab-content'));
}

function setEvalDatePreset(preset) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    switch(preset) {
        case 'month':
            evalFilters.date_from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            evalFilters.date_to = new Date(year, month + 1, 0).toISOString().split('T')[0];
            break;
        case 'quarter':
            const quarterStart = Math.floor(month / 3) * 3;
            evalFilters.date_from = `${year}-${String(quarterStart + 1).padStart(2, '0')}-01`;
            evalFilters.date_to = new Date(year, quarterStart + 3, 0).toISOString().split('T')[0];
            break;
        case 'year':
            evalFilters.date_from = `${year}-01-01`;
            evalFilters.date_to = `${year}-12-31`;
            break;
        case 'all':
            evalFilters.date_from = '';
            evalFilters.date_to = '';
            break;
    }
    renderEvalList(document.getElementById('eval-tab-content'));
}

function isCurrentMonth() {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return evalFilters.date_from === monthStart;
}

function isCurrentQuarter() {
    const now = new Date();
    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
    const qStart = `${now.getFullYear()}-${String(quarterStart + 1).padStart(2, '0')}-01`;
    return evalFilters.date_from === qStart;
}

function isCurrentYear() {
    const now = new Date();
    return evalFilters.date_from === `${now.getFullYear()}-01-01`;
}

function filterUserChips(searchTerm) {
    const container = document.getElementById('user-chips-list');
    if (!container) return;
    
    const filtered = evalListData.users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    container.innerHTML = filtered.slice(0, 8).map(u => `
        <button class="user-chip" onclick="setEvalUserFilter('${u.id}')">
            <span class="user-chip-avatar">${u.name.charAt(0)}</span>
            <span class="user-chip-name">${esc(u.name.split(' ')[0])}</span>
        </button>
    `).join('') + (filtered.length > 8 ? `<span class="more-users">+${filtered.length - 8}</span>` : '');
}

function applyEvalFilters() {
    evalFilters.hotel_id = document.getElementById('eval-filter-hotel')?.value || evalFilters.hotel_id;
    evalFilters.date_from = document.getElementById('eval-filter-date-from')?.value || '';
    evalFilters.date_to = document.getElementById('eval-filter-date-to')?.value || '';
    
    renderEvalList(document.getElementById('eval-tab-content'));
}

function resetEvalFilters() {
    evalFilters = { hotel_id: '', user_id: '', status: '', grid_id: '', date_from: '', date_to: '' };
    renderEvalList(document.getElementById('eval-tab-content'));
}

async function exportEvalList() {
    toast('Export en cours...', 'info');
    // TODO: Implémenter l'export Excel
    toast('Fonctionnalité à venir', 'warning');
}

// ==================== LISTE DES GRILLES ====================

async function renderGridsList(container) {
    try {
        const res = await API.getEvaluationGrids();
        const grids = res.grids || [];
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-th-list"></i> Grilles d'évaluation</h3>
                    <button class="btn btn-primary" onclick="evalCreateGrid()"><i class="fas fa-plus"></i> Nouvelle grille</button>
                </div>
                ${grids.length ? `
                    <div class="audit-grids-list">
                        ${grids.map(g => `
                            <div class="audit-grid-card">
                                <div class="audit-grid-info">
                                    <h5>${esc(g.name)}</h5>
                                    <p>${g.instructions ? esc(g.instructions.substring(0, 100)) + '...' : 'Pas de description'}</p>
                                    <div class="audit-grid-meta">
                                        <span><i class="fas fa-building"></i> ${g.hotel_name || 'Tous les hôtels'}</span>
                                        <span><i class="fas fa-user-tag"></i> ${LABELS.role[g.target_role] || g.target_role}</span>
                                        <span><i class="fas fa-question-circle"></i> ${g.question_count || 0} questions</span>
                                        <span class="badge badge-${g.is_active == 1 ? 'success' : 'secondary'}">${g.is_active == 1 ? 'Active' : 'Inactive'}</span>
                                    </div>
                                </div>
                                <div class="table-actions">
                                    <button onclick="evalEditGrid(${g.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                                    <button onclick="evalDuplicateGrid(${g.id})" title="Dupliquer"><i class="fas fa-copy"></i></button>
                                    <button onclick="evalDeleteGrid(${g.id})" title="Supprimer"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="empty-state"><i class="fas fa-th-list"></i><h3>Aucune grille</h3><p>Créez votre première grille d\'évaluation</p></div>'}
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="card"><p class="text-danger">Erreur: ' + error.message + '</p></div>';
    }
}

// ==================== MES ÉVALUATIONS ====================

async function renderMyEvaluations(container) {
    try {
        const res = await API.getMyEvaluations();
        const evaluations = res.evaluations || [];
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-user-check"></i> Mes évaluations</h3>
                </div>
                ${evaluations.length ? `
                    <table>
                        <thead><tr><th>Date</th><th>Grille</th><th>Évaluateur</th><th>Score</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${evaluations.map(e => `
                                <tr>
                                    <td>${formatDateEval(e.evaluation_date)}</td>
                                    <td>${esc(e.grid_name)}</td>
                                    <td>${esc(e.evaluator_name)}</td>
                                    <td><span class="eval-score ${evalScoreClass((e.score_weighted || e.score_simple * 10))}">${e.score_weighted ? e.score_weighted.toFixed(1) + '%' : e.score_simple + '/10'}</span></td>
                                    <td><button class="btn btn-sm btn-outline" onclick="evalOpen(${e.id})"><i class="fas fa-eye"></i> Voir</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div class="empty-state"><i class="fas fa-clipboard-list"></i><h3>Aucune évaluation</h3><p>Vous n\'avez pas encore été évalué</p></div>'}
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="card"><p class="text-danger">Erreur: ' + error.message + '</p></div>';
    }
}

// ==================== STATISTIQUES ====================

async function renderEvalStats(container) {
    try {
        const res = await API.getEvaluationStats();
        const stats = res.stats || {};
        const byCategory = res.by_category || [];
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-chart-bar"></i> Statistiques</h3>
                </div>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${stats.total || 0}</div>
                        <div class="stat-label">Évaluations validées</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value ${evalScoreClass((stats.avg_score || 0) * 10)}">${stats.avg_score ? parseFloat(stats.avg_score).toFixed(1) : '-'}/10</div>
                        <div class="stat-label">Score moyen</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.min_score ? parseFloat(stats.min_score).toFixed(1) : '-'}</div>
                        <div class="stat-label">Score min</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.max_score ? parseFloat(stats.max_score).toFixed(1) : '-'}</div>
                        <div class="stat-label">Score max</div>
                    </div>
                </div>
                ${byCategory.length ? `
                    <h4 class="mt-20">Scores par section</h4>
                    <table>
                        <thead><tr><th>Section</th><th>Score moyen</th></tr></thead>
                        <tbody>
                            ${byCategory.map(c => `<tr><td>${esc(c.category)}</td><td><span class="eval-score ${evalScoreClass(c.avg_score * 10)}">${parseFloat(c.avg_score).toFixed(1)}/10</span></td></tr>`).join('')}
                        </tbody>
                    </table>
                ` : ''}
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="card"><p class="text-danger">Erreur: ' + error.message + '</p></div>';
    }
}

// ==================== CRÉATION/ÉDITION DE GRILLE ====================

async function evalCreateGrid() {
    evalCurrentGrid = null;
    evalQuestions = [];
    await evalShowGridEditor();
}

async function evalEditGrid(gridId) {
    try {
        const res = await API.getEvaluationGrid(gridId);
        evalCurrentGrid = res.grid;
        evalQuestions = (res.questions || []).map(q => ({
            id: q.id,
            section: q.category || null,
            question: q.question_text,
            weight: q.weight || 1,
            response_type: q.response_type || 'score',
            min_score: q.min_score || 1,
            max_score: q.max_score || 10,
            choices: q.choices || null,
            multiple_selection: q.multiple_selection || 0,
            comment_required: q.comment_required || 0,
            file_optional: q.file_optional || 0,
            file_required: q.file_required || 0,
            sort_order: q.position || 0
        }));
        await evalShowGridEditor();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function evalShowGridEditor() {
    const grid = evalCurrentGrid || {};
    const isEdit = !!grid.id;

    const container = document.getElementById('page-content');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-clipboard-list"></i> ${isEdit ? 'Modifier la grille' : 'Nouvelle grille d\'évaluation'}</h3>
                <div>
                    <button class="btn btn-outline" onclick="loadEvaluations(document.getElementById('page-content'))">
                        <i class="fas fa-arrow-left"></i> Retour
                    </button>
                    <button class="btn btn-primary" onclick="evalSaveGrid()">
                        <i class="fas fa-save"></i> Enregistrer
                    </button>
                </div>
            </div>

            <form id="eval-grid-form">
                <!-- Informations générales -->
                <div class="form-section">
                    <h4><i class="fas fa-info-circle"></i> Informations générales</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Nom de la grille *</label>
                            <input type="text" name="name" value="${esc(grid.name || '')}" required placeholder="Ex: Évaluation trimestrielle employés">
                        </div>
                        <div class="form-group">
                            <label>Hôtel concerné</label>
                            <select name="hotel_id">
                                <option value="">Tous les hôtels</option>
                                ${evalHotels.map(h => `<option value="${h.id}" ${grid.hotel_id == h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Instructions</label>
                        <textarea name="instructions" rows="2" placeholder="Instructions affichées au début du formulaire...">${esc(grid.instructions || '')}</textarea>
                    </div>
                </div>

                <!-- Configuration -->
                <div class="form-section">
                    <h4><i class="fas fa-cog"></i> Configuration</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Rôle cible *</label>
                            <select name="target_role" required>
                                <option value="employee" ${grid.target_role === 'employee' ? 'selected' : ''}>Employé</option>
                                <option value="receptionniste" ${grid.target_role === 'receptionniste' ? 'selected' : ''}>Réceptionniste</option>
                                <option value="hotel_manager" ${grid.target_role === 'hotel_manager' ? 'selected' : ''}>Resp. Hôtel</option>
                                <option value="comptabilite" ${grid.target_role === 'comptabilite' ? 'selected' : ''}>Comptabilité</option>
                                <option value="rh" ${grid.target_role === 'rh' ? 'selected' : ''}>Ressources Humaines</option>
                                <option value="groupe_manager" ${grid.target_role === 'groupe_manager' ? 'selected' : ''}>Resp. Groupe</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Périodicité</label>
                            <select name="periodicity">
                                <option value="monthly" ${grid.periodicity === 'monthly' ? 'selected' : ''}>Mensuel</option>
                                <option value="quarterly" ${grid.periodicity === 'quarterly' || !grid.periodicity ? 'selected' : ''}>Trimestriel</option>
                                <option value="annual" ${grid.periodicity === 'annual' ? 'selected' : ''}>Annuel</option>
                                <option value="one_time" ${grid.periodicity === 'one_time' ? 'selected' : ''}>Ponctuel</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Statut</label>
                            <select name="is_active">
                                <option value="1" ${grid.is_active != 0 ? 'selected' : ''}>Active</option>
                                <option value="0" ${grid.is_active == 0 ? 'selected' : ''}>Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>
            </form>
        </div>

        <!-- Questions -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-question-circle"></i> Questions (${evalQuestions.length})</h3>
                <div>
                    <button class="btn btn-outline" onclick="evalAddSection()"><i class="fas fa-folder-plus"></i> Ajouter section</button>
                    <button class="btn btn-primary" onclick="evalAddQuestion()"><i class="fas fa-plus"></i> Ajouter question</button>
                </div>
            </div>
            <div id="eval-questions-list" class="audit-questions-container">
                ${evalRenderQuestions()}
            </div>
        </div>
    `;
}

function evalRenderQuestions() {
    if (evalQuestions.length === 0) {
        return '<div class="empty-state py-40"><i class="fas fa-question-circle"></i><h3>Aucune question</h3><p>Ajoutez des questions à votre grille d\'évaluation</p></div>';
    }

    // Trier par section puis par ordre
    const sortedQuestions = [...evalQuestions].sort((a, b) => {
        if (a.section === b.section) return (a.sort_order || 0) - (b.sort_order || 0);
        if (!a.section) return 1;
        if (!b.section) return -1;
        return a.section.localeCompare(b.section);
    });

    let currentSection = null;
    let html = '';

    sortedQuestions.forEach((q, idx) => {
        const actualIdx = evalQuestions.indexOf(q);
        
        if (q.section !== currentSection) {
            if (currentSection !== null) html += '</div>';
            currentSection = q.section;
            html += `
                <div class="audit-section">
                    <div class="audit-section-header">
                        <h5><i class="fas fa-folder"></i> ${esc(currentSection || 'Sans section')}</h5>
                        ${currentSection ? `<button class="btn btn-sm btn-outline" onclick="evalEditSection('${esc(currentSection)}')" title="Renommer"><i class="fas fa-edit"></i></button>` : ''}
                    </div>
            `;
        }

        let responseTypeBadge;
        if (q.response_type === 'yesno') {
            responseTypeBadge = '<span class="badge badge-info">Oui/Non/NA</span>';
        } else if (q.response_type === 'choice') {
            const choiceCount = q.choices ? q.choices.split('\n').filter(c => c.trim()).length : 0;
            responseTypeBadge = `<span class="badge badge-warning">${q.multiple_selection ? 'Choix multiples' : 'Choix unique'} (${choiceCount})</span>`;
        } else {
            responseTypeBadge = `<span class="badge badge-primary">Note ${q.min_score || 1}-${q.max_score || 10}</span>`;
        }
        
        html += `
            <div class="audit-question-item" data-index="${actualIdx}">
                <div class="audit-question-drag"><i class="fas fa-grip-vertical"></i></div>
                <div class="audit-question-content">
                    <div class="audit-question-text">${esc(q.question)}</div>
                    <div class="audit-question-meta">
                        ${responseTypeBadge}
                        ${q.weight != 1 ? `<span>Coef: x${q.weight}</span>` : ''}
                        ${q.comment_required ? '<span class="text-warning"><i class="fas fa-comment"></i> Commentaire obligatoire</span>' : ''}
                        ${q.file_required ? '<span class="text-danger"><i class="fas fa-file-upload"></i> Pièce jointe obligatoire</span>' : (q.file_optional ? '<span class="text-muted"><i class="fas fa-file-upload"></i> Pièce jointe autorisée</span>' : '')}
                    </div>
                </div>
                <div class="audit-question-actions">
                    <button class="btn btn-sm btn-outline" onclick="evalEditQuestion(${actualIdx})" title="Modifier"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="evalDeleteQuestion(${actualIdx})" title="Supprimer"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });

    if (currentSection !== null) html += '</div>';
    return html;
}

function evalAddSection() {
    openModal('Nouvelle section', `
        <form onsubmit="evalSaveSection(event)">
            <div class="form-group">
                <label>Nom de la section *</label>
                <input type="text" id="eval-section-name" required placeholder="Ex: Compétences techniques, Savoir-être, Communication...">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Ajouter</button>
            </div>
        </form>
    `);
}

function evalSaveSection(e) {
    e.preventDefault();
    const sectionName = document.getElementById('eval-section-name').value.trim();
    if (!sectionName) return;
    
    closeModal();
    evalAddQuestion(sectionName);
}

function evalEditSection(oldName) {
    openModal('Renommer la section', `
        <form onsubmit="evalRenameSection(event, '${esc(oldName)}')">
            <div class="form-group">
                <label>Nouveau nom *</label>
                <input type="text" id="eval-section-new-name" value="${esc(oldName)}" required>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Renommer</button>
            </div>
        </form>
    `);
}

function evalRenameSection(e, oldName) {
    e.preventDefault();
    const newName = document.getElementById('eval-section-new-name').value.trim();
    if (!newName) return;
    
    evalQuestions.forEach(q => {
        if (q.section === oldName) q.section = newName;
    });
    
    closeModal();
    document.getElementById('eval-questions-list').innerHTML = evalRenderQuestions();
}

function evalAddQuestion(defaultSection = null) {
    const sections = [...new Set(evalQuestions.map(q => q.section).filter(s => s))];
    
    openModal('Nouvelle question', `
        <form id="eval-question-form" onsubmit="evalSaveQuestion(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Section</label>
                    <select name="section">
                        <option value="">Sans section</option>
                        ${sections.map(s => `<option value="${esc(s)}" ${s === defaultSection ? 'selected' : ''}>${esc(s)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Coefficient</label>
                    <select name="weight">
                        <option value="1">x1 (standard)</option>
                        <option value="1.5">x1.5</option>
                        <option value="2">x2 (important)</option>
                        <option value="3">x3 (critique)</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label>Question *</label>
                <textarea name="question" rows="2" required placeholder="Saisissez votre question d'évaluation..."></textarea>
            </div>
            
            <div class="form-section">
                <h5>Type de réponse</h5>
                <div class="response-type-selector">
                    <label class="response-type-option">
                        <input type="radio" name="response_type" value="score" checked onchange="evalToggleResponseType(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-star"></i>
                            <span>Note</span>
                            <small>Échelle de notation</small>
                        </div>
                    </label>
                    <label class="response-type-option">
                        <input type="radio" name="response_type" value="yesno" onchange="evalToggleResponseType(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-check-circle"></i>
                            <span>Oui / Non</span>
                            <small>+ Non applicable</small>
                        </div>
                    </label>
                    <label class="response-type-option">
                        <input type="radio" name="response_type" value="choice" onchange="evalToggleResponseType(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-list-ul"></i>
                            <span>Choix</span>
                            <small>Multiple ou unique</small>
                        </div>
                    </label>
                </div>
            </div>
            
            <div id="score-options" class="form-section">
                <h5>Échelle de notation</h5>
                <div class="form-row">
                    <div class="form-group">
                        <label>Note minimum</label>
                        <select name="min_score">
                            <option value="1" selected>1</option>
                            <option value="0">0</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Note maximum</label>
                        <select name="max_score">
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                            <option value="7">7</option>
                            <option value="8">8</option>
                            <option value="9">9</option>
                            <option value="10" selected>10</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div id="choice-options" class="form-section" style="display: none;">
                <h5>Options de choix</h5>
                <div class="form-group">
                    <label>Choix possibles (un par ligne) *</label>
                    <textarea name="choices" rows="4" placeholder="Option 1&#10;Option 2&#10;Option 3&#10;Option 4"></textarea>
                    <small class="text-muted">Entrez chaque option sur une nouvelle ligne</small>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="multiple_selection">
                        Autoriser plusieurs sélections
                    </label>
                </div>
            </div>
            
            <div class="form-section">
                <h5>Options</h5>
                <div class="checkbox-group">
                    <label class="checkbox-label"><input type="checkbox" name="comment_required"> Commentaire obligatoire</label>
                    <label class="checkbox-label"><input type="checkbox" name="file_optional" checked> Pièce jointe autorisée</label>
                    <label class="checkbox-label"><input type="checkbox" name="file_required"> Pièce jointe obligatoire</label>
                </div>
            </div>
            
            <input type="hidden" name="edit_index" value="-1">
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Ajouter</button>
            </div>
        </form>
        <script>
            document.querySelector('[name="file_required"]').addEventListener('change', function() {
                if (this.checked) document.querySelector('[name="file_optional"]').checked = true;
            });
        </script>
    `);
}

function evalToggleResponseType(type) {
    const scoreOptions = document.getElementById('score-options');
    const choiceOptions = document.getElementById('choice-options');
    if (scoreOptions) {
        scoreOptions.style.display = type === 'score' ? 'block' : 'none';
    }
    if (choiceOptions) {
        choiceOptions.style.display = type === 'choice' ? 'block' : 'none';
    }
}

function evalEditQuestion(idx) {
    const q = evalQuestions[idx];
    const sections = [...new Set(evalQuestions.map(q => q.section).filter(s => s))];
    const isYesNo = q.response_type === 'yesno';
    const isChoice = q.response_type === 'choice';
    const isScore = !isYesNo && !isChoice;
    
    openModal('Modifier la question', `
        <form id="eval-question-form" onsubmit="evalSaveQuestion(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Section</label>
                    <select name="section">
                        <option value="">Sans section</option>
                        ${sections.map(s => `<option value="${esc(s)}" ${s === q.section ? 'selected' : ''}>${esc(s)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Coefficient</label>
                    <select name="weight">
                        <option value="1" ${q.weight == 1 ? 'selected' : ''}>x1 (standard)</option>
                        <option value="1.5" ${q.weight == 1.5 ? 'selected' : ''}>x1.5</option>
                        <option value="2" ${q.weight == 2 ? 'selected' : ''}>x2 (important)</option>
                        <option value="3" ${q.weight == 3 ? 'selected' : ''}>x3 (critique)</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label>Question *</label>
                <textarea name="question" rows="2" required>${esc(q.question)}</textarea>
            </div>
            
            <div class="form-section">
                <h5>Type de réponse</h5>
                <div class="response-type-selector">
                    <label class="response-type-option">
                        <input type="radio" name="response_type" value="score" ${isScore ? 'checked' : ''} onchange="evalToggleResponseType(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-star"></i>
                            <span>Note</span>
                            <small>Échelle de notation</small>
                        </div>
                    </label>
                    <label class="response-type-option">
                        <input type="radio" name="response_type" value="yesno" ${isYesNo ? 'checked' : ''} onchange="evalToggleResponseType(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-check-circle"></i>
                            <span>Oui / Non</span>
                            <small>+ Non applicable</small>
                        </div>
                    </label>
                    <label class="response-type-option">
                        <input type="radio" name="response_type" value="choice" ${isChoice ? 'checked' : ''} onchange="evalToggleResponseType(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-list-ul"></i>
                            <span>Choix</span>
                            <small>Multiple ou unique</small>
                        </div>
                    </label>
                </div>
            </div>
            
            <div id="score-options" class="form-section" style="display: ${isScore ? 'block' : 'none'}">
                <h5>Échelle de notation</h5>
                <div class="form-row">
                    <div class="form-group">
                        <label>Note minimum</label>
                        <select name="min_score">
                            <option value="0" ${q.min_score == 0 ? 'selected' : ''}>0</option>
                            <option value="1" ${q.min_score != 0 ? 'selected' : ''}>1</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Note maximum</label>
                        <select name="max_score">
                            <option value="1" ${q.max_score == 1 ? 'selected' : ''}>1</option>
                            <option value="2" ${q.max_score == 2 ? 'selected' : ''}>2</option>
                            <option value="3" ${q.max_score == 3 ? 'selected' : ''}>3</option>
                            <option value="4" ${q.max_score == 4 ? 'selected' : ''}>4</option>
                            <option value="5" ${q.max_score == 5 ? 'selected' : ''}>5</option>
                            <option value="6" ${q.max_score == 6 ? 'selected' : ''}>6</option>
                            <option value="7" ${q.max_score == 7 ? 'selected' : ''}>7</option>
                            <option value="8" ${q.max_score == 8 ? 'selected' : ''}>8</option>
                            <option value="9" ${q.max_score == 9 ? 'selected' : ''}>9</option>
                            <option value="10" ${!q.max_score || q.max_score == 10 ? 'selected' : ''}>10</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div id="choice-options" class="form-section" style="display: ${isChoice ? 'block' : 'none'}">
                <h5>Options de choix</h5>
                <div class="form-group">
                    <label>Choix possibles (un par ligne) *</label>
                    <textarea name="choices" rows="4" placeholder="Option 1&#10;Option 2&#10;Option 3">${q.choices || ''}</textarea>
                    <small class="text-muted">Entrez chaque option sur une nouvelle ligne</small>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="multiple_selection" ${q.multiple_selection ? 'checked' : ''}>
                        Autoriser plusieurs sélections
                    </label>
                </div>
            </div>
            
            <div class="form-section">
                <h5>Options</h5>
                <div class="checkbox-group">
                    <label class="checkbox-label"><input type="checkbox" name="comment_required" ${q.comment_required ? 'checked' : ''}> Commentaire obligatoire</label>
                    <label class="checkbox-label"><input type="checkbox" name="file_optional" ${q.file_optional || q.file_required ? 'checked' : ''}> Pièce jointe autorisée</label>
                    <label class="checkbox-label"><input type="checkbox" name="file_required" ${q.file_required ? 'checked' : ''}> Pièce jointe obligatoire</label>
                </div>
            </div>
            
            <input type="hidden" name="edit_index" value="${idx}">
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
        </form>
        <script>
            document.querySelector('[name="file_required"]').addEventListener('change', function() {
                if (this.checked) document.querySelector('[name="file_optional"]').checked = true;
            });
        </script>
    `);
}

function evalSaveQuestion(e) {
    e.preventDefault();
    const form = document.getElementById('eval-question-form');
    const formData = new FormData(form);
    
    const responseType = formData.get('response_type') || 'score';
    
    const question = {
        section: formData.get('section') || null,
        question: formData.get('question'),
        weight: parseFloat(formData.get('weight')) || 1,
        response_type: responseType,
        min_score: responseType === 'score' ? (parseInt(formData.get('min_score')) || 1) : 0,
        max_score: responseType === 'score' ? (parseInt(formData.get('max_score')) || 10) : 1,
        choices: responseType === 'choice' ? formData.get('choices') : null,
        multiple_selection: responseType === 'choice' && form.querySelector('[name="multiple_selection"]').checked ? 1 : 0,
        comment_required: form.querySelector('[name="comment_required"]').checked ? 1 : 0,
        file_optional: form.querySelector('[name="file_optional"]').checked ? 1 : 0,
        file_required: form.querySelector('[name="file_required"]').checked ? 1 : 0,
        sort_order: 0
    };
    
    const editIndex = parseInt(formData.get('edit_index'));
    
    if (editIndex >= 0) {
        question.id = evalQuestions[editIndex].id;
        evalQuestions[editIndex] = question;
    } else {
        question.sort_order = evalQuestions.length;
        evalQuestions.push(question);
    }
    
    closeModal();
    document.getElementById('eval-questions-list').innerHTML = evalRenderQuestions();
}

function evalDeleteQuestion(idx) {
    if (!confirm('Supprimer cette question ?')) return;
    evalQuestions.splice(idx, 1);
    document.getElementById('eval-questions-list').innerHTML = evalRenderQuestions();
}

async function evalSaveGrid() {
    const form = document.getElementById('eval-grid-form');
    const formData = new FormData(form);
    
    const validQuestions = evalQuestions.filter(q => q.question && q.question.trim());
    
    if (validQuestions.length === 0) {
        toast('Ajoutez au moins une question', 'warning');
        return;
    }
    
    const gridData = {
        name: formData.get('name'),
        hotel_id: formData.get('hotel_id') || null,
        instructions: formData.get('instructions'),
        target_role: formData.get('target_role'),
        periodicity: formData.get('periodicity'),
        is_active: formData.get('is_active'),
        questions: validQuestions.map((q, idx) => ({
            id: q.id || null,
            question_text: q.question,
            category: q.section,
            weight: q.weight,
            response_type: q.response_type || 'score',
            min_score: q.min_score || 1,
            max_score: q.max_score || 10,
            choices: q.choices || null,
            multiple_selection: q.multiple_selection || 0,
            comment_required: q.comment_required,
            file_optional: q.file_optional || 0,
            file_required: q.file_required || 0,
            position: idx
        }))
    };
    
    try {
        if (evalCurrentGrid?.id) {
            await API.updateEvaluationGridFull(evalCurrentGrid.id, gridData);
            toast('Grille mise à jour', 'success');
        } else {
            await API.createEvaluationGridFull(gridData);
            toast('Grille créée', 'success');
        }
        loadEvaluations(document.getElementById('page-content'));
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function evalDuplicateGrid(gridId) {
    if (!confirm('Dupliquer cette grille ?')) return;
    try {
        await API.duplicateEvaluationGrid(gridId);
        toast('Grille dupliquée', 'success');
        showEvalTab('grids');
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function evalDeleteGrid(gridId) {
    if (!confirm('Supprimer cette grille ?')) return;
    try {
        await API.deleteEvaluationGrid(gridId);
        toast('Grille supprimée', 'success');
        showEvalTab('grids');
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== NOUVELLE ÉVALUATION ====================

async function evalShowNewModal() {
    try {
        const gridsRes = await API.getEvaluationGrids();
        const grids = (gridsRes.grids || []).filter(g => g.is_active == 1);
        
        if (grids.length === 0) {
            toast('Aucune grille d\'évaluation active', 'warning');
            return;
        }
        
        openModal('Nouvelle évaluation', `
            <form id="eval-new-form" onsubmit="evalCreate(event)">
                <div class="form-group">
                    <label>Grille d'évaluation *</label>
                    <select name="grid_id" required onchange="evalLoadEligibleUsers(this.value)">
                        <option value="">Sélectionner une grille...</option>
                        ${grids.map(g => `<option value="${g.id}" data-role="${g.target_role}" data-hotel="${g.hotel_id || ''}">${esc(g.name)} (${LABELS.role[g.target_role] || g.target_role})</option>`).join('')}
                    </select>
                </div>
                
                <div id="eval-user-section" style="display: none;">
                    <div class="form-group">
                        <label>Collaborateur à évaluer *</label>
                        <select name="evaluated_user_id" required id="eval-user-select" onchange="evalCheckMultiHotels(this.value)">
                            <option value="">Sélectionner un collaborateur...</option>
                        </select>
                    </div>
                    
                    <div id="eval-hotel-section" style="display: none;">
                        <div class="form-group">
                            <label>Hôtel concerné *</label>
                            <select name="hotel_id" id="eval-hotel-select" required>
                                <option value="">Sélectionner l'hôtel...</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Évaluateur</label>
                    <select name="evaluator_id" id="eval-evaluator-select">
                        <option value="${API.user.id}" selected>${esc(API.user.first_name)} ${esc(API.user.last_name)} (moi)</option>
                    </select>
                    <small class="text-muted">Par défaut, c'est vous qui réalisez l'évaluation</small>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Date d'évaluation</label>
                        <input type="date" name="evaluation_date" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Période - Début</label>
                        <input type="date" name="period_start">
                    </div>
                    <div class="form-group">
                        <label>Période - Fin</label>
                        <input type="date" name="period_end">
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Créer</button>
                </div>
            </form>
        `);
        
        // Stocker les données pour usage ultérieur
        window.evalEligibleUsers = [];
        window.evalUserHotels = {};
        
    } catch (error) { toast(error.message, 'error'); }
}

async function evalLoadEligibleUsers(gridId) {
    const userSection = document.getElementById('eval-user-section');
    const userSelect = document.getElementById('eval-user-select');
    const hotelSection = document.getElementById('eval-hotel-section');
    
    if (!gridId) {
        userSection.style.display = 'none';
        return;
    }
    
    const gridOption = document.querySelector(`select[name="grid_id"] option[value="${gridId}"]`);
    const targetRole = gridOption.dataset.role;
    const gridHotelId = gridOption.dataset.hotel;
    
    try {
        // Charger les utilisateurs éligibles selon le rôle cible
        const params = { role: targetRole };
        if (gridHotelId) params.hotel_id = gridHotelId;
        
        const usersRes = await API.getEvaluableUsers(params);
        const users = usersRes.users || [];
        
        // Regrouper par utilisateur unique (éviter doublons)
        const uniqueUsers = {};
        window.evalUserHotels = {};
        
        users.forEach(u => {
            if (!uniqueUsers[u.id]) {
                uniqueUsers[u.id] = {
                    id: u.id,
                    name: `${u.last_name} ${u.first_name}`,
                    role: u.role,
                    hotels: []
                };
            }
            uniqueUsers[u.id].hotels.push({
                id: u.hotel_id,
                name: u.hotel_name
            });
            
            // Stocker les hôtels par utilisateur
            if (!window.evalUserHotels[u.id]) {
                window.evalUserHotels[u.id] = [];
            }
            window.evalUserHotels[u.id].push({
                id: u.hotel_id,
                name: u.hotel_name
            });
        });
        
        window.evalEligibleUsers = Object.values(uniqueUsers);
        
        // Mettre à jour le select
        userSelect.innerHTML = '<option value="">Sélectionner un collaborateur...</option>' +
            window.evalEligibleUsers.map(u => 
                `<option value="${u.id}">${esc(u.name)} (${LABELS.role[u.role] || u.role})${u.hotels.length > 1 ? ' - ' + u.hotels.length + ' hôtels' : ''}</option>`
            ).join('');
        
        userSection.style.display = 'block';
        hotelSection.style.display = 'none';
        
        // Charger aussi les évaluateurs potentiels
        await evalLoadEvaluators(gridHotelId);
        
    } catch (error) {
        toast('Erreur chargement collaborateurs: ' + error.message, 'error');
    }
}

function evalCheckMultiHotels(userId) {
    const hotelSection = document.getElementById('eval-hotel-section');
    const hotelSelect = document.getElementById('eval-hotel-select');
    
    if (!userId || !window.evalUserHotels[userId]) {
        hotelSection.style.display = 'none';
        return;
    }
    
    const hotels = window.evalUserHotels[userId];
    
    if (hotels.length === 1) {
        // Un seul hôtel, pas besoin de sélection
        hotelSection.style.display = 'none';
        hotelSelect.innerHTML = `<option value="${hotels[0].id}" selected>${esc(hotels[0].name)}</option>`;
        hotelSelect.removeAttribute('required');
    } else {
        // Plusieurs hôtels, afficher la sélection
        hotelSelect.innerHTML = '<option value="">Sélectionner l\'hôtel...</option>' +
            hotels.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('');
        hotelSelect.setAttribute('required', 'required');
        hotelSection.style.display = 'block';
    }
}

async function evalLoadEvaluators(hotelId) {
    const evaluatorSelect = document.getElementById('eval-evaluator-select');
    
    try {
        // Charger les managers qui peuvent évaluer
        const params = {};
        if (hotelId) params.hotel_id = hotelId;
        
        const usersRes = await API.getEvaluableUsers(params);
        const users = usersRes.users || [];
        
        // Filtrer pour garder uniquement les managers/admins
        const evaluators = users.filter(u => 
            ['admin', 'groupe_manager', 'hotel_manager', 'rh'].includes(u.role)
        );
        
        // Dédupliquer
        const uniqueEvaluators = {};
        evaluators.forEach(u => {
            if (!uniqueEvaluators[u.id]) {
                uniqueEvaluators[u.id] = u;
            }
        });
        
        // Construire les options avec l'utilisateur courant en premier
        let options = `<option value="${API.user.id}" selected>${esc(API.user.first_name)} ${esc(API.user.last_name)} (moi)</option>`;
        
        Object.values(uniqueEvaluators).forEach(u => {
            if (u.id != API.user.id) {
                options += `<option value="${u.id}">${esc(u.last_name)} ${esc(u.first_name)} (${LABELS.role[u.role] || u.role})</option>`;
            }
        });
        
        evaluatorSelect.innerHTML = options;
        
    } catch (error) {
        console.error('Erreur chargement évaluateurs:', error);
    }
}

async function evalCreate(e) {
    e.preventDefault();
    const form = document.getElementById('eval-new-form');
    const formData = new FormData(form);
    
    const userId = formData.get('evaluated_user_id');
    let hotelId = formData.get('hotel_id');
    
    // Si pas d'hôtel sélectionné mais un seul hôtel disponible
    if (!hotelId && window.evalUserHotels[userId] && window.evalUserHotels[userId].length === 1) {
        hotelId = window.evalUserHotels[userId][0].id;
    }
    
    if (!hotelId) {
        toast('Veuillez sélectionner un hôtel', 'warning');
        return;
    }
    
    const data = {
        grid_id: formData.get('grid_id'),
        evaluated_user_id: userId,
        hotel_id: hotelId,
        evaluator_id: formData.get('evaluator_id') || API.user.id,
        evaluation_date: formData.get('evaluation_date'),
        period_start: formData.get('period_start') || null,
        period_end: formData.get('period_end') || null
    };
    
    try {
        const res = await API.createEvaluation(data);
        toast('Évaluation créée', 'success');
        closeModal();
        evalOpen(res.id);
    } catch (error) { toast(error.message, 'error'); }
}

// ==================== RÉALISATION D'ÉVALUATION ====================

async function evalOpen(evalId) {
    try {
        const res = await API.getEvaluation(evalId);
        const evaluation = res.evaluation;
        const questions = res.questions || [];
        const isReadOnly = evaluation.status === 'validated' && API.user.role !== 'admin';
        
        // Grouper les questions par section
        const sections = {};
        questions.forEach(q => {
            const sec = q.category || 'Général';
            if (!sections[sec]) sections[sec] = [];
            sections[sec].push(q);
        });
        
        // Générer l'échelle de notation dynamique
        const generateRatingScale = (q, isReadOnly) => {
            const min = parseInt(q.min_score) || 1;
            const max = parseInt(q.max_score) || 10;
            const scores = [];
            for (let n = min; n <= max; n++) scores.push(n);
            
            return `
                <div class="rating-scale">
                    ${scores.map(n => `
                        <label class="rating-option">
                            <input type="radio" name="answers[${q.id}][score]" value="${n}" ${q.score == n ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} required>
                            <span>${n}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="rating-labels">
                    <span>Insuffisant</span>
                    <span>Excellent</span>
                </div>
            `;
        };
        
        // Générer les boutons Oui/Non/NA
        const generateYesNoButtons = (q, isReadOnly) => {
            const currentAnswer = q.answer_yesno || q.score;
            return `
                <div class="yesno-buttons">
                    <label class="yesno-option yesno-yes ${currentAnswer === 'yes' || currentAnswer == 1 ? 'selected' : ''}">
                        <input type="radio" name="answers[${q.id}][yesno]" value="yes" ${currentAnswer === 'yes' || currentAnswer == 1 ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} required>
                        <i class="fas fa-check"></i> Oui
                    </label>
                    <label class="yesno-option yesno-no ${currentAnswer === 'no' || currentAnswer == 0 ? 'selected' : ''}">
                        <input type="radio" name="answers[${q.id}][yesno]" value="no" ${currentAnswer === 'no' || currentAnswer == 0 ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}>
                        <i class="fas fa-times"></i> Non
                    </label>
                    <label class="yesno-option yesno-na ${currentAnswer === 'na' ? 'selected' : ''}">
                        <input type="radio" name="answers[${q.id}][yesno]" value="na" ${currentAnswer === 'na' ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}>
                        <i class="fas fa-minus"></i> N/A
                    </label>
                </div>
            `;
        };
        
        // Générer les choix multiples/uniques
        const generateChoices = (q, isReadOnly) => {
            const choices = (q.choices || '').split('\n').filter(c => c.trim());
            const selectedChoices = q.answer_choice ? q.answer_choice.split('||') : [];
            const isMultiple = q.multiple_selection == 1;
            const inputType = isMultiple ? 'checkbox' : 'radio';
            
            return `
                <div class="choice-options ${isMultiple ? 'multiple' : 'single'}">
                    ${choices.map((choice, idx) => `
                        <label class="choice-option ${selectedChoices.includes(choice.trim()) ? 'selected' : ''}">
                            <input type="${inputType}" name="answers[${q.id}][choice]${isMultiple ? '[]' : ''}" value="${esc(choice.trim())}" 
                                ${selectedChoices.includes(choice.trim()) ? 'checked' : ''} 
                                ${isReadOnly ? 'disabled' : ''} 
                                ${!isMultiple ? 'required' : ''}>
                            <span class="choice-text">${esc(choice.trim())}</span>
                        </label>
                    `).join('')}
                </div>
                ${isMultiple ? '<small class="text-muted">Plusieurs choix possibles</small>' : ''}
            `;
        };
        
        let questionsHtml = Object.entries(sections).map(([sectionName, sectionQuestions]) => `
            <div class="audit-execute-section">
                <h4 class="section-title"><i class="fas fa-folder-open"></i> ${esc(sectionName)}</h4>
                ${sectionQuestions.map((q, idx) => {
                    const isYesNo = q.response_type === 'yesno';
                    const isChoice = q.response_type === 'choice';
                    return `
                    <div class="audit-execute-question" data-question-id="${q.id}">
                        <div class="question-header">
                            <span class="question-number">${idx + 1}</span>
                            <span class="question-text">${esc(q.question_text)}</span>
                            ${q.weight != 1 ? `<span class="question-weight">Coef. x${q.weight}</span>` : ''}
                        </div>
                        <div class="question-answer">
                            ${isYesNo ? generateYesNoButtons(q, isReadOnly) : 
                              isChoice ? generateChoices(q, isReadOnly) :
                              `<div class="rating-input">${generateRatingScale(q, isReadOnly)}</div>`}
                        </div>
                        <div class="question-comment">
                            <label>${q.comment_required ? 'Commentaire *' : 'Commentaire'}</label>
                            <textarea name="answers[${q.id}][comment]" rows="2" ${q.comment_required && !isReadOnly ? 'required' : ''} ${isReadOnly ? 'disabled' : ''} placeholder="Commentaire...">${q.answer_comment || ''}</textarea>
                        </div>
                        ${(q.file_optional || q.file_required) ? `
                            <div class="question-file">
                                <label>${q.file_required ? 'Pièce jointe *' : 'Pièce jointe'} <small class="text-muted">(Photo, PDF)</small></label>
                                ${q.file_url ? `
                                    <div class="file-preview mb-10">
                                        ${q.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) 
                                            ? `<img src="${q.file_url}" alt="Preuve" style="max-width: 200px; max-height: 150px; border-radius: 4px; cursor: pointer;" onclick="window.open('${q.file_url}', '_blank')">` 
                                            : `<a href="${q.file_url}" target="_blank" class="btn btn-sm btn-outline"><i class="fas fa-file-pdf"></i> Voir le fichier</a>`}
                                        ${!isReadOnly ? `<button type="button" class="btn btn-sm btn-danger ml-10" onclick="evalRemoveFile(${q.id})"><i class="fas fa-trash"></i></button>` : ''}
                                    </div>
                                ` : ''}
                                ${!isReadOnly ? `
                                    <input type="file" name="files[${q.id}]" accept="image/*,.pdf" ${q.file_required && !q.file_url ? 'required' : ''} onchange="evalPreviewFile(this, ${q.id})">
                                    <div id="file-preview-${q.id}" class="file-preview-new mt-10"></div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `}).join('')}
            </div>
        `).join('');
        
        openModal(`Évaluation: ${esc(evaluation.evaluated_name)}`, `
            <form id="eval-form" onsubmit="evalSave(event, ${evalId})">
                <div class="audit-info-bar">
                    <span><i class="fas fa-clipboard-list"></i> ${esc(evaluation.grid_name)}</span>
                    <span><i class="fas fa-calendar"></i> ${formatDateEval(evaluation.evaluation_date)}</span>
                    <span>${evalStatusBadge(evaluation.status)}</span>
                    ${evaluation.score_weighted ? `<span class="eval-score ${evalScoreClass(evaluation.score_weighted)}">${parseFloat(evaluation.score_weighted).toFixed(1)}%</span>` : ''}
                </div>
                
                ${evaluation.instructions ? `<div class="eval-instructions"><i class="fas fa-info-circle"></i> ${esc(evaluation.instructions)}</div>` : ''}
                
                <div class="eval-questions-execute">${questionsHtml}</div>
                
                <div class="audit-notes mt-20">
                    <div class="form-group">
                        <label>Commentaire global</label>
                        <textarea name="global_comment" rows="3" ${isReadOnly ? 'disabled' : ''}>${evaluation.global_comment || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Conclusion</label>
                        <textarea name="conclusion" rows="2" ${isReadOnly ? 'disabled' : ''}>${evaluation.conclusion || ''}</textarea>
                    </div>
                </div>
                
                ${!isReadOnly ? `
                    <div class="audit-bottom-actions">
                        <select name="status">
                            <option value="draft" ${evaluation.status === 'draft' ? 'selected' : ''}>Brouillon</option>
                            <option value="validated" ${evaluation.status === 'validated' ? 'selected' : ''}>Validée</option>
                            <option value="archived" ${evaluation.status === 'archived' ? 'selected' : ''}>Archivée</option>
                        </select>
                        <div>
                            <button type="button" class="btn btn-outline" onclick="closeModal()">Fermer</button>
                            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
                        </div>
                    </div>
                ` : `
                    <div class="audit-bottom-actions">
                        <div></div>
                        <div>
                            <button type="button" class="btn btn-outline" onclick="closeModal()">Fermer</button>
                            <button type="button" class="btn btn-primary" onclick="evalExportPDF(${evalId})"><i class="fas fa-file-pdf"></i> Exporter PDF</button>
                        </div>
                    </div>
                `}
            </form>
        `, 'modal-xl');
    } catch (error) { toast(error.message, 'error'); }
}

function evalPreviewFile(input, questionId) {
    const preview = document.getElementById(`file-preview-${questionId}`);
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e => {
                preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 150px; border-radius: 4px;">`;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = `<span class="text-muted"><i class="fas fa-file-pdf"></i> ${esc(file.name)}</span>`;
        }
    } else {
        preview.innerHTML = '';
    }
}

function evalRemoveFile(questionId) {
    // Marquer le fichier pour suppression
    const form = document.getElementById('eval-form');
    let input = form.querySelector(`input[name="remove_files"]`);
    if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'remove_files';
        input.value = '';
        form.appendChild(input);
    }
    const current = input.value ? input.value.split(',') : [];
    if (!current.includes(String(questionId))) {
        current.push(questionId);
        input.value = current.join(',');
    }
    // Masquer la preview
    const preview = document.querySelector(`[data-question-id="${questionId}"] .file-preview`);
    if (preview) preview.style.display = 'none';
    toast('Fichier marqué pour suppression', 'info');
}

async function evalSave(e, evalId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    
    // Utiliser FormData directement pour supporter les fichiers
    formData.append('evaluation_id', evalId);
    
    // Convertir les réponses en JSON pour le backend
    const answers = {};
    for (const [key, value] of formData.entries()) {
        const match = key.match(/answers\[(\d+)\]\[(\w+)\](\[\])?/);
        if (match) {
            const [, qId, field, isArray] = match;
            if (!answers[qId]) answers[qId] = {};
            
            if (isArray) {
                // Choix multiples - combiner avec ||
                if (!answers[qId][field]) answers[qId][field] = [];
                answers[qId][field].push(value);
            } else {
                answers[qId][field] = value;
            }
        }
    }
    
    // Convertir les tableaux de choix en chaîne
    Object.keys(answers).forEach(qId => {
        if (Array.isArray(answers[qId].choice)) {
            answers[qId].choice = answers[qId].choice.join('||');
        }
    });
    
    formData.append('answers_json', JSON.stringify(answers));
    
    try {
        await API.saveEvaluationWithFiles(evalId, formData);
        toast('Évaluation enregistrée', 'success');
        closeModal();
        showEvalTab('list');
    } catch (error) { toast(error.message, 'error'); }
}

async function evalDelete(evalId) {
    if (!confirm('Supprimer cette évaluation ?')) return;
    try {
        await API.deleteEvaluation(evalId);
        toast('Évaluation supprimée', 'success');
        showEvalTab('list');
    } catch (error) { toast(error.message, 'error'); }
}

// ==================== EXPORT PDF ====================

async function evalExportPDF(evalId) {
    try {
        const res = await API.getEvaluation(evalId);
        const evaluation = res.evaluation;
        const questions = res.questions || [];
        
        // Grouper les questions par section
        const sections = {};
        questions.forEach(q => {
            const sec = q.category || 'Général';
            if (!sections[sec]) sections[sec] = [];
            sections[sec].push(q);
        });
        
        evalCreatePDF(evaluation, sections);
    } catch (e) {
        toast(e.message, 'error');
    }
}

function evalCreatePDF(evaluation, sections) {
    const printWindow = window.open('', '_blank');
    
    // Calculer les totaux par section et global
    let totalWeightedScore = 0;
    let totalMaxWeighted = 0;
    const sectionScores = {};
    
    Object.entries(sections).forEach(([sectionName, sectionQuestions]) => {
        let sectionWeightedScore = 0;
        let sectionMaxWeighted = 0;
        
        sectionQuestions.forEach(q => {
            const maxScore = parseInt(q.max_score) || 10;
            const weight = parseFloat(q.weight) || 1;
            const score = parseInt(q.score) || 0;
            
            sectionWeightedScore += score * weight;
            sectionMaxWeighted += maxScore * weight;
        });
        
        sectionScores[sectionName] = {
            score: sectionWeightedScore,
            max: sectionMaxWeighted,
            percent: sectionMaxWeighted > 0 ? (sectionWeightedScore / sectionMaxWeighted * 100) : 0,
            count: sectionQuestions.length
        };
        
        totalWeightedScore += sectionWeightedScore;
        totalMaxWeighted += sectionMaxWeighted;
    });
    
    const globalPercent = totalMaxWeighted > 0 ? (totalWeightedScore / totalMaxWeighted * 100) : 0;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Évaluation - ${esc(evaluation.evaluated_name)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1E3A5F; }
        .header h1 { color: #1E3A5F; font-size: 22px; margin-bottom: 5px; }
        .header h2 { color: #666; font-size: 16px; font-weight: normal; margin-bottom: 15px; }
        .info-grid { display: flex; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
        .info-item { text-align: center; padding: 10px; }
        .info-item .label { color: #666; font-size: 11px; }
        .info-item .value { font-weight: bold; font-size: 14px; }
        .score-box { background: #1E3A5F; color: white; padding: 15px 30px; border-radius: 8px; text-align: center; }
        .score-box .score { font-size: 32px; font-weight: bold; }
        .score-box .label { font-size: 12px; opacity: 0.9; }
        .score-details { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .score-details h3 { margin-bottom: 15px; color: #1E3A5F; font-size: 14px; }
        .score-table { width: 100%; border-collapse: collapse; }
        .score-table th, .score-table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        .score-table th { background: #1E3A5F; color: white; font-weight: 500; }
        .score-table .score-cell { text-align: center; font-weight: bold; }
        .score-table .percent-cell { text-align: center; }
        .score-table tfoot td { font-weight: bold; background: #e9e9e9; }
        .section { margin-top: 25px; }
        .section h3 { background: #f5f5f5; padding: 10px 15px; margin-bottom: 15px; color: #1E3A5F; font-size: 14px; border-left: 4px solid #1E3A5F; display: flex; justify-content: space-between; align-items: center; }
        .section h3 .section-score { font-size: 12px; background: #1E3A5F; color: white; padding: 3px 10px; border-radius: 4px; }
        .question { margin-bottom: 15px; padding: 12px; border: 1px solid #eee; border-radius: 5px; page-break-inside: avoid; }
        .question-text { font-weight: 500; margin-bottom: 8px; }
        .answer { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
        .answer-score { background: #1E3A5F; color: white; padding: 5px 15px; border-radius: 4px; font-weight: bold; }
        .answer-weight { background: #6c757d; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
        .answer-weighted { color: #666; font-size: 11px; }
        .answer-comment { flex: 1; font-style: italic; color: #666; font-size: 11px; min-width: 200px; }
        .answer-file { margin-top: 10px; }
        .answer-file img { max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd; }
        .answer-file a { color: #1E3A5F; text-decoration: none; }
        .global-section { margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
        .global-section h4 { margin-bottom: 10px; color: #1E3A5F; }
        .global-section p { margin-bottom: 10px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; }
        @media print { body { padding: 10px; } .question { page-break-inside: avoid; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 Rapport d'Évaluation</h1>
        <h2>${esc(evaluation.evaluated_name)}</h2>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="label">Grille</div>
                <div class="value">${esc(evaluation.grid_name)}</div>
            </div>
            <div class="info-item">
                <div class="label">Date</div>
                <div class="value">${formatDateEval(evaluation.evaluation_date)}</div>
            </div>
            <div class="info-item">
                <div class="label">Évaluateur</div>
                <div class="value">${esc(evaluation.evaluator_name)}</div>
            </div>
            <div class="info-item">
                <div class="label">Hôtel</div>
                <div class="value">${esc(evaluation.hotel_name)}</div>
            </div>
            <div class="score-box">
                <div class="score">${globalPercent.toFixed(1)}%</div>
                <div class="label">Score Global Pondéré</div>
            </div>
        </div>
    </div>
    
    <!-- Tableau récapitulatif des scores -->
    <div class="score-details">
        <h3>📊 Récapitulatif des scores par section</h3>
        <table class="score-table">
            <thead>
                <tr>
                    <th>Section</th>
                    <th style="text-align:center">Questions</th>
                    <th style="text-align:center">Score obtenu</th>
                    <th style="text-align:center">Score max</th>
                    <th style="text-align:center">Pourcentage</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(sectionScores).map(([name, data]) => `
                    <tr>
                        <td>${esc(name)}</td>
                        <td class="score-cell">${data.count}</td>
                        <td class="score-cell">${data.score.toFixed(1)}</td>
                        <td class="score-cell">${data.max.toFixed(1)}</td>
                        <td class="percent-cell"><strong>${data.percent.toFixed(1)}%</strong></td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td>TOTAL</td>
                    <td class="score-cell">${Object.values(sections).flat().length}</td>
                    <td class="score-cell">${totalWeightedScore.toFixed(1)}</td>
                    <td class="score-cell">${totalMaxWeighted.toFixed(1)}</td>
                    <td class="percent-cell"><strong>${globalPercent.toFixed(1)}%</strong></td>
                </tr>
            </tfoot>
        </table>
    </div>
    
    <!-- Détail par section -->
    ${Object.entries(sections).map(([sectionName, sectionQuestions]) => `
        <div class="section">
            <h3>
                <span><i>📁</i> ${esc(sectionName)}</span>
                <span class="section-score">${sectionScores[sectionName].percent.toFixed(1)}%</span>
            </h3>
            ${sectionQuestions.map((q, idx) => {
                const maxScore = parseInt(q.max_score) || 10;
                const weight = parseFloat(q.weight) || 1;
                const score = parseInt(q.score) || 0;
                const weightedScore = score * weight;
                const maxWeighted = maxScore * weight;
                
                return `
                <div class="question">
                    <div class="question-text">${idx + 1}. ${esc(q.question_text)}</div>
                    <div class="answer">
                        <span class="answer-score">${score}/${maxScore}</span>
                        ${weight != 1 ? `<span class="answer-weight">Coef. x${weight}</span>` : ''}
                        <span class="answer-weighted">→ ${weightedScore.toFixed(1)} / ${maxWeighted.toFixed(1)} pts</span>
                        ${q.answer_comment ? `<span class="answer-comment">${esc(q.answer_comment)}</span>` : ''}
                    </div>
                    ${q.file_url ? `
                        <div class="answer-file">
                            ${q.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) 
                                ? `<img src="${q.file_url}" alt="Preuve">` 
                                : `<a href="${q.file_url}" target="_blank">📎 Voir la pièce jointe</a>`}
                        </div>
                    ` : ''}
                </div>
            `}).join('')}
        </div>
    `).join('')}
    
    ${evaluation.global_comment || evaluation.conclusion ? `
        <div class="global-section">
            ${evaluation.global_comment ? `<div><h4>💬 Commentaire global</h4><p>${esc(evaluation.global_comment)}</p></div>` : ''}
            ${evaluation.conclusion ? `<div style="margin-top: 15px;"><h4>✅ Conclusion</h4><p>${esc(evaluation.conclusion)}</p></div>` : ''}
        </div>
    ` : ''}
    
    <div class="footer">
        <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        <p>ACL GESTION - Module Évaluations</p>
    </div>
    
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

// ==================== HELPERS ====================

function evalStatusBadge(status) {
    const map = { draft: ['secondary', 'Brouillon'], validated: ['success', 'Validée'], archived: ['primary', 'Archivée'] };
    const [color, label] = map[status] || ['secondary', status];
    return `<span class="badge badge-${color}">${label}</span>`;
}

function evalScoreClass(score) {
    if (!score) return '';
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-average';
    return 'score-low';
}

function formatDateEval(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
