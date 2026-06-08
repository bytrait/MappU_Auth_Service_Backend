const express = require('express');
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { logger } = require('./config/logger');
const authRoutes = require('./routes/auth.routes');
const counsellorRoutes = require('./routes/counsellor.routes');
const internalRoutes = require('./routes/internal.routes');

const app = express();

const crossOrigins = [
  'https://auth.mappmyuniversity.com',
  'https://career-psychometric-assessment.mappmyuniversity.com',

  // Test domains
  'https://auth-test.mappmyuniversity.com',
  'https://career-psychometric-assessment-test.mappmyuniversity.com',

  // Local development
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:4000',
  'http://127.0.0.1:4002',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4000',
  'http://localhost:4002'
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (crossOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization'
  ],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('/{*path}', cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v2/auth', authRoutes);
app.use('/api/v2/counsellor', counsellorRoutes);
app.use('/api/v2/internal', internalRoutes);

// ---------------------------------------------------------------------------
// 404 + global error handler
//
// Every controller does `next(error)` on failure. Without these two
// middlewares Express's default handler returns an HTML 500 page, so the
// frontend can never get a status-coded JSON error. These translate:
//   - HttpError → response with its status + JSON body
//   - Prisma P2002 → 409 with the message
//   - Anything else → 500 with a generic message (real error in logs)
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  let status = err.status || err.statusCode || 500;
  let code = err.code;
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  // Prisma known-request errors → HTTP mapping
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

  // Connection pool / unreachable DB (common with remote Postgres)
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