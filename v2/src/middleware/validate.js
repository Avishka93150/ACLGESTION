/**
 * ACL GESTION v2 - Middleware de validation des entrees
 *
 * Utilise express-validator pour definir des chaines de validation
 * reutilisables pour chaque type de ressource.
 */
const { body, validationResult } = require('express-validator');

/**
 * handleValidation
 *
 * Middleware qui verifie les resultats de express-validator.
 * Si des erreurs existent, retourne une reponse 422 avec le detail des erreurs.
 * Sinon, passe au middleware suivant.
 *
 * Usage :
 *   router.post('/login', validateLogin, handleValidation, loginHandler);
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));

    return res.status(422).json({
      success: false,
      message: 'Donnees invalides.',
      errors: formattedErrors
    });
  }

  next();
}

// ============================================================
// Chaines de validation par ressource
// ============================================================

/**
 * validateLogin
 *
 * Valide les champs de connexion : email et mot de passe.
 */
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Adresse email invalide.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis.')
    .isLength({ min: 1 })
    .withMessage('Le mot de passe est requis.')
];

/**
 * validateHotel
 *
 * Valide les champs de creation/modification d'un hotel.
 */
const validateHotel = [
  body('name')
    .notEmpty()
    .withMessage('Le nom de l\'hotel est requis.')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Le nom doit contenir entre 1 et 255 caracteres.'),
  body('address')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('L\'adresse ne peut pas depasser 500 caracteres.'),
  body('city')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('La ville ne peut pas depasser 100 caracteres.'),
  body('postal_code')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 10 })
    .withMessage('Le code postal ne peut pas depasser 10 caracteres.'),
  body('phone')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Le telephone ne peut pas depasser 20 caracteres.'),
  body('email')
    .optional({ nullable: true })
    .isEmail()
    .withMessage('Adresse email de l\'hotel invalide.')
    .normalizeEmail(),
  body('stars')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 5 })
    .withMessage('Le nombre d\'etoiles doit etre entre 1 et 5.'),
  body('total_floors')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Le nombre d\'etages doit etre au moins 1.')
];

/**
 * validateRoom
 *
 * Valide les champs de creation/modification d'une chambre.
 */
const validateRoom = [
  body('hotel_id')
    .isInt({ min: 1 })
    .withMessage('L\'identifiant de l\'hotel est requis et doit etre un entier valide.'),
  body('room_number')
    .notEmpty()
    .withMessage('Le numero de chambre est requis.')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Le numero de chambre doit contenir entre 1 et 10 caracteres.'),
  body('floor')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('L\'etage doit etre un entier positif ou zero.'),
  body('room_type')
    .isIn(['standard', 'superieure', 'suite', 'familiale', 'pmr'])
    .withMessage('Type de chambre invalide. Valeurs acceptees: standard, superieure, suite, familiale, pmr.'),
  body('bed_type')
    .isIn(['single', 'double', 'twin', 'king', 'queen'])
    .withMessage('Type de lit invalide. Valeurs acceptees: single, double, twin, king, queen.'),
  body('status')
    .optional({ nullable: true })
    .isIn(['active', 'hors_service', 'renovation'])
    .withMessage('Statut invalide. Valeurs acceptees: active, hors_service, renovation.')
];

/**
 * validateMaintenanceTicket
 *
 * Valide les champs de creation d'un ticket de maintenance.
 */
const validateMaintenanceTicket = [
  body('hotel_id')
    .isInt({ min: 1 })
    .withMessage('L\'identifiant de l\'hotel est requis.'),
  body('room_number')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 10 })
    .withMessage('Le numero de chambre ne peut pas depasser 10 caracteres.'),
  body('category')
    .isIn(['plomberie', 'electricite', 'climatisation', 'mobilier', 'serrurerie', 'peinture', 'nettoyage', 'autre'])
    .withMessage('Categorie invalide. Valeurs acceptees: plomberie, electricite, climatisation, mobilier, serrurerie, peinture, nettoyage, autre.'),
  body('description')
    .notEmpty()
    .withMessage('La description est requise.')
    .trim()
    .isLength({ min: 5 })
    .withMessage('La description doit contenir au moins 5 caracteres.'),
  body('priority')
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priorite invalide. Valeurs acceptees: low, medium, high, critical.'),
  body('room_blocked')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('Le champ room_blocked doit etre un booleen.')
];

/**
 * validateLeaveRequest
 *
 * Valide les champs de creation d'une demande de conges.
 */
const validateLeaveRequest = [
  body('leave_type')
    .isIn(['cp', 'rtt', 'sans_solde', 'maladie', 'autre'])
    .withMessage('Type de conge invalide. Valeurs acceptees: cp, rtt, sans_solde, maladie, autre.'),
  body('start_date')
    .isDate()
    .withMessage('La date de debut doit etre une date valide (YYYY-MM-DD).'),
  body('end_date')
    .isDate()
    .withMessage('La date de fin doit etre une date valide (YYYY-MM-DD).')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.start_date)) {
        throw new Error('La date de fin doit etre posterieure ou egale a la date de debut.');
      }
      return true;
    }),
  body('days_count')
    .isFloat({ min: 0.5 })
    .withMessage('Le nombre de jours doit etre au minimum 0.5.'),
  body('comment')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Le commentaire ne peut pas depasser 1000 caracteres.'),
  body('hotel_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('L\'identifiant de l\'hotel doit etre un entier valide.')
];

module.exports = {
  handleValidation,
  validateLogin,
  validateHotel,
  validateRoom,
  validateMaintenanceTicket,
  validateLeaveRequest
};
