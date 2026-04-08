const { redis: redisClient } = require('../config/redis.config');
const { logger } = require('../config/logger');
const crypto = require('crypto');

const OTP_EXPIRY = 300; // 5 min
const EMAIL_VERIFIED_EXPIRY = 300;

// 🔒 Namespaced keys
const getOtpKey = (email) => `auth:otp:email:${email}`;
const getVerifiedKey = (email) => `auth:verified:email:${email}`;
const getRateLimitKey = (email) => `auth:otp:rate:${email}`;

// 🔢 Generate secure OTP
const generateOtp = () => crypto.randomInt(100000, 999999).toString();


// -------------------------
// OTP SET (WITH RATE LIMIT)
// -------------------------
const setOtp = async (email, otp) => {
    const otpKey = getOtpKey(email);
    const rateKey = getRateLimitKey(email);

    try {
        // 🚫 Rate limit: max 3 OTP per minute
        const attempts = await redisClient.incr(rateKey);

        if (attempts === 1) {
            await redisClient.expire(rateKey, 60); // 1 min window
        }

        if (attempts > 3) {
            logger.warn(`🚫 OTP rate limit exceeded for ${email}`);
            throw new Error('Too many OTP requests. Try again later.');
        }

        // ✅ Store OTP with expiry
        await redisClient.set(otpKey, otp, 'EX', OTP_EXPIRY);

        logger.info(`✅ OTP set for ${email}`);
    } catch (err) {
        logger.error('❌ setOtp failed:', {
            message: err.message,
            stack: err.stack,
        });
        throw err; // 🔥 DO NOT wrap blindly
    }
};


// -------------------------
// OTP GET
// -------------------------
const getOtp = async (email) => {
    const key = getOtpKey(email);

    try {
        return await redisClient.get(key);
    } catch (err) {
        logger.error('❌ getOtp failed:', err.message);
        return null;
    }
};


// -------------------------
// OTP DELETE
// -------------------------
const deleteOtp = async (email) => {
    const key = getOtpKey(email);

    try {
        await redisClient.del(key);
    } catch (err) {
        logger.error('❌ deleteOtp failed:', err.message);
    }
};


// -------------------------
// EMAIL VERIFIED FLAG
// -------------------------
const setEmailVerified = async (email) => {
    const key = getVerifiedKey(email);

    try {
        await redisClient.set(key, 'true', 'EX', EMAIL_VERIFIED_EXPIRY);
        logger.info(`✅ Email verified flag set for ${email}`);
    } catch (err) {
        logger.error('❌ setEmailVerified failed:', err.message);
    }
};

const isEmailVerified = async (email) => {
    const key = getVerifiedKey(email);

    try {
        const result = await redisClient.get(key);
        return result === 'true';
    } catch (err) {
        logger.error('❌ isEmailVerified failed:', err.message);
        return false;
    }
};

const deleteEmailVerifiedFlag = async (email) => {
    const key = getVerifiedKey(email);

    try {
        await redisClient.del(key);
    } catch (err) {
        logger.error('❌ deleteEmailVerifiedFlag failed:', err.message);
    }
};


// -------------------------
// OTP VERIFY (NEW - IMPORTANT)
// -------------------------
const verifyOtp = async (email, inputOtp) => {
    const key = getOtpKey(email);

    try {
        const storedOtp = await redisClient.get(key);

        if (!storedOtp) {
            return { success: false, message: 'OTP expired or not found' };
        }

        if (storedOtp !== inputOtp) {
            return { success: false, message: 'Invalid OTP' };
        }

        // ✅ Delete OTP immediately after success
        await redisClient.del(key);

        // ✅ Mark email verified
        await setEmailVerified(email);

        return { success: true };
    } catch (err) {
        logger.error('❌ verifyOtp failed:', err.message);
        return { success: false, message: 'Verification failed' };
    }
};


module.exports = {
    generateOtp,
    setOtp,
    getOtp,
    deleteOtp,
    verifyOtp,
    setEmailVerified,
    isEmailVerified,
    deleteEmailVerifiedFlag
};