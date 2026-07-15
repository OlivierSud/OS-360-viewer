import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createProjectId } from '../../storage/projectRegistry';
import {
  createViewerUrl,
  deleteCloudProject,
  saveCloudProject,
} from '../../services/cloudflareApi';
import { uploadProjectAssetsToR2 } from '../../services/projectAssetUpload';
import { useProjectStore } from '../../state/projectStore';
import { useProjectActions } from '../../hooks/useProjectActions';
import PasswordGate from '../Viewer/PasswordGate';

const ProjectViewerLink: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [copied, setCopied] = useState(false);
  const url = createViewerUrl(projectId);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={url}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '0.7rem',
          color: '#2196f3',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        {url.replace(/^https?:\/\//, '')}
      </a>
      <button
        onClick={handleCopy}
        title="Copier le lien de la visonneuse"
        style={{
          background: 'none',
          border: 'none',
          color: copied ? '#4caf50' : '#888',
          cursor: 'pointer',
          fontSize: '0.78rem',
          padding: '0 2px',
          flexShrink: 0,
        }}
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );
};

const ProjectDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const storeProject = useProjectStore((s) => s.project);
  const currentId = useProjectStore((s) => s.currentProjectId);
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);

  const {
    cloudProjects,
    isBusy,
    syncStatus,
    setSyncStatus,
    lockedProject,
    setLockedProject,
    refreshCloudList,
    createAndOpen,
    openCloudProject,
    unlockLockedProject,
  } = useProjectActions();

  // Populate the cloud list when the dropdown is first shown (no auto-open).
  useEffect(() => {
    if (open) void refreshCloudList();
  }, [open, refreshCloudList]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const refreshProjects = () => { void refreshCloudList(); };
    window.addEventListener('cloud-projects-changed', refreshProjects);
    return () => window.removeEventListener('cloud-projects-changed', refreshProjects);
  }, [refreshCloudList]);

  const handleCloudSave = useCallback(async (): Promise<string | null> => {
    if (!storeProject) return null;

    const id = currentId ?? createProjectId();
    const updatedProject = {
      ...storeProject,
      project: { ...storeProject.project, updatedAt: new Date().toISOString() },
    };

    if (!currentId) setCurrentProjectId(id);
    setSyncStatus('Upload des médias vers R2…');

    try {
      const projectWithUploadedAssets = await uploadProjectAssetsToR2(updatedProject, id);
      setSyncStatus('Enregistrement sur Cloudflare…');
      await saveCloudProject({ id, project: projectWithUploadedAssets });
      setSyncStatus('Projet enregistré sur Cloudflare');
      await refreshCloudList();
      return id;
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Sauvegarde Cloudflare impossible');
      return null;
    }
  }, [currentId, refreshCloudList, setCurrentProjectId, setSyncStatus, storeProject]);

  useEffect(() => {
    (window as any).__saveCurrentProject = handleCloudSave;
    (window as any).__exportCurrentProject = async () => {
      const savedId = await handleCloudSave();
      return savedId ? createViewerUrl(savedId) : null;
    };
  }, [handleCloudSave]);

  const filteredCloud = cloudProjects.filter((project) =>
    project.title.toLowerCase().includes(search.toLowerCase())
  );

  const currentTitle = storeProject?.project?.title ?? 'Projets';

  const btn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: open ? '#37373d' : '#2d2d2d',
    color: 'white',
    border: '1px solid #444',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: 'system-ui, sans-serif',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
    maxWidth: '180px',
  };

  const panel: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    width: '280px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #3d3d3d',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    zIndex: 9999,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button style={btn} onClick={() => setOpen((value) => !value)}>
        <span style={{ fontSize: '1rem' }}>☁️</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '130px',
            display: 'inline-block',
          }}
        >
          {currentTitle}
        </span>
        <span style={{ fontSize: '0.6rem', color: '#888', marginLeft: 'auto' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={panel}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #333', color: '#a5d6a7', fontSize: '0.8rem' }}>
            Projets Cloudflare
          </div>

          <div style={{ padding: '10px', borderBottom: '1px solid #333' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#252526',
                border: '1px solid #444',
                borderRadius: '5px',
                padding: '5px 8px',
              }}
            >
              <span style={{ color: '#666', fontSize: '0.85rem' }}>🔍</span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un projet…"
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: '0.85rem',
                  width: '100%',
                  fontFamily: 'system-ui, sans-serif',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    padding: 0,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {syncStatus && (
            <div style={{ padding: '8px 10px', color: '#aaa', fontSize: '0.76rem', borderBottom: '1px solid #333' }}>
              {syncStatus}
            </div>
          )}

          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {isBusy ? (
              <div style={{ padding: '14px', color: '#555', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center' }}>
                Synchronisation Cloudflare…
              </div>
            ) : filteredCloud.length === 0 ? (
              <div style={{ padding: '14px', color: '#555', fontStyle: 'italic', fontSize: '0.85rem', textAlign: 'center' }}>
                {search ? 'Aucun projet cloud trouvé' : 'Aucun projet cloud'}
              </div>
            ) : (
              filteredCloud.map((project) => {
                const isActive = project.id === currentId;
                return (
                  <div
                    key={project.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      backgroundColor: isActive ? '#37373d' : 'transparent',
                      borderLeft: isActive ? '3px solid #4caf50' : '3px solid transparent',
                      cursor: 'pointer',
                      gap: '8px',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div
                      style={{ flex: 1, overflow: 'hidden' }}
                      onClick={() => void openCloudProject(project.id).then((locked) => { if (!locked) setOpen(false); })}
                    >
                      <div
                        style={{
                          fontWeight: isActive ? 600 : 400,
                          fontSize: '0.88rem',
                          color: 'white',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {project.passwordHash ? <span title="Projet protégé par mot de passe">🔒</span> : null}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.title}</span>
                      </div>
                      <ProjectViewerLink projectId={project.id} />
                      <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '2px' }}>
                        {new Date(project.updated_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    {!isActive && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          if (confirm(`Supprimer "${project.title}" du cloud ?`)) {
                            void deleteCloudProject(project.id).then(refreshCloudList).catch((error) => {
                              setSyncStatus(error instanceof Error ? error.message : 'Suppression cloud impossible');
                            });
                          }
                        }}
                        title="Supprimer ce projet cloud"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#777',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          flexShrink: 0,
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div style={{ borderTop: '1px solid #333', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => { createAndOpen(); setOpen(false); }}
              style={{
                width: '100%',
                padding: '7px',
                backgroundColor: '#252526',
                color: '#4caf50',
                border: '1px dashed #444',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              ＋ Nouveau projet
            </button>
          </div>
        </div>
      )}

      {lockedProject && (
        <PasswordGate
          expectedHash={lockedProject.data.project.passwordHash ?? ''}
          title={lockedProject.data.project.title}
          description={lockedProject.data.project.description}
          splashImage={lockedProject.data.project.splashImage}
          onUnlocked={unlockLockedProject}
          onCancel={() => setLockedProject(null)}
        />
      )}
    </div>
  );
};

export default ProjectDropdown;
