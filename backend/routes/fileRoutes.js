const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const File = require('../models/File');

// Directory for uploaded files
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Middleware: ensure MongoDB is connected before running DB queries
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Database is currently connecting or unavailable. Please ensure MongoDB is running.',
    });
  }
  next();
});

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Multer upload middleware (100MB max limit)
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// Helper: Calculate expiration date
const calculateExpiry = (option) => {
  if (!option || option === 'never') return null;
  const now = Date.now();
  switch (option) {
    case '1h':
      return new Date(now + 60 * 60 * 1000);
    case '24h':
      return new Date(now + 24 * 60 * 60 * 1000);
    case '3d':
      return new Date(now + 3 * 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now + 7 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
};

// Helper: Generate unique short share code
const generateShareCode = async () => {
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = crypto.randomBytes(6).toString('base64url');
    const existing = await File.findOne({ shareCode: code });
    if (!existing) return code;
  }
  return crypto.randomUUID();
};

// -------------------------------------------------------------
// 1. Upload File
// -------------------------------------------------------------
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select a file.' });
    }

    const {
      description,
      uploaderName,
      password,
      expiryOption,
      maxDownloads,
    } = req.body;

    const shareCode = await generateShareCode();
    const expiresAt = calculateExpiry(expiryOption);

    const parsedMaxDownloads =
      maxDownloads && !isNaN(parseInt(maxDownloads, 10)) && parseInt(maxDownloads, 10) > 0
        ? parseInt(maxDownloads, 10)
        : null;

    const newFile = new File({
      originalName: req.file.originalname,
      storedName: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype || 'application/octet-stream',
      shareCode,
      description: description ? description.trim() : '',
      uploaderName: uploaderName ? uploaderName.trim() : 'Anonymous',
      maxDownloads: parsedMaxDownloads,
      expiresAt,
    });

    if (password && password.trim().length > 0) {
      newFile.setPassword(password.trim());
    }

    await newFile.save();

    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        id: newFile._id,
        originalName: newFile.originalName,
        fileSize: newFile.fileSize,
        mimeType: newFile.mimeType,
        shareCode: newFile.shareCode,
        description: newFile.description,
        uploaderName: newFile.uploaderName,
        isPasswordProtected: newFile.isPasswordProtected,
        maxDownloads: newFile.maxDownloads,
        downloadCount: newFile.downloadCount,
        expiresAt: newFile.expiresAt,
        createdAt: newFile.createdAt,
      },
    });
  } catch (error) {
    // If saving to DB fails, remove uploaded file from disk to avoid orphans
    if (req.file) {
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, req.file.filename));
      } catch (_) {}
    }
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'File upload failed' });
  }
});

// -------------------------------------------------------------
// 2. Overview Stats
// -------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const files = await File.find();
    const now = new Date();

    let totalBytes = 0;
    let totalDownloads = 0;
    let activeFilesCount = 0;

    files.forEach((f) => {
      const isExpired = f.expiresAt && now > f.expiresAt;
      const isLimitReached = f.maxDownloads && f.downloadCount >= f.maxDownloads;
      if (!isExpired && !isLimitReached) {
        activeFilesCount++;
        totalBytes += f.fileSize;
      }
      totalDownloads += f.downloadCount;
    });

    res.json({
      totalFiles: files.length,
      activeFiles: activeFilesCount,
      totalBytes,
      totalDownloads,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 3. List Active Files (with search, category filter, sorting)
// -------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { search, category, sort } = req.query;
    const query = {};

    // Search filter
    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ originalName: regex }, { description: regex }, { shareCode: regex }];
    }

    // Category filter
    if (category && category !== 'all') {
      switch (category) {
        case 'images':
          query.mimeType = { $regex: '^image/', $options: 'i' };
          break;
        case 'documents':
          query.$or = [
            { mimeType: { $regex: 'pdf|document|text|msword|officedocument', $options: 'i' } },
            { originalName: { $regex: '\\.(pdf|docx?|xlsx?|pptx?|txt|rtf|csv|md)$', $options: 'i' } },
          ];
          break;
        case 'media':
          query.mimeType = { $regex: '^(audio|video)/', $options: 'i' };
          break;
        case 'archives':
          query.$or = [
            { mimeType: { $regex: 'zip|tar|rar|gzip|7z', $options: 'i' } },
            { originalName: { $regex: '\\.(zip|rar|7z|tar|gz|bz2)$', $options: 'i' } },
          ];
          break;
        case 'code':
          query.$or = [
            { mimeType: { $regex: 'javascript|json|html|css|xml|yaml', $options: 'i' } },
            { originalName: { $regex: '\\.(js|jsx|ts|tsx|html|css|json|py|java|c|cpp|go|rs|sql|sh)$', $options: 'i' } },
          ];
          break;
        default:
          break;
      }
    }

    // Sorting
    let sortOptions = { createdAt: -1 };
    if (sort === 'oldest') sortOptions = { createdAt: 1 };
    else if (sort === 'size_desc') sortOptions = { fileSize: -1 };
    else if (sort === 'size_asc') sortOptions = { fileSize: 1 };
    else if (sort === 'downloads') sortOptions = { downloadCount: -1 };

    const files = await File.find(query).sort(sortOptions);

    const now = new Date();
    const formattedFiles = files.map((f) => {
      const isExpired = Boolean(f.expiresAt && now > f.expiresAt);
      const isLimitReached = Boolean(f.maxDownloads && f.downloadCount >= f.maxDownloads);
      return {
        id: f._id,
        originalName: f.originalName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        shareCode: f.shareCode,
        description: f.description,
        uploaderName: f.uploaderName,
        isPasswordProtected: f.isPasswordProtected,
        maxDownloads: f.maxDownloads,
        downloadCount: f.downloadCount,
        expiresAt: f.expiresAt,
        createdAt: f.createdAt,
        isExpired,
        isLimitReached,
        status: isExpired ? 'expired' : isLimitReached ? 'limit_reached' : 'active',
      };
    });

    res.json({ files: formattedFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 4. Get File Metadata by Share Code (for recipient preview)
// -------------------------------------------------------------
router.get('/:shareCode', async (req, res) => {
  try {
    const file = await File.findOne({ shareCode: req.params.shareCode });
    if (!file) {
      return res.status(404).json({ error: 'File not found or link has expired.' });
    }

    if (file.isExpired()) {
      return res.status(410).json({
        error: 'This file share link has expired.',
        isExpired: true,
        originalName: file.originalName,
      });
    }

    if (file.isLimitReached()) {
      return res.status(410).json({
        error: 'This file has reached its maximum download limit.',
        isLimitReached: true,
        originalName: file.originalName,
      });
    }

    res.json({
      file: {
        id: file._id,
        originalName: file.originalName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        shareCode: file.shareCode,
        description: file.description,
        uploaderName: file.uploaderName,
        isPasswordProtected: file.isPasswordProtected,
        maxDownloads: file.maxDownloads,
        downloadCount: file.downloadCount,
        expiresAt: file.expiresAt,
        createdAt: file.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 5. Verify Password
// -------------------------------------------------------------
router.post('/:shareCode/verify', async (req, res) => {
  try {
    const file = await File.findOne({ shareCode: req.params.shareCode }).select('+passwordHash +passwordSalt');
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!file.isPasswordProtected) {
      return res.json({ valid: true });
    }

    const { password } = req.body;
    const isValid = file.verifyPassword(password);
    if (!isValid) {
      return res.status(401).json({ valid: false, error: 'Incorrect password' });
    }

    res.json({ valid: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 6. Download / Preview File
// -------------------------------------------------------------
router.get('/:shareCode/download', async (req, res) => {
  try {
    const file = await File.findOne({ shareCode: req.params.shareCode }).select('+passwordHash +passwordSalt');
    if (!file) {
      return res.status(404).json({ error: 'File not found or link has expired.' });
    }

    if (file.isExpired()) {
      return res.status(410).json({ error: 'This file share link has expired.' });
    }

    if (file.isLimitReached()) {
      return res.status(410).json({ error: 'This file has reached its maximum download limit.' });
    }

    // Password verification
    if (file.isPasswordProtected) {
      const providedPassword = req.query.password || req.headers['x-file-password'];
      if (!file.verifyPassword(providedPassword)) {
        return res.status(401).json({ error: 'Password required or incorrect password provided.' });
      }
    }

    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical file not found on server.' });
    }

    const isPreview = req.query.preview === 'true';

    // Increment download count only if not an in-browser preview
    if (!isPreview) {
      file.downloadCount += 1;
      await file.save();
    }

    const disposition = isPreview ? 'inline' : 'attachment';
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(file.originalName)}"`
    );
    res.setHeader('Content-Length', file.fileSize);

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming file.' });
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 7. Delete File
// -------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Unlink physical file
    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.warn('Could not delete physical file:', unlinkErr.message);
      }
    }

    await File.findByIdAndDelete(req.params.id);
    res.json({ message: 'File deleted successfully', fileId: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
