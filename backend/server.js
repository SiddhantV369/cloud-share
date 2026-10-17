const path = require('path');
// Load environment variables from backend/.env or root .env
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const fileRoutes = require('./routes/fileRoutes');
const File = require('./models/File');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://admin:adminpassword@mongo:27017/mern_db?authSource=admin';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection handling
let isDbConnected = false;
const isAtlas = MONGO_URI.includes('mongodb+srv://') || MONGO_URI.includes('mongodb.net');

const connectDB = async () => {
  try {
    let targetUri = MONGO_URI;
    if (targetUri.includes('mongodb.net') && !targetUri.includes('mongodb.net/')) {
      targetUri = `${targetUri}/mern_db?retryWrites=true&w=majority`;
    } else if (targetUri.endsWith('mongodb.net/')) {
      targetUri = `${targetUri}mern_db?retryWrites=true&w=majority`;
    }

    const maskedUri = targetUri.replace(/:([^:@]{1,})@/, ':****@');
    console.log(`[Database] Connecting to ${isAtlas ? 'MongoDB Atlas (Cloud)' : 'MongoDB Docker Container'} at: ${maskedUri}`);
    await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 8000,
    });
    isDbConnected = true;
    console.log(`✅ [Database] ${isAtlas ? 'MongoDB Atlas (Cloud)' : 'MongoDB Docker Container'} connected successfully`);
  } catch (error) {
    isDbConnected = false;
    console.error('❌ [Database] MongoDB connection error:', error.message);
  }
};

connectDB();

mongoose.connection.on('disconnected', () => {
  isDbConnected = false;
  console.warn('⚠️ [Database] MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  isDbConnected = true;
  console.log('🔄 [Database] MongoDB reconnected');
});

// -------------------------------------------------------------
// Periodic Background Cleaner for Expired Files (every 15 min)
// -------------------------------------------------------------
const cleanupExpiredFiles = async () => {
  if (!isDbConnected) return;
  try {
    const now = new Date();
    // Find files that expired or reached download limits
    const expiredFiles = await File.find({
      $or: [
        { expiresAt: { $ne: null, $lt: now } },
      ],
    });

    for (const file of expiredFiles) {
      const filePath = path.join(UPLOAD_DIR, file.storedName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }
      await File.findByIdAndDelete(file._id);
      console.log(`🧹 [Cleaner] Auto-cleaned expired file: ${file.originalName}`);
    }
  } catch (err) {
    console.error('❌ [Cleaner] Error cleaning expired files:', err.message);
  }
};

setInterval(cleanupExpiredFiles, 15 * 60 * 1000);

// -------------------------------------------------------------
// Core Routes
// -------------------------------------------------------------

// Root info route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    service: 'mern-file-sharing-backend',
    message: 'MERN File Sharing API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbStatus = dbStateMap[mongoose.connection.readyState] || 'unknown';

  let storageUsed = 0;
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    storageUsed = files.reduce((acc, file) => {
      const p = path.join(UPLOAD_DIR, file);
      try {
        return acc + fs.statSync(p).size;
      } catch {
        return acc;
      }
    }, 0);
  } catch (_) {}

  res.json({
    status: isDbConnected ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      backend: 'healthy',
      database: dbStatus,
      isCloud: isAtlas,
      databaseType: isAtlas ? 'MongoDB Atlas (Cloud)' : 'MongoDB Docker Container',
    },
    storage: {
      uploadDir: UPLOAD_DIR,
      storageUsedBytes: storageUsed,
    },
    dbDetails: {
      isAtlas,
      host: mongoose.connection.host || 'none',
      name: mongoose.connection.name || 'none',
    },
  });
});

// API Overview
app.get('/api', (req, res) => {
  res.json({
    message: 'CloudDrop MERN File Sharing API',
    endpoints: [
      { method: 'GET', path: '/api/health', description: 'Stack health check' },
      { method: 'GET', path: '/api/files', description: 'List files with filters' },
      { method: 'GET', path: '/api/files/stats', description: 'Aggregated storage and download stats' },
      { method: 'POST', path: '/api/files/upload', description: 'Upload file (multipart/form-data)' },
      { method: 'GET', path: '/api/files/:shareCode', description: 'Get file info by share code' },
      { method: 'POST', path: '/api/files/:shareCode/verify', description: 'Verify file password' },
      { method: 'GET', path: '/api/files/:shareCode/download', description: 'Download or stream preview' },
      { method: 'DELETE', path: '/api/files/:id', description: 'Delete file' },
    ],
  });
});

// File Sharing routes
app.use('/api/files', fileRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size limit exceeded (maximum 100MB).' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Backend] File Sharing Server listening on port ${PORT}`);
  console.log(`🔗 [Backend] Health check: http://localhost:${PORT}/api/health`);
  console.log(`📂 [Backend] Upload storage directory: ${UPLOAD_DIR}`);
});
