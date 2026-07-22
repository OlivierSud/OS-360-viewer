import React, { useEffect, useState } from 'react';
import { useProjectActions } from '../../hooks/useProjectActions';
import PasswordGate from '../Viewer/PasswordGate';
import homeBackground from '../../assets/home-background.png';

interface ProjectSelectionScreenProps {
  onClose: () => void;
}

const RECENT_LIMIT = 5;

const ProjectSelectionScreen: React.FC<ProjectSelectionScreenProps> = ({ onClose }) => {
  const {
    cloudProjects,
    isBusy,
    syncStatus,
    lockedProject,
    setLockedProject,
    refreshCloudList,
    createAndOpen,
    openCloudProject,
    unlockLockedProject,
  } = useProjectActions();

  const [search, setSearch] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    void refreshCloudList();

    const checkMobile = () => {
      const match = window.matchMedia('(max-width: 768px)').matches || 
                    /Mobi|Android|iPhone/i.test(navigator.userAgent);
      setIsMobile(match);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const matchStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(Boolean(matchStandalone));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [refreshCloudList]);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
        }
        setDeferredPrompt(null);
      });
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = query
    ? cloudProjects.filter((p) => p.title.toLowerCase().includes(query))
    : cloudProjects;
  // When not searching, show only the 5 most recent projects.
  const displayed = query ? filtered : cloudProjects.slice(0, RECENT_LIMIT);

  const handleOpen = async (id: string) => {
    const locked = await openCloudProject(id);
    if (!locked) onClose();
  };

  const handleNew = () => {
    createAndOpen();
    onClose();
  };

  const handleUnlock = () => {
    unlockLockedProject();
    onClose();
  };

  return (
    <div
      className="selection-screen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: '#111',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '24px',
      }}
    >
      <img
        src={homeBackground}
        alt=""
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'auto',
          height: 'auto',
          maxWidth: '90vw',
          maxHeight: '90vh',
          opacity: 0.1,
          zIndex: 0,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
      <div
        className="selection-screen__card"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          padding: '24px',
        }}
      >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>OS-360 Viewer</h1>
        <p style={{ color: '#aaa', margin: '6px 0 0', fontSize: '0.95rem' }}>
          Choisissez un projet à éditer
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#1e1e1e',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '10px 12px',
          }}
        >
          <span style={{ color: '#888', fontSize: '0.95rem' }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un projet…"
            autoFocus
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: '0.9rem',
              width: '100%',
              fontFamily: 'system-ui, sans-serif',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
              title="Effacer"
            >
              ×
            </button>
          )}
        </div>

        {isBusy && cloudProjects.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', fontSize: '0.9rem' }}>Chargement…</div>
        )}
        {!isBusy && cloudProjects.length === 0 && (
          <div
            style={{
              color: '#888',
              textAlign: 'center',
              padding: '24px',
              border: '1px dashed #444',
              borderRadius: '8px',
              fontSize: '0.9rem',
            }}
          >
            Aucun projet cloud pour le moment.
          </div>
        )}

        {!isBusy && cloudProjects.length > 0 && !query && (
          <div style={{ color: '#666', fontSize: '0.78rem', textAlign: 'center' }}>
            {cloudProjects.length > RECENT_LIMIT
              ? `5 projets les plus récents — utilisez la recherche pour voir les autres`
              : 'Projets récents'}
          </div>
        )}

        {displayed.map((project) => (
           <button
            key={project.id}
            onClick={() => void handleOpen(project.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '14px 16px',
              background: '#1e1e1e',
              border: '1px solid #333',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.95rem',
              textAlign: 'left',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#007acc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              {project.passwordHash ? (
                <span title="Projet protégé par mot de passe">🔒</span>
              ) : null}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.title}
              </span>
            </span>
            <span style={{ color: '#666', fontSize: '0.75rem', flexShrink: 0 }}>
              {new Date(project.updated_at).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </button>
        ))}

        {query && filtered.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', padding: '16px', fontSize: '0.9rem' }}>
            Aucun projet ne correspond à « {search} ».
          </div>
        )}
      </div>

      <button
        onClick={handleNew}
        style={{
          padding: '12px 22px',
          background: '#007acc',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: 600,
        }}
      >
        ＋ Nouveau projet
      </button>

      {isMobile && !isStandalone && (deferredPrompt || isIOS) && (
        <button
          onClick={handleInstallClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '999px',
            color: '#fff',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(8px)',
            transition: 'background 0.15s',
          }}
        >
          <span>📲</span> Installer l'application (PWA)
        </button>
      )}

      {syncStatus && (
        <div style={{ color: '#888', fontSize: '0.8rem' }}>{syncStatus}</div>
      )}

      {lockedProject && (
        <PasswordGate
          expectedHash={lockedProject.data.project.passwordHash ?? ''}
          title={lockedProject.data.project.title}
          description={lockedProject.data.project.description}
          splashImage={lockedProject.data.project.splashImage}
          onUnlocked={handleUnlock}
          onCancel={() => setLockedProject(null)}
        />
      )}
      </div>

      {showIOSGuide && (
        <div
          onClick={() => setShowIOSGuide(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1c1c1e',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '320px',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              color: 'white',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📲</div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', fontWeight: 700 }}>Installer sur iOS</h3>
            <p style={{ fontSize: '0.88rem', color: '#aaa', lineHeight: 1.45, margin: '0 0 20px 0' }}>
              Pour installer cette application sur votre iPhone ou iPad :
            </p>
            <ol style={{ textAlign: 'left', fontSize: '0.85rem', color: '#ddd', paddingLeft: '20px', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              <li>Appuyez sur le bouton <strong>Partager</strong> <span style={{fontSize:'1.1rem'}}>⎋</span> dans Safari.</li>
              <li>Faites défiler et sélectionnez <strong>Sur l'écran d'accueil</strong> ＋.</li>
              <li>Appuyez sur <strong>Ajouter</strong> en haut à droite.</li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              style={{
                width: '100%',
                padding: '10px 0',
                background: '#007acc',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectSelectionScreen;
