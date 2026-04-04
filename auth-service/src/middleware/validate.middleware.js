const { logger } = require('../config/logger');

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    logger.warn('Validation failed:', error);
    return res.status(400).json({
      message: 'Validation error',
      errors: error.errors,
    });
  }
};

module.exports = validate;
