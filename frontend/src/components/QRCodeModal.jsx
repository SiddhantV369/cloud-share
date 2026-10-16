import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Download, QrCode as QrIcon } from 'lucide-react';

export default function QRCodeModal({ shareUrl, fileName, onClose }) {
  const [qrSrc, setQrSrc] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shareUrl) return;
    QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrSrc(url))
      .catch((err) => console.error('Failed to generate QR Code:', err));
  }, [shareUrl]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrSrc) return;
    const a = document.createElement('a');
    a.href = qrSrc;
    a.download = `qr-code-${fileName || 'file'}.png`;
    a.click();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass-panel modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <div className="modal-icon-badge">
              <QrIcon size={20} className="text-orange" />
            </div>
            <div>
              <h3>Share via QR Code</h3>
              <p className="modal-subtitle">Scan with any mobile device to download</p>
            </div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="qr-container">
          {qrSrc ? (
            <div className="qr-image-wrapper">
              <img src={qrSrc} alt="QR Code for file" className="qr-image" />
            </div>
          ) : (
            <div className="qr-skeleton">Generating QR code...</div>
          )}
          <p className="qr-filename" title={fileName}>
            {fileName}
          </p>
        </div>

        <div className="qr-url-box">
          <span className="qr-url-text">{shareUrl}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
            {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="modal-footer">
          <button className="btn btn-orange w-full" onClick={handleDownloadQr}>
            <Download size={16} /> Save QR Image
          </button>
        </div>
      </div>
    </div>
  );
}
