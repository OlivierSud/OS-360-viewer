import React, { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { createViewerUrl } from '../../services/cloudflareApi';

const section: React.CSSProperties = {
  marginBottom: '16px',
};

const h2: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#4fc3f7',
  margin: '0 0 6px 0',
};

const p: React.CSSProperties = {
  fontSize: '0.85rem',
  lineHeight: 1.5,
  color: '#cfcfcf',
  margin: '0 0 6px 0',
};

const li: React.CSSProperties = {
  fontSize: '0.85rem',
  lineHeight: 1.5,
  color: '#cfcfcf',
  marginBottom: '3px',
};

const HelpButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const projectTitle = useProjectStore((s) => s.project?.project?.title);

  const viewerUrl = currentProjectId ? createViewerUrl(currentProjectId) : null;

  return (
    <>
      <button
        title="Aide et documentation"
        onClick={() => setOpen(true)}
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          border: '1px solid #444',
          background: '#2d2d2d',
          color: '#bbb',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: 700,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s, color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#3a3a3a';
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#2d2d2d';
          e.currentTarget.style.color = '#bbb';
        }}
      >
        ?
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '40px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '560px',
              background: '#252526',
              border: '1px solid #3d3d3d',
              borderRadius: '12px',
              padding: '24px 26px',
              boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <button
              onClick={() => setOpen(false)}
              title="Fermer"
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '1px solid #444',
                background: '#2d2d2d',
                color: '#bbb',
                cursor: 'pointer',
                fontSize: '1rem',
                lineHeight: 1,
              }}
            >
              ✕
            </button>

            <h1 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: 'white' }}>
              OS-360 · Aide
            </h1>
            <p style={{ ...p, color: '#888', marginBottom: '20px' }}>
              Créez et publiez des visites virtuelles à 360° directement dans le navigateur.
            </p>

            <div style={section}>
              <h2 style={h2}>Plan de travail</h2>
              <p style={p}>
                Configurez le plan sous la carte : chargez une image de plan (vue du dessus)
                ou utilisez la carte géographique (GPS). Les points de vue y sont positionnés.
              </p>
            </div>

            <div style={section}>
              <h2 style={h2}>Ajouter des points de vue</h2>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                <li style={li}>📍 <strong>Add 360</strong> : cliquez sur le plan pour déposer une photo/vidéo 360.</li>
                <li style={li}>🔗 <strong>Add Portal</strong> : crée un lien vers un autre projet (visite connectée).</li>
                <li style={li}>✋ <strong>Move</strong> : déplacez un point existant.</li>
                <li style={li}>🔄 <strong>Rotate</strong> : orientez le nord du point de vue.</li>
                <li style={li}>🛤️ <strong>Path</strong> : reliez deux points pour naviguer de l'un à l'autre.</li>
                <li style={li}>🗑️ <strong>Delete</strong> : supprimez un point.</li>
              </ul>
            </div>

            <div style={section}>
              <h2 style={h2}>Visionneuse (Viewer)</h2>
              <p style={p}>
                Cliquez sur un lien (<strong>Path</strong>) ou un portail (<strong>Portal</strong>)
                dans la visite pour vous déplacer. En haut à droite, la mini-carte circulaire
                permet de recentrer et zoomer. Le plein écran et le gyroscope sont disponibles
                sur mobile.
              </p>
            </div>

            <div style={section}>
              <h2 style={h2}>Sauvegarde & partage</h2>
              <p style={p}>
                💾 <strong>Save</strong> envoie le projet sur Cloudflare. 🔗 copie le lien
                public de la visionneuse, à partager ou intégrer en iframe sur un site.
              </p>
              {viewerUrl ? (
                <div style={{
                  marginTop: '8px',
                  padding: '10px 12px',
                  background: '#1e1e1e',
                  border: '1px solid #3d3d3d',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: '4px' }}>
                    Lien de la visionneuse — {projectTitle || 'projet ouvert'} :
                  </div>
                  <a
                    href={viewerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#4fc3f7',
                      fontSize: '0.82rem',
                      wordBreak: 'break-all',
                      textDecoration: 'none',
                    }}
                  >
                    {viewerUrl}
                  </a>
                </div>
              ) : (
                <p style={{ ...p, color: '#888', marginTop: '8px' }}>
                  Aucun projet enregistré : sauvegardez (💾 Save) pour générer un lien de partage.
                </p>
              )}
            </div>

            <div style={section}>
              <h2 style={h2}>Raccourcis</h2>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                <li style={li}>Flèches ◀ ▶ (mode Rotate) : orienter le point de vue de 5°.</li>
                <li style={li}>Double-clic / molette : zoom dans la visite 360.</li>
              </ul>
            </div>

            <div style={section}>
              <h2 style={h2}>Intégrer sur un site</h2>
              <p style={p}>
                Copiez ce code dans la page de votre site pour afficher la visite en iframe.
                Le lien se met à jour automatiquement avec le projet ouvert.
              </p>
              {viewerUrl ? (
                <>
                  <pre style={{
                    margin: '8px 0 0 0',
                    padding: '12px 14px',
                    background: '#1e1e1e',
                    border: '1px solid #3d3d3d',
                    borderRadius: '8px',
                    color: '#cfcfcf',
                    fontSize: '0.78rem',
                    lineHeight: 1.5,
                    overflowX: 'auto',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>{`<iframe
  src="${viewerUrl}"
  style="width:100%; height:600px; border:0;"
  allow="fullscreen; gyroscope; accelerometer"
  title="Visite 360">
</iframe>`}</pre>
                  <button
                    onClick={() => void navigator.clipboard.writeText(
                      `<iframe\n  src="${viewerUrl}"\n  style="width:100%; height:600px; border:0;"\n  allow="fullscreen; gyroscope; accelerometer"\n  title="Visite 360">\n</iframe>`
                    )}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      background: '#2d2d2d',
                      border: '1px solid #444',
                      borderRadius: '5px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    📋 Copier le code
                  </button>
                </>
              ) : (
                <p style={{ ...p, color: '#888', marginTop: '8px' }}>
                  Aucun projet enregistré : sauvegardez (💾 Save) pour générer le code d'intégration.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpButton;
