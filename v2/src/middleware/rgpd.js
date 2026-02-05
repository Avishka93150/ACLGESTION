/**
 * ACL GESTION v2 - Middleware RGPD / Journal des acces
 *
 * Enregistre les actions utilisateur dans la table access_logs
 * pour la conformite RGPD (Reglement General sur la Protection des Donnees).
 *
 * Chaque entree de log contient :
 *   - user_id    : identifiant de l'utilisateur connecte
 *   - action     : type d'action (login, view, create, update, delete, export)
 *   - resource   : ressource concernee (users, hotels, closures, etc.)
 *   - resource_id: identifiant de la ressource (depuis req.params.id)
 *   - ip_address : adresse IP du client
 *   - user_agent : agent utilisateur du navigateur
 *   - created_at : horodatage de l'action
 */
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const logger = require('../config/logger');

/**
 * logAccess(action, resource)
 *
 * Retourne un middleware Express qui enregistre l'acces dans la table access_logs.
 * Le log est effectue de maniere asynchrone (non-bloquant) pour ne pas ralentir
 * la reponse HTTP.
 *
 * Usage :
 *   router.get('/users',     requireAuth, logAccess('view', 'users'),   listUsers);
 *   router.get('/users/:id', requireAuth, logAccess('view', 'users'),   getUser);
 *   router.post('/users',    requireAuth, logAccess('create', 'users'), createUser);
 *   router.put('/users/:id', requireAuth, logAccess('update', 'users'), updateUser);
 *   router.delete('/users/:id', requireAuth, logAccess('delete', 'users'), deleteUser);
 *   router.get('/export/users', requireAuth, logAccess('export', 'users'), exportUsers);
 *
 * @param {string} action   - Type d'action : login, logout, view, create, update, delete, export
 * @param {string} resource - Nom de la ressource : users, hotels, rooms, closures, etc.
 * @returns {Function} Middleware Express
 */
function logAccess(action, resource) {
  return (req, res, next) => {
    // Enregistrer le log de maniere asynchrone (fire-and-forget)
    // pour ne pas bloquer la reponse
    const userId = req.user ? req.user.id : null;
    const resourceId = req.params.id ? parseInt(req.params.id, 10) || null : null;
    const ipAddress = getClientIp(req);
    const userAgent = (req.headers['user-agent'] || '').substring(0, 500);

    // Execution asynchrone sans await pour ne pas ralentir la requete
    insertAccessLog(userId, action, resource, resourceId, ipAddress, userAgent)
      .catch(err => {
        logger.error('[RGPD] Erreur enregistrement access_log:', err);
      });

    next();
  };
}

/**
 * Insere une entree dans la table access_logs.
 *
 * @param {number|null} userId
 * @param {string} action
 * @param {string} resource
 * @param {number|null} resourceId
 * @param {string} ipAddress
 * @param {string} userAgent
 */
async function insertAccessLog(userId, action, resource, resourceId, ipAddress, userAgent) {
  try {
    await sequelize.query(
      `INSERT INTO access_logs (user_id, action, resource, resource_id, ip_address, user_agent, created_at)
       VALUES (:userId, :action, :resource, :resourceId, :ipAddress, :userAgent, NOW())`,
      {
        replacements: {
          userId,
          action,
          resource,
          resourceId,
          ipAddress,
          userAgent
        },
        type: QueryTypes.INSERT
      }
    );
  } catch (error) {
    // On log l'erreur mais on ne la propage pas pour ne pas affecter la requete
    logger.error(`[RGPD] Echec insertion access_log: action=${action}, resource=${resource}`, error);
  }
}

/**
 * Extrait l'adresse IP du client en tenant compte des proxys.
 *
 * @param {Object} req - Requete Express
 * @returns {string} Adresse IP
 */
function getClientIp(req) {
  // X-Forwarded-For peut contenir une liste : "client, proxy1, proxy2"
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // X-Real-IP (Nginx)
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  return req.ip || req.connection.remoteAddress || 'unknown';
}

module.exports = { logAccess };
