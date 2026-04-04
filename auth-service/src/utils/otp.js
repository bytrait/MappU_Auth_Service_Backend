const crypto = require("crypto");
const redisClient = require("../config/redis");
const { logger } = require("../config/logger");

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const OTP_PREFIX = "otp:";
const OTP_ATTEMPT_PREFIX = "otp_attempts:";
const MAX_ATTEMPTS = 5;

// -------------------------
// GENERATE OTP
// -------------------------
function generateOtp() {
  // More secure than Math.random
  return crypto.randomInt(100000, 999999).toString();
}

// -------------------------
// STORE OTP
// -------------------------
async function storeOtp(email, otp) {
  const key = `${OTP_PREFIX}${email}`;

  try {
    // ✅ Use atomic set with expiry (safe)
    await redisClient.set(key, otp, "EX", OTP_EXPIRY_SECONDS);

    // Reset attempts on new OTP
    await redisClient.del(`${OTP_ATTEMPT_PREFIX}${email}`);

    logger.info(`OTP stored for ${email}`);
  } catch (error) {
    logger.error("Error storing OTP:", error);

    // Fail fast → important for auth systems
    throw new Error("OTP service unavailable");
  }
}

// -------------------------
// VERIFY OTP
// -------------------------
async function verifyOtp(email, otp) {
  const key = `${OTP_PREFIX}${email}`;
  const attemptKey = `${OTP_ATTEMPT_PREFIX}${email}`;

  try {
    // ✅ Check attempts (rate limiting)
    const attempts = parseInt(await redisClient.get(attemptKey)) || 0;

    if (attempts >= MAX_ATTEMPTS) {
      return {
        success: false,
        message: "Too many attempts. Try again later.",
      };
    }

    const storedOtp = await redisClient.get(key);

    if (!storedOtp) {
      return {
        success: false,
        message: "OTP expired or not found",
      };
    }

    // ❌ Wrong OTP
    if (storedOtp !== otp) {
      await redisClient.multi()
        .incr(attemptKey)
        .expire(attemptKey, OTP_EXPIRY_SECONDS)
        .exec();

      return {
        success: false,
        message: "Invalid OTP",
      };
    }

    // ✅ Correct OTP → delete atomically
    await redisClient.multi()
      .del(key)
      .del(attemptKey)
      .exec();

    return {
      success: true,
      message: "OTP verified successfully",
    };

  } catch (error) {
    logger.error("Error verifying OTP:", error);

    return {
      success: false,
      message: "OTP verification failed",
    };
  }
}

module.exports = {
  generateOtp,
  storeOtp,
  verifyOtp,
};