/**
 * Revenue Management Module
 * Veille concurrentielle et analyse tarifaire via Xotelo API
 */

// ============ VARIABLES GLOBALES ============
let revenueHotels = [];
let revenueSelectedHotel = null;
let revenueCompetitors = [];
let revenueRatesData = [];
let revenueCurrentMonth = new Date();
let revenueFilters = {
    guests: 2,
    sources: [],      // Sources sélectionnées (own + competitors keys)
    otas: []          // OTAs sélectionnées
};
let revenueAvailableOtas = []; // OTAs disponibles dans les données

// OTAs supportées par Xotelo
const XOTELO_OTAS = [
    { value: '', label: 'Toutes les OTAs' },
    { value: 'Booking.com', label: 'Booking.com' },
    { value: 'Expedia', label: 'Expedia' },
    { value: 'Hotels.com', label: 'Hotels.com' },
    { value: 'Agoda', label: 'Agoda' },
    { value: 'Trip.com', label: 'Trip.com' }
];

// Devise (EUR uniquement)
const CURRENCY_SYMBOL = '€';

// Couleurs pour les hôtels
const HOTEL_COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c',
    '#0891b2', '#c026d3', '#65a30d', '#0d9488', '#6366f1', '#f59e0b'
];

// ============ CHARGEMENT INITIAL ============
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
        
        if (!revenueSelectedHotel && revenueHotels.length > 0) {
            revenueSelectedHotel = revenueHotels[0].id;
        }
        
        revenueCurrentMonth = new Date();
        
        container.innerHTML = `
            <div class="revenue-page">
                <div class="revenue-header">
                    <div class="revenue-header-left">
                        <h2><i class="fas fa-chart-line"></i> Revenue Management</h2>
                        <p>Veille concurrentielle et analyse tarifaire</p>
                    </div>
                    <div class="revenue-header-actions">
                        <div class="last-update-info" id="revenue-last-update">
                            <i class="fas fa-clock"></i> <span>Chargement...</span>
                        </div>
                        ${canSettings ? `<button class="btn btn-outline" onclick="showRevenueSettings()"><i class="fas fa-cog"></i> Paramètres</button>` : ''}
                    </div>
                </div>
                
                <div class="revenue-filters card">
                    <div class="filters-row">
                        <div class="filter-group">
                            <label><i class="fas fa-hotel"></i> Hôtel</label>
                            <select id="revenue-hotel-select" onchange="revenueChangeHotel(this.value)">
                                ${revenueHotels.map(h => `<option value="${h.id}" ${h.id == revenueSelectedHotel ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label><i class="fas fa-users"></i> Personnes</label>
                            <select id="revenue-guests" onchange="revenueFilters.guests = parseInt(this.value); loadMonthRates();">
                                ${[1,2,3,4].map(n => `<option value="${n}" ${revenueFilters.guests === n ? 'selected' : ''}>${n} pers.</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <!-- Filtres dynamiques sources -->
                    <div class="dynamic-filters-section">
                        <div class="dynamic-filter-group">
                            <label><i class="fas fa-building"></i> Sources à afficher</label>
                            <div class="dynamic-filter-chips" id="calendar-source-filters">
                                <!-- Rempli dynamiquement -->
                            </div>
                        </div>
                        <div class="dynamic-filter-group">
                            <label><i class="fas fa-globe"></i> OTAs</label>
                            <div class="dynamic-filter-chips" id="calendar-ota-filters">
                                <!-- Rempli dynamiquement -->
                            </div>
                        </div>
                        <div class="dynamic-filter-actions">
                            <button type="button" class="btn btn-sm btn-outline" onclick="selectAllCalendarFilters()">
                                <i class="fas fa-check-double"></i> Tout
                            </button>
                            <button type="button" class="btn btn-sm btn-outline" onclick="clearAllCalendarFilters()">
                                <i class="fas fa-times"></i> Aucun
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="revenue-month-nav card">
                    <button class="btn btn-outline" onclick="changeRevenueMonth(-1)"><i class="fas fa-chevron-left"></i> Mois précédent</button>
                    <h3 id="revenue-month-title"></h3>
                    <button class="btn btn-outline" onclick="changeRevenueMonth(1)">Mois suivant <i class="fas fa-chevron-right"></i></button>
                </div>
                
                <div class="revenue-calendar-container card" id="revenue-calendar-container">
                    <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>
                </div>
            </div>
        `;
        
        await loadRevenueCompetitors();
        await loadMonthRates();
        
    } catch (error) {
        console.error('Revenue load error:', error);
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

// ============ CHARGEMENT DES DONNÉES ============
async function loadRevenueCompetitors() {
    if (!revenueSelectedHotel) return;
    try {
        const res = await API.get(`/hotels/${revenueSelectedHotel}/competitors`);
        revenueCompetitors = res.competitors || [];
        
        // Initialiser les filtres sources (mon hôtel + tous les concurrents)
        revenueFilters.sources = ['own'];
        revenueCompetitors.forEach(c => {
            if (c.xotelo_hotel_key) {
                revenueFilters.sources.push(c.xotelo_hotel_key);
            }
        });
        
        renderCalendarSourceFilters();
    } catch (e) {
        revenueCompetitors = [];
        revenueFilters.sources = ['own'];
    }
}

async function loadMonthRates() {
    if (!revenueSelectedHotel) return;
    
    const year = revenueCurrentMonth.getFullYear();
    const month = revenueCurrentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const dateFrom = formatDateISO(firstDay);
    const dateTo = formatDateISO(lastDay);
    
    const monthTitle = document.getElementById('revenue-month-title');
    if (monthTitle) {
        const monthName = firstDay.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        monthTitle.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    }
    
    const container = document.getElementById('revenue-calendar-container');
    if (container) {
        container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Chargement des tarifs...</div>';
    }
    
    try {
        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, currency: 'EUR' });
        const res = await API.get(`/revenue/rates/${revenueSelectedHotel}?${params.toString()}`);
        revenueRatesData = res.rates || [];
        
        // Extraire les OTAs disponibles dans les données
        const otaSet = new Set();
        revenueRatesData.forEach(r => {
            if (r.ota_name) otaSet.add(r.ota_name);
        });
        revenueAvailableOtas = Array.from(otaSet).sort();
        
        // Initialiser les filtres OTAs si vide (première fois)
        if (revenueFilters.otas.length === 0 && revenueAvailableOtas.length > 0) {
            revenueFilters.otas = [...revenueAvailableOtas];
        }
        
        // Mettre à jour les filtres UI
        renderCalendarOtaFilters();
        
        // Afficher l'heure de dernière actualisation
        updateLastFetchTime(res.rates);
        
        renderRevenueCalendar();
    } catch (error) {
        console.error('Rates load error:', error);
        if (container) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Erreur</h3><p>${error.message}</p></div>`;
        }
    }
}

// ============ DERNIÈRE ACTUALISATION ============
function updateLastFetchTime(rates) {
    const container = document.getElementById('revenue-last-update');
    if (!container) return;
    
    if (!rates || rates.length === 0) {
        container.innerHTML = '<i class="fas fa-clock"></i> <span>Aucune donnée</span>';
        return;
    }
    
    // Trouver la date de fetch la plus récente
    let lastFetch = null;
    rates.forEach(r => {
        if (r.fetched_at) {
            const fetchDate = new Date(r.fetched_at);
            if (!lastFetch || fetchDate > lastFetch) {
                lastFetch = fetchDate;
            }
        }
    });
    
    if (lastFetch) {
        const now = new Date();
        const diffMs = now - lastFetch;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        
        let timeAgo;
        if (diffMins < 1) {
            timeAgo = "À l'instant";
        } else if (diffMins < 60) {
            timeAgo = `Il y a ${diffMins} min`;
        } else if (diffHours < 24) {
            timeAgo = `Il y a ${diffHours}h${diffMins % 60 > 0 ? String(diffMins % 60).padStart(2, '0') : ''}`;
        } else {
            timeAgo = lastFetch.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        }
        
        container.innerHTML = `<i class="fas fa-sync-alt"></i> <span>Màj : ${timeAgo}</span>`;
        container.title = `Dernière actualisation : ${lastFetch.toLocaleString('fr-FR')}`;
    } else {
        container.innerHTML = '<i class="fas fa-clock"></i> <span>Aucune donnée</span>';
    }
}

// ============ NAVIGATION ============
async function revenueChangeHotel(hotelId) {
    revenueSelectedHotel = parseInt(hotelId);
    await loadRevenueCompetitors();
    await loadMonthRates();
}

function changeRevenueMonth(delta) {
    revenueCurrentMonth.setMonth(revenueCurrentMonth.getMonth() + delta);
    loadMonthRates();
}

// ============ FILTRES DYNAMIQUES CALENDRIER ============
function renderCalendarSourceFilters() {
    const container = document.getElementById('calendar-source-filters');
    if (!container) return;
    
    const hotel = revenueHotels.find(h => h.id == revenueSelectedHotel);
    
    let html = `
        <button type="button" class="filter-chip ${revenueFilters.sources.includes('own') ? 'active' : ''}" 
                data-source="own" style="--chip-color: ${HOTEL_COLORS[0]}" onclick="toggleCalendarSource('own')">
            <span class="chip-dot"></span>
            ${hotel ? esc(hotel.name) : 'Mon hôtel'}
            <span class="chip-badge">Vous</span>
        </button>
    `;
    
    revenueCompetitors.forEach((c, idx) => {
        const color = HOTEL_COLORS[(idx + 1) % HOTEL_COLORS.length];
        const isActive = revenueFilters.sources.includes(c.xotelo_hotel_key);
        html += `
            <button type="button" class="filter-chip ${isActive ? 'active' : ''}" 
                    data-source="${esc(c.xotelo_hotel_key)}" style="--chip-color: ${color}" 
                    onclick="toggleCalendarSource('${esc(c.xotelo_hotel_key)}')">
                <span class="chip-dot"></span>
                ${esc(c.competitor_name)}
            </button>
        `;
    });
    
    container.innerHTML = html;
}

function renderCalendarOtaFilters() {
    const container = document.getElementById('calendar-ota-filters');
    if (!container) return;
    
    if (revenueAvailableOtas.length === 0) {
        container.innerHTML = '<span class="text-muted">Aucune OTA disponible</span>';
        return;
    }
    
    let html = '';
    revenueAvailableOtas.forEach(ota => {
        const isActive = revenueFilters.otas.includes(ota);
        html += `
            <button type="button" class="filter-chip ${isActive ? 'active' : ''}" 
                    data-ota="${esc(ota)}" onclick="toggleCalendarOta('${esc(ota)}')">
                ${esc(ota)}
            </button>
        `;
    });
    
    container.innerHTML = html;
}

function toggleCalendarSource(sourceKey) {
    const idx = revenueFilters.sources.indexOf(sourceKey);
    if (idx > -1) {
        revenueFilters.sources.splice(idx, 1);
    } else {
        revenueFilters.sources.push(sourceKey);
    }
    updateCalendarSourceFilterUI();
    renderRevenueCalendar();
}

function toggleCalendarOta(ota) {
    const idx = revenueFilters.otas.indexOf(ota);
    if (idx > -1) {
        revenueFilters.otas.splice(idx, 1);
    } else {
        revenueFilters.otas.push(ota);
    }
    updateCalendarOtaFilterUI();
    renderRevenueCalendar();
}

function selectAllCalendarFilters() {
    // Sélectionner toutes les sources
    revenueFilters.sources = ['own'];
    revenueCompetitors.forEach(c => {
        if (c.xotelo_hotel_key) revenueFilters.sources.push(c.xotelo_hotel_key);
    });
    
    // Sélectionner toutes les OTAs
    revenueFilters.otas = [...revenueAvailableOtas];
    
    updateCalendarSourceFilterUI();
    updateCalendarOtaFilterUI();
    renderRevenueCalendar();
}

function clearAllCalendarFilters() {
    revenueFilters.sources = [];
    revenueFilters.otas = [];
    updateCalendarSourceFilterUI();
    updateCalendarOtaFilterUI();
    renderRevenueCalendar();
}

function updateCalendarSourceFilterUI() {
    document.querySelectorAll('#calendar-source-filters .filter-chip').forEach(btn => {
        const sourceKey = btn.dataset.source;
        btn.classList.toggle('active', revenueFilters.sources.includes(sourceKey));
    });
}

function updateCalendarOtaFilterUI() {
    document.querySelectorAll('#calendar-ota-filters .filter-chip').forEach(btn => {
        const ota = btn.dataset.ota;
        btn.classList.toggle('active', revenueFilters.otas.includes(ota));
    });
}

// ============ RENDU ============
function renderRevenueCalendar() {
    const container = document.getElementById('revenue-calendar-container');
    if (!container) return;
    
    const year = revenueCurrentMonth.getFullYear();
    const month = revenueCurrentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    
    const currencySymbol = CURRENCY_SYMBOL;
    
    // Organiser les données par date (avec filtres dynamiques)
    const dateMap = {};
    revenueRatesData.forEach(rate => {
        // Filtrer par OTAs sélectionnées
        if (revenueFilters.otas.length > 0 && !revenueFilters.otas.includes(rate.ota_name)) return;
        
        const dateKey = rate.check_date;
        if (!dateMap[dateKey]) dateMap[dateKey] = {};
        
        const sourceKey = rate.source_type === 'own' ? 'own' : rate.source_hotel_key;
        if (!dateMap[dateKey][sourceKey]) {
            dateMap[dateKey][sourceKey] = { name: rate.source_name, type: rate.source_type, rates: [] };
        }
        dateMap[dateKey][sourceKey].rates.push(rate);
    });
    
    // Liste des sources à afficher (filtrées)
    const hotel = revenueHotels.find(h => h.id == revenueSelectedHotel);
    let sourcesList = [];
    
    // Mon hôtel (si sélectionné)
    if (revenueFilters.sources.includes('own')) {
        sourcesList.push({ key: 'own', name: hotel ? hotel.name : 'Mon hôtel', type: 'own', color: HOTEL_COLORS[0] });
    }
    
    // Concurrents (si sélectionnés)
    revenueCompetitors.forEach((c, idx) => {
        if (revenueFilters.sources.includes(c.xotelo_hotel_key)) {
            sourcesList.push({ key: c.xotelo_hotel_key, name: c.competitor_name, type: 'competitor', color: HOTEL_COLORS[(idx + 1) % HOTEL_COLORS.length] });
        }
    });
    
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const today = formatDateISO(new Date());
    
    // Message si aucun filtre sélectionné
    if (sourcesList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-filter"></i>
                <h3>Aucune source sélectionnée</h3>
                <p>Sélectionnez au moins un hôtel dans les filtres ci-dessus</p>
            </div>
        `;
        return;
    }
    
    let html = `<div class="revenue-monthly-calendar"><div class="calendar-weekdays">${dayNames.map(d => `<div class="weekday">${d}</div>`).join('')}</div><div class="calendar-grid">`;
    
    for (let i = 0; i < startDayOfWeek; i++) html += `<div class="calendar-day empty"></div>`;
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateData = dateMap[dateStr];
        const isToday = today === dateStr;
        const isPast = dateStr < today;
        const isWeekend = (startDayOfWeek + day - 1) % 7 >= 5;
        
        html += `<div class="calendar-day ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${isWeekend ? 'weekend' : ''}">`;
        html += `<div class="day-number" onclick="showDayComparison('${dateStr}')" title="Voir comparaison">${day}</div>`;
        html += `<div class="day-rates">`;
        
        if (dateData) {
            let ownMinRate = null;
            if (dateData['own'] && dateData['own'].rates.length > 0) {
                ownMinRate = Math.min(...dateData['own'].rates.map(r => parseFloat(r.rate_amount)));
            }
            
            sourcesList.forEach(source => {
                const sourceData = dateData[source.key];
                if (sourceData && sourceData.rates.length > 0) {
                    const minRate = Math.min(...sourceData.rates.map(r => parseFloat(r.rate_amount)));
                    let compClass = '';
                    if (source.type === 'competitor' && ownMinRate !== null) {
                        compClass = minRate < ownMinRate ? 'cheaper' : (minRate > ownMinRate ? 'expensive' : '');
                    }
                    html += `<div class="rate-chip ${compClass}" style="--chip-color: ${source.color}" onclick="event.stopPropagation(); showRateDetails('${dateStr}', '${source.key}')" title="${esc(source.name)}: ${Math.round(minRate)}${currencySymbol}"><span class="rate-value">${Math.round(minRate)}${currencySymbol}</span></div>`;
                }
            });
        } else if (!isPast) {
            html += `<span class="no-rate">—</span>`;
        }
        
        html += `</div></div>`;
    }
    
    const totalCells = startDayOfWeek + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) html += `<div class="calendar-day empty"></div>`;
    
    html += `</div></div>`;
    html += `<div class="calendar-legend">${sourcesList.map(s => `<div class="legend-item"><span class="legend-color" style="background: ${s.color}"></span><span class="legend-name">${esc(s.name)}</span></div>`).join('')}</div>`;
    
    container.innerHTML = html;
}

// ============ DÉTAILS ET COMPARAISON ============
function showRateDetails(date, sourceKey) {
    const dateData = revenueRatesData.filter(r => r.check_date === date && (sourceKey === 'own' ? r.source_type === 'own' : r.source_hotel_key === sourceKey));
    if (dateData.length === 0) { toast('Aucune donnée', 'warning'); return; }
    
    let filteredData = revenueFilters.ota ? dateData.filter(r => r.ota_name === revenueFilters.ota) : dateData;
    const sourceName = dateData[0].source_name;
    const dateFormatted = formatDateLong(date);
    const currencySymbol = CURRENCY_SYMBOL;
    
    let html = `<div class="rate-details-header"><h4>${esc(sourceName)}</h4><p>${dateFormatted}</p><button class="btn btn-sm btn-outline mt-10" onclick="closeModal(); showDayComparison('${date}')"><i class="fas fa-chart-bar"></i> Comparaison complète</button></div><table class="rate-details-table"><thead><tr><th>OTA</th><th>Tarif</th></tr></thead><tbody>`;
    
    filteredData.sort((a, b) => a.rate_amount - b.rate_amount).forEach(rate => {
        html += `<tr><td><strong>${esc(rate.ota_name || 'N/A')}</strong></td><td class="rate-cell">${parseFloat(rate.rate_amount).toFixed(2)}${currencySymbol}</td></tr>`;
    });
    
    html += `</tbody></table>`;
    openModal('Détails des tarifs', html);
}

function showDayComparison(date) {
    const dateFormatted = formatDateLong(date);
    const currencySymbol = CURRENCY_SYMBOL;
    
    let dayData = revenueRatesData.filter(r => r.check_date === date);
    if (revenueFilters.ota) dayData = dayData.filter(r => r.ota_name === revenueFilters.ota);
    if (dayData.length === 0) { toast('Aucune donnée pour cette date', 'warning'); return; }
    
    const sourceMap = {};
    const otaSet = new Set();
    
    dayData.forEach(rate => {
        const sourceKey = rate.source_type === 'own' ? 'own' : rate.source_hotel_key;
        if (!sourceMap[sourceKey]) sourceMap[sourceKey] = { name: rate.source_name, type: rate.source_type, rates: {} };
        sourceMap[sourceKey].rates[rate.ota_name] = rate;
        otaSet.add(rate.ota_name);
    });
    
    const otas = Array.from(otaSet).sort();
    let sourcesList = [];
    if (sourceMap['own']) sourcesList.push({ key: 'own', ...sourceMap['own'], color: HOTEL_COLORS[0] });
    revenueCompetitors.forEach((c, idx) => {
        if (sourceMap[c.xotelo_hotel_key]) sourcesList.push({ key: c.xotelo_hotel_key, ...sourceMap[c.xotelo_hotel_key], color: HOTEL_COLORS[(idx + 1) % HOTEL_COLORS.length] });
    });
    
    const otaStats = {};
    otas.forEach(ota => {
        const prices = sourcesList.map(s => s.rates[ota] ? parseFloat(s.rates[ota].rate_amount) : null).filter(p => p !== null);
        if (prices.length > 0) otaStats[ota] = { min: Math.min(...prices), max: Math.max(...prices) };
    });
    
    let html = `<div class="day-comparison"><div class="comparison-header"><div class="comparison-header-left"><h3><i class="fas fa-calendar-day"></i> ${dateFormatted}</h3><p class="text-muted">Comparaison tarifaire</p></div><div class="comparison-header-right"><button class="btn btn-outline" onclick="closeModal(); showPriceEvolution('${date}')"><i class="fas fa-chart-line"></i> Évolution</button></div></div>`;
    html += `<div class="comparison-table-wrapper"><table class="comparison-table"><thead><tr><th class="ota-column">Plateforme</th>${sourcesList.map(s => `<th class="hotel-column" style="--hotel-color: ${s.color}"><span class="hotel-indicator"></span>${esc(s.name)}${s.type === 'own' ? '<span class="badge badge-primary ml-5">Vous</span>' : ''}</th>`).join('')}</tr></thead><tbody>`;
    
    otas.forEach(ota => {
        const stats = otaStats[ota];
        html += `<tr><td class="ota-name"><i class="fas fa-globe"></i> ${esc(ota)}</td>`;
        sourcesList.forEach(source => {
            const rate = source.rates[ota];
            if (rate) {
                const price = parseFloat(rate.rate_amount);
                let cellClass = '';
                if (stats && sourcesList.length > 1) {
                    if (price === stats.min) cellClass = 'best-price';
                    else if (price === stats.max) cellClass = 'worst-price';
                }
                let diffHtml = '';
                const ownRate = sourceMap['own'] && sourceMap['own'].rates[ota] ? parseFloat(sourceMap['own'].rates[ota].rate_amount) : null;
                if (source.type === 'competitor' && ownRate) {
                    const diff = price - ownRate;
                    const pct = ((diff / ownRate) * 100).toFixed(0);
                    diffHtml = diff > 0 ? `<span class="price-diff higher">+${pct}%</span>` : (diff < 0 ? `<span class="price-diff lower">${pct}%</span>` : '');
                }
                html += `<td class="price-cell ${cellClass}"><span class="price-value">${price.toFixed(0)}${currencySymbol}</span>${diffHtml}</td>`;
            } else {
                html += `<td class="price-cell no-price">—</td>`;
            }
        });
        html += `</tr>`;
    });
    
    html += `<tr class="summary-row"><td class="ota-name"><strong><i class="fas fa-arrow-down"></i> Prix min</strong></td>`;
    sourcesList.forEach(source => {
        const prices = Object.values(source.rates).map(r => parseFloat(r.rate_amount));
        html += prices.length > 0 ? `<td class="price-cell summary"><strong>${Math.min(...prices).toFixed(0)}${currencySymbol}</strong></td>` : `<td class="price-cell no-price">—</td>`;
    });
    html += `</tr></tbody></table></div>`;
    html += `<div class="comparison-legend"><span class="legend-item"><span class="legend-dot best"></span> Meilleur</span><span class="legend-item"><span class="legend-dot worst"></span> Plus élevé</span><span class="legend-item"><span class="price-diff lower">-X%</span> Moins cher</span><span class="legend-item"><span class="price-diff higher">+X%</span> Plus cher</span></div></div>`;
    
    openModal(`Comparaison du ${dateFormatted}`, html, 'modal-xl');
}

// ============ ÉVOLUTION DES PRIX ============
let evolutionChartInstance = null;
let evolutionSourcesList = [];
let evolutionCurrencySymbol = '€';
let evolutionFilters = { sources: [], otas: [] };

async function showPriceEvolution(checkDate) {
    const dateFormatted = formatDateLong(checkDate);
    evolutionCurrencySymbol = CURRENCY_SYMBOL;
    
    openModal(`Évolution des prix - ${dateFormatted}`, `<div class="loading-spinner" style="padding: 40px; text-align: center;"><i class="fas fa-spinner fa-spin fa-2x"></i><p class="mt-10">Chargement...</p></div>`, 'modal-xl');
    
    try {
        const res = await API.get(`/revenue/history/${revenueSelectedHotel}?check_date=${checkDate}&currency=EUR`);
        const historyData = res.history || [];
        
        if (historyData.length === 0) {
            document.getElementById('modal-body').innerHTML = `<div class="empty-state"><i class="fas fa-chart-line"></i><h3>Pas encore d'historique</h3><p>L'historique se construit au fil des actualisations.</p></div>`;
            return;
        }
        
        // Grouper par source
        const sourceGroups = {};
        const allOtas = new Set();
        historyData.forEach(h => {
            const sourceKey = h.source_type === 'own' ? 'own' : h.source_key;
            if (!sourceGroups[sourceKey]) sourceGroups[sourceKey] = { name: h.source_name, type: h.source_type, otas: {} };
            if (!sourceGroups[sourceKey].otas[h.ota_name]) sourceGroups[sourceKey].otas[h.ota_name] = h.data;
            allOtas.add(h.ota_name);
        });
        
        // Construire la liste des sources
        evolutionSourcesList = [];
        if (sourceGroups['own']) evolutionSourcesList.push({ key: 'own', ...sourceGroups['own'], color: HOTEL_COLORS[0] });
        revenueCompetitors.forEach((c, idx) => {
            if (sourceGroups[c.xotelo_hotel_key]) evolutionSourcesList.push({ key: c.xotelo_hotel_key, ...sourceGroups[c.xotelo_hotel_key], color: HOTEL_COLORS[(idx + 1) % HOTEL_COLORS.length] });
        });
        
        // Initialiser les filtres (tout sélectionné par défaut)
        evolutionFilters.sources = evolutionSourcesList.map(s => s.key);
        evolutionFilters.otas = Array.from(allOtas);
        
        // Construire le HTML
        let html = `
            <div class="price-evolution">
                <div class="evolution-header">
                    <h3><i class="fas fa-chart-line"></i> Évolution pour le ${dateFormatted}</h3>
                    <p class="text-muted">Cliquez sur les filtres pour afficher/masquer les données</p>
                </div>
                
                <div class="evolution-filters">
                    <div class="evolution-filter-group">
                        <label><i class="fas fa-hotel"></i> Hôtels</label>
                        <div class="evolution-filter-chips" id="evolution-source-filters">
                            ${evolutionSourcesList.map(s => `
                                <button type="button" class="filter-chip active" data-source="${s.key}" style="--chip-color: ${s.color}" onclick="toggleEvolutionSource('${s.key}')">
                                    <span class="chip-dot"></span>
                                    ${esc(s.name)}
                                    ${s.type === 'own' ? '<span class="chip-badge">Vous</span>' : ''}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="evolution-filter-group">
                        <label><i class="fas fa-globe"></i> OTAs</label>
                        <div class="evolution-filter-chips" id="evolution-ota-filters">
                            ${Array.from(allOtas).sort().map(ota => `
                                <button type="button" class="filter-chip active" data-ota="${ota}" onclick="toggleEvolutionOta('${esc(ota)}')">
                                    ${esc(ota)}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="evolution-filter-actions">
                        <button type="button" class="btn btn-sm btn-outline" onclick="selectAllEvolutionFilters()">
                            <i class="fas fa-check-double"></i> Tout
                        </button>
                        <button type="button" class="btn btn-sm btn-outline" onclick="clearAllEvolutionFilters()">
                            <i class="fas fa-times"></i> Aucun
                        </button>
                    </div>
                </div>
                
                <div class="evolution-chart-container">
                    <canvas id="price-evolution-chart"></canvas>
                </div>
            </div>
        `;
        
        document.getElementById('modal-body').innerHTML = html;
        setTimeout(() => renderPriceEvolutionChart(), 100);
        
    } catch (error) {
        document.getElementById('modal-body').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Erreur</h3><p>${error.message}</p></div>`;
    }
}

function toggleEvolutionSource(sourceKey) {
    const idx = evolutionFilters.sources.indexOf(sourceKey);
    if (idx > -1) {
        evolutionFilters.sources.splice(idx, 1);
    } else {
        evolutionFilters.sources.push(sourceKey);
    }
    updateEvolutionFilterUI();
    renderPriceEvolutionChart();
}

function toggleEvolutionOta(ota) {
    const idx = evolutionFilters.otas.indexOf(ota);
    if (idx > -1) {
        evolutionFilters.otas.splice(idx, 1);
    } else {
        evolutionFilters.otas.push(ota);
    }
    updateEvolutionFilterUI();
    renderPriceEvolutionChart();
}

function selectAllEvolutionFilters() {
    evolutionFilters.sources = evolutionSourcesList.map(s => s.key);
    evolutionFilters.otas = [];
    evolutionSourcesList.forEach(s => {
        Object.keys(s.otas).forEach(ota => {
            if (!evolutionFilters.otas.includes(ota)) evolutionFilters.otas.push(ota);
        });
    });
    updateEvolutionFilterUI();
    renderPriceEvolutionChart();
}

function clearAllEvolutionFilters() {
    evolutionFilters.sources = [];
    evolutionFilters.otas = [];
    updateEvolutionFilterUI();
    renderPriceEvolutionChart();
}

function updateEvolutionFilterUI() {
    // Mettre à jour les boutons sources
    document.querySelectorAll('#evolution-source-filters .filter-chip').forEach(btn => {
        const sourceKey = btn.dataset.source;
        btn.classList.toggle('active', evolutionFilters.sources.includes(sourceKey));
    });
    
    // Mettre à jour les boutons OTAs
    document.querySelectorAll('#evolution-ota-filters .filter-chip').forEach(btn => {
        const ota = btn.dataset.ota;
        btn.classList.toggle('active', evolutionFilters.otas.includes(ota));
    });
}

function renderPriceEvolutionChart() {
    const canvas = document.getElementById('price-evolution-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    
    // Détruire l'ancien graphique s'il existe
    if (evolutionChartInstance) {
        evolutionChartInstance.destroy();
        evolutionChartInstance = null;
    }
    
    // Construire les datasets filtrés
    const datasets = [];
    evolutionSourcesList.forEach(source => {
        if (!evolutionFilters.sources.includes(source.key)) return;
        
        Object.entries(source.otas).forEach(([otaName, data]) => {
            if (!evolutionFilters.otas.includes(otaName)) return;
            
            datasets.push({
                label: `${source.name} - ${otaName}`,
                data: data.map(d => ({ x: new Date(d.date), y: d.rate })),
                borderColor: source.color,
                backgroundColor: source.color + '20',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6
            });
        });
    });
    
    // Afficher un message si aucune donnée
    if (datasets.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.fillText('Sélectionnez au moins un hôtel et une OTA', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    evolutionChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'dd/MM HH:mm' } }, title: { display: true, text: 'Date de relevé' } },
                y: { beginAtZero: false, title: { display: true, text: `Prix (${evolutionCurrencySymbol})` } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(0)}${evolutionCurrencySymbol}` } }
            }
        }
    });
}

// ============ PARAMÈTRES ============
async function showRevenueSettings() {
    if (!revenueSelectedHotel) { toast('Veuillez sélectionner un hôtel', 'warning'); return; }
    
    const hotel = revenueHotels.find(h => h.id == revenueSelectedHotel);
    
    try {
        const res = await API.get(`/hotels/${revenueSelectedHotel}/competitors`);
        const competitors = res.competitors || [];
        
        let competitorsHtml = '';
        for (let i = 0; i < 10; i++) {
            const comp = competitors[i] || {};
            competitorsHtml += `<div class="competitor-row"><div class="competitor-num">${i + 1}</div><div class="form-group"><input type="text" name="competitor_name_${i}" value="${esc(comp.competitor_name || '')}" placeholder="Nom"></div><div class="form-group"><input type="text" name="competitor_key_${i}" value="${esc(comp.xotelo_hotel_key || '')}" placeholder="Clé Xotelo"></div><div class="form-group small"><select name="competitor_stars_${i}"><option value="">⭐</option>${[1,2,3,4,5].map(n => `<option value="${n}" ${comp.competitor_stars == n ? 'selected' : ''}>${n}⭐</option>`).join('')}</select></div></div>`;
        }
        
        openModal('Paramètres Revenue Management', `
            <form onsubmit="saveRevenueSettings(event)">
                <div class="settings-section">
                    <h4><i class="fas fa-hotel"></i> Configuration de l'hôtel</h4>
                    <div class="form-group"><label>Hôtel</label><input type="text" value="${esc(hotel.name)}" disabled><input type="hidden" name="hotel_id" value="${hotel.id}"></div>
                    <div class="form-group"><label>Clé Xotelo *</label><input type="text" name="xotelo_hotel_key" value="${esc(hotel.xotelo_hotel_key || '')}" placeholder="Ex: h12345678" required><small class="form-help">Trouvez cette clé sur <a href="https://xotelo.com" target="_blank">xotelo.com</a></small></div>
                </div>
                <div class="settings-section">
                    <h4><i class="fas fa-users"></i> Concurrents (max 10)</h4>
                    <div class="competitors-list"><div class="competitors-header"><div class="competitor-num">#</div><div>Nom</div><div>Clé Xotelo</div><div class="small">Étoiles</div></div>${competitorsHtml}</div>
                </div>
                <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer</button></div>
            </form>
        `, 'modal-lg');
        
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function saveRevenueSettings(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const hotelId = formData.get('hotel_id');
    const xoteloKey = formData.get('xotelo_hotel_key');
    
    const competitors = [];
    for (let i = 0; i < 10; i++) {
        const name = formData.get(`competitor_name_${i}`);
        const key = formData.get(`competitor_key_${i}`);
        const stars = formData.get(`competitor_stars_${i}`);
        if (name && key) competitors.push({ competitor_name: name, xotelo_hotel_key: key, competitor_stars: stars || 3, display_order: i });
    }
    
    try {
        await API.put(`/hotels/${hotelId}`, { xotelo_hotel_key: xoteloKey });
        const compRes = await API.post(`/hotels/${hotelId}/competitors`, { competitors });
        
        const hotel = revenueHotels.find(h => h.id == hotelId);
        if (hotel) hotel.xotelo_hotel_key = xoteloKey;
        revenueCompetitors = competitors;
        
        toast(`Configuration enregistrée (${compRes.saved || 0} concurrent(s))`, 'success');
        closeModal();
        renderCompetitorsLegend();
    } catch (error) {
        toast(error.message, 'error');
    }
}

// ============ UTILITAIRES ============
function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateLong(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
