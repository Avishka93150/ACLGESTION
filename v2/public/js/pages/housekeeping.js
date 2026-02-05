/**
 * Module Gouvernante - Dispatch et Contrôle des chambres
 */

const CLEANING_TYPES = {
    blanc: { label: 'À blanc', desc: 'Nettoyage complet', icon: '🧹' },
    recouche: { label: 'Recouche', desc: 'Entretien léger', icon: '🛏️' }
};

const CONTROL_CRITERIA = [
    { key: 'ctrl_literie', label: 'Literie', icon: '🛏️' },
    { key: 'ctrl_salle_bain', label: 'Salle de bain', icon: '🚿' },
    { key: 'ctrl_sol_surfaces', label: 'Sol et surfaces', icon: '🧽' },
    { key: 'ctrl_equipements', label: 'Équipements', icon: '📺' },
    { key: 'ctrl_ambiance', label: 'Ambiance', icon: '💡' },
    { key: 'ctrl_proprete', label: 'Propreté générale', icon: '✨' }
];

let hkHotelId = null;
let hkDate = new Date().toISOString().split('T')[0];
let hkTab = 'dispatch';
let hkHotels = [];

async function loadHousekeeping(container) {
    showLoading(container);

    try {
        // Récupérer les hôtels auxquels l'utilisateur est affecté
        const mgmtRes = await API.getManagementInfo();
        hkHotels = mgmtRes.manageable_hotels || [];

        if (hkHotels.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="empty-state">
                        <i class="fas fa-building"></i>
                        <h3>Aucun hôtel assigné</h3>
                        <p>Vous n'êtes affecté à aucun hôtel. Contactez votre responsable.</p>
                    </div>
                </div>
            `;
            return;
        }

        // Premier hôtel par défaut
        if (!hkHotelId || !hkHotels.find(h => parseInt(h.id) === hkHotelId)) {
            hkHotelId = parseInt(hkHotels[0].id);
        }

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-broom"></i> Module Gouvernante</h3>
                    <div class="header-controls">
                        <select id="hk-hotel" onchange="hkChangeHotel(this.value)">
                            ${hkHotels.map(h => `<option value="${h.id}" ${h.id == hkHotelId ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
                        </select>
                        <input type="date" id="hk-date" value="${hkDate}" onchange="hkChangeDate(this.value)">
                    </div>
                </div>

                <div class="tabs">
                    <button class="tab-btn ${hkTab === 'dispatch' ? 'active' : ''}" onclick="hkSwitchTab('dispatch')">
                        <i class="fas fa-tasks"></i> Dispatch
                    </button>
                    <button class="tab-btn ${hkTab === 'control' ? 'active' : ''}" onclick="hkSwitchTab('control')">
                        <i class="fas fa-clipboard-check"></i> Contrôle
                    </button>
                    <button class="tab-btn ${hkTab === 'reports' ? 'active' : ''}" onclick="hkSwitchTab('reports')">
                        <i class="fas fa-file-pdf"></i> Rapports
                    </button>
                    <button class="tab-btn ${hkTab === 'alerts' ? 'active' : ''}" onclick="hkSwitchTab('alerts')">
                        <i class="fas fa-bell"></i> Alertes
                    </button>
                </div>

                <div id="hk-content"></div>
            </div>
        `;

        await hkLoadTab();
    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function hkChangeHotel(id) {
    hkHotelId = parseInt(id);
    hkLoadTab();
}

function hkChangeDate(date) {
    hkDate = date;
    hkLoadTab();
}

function hkSwitchTab(tab) {
    hkTab = tab;
    document.querySelectorAll('.tabs .tab-btn').forEach((btn, i) => {
        btn.classList.toggle('active', 
            (tab === 'dispatch' && i === 0) || 
            (tab === 'control' && i === 1) || 
            (tab === 'reports' && i === 2) ||
            (tab === 'alerts' && i === 3)
        );
    });
    hkLoadTab();
}

async function hkLoadTab() {
    const container = document.getElementById('hk-content');
    if (!container) return;
    
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

    try {
        if (hkTab === 'dispatch') {
            await hkLoadDispatch(container);
        } else if (hkTab === 'control') {
            await hkLoadControl(container);
        } else if (hkTab === 'reports') {
            await hkLoadReports(container);
        } else {
            await hkLoadAlerts(container);
        }
    } catch (error) {
        container.innerHTML = `<p class="text-danger">Erreur: ${error.message}</p>`;
    }
}

// ========== DISPATCH ==========

async function hkLoadDispatch(container) {
    const [roomsRes, dispatchRes] = await Promise.all([
        API.getRooms(hkHotelId),
        API.getDispatch({ hotel_id: hkHotelId, date: hkDate })
    ]);

    const rooms = (roomsRes.rooms || []).filter(r => r.status === 'active');
    const dispatches = dispatchRes.dispatches || [];

    const dispatchMap = {};
    dispatches.forEach(d => dispatchMap[parseInt(d.room_id)] = d);

    const roomsByFloor = {};
    rooms.forEach(r => {
        const floor = r.floor !== null && r.floor !== undefined ? String(r.floor) : '0';
        if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
        roomsByFloor[floor].push({ ...r, dispatch: dispatchMap[parseInt(r.id)] || null });
    });

    // Trier les étages numériquement
    const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
    });

    const stats = {
        total: rooms.length,
        dispatched: dispatches.length,
        pending: dispatches.filter(d => d.status === 'pending').length,
        completed: dispatches.filter(d => d.status === 'completed').length,
        controlled: dispatches.filter(d => d.status === 'controlled').length
    };

    container.innerHTML = `
        <div class="dispatch-stats">
            <div class="stat-item"><span class="stat-number">${stats.total}</span><span class="stat-label">🏠 Chambres</span></div>
            <div class="stat-item"><span class="stat-number">${stats.dispatched}</span><span class="stat-label">📋 Dispatchées</span></div>
            <div class="stat-item stat-warning"><span class="stat-number">${stats.pending}</span><span class="stat-label">⏳ En cours</span></div>
            <div class="stat-item stat-info"><span class="stat-number">${stats.completed}</span><span class="stat-label">🧹 Nettoyées</span></div>
            <div class="stat-item stat-success"><span class="stat-number">${stats.controlled}</span><span class="stat-label">✅ Contrôlées</span></div>
        </div>

        <div class="batch-actions">
            ${hasPermission('dispatch.create') ? '<button class="btn btn-primary" onclick="hkBatchModal()"><i class="fas fa-layer-group"></i> Dispatch en lot</button>' : ''}
            ${hasPermission('dispatch.complete') && stats.pending > 0 ? '<button class="btn btn-success" onclick="hkBatchCompleteModal()"><i class="fas fa-check-double"></i> Marquer nettoyées</button>' : ''}
            ${hasPermission('dispatch.create') ? '<button class="btn btn-outline" onclick="hkSelectAll(\'blanc\')">Tout à blanc</button>' : ''}
            ${hasPermission('dispatch.create') ? '<button class="btn btn-outline" onclick="hkSelectAll(\'recouche\')">Tout recouche</button>' : ''}
            ${hasPermission('dispatch.create') ? '<button class="btn btn-outline" onclick="hkClearAll()"><i class="fas fa-eraser"></i> Effacer</button>' : ''}
        </div>

        <div class="workflow-legend">
            <span class="legend-item"><span class="legend-dot pending"></span> En attente</span>
            <span class="legend-item"><span class="legend-dot completed"></span> Nettoyée (à contrôler)</span>
            <span class="legend-item"><span class="legend-dot controlled"></span> Contrôlée</span>
        </div>

        <div class="dispatch-floors">
            ${sortedFloors.map(floor => `
                <div class="floor-section">
                    <div class="floor-header">
                        <h4><i class="fas fa-layer-group"></i> Étage ${floor} <span class="floor-room-count">(${roomsByFloor[floor].length} chambres)</span></h4>
                        <div class="floor-actions">
                            <button class="btn-sm" onclick="hkSelectFloor('${floor}', 'blanc')" title="Tout à blanc">🧹</button>
                            <button class="btn-sm" onclick="hkSelectFloor('${floor}', 'recouche')" title="Tout recouche">🛏️</button>
                        </div>
                    </div>
                    <div class="rooms-dispatch-grid">
                        ${roomsByFloor[floor].sort((a,b) => {
                            // Tri naturel des numéros de chambre
                            const numA = parseInt(a.room_number) || 0;
                            const numB = parseInt(b.room_number) || 0;
                            if (numA !== numB) return numA - numB;
                            return String(a.room_number).localeCompare(String(b.room_number));
                        }).map(r => {
                            const d = r.dispatch;
                            const type = d ? d.cleaning_type : null;
                            const status = d ? d.status : 'none';
                            return `
                                <div class="dispatch-room dispatch-${status} ${type ? 'type-' + type : ''}" ${d ? `onclick="hkRoomActions(${d.id}, '${status}', '${r.room_number}')"` : ''}>
                                    <div class="room-num">${esc(r.room_number)}</div>
                                    ${!d ? `
                                        <div class="dispatch-buttons">
                                            <button class="dispatch-btn" onclick="event.stopPropagation(); hkSetRoom(${r.id}, 'blanc')" title="À blanc">🧹</button>
                                            <button class="dispatch-btn" onclick="event.stopPropagation(); hkSetRoom(${r.id}, 'recouche')" title="Recouche">🛏️</button>
                                        </div>
                                    ` : `
                                        <div class="dispatch-type">${type === 'blanc' ? '🧹' : '🛏️'}</div>
                                        <div class="dispatch-status-badge">
                                            ${status === 'pending' ? '⏳' : status === 'completed' ? '🧹✓' : '✅'}
                                        </div>
                                    `}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('')}
        </div>

        ${rooms.length === 0 ? '<div class="empty-state"><i class="fas fa-door-open"></i><h3>Aucune chambre configurée</h3><p>Ajoutez des chambres dans le module Hôtels</p></div>' : ''}
    `;
}

// Modal d'actions sur une chambre dispatchée
function hkRoomActions(dispatchId, status, roomNumber) {
    let actions = '';
    
    if (status === 'pending') {
        actions = `
            <button class="btn btn-success btn-block" onclick="hkMarkComplete(${dispatchId})">
                <i class="fas fa-check"></i> Marquer nettoyage terminé
            </button>
            <button class="btn btn-outline btn-block" onclick="hkClearRoom(${dispatchId}); closeModal();">
                <i class="fas fa-times"></i> Annuler le dispatch
            </button>
        `;
    } else if (status === 'completed') {
        actions = `
            <button class="btn btn-primary btn-block" onclick="closeModal(); hkControlModal(${dispatchId})">
                <i class="fas fa-clipboard-check"></i> Effectuer le contrôle
            </button>
        `;
    } else if (status === 'controlled') {
        actions = `
            <button class="btn btn-outline btn-block" onclick="closeModal(); hkControlModal(${dispatchId})">
                <i class="fas fa-eye"></i> Voir le contrôle
            </button>
        `;
    }
    
    openModal(`Chambre ${roomNumber}`, `
        <div class="room-action-status">
            <p><strong>Statut:</strong> ${status === 'pending' ? '⏳ En attente de nettoyage' : status === 'completed' ? '🧹 Nettoyée, à contrôler' : '✅ Contrôlée'}</p>
        </div>
        <div class="room-actions-buttons">
            ${actions}
        </div>
    `);
}

// Marquer une chambre comme nettoyée
async function hkMarkComplete(dispatchId) {
    try {
        await API.completeDispatch(dispatchId);
        toast('Chambre marquée comme nettoyée', 'success');
        closeModal();
        await hkLoadTab();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function hkSetRoom(roomId, type) {
    try {
        await API.createDispatch({ room_id: roomId, dispatch_date: hkDate, cleaning_type: type });
        await hkLoadTab();
    } catch (e) { toast(e.message, 'error'); }
}

async function hkClearRoom(dispatchId) {
    try {
        await API.deleteDispatch(dispatchId);
        await hkLoadTab();
    } catch (e) { toast(e.message, 'error'); }
}

async function hkSelectAll(type) {
    if (!confirm(`Assigner toutes les chambres en "${CLEANING_TYPES[type].label}" ?`)) return;
    try {
        const res = await API.getRooms(hkHotelId);
        for (const r of (res.rooms || []).filter(r => r.status === 'active')) {
            try { await API.createDispatch({ room_id: r.id, dispatch_date: hkDate, cleaning_type: type }); } catch(e) {}
        }
        toast('Chambres assignées', 'success');
        await hkLoadTab();
    } catch (e) { toast(e.message, 'error'); }
}

async function hkSelectFloor(floor, type) {
    try {
        const res = await API.getRooms(hkHotelId);
        for (const r of (res.rooms || []).filter(r => r.status === 'active' && r.floor == floor)) {
            try { await API.createDispatch({ room_id: r.id, dispatch_date: hkDate, cleaning_type: type }); } catch(e) {}
        }
        toast(`Étage ${floor} assigné`, 'success');
        await hkLoadTab();
    } catch (e) { toast(e.message, 'error'); }
}

async function hkClearAll() {
    if (!confirm('Effacer tout le dispatch du jour ?')) return;
    try {
        const res = await API.getDispatch({ hotel_id: hkHotelId, date: hkDate });
        for (const d of (res.dispatches || []).filter(d => d.status === 'pending')) {
            await API.deleteDispatch(d.id);
        }
        toast('Dispatch effacé', 'success');
        await hkLoadTab();
    } catch (e) { toast(e.message, 'error'); }
}

function hkBatchModal() {
    openModal('Dispatch en lot', `
        <form onsubmit="hkBatchSubmit(event)">
            <div class="form-group">
                <label>Type de ménage</label>
                <div class="cleaning-type-selector">
                    <label class="cleaning-option">
                        <input type="radio" name="cleaning_type" value="blanc" checked>
                        <span class="cleaning-option-content"><span class="cleaning-icon">🧹</span><span class="cleaning-label">À blanc</span></span>
                    </label>
                    <label class="cleaning-option">
                        <input type="radio" name="cleaning_type" value="recouche">
                        <span class="cleaning-option-content"><span class="cleaning-icon">🛏️</span><span class="cleaning-label">Recouche</span></span>
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label>Chambres</label>
                <div class="batch-rooms-list" id="batch-rooms"></div>
            </div>
            <div class="modal-footer">
                <span id="batch-count">0 sélectionnée(s)</span>
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Appliquer</button>
            </div>
        </form>
    `);
    hkLoadBatchRooms();
}

async function hkLoadBatchRooms() {
    const container = document.getElementById('batch-rooms');
    try {
        const [roomsRes, dispatchRes] = await Promise.all([
            API.getRooms(hkHotelId),
            API.getDispatch({ hotel_id: hkHotelId, date: hkDate })
        ]);
        const rooms = (roomsRes.rooms || []).filter(r => r.status === 'active');
        const dispIds = (dispatchRes.dispatches || []).map(d => parseInt(d.room_id));

        const byFloor = {};
        rooms.forEach(r => {
            const floor = r.floor !== null && r.floor !== undefined ? String(r.floor) : '0';
            if (!byFloor[floor]) byFloor[floor] = [];
            byFloor[floor].push(r);
        });

        // Trier les étages numériquement
        const sortedFloors = Object.keys(byFloor).sort((a, b) => {
            const numA = parseInt(a) || 0;
            const numB = parseInt(b) || 0;
            return numA - numB;
        });

        container.innerHTML = sortedFloors.map(floor => `
            <div class="batch-floor">
                <div class="batch-floor-header">
                    <label>
                        <input type="checkbox" onchange="hkToggleFloor(this, '${floor}')"> 
                        <strong>Étage ${floor}</strong>
                        <span class="floor-count">(${byFloor[floor].length} chambres)</span>
                    </label>
                </div>
                <div class="batch-floor-rooms" data-floor="${floor}">
                    ${byFloor[floor].sort((a,b) => {
                        const numA = parseInt(a.room_number) || 0;
                        const numB = parseInt(b.room_number) || 0;
                        if (numA !== numB) return numA - numB;
                        return String(a.room_number).localeCompare(String(b.room_number));
                    }).map(r => {
                        const done = dispIds.includes(parseInt(r.id));
                        return `<label class="batch-room-item ${done ? 'already-dispatched' : ''}"><input type="checkbox" name="rooms" value="${r.id}" ${done ? 'disabled' : ''} onchange="hkUpdateCount()"><span>${r.room_number}</span>${done ? '<span class="dispatched-badge">✓</span>' : ''}</label>`;
                    }).join('')}
                </div>
            </div>
        `).join('');
        
        if (rooms.length === 0) {
            container.innerHTML = '<p class="text-muted">Aucune chambre configurée pour cet hôtel.</p>';
        }
    } catch (e) { container.innerHTML = `<p class="text-danger">${e.message}</p>`; }
}

function hkToggleFloor(cb, floor) {
    document.querySelectorAll(`.batch-floor-rooms[data-floor="${floor}"] input[name="rooms"]:not(:disabled)`).forEach(c => c.checked = cb.checked);
    hkUpdateCount();
}

function hkUpdateCount() {
    document.getElementById('batch-count').textContent = document.querySelectorAll('input[name="rooms"]:checked').length + ' sélectionnée(s)';
}

async function hkBatchSubmit(e) {
    e.preventDefault();
    const type = new FormData(e.target).get('cleaning_type');
    const ids = [...document.querySelectorAll('input[name="rooms"]:checked')].map(c => +c.value);
    if (!ids.length) { toast('Sélectionnez des chambres', 'warning'); return; }
    
    try {
        for (const id of ids) {
            try { await API.createDispatch({ room_id: id, dispatch_date: hkDate, cleaning_type: type }); } catch(e) {}
        }
        toast(`${ids.length} chambre(s) assignée(s)`, 'success');
        closeModal();
        await hkLoadTab();
    } catch (e) { toast(e.message, 'error'); }
}

// ========== BATCH COMPLETE (Marquer plusieurs chambres nettoyées) ==========

async function hkBatchCompleteModal() {
    openModal('Marquer les chambres nettoyées', `
        <p class="text-muted mb-20">Sélectionnez les chambres à passer en "Nettoyées" pour le contrôle.</p>
        <div class="batch-rooms-list" id="batch-complete-rooms">
            <div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>
        </div>
        <div class="modal-footer">
            <span id="batch-complete-count">0 sélectionnée(s)</span>
            <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
            <button type="button" class="btn btn-success" onclick="hkBatchCompleteSubmit()">
                <i class="fas fa-check-double"></i> Marquer nettoyées
            </button>
        </div>
    `);
    await hkLoadBatchCompleteRooms();
}

async function hkLoadBatchCompleteRooms() {
    const container = document.getElementById('batch-complete-rooms');
    try {
        const res = await API.getDispatch({ hotel_id: hkHotelId, date: hkDate });
        const pending = (res.dispatches || []).filter(d => d.status === 'pending');
        
        if (pending.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>Aucune chambre en attente de nettoyage</p></div>';
            return;
        }

        // Grouper par étage
        const byFloor = {};
        pending.forEach(d => {
            const floor = d.floor !== null && d.floor !== undefined ? String(d.floor) : '0';
            if (!byFloor[floor]) byFloor[floor] = [];
            byFloor[floor].push(d);
        });

        const sortedFloors = Object.keys(byFloor).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

        container.innerHTML = `
            <div class="batch-select-all mb-15">
                <label>
                    <input type="checkbox" id="batch-complete-all" onchange="hkToggleAllComplete(this)">
                    <strong>Tout sélectionner</strong> (${pending.length} chambres)
                </label>
            </div>
            ${sortedFloors.map(floor => `
                <div class="batch-floor">
                    <div class="batch-floor-header">
                        <label>
                            <input type="checkbox" onchange="hkToggleFloorComplete(this, '${floor}')"> 
                            <strong>Étage ${floor}</strong>
                            <span class="floor-count">(${byFloor[floor].length} chambres)</span>
                        </label>
                    </div>
                    <div class="batch-floor-rooms" data-floor="${floor}">
                        ${byFloor[floor].sort((a,b) => {
                            const numA = parseInt(a.room_number) || 0;
                            const numB = parseInt(b.room_number) || 0;
                            return numA - numB;
                        }).map(d => `
                            <label class="batch-room">
                                <input type="checkbox" name="complete_dispatches" value="${d.id}" onchange="hkUpdateCompleteCount()">
                                <span class="room-badge">${d.room_number}</span>
                                <span class="room-type-mini">${d.cleaning_type === 'blanc' ? '🧹' : '🛏️'}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        `;
    } catch (e) {
        container.innerHTML = `<p class="text-danger">Erreur: ${e.message}</p>`;
    }
}

function hkToggleAllComplete(checkbox) {
    document.querySelectorAll('input[name="complete_dispatches"]').forEach(cb => {
        cb.checked = checkbox.checked;
    });
    // Cocher aussi tous les headers de floor
    document.querySelectorAll('#batch-complete-rooms .batch-floor-header input[type="checkbox"]').forEach(cb => {
        cb.checked = checkbox.checked;
    });
    hkUpdateCompleteCount();
}

function hkToggleFloorComplete(checkbox, floor) {
    const container = document.querySelector(`.batch-floor-rooms[data-floor="${floor}"]`);
    if (container) {
        container.querySelectorAll('input[name="complete_dispatches"]').forEach(cb => {
            cb.checked = checkbox.checked;
        });
    }
    hkUpdateCompleteCount();
}

function hkUpdateCompleteCount() {
    const count = document.querySelectorAll('input[name="complete_dispatches"]:checked').length;
    const el = document.getElementById('batch-complete-count');
    if (el) el.textContent = `${count} sélectionnée(s)`;
}

async function hkBatchCompleteSubmit() {
    const ids = [...document.querySelectorAll('input[name="complete_dispatches"]:checked')].map(c => +c.value);
    
    if (!ids.length) {
        toast('Sélectionnez au moins une chambre', 'warning');
        return;
    }
    
    if (!confirm(`Marquer ${ids.length} chambre(s) comme nettoyée(s) ?`)) return;
    
    try {
        let success = 0;
        let errors = 0;
        
        for (const id of ids) {
            try {
                await API.completeDispatch(id);
                success++;
            } catch(e) {
                errors++;
            }
        }
        
        if (success > 0) {
            toast(`${success} chambre(s) marquée(s) comme nettoyée(s)`, 'success');
        }
        if (errors > 0) {
            toast(`${errors} erreur(s) lors du traitement`, 'warning');
        }
        
        closeModal();
        await hkLoadTab();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ========== CONTROL ==========

async function hkLoadControl(container) {
    const res = await API.getDispatch({ hotel_id: hkHotelId, date: hkDate });
    const all = res.dispatches || [];
    const toControl = all.filter(d => d.status === 'completed');
    const controlled = all.filter(d => d.status === 'controlled');
    const pending = all.filter(d => d.status === 'pending');

    container.innerHTML = `
        <div class="control-stats">
            <div class="stat-item stat-warning"><span class="stat-number">${toControl.length}</span><span class="stat-label">À contrôler</span></div>
            <div class="stat-item stat-success"><span class="stat-number">${controlled.length}</span><span class="stat-label">Contrôlées</span></div>
            <div class="stat-item"><span class="stat-number">${pending.length}</span><span class="stat-label">En attente</span></div>
        </div>

        ${toControl.length ? `
            <div class="control-section">
                <div class="section-header">
                    <h4><i class="fas fa-clipboard-check"></i> À contrôler (${toControl.length})</h4>
                    <button class="btn btn-primary btn-sm" onclick="hkBatchControlModal()">
                        <i class="fas fa-check-double"></i> Contrôle multiple
                    </button>
                </div>
                <div class="control-grid">
                    ${toControl.map(d => `
                        <div class="control-card control-pending" onclick="hkControlModal(${d.id})">
                            <div class="control-room-num">${d.room_number}</div>
                            <span class="badge badge-${d.cleaning_type === 'blanc' ? 'primary' : 'success'}">${CLEANING_TYPES[d.cleaning_type]?.label || d.cleaning_type}</span>
                            <div class="control-action">Cliquer pour contrôler</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        ${controlled.length ? `
            <div class="control-section">
                <h4><i class="fas fa-check-circle"></i> Contrôlées (${controlled.length})</h4>
                <div class="control-grid">
                    ${controlled.map(d => `
                        <div class="control-card ${d.control_status === 'ok' ? 'control-ok' : 'control-not-ok'}" onclick="hkControlModal(${d.id})">
                            <div class="control-room-num">${d.room_number}</div>
                            <div>${d.control_status === 'ok' ? '✅ OK' : '❌ À reprendre'}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        ${!toControl.length && !controlled.length ? '<div class="empty-state"><i class="fas fa-clipboard-check"></i><h3>Rien à contrôler</h3></div>' : ''}
    `;
}

async function hkControlModal(id) {
    try {
        const res = await API.getDispatchDetail(id);
        const d = res.dispatch;
        
        const isControlled = d.status === 'controlled';
        const statusText = d.control_status === 'ok' ? '✅ Conforme' : '❌ Non conforme';
        
        // Parser les photos existantes (JSON array ou null)
        let existingPhotos = [];
        if (d.control_photos) {
            try {
                existingPhotos = JSON.parse(d.control_photos);
            } catch(e) {
                // Ancien format single photo
                if (d.control_photos) existingPhotos = [d.control_photos];
            }
        }
        const hasPhotos = existingPhotos.length > 0;

        openModal(`Contrôle chambre ${d.room_number}`, `
            ${isControlled ? `
                <div class="control-readonly-banner ${d.control_status === 'ok' ? 'banner-success' : 'banner-danger'}">
                    <i class="fas fa-lock"></i> Contrôle validé le ${d.controlled_at ? new Date(d.controlled_at).toLocaleDateString('fr-FR') : '-'} - ${statusText}
                </div>
            ` : ''}
            <form onsubmit="hkControlSubmit(event, ${d.id})" ${isControlled ? 'class="form-readonly"' : ''} id="control-form">
                <div class="control-header-info">
                    <p><strong>Type:</strong> ${CLEANING_TYPES[d.cleaning_type]?.label || d.cleaning_type}</p>
                    <p><strong>Nettoyé:</strong> ${d.completed_at ? new Date(d.completed_at).toLocaleString('fr-FR') : '-'}</p>
                    ${isControlled ? `<p><strong>Contrôlé par:</strong> ${d.controlled_by_name || 'N/A'}</p>` : ''}
                </div>
                <h4>Grille de contrôle</h4>
                <div class="control-grid-form">
                    ${CONTROL_CRITERIA.map(c => `
                        <div class="control-criterion">
                            <span class="criterion-label">${c.icon} ${c.label}</span>
                            <div class="criterion-buttons">
                                <label class="criterion-btn ok"><input type="radio" name="${c.key}" value="1" ${d[c.key] === 1 ? 'checked' : ''} ${isControlled ? 'disabled' : 'required'} onchange="hkCheckControlStatus()"><span>✓ OK</span></label>
                                <label class="criterion-btn not-ok"><input type="radio" name="${c.key}" value="0" ${d[c.key] === 0 ? 'checked' : ''} ${isControlled ? 'disabled' : ''} onchange="hkCheckControlStatus()"><span>✕ NOK</span></label>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="form-group mt-20">
                    <label>Notes</label>
                    <textarea name="control_notes" rows="3" ${isControlled ? 'disabled' : ''}>${d.control_notes || ''}</textarea>
                </div>
                
                <!-- Section Photos multiples -->
                <div class="control-photo-section" id="photo-section" style="display: ${(d.control_status === 'not_ok' || hasPhotos) ? 'block' : 'none'}">
                    <h4><i class="fas fa-camera"></i> Photos des anomalies <span class="photo-count" id="photo-count">(${existingPhotos.length})</span></h4>
                    
                    <!-- Photos existantes -->
                    <div class="photos-gallery" id="existing-photos">
                        ${existingPhotos.map((photo, idx) => `
                            <div class="photo-thumb" data-photo="${photo}">
                                <img src="uploads/control/${photo}" alt="Photo ${idx + 1}" onclick="hkViewPhoto('uploads/control/${photo}')">
                                ${!isControlled ? `<button type="button" class="photo-remove-btn" onclick="hkRemoveExistingPhoto(this, '${photo}')"><i class="fas fa-times"></i></button>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- Nouvelles photos (preview) -->
                    <div class="photos-gallery" id="new-photos-preview"></div>
                    
                    ${!isControlled ? `
                        <!-- Zone d'ajout de photos -->
                        <div class="photo-add-zone" id="photo-add-zone">
                            <label class="photo-add-btn">
                                <input type="file" accept="image/*" capture="environment" onchange="hkAddPhoto(this)" style="display:none">
                                <i class="fas fa-camera"></i>
                                <span>Prendre</span>
                            </label>
                            <label class="photo-add-btn">
                                <input type="file" accept="image/*" multiple onchange="hkAddPhotos(this)" style="display:none">
                                <i class="fas fa-images"></i>
                                <span>Galerie</span>
                            </label>
                        </div>
                        <p class="photo-hint"><i class="fas fa-info-circle"></i> Vous pouvez ajouter plusieurs photos</p>
                    ` : ''}
                </div>
                
                <!-- Hidden fields pour tracker les photos -->
                <input type="hidden" name="photos_to_remove" id="photos-to-remove" value="[]">
                
                <div class="modal-footer">
                    ${isControlled ? `
                        <button type="button" class="btn btn-outline" onclick="closeModal()">Fermer</button>
                    ` : `
                        <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                        <button type="submit" class="btn btn-primary">Valider</button>
                    `}
                </div>
            </form>
        `);
        
        // Initialiser le tableau des nouvelles photos
        window.hkNewPhotos = [];
        window.hkPhotosToRemove = [];
        
    } catch (e) { toast(e.message, 'error'); }
}

// Vérifie si au moins un critère est NOK pour afficher la section photo
function hkCheckControlStatus() {
    const form = document.getElementById('control-form');
    if (!form) return;
    
    let hasNok = false;
    CONTROL_CRITERIA.forEach(c => {
        const val = form.querySelector(`input[name="${c.key}"]:checked`);
        if (val && val.value === '0') hasNok = true;
    });
    
    const photoSection = document.getElementById('photo-section');
    if (photoSection) {
        photoSection.style.display = hasNok ? 'block' : 'none';
    }
}

// Ajouter une photo (caméra)
function hkAddPhoto(input) {
    if (input.files && input.files[0]) {
        hkProcessNewPhoto(input.files[0]);
        input.value = ''; // Reset pour permettre de reprendre la même photo
    }
}

// Ajouter plusieurs photos (galerie)
function hkAddPhotos(input) {
    if (input.files && input.files.length > 0) {
        Array.from(input.files).forEach(file => {
            hkProcessNewPhoto(file);
        });
        input.value = ''; // Reset
    }
}

// Traiter une nouvelle photo
function hkProcessNewPhoto(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const photoId = 'new_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Ajouter au tableau
        window.hkNewPhotos.push({
            id: photoId,
            file: file,
            dataUrl: e.target.result
        });
        
        // Ajouter la preview
        const previewContainer = document.getElementById('new-photos-preview');
        const thumb = document.createElement('div');
        thumb.className = 'photo-thumb new-photo';
        thumb.dataset.photoId = photoId;
        thumb.innerHTML = `
            <img src="${e.target.result}" alt="Nouvelle photo" onclick="hkViewPhotoData('${photoId}')">
            <button type="button" class="photo-remove-btn" onclick="hkRemoveNewPhoto('${photoId}')"><i class="fas fa-times"></i></button>
        `;
        previewContainer.appendChild(thumb);
        
        hkUpdatePhotoCount();
    };
    reader.readAsDataURL(file);
}

// Supprimer une nouvelle photo (pas encore uploadée)
function hkRemoveNewPhoto(photoId) {
    window.hkNewPhotos = window.hkNewPhotos.filter(p => p.id !== photoId);
    const thumb = document.querySelector(`.photo-thumb[data-photo-id="${photoId}"]`);
    if (thumb) thumb.remove();
    hkUpdatePhotoCount();
}

// Supprimer une photo existante
function hkRemoveExistingPhoto(btn, photoName) {
    window.hkPhotosToRemove.push(photoName);
    document.getElementById('photos-to-remove').value = JSON.stringify(window.hkPhotosToRemove);
    
    const thumb = btn.closest('.photo-thumb');
    if (thumb) {
        thumb.classList.add('photo-removing');
        setTimeout(() => thumb.remove(), 300);
    }
    hkUpdatePhotoCount();
    toast('Photo marquée pour suppression', 'info');
}

// Mettre à jour le compteur de photos
function hkUpdatePhotoCount() {
    const existingCount = document.querySelectorAll('#existing-photos .photo-thumb:not(.photo-removing)').length;
    const newCount = window.hkNewPhotos ? window.hkNewPhotos.length : 0;
    const total = existingCount + newCount;
    
    const countEl = document.getElementById('photo-count');
    if (countEl) {
        countEl.textContent = `(${total})`;
    }
}

// Voir une photo existante
function hkViewPhoto(src) {
    openModal('Photo du contrôle', `
        <div class="photo-fullview">
            <img src="${src}" alt="Photo contrôle">
        </div>
        <div class="modal-footer">
            <a href="${src}" download class="btn btn-outline"><i class="fas fa-download"></i> Télécharger</a>
            <button type="button" class="btn btn-primary" onclick="closeModal()">Fermer</button>
        </div>
    `);
}

// Voir une nouvelle photo (data URL)
function hkViewPhotoData(photoId) {
    const photo = window.hkNewPhotos.find(p => p.id === photoId);
    if (photo) {
        openModal('Aperçu photo', `
            <div class="photo-fullview">
                <img src="${photo.dataUrl}" alt="Aperçu">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="closeModal()">Fermer</button>
            </div>
        `);
    }
}

async function hkControlSubmit(e, id) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    
    // Vérifier les critères
    let allOk = true;
    CONTROL_CRITERIA.forEach(c => {
        if (fd.get(c.key) !== '1') allOk = false;
    });
    
    // Préparer les données
    const data = new FormData();
    data.append('control_notes', fd.get('control_notes') || '');
    data.append('control_status', allOk ? 'ok' : 'not_ok');
    
    // Photos à supprimer
    data.append('photos_to_remove', fd.get('photos_to_remove') || '[]');
    
    CONTROL_CRITERIA.forEach(c => {
        data.append(c.key, fd.get(c.key) === '1' ? '1' : '0');
    });
    
    // Ajouter les nouvelles photos
    if (window.hkNewPhotos && window.hkNewPhotos.length > 0) {
        window.hkNewPhotos.forEach((photo, idx) => {
            data.append('control_photos[]', photo.file);
        });
    }

    try {
        await API.controlDispatchWithPhoto(id, data);
        toast('Contrôle enregistré', 'success');
        closeModal();
        await hkLoadTab();
    } catch (e) { toast(e.message, 'error'); }
}

// ========== BATCH CONTROL ==========

async function hkBatchControlModal() {
    const res = await API.getDispatch({ hotel_id: hkHotelId, date: hkDate });
    const toControl = (res.dispatches || []).filter(d => d.status === 'completed');
    
    if (toControl.length === 0) {
        toast('Aucune chambre à contrôler', 'info');
        return;
    }
    
    // Grouper par étage
    const byFloor = {};
    toControl.forEach(d => {
        const floor = d.floor || '0';
        if (!byFloor[floor]) byFloor[floor] = [];
        byFloor[floor].push(d);
    });
    
    openModal('Contrôle multiple', `
        <form onsubmit="hkBatchControlSubmit(event)">
            <div class="batch-control-info">
                <p><i class="fas fa-info-circle"></i> Sélectionnez les chambres à valider comme <strong>conformes</strong> (tous les critères OK).</p>
                <p class="text-muted">Pour les chambres non conformes, utilisez le contrôle individuel.</p>
            </div>
            
            <div class="batch-rooms-list" id="batch-control-rooms">
                ${Object.keys(byFloor).sort((a,b) => a - b).map(floor => `
                    <div class="batch-floor">
                        <div class="batch-floor-header">
                            <label>
                                <input type="checkbox" onchange="hkToggleControlFloor(this, '${floor}')"> 
                                <strong>Étage ${floor}</strong>
                                <span class="floor-count">(${byFloor[floor].length} chambre${byFloor[floor].length > 1 ? 's' : ''})</span>
                            </label>
                        </div>
                        <div class="batch-floor-rooms" data-floor="${floor}">
                            ${byFloor[floor].sort((a,b) => a.room_number.localeCompare(b.room_number)).map(d => `
                                <label class="batch-room-item">
                                    <input type="checkbox" name="dispatches" value="${d.id}" onchange="hkUpdateControlCount()">
                                    <span>${d.room_number}</span>
                                    <span class="room-type-badge ${d.cleaning_type}">${d.cleaning_type === 'blanc' ? '🧹' : '🛏️'}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="batch-control-actions">
                <button type="button" class="btn btn-outline btn-sm" onclick="hkSelectAllControl(true)">
                    <i class="fas fa-check-double"></i> Tout sélectionner
                </button>
                <button type="button" class="btn btn-outline btn-sm" onclick="hkSelectAllControl(false)">
                    <i class="fas fa-times"></i> Tout désélectionner
                </button>
            </div>
            
            <div class="modal-footer">
                <span id="batch-control-count" class="selected-count">0 sélectionnée(s)</span>
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-success">
                    <i class="fas fa-check"></i> Valider OK
                </button>
            </div>
        </form>
    `);
}

function hkToggleControlFloor(cb, floor) {
    document.querySelectorAll(`.batch-floor-rooms[data-floor="${floor}"] input[name="dispatches"]`).forEach(c => c.checked = cb.checked);
    hkUpdateControlCount();
}

function hkSelectAllControl(select) {
    document.querySelectorAll('input[name="dispatches"]').forEach(c => c.checked = select);
    document.querySelectorAll('.batch-floor-header input[type="checkbox"]').forEach(c => c.checked = select);
    hkUpdateControlCount();
}

function hkUpdateControlCount() {
    const count = document.querySelectorAll('input[name="dispatches"]:checked').length;
    document.getElementById('batch-control-count').textContent = count + ' sélectionnée(s)';
}

async function hkBatchControlSubmit(e) {
    e.preventDefault();
    
    const ids = [...document.querySelectorAll('input[name="dispatches"]:checked')].map(c => parseInt(c.value));
    
    if (ids.length === 0) {
        toast('Sélectionnez au moins une chambre', 'warning');
        return;
    }
    
    if (!confirm(`Valider ${ids.length} chambre(s) comme conformes (tous critères OK) ?`)) {
        return;
    }
    
    // Données pour un contrôle "tout OK"
    const data = {
        ctrl_literie: 1,
        ctrl_salle_bain: 1,
        ctrl_sol_surfaces: 1,
        ctrl_equipements: 1,
        ctrl_ambiance: 1,
        ctrl_proprete: 1,
        control_status: 'ok',
        control_notes: 'Contrôle validé en lot'
    };
    
    let success = 0;
    let errors = 0;
    
    // Afficher un loader
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validation...';
    submitBtn.disabled = true;
    
    for (const id of ids) {
        try {
            await API.controlDispatch(id, data);
            success++;
        } catch (err) {
            errors++;
            console.error(`Erreur contrôle dispatch ${id}:`, err);
        }
    }
    
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    
    if (errors > 0) {
        toast(`${success} validée(s), ${errors} erreur(s)`, 'warning');
    } else {
        toast(`${success} chambre(s) validée(s) OK`, 'success');
    }
    
    closeModal();
    await hkLoadTab();
}

// ========== REPORTS ==========

async function hkLoadReports(container) {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.substring(0, 8) + '01';
    
    const currentHotel = hkHotels.find(h => parseInt(h.id) === hkHotelId);
    const hotelName = currentHotel ? currentHotel.name : 'Hôtel';

    container.innerHTML = `
        <div class="reports-section">
            <div class="reports-grid">
                <!-- Rapport 1: Chambres mal nettoyées -->
                <div class="report-card" onclick="hkShowReportForm('anomalies')">
                    <div class="report-icon report-icon-red"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="report-info">
                        <h4>Chambres non conformes</h4>
                        <p>Liste des contrôles avec anomalies sur une période.</p>
                    </div>
                    <i class="fas fa-chevron-right report-arrow"></i>
                </div>
                
                <!-- Rapport 2: Activité complète -->
                <div class="report-card" onclick="hkShowReportForm('activity')">
                    <div class="report-icon report-icon-blue"><i class="fas fa-clipboard-list"></i></div>
                    <div class="report-info">
                        <h4>Rapport d'activité complet</h4>
                        <p>Dispatch, nettoyage, contrôle jour par jour avec les intervenants.</p>
                    </div>
                    <i class="fas fa-chevron-right report-arrow"></i>
                </div>
            </div>
            
            <!-- Formulaire de rapport (caché par défaut) -->
            <div id="report-form-container" style="display:none;"></div>
        </div>
    `;
}

function hkShowReportForm(type) {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.substring(0, 8) + '01';
    
    const titles = {
        anomalies: 'Rapport des chambres non conformes',
        activity: 'Rapport d\'activité complet'
    };
    
    const descriptions = {
        anomalies: 'Extraction des contrôles avec statut "Non conforme" sur la période sélectionnée.',
        activity: 'Historique complet : qui a dispatché, nettoyé et contrôlé chaque chambre, jour par jour.'
    };
    
    const container = document.getElementById('report-form-container');
    container.style.display = 'block';
    container.innerHTML = `
        <div class="report-form-card">
            <div class="report-form-header">
                <h4><i class="fas fa-file-pdf"></i> ${titles[type]}</h4>
                <button class="btn-close" onclick="document.getElementById('report-form-container').style.display='none'">&times;</button>
            </div>
            <p class="report-description">${descriptions[type]}</p>
            
            <form id="report-form" onsubmit="hkGenerateReport(event, '${type}')">
                <div class="form-row">
                    <div class="form-group">
                        <label><i class="fas fa-calendar"></i> Date de début</label>
                        <input type="date" name="start_date" value="${firstOfMonth}" required>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-calendar"></i> Date de fin</label>
                        <input type="date" name="end_date" value="${today}" required>
                    </div>
                </div>
                
                <div class="report-preview" id="report-preview" style="display:none;">
                    <h4><i class="fas fa-eye"></i> Aperçu</h4>
                    <div id="report-preview-content"></div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" onclick="hkPreviewReport('${type}')">
                        <i class="fas fa-eye"></i> Aperçu
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-file-pdf"></i> Générer PDF
                    </button>
                </div>
            </form>
        </div>
    `;
    
    // Scroll vers le formulaire
    container.scrollIntoView({ behavior: 'smooth' });
}

async function hkPreviewReport(type) {
    const form = document.getElementById('report-form');
    const startDate = form.querySelector('[name="start_date"]').value;
    const endDate = form.querySelector('[name="end_date"]').value;
    
    if (!startDate || !endDate) {
        toast('Veuillez sélectionner les dates', 'warning');
        return;
    }
    
    const previewDiv = document.getElementById('report-preview');
    const contentDiv = document.getElementById('report-preview-content');
    
    contentDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';
    previewDiv.style.display = 'block';
    
    try {
        if (type === 'anomalies') {
            await hkPreviewAnomalies(contentDiv, startDate, endDate);
        } else {
            await hkPreviewActivity(contentDiv, startDate, endDate);
        }
    } catch (e) {
        contentDiv.innerHTML = `<p class="text-danger">Erreur: ${e.message}</p>`;
    }
}

async function hkPreviewAnomalies(contentDiv, startDate, endDate) {
    const res = await API.get(`dispatch/report?hotel_id=${hkHotelId}&start_date=${startDate}&end_date=${endDate}`);
    const data = res.data || [];
    
    if (data.length === 0) {
        contentDiv.innerHTML = '<p class="text-success"><i class="fas fa-check-circle"></i> Aucune chambre non conforme sur cette période.</p>';
        return;
    }
    
    // Compter les photos
    let totalPhotos = 0;
    data.forEach(d => {
        const photos = hkParsePhotos(d.control_photos);
        totalPhotos += photos.length;
    });
    
    contentDiv.innerHTML = `
        <p><strong>${data.length}</strong> chambre(s) non conforme(s) trouvée(s) ${totalPhotos > 0 ? `<span class="text-muted">(${totalPhotos} photo${totalPhotos > 1 ? 's' : ''})</span>` : ''}</p>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Chambre</th>
                    <th>Type</th>
                    <th>Problèmes</th>
                    <th>Photos</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                ${data.slice(0, 10).map(d => {
                    const photos = hkParsePhotos(d.control_photos);
                    return `
                    <tr>
                        <td>${formatDate(d.dispatch_date)}</td>
                        <td><strong>${d.room_number}</strong></td>
                        <td>${d.cleaning_type === 'blanc' ? '🧹 À blanc' : '🛏️ Recouche'}</td>
                        <td class="text-danger">${hkGetProblems(d)}</td>
                        <td>${photos.length > 0 ? `<i class="fas fa-camera text-primary"></i> ${photos.length}` : '-'}</td>
                        <td>${d.control_notes || '-'}</td>
                    </tr>
                `}).join('')}
                ${data.length > 10 ? `<tr><td colspan="6" class="text-muted">... et ${data.length - 10} autre(s)</td></tr>` : ''}
            </tbody>
        </table>
    `;
}

// Helper pour parser les photos (JSON array ou null)
function hkParsePhotos(photosField) {
    if (!photosField) return [];
    try {
        const parsed = JSON.parse(photosField);
        return Array.isArray(parsed) ? parsed : [];
    } catch(e) {
        return [];
    }
}

async function hkPreviewActivity(contentDiv, startDate, endDate) {
    const res = await API.get(`dispatch/activity?hotel_id=${hkHotelId}&start_date=${startDate}&end_date=${endDate}`);
    const data = res.data || [];
    
    if (data.length === 0) {
        contentDiv.innerHTML = '<p class="text-muted"><i class="fas fa-info-circle"></i> Aucune activité sur cette période.</p>';
        return;
    }
    
    // Grouper par date
    const byDate = {};
    data.forEach(d => {
        if (!byDate[d.dispatch_date]) byDate[d.dispatch_date] = [];
        byDate[d.dispatch_date].push(d);
    });
    
    const dates = Object.keys(byDate).sort().reverse();
    const previewDates = dates.slice(0, 3);
    
    contentDiv.innerHTML = `
        <p><strong>${data.length}</strong> dispatch(s) sur <strong>${dates.length}</strong> jour(s)</p>
        ${previewDates.map(date => `
            <div class="activity-day-preview">
                <h5>📅 ${formatDate(date)}</h5>
                <table class="report-table report-table-sm">
                    <thead>
                        <tr>
                            <th>Chambre</th>
                            <th>Dispatché par</th>
                            <th>Nettoyé par</th>
                            <th>Contrôlé par</th>
                            <th>Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${byDate[date].slice(0, 5).map(d => `
                            <tr>
                                <td><strong>${d.room_number}</strong></td>
                                <td>${d.created_by_name || '-'}</td>
                                <td>${d.completed_by_name || '-'}</td>
                                <td>${d.controlled_by_name || '-'}</td>
                                <td>${hkGetStatusBadge(d)}</td>
                            </tr>
                        `).join('')}
                        ${byDate[date].length > 5 ? `<tr><td colspan="5" class="text-muted">... et ${byDate[date].length - 5} autre(s)</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `).join('')}
        ${dates.length > 3 ? `<p class="text-muted">... et ${dates.length - 3} autre(s) jour(s)</p>` : ''}
    `;
}

function hkGetStatusBadge(d) {
    if (d.status === 'controlled') {
        return d.control_status === 'ok' 
            ? '<span class="badge badge-success">✅ OK</span>' 
            : '<span class="badge badge-danger">❌ NOK</span>';
    } else if (d.status === 'completed') {
        return '<span class="badge badge-warning">🧹 À contrôler</span>';
    } else {
        return '<span class="badge badge-secondary">⏳ En cours</span>';
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function hkGetProblems(dispatch) {
    const problems = [];
    if (dispatch.ctrl_literie === 0) problems.push('Literie');
    if (dispatch.ctrl_salle_bain === 0) problems.push('Salle de bain');
    if (dispatch.ctrl_sol_surfaces === 0) problems.push('Sol/Surfaces');
    if (dispatch.ctrl_equipements === 0) problems.push('Équipements');
    if (dispatch.ctrl_ambiance === 0) problems.push('Ambiance');
    if (dispatch.ctrl_proprete === 0) problems.push('Propreté');
    return problems.length ? problems.join(', ') : '-';
}

async function hkGenerateReport(e, type) {
    e.preventDefault();
    
    const form = e.target;
    const startDate = form.querySelector('[name="start_date"]').value;
    const endDate = form.querySelector('[name="end_date"]').value;
    
    if (!startDate || !endDate) {
        toast('Veuillez sélectionner les dates', 'warning');
        return;
    }
    
    const currentHotel = hkHotels.find(h => parseInt(h.id) === hkHotelId);
    const hotelName = currentHotel ? currentHotel.name : 'Hôtel';
    
    try {
        if (type === 'anomalies') {
            const res = await API.get(`dispatch/report?hotel_id=${hkHotelId}&start_date=${startDate}&end_date=${endDate}`);
            const data = res.data || [];
            
            if (data.length === 0) {
                toast('Aucune chambre non conforme sur cette période', 'info');
                return;
            }
            
            hkCreateAnomaliesPDF(data, hotelName, startDate, endDate);
        } else {
            const res = await API.get(`dispatch/activity?hotel_id=${hkHotelId}&start_date=${startDate}&end_date=${endDate}`);
            const data = res.data || [];
            
            if (data.length === 0) {
                toast('Aucune activité sur cette période', 'info');
                return;
            }
            
            hkCreateActivityPDF(data, hotelName, startDate, endDate);
        }
    } catch (e) {
        toast('Erreur: ' + e.message, 'error');
    }
}

function hkCreateAnomaliesPDF(data, hotelName, startDate, endDate) {
    const printWindow = window.open('', '_blank');
    
    const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR');
    
    // Compter le total des photos
    let totalPhotos = 0;
    data.forEach(d => {
        const photos = hkParsePhotos(d.control_photos);
        totalPhotos += photos.length;
    });
    
    // Obtenir l'URL de base pour les images
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Rapport Chambres Non Conformes - ${hotelName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1E3A5F; }
        .header h1 { color: #1E3A5F; font-size: 22px; margin-bottom: 5px; }
        .header h2 { color: #666; font-size: 16px; font-weight: normal; margin-bottom: 10px; }
        .header .dates { background: #f5f5f5; padding: 10px 20px; border-radius: 5px; display: inline-block; }
        .header .dates span { font-weight: bold; color: #1E3A5F; }
        .summary { background: #FEF3C7; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .summary strong { color: #92400E; }
        .anomaly-card { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; }
        .anomaly-header { background: #1E3A5F; color: white; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; }
        .anomaly-header .room { font-size: 16px; font-weight: bold; }
        .anomaly-header .date { font-size: 12px; opacity: 0.9; }
        .anomaly-body { padding: 15px; }
        .anomaly-info { margin-bottom: 15px; }
        .anomaly-info p { margin-bottom: 8px; }
        .anomaly-info .label { color: #666; font-size: 11px; }
        .anomaly-info .value { font-weight: 500; }
        .anomaly-info .problems { color: #C94A4A; font-weight: 600; }
        .anomaly-photos { display: flex; flex-wrap: wrap; gap: 10px; }
        .anomaly-photos img { width: 150px; height: 120px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd; }
        .no-photo { padding: 20px; background: #f5f5f5; border-radius: 5px; text-align: center; color: #999; font-size: 11px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; }
        @media print { 
            body { padding: 10px; } 
            .anomaly-card { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏨 ${hotelName}</h1>
        <h2>Rapport des chambres non conformes</h2>
        <div class="dates">
            Période: <span>${fmtDate(startDate)}</span> au <span>${fmtDate(endDate)}</span>
        </div>
    </div>
    
    <div class="summary">
        <strong>${data.length}</strong> chambre(s) non conforme(s) sur cette période
        ${totalPhotos > 0 ? ` • <strong>${totalPhotos}</strong> photo${totalPhotos > 1 ? 's' : ''} jointe${totalPhotos > 1 ? 's' : ''}` : ''}
    </div>
    
    ${data.map(d => {
        const photos = hkParsePhotos(d.control_photos);
        return `
        <div class="anomaly-card">
            <div class="anomaly-header">
                <span class="room">Chambre ${d.room_number} ${d.floor ? `(Étage ${d.floor})` : ''}</span>
                <span class="date">${fmtDate(d.dispatch_date)} • ${d.cleaning_type === 'blanc' ? 'À blanc' : 'Recouche'}</span>
            </div>
            <div class="anomaly-body">
                <div class="anomaly-info">
                    <p>
                        <span class="label">Problèmes identifiés:</span><br>
                        <span class="value problems">${hkGetProblems(d)}</span>
                    </p>
                    ${d.control_notes ? `
                        <p>
                            <span class="label">Notes du contrôle:</span><br>
                            <span class="value">${d.control_notes}</span>
                        </p>
                    ` : ''}
                    ${d.controlled_by_name ? `
                        <p>
                            <span class="label">Contrôlé par:</span>
                            <span class="value">${d.controlled_by_name}</span>
                        </p>
                    ` : ''}
                </div>
                ${photos.length > 0 ? `
                    <div class="anomaly-photos">
                        ${photos.map(photo => `<img src="${baseUrl}uploads/control/${photo}" alt="Photo anomalie">`).join('')}
                    </div>
                ` : '<div class="no-photo">Pas de photo</div>'}
            </div>
        </div>
    `}).join('')}
    
    <div class="footer">
        <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        <p>ACL GESTION - Module Gouvernante</p>
    </div>
    
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

function hkCreateActivityPDF(data, hotelName, startDate, endDate) {
    const printWindow = window.open('', '_blank');
    
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '-';
    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : '';
    const fmtDateTime = (d) => d ? fmtDate(d) + ' ' + fmtTime(d) : '-';
    
    // Grouper par date
    const byDate = {};
    data.forEach(d => {
        if (!byDate[d.dispatch_date]) byDate[d.dispatch_date] = [];
        byDate[d.dispatch_date].push(d);
    });
    
    const sortedDates = Object.keys(byDate).sort();
    
    // Calculer les stats
    const stats = {
        totalDispatches: data.length,
        completed: data.filter(d => d.status === 'completed' || d.status === 'controlled').length,
        controlled: data.filter(d => d.status === 'controlled').length,
        ok: data.filter(d => d.control_status === 'ok').length,
        notOk: data.filter(d => d.control_status === 'not_ok').length
    };
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Rapport d'activité - ${hotelName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 11px; }
        .header { text-align: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #1E3A5F; }
        .header h1 { color: #1E3A5F; font-size: 22px; margin-bottom: 5px; }
        .header h2 { color: #666; font-size: 16px; font-weight: normal; margin-bottom: 10px; }
        .header .dates { background: #f5f5f5; padding: 10px 20px; border-radius: 5px; display: inline-block; }
        .header .dates span { font-weight: bold; color: #1E3A5F; }
        .stats { display: flex; justify-content: center; gap: 15px; margin-bottom: 25px; flex-wrap: wrap; }
        .stat-box { background: #f5f5f5; padding: 12px 20px; border-radius: 5px; text-align: center; min-width: 100px; }
        .stat-box .num { font-size: 20px; font-weight: bold; color: #1E3A5F; }
        .stat-box .label { font-size: 10px; color: #666; }
        .stat-box.success { background: #D1FAE5; }
        .stat-box.success .num { color: #059669; }
        .stat-box.danger { background: #FEE2E2; }
        .stat-box.danger .num { color: #DC2626; }
        .day-section { margin-bottom: 25px; page-break-inside: avoid; }
        .day-header { background: #1E3A5F; color: white; padding: 10px 15px; font-size: 14px; font-weight: bold; margin-bottom: 0; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #E5E7EB; padding: 8px 6px; text-align: left; font-size: 10px; font-weight: 600; }
        td { padding: 6px; border-bottom: 1px solid #E5E7EB; font-size: 10px; vertical-align: top; }
        tr:nth-child(even) { background: #F9FAFB; }
        .room-num { font-weight: bold; color: #1E3A5F; }
        .status-ok { color: #059669; font-weight: bold; }
        .status-nok { color: #DC2626; font-weight: bold; }
        .status-pending { color: #D97706; }
        .time { color: #6B7280; font-size: 9px; }
        .notes { font-style: italic; color: #6B7280; max-width: 150px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; }
        @media print { 
            body { padding: 10px; } 
            .day-section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏨 ${hotelName}</h1>
        <h2>Rapport d'activité - Gouvernante</h2>
        <div class="dates">
            Période: <span>${fmtDate(startDate)}</span> au <span>${fmtDate(endDate)}</span>
        </div>
    </div>
    
    <div class="stats">
        <div class="stat-box">
            <div class="num">${stats.totalDispatches}</div>
            <div class="label">Dispatches</div>
        </div>
        <div class="stat-box">
            <div class="num">${stats.completed}</div>
            <div class="label">Nettoyées</div>
        </div>
        <div class="stat-box">
            <div class="num">${stats.controlled}</div>
            <div class="label">Contrôlées</div>
        </div>
        <div class="stat-box success">
            <div class="num">${stats.ok}</div>
            <div class="label">Conformes</div>
        </div>
        <div class="stat-box danger">
            <div class="num">${stats.notOk}</div>
            <div class="label">Non conformes</div>
        </div>
    </div>
    
    ${sortedDates.map(date => `
        <div class="day-section">
            <div class="day-header">📅 ${new Date(date).toLocaleDateString('fr-FR', {weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'})}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:8%">Chambre</th>
                        <th style="width:8%">Type</th>
                        <th style="width:18%">Dispatché</th>
                        <th style="width:18%">Nettoyé</th>
                        <th style="width:18%">Contrôlé</th>
                        <th style="width:10%">Résultat</th>
                        <th style="width:20%">Remarques</th>
                    </tr>
                </thead>
                <tbody>
                    ${byDate[date].sort((a,b) => {
                        const numA = parseInt(a.room_number) || 0;
                        const numB = parseInt(b.room_number) || 0;
                        return numA - numB;
                    }).map(d => `
                        <tr>
                            <td class="room-num">${d.room_number}</td>
                            <td>${d.cleaning_type === 'blanc' ? '🧹 Blanc' : '🛏️ Rec.'}</td>
                            <td>
                                ${d.created_by_name || '-'}
                                ${d.created_at ? `<div class="time">${fmtTime(d.created_at)}</div>` : ''}
                            </td>
                            <td>
                                ${d.completed_by_name || '-'}
                                ${d.completed_at ? `<div class="time">${fmtTime(d.completed_at)}</div>` : ''}
                            </td>
                            <td>
                                ${d.controlled_by_name || '-'}
                                ${d.controlled_at ? `<div class="time">${fmtTime(d.controlled_at)}</div>` : ''}
                            </td>
                            <td>
                                ${d.status === 'controlled' 
                                    ? (d.control_status === 'ok' ? '<span class="status-ok">✅ OK</span>' : '<span class="status-nok">❌ NOK</span>')
                                    : d.status === 'completed' 
                                        ? '<span class="status-pending">⏳</span>'
                                        : '-'}
                            </td>
                            <td class="notes">${d.control_notes || (d.control_status === 'not_ok' ? hkGetProblems(d) : '-')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('')}
    
    <div class="footer">
        <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        <p>ACL GESTION - Module Gouvernante</p>
    </div>
    
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

// ========== ALERTS ==========

async function hkLoadAlerts(container) {
    try {
        const res = await API.getDispatchAlerts(hkHotelId);
        const alerts = res.alerts || [];

        container.innerHTML = `
            <div class="alerts-info">
                <h4><i class="fas fa-bell"></i> Alertes automatiques</h4>
                <div class="alert-rules">
                    <div class="alert-rule"><span class="rule-time">12h00</span><span>Dispatch incomplet</span></div>
                    <div class="alert-rule"><span class="rule-time">19h00</span><span>Contrôle incomplet</span></div>
                </div>
                <div class="alert-escalation">
                    <p><strong>Escalade :</strong></p>
                    <ul>
                        <li>1ère fois → Resp. Hôtel</li>
                        <li>2ème consécutive → + Resp. Groupe</li>
                        <li>5ème consécutive → + Admin</li>
                    </ul>
                </div>
            </div>

            ${alerts.length ? `
                <h4>Historique</h4>
                <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Jours</th><th>Notifiés</th></tr></thead>
                    <tbody>
                        ${alerts.map(a => `
                            <tr>
                                <td>${a.alert_date}</td>
                                <td><span class="badge badge-warning">${a.alert_type === 'dispatch_incomplet' ? 'Dispatch' : 'Contrôle'}</span></td>
                                <td>${a.consecutive_count}</td>
                                <td>${a.notified_hotel_manager ? '👤 ' : ''}${a.notified_groupe_manager ? '👥 ' : ''}${a.notified_admin ? '👑' : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>Aucune alerte</h3></div>'}
        `;
    } catch (e) { container.innerHTML = `<p class="text-danger">${e.message}</p>`; }
}
