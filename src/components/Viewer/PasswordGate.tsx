import React, { useState } from 'react';
import { sha256 } from '../../utils/crypto';

interface PasswordGateProps {
  expectedHash: string;
  title?: string;
  description?: string;
  splashImage?: string;
  onUnlocked: () => void;
  onCancel?: () => void;
}

const PasswordGate: React.FC<PasswordGateProps> = ({
  expectedHash,
  title,
  description,
  splashImage,
  onUnlocked,
  onCancel,
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async () => {
    if (!value) {
      triggerError();
      return;
    }
    const hash = await sha256(value);
    if (hash === expectedHash) {
      onUnlocked();
    } else {
      triggerError();
    }
  };

  const triggerError = () => {
    setError(true);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {splashImage && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${splashImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(12px) brightness(0.35)',
            transform: 'scale(1.1)',
            zIndex: -1,
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px',
          textAlign: 'center',
          padding: '40px',
          background: 'rgba(20,20,22,0.75)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.12)',
          maxWidth: '90%',
          width: '420px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
          animation: shake ? 'password-shake 0.4s ease' : undefined,
        }}
      >
        <div style={{ fontSize: '2.2rem' }}>🔒</div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
          {title ?? 'Visite protégée'}
        </h1>
        {description && (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc', lineHeight: 1.4 }}>
            {description}
          </p>
        )}

        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
          placeholder="Mot de passe"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#1e1e1e',
            border: `1px solid ${error ? '#8a3333' : '#444'}`,
            color: 'white',
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '0.95rem',
            outline: 'none',
            fontFamily: 'system-ui, sans-serif',
          }}
        />

        {error && (
          <div style={{ fontSize: '0.85rem', color: '#ef9a9a' }}>
            ⚠️ Mot de passe incorrect.
          </div>
        )}

        <button
          onClick={() => void handleSubmit()}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'linear-gradient(180deg, rgba(0,136,255,0.95) 0%, rgba(0,85,204,0.95) 100%)',
            border: '1px solid rgba(0,122,204,0.6)',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 600,
          }}
        >
          Accéder à la visite
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              width: '100%',
              padding: '8px 14px',
              background: 'transparent',
              border: 'none',
              color: '#999',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
};

export default PasswordGate;
