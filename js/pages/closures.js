/**
 * ACL GESTION - Module Clôtures & Remises
 * Version refaite avec page complète pour création/modification
 */

let closureCurrentTab = 'daily';
let closureHotels = [];
let closureSelectedHotel = null;
let closureConfig = [];
let closureCurrentView = 'list';

async function loadClosures(container) {
    try {
        const res = await API.getHotels();
        closureHotels = res.hotels || [];
    } catch (e) {
        closureHotels = [];
    }
    
    if (API.user.hotel_id) {
        closureSelectedHotel = API.user.hotel_id;
    } else if (closureHotels.length > 0) {
        closureSelectedHotel = closureHotels[0].id;
    }
    
    closureCurrentView = 'list';
    renderClosuresPage(container);
}

function renderClosuresPage(container) {
    container.innerHTML = `
        <div class="page-header">
            <div class="page-header-left">
                <h2><i class="fas fa-cash-register"></i> Clôtures & Remises</h2>
            </div>
            <div class="page-header-right">
                ${closureHotels.length > 1 ? `
                    <select id="closure-hotel-select" class="form-control" onchange="closureChangeHotel(this.value)">
                        ${closureHotels.map(h => `<option value="${h.id}" ${h.id == closureSelectedHotel ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
                    </select>
                ` : ''}
            </div>
        </div>
        
        <div class="closure-tabs">
            <button class="closure-tab ${closureCurrentTab === 'daily' ? 'active' : ''}" data-tab="daily" onclick="showClosureTab('daily')">
                <i class="fas fa-calendar-day"></i>
                <span>Clôture Journalière</span>
            </button>
            <button class="closure-tab ${closureCurrentTab === 'monthly' ? 'active' : ''}" data-tab="monthly" onclick="showClosureTab('monthly')">
                <i class="fas fa-calendar-alt"></i>
                <span>Clôture Mensuelle</span>
            </button>
            <button class="closure-tab ${closureCurrentTab === 'cash' ? 'active' : ''}" data-tab="cash" onclick="showClosureTab('cash')">
                <i class="fas fa-coins"></i>
                <span>Suivi Caisse</span>
            </button>
        </div>
        
        <div id="closure-content">
            <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>
        </div>
    `;
    
    showClosureTab(closureCurrentTab);
}

function closureChangeHotel(hotelId) {
    closureSelectedHotel = hotelId;
    closureCurrentView = 'list';
    showClosureTab(closureCurrentTab);
}

async function showClosureTab(tab) {
    closureCurrentTab = tab;
    closureCurrentView = 'list';
    
    document.querySelectorAll('.closure-tabs .closure-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.closure-tabs .closure-tab[data-tab="${tab}"]`)?.classList.add('active');
    
    const content = document.getElementById('closure-content');
    
    switch (tab) {
        case 'daily':
            await loadDailyClosures(content);
            break;
        case 'monthly':
            await loadMonthlyClosures(content);
            break;
        case 'cash':
            await loadCashTracking(content);
            break;
    }
}

// ==================== CLOTURE JOURNALIERE ====================

async function loadDailyClosures(container) {
    container.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
    
    try {
        const res = await API.get(`/closures/daily?hotel_id=${closureSelectedHotel}`);
        const closures = res.closures || [];
        const pendingDate = res.pending_date || null;
        const config = res.config || [];
        closureConfig = config;
        
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const isLate = today.getHours() >= 13 && !closures.find(c => c.closure_date === yesterdayStr && c.status !== 'draft');
        
        container.innerHTML = `
            ${pendingDate || isLate ? `
                <div class="closure-pending-alert">
                    <div class="closure-pending-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="closure-pending-content">
                        <strong>Clôture en attente !</strong>
                        <p>La clôture du <strong>${formatDateLong(pendingDate || yesterdayStr)}</strong> doit être effectuée${isLate ? ' <span class="text-danger">(en retard)</span>' : ''}.</p>
                    </div>
                    <button class="btn btn-warning" onclick="closureOpenDailyForm('${pendingDate || yesterdayStr}')">
                        <i class="fas fa-edit"></i> Effectuer maintenant
                    </button>
                </div>
            ` : ''}
            
            <div class="card">
                <div class="card-header">
                    <h4><i class="fas fa-calendar-day"></i> Clôtures Journalières</h4>
                    <div class="card-actions">
                        ${hasPermission('closures.create') ? `
                        <button class="btn btn-primary" onclick="closureNewDaily()">
                            <i class="fas fa-plus"></i> Nouvelle clôture
                        </button>
                        ` : ''}
                    </div>
                </div>
                <div class="card-body">
                    ${closures.length === 0 ? `
                        <div class="empty-state">
                            <i class="fas fa-calendar-times"></i>
                            <p>Aucune clôture journalière</p>
                            ${hasPermission('closures.create') ? `
                            <button class="btn btn-primary mt-15" onclick="closureNewDaily()">
                                <i class="fas fa-plus"></i> Créer la première clôture
                            </button>
                            ` : ''}
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table closures-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Encaissements</th>
                                        <th>Dépenses</th>
                                        <th>Solde</th>
                                        <th>Documents</th>
                                        <th>Statut</th>
                                        <th>Soumis par</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${closures.map(c => {
                                        const docsComplete = c.documents_count >= c.required_docs;
                                        const docsClass = c.documents_count === 0 ? 'empty' : (docsComplete ? 'complete' : 'incomplete');
                                        return `
                                        <tr>
                                            <td class="date-cell">${formatDateLong(c.closure_date)}</td>
                                            <td class="amount-positive">+${formatMoney(c.cash_received)}</td>
                                            <td class="amount-negative">-${formatMoney(c.cash_spent)}</td>
                                            <td class="amount-balance">${formatMoney(c.cash_balance)}</td>
                                            <td>
                                                <span class="docs-badge ${docsClass}">
                                                    <i class="fas fa-file-alt"></i>
                                                    ${c.documents_count || 0} / ${c.required_docs || 0}
                                                </span>
                                            </td>
                                            <td>${closureStatusBadge(c.status)}</td>
                                            <td>${c.submitted_by_name || '<span class="text-muted">-</span>'}</td>
                                            <td class="closure-actions">
                                                <button class="btn btn-sm btn-outline" onclick="closureOpenDailyForm('${c.closure_date}', ${c.id})" title="Voir/Modifier">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                                ${c.status === 'submitted' && hasPermission('closures.validate') ? `
                                                    <button class="btn btn-sm btn-success" onclick="closureValidate(${c.id})" title="Valider">
                                                        <i class="fas fa-check"></i>
                                                    </button>
                                                ` : ''}
                                            </td>
                                        </tr>
                                    `}).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
}

function closureNewDaily() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const maxDate = yesterday.toISOString().split('T')[0];
    const defaultDate = maxDate;
    
    const container = document.getElementById('closure-content');
    container.innerHTML = `
        <div class="closure-form-page">
            <div class="closure-form-header">
                <button class="btn btn-outline" onclick="showClosureTab('daily')">
                    <i class="fas fa-arrow-left"></i> Retour
                </button>
                <h3><i class="fas fa-calendar-plus"></i> Nouvelle Clôture Journalière</h3>
            </div>
            
            <div class="card">
                <div class="card-body">
                    <form id="closure-date-form" onsubmit="closureLoadFormForDate(event)">
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label><i class="fas fa-calendar"></i> Date de la clôture *</label>
                                <input type="date" name="closure_date" id="closure-date-input" 
                                       value="${defaultDate}" max="${maxDate}" required class="form-control">
                                <small class="text-muted">Sélectionnez la date pour laquelle effectuer la clôture</small>
                            </div>
                        </div>
                        
                        <div id="closure-date-error" class="alert alert-danger" style="display: none;">
                            <i class="fas fa-exclamation-circle"></i>
                            <span id="closure-date-error-text"></span>
                        </div>
                        
                        <div id="closure-date-warning" class="alert alert-warning" style="display: none;">
                            <i class="fas fa-info-circle"></i>
                            <span id="closure-date-warning-text"></span>
                        </div>
                        
                        <div class="form-actions mt-20">
                            <button type="button" class="btn btn-outline" onclick="showClosureTab('daily')">Annuler</button>
                            <button type="submit" class="btn btn-primary" id="closure-date-submit">
                                <i class="fas fa-arrow-right"></i> Continuer
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('closure-date-input').addEventListener('change', closureCheckDateAvailability);
    closureCheckDateAvailability();
}

async function closureCheckDateAvailability() {
    const dateInput = document.getElementById('closure-date-input');
    const errorDiv = document.getElementById('closure-date-error');
    const warningDiv = document.getElementById('closure-date-warning');
    const submitBtn = document.getElementById('closure-date-submit');
    
    if (!dateInput || !dateInput.value) return;
    
    errorDiv.style.display = 'none';
    warningDiv.style.display = 'none';
    submitBtn.disabled = false;
    
    try {
        const res = await API.get(`/closures/daily/${closureSelectedHotel}/${dateInput.value}`);
        const closure = res.closure;
        
        if (closure && closure.status === 'validated') {
            document.getElementById('closure-date-error-text').textContent = 
                'Cette date a déjà été clôturée et validée. Vous ne pouvez plus la modifier.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = true;
        } else if (closure && closure.status === 'submitted') {
            document.getElementById('closure-date-warning-text').textContent = 
                'Une clôture existe déjà pour cette date (en attente de validation). Vous pouvez la modifier.';
            warningDiv.style.display = 'block';
            submitBtn.innerHTML = '<i class="fas fa-edit"></i> Modifier la clôture';
        } else if (closure && closure.status === 'draft') {
            document.getElementById('closure-date-warning-text').textContent = 
                'Un brouillon existe pour cette date. Vous pouvez le compléter.';
            warningDiv.style.display = 'block';
            submitBtn.innerHTML = '<i class="fas fa-edit"></i> Compléter le brouillon';
        } else {
            submitBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Créer la clôture';
        }
    } catch (e) {
        submitBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Créer la clôture';
    }
}

async function closureLoadFormForDate(e) {
    e.preventDefault();
    const date = document.getElementById('closure-date-input').value;
    if (!date) return;
    await closureOpenDailyForm(date);
}

async function closureOpenDailyForm(date, closureId = null) {
    const container = document.getElementById('closure-content');
    container.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
    
    try {
        const res = await API.get(`/closures/daily/${closureSelectedHotel}/${date}`);
        const closure = res.closure || {};
        const config = res.config || [];
        const documents = res.documents || [];
        closureConfig = config;
        
        const isReadOnly = closure.status === 'validated';
        const isEdit = !!closure.id;
        
        container.innerHTML = `
            <div class="closure-form-page">
                <div class="closure-form-header">
                    <button class="btn btn-outline" onclick="showClosureTab('daily')">
                        <i class="fas fa-arrow-left"></i> Retour à la liste
                    </button>
                    <h3>
                        <i class="fas fa-calendar-day"></i> 
                        Clôture du ${formatDateLong(date)}
                        ${closure.status ? closureStatusBadge(closure.status) : '<span class="badge badge-info">Nouvelle</span>'}
                    </h3>
                </div>
                
                ${isReadOnly ? `
                    <div class="alert alert-info">
                        <i class="fas fa-lock"></i> 
                        Cette clôture a été validée et ne peut plus être modifiée.
                    </div>
                ` : ''}
                
                <form id="closure-daily-form" onsubmit="closureSaveDaily(event)" enctype="multipart/form-data">
                    <input type="hidden" name="hotel_id" value="${closureSelectedHotel}">
                    <input type="hidden" name="closure_date" value="${date}">
                    <input type="hidden" name="closure_id" value="${closure.id || ''}">
                    
                    <!-- Section Encaissement & Dépenses -->
                    <div class="card mb-20">
                        <div class="card-header">
                            <h4><i class="fas fa-euro-sign"></i> Encaissement & Dépenses</h4>
                        </div>
                        <div class="card-body">
                            <div class="form-row">
                                <div class="form-group col-md-6">
                                    <label><i class="fas fa-coins text-success"></i> Espèces encaissées *</label>
                                    <div class="input-group">
                                        <input type="number" name="cash_received" step="0.01" min="0" 
                                               value="${closure.cash_received || 0}" 
                                               ${isReadOnly ? 'disabled' : 'required'}
                                               class="form-control" id="input-cash-received"
                                               onchange="closureCalculateBalance()">
                                        <span class="input-group-text">€</span>
                                    </div>
                                    <small class="text-muted">Total des espèces reçues ce jour</small>
                                </div>
                                
                                <div class="form-group col-md-6">
                                    <label><i class="fas fa-shopping-cart text-danger"></i> Dépenses *</label>
                                    <div class="input-group">
                                        <input type="number" name="cash_spent" step="0.01" min="0" 
                                               value="${closure.cash_spent || 0}" 
                                               ${isReadOnly ? 'disabled' : 'required'}
                                               class="form-control" id="input-cash-spent"
                                               onchange="closureCalculateBalance()">
                                        <span class="input-group-text">€</span>
                                    </div>
                                    <small class="text-muted">Total des dépenses effectuées</small>
                                </div>
                            </div>
                            
                            <div class="closure-balance-summary">
                                <div class="balance-item">
                                    <span>Solde du jour</span>
                                    <strong id="closure-balance" class="${(closure.cash_received || 0) - (closure.cash_spent || 0) >= 0 ? 'text-success' : 'text-danger'}">
                                        ${formatMoney((closure.cash_received || 0) - (closure.cash_spent || 0))}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Section Justificatif des dépenses -->
                    <div class="card mb-20" id="expense-receipt-section">
                        <div class="card-header">
                            <h4><i class="fas fa-receipt"></i> Justificatif des dépenses</h4>
                            <span class="badge badge-warning">Si dépenses > 0</span>
                        </div>
                        <div class="card-body">
                            <div class="document-upload-card single-upload ${closure.expense_receipt ? 'has-file' : ''}" id="doc-card-expense">
                                <div class="document-card-header">
                                    <div class="document-icon" style="color: #e67e22">
                                        <i class="fas fa-receipt"></i>
                                    </div>
                                    <div class="document-title">
                                        <span class="document-name">Pièce justificative</span>
                                        <span class="document-conditional">Obligatoire si dépenses > 0€</span>
                                    </div>
                                </div>
                                
                                <div class="document-card-body">
                                    ${closure.expense_receipt ? `
                                        <div class="document-preview">
                                            <div class="preview-icon success">
                                                <i class="fas fa-check-circle"></i>
                                            </div>
                                            <div class="preview-info">
                                                <span class="preview-status">Justificatif joint</span>
                                                <a href="${closure.expense_receipt}" target="_blank" class="preview-link">
                                                    <i class="fas fa-external-link-alt"></i> Voir le fichier
                                                </a>
                                            </div>
                                        </div>
                                        ${!isReadOnly ? `
                                            <div class="document-replace">
                                                <label class="replace-label">
                                                    <i class="fas fa-sync-alt"></i> Remplacer le justificatif
                                                    <input type="file" name="expense_receipt" 
                                                           accept=".pdf,.jpg,.jpeg,.png"
                                                           class="file-input-hidden"
                                                           onchange="updateExpenseCard(this)">
                                                </label>
                                            </div>
                                        ` : ''}
                                    ` : `
                                        <div class="document-dropzone" 
                                             onclick="document.getElementById('file-input-expense').click()"
                                             ondragover="handleExpenseDragOver(event)"
                                             ondragleave="handleExpenseDragLeave(event)"
                                             ondrop="handleExpenseDrop(event)">
                                            <div class="dropzone-icon">
                                                <i class="fas fa-cloud-upload-alt"></i>
                                            </div>
                                            <div class="dropzone-text">
                                                <span class="dropzone-main">Glissez votre justificatif ici</span>
                                                <span class="dropzone-sub">ou cliquez pour sélectionner</span>
                                            </div>
                                            <div class="dropzone-formats">
                                                Ticket, facture, reçu • PDF, JPG, PNG (max 5Mo)
                                            </div>
                                        </div>
                                        <input type="file" id="file-input-expense" name="expense_receipt" 
                                               accept=".pdf,.jpg,.jpeg,.png"
                                               ${isReadOnly ? 'disabled' : ''}
                                               class="file-input-hidden"
                                               onchange="updateExpenseCard(this)">
                                        <div class="document-selected" id="selected-expense" style="display: none;">
                                            <div class="selected-file">
                                                <i class="fas fa-file"></i>
                                                <span class="selected-filename"></span>
                                            </div>
                                            <button type="button" class="btn-remove-file" onclick="removeExpenseFile()">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Section Commentaire -->
                    <div class="card mb-20">
                        <div class="card-header">
                            <h4><i class="fas fa-comment-alt"></i> Commentaire</h4>
                            <span class="badge badge-warning">Si dépenses > 0</span>
                        </div>
                        <div class="card-body">
                            <div class="form-group">
                                <label>Détail des opérations</label>
                                <textarea name="notes" rows="4" 
                                          placeholder="Décrivez les dépenses de la journée (nature des achats, fournisseurs...)..."
                                          ${isReadOnly ? 'disabled' : ''}
                                          class="form-control" id="input-notes">${closure.notes || ''}</textarea>
                                <small class="text-muted">Précisez le détail des achats effectués. Obligatoire si vous avez des dépenses.</small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Section Documents requis -->
                    ${config.length > 0 ? `
                        <div class="card mb-20">
                            <div class="card-header">
                                <h4><i class="fas fa-folder-open"></i> Documents à joindre</h4>
                                <span class="badge badge-info">${config.filter(c => c.is_required).length} obligatoire(s)</span>
                            </div>
                            <div class="card-body">
                                <div class="documents-upload-grid">
                                    ${config.map(c => {
                                        const existingDoc = documents.find(d => d.config_id == c.id);
                                        const docIcon = c.document_type === 'pdf' ? 'file-pdf' : 'file-image';
                                        const docColor = c.document_type === 'pdf' ? '#e74c3c' : '#3498db';
                                        return `
                                            <div class="document-upload-card ${c.is_required ? 'required' : ''} ${existingDoc ? 'has-file' : ''}" 
                                                 id="doc-card-${c.id}">
                                                <div class="document-card-header">
                                                    <div class="document-icon" style="color: ${docColor}">
                                                        <i class="fas fa-${docIcon}"></i>
                                                    </div>
                                                    <div class="document-title">
                                                        <span class="document-name">${esc(c.document_name)}</span>
                                                        ${c.is_required ? 
                                                            '<span class="document-required">Obligatoire</span>' : 
                                                            '<span class="document-optional">Optionnel</span>'}
                                                    </div>
                                                </div>
                                                
                                                <div class="document-card-body">
                                                    ${existingDoc ? `
                                                        <div class="document-preview">
                                                            <div class="preview-icon success">
                                                                <i class="fas fa-check-circle"></i>
                                                            </div>
                                                            <div class="preview-info">
                                                                <span class="preview-status">Document joint</span>
                                                                <a href="${existingDoc.file_url}" target="_blank" class="preview-link">
                                                                    <i class="fas fa-external-link-alt"></i> Voir le fichier
                                                                </a>
                                                            </div>
                                                        </div>
                                                        <div class="document-replace">
                                                            <label class="replace-label">
                                                                <i class="fas fa-sync-alt"></i> Remplacer
                                                                <input type="file" name="doc_${c.id}" 
                                                                       accept="${c.document_type === 'pdf' ? '.pdf' : '.jpg,.jpeg,.png,.pdf'}"
                                                                       ${isReadOnly ? 'disabled' : ''}
                                                                       class="file-input-hidden"
                                                                       onchange="updateDocumentCard(${c.id}, this)">
                                                            </label>
                                                        </div>
                                                    ` : `
                                                        <div class="document-dropzone" 
                                                             onclick="document.getElementById('file-input-${c.id}').click()"
                                                             ondragover="handleDragOver(event, ${c.id})"
                                                             ondragleave="handleDragLeave(event, ${c.id})"
                                                             ondrop="handleDrop(event, ${c.id})">
                                                            <div class="dropzone-icon">
                                                                <i class="fas fa-cloud-upload-alt"></i>
                                                            </div>
                                                            <div class="dropzone-text">
                                                                <span class="dropzone-main">Glissez un fichier ici</span>
                                                                <span class="dropzone-sub">ou cliquez pour sélectionner</span>
                                                            </div>
                                                            <div class="dropzone-formats">
                                                                ${c.document_type === 'pdf' ? 'PDF uniquement' : 'PDF, JPG, PNG'}
                                                            </div>
                                                        </div>
                                                        <input type="file" id="file-input-${c.id}" name="doc_${c.id}" 
                                                               accept="${c.document_type === 'pdf' ? '.pdf' : '.jpg,.jpeg,.png,.pdf'}"
                                                               ${isReadOnly ? 'disabled' : ''}
                                                               ${c.is_required && !isReadOnly ? 'required' : ''}
                                                               class="file-input-hidden"
                                                               onchange="updateDocumentCard(${c.id}, this)">
                                                        <div class="document-selected" id="selected-${c.id}" style="display: none;">
                                                            <div class="selected-file">
                                                                <i class="fas fa-file"></i>
                                                                <span class="selected-filename"></span>
                                                            </div>
                                                            <button type="button" class="btn-remove-file" onclick="removeSelectedFile(${c.id})">
                                                                <i class="fas fa-times"></i>
                                                            </button>
                                                        </div>
                                                    `}
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Actions -->
                    ${!isReadOnly ? `
                        <div class="closure-form-actions">
                            <button type="button" class="btn btn-outline btn-lg" onclick="showClosureTab('daily')">
                                <i class="fas fa-times"></i> Annuler
                            </button>
                            <button type="button" class="btn btn-secondary btn-lg" onclick="closureSaveDraft()">
                                <i class="fas fa-save"></i> Enregistrer brouillon
                            </button>
                            <button type="submit" class="btn btn-primary btn-lg">
                                <i class="fas fa-check"></i> Soumettre la clôture
                            </button>
                        </div>
                    ` : `
                        <div class="closure-form-actions">
                            <button type="button" class="btn btn-outline btn-lg" onclick="showClosureTab('daily')">
                                <i class="fas fa-arrow-left"></i> Retour
                            </button>
                        </div>
                    `}
                </form>
            </div>
        `;
        
    } catch (e) {
        container.innerHTML = `
            <div class="closure-form-page">
                <div class="closure-form-header">
                    <button class="btn btn-outline" onclick="showClosureTab('daily')">
                        <i class="fas fa-arrow-left"></i> Retour
                    </button>
                    <h3><i class="fas fa-calendar-day"></i> Clôture du ${formatDateLong(date)}</h3>
                </div>
                <div class="alert alert-danger">${e.message}</div>
            </div>
        `;
    }
}

function closureCalculateBalance() {
    const received = parseFloat(document.getElementById('input-cash-received')?.value) || 0;
    const spent = parseFloat(document.getElementById('input-cash-spent')?.value) || 0;
    const balance = received - spent;
    
    const balanceEl = document.getElementById('closure-balance');
    if (balanceEl) {
        balanceEl.textContent = formatMoney(balance);
        balanceEl.className = balance >= 0 ? 'text-success' : 'text-danger';
    }
}

async function closureSaveDraft() {
    const form = document.getElementById('closure-daily-form');
    if (!form) return;
    
    const formData = new FormData(form);
    formData.append('status', 'draft');
    
    try {
        const btn = document.querySelector('.closure-form-actions');
        if (btn) btn.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
        
        await API.upload('/closures/daily', formData);
        toast('Brouillon enregistré', 'success');
        showClosureTab('daily');
    } catch (e) {
        toast(e.message, 'error');
        showClosureTab('daily');
    }
}

async function closureSaveDaily(e) {
    e.preventDefault();
    
    const form = document.getElementById('closure-daily-form');
    if (!form) return;
    
    const cashSpent = parseFloat(form.querySelector('[name="cash_spent"]')?.value) || 0;
    const notes = form.querySelector('[name="notes"]')?.value?.trim() || '';
    const expenseReceipt = form.querySelector('[name="expense_receipt"]')?.files[0];
    const existingReceipt = document.querySelector('#expense-receipt-section .existing-file');
    
    // Validation uniquement si dépenses > 0
    if (cashSpent > 0) {
        // Commentaire obligatoire si dépenses
        if (!notes) {
            toast('Un commentaire est obligatoire pour justifier les dépenses', 'error');
            form.querySelector('[name="notes"]')?.focus();
            form.querySelector('[name="notes"]')?.classList.add('input-error');
            return;
        }
        
        // Justificatif obligatoire si dépenses
        if (!expenseReceipt && !existingReceipt) {
            toast('Un justificatif est obligatoire pour les dépenses', 'error');
            form.querySelector('[name="expense_receipt"]')?.focus();
            return;
        }
    }
    
    const formData = new FormData(form);
    formData.append('status', 'submitted');
    
    try {
        const btn = document.querySelector('.closure-form-actions');
        if (btn) btn.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
        
        await API.upload('/closures/daily', formData);
        toast('Clôture soumise avec succès', 'success');
        showClosureTab('daily');
    } catch (e) {
        toast(e.message, 'error');
        showClosureTab('daily');
    }
}

async function closureValidate(id) {
    if (!confirm('Valider cette clôture ? Cette action est irréversible.')) return;
    
    try {
        await API.put(`/closures/daily/${id}/validate`);
        toast('Clôture validée', 'success');
        showClosureTab('daily');
    } catch (e) {
        toast(e.message, 'error');
    }
}

function closureStatusBadge(status) {
    const badges = {
        'draft': '<span class="badge badge-secondary"><i class="fas fa-pencil-alt"></i> Brouillon</span>',
        'submitted': '<span class="badge badge-warning"><i class="fas fa-clock"></i> En attente</span>',
        'validated': '<span class="badge badge-success"><i class="fas fa-check"></i> Validée</span>',
        'rejected': '<span class="badge badge-danger"><i class="fas fa-times"></i> Rejetée</span>'
    };
    return badges[status] || `<span class="badge">${status}</span>`;
}

// ==================== CLOTURE MENSUELLE ====================

async function loadMonthlyClosures(container) {
    container.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
    
    try {
        const res = await API.get(`/closures/monthly?hotel_id=${closureSelectedHotel}`);
        const closures = res.closures || [];
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h4><i class="fas fa-calendar-alt"></i> Clôtures Mensuelles</h4>
                </div>
                <div class="card-body">
                    ${closures.length === 0 ? `
                        <div class="empty-state">
                            <i class="fas fa-calendar-times"></i>
                            <p>Aucune clôture mensuelle</p>
                            <small>Les clôtures mensuelles sont générées automatiquement à partir des clôtures journalières</small>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Mois</th>
                                        <th>Nb clôtures</th>
                                        <th>Total encaissé</th>
                                        <th>Total dépenses</th>
                                        <th>Solde</th>
                                        <th>Statut</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${closures.map(c => `
                                        <tr>
                                            <td>${c.month_name} ${c.year}</td>
                                            <td>${c.closures_count}</td>
                                            <td class="amount-positive">+${formatMoney(c.total_received)}</td>
                                            <td class="amount-negative">-${formatMoney(c.total_spent)}</td>
                                            <td class="amount-balance">${formatMoney(c.balance)}</td>
                                            <td>${c.is_complete ? '<span class="badge badge-success">Complet</span>' : '<span class="badge badge-warning">Incomplet</span>'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
}

// ==================== SUIVI CAISSE ====================

async function loadCashTracking(container) {
    container.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
    
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    
    await renderCashTracking(container, month, year);
}

async function renderCashTracking(container, month, year) {
    try {
        const res = await API.get(`/closures/cash-tracking-detailed?hotel_id=${closureSelectedHotel}&month=${month}&year=${year}`);
        const data = res.data || [];
        const previousBalance = res.previous_balance || 0;
        const summary = res.summary || {};
        
        // Vérifier si l'utilisateur peut modifier
        const canEdit = hasPermission('closures.edit_all');
        
        const daysInMonth = new Date(year, month, 0).getDate();
        const allDates = [];
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const existing = data.find(row => row.date === dateStr);
            allDates.push(existing || { date: dateStr, encaisse: 0, remise_banque: 0, depenses: 0, commentaire: '', has_closure: false });
        }
        
        container.innerHTML = `
            <div class="cash-tracking-header">
                <div class="cash-tracking-filters">
                    <select id="cash-month" class="form-control" onchange="refreshCashTracking()">
                        ${Array.from({length: 12}, (_, i) => `
                            <option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${getMonthName(i + 1)}</option>
                        `).join('')}
                    </select>
                    <select id="cash-year" class="form-control" onchange="refreshCashTracking()">
                        ${[year - 1, year, year + 1].map(y => `
                            <option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="cash-tracking-actions">
                    ${canEdit ? `
                        <button class="btn btn-primary" onclick="showBankDepositModal()">
                            <i class="fas fa-university"></i> Saisir Remise Banque
                        </button>
                    ` : ''}
                    <button class="btn btn-outline" onclick="exportCashTracking()">
                        <i class="fas fa-download"></i> Exporter CSV
                    </button>
                </div>
            </div>
            
            <div class="cash-summary-cards">
                <div class="summary-card">
                    <div class="summary-icon green"><i class="fas fa-arrow-down"></i></div>
                    <div class="summary-info">
                        <span class="summary-label">Total Encaissé</span>
                        <span class="summary-value">${formatMoney(summary.total_encaisse || 0)}</span>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="summary-icon orange"><i class="fas fa-university"></i></div>
                    <div class="summary-info">
                        <span class="summary-label">Remises Banque</span>
                        <span class="summary-value">${formatMoney(summary.total_remise_banque || 0)}</span>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="summary-icon red"><i class="fas fa-shopping-cart"></i></div>
                    <div class="summary-info">
                        <span class="summary-label">Total Dépenses</span>
                        <span class="summary-value">${formatMoney(summary.total_depenses || 0)}</span>
                    </div>
                </div>
                <div class="summary-card">
                    <div class="summary-icon blue"><i class="fas fa-wallet"></i></div>
                    <div class="summary-info">
                        <span class="summary-label">Solde Fin Mois</span>
                        <span class="summary-value">${formatMoney(summary.solde_fin_mois || 0)}</span>
                    </div>
                </div>
            </div>
            
            ${canEdit ? '' : `
                <div class="alert alert-info mb-15">
                    <i class="fas fa-info-circle"></i> 
                    Cliquez sur une ligne pour voir/modifier la clôture correspondante.
                    <strong>Seuls les administrateurs et responsables de groupe peuvent modifier les données.</strong>
                </div>
            `}
            
            <div class="card">
                <div class="card-header">
                    <h4><i class="fas fa-table"></i> Suivi Caisse - ${getMonthName(month)} ${year}</h4>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table cash-table">
                            <thead>
                                <tr>
                                    <th rowspan="2" class="col-date">Date</th>
                                    <th rowspan="2" class="col-encaisse">Encaissés</th>
                                    <th colspan="2" class="col-decaissement-header text-center">Décaissements</th>
                                    <th rowspan="2" class="col-total">Total Décaissés</th>
                                    <th rowspan="2" class="col-reste">Reste</th>
                                    <th rowspan="2" class="col-comment">Commentaire</th>
                                </tr>
                                <tr>
                                    <th class="col-sub">Remise Banque</th>
                                    <th class="col-sub">Dépenses</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="row-previous-balance">
                                    <td><strong>Reste Mois -1</strong></td>
                                    <td class="text-success">${formatMoney(previousBalance)}</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td class="text-primary"><strong>${formatMoney(previousBalance)}</strong></td>
                                    <td class="text-muted">Report mois précédent</td>
                                </tr>
                                
                                ${allDates.map(row => {
                                    const enc = parseFloat(row.encaisse) || 0;
                                    const rem = parseFloat(row.remise_banque) || 0;
                                    const dep = parseFloat(row.depenses) || 0;
                                    const totalDecaisse = rem + dep;
                                    const reste = enc - totalDecaisse;
                                    const hasData = enc > 0 || totalDecaisse > 0;
                                    const rowClass = !hasData ? 'row-empty' : (reste < 0 ? 'row-negative' : '');
                                    const clickable = row.has_closure ? 'clickable-row' : '';
                                    
                                    return `
                                    <tr class="${rowClass} ${clickable}" 
                                        ${row.has_closure ? `onclick="goToClosureEdit('${row.date}')" title="Cliquer pour ${canEdit ? 'modifier' : 'voir'} la clôture"` : ''}>
                                        <td class="date-cell">${formatDateShort(row.date)}</td>
                                        <td class="amount-cell ${enc > 0 ? 'text-success' : ''}">${enc > 0 ? '+' + formatMoney(enc) : '-'}</td>
                                        <td class="amount-cell ${rem > 0 ? 'text-warning' : ''}">${rem > 0 ? '-' + formatMoney(rem) : '-'}</td>
                                        <td class="amount-cell ${dep > 0 ? 'text-danger' : ''}">${dep > 0 ? '-' + formatMoney(dep) : '-'}</td>
                                        <td class="amount-cell">${totalDecaisse > 0 ? '-' + formatMoney(totalDecaisse) : '-'}</td>
                                        <td class="amount-cell ${reste >= 0 ? 'text-success' : 'text-danger'}">${hasData ? formatMoney(reste) : '-'}</td>
                                        <td class="comment-cell" title="${esc(row.commentaire || '')}">${esc(row.commentaire || '')}</td>
                                    </tr>
                                `}).join('')}
                                
                                <tr class="row-totals">
                                    <td><strong>TOTAUX</strong></td>
                                    <td class="text-success"><strong>+${formatMoney(summary.total_encaisse || 0)}</strong></td>
                                    <td class="text-warning"><strong>-${formatMoney(summary.total_remise_banque || 0)}</strong></td>
                                    <td class="text-danger"><strong>-${formatMoney(summary.total_depenses || 0)}</strong></td>
                                    <td><strong>-${formatMoney((summary.total_remise_banque || 0) + (summary.total_depenses || 0))}</strong></td>
                                    <td class="text-primary"><strong>${formatMoney(summary.solde_fin_mois || 0)}</strong></td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
}

// Rediriger vers la clôture pour modification
function goToClosureEdit(date) {
    closureOpenDailyForm(date);
}

async function refreshCashTracking() {
    const month = parseInt(document.getElementById('cash-month')?.value) || (new Date().getMonth() + 1);
    const year = parseInt(document.getElementById('cash-year')?.value) || new Date().getFullYear();
    const container = document.getElementById('closure-content');
    
    await renderCashTracking(container, month, year);
    
    document.getElementById('cash-month').value = month;
    document.getElementById('cash-year').value = year;
}

async function exportCashTracking() {
    const month = document.getElementById('cash-month')?.value || (new Date().getMonth() + 1);
    const year = document.getElementById('cash-year')?.value || new Date().getFullYear();
    
    try {
        const response = await fetch(`${API.baseUrl}/closures/cash-tracking-export?hotel_id=${closureSelectedHotel}&month=${month}&year=${year}`, {
            headers: { 'Authorization': `Bearer ${API.token}` }
        });
        
        if (!response.ok) throw new Error('Erreur export');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `suivi_caisse_${year}_${month}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast('Export téléchargé', 'success');
    } catch (e) {
        toast('Erreur lors de l\'export', 'error');
    }
}

// ==================== DOCUMENT UPLOAD FUNCTIONS ====================

// Expense receipt specific functions
function handleExpenseDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    const card = document.getElementById('doc-card-expense');
    if (card) card.classList.add('drag-over');
}

function handleExpenseDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    const card = document.getElementById('doc-card-expense');
    if (card) card.classList.remove('drag-over');
}

function handleExpenseDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const card = document.getElementById('doc-card-expense');
    if (card) card.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const input = document.getElementById('file-input-expense');
        if (input) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(files[0]);
            input.files = dataTransfer.files;
            updateExpenseCard(input);
        }
    }
}

function updateExpenseCard(input) {
    const card = document.getElementById('doc-card-expense');
    if (!card) return;
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileName = file.name;
        const fileSize = formatFileSize(file.size);
        
        // Check if this is a replacement (has .document-preview)
        const existingPreview = card.querySelector('.document-preview');
        const replaceSection = card.querySelector('.document-replace');
        
        if (existingPreview && replaceSection) {
            // Replacement mode
            existingPreview.innerHTML = `
                <div class="preview-icon warning">
                    <i class="fas fa-sync-alt"></i>
                </div>
                <div class="preview-info">
                    <span class="preview-status">Nouveau justificatif sélectionné</span>
                    <span class="preview-filename">${fileName} (${fileSize})</span>
                </div>
            `;
            card.classList.add('file-replacing');
        } else {
            // New upload mode
            const selectedDiv = document.getElementById('selected-expense');
            const dropzone = card.querySelector('.document-dropzone');
            
            if (selectedDiv) {
                selectedDiv.style.display = 'flex';
                selectedDiv.querySelector('.selected-filename').textContent = `${fileName} (${fileSize})`;
            }
            
            if (dropzone) {
                dropzone.style.display = 'none';
            }
        }
        
        card.classList.add('file-selected');
    }
}

function removeExpenseFile() {
    const input = document.getElementById('file-input-expense');
    const card = document.getElementById('doc-card-expense');
    const selectedDiv = document.getElementById('selected-expense');
    const dropzone = card?.querySelector('.document-dropzone');
    
    if (input) input.value = '';
    if (selectedDiv) selectedDiv.style.display = 'none';
    if (dropzone) dropzone.style.display = 'flex';
    if (card) card.classList.remove('file-selected');
}

// Generic document functions

function handleDragOver(event, docId) {
    event.preventDefault();
    event.stopPropagation();
    const card = document.getElementById(`doc-card-${docId}`);
    if (card) card.classList.add('drag-over');
}

function handleDragLeave(event, docId) {
    event.preventDefault();
    event.stopPropagation();
    const card = document.getElementById(`doc-card-${docId}`);
    if (card) card.classList.remove('drag-over');
}

function handleDrop(event, docId) {
    event.preventDefault();
    event.stopPropagation();
    
    const card = document.getElementById(`doc-card-${docId}`);
    if (card) card.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const input = document.getElementById(`file-input-${docId}`);
        if (input) {
            // Create a new DataTransfer to set files
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(files[0]);
            input.files = dataTransfer.files;
            updateDocumentCard(docId, input);
        }
    }
}

function updateDocumentCard(docId, input) {
    const card = document.getElementById(`doc-card-${docId}`);
    if (!card) return;
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileName = file.name;
        const fileSize = formatFileSize(file.size);
        
        // Check if this is a replacement (has .document-preview)
        const existingPreview = card.querySelector('.document-preview');
        const replaceSection = card.querySelector('.document-replace');
        
        if (existingPreview && replaceSection) {
            // Replacement mode - update the preview to show new file selected
            existingPreview.innerHTML = `
                <div class="preview-icon warning">
                    <i class="fas fa-sync-alt"></i>
                </div>
                <div class="preview-info">
                    <span class="preview-status">Nouveau fichier sélectionné</span>
                    <span class="preview-filename">${fileName} (${fileSize})</span>
                </div>
            `;
            card.classList.add('file-replacing');
        } else {
            // New upload mode
            const selectedDiv = document.getElementById(`selected-${docId}`);
            const dropzone = card.querySelector('.document-dropzone');
            
            if (selectedDiv) {
                selectedDiv.style.display = 'flex';
                selectedDiv.querySelector('.selected-filename').textContent = `${fileName} (${fileSize})`;
            }
            
            if (dropzone) {
                dropzone.style.display = 'none';
            }
        }
        
        // Add success state to card
        card.classList.add('file-selected');
    }
}

function removeSelectedFile(docId) {
    const input = document.getElementById(`file-input-${docId}`);
    const card = document.getElementById(`doc-card-${docId}`);
    const selectedDiv = document.getElementById(`selected-${docId}`);
    const dropzone = card?.querySelector('.document-dropzone');
    
    // Clear input
    if (input) {
        input.value = '';
    }
    
    // Hide selected, show dropzone
    if (selectedDiv) {
        selectedDiv.style.display = 'none';
    }
    if (dropzone) {
        dropzone.style.display = 'flex';
    }
    
    // Remove success state
    if (card) {
        card.classList.remove('file-selected');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ==================== HELPERS ====================

function getMonthName(month) {
    const months = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return months[month] || '';
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return `${days[d.getDay()]} ${d.getDate()}`;
}

function formatDateLong(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMoney(amount) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

// Modal pour saisir une remise banque
function showBankDepositModal() {
    const today = new Date().toISOString().split('T')[0];
    openModal('Saisir une Remise Banque', `
        <form onsubmit="saveBankDeposit(event)">
            <div class="form-group">
                <label><i class="fas fa-calendar"></i> Date de la remise *</label>
                <input type="date" name="deposit_date" value="${today}" required class="form-control">
            </div>
            <div class="form-group">
                <label><i class="fas fa-euro-sign"></i> Montant remis *</label>
                <div class="input-group">
                    <input type="number" name="amount" step="0.01" min="0.01" required class="form-control" placeholder="0.00">
                    <span class="input-group-text">€</span>
                </div>
            </div>
            <div class="form-group">
                <label><i class="fas fa-file-alt"></i> Référence / N° bordereau</label>
                <input type="text" name="reference" class="form-control" placeholder="Ex: BOR-2025-001">
            </div>
            <div class="form-group">
                <label><i class="fas fa-comment"></i> Notes</label>
                <textarea name="notes" rows="2" class="form-control" placeholder="Notes optionnelles..."></textarea>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-check"></i> Enregistrer</button>
            </div>
        </form>
    `);
}

async function saveBankDeposit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        hotel_id: closureSelectedHotel,
        deposit_date: form.deposit_date.value,
        amount: parseFloat(form.amount.value),
        reference: form.reference.value,
        notes: form.notes.value
    };
    
    try {
        await API.post('/closures/bank-deposits', data);
        toast('Remise banque enregistrée', 'success');
        closeModal();
        refreshCashTracking();
    } catch (error) {
        toast(error.message, 'error');
    }
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
