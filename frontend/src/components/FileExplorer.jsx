import { useState, useMemo } from 'react';
import {
  Search,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  FileCode,
  File as FileIcon,
  Trash2,
  Copy,
  Check,
  Lock,
  Clock,
  Eye,
  QrCode as QrIcon,
  Layers,
  ArrowUpDown,
  UploadCloud,
  RefreshCw,
} from 'lucide-react';
import { formatBytes, formatTimeLeft, formatDate, getFileCategory } from '../utils/formatters';

export default function FileExplorer({
  files,
  loading,
  onRefresh,
  onOpenFile,
  onShowQr,
  onDeleteFile,
  onNavigateToUpload,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'documents', label: 'Documents' },
    { id: 'images', label: 'Images' },
    { id: 'media', label: 'Media' },
    { id: 'code', label: 'Code' },
    { id: 'archives', label: 'Archives' },
  ];

  // Client-side filtering & sorting
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.originalName?.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) ||
          f.shareCode?.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(
        (f) => getFileCategory(f.mimeType, f.originalName) === selectedCategory
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'size_desc':
          return b.fileSize - a.fileSize;
        case 'size_asc':
          return a.fileSize - b.fileSize;
        case 'downloads':
          return b.downloadCount - a.downloadCount;
        default:
          return 0;
      }
    });

    return result;
  }, [files, searchTerm, selectedCategory, sortBy]);

  const handleCopyLink = (file) => {
    const url = `${window.location.origin}/?share=${file.shareCode}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.originalName}"?`)) {
      return;
    }
    setDeletingId(file.id);
    try {
      await onDeleteFile(file.id);
    } finally {
      setDeletingId(null);
    }
  };

  const renderIcon = (cat, size = 22) => {
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

  return (
    <div className="file-explorer-container">
      {/* Controls Bar */}
      <div className="glass-panel explorer-controls-bar">
        {/* Search */}
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>

        {/* Sort & Refresh */}
        <div className="controls-right-group">
          <div className="sort-dropdown-wrapper">
            <ArrowUpDown size={14} className="sort-icon" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="size_desc">Largest</option>
              <option value="downloads">Most Downloaded</option>
            </select>
          </div>

          <button
            className="icon-btn"
            onClick={onRefresh}
            title="Refresh files"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="category-pills-row">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`cat-pill-btn ${selectedCategory === cat.id ? 'cat-pill-active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Files Grid */}
      {loading && files.length === 0 ? (
        <div className="explorer-loading-state">
          <div className="spinner" />
          <p>Loading files...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="glass-panel empty-explorer-state">
          <div className="empty-icon-circle">
            <Layers size={36} className="text-dim" />
          </div>
          <h4>No files found</h4>
          <p>
            {searchTerm || selectedCategory !== 'all'
              ? 'Try adjusting your search criteria.'
              : 'You haven\'t uploaded any files yet.'}
          </p>
          {onNavigateToUpload && (
            <button className="btn btn-primary mt-3" onClick={onNavigateToUpload}>
              <UploadCloud size={16} /> Upload Now
            </button>
          )}
        </div>
      ) : (
        <div className="files-cards-grid">
          {filteredFiles.map((file) => {
            const cat = getFileCategory(file.mimeType, file.originalName);
            const shareUrl = `${window.location.origin}/?share=${file.shareCode}`;
            const isDeleting = deletingId === file.id;

            return (
              <div
                key={file.id}
                className={`glass-panel file-card ${file.status === 'expired' ? 'card-expired' : ''}`}
              >
                {/* Header */}
                <div className="file-card-header">
                  <div className="file-card-avatar">{renderIcon(cat, 22)}</div>

                  <div className="file-card-badges">
                    {file.isPasswordProtected && (
                      <span className="badge badge-locked" title="Password protected">
                        <Lock size={10} /> Protected
                      </span>
                    )}

                    {file.isExpired ? (
                      <span className="badge badge-expired">Expired</span>
                    ) : (
                      <span className="badge badge-expiry" title="Time remaining">
                        <Clock size={10} /> {formatTimeLeft(file.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="file-card-body" onClick={() => onOpenFile(file)}>
                  <h4 className="file-card-title" title={file.originalName}>
                    {file.originalName}
                  </h4>
                  <div className="file-card-meta">
                    <span>{formatBytes(file.fileSize)}</span>
                    <span className="meta-bullet">•</span>
                    <span>{file.downloadCount} dl</span>
                    <span className="meta-bullet">•</span>
                    <span>{formatDate(file.createdAt)}</span>
                  </div>

                  {file.description && (
                    <p className="file-card-note" title={file.description}>
                      "{file.description}"
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="file-card-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleCopyLink(file)}
                    title="Copy share link"
                  >
                    {copiedId === file.id ? (
                      <Check size={14} className="text-emerald" />
                    ) : (
                      <Copy size={14} />
                    )}
                    <span>{copiedId === file.id ? 'Copied' : 'Link'}</span>
                  </button>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onShowQr(shareUrl, file.originalName)}
                    title="QR Code"
                  >
                    <QrIcon size={14} />
                    <span>QR</span>
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenFile(file)}
                    title="View & Download"
                  >
                    <Eye size={14} />
                    <span>Open</span>
                  </button>

                  <button
                    className="icon-btn btn-sm btn-danger-icon"
                    onClick={() => handleDelete(file)}
                    disabled={isDeleting}
                    title="Delete file"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
