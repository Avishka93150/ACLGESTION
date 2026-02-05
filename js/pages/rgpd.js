/**
 * ACL GESTION - Module RGPD
 * Gestion des données personnelles, consentements et conformité RGPD
 */

let rgpdSettings = {};

// ==================== PAGE MES DONNEES PERSONNELLES ====================

async function loadMyData(container) {
    container.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
    
    try {
        const res = await API.get('/rgpd/my-data');
        const userData = res.user || {};
        const consents = res.consents || [];
        const requests = res.requests || [];
        const accessLogs = res.access_logs || [];
        
        container.innerHTML = `
            <div class="page-header">
                <h2><i class="fas fa-user-shield"></i> Mes données personnelles</h2>
            </div>
            
            <div class="rgpd-info-banner">
                <i class="fas fa-info-circle"></i>
                <div>
                    <strong>Vos droits RGPD</strong>
                    <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition concernant vos données personnelles.</p>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h4><i class="fas fa-user"></i> Mes informations</h4>
                        </div>
                        <div class="card-body">
                            <table class="table table-simple">
                                <tr><td><strong>Nom</strong></td><td>${esc(userData.first_name || '')} ${esc(userData.last_name || '')}</td></tr>
                                <tr><td><strong>Email</strong></td><td>${esc(userData.email || '')}</td></tr>
                                <tr><td><strong>Téléphone</strong></td><td>${esc(userData.phone || '-')}</td></tr>
                                <tr><td><strong>Rôle</strong></td><td>${esc(LABELS.role[userData.role] || userData.role)}</td></tr>
                                <tr><td><strong>Hôtel</strong></td><td>${esc(userData.hotel_name || 'Tous')}</td></tr>
                                <tr><td><strong>Compte créé le</strong></td><td>${formatDate(userData.created_at)}</td></tr>
                                <tr><td><strong>Dernière connexion</strong></td><td>${userData.last_login ? formatDateTime(userData.last_login) : '-'}</td></tr>
                            </table>
                            <button class="btn btn-outline btn-block mt-15" onclick="showProfileModal()">
                                <i class="fas fa-edit"></i> Modifier mes informations
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h4><i class="fas fa-check-circle"></i> Mes consentements</h4>
                        </div>
                        <div class="card-body">
                            ${renderConsentsTable(consents)}
                            <button class="btn btn-outline btn-block mt-15" onclick="rgpdManageConsents()">
                                <i class="fas fa-cog"></i> Gérer mes consentements
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card mt-20">
                <div class="card-header">
                    <h4><i class="fas fa-download"></i> Exporter mes données</h4>
                </div>
                <div class="card-body">
                    <p class="text-muted">Téléchargez une copie de toutes vos données personnelles stockées dans l'application.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="rgpdExportMyData('json')">
                            <i class="fas fa-file-code"></i> Export JSON
                        </button>
                        <button class="btn btn-outline" onclick="rgpdExportMyData('csv')">
                            <i class="fas fa-file-csv"></i> Export CSV
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="card mt-20">
                <div class="card-header">
                    <h4><i class="fas fa-history"></i> Historique de mes accès</h4>
                </div>
                <div class="card-body">
                    ${accessLogs.length === 0 ? `
                        <p class="text-muted">Aucun historique d'accès enregistré.</p>
                    ` : `
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Action</th>
                                        <th>Ressource</th>
                                        <th>Adresse IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${accessLogs.slice(0, 20).map(log => `
                                        <tr>
                                            <td>${formatDateTime(log.created_at)}</td>
                                            <td><span class="badge badge-${getActionBadgeClass(log.action)}">${esc(log.action)}</span></td>
                                            <td>${esc(log.resource || '-')} ${log.resource_id ? '#' + log.resource_id : ''}</td>
                                            <td><code>${esc(log.ip_address || '-')}</code></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ${accessLogs.length > 20 ? `<p class="text-muted mt-10">Affichage des 20 dernières actions. Exportez vos données pour l'historique complet.</p>` : ''}
                    `}
                </div>
            </div>
            
            <div class="card mt-20">
                <div class="card-header">
                    <h4><i class="fas fa-clipboard-list"></i> Mes demandes RGPD</h4>
                </div>
                <div class="card-body">
                    ${requests.length === 0 ? `
                        <p class="text-muted">Aucune demande RGPD en cours.</p>
                    ` : `
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Statut</th>
                                        <th>Traité le</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${requests.map(req => `
                                        <tr>
                                            <td>${formatDate(req.requested_at)}</td>
                                            <td>${getRequestTypeLabel(req.request_type)}</td>
                                            <td>${rgpdRequestStatusBadge(req.status)}</td>
                                            <td>${req.processed_at ? formatDate(req.processed_at) : '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                    
                    <div class="rgpd-actions mt-20">
                        <h5>Effectuer une demande</h5>
                        <div class="btn-group-vertical">
                            <button class="btn btn-outline" onclick="rgpdRequestAccess()">
                                <i class="fas fa-eye"></i> Demande d'accès complet
                            </button>
                            <button class="btn btn-outline" onclick="rgpdRequestPortability()">
                                <i class="fas fa-file-export"></i> Demande de portabilité
                            </button>
                            <button class="btn btn-danger" onclick="rgpdRequestErasure()">
                                <i class="fas fa-trash-alt"></i> Demande de suppression de compte
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
}

function renderConsentsTable(consents) {
    const consentTypes = [
        { key: 'privacy_policy', label: 'Politique de confidentialité', required: true },
        { key: 'data_processing', label: 'Traitement des données', required: true },
        { key: 'cookies', label: 'Cookies analytiques', required: false },
        { key: 'marketing', label: 'Communications marketing', required: false }
    ];
    
    return `
        <table class="table table-simple">
            ${consentTypes.map(type => {
                const consent = consents.find(c => c.consent_type === type.key);
                const isConsented = consent && consent.consented;
                return `
                    <tr>
                        <td>
                            ${type.label}
                            ${type.required ? '<span class="text-danger">*</span>' : ''}
                        </td>
                        <td class="text-right">
                            ${isConsented 
                                ? `<span class="text-success"><i class="fas fa-check-circle"></i> Accepté le ${formatDate(consent.consented_at)}</span>`
                                : `<span class="text-danger"><i class="fas fa-times-circle"></i> Non accepté</span>`
                            }
                        </td>
                    </tr>
                `;
            }).join('')}
        </table>
    `;
}

function getActionBadgeClass(action) {
    const classes = {
        'login': 'success',
        'logout': 'secondary',
        'view': 'info',
        'create': 'primary',
        'update': 'warning',
        'delete': 'danger',
        'export': 'info'
    };
    return classes[action] || 'secondary';
}

function getRequestTypeLabel(type) {
    const labels = {
        'access': 'Accès aux données',
        'rectification': 'Rectification',
        'erasure': 'Effacement',
        'portability': 'Portabilité',
        'restriction': 'Limitation',
        'objection': 'Opposition'
    };
    return labels[type] || type;
}

function rgpdRequestStatusBadge(status) {
    const badges = {
        'pending': '<span class="badge badge-warning">En attente</span>',
        'processing': '<span class="badge badge-info">En cours</span>',
        'completed': '<span class="badge badge-success">Traitée</span>',
        'rejected': '<span class="badge badge-danger">Rejetée</span>'
    };
    return badges[status] || status;
}

// ==================== GESTION DES CONSENTEMENTS ====================

function rgpdManageConsents() {
    openModal('Gérer mes consentements', `
        <form id="consents-form" onsubmit="rgpdSaveConsents(event)">
            <p class="text-muted mb-20">
                Vous pouvez à tout moment modifier vos préférences de consentement. 
                Les consentements marqués d'un * sont obligatoires pour utiliser le service.
            </p>
            
            <div class="consent-item">
                <label class="checkbox-label">
                    <input type="checkbox" name="privacy_policy" checked disabled>
                    <strong>Politique de confidentialité *</strong>
                </label>
                <p class="text-muted small">J'ai lu et accepté la <a href="#" onclick="showPrivacyPolicy(); return false;">politique de confidentialité</a>.</p>
            </div>
            
            <div class="consent-item">
                <label class="checkbox-label">
                    <input type="checkbox" name="data_processing" checked disabled>
                    <strong>Traitement des données *</strong>
                </label>
                <p class="text-muted small">J'accepte le traitement de mes données personnelles dans le cadre de l'utilisation du service.</p>
            </div>
            
            <div class="consent-item">
                <label class="checkbox-label">
                    <input type="checkbox" name="cookies" id="consent-cookies">
                    <strong>Cookies analytiques</strong>
                </label>
                <p class="text-muted small">J'accepte l'utilisation de cookies pour améliorer mon expérience utilisateur.</p>
            </div>
            
            <div class="consent-item">
                <label class="checkbox-label">
                    <input type="checkbox" name="marketing" id="consent-marketing">
                    <strong>Communications marketing</strong>
                </label>
                <p class="text-muted small">J'accepte de recevoir des communications marketing par email.</p>
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
        </form>
    `);
    
    // Charger l'état actuel des consentements
    loadCurrentConsents();
}

async function loadCurrentConsents() {
    try {
        const res = await API.get('/rgpd/my-consents');
        const consents = res.consents || [];
        
        consents.forEach(c => {
            const checkbox = document.getElementById(`consent-${c.consent_type}`);
            if (checkbox) checkbox.checked = c.consented;
        });
    } catch (e) {
        console.error('Erreur chargement consentements:', e);
    }
}

async function rgpdSaveConsents(e) {
    e.preventDefault();
    const form = e.target;
    
    const consents = {
        cookies: form.querySelector('[name="cookies"]').checked,
        marketing: form.querySelector('[name="marketing"]').checked
    };
    
    try {
        await API.post('/rgpd/consents', consents);
        toast('Préférences enregistrées', 'success');
        closeModal();
        loadMyData(document.getElementById('page-content'));
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== EXPORT DES DONNEES ====================

async function rgpdExportMyData(format = 'json') {
    try {
        toast('Préparation de l\'export...', 'info');
        
        const res = await API.get(`/rgpd/export?format=${format}`);
        
        if (format === 'json') {
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            downloadBlob(blob, `mes_donnees_${new Date().toISOString().split('T')[0]}.json`);
        } else {
            // CSV
            const csv = convertToCSV(res.data);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            downloadBlob(blob, `mes_donnees_${new Date().toISOString().split('T')[0]}.csv`);
        }
        
        toast('Export téléchargé', 'success');
    } catch (e) {
        toast(e.message, 'error');
    }
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function convertToCSV(data) {
    const lines = [];
    
    // Informations personnelles
    lines.push('=== INFORMATIONS PERSONNELLES ===');
    lines.push('Champ,Valeur');
    if (data.user) {
        Object.entries(data.user).forEach(([key, value]) => {
            lines.push(`${key},"${value || ''}"`);
        });
    }
    
    lines.push('');
    lines.push('=== CONSENTEMENTS ===');
    lines.push('Type,Accepté,Date');
    if (data.consents) {
        data.consents.forEach(c => {
            lines.push(`${c.consent_type},${c.consented ? 'Oui' : 'Non'},${c.consented_at || ''}`);
        });
    }
    
    lines.push('');
    lines.push('=== HISTORIQUE DES ACCES ===');
    lines.push('Date,Action,Ressource,IP');
    if (data.access_logs) {
        data.access_logs.forEach(log => {
            lines.push(`${log.created_at},${log.action},${log.resource || ''},${log.ip_address || ''}`);
        });
    }
    
    return lines.join('\n');
}

// ==================== DEMANDES RGPD ====================

function rgpdRequestAccess() {
    openModal('Demande d\'accès aux données', `
        <form onsubmit="rgpdSubmitRequest(event, 'access')">
            <p>Vous souhaitez obtenir une copie complète de toutes les données personnelles que nous détenons à votre sujet.</p>
            <p class="text-muted">Cette demande sera traitée dans un délai maximum de 30 jours.</p>
            
            <div class="form-group">
                <label>Précisions (optionnel)</label>
                <textarea name="reason" rows="3" placeholder="Précisez votre demande si nécessaire..."></textarea>
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Envoyer la demande</button>
            </div>
        </form>
    `);
}

function rgpdRequestPortability() {
    openModal('Demande de portabilité des données', `
        <form onsubmit="rgpdSubmitRequest(event, 'portability')">
            <p>Vous souhaitez recevoir vos données dans un format structuré et lisible par machine (JSON) pour les transférer à un autre service.</p>
            <p class="text-muted">Cette demande sera traitée dans un délai maximum de 30 jours.</p>
            
            <div class="form-group">
                <label>Précisions (optionnel)</label>
                <textarea name="reason" rows="3" placeholder="Précisez votre demande si nécessaire..."></textarea>
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Envoyer la demande</button>
            </div>
        </form>
    `);
}

function rgpdRequestErasure() {
    openModal('Demande de suppression de compte', `
        <form onsubmit="rgpdSubmitRequest(event, 'erasure')">
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Attention !</strong> Cette action est irréversible.
            </div>
            
            <p>Vous demandez la suppression définitive de votre compte et de toutes vos données personnelles.</p>
            
            <p><strong>Conséquences :</strong></p>
            <ul>
                <li>Votre compte sera désactivé immédiatement</li>
                <li>Vos données personnelles seront supprimées sous 30 jours</li>
                <li>Certaines données peuvent être conservées pour des obligations légales</li>
                <li>Cette action est irréversible</li>
            </ul>
            
            <div class="form-group">
                <label>Motif de la demande *</label>
                <textarea name="reason" rows="3" required placeholder="Veuillez indiquer la raison de votre demande..."></textarea>
            </div>
            
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" name="confirm" required>
                    Je comprends que cette action est irréversible et je confirme vouloir supprimer mon compte
                </label>
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-danger">Confirmer la suppression</button>
            </div>
        </form>
    `);
}

async function rgpdSubmitRequest(e, type) {
    e.preventDefault();
    const form = e.target;
    const reason = form.querySelector('[name="reason"]')?.value || '';
    
    try {
        await API.post('/rgpd/request', { type, reason });
        toast('Demande envoyée. Vous recevrez une réponse sous 30 jours.', 'success');
        closeModal();
        loadMyData(document.getElementById('page-content'));
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ==================== PAGES LEGALES ====================

function showPrivacyPolicy() {
    openModal('Politique de confidentialité', `
        <div class="legal-content">
            <h4>1. Introduction</h4>
            <p>La présente politique de confidentialité décrit comment ACL GESTION collecte, utilise et protège vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD).</p>
            
            <h4>2. Responsable du traitement</h4>
            <p>Le responsable du traitement des données est ACL GESTION.<br>
            Contact : <span id="dpo-email">dpo@acl-gestion.fr</span></p>
            
            <h4>3. Données collectées</h4>
            <p>Nous collectons les données suivantes :</p>
            <ul>
                <li><strong>Données d'identification :</strong> nom, prénom, email, téléphone</li>
                <li><strong>Données professionnelles :</strong> fonction, hôtel d'affectation</li>
                <li><strong>Données de connexion :</strong> adresse IP, logs d'accès, horodatage</li>
                <li><strong>Données d'utilisation :</strong> actions effectuées dans l'application</li>
            </ul>
            
            <h4>4. Finalités du traitement</h4>
            <p>Vos données sont traitées pour :</p>
            <ul>
                <li>Gestion de votre compte utilisateur</li>
                <li>Fourniture des services de l'application</li>
                <li>Sécurité et prévention des fraudes</li>
                <li>Respect des obligations légales</li>
            </ul>
            
            <h4>5. Base légale</h4>
            <p>Le traitement de vos données est fondé sur :</p>
            <ul>
                <li>L'exécution du contrat de travail</li>
                <li>Votre consentement pour certains traitements</li>
                <li>L'intérêt légitime de l'employeur</li>
                <li>Les obligations légales</li>
            </ul>
            
            <h4>6. Durée de conservation</h4>
            <p>Vos données sont conservées pendant la durée de votre contrat et jusqu'à 3 ans après la fin de celui-ci, sauf obligation légale de conservation plus longue.</p>
            
            <h4>7. Vos droits</h4>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul>
                <li><strong>Droit d'accès :</strong> obtenir une copie de vos données</li>
                <li><strong>Droit de rectification :</strong> corriger vos données inexactes</li>
                <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données</li>
                <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
                <li><strong>Droit d'opposition :</strong> vous opposer à certains traitements</li>
                <li><strong>Droit à la limitation :</strong> limiter le traitement de vos données</li>
            </ul>
            
            <h4>8. Sécurité</h4>
            <p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction.</p>
            
            <h4>9. Contact</h4>
            <p>Pour exercer vos droits ou pour toute question relative à vos données personnelles, contactez notre Délégué à la Protection des Données (DPO) à l'adresse : <span id="dpo-email-2">dpo@acl-gestion.fr</span></p>
            
            <h4>10. Réclamation</h4>
            <p>Vous avez le droit d'introduire une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés) : <a href="https://www.cnil.fr" target="_blank">www.cnil.fr</a></p>
            
            <p class="text-muted mt-20"><em>Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}</em></p>
        </div>
        
        <div class="modal-footer">
            <button type="button" class="btn btn-primary" onclick="closeModal()">Fermer</button>
        </div>
    `, 'modal-lg');
}

function showLegalNotice() {
    openModal('Mentions légales', `
        <div class="legal-content">
            <h4>1. Éditeur du site</h4>
            <p>
                <strong>ACL GESTION</strong><br>
                Société de gestion hôtelière<br>
                <span id="company-address">Adresse à compléter</span><br>
                Email : <span id="company-email">contact@acl-gestion.fr</span><br>
                Téléphone : <span id="company-phone">À compléter</span>
            </p>
            
            <h4>2. Hébergement</h4>
            <p>
                L'application est hébergée par :<br>
                <span id="host-info">Informations hébergeur à compléter</span>
            </p>
            
            <h4>3. Propriété intellectuelle</h4>
            <p>L'ensemble du contenu de cette application (textes, images, logos, logiciels) est la propriété exclusive d'ACL GESTION et est protégé par les lois sur la propriété intellectuelle.</p>
            
            <h4>4. Protection des données personnelles</h4>
            <p>Conformément au RGPD, vous disposez de droits sur vos données personnelles. Consultez notre <a href="#" onclick="showPrivacyPolicy(); return false;">Politique de confidentialité</a> pour plus d'informations.</p>
            
            <h4>5. Cookies</h4>
            <p>Cette application utilise des cookies techniques nécessaires à son fonctionnement. Des cookies analytiques peuvent être utilisés avec votre consentement.</p>
            
            <h4>6. Responsabilité</h4>
            <p>ACL GESTION s'efforce d'assurer l'exactitude des informations diffusées mais ne saurait être tenue responsable des erreurs, omissions ou résultats obtenus suite à l'utilisation de ces informations.</p>
            
            <p class="text-muted mt-20"><em>Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}</em></p>
        </div>
        
        <div class="modal-footer">
            <button type="button" class="btn btn-primary" onclick="closeModal()">Fermer</button>
        </div>
    `, 'modal-lg');
}

// ==================== CONSENTEMENT INITIAL ====================

function showConsentModal(onAccept) {
    openModal('Consentement requis', `
        <form id="initial-consent-form">
            <div class="consent-intro">
                <i class="fas fa-shield-alt fa-3x text-primary mb-15"></i>
                <h4>Protection de vos données</h4>
                <p>Avant de continuer, veuillez prendre connaissance de notre politique de confidentialité et donner votre consentement.</p>
            </div>
            
            <div class="consent-item required">
                <label class="checkbox-label">
                    <input type="checkbox" name="privacy_policy" id="consent-privacy" required>
                    <strong>J'ai lu et j'accepte la <a href="#" onclick="showPrivacyPolicy(); return false;">politique de confidentialité</a></strong> *
                </label>
            </div>
            
            <div class="consent-item required">
                <label class="checkbox-label">
                    <input type="checkbox" name="data_processing" id="consent-processing" required>
                    <strong>J'accepte le traitement de mes données personnelles</strong> *
                </label>
                <p class="text-muted small">Nécessaire pour l'utilisation du service</p>
            </div>
            
            <div class="consent-item">
                <label class="checkbox-label">
                    <input type="checkbox" name="cookies" id="consent-cookies-init">
                    J'accepte les cookies analytiques
                </label>
                <p class="text-muted small">Pour améliorer votre expérience utilisateur</p>
            </div>
            
            <p class="text-muted small mt-15">* Champs obligatoires</p>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-danger" onclick="rgpdRefuseAndLogout()">Refuser et quitter</button>
                <button type="button" class="btn btn-primary" onclick="rgpdAcceptConsents()">Accepter et continuer</button>
            </div>
        </form>
    `, 'modal-md', false); // false = non fermable
}

async function rgpdAcceptConsents() {
    const privacyChecked = document.getElementById('consent-privacy').checked;
    const processingChecked = document.getElementById('consent-processing').checked;
    const cookiesChecked = document.getElementById('consent-cookies-init')?.checked || false;
    
    if (!privacyChecked || !processingChecked) {
        toast('Veuillez accepter les conditions obligatoires', 'warning');
        return;
    }
    
    try {
        await API.post('/rgpd/initial-consent', {
            privacy_policy: true,
            data_processing: true,
            cookies: cookiesChecked
        });
        
        closeModal();
        toast('Merci pour votre consentement', 'success');
        
        // Continuer vers l'application
        if (typeof showApp === 'function') {
            showApp();
        }
    } catch (e) {
        toast(e.message, 'error');
    }
}

function rgpdRefuseAndLogout() {
    if (confirm('Sans votre consentement, vous ne pourrez pas utiliser l\'application. Voulez-vous vraiment quitter ?')) {
        closeModal();
        logout();
    }
}

// ==================== ADMIN RGPD ====================

async function loadRgpdAdmin(container) {
    if (!['admin'].includes(API.user.role)) {
        container.innerHTML = `<div class="alert alert-danger">Accès non autorisé</div>`;
        return;
    }
    
    container.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
    
    try {
        const res = await API.get('/rgpd/admin/requests');
        const requests = res.requests || [];
        const stats = res.stats || {};
        
        container.innerHTML = `
            <div class="page-header">
                <h2><i class="fas fa-user-shield"></i> Administration RGPD</h2>
            </div>
            
            <div class="stats-row mb-20">
                <div class="stat-card">
                    <div class="stat-icon" style="background: #ffc107;"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <h3>${stats.pending || 0}</h3>
                        <p>Demandes en attente</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background: #17a2b8;"><i class="fas fa-spinner"></i></div>
                    <div class="stat-info">
                        <h3>${stats.processing || 0}</h3>
                        <p>En cours de traitement</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background: #28a745;"><i class="fas fa-check"></i></div>
                    <div class="stat-info">
                        <h3>${stats.completed || 0}</h3>
                        <p>Traitées ce mois</p>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h4><i class="fas fa-clipboard-list"></i> Demandes RGPD</h4>
                </div>
                <div class="card-body">
                    ${requests.length === 0 ? `
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <p>Aucune demande RGPD</p>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Utilisateur</th>
                                        <th>Type</th>
                                        <th>Statut</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${requests.map(req => `
                                        <tr>
                                            <td>${formatDate(req.requested_at)}</td>
                                            <td>
                                                <strong>${esc(req.user_name)}</strong><br>
                                                <small class="text-muted">${esc(req.user_email)}</small>
                                            </td>
                                            <td>${getRequestTypeLabel(req.request_type)}</td>
                                            <td>${rgpdRequestStatusBadge(req.status)}</td>
                                            <td>
                                                <button class="btn btn-sm btn-outline" onclick="rgpdViewRequest(${req.id})">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                                ${req.status === 'pending' ? `
                                                    <button class="btn btn-sm btn-success" onclick="rgpdProcessRequest(${req.id})">
                                                        <i class="fas fa-play"></i>
                                                    </button>
                                                ` : ''}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
            
            <div class="card mt-20">
                <div class="card-header">
                    <h4><i class="fas fa-cog"></i> Paramètres RGPD</h4>
                </div>
                <div class="card-body">
                    <button class="btn btn-outline" onclick="rgpdEditSettings()">
                        <i class="fas fa-edit"></i> Modifier les paramètres
                    </button>
                    <button class="btn btn-outline" onclick="rgpdViewLogs()">
                        <i class="fas fa-history"></i> Voir les logs d'accès
                    </button>
                    <button class="btn btn-danger" onclick="rgpdPurgeOldData()">
                        <i class="fas fa-trash"></i> Purger les anciennes données
                    </button>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
}

async function rgpdViewRequest(requestId) {
    try {
        const res = await API.get(`/rgpd/admin/requests/${requestId}`);
        const req = res.request;
        
        openModal('Détail de la demande RGPD', `
            <div class="rgpd-request-detail">
                <div class="form-row">
                    <div class="form-group">
                        <label>Utilisateur</label>
                        <p><strong>${esc(req.user_name)}</strong> (${esc(req.user_email)})</p>
                    </div>
                    <div class="form-group">
                        <label>Type de demande</label>
                        <p>${getRequestTypeLabel(req.request_type)}</p>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Date de la demande</label>
                        <p>${formatDateTime(req.requested_at)}</p>
                    </div>
                    <div class="form-group">
                        <label>Statut</label>
                        <p>${rgpdRequestStatusBadge(req.status)}</p>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Motif de la demande</label>
                    <p>${esc(req.reason) || '<em>Non renseigné</em>'}</p>
                </div>
                
                ${req.admin_notes ? `
                    <div class="form-group">
                        <label>Notes admin</label>
                        <p>${esc(req.admin_notes)}</p>
                    </div>
                ` : ''}
                
                ${req.status !== 'completed' && req.status !== 'rejected' ? `
                    <hr>
                    <form onsubmit="rgpdUpdateRequest(event, ${req.id})">
                        <div class="form-group">
                            <label>Notes de traitement</label>
                            <textarea name="admin_notes" rows="3">${esc(req.admin_notes || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Action</label>
                            <select name="status" required>
                                <option value="">-- Sélectionner --</option>
                                <option value="processing">Marquer en cours</option>
                                <option value="completed">Marquer comme traitée</option>
                                <option value="rejected">Rejeter</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="closeModal()">Fermer</button>
                            <button type="submit" class="btn btn-primary">Mettre à jour</button>
                        </div>
                    </form>
                ` : `
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="closeModal()">Fermer</button>
                    </div>
                `}
            </div>
        `);
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function rgpdUpdateRequest(e, requestId) {
    e.preventDefault();
    const form = e.target;
    const data = {
        status: form.querySelector('[name="status"]').value,
        admin_notes: form.querySelector('[name="admin_notes"]').value
    };
    
    try {
        await API.put(`/rgpd/admin/requests/${requestId}`, data);
        toast('Demande mise à jour', 'success');
        closeModal();
        loadRgpdAdmin(document.getElementById('page-content'));
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function rgpdProcessRequest(requestId) {
    try {
        await API.put(`/rgpd/admin/requests/${requestId}`, { status: 'processing' });
        toast('Demande marquée en cours de traitement', 'success');
        loadRgpdAdmin(document.getElementById('page-content'));
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function rgpdPurgeOldData() {
    if (!confirm('Cette action va supprimer les logs et données de plus de 3 ans. Continuer ?')) return;
    
    try {
        const res = await API.post('/rgpd/admin/purge');
        toast(`${res.deleted || 0} enregistrements supprimés`, 'success');
    } catch (e) {
        toast(e.message, 'error');
    }
}
