# Use official Node.js LTS image
FROM node:20

# Set working directory
WORKDIR /app

# Copy dependency files and install
COPY package*.json ./
RUN npm install

# Copy rest of the application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Run migrations and start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
