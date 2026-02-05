/**
 * ACL GESTION v2 - Middleware d'upload de fichiers
 *
 * Configure multer pour l'upload de photos et documents PDF,
 * organises par sous-dossier (maintenance, control, evaluations, etc.).
 * Genere des noms de fichiers uniques avec uuid.
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../config/logger');

// ---- Types MIME autorises ----
const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

// ---- Sous-dossiers valides ----
const VALID_SUBFOLDERS = [
  'maintenance',
  'control',
  'evaluations',
  'closures',
  'tasks',
  'linen',
  'avatars'
];

/**
 * Retourne le chemin absolu du repertoire d'upload.
 * @returns {string}
 */
function getUploadBaseDir() {
  return path.resolve(config.upload.dir || './uploads');
}

/**
 * Assure que le repertoire d'upload existe, le cree sinon.
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.debug(`[UPLOAD] Repertoire cree: ${dirPath}`);
  }
}

/**
 * uploadPhoto(subfolder)
 *
 * Retourne un middleware multer configure pour l'upload d'un seul fichier.
 * Le fichier est enregistre dans uploads/<subfolder>/ avec un nom unique (uuid).
 *
 * Types acceptes : JPEG, PNG, GIF, WebP, PDF
 * Taille maximale : config.upload.maxFileSize (10 Mo par defaut)
 *
 * Usage :
 *   router.post('/upload', requireAuth, uploadPhoto('maintenance'), handler);
 *   // Le fichier est accessible via req.file
 *   // req.file.filename  -> nom unique du fichier
 *   // req.file.path      -> chemin complet sur le disque
 *   // req.file.subfolder -> sous-dossier utilise
 *
 * @param {string} subfolder - Sous-dossier de destination (ex: 'maintenance', 'avatars')
 * @returns {Function} Middleware multer pour upload de fichier unique (champ 'photo')
 */
function uploadPhoto(subfolder) {
  // Valider le sous-dossier
  if (!VALID_SUBFOLDERS.includes(subfolder)) {
    logger.warn(`[UPLOAD] Sous-dossier invalide: "${subfolder}". Utilisation de "misc".`);
    subfolder = 'misc';
  }

  // Configuration du stockage sur disque
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(getUploadBaseDir(), subfolder);
      ensureDir(uploadDir);
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generer un nom unique : uuid + extension originale
      const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname).toLowerCase();
      const uniqueName = `${uuidv4()}${ext}`;
      cb(null, uniqueName);
    }
  });

  // Filtre de fichier : n'accepter que les types autorises
  const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      const error = new Error(
        `Type de fichier non autorise: ${file.mimetype}. ` +
        `Types acceptes: JPEG, PNG, GIF, WebP, PDF.`
      );
      error.code = 'INVALID_FILE_TYPE';
      cb(error, false);
    }
  };

  // Creer l'instance multer
  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: config.upload.maxFileSize || 10 * 1024 * 1024, // 10 Mo par defaut
      files: 1 // Un seul fichier a la fois
    }
  });

  // Retourner un middleware qui gere aussi les erreurs multer
  return (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          // Erreurs multer specifiques
          if (err.code === 'LIMIT_FILE_SIZE') {
            const maxMB = Math.round((config.upload.maxFileSize || 10 * 1024 * 1024) / (1024 * 1024));
            return res.status(413).json({
              success: false,
              message: `Fichier trop volumineux. Taille maximale: ${maxMB} Mo.`
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              message: 'Un seul fichier autorise par envoi.'
            });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
              success: false,
              message: 'Champ de fichier inattendu. Utilisez le champ "photo".'
            });
          }
          return res.status(400).json({
            success: false,
            message: `Erreur upload: ${err.message}`
          });
        }

        if (err.code === 'INVALID_FILE_TYPE') {
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }

        logger.error('[UPLOAD] Erreur inattendue:', err);
        return res.status(500).json({
          success: false,
          message: 'Erreur interne lors de l\'upload du fichier.'
        });
      }

      // Ajouter le sous-dossier aux metadonnees du fichier pour reference
      if (req.file) {
        req.file.subfolder = subfolder;
        req.file.url = `/uploads/${subfolder}/${req.file.filename}`;
      }

      next();
    });
  };
}

module.exports = { uploadPhoto };
