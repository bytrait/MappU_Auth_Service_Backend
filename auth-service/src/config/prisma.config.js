// utils/prisma.config.js
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  (isProd
    ? 'postgresql://postgres:Sanket0506@localhost:5432/authdb'
    : 'postgresql://postgres:Sanket0506@postgres:5432/authdb');

module.exports = {
  DATABASE_URL,
};
