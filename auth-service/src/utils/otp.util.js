const redis = require('../config/redis.config');
const { logger } = require('../config/logger');
const crypto = require('crypto');

const OTP_EXPIRY = 300;
const EMAIL_VERIFIED_EXPIRY = 300;

const generateOtp = () => {
    return crypto.randomInt(100000, 999999).toString();
};

// ✅ wrapped with try/catch
const setOtp = async (email, otp) => {
    const key = `otp:${email}`;
    try {
        await redis.set(key, otp, 'EX', OTP_EXPIRY);
        logger.info(`✅ OTP set for ${email}`);
    } catch (err) {
        logger.error('❌ setOtp failed:', err);
        throw new Error('OTP service unavailable');
    }
};

// ✅ safe fallback
const getOtp = async (email) => {
    const key = `otp:${email}`;
    try {
        return await redis.get(key);
    } catch (err) {
        logger.error('❌ getOtp failed:', err);
        return null;
    }
};

// ✅ safe delete (no crash)
const deleteOtp = async (email) => {
    const key = `otp:${email}`;
    try {
        await redis.del(key);
    } catch (err) {
        logger.error('❌ deleteOtp failed:', err);
    }
};

// ✅ fix: store string instead of boolean + error handling
const setEmailVerified = async (email) => {
    const key = `email_verified:${email}`;
    try {
        await redis.set(key, 'true', 'EX', EMAIL_VERIFIED_EXPIRY);
        logger.info(`✅ Email verified flag set for ${email}`);
    } catch (err) {
        logger.error('❌ setEmailVerified failed:', err);
    }
};

// ✅ safe read
const isEmailVerified = async (email) => {
    const key = `email_verified:${email}`;
    try {
        const result = await redis.get(key);
        return result === 'true';
    } catch (err) {
        logger.error('❌ isEmailVerified failed:', err);
        return false;
    }
};

// ✅ safe delete
const deleteEmailVerifiedFlag = async (email) => {
    const key = `email_verified:${email}`;
    try {
        await redis.del(key);
    } catch (err) {
        logger.error('❌ deleteEmailVerifiedFlag failed:', err);
    }
};

module.exports = {
    generateOtp,
    setOtp,
    getOtp,
    deleteOtp,
    setEmailVerified,
    isEmailVerified,
    deleteEmailVerifiedFlag
};