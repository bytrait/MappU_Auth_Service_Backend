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
  'https://career-api.mappmyuniversity.com',

  // Test domains
  'https://auth-test.mappmyuniversity.com',
  'https://auth-api-test.mappmyuniversity.com',
  'https://career-psychometric-assessment-test.mappmyuniversity.com',
  'https://career-api-test.mappmyuniversity.com',

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

// === Middlewares
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (crossOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization'
  ]
}));

app.options(/.*/, cors());

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === API Routes
app.use('/api/v2/auth', authRoutes);
app.use('/api/v2/counsellor', counsellorRoutes);
app.use('/api/v2/internal', internalRoutes);

// === Serve static frontend
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// === SPA Fallback Middleware
app.use(history({
  rewrites: [
    { from: /^\/api\/.*$/, to: context => context.parsedUrl.pathname }
  ]
}));

module.exports = app;