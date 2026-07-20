import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  value: string;
  size?: number;
  title?: string;
}

const QrCode: React.FC<QrCodeProps> = ({ value, size = 120, title }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setDataUrl(''); });
    return () => { cancelled = true; };
  }, [value, size]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div
        style={{
          width: size,
          height: size,
          background: '#fff',
          borderRadius: '8px',
          padding: '6px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {dataUrl ? (
          <img src={dataUrl} alt={title ?? 'QR code'} width={size - 12} height={size - 12} />
        ) : (
          <div style={{ fontSize: '0.7rem', color: '#999' }}>…</div>
        )}
      </div>
      {title && <span style={{ fontSize: '0.72rem', color: '#aaa', textAlign: 'center' }}>{title}</span>}
    </div>
  );
};

export default QrCode;
