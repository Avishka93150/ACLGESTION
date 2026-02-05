/**
 * Users Page - avec gestion des affectations hôtels et filtre dynamique
 */

let managementInfo = null;
let allUsers = []; // Store all users for filtering

async function loadUsers(container) {
    showLoading(container);

    try {
        const [usersRes, mgmtRes] = await Promise.all([
            API.getUsers(),
            API.getManagementInfo()
        ]);

        allUsers = usersRes.users || [];
        managementInfo = mgmtRes;
        
        const canCreate = managementInfo.can_manage_users;

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-users"></i> Gestion des utilisateurs</h3>
                    ${canCreate ? '<button class="btn btn-primary" onclick="showNewUserModal()"><i class="fas fa-plus"></i> Nouvel utilisateur</button>' : ''}
                </div>
                
                <p class="text-muted mb-20">
                    ${getRoleDescription()}
                </p>
                
                <!-- Filtres de recherche -->
                <div class="filters-bar mb-20">
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="user-search" placeholder="Rechercher par nom, email..." oninput="filterUsers()">
                    </div>
                    <select id="user-filter-role" onchange="filterUsers()">
                        <option value="">Tous les rôles</option>
                        <option value="admin">Admin</option>
                        <option value="groupe_manager">Resp. Groupe</option>
                        <option value="hotel_manager">Resp. Hôtel</option>
                        <option value="comptabilite">Comptabilité</option>
                        <option value="rh">Ressources Humaines</option>
                        <option value="receptionniste">Réceptionniste</option>
                        <option value="employee">Employé</option>
                    </select>
                    <select id="user-filter-status" onchange="filterUsers()">
                        <option value="">Tous les statuts</option>
                        <option value="active">Actif</option>
                        <option value="inactive">Inactif</option>
                    </select>
                    <span class="filter-count" id="user-count">${allUsers.length} utilisateur(s)</span>
                </div>
                
                <div id="users-table-container">
                    ${renderUsersTable(allUsers)}
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-sitemap"></i> Hiérarchie des droits</h3>
                </div>
                <table>
                    <thead><tr><th>Votre rôle</th><th>Peut gérer</th><th>Peut assigner aux hôtels</th></tr></thead>
                    <tbody>
                        <tr class="${API.user.role === 'admin' ? 'table-highlight' : ''}">
                            <td><span class="badge badge-danger">Admin</span></td>
                            <td>Tous les utilisateurs</td>
                            <td>Tous les hôtels</td>
                        </tr>
                        <tr class="${API.user.role === 'groupe_manager' ? 'table-highlight' : ''}">
                            <td><span class="badge badge-warning">Resp. Groupe</span></td>
                            <td>Resp. Hôtel, Employés</td>
                            <td>Ses hôtels uniquement</td>
                        </tr>
                        <tr class="${API.user.role === 'hotel_manager' ? 'table-highlight' : ''}">
                            <td><span class="badge badge-primary">Resp. Hôtel</span></td>
                            <td>Employés de ses hôtels</td>
                            <td>Ses hôtels uniquement</td>
                        </tr>
                        <tr class="${API.user.role === 'employee' ? 'table-highlight' : ''}">
                            <td><span class="badge badge-success">Employé</span></td>
                            <td>-</td>
                            <td>-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function renderUsersTable(users) {
    if (!users.length) {
        return '<div class="empty-state"><i class="fas fa-users"></i><h3>Aucun utilisateur trouvé</h3><p>Aucun utilisateur ne correspond à vos critères de recherche.</p></div>';
    }
    
    return `
        <table>
            <thead>
                <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Hôtels assignés</th>
                    <th>Statut</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(u => `
                    <tr>
                        <td><strong>${esc(u.first_name)} ${esc(u.last_name)}</strong></td>
                        <td>${esc(u.email)}</td>
                        <td><span class="badge badge-primary">${LABELS.role[u.role] || u.role}</span></td>
                        <td>${u.hotels ? `<span class="text-muted">${esc(u.hotels)}</span>` : '<span class="text-muted">Aucun</span>'}</td>
                        <td>${statusBadge(u.status)}</td>
                        <td>
                            <div class="table-actions">
                                <button onclick="showEditUserModal(${u.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                                <button onclick="showAssignHotelsModal(${u.id}, '${esc(u.first_name)} ${esc(u.last_name)}')" title="Affecter aux hôtels"><i class="fas fa-building"></i></button>
                                ${u.id !== API.user.id ? `<button onclick="toggleUserStatus(${u.id}, '${u.status}')" title="${u.status === 'active' ? 'Désactiver' : 'Activer'}"><i class="fas fa-${u.status === 'active' ? 'ban' : 'check'}"></i></button>` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function filterUsers() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase().trim();
    const roleFilter = document.getElementById('user-filter-role').value;
    const statusFilter = document.getElementById('user-filter-status').value;
    
    let filteredUsers = allUsers.filter(u => {
        // Filtre par recherche texte (nom, prénom, email)
        const matchesSearch = !searchTerm || 
            u.first_name.toLowerCase().includes(searchTerm) ||
            u.last_name.toLowerCase().includes(searchTerm) ||
            u.email.toLowerCase().includes(searchTerm) ||
            (u.first_name + ' ' + u.last_name).toLowerCase().includes(searchTerm);
        
        // Filtre par rôle
        const matchesRole = !roleFilter || u.role === roleFilter;
        
        // Filtre par statut
        const matchesStatus = !statusFilter || u.status === statusFilter;
        
        return matchesSearch && matchesRole && matchesStatus;
    });
    
    // Mettre à jour le tableau
    document.getElementById('users-table-container').innerHTML = renderUsersTable(filteredUsers);
    
    // Mettre à jour le compteur
    document.getElementById('user-count').textContent = filteredUsers.length + ' utilisateur(s)';
}

function getRoleDescription() {
    const role = API.user.role;
    if (role === 'admin') return 'En tant qu\'administrateur, vous pouvez gérer tous les utilisateurs.';
    if (role === 'groupe_manager') return 'Vous pouvez gérer les responsables d\'hôtels et employés de vos hôtels.';
    if (role === 'hotel_manager') return 'Vous pouvez gérer les employés de vos hôtels.';
    return 'Vous n\'avez pas de droits de gestion des utilisateurs.';
}

async function showNewUserModal() {
    const assignableRoles = managementInfo.assignable_roles || [];
    const manageableHotels = managementInfo.manageable_hotels || [];
    
    openModal('Nouvel utilisateur', `
        <form onsubmit="createUser(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Prénom *</label>
                    <input type="text" name="first_name" required>
                </div>
                <div class="form-group">
                    <label>Nom *</label>
                    <input type="text" name="last_name" required>
                </div>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" name="email" required>
            </div>
            <div class="form-group">
                <label>Téléphone</label>
                <input type="tel" name="phone" placeholder="06 12 34 56 78">
            </div>
            <div class="form-group">
                <label>Mot de passe *</label>
                <input type="password" name="password" required minlength="6">
            </div>
            <div class="form-group">
                <label>Rôle *</label>
                <select name="role" required>
                    ${assignableRoles.map(r => `<option value="${r}">${LABELS.role[r] || r}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label><i class="fas fa-building"></i> Hôtel(s) assigné(s) *</label>
                <div class="checkbox-list">
                    ${manageableHotels.map(h => `
                        <label class="checkbox-item">
                            <input type="checkbox" name="hotel_ids" value="${h.id}">
                            <span>${esc(h.name)}</span>
                        </label>
                    `).join('')}
                </div>
                <small class="text-muted">Sélectionnez au moins un hôtel</small>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Créer</button>
            </div>
        </form>
    `);
}

async function createUser(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    
    // Récupérer les hôtels sélectionnés
    const hotelIds = formData.getAll('hotel_ids').map(Number);
    
    if (hotelIds.length === 0) {
        toast('Veuillez sélectionner au moins un hôtel', 'warning');
        return;
    }
    
    const data = {
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        email: formData.get('email'),
        phone: formData.get('phone') || '',
        password: formData.get('password'),
        role: formData.get('role'),
        hotel_ids: hotelIds
    };
    
    try {
        await API.createUser(data);
        toast('Utilisateur créé avec succès', 'success');
        closeModal();
        loadUsers(document.getElementById('page-content'));
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function showEditUserModal(id) {
    try {
        const res = await API.getUser(id);
        const user = res.user;
        const assignableRoles = managementInfo.assignable_roles || [];
        
        openModal('Modifier l\'utilisateur', `
            <form onsubmit="updateUser(event, ${id})">
                <div class="form-row">
                    <div class="form-group">
                        <label>Prénom *</label>
                        <input type="text" name="first_name" value="${esc(user.first_name)}" required>
                    </div>
                    <div class="form-group">
                        <label>Nom *</label>
                        <input type="text" name="last_name" value="${esc(user.last_name)}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Email *</label>
                    <input type="email" name="email" value="${esc(user.email)}" required>
                </div>
                <div class="form-group">
                    <label>Nouveau mot de passe <small>(laisser vide pour ne pas changer)</small></label>
                    <input type="password" name="password" minlength="6">
                </div>
                <div class="form-group">
                    <label>Rôle *</label>
                    <select name="role" required>
                        ${assignableRoles.map(r => `<option value="${r}" ${user.role === r ? 'selected' : ''}>${LABELS.role[r] || r}</option>`).join('')}
                    </select>
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

async function updateUser(e, id) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    
    // Remove empty password
    if (!data.password) delete data.password;
    
    try {
        await API.updateUser(id, data);
        toast('Utilisateur mis à jour', 'success');
        closeModal();
        loadUsers(document.getElementById('page-content'));
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function toggleUserStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activer' : 'désactiver';
    
    if (!confirm(`Voulez-vous vraiment ${action} cet utilisateur ?`)) return;
    
    try {
        await API.updateUser(id, { status: newStatus });
        toast(`Utilisateur ${newStatus === 'active' ? 'activé' : 'désactivé'}`, 'success');
        loadUsers(document.getElementById('page-content'));
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function showAssignHotelsModal(userId, userName) {
    try {
        // Récupérer les hôtels gérables et les assignations actuelles
        const manageableHotels = managementInfo.manageable_hotels || [];
        const userRes = await API.getUser(userId);
        const currentHotelIds = userRes.user.hotel_ids || [];
        
        if (!manageableHotels.length) {
            toast('Vous n\'avez aucun hôtel à assigner', 'warning');
            return;
        }
        
        openModal(`Affecter ${userName} aux hôtels`, `
            <form onsubmit="assignHotels(event, ${userId})">
                <p class="text-muted mb-20">Sélectionnez les hôtels auxquels cet utilisateur aura accès :</p>
                
                <div class="checkbox-group">
                    ${manageableHotels.map(h => `
                        <label class="checkbox-item">
                            <input type="checkbox" name="hotel_ids" value="${h.id}" ${currentHotelIds.includes(h.id) ? 'checked' : ''}>
                            <span>${esc(h.name)}</span>
                        </label>
                    `).join('')}
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

async function assignHotels(e, userId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const hotelIds = formData.getAll('hotel_ids').map(Number);
    
    try {
        await API.updateUserHotels(userId, hotelIds);
        toast('Hôtels assignés avec succès', 'success');
        closeModal();
        loadUsers(document.getElementById('page-content'));
    } catch (error) {
        toast(error.message, 'error');
    }
}
