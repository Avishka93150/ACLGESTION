/**
 * Module Maintenance - Tickets avec photos et historique
 */

let mtHotels = [];
let mtCurrentHotel = null; // null = tous les hôtels
let mtBlockedRoomsData = null; // Cache pour les données chambres bloquées

async function loadMaintenance(container) {
    showLoading(container);

    try {
        const mgmtRes = await API.getManagementInfo();
        mtHotels = mgmtRes.manageable_hotels || [];

        if (mtHotels.length === 0) {
            container.innerHTML = `<div class="card"><div class="empty-state"><i class="fas fa-building"></i><h3>Aucun hôtel assigné</h3></div></div>`;
            return;
        }

        // Par défaut, afficher tous les hôtels
        const ticketParams = mtCurrentHotel ? { hotel_id: mtCurrentHotel } : {};

        const [statsRes, ticketsRes, blockedRes] = await Promise.all([
            API.getMaintenanceStats(),
            API.getTickets(ticketParams),
            API.get('/maintenance/blocked-rooms/stats')
        ]);

        const stats = statsRes.stats || {};
        const tickets = ticketsRes.tickets || [];
        const blockedStats = blockedRes.stats || {};
        
        // Calculer le pourcentage de disponibilité
        const availabilityPct = blockedStats.total_room_days > 0 
            ? Math.round((1 - blockedStats.blocked_room_days / blockedStats.total_room_days) * 100) 
            : 100;
        const blockedPct = 100 - availabilityPct;

        container.innerHTML = `
            <!-- KPI Principaux -->
            <div class="kpi-grid">
                <div class="kpi-card"><div class="kpi-icon orange"><i class="fas fa-exclamation-circle"></i></div><div><div class="kpi-value">${stats.open || 0}</div><div class="kpi-label">Ouverts</div></div></div>
                <div class="kpi-card"><div class="kpi-icon blue"><i class="fas fa-wrench"></i></div><div><div class="kpi-value">${stats.in_progress || 0}</div><div class="kpi-label">En cours</div></div></div>
                <div class="kpi-card"><div class="kpi-icon green"><i class="fas fa-check-circle"></i></div><div><div class="kpi-value">${stats.resolved || 0}</div><div class="kpi-label">Résolus</div></div></div>
                <div class="kpi-card"><div class="kpi-icon red"><i class="fas fa-fire"></i></div><div><div class="kpi-value">${stats.critical || 0}</div><div class="kpi-label">Critiques</div></div></div>
            </div>
            
            <!-- KPI Chambres bloquées du mois -->
            <div class="card blocked-rooms-summary">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-ban"></i> Chambres bloquées - ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3>
                </div>
                <div class="blocked-stats-grid">
                    <div class="blocked-stat-card">
                        <div class="blocked-stat-icon red"><i class="fas fa-door-closed"></i></div>
                        <div class="blocked-stat-info">
                            <span class="blocked-stat-value">${blockedStats.currently_blocked || 0}</span>
                            <span class="blocked-stat-label">Actuellement bloquées</span>
                        </div>
                    </div>
                    <div class="blocked-stat-card">
                        <div class="blocked-stat-icon orange"><i class="fas fa-calendar-times"></i></div>
                        <div class="blocked-stat-info">
                            <span class="blocked-stat-value">${blockedStats.blocked_room_days || 0}</span>
                            <span class="blocked-stat-label">Jours-chambre perdus</span>
                        </div>
                    </div>
                    <div class="blocked-stat-card">
                        <div class="blocked-stat-icon blue"><i class="fas fa-percentage"></i></div>
                        <div class="blocked-stat-info">
                            <span class="blocked-stat-value">${blockedPct.toFixed(1)}%</span>
                            <span class="blocked-stat-label">Taux d'indisponibilité</span>
                        </div>
                    </div>
                    <div class="blocked-stat-card">
                        <div class="blocked-stat-icon green"><i class="fas fa-chart-line"></i></div>
                        <div class="blocked-stat-info">
                            <span class="blocked-stat-value">${availabilityPct}%</span>
                            <span class="blocked-stat-label">Disponibilité</span>
                        </div>
                    </div>
                </div>
                <div class="availability-bar">
                    <div class="availability-fill" style="width: ${availabilityPct}%"></div>
                    <div class="availability-blocked" style="width: ${blockedPct}%"></div>
                </div>
                <div class="availability-legend">
                    <span><i class="fas fa-circle text-success"></i> Disponible: ${blockedStats.total_room_days - blockedStats.blocked_room_days || 0} jours-chambre</span>
                    <span><i class="fas fa-circle text-danger"></i> Bloqué: ${blockedStats.blocked_room_days || 0} jours-chambre</span>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-tools"></i> Tickets de maintenance</h3>
                    <div class="header-controls">
                        <select id="mt-hotel" onchange="mtChangeHotel(this.value)">
                            <option value="" ${!mtCurrentHotel ? 'selected' : ''}>🏨 Tous les hôtels</option>
                            ${mtHotels.map(h => `<option value="${h.id}" ${h.id == mtCurrentHotel ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
                        </select>
                        ${hasPermission('maintenance.create') ? '<button class="btn btn-primary" onclick="mtNewTicketModal()"><i class="fas fa-plus"></i> Nouveau ticket</button>' : ''}
                    </div>
                </div>

                <div class="form-row mb-20">
                    <select id="mt-filter-status" onchange="mtReloadTickets()">
                        <option value="">Tous les statuts</option>
                        <option value="open">Ouverts</option>
                        <option value="in_progress">En cours</option>
                        <option value="resolved">Résolus</option>
                    </select>
                    <select id="mt-filter-priority" onchange="mtReloadTickets()">
                        <option value="">Toutes priorités</option>
                        <option value="critical">Critique</option>
                        <option value="high">Haute</option>
                        <option value="medium">Moyenne</option>
                        <option value="low">Basse</option>
                    </select>
                </div>

                <div id="mt-tickets-list">${mtRenderTickets(tickets)}</div>
            </div>
            
            <!-- Section Analyse des chambres bloquées -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-chart-bar"></i> Analyse des chambres bloquées</h3>
                    <button class="btn btn-outline" onclick="mtExportBlockedRoomsPDF()">
                        <i class="fas fa-file-pdf"></i> Exporter PDF
                    </button>
                </div>
                <div class="blocked-rooms-filters">
                    <div class="filter-row">
                        <div class="filter-group">
                            <label><i class="fas fa-building"></i> Hôtel</label>
                            <select id="blocked-hotel" onchange="mtLoadBlockedRooms()">
                                <option value="">Tous les hôtels</option>
                                ${mtHotels.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label><i class="fas fa-calendar"></i> Du</label>
                            <input type="date" id="blocked-start" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]}" onchange="mtLoadBlockedRooms()">
                        </div>
                        <div class="filter-group">
                            <label><i class="fas fa-calendar-check"></i> Au</label>
                            <input type="date" id="blocked-end" value="${new Date().toISOString().split('T')[0]}" onchange="mtLoadBlockedRooms()">
                        </div>
                        <div class="filter-group">
                            <label><i class="fas fa-filter"></i> Statut</label>
                            <select id="blocked-status" onchange="mtLoadBlockedRooms()">
                                <option value="">Tous</option>
                                <option value="blocked">Encore bloquées</option>
                                <option value="resolved">Résolues</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div id="blocked-rooms-kpis" class="blocked-analysis-kpis"></div>
                <div id="blocked-rooms-list" class="blocked-rooms-table-container">
                    <div class="loading-inline"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>
                </div>
            </div>
        `;
        
        // Charger les données d'analyse
        mtLoadBlockedRooms();
        
    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function mtRenderTickets(tickets) {
    if (!tickets.length) return '<div class="empty-state"><i class="fas fa-tools"></i><h3>Aucun ticket</h3></div>';

    // Afficher la colonne Hôtel si "Tous les hôtels" est sélectionné
    const showHotelColumn = !mtCurrentHotel;
    
    // Vérifier les permissions
    const canManage = hasPermission('maintenance.manage');
    const canDelete = hasPermission('maintenance.manage') && ['admin', 'groupe_manager'].includes(API.user?.role);

    return `
        <table>
            <thead><tr><th>ID</th>${showHotelColumn ? '<th>Hôtel</th>' : ''}<th>Chambre</th><th>Catégorie</th><th>Description</th><th>Priorité</th><th>Statut</th><th>Créé</th><th>Actions</th></tr></thead>
            <tbody>
                ${tickets.map(t => {
                    // Ticket en retard = en cours depuis plus de 7 jours
                    const isOverdue = t.is_overdue || (t.status === 'in_progress' && t.days_in_progress >= 7);
                    const rowClass = isOverdue ? 'row-overdue' : (t.priority === 'critical' ? 'row-critical' : '');
                    
                    return `
                    <tr class="${rowClass}">
                        <td>#${t.id}</td>
                        ${showHotelColumn ? `<td><span class="hotel-tag">${esc(t.hotel_name || '-')}</span></td>` : ''}
                        <td>${t.room_number || '-'}</td>
                        <td>${LABELS.maintenance_cat[t.category] || t.category}</td>
                        <td class="text-truncate" style="max-width:200px">${esc(t.description)}</td>
                        <td><span class="badge badge-${t.priority === 'critical' ? 'danger' : t.priority === 'high' ? 'warning' : 'primary'}">${LABELS.priority[t.priority] || t.priority}</span></td>
                        <td>
                            ${statusBadge(t.status)}
                            ${isOverdue ? '<span class="badge badge-overdue" title="En cours depuis plus de 7 jours">⚠️ Retard</span>' : ''}
                            ${t.status === 'in_progress' && t.days_in_progress ? `<small class="days-info">${t.days_in_progress}j</small>` : ''}
                        </td>
                        <td>${formatDateShort(t.created_at)}</td>
                        <td>
                            <div class="table-actions">
                                <button onclick="mtViewTicket(${t.id})" title="Voir détails"><i class="fas fa-eye"></i></button>
                                ${canManage && t.status === 'open' ? `<button onclick="mtAssignTicket(${t.id})" title="Prendre en charge"><i class="fas fa-hand-paper"></i></button>` : ''}
                                ${canManage && t.status === 'in_progress' ? `<button onclick="mtResolveModal(${t.id})" title="Résoudre"><i class="fas fa-check"></i></button>` : ''}
                                ${canDelete ? `<button onclick="mtDeleteTicket(${t.id})" title="Supprimer" class="btn-delete"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function mtChangeHotel(id) {
    mtCurrentHotel = id || null; // null si vide (tous les hôtels)
    mtReloadTickets();
}

async function mtReloadTickets() {
    const params = {};
    if (mtCurrentHotel) params.hotel_id = mtCurrentHotel;
    
    const status = document.getElementById('mt-filter-status')?.value;
    const priority = document.getElementById('mt-filter-priority')?.value;
    if (status) params.status = status;
    if (priority) params.priority = priority;

    try {
        const res = await API.getTickets(params);
        document.getElementById('mt-tickets-list').innerHTML = mtRenderTickets(res.tickets || []);
    } catch (e) { toast(e.message, 'error'); }
}

function mtNewTicketModal() {
    const defaultHotel = mtCurrentHotel || (mtHotels.length > 0 ? mtHotels[0].id : null);
    
    openModal('Nouveau ticket', `
        <form onsubmit="mtCreateTicket(event)" enctype="multipart/form-data" id="new-ticket-form">
            <div class="form-row">
                <div class="form-group">
                    <label><i class="fas fa-building"></i> Hôtel *</label>
                    <select name="hotel_id" required onchange="mtLoadHotelRooms(this.value)">
                        ${mtHotels.map(h => `<option value="${h.id}" ${h.id == defaultHotel ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-door-open"></i> Localisation *</label>
                    <select name="room_number" id="mt-room-select" required onchange="mtToggleRoomBlocked(this.value)">
                        <option value="">Chargement...</option>
                    </select>
                </div>
            </div>
            
            <!-- Case à cocher chambre bloquée (visible uniquement si chambre sélectionnée) -->
            <div class="form-group" id="mt-room-blocked-group" style="display: none;">
                <div class="room-blocked-checkbox">
                    <label class="checkbox-container">
                        <input type="checkbox" name="room_blocked" id="mt-room-blocked" value="1">
                        <span class="checkmark"></span>
                        <span class="checkbox-label">
                            <i class="fas fa-ban"></i> Chambre bloquée / Hors service
                        </span>
                    </label>
                    <small class="text-muted">Cochez si la chambre ne peut pas être louée à cause de ce problème</small>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label><i class="fas fa-tag"></i> Catégorie *</label>
                    <select name="category" required>
                        ${Object.entries(LABELS.maintenance_cat).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-exclamation-triangle"></i> Priorité *</label>
                    <select name="priority" required>
                        <option value="low">🟢 Basse</option>
                        <option value="medium" selected>🟡 Moyenne</option>
                        <option value="high">🟠 Haute</option>
                        <option value="critical">🔴 Critique</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label><i class="fas fa-align-left"></i> Description *</label>
                <textarea name="description" rows="3" required placeholder="Décrivez le problème en détail..."></textarea>
            </div>
            <div class="form-group">
                <label><i class="fas fa-camera"></i> Photo (preuve du problème)</label>
                <div class="photo-upload-zone" onclick="document.getElementById('mt-photo-input').click()">
                    <div class="photo-upload-content" id="mt-photo-content">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <span>Cliquez pour ajouter une photo</span>
                        <small>JPG, PNG - Max 5 Mo</small>
                    </div>
                    <div class="photo-preview" id="mt-photo-preview" style="display: none;">
                        <img id="mt-photo-img" src="" alt="Preview">
                        <button type="button" class="btn-remove-photo" onclick="mtRemovePhoto(event)">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <input type="file" id="mt-photo-input" name="photo" accept="image/*" style="display: none" onchange="mtPreviewPhoto(this)">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Créer le ticket</button>
            </div>
        </form>
    `);
    
    // Charger les chambres du premier hôtel
    if (defaultHotel) {
        mtLoadHotelRooms(defaultHotel);
    }
}

// Affiche/masque la case "chambre bloquée" selon la sélection
function mtToggleRoomBlocked(value) {
    const blockedGroup = document.getElementById('mt-room-blocked-group');
    if (!blockedGroup) return;
    
    // Afficher uniquement si c'est une vraie chambre (numéro)
    const isRoom = value && !['HALL', 'COULOIR', 'ESCALIER', 'ASCENSEUR', 'PARKING', 'CUISINE', 'RESTAURANT', 'EXTERIEUR', 'AUTRE'].includes(value);
    blockedGroup.style.display = isRoom ? 'block' : 'none';
    
    // Décocher si on masque
    if (!isRoom) {
        document.getElementById('mt-room-blocked').checked = false;
    }
}

async function mtLoadHotelRooms(hotelId) {
    const select = document.getElementById('mt-room-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Chargement...</option>';
    select.disabled = true;
    
    try {
        const res = await API.get(`/hotels/${hotelId}/rooms`);
        const rooms = res.rooms || [];
        
        let options = '<option value="">-- Sélectionner --</option>';
        
        // Grouper par étage
        const byFloor = {};
        rooms.forEach(r => {
            const floor = r.floor || 'RDC';
            if (!byFloor[floor]) byFloor[floor] = [];
            byFloor[floor].push(r);
        });
        
        // Trier les étages
        const floors = Object.keys(byFloor).sort((a, b) => {
            if (a === 'RDC') return -1;
            if (b === 'RDC') return 1;
            return parseInt(a) - parseInt(b);
        });
        
        floors.forEach(floor => {
            options += `<optgroup label="Étage ${floor}">`;
            byFloor[floor].forEach(r => {
                const roomType = r.room_type ? ` (${r.room_type})` : '';
                options += `<option value="${esc(r.room_number)}">Chambre ${esc(r.room_number)}${roomType}</option>`;
            });
            options += '</optgroup>';
        });
        
        // Ajouter l'option "Autre"
        options += '<optgroup label="Autres zones">';
        options += '<option value="HALL">Hall / Réception</option>';
        options += '<option value="COULOIR">Couloirs</option>';
        options += '<option value="ESCALIER">Escaliers</option>';
        options += '<option value="ASCENSEUR">Ascenseur</option>';
        options += '<option value="PARKING">Parking</option>';
        options += '<option value="CUISINE">Cuisine</option>';
        options += '<option value="RESTAURANT">Restaurant</option>';
        options += '<option value="EXTERIEUR">Extérieur</option>';
        options += '<option value="AUTRE">Autre</option>';
        options += '</optgroup>';
        
        select.innerHTML = options;
        select.disabled = false;
        
    } catch (e) {
        select.innerHTML = `
            <option value="">-- Sélectionner --</option>
            <option value="AUTRE">Autre (saisie libre)</option>
        `;
        select.disabled = false;
    }
}

function mtPreviewPhoto(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (file.size > 5 * 1024 * 1024) {
            toast('La photo ne doit pas dépasser 5Mo', 'error');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('mt-photo-content').style.display = 'none';
            document.getElementById('mt-photo-preview').style.display = 'block';
            document.getElementById('mt-photo-img').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function mtRemovePhoto(event) {
    event.stopPropagation();
    document.getElementById('mt-photo-input').value = '';
    document.getElementById('mt-photo-content').style.display = 'flex';
    document.getElementById('mt-photo-preview').style.display = 'none';
}

async function mtCreateTicket(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
        await API.createTicketWithPhoto(formData);
        toast('Ticket créé', 'success');
        closeModal();
        loadMaintenance(document.getElementById('page-content'));
    } catch (e) { toast(e.message, 'error'); }
}

async function mtViewTicket(id) {
    try {
        const res = await API.getTicket(id);
        const t = res.ticket;
        const comments = res.comments || [];
        
        // Vérifier les permissions
        const canManage = hasPermission('maintenance.manage');
        const canComment = hasPermission('maintenance.comment');
        
        // Indicateur de retard
        const isOverdue = t.is_overdue || false;
        const daysInProgress = t.days_in_progress || 0;

        // Construire le HTML de la timeline
        let timelineHtml = '<div class="timeline-item timeline-blue"><div class="timeline-icon"><i class="fas fa-plus-circle"></i></div><div class="timeline-content"><div class="timeline-header"><strong>Ticket créé</strong><span class="timeline-meta">par ' + esc(t.reporter_name || 'Inconnu') + '</span><span class="timeline-date">' + formatDateFull(t.created_at) + '</span></div></div></div>';
        
        if (comments && comments.length > 0) {
            comments.forEach(function(c) {
                let icon = 'fa-comment';
                let color = 'gray';
                let title = 'Commentaire';
                
                if (c.comment_type === 'assignment') {
                    icon = 'fa-hand-paper';
                    color = 'orange';
                    title = 'Prise en charge';
                } else if (c.comment_type === 'resolution') {
                    icon = 'fa-check-circle';
                    color = 'green';
                    title = 'Résolution';
                }
                
                timelineHtml += '<div class="timeline-item timeline-' + color + '"><div class="timeline-icon"><i class="fas ' + icon + '"></i></div><div class="timeline-content"><div class="timeline-header"><strong>' + title + '</strong><span class="timeline-meta">par ' + esc(c.user_name || 'Inconnu') + '</span><span class="timeline-date">' + formatDateFull(c.created_at) + '</span></div>' + (c.comment ? '<div class="timeline-body">' + esc(c.comment) + '</div>' : '') + '</div></div>';
            });
        }

        // Construire le formulaire de commentaire
        let commentFormHtml = '';
        if (canComment && t.status !== 'resolved') {
            commentFormHtml = '<form onsubmit="mtAddComment(event, ' + t.id + ')" class="comment-form"><textarea name="comment" rows="2" placeholder="Écrire un commentaire de suivi..." required></textarea><button type="submit" class="btn btn-sm btn-primary"><i class="fas fa-paper-plane"></i> Envoyer</button></form>';
        } else if (t.status === 'resolved') {
            commentFormHtml = '<p class="text-muted" style="margin-top:10px; font-size:13px;">Ce ticket est résolu.</p>';
        } else if (!canComment) {
            commentFormHtml = '<p class="text-muted" style="margin-top:10px; font-size:13px;">Vous n\'avez pas la permission d\'ajouter des commentaires.</p>';
        }

        // Boutons d'action
        let actionButtons = '';
        if (canManage && t.status === 'open') {
            actionButtons = '<button class="btn btn-primary" onclick="mtAssignTicket(' + t.id + '); closeModal();">Prendre en charge</button>';
        }
        if (canManage && t.status === 'in_progress') {
            actionButtons = '<button class="btn btn-success" onclick="closeModal(); mtResolveModal(' + t.id + ');">Résoudre</button>';
        }

        const modalContent = `
            <div class="ticket-detail">
                <div class="ticket-header">
                    <span class="badge badge-${t.priority === 'critical' ? 'danger' : 'primary'}">${LABELS.priority[t.priority] || t.priority}</span>
                    ${statusBadge(t.status)}
                    ${isOverdue ? '<span class="badge badge-overdue">⚠️ En retard</span>' : ''}
                </div>
                
                ${isOverdue ? '<div class="ticket-overdue-warning"><i class="fas fa-exclamation-triangle"></i> Ce ticket est en cours depuis ' + daysInProgress + ' jours (> 7 jours)</div>' : ''}

                <div class="ticket-info-grid">
                    <div class="ticket-info-item"><i class="fas fa-hotel"></i><span>Hôtel:</span> ${esc(t.hotel_name || '-')}</div>
                    <div class="ticket-info-item"><i class="fas fa-door-open"></i><span>Chambre:</span> ${t.room_number || 'Parties communes'}</div>
                    <div class="ticket-info-item"><i class="fas fa-tag"></i><span>Catégorie:</span> ${LABELS.maintenance_cat[t.category] || t.category}</div>
                    <div class="ticket-info-item"><i class="fas fa-user"></i><span>Créé par:</span> ${esc(t.reporter_name || '-')}</div>
                    <div class="ticket-info-item"><i class="fas fa-calendar"></i><span>Date:</span> ${formatDateFull(t.created_at)}</div>
                    ${t.assigned_to_name ? '<div class="ticket-info-item"><i class="fas fa-user-cog"></i><span>Assigné à:</span> ' + esc(t.assigned_to_name) + '</div>' : ''}
                </div>

                <div class="ticket-description">
                    <strong><i class="fas fa-align-left"></i> Description:</strong>
                    <p>${esc(t.description)}</p>
                </div>

                <div class="ticket-photos-section">
                    <strong><i class="fas fa-camera"></i> Photos jointes:</strong>
                    ${t.photo_url ? `
                        <div class="ticket-photos-gallery">
                            <div class="ticket-photo-item" onclick="openPhotoModal('${t.photo_url}')">
                                <img src="${t.photo_url}" alt="Photo du ticket">
                                <div class="photo-overlay">
                                    <i class="fas fa-search-plus"></i>
                                </div>
                            </div>
                        </div>
                    ` : '<p class="text-muted" style="margin: 10px 0;">Aucune photo jointe</p>'}
                </div>

                ${t.resolution_notes ? '<div class="ticket-resolution"><strong><i class="fas fa-check-circle"></i> Résolution:</strong><p>' + esc(t.resolution_notes) + '</p></div>' : ''}

                <div class="ticket-timeline">
                    <strong><i class="fas fa-history"></i> Historique & Commentaires:</strong>
                    <div class="timeline-list">
                        ${timelineHtml}
                    </div>
                </div>
                
                <div class="ticket-add-comment">
                    <strong><i class="fas fa-comment"></i> Ajouter un commentaire:</strong>
                    ${commentFormHtml}
                </div>
            </div>

            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal()">Fermer</button>
                ${actionButtons}
            </div>
        `;

        openModal('Ticket #' + t.id, modalContent);
    } catch (e) { 
        console.error('Erreur mtViewTicket:', e);
        toast(e.message, 'error'); 
    }
}

function mtRenderTimeline(ticket, comments) {
    const timeline = [];
    
    // Événement de création
    timeline.push({
        type: 'creation',
        icon: 'fa-plus-circle',
        color: 'blue',
        title: 'Ticket créé',
        user: ticket.reporter_name,
        date: ticket.created_at,
        content: null
    });
    
    // Ajouter les commentaires dans l'ordre chronologique
    comments.forEach(c => {
        let icon, color, title;
        switch(c.comment_type) {
            case 'assignment':
                icon = 'fa-hand-paper';
                color = 'orange';
                title = 'Prise en charge';
                break;
            case 'resolution':
                icon = 'fa-check-circle';
                color = 'green';
                title = 'Résolution';
                break;
            case 'status_change':
                icon = 'fa-exchange-alt';
                color = 'purple';
                title = 'Changement de statut';
                break;
            default:
                icon = 'fa-comment';
                color = 'gray';
                title = 'Commentaire';
        }
        
        timeline.push({
            type: c.comment_type,
            icon,
            color,
            title,
            user: c.user_name,
            role: c.user_role,
            date: c.created_at,
            content: c.comment
        });
    });
    
    if (timeline.length === 1) {
        return '<p class="text-muted">Aucun commentaire pour l\'instant.</p>';
    }
    
    return timeline.map(item => `
        <div class="timeline-item timeline-${item.color}">
            <div class="timeline-icon"><i class="fas ${item.icon}"></i></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <strong>${item.title}</strong>
                    <span class="timeline-meta">par ${esc(item.user)} ${item.role ? `<span class="role-badge">${LABELS.role[item.role] || item.role}</span>` : ''}</span>
                    <span class="timeline-date">${formatDateFull(item.date)}</span>
                </div>
                ${item.content ? `<div class="timeline-body">${esc(item.content)}</div>` : ''}
            </div>
        </div>
    `).join('');
}

async function mtAddComment(e, ticketId) {
    e.preventDefault();
    const form = e.target;
    const comment = new FormData(form).get('comment');
    
    if (!comment.trim()) {
        toast('Le commentaire ne peut pas être vide', 'warning');
        return;
    }
    
    try {
        await API.addTicketComment(ticketId, comment);
        toast('Commentaire ajouté', 'success');
        
        // Recharger le ticket pour voir le nouveau commentaire
        mtViewTicket(ticketId);
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function mtAssignTicket(id) {
    if (!['admin', 'groupe_manager', 'hotel_manager'].includes(API.user?.role)) {
        toast('Vous n\'avez pas les droits pour prendre en charge ce ticket', 'error');
        return;
    }
    try {
        await API.assignTicket(id);
        toast('Ticket pris en charge', 'success');
        mtReloadTickets();
    } catch (e) { toast(e.message, 'error'); }
}

function mtResolveModal(id) {
    openModal('Résoudre le ticket', `
        <form onsubmit="mtResolveTicket(event, ${id})">
            <div class="form-group">
                <label>Notes de résolution *</label>
                <textarea name="notes" rows="4" required placeholder="Décrivez la solution apportée..."></textarea>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-success">Marquer résolu</button>
            </div>
        </form>
    `);
}

async function mtResolveTicket(e, id) {
    e.preventDefault();
    const notes = new FormData(e.target).get('notes');
    try {
        await API.resolveTicket(id, notes);
        toast('Ticket résolu', 'success');
        closeModal();
        loadMaintenance(document.getElementById('page-content'));
    } catch (e) { toast(e.message, 'error'); }
}

function formatDateShort(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR');
}

function formatDateFull(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('fr-FR');
}

// =============================================
// CHAMBRES BLOQUÉES - Analyse et Reporting
// =============================================

async function mtLoadBlockedRooms() {
    const container = document.getElementById('blocked-rooms-list');
    const kpisContainer = document.getElementById('blocked-rooms-kpis');
    
    if (!container) return;
    
    container.innerHTML = '<div class="loading-inline"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';
    
    const hotelId = document.getElementById('blocked-hotel')?.value || '';
    const startDate = document.getElementById('blocked-start')?.value || '';
    const endDate = document.getElementById('blocked-end')?.value || '';
    const status = document.getElementById('blocked-status')?.value || '';
    
    try {
        const params = new URLSearchParams();
        if (hotelId) params.append('hotel_id', hotelId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (status) params.append('status', status);
        
        const res = await API.get(`/maintenance/blocked-rooms?${params.toString()}`);
        const rooms = res.rooms || [];
        const stats = res.stats || {};
        
        // Stocker pour l'export PDF
        mtBlockedRoomsData = { rooms, stats, filters: { hotelId, startDate, endDate, status } };
        
        // Afficher les KPIs
        kpisContainer.innerHTML = `
            <div class="analysis-kpi-grid">
                <div class="analysis-kpi">
                    <div class="analysis-kpi-value">${stats.total_blocked || 0}</div>
                    <div class="analysis-kpi-label">Total incidents</div>
                </div>
                <div class="analysis-kpi">
                    <div class="analysis-kpi-value">${stats.still_blocked || 0}</div>
                    <div class="analysis-kpi-label">Encore bloquées</div>
                </div>
                <div class="analysis-kpi">
                    <div class="analysis-kpi-value">${stats.resolved_count || 0}</div>
                    <div class="analysis-kpi-label">Résolues</div>
                </div>
                <div class="analysis-kpi">
                    <div class="analysis-kpi-value">${stats.total_blocked_days || 0}</div>
                    <div class="analysis-kpi-label">Jours-chambre perdus</div>
                </div>
                <div class="analysis-kpi">
                    <div class="analysis-kpi-value">${stats.avg_resolution_days ? stats.avg_resolution_days.toFixed(1) : '-'}</div>
                    <div class="analysis-kpi-label">Durée moy. (jours)</div>
                </div>
            </div>
        `;
        
        // Afficher la liste
        if (rooms.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-door-open"></i>
                    <h3>Aucune chambre bloquée</h3>
                    <p class="text-muted">Aucune chambre n'a été bloquée sur cette période</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <table class="table blocked-rooms-table">
                <thead>
                    <tr>
                        <th>Hôtel</th>
                        <th>Chambre</th>
                        <th>Ticket</th>
                        <th>Catégorie</th>
                        <th>Raison</th>
                        <th>Bloquée le</th>
                        <th>Durée</th>
                        <th>Statut</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rooms.map(r => {
                        const statusClass = r.status === 'resolved' ? 'success' : 'danger';
                        const statusLabel = r.status === 'resolved' ? 'Résolue' : 'Bloquée';
                        const daysBlocked = r.days_blocked || 0;
                        
                        return `
                            <tr class="${r.status !== 'resolved' ? 'row-blocked' : ''}">
                                <td><span class="hotel-tag">${esc(r.hotel_name)}</span></td>
                                <td><strong>${esc(r.room_number)}</strong></td>
                                <td><a href="#" onclick="mtViewTicket(${r.ticket_id}); return false;">#${r.ticket_id}</a></td>
                                <td>${LABELS.maintenance_cat[r.category] || r.category}</td>
                                <td class="text-truncate" style="max-width: 200px;" title="${esc(r.description)}">${esc(r.description.substring(0, 50))}${r.description.length > 50 ? '...' : ''}</td>
                                <td>${formatDateShort(r.created_at)}</td>
                                <td>
                                    <span class="days-badge ${daysBlocked > 5 ? 'critical' : daysBlocked > 2 ? 'warning' : ''}">${daysBlocked} jour${daysBlocked > 1 ? 's' : ''}</span>
                                </td>
                                <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
                                <td>
                                    <button class="btn-action" onclick="mtViewTicket(${r.ticket_id})" title="Voir détails">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </td>
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

async function mtExportBlockedRoomsPDF() {
    if (!mtBlockedRoomsData) {
        toast('Veuillez d\'abord charger les données', 'warning');
        return;
    }
    
    const { rooms, stats, filters } = mtBlockedRoomsData;
    
    // Préparer les données pour l'API
    const exportData = {
        rooms,
        stats,
        start_date: filters.startDate,
        end_date: filters.endDate,
        hotel_id: filters.hotelId
    };
    
    try {
        toast('Génération du PDF en cours...', 'info');
        
        const response = await fetch(API_BASE + '/maintenance/blocked-rooms/export-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            },
            body: JSON.stringify(exportData)
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors de la génération du PDF');
        }
        
        // Télécharger le fichier
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chambres_bloquees_${filters.startDate}_${filters.endDate}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast('PDF généré avec succès', 'success');
        
    } catch (e) {
        toast(e.message, 'error');
    }
}

// Supprimer un ticket de maintenance (admin et groupe_manager uniquement)
async function mtDeleteTicket(id) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le ticket #${id} ?\n\nCette action est irréversible et supprimera également tous les commentaires et photos associés.`)) {
        return;
    }
    
    try {
        await API.delete(`maintenance/${id}`);
        toast('Ticket supprimé avec succès', 'success');
        mtReloadTickets();
    } catch (error) {
        toast(error.message, 'error');
    }
}

// Ouvrir une photo en grand dans une modal
function openPhotoModal(photoUrl) {
    const overlay = document.createElement('div');
    overlay.className = 'photo-modal-overlay';
    overlay.onclick = () => overlay.remove();
    overlay.innerHTML = `
        <div class="photo-modal-content" onclick="event.stopPropagation()">
            <button class="photo-modal-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
            <img src="${photoUrl}" alt="Photo en grand">
            <div class="photo-modal-actions">
                <a href="${photoUrl}" download class="btn btn-outline">
                    <i class="fas fa-download"></i> Télécharger
                </a>
                <a href="${photoUrl}" target="_blank" class="btn btn-outline">
                    <i class="fas fa-external-link-alt"></i> Ouvrir dans un nouvel onglet
                </a>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}
