/**
 * ACL GESTION v2 - Logger Winston
 *
 * Transport console + fichier avec rotation quotidienne.
 * Les fichiers sont ecrits dans le repertoire defini par LOG_DIR (./logs par defaut).
 */
const path = require('path');
const fs = require('fs');
const winston = require('winston');

// ---- Parametres (lus directement depuis process.env pour eviter
//      une dependance circulaire avec config/index.js) ----
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DIR = process.env.LOG_DIR || './logs';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Creer le repertoire de logs s'il n'existe pas
const logDir = path.resolve(LOG_DIR);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ---- Format personnalise ----
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// ---- Format console (avec couleurs en developpement) ----
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// ---- Fonction utilitaire : nom de fichier du jour ----
function dailyFileName(prefix) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(logDir, `${prefix}-${date}.log`);
}

// ---- Transports ----
const transports = [
  // Console (toujours actif)
  new winston.transports.Console({
    level: NODE_ENV === 'development' ? 'debug' : LOG_LEVEL,
    format: consoleFormat
  }),

  // Fichier combine (tous les niveaux)
  new winston.transports.File({
    filename: dailyFileName('combined'),
    level: LOG_LEVEL,
    format: logFormat,
    maxsize: 20 * 1024 * 1024, // 20 Mo par fichier
    maxFiles: 14               // conservation 14 jours
  }),

  // Fichier erreurs uniquement
  new winston.transports.File({
    filename: dailyFileName('error'),
    level: 'error',
    format: logFormat,
    maxsize: 20 * 1024 * 1024,
    maxFiles: 30               // conservation 30 jours pour les erreurs
  })
];

// ---- Instance du logger ----
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'acl-gestion' },
  transports,
  // Ne pas quitter sur les exceptions non gerees
  exitOnError: false,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

module.exports = logger;
