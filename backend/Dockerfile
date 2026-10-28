# ==============================================================
# Production Dockerfile for Express Node.js Backend
# ==============================================================
FROM node:20-alpine

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Set working directory
WORKDIR /app

# Install production dependencies first (leverages Docker cache layer)
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Create uploads directory and assign ownership to unprivileged node user
RUN mkdir -p /app/uploads && chown -R node:node /app

# Copy application source code with unprivileged user ownership
COPY --chown=node:node . .

# Run container as unprivileged user for AWS security compliance
USER node

# Expose backend port
EXPOSE 5000

# Container health check for AWS ECS / Docker Compose
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/api/health || exit 1

# Start server directly with Node for proper SIGTERM signal handling
CMD ["node", "server.js"]
