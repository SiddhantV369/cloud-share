import { useState, useRef } from 'react';
import {
  UploadCloud,
  File as FileIcon,
  X,
  Lock,
  Clock,
  Check,
  Copy,
  QrCode as QrIcon,
  Eye,
  EyeOff,
  ArrowRight,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { formatBytes, formatTimeLeft } from '../utils/formatters';
import { getClientId } from '../utils/clientId';
import {
  generateRandomKey,
  deriveKeyFromPassword,
  generateIv,
  generateSalt,
  encryptBuffer,
  bufferToBase64,
  saveFileKey,
} from '../utils/crypto';

export default function UploadView({ onUploadSuccess, onShowQr, onOpenFile }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Expiration options (presets + manual/custom)
  const [expiryOption, setExpiryOption] = useState('24h'); // '1h' | '24h' | '7d' | 'never' | 'custom'
  const [customExpiryVal, setCustomExpiryVal] = useState('12');
  const [customExpiryUnit, setCustomExpiryUnit] = useState('h'); // 'm' | 'h' | 'd'

  // Download limit options (presets + manual/custom)
  const [downloadLimitOption, setDownloadLimitOption] = useState('unlimited'); // 'unlimited' | '1' | '5' | '10' | 'custom'
  const [customDownloadLimit, setCustomDownloadLimit] = useState('20');

  // Security & Note
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [description, setDescription] = useState('');

  // Post-upload state
  const [uploadedResult, setUploadedResult] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file) => {
    setErrorMessage('');
    if (file.size > 100 * 1024 * 1024) {
      setErrorMessage('Selected file exceeds maximum limit of 100MB.');
      return;
    }
    setSelectedFile(file);
    setUploadedResult(null);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.');
      return;
    }

    if (enablePassword && !password.trim()) {
      setErrorMessage('Please enter a password or disable password protection.');
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    setErrorMessage('');

    try {
      // 1. Read file into ArrayBuffer
      const fileBuffer = await selectedFile.arrayBuffer();
      const iv = generateIv();

      let cryptoKey = null;
      let keyString = null;
      let salt = null;

      // 2. Prepare encryption key
      if (enablePassword && password.trim()) {
        salt = generateSalt();
        cryptoKey = await deriveKeyFromPassword(password.trim(), salt);
      } else {
        const keyObj = await generateRandomKey();
        cryptoKey = keyObj.key;
        keyString = keyObj.keyString;
      }

      // 3. Encrypt file in browser using AES-256-GCM
      setUploadProgress(35);
      const ciphertextBuffer = await encryptBuffer(fileBuffer, cryptoKey, iv);
      const encryptedBlob = new Blob([ciphertextBuffer], { type: 'application/octet-stream' });

      // Calculate effective expiration
      let effectiveExpiry = expiryOption;
      if (expiryOption === 'custom') {
        const val = parseInt(customExpiryVal, 10);
        if (isNaN(val) || val <= 0) {
          throw new Error('Please enter a valid positive number for custom expiration.');
        }
        effectiveExpiry = `${val}${customExpiryUnit}`;
      }

      // Calculate effective max downloads
      let effectiveMaxDownloads = null;
      if (downloadLimitOption === 'custom') {
        const dls = parseInt(customDownloadLimit, 10);
        if (isNaN(dls) || dls <= 0) {
          throw new Error('Please enter a valid positive number for download limit.');
        }
        effectiveMaxDownloads = String(dls);
      } else if (downloadLimitOption !== 'unlimited') {
        effectiveMaxDownloads = downloadLimitOption;
      }

      // 4. Prepare FormData
      const clientId = getClientId();
      const formData = new FormData();
      formData.append('file', encryptedBlob, selectedFile.name);
      formData.append('originalFileName', selectedFile.name);
      formData.append('originalMimeType', selectedFile.type || 'application/octet-stream');
      formData.append('isEncrypted', 'true');
      formData.append('encryptionIv', bufferToBase64(iv));
      if (salt) {
        formData.append('encryptionSalt', bufferToBase64(salt));
      }
      formData.append('expiryOption', effectiveExpiry);
      if (effectiveMaxDownloads) {
        formData.append('maxDownloads', effectiveMaxDownloads);
      }
      formData.append('clientId', clientId);
      if (enablePassword && password.trim()) {
        formData.append('password', password.trim());
      }
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      setUploadProgress(65);
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'X-Client-Id': clientId,
        },
        body: formData,
      });

      setUploadProgress(100);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // 5. Cache encryption key locally for uploader's browser
      if (keyString) {
        saveFileKey(data.file.shareCode, keyString);
      }

      const fileWithKey = {
        ...data.file,
        encryptionKey: keyString,
      };

      setUploadedResult(fileWithKey);
      if (onUploadSuccess) {
        onUploadSuccess(fileWithKey);
      }
    } catch (err) {
      console.error('Encryption/Upload error:', err);
      setErrorMessage(err.message || 'Error encrypting and uploading file');
    } finally {
      setUploading(false);
    }
  };

  const getShareUrl = (fileObj) => {
    if (!fileObj) return '';
    const code = typeof fileObj === 'string' ? fileObj : fileObj.shareCode;
    const key =
      typeof fileObj === 'object' && fileObj.encryptionKey
        ? fileObj.encryptionKey
        : uploadedResult?.encryptionKey || null;
    const base = `${window.location.origin}/?share=${code}`;
    return key ? `${base}#key=${key}` : base;
  };

  const handleCopyLink = () => {
    if (!uploadedResult) return;
    const url = getShareUrl(uploadedResult);
    navigator.clipboard?.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setUploadedResult(null);
    setPassword('');
    setEnablePassword(false);
    setDescription('');
    setExpiryOption('24h');
    setCustomExpiryVal('12');
    setCustomExpiryUnit('h');
    setDownloadLimitOption('unlimited');
    setCustomDownloadLimit('20');
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="upload-view-container">
      {uploadedResult ? (
        /* Simplistic Success Card */
        <div className="glass-panel upload-success-card">
          <div className="success-icon-badge">
            <Sparkles size={28} className="text-orange" />
          </div>

          <h3 className="success-title">Link Generated!</h3>
          <p className="success-subtitle">
            Anyone with this link can view and download{' '}
            <strong className="text-dark">{uploadedResult.originalName}</strong>
          </p>

          <div className="share-link-box">
            <input
              type="text"
              readOnly
              value={getShareUrl(uploadedResult)}
              className="share-link-input"
            />
            <button className="btn btn-primary" onClick={handleCopyLink}>
              {linkCopied ? <Check size={16} /> : <Copy size={16} />}
              {linkCopied ? 'Copied' : 'Copy Link'}
            </button>
          </div>

          <div className="success-meta-row">
            <span className="meta-pill pill-encrypted">
              <ShieldCheck size={13} className="text-emerald" /> End-to-End Encrypted (AES-256)
            </span>
            <span className="meta-pill">
              <Clock size={13} /> Expires:{' '}
              {uploadedResult.expiresAt ? formatTimeLeft(uploadedResult.expiresAt) : 'Never'}
            </span>
            <span className="meta-pill">
              <Download size={13} /> Limit:{' '}
              {uploadedResult.maxDownloads
                ? `${uploadedResult.maxDownloads} download${uploadedResult.maxDownloads > 1 ? 's' : ''}`
                : 'Unlimited'}
            </span>
            {uploadedResult.isPasswordProtected && (
              <span className="meta-pill pill-locked">
                <Lock size={13} /> Password Protected
              </span>
            )}
          </div>

          <div className="success-actions-row">
            <button
              className="btn btn-orange"
              onClick={() =>
                onShowQr &&
                onShowQr(getShareUrl(uploadedResult), uploadedResult.originalName)
              }
            >
              <QrIcon size={16} /> QR Code
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onOpenFile && onOpenFile(uploadedResult)}
            >
              <ArrowRight size={16} /> View Page
            </button>
            <button className="btn btn-ghost" onClick={resetUploadForm}>
              Upload Another
            </button>
          </div>
        </div>
      ) : (
        /* Simplistic Upload Form */
        <form onSubmit={handleSubmit} className="upload-form">
          {/* Dropzone */}
          <div
            className={`glass-panel dropzone ${dragActive ? 'dropzone-active' : ''} ${
              selectedFile ? 'has-file' : ''
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden-file-input"
              onChange={handleFileChange}
            />

            {selectedFile ? (
              <div className="selected-file-preview">
                <div className="file-avatar">
                  <FileIcon size={32} className="text-blue" />
                </div>
                <div className="file-details">
                  <h4 className="file-name" title={selectedFile.name}>
                    {selectedFile.name}
                  </h4>
                  <p className="file-size">{formatBytes(selectedFile.size)}</p>
                </div>
                <button
                  type="button"
                  className="icon-btn remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearFile();
                  }}
                  title="Remove file"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="dropzone-prompt">
                <div className="upload-icon-circle">
                  <UploadCloud size={36} className="text-blue" />
                </div>
                <h3 className="dropzone-title">
                  Drop your file here, or <span className="text-blue highlight-link">browse</span>
                </h3>
                <p className="dropzone-helper">
                  Supports all formats up to 100MB
                </p>
              </div>
            )}
          </div>

          {/* Simple Settings */}
          <div className="glass-panel upload-options-card">
            <div className="options-grid">
              {/* Auto Expiry with Presets & Manual Custom Input */}
              <div className="option-group">
                <label className="option-label">
                  <Clock size={14} /> Expiration
                </label>
                <div className="expiry-pills">
                  {[
                    { label: '1 Hour', val: '1h' },
                    { label: '24 Hours', val: '24h' },
                    { label: '7 Days', val: '7d' },
                    { label: 'Never', val: 'never' },
                    { label: 'Custom', val: 'custom' },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      className={`pill-btn ${expiryOption === p.val ? 'pill-active' : ''}`}
                      onClick={() => setExpiryOption(p.val)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {expiryOption === 'custom' && (
                  <div className="custom-input-row mt-2">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      className="input-field custom-number-input"
                      placeholder="Duration"
                      value={customExpiryVal}
                      onChange={(e) => setCustomExpiryVal(e.target.value)}
                    />
                    <select
                      className="input-field custom-unit-select"
                      value={customExpiryUnit}
                      onChange={(e) => setCustomExpiryUnit(e.target.value)}
                    >
                      <option value="m">Minutes</option>
                      <option value="h">Hours</option>
                      <option value="d">Days</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Download Limit with Presets & Manual Custom Input */}
              <div className="option-group">
                <label className="option-label">
                  <Download size={14} /> Download Limit
                </label>
                <div className="expiry-pills">
                  {[
                    { label: 'Unlimited', val: 'unlimited' },
                    { label: '1 (Single-use)', val: '1' },
                    { label: '5', val: '5' },
                    { label: '10', val: '10' },
                    { label: 'Custom', val: 'custom' },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      className={`pill-btn ${downloadLimitOption === p.val ? 'pill-active' : ''}`}
                      onClick={() => setDownloadLimitOption(p.val)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {downloadLimitOption === 'custom' && (
                  <div className="custom-input-row mt-2">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      className="input-field custom-number-input"
                      placeholder="Max downloads"
                      value={customDownloadLimit}
                      onChange={(e) => setCustomDownloadLimit(e.target.value)}
                    />
                    <span className="custom-input-unit-label">downloads</span>
                  </div>
                )}
              </div>

              {/* Password Protection */}
              <div className="option-group">
                <div className="option-label-toggle">
                  <label className="option-label">
                    <Lock size={14} /> Password Protection
                  </label>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={enablePassword}
                      onChange={(e) => setEnablePassword(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {enablePassword && (
                  <div className="password-input-wrapper mt-2">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input-field"
                      placeholder="Set a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Message / Note */}
              <div className="option-group">
                <label className="option-label">
                  <MessageSquare size={14} /> Note for recipient (optional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Design files for review"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                />
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="error-banner">
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Progress bar */}
          {uploading && (
            <div className="upload-progress-container">
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span className="progress-text">
                {uploadProgress < 40
                  ? '🔒 Encrypting file in browser (AES-256-GCM)...'
                  : `Uploading encrypted file... ${uploadProgress}%`}
              </span>
            </div>
          )}

          {/* Zero-Knowledge Security Badge */}
          <div className="e2ee-security-note">
            <ShieldCheck size={14} className="text-emerald" />
            <span>
              <strong>Zero-Knowledge Encryption:</strong> Encrypted in your browser before upload.
            </span>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="btn btn-primary btn-large w-full upload-submit-btn"
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <div className="spinner-small" /> Encrypting & Uploading...
              </>
            ) : (
              <>
                <UploadCloud size={18} /> Encrypt & Share File
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
