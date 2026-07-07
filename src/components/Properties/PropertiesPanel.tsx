import React from 'react';
import { useProjectStore } from '../../state/projectStore';

const PropertiesPanel: React.FC = () => {
  const scenes = useProjectStore((state) => state.scenes);
  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);
  const selectedHotspotId = useProjectStore((state) => state.selectedHotspotId);
  
  const selectHotspot = useProjectStore((state) => state.selectHotspot);
  const updateHotspot = useProjectStore((state) => state.updateHotspot);
  const removeHotspot = useProjectStore((state) => state.removeHotspot);

  const selectedScene = scenes.find(s => s.id === selectedSceneId);
  const selectedHotspot = selectedScene?.hotspots?.find(h => h.id === selectedHotspotId);

  return (
    <aside className="properties-panel" style={{ padding: '15px', color: 'white', display: 'flex', flexDirection: 'column', gap: '20px', userSelect: 'none' }}>
      <h2 style={{ margin: 0, fontSize: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Properties</h2>
      
      {selectedScene ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <h4 style={{ margin: '0 0 5px 0', color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>Viewpoint</h4>
            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{selectedScene.title}</div>
            <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '2px' }}>ID: {selectedScene.id}</div>
          </div>

          <div style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>Hotspots</h4>
            
            {/* Hotspots List */}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          removeHotspot(selectedScene.id, h.id);
                        }}
                        style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '0.9rem', padding: '0 4px' }}
                        title="Delete hotspot"
                      >
                        🗑️
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#555', fontStyle: 'italic', marginBottom: '15px' }}>
                Aucun hotspot dans cette vue. Utilisez le bouton "Add Hotspot" en haut à droite du panorama pour en ajouter un.
              </div>
            )}

            {/* Selected Hotspot Edit Form */}
            {selectedHotspot ? (
              <div style={{
                backgroundColor: '#252526',
                border: '1px solid #333',
                borderRadius: '6px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', borderBottom: '1px solid #333', paddingBottom: '6px', color: '#888' }}>
                  Edit Hotspot
                </div>
                
                {/* Type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#aaa' }}>Type</label>
                  <select
                    value={selectedHotspot.type}
                    onChange={(e) => updateHotspot(selectedScene.id, selectedHotspot.id, { type: e.target.value as any })}
                    style={{
                      background: '#1e1e1e',
                      border: '1px solid #444',
                      color: 'white',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  >
                    <option value="text">ℹ️ Texte</option>
                    <option value="video">🎥 Vidéo (YouTube)</option>
                    <option value="image">🖼️ Image (URL)</option>
                  </select>
                </div>

                {/* Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#aaa' }}>
                    {selectedHotspot.type === 'video' ? 'Lien YouTube' : selectedHotspot.type === 'image' ? 'URL de l\'image' : 'Contenu Texte'}
                  </label>
                  {selectedHotspot.type === 'video' ? (
                    <input
                      type="text"
                      value={selectedHotspot.content}
                      onChange={(e) => updateHotspot(selectedScene.id, selectedHotspot.id, { content: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                      style={{
                        background: '#1e1e1e',
                        border: '1px solid #444',
                        color: 'white',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                  ) : selectedHotspot.type === 'image' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input
                        type="text"
                        value={selectedHotspot.content}
                        onChange={(e) => updateHotspot(selectedScene.id, selectedHotspot.id, { content: e.target.value })}
                        placeholder="https://exemple.com/image.jpg"
                        style={{
                          background: '#1e1e1e',
                          border: '1px solid #444',
                          color: 'white',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          outline: 'none',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                      {selectedHotspot.content && (
                        <img
                          src={selectedHotspot.content}
                          alt="preview"
                          style={{
                            width: '100%',
                            maxHeight: '120px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #333'
                          }}
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
                      placeholder="Saisissez votre texte..."
                      style={{
                        background: '#1e1e1e',
                        border: '1px solid #444',
                        color: 'white',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        resize: 'vertical',
                        outline: 'none',
                        fontFamily: 'sans-serif',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              selectedScene.hotspots && selectedScene.hotspots.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#555', fontStyle: 'italic', textAlign: 'center' }}>
                  Sélectionnez un hotspot dans la liste ci-dessus pour modifier ses propriétés.
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '0.9rem', color: '#555', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
          Sélectionnez un point de vue sur la carte ou dans la liste de gauche pour configurer ses propriétés.
        </div>
      )}
    </aside>
  );
};

export default PropertiesPanel;
