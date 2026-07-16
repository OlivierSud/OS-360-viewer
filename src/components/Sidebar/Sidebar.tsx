import React, { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';

const Sidebar: React.FC = () => {
  const scenes = useProjectStore((state) => state.scenes);
  const selectScene = useProjectStore((state) => state.selectScene);
  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);
  const updateScene = useProjectStore((state) => state.updateScene);
  const removeScene = useProjectStore((state) => state.removeScene);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEditing = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditText(currentTitle);
    setConfirmDeleteId(null);
  };

  const saveEdit = (id: string) => {
    if (editText.trim()) {
      updateScene(id, { title: editText.trim() });
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') saveEdit(id);
    else if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <>
      {/* Mobile FAB to open the viewpoints list */}
      <button
        className="sidebar-fab"
        onClick={() => setMobileOpen(true)}
        style={{
          display: 'none',
          position: 'fixed',
          left: '12px',
          bottom: '12px',
          zIndex: 1500,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'linear-gradient(180deg, rgba(0,136,255,0.9), rgba(0,85,204,0.9))',
          color: 'white',
          cursor: 'pointer',
          fontSize: '1.4rem',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
        }}
        title="Viewpoints"
      >
        ☰
      </button>

      <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`} style={{ userSelect: 'none' }}>
        <button
          className="sheet-collapse-btn"
          onClick={() => setMobileOpen(false)}
          title="Fermer"
          aria-label="Fermer"
        >
          <svg width="22" height="14" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 3 12 11 20 3" />
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <h2 style={{ margin: 0 }}>Viewpoints</h2>
        </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {scenes.map((scene) => {
          const isSelected = scene.id === selectedSceneId;
          const isEditing = scene.id === editingId;
          const isConfirmingDelete = scene.id === confirmDeleteId;

          return (
            <li
              key={scene.id}
              onClick={() => { if (!isConfirmingDelete) { selectScene(scene.id); setMobileOpen(false); } }}
              style={{
                cursor: 'pointer',
                padding: '8px 10px',
                borderBottom: '1px solid #333',
                backgroundColor: isSelected ? '#37373d' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: '4px',
                marginBottom: '2px',
              }}
            >
              {/* Left: title / edit input / confirm delete */}
              {isEditing ? (
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => saveEdit(scene.id)}
                  onKeyDown={(e) => handleKeyDown(e, scene.id)}
                  autoFocus
                  style={{
                    background: '#252526',
                    border: '1px solid #007acc',
                    color: 'white',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    width: '80%',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : isConfirmingDelete ? (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span style={{ fontSize: '0.78rem', color: '#ff6b6b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Supprimer ?
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeScene(scene.id); setConfirmDeleteId(null); }}
                    style={{ background: '#d32f2f', border: 'none', color: 'white', cursor: 'pointer', padding: '2px 8px', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    Oui
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                    style={{ background: '#444', border: 'none', color: '#ccc', cursor: 'pointer', padding: '2px 8px', borderRadius: '3px', fontSize: '0.75rem' }}
                  >
                    Non
                  </button>
                </div>
              ) : (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {scene.title}
                </span>
              )}

              {/* Right: action buttons (hidden during edit or confirm) */}
              {!isEditing && !isConfirmingDelete && (
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0, marginLeft: '6px' }}>
                  {/* Visibility toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateScene(scene.id, { showTitleInViewer: scene.showTitleInViewer === false ? true : false });
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', fontSize: '0.85rem',
                      opacity: scene.showTitleInViewer !== false ? 1 : 0.35,
                      filter: scene.showTitleInViewer !== false ? 'none' : 'grayscale(100%)',
                      transition: 'opacity 0.2s',
                    }}
                    title={scene.showTitleInViewer !== false ? 'Masquer le nom dans la vue 360' : 'Afficher le nom dans la vue 360'}
                  >
                    👁️
                  </button>

                  {/* Rename */}
                  <button
                    onClick={(e) => startEditing(scene.id, scene.title, e)}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px 3px', fontSize: '0.85rem' }}
                    title="Renommer le viewpoint"
                  >
                    ✏️
                  </button>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(scene.id); }}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px 3px', lineHeight: 1, transition: 'color 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ff6b6b')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
                    title="Supprimer ce viewpoint"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      </aside>
    </>
  );
};

export default Sidebar;
