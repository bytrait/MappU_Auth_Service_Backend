const express = require('express');
const router = express.Router();

const validateInternalServiceSecret = require('../middleware/internal.middleware');
const {
  getBasicUserDetails,
  sendPaymentReceiptEmail,
} = require('../controllers/internal.controller');

router.use(validateInternalServiceSecret);

router.get(
  '/users/:studentId/basic-details',
  getBasicUserDetails
);

router.post(
  '/emails/payment-receipt',
  sendPaymentReceiptEmail
);

module.exports = router;