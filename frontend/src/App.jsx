import { useState, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  Layers,
  Share2,
} from 'lucide-react';
import UploadView from './components/UploadView';
import FileExplorer from './components/FileExplorer';
import FileModal from './components/FileModal';
import QRCodeModal from './components/QRCodeModal';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'explorer'
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // Modals state
  const [activeFileModal, setActiveFileModal] = useState(null); // { file, shareCode }
  const [qrModal, setQrModal] = useState(null); // { shareUrl, fileName }
  const [toast, setToast] = useState(null);

  const showToast = (text, type = 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch Files
  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const res = await fetch('/api/files');
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (res.ok && isJson) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  // Check URL parameters on mount (e.g. ?share=CODE or /share/CODE)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');
    if (shareParam) {
      setActiveFileModal({ shareCode: shareParam });
      return;
    }

    const path = window.location.pathname;
    if (path.startsWith('/share/')) {
      const code = path.replace('/share/', '').split('/')[0];
      if (code) {
        setActiveFileModal({ shareCode: code });
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Handle File Deletion
  const handleDeleteFile = async (id) => {
    try {
      const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('File deleted successfully', 'success');
        fetchFiles();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete file', 'error');
      }
    } catch (err) {
      showToast(`Error deleting file: ${err.message}`, 'error');
    }
  };

  const handleUploadSuccess = () => {
    showToast('File uploaded! Share link is ready.', 'success');
    fetchFiles();
  };

  const handleDownloadSuccess = () => {
    fetchFiles();
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <span>{toast.text}</span>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <QRCodeModal
          shareUrl={qrModal.shareUrl}
          fileName={qrModal.fileName}
          onClose={() => setQrModal(null)}
        />
      )}

      {/* File Preview & Download Modal */}
      {activeFileModal && (
        <FileModal
          fileData={activeFileModal.file}
          shareCode={activeFileModal.shareCode}
          onClose={() => setActiveFileModal(null)}
          onShowQr={(shareUrl, fileName) => setQrModal({ shareUrl, fileName })}
          onDownloadSuccess={handleDownloadSuccess}
        />
      )}

      {/* Simplistic Top Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-wrapper">
            <div className="brand-icon-box">
              <Share2 size={22} className="brand-icon" />
            </div>
            <div>
              <h1 className="brand-title">
                Cloud<span className="brand-orange">Drop</span>
              </h1>
              <p className="brand-subtitle">Simple, secure & fast file sharing</p>
            </div>
          </div>

          {/* Clean Navigation */}
          <nav className="nav-tabs">
            <button
              className={`nav-tab-btn ${activeTab === 'upload' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <UploadCloud size={17} />
              <span>Upload</span>
            </button>

            <button
              className={`nav-tab-btn ${activeTab === 'explorer' ? 'nav-tab-active' : ''}`}
              onClick={() => {
                setActiveTab('explorer');
                fetchFiles();
              }}
            >
              <Layers size={17} />
              <span>My Files</span>
              {files.length > 0 && <span className="tab-badge">{files.length}</span>}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main-content">
        {activeTab === 'upload' && (
          <UploadView
            onUploadSuccess={handleUploadSuccess}
            onShowQr={(shareUrl, fileName) => setQrModal({ shareUrl, fileName })}
            onOpenFile={(file) => setActiveFileModal({ file })}
          />
        )}

        {activeTab === 'explorer' && (
          <FileExplorer
            files={files}
            loading={filesLoading}
            onRefresh={fetchFiles}
            onOpenFile={(file) => setActiveFileModal({ file })}
            onShowQr={(shareUrl, fileName) => setQrModal({ shareUrl, fileName })}
            onDeleteFile={handleDeleteFile}
            onNavigateToUpload={() => setActiveTab('upload')}
          />
        )}
      </main>

      {/* Simplistic Footer */}
      <footer className="app-footer">
        <p>CloudDrop • Secure End-to-End File Sharing</p>
      </footer>
    </div>
  );
}
