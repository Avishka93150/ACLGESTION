/**
 * ACL GESTION - Landing Page JavaScript
 * For acl-gestion.com
 */

// Configuration
const CONFIG = {
    API_URL: 'https://app.acl-gestion.com/api',
    APP_URL: 'https://app.acl-gestion.com'
};

let captchaAnswer = 0;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    generateCaptcha();
    initSmoothScroll();
});

// Generate math captcha
function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    captchaAnswer = num1 + num2;

    const questionEl = document.getElementById('captcha-question');
    if (questionEl) {
        questionEl.innerHTML = `<strong>${num1} + ${num2} = </strong>`;
    }
}

// Initialize smooth scroll for anchor links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Scroll to contact section
function scrollToContact() {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Toggle mobile menu
function toggleLandingMenu() {
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.querySelector('.nav-toggle');

    if (navMenu) {
        const isOpen = navMenu.classList.contains('open');
        navMenu.classList.toggle('open');

        if (navToggle) {
            navToggle.innerHTML = isOpen ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-times"></i>';
        }
    }
}

// Close landing menu
function closeLandingMenu() {
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.querySelector('.nav-toggle');

    if (navMenu) {
        navMenu.classList.remove('open');
        if (navToggle) {
            navToggle.innerHTML = '<i class="fas fa-bars"></i>';
        }
    }
}

// Submit contact form
async function submitContactForm(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const btn = document.getElementById('contact-submit-btn');

    // Honeypot check (anti-bot)
    if (formData.get('website')) {
        toast('Erreur de validation', 'error');
        return;
    }

    // Captcha check
    const userAnswer = parseInt(formData.get('captcha'));
    if (userAnswer !== captchaAnswer) {
        toast('Reponse anti-robot incorrecte', 'error');
        generateCaptcha();
        return;
    }

    // Prepare data
    const contactData = {
        name: formData.get('name'),
        firstname: formData.get('firstname'),
        email: formData.get('email'),
        phone: formData.get('phone') || null,
        company: formData.get('company'),
        hotels_count: formData.get('hotels_count') || null,
        message: formData.get('message') || null
    };

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';

    try {
        const response = await fetch(`${CONFIG.API_URL}/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactData)
        });

        const result = await response.json();

        if (result.success) {
            toast('Votre demande a bien ete envoyee. Nous vous contacterons rapidement.', 'success');
            form.reset();
            generateCaptcha();
        } else {
            toast(result.message || 'Erreur lors de l\'envoi', 'error');
        }
    } catch (error) {
        toast('Erreur de connexion. Veuillez reessayer.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Envoyer ma demande <i class="fas fa-paper-plane"></i>';
    }
}

// Toast notification
function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Escape HTML for XSS prevention
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Modal functions
function openModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.body.style.overflow = '';
}

// Legal notices
function showLegalNotice() {
    openModal('Mentions legales', `
        <div class="legal-content">
            <h4>Editeur du site</h4>
            <p>ACL GESTION<br>
            Paris, France<br>
            Email : contact@acl-gestion.com</p>

            <h4>Hebergement</h4>
            <p>OVH SAS<br>
            2 rue Kellermann<br>
            59100 Roubaix - France</p>

            <h4>Propriete intellectuelle</h4>
            <p>L'ensemble du contenu de ce site (textes, images, logos, etc.) est protege par le droit d'auteur. Toute reproduction, meme partielle, est interdite sans autorisation prealable.</p>

            <h4>Donnees personnelles</h4>
            <p>Les donnees collectees via le formulaire de contact sont utilisees uniquement pour repondre a vos demandes. Conformement au RGPD, vous disposez d'un droit d'acces, de rectification et de suppression de vos donnees.</p>
        </div>
    `);
}

function showPrivacyPolicy() {
    openModal('Politique de confidentialite', `
        <div class="legal-content">
            <h4>Collecte des donnees</h4>
            <p>Nous collectons uniquement les donnees necessaires pour repondre a vos demandes de contact et de demonstration.</p>

            <h4>Utilisation des donnees</h4>
            <p>Vos donnees sont utilisees pour :</p>
            <ul>
                <li>Repondre a vos demandes de contact</li>
                <li>Vous proposer une demonstration de notre plateforme</li>
                <li>Ameliorer nos services</li>
            </ul>

            <h4>Conservation des donnees</h4>
            <p>Vos donnees sont conservees pendant une duree de 3 ans maximum apres le dernier contact.</p>

            <h4>Vos droits</h4>
            <p>Conformement au RGPD, vous disposez des droits suivants :</p>
            <ul>
                <li>Droit d'acces a vos donnees</li>
                <li>Droit de rectification</li>
                <li>Droit a l'effacement</li>
                <li>Droit a la portabilite</li>
                <li>Droit d'opposition</li>
            </ul>
            <p>Pour exercer ces droits, contactez-nous : contact@acl-gestion.com</p>

            <h4>Cookies</h4>
            <p>Ce site n'utilise pas de cookies de suivi. Seuls des cookies techniques essentiels sont utilises.</p>
        </div>
    `);
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
