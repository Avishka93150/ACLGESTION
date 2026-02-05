/**
 * Hotels Page - avec gestion complète des chambres
 */

const ROOM_TYPES = [
    { value: 'standard', label: 'Standard', icon: '🛏️' },
    { value: 'superieure', label: 'Supérieure', icon: '⭐' },
    { value: 'suite', label: 'Suite', icon: '👑' },
    { value: 'familiale', label: 'Familiale', icon: '👨‍👩‍👧‍👦' },
    { value: 'pmr', label: 'PMR', icon: '♿' }
];

const BED_TYPES = [
    { value: 'single', label: 'Simple' },
    { value: 'double', label: 'Double' },
    { value: 'twin', label: 'Twin (2 lits)' },
    { value: 'queen', label: 'Queen' },
    { value: 'king', label: 'King' }
];

const ROOM_STATUSES = [
    { value: 'active', label: 'Active', color: 'success' },
    { value: 'hors_service', label: 'Hors service', color: 'warning' },
    { value: 'renovation', label: 'En rénovation', color: 'danger' }
];

let currentHotelId = null;

async function loadHotels(container) {
    showLoading(container);

    try {
        const [hotelsRes, permsRes] = await Promise.all([
            API.getHotels(),
            API.getMyPermissions()
        ]);
        
        const hotels = hotelsRes.hotels || [];
        const perms = permsRes.permissions || {};
        window._hotels = hotels;
        window._myPerms = perms;

        const canCreate = perms['hotels.create'] || API.user.role === 'admin';
        const canEdit = perms['hotels.edit'] || API.user.role === 'admin';
        const canDelete = perms['hotels.delete'] || API.user.role === 'admin';

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-building"></i> Liste des hôtels</h3>
                    ${canCreate ? '<button class="btn btn-primary" onclick="showNewHotelModal()"><i class="fas fa-plus"></i> Nouvel hôtel</button>' : ''}
                </div>
                ${hotels.length ? `
                    <table>
                        <thead><tr><th>Nom</th><th>Ville</th><th>Téléphone</th><th>Étoiles</th><th>Chambres</th><th>Statut</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${hotels.map(h => `
                                <tr>
                                    <td><strong>${esc(h.name)}</strong></td>
                                    <td>${esc(h.city) || '-'}</td>
                                    <td>${esc(h.phone) || '-'}</td>
                                    <td>${'⭐'.repeat(h.stars || 0)}</td>
                                    <td><span class="badge badge-primary">${h.room_count || 0}</span></td>
                                    <td>${statusBadge(h.status)}</td>
                                    <td>
                                        <div class="table-actions">
                                            <button onclick="viewHotelRooms(${h.id})" title="Gérer les chambres"><i class="fas fa-door-open"></i></button>
                                            ${canEdit ? `<button onclick="showEditHotelModal(${h.id})" title="Modifier l'hôtel"><i class="fas fa-edit"></i></button>` : ''}
                                            ${canDelete ? `<button onclick="deleteHotel(${h.id})" title="Supprimer" style="color:var(--danger)"><i class="fas fa-trash"></i></button>` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div class="empty-state"><i class="fas fa-building"></i><h3>Aucun hôtel</h3></div>'}
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

// ============ HOTEL CRUD ============

function showNewHotelModal() {
    openModal('Nouvel hôtel', `
        <form onsubmit="createHotel(event)">
            <div class="form-group">
                <label>Nom commercial *</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>Adresse</label>
                <input type="text" name="address" placeholder="Rue, numéro...">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Ville</label>
                    <input type="text" name="city">
                </div>
                <div class="form-group">
                    <label>Code postal</label>
                    <input type="text" name="postal_code">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Téléphone</label>
                    <input type="tel" name="phone" placeholder="01 23 45 67 89">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" placeholder="contact@hotel.fr">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Étoiles</label>
                    <select name="stars">
                        <option value="1">1 ⭐</option>
                        <option value="2">2 ⭐</option>
                        <option value="3" selected>3 ⭐</option>
                        <option value="4">4 ⭐</option>
                        <option value="5">5 ⭐</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Étages</label>
                    <input type="number" name="total_floors" value="1" min="1">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Heure check-in</label>
                    <input type="time" name="checkin_time" value="15:00">
                </div>
                <div class="form-group">
                    <label>Heure check-out</label>
                    <input type="time" name="checkout_time" value="11:00">
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Créer</button>
            </div>
        </form>
    `);
}

async function createHotel(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));

    try {
        await API.createHotel(data);
        toast('Hôtel créé', 'success');
        closeModal();
        loadHotels(document.getElementById('page-content'));
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function showEditHotelModal(id) {
    try {
        const result = await API.getHotel(id);
        const h = result.hotel;

        openModal('Modifier l\'hôtel', `
            <form onsubmit="updateHotel(event, ${h.id})">
                <div class="form-group">
                    <label>Nom commercial *</label>
                    <input type="text" name="name" value="${esc(h.name)}" required>
                </div>
                <div class="form-group">
                    <label>Adresse</label>
                    <input type="text" name="address" value="${esc(h.address || '')}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Ville</label>
                        <input type="text" name="city" value="${esc(h.city || '')}">
                    </div>
                    <div class="form-group">
                        <label>Code postal</label>
                        <input type="text" name="postal_code" value="${esc(h.postal_code || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Téléphone</label>
                        <input type="tel" name="phone" value="${esc(h.phone || '')}">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" value="${esc(h.email || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Étoiles</label>
                        <select name="stars">
                            ${[1,2,3,4,5].map(n => `<option value="${n}" ${h.stars == n ? 'selected' : ''}>${n} ⭐</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Étages</label>
                        <input type="number" name="total_floors" value="${h.total_floors || 1}" min="1">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Heure check-in</label>
                        <input type="time" name="checkin_time" value="${(h.checkin_time || '15:00:00').substring(0,5)}">
                    </div>
                    <div class="form-group">
                        <label>Heure check-out</label>
                        <input type="time" name="checkout_time" value="${(h.checkout_time || '11:00:00').substring(0,5)}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Statut</label>
                    <select name="status">
                        <option value="active" ${h.status === 'active' ? 'selected' : ''}>Actif</option>
                        <option value="inactive" ${h.status === 'inactive' ? 'selected' : ''}>Inactif</option>
                    </select>
                </div>
                
                <div class="form-section mt-20">
                    <h5><i class="fas fa-chart-line"></i> Revenue Management (Xotelo)</h5>
                    <p class="text-muted mb-10">Configurez la clé Xotelo pour la veille tarifaire</p>
                    <div class="form-group">
                        <label>Clé Xotelo (hotel_key)</label>
                        <input type="text" name="xotelo_hotel_key" value="${esc(h.xotelo_hotel_key || '')}" placeholder="Ex: h12345678">
                        <small class="form-help">Trouvez cette clé sur <a href="https://xotelo.com" target="_blank">xotelo.com</a></small>
                    </div>
                </div>
                
                <div class="form-section mt-20">
                    <h5><i class="fas fa-cash-register"></i> Configuration des clôtures</h5>
                    <p class="text-muted mb-10">Paramétrez les documents requis pour les clôtures journalières</p>
                    <button type="button" class="btn btn-outline" onclick="closeModal(); showClosureConfigModal(${h.id}, '${esc(h.name)}')">
                        <i class="fas fa-cog"></i> Configurer les documents de clôture
                    </button>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `);
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function updateHotel(e, id) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));

    try {
        await API.updateHotel(id, data);
        toast('Hôtel modifié', 'success');
        closeModal();
        loadHotels(document.getElementById('page-content'));
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function deleteHotel(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet hôtel ?\nCette action est irréversible.')) return;

    try {
        await API.deleteHotel(id);
        toast('Hôtel supprimé', 'success');
        loadHotels(document.getElementById('page-content'));
    } catch (error) {
        toast(error.message, 'error');
    }
}

// ============ ROOMS MANAGEMENT ============

async function viewHotelRooms(hotelId) {
    currentHotelId = hotelId;
    const container = document.getElementById('page-content');
    showLoading(container);

    try {
        const result = await API.getHotel(hotelId);
        const hotel = result.hotel;
        const rooms = hotel.rooms || [];

        // Grouper les chambres par étage
        const roomsByFloor = {};
        rooms.forEach(r => {
            if (!roomsByFloor[r.floor]) roomsByFloor[r.floor] = [];
            roomsByFloor[r.floor].push(r);
        });

        // Statistiques
        const stats = {
            total: rooms.length,
            active: rooms.filter(r => r.status === 'active').length,
            hors_service: rooms.filter(r => r.status === 'hors_service').length,
            renovation: rooms.filter(r => r.status === 'renovation').length
        };

        // Stats par type
        const typeStats = {};
        ROOM_TYPES.forEach(t => {
            typeStats[t.value] = rooms.filter(r => r.room_type === t.value).length;
        });

        container.innerHTML = `
            <div class="page-header-actions">
                <button class="btn btn-outline" onclick="loadHotels(document.getElementById('page-content'))">
                    <i class="fas fa-arrow-left"></i> Retour aux hôtels
                </button>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-door-open"></i> ${esc(hotel.name)} - Gestion des chambres</h3>
                    <div class="header-actions">
                        <button class="btn btn-outline" onclick="showBulkAddRoomsModal(${hotelId})">
                            <i class="fas fa-layer-group"></i> Ajout multiple
                        </button>
                        <button class="btn btn-primary" onclick="showAddRoomModal(${hotelId})">
                            <i class="fas fa-plus"></i> Nouvelle chambre
                        </button>
                    </div>
                </div>

                <!-- Statistiques -->
                <div class="rooms-stats">
                    <div class="stat-card">
                        <div class="stat-value">${stats.total}</div>
                        <div class="stat-label">Total</div>
                    </div>
                    <div class="stat-card stat-success">
                        <div class="stat-value">${stats.active}</div>
                        <div class="stat-label">Actives</div>
                    </div>
                    <div class="stat-card stat-warning">
                        <div class="stat-value">${stats.hors_service}</div>
                        <div class="stat-label">Hors service</div>
                    </div>
                    <div class="stat-card stat-danger">
                        <div class="stat-value">${stats.renovation}</div>
                        <div class="stat-label">Rénovation</div>
                    </div>
                </div>

                <!-- Types de chambres -->
                <div class="room-types-summary">
                    ${ROOM_TYPES.map(t => `
                        <span class="type-badge ${typeStats[t.value] > 0 ? '' : 'type-badge-empty'}">
                            ${t.icon} ${t.label}: <strong>${typeStats[t.value]}</strong>
                        </span>
                    `).join('')}
                </div>
            </div>

            <!-- Liste des chambres par étage -->
            ${Object.keys(roomsByFloor).sort((a,b) => a - b).map(floor => `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-layer-group"></i> Étage ${floor}</h3>
                        <span class="badge badge-primary">${roomsByFloor[floor].length} chambre(s)</span>
                    </div>
                    <div class="rooms-grid">
                        ${roomsByFloor[floor].sort((a,b) => a.room_number.localeCompare(b.room_number)).map(r => `
                            <div class="room-card room-card-${r.status}" onclick="showEditRoomModal(${r.id}, ${hotelId})">
                                <div class="room-number">${esc(r.room_number)}</div>
                                <div class="room-type">${getRoomTypeIcon(r.room_type)} ${LABELS.room_type[r.room_type] || r.room_type}</div>
                                <div class="room-bed">${getBedTypeLabel(r.bed_type)}</div>
                                <div class="room-status">${getStatusLabel(r.status)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}

            ${rooms.length === 0 ? `
                <div class="card">
                    <div class="empty-state">
                        <i class="fas fa-door-open"></i>
                        <h3>Aucune chambre</h3>
                        <p>Commencez par ajouter des chambres à cet hôtel</p>
                        <button class="btn btn-primary" onclick="showBulkAddRoomsModal(${hotelId})">
                            <i class="fas fa-layer-group"></i> Ajouter plusieurs chambres
                        </button>
                    </div>
                </div>
            ` : ''}
        `;
    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function getRoomTypeIcon(type) {
    const t = ROOM_TYPES.find(x => x.value === type);
    return t ? t.icon : '🛏️';
}

function getBedTypeLabel(type) {
    const t = BED_TYPES.find(x => x.value === type);
    return t ? t.label : type;
}

function getStatusLabel(status) {
    const s = ROOM_STATUSES.find(x => x.value === status);
    return s ? s.label : status;
}

// ============ ROOM CRUD ============

function showAddRoomModal(hotelId) {
    openModal('Nouvelle chambre', `
        <form onsubmit="createRoom(event, ${hotelId})">
            <div class="form-row">
                <div class="form-group">
                    <label>Numéro de chambre *</label>
                    <input type="text" name="room_number" required placeholder="Ex: 101, A12...">
                </div>
                <div class="form-group">
                    <label>Étage *</label>
                    <input type="number" name="floor" value="1" min="0" required>
                </div>
            </div>
            
            <div class="form-group">
                <label>Type de chambre</label>
                <div class="room-type-selector">
                    ${ROOM_TYPES.map((t, i) => `
                        <label class="type-option">
                            <input type="radio" name="room_type" value="${t.value}" ${i === 0 ? 'checked' : ''}>
                            <span class="type-option-content">
                                <span class="type-icon">${t.icon}</span>
                                <span class="type-label">${t.label}</span>
                            </span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <div class="form-group">
                <label>Type de lit</label>
                <select name="bed_type">
                    ${BED_TYPES.map(b => `<option value="${b.value}">${b.label}</option>`).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label>Statut</label>
                <select name="status">
                    ${ROOM_STATUSES.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
                </select>
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Ajouter</button>
            </div>
        </form>
    `);
}

async function createRoom(e, hotelId) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.hotel_id = hotelId;

    try {
        await API.createRoom(data);
        toast('Chambre ajoutée', 'success');
        closeModal();
        viewHotelRooms(hotelId);
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function showEditRoomModal(roomId, hotelId) {
    try {
        const result = await API.getRoom(roomId);
        const r = result.room;

        openModal(`Chambre ${r.room_number}`, `
            <form onsubmit="updateRoom(event, ${r.id}, ${hotelId})">
                <div class="form-row">
                    <div class="form-group">
                        <label>Numéro de chambre *</label>
                        <input type="text" name="room_number" value="${esc(r.room_number)}" required>
                    </div>
                    <div class="form-group">
                        <label>Étage *</label>
                        <input type="number" name="floor" value="${r.floor}" min="0" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Type de chambre</label>
                    <div class="room-type-selector">
                        ${ROOM_TYPES.map(t => `
                            <label class="type-option">
                                <input type="radio" name="room_type" value="${t.value}" ${r.room_type === t.value ? 'checked' : ''}>
                                <span class="type-option-content">
                                    <span class="type-icon">${t.icon}</span>
                                    <span class="type-label">${t.label}</span>
                                </span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Type de lit</label>
                    <select name="bed_type">
                        ${BED_TYPES.map(b => `<option value="${b.value}" ${r.bed_type === b.value ? 'selected' : ''}>${b.label}</option>`).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Statut</label>
                    <select name="status">
                        ${ROOM_STATUSES.map(s => `<option value="${s.value}" ${r.status === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                    </select>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-danger" onclick="deleteRoom(${r.id}, ${hotelId})" style="margin-right:auto">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `);
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function updateRoom(e, roomId, hotelId) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));

    try {
        await API.updateRoom(roomId, data);
        toast('Chambre modifiée', 'success');
        closeModal();
        viewHotelRooms(hotelId);
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function deleteRoom(roomId, hotelId) {
    if (!confirm('Supprimer cette chambre ?')) return;

    try {
        await API.deleteRoom(roomId);
        toast('Chambre supprimée', 'success');
        closeModal();
        viewHotelRooms(hotelId);
    } catch (error) {
        toast(error.message, 'error');
    }
}

// ============ BULK ADD ROOMS ============

function showBulkAddRoomsModal(hotelId) {
    openModal('Ajouter plusieurs chambres', `
        <form onsubmit="bulkAddRooms(event, ${hotelId})">
            <p class="text-muted mb-20">Créez rapidement plusieurs chambres en définissant une plage de numéros.</p>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Étage *</label>
                    <input type="number" name="floor" value="1" min="0" required>
                </div>
                <div class="form-group">
                    <label>Préfixe (optionnel)</label>
                    <input type="text" name="prefix" placeholder="Ex: A, B...">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Numéro début *</label>
                    <input type="number" name="start" value="1" min="1" required>
                </div>
                <div class="form-group">
                    <label>Numéro fin *</label>
                    <input type="number" name="end" value="10" min="1" required>
                </div>
            </div>
            
            <div class="form-group">
                <label>Type de chambre</label>
                <select name="room_type">
                    ${ROOM_TYPES.map(t => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label>Type de lit</label>
                <select name="bed_type">
                    ${BED_TYPES.map(b => `<option value="${b.value}">${b.label}</option>`).join('')}
                </select>
            </div>
            
            <div class="bulk-preview" id="bulk-preview"></div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary"><i class="fas fa-plus"></i> Créer les chambres</button>
            </div>
        </form>
    `);

    // Prévisualisation en temps réel
    document.querySelectorAll('input[name="floor"], input[name="prefix"], input[name="start"], input[name="end"]').forEach(input => {
        input.addEventListener('input', updateBulkPreview);
    });
    updateBulkPreview();
}

function updateBulkPreview() {
    const floor = document.querySelector('input[name="floor"]').value;
    const prefix = document.querySelector('input[name="prefix"]').value || '';
    const start = parseInt(document.querySelector('input[name="start"]').value) || 1;
    const end = parseInt(document.querySelector('input[name="end"]').value) || 1;

    const preview = document.getElementById('bulk-preview');
    if (!preview) return;

    const count = Math.max(0, end - start + 1);
    if (count > 50) {
        preview.innerHTML = `<p class="text-warning"><i class="fas fa-exclamation-triangle"></i> Maximum 50 chambres à la fois</p>`;
        return;
    }

    const rooms = [];
    for (let i = start; i <= end && i < start + 50; i++) {
        rooms.push(`${prefix}${floor}${String(i).padStart(2, '0')}`);
    }

    preview.innerHTML = `
        <p><strong>${count} chambre(s) à créer :</strong></p>
        <div class="preview-rooms">${rooms.map(r => `<span class="preview-room">${r}</span>`).join('')}</div>
    `;
}

async function bulkAddRooms(e, hotelId) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const floor = formData.get('floor');
    const prefix = formData.get('prefix') || '';
    const start = parseInt(formData.get('start'));
    const end = parseInt(formData.get('end'));
    const roomType = formData.get('room_type');
    const bedType = formData.get('bed_type');

    const count = end - start + 1;
    if (count > 50) {
        toast('Maximum 50 chambres à la fois', 'error');
        return;
    }

    try {
        let created = 0;
        for (let i = start; i <= end; i++) {
            const roomNumber = `${prefix}${floor}${String(i).padStart(2, '0')}`;
            try {
                await API.createRoom({
                    hotel_id: hotelId,
                    room_number: roomNumber,
                    floor: floor,
                    room_type: roomType,
                    bed_type: bedType,
                    status: 'active'
                });
                created++;
            } catch (err) {
                console.warn(`Chambre ${roomNumber} non créée:`, err.message);
            }
        }
        
        toast(`${created} chambre(s) créée(s)`, 'success');
        closeModal();
        viewHotelRooms(hotelId);
    } catch (error) {
        toast(error.message, 'error');
    }
}

// ==================== CONFIGURATION CLOTURES ====================

let closureConfigDocs = [];

async function showClosureConfigModal(hotelId, hotelName) {
    try {
        const res = await API.get(`/closures/config/${hotelId}`);
        closureConfigDocs = res.config || [];
        
        renderClosureConfigModal(hotelId, hotelName);
    } catch (e) {
        closureConfigDocs = [];
        renderClosureConfigModal(hotelId, hotelName);
    }
}

function renderClosureConfigModal(hotelId, hotelName) {
    openModal(`Configuration clôtures - ${hotelName}`, `
        <div class="closure-config-container">
            <p class="text-muted mb-20">
                Configurez les documents à déposer et les champs à remplir lors des clôtures journalières.
            </p>
            
            <div class="closure-config-docs" id="closure-config-docs">
                ${renderClosureConfigDocs()}
            </div>
            
            <button type="button" class="btn btn-outline btn-block mt-20" onclick="closureConfigAddDoc()">
                <i class="fas fa-plus"></i> Ajouter un document
            </button>
            
            <div class="modal-footer mt-20">
                <button type="button" class="btn btn-outline" onclick="closeModal(); showEditHotelModal(${hotelId})">
                    <i class="fas fa-arrow-left"></i> Retour à l'hôtel
                </button>
                <button type="button" class="btn btn-primary" onclick="saveClosureConfig(${hotelId})">
                    <i class="fas fa-save"></i> Enregistrer
                </button>
            </div>
        </div>
    `, 'modal-xl');
}

function renderClosureConfigDocs() {
    if (closureConfigDocs.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>Aucun document configuré</p>
                <small class="text-muted">Ajoutez des documents requis pour les clôtures journalières</small>
            </div>
        `;
    }
    
    return closureConfigDocs.map((doc, idx) => `
        <div class="closure-config-doc card mb-15" data-index="${idx}">
            <div class="card-header">
                <div class="closure-config-doc-header">
                    <i class="fas fa-grip-vertical text-muted mr-10"></i>
                    <input type="text" class="form-control" value="${esc(doc.document_name || '')}" 
                        onchange="closureConfigUpdateDoc(${idx}, 'document_name', this.value)"
                        placeholder="Nom du document *" style="flex: 1;">
                    <label class="checkbox-label ml-15">
                        <input type="checkbox" ${doc.is_required ? 'checked' : ''} 
                            onchange="closureConfigUpdateDoc(${idx}, 'is_required', this.checked)">
                        Obligatoire
                    </label>
                    <button type="button" class="btn btn-sm btn-danger ml-10" onclick="closureConfigRemoveDoc(${idx})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <h6 class="mb-10">Champs personnalisés</h6>
                <div class="closure-config-fields" id="closure-config-fields-${idx}">
                    ${renderClosureConfigFields(idx, doc.fields || [])}
                </div>
                <button type="button" class="btn btn-sm btn-outline mt-10" onclick="closureConfigAddField(${idx})">
                    <i class="fas fa-plus"></i> Ajouter un champ
                </button>
            </div>
        </div>
    `).join('');
}

function renderClosureConfigFields(docIdx, fields) {
    if (fields.length === 0) {
        return '<p class="text-muted mb-0">Aucun champ - Document uniquement</p>';
    }
    
    return fields.map((field, fieldIdx) => `
        <div class="closure-config-field form-row mb-10" data-field-index="${fieldIdx}">
            <div class="form-group" style="flex: 2;">
                <input type="text" class="form-control" value="${esc(field.field_name || '')}"
                    onchange="closureConfigUpdateField(${docIdx}, ${fieldIdx}, 'field_name', this.value)"
                    placeholder="Nom du champ">
            </div>
            <div class="form-group" style="flex: 1;">
                <select class="form-control" onchange="closureConfigUpdateField(${docIdx}, ${fieldIdx}, 'field_type', this.value)">
                    <option value="text" ${field.field_type === 'text' ? 'selected' : ''}>Texte</option>
                    <option value="number" ${field.field_type === 'number' ? 'selected' : ''}>Nombre entier</option>
                    <option value="decimal" ${field.field_type === 'decimal' ? 'selected' : ''}>Nombre décimal</option>
                    <option value="date" ${field.field_type === 'date' ? 'selected' : ''}>Date</option>
                    <option value="select" ${field.field_type === 'select' ? 'selected' : ''}>Liste déroulante</option>
                </select>
            </div>
            <div class="form-group" style="flex: 0 0 auto;">
                <label class="checkbox-label">
                    <input type="checkbox" ${field.is_required ? 'checked' : ''}
                        onchange="closureConfigUpdateField(${docIdx}, ${fieldIdx}, 'is_required', this.checked)">
                    Obligatoire
                </label>
            </div>
            <div class="form-group" style="flex: 0 0 auto;">
                <button type="button" class="btn btn-sm btn-danger" onclick="closureConfigRemoveField(${docIdx}, ${fieldIdx})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function closureConfigAddDoc() {
    closureConfigDocs.push({
        document_name: '',
        is_required: true,
        closure_type: 'daily',
        fields: []
    });
    document.getElementById('closure-config-docs').innerHTML = renderClosureConfigDocs();
}

function closureConfigRemoveDoc(idx) {
    if (!confirm('Supprimer ce document ?')) return;
    closureConfigDocs.splice(idx, 1);
    document.getElementById('closure-config-docs').innerHTML = renderClosureConfigDocs();
}

function closureConfigUpdateDoc(idx, field, value) {
    closureConfigDocs[idx][field] = value;
}

function closureConfigAddField(docIdx) {
    if (!closureConfigDocs[docIdx].fields) {
        closureConfigDocs[docIdx].fields = [];
    }
    closureConfigDocs[docIdx].fields.push({
        field_name: '',
        field_type: 'text',
        is_required: false
    });
    document.getElementById(`closure-config-fields-${docIdx}`).innerHTML = 
        renderClosureConfigFields(docIdx, closureConfigDocs[docIdx].fields);
}

function closureConfigRemoveField(docIdx, fieldIdx) {
    closureConfigDocs[docIdx].fields.splice(fieldIdx, 1);
    document.getElementById(`closure-config-fields-${docIdx}`).innerHTML = 
        renderClosureConfigFields(docIdx, closureConfigDocs[docIdx].fields);
}

function closureConfigUpdateField(docIdx, fieldIdx, field, value) {
    closureConfigDocs[docIdx].fields[fieldIdx][field] = value;
}

async function saveClosureConfig(hotelId) {
    // Valider les documents
    const validDocs = closureConfigDocs.filter(d => d.document_name && d.document_name.trim());
    
    if (closureConfigDocs.length > 0 && validDocs.length === 0) {
        toast('Veuillez renseigner le nom des documents', 'warning');
        return;
    }
    
    try {
        await API.post(`/closures/config/${hotelId}`, { config: validDocs });
        toast('Configuration enregistrée', 'success');
        closeModal();
    } catch (e) {
        toast(e.message, 'error');
    }
}

