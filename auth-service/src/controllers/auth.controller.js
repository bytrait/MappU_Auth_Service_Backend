const {
  sendLoginOtpService,
  sendRegisterOtpService,
  verifyRegisterOtp,
  registerUserService,
  verifyLoginOtpService,
  getUserByIdService,
  getCounsellorStudentsService,
  verifyStudentOwnershipService,
  getCurrentUserService,
} = require('../services/auth.service');

const { logger } = require('../config/logger');

// ---------------------------
// ENVIRONMENT & COOKIE CONFIG
// ---------------------------
const isProd = process.env.NODE_ENV === 'prod';

const baseCookieConfig = {
  httpOnly: true,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Production → HTTPS + subdomains
const prodCookieConfig = {
  ...baseCookieConfig,
  secure: true,
  sameSite: 'None',
  domain: '.bytrait.com'
};

// Development → 127.0.0.1 cross-port sharing
const devCookieConfig = {
  ...baseCookieConfig,
  secure: false,
  sameSite: 'lax',   // REQUIRED for 127.0.0.1
  // IMPORTANT: no domain for 127.0.0.1
};

// Select correct config
const cookieOptions = isProd ? prodCookieConfig : devCookieConfig;

// ---------------------------
// CONTROLLERS
// ---------------------------

const sendLoginOtpController = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await sendLoginOtpService(email);

    return res.status(200).json({
      success: true,
      message: 'OTP sent for login',
      data: result,
    });
  } catch (error) {
    logger.error('Login OTP Error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const sendRegisterOtpController = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await sendRegisterOtpService(email);

    return res.status(200).json({
      success: true,
      message: 'OTP sent for registration',
      data: result,
    });
  } catch (error) {
    logger.error('Register OTP Error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const verifyLoginOtpController = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const { user, token } = await verifyLoginOtpService(email, otp);

    // Set cookie
    res.cookie('auth-token', token, cookieOptions);

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Login verification failed:', error);
    return res.status(400).json({ message: error.message });
  }
};

const verifyRegisterOtpController = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyRegisterOtp(email, otp);

    logger.info(`[verify-register-otp] OTP verified for ${email}`);
    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      result,
    });
  } catch (error) {
    logger.error(`[verify-register-otp] Error: ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
    next(error);
  }
};

const registerUserController = async (req, res) => {
  try {
    const { user, token } = await registerUserService({
      ...req.body,
      requestId: req.requestId
    });

    res.cookie('auth-token', token, cookieOptions);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    logger.error('Registration failed', {
      requestId: req.requestId,
      error: error.message
    });

    return res.status(400).json({
      success: false,
      message: error.message || 'Registration failed',
      requestId: req.requestId
    });
  }
};


const logoutController = async (req, res) => {
  try {
    res.clearCookie('auth-token', {
      ...cookieOptions,
      maxAge: 0,
    });

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout failed:', error);
    return res.status(500).json({ message: 'Logout failed' });
  }
};

const isAuthenticated = async (req, res) => {
  try {
    const { id, email, fullName, role } = req.user;

    return res.status(200).json({
      success: true,
      data: { id, email, fullName, role },
    });
  } catch (err) {
    logger.error('isAuthenticated failed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
    });
  }
};

const getUserDetailsByIdController = async (req, res) => {
  try {
    const { userId } = req.params;
    const userDetails = await getUserByIdService(userId);

    if (!userDetails) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, data: userDetails });
  } catch (error) {
    logger.error('Get user details failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user details',
    });
  }
};
const getCounsellorStudentsController = async (req, res) => {
  try {
    const counsellorId = req.user.id;

    const {
      page = 1,
      limit = 20,
      search = '',
    } = req.query;

    const result = await getCounsellorStudentsService({
      counsellorId,
      page: Number(page),
      limit: Number(limit),
      search,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Get counsellor students failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
    });
  }
};

const verifyStudentOwnershipController = async (req, res) => {
  try {
    const { counsellorId, studentId } = req.query;

    const isOwner = await verifyStudentOwnershipService(
      counsellorId,
      studentId
    );

    return res.status(200).json({
      success: isOwner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify student ownership',
    });
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await getCurrentUserService({
      userId
    });

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendLoginOtpController,
  sendRegisterOtpController,
  verifyLoginOtpController,
  verifyRegisterOtpController,
  registerUserController,
  logoutController,
  isAuthenticated,
  getUserDetailsByIdController,
  getCounsellorStudentsController,
  verifyStudentOwnershipController,
  getCurrentUser,
};
