# Use Node.js official image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 5173

# Development command with Vite dev server
# Host 0.0.0.0 allows external access (required for Docker)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"] 