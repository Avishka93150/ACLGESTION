/**
 * Module Messagerie - Style Messenger
 */

let msgUsers = [];
let msgConversations = [];
let msgCurrentConvId = null;
let msgRefreshInterval = null;
let msgLastMessageId = 0; // Track last message to detect new ones

async function loadMessages(container) {
    showLoading(container);

    try {
        // Charger les utilisateurs disponibles et les conversations
        const [usersRes, convsRes] = await Promise.all([
            API.getMessagingUsers(),
            API.getConversations()
        ]);

        msgUsers = usersRes.users || [];
        msgConversations = convsRes.conversations || [];

        container.innerHTML = `
            <div class="page-header">
                <h1>Messagerie</h1>
            </div>
            <div class="messenger">
                <div class="messenger-sidebar">
                    <div class="messenger-header">
                        <h3><i class="fas fa-comments"></i> Messages</h3>
                        <button class="btn btn-sm btn-outline" onclick="msgNewConvModal()" title="Nouvelle conversation">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                    <div class="messenger-search">
                        <input type="text" placeholder="Rechercher..." oninput="msgFilterConvs(this.value)">
                    </div>
                    <div class="messenger-convs" id="msg-conv-list">
                        ${renderConversationList()}
                    </div>
                </div>
                <div class="messenger-main" id="msg-main">
                    <div class="messenger-empty">
                        <i class="fas fa-comments"></i>
                        <p>Sélectionnez une conversation</p>
                    </div>
                </div>
            </div>
        `;

        // Démarrer le rafraîchissement automatique (plus rapide)
        msgStartAutoRefresh();

    } catch (error) {
        container.innerHTML = `<div class="card"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function renderConversationList() {
    if (!msgConversations.length) {
        return '<div class="conv-empty">Aucune conversation</div>';
    }

    return msgConversations.map(c => {
        const isActive = parseInt(c.id) === msgCurrentConvId;
        const hasUnread = parseInt(c.unread) > 0;
        
        return `
            <div class="conv-item ${isActive ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}" 
                 data-id="${c.id}" 
                 onclick="msgOpenConv(${c.id})">
                <div class="conv-avatar">${getInitials(c.other_name)}</div>
                <div class="conv-info">
                    <div class="conv-name">${esc(c.other_name || 'Utilisateur')}</div>
                    <div class="conv-preview">${esc(c.last_message || 'Aucun message')}</div>
                </div>
                <div class="conv-meta">
                    <div class="conv-time">${formatTimeAgo(c.last_at)}</div>
                    ${hasUnread ? `<div class="conv-unread">${c.unread}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(p => p.charAt(0)).join('').substring(0, 2).toUpperCase();
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (diffDays < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function msgFilterConvs(searchTerm) {
    const term = searchTerm.toLowerCase();
    document.querySelectorAll('.conv-item').forEach(item => {
        const name = item.querySelector('.conv-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(term) ? '' : 'none';
    });
}

async function msgOpenConv(convId) {
    convId = parseInt(convId);
    msgCurrentConvId = convId;
    msgLastMessageId = 0; // Reset for new conversation

    // Marquer visuellement comme active
    document.querySelectorAll('.conv-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.id) === convId);
        item.classList.remove('conv-highlight');
    });

    const mainEl = document.getElementById('msg-main');
    mainEl.innerHTML = '<div class="messenger-loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

    try {
        // Récupérer les messages
        const res = await API.getConversation(convId);
        const messages = res.messages || [];
        
        // Track last message ID
        if (messages.length > 0) {
            msgLastMessageId = messages[messages.length - 1].id;
        }
        
        // Trouver la conversation pour le header
        const conv = msgConversations.find(c => parseInt(c.id) === convId);
        const otherName = conv?.other_name || 'Conversation';
        const otherRole = conv?.other_role || '';

        mainEl.innerHTML = `
            <div class="messenger-conv-header">
                <div class="conv-avatar">${getInitials(otherName)}</div>
                <div class="conv-header-info">
                    <div class="conv-header-name">${esc(otherName)}</div>
                    <div class="conv-header-status">${LABELS.role[otherRole] || ''}</div>
                </div>
            </div>
            <div class="messenger-messages" id="msg-messages">
                ${renderMessages(messages)}
            </div>
            <div class="messenger-input">
                <form id="msg-send-form" onsubmit="msgSendMessage(event)">
                    <input type="text" name="content" placeholder="Écrire un message..." autocomplete="off" required>
                    <button type="submit"><i class="fas fa-paper-plane"></i></button>
                </form>
            </div>
        `;

        // Scroll en bas
        scrollMessagesToBottom();

        // Marquer comme lu
        try {
            await API.markConversationRead(convId);
            await refreshConversationList();
        } catch (e) {
            console.log('Erreur marquage lu:', e);
        }

    } catch (error) {
        mainEl.innerHTML = `<div class="messenger-error"><p class="text-danger">Erreur: ${error.message}</p></div>`;
    }
}

function renderMessages(messages) {
    if (!messages || messages.length === 0) {
        return '<div class="msg-empty">Aucun message. Commencez la conversation !</div>';
    }

    const currentUserId = parseInt(API.user?.id);
    let html = '';
    let lastDateStr = '';

    messages.forEach(msg => {
        // Séparateur de date
        const msgDate = new Date(msg.created_at);
        const dateStr = msgDate.toLocaleDateString('fr-FR');
        if (dateStr !== lastDateStr) {
            html += `<div class="msg-date-sep">${dateStr}</div>`;
            lastDateStr = dateStr;
        }

        // Déterminer si c'est mon message
        const senderId = parseInt(msg.sender_id);
        const isMine = senderId === currentUserId;
        const timeStr = msgDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        html += `
            <div class="msg-bubble ${isMine ? 'msg-mine' : 'msg-other'}">
                <div class="msg-text">${esc(msg.content)}</div>
                <div class="msg-time">${timeStr}</div>
            </div>
        `;
    });

    return html;
}

function scrollMessagesToBottom() {
    const container = document.getElementById('msg-messages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

async function msgSendMessage(e) {
    e.preventDefault();
    
    if (!msgCurrentConvId) {
        toast('Aucune conversation sélectionnée', 'error');
        return;
    }

    const form = e.target;
    const input = form.querySelector('input[name="content"]');
    const content = input.value.trim();

    if (!content) return;

    // Vider l'input immédiatement
    input.value = '';
    input.focus();

    try {
        await API.sendMessage(msgCurrentConvId, content);
        
        // Rafraîchir les messages
        await msgRefreshCurrentConv();
        
    } catch (error) {
        toast('Erreur envoi: ' + error.message, 'error');
    }
}

async function msgRefreshCurrentConv() {
    if (!msgCurrentConvId) return;

    try {
        const res = await API.getConversation(msgCurrentConvId);
        const messagesEl = document.getElementById('msg-messages');
        if (messagesEl && res.messages) {
            const messages = res.messages;
            const newLastId = messages.length > 0 ? messages[messages.length - 1].id : 0;
            
            // Check if there are new messages
            const hasNewMessages = newLastId > msgLastMessageId;
            
            // Update content
            messagesEl.innerHTML = renderMessages(messages);
            
            // Only scroll if there are new messages or it's first load
            if (hasNewMessages || msgLastMessageId === 0) {
                scrollMessagesToBottom();
                
                // Add visual feedback for new messages (not from current user)
                if (hasNewMessages && msgLastMessageId > 0) {
                    const lastMsg = messages[messages.length - 1];
                    const currentUserId = parseInt(API.user?.id);
                    if (parseInt(lastMsg.sender_id) !== currentUserId) {
                        // Flash effect on new message
                        const bubbles = messagesEl.querySelectorAll('.msg-bubble');
                        if (bubbles.length > 0) {
                            const lastBubble = bubbles[bubbles.length - 1];
                            lastBubble.classList.add('msg-new');
                            setTimeout(() => lastBubble.classList.remove('msg-new'), 2000);
                        }
                    }
                }
            }
            
            msgLastMessageId = newLastId;
        }
    } catch (e) {
        console.log('Erreur refresh messages:', e);
    }
}

async function refreshConversationList() {
    try {
        const res = await API.getConversations();
        const oldConversations = [...msgConversations];
        msgConversations = res.conversations || [];
        
        const listEl = document.getElementById('msg-conv-list');
        if (listEl) {
            // Check for new conversations or updated ones
            const hasChanges = JSON.stringify(oldConversations) !== JSON.stringify(msgConversations);
            
            if (hasChanges) {
                listEl.innerHTML = renderConversationList();
                
                // Highlight conversations with new messages
                msgConversations.forEach(conv => {
                    if (parseInt(conv.unread) > 0 && parseInt(conv.id) !== msgCurrentConvId) {
                        const convEl = listEl.querySelector(`.conv-item[data-id="${conv.id}"]`);
                        if (convEl && !convEl.classList.contains('has-unread-notified')) {
                            convEl.classList.add('conv-highlight');
                            setTimeout(() => convEl.classList.remove('conv-highlight'), 2000);
                        }
                    }
                });
            }
        }
    } catch (e) {
        console.log('Erreur refresh convs:', e);
    }
}

function msgStartAutoRefresh() {
    // Arrêter l'ancien interval si existe
    if (msgRefreshInterval) {
        clearInterval(msgRefreshInterval);
    }

    // Reset last message tracking
    msgLastMessageId = 0;

    // Rafraîchir toutes les 3 secondes (plus réactif)
    msgRefreshInterval = setInterval(async () => {
        await refreshConversationList();
        if (msgCurrentConvId) {
            await msgRefreshCurrentConv();
        }
    }, 3000);
}

function msgStopAutoRefresh() {
    if (msgRefreshInterval) {
        clearInterval(msgRefreshInterval);
        msgRefreshInterval = null;
    }
}

// Modal nouvelle conversation
function msgNewConvModal() {
    if (!msgUsers.length) {
        toast('Aucun utilisateur disponible', 'warning');
        return;
    }

    openModal('Nouvelle conversation', `
        <form id="new-conv-form" onsubmit="msgStartNewConv(event)">
            <div class="form-group">
                <label>Destinataire *</label>
                <select name="recipient_id" required>
                    <option value="">-- Sélectionner --</option>
                    ${msgUsers.map(u => `
                        <option value="${u.id}">${esc(u.first_name)} ${esc(u.last_name)} (${LABELS.role[u.role] || u.role})</option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Message *</label>
                <textarea name="content" rows="4" required placeholder="Votre message..."></textarea>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn-primary">Envoyer</button>
            </div>
        </form>
    `);
}

async function msgStartNewConv(e) {
    e.preventDefault();
    
    const form = e.target;
    const recipientId = form.querySelector('[name="recipient_id"]').value;
    const content = form.querySelector('[name="content"]').value.trim();

    if (!recipientId || !content) {
        toast('Veuillez remplir tous les champs', 'warning');
        return;
    }

    try {
        const res = await API.startConversation(parseInt(recipientId), content);
        toast('Message envoyé', 'success');
        closeModal();

        // Rafraîchir et ouvrir la nouvelle conversation
        await refreshConversationList();
        if (res.conversation_id) {
            msgOpenConv(res.conversation_id);
        }

    } catch (error) {
        toast('Erreur: ' + error.message, 'error');
    }
}

// Nettoyage quand on quitte la page
window.addEventListener('beforeunload', msgStopAutoRefresh);
