/**
 * Revenue Management Module
 * Veille concurrentielle et analyse tarifaire via Xotelo API
 */

let revenueHotels = [];
let revenueSelectedHotel = null;
let revenueCompetitors = [];
let revenueRatesData = [];
let revenueFilters = {
    dateFrom: null,
    dateTo: null,
    guests: 2,
    roomType: '',
    ota: '',
    showCompetitors: true
};

// OTAs supportées par Xotelo
const XOTELO_OTAS = [
    { value: '', label: 'Toutes les OTAs' },
    { value: 'booking', label: 'Booking.com' },
    { value: 'expedia', label: 'Expedia' },
    { value: 'hotels', label: 'Hotels.com' },
    { value: 'agoda', label: 'Agoda' },
    { value: 'trip', label: 'Trip.com' },
    { value: 'direct', label: 'Site direct' }
];

async function loadRevenue(container) {
    showLoading(container);
    
    try {
        const [hotelsRes, permsRes] = await Promise.all([
            API.getHotels(),
            API.getMyPermissions()
        ]);
        
        revenueHotels = hotelsRes.hotels || [];
        const perms = permsRes.permissions || {};
        
        const canView = perms['revenue.view'] || ['admin', 'groupe_manager', 'hotel_manager'].includes(API.user.role);
        const canSettings = perms['revenue.settings'] || ['admin', 'groupe_manager'].includes(API.user.role);
        const canFetch = perms['revenue.fetch_rates'] || ['admin', 'groupe_manager', 'hotel_manager'].includes(API.user.role);
        
        if (!canView) {
            container.innerHTML = `
                <div class="card">
                    <div class="empty-state">
                        <i class="fas fa-lock"></i>
                        <h3>Accès non autorisé</h3>
                        <p>Vous n'avez pas les permissions pour accéder au module Revenue Management</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Définir les dates par défaut (aujourd'hui + 30 jours)
        const today = new Date();
        const nextMonth = new Date(today);
        nextMonth.setDate(nextMonth.getDate() + 30);
        
        revenueFilters.dateFrom = revenueFilters.dateFrom || today.toISOString().split('T')[0];
        revenueFilters.dateTo = revenueFilters.dateTo || nextMonth.toISOString().split('T')[0];
        
        // Sélectionner le premier hôtel par défaut
        if (!revenueSelectedHotel && revenueHotels.length > 0) {
            revenueSelectedHotel = revenueHotels[0].id;
        }
        
        container.innerHTML = `
            <div class="revenue-page">
                <!-- Header -->
                <div class="revenue-header">
                    <div class="revenue-header-left">
                        <h2><i class="fas fa-chart-line"></i> Revenue Management</h2>
                        <p>Veille concurrentielle et analyse tarifaire</p>
                    </div>
                    <div class="revenue-header-actions">
                        ${canSettings ? `
                            <button class="btn btn-outline" onclick="showRevenueSettings()">
                                <i class="fas fa-cog"></i> Paramètres
                            </button>
                        ` : ''}
                        ${canFetch ? `
                            <button class="btn btn-primary" onclick="fetchXoteloRates()">
                                <i class="fas fa-sync-alt"></i> Actualiser les tarifs
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Filters -->
                <div class="revenue-filters card">
                    <div class="filters-row">
                        <div class="filter-group">
                            <label><i class="fas fa-hotel"></i> Hôtel</label>
                            <select id="revenue-hotel-select" onchange="revenueChangeHotel(this.value)">
                                ${revenueHotels.map(h => `
                                    <option value="${h.id}" ${h.id == revenueSelectedHotel ? 'selected' : ''}>
                                        ${esc(h.name)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label><i class="fas fa-calendar"></i> Du</label>
                            <input type="date" id="revenue-date-from" value="${revenueFilters.dateFrom}" onchange="revenueFilters.dateFrom = this.value">
                        </div>
                        <div class="filter-group">
                            <label><i class="fas fa-calendar"></i> Au</label>
                            <input type="date" id="revenue-date-to" value="${revenueFilters.dateTo}" onchange="revenueFilters.dateTo = this.value">
                        </div>
                        <div class="filter-group">
                            <label><i class="fas fa-users"></i> Personnes</label>
                            <select id="revenue-guests" onchange="revenueFilters.guests = parseInt(this.value)">
                                ${[1,2,3,4].map(n => `<option value="${n}" ${revenueFilters.guests === n ? 'selected' : ''}>${n} pers.</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label><i class="fas fa-globe"></i> OTA</label>
                            <select id="revenue-ota" onchange="revenueFilters.ota = this.value">
                                ${XOTELO_OTAS.map(o => `<option value="${o.value}" ${revenueFilters.ota === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group filter-actions">
                            <button class="btn btn-primary" onclick="applyRevenueFilters()">
                                <i class="fas fa-search"></i> Rechercher
                            </button>
                        </div>
                    </div>
                    <div class="filters-row-secondary">
                        <label class="checkbox-label">
                            <input type="checkbox" id="revenue-show-competitors" ${revenueFilters.showCompetitors ? 'checked' : ''} onchange="revenueFilters.showCompetitors = this.checked; renderRevenueCalendar()">
                            <span>Afficher les concurrents</span>
                        </label>
                        <div class="competitors-legend" id="competitors-legend"></div>
                    </div>
                </div>
                
                <!-- Calendar View -->
                <div class="revenue-calendar-container card" id="revenue-calendar-container">
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h3>Sélectionnez vos critères</h3>
                        <p>Choisissez un hôtel et cliquez sur "Rechercher" pour afficher les tarifs</p>
                    </div>
                </div>
            </div>
        `;
        
        // Charger les concurrents
        await loadRevenueCompetitors();
        
    } catch (error) {
        console.error('Revenue load error:', error);
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

async function loadRevenueCompetitors() {
    if (!revenueSelectedHotel) return;
    
    try {
        const res = await API.request(`/hotels/${revenueSelectedHotel}/competitors`);
        revenueCompetitors = res.competitors || [];
        renderCompetitorsLegend();
    } catch (e) {
        revenueCompetitors = [];
    }
}

function renderCompetitorsLegend() {
    const container = document.getElementById('competitors-legend');
    if (!container) return;
    
    const hotel = revenueHotels.find(h => h.id == revenueSelectedHotel);
    const colors = getCompetitorColors();
    
    let html = `<span class="legend-item" style="--legend-color: ${colors[0]}"><span class="legend-dot"></span>${hotel ? esc(hotel.name) : 'Mon hôtel'}</span>`;
    
    revenueCompetitors.forEach((c, idx) => {
        html += `<span class="legend-item" style="--legend-color: ${colors[idx + 1] || colors[idx % colors.length]}"><span class="legend-dot"></span>${esc(c.competitor_name)}</span>`;
    });
    
    container.innerHTML = html;
}

function getCompetitorColors() {
    return [
        '#2563eb', // Bleu - mon hôtel
        '#dc2626', // Rouge
        '#16a34a', // Vert
        '#9333ea', // Violet
        '#ea580c', // Orange
        '#0891b2', // Cyan
        '#c026d3', // Magenta
        '#65a30d', // Lime
        '#0d9488', // Teal
        '#6366f1', // Indigo
        '#f59e0b'  // Amber
    ];
}

async function revenueChangeHotel(hotelId) {
    revenueSelectedHotel = parseInt(hotelId);
    await loadRevenueCompetitors();
    revenueRatesData = [];
    
    const calendarContainer = document.getElementById('revenue-calendar-container');
    if (calendarContainer) {
        calendarContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Hôtel changé</h3>
                <p>Cliquez sur "Rechercher" pour charger les tarifs</p>
            </div>
        `;
    }
}

async function fetchXoteloRates() {
    if (!revenueSelectedHotel) {
        toast('Veuillez sélectionner un hôtel', 'warning');
        return;
    }
    
    const hotel = revenueHotels.find(h => h.id == revenueSelectedHotel);
    if (!hotel || !hotel.xotelo_hotel_key) {
        toast('Cet hôtel n\'a pas de clé Xotelo configurée. Allez dans Hôtels > Modifier pour la configurer.', 'warning');
        return;
    }
    
    const btn = document.querySelector('.revenue-header-actions .btn-primary');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Récupération...';
    }
    
    try {
        const res = await API.post(`/revenue/fetch-rates`, {
            hotel_id: revenueSelectedHotel,
            date_from: revenueFilters.dateFrom,
            date_to: revenueFilters.dateTo,
            guests: revenueFilters.guests
        });
        
        if (res.rates_count > 0) {
            toast(`${res.rates_count} tarifs récupérés`, 'success');
        } else {
            toast('Aucun tarif trouvé. Vérifiez la clé Xotelo.', 'warning');
        }
        
        // Afficher les warnings s'il y en a
        if (res.warnings && res.warnings.length > 0) {
            console.warn('Xotelo warnings:', res.warnings);
            res.warnings.forEach(w => toast(w, 'warning'));
        }
        await applyRevenueFilters();
        
    } catch (error) {
        toast(error.message || 'Erreur lors de la récupération des tarifs', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualiser les tarifs';
        }
    }
}

async function applyRevenueFilters() {
    if (!revenueSelectedHotel) {
        toast('Veuillez sélectionner un hôtel', 'warning');
        return;
    }
    
    const calendarContainer = document.getElementById('revenue-calendar-container');
    if (calendarContainer) {
        calendarContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Chargement des tarifs...</div>';
    }
    
    try {
        const params = new URLSearchParams({
            date_from: revenueFilters.dateFrom,
            date_to: revenueFilters.dateTo,
            guests: revenueFilters.guests
        });
        
        if (revenueFilters.ota) params.append('ota', revenueFilters.ota);
        if (revenueFilters.roomType) params.append('room_type', revenueFilters.roomType);
        
        const res = await API.request(`/revenue/rates/${revenueSelectedHotel}?${params.toString()}`);
        revenueRatesData = res.rates || [];
        
        renderRevenueCalendar();
        
    } catch (error) {
        console.error('Rates load error:', error);
        if (calendarContainer) {
            calendarContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Erreur</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

function renderRevenueCalendar() {
    const container = document.getElementById('revenue-calendar-container');
    if (!container) return;
    
    if (revenueRatesData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <h3>Aucun tarif disponible</h3>
                <p>Cliquez sur "Actualiser les tarifs" pour récupérer les données depuis Xotelo</p>
            </div>
        `;
        return;
    }
    
    // Organiser les données par date
    const dateMap = {};
    const sources = new Set();
    
    revenueRatesData.forEach(rate => {
        if (!dateMap[rate.check_date]) {
            dateMap[rate.check_date] = {};
        }
        
        const sourceKey = rate.source_type === 'own' ? 'own' : rate.source_hotel_key;
        sources.add(sourceKey);
        
        if (!dateMap[rate.check_date][sourceKey]) {
            dateMap[rate.check_date][sourceKey] = {
                name: rate.source_name,
                type: rate.source_type,
                rates: []
            };
        }
        
        dateMap[rate.check_date][sourceKey].rates.push(rate);
    });
    
    // Trier les dates
    const sortedDates = Object.keys(dateMap).sort();
    
    // Construire le calendrier
    const hotel = revenueHotels.find(h => h.id == revenueSelectedHotel);
    const colors = getCompetitorColors();
    
    // Créer la liste des sources (mon hôtel + concurrents)
    let sourcesList = [{
        key: 'own',
        name: hotel ? hotel.name : 'Mon hôtel',
        type: 'own',
        color: colors[0]
    }];
    
    if (revenueFilters.showCompetitors) {
        revenueCompetitors.forEach((c, idx) => {
            sourcesList.push({
                key: c.xotelo_hotel_key,
                name: c.competitor_name,
                type: 'competitor',
                color: colors[idx + 1] || colors[(idx + 1) % colors.length]
            });
        });
    }
    
    let html = `
        <div class="revenue-calendar">
            <div class="calendar-header-row">
                <div class="calendar-corner">Date</div>
                ${sourcesList.map(s => `
                    <div class="calendar-source-header" style="--source-color: ${s.color}">
                        <span class="source-indicator"></span>
                        ${esc(s.name)}
                    </div>
                `).join('')}
            </div>
            <div class="calendar-body">
    `;
    
    sortedDates.forEach(date => {
        const dateObj = new Date(date + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' });
        const dayNum = dateObj.getDate();
        const monthName = dateObj.toLocaleDateString('fr-FR', { month: 'short' });
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        
        html += `
            <div class="calendar-row ${isWeekend ? 'weekend' : ''}">
                <div class="calendar-date">
                    <span class="date-day">${dayName}</span>
                    <span class="date-num">${dayNum}</span>
                    <span class="date-month">${monthName}</span>
                </div>
        `;
        
        sourcesList.forEach(source => {
            const sourceData = dateMap[date][source.key];
            
            if (sourceData && sourceData.rates.length > 0) {
                // Trouver le meilleur tarif (le plus bas)
                const minRate = Math.min(...sourceData.rates.map(r => r.rate_amount));
                const maxRate = Math.max(...sourceData.rates.map(r => r.rate_amount));
                const avgRate = sourceData.rates.reduce((sum, r) => sum + parseFloat(r.rate_amount), 0) / sourceData.rates.length;
                
                // Comparer avec le tarif de notre hôtel
                const ownData = dateMap[date]['own'];
                const ownMinRate = ownData ? Math.min(...ownData.rates.map(r => r.rate_amount)) : null;
                
                let comparison = '';
                if (source.type === 'competitor' && ownMinRate) {
                    const diff = minRate - ownMinRate;
                    const pct = ((diff / ownMinRate) * 100).toFixed(0);
                    if (diff > 0) {
                        comparison = `<span class="rate-comparison positive">+${pct}%</span>`;
                    } else if (diff < 0) {
                        comparison = `<span class="rate-comparison negative">${pct}%</span>`;
                    }
                }
                
                html += `
                    <div class="calendar-cell has-data" style="--cell-color: ${source.color}" onclick="showRateDetails('${date}', '${source.key}')">
                        <span class="rate-amount">${Math.round(minRate)}€</span>
                        ${sourceData.rates.length > 1 ? `<span class="rate-range">${Math.round(minRate)}-${Math.round(maxRate)}€</span>` : ''}
                        ${comparison}
                        <span class="rate-ota-count">${sourceData.rates.length} OTA${sourceData.rates.length > 1 ? 's' : ''}</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="calendar-cell no-data">
                        <span class="no-data-icon">—</span>
                    </div>
                `;
            }
        });
        
        html += `</div>`;
    });
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function showRateDetails(date, sourceKey) {
    const dateData = revenueRatesData.filter(r => r.check_date === date && (sourceKey === 'own' ? r.source_type === 'own' : r.source_hotel_key === sourceKey));
    
    if (dateData.length === 0) return;
    
    const sourceName = dateData[0].source_name;
    const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    let html = `
        <div class="rate-details-header">
            <h4>${esc(sourceName)}</h4>
            <p>${dateFormatted}</p>
        </div>
        <table class="rate-details-table">
            <thead>
                <tr>
                    <th>OTA</th>
                    <th>Type chambre</th>
                    <th>Tarif</th>
                    <th>Dispo</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    dateData.sort((a, b) => a.rate_amount - b.rate_amount).forEach(rate => {
        html += `
            <tr>
                <td><strong>${esc(rate.ota_name || 'N/A')}</strong></td>
                <td>${esc(rate.room_type || 'Standard')}</td>
                <td class="rate-cell">${parseFloat(rate.rate_amount).toFixed(2)} ${rate.currency || '€'}</td>
                <td>${rate.is_available ? '<span class="badge badge-success">Oui</span>' : '<span class="badge badge-danger">Non</span>'}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    openModal(`Détails des tarifs`, html);
}

// ============ SETTINGS ============

async function showRevenueSettings() {
    if (!revenueSelectedHotel) {
        toast('Veuillez d\'abord sélectionner un hôtel', 'warning');
        return;
    }
    
    const hotel = revenueHotels.find(h => h.id == revenueSelectedHotel);
    
    try {
        console.log('Loading competitors for hotel:', revenueSelectedHotel);
        const res = await API.get(`/hotels/${revenueSelectedHotel}/competitors`);
        console.log('Competitors loaded:', res);
        const competitors = res.competitors || [];
        
        let competitorsHtml = '';
        for (let i = 0; i < 10; i++) {
            const comp = competitors[i] || {};
            competitorsHtml += `
                <div class="competitor-row" data-index="${i}">
                    <div class="competitor-num">${i + 1}</div>
                    <div class="form-group">
                        <input type="text" name="competitor_name_${i}" value="${esc(comp.competitor_name || '')}" placeholder="Nom du concurrent">
                    </div>
                    <div class="form-group">
                        <input type="text" name="competitor_key_${i}" value="${esc(comp.xotelo_hotel_key || '')}" placeholder="Clé Xotelo">
                    </div>
                    <div class="form-group small">
                        <select name="competitor_stars_${i}">
                            <option value="">⭐</option>
                            ${[1,2,3,4,5].map(n => `<option value="${n}" ${comp.competitor_stars == n ? 'selected' : ''}>${n}⭐</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;
        }
        
        openModal('Paramètres Revenue Management', `
            <form onsubmit="saveRevenueSettings(event)">
                <div class="settings-section">
                    <h4><i class="fas fa-hotel"></i> Configuration de l'hôtel</h4>
                    <p class="text-muted">Configurez la clé Xotelo pour récupérer les tarifs de votre hôtel</p>
                    
                    <div class="form-group">
                        <label>Hôtel sélectionné</label>
                        <input type="text" value="${esc(hotel.name)}" disabled>
                        <input type="hidden" name="hotel_id" value="${hotel.id}">
                    </div>
                    
                    <div class="form-group">
                        <label>Clé Xotelo (hotel_key) *</label>
                        <input type="text" name="xotelo_hotel_key" value="${esc(hotel.xotelo_hotel_key || '')}" placeholder="Ex: h12345678" required>
                        <small class="form-help">Trouvez cette clé sur <a href="https://xotelo.com" target="_blank">xotelo.com</a> dans les paramètres de l'hôtel</small>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h4><i class="fas fa-users"></i> Concurrents (max 10)</h4>
                    <p class="text-muted">Ajoutez les hôtels concurrents à surveiller</p>
                    
                    <div class="competitors-list">
                        <div class="competitors-header">
                            <div class="competitor-num">#</div>
                            <div>Nom</div>
                            <div>Clé Xotelo</div>
                            <div class="small">Étoiles</div>
                        </div>
                        ${competitorsHtml}
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
            </form>
        `, 'modal-lg');
        
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function saveRevenueSettings(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    
    const hotelId = formData.get('hotel_id');
    const xoteloKey = formData.get('xotelo_hotel_key');
    
    // Collecter les concurrents
    const competitors = [];
    for (let i = 0; i < 10; i++) {
        const name = formData.get(`competitor_name_${i}`);
        const key = formData.get(`competitor_key_${i}`);
        const stars = formData.get(`competitor_stars_${i}`);
        
        if (name && key) {
            competitors.push({
                competitor_name: name,
                xotelo_hotel_key: key,
                competitor_stars: stars || 3,
                display_order: i
            });
        }
    }
    
    console.log('Saving revenue settings:', { hotelId, xoteloKey, competitors });
    
    try {
        // Sauvegarder la clé Xotelo de l'hôtel
        console.log('Saving hotel xotelo key...');
        const hotelRes = await API.put(`/hotels/${hotelId}`, {
            xotelo_hotel_key: xoteloKey
        });
        console.log('Hotel response:', hotelRes);
        
        // Sauvegarder les concurrents
        if (competitors.length > 0) {
            console.log('Saving competitors...', competitors);
            const compRes = await API.post(`/hotels/${hotelId}/competitors`, {
                competitors: competitors
            });
            console.log('Competitors response:', compRes);
            toast(`${compRes.saved || 0} concurrent(s) enregistré(s)`, 'success');
        } else {
            toast('Clé Xotelo enregistrée', 'success');
        }
        
        // Mettre à jour les données locales
        const hotel = revenueHotels.find(h => h.id == hotelId);
        if (hotel) hotel.xotelo_hotel_key = xoteloKey;
        revenueCompetitors = competitors;
        
        closeModal();
        renderCompetitorsLegend();
        
    } catch (error) {
        console.error('Save error:', error);
        toast(error.message, 'error');
    }
}
