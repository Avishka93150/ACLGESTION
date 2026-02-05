/**
 * Module Blanchisserie - Gestion du linge
 */

let blHotels = [];
let blCurrentHotel = null;
let blPeriodStart = null;
let blPeriodEnd = null;

async function loadLinen(container) {
    showLoading(container);

    try {
        // Récupérer les hôtels assignés
        const mgmtRes = await API.getManagementInfo();
        blHotels = mgmtRes.manageable_hotels || [];

        if (blHotels.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="empty-state">
                        <i class="fas fa-building"></i>
                        <h3>Aucun hôtel assigné</h3>
                        <p>Vous n'êtes affecté à aucun hôtel.</p>
                    </div>
                </div>
            `;
            return;
        }

        if (!blCurrentHotel) blCurrentHotel = blHotels[0].id;

        // Période par défaut : mois en cours
        const now = new Date();
        if (!blPeriodStart) blPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        if (!blPeriodEnd) blPeriodEnd = now.toISOString().split('T')[0];

        // Charger les données
        const [configRes, transRes] = await Promise.all([
            API.getLinenConfig(blCurrentHotel),
            API.getLinenTransactions({ hotel_id: blCurrentHotel, start_date: blPeriodStart, end_date: blPeriodEnd })
        ]);

        const config = configRes.config || { petit_draps: 1, petite_housse: 1, grand_draps: 1, grande_housse: 1 };
        const transactions = transRes.transactions || [];
        const summary = transRes.summary || {};

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-tshirt"></i> Blanchisserie</h3>
                    <div class="header-controls">
                        <select id="bl-hotel" onchange="blChangeHotel(this.value)">
                            ${blHotels.map(h => `<option value="${h.id}" ${h.id == blCurrentHotel ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
                        </select>
                        <button class="btn btn-primary" onclick="blNewEntryModal()"><i class="fas fa-plus"></i> Nouvelle saisie</button>
                    </div>
                </div>

                <!-- Dashboard comparatif -->
                <div class="bl-dashboard">
                    <div class="bl-period">
                        <label>Période:</label>
                        <input type="date" id="bl-start" value="${blPeriodStart}" onchange="blChangePeriod()">
                        <span>au</span>
                        <input type="date" id="bl-end" value="${blPeriodEnd}" onchange="blChangePeriod()">
                        <button class="btn btn-outline" onclick="blExportPDF()" title="Exporter en PDF"><i class="fas fa-file-pdf"></i> PDF</button>
                    </div>

                    <div class="bl-summary-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Type de linge</th>
                                    <th>Envoyé</th>
                                    <th>Reçu</th>
                                    <th>Différence</th>
                                    <th>Stock actuel</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${blRenderSummaryRows(config, summary)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-history"></i> Historique des mouvements</h3>
                </div>
                <div id="bl-transactions">${blRenderTransactions(transactions, config)}</div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function blRenderSummaryRows(config, summary) {
    const linenTypes = [];
    if (config.petit_draps) linenTypes.push({ key: 'petit_draps', label: 'Petits draps' });
    if (config.petite_housse) linenTypes.push({ key: 'petite_housse', label: 'Petites housses' });
    if (config.grand_draps) linenTypes.push({ key: 'grand_draps', label: 'Grands draps' });
    if (config.grande_housse) linenTypes.push({ key: 'grande_housse', label: 'Grandes housses' });

    if (!linenTypes.length) {
        return `<tr><td colspan="5" class="text-center text-muted">Aucun type de linge configuré</td></tr>`;
    }

    return linenTypes.map(t => {
        const data = summary[t.key] || { sent: 0, received: 0, stock: 0 };
        const diff = data.received - data.sent;
        return `
            <tr>
                <td><strong>${t.label}</strong></td>
                <td class="text-center">${data.sent}</td>
                <td class="text-center">${data.received}</td>
                <td class="text-center ${diff < 0 ? 'text-danger' : diff > 0 ? 'text-success' : ''}">${diff > 0 ? '+' : ''}${diff}</td>
                <td class="text-center"><strong>${data.stock}</strong></td>
            </tr>
        `;
    }).join('');
}

function blRenderTransactions(transactions, config) {
    if (!transactions.length) {
        return '<div class="empty-state"><i class="fas fa-tshirt"></i><h3>Aucun mouvement</h3></div>';
    }
    
    const canEdit = hasPermission('linen.manage');

    return `
        <div class="bl-transactions-list">
            ${transactions.map(t => {
                const typeColors = { collecte: '#F59E0B', reception: '#10B981', stock: '#3B82F6' };
                const typeIcons = { collecte: 'fa-truck-loading', reception: 'fa-truck', stock: 'fa-boxes' };
                const details = blFormatDetailsArray(t, config);
                
                return `
                <div class="bl-transaction-card" style="border-left: 4px solid ${typeColors[t.transaction_type] || '#6B7280'}">
                    <div class="bl-trans-header">
                        <div class="bl-trans-date">
                            <i class="fas fa-calendar"></i>
                            ${new Date(t.transaction_date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <span class="badge badge-${t.transaction_type === 'collecte' ? 'warning' : t.transaction_type === 'reception' ? 'success' : 'primary'}">
                            <i class="fas ${typeIcons[t.transaction_type] || 'fa-exchange-alt'}"></i> ${blTypeLabel(t.transaction_type)}
                        </span>
                    </div>
                    <div class="bl-trans-body">
                        <div class="bl-trans-details">
                            ${details.map(d => `
                                <div class="bl-detail-item">
                                    <span class="bl-detail-label">${d.label}</span>
                                    <span class="bl-detail-value">${d.value}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="bl-trans-meta">
                            <span class="bl-trans-user"><i class="fas fa-user"></i> ${esc(t.user_name || 'Inconnu')}</span>
                            ${t.document_url ? `<a href="${t.document_url}" target="_blank" class="bl-trans-doc"><i class="fas fa-paperclip"></i> Document</a>` : ''}
                        </div>
                    </div>
                    ${canEdit ? `
                        <div class="bl-trans-actions">
                            <button class="btn btn-sm btn-outline" onclick="blEditEntry(${t.id})" title="Modifier"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline text-danger" onclick="blDeleteEntry(${t.id})" title="Supprimer"><i class="fas fa-trash"></i></button>
                        </div>
                    ` : ''}
                </div>
            `}).join('')}
        </div>
    `;
}

function blFormatDetailsArray(t, config) {
    const details = [];
    if (config.petit_draps && t.petit_draps > 0) details.push({ label: 'Petits draps', value: t.petit_draps });
    if (config.petite_housse && t.petite_housse > 0) details.push({ label: 'Petites housses', value: t.petite_housse });
    if (config.grand_draps && t.grand_draps > 0) details.push({ label: 'Grands draps', value: t.grand_draps });
    if (config.grande_housse && t.grande_housse > 0) details.push({ label: 'Grandes housses', value: t.grande_housse });
    return details;
}

function blTypeLabel(type) {
    return { collecte: 'Envoyé', reception: 'Reçu', stock: 'Stock' }[type] || type;
}

function blFormatDetails(t, config) {
    const parts = [];
    if (config.petit_draps && t.petit_draps > 0) parts.push(`Petits draps: ${t.petit_draps}`);
    if (config.petite_housse && t.petite_housse > 0) parts.push(`Petites housses: ${t.petite_housse}`);
    if (config.grand_draps && t.grand_draps > 0) parts.push(`Grands draps: ${t.grand_draps}`);
    if (config.grande_housse && t.grande_housse > 0) parts.push(`Grandes housses: ${t.grande_housse}`);
    return parts.join(', ') || '-';
}

function blChangeHotel(id) {
    blCurrentHotel = parseInt(id);
    loadLinen(document.getElementById('page-content'));
}

function blChangePeriod() {
    blPeriodStart = document.getElementById('bl-start').value;
    blPeriodEnd = document.getElementById('bl-end').value;
    loadLinen(document.getElementById('page-content'));
}

async function blNewEntryModal() {
    try {
        const configRes = await API.getLinenConfig(blCurrentHotel);
        const config = configRes.config || { petit_draps: 1, petite_housse: 1, grand_draps: 1, grande_housse: 1 };

        const linenTypes = [];
        if (config.petit_draps) linenTypes.push({ key: 'petit_draps', label: 'Petits draps' });
        if (config.petite_housse) linenTypes.push({ key: 'petite_housse', label: 'Petites housses' });
        if (config.grand_draps) linenTypes.push({ key: 'grand_draps', label: 'Grands draps' });
        if (config.grande_housse) linenTypes.push({ key: 'grande_housse', label: 'Grandes housses' });

        if (!linenTypes.length) {
            toast('Aucun type de linge configuré pour cet hôtel', 'warning');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const hotelName = blHotels.find(h => h.id == blCurrentHotel)?.name || '';

        openModal('Nouvelle saisie', `
            <form id="bl-form" onsubmit="blCreateEntry(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label>Hôtel</label>
                        <input type="text" value="${esc(hotelName)}" disabled>
                        <input type="hidden" name="hotel_id" value="${blCurrentHotel}">
                    </div>
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" name="transaction_date" value="${today}" required>
                    </div>
                </div>

                <div class="form-group">
                    <label>Type de mouvement *</label>
                    <div class="bl-type-selector">
                        <label class="bl-type-option">
                            <input type="radio" name="transaction_type" value="collecte" required checked>
                            <span class="bl-type-content"><i class="fas fa-truck-loading"></i> Envoyé (collecté)</span>
                        </label>
                        <label class="bl-type-option">
                            <input type="radio" name="transaction_type" value="reception">
                            <span class="bl-type-content"><i class="fas fa-truck"></i> Reçu (livraison)</span>
                        </label>
                        <label class="bl-type-option">
                            <input type="radio" name="transaction_type" value="stock">
                            <span class="bl-type-content"><i class="fas fa-boxes"></i> Mise à jour stock</span>
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label>Quantités</label>
                    <div class="bl-quantities">
                        ${linenTypes.map(t => `
                            <div class="bl-qty-row">
                                <label>${t.label}</label>
                                <input type="number" name="${t.key}" min="0" value="0">
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="form-group">
                    <label>Bon de livraison (optionnel)</label>
                    <input type="file" name="document" accept=".pdf,.jpg,.jpeg,.png">
                    <small class="text-muted">Pour les réceptions</small>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `);
    } catch (e) { 
        toast(e.message, 'error'); 
    }
}

async function blCreateEntry(e) {
    e.preventDefault();
    const form = document.getElementById('bl-form');
    const formData = new FormData(form);

    try {
        await API.createLinenTransaction(formData);
        toast('Mouvement enregistré', 'success');
        closeModal();
        loadLinen(document.getElementById('page-content'));
    } catch (e) { 
        toast(e.message, 'error'); 
    }
}

async function blExportPDF() {
    const hotelName = blHotels.find(h => h.id == blCurrentHotel)?.name || 'Hotel';
    const startDate = document.getElementById('bl-start').value;
    const endDate = document.getElementById('bl-end').value;
    
    toast('Génération du rapport...', 'info');
    
    try {
        // Charger les données
        const [configRes, transRes] = await Promise.all([
            API.getLinenConfig(blCurrentHotel),
            API.getLinenTransactions({ hotel_id: blCurrentHotel, start_date: startDate, end_date: endDate })
        ]);
        
        const config = configRes.config || { petit_draps: 1, petite_housse: 1, grand_draps: 1, grande_housse: 1 };
        const transactions = transRes.transactions || [];
        const summary = transRes.summary || {};
        
        // Générer le PDF
        blCreatePDF(transactions, summary, config, hotelName, startDate, endDate);
        
    } catch (e) {
        toast(e.message, 'error');
    }
}

function blCreatePDF(transactions, summary, config, hotelName, startDate, endDate) {
    const printWindow = window.open('', '_blank');
    
    const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR');
    
    // Préparer les types de linge actifs
    const linenTypes = [];
    if (config.petit_draps) linenTypes.push({ key: 'petit_draps', label: 'Petits draps' });
    if (config.petite_housse) linenTypes.push({ key: 'petite_housse', label: 'Petites housses' });
    if (config.grand_draps) linenTypes.push({ key: 'grand_draps', label: 'Grands draps' });
    if (config.grande_housse) linenTypes.push({ key: 'grande_housse', label: 'Grandes housses' });
    
    // Calculer totaux
    let totalSent = 0, totalReceived = 0;
    linenTypes.forEach(t => {
        const s = summary[t.key] || { sent: 0, received: 0 };
        totalSent += s.sent;
        totalReceived += s.received;
    });
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Rapport Blanchisserie - ${hotelName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1E3A5F; }
        .header h1 { color: #1E3A5F; font-size: 22px; margin-bottom: 5px; }
        .header h2 { color: #666; font-size: 16px; font-weight: normal; margin-bottom: 10px; }
        .header .dates { background: #f5f5f5; padding: 10px 20px; border-radius: 5px; display: inline-block; }
        .header .dates span { font-weight: bold; color: #1E3A5F; }
        .summary-section { margin-bottom: 30px; }
        .summary-section h3 { color: #1E3A5F; font-size: 14px; margin-bottom: 15px; padding-bottom: 5px; border-bottom: 1px solid #ddd; }
        .summary-cards { display: flex; gap: 15px; margin-bottom: 20px; }
        .summary-card { flex: 1; background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
        .summary-card.sent { background: #FEF3C7; }
        .summary-card.received { background: #D1FAE5; }
        .summary-card .number { font-size: 28px; font-weight: bold; color: #1E3A5F; }
        .summary-card .label { font-size: 11px; color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #1E3A5F; color: white; font-weight: 500; }
        tr:nth-child(even) { background: #f9f9f9; }
        .text-center { text-align: center; }
        .positive { color: #059669; font-weight: bold; }
        .negative { color: #DC2626; font-weight: bold; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 500; }
        .badge-warning { background: #FEF3C7; color: #92400E; }
        .badge-success { background: #D1FAE5; color: #065F46; }
        .badge-primary { background: #DBEAFE; color: #1E40AF; }
        .transactions-section { margin-top: 30px; }
        .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; }
        @media print { 
            body { padding: 10px; }
            .summary-cards { flex-wrap: wrap; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧺 ${hotelName}</h1>
        <h2>Rapport Blanchisserie</h2>
        <div class="dates">
            Période: <span>${fmtDate(startDate)}</span> au <span>${fmtDate(endDate)}</span>
        </div>
    </div>
    
    <div class="summary-section">
        <h3>📊 Résumé de la période</h3>
        
        <div class="summary-cards">
            <div class="summary-card sent">
                <div class="number">${totalSent}</div>
                <div class="label">Total envoyé</div>
            </div>
            <div class="summary-card received">
                <div class="number">${totalReceived}</div>
                <div class="label">Total reçu</div>
            </div>
            <div class="summary-card">
                <div class="number ${totalReceived - totalSent >= 0 ? 'positive' : 'negative'}">${totalReceived - totalSent >= 0 ? '+' : ''}${totalReceived - totalSent}</div>
                <div class="label">Différence</div>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Type de linge</th>
                    <th class="text-center">Envoyé</th>
                    <th class="text-center">Reçu</th>
                    <th class="text-center">Différence</th>
                    <th class="text-center">Stock actuel</th>
                </tr>
            </thead>
            <tbody>
                ${linenTypes.map(t => {
                    const s = summary[t.key] || { sent: 0, received: 0, stock: 0 };
                    const diff = s.received - s.sent;
                    return `
                    <tr>
                        <td><strong>${t.label}</strong></td>
                        <td class="text-center">${s.sent}</td>
                        <td class="text-center">${s.received}</td>
                        <td class="text-center ${diff < 0 ? 'negative' : diff > 0 ? 'positive' : ''}">${diff > 0 ? '+' : ''}${diff}</td>
                        <td class="text-center"><strong>${s.stock}</strong></td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="transactions-section">
        <h3>📋 Détail des mouvements (${transactions.length})</h3>
        
        ${transactions.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Détails</th>
                    <th>Par</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.map(t => {
                    const typeLabel = t.transaction_type === 'collecte' ? 'Envoyé' : (t.transaction_type === 'reception' ? 'Reçu' : 'Stock');
                    const badgeClass = t.transaction_type === 'collecte' ? 'badge-warning' : (t.transaction_type === 'reception' ? 'badge-success' : 'badge-primary');
                    
                    const details = [];
                    if (config.petit_draps && t.petit_draps > 0) details.push('Petits draps: ' + t.petit_draps);
                    if (config.petite_housse && t.petite_housse > 0) details.push('Petites housses: ' + t.petite_housse);
                    if (config.grand_draps && t.grand_draps > 0) details.push('Grands draps: ' + t.grand_draps);
                    if (config.grande_housse && t.grande_housse > 0) details.push('Grandes housses: ' + t.grande_housse);
                    
                    return `
                    <tr>
                        <td>${fmtDate(t.transaction_date)}</td>
                        <td><span class="badge ${badgeClass}">${typeLabel}</span></td>
                        <td>${details.join(', ') || '-'}</td>
                        <td>${t.user_name || '-'}</td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>
        ` : '<p style="text-align:center; color:#666; padding:20px;">Aucun mouvement sur cette période</p>'}
    </div>
    
    <div class="footer">
        <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
        <p>ACL GESTION - Module Blanchisserie</p>
    </div>
    
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

// Modifier une saisie de blanchisserie
async function blEditEntry(id) {
    try {
        const res = await API.get(`linen/transactions/${id}`);
        
        if (!res.transaction) {
            toast('Transaction non trouvée', 'error');
            console.error('API response:', res);
            return;
        }
        
        const t = res.transaction;
        
        // Utiliser la config actuelle de l'hôtel sélectionné
        const configRes = await API.getLinenConfig(blCurrentHotel);
        const config = configRes.config || { petit_draps: 1, petite_housse: 1, grand_draps: 1, grande_housse: 1 };
        
        const linenTypes = [];
        if (config.petit_draps) linenTypes.push({ key: 'petit_draps', label: 'Petits draps', value: t.petit_draps || 0 });
        if (config.petite_housse) linenTypes.push({ key: 'petite_housse', label: 'Petites housses', value: t.petite_housse || 0 });
        if (config.grand_draps) linenTypes.push({ key: 'grand_draps', label: 'Grands draps', value: t.grand_draps || 0 });
        if (config.grande_housse) linenTypes.push({ key: 'grande_housse', label: 'Grandes housses', value: t.grande_housse || 0 });
        
        openModal('Modifier la saisie', `
            <form onsubmit="blUpdateEntry(event, ${id})">
                <div class="form-row">
                    <div class="form-group">
                        <label>Hôtel</label>
                        <input type="text" value="${esc(t.hotel_name)}" disabled>
                    </div>
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" name="transaction_date" value="${t.transaction_date}" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Type de mouvement *</label>
                    <div class="btn-group-toggle">
                        <label class="btn-toggle ${t.transaction_type === 'collecte' ? 'active' : ''}">
                            <input type="radio" name="transaction_type" value="collecte" ${t.transaction_type === 'collecte' ? 'checked' : ''}>
                            <i class="fas fa-truck-loading"></i> Envoyé (collecté)
                        </label>
                        <label class="btn-toggle ${t.transaction_type === 'reception' ? 'active' : ''}">
                            <input type="radio" name="transaction_type" value="reception" ${t.transaction_type === 'reception' ? 'checked' : ''}>
                            <i class="fas fa-truck"></i> Reçu (livraison)
                        </label>
                        <label class="btn-toggle ${t.transaction_type === 'stock' ? 'active' : ''}">
                            <input type="radio" name="transaction_type" value="stock" ${t.transaction_type === 'stock' ? 'checked' : ''}>
                            <i class="fas fa-boxes"></i> Mise à jour stock
                        </label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Quantités</label>
                    <div class="linen-quantities">
                        ${linenTypes.map(lt => `
                            <div class="linen-qty-row">
                                <span>${lt.label}</span>
                                <input type="number" name="${lt.key}" value="${lt.value}" min="0">
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                ${t.document_url ? `
                    <div class="form-group">
                        <label>Document actuel</label>
                        <a href="${t.document_url}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-file"></i> Voir le document</a>
                    </div>
                ` : ''}
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `);
        
        // Toggle buttons
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });
        
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function blUpdateEntry(e, id) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    
    try {
        await API.put(`linen/transactions/${id}`, data);
        toast('Saisie modifiée', 'success');
        closeModal();
        loadLinen(document.getElementById('page-content'));
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function blDeleteEntry(id) {
    if (!confirm('Voulez-vous vraiment supprimer cette saisie ?')) return;
    
    try {
        await API.delete(`linen/transactions/${id}`);
        toast('Saisie supprimée', 'success');
        loadLinen(document.getElementById('page-content'));
    } catch (error) {
        toast(error.message, 'error');
    }
}
