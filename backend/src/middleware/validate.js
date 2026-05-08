const { body, validationResult } = require('express-validator');

exports.validateIoTPayload = [
  body('datetime').notEmpty(),
  body('type_equipement').isIn(['Climatisation', 'Serveur', 'Éclairage']),
  body('consumption_zone1').isFloat({ min: 0 }),
  body('consumption_zone2').isFloat({ min: 0 }),
  body('consumption_zone3').isFloat({ min: 0 }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];
