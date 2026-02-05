/**
 * ACL GESTION v2 - Middleware de limitation de debit (Rate Limiting)
 *
 * Protege les routes sensibles contre les abus et les attaques par force brute.
 * Utilise express-rate-limit avec stockage memoire.
 */
const rateLimit = require('express-rate-limit');

/**
 * loginLimiter
 *
 * Limite les tentatives de connexion a 5 par fenetre de 15 minutes par IP.
 * Protege contre les attaques par force brute sur l'authentification.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 tentatives maximum
  standardHeaders: true,     // Retourne les headers RateLimit-*
  legacyHeaders: false,      // Desactive X-RateLimit-*
  skipSuccessfulRequests: false,
  message: {
    success: false,
    message: 'Trop de tentatives de connexion. Veuillez reessayer dans 15 minutes.'
  },
  keyGenerator: (req) => {
    // Utiliser X-Forwarded-For si derriere un proxy, sinon l'IP directe
    return req.ip || req.connection.remoteAddress;
  }
});

/**
 * apiLimiter
 *
 * Limite generale pour les routes API : 100 requetes par minute par IP.
 * Previent les abus generaux de l'API.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 100,                  // 100 requetes maximum
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requetes. Veuillez patienter avant de reessayer.'
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

/**
 * contactLimiter
 *
 * Limite les soumissions de formulaire de contact : 3 par heure par IP.
 * Previent le spam de messages de contact.
 */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3,                    // 3 requetes maximum
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de messages envoyes. Veuillez reessayer dans une heure.'
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

module.exports = { loginLimiter, apiLimiter, contactLimiter };
