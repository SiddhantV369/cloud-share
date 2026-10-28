import { useState, useEffect, useRef } from 'react';
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
  ShieldCheck,
  Key,
} from 'lucide-react';
import { formatBytes, formatTimeLeft, formatDate, getFileCategory } from '../utils/formatters';
import {
  extractKeyFromUrlHash,
  getFileKey,
  base64ToBuffer,
  decryptBuffer,
  deriveKeyFromPassword,
  importKeyFromString,
} from '../utils/crypto';

export default function FileModal({ fileData, shareCode, onClose, onShowQr, onDownloadSuccess }) {
  const [file, setFile] = useState(fileData || null);
  const [loading, setLoading] = useState(!fileData);
  const [error, setError] = useState(null);

  // Password state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(fileData ? !fileData.isPasswordProtected : false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Client-Side Decryption state
  const [manualKey, setManualKey] = useState('');
  const [decryptedBlobUrl, setDecryptedBlobUrl] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionError, setDecryptionError] = useState('');

  const [copied, setCopied] = useState(false);
  const activeBlobUrlRef = useRef(null);
  const hasDecryptedRef = useRef(false);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
    };
  }, []);

  // Pure helper to extract the encryption key from available sources
  const resolveKey = (targetFile) => {
    const code = targetFile?.shareCode || shareCode;
    return (
      targetFile?.encryptionKey ||
      extractKeyFromUrlHash() ||
      getFileKey(code) ||
      null
    );
  };

  // Decrypt file blob in browser memory
  const decryptFileBlob = async (targetFile, keyOverride = null, pwdOverride = null) => {
    const f = targetFile || file;
    if (!f || !f.isEncrypted) return null;

    setIsDecrypting(true);
    setDecryptionError('');

    try {
      const code = f.shareCode || shareCode;
      const pwd = pwdOverride || password;
      let downloadEndpoint = `/api/files/${code}/download?preview=true`;
      if (f.isPasswordProtected && pwd) {
        downloadEndpoint += `&password=${encodeURIComponent(pwd)}`;
      }

      // 1. Fetch ciphertext binary
      const res = await fetch(downloadEndpoint);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to download encrypted data');
      }
      const ciphertextBuffer = await res.arrayBuffer();

      // 2. Prepare CryptoKey
      let cryptoKey = null;
      if (f.isPasswordProtected) {
        if (!pwd) throw new Error('Password required to decrypt');
        const saltBuffer = base64ToBuffer(f.encryptionSalt);
        cryptoKey = await deriveKeyFromPassword(pwd, saltBuffer);
      } else {
        const keyStr = keyOverride || resolveKey(f) || manualKey.trim();
        if (!keyStr) {
          throw new Error('Decryption key required');
        }
        cryptoKey = await importKeyFromString(keyStr);
      }

      // 3. Decrypt ciphertext with AES-256-GCM
      const ivBuffer = base64ToBuffer(f.encryptionIv);
      const plaintextBuffer = await decryptBuffer(
        ciphertextBuffer,
        cryptoKey,
        new Uint8Array(ivBuffer)
      );

      // 4. Create in-memory Blob
      const blob = new Blob([plaintextBuffer], {
        type: f.mimeType || 'application/octet-stream',
      });
      const objectUrl = URL.createObjectURL(blob);

      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      activeBlobUrlRef.current = objectUrl;
      setDecryptedBlobUrl(objectUrl);
      hasDecryptedRef.current = true;
      return objectUrl;
    } catch (err) {
      console.error('Decryption failed:', err);
      setDecryptionError(
        f.isPasswordProtected
          ? 'Incorrect password. Decryption failed.'
          : 'Invalid or missing decryption key.'
      );
      return null;
    } finally {
      setIsDecrypting(false);
    }
  };

  // Initialize modal data & auto-decrypt once (Fixed dependency loop to prevent flashing)
  useEffect(() => {
    let isMounted = true;
    hasDecryptedRef.current = false;

    const initModal = async () => {
      let currentFile = fileData;

      if (!currentFile && shareCode) {
        setLoading(true);
        try {
          const res = await fetch(`/api/files/${shareCode}`);
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to fetch file details');
          }
          if (isMounted) {
            currentFile = data.file;
            setFile(data.file);
            if (!data.file.isPasswordProtected) {
              setIsUnlocked(true);
            }
          }
        } catch (err) {
          if (isMounted) {
            setError(err.message);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      }

      if (!currentFile || !isMounted) return;

      // Auto-decrypt if not password protected and key is available
      if (!currentFile.isPasswordProtected && currentFile.isEncrypted && !hasDecryptedRef.current) {
        const key = resolveKey(currentFile);
        if (key) {
          await decryptFileBlob(currentFile, key);
        }
      }
    };

    initModal();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCode, fileData?.id]);

  // Handle password unlock
  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (!password) {
      setPasswordError('Please enter the password');
      return;
    }

    setVerifyingPassword(true);
    setPasswordError('');

    try {
      if (file?.isEncrypted) {
        const resultUrl = await decryptFileBlob(file, null, password);
        if (resultUrl) {
          setIsUnlocked(true);
        } else {
          setPasswordError('Incorrect password. Please try again.');
        }
      } else {
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
      }
    } catch (err) {
      setPasswordError(`Error verifying password: ${err.message}`);
    } finally {
      setVerifyingPassword(false);
    }
  };

  // Handle manual decryption key submission
  const handleManualKeySubmit = async (e) => {
    e.preventDefault();
    if (!manualKey.trim()) return;
    await decryptFileBlob(file, manualKey.trim());
  };

  const getFullShareUrl = () => {
    const code = file?.shareCode || shareCode;
    const key = file?.encryptionKey || extractKeyFromUrlHash() || getFileKey(code);
    const base = `${window.location.origin}/?share=${code}`;
    return key ? `${base}#key=${key}` : base;
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(getFullShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Trigger file download
  const handleDownload = async () => {
    if (file?.isEncrypted) {
      let targetUrl = decryptedBlobUrl;
      if (!targetUrl) {
        targetUrl = await decryptFileBlob(file);
      }
      if (!targetUrl) return;

      const link = document.createElement('a');
      link.href = targetUrl;
      link.download = file?.originalName || 'download';
      document.body.appendChild(link);
      link.click();
      const code = file?.shareCode || shareCode;
      fetch(`/api/files/${code}/download-count`, { method: 'POST' }).catch(() => {});

      if (onDownloadSuccess) {
        onDownloadSuccess(file?.id);
      }
    } else {
      const code = file?.shareCode || shareCode;
      let url = `/api/files/${code}/download`;
      if (file?.isPasswordProtected && password) {
        url += `?password=${encodeURIComponent(password)}`;
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = file?.originalName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onDownloadSuccess) {
        onDownloadSuccess(file?.id);
      }
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
  const effectiveKey = resolveKey(file) || manualKey.trim() || null;
  const effectivePreviewUrl = file?.isEncrypted
    ? decryptedBlobUrl
    : `/api/files/${file?.shareCode}/download?preview=true${
        file?.isPasswordProtected && password ? `&password=${encodeURIComponent(password)}` : ''
      }`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass-panel modal-card file-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <div className="modal-icon-badge">{renderIcon(category, 22)}</div>
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
            {/* File Metadata Card */}
            <div className="file-meta-card">
              <div className="file-meta-header">
                <div className="file-meta-icon-large">{renderIcon(category, 36)}</div>
                <div className="file-meta-text">
                  <h4 className="file-modal-filename" title={file.originalName}>
                    {file.originalName}
                  </h4>
                  <div className="file-meta-tags">
                    <span className="meta-tag size-tag">{formatBytes(file.fileSize)}</span>
                    <span className="meta-tag type-tag">{file.mimeType}</span>

                    {file.isEncrypted && (
                      <span className="meta-tag encrypted-tag" title="Zero-Knowledge AES-256-GCM">
                        <ShieldCheck size={12} className="text-emerald" /> E2EE
                      </span>
                    )}

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
                  This file is encrypted and password-protected by the sender. Enter the password to unlock.
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
                  disabled={verifyingPassword || isDecrypting}
                >
                  {verifyingPassword || isDecrypting ? (
                    <>
                      <div className="spinner-small" /> Decrypting...
                    </>
                  ) : (
                    'Unlock & Decrypt'
                  )}
                </button>
              </form>
            ) : file.isEncrypted && !effectiveKey && !decryptedBlobUrl ? (
              /* Missing Decryption Key Gate (if opened via incomplete URL) */
              <form className="password-gate-form glass-subpanel" onSubmit={handleManualKeySubmit}>
                <div className="password-gate-header">
                  <Key size={20} className="text-blue" />
                  <h5>Decryption Key Required</h5>
                </div>
                <p className="password-gate-desc">
                  This file is end-to-end encrypted. The share link you followed was missing the{' '}
                  <code>#key=...</code> fragment. Paste the key to decrypt.
                </p>

                <div className="password-input-group">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Paste decryption key"
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    autoFocus
                  />
                </div>

                {decryptionError && <p className="error-text">{decryptionError}</p>}

                <button
                  type="submit"
                  className="btn btn-primary w-full mt-3"
                  disabled={isDecrypting || !manualKey.trim()}
                >
                  {isDecrypting ? 'Decrypting...' : 'Decrypt File'}
                </button>
              </form>
            ) : (
              /* Preview Area when unlocked */
              <div className="file-preview-section">
                {isDecrypting && !decryptedBlobUrl && (
                  <div className="decrypting-notice">
                    <div className="spinner-small" />
                    <span>Decrypting file locally in browser (AES-256-GCM)...</span>
                  </div>
                )}

                {decryptionError && (
                  <div className="error-banner">
                    <span>{decryptionError}</span>
                  </div>
                )}

                {effectivePreviewUrl && (
                  <>
                    {category === 'images' && (
                      <div className="image-preview-wrapper">
                        <img
                          src={effectivePreviewUrl}
                          alt={file.originalName}
                          className="image-preview-element"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {category === 'media' && file.mimeType?.startsWith('audio') && (
                      <div className="media-preview-wrapper">
                        <audio controls className="w-full" src={effectivePreviewUrl}>
                          Your browser does not support audio playback.
                        </audio>
                      </div>
                    )}

                    {category === 'media' && file.mimeType?.startsWith('video') && (
                      <div className="media-preview-wrapper">
                        <video controls className="video-preview-element" src={effectivePreviewUrl}>
                          Your browser does not support video playback.
                        </video>
                      </div>
                    )}

                    {category === 'documents' && file.mimeType?.includes('pdf') && (
                      <div className="pdf-preview-box">
                        <FileText size={32} className="cat-blue" />
                        <div>
                          <p className="pdf-preview-title">Decrypted PDF Document</p>
                          <a
                            href={effectivePreviewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            <ExternalLink size={14} /> Open in new tab
                          </a>
                        </div>
                      </div>
                    )}
                  </>
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
                <button
                  className="btn btn-primary btn-large w-full mt-4"
                  onClick={handleDownload}
                  disabled={isDecrypting}
                >
                  <Download size={20} />{' '}
                  {isDecrypting
                    ? 'Decrypting...'
                    : `Download ${file.isEncrypted ? 'Decrypted ' : ''}File (${formatBytes(
                        file.fileSize
                      )})`}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
