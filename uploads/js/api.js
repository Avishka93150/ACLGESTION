/**
 * ACL GESTION - API Module
 */
const API_BASE = CONFIG.API_URL;

const API = {
    token: localStorage.getItem(CONFIG.TOKEN_KEY),
    user: JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || 'null'),

    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem(CONFIG.TOKEN_KEY, token);
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    },

    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
    },

    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_URL}/${endpoint}`;
        const headers = {};
        
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const config = { ...options, headers: { ...headers, ...options.headers } };

        if (config.body && !(config.body instanceof FormData)) {
            config.headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const text = await response.text();
            let data;
            try { data = JSON.parse(text); } 
            catch (e) { throw new Error('Erreur serveur'); }

            if (!response.ok) {
                if (response.status === 401 && !endpoint.includes('login')) {
                    this.clearAuth();
                    showLogin();
                }
                throw new Error(data.message || 'Erreur serveur');
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get(endpoint) { return this.request(endpoint); },
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body }); },
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body }); },
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
    
    // Upload avec FormData
    upload(endpoint, formData) {
        return this.request(endpoint, { method: 'POST', body: formData });
    },

    // Auth & Profile
    login(email, password) { return this.post('auth/login', { email, password }); },
    updateProfile(data) { return this.put('auth/profile', data); },
    getManagementInfo() { return this.get('auth/management-info'); },

    // Dashboard
    getStats() { return this.get('dashboard/stats'); },

    // Hotels
    getHotels() { return this.get('hotels'); },
    getHotel(id) { return this.get(`hotels/${id}`); },
    createHotel(data) { return this.post('hotels', data); },
    updateHotel(id, data) { return this.put(`hotels/${id}`, data); },
    deleteHotel(id) { return this.delete(`hotels/${id}`); },

    // Rooms
    getRooms(hotelId) { return this.get(`hotels/${hotelId}/rooms`); },
    getRoom(id) { return this.get(`rooms/${id}`); },
    createRoom(data) { return this.post('rooms', data); },
    updateRoom(id, data) { return this.put(`rooms/${id}`, data); },
    deleteRoom(id) { return this.delete(`rooms/${id}`); },

    // Permissions
    getAllPermissions() { return this.get('permissions'); },
    getMyPermissions() { return this.get('permissions/me'); },
    updateRolePermissions(role, permissions) { return this.put(`permissions/${role}`, { permissions }); },

    // Modules Config
    getModulesConfig() { return this.get('modules'); },
    saveModulesConfig(modules) { return this.put('modules', modules); },

    // Maintenance
    getMaintenanceStats() { return this.get('maintenance/stats'); },
    getTickets(params = {}) { 
        const q = new URLSearchParams(params).toString();
        return this.get(`maintenance${q ? '?' + q : ''}`);
    },
    getTicket(id) { return this.get(`maintenance/${id}`); },
    createTicket(data) { return this.post('maintenance', data); },
    async createTicketWithPhoto(formData) {
        const url = `${CONFIG.API_URL}/maintenance`;
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(url, { method: 'POST', headers, body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur');
        return data;
    },
    assignTicket(id) { return this.put(`maintenance/${id}/assign`, {}); },
    resolveTicket(id, notes) { return this.put(`maintenance/${id}/resolve`, { notes }); },
    addTicketComment(id, comment) { return this.post(`maintenance/${id}/comment`, { comment }); },
    getTicketComments(id) { return this.get(`maintenance/${id}/comments`); },

    // Tasks (Kanban)
    getTaskBoards(hotelId) { 
        return this.get(`tasks/boards${hotelId ? '?hotel_id=' + hotelId : ''}`); 
    },
    createTaskBoard(data) { return this.post('tasks/boards', data); },
    getTaskBoard(id) { return this.get(`tasks/${id}`); },
    updateTaskBoard(id, data) { return this.put(`tasks/${id}`, data); },
    deleteTaskBoard(id) { return this.delete(`tasks/${id}`); },
    
    // Colonnes
    createColumn(boardId, data) { return this.post(`tasks/${boardId}/columns`, data); },
    updateColumn(boardId, columnId, data) { return this.put(`tasks/${boardId}/columns/${columnId}`, data); },
    deleteColumn(boardId, columnId) { return this.delete(`tasks/${boardId}/columns/${columnId}`); },
    
    // Tâches
    createTask(boardId, data) { return this.post(`tasks/${boardId}/tasks`, data); },
    createTaskWithAttachments(boardId, formData) { return this.upload(`tasks/${boardId}/tasks`, formData); },
    getTask(boardId, taskId) { return this.get(`tasks/${boardId}/tasks/${taskId}`); },
    updateTask(boardId, taskId, data) { return this.put(`tasks/${boardId}/tasks/${taskId}`, data); },
    moveTask(boardId, taskId, data) { return this.put(`tasks/${boardId}/tasks/${taskId}`, data); },
    deleteTask(boardId, taskId) { return this.delete(`tasks/${boardId}/tasks/${taskId}`); },
    
    // Pièces jointes tâches
    uploadTaskAttachments(boardId, taskId, formData) { 
        return this.upload(`tasks/${boardId}/tasks/${taskId}/attachments`, formData); 
    },
    
    // Commentaires de tâches
    addTaskComment(boardId, taskId, data) { 
        return this.post(`tasks/${boardId}/tasks/${taskId}/comments`, data); 
    },
    
    // Checklist
    addChecklistItem(boardId, taskId, data) { 
        return this.post(`tasks/${boardId}/tasks/${taskId}/checklist`, data); 
    },
    updateChecklistItem(boardId, itemId, data) { 
        return this.put(`tasks/${boardId}/checklist/${itemId}`, data); 
    },
    deleteChecklistItem(boardId, itemId) { 
        return this.delete(`tasks/${boardId}/checklist/${itemId}`); 
    },


    // Evaluations
    getEvaluationGrids() { return this.get('evaluations/grids'); },
    getEvaluationGrid(id) { return this.get(`evaluations/grids/${id}`); },
    createEvaluationGrid(data) { return this.post('evaluations/grids', data); },
    createEvaluationGridFull(data) { return this.post('evaluations/grids/full', data); },
    updateEvaluationGrid(id, data) { return this.put(`evaluations/grids/${id}`, data); },
    updateEvaluationGridFull(id, data) { return this.put(`evaluations/grids/${id}/full`, data); },
    deleteEvaluationGrid(id) { return this.delete(`evaluations/grids/${id}`); },
    duplicateEvaluationGrid(id, name) { return this.post(`evaluations/grids/${id}/duplicate`, { name }); },
    addEvaluationQuestion(gridId, data) { return this.post(`evaluations/grids/${gridId}/questions`, data); },
    updateEvaluationQuestion(id, data) { return this.put(`evaluations/questions/${id}`, data); },
    deleteEvaluationQuestion(id) { return this.delete(`evaluations/questions/${id}`); },
    getEvaluations(params = {}) { 
        const q = new URLSearchParams(params).toString();
        return this.get(`evaluations${q ? '?' + q : ''}`); 
    },
    getMyEvaluations() { return this.get('evaluations/mine'); },
    getEvaluableUsers(params = {}) { 
        const q = new URLSearchParams(params).toString();
        return this.get(`evaluations/users${q ? '?' + q : ''}`); 
    },
    createEvaluation(data) { return this.post('evaluations', data); },
    getEvaluation(id) { return this.get(`evaluations/${id}`); },
    saveEvaluation(id, data) { return this.put(`evaluations/${id}`, data); },
    async saveEvaluationWithFiles(id, formData) {
        const url = `${CONFIG.API_URL}/evaluations/${id}/save`;
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(url, { method: 'POST', headers, body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur');
        return data;
    },
    deleteEvaluation(id) { return this.delete(`evaluations/${id}`); },
    getEvaluationStats(params = {}) { 
        const q = new URLSearchParams(params).toString();
        return this.get(`evaluations/stats${q ? '?' + q : ''}`); 
    },

    // Notifications
    getNotifications() { return this.get('notifications'); },
    markNotificationRead(id) { return this.put(`notifications/${id}/read`, {}); },
    markAllNotificationsRead() { return this.put('notifications/read-all', {}); },
    deleteNotification(id) { return this.delete(`notifications/${id}`); },
    clearAllNotifications() { return this.delete('notifications/all'); },

    // Dispatch (Gouvernante)
    getDispatch(params = {}) {
        const q = new URLSearchParams(params).toString();
        return this.get(`dispatch${q ? '?' + q : ''}`);
    },
    getDispatchDetail(id) { return this.get(`dispatch/${id}`); },
    getDispatchAlerts(hotelId) { 
        return this.get(`dispatch/alerts${hotelId ? '?hotel_id=' + hotelId : ''}`);
    },
    createDispatch(data) { return this.post('dispatch', data); },
    completeDispatch(id) { return this.put(`dispatch/${id}/complete`, {}); },
    controlDispatch(id, data) { return this.put(`dispatch/${id}/control`, data); },
    async controlDispatchWithPhoto(id, formData) {
        const url = `${CONFIG.API_URL}/dispatch/${id}/control`;
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(url, { method: 'POST', headers, body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur');
        return data;
    },
    deleteDispatch(id) { return this.delete(`dispatch/${id}`); },

    // Leaves (Congés)
    getLeaves() { return this.get('leaves'); },
    getLeavesPending() { return this.get('leaves/pending'); },
    getHotelLeaves(params = {}) {
        const q = new URLSearchParams(params).toString();
        return this.get(`leaves/hotel${q ? '?' + q : ''}`);
    },
    createLeave(data) { return this.post('leaves', data); },
    createLeaveForOther(data) { return this.post('leaves/for-other', data); },
    approveLeave(id, comment = '') { return this.put(`leaves/${id}/approve`, { comment }); },
    rejectLeave(id, reason) { return this.put(`leaves/${id}/reject`, { reason }); },
    getLeaveReport(year, quarter, hotelId = null) { 
        let url = `leaves/report?year=${year}&quarter=${quarter}`;
        if (hotelId) url += `&hotel_id=${hotelId}`;
        return this.get(url);
    },

    // Linen (Blanchisserie)
    getLinenConfig(hotelId) { return this.get(`linen/config/${hotelId}`); },
    updateLinenConfig(hotelId, data) { return this.put(`linen/config/${hotelId}`, data); },
    getLinenTransactions(params = {}) {
        const q = new URLSearchParams(params).toString();
        return this.get(`linen/transactions${q ? '?' + q : ''}`);
    },
    async createLinenTransaction(formData) {
        const url = `${CONFIG.API_URL}/linen/transactions`;
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(url, { method: 'POST', headers, body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erreur');
        return data;
    },

    // Users
    getUsers() { return this.get('users'); },
    getUser(id) { return this.get(`users/${id}`); },
    createUser(data) { return this.post('users', data); },
    updateUser(id, data) { return this.put(`users/${id}`, data); },
    updateUserHotels(id, hotelIds) { return this.put(`users/${id}/hotels`, { hotel_ids: hotelIds }); },

    // Messages (Messenger)
    getMessagingUsers() { return this.get('messaging/users'); },
    getConversations() { return this.get('messaging/conversations'); },
    getConversation(id) { return this.get(`messaging/conversations/${id}`); },
    startConversation(recipientId, content) { 
        return this.post('messaging/conversations', { recipient_id: recipientId, content }); 
    },
    sendMessage(convId, content) { 
        return this.post(`messaging/conversations/${convId}/messages`, { content }); 
    },
    markConversationRead(convId) { return this.put(`messaging/conversations/${convId}/read`, {}); },
    getUnreadCount() { return this.get('messaging/unread-count'); },

    // ========== MODULE TIME ==========
    
    // Services
    getTimeServices(hotelId = null) { 
        return this.get(`time/services${hotelId ? '?hotel_id=' + hotelId : ''}`); 
    },
    createTimeService(data) { return this.post('time/services', data); },
    updateTimeService(id, data) { return this.put(`time/services/${id}`, data); },
    deleteTimeService(id) { return this.delete(`time/services/${id}`); },
    
    // Positions (Postes)
    getTimePositions(params = {}) { 
        const q = new URLSearchParams(params).toString();
        return this.get(`time/positions${q ? '?' + q : ''}`); 
    },
    createTimePosition(data) { return this.post('time/positions', data); },
    updateTimePosition(id, data) { return this.put(`time/positions/${id}`, data); },
    deleteTimePosition(id) { return this.delete(`time/positions/${id}`); },
    
    // Contracts
    getTimeContracts(params = {}) { 
        const q = new URLSearchParams(params).toString();
        return this.get(`time/contracts${q ? '?' + q : ''}`); 
    },
    getTimeContract(id) { return this.get(`time/contracts/${id}`); },
    createTimeContract(data) { return this.post('time/contracts', data); },
    updateTimeContract(id, data) { return this.put(`time/contracts/${id}`, data); },
    deleteTimeContract(id) { return this.delete(`time/contracts/${id}`); },
    
    // Templates
    getTimeTemplates(hotelId = null) { 
        return this.get(`time/templates${hotelId ? '?hotel_id=' + hotelId : ''}`); 
    },
    createTimeTemplate(data) { return this.post('time/templates', data); },
    deleteTimeTemplate(id) { return this.delete(`time/templates/${id}`); },
    
    // Holidays
    getTimeHolidays(year = null) { 
        return this.get(`time/holidays${year ? '?year=' + year : ''}`); 
    },
    
    // Schedules (Planning)
    getTimeSchedule(hotelId, weekStart) { 
        return this.get(`time/schedules?hotel_id=${hotelId}&week_start=${weekStart}`); 
    },
    updateTimeSchedule(id, data) { return this.put(`time/schedules/${id}`, data); },
    
    // Schedule Entries
    saveScheduleEntry(data) { return this.post('time/entries', data); },
    deleteScheduleEntry(id) { return this.delete(`time/entries/${id}`); },
    
    // My Schedule (Vue employé)
    getMySchedule(month = null) { 
        return this.get(`time/my-schedule${month ? '?month=' + month : ''}`); 
    },
    
    // Timesheet (Émargement)
    getTimesheet(params = {}) { 
        const q = new URLSearchParams(params).toString();
        return this.get(`time/timesheet${q ? '?' + q : ''}`); 
    },
    transferToTimesheet(scheduleId) { return this.post('time/timesheet/transfer', { schedule_id: scheduleId }); },
    updateTimesheetEntry(id, data) { return this.put(`time/timesheet/${id}`, data); },
    validateTimesheetEntries(entryIds) { return this.post('time/timesheet/validate', { entry_ids: entryIds }); },
    
    // Counters
    getTimeCounters(params = {}) { 
        const q = new URLSearchParams(params).toString();
        return this.get(`time/counters${q ? '?' + q : ''}`); 
    },
    
    // Employees for planning
    getTimeEmployees(hotelId) { return this.get(`time/employees?hotel_id=${hotelId}`); },
    
    // User Positions
    getUserPositions(userId = null) { 
        return this.get(`time/user-positions${userId ? '?user_id=' + userId : ''}`); 
    },
    assignUserPosition(data) { return this.post('time/user-positions', data); },
    removeUserPosition(id) { return this.delete(`time/user-positions/${id}`); },
    
    // ============ AUDIT ============
    // Grilles d'audit
    getAuditGrids(hotelId = null, all = false) {
        let q = [];
        if (hotelId) q.push(`hotel_id=${hotelId}`);
        if (all) q.push('all=1');
        return this.get(`audit/grids${q.length ? '?' + q.join('&') : ''}`);
    },
    getAuditGrid(id) { return this.get(`audit/grids/${id}`); },
    createAuditGrid(data) { return this.post('audit/grids', data); },
    updateAuditGrid(id, data) { return this.put(`audit/grids/${id}`, data); },
    deleteAuditGrid(id) { return this.delete(`audit/grids/${id}`); },
    duplicateAuditGrid(id) { return this.post(`audit/grids/${id}/duplicate`); },
    
    // Audits
    getAudits(params = {}) {
        const q = new URLSearchParams(params).toString();
        return this.get(`audit/audits${q ? '?' + q : ''}`);
    },
    getAudit(id) { return this.get(`audit/audits/${id}`); },
    createAudit(data) { return this.post('audit/audits', data); },
    
    // Audits en attente
    getAuditPending(hotelId = null) {
        return this.get(`audit/pending${hotelId ? '?hotel_id=' + hotelId : ''}`);
    },
    
    // Sauvegarder réponses (FormData pour upload photos)
    async saveAuditAnswers(formData) {
        const res = await fetch(`${CONFIG.API_URL}/audit/answers`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur');
        return data;
    },
    
    // ==================== CLOSURES ====================
    
    // POST avec FormData
    async postForm(endpoint, formData) {
        const res = await fetch(`${CONFIG.API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur');
        return data;
    }
};
