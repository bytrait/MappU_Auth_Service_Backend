const express = require('express');
require('dotenv').config();

const cors = require('cors');
const cookieParser = require('cookie-parser');

const { logger } = require('./config/logger');
const authRoutes = require('./routes/auth.routes');
const counsellorRoutes = require('./routes/counsellor.routes');
const internalRoutes = require('./routes/internal.routes');

const app = express();

/* =======================================================
   CORS CONFIG (env-driven; falls back to empty allow-list)
======================================================= */

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
  : [];

const corsOptions = {
  origin(origin, callback) {
    try {
      // Allow Postman/mobile apps/server-side requests
      if (!origin) {
        return callback(null, true);
      }

      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(`❌ Blocked by CORS: ${origin}`);

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    } catch (err) {
      callback(err);
    }
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Tenant-Slug',
  ],

  optionsSuccessStatus: 200,
};

/* =======================================================
   MIDDLEWARE
======================================================= */

app.use(cors(corsOptions));
app.options(/./, cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =======================================================
   ROUTES
======================================================= */

app.use('/api/v2/auth', authRoutes);
app.use('/api/v2/counsellor', counsellorRoutes);
app.use('/api/v2/internal', internalRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Auth service running',
  });
});

/* =======================================================
   404 + global error handler
======================================================= */

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  let status = err.status || err.statusCode || 500;
  let code = err.code;
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  if (err && err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      status = 409;
      code = code || 'UNIQUE_VIOLATION';
      const target = err.meta?.target;
      message = `Duplicate value for ${
        Array.isArray(target) ? target.join(', ') : target || 'unique field'
      }`;
    } else if (err.code === 'P2025') {
      status = 404;
      code = code || 'NOT_FOUND';
      message = 'Resource not found';
    }
  }

  if (
    err?.name === 'PrismaClientInitializationError' ||
    (typeof message === 'string' &&
      message.includes('Timed out fetching a new connection from the connection pool'))
  ) {
    status = 503;
    code = code || 'DATABASE_UNAVAILABLE';
    message = 'Database temporarily unavailable. Please try again.';
  }

  if (status >= 500) {
    logger.error(
      `[${req.method} ${req.originalUrl}] ${status} ${err.stack || message}`
    );
    if (process.env.NODE_ENV === 'production') {
      message = 'Internal Server Error';
      details = undefined;
    }
  } else {
    logger.warn(`[${req.method} ${req.originalUrl}] ${status} ${message}`);
  }

  res.status(status).json({
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(details !== undefined ? { details } : {}),
  });
});

module.exports = app;
