FROM node:20

WORKDIR /app

# Copy backend files
COPY auth-service/package*.json ./
RUN npm install

# Prisma generate BEFORE app starts
COPY auth-service/prisma ./prisma
  RUN npx prisma generate

# Copy remaining backend files
COPY auth-service .

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
