import { useState, useEffect } from 'react';
import {
  X,
  Download,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  Check,
  QrCode as QrIcon,
  Clock,
  HardDrive,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  FileCode,
  File as FileIcon,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { formatBytes, formatTimeLeft, formatDate, getFileCategory } from '../utils/formatters';

export default function FileModal({ fileData, shareCode, onClose, onShowQr, onDownloadSuccess }) {
  const [file, setFile] = useState(fileData || null);
  const [loading, setLoading] = useState(!fileData);
  const [error, setError] = useState(null);

  // Password state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [copied, setCopied] = useState(false);

  // Fetch file if only shareCode was provided
  useEffect(() => {
    if (!fileData && shareCode) {
      setLoading(true);
      fetch(`/api/files/${shareCode}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to fetch file details');
          }
          setFile(data.file);
          if (!data.file.isPasswordProtected) {
            setIsUnlocked(true);
          }
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => setLoading(false));
    } else if (fileData) {
      setFile(fileData);
      if (!fileData.isPasswordProtected) {
        setIsUnlocked(true);
      }
    }
  }, [fileData, shareCode]);

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (!password) {
      setPasswordError('Please enter the password');
      return;
    }

    setVerifyingPassword(true);
    setPasswordError('');
    try {
      const code = file?.shareCode || shareCode;
      const res = await fetch(`/api/files/${code}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setIsUnlocked(true);
      } else {
        setPasswordError(data.error || 'Incorrect password. Please try again.');
      }
    } catch (err) {
      setPasswordError(`Error verifying password: ${err.message}`);
    } finally {
      setVerifyingPassword(false);
    }
  };

  const getFullShareUrl = () => {
    const code = file?.shareCode || shareCode;
    return `${window.location.origin}/?share=${code}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(getFullShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const code = file?.shareCode || shareCode;
    let url = `/api/files/${code}/download`;
    if (file?.isPasswordProtected && password) {
      url += `?password=${encodeURIComponent(password)}`;
    }
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = file?.originalName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onDownloadSuccess) {
      onDownloadSuccess(file?.id);
    }
  };

  const renderIcon = (cat, size = 28) => {
    switch (cat) {
      case 'images':
        return <FileImage size={size} className="cat-blue" />;
      case 'documents':
        return <FileText size={size} className="cat-blue" />;
      case 'media':
        return <FileVideo size={size} className="cat-orange" />;
      case 'code':
        return <FileCode size={size} className="cat-blue" />;
      case 'archives':
        return <FileArchive size={size} className="cat-orange" />;
      default:
        return <FileIcon size={size} className="cat-blue" />;
    }
  };

  const category = file ? getFileCategory(file.mimeType, file.originalName) : 'other';
  const downloadUrl = file
    ? `/api/files/${file.shareCode}/download${
        file.isPasswordProtected && password ? `?password=${encodeURIComponent(password)}` : ''
      }`
    : '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass-panel modal-card file-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <div className="modal-icon-badge">
              {renderIcon(category, 22)}
            </div>
            <div>
              <h3>Shared File</h3>
              <p className="modal-subtitle">Ready for preview and secure download</p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="modal-loading">
            <div className="spinner" />
            <p>Loading file details...</p>
          </div>
        ) : error ? (
          <div className="modal-error-state">
            <AlertCircle size={40} className="text-rose" />
            <h4>File Unavailable</h4>
            <p>{error}</p>
            <button className="btn btn-secondary mt-4" onClick={onClose}>
              Close
            </button>
          </div>
        ) : file ? (
          <div className="file-modal-content">
            {/* File Header Card */}
            <div className="file-meta-card">
              <div className="file-meta-header">
                <div className="file-meta-icon-large">
                  {renderIcon(category, 36)}
                </div>
                <div className="file-meta-text">
                  <h4 className="file-modal-filename" title={file.originalName}>
                    {file.originalName}
                  </h4>
                  <div className="file-meta-tags">
                    <span className="meta-tag size-tag">{formatBytes(file.fileSize)}</span>
                    <span className="meta-tag type-tag">{file.mimeType}</span>
                    {file.isPasswordProtected && (
                      <span className="meta-tag lock-tag">
                        {isUnlocked ? <Unlock size={12} /> : <Lock size={12} />}
                        {isUnlocked ? 'Unlocked' : 'Password Protected'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Note / Message */}
              {file.description && (
                <div className="file-note-box">
                  <span className="file-note-label">Sender Note:</span>
                  <p className="file-note-content">"{file.description}"</p>
                </div>
              )}

              {/* Detailed metrics grid */}
              <div className="file-stats-grid">
                <div className="file-stat-item">
                  <Clock size={14} className="stat-icon" />
                  <div>
                    <span className="stat-label">Expires</span>
                    <span className="stat-val">{formatTimeLeft(file.expiresAt)}</span>
                  </div>
                </div>

                <div className="file-stat-item">
                  <Download size={14} className="stat-icon" />
                  <div>
                    <span className="stat-label">Downloads</span>
                    <span className="stat-val">
                      {file.downloadCount}
                      {file.maxDownloads ? ` / ${file.maxDownloads}` : ' (unlimited)'}
                    </span>
                  </div>
                </div>

                <div className="file-stat-item">
                  <HardDrive size={14} className="stat-icon" />
                  <div>
                    <span className="stat-label">Uploaded</span>
                    <span className="stat-val">{formatDate(file.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Password Gate */}
            {file.isPasswordProtected && !isUnlocked ? (
              <form className="password-gate-form glass-subpanel" onSubmit={handleVerifyPassword}>
                <div className="password-gate-header">
                  <Lock size={20} className="text-amber" />
                  <h5>Password Required</h5>
                </div>
                <p className="password-gate-desc">
                  This file was protected with a password by the uploader. Enter the password to unlock.
                </p>

                <div className="password-input-group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field"
                    placeholder="Enter file password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError('');
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {passwordError && <p className="error-text">{passwordError}</p>}

                <button
                  type="submit"
                  className="btn btn-primary w-full mt-3"
                  disabled={verifyingPassword}
                >
                  {verifyingPassword ? 'Verifying...' : 'Unlock File'}
                </button>
              </form>
            ) : (
              /* Preview Area when unlocked */
              <div className="file-preview-section">
                {category === 'images' && (
                  <div className="image-preview-wrapper">
                    <img
                      src={`${downloadUrl}&preview=true`}
                      alt={file.originalName}
                      className="image-preview-element"
                      loading="lazy"
                    />
                  </div>
                )}

                {category === 'media' && file.mimeType?.startsWith('audio') && (
                  <div className="media-preview-wrapper">
                    <audio controls className="w-full">
                      <source src={`${downloadUrl}&preview=true`} type={file.mimeType} />
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}

                {category === 'media' && file.mimeType?.startsWith('video') && (
                  <div className="media-preview-wrapper">
                    <video controls className="video-preview-element">
                      <source src={`${downloadUrl}&preview=true`} type={file.mimeType} />
                      Your browser does not support video playback.
                    </video>
                  </div>
                )}

                {category === 'documents' && file.mimeType?.includes('pdf') && (
                  <div className="pdf-preview-box">
                    <FileText size={32} className="cat-blue" />
                    <div>
                      <p className="pdf-preview-title">PDF Document</p>
                      <a
                        href={`${downloadUrl}&preview=true`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        <ExternalLink size={14} /> Open in browser tab
                      </a>
                    </div>
                  </div>
                )}

                {/* Quick Share Link Row */}
                <div className="share-url-row">
                  <input
                    type="text"
                    readOnly
                    value={getFullShareUrl()}
                    className="share-url-input"
                  />
                  <button className="btn btn-secondary btn-sm" onClick={handleCopyLink}>
                    {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy Link'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onShowQr && onShowQr(getFullShareUrl(), file.originalName)}
                    title="View QR Code"
                  >
                    <QrIcon size={14} /> QR
                  </button>
                </div>

                {/* Primary Download Button */}
                <button className="btn btn-primary btn-large w-full mt-4" onClick={handleDownload}>
                  <Download size={20} /> Download File ({formatBytes(file.fileSize)})
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
