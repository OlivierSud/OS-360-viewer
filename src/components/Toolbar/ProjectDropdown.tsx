import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  listProjects,
  loadProjectById,
  saveProject,
  deleteProject,
  createProjectId,
  migrateOldProject,
  type ProjectEntry,
} from '../../storage/projectRegistry';
import { useProjectStore } from '../../state/projectStore';
import type { Project } from '../../models/Project';

const ProjectDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const storeProject = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);

  const setCurrentId = (id: string | null) => {
    setCurrentIdState(id);
    setCurrentProjectId(id);
  };

  /* ── Bootstrap: migrate old data, load index, auto-load or create project ── */
  useEffect(() => {
    migrateOldProject();
    const entries = listProjects();
    setProjects(entries);

    if (entries.length > 0) {
      // Load the most-recently updated project
      const latest = [...entries].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      openProject(latest.id, entries);
    } else {
      // Create a first blank project
      createAndOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Close on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Focus search when panel opens ── */
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  /* ── Helpers ── */
  const refreshList = () => {
    const entries = listProjects();
    setProjects(entries);
    return entries;
  };

  const openProject = useCallback((id: string, entries?: ProjectEntry[]) => {
    const raw = loadProjectById(id);
    if (!raw) return;
    try {
      const parsed: Project = JSON.parse(raw);
      setProject(parsed);
      setCurrentId(id);
      setOpen(false);
    } catch {
      console.error('Failed to parse project', id);
    }
  }, [setProject]);

  const createAndOpen = useCallback(() => {
    const id = createProjectId();
    const title = 'Nouveau Projet';
    const blank: Project = {
      version: 1,
      project: { title, createdAt: new Date().toISOString() },
      scenes: [],
    };
    const data = JSON.stringify(blank);
    saveProject(id, title, data);
    setProject(blank);
    setCurrentId(id);
    setOpen(false);
    refreshList();
  }, [setProject]);

  /* ── Save current project ── */
  const handleSave = useCallback(() => {
    if (!storeProject) return;
    const id = currentId ?? createProjectId();
    const title = storeProject.project.title;
    const data = JSON.stringify({
      ...storeProject,
      project: { ...storeProject.project, updatedAt: new Date().toISOString() },
    });
    saveProject(id, title, data);
    if (!currentId) setCurrentId(id);
    refreshList();
  }, [storeProject, currentId]);

  /* ── Expose save so Toolbar can call it ── */
  useEffect(() => {
    (window as any).__saveCurrentProject = handleSave;
  }, [handleSave]);

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const currentTitle = storeProject?.project?.title ?? 'Projects';

  /* ── Styles ── */
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
    width: '260px',
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
      {/* Trigger button */}
      <button style={btn} onClick={() => setOpen((o) => !o)}>
        <span style={{ fontSize: '1rem' }}>📁</span>
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

      {/* Dropdown panel */}
      {open && (
        <div style={panel}>
          {/* Search bar */}
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
                onChange={(e) => setSearch(e.target.value)}
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
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Project list */}
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: '14px',
                  color: '#555',
                  fontStyle: 'italic',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                }}
              >
                {search ? 'Aucun projet trouvé' : 'Aucun projet enregistré'}
              </div>
            ) : (
              filtered.map((p) => {
                const isActive = p.id === currentId;
                return (
                  <div
                    key={p.id}
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
                    onMouseEnter={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = '#2a2a2a';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Click to switch */}
                    <div
                      style={{ flex: 1, overflow: 'hidden' }}
                      onClick={() => openProject(p.id)}
                    >
                      <div
                        style={{
                          fontWeight: isActive ? 600 : 400,
                          fontSize: '0.88rem',
                          color: 'white',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '2px' }}>
                        {new Date(p.updatedAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    {/* Delete button */}
                    {!isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Supprimer "${p.title}" ?`)) {
                            deleteProject(p.id);
                            refreshList();
                          }
                        }}
                        title="Supprimer ce projet"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#555',
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

          {/* Footer: New project */}
          <div style={{ borderTop: '1px solid #333', padding: '8px 10px' }}>
            <button
              onClick={createAndOpen}
              style={{
                width: '100%',
                padding: '7px',
                backgroundColor: '#252526',
                color: '#4caf50',
                border: '1px dashed #444',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2d2d2d')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#252526')
              }
            >
              ＋ Nouveau projet
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDropdown;
