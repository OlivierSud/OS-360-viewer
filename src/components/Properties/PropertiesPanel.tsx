import React, { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { deleteCloudProject, listCloudProjects } from '../../services/cloudflareApi';
import { getViewerUrlForCurrentProject } from '../../services/projectCloudSave';
import { createTrackedObjectUrl } from '../../services/mediaRegistry';
import { createProjectId, deleteProject } from '../../storage/projectRegistry';
import type { Project } from '../../models/Project';
import { sha256 } from '../../utils/crypto';
import { DEFAULT_ACCENT_COLOR } from '../../utils/theme';

/* ── Small reusable field row ── */
const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  background: '#1e1e1e',
  border: '1px solid #444',
  color: 'white',
  padding: '6px 8px',
  borderRadius: '4px',
  fontSize: '0.85rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
};

const mapActionBtnStyle: React.CSSProperties = {
  padding: '7px 12px',
  backgroundColor: '#252526',
  border: '1px solid #444',
  borderRadius: '5px',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '0.82rem',
  transition: 'background 0.15s',
};

/* ── Reusable audio track picker ── */
const AudioField: React.FC<{
  label: string;
  value: string | undefined;
  onChange: (url: string | undefined) => void;
  hint?: string;
}> = ({ label, value, onChange, hint }) => {

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onChange(createTrackedObjectUrl(file));
    e.target.value = '';
  };

  return (
    <Field label={label}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type="text"
          value={value ?? ''}
          placeholder="Lien audio ou fichier local…"
          onChange={(e) => onChange(e.target.value.trim() || undefined)}
          style={inputStyle}
        />
        <label
          style={{
            padding: '8px',
            border: '1px dashed #555',
            borderRadius: '5px',
            color: '#aaa',
            cursor: 'pointer',
            textAlign: 'center',
            fontSize: '0.82rem',
          }}
        >
          📁 Choisir un fichier audio
          <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFile} />
        </label>
        {value && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <audio src={value} controls style={{ flex: 1, height: '32px' }} />
            <button
              onClick={() => onChange(undefined)}
              title="Retirer l'audio"
              style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
            >
              🗑️
            </button>
          </div>
        )}
        {hint && <span style={{ fontSize: '0.72rem', color: '#555', fontStyle: 'italic' }}>{hint}</span>}
      </div>
    </Field>
  );
};

/* ══════════════════════════════════════════════════════════
   Project Settings Panel
 ══════════════════════════════════════════════════════════ */
const ProjectSettingsPanel: React.FC<{ mobileOpen?: boolean; onMobileClose?: () => void }> = ({ mobileOpen, onMobileClose }) => {
  const project = useProjectStore((s) => s.project);
  const updateProjectTitle = useProjectStore((s) => s.updateProjectTitle);
  const setProject = useProjectStore((s) => s.setProject);
  const setMapConfig = useProjectStore((s) => s.setMapConfig);
  const setShowProjectSettings = useProjectStore((s) => s.setShowProjectSettings);
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);
  const selectScene = useProjectStore((s) => s.selectScene);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const scenes = useProjectStore((s) => s.scenes);

  const updateProjectPassword = useProjectStore((s) => s.updateProjectPassword);
  const setProjectMeta = useProjectStore((s) => s.setProjectMeta);

  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapFileRef = useRef<HTMLInputElement>(null);

  // Password protection state
  const [pwInput, setPwInput] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwShowFields, setPwShowFields] = useState(false);

  const handleMapFileClick = () => mapFileRef.current?.click();

  const handleMapFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = createTrackedObjectUrl(file);
    const img = new Image();
    img.onload = () => {
      setMapConfig({ type: 'custom', image: url, width: img.width, height: img.height });
    };
    img.src = url;
    e.target.value = '';
  };

  if (!project) return null;
  const meta = project.project;
  const mapConfig = project.map;

  const updateMeta = (updates: Partial<typeof meta>) => {
    setProject({ ...project, project: { ...meta, ...updates } });
  };

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Ensure the project (with all media uploaded to R2) is saved before sharing,
  // so the link always points to valid cloud data.
  const ensureViewerUrl = async (): Promise<string | null> => {
    setIsSyncing(true);
    try {
      const url = await getViewerUrlForCurrentProject();
      setViewerUrl(url);
      return url;
    } catch {
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  const resolveUrl = async (): Promise<string | null> => {
    if (viewerUrl) return viewerUrl;
    // Always save (uploading any local blob assets to R2) so the link points
    // to valid cloud data, even for a project already opened from the cloud.
    return ensureViewerUrl();
  };

  const handleCopy = async () => {
    const url = await resolveUrl();
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  };

  /* Splash image: file → object URL (will be replaced by a real upload in a later sprint) */
  const handleSplashFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = createTrackedObjectUrl(file);
    updateMeta({ splashImage: url });
  };

  const resetToBlankProject = () => {
    const id = createProjectId();
    const blankProject: Project = {
      version: 1,
      project: { title: 'Nouveau Projet', createdAt: new Date().toISOString() },
      scenes: [],
    };

    setProject(blankProject);
    setCurrentProjectId(id);
    selectScene(null);
    setShowProjectSettings(false);
  };

  const handleDeleteProject = async () => {
    if (!currentProjectId) {
      resetToBlankProject();
      return;
    }

    setIsDeleting(true);
    try {
      // Remove the project's media (R2 assets + DB entry) from Cloudflare, and
      // the local registry entry so no trace remains.
      await deleteCloudProject(currentProjectId);
      deleteProject(currentProjectId);
      window.dispatchEvent(new Event('cloud-projects-changed'));
      resetToBlankProject();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <aside
      className={`properties-panel${mobileOpen ? ' mobile-open' : ''}`}
      style={{ padding: '15px', color: 'white', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', minHeight: 0 }}
    >
      {onMobileClose && (
        <button
          className="sheet-collapse-btn"
          onClick={onMobileClose}
          title="Fermer"
          aria-label="Fermer"
        >
          <svg width="22" height="14" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 3 12 11 20 3" />
          </svg>
        </button>
      )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>⚙️ Paramètres du projet</h2>
        <button
          onClick={() => {
            setShowProjectSettings(false);
            onMobileClose?.();
          }}
          style={{ display: 'none', background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1rem', padding: '2px 5px' }}
          title="Fermer"
        >✕</button>
      </div>

      {/* ── General ── */}
      <Field label="Titre du projet">
        <input
          type="text"
          value={meta.title}
          onChange={(e) => updateProjectTitle(e.target.value)}
          style={inputStyle}
          placeholder="Nom du projet"
        />
      </Field>

      <Field label="Auteur">
        <input
          type="text"
          value={meta.author ?? ''}
          onChange={(e) => updateMeta({ author: e.target.value })}
          style={inputStyle}
          placeholder="Nom de l'auteur"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={meta.description ?? ''}
          onChange={(e) => updateMeta({ description: e.target.value })}
          rows={3}
          placeholder="Description courte du projet…"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      <Field label="Scène par défaut">
        <select
          value={meta.defaultScene ?? ''}
          onChange={(e) => updateMeta({ defaultScene: e.target.value || undefined })}
          style={inputStyle}
        >
          <option value="">— Aucune —</option>
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </Field>

      {/* ── Couleur d'accent du viewer ── */}
      <Field label="Couleur des boutons (viewer)">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="color"
            value={meta.accentColor ?? DEFAULT_ACCENT_COLOR}
            onChange={(e) => updateMeta({ accentColor: e.target.value })}
            style={{ width: '40px', height: '32px', padding: 0, border: '1px solid #444', borderRadius: '4px', background: 'none', cursor: 'pointer' }}
            title="Choisir la couleur d'accent du viewer"
          />
          <input
            type="text"
            value={meta.accentColor ?? ''}
            placeholder={DEFAULT_ACCENT_COLOR}
            onChange={(e) => updateMeta({ accentColor: e.target.value.trim() || undefined })}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => updateMeta({ accentColor: undefined })}
            title="Réinitialiser (bleu par défaut)"
            style={{ background: '#252526', border: '1px solid #444', color: '#aaa', borderRadius: '4px', cursor: 'pointer', padding: '6px 8px', fontSize: '0.8rem' }}
          >
            Défaut
          </button>
        </div>
      </Field>

      <AudioField
        label="Audio du projet"
        value={meta.audio}
        onChange={(url) => updateMeta({ audio: url })}
        hint="Joué pour tout le projet, sauf si un viewpoint possède sa propre piste."
      />

      {/* ── Splash image ── */}
      <div style={{ borderTop: '1px solid #333', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          🖼️ Image de démarrage <span style={{ color: '#555', fontStyle: 'italic', textTransform: 'none' }}>(optionnelle)</span>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#555' }}>
          Cette image s'affiche pendant le chargement de la visioneuse.
        </div>

        {/* Preview */}
        {meta.splashImage ? (
          <div style={{ position: 'relative' }}>
            <img
              src={meta.splashImage}
              alt="splash preview"
              style={{
                width: '100%',
                maxHeight: '130px',
                objectFit: 'cover',
                borderRadius: '6px',
                border: '1px solid #444',
                display: 'block',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
            />
            <button
              onClick={() => updateMeta({ splashImage: undefined })}
              title="Supprimer l'image"
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                background: 'rgba(0,0,0,0.7)',
                border: '1px solid #555',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                padding: '2px 6px',
              }}
            >✕ Retirer</button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #444',
              borderRadius: '6px',
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
              color: '#555',
              fontSize: '0.82rem',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#666')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#444')}
          >
            📁 Cliquez pour choisir une image
            <div style={{ fontSize: '0.72rem', marginTop: '4px', color: '#444' }}>JPG, PNG, WebP recommandés</div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleSplashFile}
        />

        <Field label="ou URL directe">
          <input
            type="text"
            value={meta.splashImage ?? ''}
            onChange={(e) => updateMeta({ splashImage: e.target.value || undefined })}
            placeholder="https://exemple.com/splash.jpg"
            style={inputStyle}
          />
        </Field>

        <Field label="Temps d'affichage minimum (en secondes)">
          <input
            type="number"
            min="0"
            step="0.5"
            value={meta.splashDuration ?? 0}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateMeta({ splashDuration: isNaN(val) ? 0 : val });
            }}
            placeholder="0"
            style={inputStyle}
          />
        </Field>
      </div>

      {/* ── Plan de travail (map) ── */}
      <div style={{ borderTop: '1px solid #333', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          🗺️ Plan de travail
        </div>

        {mapConfig?.type === 'custom' && mapConfig.image ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <img
              src={mapConfig.image}
              alt="Plan du projet"
              style={{
                width: '100%',
                maxHeight: '130px',
                objectFit: 'contain',
                borderRadius: '6px',
                border: '1px solid #444',
                background: '#111',
              }}
            />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={handleMapFileClick}
                style={mapActionBtnStyle}
              >
                📁 Changer le plan
              </button>
              <button
                onClick={() => setMapConfig({ type: 'geographic' })}
                style={mapActionBtnStyle}
              >
                🌍 Carte GPS
              </button>
            </div>
          </div>
        ) : mapConfig?.type === 'geographic' ? (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>Carte géographique (GPS) active</span>
            <button
              onClick={handleMapFileClick}
              style={mapActionBtnStyle}
            >
              📁 Utiliser une image
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={handleMapFileClick}
              style={mapActionBtnStyle}
            >
              📁 Charger un plan (Image)
            </button>
            <button
              onClick={() => setMapConfig({ type: 'geographic' })}
              style={mapActionBtnStyle}
            >
              🌍 Carte Géographique (GPS)
            </button>
          </div>
        )}

        <input
          ref={mapFileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleMapFileChange}
        />
      </div>

      {/* ── Viewer link ── */}
      <div style={{ borderTop: '1px solid #333', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          🔗 Lien Visioneuse
        </div>

        {viewerUrl ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <a
              href={viewerUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Ouvrir la visioneuse"
              style={{
                ...inputStyle,
                color: '#888',
                fontSize: '0.78rem',
                cursor: 'pointer',
                flex: 1,
                minWidth: 0,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {viewerUrl}
            </a>
            <button
              onClick={handleCopy}
              title="Copier le lien"
              style={{
                padding: '5px 10px',
                background: copied ? '#2e7d32' : '#2d2d2d',
                border: '1px solid #444',
                borderRadius: '4px',
                color: copied ? '#a5d6a7' : 'white',
                cursor: 'pointer',
                fontSize: '0.8rem',
                whiteSpace: 'nowrap',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              {copied ? '✓ Copié' : '📋 Copier'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCopy}
            disabled={isSyncing}
            title="Enregistrer le projet et générer le lien"
            style={{
              padding: '8px 10px',
              background: '#252526',
              border: '1px solid #444',
              borderRadius: '5px',
              color: isSyncing ? '#666' : '#4caf50',
              cursor: isSyncing ? 'default' : 'pointer',
              fontSize: '0.82rem',
              textAlign: 'left',
            }}
          >
            {isSyncing ? '⏳ Enregistrement…' : '🔗 Générer le lien de partage'}
          </button>
        )}

        <div style={{ fontSize: '0.75rem', color: '#444', lineHeight: 1.5 }}>
          Ce lien sera actif une fois la visioneuse déployée. Partagez-le avec vos clients pour qu'ils accèdent directement au tour virtuel.
        </div>
      </div>

      {/* ── Password protection ── */}
      <div style={{ borderTop: '1px solid #333', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          🔒 Protection par mot de passe
        </div>

        {meta.passwordHash ? (
          // — Protected state —
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'rgba(76,175,80,0.1)',
              border: '1px solid rgba(76,175,80,0.35)',
              borderRadius: '6px',
            }}>
              <span style={{ fontSize: '1rem' }}>🔒</span>
              <span style={{ fontSize: '0.85rem', color: '#81c784' }}>Ce projet est protégé par un mot de passe.</span>
            </div>

            {pwShowFields ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Field label="Nouveau mot de passe">
                  <input
                    type="password"
                    value={pwInput}
                    onChange={(e) => { setPwInput(e.target.value); setPwError(null); setPwSuccess(false); }}
                    placeholder="Laisser vide pour supprimer"
                    style={inputStyle}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirmer le mot de passe">
                  <input
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => { setPwConfirm(e.target.value); setPwError(null); }}
                    placeholder="Confirmer"
                    style={inputStyle}
                    autoComplete="new-password"
                  />
                </Field>
                {pwError && (
                  <div style={{ fontSize: '0.8rem', color: '#ef9a9a' }}>⚠️ {pwError}</div>
                )}
                {pwSuccess && (
                  <div style={{ fontSize: '0.8rem', color: '#81c784' }}>✓ Mot de passe mis à jour !</div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={async () => {
                      if (!pwInput) {
                        // Remove password
                        updateProjectPassword(undefined);
                        setPwInput('');
                        setPwConfirm('');
                        setPwShowFields(false);
                        return;
                      }
                      if (pwInput !== pwConfirm) {
                        setPwError('Les mots de passe ne correspondent pas.');
                        return;
                      }
                      const hash = await sha256(pwInput);
                      updateProjectPassword(hash);
                      setPwInput('');
                      setPwConfirm('');
                      setPwShowFields(false);
                      setPwSuccess(true);
                      setTimeout(() => setPwSuccess(false), 2500);
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      background: '#1b5e20',
                      border: '1px solid #388e3c',
                      color: '#c8e6c9',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    ✓ Enregistrer
                  </button>
                  <button
                    onClick={() => { setPwShowFields(false); setPwInput(''); setPwConfirm(''); setPwError(null); }}
                    style={{
                      padding: '7px 10px',
                      background: '#252526',
                      border: '1px solid #444',
                      color: '#aaa',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setPwShowFields(true)}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: '#252526',
                    border: '1px solid #444',
                    color: '#fff',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                >
                  🔑 Changer le mot de passe
                </button>
                <button
                  onClick={() => { updateProjectPassword(undefined); }}
                  style={{
                    padding: '7px 10px',
                    background: '#3a1f1f',
                    border: '1px solid #8a3333',
                    color: '#ffcdd2',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                >
                  🔓 Désactiver
                </button>
              </div>
            )}
          </div>
        ) : (
          // — Unprotected state —
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.78rem', color: '#555' }}>
              Ajoutez un mot de passe pour restreindre l'accès à la visionneuse.
            </div>
            {pwShowFields ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Field label="Mot de passe">
                  <input
                    type="password"
                    value={pwInput}
                    onChange={(e) => { setPwInput(e.target.value); setPwError(null); }}
                    placeholder="Choisir un mot de passe"
                    style={inputStyle}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirmer le mot de passe">
                  <input
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => { setPwConfirm(e.target.value); setPwError(null); }}
                    placeholder="Confirmer"
                    style={inputStyle}
                    autoComplete="new-password"
                  />
                </Field>
                {pwError && (
                  <div style={{ fontSize: '0.8rem', color: '#ef9a9a' }}>⚠️ {pwError}</div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={async () => {
                      if (!pwInput) {
                        setPwError('Veuillez saisir un mot de passe.');
                        return;
                      }
                      if (pwInput !== pwConfirm) {
                        setPwError('Les mots de passe ne correspondent pas.');
                        return;
                      }
                      const hash = await sha256(pwInput);
                      updateProjectPassword(hash);
                      setPwInput('');
                      setPwConfirm('');
                      setPwShowFields(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      background: '#1b5e20',
                      border: '1px solid #388e3c',
                      color: '#c8e6c9',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    🔒 Activer la protection
                  </button>
                  <button
                    onClick={() => { setPwShowFields(false); setPwInput(''); setPwConfirm(''); setPwError(null); }}
                    style={{
                      padding: '7px 10px',
                      background: '#252526',
                      border: '1px solid #444',
                      color: '#aaa',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPwShowFields(true)}
                style={{
                  padding: '8px 10px',
                  background: '#252526',
                  border: '1px solid #444',
                  borderRadius: '5px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  textAlign: 'left',
                }}
              >
                🔒 Ajouter un mot de passe
              </button>
            )}
          </div>
        )}

        {/* VR mode (mobile) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', fontSize: '0.85rem', color: '#e0e0e0' }}>
            <input
              type="checkbox"
              checked={Boolean(project?.project?.enableVR)}
              onChange={(e) => setProjectMeta({ enableVR: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: '#007acc', cursor: 'pointer' }}
            />
            Activer le mode VR (mobile)
          </label>
          <div style={{ fontSize: '0.75rem', color: '#666', lineHeight: 1.4 }}>
            Affiche un bouton VR plein écran sur mobile (gyroscope + vue stéréoscopique pour casque cardboard).
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #333', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Zone dangereuse
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{
            padding: '8px 10px',
            background: '#3a1f1f',
            border: '1px solid #8a3333',
            color: '#ffcdd2',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            textAlign: 'left',
          }}
        >
          🗑️ Supprimer le projet
        </button>
        <div style={{ fontSize: '0.75rem', color: '#555', lineHeight: 1.4 }}>
          Supprime le projet de Cloudflare. Cette action ne peut pas être annulée.
        </div>
      </div>

      {/* ── Read-only info ── */}
      <div style={{ borderTop: '1px solid #333', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ fontSize: '0.72rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Informations</div>
        {meta.createdAt && (
          <div style={{ fontSize: '0.78rem', color: '#666' }}>
            Créé le : {new Date(meta.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        )}
        {meta.updatedAt && (
          <div style={{ fontSize: '0.78rem', color: '#666' }}>
            Modifié le : {new Date(meta.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        <div style={{ fontSize: '0.78rem', color: '#666' }}>Scènes : {scenes.length}</div>
        {currentProjectId && (
          <div style={{ fontSize: '0.72rem', color: '#444', fontFamily: 'monospace', marginTop: '2px' }}>
            ID : {currentProjectId}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '360px',
              background: '#1e1e1e',
              border: '1px solid #8a3333',
              borderRadius: '8px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffcdd2' }}>
              Supprimer ce projet ?
            </div>
            <div style={{ fontSize: '0.86rem', color: '#aaa', lineHeight: 1.5 }}>
              Le projet « {meta.title} » sera supprimé de Cloudflare. La visionneuse associée ne pourra plus le charger.
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                style={{
                  padding: '7px 12px',
                  background: '#2d2d2d',
                  border: '1px solid #444',
                  color: 'white',
                  borderRadius: '5px',
                  cursor: isDeleting ? 'default' : 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => void handleDeleteProject()}
                disabled={isDeleting}
                style={{
                  padding: '7px 12px',
                  background: '#8a3333',
                  border: '1px solid #b94a4a',
                  color: 'white',
                  borderRadius: '5px',
                  cursor: isDeleting ? 'default' : 'pointer',
                }}
              >
                {isDeleting ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};


/* ══════════════════════════════════════════════════════════
   Hotspot Properties Panel (existing content)
══════════════════════════════════════════════════════════ */
const HotspotPropertiesPanel: React.FC<{ mobileOpen?: boolean; onMobileClose?: () => void }> = ({ mobileOpen, onMobileClose }) => {
  const scenes = useProjectStore((state) => state.scenes);
  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);
  const selectedHotspotId = useProjectStore((state) => state.selectedHotspotId);

  const selectHotspot = useProjectStore((state) => state.selectHotspot);
  const updateHotspot = useProjectStore((state) => state.updateHotspot);
  const removeHotspot = useProjectStore((state) => state.removeHotspot);
  const updateScene = useProjectStore((state) => state.updateScene);

  const selectedScene = scenes.find(s => s.id === selectedSceneId);
  const selectedHotspot = selectedScene?.hotspots?.find(h => h.id === selectedHotspotId);

  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  useEffect(() => {
    listCloudProjects().then(setAvailableProjects).catch(console.error);
  }, []);

  const handleHotspotFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedScene || !selectedHotspot) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const url = createTrackedObjectUrl(file);
    updateHotspot(selectedScene.id, selectedHotspot.id, { content: url });
    e.target.value = '';
  };

  return (
    <aside
      className={`properties-panel${mobileOpen ? ' mobile-open' : ''}`}
      style={{ padding: '15px', color: 'white', display: 'flex', flexDirection: 'column', gap: '20px', userSelect: 'none', overflowY: 'auto' }}
    >
      {onMobileClose && (
        <button
          className="sheet-collapse-btn"
          onClick={onMobileClose}
          title="Fermer"
          aria-label="Fermer"
        >
          <svg width="22" height="14" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 3 12 11 20 3" />
          </svg>
        </button>
      )}
      <h2 style={{ margin: 0, fontSize: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Properties</h2>

      {selectedScene ? (
        selectedScene.type === 'project-link' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>Project Link</h4>
              <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '2px' }}>ID: {selectedScene.id}</div>
            </div>

            <Field label="Titre du lien">
              <input
                type="text"
                value={selectedScene.title}
                onChange={(e) => updateScene(selectedScene.id, { title: e.target.value })}
                style={inputStyle}
              />
            </Field>

            <Field label="Projet à charger">
              <select
                value={selectedScene.targetProjectId ?? ''}
                onChange={(e) => updateScene(selectedScene.id, { targetProjectId: e.target.value })}
                style={inputStyle}
              >
                <option value="">— Sélectionner un projet —</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>Viewpoint</h4>
              <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{selectedScene.title}</div>
              <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '2px' }}>ID: {selectedScene.id}</div>
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>Hotspots</h4>

            {selectedScene.hotspots && selectedScene.hotspots.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '150px', overflowY: 'auto', marginBottom: '15px', paddingRight: '5px' }}>
                {selectedScene.hotspots.map(h => {
                  const isActive = h.id === selectedHotspotId;
                  const icon = h.type === 'video' ? '🎥' : h.type === 'image' ? '🖼️' : 'ℹ️';
                  return (
                    <div
                      key={h.id}
                      onClick={() => selectHotspot(h.id)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: isActive ? '#37373d' : '#252526',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span>{icon}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.content}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeHotspot(selectedScene.id, h.id); }}
                        style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '0.9rem', padding: '0 4px' }}
                        title="Supprimer le hotspot"
                      >🗑️</button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#555', fontStyle: 'italic', marginBottom: '15px' }}>
                Aucun hotspot dans cette vue. Utilisez "Add Hotspot" dans la vue 360°.
              </div>
            )}

            {selectedHotspot ? (
              <div style={{ backgroundColor: '#252526', border: '1px solid #333', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', borderBottom: '1px solid #333', paddingBottom: '6px', color: '#888' }}>
                  Edit Hotspot
                </div>

                <Field label="Type">
                  <select
                    value={selectedHotspot.type}
                    onChange={(e) => updateHotspot(selectedScene.id, selectedHotspot.id, { type: e.target.value as any })}
                    style={{ ...inputStyle }}
                  >
                    <option value="text">ℹ️ Texte</option>
                    <option value="video">🎥 Vidéo (YouTube)</option>
                    <option value="image">🖼️ Image (URL)</option>
                  </select>
                </Field>

                <Field label="Titre (optionnel)">
                  <input
                    type="text"
                    value={selectedHotspot.title ?? ''}
                    onChange={(e) => updateHotspot(selectedScene.id, selectedHotspot.id, { title: e.target.value })}
                    placeholder="Titre affiché dans la bulle"
                    style={inputStyle}
                  />
                </Field>

                <Field label={selectedHotspot.type === 'video' ? 'Vidéo' : selectedHotspot.type === 'image' ? "Image" : 'Contenu Texte'}>
                  {selectedHotspot.type === 'video' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        value={selectedHotspot.content}
                        onChange={(e) => updateHotspot(selectedScene.id, selectedHotspot.id, { content: e.target.value })}
                        placeholder="Lien web vidéo ou fichier local"
                        style={inputStyle}
                      />
                      <label
                        style={{
                          padding: '8px',
                          border: '1px dashed #555',
                          borderRadius: '5px',
                          color: '#aaa',
                          cursor: 'pointer',
                          textAlign: 'center',
                          fontSize: '0.82rem',
                        }}
                      >
                        📁 Choisir une vidéo locale
                        <input
                          type="file"
                          accept="video/*"
                          style={{ display: 'none' }}
                          onChange={handleHotspotFile}
                        />
                      </label>
                      {selectedHotspot.content && selectedHotspot.content.startsWith('blob:') && (
                        <video
                          src={selectedHotspot.content}
                          controls
                          style={{ width: '100%', maxHeight: '140px', borderRadius: '4px', border: '1px solid #333' }}
                        />
                      )}
                    </div>
                  ) : selectedHotspot.type === 'image' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input
                        type="text"
                        value={selectedHotspot.content}
                        onChange={(e) => updateHotspot(selectedScene.id, selectedHotspot.id, { content: e.target.value })}
                        placeholder="Lien web image ou fichier local"
                        style={inputStyle}
                      />
                      <label
                        style={{
                          padding: '8px',
                          border: '1px dashed #555',
                          borderRadius: '5px',
                          color: '#aaa',
                          cursor: 'pointer',
                          textAlign: 'center',
                          fontSize: '0.82rem',
                        }}
                      >
                        📁 Choisir une image locale
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleHotspotFile}
                        />
                      </label>
                      {selectedHotspot.content && (
                        <img
                          src={selectedHotspot.content}
                          alt="preview"
                          style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #333' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
                        />
                      )}
                    </div>
                  ) : (
                    <textarea
                      value={selectedHotspot.content}
                      onChange={(e) => updateHotspot(selectedScene.id, selectedHotspot.id, { content: e.target.value })}
                      rows={4}
                      placeholder="Saisissez votre texte…"
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  )}
                </Field>
              </div>
            ) : (
              selectedScene.hotspots && selectedScene.hotspots.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#555', fontStyle: 'italic', textAlign: 'center' }}>
                  Sélectionnez un hotspot ci-dessus pour l'éditer.
                </div>
              )
            )}

            <div style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
              <AudioField
                label="Audio du viewpoint"
                value={selectedScene.audio}
                onChange={(url) => updateScene(selectedScene.id, { audio: url })}
                hint="Remplace la piste audio du projet pour ce viewpoint uniquement."
              />
            </div>
          </div>
        </div>
        )
      ) : (
        <div style={{ fontSize: '0.9rem', color: '#555', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
          Sélectionnez un point de vue pour configurer ses propriétés.
        </div>
      )}
    </aside>
  );
};

/* ══════════════════════════════════════════════════════════
   Root: switches between the two panels
══════════════════════════════════════════════════════════ */
const PropertiesPanel: React.FC = () => {
  const showProjectSettings = useProjectStore((s) => s.showProjectSettings);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectedHotspotId = useProjectStore((s) => s.selectedHotspotId);
  const scenes = useProjectStore((s) => s.scenes);
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectedScene = scenes.find((s) => s.id === selectedSceneId) ?? null;


  // On mobile, only auto-open the sheet when a hotspot is explicitly selected
  // or when the project settings are opened.
  const prevHotspotIdRef = useRef<string | null>(null);
  const prevShowSettingsRef = useRef<boolean>(false);

  useEffect(() => {
    const hotspotOpened = selectedHotspotId && selectedHotspotId !== prevHotspotIdRef.current;
    const settingsOpened = showProjectSettings && !prevShowSettingsRef.current;

    if (hotspotOpened || settingsOpened) {
      setMobileOpen(true);
    }

    prevHotspotIdRef.current = selectedHotspotId;
    prevShowSettingsRef.current = showProjectSettings;
  }, [selectedHotspotId, showProjectSettings]);

  const hasContent = Boolean(selectedScene);

  return (
    <>
      <button
        className={`properties-fab${mobileOpen ? ' properties-fab--hidden' : ''}`}
        onClick={() => setMobileOpen((o) => !o)}
        style={{
          display: 'none',
          position: 'fixed',
          right: '12px',
          bottom: '12px',
          zIndex: 1500,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'linear-gradient(180deg, rgba(0,136,255,0.9), rgba(0,85,204,0.9))',
          color: 'white',
          cursor: 'pointer',
          fontSize: '1.5rem',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
        }}
        title="Ouvrir les propriétés"
        aria-label="Ouvrir les propriétés"
      >
        ☰
      </button>

      <div className={`properties-drawer-host${hasContent ? ' has-content' : ''}`}>
        {showProjectSettings ? <ProjectSettingsPanel mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} /> : <HotspotPropertiesPanel mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />}
      </div>
    </>
  );
};

export default PropertiesPanel;
