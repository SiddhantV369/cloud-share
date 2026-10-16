#!/usr/bin/env bash
# ==============================================================
# CloudDrop Automated AWS Deployment Script
# ==============================================================
set -e

echo "🚀 Starting CloudDrop AWS Deployment..."

# 1. Check & Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm -f get-docker.sh
    sudo usermod -aG docker "$USER" || true
    echo "✅ Docker installed successfully."
else
    echo "✅ Docker is already installed."
fi

# 2. Check & Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    echo "📦 Docker Compose plugin not found. Installing..."
    sudo apt-get update && sudo apt-get install -y docker-compose-plugin || sudo yum install -y docker-compose-plugin
fi
echo "✅ Docker Compose is ready."

# 3. Check for .env file
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "⚠️ .env file not found. Creating from .env.example..."
        cp .env.example .env
        echo "👉 Please update your .env with your MongoDB Atlas connection string before continuing."
        exit 1
    else
        echo "❌ No .env or .env.example found. Please configure .env file."
        exit 1
    fi
fi

# 4. Build and start containers
echo "🔨 Building and launching multi-container application..."
docker compose up --build -d

# 5. Verify container health
echo "⏳ Waiting for services to initialize..."
sleep 5

docker compose ps

echo "🔍 Testing health check..."
if curl -s http://localhost/api/health | grep -q '"status":"healthy"'; then
    echo "✅ CloudDrop application is HEALTHY and running on port 80!"
else
    echo "⚠️ Application started. Check logs using: docker compose logs -f"
fi

echo "🎉 Deployment complete! Access your application at http://$(curl -s ifconfig.me || echo 'localhost')"
