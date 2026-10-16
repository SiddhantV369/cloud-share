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
} from 'lucide-react';
import { formatBytes } from '../utils/formatters';

export default function UploadView({ onUploadSuccess, onShowQr, onOpenFile }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Simplistic options
  const [expiryOption, setExpiryOption] = useState('24h');
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
    setUploadProgress(20);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('expiryOption', expiryOption);
    if (enablePassword && password.trim()) {
      formData.append('password', password.trim());
    }
    if (description.trim()) {
      formData.append('description', description.trim());
    }

    // Progress simulation
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) {
          clearInterval(interval);
          return 85;
        }
        return prev + 15;
      });
    }, 120);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);
      setUploadProgress(100);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadedResult(data.file);
      if (onUploadSuccess) {
        onUploadSuccess(data.file);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error uploading file');
    } finally {
      clearInterval(interval);
      setUploading(false);
    }
  };

  const getShareUrl = (code) => {
    return `${window.location.origin}/?share=${code}`;
  };

  const handleCopyLink = () => {
    if (!uploadedResult) return;
    const url = getShareUrl(uploadedResult.shareCode);
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
              value={getShareUrl(uploadedResult.shareCode)}
              className="share-link-input"
            />
            <button className="btn btn-primary" onClick={handleCopyLink}>
              {linkCopied ? <Check size={16} /> : <Copy size={16} />}
              {linkCopied ? 'Copied' : 'Copy Link'}
            </button>
          </div>

          <div className="success-meta-row">
            <span className="meta-pill">
              <Clock size={13} /> Expires in: {expiryOption === 'never' ? 'Never' : expiryOption}
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
                onShowQr(getShareUrl(uploadedResult.shareCode), uploadedResult.originalName)
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
              {/* Auto Expiry */}
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
              <div className="option-group full-width">
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
              <span className="progress-text">Uploading... {uploadProgress}%</span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            className="btn btn-primary btn-large w-full upload-submit-btn"
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <div className="spinner-small" /> Uploading...
              </>
            ) : (
              <>
                <UploadCloud size={18} /> Share File
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
