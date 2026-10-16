# ==============================================================
# Multi-stage Production Dockerfile for React (Vite) Frontend
# ==============================================================

# Stage 1: Build production static bundles
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (cached if package files unchanged)
COPY package*.json ./
RUN npm install

# Copy application source code and compile production assets
COPY . .
RUN npm run build

# Stage 2: High-performance Nginx production web server
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled production assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for port 3000 and SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 3000 (proxied by root Nginx)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
