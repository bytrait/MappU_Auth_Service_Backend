const Redis = require("ioredis");
const { logger } = require("./logger");

const redis = new Redis(process.env.REDIS_URL, {
  // ✅ Prevent request failures during reconnect
  maxRetriesPerRequest: null,
  enableReadyCheck: true,

  // ✅ Retry strategy (progressive backoff)
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`🔁 Redis retry attempt #${times}, delay: ${delay}ms`);
    return delay;
  },

  // ✅ Handle READONLY error (critical fix)
  reconnectOnError(err) {
    if (err.message.includes("READONLY")) {
      logger.warn("⚠️ Redis READONLY detected. Reconnecting...");
      return true; // forces reconnect
    }
    return false;
  },

  // ✅ Optional: connection timeout safety
  connectTimeout: 10000,
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
  logger.error("❌ Redis connection error:", err);
});

redis.on("end", () => {
  logger.warn("⚠️ Redis connection closed");
});

module.exports = redis;