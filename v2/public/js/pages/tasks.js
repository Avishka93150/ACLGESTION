/**
 * Module Tâches - Kanban style Trello
 * Multi-hôtels, membres, pièces jointes, assignations multiples
 */

let taskHotels = [];
let taskAllUsers = [];
let currentBoard = null;
let currentBoardData = null;
let draggedTask = null;

async function loadTasks(container) {
    showLoading(container);
    try {
        const mgmtRes = await API.getManagementInfo();
        taskHotels = mgmtRes.manageable_hotels || [];

        const boardsRes = await API.getTaskBoards();
        const boards = boardsRes.boards || [];
        
        const canCreate = hasPermission('tasks.create');

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-tasks"></i> Tableaux de tâches</h3>
                    ${canCreate ? '<button class="btn btn-primary" onclick="showNewBoardModal()"><i class="fas fa-plus"></i> Nouveau tableau</button>' : ''}
                </div>
                <div class="boards-grid" id="boards-list">
                    ${boards.length ? boards.map(b => `
                        <div class="board-card" onclick="openBoard(${b.id})" style="border-top: 4px solid ${b.color}">
                            <div class="board-card-header">
                                <h4>${esc(b.name)}</h4>
                                <div class="board-hotels-tags">
                                    ${b.hotels ? b.hotels.split(',').map(h => `<span class="hotel-mini-tag">${esc(h.trim())}</span>`).join('') : ''}
                                </div>
                            </div>
                            <p class="board-desc">${esc(b.description || 'Aucune description')}</p>
                            <div class="board-meta">
                                <span><i class="fas fa-sticky-note"></i> ${b.task_count || 0}</span>
                                <span><i class="fas fa-users"></i> ${b.member_count || 1}</span>
                                <span><i class="fas fa-user"></i> ${esc(b.created_by_name)}</span>
                            </div>
                        </div>
                    `).join('') : '<div class="empty-state"><i class="fas fa-clipboard-list"></i><h3>Aucun tableau</h3><p>Créez votre premier tableau de tâches</p></div>'}
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function showNewBoardModal() {
    openModal('Nouveau tableau', `
        <form onsubmit="createBoard(event)" id="new-board-form">
            <div class="form-group">
                <label><i class="fas fa-heading"></i> Nom du tableau *</label>
                <input type="text" name="name" required placeholder="Ex: Tâches hebdomadaires">
            </div>
            <div class="form-group">
                <label><i class="fas fa-align-left"></i> Description</label>
                <textarea name="description" rows="2" placeholder="Description optionnelle..."></textarea>
            </div>
            <div class="form-group">
                <label><i class="fas fa-building"></i> Hôtel(s) associé(s) *</label>
                <div class="checkbox-list" id="board-hotels-list">
                    ${taskHotels.map(h => `
                        <label class="checkbox-item">
                            <input type="checkbox" name="hotel_ids" value="${h.id}">
                            <span>${esc(h.name)}</span>
                        </label>
                    `).join('')}
                </div>
                <small class="text-muted">Les managers des hôtels sélectionnés auront automatiquement accès</small>
            </div>
            <div class="form-group">
                <label><i class="fas fa-users"></i> Membres du tableau</label>
                <div class="members-selector" id="board-members-selector">
                    <p class="text-muted"><i class="fas fa-info-circle"></i> Sélectionnez d'abord un ou plusieurs hôtels</p>
                </div>
            </div>
            <div class="form-group">
                <label><i class="fas fa-palette"></i> Couleur</label>
                <div class="color-picker">
                    <label><input type="radio" name="color" value="#1E3A5F" checked><span style="background:#1E3A5F"></span></label>
                    <label><input type="radio" name="color" value="#10B981"><span style="background:#10B981"></span></label>
                    <label><input type="radio" name="color" value="#F59E0B"><span style="background:#F59E0B"></span></label>
                    <label><input type="radio" name="color" value="#EF4444"><span style="background:#EF4444"></span></label>
                    <label><input type="radio" name="color" value="#8B5CF6"><span style="background:#8B5CF6"></span></label>
                    <label><input type="radio" name="color" value="#EC4899"><span style="background:#EC4899"></span></label>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Créer</button>
            </div>
        </form>
    `);
    document.querySelectorAll('#board-hotels-list input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', loadMembersForSelectedHotels);
    });
}

async function loadMembersForSelectedHotels() {
    const selectedHotels = Array.from(document.querySelectorAll('#board-hotels-list input:checked')).map(cb => cb.value);
    const container = document.getElementById('board-members-selector');
    if (selectedHotels.length === 0) {
        container.innerHTML = '<p class="text-muted"><i class="fas fa-info-circle"></i> Sélectionnez d\'abord un ou plusieurs hôtels</p>';
        return;
    }
    container.innerHTML = '<div class="loading-inline"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';
    try {
        const res = await API.get(`/tasks/available-members?hotel_ids=${selectedHotels.join(',')}`);
        const users = res.users || [];
        taskAllUsers = users;
        if (users.length === 0) {
            container.innerHTML = '<p class="text-muted">Aucun collaborateur disponible</p>';
            return;
        }
        const byRole = {};
        users.forEach(u => { if (!byRole[u.role]) byRole[u.role] = []; byRole[u.role].push(u); });
        let html = '<div class="members-checkbox-list">';
        const roleOrder = ['admin', 'groupe_manager', 'hotel_manager', 'comptabilite', 'rh', 'receptionniste', 'employee'];
        roleOrder.forEach(role => {
            if (byRole[role] && byRole[role].length > 0) {
                html += `<div class="member-role-group"><label class="role-header">${LABELS.role[role] || role}</label>`;
                byRole[role].forEach(u => {
                    html += `<label class="checkbox-item member-item"><input type="checkbox" name="member_ids" value="${u.id}"><span class="member-info"><span class="member-name">${esc(u.first_name)} ${esc(u.last_name)}</span></span></label>`;
                });
                html += '</div>';
            }
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) { container.innerHTML = `<p class="text-danger">${e.message}</p>`; }
}

async function createBoard(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const hotelIds = Array.from(form.querySelectorAll('input[name="hotel_ids"]:checked')).map(cb => cb.value);
    if (hotelIds.length === 0) { toast('Veuillez sélectionner au moins un hôtel', 'warning'); return; }
    const memberIds = Array.from(form.querySelectorAll('input[name="member_ids"]:checked')).map(cb => cb.value);
    const data = { name: formData.get('name'), description: formData.get('description'), color: formData.get('color'), hotel_ids: hotelIds, member_ids: memberIds };
    try {
        const res = await API.post('/tasks/boards', data);
        toast('Tableau créé', 'success');
        closeModal();
        openBoard(res.id);
    } catch (error) { toast(error.message, 'error'); }
}

async function openBoard(boardId) {
    currentBoard = boardId;
    const container = document.getElementById('page-content');
    showLoading(container);
    try {
        const res = await API.getTaskBoard(boardId);
        currentBoardData = res;
        const board = res.board, columns = res.columns || [], tasks = res.tasks || [], members = res.members || [], hotels = res.hotels || [], canManage = res.can_manage;

        container.innerHTML = `
            <div class="kanban-header">
                <div class="kanban-title">
                    <button class="btn btn-outline btn-sm" onclick="loadTasks(document.getElementById('page-content'))"><i class="fas fa-arrow-left"></i></button>
                    <div>
                        <h2 style="color: ${board.color}">${esc(board.name)}</h2>
                        <div class="kanban-hotels">${hotels.map(h => `<span class="hotel-tag-sm">${esc(h.name)}</span>`).join('')}</div>
                    </div>
                </div>
                <div class="kanban-actions">
                    <div class="board-members-avatars">
                        ${members.slice(0, 5).map(m => `<span class="member-avatar" title="${esc(m.first_name)} ${esc(m.last_name)}">${m.first_name.charAt(0)}${m.last_name.charAt(0)}</span>`).join('')}
                        ${members.length > 5 ? `<span class="member-avatar more">+${members.length - 5}</span>` : ''}
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="showArchivedTasks()" title="Tâches archivées"><i class="fas fa-archive"></i></button>
                    ${canManage ? `<button class="btn btn-outline btn-sm" onclick="showAddColumnModal()"><i class="fas fa-plus"></i> Colonne</button>
                    <button class="btn btn-outline btn-sm" onclick="showBoardSettingsModal()"><i class="fas fa-cog"></i></button>` : ''}
                </div>
            </div>
            <div class="kanban-board" id="kanban-board">
                ${columns.map(col => `
                    <div class="kanban-column" data-column-id="${col.id}">
                        <div class="kanban-column-header" style="border-top: 3px solid ${col.color}">
                            <h4>${esc(col.name)}</h4>
                            <span class="task-count">${tasks.filter(t => t.column_id == col.id).length}</span>
                            <div class="column-actions">
                                ${hasPermission('tasks.create') ? `<button onclick="showAddTaskModal(${col.id})" title="Ajouter"><i class="fas fa-plus"></i></button>` : ''}
                                ${canManage ? `<button onclick="showEditColumnModal(${col.id}, '${esc(col.name)}', '${col.color}')" title="Modifier"><i class="fas fa-ellipsis-v"></i></button>` : ''}
                            </div>
                        </div>
                        <div class="kanban-tasks" data-column-id="${col.id}" ondrop="dropTask(event, ${col.id})" ondragover="allowDrop(event)" ondragenter="dragEnter(event)" ondragleave="dragLeave(event)">
                            ${tasks.filter(t => t.column_id == col.id).map(t => renderTaskCard(t)).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) { container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`; }
}

function renderTaskCard(task) {
    const priorityColors = { urgent: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#10B981' };
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.is_completed;
    const assignees = task.assignees || [];
    const attachmentCount = task.attachment_count || 0;
    const checklistTotal = task.checklist_total || 0;
    const checklistDone = task.checklist_done || 0;
    return `
        <div class="task-card ${task.is_completed ? 'task-completed' : ''} ${isOverdue ? 'task-overdue' : ''}" data-task-id="${task.id}" draggable="true" ondragstart="dragStart(event, ${task.id})" ondragend="dragEnd(event)" onclick="openTaskDetail(${task.id})">
            <div class="task-priority-bar" style="background: ${priorityColors[task.priority] || '#6B7280'}"></div>
            <div class="task-content">
                <div class="task-title-row">
                    <span class="task-title-text" data-task-id="${task.id}" data-title="${esc(task.title)}">${esc(task.title)}</span>
                    <button class="task-edit-btn" onclick="event.stopPropagation(); startEditTaskTitle(${task.id}, this.parentElement)" title="Modifier le titre"><i class="fas fa-pencil-alt"></i></button>
                </div>
                ${task.description ? `<div class="task-desc">${esc(task.description.substring(0, 60))}${task.description.length > 60 ? '...' : ''}</div>` : ''}
                <div class="task-meta">
                    ${task.due_date ? `<span class="${isOverdue ? 'text-danger' : ''}"><i class="fas fa-calendar"></i> ${formatDate(task.due_date)}</span>` : ''}
                    ${attachmentCount > 0 ? `<span><i class="fas fa-paperclip"></i> ${attachmentCount}</span>` : ''}
                    ${checklistTotal > 0 ? `<span class="${checklistDone === checklistTotal ? 'text-success' : ''}"><i class="fas fa-check-square"></i> ${checklistDone}/${checklistTotal}</span>` : ''}
                </div>
                ${assignees.length > 0 ? `<div class="task-assignees">${assignees.slice(0, 3).map(a => `<span class="assignee-avatar" title="${esc(a.first_name)} ${esc(a.last_name)}">${a.first_name.charAt(0)}</span>`).join('')}${assignees.length > 3 ? `<span class="assignee-avatar more">+${assignees.length - 3}</span>` : ''}</div>` : ''}
            </div>
            ${task.is_completed ? '<div class="task-completed-badge"><i class="fas fa-check"></i></div>' : ''}
        </div>
    `;
}

// Démarrer l'édition du titre
function startEditTaskTitle(taskId, rowElement) {
    // Éviter de rééditer si déjà en mode édition
    if (rowElement.querySelector('input')) return;
    
    const titleSpan = rowElement.querySelector('.task-title-text');
    const currentTitle = titleSpan.dataset.title || titleSpan.textContent.trim();
    
    rowElement.innerHTML = `
        <input type="text" class="task-title-input" value="${esc(currentTitle)}" 
            onclick="event.stopPropagation()" 
            onblur="saveTaskTitleInline(${taskId}, this, '${esc(currentTitle).replace(/'/g, "\\'")}')">
    `;
    
    const input = rowElement.querySelector('input');
    input.focus();
    input.select();
    
    input.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { 
            e.preventDefault();
            openBoard(currentBoard); // Recharger pour annuler
        }
    };
}

async function saveTaskTitleInline(taskId, input, originalTitle) {
    const newTitle = input.value.trim();
    if (!newTitle || newTitle === originalTitle) {
        openBoard(currentBoard); // Recharger pour restaurer
        return;
    }
    try {
        await API.updateTask(currentBoard, taskId, { title: newTitle });
        toast('Titre mis à jour', 'success');
        openBoard(currentBoard); // Recharger pour afficher
    } catch (e) {
        toast(e.message, 'error');
        openBoard(currentBoard);
    }
}

function dragStart(e, taskId) { draggedTask = taskId; e.target.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
function dragEnd(e) { e.target.classList.remove('dragging'); document.querySelectorAll('.kanban-tasks').forEach(el => el.classList.remove('drag-over')); }
function allowDrop(e) { e.preventDefault(); }
function dragEnter(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function dragLeave(e) { e.currentTarget.classList.remove('drag-over'); }

async function dropTask(e, columnId) {
    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
    if (!draggedTask) return;
    try {
        const tasksInColumn = document.querySelectorAll(`.kanban-tasks[data-column-id="${columnId}"] .task-card`);
        await API.moveTask(currentBoard, draggedTask, { column_id: columnId, position: tasksInColumn.length });
        openBoard(currentBoard);
    } catch (error) { toast(error.message, 'error'); }
    draggedTask = null;
}

function showAddTaskModal(columnId) {
    const members = currentBoardData.members || [];
    openModal('Nouvelle tâche', `
        <form onsubmit="createTask(event, ${columnId})" enctype="multipart/form-data" id="new-task-form">
            <div class="form-group"><label><i class="fas fa-heading"></i> Titre *</label><input type="text" name="title" required placeholder="Titre de la tâche"></div>
            <div class="form-group"><label><i class="fas fa-align-left"></i> Description</label><textarea name="description" rows="3" placeholder="Description détaillée..."></textarea></div>
            <div class="form-row">
                <div class="form-group"><label><i class="fas fa-flag"></i> Priorité</label>
                    <select name="priority"><option value="low">🟢 Basse</option><option value="medium" selected>🔵 Moyenne</option><option value="high">🟠 Haute</option><option value="urgent">🔴 Urgente</option></select>
                </div>
                <div class="form-group"><label><i class="fas fa-calendar"></i> Échéance</label><input type="date" name="due_date"></div>
            </div>
            <div class="form-group">
                <label><i class="fas fa-users"></i> Assigné à</label>
                <div class="assignees-selector">${members.map(m => `<label class="assignee-checkbox"><input type="checkbox" name="assignee_ids" value="${m.id}"><span class="assignee-chip"><span class="assignee-avatar-sm">${m.first_name.charAt(0)}</span>${esc(m.first_name)} ${esc(m.last_name)}</span></label>`).join('')}</div>
            </div>
            <div class="form-group">
                <label><i class="fas fa-paperclip"></i> Pièces jointes</label>
                <div class="attachments-upload-zone" id="task-attachments-zone">
                    <input type="file" name="attachments" multiple id="task-attachments-input" style="display:none" onchange="previewTaskAttachments(this)">
                    <div class="upload-prompt" onclick="document.getElementById('task-attachments-input').click()">
                        <i class="fas fa-cloud-upload-alt"></i><span>Cliquez ou glissez des fichiers</span><small>PDF, Images - Max 10 Mo</small>
                    </div>
                    <div class="attachments-preview" id="attachments-preview"></div>
                </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button><button type="submit" class="btn btn-primary"><i class="fas fa-plus"></i> Créer</button></div>
        </form>
    `);
}

function previewTaskAttachments(input) {
    const preview = document.getElementById('attachments-preview');
    preview.innerHTML = '';
    if (input.files && input.files.length > 0) {
        Array.from(input.files).forEach(file => {
            const icon = file.type.startsWith('image/') ? 'fa-image' : (file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file');
            preview.innerHTML += `<div class="attachment-item"><i class="fas ${icon}"></i><span class="attachment-name">${esc(file.name)}</span><span class="attachment-size">${(file.size / 1024).toFixed(1)} Ko</span></div>`;
        });
    }
}

async function createTask(e, columnId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    formData.append('column_id', columnId);
    const assigneeIds = Array.from(form.querySelectorAll('input[name="assignee_ids"]:checked')).map(cb => cb.value);
    formData.delete('assignee_ids');
    formData.append('assignee_ids', JSON.stringify(assigneeIds));
    try {
        await API.createTaskWithAttachments(currentBoard, formData);
        toast('Tâche créée', 'success');
        closeModal();
        openBoard(currentBoard);
    } catch (error) { toast(error.message, 'error'); }
}

async function openTaskDetail(taskId) {
    try {
        const res = await API.getTask(currentBoard, taskId);
        const task = res.task, comments = res.comments || [], checklist = res.checklist || [], attachments = res.attachments || [], assignees = res.assignees || [], members = currentBoardData.members || [];
        const priorityColors = { urgent: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#10B981' };
        const priorityLabels = { urgent: '🔴 Urgente', high: '🟠 Haute', medium: '🔵 Moyenne', low: '🟢 Basse' };
        const checklistDone = checklist.filter(c => c.is_checked).length, checklistTotal = checklist.length;
        
        openModal(`<span class="task-modal-title" style="color: ${priorityColors[task.priority]}; font-weight: 600; cursor: pointer;" onclick="editTaskTitleModal(${task.id}, this)" title="Cliquez pour modifier">${esc(task.title)} <i class="fas fa-pencil-alt" style="font-size: 14px; opacity: 0.5; margin-left: 8px;"></i></span>`, `
            <div class="task-detail">
                <div class="task-detail-main">
                    <div class="task-detail-section">
                        <label><i class="fas fa-align-left"></i> Description</label>
                        <div class="task-description-box" data-description="${esc(task.description || '')}" data-task-id="${task.id}" onclick="editTaskDescription(${task.id}, this)">
                            ${task.description ? esc(task.description) : '<span class="text-muted">Cliquez pour ajouter une description...</span>'}
                        </div>
                    </div>
                    
                    <div class="task-detail-section">
                        <label><i class="fas fa-paperclip"></i> Pièces jointes (${attachments.length})</label>
                        <div class="task-attachments-list" id="task-attachments-list">
                            ${attachments.length > 0 ? attachments.map(a => `
                                <div class="task-attachment">
                                    <i class="fas ${a.mime_type && a.mime_type.startsWith('image/') ? 'fa-image' : 'fa-file-pdf'}"></i>
                                    <a href="uploads/tasks/${a.filename}" target="_blank" class="attachment-link">${esc(a.original_name)}</a>
                                    <span class="attachment-size">${(a.file_size / 1024).toFixed(1)} Ko</span>
                                    <button onclick="deleteTaskAttachment(${a.id}, ${task.id})" class="btn-icon" title="Supprimer"><i class="fas fa-times"></i></button>
                                </div>
                            `).join('') : '<p class="text-muted" style="margin:0;">Aucune pièce jointe</p>'}
                        </div>
                        <div class="add-attachment-inline">
                            <input type="file" id="add-attachment-input" multiple style="display:none" onchange="addTaskAttachments(${task.id}, this)">
                            <button class="btn btn-sm btn-outline" onclick="document.getElementById('add-attachment-input').click()">
                                <i class="fas fa-plus"></i> Ajouter un fichier
                            </button>
                        </div>
                    </div>
                    
                    <div class="task-detail-section">
                        <label><i class="fas fa-tasks"></i> Checklist ${checklistTotal > 0 ? `<span style="color: #10B981; margin-left: auto;">${checklistDone}/${checklistTotal}</span>` : ''}</label>
                        ${checklistTotal > 0 ? `<div class="checklist-progress"><div class="checklist-progress-bar" style="width: ${(checklistDone/checklistTotal)*100}%"></div></div>` : ''}
                        <div class="checklist-items" id="checklist-items">
                            ${checklist.map(item => `
                                <div class="checklist-item" data-item-id="${item.id}">
                                    <input type="checkbox" ${item.is_checked ? 'checked' : ''} onchange="toggleChecklistItem(${item.id}, this.checked, ${task.id})">
                                    <span class="checklist-text ${item.is_checked ? 'checked' : ''}" ondblclick="editChecklistItem(${item.id}, ${task.id}, this)">${esc(item.item_text)}</span>
                                    <button onclick="deleteChecklistItem(${item.id}, ${task.id})" class="btn-icon" title="Supprimer"><i class="fas fa-times"></i></button>
                                </div>
                            `).join('')}
                        </div>
                        <form onsubmit="addChecklistItem(event, ${task.id})" class="checklist-add">
                            <input type="text" name="item" placeholder="Ajouter un élément...">
                            <button type="submit" class="btn btn-sm btn-primary"><i class="fas fa-plus"></i></button>
                        </form>
                    </div>
                    
                    <div class="task-detail-section">
                        <label><i class="fas fa-comments"></i> Commentaires (${comments.length})</label>
                        <div class="task-comments" id="task-comments">
                            ${comments.length > 0 ? comments.map(c => `
                                <div class="task-comment">
                                    <div class="comment-avatar">${c.user_name ? c.user_name.charAt(0).toUpperCase() : '?'}</div>
                                    <div class="comment-content">
                                        <div class="comment-header">
                                            <strong>${esc(c.user_name)}</strong>
                                            <span class="text-muted">${formatDateTime(c.created_at)}</span>
                                        </div>
                                        <p>${esc(c.comment)}</p>
                                    </div>
                                </div>
                            `).join('') : '<p class="text-muted" style="margin:0;">Aucun commentaire</p>'}
                        </div>
                        <form onsubmit="addTaskCommentFromDetail(event, ${task.id})" class="comment-form">
                            <textarea name="comment" rows="2" placeholder="Écrire un commentaire..."></textarea>
                            <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i></button>
                        </form>
                    </div>
                </div>
                
                <div class="task-detail-sidebar">
                    <div class="task-detail-field">
                        <label><i class="fas fa-users"></i> Assignés</label>
                        <div class="assignees-multi-select">
                            ${members.length > 0 ? members.map(m => { 
                                const isAssigned = assignees.some(a => a.id == m.id); 
                                return `
                                    <label class="assignee-checkbox-sm ${isAssigned ? 'checked' : ''}">
                                        <input type="checkbox" ${isAssigned ? 'checked' : ''} onchange="toggleTaskAssignee(${task.id}, ${m.id}, this.checked); this.parentElement.classList.toggle('checked')">
                                        <span class="assignee-avatar-sm">${m.first_name.charAt(0).toUpperCase()}</span>
                                        <span>${esc(m.first_name)} ${esc(m.last_name)}</span>
                                    </label>
                                `; 
                            }).join('') : '<p class="text-muted" style="margin:0;">Aucun membre</p>'}
                        </div>
                    </div>
                    
                    <div class="task-detail-field">
                        <label><i class="fas fa-flag"></i> Priorité</label>
                        <select onchange="updateTaskField(${task.id}, 'priority', this.value)">
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>🟢 Basse</option>
                            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>🔵 Moyenne</option>
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>🟠 Haute</option>
                            <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>🔴 Urgente</option>
                        </select>
                    </div>
                    
                    <div class="task-detail-field">
                        <label><i class="fas fa-calendar-alt"></i> Échéance</label>
                        <input type="date" value="${task.due_date || ''}" onchange="updateTaskField(${task.id}, 'due_date', this.value)">
                    </div>
                    
                    <div class="task-detail-field">
                        <label><i class="fas fa-check-circle"></i> Statut</label>
                        <button class="btn ${task.is_completed ? 'btn-success' : 'btn-outline'} btn-block" onclick="toggleTaskComplete(${task.id}, ${task.is_completed ? 0 : 1})">
                            <i class="fas fa-${task.is_completed ? 'check-circle' : 'circle'}"></i>
                            ${task.is_completed ? 'Terminée ✓' : 'Marquer terminée'}
                        </button>
                    </div>
                    
                    <hr>
                    
                    <div class="task-detail-info">
                        <small>
                            <i class="fas fa-user"></i> Créée par <strong>${esc(task.created_by_name)}</strong><br>
                            <i class="fas fa-clock"></i> ${formatDateTime(task.created_at)}
                        </small>
                    </div>
                    
                    <button class="btn btn-outline btn-block btn-sm" onclick="archiveTask(${task.id})">
                        <i class="fas fa-archive"></i> Archiver
                    </button>
                    
                    <button class="btn btn-danger btn-block btn-sm" onclick="deleteTaskConfirm(${task.id})">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </div>
            </div>
        `, 'modal-wide');
    } catch (error) { toast(error.message, 'error'); }
}

async function toggleTaskAssignee(taskId, userId, isAssigned) {
    try {
        if (isAssigned) await API.post(`/tasks/${currentBoard}/tasks/${taskId}/assignees`, { user_id: userId });
        else await API.delete(`/tasks/${currentBoard}/tasks/${taskId}/assignees/${userId}`);
        toast(isAssigned ? 'Assigné ajouté' : 'Assigné retiré', 'success');
    } catch (e) { toast(e.message, 'error'); }
}

async function addTaskAttachments(taskId, input) {
    if (!input.files || input.files.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < input.files.length; i++) formData.append('attachments[]', input.files[i]);
    try {
        await API.uploadTaskAttachments(currentBoard, taskId, formData);
        toast('Pièces jointes ajoutées', 'success');
        openTaskDetail(taskId);
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteTaskAttachment(attachmentId, taskId) {
    if (!confirm('Supprimer cette pièce jointe ?')) return;
    try {
        await API.delete(`/tasks/${currentBoard}/attachments/${attachmentId}`);
        toast('Pièce jointe supprimée', 'success');
        openTaskDetail(taskId);
    } catch (e) { toast(e.message, 'error'); }
}

function showAddColumnModal() {
    openModal('Nouvelle colonne', `<form onsubmit="createColumn(event)"><div class="form-group"><label>Nom *</label><input type="text" name="name" required placeholder="Ex: En attente"></div><div class="form-group"><label>Couleur</label><input type="color" name="color" value="#6B7280"></div><div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button><button type="submit" class="btn btn-primary">Créer</button></div></form>`);
}

async function createColumn(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try { await API.createColumn(currentBoard, data); toast('Colonne créée', 'success'); closeModal(); openBoard(currentBoard); } catch (error) { toast(error.message, 'error'); }
}

function showEditColumnModal(colId, name, color) {
    openModal('Modifier la colonne', `<form onsubmit="updateColumn(event, ${colId})"><div class="form-group"><label>Nom</label><input type="text" name="name" value="${esc(name)}" required></div><div class="form-group"><label>Couleur</label><input type="color" name="color" value="${color}"></div><div class="modal-footer"><button type="button" class="btn btn-danger" onclick="deleteColumn(${colId})"><i class="fas fa-trash"></i></button><button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer</button></div></form>`);
}

async function updateColumn(e, colId) { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); try { await API.updateColumn(currentBoard, colId, data); toast('Colonne mise à jour', 'success'); closeModal(); openBoard(currentBoard); } catch (error) { toast(error.message, 'error'); } }
async function deleteColumn(colId) { if (!confirm('Supprimer cette colonne et toutes ses tâches ?')) return; try { await API.deleteColumn(currentBoard, colId); toast('Colonne supprimée', 'success'); closeModal(); openBoard(currentBoard); } catch (error) { toast(error.message, 'error'); } }

function showBoardSettingsModal() {
    const board = currentBoardData.board, hotels = currentBoardData.hotels || [], members = currentBoardData.members || [];
    openModal('Paramètres du tableau', `
        <div class="tabs"><button class="tab active" onclick="switchBoardTab('general', this)">Général</button><button class="tab" onclick="switchBoardTab('members', this)">Membres</button></div>
        <div id="board-tab-general" class="tab-content active">
            <form onsubmit="updateBoardSettings(event)">
                <div class="form-group"><label>Nom</label><input type="text" name="name" value="${esc(board.name)}" required></div>
                <div class="form-group"><label>Description</label><textarea name="description" rows="2">${esc(board.description || '')}</textarea></div>
                <div class="form-group"><label>Couleur</label><input type="color" name="color" value="${board.color}"></div>
                <div class="form-group"><label>Hôtels associés</label><div class="text-muted">${hotels.map(h => h.name).join(', ')}</div></div>
                <div class="modal-footer"><button type="button" class="btn btn-danger" onclick="archiveBoard()"><i class="fas fa-archive"></i> Archiver</button><button type="submit" class="btn btn-primary">Enregistrer</button></div>
            </form>
        </div>
        <div id="board-tab-members" class="tab-content" style="display:none">
            <div class="members-management">
                <h4>Membres actuels (${members.length})</h4>
                <div class="current-members-list">${members.map(m => `<div class="member-row"><span class="member-avatar">${m.first_name.charAt(0)}${m.last_name.charAt(0)}</span><div class="member-info"><span class="member-name">${esc(m.first_name)} ${esc(m.last_name)}</span><span class="member-role">${LABELS.role[m.role] || m.role}</span></div>${m.is_owner ? '<span class="badge badge-primary">Propriétaire</span>' : `<button class="btn-icon" onclick="removeBoardMember(${m.id})"><i class="fas fa-times"></i></button>`}</div>`).join('')}</div>
                <hr><button class="btn btn-outline btn-block" onclick="showAddMemberModal()"><i class="fas fa-user-plus"></i> Ajouter des membres</button>
            </div>
        </div>
    `);
}

function switchBoardTab(tabName, btn) { document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none'); document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); document.getElementById(`board-tab-${tabName}`).style.display = 'block'; btn.classList.add('active'); }

async function updateBoardSettings(e) { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); try { await API.updateTaskBoard(currentBoard, data); toast('Tableau mis à jour', 'success'); closeModal(); openBoard(currentBoard); } catch (error) { toast(error.message, 'error'); } }
async function archiveBoard() { if (!confirm('Archiver ce tableau ?')) return; try { await API.updateTaskBoard(currentBoard, { is_archived: 1 }); toast('Tableau archivé', 'success'); closeModal(); loadTasks(document.getElementById('page-content')); } catch (error) { toast(error.message, 'error'); } }

async function removeBoardMember(userId) {
    if (!confirm('Retirer ce membre ?')) return;
    try { await API.delete(`/tasks/${currentBoard}/members/${userId}`); toast('Membre retiré', 'success'); const res = await API.getTaskBoard(currentBoard); currentBoardData = res; showBoardSettingsModal(); } catch (e) { toast(e.message, 'error'); }
}

async function showAddMemberModal() {
    const hotels = currentBoardData.hotels || [], hotelIds = hotels.map(h => h.id).join(',');
    try {
        const res = await API.get(`/tasks/available-members?hotel_ids=${hotelIds}`);
        const users = res.users || [], currentMembers = currentBoardData.members || [], currentMemberIds = currentMembers.map(m => m.id), available = users.filter(u => !currentMemberIds.includes(u.id));
        openModal('Ajouter des membres', `<form onsubmit="addBoardMembers(event)"><div class="members-checkbox-list">${available.length > 0 ? available.map(u => `<label class="checkbox-item member-item"><input type="checkbox" name="user_ids" value="${u.id}"><span class="member-info"><span class="member-name">${esc(u.first_name)} ${esc(u.last_name)}</span><span class="member-role">${LABELS.role[u.role] || u.role}</span></span></label>`).join('') : '<p class="text-muted">Tous les collaborateurs sont déjà membres</p>'}</div><div class="modal-footer"><button type="button" class="btn btn-outline" onclick="showBoardSettingsModal()">Retour</button>${available.length > 0 ? '<button type="submit" class="btn btn-primary">Ajouter</button>' : ''}</div></form>`);
    } catch (e) { toast(e.message, 'error'); }
}

async function addBoardMembers(e) {
    e.preventDefault();
    const userIds = Array.from(e.target.querySelectorAll('input[name="user_ids"]:checked')).map(cb => cb.value);
    if (userIds.length === 0) { toast('Sélectionnez au moins un membre', 'warning'); return; }
    try { await API.post(`/tasks/${currentBoard}/members`, { user_ids: userIds }); toast('Membres ajoutés', 'success'); const res = await API.getTaskBoard(currentBoard); currentBoardData = res; showBoardSettingsModal(); } catch (e) { toast(e.message, 'error'); }
}

async function updateTaskField(taskId, field, value) { try { await API.updateTask(currentBoard, taskId, { [field]: value }); toast('Mis à jour', 'success'); } catch (error) { toast(error.message, 'error'); } }
async function toggleTaskComplete(taskId, completed) {
    try {
        // Si on marque comme terminée, trouver la colonne "Terminé"
        if (completed) {
            const columns = currentBoardData.columns || [];
            const termineeColumn = columns.find(c => 
                c.name.toLowerCase().includes('terminé') || 
                c.name.toLowerCase().includes('termine') ||
                c.name.toLowerCase().includes('done') ||
                c.name.toLowerCase().includes('completed')
            );
            if (termineeColumn) {
                await API.updateTask(currentBoard, taskId, { is_completed: 1, column_id: termineeColumn.id });
            } else {
                await API.updateTask(currentBoard, taskId, { is_completed: 1 });
            }
        } else {
            await API.updateTask(currentBoard, taskId, { is_completed: 0 });
        }
        toast(completed ? 'Tâche terminée' : 'Tâche rouverte', 'success');
        closeModal();
        openBoard(currentBoard);
    } catch (error) {
        toast(error.message, 'error');
    }
}
async function deleteTaskConfirm(taskId) { if (!confirm('Supprimer cette tâche ?')) return; try { await API.deleteTask(currentBoard, taskId); toast('Supprimée', 'success'); closeModal(); openBoard(currentBoard); } catch (error) { toast(error.message, 'error'); } }

async function addChecklistItem(e, taskId) { e.preventDefault(); const input = e.target.querySelector('input[name="item"]'); const text = input.value.trim(); if (!text) return; try { await API.addChecklistItem(currentBoard, taskId, { item_text: text }); input.value = ''; openTaskDetail(taskId); } catch (error) { toast(error.message, 'error'); } }
async function toggleChecklistItem(itemId, checked, taskId) { try { await API.updateChecklistItem(currentBoard, itemId, { is_checked: checked ? 1 : 0 }); openTaskDetail(taskId); } catch (error) { toast(error.message, 'error'); } }
async function deleteChecklistItem(itemId, taskId) { try { await API.deleteChecklistItem(currentBoard, itemId); openTaskDetail(taskId); } catch (error) { toast(error.message, 'error'); } }

// Éditer un élément de checklist (double-clic)
function editChecklistItem(itemId, taskId, element) {
    // Éviter de rééditer si déjà en mode édition
    if (element.querySelector('input')) return;
    
    const currentText = element.textContent.trim();
    const isChecked = element.classList.contains('checked');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'checklist-edit-input';
    
    input.onblur = () => saveChecklistItem(itemId, taskId, input, element, currentText, isChecked);
    input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { 
            e.preventDefault();
            element.textContent = currentText;
            element.className = `checklist-text ${isChecked ? 'checked' : ''}`;
        }
    };
    
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    input.select();
}

async function saveChecklistItem(itemId, taskId, input, element, originalText, isChecked) {
    const newText = input.value.trim();
    if (!newText) {
        element.textContent = originalText;
        element.className = `checklist-text ${isChecked ? 'checked' : ''}`;
        return;
    }
    if (newText === originalText) {
        element.textContent = originalText;
        element.className = `checklist-text ${isChecked ? 'checked' : ''}`;
        return;
    }
    try {
        await API.updateChecklistItem(currentBoard, itemId, { item_text: newText });
        element.textContent = newText;
        element.className = `checklist-text ${isChecked ? 'checked' : ''}`;
        toast('Élément mis à jour', 'success');
    } catch (e) {
        element.textContent = originalText;
        element.className = `checklist-text ${isChecked ? 'checked' : ''}`;
        toast(e.message, 'error');
    }
}

async function addTaskCommentFromDetail(e, taskId) { e.preventDefault(); const textarea = e.target.querySelector('textarea'); const comment = textarea.value.trim(); if (!comment) return; try { await API.addTaskComment(currentBoard, taskId, { comment }); textarea.value = ''; openTaskDetail(taskId); } catch (error) { toast(error.message, 'error'); } }

// Éditer le titre depuis le header de la modal
function editTaskTitleModal(taskId, element) {
    const currentTitle = element.innerText.trim().replace(/\s*✏️?\s*$/, ''); // Retirer l'icône
    const container = element.parentElement;
    
    container.innerHTML = `
        <input type="text" class="modal-title-input" value="${esc(currentTitle)}" 
            onkeydown="if(event.key==='Enter'){event.preventDefault();saveTaskTitleModal(${taskId}, this);} if(event.key==='Escape'){openTaskDetail(${taskId});}"
            onblur="saveTaskTitleModal(${taskId}, this)">
    `;
    const input = container.querySelector('input');
    input.focus();
    input.select();
}

async function saveTaskTitleModal(taskId, input) {
    const newTitle = input.value.trim();
    if (!newTitle) {
        openTaskDetail(taskId);
        return;
    }
    try {
        await API.updateTask(currentBoard, taskId, { title: newTitle });
        toast('Titre mis à jour', 'success');
        openTaskDetail(taskId);
    } catch (e) {
        toast(e.message, 'error');
        openTaskDetail(taskId);
    }
}

function editTaskDescription(taskId, element) {
    // Éviter de rééditer si déjà en mode édition
    if (element.querySelector('textarea')) return;
    
    // Récupérer la description actuelle depuis l'attribut data
    const currentDesc = element.dataset.description || '';
    
    // Remplacer complètement le contenu de la box
    element.className = 'task-description-box editing';
    element.innerHTML = `
        <textarea class="desc-textarea" id="edit-desc-textarea">${currentDesc}</textarea>
        <div class="desc-edit-actions">
            <button class="btn btn-sm btn-primary" onclick="saveTaskDescription(${taskId})">Enregistrer</button>
            <button class="btn btn-sm btn-outline" onclick="openTaskDetail(${taskId})">Annuler</button>
        </div>
    `;
    const textarea = element.querySelector('textarea');
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
}

async function saveTaskDescription(taskId) { const desc = document.getElementById('edit-desc-textarea').value; try { await API.updateTask(currentBoard, taskId, { description: desc }); toast('Description mise à jour', 'success'); openTaskDetail(taskId); } catch (error) { toast(error.message, 'error'); } }

// Archiver une tâche
async function archiveTask(taskId) {
    if (!confirm('Archiver cette tâche ?')) return;
    try {
        await API.updateTask(currentBoard, taskId, { is_archived: 1 });
        toast('Tâche archivée', 'success');
        closeModal();
        openBoard(currentBoard);
    } catch (error) {
        toast(error.message, 'error');
    }
}

// Restaurer une tâche archivée
async function restoreTask(taskId) {
    try {
        await API.updateTask(currentBoard, taskId, { is_archived: 0 });
        toast('Tâche restaurée', 'success');
        showArchivedTasks();
    } catch (error) {
        toast(error.message, 'error');
    }
}

// Afficher les tâches archivées
async function showArchivedTasks() {
    try {
        const res = await API.get(`/tasks/${currentBoard}/archived`);
        const archivedTasks = res.tasks || [];
        
        let html = `
            <div class="archived-tasks-list">
                ${archivedTasks.length > 0 ? archivedTasks.map(task => `
                    <div class="archived-task-item" onclick="openArchivedTaskDetail(${task.id})">
                        <div class="archived-task-info">
                            <span class="archived-task-title">${esc(task.title)}</span>
                            <span class="archived-task-meta">Archivée le ${formatDateTime(task.archived_at || task.updated_at)}</span>
                        </div>
                        <div class="archived-task-actions">
                            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); restoreTask(${task.id})">
                                <i class="fas fa-undo"></i> Restaurer
                            </button>
                        </div>
                    </div>
                `).join('') : '<p class="text-muted text-center">Aucune tâche archivée</p>'}
            </div>
        `;
        
        openModal(`<i class="fas fa-archive"></i> Tâches archivées (${archivedTasks.length})`, html);
    } catch (error) {
        toast(error.message, 'error');
    }
}

// Ouvrir le détail d'une tâche archivée
async function openArchivedTaskDetail(taskId) {
    try {
        const res = await API.getTask(currentBoard, taskId);
        const task = res.task, comments = res.comments || [], checklist = res.checklist || [], attachments = res.attachments || [];
        const priorityColors = { urgent: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#10B981' };
        const checklistDone = checklist.filter(c => c.is_checked).length, checklistTotal = checklist.length;
        
        openModal(`<span class="text-muted"><i class="fas fa-archive"></i></span> ${esc(task.title)}`, `
            <div class="task-detail">
                <div class="task-detail-main">
                    <div class="archived-banner">
                        <i class="fas fa-archive"></i> Cette tâche est archivée
                        <button class="btn btn-sm btn-primary" onclick="restoreTask(${task.id}); closeModal();">
                            <i class="fas fa-undo"></i> Restaurer
                        </button>
                    </div>
                    
                    <div class="task-detail-section">
                        <label><i class="fas fa-align-left"></i> Description</label>
                        <div class="task-description-box readonly">
                            ${task.description ? esc(task.description) : '<span class="text-muted">Aucune description</span>'}
                        </div>
                    </div>
                    
                    ${checklistTotal > 0 ? `
                    <div class="task-detail-section">
                        <label><i class="fas fa-tasks"></i> Checklist <span style="color: #10B981; margin-left: auto;">${checklistDone}/${checklistTotal}</span></label>
                        <div class="checklist-items">
                            ${checklist.map(item => `
                                <div class="checklist-item">
                                    <input type="checkbox" ${item.is_checked ? 'checked' : ''} disabled>
                                    <span class="${item.is_checked ? 'checked' : ''}">${esc(item.item_text)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${attachments.length > 0 ? `
                    <div class="task-detail-section">
                        <label><i class="fas fa-paperclip"></i> Pièces jointes (${attachments.length})</label>
                        <div class="task-attachments-list">
                            ${attachments.map(a => `
                                <div class="task-attachment">
                                    <i class="fas ${a.mime_type && a.mime_type.startsWith('image/') ? 'fa-image' : 'fa-file-pdf'}"></i>
                                    <a href="uploads/tasks/${a.filename}" target="_blank" class="attachment-link">${esc(a.original_name)}</a>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="task-detail-sidebar">
                    <div class="task-detail-field">
                        <label><i class="fas fa-flag"></i> Priorité</label>
                        <span class="badge" style="background: ${priorityColors[task.priority]}">${task.priority}</span>
                    </div>
                    ${task.due_date ? `
                    <div class="task-detail-field">
                        <label><i class="fas fa-calendar-alt"></i> Échéance</label>
                        <span>${formatDate(task.due_date)}</span>
                    </div>
                    ` : ''}
                    <div class="task-detail-info">
                        <small>
                            <i class="fas fa-user"></i> Créée par <strong>${esc(task.created_by_name)}</strong><br>
                            <i class="fas fa-clock"></i> ${formatDateTime(task.created_at)}
                        </small>
                    </div>
                </div>
            </div>
        `, 'modal-wide');
    } catch (error) {
        toast(error.message, 'error');
    }
}

function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
function formatDateTime(d) { if (!d) return ''; return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
