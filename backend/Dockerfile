# Use Node.js official image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies for native modules (sharp, etc.)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    vips-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Copy Docker environment file
COPY .env.docker .env

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Development command with hot reload
CMD ["npm", "run", "dev"] 