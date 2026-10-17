# CloudDrop • MERN Stack File Sharing Application

A complete, production-ready multi-container file sharing application powered by the **MERN** stack (**MongoDB**, **Express.js**, **React + Vite**, and **Node.js**) orchestrated with **Docker Compose** and **Nginx**.

---

## 🌟 Features

- **⚡ Fast Drag & Drop Uploads**: Seamlessly upload files up to 100MB with real-time feedback and animated upload status.
- **🔗 Instant Shareable Links**: Generates concise, URL-safe 8-character share codes (`/?share=BCZVCWQq`).
- **📱 Built-in QR Code Generator**: Generate high-res QR codes for any shared file to allow instant mobile scanning and downloading.
- **🔒 Password Protection**: Optional salted PBKDF2 password protection for secure transfers.
- **⏱️ Configurable Auto-Expiry**: Set files to auto-expire after 1 Hour, 24 Hours, 3 Days, 7 Days, or Never.
- **🔥 Download Limits (Burn-After-Reading)**: Set download limits (1, 5, 10, or unlimited) with automated cleanup.
- **📁 File Explorer**: Search by name or note, filter by category (Images, Documents, Media, Code, Archives), and sort by newest, size, or downloads.
- **👁️ In-Browser Preview & Media Streaming**: Stream images, audio, video, and PDFs directly in the browser or trigger immediate file downloads.
- **🐳 Multi-Container Architecture**: Pre-configured with Docker Compose, persistent volumes for MongoDB and uploaded files, and Nginx reverse proxy with 100MB body size support.

---

## 📁 Directory Structure

```text
mern-compose/
├── docker-compose.yml       # Docker Compose multi-service definition & persistent volumes
├── .env                     # Environment variables configuration
├── .env.example             # Example environment template
├── nginx/
│   └── default.conf         # Nginx reverse proxy with 100MB client_max_body_size
├── backend/
│   ├── Dockerfile           # Backend container build definition
│   ├── .dockerignore        # Excludes node_modules & local uploads from build
│   ├── package.json         # Express, Mongoose, Multer dependencies
│   ├── server.js            # Express server entry point & auto-cleaner worker
│   ├── models/
│   │   └── File.js          # Mongoose File schema with PBKDF2 password methods
│   └── routes/
│       └── fileRoutes.js    # REST endpoints for upload, stats, download, and delete
└── frontend/
    ├── Dockerfile           # Frontend container build definition
    ├── .dockerignore        # Frontend build ignore rules
    ├── index.html           # HTML5 template with Google Fonts
    ├── package.json         # React 19, Vite, Lucide-React, QRCode
    ├── vite.config.js       # Vite server configuration with HMR polling
    └── src/
        ├── App.jsx          # Main application dashboard & state
        ├── App.css          # Design system & glassmorphism theme
        ├── index.css        # Base stylesheet & color tokens
        ├── components/
        │   ├── UploadView.jsx     # Drag-and-drop uploader with security controls
        │   ├── FileExplorer.jsx   # Searchable file catalog & card grid
        │   ├── FileModal.jsx      # File preview, password gate & download portal
        │   ├── LookupView.jsx     # Access shared files via code or link
        │   └── QRCodeModal.jsx    # QR Code modal for mobile sharing
        └── utils/
            └── formatters.js      # File size, date, countdown & category helpers
```

---

## 🌐 Network Architecture & Ports

| Service | Internal Host & Port | Host Port | Description |
| :--- | :--- | :--- | :--- |
| **Nginx** | `nginx:80` | `80` (or `$NGINX_PORT`) | Reverse proxy routing `/` to Frontend and `/api` to Backend |
| **Frontend** | `frontend:3000` | `3000` (or `$CLIENT_PORT`) | Vite + React Single Page App with HMR support |
| **Backend** | `backend:5000` | `5000` (or `$PORT`) | Express.js API handling Multer uploads & storage |
| **MongoDB** | `mongo:27017` | `27017` (or `$MONGO_PORT`) | MongoDB 7.0 database with persistent storage volume |

---

## 🚀 REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check for backend, database, and storage |
| `GET` | `/api/files` | List active files with search, category, and sort parameters |
| `GET` | `/api/files/stats` | Aggregated stats (total files, storage used, download count) |
| `POST` | `/api/files/upload` | Upload file (`multipart/form-data`) with expiry and password options |
| `GET` | `/api/files/:shareCode` | Get file metadata for recipient download/preview |
| `POST` | `/api/files/:shareCode/verify` | Verify file password |
| `GET` | `/api/files/:shareCode/download` | Download file or stream preview (`?preview=true`) |
| `DELETE` | `/api/files/:id` | Permanently delete file and purge disk storage |

---

## 🗄️ MongoDB Docker Container Configuration

The application is configured to run with a dedicated **MongoDB 7.0 Docker container** with persistent storage:

1. **Docker Compose Configuration**:
   The `mongo` service starts automatically, initializes root credentials (`admin`/`adminpassword`), and mounts persistent storage to the `mongo_data` named volume (`/data/db`).
   ```env
   # Connection URI used by backend inside docker-compose
   MONGO_URI=mongodb://admin:adminpassword@mongo:27017/mern_db?authSource=admin
   ```
2. **Local Host Development**:
   If running the backend on the host machine (`npm run dev`) while the MongoDB container runs in Docker, connect via the mapped port:
   ```env
   MONGO_URI=mongodb://admin:adminpassword@localhost:27017/mern_db?authSource=admin
   ```

---

## 🐳 Quick Start with Docker Compose

### 1. Build & Launch Containers
From the `mern-compose/` root directory:
```bash
docker compose up --build
```
Or run detached in the background:
```bash
docker compose up --build -d
```

### 2. Open in Browser
- **Web Application**: [http://localhost](http://localhost) (via Nginx proxy)
- **Direct Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## ☁️ Deploying to AWS (EC2 / Lightsail / ECS)

The application is fully containerized and production-ready for AWS.
See the complete step-by-step guide: [AWS_DEPLOYMENT.md](file:///c:/Users/Siddhant%20Verma/OneDrive/Documents/Comeback/mern-compose/AWS_DEPLOYMENT.md)

Quick deploy on an AWS EC2 instance:
```bash
chmod +x deploy-aws.sh
./deploy-aws.sh
```


