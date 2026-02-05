/**
 * Chatbot Assistant - ACL GESTION
 * Répond aux questions des utilisateurs de manière contextuelle
 */

// Base de connaissances du chatbot
const CHATBOT_KNOWLEDGE = {
    // Salutations
    greetings: {
        patterns: ['bonjour', 'salut', 'hello', 'bonsoir', 'coucou', 'hey', 'hi'],
        responses: [
            "Bonjour ! Je suis l'assistant ACL GESTION. Comment puis-je vous aider ?",
            "Bonjour ! Que puis-je faire pour vous aujourd'hui ?",
            "Salut ! Je suis là pour répondre à vos questions sur la plateforme."
        ]
    },
    
    // Aide générale
    help: {
        patterns: ['aide', 'help', 'comment', 'besoin d\'aide', 'assistance', 'soutien'],
        responses: [
            "Je peux vous aider avec :\n• **Maintenance** - Créer/suivre des tickets\n• **Gouvernante** - Dispatch des chambres\n• **Congés** - Demandes et validation\n• **Blanchisserie** - Collectes et réceptions\n• **Tâches** - Gestion Kanban\n• **Évaluations** - Grilles et suivi\n\nQue souhaitez-vous savoir ?"
        ]
    },
    
    // Maintenance
    maintenance: {
        patterns: ['maintenance', 'ticket', 'panne', 'réparation', 'problème technique', 'réparer', 'casse', 'fuite', 'électricité', 'plomberie'],
        responses: [
            "Pour créer un ticket de maintenance :\n1. Allez dans **Maintenance** depuis le menu\n2. Cliquez sur **Nouveau ticket**\n3. Sélectionnez l'hôtel, la catégorie et la priorité\n4. Décrivez le problème et ajoutez une photo si nécessaire\n\nVoulez-vous que je vous y emmène ?"
        ],
        action: { type: 'navigate', page: 'maintenance' }
    },
    
    // Gouvernante / Dispatch
    gouvernante: {
        patterns: ['gouvernante', 'dispatch', 'chambre', 'nettoyage', 'ménage', 'femme de chambre', 'housekeeping', 'blanc', 'recouche'],
        responses: [
            "Le module **Gouvernante** permet de :\n• Dispatcher les chambres aux femmes de chambre\n• Suivre l'avancement du nettoyage\n• Effectuer les contrôles qualité\n\nTypes de nettoyage :\n• **À blanc** : Nettoyage complet (changement départ)\n• **Recouche** : Nettoyage léger (client reste)\n\nBesoin d'aide pour dispatcher des chambres ?"
        ],
        action: { type: 'navigate', page: 'housekeeping' }
    },
    
    // Congés
    conges: {
        patterns: ['congé', 'conges', 'vacances', 'absence', 'repos', 'rtt', 'cp', 'jour off', 'demande congé'],
        responses: [
            "Pour demander un congé :\n1. Allez dans **Congés** depuis le menu\n2. Cliquez sur **Nouvelle demande**\n3. Sélectionnez les dates et le type (CP, RTT, etc.)\n4. Ajoutez un commentaire si nécessaire\n\nVotre manager sera notifié pour validation.\n\nVoulez-vous faire une demande maintenant ?"
        ],
        action: { type: 'navigate', page: 'leaves' }
    },
    
    // Blanchisserie
    blanchisserie: {
        patterns: ['blanchisserie', 'linge', 'draps', 'housse', 'collecte', 'réception', 'lavage'],
        responses: [
            "Le module **Blanchisserie** permet de :\n• Enregistrer les collectes de linge sale\n• Enregistrer les réceptions de linge propre\n• Suivre les écarts entre collecte et réception\n• Consulter l'historique par hôtel\n\nTypes de linge suivis : petits draps, grandes housses, etc."
        ],
        action: { type: 'navigate', page: 'linen' }
    },
    
    // Tâches
    taches: {
        patterns: ['tâche', 'tache', 'kanban', 'todo', 'à faire', 'tableau', 'projet', 'assigner'],
        responses: [
            "Le module **Tâches** fonctionne comme un Kanban :\n• Créez des tableaux par projet/équipe\n• Ajoutez des colonnes personnalisées\n• Créez des tâches avec priorité et échéance\n• Assignez aux membres de l'équipe\n• Déplacez les tâches entre colonnes\n\nIdéal pour organiser le travail d'équipe !"
        ],
        action: { type: 'navigate', page: 'tasks' }
    },
    
    // Évaluations
    evaluations: {
        patterns: ['évaluation', 'evaluation', 'grille', 'noter', 'performance', 'entretien', 'bilan'],
        responses: [
            "Le module **Évaluations** permet de :\n• Créer des grilles d'évaluation personnalisées\n• Évaluer les employés avec des critères pondérés\n• Suivre l'historique des évaluations\n• Générer des rapports de performance\n\nAccessible aux managers et RH."
        ],
        action: { type: 'navigate', page: 'evaluations' }
    },
    
    // Messages
    messages: {
        patterns: ['message', 'messagerie', 'contacter', 'écrire', 'envoyer', 'communication', 'mail'],
        responses: [
            "La **Messagerie** interne permet de :\n• Envoyer des messages à un collègue\n• Envoyer des messages à tout un hôtel\n• Diffuser à tous (broadcast)\n• Recevoir des notifications\n\nIdéal pour la communication d'équipe !"
        ],
        action: { type: 'navigate', page: 'messages' }
    },
    
    // Hôtels
    hotels: {
        patterns: ['hôtel', 'hotel', 'établissement', 'propriété', 'chambres', 'étages'],
        responses: [
            "Le module **Hôtels** permet de :\n• Voir la liste de vos établissements\n• Gérer les chambres (numéro, étage, type)\n• Configurer les paramètres par hôtel\n\nLes admins peuvent créer/modifier les hôtels."
        ],
        action: { type: 'navigate', page: 'hotels' }
    },
    
    // Utilisateurs
    utilisateurs: {
        patterns: ['utilisateur', 'compte', 'profil', 'mot de passe', 'employé', 'équipe', 'personnel'],
        responses: [
            "La gestion des **Utilisateurs** permet de :\n• Créer des comptes utilisateurs\n• Assigner des rôles (Admin, Manager, Employé, RH, Comptabilité)\n• Associer les utilisateurs à des hôtels\n• Gérer les permissions\n\nAccessible aux administrateurs et RH."
        ],
        action: { type: 'navigate', page: 'users' }
    },
    
    // Paramètres
    parametres: {
        patterns: ['paramètre', 'parametre', 'configuration', 'réglage', 'permission', 'module', 'activer', 'désactiver'],
        responses: [
            "Les **Paramètres** (admin uniquement) permettent de :\n• Activer/désactiver des modules\n• Configurer les permissions par rôle\n• Personnaliser le système\n\nLes modules désactivés disparaissent du menu pour tous."
        ],
        action: { type: 'navigate', page: 'settings' }
    },
    
    // Rôles
    roles: {
        patterns: ['rôle', 'role', 'permission', 'droit', 'accès', 'admin', 'manager', 'responsable'],
        responses: [
            "Les rôles disponibles sont :\n\n• **Admin** - Accès complet\n• **Resp. Groupe** - Gère plusieurs hôtels\n• **Resp. Hôtel** - Gère un hôtel\n• **Comptabilité** - Rapports et blanchisserie\n• **RH** - Congés, évaluations, personnel\n• **Employé** - Accès limité aux tâches quotidiennes\n\nChaque rôle a des permissions spécifiques."
        ]
    },
    
    // Dashboard
    dashboard: {
        patterns: ['dashboard', 'tableau de bord', 'accueil', 'résumé', 'statistiques', 'stats'],
        responses: [
            "Le **Dashboard** affiche un résumé de :\n• Vos hôtels et chambres\n• Tickets de maintenance ouverts\n• Dispatch du jour\n• Tâches en cours\n• Congés en attente\n• Messages non lus\n\nC'est votre vue d'ensemble quotidienne !"
        ],
        action: { type: 'navigate', page: 'dashboard' }
    },
    
    // Urgence
    urgence: {
        patterns: ['urgent', 'urgence', 'critique', 'important', 'immédiat', 'vite'],
        responses: [
            "Pour une **urgence** :\n1. Créez un ticket de maintenance avec priorité **Critique**\n2. Les managers seront notifiés immédiatement\n3. Les tickets critiques apparaissent en rouge sur le dashboard\n\nVoulez-vous créer un ticket urgent maintenant ?"
        ],
        action: { type: 'navigate', page: 'maintenance' }
    },
    
    // Merci
    thanks: {
        patterns: ['merci', 'thanks', 'super', 'génial', 'parfait', 'excellent'],
        responses: [
            "Avec plaisir ! N'hésitez pas si vous avez d'autres questions. 😊",
            "Je vous en prie ! Je suis là pour vous aider.",
            "De rien ! Bonne continuation sur ACL GESTION."
        ]
    },
    
    // Au revoir
    bye: {
        patterns: ['au revoir', 'bye', 'à bientôt', 'salut', 'ciao', 'bonne journée'],
        responses: [
            "Au revoir ! Bonne continuation. 👋",
            "À bientôt ! N'hésitez pas à revenir si besoin.",
            "Bonne journée ! L'assistant reste disponible à tout moment."
        ]
    }
};

// Réponse par défaut
const DEFAULT_RESPONSES = [
    "Je ne suis pas sûr de comprendre votre question. Pouvez-vous reformuler ?",
    "Je n'ai pas trouvé d'information sur ce sujet. Essayez de me poser une question sur : maintenance, congés, gouvernante, blanchisserie, tâches, ou évaluations.",
    "Désolé, je ne peux pas répondre à cette question. Tapez 'aide' pour voir ce que je peux faire."
];

// État du chatbot
let chatbotOpen = false;
let chatHistory = [];

// Initialiser le chatbot
function initChatbot() {
    // Créer le bouton flottant et le conteneur
    const chatbotHTML = `
        <div id="chatbot-button" onclick="toggleChatbot()">
            <i class="fas fa-comments"></i>
            <span class="chatbot-badge hidden">1</span>
        </div>
        
        <div id="chatbot-container" class="hidden">
            <div class="chatbot-header">
                <div class="chatbot-title">
                    <i class="fas fa-robot"></i>
                    <span>Assistant ACL</span>
                </div>
                <div class="chatbot-actions">
                    <button onclick="clearChatHistory()" title="Effacer l'historique"><i class="fas fa-trash"></i></button>
                    <button onclick="toggleChatbot()" title="Fermer"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="chatbot-messages" id="chatbot-messages">
                <div class="chat-message bot">
                    <div class="message-avatar"><i class="fas fa-robot"></i></div>
                    <div class="message-content">
                        Bonjour ${API.user ? API.user.first_name : ''} ! 👋<br>
                        Je suis l'assistant ACL GESTION. Comment puis-je vous aider ?
                    </div>
                </div>
            </div>
            <div class="chatbot-input">
                <input type="text" id="chatbot-input" placeholder="Posez votre question..." onkeypress="handleChatKeypress(event)">
                <button onclick="sendChatMessage()"><i class="fas fa-paper-plane"></i></button>
            </div>
            <div class="chatbot-suggestions">
                <button onclick="askQuestion('Comment créer un ticket ?')">Créer un ticket</button>
                <button onclick="askQuestion('Comment demander un congé ?')">Demander congé</button>
                <button onclick="askQuestion('Aide')">Aide</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
    
    // Initialiser la gestion du clavier mobile
    handleMobileKeyboard();
}

// Ouvrir/Fermer le chatbot
function toggleChatbot() {
    chatbotOpen = !chatbotOpen;
    const container = document.getElementById('chatbot-container');
    const button = document.getElementById('chatbot-button');
    
    if (chatbotOpen) {
        container.classList.remove('hidden');
        button.classList.add('active');
        document.getElementById('chatbot-input').focus();
        // Masquer le badge
        button.querySelector('.chatbot-badge').classList.add('hidden');
        // Empêcher le scroll du body sur mobile
        if (window.innerWidth <= 480) {
            document.body.style.overflow = 'hidden';
        }
    } else {
        container.classList.add('hidden');
        button.classList.remove('active');
        // Réactiver le scroll du body
        document.body.style.overflow = '';
    }
}

// Fermer le chatbot avec la touche Escape ou le bouton retour
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && chatbotOpen) {
        toggleChatbot();
    }
});

// Gérer le bouton retour sur mobile (Android)
window.addEventListener('popstate', function(e) {
    if (chatbotOpen) {
        e.preventDefault();
        toggleChatbot();
        // Remettre l'état de l'historique
        history.pushState(null, '', window.location.href);
    }
});

// Envoyer un message
function sendChatMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Ajouter le message utilisateur
    addChatMessage(message, 'user');
    input.value = '';
    
    // Simuler un délai de réflexion
    showTypingIndicator();
    
    setTimeout(() => {
        hideTypingIndicator();
        const response = generateResponse(message);
        addChatMessage(response.text, 'bot', response.action);
    }, 500 + Math.random() * 500);
}

// Poser une question prédéfinie
function askQuestion(question) {
    document.getElementById('chatbot-input').value = question;
    sendChatMessage();
}

// Générer une réponse
function generateResponse(userMessage) {
    const message = userMessage.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    let bestMatch = null;
    let bestScore = 0;
    
    // Chercher la meilleure correspondance
    for (const [key, knowledge] of Object.entries(CHATBOT_KNOWLEDGE)) {
        for (const pattern of knowledge.patterns) {
            const normalizedPattern = pattern.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            if (message.includes(normalizedPattern)) {
                const score = normalizedPattern.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = knowledge;
                }
            }
        }
    }
    
    if (bestMatch) {
        const responseText = bestMatch.responses[Math.floor(Math.random() * bestMatch.responses.length)];
        return {
            text: responseText,
            action: bestMatch.action || null
        };
    }
    
    // Réponse par défaut
    return {
        text: DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)],
        action: null
    };
}

// Ajouter un message au chat
function addChatMessage(text, sender, action = null) {
    const container = document.getElementById('chatbot-messages');
    
    const messageHTML = `
        <div class="chat-message ${sender}">
            <div class="message-avatar">
                <i class="fas fa-${sender === 'bot' ? 'robot' : 'user'}"></i>
            </div>
            <div class="message-content">
                ${sender === 'bot' ? formatMessage(text) : esc(text)}
                ${action ? `<button class="chat-action-btn" onclick="executeChatAction('${esc(action.type)}', '${esc(action.page)}')">
                    <i class="fas fa-arrow-right"></i> Aller à ${esc(action.page)}
                </button>` : ''}
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', messageHTML);
    container.scrollTop = container.scrollHeight;
    
    // Sauvegarder dans l'historique
    chatHistory.push({ text, sender, timestamp: new Date() });
}

// Formater le message (markdown simple)
function formatMessage(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

// Exécuter une action
function executeChatAction(type, page) {
    if (type === 'navigate') {
        toggleChatbot();
        navigateTo(page);
    }
}

// Indicateur de frappe
function showTypingIndicator() {
    const container = document.getElementById('chatbot-messages');
    const typingHTML = `
        <div class="chat-message bot typing-indicator" id="typing-indicator">
            <div class="message-avatar"><i class="fas fa-robot"></i></div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', typingHTML);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

// Effacer l'historique
function clearChatHistory() {
    const container = document.getElementById('chatbot-messages');
    container.innerHTML = `
        <div class="chat-message bot">
            <div class="message-avatar"><i class="fas fa-robot"></i></div>
            <div class="message-content">
                Historique effacé. Comment puis-je vous aider ?
            </div>
        </div>
    `;
    chatHistory = [];
}

// Gérer la touche Entrée
function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendChatMessage();
        // Fermer le clavier sur mobile après envoi
        if (window.innerWidth <= 480) {
            document.getElementById('chatbot-input').blur();
        }
    }
}

// Scroll vers le bas quand le clavier s'ouvre sur mobile
function handleMobileKeyboard() {
    const input = document.getElementById('chatbot-input');
    if (input) {
        input.addEventListener('focus', function() {
            if (window.innerWidth <= 480) {
                setTimeout(() => {
                    const messages = document.getElementById('chatbot-messages');
                    if (messages) {
                        messages.scrollTop = messages.scrollHeight;
                    }
                }, 300);
            }
        });
    }
}

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', function() {
    // Le chatbot sera initialisé après la connexion
});
