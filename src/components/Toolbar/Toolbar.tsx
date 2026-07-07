import React, { useEffect, useRef, useState } from 'react';
import ProjectDropdown from './ProjectDropdown';
import { useProjectStore } from '../../state/projectStore';

const Toolbar: React.FC = () => {
  const project = useProjectStore((s) => s.project);
  const updateProjectTitle = useProjectStore((s) => s.updateProjectTitle);
  const showProjectSettings = useProjectStore((s) => s.showProjectSettings);
  const setShowProjectSettings = useProjectStore((s) => s.setShowProjectSettings);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [saveFlash, setSaveFlash] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  /* Focus input when editing starts */
  useEffect(() => {
    if (editingTitle) {
      setTitleDraft(project?.project?.title ?? '');
      setTimeout(() => {
        titleInputRef.current?.select();
      }, 30);
    }
  }, [editingTitle]);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed) updateProjectTitle(trimmed);
    setEditingTitle(false);
  };

  const handleSave = () => {
    if (typeof (window as any).__saveCurrentProject === 'function') {
      (window as any).__saveCurrentProject();
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1500);
    }
  };

  const projectTitle = project?.project?.title ?? 'Sans titre';

  /* ── Shared button base ── */
  const toolBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '5px 12px',
    border: '1px solid #444',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontFamily: 'system-ui, sans-serif',
    color: 'white',
    background: '#2d2d2d',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
    ...extra,
  });

  return (
    <header className="toolbar">
      {/* ── Left: App name ── */}
      <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#d4d4d4', whiteSpace: 'nowrap' }}>
        Virtual Tour Editor
      </h1>

      {/* ── Right: controls ── */}
      <div className="toolbar-actions">

        {/* Project name + gear */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: '#1e1e1e',
          border: '1px solid #3d3d3d',
          borderRadius: '6px',
          padding: '3px 8px',
          height: '32px',
          boxSizing: 'border-box',
        }}>
          <span style={{ fontSize: '0.72rem', color: '#666', whiteSpace: 'nowrap' }}>
            Projet :
          </span>

          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #007acc',
                outline: 'none',
                color: 'white',
                fontSize: '0.88rem',
                fontWeight: 600,
                width: '140px',
                padding: '0 2px',
                fontFamily: 'system-ui, sans-serif',
              }}
            />
          ) : (
            <button
              title="Renommer le projet"
              onClick={() => setEditingTitle(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'text',
                padding: '0 2px',
                maxWidth: '150px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {projectTitle}
            </button>
          )}

          {/* Pencil icon */}
          {!editingTitle && (
            <button
              title="Renommer le projet"
              onClick={() => setEditingTitle(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#555',
                cursor: 'pointer',
                padding: '0 2px',
                fontSize: '0.75rem',
                lineHeight: 1,
              }}
            >
              ✏️
            </button>
          )}

          {/* Gear icon → project settings panel */}
          <button
            title="Paramètres du projet"
            onClick={() => setShowProjectSettings(!showProjectSettings)}
            style={{
              background: 'none',
              border: 'none',
              color: showProjectSettings ? '#4caf50' : '#555',
              cursor: 'pointer',
              padding: '0 2px',
              fontSize: '0.9rem',
              lineHeight: 1,
              transition: 'color 0.15s',
            }}
          >
            ⚙️
          </button>
        </div>

        {/* Project selector dropdown */}
        <ProjectDropdown />

        {/* Save */}
        <button
          onClick={handleSave}
          style={toolBtn({
            background: saveFlash ? '#2e7d32' : '#2d2d2d',
            color: saveFlash ? '#a5d6a7' : 'white',
            borderColor: saveFlash ? '#4caf50' : '#444',
          })}
        >
          {saveFlash ? '✓ Sauvegardé' : '💾 Save'}
        </button>

        {/* Export */}
        <button style={toolBtn()}>
          📤 Export
        </button>
      </div>
    </header>
  );
};

export default Toolbar;
