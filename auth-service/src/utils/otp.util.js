const { redis: redisClient } = require('../config/redis.config');
const { logger } = require('../config/logger');
const crypto = require('crypto');

const OTP_EXPIRY = 300;
const EMAIL_VERIFIED_EXPIRY = 300;

// -------------------------
// HELPERS
// -------------------------

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function safeRedisWrite(fn) {
    for (let i = 0; i < 2; i++) {
        try {
            return await fn();
        } catch (err) {
            if (err.message.includes('READONLY')) {
                logger.warn('🔁 Redis READONLY - retrying...');
                await sleep(100);
                continue;
            }
            throw err;
        }
    }
}

// -------------------------
// KEYS
// -------------------------

const getOtpKey = (email) => `auth:otp:email:${email}`;
const getVerifiedKey = (email) => `auth:verified:email:${email}`;
const getRateLimitKey = (email) => `auth:otp:rate:${email}`;

// -------------------------
// OTP GENERATE
// -------------------------

const generateOtp = () => crypto.randomInt(100000, 999999).toString();


// -------------------------
// OTP SET
// -------------------------

const setOtp = async (email, otp) => {
    const otpKey = getOtpKey(email);
    const rateKey = getRateLimitKey(email);

    try {
        const attempts = await safeRedisWrite(() => redisClient.incr(rateKey));

        if (attempts === 1) {
            await safeRedisWrite(() => redisClient.expire(rateKey, 60));
        }

        if (attempts > 3) {
            logger.warn(`🚫 OTP rate limit exceeded for ${email}`);
            throw new Error('Too many OTP requests. Try again later.');
        }

        await safeRedisWrite(() =>
            redisClient.set(otpKey, otp, 'EX', OTP_EXPIRY)
        );

        logger.info(`✅ OTP set for ${email}`);
    } catch (err) {
        logger.error('❌ setOtp failed:', {
            message: err.message,
            stack: err.stack,
        });
        throw err;
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
        await safeRedisWrite(() => redisClient.del(key));
    } catch (err) {
        logger.error('❌ deleteOtp failed:', err.message);
    }
};


// -------------------------
// EMAIL VERIFIED
// -------------------------

const setEmailVerified = async (email) => {
    const key = getVerifiedKey(email);

    try {
        await safeRedisWrite(() =>
            redisClient.set(key, 'true', 'EX', EMAIL_VERIFIED_EXPIRY)
        );

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
        await safeRedisWrite(() => redisClient.del(key));
    } catch (err) {
        logger.error('❌ deleteEmailVerifiedFlag failed:', err.message);
    }
};


// -------------------------
// OTP VERIFY
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

        await safeRedisWrite(() => redisClient.del(key));
        await setEmailVerified(email);

        return { success: true };
    } catch (err) {
        logger.error('❌ verifyOtp failed:', err.message);
        return { success: false, message: 'Verification failed' };
    }
};


// -------------------------
// EXPORTS
// -------------------------

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