/**
 * ACL GESTION v2 - Middleware de verification des permissions
 *
 * Verifie les permissions dynamiques depuis la table role_permissions.
 * Utilise un cache memoire de 5 minutes pour eviter les requetes DB constantes.
 */
const logger = require('../config/logger');

// ---- Cache memoire des permissions ----
// Structure : { role: { permissions: { 'permission.name': true/false }, loadedAt: timestamp } }
const permissionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes en millisecondes

/**
 * Vide le cache des permissions.
 * Utile apres une modification des permissions en BDD.
 */
function clearPermissionCache() {
  permissionCache.clear();
  logger.debug('[PERMISSIONS] Cache vide');
}

/**
 * Vide le cache pour un role specifique.
 * @param {string} role - Le role dont il faut vider le cache
 */
function clearRoleCache(role) {
  permissionCache.delete(role);
  logger.debug(`[PERMISSIONS] Cache vide pour le role: ${role}`);
}

/**
 * Verifie si le cache est encore valide pour un role donne.
 * @param {string} role
 * @returns {boolean}
 */
function isCacheValid(role) {
  const cached = permissionCache.get(role);
  if (!cached) return false;
  return (Date.now() - cached.loadedAt) < CACHE_TTL;
}

/**
 * getUserPermissions(role)
 *
 * Retourne toutes les permissions pour un role donne.
 * Utilise le cache si disponible et valide, sinon charge depuis la BDD.
 *
 * @param {string} role - Le role utilisateur
 * @returns {Promise<Object>} Objet { 'permission.name': true/false, ... }
 */
async function getUserPermissions(role) {
  // Verifier le cache
  if (isCacheValid(role)) {
    return { ...permissionCache.get(role).permissions };
  }

  // Charger depuis la BDD
  // Import dynamique pour eviter les dependances circulaires
  const RolePermission = require('../models/RolePermission');

  try {
    const rows = await RolePermission.findAll({
      where: { role },
      attributes: ['permission', 'allowed'],
      raw: true
    });

    // Construire l'objet de permissions
    const permissions = {};
    for (const row of rows) {
      permissions[row.permission] = row.allowed === 1;
    }

    // Mettre en cache
    permissionCache.set(role, {
      permissions,
      loadedAt: Date.now()
    });

    logger.debug(`[PERMISSIONS] Permissions chargees pour le role "${role}" (${rows.length} regles)`);

    return { ...permissions };
  } catch (error) {
    logger.error(`[PERMISSIONS] Erreur chargement permissions pour role "${role}":`, error);
    throw error;
  }
}

/**
 * hasPermission(role, permission)
 *
 * Fonction utilitaire asynchrone qui verifie si un role possede
 * une permission specifique.
 *
 * @param {string} role - Le role utilisateur
 * @param {string} permission - Le nom de la permission (ex: 'hotels.view')
 * @returns {Promise<boolean>} true si autorise, false sinon
 */
async function hasPermission(role, permission) {
  try {
    const permissions = await getUserPermissions(role);
    return permissions[permission] === true;
  } catch (error) {
    logger.error(`[PERMISSIONS] Erreur verification permission "${permission}" pour role "${role}":`, error);
    return false;
  }
}

/**
 * requirePermission(permission)
 *
 * Middleware generateur qui verifie si l'utilisateur authentifie
 * possede la permission specifiee dans la table role_permissions.
 *
 * Usage :
 *   router.get('/hotels', requireAuth, requirePermission('hotels.view'), handler);
 *   router.post('/hotels', requireAuth, requirePermission('hotels.create'), handler);
 *
 * Retourne 401 si l'utilisateur n'est pas authentifie.
 * Retourne 403 si la permission n'est pas accordee.
 *
 * Doit etre utilise APRES requireAuth.
 *
 * @param {string} permission - Le nom de la permission requise
 * @returns {Function} Middleware Express
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.'
      });
    }

    try {
      const allowed = await hasPermission(req.user.role, permission);

      if (!allowed) {
        logger.warn(
          `[PERMISSIONS] Permission refusee: "${permission}" pour ${req.user.email} ` +
          `(role: ${req.user.role}). Route: ${req.method} ${req.originalUrl}`
        );
        return res.status(403).json({
          success: false,
          message: 'Permission insuffisante pour cette action.'
        });
      }

      next();
    } catch (error) {
      logger.error('[PERMISSIONS] Erreur middleware permission:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur interne lors de la verification des permissions.'
      });
    }
  };
}

module.exports = {
  requirePermission,
  hasPermission,
  getUserPermissions,
  clearPermissionCache,
  clearRoleCache
};
