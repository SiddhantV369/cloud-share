# Publishing CloudDrop to Docker Hub & Running Multi-Container Stack

This guide details how to build, tag, and publish your custom multi-container images (`backend`, `frontend`, and `gateway`) to **Docker Hub**, and how anyone else can pull and run the entire application using a single command.

---

## 🏗️ Architecture Overview

The application consists of 4 containers:
1. **`mongo:7.0`**: Official public MongoDB image (pulled directly from Docker Hub).
2. **`<your-username>/clouddrop-backend:latest`**: Node.js/Express REST API + auto-cleaner worker.
3. **`<your-username>/clouddrop-frontend:latest`**: Compiled React SPA served via ultra-light Nginx Alpine (~25MB).
4. **`<your-username>/clouddrop-gateway:latest`**: Nginx Reverse Proxy Gateway routing `/` to frontend and `/api` to backend.

---

## Step 1: Login to Docker Hub

Open PowerShell or terminal and authenticate with your Docker Hub account:

```bash
docker login
```
Enter your Docker Hub username and password (or Personal Access Token).

---

## Step 2: Set Your Docker Hub Username

Open [.env](file:///c:/Users/Siddhant%20Verma/OneDrive/Documents/Comeback/mern-compose/.env) and set your Docker Hub username:

```env
DOCKERHUB_USERNAME=your_actual_dockerhub_username
```

---

## Step 3: Build and Push Images

### Method A: Single-Command (Recommended with Docker Compose)

Docker Compose automatically builds and tags all 3 custom images according to the names in `docker-compose.yml`:

```bash
# 1. Build all images locally
docker compose build

# 2. Push all images to Docker Hub
docker compose push
```

### Method B: Manual Individual Build & Push

If you prefer building and pushing each image individually:

```bash
# Set your username variable (PowerShell)
$env:DOCKERHUB_USERNAME="your_actual_dockerhub_username"

# 1. Build Backend
docker build -t ${env:DOCKERHUB_USERNAME}/clouddrop-backend:latest ./backend
docker push ${env:DOCKERHUB_USERNAME}/clouddrop-backend:latest

# 2. Build Frontend
docker build -t ${env:DOCKERHUB_USERNAME}/clouddrop-frontend:latest ./frontend
docker push ${env:DOCKERHUB_USERNAME}/clouddrop-frontend:latest

# 3. Build Nginx Gateway
docker build -t ${env:DOCKERHUB_USERNAME}/clouddrop-gateway:latest ./nginx
docker push ${env:DOCKERHUB_USERNAME}/clouddrop-gateway:latest
```

---

## Step 4: How Others Can Pull & Run Your Application

Anyone else in the world can run your entire application **without cloning the source code, without Node.js, and without compiling anything**.

### 1. Send them `docker-compose.prod.yml`
Send them the [docker-compose.prod.yml](file:///c:/Users/Siddhant%20Verma/OneDrive/Documents/Comeback/mern-compose/docker-compose.prod.yml) file (or they can download it directly):

```bash
# Example if hosted on GitHub:
curl -O https://raw.githubusercontent.com/<username>/<repo>/main/docker-compose.prod.yml
```

### 2. Set the image username
They can either:
- Replace `yourusername` in `docker-compose.prod.yml` with your actual Docker Hub username.
- Or pass it when running:
  ```bash
  # Linux/macOS
  DOCKERHUB_USERNAME=your_actual_dockerhub_username docker compose -f docker-compose.prod.yml up -d

  # Windows PowerShell
  $env:DOCKERHUB_USERNAME="your_actual_dockerhub_username"; docker compose -f docker-compose.prod.yml up -d
  ```

### 3. Open the App
Once launched, they can open their browser at:
```text
http://localhost
```
All 4 containers (`mongo`, `backend`, `frontend`, and `nginx`) will start and communicate automatically over their internal Docker network!

---

## Step 5: Updating Images Later

Whenever you make code changes:
1. Re-build: `docker compose build`
2. Re-push: `docker compose push`
3. Others can pull the latest version anytime with:
   ```bash
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```
