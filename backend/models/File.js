const mongoose = require('mongoose');
const crypto = require('crypto');

const fileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: [true, 'Original file name is required'],
      trim: true,
    },
    storedName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    shareCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxLength: 500,
    },
    uploaderName: {
      type: String,
      default: 'Anonymous',
      trim: true,
      maxLength: 100,
    },
    isPasswordProtected: {
      type: Boolean,
      default: false,
    },
    passwordSalt: {
      type: String,
      select: false,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    maxDownloads: {
      type: Number,
      default: null, // null = unlimited
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: null, // null = never expires
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Method to set password with PBKDF2
fileSchema.methods.setPassword = function (password) {
  if (!password || password.trim() === '') {
    this.isPasswordProtected = false;
    this.passwordSalt = undefined;
    this.passwordHash = undefined;
    return;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  this.passwordSalt = salt;
  this.passwordHash = hash;
  this.isPasswordProtected = true;
};

// Method to verify password
fileSchema.methods.verifyPassword = function (password) {
  if (!this.isPasswordProtected) return true;
  if (!password || !this.passwordSalt || !this.passwordHash) return false;
  const hash = crypto.pbkdf2Sync(password, this.passwordSalt, 1000, 64, 'sha512').toString('hex');
  return hash === this.passwordHash;
};

// Virtual: is file expired
fileSchema.methods.isExpired = function () {
  if (!this.expiresAt) return false;
  return new Date() > new Date(this.expiresAt);
};

// Virtual: is download limit reached
fileSchema.methods.isLimitReached = function () {
  if (!this.maxDownloads) return false;
  return this.downloadCount >= this.maxDownloads;
};

module.exports = mongoose.model('File', fileSchema);
