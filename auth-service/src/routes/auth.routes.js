const express = require('express');
const validate = require('../middleware/validate.middleware');
const { sendOtpSchema, verifyOtpSchema, registerSchema } = require('../validators/auth.schema');
const { sendLoginOtpController, sendRegisterOtpController, verifyRegisterOtpController, registerUserController, verifyLoginOtpController, logoutController, isAuthenticated, getUserDetailsByIdController, getCounsellorStudentsController, verifyStudentOwnershipController, getCurrentUser, getReferenceCodeDetailsController } = require('../controllers/auth.controller');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.post('/send-login-otp', validate(sendOtpSchema), sendLoginOtpController);
router.post('/verify-login-otp', validate(verifyOtpSchema), verifyLoginOtpController);
router.post('/send-register-otp', validate(sendOtpSchema), sendRegisterOtpController);
router.post('/verify-register-otp', validate(verifyOtpSchema), verifyRegisterOtpController);
router.post('/register', validate(registerSchema), registerUserController);
router.post('/logout', logoutController);
router.get(
    '/counsellor/students',
    requireAuth,
    requireRole('COUNSELLOR'),
    getCounsellorStudentsController
  );
  

router.get('/isAuthenticated', requireAuth, isAuthenticated);
router.get('/user/:userId', requireAuth,
  requireRole('COUNSELLOR','STUDENT'), getUserDetailsByIdController);

router.get(
  '/internal/verify-student-ownership',
  requireAuth,
  requireRole('COUNSELLOR'),
  verifyStudentOwnershipController
);

router.get(
  "/me",
  requireAuth,
  getCurrentUser
);


router.get(
  '/reference-code-details',
  getReferenceCodeDetailsController
);



module.exports = router;
