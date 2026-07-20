import React from 'react';
import QrCode from '../Common/QrCode';

interface PanoDesktopNoticeProps {
  url: string;
  onClose: () => void;
}

const PanoDesktopNotice: React.FC<PanoDesktopNoticeProps> = ({ url, onClose }) => {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000,
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#1c1c1e', color: 'white', borderRadius: 16,
        maxWidth: 420, width: '100%', padding: '26px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }}>
          📱 Création de panorama sur mobile
        </div>
        <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.5, color: '#d0d0d0', textAlign: 'center' }}>
          La capture 360° utilise l'appareil photo de votre téléphone et n'est disponible
          que sur mobile. Scannez le QR code ci-dessous avec votre téléphone pour ouvrir
          cette page et y créer votre panorama.
        </p>
        <div style={{ background: '#fff', padding: 12, borderRadius: 12 }}>
          <QrCode value={url} size={180} title="Ouvrir sur mobile" />
        </div>
        <div style={{ fontSize: '0.72rem', color: '#8a8a8e', wordBreak: 'break-all', textAlign: 'center' }}>
          {url}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 4, padding: '12px 22px', borderRadius: 10, border: 'none',
            background: '#6a3df2', color: 'white', fontSize: '0.95rem', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
};

export default PanoDesktopNotice;
