/**
 * Module Audit - Gestion des audits hôteliers
 */

let auditHotels = [];
let auditCurrentHotel = null;
let auditGrids = [];
let auditCurrentGrid = null;
let auditQuestions = [];
let auditCurrentAudit = null;

async function loadAudit(container) {
    showLoading(container);

    try {
        const mgmtRes = await API.getManagementInfo();
        auditHotels = mgmtRes.manageable_hotels || [];
        
        const canManageGrids = hasPermission('audit.grids');
        const canExecute = hasPermission('audit.execute');

        if (auditHotels.length === 0 && !canManageGrids) {
            container.innerHTML = `
                <div class="card">
                    <div class="empty-state">
                        <i class="fas fa-clipboard-check"></i>
                        <h3>Aucun hôtel assigné</h3>
                        <p>Vous n'êtes affecté à aucun hôtel.</p>
                    </div>
                </div>
            `;
            return;
        }

        if (!auditCurrentHotel && auditHotels.length > 0) {
            auditCurrentHotel = auditHotels[0].id;
        }

        // Charger les grilles et audits
        const [gridsRes, auditsRes, pendingRes] = await Promise.all([
            API.getAuditGrids(auditCurrentHotel),
            API.getAudits({ hotel_id: auditCurrentHotel, limit: 20 }),
            API.getAuditPending(auditCurrentHotel)
        ]);

        auditGrids = gridsRes.grids || [];
        const audits = auditsRes.audits || [];
        const pending = pendingRes.pending || [];

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-clipboard-check"></i> Audits</h3>
                    <div class="header-controls">
                        ${auditHotels.length > 0 ? `
                            <select id="audit-hotel" onchange="auditChangeHotel(this.value)">
                                ${auditHotels.map(h => `<option value="${h.id}" ${h.id == auditCurrentHotel ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
                            </select>
                        ` : ''}
                        ${canManageGrids ? `<button class="btn btn-outline" onclick="auditShowGridsManager()"><i class="fas fa-cog"></i> Gérer les grilles</button>` : ''}
                    </div>
                </div>

                <!-- Audits en attente -->
                ${pending.length > 0 ? `
                    <div class="audit-pending-section">
                        <h4><i class="fas fa-exclamation-triangle text-warning"></i> Audits à réaliser</h4>
                        <div class="audit-pending-list">
                            ${pending.map(p => `
                                <div class="audit-pending-item ${p.is_overdue ? 'overdue' : ''}">
                                    <div class="audit-pending-info">
                                        <strong>${esc(p.grid_name)}</strong>
                                        <span class="audit-deadline">
                                            ${p.is_overdue ? '<i class="fas fa-exclamation-circle text-danger"></i> En retard - ' : ''}
                                            Échéance: ${formatDateFr(p.deadline_date)}
                                        </span>
                                    </div>
                                    <button class="btn btn-primary btn-sm" onclick="auditStartNew(${p.grid_id}, ${p.schedule_id})">
                                        <i class="fas fa-play"></i> Commencer
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Grilles disponibles -->
                <div class="audit-grids-section">
                    <h4><i class="fas fa-list-alt"></i> Grilles d'audit disponibles</h4>
                    ${auditGrids.length > 0 ? `
                        <div class="audit-grids-list">
                            ${auditGrids.map(g => `
                                <div class="audit-grid-card">
                                    <div class="audit-grid-info">
                                        <h5>${esc(g.name)}</h5>
                                        <p>${esc(g.description || 'Pas de description')}</p>
                                        <div class="audit-grid-meta">
                                            <span><i class="fas fa-question-circle"></i> ${g.questions_count || 0} questions</span>
                                            ${g.is_mandatory ? `<span class="badge badge-warning"><i class="fas fa-clock"></i> ${auditFrequencyLabel(g.frequency)}</span>` : ''}
                                        </div>
                                    </div>
                                    <div class="audit-grid-actions">
                                        <button class="btn btn-primary btn-sm" onclick="auditStartNew(${g.id})">
                                            <i class="fas fa-plus"></i> Nouvel audit
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-muted text-center py-20">Aucune grille d\'audit disponible</p>'}
                </div>
            </div>

            <!-- Historique des audits -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-history"></i> Historique des audits</h3>
                </div>
                ${audits.length > 0 ? `
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Grille</th>
                                <th>Réalisé par</th>
                                <th>Score</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${audits.map(a => `
                                <tr>
                                    <td>${formatDateFr(a.completed_at || a.created_at)}</td>
                                    <td>${esc(a.grid_name)}</td>
                                    <td>${esc(a.performer_name)}</td>
                                    <td>
                                        <div class="audit-score ${auditScoreClass(a.score_percentage)}">
                                            ${a.score_percentage ? parseFloat(a.score_percentage).toFixed(1) + '%' : '-'}
                                        </div>
                                    </td>
                                    <td><span class="badge badge-${auditStatusBadge(a.status)}">${auditStatusLabel(a.status)}</span></td>
                                    <td>
                                        <button class="btn btn-sm btn-outline" onclick="auditView(${a.id})" title="Voir"><i class="fas fa-eye"></i></button>
                                        ${a.status === 'completed' || a.status === 'validated' ? `
                                            <button class="btn btn-sm btn-outline" onclick="auditExportPDF(${a.id})" title="PDF"><i class="fas fa-file-pdf"></i></button>
                                        ` : ''}
                                        ${a.status === 'draft' || a.status === 'in_progress' ? `
                                            <button class="btn btn-sm btn-primary" onclick="auditContinue(${a.id})" title="Continuer"><i class="fas fa-edit"></i></button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p class="text-muted text-center py-20">Aucun audit réalisé</p>'}
            </div>
        `;

    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function auditChangeHotel(id) {
    auditCurrentHotel = parseInt(id);
    loadAudit(document.getElementById('page-content'));
}

function auditFrequencyLabel(freq) {
    const labels = {
        'once': 'Ponctuel',
        'weekly': 'Hebdomadaire',
        'monthly': 'Mensuel',
        'quarterly': 'Trimestriel',
        'yearly': 'Annuel'
    };
    return labels[freq] || freq;
}

function auditStatusLabel(status) {
    const labels = {
        'draft': 'Brouillon',
        'in_progress': 'En cours',
        'completed': 'Terminé',
        'validated': 'Validé'
    };
    return labels[status] || status;
}

function auditStatusBadge(status) {
    const badges = {
        'draft': 'secondary',
        'in_progress': 'warning',
        'completed': 'success',
        'validated': 'primary'
    };
    return badges[status] || 'secondary';
}

function auditScoreClass(score) {
    if (!score) return '';
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-average';
    return 'score-low';
}

// ==================== GESTIONNAIRE DE GRILLES ====================

async function auditShowGridsManager() {
    try {
        const res = await API.getAuditGrids(null, true); // all grids for management
        const grids = res.grids || [];

        openModal('Gestion des grilles d\'audit', `
            <div class="audit-grids-manager">
                <div class="manager-header">
                    <button class="btn btn-primary" onclick="auditCreateGrid()">
                        <i class="fas fa-plus"></i> Nouvelle grille
                    </button>
                </div>
                
                ${grids.length > 0 ? `
                    <table class="mt-20">
                        <thead>
                            <tr>
                                <th>Nom</th>
                                <th>Hôtels</th>
                                <th>Questions</th>
                                <th>Fréquence</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${grids.map(g => `
                                <tr>
                                    <td><strong>${esc(g.name)}</strong></td>
                                    <td>
                                        <span class="hotels-badge ${!g.hotel_id && !g.hotels ? 'all-hotels' : ''}">
                                            ${g.hotels_display || g.hotel_name || 'Tous les hôtels'}
                                        </span>
                                    </td>
                                    <td>${g.questions_count || 0}</td>
                                    <td>${g.is_mandatory ? auditFrequencyLabel(g.frequency) : 'Ponctuel'}</td>
                                    <td><span class="badge badge-${g.is_active ? 'success' : 'secondary'}">${g.is_active ? 'Active' : 'Inactive'}</span></td>
                                    <td>
                                        <button class="btn btn-sm btn-outline" onclick="auditEditGrid(${g.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                                        <button class="btn btn-sm btn-outline" onclick="auditDuplicateGrid(${g.id})" title="Dupliquer"><i class="fas fa-copy"></i></button>
                                        <button class="btn btn-sm btn-danger" onclick="auditDeleteGrid(${g.id})" title="Supprimer"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p class="text-muted text-center py-20">Aucune grille créée</p>'}
            </div>
        `, 'modal-xl');
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== CRÉATION/ÉDITION DE GRILLE ====================

async function auditCreateGrid() {
    closeModal();
    auditCurrentGrid = null;
    auditQuestions = [];
    await auditShowGridEditor();
}

async function auditEditGrid(gridId) {
    closeModal();
    try {
        const res = await API.getAuditGrid(gridId);
        auditCurrentGrid = res.grid;
        auditQuestions = res.questions || [];
        await auditShowGridEditor();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function auditShowGridEditor() {
    const grid = auditCurrentGrid || {};
    const isEdit = !!grid.id;
    
    // Récupérer les hôtels sélectionnés (tableau d'IDs)
    const selectedHotelIds = grid.hotel_ids || (grid.hotel_id ? [grid.hotel_id] : []);

    // Charger les utilisateurs pour les permissions
    let users = [];
    try {
        const usersRes = await API.getUsers();
        users = usersRes.users || [];
    } catch (e) {}

    const container = document.getElementById('page-content');
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-clipboard-list"></i> ${isEdit ? 'Modifier la grille' : 'Nouvelle grille d\'audit'}</h3>
                <div class="header-controls">
                    <button class="btn btn-outline" onclick="loadAudit(document.getElementById('page-content'))">
                        <i class="fas fa-arrow-left"></i> Retour
                    </button>
                    <button class="btn btn-primary" onclick="auditSaveGrid()">
                        <i class="fas fa-save"></i> Enregistrer
                    </button>
                </div>
            </div>

            <form id="audit-grid-form">
                <!-- Informations générales -->
                <div class="form-section">
                    <h4><i class="fas fa-info-circle"></i> Informations générales</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Nom de la grille *</label>
                            <input type="text" name="name" value="${esc(grid.name || '')}" required placeholder="Ex: Audit qualité mensuel">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" rows="2" placeholder="Description de l'audit...">${esc(grid.description || '')}</textarea>
                    </div>
                </div>
                
                <!-- Hôtels concernés -->
                <div class="form-section">
                    <h4><i class="fas fa-building"></i> Hôtels concernés</h4>
                    <div class="form-group">
                        <div class="hotel-selection-toggle">
                            <label class="radio-card ${selectedHotelIds.length === 0 ? 'active' : ''}">
                                <input type="radio" name="hotel_scope" value="all" ${selectedHotelIds.length === 0 ? 'checked' : ''} onchange="auditToggleHotelScope(this)">
                                <div class="radio-card-content">
                                    <i class="fas fa-globe"></i>
                                    <span>Tous les hôtels</span>
                                    <small>Cette grille sera disponible pour tous les établissements</small>
                                </div>
                            </label>
                            <label class="radio-card ${selectedHotelIds.length > 0 ? 'active' : ''}">
                                <input type="radio" name="hotel_scope" value="specific" ${selectedHotelIds.length > 0 ? 'checked' : ''} onchange="auditToggleHotelScope(this)">
                                <div class="radio-card-content">
                                    <i class="fas fa-check-square"></i>
                                    <span>Hôtels spécifiques</span>
                                    <small>Sélectionner un ou plusieurs hôtels</small>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div class="form-group hotel-checkboxes-container ${selectedHotelIds.length === 0 ? 'hidden' : ''}" id="hotel-checkboxes">
                        <label>Sélectionnez les hôtels :</label>
                        <div class="hotel-chips-grid">
                            ${auditHotels.map(h => `
                                <label class="hotel-chip-checkbox ${selectedHotelIds.includes(h.id) ? 'selected' : ''}">
                                    <input type="checkbox" name="hotel_ids" value="${h.id}" ${selectedHotelIds.includes(h.id) ? 'checked' : ''} onchange="auditUpdateHotelChip(this)">
                                    <span class="hotel-chip-content">
                                        <i class="fas fa-hotel"></i>
                                        ${esc(h.name)}
                                    </span>
                                </label>
                            `).join('')}
                        </div>
                        <div class="hotel-selection-actions">
                            <button type="button" class="btn btn-sm btn-outline" onclick="auditSelectAllHotels()">
                                <i class="fas fa-check-double"></i> Tout sélectionner
                            </button>
                            <button type="button" class="btn btn-sm btn-outline" onclick="auditDeselectAllHotels()">
                                <i class="fas fa-times"></i> Tout désélectionner
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Planification -->
                <div class="form-section">
                    <h4><i class="fas fa-calendar-alt"></i> Planification</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" name="is_mandatory" ${grid.is_mandatory ? 'checked' : ''} onchange="auditToggleMandatory(this)">
                                <span>Audit obligatoire (planifié)</span>
                            </label>
                        </div>
                    </div>
                    <div class="form-row audit-mandatory-options ${grid.is_mandatory ? '' : 'hidden'}">
                        <div class="form-group">
                            <label>Fréquence</label>
                            <select name="frequency">
                                <option value="monthly" ${grid.frequency === 'monthly' ? 'selected' : ''}>Mensuel</option>
                                <option value="weekly" ${grid.frequency === 'weekly' ? 'selected' : ''}>Hebdomadaire</option>
                                <option value="quarterly" ${grid.frequency === 'quarterly' ? 'selected' : ''}>Trimestriel</option>
                                <option value="yearly" ${grid.frequency === 'yearly' ? 'selected' : ''}>Annuel</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Jour du mois (deadline)</label>
                            <input type="number" name="day_of_month" min="1" max="28" value="${grid.day_of_month || 15}">
                        </div>
                        <div class="form-group">
                            <label>Rappel (jours avant)</label>
                            <input type="number" name="reminder_days" min="1" max="30" value="${grid.reminder_days || 7}">
                        </div>
                    </div>
                </div>

                <!-- Permissions -->
                <div class="form-section">
                    <h4><i class="fas fa-lock"></i> Permissions</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Qui peut réaliser cet audit ?</label>
                            <div class="checkbox-group">
                                <label class="checkbox-label"><input type="checkbox" name="exec_role_admin" checked disabled> Admin</label>
                                <label class="checkbox-label"><input type="checkbox" name="exec_role_groupe_manager" checked disabled> Responsable Groupe</label>
                                <label class="checkbox-label"><input type="checkbox" name="exec_role_hotel_manager" ${auditHasPermission(grid, 'execute', 'role', 'hotel_manager') ? 'checked' : ''}> Manager Hôtel</label>
                                <label class="checkbox-label"><input type="checkbox" name="exec_role_employee" ${auditHasPermission(grid, 'execute', 'role', 'employee') ? 'checked' : ''}> Employés</label>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Qui peut voir les résultats ?</label>
                            <div class="checkbox-group">
                                <label class="checkbox-label"><input type="checkbox" name="view_role_admin" checked disabled> Admin</label>
                                <label class="checkbox-label"><input type="checkbox" name="view_role_groupe_manager" checked disabled> Responsable Groupe</label>
                                <label class="checkbox-label"><input type="checkbox" name="view_role_hotel_manager" ${auditHasPermission(grid, 'view', 'role', 'hotel_manager') ? 'checked' : ''}> Manager Hôtel</label>
                                <label class="checkbox-label"><input type="checkbox" name="view_role_employee" ${auditHasPermission(grid, 'view', 'role', 'employee') ? 'checked' : ''}> Employés (leur audit uniquement)</label>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>

        <!-- Questions -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-question-circle"></i> Questions (${auditQuestions.length})</h3>
                <div class="header-controls">
                    <button class="btn btn-outline" onclick="auditAddSection()"><i class="fas fa-folder-plus"></i> Ajouter section</button>
                    <button class="btn btn-primary" onclick="auditAddQuestion()"><i class="fas fa-plus"></i> Ajouter question</button>
                </div>
            </div>
            <div id="audit-questions-list" class="audit-questions-container">
                ${auditRenderQuestions()}
            </div>
        </div>
    `;
}

function auditToggleHotelScope(radio) {
    const container = document.getElementById('hotel-checkboxes');
    const radioCards = document.querySelectorAll('.hotel-selection-toggle .radio-card');
    
    radioCards.forEach(card => card.classList.remove('active'));
    radio.closest('.radio-card').classList.add('active');
    
    if (radio.value === 'all') {
        container.classList.add('hidden');
        // Décocher tous les hôtels
        document.querySelectorAll('input[name="hotel_ids"]').forEach(cb => {
            cb.checked = false;
            cb.closest('.hotel-chip-checkbox').classList.remove('selected');
        });
    } else {
        container.classList.remove('hidden');
    }
}

function auditUpdateHotelChip(checkbox) {
    if (checkbox.checked) {
        checkbox.closest('.hotel-chip-checkbox').classList.add('selected');
    } else {
        checkbox.closest('.hotel-chip-checkbox').classList.remove('selected');
    }
}

function auditSelectAllHotels() {
    document.querySelectorAll('input[name="hotel_ids"]').forEach(cb => {
        cb.checked = true;
        cb.closest('.hotel-chip-checkbox').classList.add('selected');
    });
}

function auditDeselectAllHotels() {
    document.querySelectorAll('input[name="hotel_ids"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.hotel-chip-checkbox').classList.remove('selected');
    });
}

function auditToggleMandatory(checkbox) {
    const options = document.querySelector('.audit-mandatory-options');
    if (checkbox.checked) {
        options.classList.remove('hidden');
    } else {
        options.classList.add('hidden');
    }
}

function auditHasPermission(grid, permType, targetType, targetId) {
    if (!grid || !grid.permissions) return targetType === 'role' && ['hotel_manager'].includes(targetId);
    return grid.permissions.some(p => p.permission_type === permType && p.target_type === targetType && p.target_id === targetId);
}

function auditRenderQuestions() {
    if (auditQuestions.length === 0) {
        return '<div class="empty-state py-40"><i class="fas fa-question-circle"></i><h3>Aucune question</h3><p>Ajoutez des questions à votre grille d\'audit</p></div>';
    }

    let currentSection = null;
    let html = '';

    auditQuestions.forEach((q, idx) => {
        if (q.section !== currentSection) {
            if (currentSection !== null) html += '</div>';
            currentSection = q.section;
            html += `
                <div class="audit-section">
                    <div class="audit-section-header">
                        <h5><i class="fas fa-folder"></i> ${esc(currentSection || 'Sans section')}</h5>
                        <button class="btn btn-sm btn-outline" onclick="auditEditSection('${esc(currentSection)}')" title="Modifier section"><i class="fas fa-edit"></i></button>
                    </div>
            `;
        }

        html += `
            <div class="audit-question-item" data-index="${idx}">
                <div class="audit-question-drag"><i class="fas fa-grip-vertical"></i></div>
                <div class="audit-question-content">
                    <div class="audit-question-text">${esc(q.question)}</div>
                    <div class="audit-question-meta">
                        <span class="badge badge-${auditQuestionTypeBadge(q.question_type)}">${auditQuestionTypeLabel(q.question_type)}</span>
                        ${q.question_type === 'rating' ? `<span>Note: ${q.rating_min}-${q.rating_max}</span>` : ''}
                        ${q.weight != 1 ? `<span>Coef: ${q.weight}</span>` : ''}
                        ${q.comment_required ? '<span class="text-warning"><i class="fas fa-comment"></i> Commentaire obligatoire</span>' : ''}
                        ${q.photo_required ? '<span class="text-warning"><i class="fas fa-camera"></i> Photo obligatoire</span>' : ''}
                    </div>
                </div>
                <div class="audit-question-actions">
                    <button class="btn btn-sm btn-outline" onclick="auditEditQuestion(${idx})" title="Modifier"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="auditDeleteQuestion(${idx})" title="Supprimer"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });

    if (currentSection !== null) html += '</div>';
    return html;
}

function auditQuestionTypeLabel(type) {
    const labels = { 'rating': 'Note', 'yes_no': 'Oui/Non', 'text': 'Texte', 'multiple_choice': 'Choix multiple' };
    return labels[type] || type;
}

function auditQuestionTypeBadge(type) {
    const badges = { 'rating': 'primary', 'yes_no': 'success', 'text': 'secondary', 'multiple_choice': 'warning' };
    return badges[type] || 'secondary';
}

function auditAddSection() {
    openModal('Nouvelle section', `
        <form onsubmit="auditSaveSection(event)">
            <div class="form-group">
                <label>Nom de la section *</label>
                <input type="text" id="section-name" required placeholder="Ex: Propreté, Accueil, Sécurité...">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Ajouter</button>
            </div>
        </form>
    `);
}

function auditSaveSection(e) {
    e.preventDefault();
    const sectionName = document.getElementById('section-name').value.trim();
    if (!sectionName) return;
    
    // Ajouter une question vide dans cette section pour la créer
    auditQuestions.push({
        section: sectionName,
        question: '',
        question_type: 'rating',
        rating_min: 1,
        rating_max: 10,
        weight: 1,
        comment_required: 0,
        comment_optional: 1,
        photo_required: 0,
        photo_optional: 1,
        sort_order: auditQuestions.length,
        _isPlaceholder: true
    });
    
    closeModal();
    document.getElementById('audit-questions-list').innerHTML = auditRenderQuestions();
    
    // Ouvrir immédiatement le formulaire d'ajout de question
    auditAddQuestion(sectionName);
}

function auditAddQuestion(defaultSection = null) {
    const sections = [...new Set(auditQuestions.map(q => q.section).filter(s => s))];
    
    openModal('Nouvelle question', `
        <form id="question-form" onsubmit="auditSaveQuestion(event)">
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
                <textarea name="question" rows="2" required placeholder="Saisissez votre question..."></textarea>
            </div>
            
            <div class="form-section">
                <h5>Type de réponse</h5>
                <div class="response-type-selector">
                    <label class="response-type-option">
                        <input type="radio" name="question_type" value="rating" checked onchange="auditToggleQuestionOptions(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-star"></i>
                            <span>Note</span>
                            <small>Échelle de notation</small>
                        </div>
                    </label>
                    <label class="response-type-option">
                        <input type="radio" name="question_type" value="yes_no" onchange="auditToggleQuestionOptions(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-check-circle"></i>
                            <span>Oui / Non</span>
                            <small>+ Non applicable</small>
                        </div>
                    </label>
                    <label class="response-type-option">
                        <input type="radio" name="question_type" value="choice" onchange="auditToggleQuestionOptions(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-list-ul"></i>
                            <span>Choix</span>
                            <small>Multiple ou unique</small>
                        </div>
                    </label>
                    <label class="response-type-option">
                        <input type="radio" name="question_type" value="text" onchange="auditToggleQuestionOptions(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-comment-alt"></i>
                            <span>Texte</span>
                            <small>Réponse libre</small>
                        </div>
                    </label>
                </div>
            </div>
            
            <div id="rating-options" class="form-section">
                <h5>Échelle de notation</h5>
                <div class="form-row">
                    <div class="form-group">
                        <label>Note minimum</label>
                        <select name="rating_min">
                            <option value="0">0</option>
                            <option value="1" selected>1</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Note maximum</label>
                        <select name="rating_max">
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
                    <label class="checkbox-label"><input type="checkbox" name="photo_optional" checked> Photo/PDF autorisée</label>
                    <label class="checkbox-label"><input type="checkbox" name="photo_required"> Photo/PDF obligatoire</label>
                </div>
            </div>
            
            <input type="hidden" name="edit_index" value="-1">
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Ajouter</button>
            </div>
        </form>
        <script>
            document.querySelector('[name="photo_required"]').addEventListener('change', function() {
                if (this.checked) document.querySelector('[name="photo_optional"]').checked = true;
            });
        </script>
    `, 'modal-lg');
}

function auditToggleQuestionOptions(type) {
    const ratingOptions = document.getElementById('rating-options');
    const choiceOptions = document.getElementById('choice-options');
    if (ratingOptions) {
        ratingOptions.style.display = type === 'rating' ? 'block' : 'none';
    }
    if (choiceOptions) {
        choiceOptions.style.display = type === 'choice' ? 'block' : 'none';
    }
}

function auditEditQuestion(idx) {
    const q = auditQuestions[idx];
    const sections = [...new Set(auditQuestions.map(q => q.section).filter(s => s))];
    const isYesNo = q.question_type === 'yes_no';
    const isChoice = q.question_type === 'choice';
    const isText = q.question_type === 'text';
    const isRating = !isYesNo && !isChoice && !isText;
    
    openModal('Modifier la question', `
        <form id="question-form" onsubmit="auditSaveQuestion(event)">
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
                        <input type="radio" name="question_type" value="rating" ${isRating ? 'checked' : ''} onchange="auditToggleQuestionOptions(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-star"></i>
                            <span>Note</span>
                            <small>Échelle de notation</small>
                        </div>
                    </label>
                    <label class="response-type-option">
                        <input type="radio" name="question_type" value="yes_no" ${isYesNo ? 'checked' : ''} onchange="auditToggleQuestionOptions(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-check-circle"></i>
                            <span>Oui / Non</span>
                            <small>+ Non applicable</small>
                        </div>
                    </label>
                    <label class="response-type-option">
                        <input type="radio" name="question_type" value="choice" ${isChoice ? 'checked' : ''} onchange="auditToggleQuestionOptions(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-list-ul"></i>
                            <span>Choix</span>
                            <small>Multiple ou unique</small>
                        </div>
                    </label>
                    <label class="response-type-option">
                        <input type="radio" name="question_type" value="text" ${isText ? 'checked' : ''} onchange="auditToggleQuestionOptions(this.value)">
                        <div class="response-type-card">
                            <i class="fas fa-comment-alt"></i>
                            <span>Texte</span>
                            <small>Réponse libre</small>
                        </div>
                    </label>
                </div>
            </div>
            
            <div id="rating-options" class="form-section" style="display: ${isRating ? 'block' : 'none'}">
                <h5>Échelle de notation</h5>
                <div class="form-row">
                    <div class="form-group">
                        <label>Note minimum</label>
                        <select name="rating_min">
                            <option value="0" ${q.rating_min == 0 ? 'selected' : ''}>0</option>
                            <option value="1" ${q.rating_min != 0 ? 'selected' : ''}>1</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Note maximum</label>
                        <select name="rating_max">
                            <option value="1" ${q.rating_max == 1 ? 'selected' : ''}>1</option>
                            <option value="2" ${q.rating_max == 2 ? 'selected' : ''}>2</option>
                            <option value="3" ${q.rating_max == 3 ? 'selected' : ''}>3</option>
                            <option value="4" ${q.rating_max == 4 ? 'selected' : ''}>4</option>
                            <option value="5" ${q.rating_max == 5 ? 'selected' : ''}>5</option>
                            <option value="6" ${q.rating_max == 6 ? 'selected' : ''}>6</option>
                            <option value="7" ${q.rating_max == 7 ? 'selected' : ''}>7</option>
                            <option value="8" ${q.rating_max == 8 ? 'selected' : ''}>8</option>
                            <option value="9" ${q.rating_max == 9 ? 'selected' : ''}>9</option>
                            <option value="10" ${!q.rating_max || q.rating_max == 10 ? 'selected' : ''}>10</option>
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
                    <label class="checkbox-label"><input type="checkbox" name="photo_optional" ${q.photo_optional || q.photo_required ? 'checked' : ''}> Photo/PDF autorisée</label>
                    <label class="checkbox-label"><input type="checkbox" name="photo_required" ${q.photo_required ? 'checked' : ''}> Photo/PDF obligatoire</label>
                </div>
            </div>
            
            <input type="hidden" name="edit_index" value="${idx}">
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
        </form>
        <script>
            document.querySelector('[name="photo_required"]').addEventListener('change', function() {
                if (this.checked) document.querySelector('[name="photo_optional"]').checked = true;
            });
        </script>
    `, 'modal-lg');
}

function auditSaveQuestion(e) {
    e.preventDefault();
    const form = document.getElementById('question-form');
    const formData = new FormData(form);
    
    const questionType = formData.get('question_type') || 'rating';
    
    const question = {
        section: formData.get('section') || null,
        question: formData.get('question'),
        question_type: questionType,
        rating_min: questionType === 'rating' ? (parseInt(formData.get('rating_min')) || 1) : 1,
        rating_max: questionType === 'rating' ? (parseInt(formData.get('rating_max')) || 10) : 10,
        weight: parseFloat(formData.get('weight')) || 1,
        choices: questionType === 'choice' ? formData.get('choices') : null,
        multiple_selection: questionType === 'choice' && form.querySelector('[name="multiple_selection"]').checked ? 1 : 0,
        comment_required: form.querySelector('[name="comment_required"]').checked ? 1 : 0,
        photo_required: form.querySelector('[name="photo_required"]').checked ? 1 : 0,
        photo_optional: form.querySelector('[name="photo_optional"]').checked ? 1 : 0,
        sort_order: 0
    };
    
    const editIndex = parseInt(formData.get('edit_index'));
    
    if (editIndex >= 0) {
        question.id = auditQuestions[editIndex].id;
        auditQuestions[editIndex] = question;
    } else {
        question.sort_order = auditQuestions.length;
        auditQuestions.push(question);
    }
    
    // Supprimer les placeholders
    auditQuestions = auditQuestions.filter(q => !q._isPlaceholder || q.question);
    
    closeModal();
    document.getElementById('audit-questions-list').innerHTML = auditRenderQuestions();
}

function auditDeleteQuestion(idx) {
    if (!confirm('Supprimer cette question ?')) return;
    auditQuestions.splice(idx, 1);
    document.getElementById('audit-questions-list').innerHTML = auditRenderQuestions();
}

async function auditSaveGrid() {
    const form = document.getElementById('audit-grid-form');
    const formData = new FormData(form);
    
    // Filtrer les questions valides
    const validQuestions = auditQuestions.filter(q => q.question && q.question.trim());
    
    if (validQuestions.length === 0) {
        toast('Ajoutez au moins une question', 'warning');
        return;
    }
    
    // Récupérer les hôtels sélectionnés
    const hotelScope = form.querySelector('[name="hotel_scope"]:checked')?.value || 'all';
    let hotelIds = [];
    if (hotelScope === 'specific') {
        hotelIds = Array.from(form.querySelectorAll('input[name="hotel_ids"]:checked')).map(cb => parseInt(cb.value));
        if (hotelIds.length === 0) {
            toast('Sélectionnez au moins un hôtel ou choisissez "Tous les hôtels"', 'warning');
            return;
        }
    }
    
    // Construire les permissions
    const permissions = [];
    const roles = ['hotel_manager', 'employee'];
    roles.forEach(role => {
        if (form.querySelector(`[name="exec_role_${role}"]`)?.checked) {
            permissions.push({ permission_type: 'execute', target_type: 'role', target_id: role });
        }
        if (form.querySelector(`[name="view_role_${role}"]`)?.checked) {
            permissions.push({ permission_type: 'view', target_type: 'role', target_id: role });
        }
    });
    
    const gridData = {
        id: auditCurrentGrid?.id || null,
        name: formData.get('name'),
        description: formData.get('description'),
        hotel_ids: hotelIds,  // Tableau d'IDs d'hôtels (vide = tous)
        is_mandatory: form.querySelector('[name="is_mandatory"]').checked ? 1 : 0,
        frequency: formData.get('frequency'),
        day_of_month: parseInt(formData.get('day_of_month')) || 15,
        reminder_days: parseInt(formData.get('reminder_days')) || 7,
        questions: validQuestions,
        permissions: permissions
    };
    
    try {
        if (gridData.id) {
            await API.updateAuditGrid(gridData.id, gridData);
            toast('Grille mise à jour', 'success');
        } else {
            await API.createAuditGrid(gridData);
            toast('Grille créée', 'success');
        }
        loadAudit(document.getElementById('page-content'));
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function auditDeleteGrid(gridId) {
    if (!confirm('Supprimer cette grille et tous ses audits ?')) return;
    try {
        await API.deleteAuditGrid(gridId);
        toast('Grille supprimée', 'success');
        auditShowGridsManager();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function auditDuplicateGrid(gridId) {
    try {
        await API.duplicateAuditGrid(gridId);
        toast('Grille dupliquée', 'success');
        auditShowGridsManager();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== RÉALISATION D'AUDIT ====================

async function auditStartNew(gridId, scheduleId = null) {
    try {
        const res = await API.createAudit({
            grid_id: gridId,
            hotel_id: auditCurrentHotel,
            schedule_id: scheduleId
        });
        auditCurrentAudit = res.audit;
        await auditShowExecute(res.audit.id);
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function auditContinue(auditId) {
    await auditShowExecute(auditId);
}

async function auditShowExecute(auditId) {
    const container = document.getElementById('page-content');
    showLoading(container);
    
    try {
        const res = await API.getAudit(auditId);
        const audit = res.audit;
        const questions = res.questions || [];
        const answers = res.answers || [];
        
        // Grouper les réponses par question_id
        const answersMap = {};
        answers.forEach(a => answersMap[a.question_id] = a);
        
        // Grouper les questions par section
        const sections = {};
        questions.forEach(q => {
            const sec = q.section || 'Général';
            if (!sections[sec]) sections[sec] = [];
            sections[sec].push(q);
        });
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-clipboard-check"></i> ${esc(audit.grid_name)}</h3>
                    <div class="header-controls">
                        <button class="btn btn-outline" onclick="auditSaveDraft(${auditId})">
                            <i class="fas fa-save"></i> Sauvegarder brouillon
                        </button>
                        <button class="btn btn-primary" onclick="auditComplete(${auditId})">
                            <i class="fas fa-check"></i> Terminer l'audit
                        </button>
                    </div>
                </div>
                
                <div class="audit-info-bar">
                    <span><i class="fas fa-building"></i> ${esc(audit.hotel_name)}</span>
                    <span><i class="fas fa-user"></i> ${esc(audit.performer_name)}</span>
                    <span><i class="fas fa-calendar"></i> ${formatDateFr(audit.created_at)}</span>
                </div>
                
                <form id="audit-execute-form">
                    <input type="hidden" name="audit_id" value="${auditId}">
                    
                    ${Object.entries(sections).map(([sectionName, sectionQuestions]) => `
                        <div class="audit-execute-section">
                            <h4 class="section-title"><i class="fas fa-folder-open"></i> ${esc(sectionName)}</h4>
                            
                            ${sectionQuestions.map((q, idx) => {
                                const answer = answersMap[q.id] || {};
                                return `
                                <div class="audit-execute-question" data-question-id="${q.id}">
                                    <div class="question-header">
                                        <span class="question-number">${idx + 1}</span>
                                        <span class="question-text">${esc(q.question)}</span>
                                        ${q.weight != 1 ? `<span class="question-weight">Coef. ${q.weight}</span>` : ''}
                                    </div>
                                    
                                    <div class="question-answer">
                                        ${auditRenderAnswerInput(q, answer)}
                                    </div>
                                    
                                    ${q.comment_optional || q.comment_required ? `
                                        <div class="question-comment">
                                            <label>${q.comment_required ? 'Commentaire *' : 'Commentaire'}</label>
                                            <textarea name="comment_${q.id}" rows="2" ${q.comment_required ? 'required' : ''} placeholder="Ajoutez un commentaire...">${esc(answer.answer_text || '')}</textarea>
                                        </div>
                                    ` : ''}
                                    
                                    ${q.photo_optional || q.photo_required ? `
                                        <div class="question-photo">
                                            <label>${q.photo_required ? 'Photo *' : 'Photo'}</label>
                                            <div class="photo-upload-area">
                                                <input type="file" name="photo_${q.id}" accept="image/*" onchange="auditPreviewPhoto(this, ${q.id})" ${q.photo_required && !answer.photo_url ? 'required' : ''}>
                                                <div class="photo-preview" id="photo-preview-${q.id}">
                                                    ${answer.photo_url ? `<img src="${answer.photo_url}" alt="Photo">` : '<i class="fas fa-camera"></i><span>Cliquez pour ajouter</span>'}
                                                </div>
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            `}).join('')}
                        </div>
                    `).join('')}
                    
                    <div class="audit-notes">
                        <label>Notes générales (optionnel)</label>
                        <textarea name="notes" rows="3" placeholder="Notes additionnelles sur cet audit...">${esc(audit.notes || '')}</textarea>
                    </div>
                </form>
            </div>
            
            <div class="audit-bottom-actions">
                <button class="btn btn-outline btn-lg" onclick="loadAudit(document.getElementById('page-content'))">
                    <i class="fas fa-arrow-left"></i> Retour
                </button>
                <button class="btn btn-primary btn-lg" onclick="auditComplete(${auditId})">
                    <i class="fas fa-check-circle"></i> Terminer et soumettre
                </button>
            </div>
        `;
        
    } catch (e) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${e.message}</p></div>`;
    }
}

function auditRenderAnswerInput(question, answer) {
    const q = question;
    const val = answer.answer_value || '';
    
    switch (q.question_type) {
        case 'rating':
            return `
                <div class="rating-input">
                    <div class="rating-scale">
                        ${Array.from({length: q.rating_max - q.rating_min + 1}, (_, i) => {
                            const num = q.rating_min + i;
                            return `<label class="rating-option">
                                <input type="radio" name="answer_${q.id}" value="${num}" ${val == num ? 'checked' : ''} required>
                                <span>${num}</span>
                            </label>`;
                        }).join('')}
                    </div>
                    <div class="rating-labels">
                        <span>Insuffisant</span>
                        <span>Excellent</span>
                    </div>
                </div>
            `;
        
        case 'yes_no':
            return `
                <div class="yes-no-input">
                    <label class="yes-no-option">
                        <input type="radio" name="answer_${q.id}" value="yes" ${val === 'yes' ? 'checked' : ''} required>
                        <span class="yes"><i class="fas fa-check"></i> Oui</span>
                    </label>
                    <label class="yes-no-option">
                        <input type="radio" name="answer_${q.id}" value="no" ${val === 'no' ? 'checked' : ''}>
                        <span class="no"><i class="fas fa-times"></i> Non</span>
                    </label>
                </div>
            `;
        
        case 'text':
            return `<textarea name="answer_${q.id}" rows="3" class="text-answer" placeholder="Votre réponse...">${esc(val)}</textarea>`;
        
        case 'multiple_choice':
            const options = (q.options || '').split('\n').filter(o => o.trim());
            return `
                <div class="multiple-choice-input">
                    ${options.map(opt => `
                        <label class="choice-option">
                            <input type="radio" name="answer_${q.id}" value="${esc(opt.trim())}" ${val === opt.trim() ? 'checked' : ''} required>
                            <span>${esc(opt.trim())}</span>
                        </label>
                    `).join('')}
                </div>
            `;
        
        default:
            return `<input type="text" name="answer_${q.id}" value="${esc(val)}">`;
    }
}

function auditPreviewPhoto(input, questionId) {
    const preview = document.getElementById(`photo-preview-${questionId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function auditSaveDraft(auditId) {
    await auditSaveAnswers(auditId, 'draft');
}

async function auditComplete(auditId) {
    const form = document.getElementById('audit-execute-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        toast('Veuillez répondre à toutes les questions obligatoires', 'warning');
        return;
    }
    await auditSaveAnswers(auditId, 'completed');
}

async function auditSaveAnswers(auditId, status) {
    const form = document.getElementById('audit-execute-form');
    const formData = new FormData(form);
    
    // Collecter les réponses
    const answers = [];
    document.querySelectorAll('.audit-execute-question').forEach(qEl => {
        const questionId = qEl.dataset.questionId;
        const answerInput = qEl.querySelector(`[name="answer_${questionId}"]:checked`) || qEl.querySelector(`[name="answer_${questionId}"]`);
        const commentInput = qEl.querySelector(`[name="comment_${questionId}"]`);
        const photoInput = qEl.querySelector(`[name="photo_${questionId}"]`);
        
        answers.push({
            question_id: parseInt(questionId),
            answer_value: answerInput?.value || '',
            answer_text: commentInput?.value || '',
            has_new_photo: photoInput?.files?.length > 0
        });
    });
    
    try {
        // Créer FormData pour l'upload
        const uploadData = new FormData();
        uploadData.append('audit_id', auditId);
        uploadData.append('status', status);
        uploadData.append('notes', formData.get('notes') || '');
        uploadData.append('answers', JSON.stringify(answers));
        
        // Ajouter les photos
        document.querySelectorAll('.audit-execute-question').forEach(qEl => {
            const questionId = qEl.dataset.questionId;
            const photoInput = qEl.querySelector(`[name="photo_${questionId}"]`);
            if (photoInput?.files?.length > 0) {
                uploadData.append(`photo_${questionId}`, photoInput.files[0]);
            }
        });
        
        await API.saveAuditAnswers(uploadData);
        
        if (status === 'completed') {
            toast('Audit terminé avec succès', 'success');
            loadAudit(document.getElementById('page-content'));
        } else {
            toast('Brouillon sauvegardé', 'success');
        }
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== VISUALISATION ET PDF ====================

async function auditView(auditId) {
    try {
        const res = await API.getAudit(auditId);
        const audit = res.audit;
        const questions = res.questions || [];
        const answers = res.answers || [];
        
        const answersMap = {};
        answers.forEach(a => answersMap[a.question_id] = a);
        
        const sections = {};
        questions.forEach(q => {
            const sec = q.section || 'Général';
            if (!sections[sec]) sections[sec] = [];
            sections[sec].push(q);
        });
        
        openModal(`Audit - ${esc(audit.grid_name)}`, `
            <div class="audit-view">
                <div class="audit-view-header">
                    <div class="audit-view-info">
                        <p><strong>Hôtel:</strong> ${esc(audit.hotel_name)}</p>
                        <p><strong>Réalisé par:</strong> ${esc(audit.performer_name)}</p>
                        <p><strong>Date:</strong> ${formatDateFr(audit.completed_at || audit.created_at)}</p>
                    </div>
                    <div class="audit-view-score ${auditScoreClass(audit.score_percentage)}">
                        <div class="score-value">${audit.score_percentage ? parseFloat(audit.score_percentage).toFixed(1) + '%' : '-'}</div>
                        <div class="score-label">Score global</div>
                    </div>
                </div>
                
                ${Object.entries(sections).map(([sectionName, sectionQuestions]) => `
                    <div class="audit-view-section">
                        <h5>${esc(sectionName)}</h5>
                        ${sectionQuestions.map(q => {
                            const a = answersMap[q.id] || {};
                            return `
                                <div class="audit-view-item">
                                    <div class="audit-view-question">${esc(q.question)}</div>
                                    <div class="audit-view-answer">
                                        <span class="answer-value">${auditFormatAnswer(q, a)}</span>
                                        ${a.answer_text ? `<p class="answer-comment">${esc(a.answer_text)}</p>` : ''}
                                        ${a.photo_url ? `<img src="${a.photo_url}" class="answer-photo" onclick="window.open('${a.photo_url}')">` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `).join('')}
                
                ${audit.notes ? `<div class="audit-view-notes"><strong>Notes:</strong> ${esc(audit.notes)}</div>` : ''}
            </div>
            
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal()">Fermer</button>
                <button class="btn btn-primary" onclick="auditExportPDF(${auditId})"><i class="fas fa-file-pdf"></i> Exporter PDF</button>
            </div>
        `, 'modal-xl');
        
    } catch (e) {
        toast(e.message, 'error');
    }
}

function auditFormatAnswer(question, answer) {
    if (!answer.answer_value) return '-';
    
    switch (question.question_type) {
        case 'rating':
            return `<span class="rating-display">${answer.answer_value}/${question.rating_max}</span>`;
        case 'yes_no':
            return answer.answer_value === 'yes' 
                ? '<span class="badge badge-success">Oui</span>' 
                : '<span class="badge badge-danger">Non</span>';
        default:
            return esc(answer.answer_value);
    }
}

async function auditExportPDF(auditId) {
    try {
        const res = await API.getAudit(auditId);
        const audit = res.audit;
        const questions = res.questions || [];
        const answers = res.answers || [];
        
        const answersMap = {};
        answers.forEach(a => answersMap[a.question_id] = a);
        
        const sections = {};
        questions.forEach(q => {
            const sec = q.section || 'Général';
            if (!sections[sec]) sections[sec] = [];
            sections[sec].push(q);
        });
        
        auditCreatePDF(audit, sections, answersMap);
        
    } catch (e) {
        toast(e.message, 'error');
    }
}

function auditCreatePDF(audit, sections, answersMap) {
    const printWindow = window.open('', '_blank');
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Audit - ${audit.grid_name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1E3A5F; }
        .header h1 { color: #1E3A5F; font-size: 22px; margin-bottom: 5px; }
        .header h2 { color: #666; font-size: 16px; font-weight: normal; margin-bottom: 15px; }
        .info-grid { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info-item { text-align: center; }
        .info-item .label { color: #666; font-size: 11px; }
        .info-item .value { font-weight: bold; font-size: 14px; }
        .score-box { background: #1E3A5F; color: white; padding: 15px 30px; border-radius: 8px; text-align: center; }
        .score-box .score { font-size: 32px; font-weight: bold; }
        .score-box .label { font-size: 12px; opacity: 0.9; }
        .section { margin-top: 25px; }
        .section h3 { background: #f5f5f5; padding: 10px 15px; margin-bottom: 15px; color: #1E3A5F; font-size: 14px; border-left: 4px solid #1E3A5F; }
        .question { margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 5px; page-break-inside: avoid; }
        .question-text { font-weight: 500; margin-bottom: 10px; }
        .answer { margin-top: 10px; }
        .answer-value { background: #E8F5E9; padding: 5px 10px; border-radius: 4px; display: inline-block; }
        .answer-value.negative { background: #FFEBEE; }
        .answer-comment { margin-top: 8px; padding: 10px; background: #f9f9f9; border-left: 3px solid #ddd; font-style: italic; }
        .answer-photo { max-width: 200px; max-height: 150px; margin-top: 10px; border-radius: 5px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; }
        @media print { 
            body { padding: 10px; }
            .question { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 ${esc(audit.grid_name)}</h1>
        <h2>${esc(audit.hotel_name)}</h2>
        
        <div class="info-grid">
            <div class="info-item">
                <div class="label">Réalisé par</div>
                <div class="value">${esc(audit.performer_name)}</div>
            </div>
            <div class="info-item">
                <div class="label">Date</div>
                <div class="value">${formatDateFr(audit.completed_at || audit.created_at)}</div>
            </div>
            <div class="score-box">
                <div class="score">${audit.score_percentage ? parseFloat(audit.score_percentage).toFixed(1) + '%' : '-'}</div>
                <div class="label">Score global</div>
            </div>
        </div>
    </div>
    
    ${Object.entries(sections).map(([sectionName, sectionQuestions]) => `
        <div class="section">
            <h3>${esc(sectionName)}</h3>
            ${sectionQuestions.map((q, idx) => {
                const a = answersMap[q.id] || {};
                const isNegative = (q.question_type === 'yes_no' && a.answer_value === 'no') ||
                                   (q.question_type === 'rating' && parseFloat(a.answer_value) < (q.rating_max / 2));
                return `
                    <div class="question">
                        <div class="question-text">${idx + 1}. ${esc(q.question)}</div>
                        <div class="answer">
                            <span class="answer-value ${isNegative ? 'negative' : ''}">
                                ${q.question_type === 'rating' ? `${a.answer_value || '-'}/${q.rating_max}` : 
                                  q.question_type === 'yes_no' ? (a.answer_value === 'yes' ? '✓ Oui' : '✗ Non') : 
                                  esc(a.answer_value || '-')}
                            </span>
                            ${a.answer_text ? `<div class="answer-comment">${esc(a.answer_text)}</div>` : ''}
                            ${a.photo_url ? `<br><img src="${baseUrl}${a.photo_url}" class="answer-photo">` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `).join('')}
    
    ${audit.notes ? `
        <div class="section">
            <h3>Notes générales</h3>
            <p style="padding: 15px;">${esc(audit.notes)}</p>
        </div>
    ` : ''}
    
    <div class="footer">
        <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        <p>ACL GESTION - Module Audit</p>
    </div>
    
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

// Helpers
function formatDateFr(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
