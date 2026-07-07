import React, { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';

const Sidebar: React.FC = () => {
  const scenes = useProjectStore((state) => state.scenes);
  const selectScene = useProjectStore((state) => state.selectScene);
  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);
  const updateScene = useProjectStore((state) => state.updateScene);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const startEditing = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering selectScene
    setEditingId(id);
    setEditText(currentTitle);
  };

  const saveEdit = (id: string) => {
    if (editText.trim()) {
      updateScene(id, { title: editText.trim() });
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      saveEdit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <aside className="sidebar" style={{ userSelect: 'none' }}>
      <h2>Viewpoints</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {scenes.map((scene) => {
          const isSelected = scene.id === selectedSceneId;
          const isEditing = scene.id === editingId;

          return (
            <li 
              key={scene.id} 
              onClick={() => selectScene(scene.id)}
              style={{ 
                cursor: 'pointer', 
                padding: '8px 10px', 
                borderBottom: '1px solid #333',
                backgroundColor: isSelected ? '#37373d' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: '4px',
                marginBottom: '2px'
              }}
            >
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
                    width: '80%'
                  }}
                  onClick={(e) => e.stopPropagation()} // Avoid selecting scene on click
                />
              ) : (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scene.title}
                </span>
              )}

              {!isEditing && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateScene(scene.id, { showTitleInViewer: scene.showTitleInViewer === false ? true : false });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      fontSize: '0.9rem',
                      opacity: scene.showTitleInViewer !== false ? 1 : 0.35,
                      filter: scene.showTitleInViewer !== false ? 'none' : 'grayscale(100%)',
                      transition: 'opacity 0.2s'
                    }}
                    title={scene.showTitleInViewer !== false ? "Masquer le nom dans la vue 360" : "Afficher le nom dans la vue 360"}
                  >
                    👁️
                  </button>
                  <button
                    onClick={(e) => startEditing(scene.id, scene.title, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      fontSize: '0.85rem'
                    }}
                    title="Renommer le viewpoint"
                  >
                    ✏️
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default Sidebar;
