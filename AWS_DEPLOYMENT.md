# CloudDrop • AWS Cloud Deployment Guide

This guide walks you through deploying the **CloudDrop** MERN File Sharing application to **Amazon Web Services (AWS)** using Docker and Docker Compose.

---

## 🏗️ Architecture on AWS

```
Internet (Users)
      │
      ▼ Port 80 / 443
┌────────────────────────────────────────────────────────┐
│ AWS EC2 Instance / Lightsail                           │
│                                                        │
│   [ Nginx Gateway Container (Port 80) ]                │
│       │                              │                 │
│       ▼                              ▼                 │
│   [ Frontend Container ]         [ Backend API ]       │
│   (Nginx Alpine: 3000)           (Node.js: 5000)       │
│                                      │                 │
│                                      ▼                 │
│                              [ Uploads Volume ]        │
└──────────────────────────────────────┬─────────────────┘
                                       │
                                       ▼ SSL Connection
                        [ MongoDB Atlas Cloud Cluster ]
```

---

## 🚀 Option 1: AWS EC2 Deployment (Recommended)

### Step 1: Launch an EC2 Instance
1. Log into your **AWS Management Console** and navigate to **EC2**.
2. Click **Launch Instance**:
   - **Name**: `clouddrop-server`
   - **OS**: **Ubuntu Server 24.04 LTS** (or Amazon Linux 2023)
   - **Instance Type**: `t3.micro` (free-tier eligible) or `t3.small` (recommended for production)
   - **Key Pair**: Select or create a `.pem` key pair for SSH access
3. **Configure Security Group (Firewall Rules)**:
   Add the following inbound rules:
   | Type | Port | Source | Purpose |
   | :--- | :--- | :--- | :--- |
   | **SSH** | `22` | Your IP (or `0.0.0.0/0`) | Remote SSH terminal access |
   | **HTTP** | `80` | `0.0.0.0/0` (Anywhere) | Web application access |
   | **HTTPS** | `443` | `0.0.0.0/0` (Anywhere) | SSL encrypted traffic |
4. Click **Launch Instance**.

---

### Step 2: Configure MongoDB Atlas Network Access
MongoDB Atlas requires your EC2 IP address to be whitelisted:
1. Go to [MongoDB Atlas Console](https://cloud.mongodb.com/).
2. Under **Security**, click **Network Access**.
3. Click **Add IP Address**:
   - For testing or dynamic EC2 IPs: Click **Allow Access from Anywhere** (`0.0.0.0/0`).
   - For production: Allocate an **Elastic IP** in AWS EC2 and add that specific IP.
4. Click **Confirm**.

---

### Step 3: Connect to EC2 and Install Docker
Connect to your EC2 instance via SSH:
```bash
ssh -i /path/to/your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

Update packages and install Docker + Docker Compose:
```bash
# Update package list
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable non-root docker commands
sudo usermod -aG docker $USER
newgrp docker
```

---

### Step 4: Clone / Transfer Application Files
Clone your Git repository or transfer the project folder:
```bash
git clone <YOUR_GIT_REPO_URL> mern-compose
cd mern-compose
```

*(Alternatively, use `scp` to copy files directly from your computer):*
```bash
scp -i your-key.pem -r ./mern-compose ubuntu@<EC2-PUBLIC-IP>:~/
```

---

### Step 5: Configure Environment Variables
Create the production `.env` file in the project root:
```bash
nano .env
```
Paste your production settings:
```env
# Application Ports
PORT=5000
CLIENT_PORT=3000
NGINX_PORT=80

# Production MongoDB Atlas Cloud URI
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.lcjvbj2.mongodb.net/mern_db?retryWrites=true&w=majority

# Node Environment
NODE_ENV=production
```
Press `Ctrl + O` to save, then `Ctrl + X` to exit.

---

### Step 6: Build & Start Containers
Launch the stack in detached mode:
```bash
docker compose up --build -d
```

Verify that all three containers are healthy and running:
```bash
docker compose ps
```
Output:
```text
NAME            IMAGE               COMMAND                  SERVICE    CREATED          STATUS                    PORTS
mern_backend    mern-compose-backend "docker-entrypoint.s…"  backend    10 seconds ago   Up 10 seconds (healthy)   0.0.0.0:5000->5000/tcp
mern_frontend   mern-compose-frontend "/docker-entrypoint.…" frontend   10 seconds ago   Up 10 seconds (healthy)   0.0.0.0:3000->3000/tcp
mern_nginx      nginx:alpine        "/docker-entrypoint.…"   nginx      10 seconds ago   Up 10 seconds             0.0.0.0:80->80/tcp
```

Test the health check directly:
```bash
curl http://localhost/api/health
```

---

### Step 7: Access the Application
Open your web browser and navigate to:
```text
http://<YOUR_EC2_PUBLIC_IP>
```
Your CloudDrop file sharing application is now live on AWS!

---

## 🔒 Optional: Add Free SSL with Let's Encrypt (Certbot)

If you have a domain pointing to your EC2 instance (e.g. `files.example.com`):

1. Install Certbot on the EC2 host:
   ```bash
   sudo apt-get install -y certbot
   ```
2. Stop the temporary container running on port 80:
   ```bash
   docker compose down
   ```
3. Issue an SSL certificate:
   ```bash
   sudo certbot certonly --standalone -d files.example.com
   ```
4. Mount certificates in `docker-compose.yml` and update `nginx/default.conf` to listen on port 443 with SSL enabled.
5. Restart the containers:
   ```bash
   docker compose up -d
   ```

---

## 🛠️ Maintenance & Management Commands

| Command | Action |
| :--- | :--- |
| `docker compose logs -f` | View live logs from all containers |
| `docker compose logs backend -f` | View backend Express logs |
| `docker compose restart` | Restart all services |
| `docker compose down` | Stop all services |
| `docker compose up --build -d` | Rebuild and deploy latest code changes |
| `docker system prune -af` | Clean up unused images and build caches |
