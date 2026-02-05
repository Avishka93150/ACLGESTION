/**
 * ACL GESTION v2 - Fonctions utilitaires generales
 *
 * Regroupe les fonctions d'aide courantes utilisees a travers l'application :
 * formatage de dates, securite, pagination, etc.
 */
const crypto = require('crypto');

// ============================================================
// Formatage de dates
// ============================================================

/**
 * formatDate(date, format)
 *
 * Formate une date en locale francaise.
 *
 * Formats supportes :
 *   'short'    -> 05/02/2026
 *   'long'     -> 5 fevrier 2026
 *   'datetime' -> 05/02/2026 14:30
 *   'time'     -> 14:30
 *   'iso'      -> 2026-02-05
 *   'relative' -> il y a 2 heures (approximatif)
 *
 * @param {Date|string|number} date - Date a formater
 * @param {string} [format='short'] - Format de sortie
 * @returns {string} Date formatee
 */
function formatDate(date, format = 'short') {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');

  const day = d.getDate();
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  const monthNames = [
    'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'
  ];

  switch (format) {
    case 'short':
      return `${pad(day)}/${pad(month + 1)}/${year}`;

    case 'long':
      return `${day} ${monthNames[month]} ${year}`;

    case 'datetime':
      return `${pad(day)}/${pad(month + 1)}/${year} ${hours}:${minutes}`;

    case 'time':
      return `${hours}:${minutes}`;

    case 'iso':
      return `${year}-${pad(month + 1)}-${pad(day)}`;

    case 'relative': {
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMin < 1) return 'a l\'instant';
      if (diffMin < 60) return `il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
      if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
      if (diffDays < 30) return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
      if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `il y a ${months} mois`;
      }
      const years = Math.floor(diffDays / 365);
      return `il y a ${years} an${years > 1 ? 's' : ''}`;
    }

    default:
      return `${pad(day)}/${pad(month + 1)}/${year}`;
  }
}

// ============================================================
// Securite
// ============================================================

/**
 * escapeHtml(str)
 *
 * Echappe les caracteres speciaux HTML pour prevenir les attaques XSS.
 *
 * @param {string} str - Chaine a echapper
 * @returns {string} Chaine echappee
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * generatePassword(length)
 *
 * Genere un mot de passe aleatoire cryptographiquement securise
 * contenant des lettres majuscules, minuscules, chiffres et caracteres speciaux.
 *
 * @param {number} [length=12] - Longueur du mot de passe
 * @returns {string} Mot de passe genere
 */
function generatePassword(length = 12) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*()_+-=';
  const allChars = uppercase + lowercase + digits + special;

  // S'assurer qu'il y a au moins un caractere de chaque type
  let password = '';
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += digits[crypto.randomInt(digits.length)];
  password += special[crypto.randomInt(special.length)];

  // Completer avec des caracteres aleatoires
  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Melanger les caracteres pour eviter un pattern previsible
  const arr = password.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.join('');
}

// ============================================================
// Manipulation de chaines
// ============================================================

/**
 * slugify(str)
 *
 * Convertit une chaine en slug URL-safe.
 * Supprime les accents, convertit en minuscules, remplace les espaces par des tirets.
 *
 * @param {string} str - Chaine a convertir
 * @returns {string} Slug
 */
function slugify(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')                    // Decomposer les caracteres accentues
    .replace(/[\u0300-\u036f]/g, '')     // Supprimer les diacritiques
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')        // Supprimer les caracteres speciaux
    .replace(/[\s_]+/g, '-')             // Remplacer espaces et underscores par des tirets
    .replace(/-+/g, '-')                 // Supprimer les tirets multiples
    .replace(/^-|-$/g, '');              // Supprimer les tirets en debut/fin
}

/**
 * sanitizeFilename(filename)
 *
 * Nettoie un nom de fichier en supprimant les caracteres dangereux.
 * Conserve l'extension et remplace les espaces par des underscores.
 *
 * @param {string} filename - Nom de fichier a nettoyer
 * @returns {string} Nom de fichier assaini
 */
function sanitizeFilename(filename) {
  if (!filename) return 'fichier';
  return String(filename)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')     // Supprimer les accents
    .replace(/[^a-zA-Z0-9._-]/g, '_')   // Remplacer les caracteres dangereux
    .replace(/_+/g, '_')                 // Supprimer les underscores multiples
    .replace(/^[._]+/, '')               // Supprimer les points/underscores en debut
    .substring(0, 255);                  // Limiter la longueur
}

// ============================================================
// Pagination
// ============================================================

/**
 * paginate(query, page, limit)
 *
 * Ajoute les options LIMIT et OFFSET a un objet d'options de requete Sequelize.
 * Retourne l'objet modifie avec les proprietes limit et offset.
 *
 * Usage :
 *   const options = paginate({}, req.query.page, req.query.limit);
 *   const { count, rows } = await Model.findAndCountAll(options);
 *
 * @param {Object} query   - Options de requete Sequelize existantes
 * @param {number|string} [page=1]  - Numero de page (commence a 1)
 * @param {number|string} [limit=20] - Nombre d'elements par page
 * @returns {Object} Options de requete enrichies avec limit et offset
 */
function paginate(query = {}, page = 1, limit = 20) {
  // Normaliser et borner les valeurs
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (parsedPage - 1) * parsedLimit;

  return {
    ...query,
    limit: parsedLimit,
    offset
  };
}

// ============================================================
// Calculs metier
// ============================================================

/**
 * calculateWorkDays(startDate, endDate)
 *
 * Calcule le nombre de jours ouvrables (lundi-vendredi) entre deux dates,
 * bornes incluses. Exclut uniquement les samedis et dimanches.
 * Les jours feries ne sont pas exclus (a gerer separement si besoin).
 *
 * @param {Date|string} startDate - Date de debut
 * @param {Date|string} endDate   - Date de fin
 * @returns {number} Nombre de jours ouvrables
 */
function calculateWorkDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  // Normaliser les heures pour comparer uniquement les dates
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = dimanche, 6 = samedi
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

module.exports = {
  formatDate,
  escapeHtml,
  generatePassword,
  slugify,
  paginate,
  calculateWorkDays,
  sanitizeFilename
};
