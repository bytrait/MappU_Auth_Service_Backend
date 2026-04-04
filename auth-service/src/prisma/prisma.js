const { PrismaClient } = require('@prisma/client');
const { DATABASE_URL } = require('../config/prisma.config.js');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: DATABASE_URL,
        },
    },
});
module.exports = prisma;
