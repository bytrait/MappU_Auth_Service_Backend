const Redis = require("ioredis");
const { logger } = require("./logger");

// 🔒 Validate env early
if (!process.env.REDIS_URL) {
  throw new Error("❌ REDIS_URL is missing in environment variables");
}

const redis = new Redis(process.env.REDIS_URL, {
  enableReadyCheck: true,

  // 🔥 Prevent infinite hanging requests
  maxRetriesPerRequest: 3,

  // 🔥 Fail fast if Redis is down
  lazyConnect: false,

  // 🔥 Retry with controlled backoff
  retryStrategy(times) {
    if (times > 10) {
      logger.error("❌ Redis retry limit exceeded. Giving up.");
      return null; // stop retrying
    }

    const delay = Math.min(times * 100, 3000);
    logger.warn(`🔁 Redis retry attempt #${times}, delay: ${delay}ms`);
    return delay;
  },

  // 🔥 Handle READONLY (replica failover case)
  reconnectOnError(err) {
    if (err.message.includes("READONLY")) {
      logger.warn("⚠️ Redis READONLY detected. Reconnecting...");
      return true;
    }
    return false;
  },

  // 🔥 Timeout safety
  connectTimeout: 10000,

  // 🔥 Keep connection alive
  keepAlive: 1,
});


// -------------------------
// EVENTS
// -------------------------

redis.on("connect", () => {
  logger.info("🔗 Connected to Redis");
});

redis.on("ready", () => {
  logger.info("✅ Redis ready to accept commands");
});

redis.on("reconnecting", () => {
  logger.warn("🔄 Reconnecting to Redis...");
});

redis.on("error", (err) => {
  logger.error("❌ Redis connection error:", {
    message: err.message,
    stack: err.stack,
  });
});

redis.on("end", () => {
  logger.warn("⚠️ Redis connection closed");
});


// -------------------------
// SAFE WRAPPER (OPTIONAL BUT VERY USEFUL)
// -------------------------

async function safeRedisCall(fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    logger.error("❌ Redis operation failed", err.message);
    return fallback;
  }
}

module.exports = {
  redis,
  safeRedisCall,
};