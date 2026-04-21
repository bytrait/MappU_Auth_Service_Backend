const express = require('express');
const path = require('path');
const history = require('connect-history-api-fallback');
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const counsellorRoutes = require('./routes/counsellor.routes');
const internalRoutes = require('./routes/internal.routes');

const app = express();

const crossOrigins = [
  'https://auth.mappmyuniversity.com',
  'https://career-psychometric-assessment.mappmyuniversity.com',
  'https://auth-test.mappmyuniversity.com',
  'https://career-psychometric-assessment-test.mappmyuniversity.com',
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
    // Allow requests without Origin header
    // Example: Postman, curl, server-to-server
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

// === CORS must come before routes
app.use(cors(corsOptions));

// Express 5 compatible OPTIONS handler
app.options('/{*path}', cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === API Routes
app.use('/api/v2/auth', authRoutes);
app.use('/api/v2/counsellor', counsellorRoutes);
app.use('/api/v2/internal', internalRoutes);

// === Static frontend
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// === SPA fallback
app.use(history({
  rewrites: [
    {
      from: /^\/api\/.*$/,
      to: context => context.parsedUrl.pathname
    }
  ]
}));

module.exports = app;