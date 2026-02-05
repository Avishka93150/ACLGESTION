/**
 * ACL GESTION v2 - Middleware d'authentification JWT
 *
 * Verifie le token JWT depuis l'en-tete Authorization: Bearer <token>.
 * Attache l'utilisateur complet (sans mot de passe) a req.user.
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../config/logger');

/**
 * requireAuth
 *
 * Middleware qui :
 *  1. Extrait le token JWT du header Authorization: Bearer <token>
 *  2. Verifie et decode le token avec config.jwt.secret
 *  3. Charge l'utilisateur complet depuis la BDD (sans le champ password)
 *  4. Attache l'objet utilisateur a req.user
 *
 * Retourne 401 si le token est absent, invalide ou expire.
 * Retourne 403 si le compte utilisateur est inactif.
 */
async function requireAuth(req, res, next) {
  try {
    // 1. Extraire le token du header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acces refuse. Token d\'authentification requis.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acces refuse. Token d\'authentification requis.'
      });
    }

    // 2. Verifier et decoder le token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expiree. Veuillez vous reconnecter.'
        });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Token invalide.'
        });
      }
      throw err;
    }

    // 3. Charger l'utilisateur complet depuis la BDD
    // Import dynamique pour eviter les dependances circulaires au demarrage
    const User = require('../models/User');

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur introuvable. Le compte a peut-etre ete supprime.'
      });
    }

    // 4. Verifier que le compte est actif
    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Compte desactive. Contactez votre administrateur.'
      });
    }

    // 5. Attacher l'utilisateur a la requete
    req.user = user;

    next();
  } catch (error) {
    logger.error('[AUTH] Erreur middleware authentification:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne lors de l\'authentification.'
    });
  }
}

/**
 * requireRole(...roles)
 *
 * Middleware generateur qui verifie si le role de l'utilisateur authentifie
 * fait partie de la liste des roles autorises.
 *
 * Usage :
 *   router.get('/admin', requireAuth, requireRole('admin'), handler);
 *   router.get('/manage', requireAuth, requireRole('admin', 'groupe_manager', 'hotel_manager'), handler);
 *
 * Retourne 403 si le role n'est pas dans la liste.
 * Doit etre utilise APRES requireAuth.
 *
 * @param  {...string} roles - Liste des roles autorises
 * @returns {Function} Middleware Express
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `[AUTH] Acces refuse pour ${req.user.email} (role: ${req.user.role}). ` +
        `Roles requis: ${roles.join(', ')}. Route: ${req.method} ${req.originalUrl}`
      );
      return res.status(403).json({
        success: false,
        message: 'Acces refuse. Vous n\'avez pas les droits necessaires.'
      });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
