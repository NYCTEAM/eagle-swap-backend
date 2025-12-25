FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript (remove dist first to force clean build)
RUN rm -rf dist && npm run build

# Expose port
EXPOSE 3005

# Start command
CMD ["sh", "-c", "node init-on-startup.js || true && npm start"]
