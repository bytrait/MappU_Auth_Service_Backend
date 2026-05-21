const validateInternalServiceSecret = (req, res, next) => {
  const apiKey = req.headers['x-internal-api-key'];

  if (!apiKey || apiKey !== process.env.INTERNAL_SERVICE_SECRET) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized internal request',
    });
  }

  next();
};

module.exports = validateInternalServiceSecret;