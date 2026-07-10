import React, { useMemo, useRef, useEffect, useState } from 'react';
import { MapContainer, ImageOverlay, Marker, Popup, TileLayer, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useProjectStore } from '../../state/projectStore';
import type { Scene } from '../../models/Scene';
import { createTrackedObjectUrl } from '../../services/mediaRegistry';

const FitBounds: React.FC<{ bounds: L.LatLngBoundsExpression }> = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [10, 10] });
    // Prevent zooming out beyond the point where the whole plan fits the view
    const fitZoom = map.getBoundsZoom(bounds, false);
    map.setMinZoom(fitZoom);
    map.setMaxZoom(Math.max(2, fitZoom + 4));
  }, [map, bounds]);
  return null;
};

const MapRefBridge: React.FC<{ mapRef: React.MutableRefObject<L.Map | null> }> = ({ mapRef }) => {
  mapRef.current = useMap();
  return null;
};

const CenterOnSelected: React.FC = () => {
  const map = useMap();
  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);

  useEffect(() => {
    if (!selectedSceneId) return;
    const scene = useProjectStore.getState().scenes.find(s => s.id === selectedSceneId);
    if (scene) {
      map.panTo([scene.position.y, scene.position.x]);
    }
  }, [map, selectedSceneId]);

  return null;
};



interface ProjectMapProps {
  mapRef?: React.MutableRefObject<L.Map | null>;
  hideZoomControl?: boolean;
}

const ProjectMap: React.FC<ProjectMapProps> = ({ mapRef, hideZoomControl }) => {
  const project = useProjectStore((state) => state.project);
  const scenes = useProjectStore((state) => state.scenes);
  const setMapConfig = useProjectStore((state) => state.setMapConfig);
  const addScene = useProjectStore((state) => state.addScene);
  const selectScene = useProjectStore((state) => state.selectScene);
  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);
  const currentYaw = useProjectStore((state) => state.currentYaw);
  const updateScene = useProjectStore((state) => state.updateScene);
  const addLink = useProjectStore((state) => state.addLink);
  const removeLink = useProjectStore((state) => state.removeLink);
  const mode = useProjectStore((state) => state.mode);
  
  const [isPlacing, setIsPlacing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isDeletingPath, setIsDeletingPath] = useState(false);
  const [linkStartSceneId, setLinkStartSceneId] = useState<string | null>(null);
  const [isDraggingAngle, setIsDraggingAngle] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{x: number, y: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapFileRef = useRef<HTMLInputElement>(null);

  const mapControlButtonStyle = (isActive: boolean, activeColor = '#d32f2f', inactiveColor = '#1e1e1e') => ({
    width: '110px',
    padding: '8px 12px',
    cursor: 'pointer',
    backgroundColor: isActive ? activeColor : inactiveColor,
    color: 'white',
    border: '1px solid #3d3d3d',
    borderRadius: '4px',
    textAlign: 'left' as const,
    fontSize: '0.82rem',
    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    fontWeight: isActive ? ('bold' as const) : ('normal' as const)
  });

  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  const rotateSelectedScene = (amount: number) => {
    if (selectedScene) {
      const newNorth = (selectedScene.north + amount + 360) % 360;
      updateScene(selectedScene.id, { north: newNorth });
    }
  };

  useEffect(() => {
    if (!isRotating || !selectedSceneId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        rotateSelectedScene(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        rotateSelectedScene(5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRotating, selectedSceneId, selectedScene]);

  // Clean up dragging if component unmounts
  useEffect(() => {
    return () => {
      setIsDraggingAngle(false);
    };
  }, []);

  // Configuration for custom map image
  const mapConfig = project?.map;
  
  // Calculate bounds based on the image size if provided
  const bounds = useMemo(() => {
    if (mapConfig?.width && mapConfig?.height) {
      // In CRS.Simple, map coordinates match pixel coordinates directly
      // [y, x] in Leaflet corresponds to [height, width]
      return new L.LatLngBounds([0, 0], [mapConfig.height, mapConfig.width]);
    }
    return null;
  }, [mapConfig]);

  const isCustomMap = mapConfig?.type === 'custom' && mapConfig?.image && bounds;
  const isGeographicMap = mapConfig?.type === 'geographic';

  const handleUseGeographicMap = () => {
    setMapConfig({
      type: 'geographic'
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = createTrackedObjectUrl(file);
    const img = new Image();
    img.onload = () => {
      setMapConfig({
        type: 'custom',
        image: url,
        width: img.width,
        height: img.height,
      });
    };
    img.src = url;
  };

  const handleSceneFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingPosition) return;

    const url = createTrackedObjectUrl(file);
    const sceneId = `scene_${Date.now()}`;

    const newScene: Scene = {
      id: sceneId,
      title: file.name.replace(/\.[^/.]+$/, ""),
      image: url,
      thumbnail: url,
      position: pendingPosition,
      north: 0,
      links: [],
      hotspots: []
    };

    addScene(newScene);
    selectScene(newScene.id);
    
    setIsPlacing(false);
    setPendingPosition(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const MapEvents = () => {
    const map = useMap();
    useMapEvents({
      click(e) {
        if (isPlacing) {
          setPendingPosition({ x: e.latlng.lng, y: e.latlng.lat });
          fileInputRef.current?.click();
        }
      },
      mousedown(e) {
        if (isRotating && selectedScene) {
          const markerLatLng = L.latLng(selectedScene.position.y, selectedScene.position.x);
          const markerPoint = map.latLngToContainerPoint(markerLatLng);
          const clickPoint = map.latLngToContainerPoint(e.latlng);
          const dist = markerPoint.distanceTo(clickPoint);
          
          // Outer ring is 80px diameter (40px radius). Let's detect click between 20px and 60px radius
          if (dist >= 15 && dist <= 55) {
            setIsDraggingAngle(true);
            map.dragging.disable();
            
            const dx = clickPoint.x - markerPoint.x;
            const dy = clickPoint.y - markerPoint.y;
            let angle = Math.atan2(dy, dx) * 180 / Math.PI;
            angle = (angle + 90 + 360) % 360;
            const currentYawDeg = currentYaw * 180 / Math.PI;
            const newNorth = (angle - currentYawDeg + 360) % 360;
            updateScene(selectedScene.id, { north: newNorth });
          }
        }
      },
      mousemove(e) {
        if (isDraggingAngle && selectedScene) {
          const markerLatLng = L.latLng(selectedScene.position.y, selectedScene.position.x);
          const markerPoint = map.latLngToContainerPoint(markerLatLng);
          const mousePoint = map.latLngToContainerPoint(e.latlng);
          
          const dx = mousePoint.x - markerPoint.x;
          const dy = mousePoint.y - markerPoint.y;
          let angle = Math.atan2(dy, dx) * 180 / Math.PI;
          angle = (angle + 90 + 360) % 360;
          const currentYawDeg = currentYaw * 180 / Math.PI;
          const newNorth = (angle - currentYawDeg + 360) % 360;
          updateScene(selectedScene.id, { north: newNorth });
        }
      },
      mouseup() {
        if (isDraggingAngle) {
          setIsDraggingAngle(false);
          map.dragging.enable();
        }
      }
    });
    return null;
  };

  const renderMarkerIcon = (scene: Scene) => {
    const isSelected = scene.id === selectedSceneId;
    const isRotateMode = isRotating && isSelected;
    const isLinkStart = scene.id === linkStartSceneId;
    // Yaw is in radians. Convert to degrees.
    const angle = isSelected ? (currentYaw * 180 / Math.PI) + scene.north : 0;
    
    let html = '';
    if (isSelected) {
      html = `
        <div style="position: relative; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;">
          <!-- Dotted Gizmo Outer Ring -->
          ${isRotateMode ? `
            <div style="position: absolute; top: 10px; left: 10px; right: 10px; bottom: 10px; border: 2px dashed #007acc; border-radius: 50%; pointer-events: none; box-shadow: 0 0 6px rgba(0,122,204,0.4); animation: rotate-dash 20s linear infinite;"></div>
            <!-- Drag Handle Indicator on the Ring -->
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; transform: rotate(${angle}deg); pointer-events: none;">
              <div style="position: absolute; top: 4px; left: 50%; transform: translateX(-50%); width: 12px; height: 12px; background: #ffc107; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.6); cursor: row-resize;"></div>
            </div>
          ` : ''}
          ${isLinkStart ? `
            <div style="position: absolute; top: 15px; left: 15px; right: 15px; bottom: 15px; border: 2px dashed #28a745; border-radius: 50%; pointer-events: none; animation: rotate-dash 10s linear infinite;"></div>
          ` : ''}
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; transform: rotate(${angle}deg); pointer-events: none; width: 100%; height: 100%;">
            <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
              <defs>
                <radialGradient id="coneGradient" cx="50" cy="50" r="56" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#007acc" stop-opacity="0.8" />
                  <stop offset="100%" stop-color="#007acc" stop-opacity="0" />
                </radialGradient>
              </defs>
              <path d="M50 50 L10 10 A56.5 56.5 0 0 1 90 10 Z" fill="url(#coneGradient)" />
            </svg>
          </div>
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background: #007acc; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>
        </div>
      `;
    } else {
      html = `
        <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
          ${isLinkStart ? `
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 2px dashed #28a745; border-radius: 50%; pointer-events: none; animation: rotate-dash 10s linear infinite;"></div>
          ` : ''}
          <div style="width: 12px; height: 12px; background: #ff5722; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>
        </div>
      `;
    }

    return L.divIcon({
      html,
      className: 'custom-scene-marker',
      iconSize: isSelected ? [100, 100] : [30, 30],
      iconAnchor: isSelected ? [50, 50] : [15, 15]
    });
  };

  const openFileDialog = () => {
    mapFileRef.current?.click();
  };

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', backgroundColor: '#111' }}>
      {isCustomMap ? (
        // Mode 1: Image Personnalisée
        <div 
          className={isPlacing ? 'placing-mode' : ''} 
          style={{ width: '100%', height: '100%', position: 'relative' }}
        >
          <MapContainer 
            key="custom-map"
            crs={L.CRS.Simple} 
            bounds={bounds}
            style={{ height: '100%', width: '100%' }}
            maxZoom={2}
            minZoom={0}
            zoomControl={!hideZoomControl}
          >
            {mapRef && <MapRefBridge mapRef={mapRef} />}
            <MapEvents />
            <FitBounds bounds={bounds} />
            <CenterOnSelected />
            <ImageOverlay
              url={mapConfig.image!}
              bounds={bounds}
            />
            {scenes.map(scene => (
              <Marker 
                key={scene.id} 
                position={[scene.position.y, scene.position.x]} 
                icon={renderMarkerIcon(scene)}
                draggable={isMoving}
                eventHandlers={{ 
                  click: () => {
                    if (isLinking) {
                      if (!linkStartSceneId) {
                        setLinkStartSceneId(scene.id);
                      } else {
                        if (linkStartSceneId !== scene.id) {
                          addLink(linkStartSceneId, scene.id);
                          setLinkStartSceneId(null);
                        } else {
                          setLinkStartSceneId(null);
                        }
                      }
                    } else if (!isMoving && !isRotating) {
                      selectScene(scene.id);
                    }
                  },
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    updateScene(scene.id, { position: { x: position.lng, y: position.lat } });
                  }
                }}
              >
                {!isLinking && !isMoving && !isRotating && <Popup>{scene.title}</Popup>}
              </Marker>
            ))}
            {/* Draw Path Polylines */}
            {scenes.flatMap(s => s.links.map(link => {
              const targetScene = scenes.find(t => t.id === link.target);
              if (!targetScene) return null;
              if (s.id > targetScene.id) return null; // Avoid duplicate lines
              
              const isConnectedToSelected = selectedSceneId === s.id || selectedSceneId === targetScene.id;
              
              if (isLinking || isConnectedToSelected) {
                return (
                  <Polyline 
                    key={`link-${s.id}-${targetScene.id}`}
                    positions={[
                      [s.position.y, s.position.x],
                      [targetScene.position.y, targetScene.position.x]
                    ]}
                    color={isDeletingPath ? '#d32f2f' : '#28a745'}
                    weight={5}
                    dashArray="6, 6"
                    opacity={isConnectedToSelected ? 0.9 : 0.4}
                    eventHandlers={{
                      click: (e) => {
                        if (isDeletingPath) {
                          removeLink(s.id, targetScene.id);
                          L.DomEvent.stopPropagation(e as any);
                        }
                      }
                    }}
                  />
                );
              }
              return null;
            }))}
          </MapContainer>

          {mode === 'editor' &&
          <div style={{ position: 'absolute', top: 90, left: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {!isMoving && !isRotating && !isLinking && (
              <button 
                onClick={() => setIsPlacing(!isPlacing)}
                style={mapControlButtonStyle(isPlacing, '#d32f2f', '#007acc')}
              >
                {isPlacing ? '❌ Cancel' : '📍 Add'}
              </button>
            )}
            {!isPlacing && !isRotating && !isLinking && (
              <button 
                onClick={() => setIsMoving(!isMoving)}
                style={mapControlButtonStyle(isMoving, '#28a745', '#1e1e1e')}
              >
                {isMoving ? '✅ Validate' : '✋ Move'}
              </button>
            )}
            {!isPlacing && !isMoving && !isLinking && (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <button 
                  onClick={() => setIsRotating(!isRotating)}
                  style={mapControlButtonStyle(isRotating, '#28a745', '#1e1e1e')}
                >
                  {isRotating ? '✅ Validate' : '🔄 Rotate'}
                </button>
                {isRotating && selectedSceneId && (
                  <div style={{ display: 'flex', gap: '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden' }}>
                    <button 
                      onClick={() => rotateSelectedScene(-5)}
                      style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: '#343a40', color: 'white', border: '1px solid #3d3d3d', borderRight: 'none' }}
                      title="Tourner à gauche (Flèche gauche)"
                    >
                      ◀
                    </button>
                    <button 
                      onClick={() => rotateSelectedScene(5)}
                      style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: '#343a40', color: 'white', border: '1px solid #3d3d3d' }}
                      title="Tourner à droite (Flèche droite)"
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>
            )}
            {!isPlacing && !isMoving && !isRotating && (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <button 
                  onClick={() => {
                    if (isLinking) {
                      setIsLinking(false);
                      setIsDeletingPath(false);
                      setLinkStartSceneId(null);
                    } else {
                      setIsLinking(true);
                    }
                  }}
                  style={mapControlButtonStyle(isLinking, '#28a745', '#1e1e1e')}
                >
                  {isLinking ? '✅ Validate' : '🔗 Path'}
                </button>
                {isLinking && (
                  <button 
                    onClick={() => setIsDeletingPath(!isDeletingPath)}
                    style={mapControlButtonStyle(isDeletingPath, '#d32f2f', '#343a40')}
                  >
                    {isDeletingPath ? '✍️ Link' : '🗑️ Delete'}
                  </button>
                )}
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleSceneFileChange} 
            />
          </div>
          }
        </div>
      ) : isGeographicMap ? (
        <div 
          className={isPlacing ? 'placing-mode' : ''} 
          style={{ width: '100%', height: '100%', position: 'relative' }}
        >
          <MapContainer
            key="geo-map"
            center={[48.8566, 2.3522]}
            zoom={13}
            minZoom={1}
            style={{ height: '100%', width: '100%' }}
            zoomControl={!hideZoomControl}
          >
            {mapRef && <MapRefBridge mapRef={mapRef} />}
            <MapEvents />
            <CenterOnSelected />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {scenes.map(scene => (
              <Marker
                key={scene.id}
                position={[scene.position.y, scene.position.x]}
                icon={renderMarkerIcon(scene)}
                draggable={isMoving}
                eventHandlers={{ 
                  click: () => {
                    if (isLinking) {
                      if (!linkStartSceneId) {
                        setLinkStartSceneId(scene.id);
                      } else {
                        if (linkStartSceneId !== scene.id) {
                          addLink(linkStartSceneId, scene.id);
                          setLinkStartSceneId(null);
                        } else {
                          setLinkStartSceneId(null);
                        }
                      }
                    } else if (!isMoving && !isRotating) {
                      selectScene(scene.id);
                    }
                  },
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    updateScene(scene.id, { position: { x: position.lng, y: position.lat } });
                  }
                }}
              >
                {!isLinking && !isMoving && !isRotating && <Popup>{scene.title}</Popup>}
              </Marker>
            ))}
            {/* Draw Path Polylines */}
            {scenes.flatMap(s => s.links.map(link => {
              const targetScene = scenes.find(t => t.id === link.target);
              if (!targetScene) return null;
              if (s.id > targetScene.id) return null; // Avoid duplicate lines
              
              const isConnectedToSelected = selectedSceneId === s.id || selectedSceneId === targetScene.id;
              
              if (isLinking || isConnectedToSelected) {
                return (
                  <Polyline 
                    key={`link-${s.id}-${targetScene.id}`}
                    positions={[
                      [s.position.y, s.position.x],
                      [targetScene.position.y, targetScene.position.x]
                    ]}
                    color={isDeletingPath ? '#d32f2f' : '#28a745'}
                    weight={5}
                    dashArray="6, 6"
                    opacity={isConnectedToSelected ? 0.9 : 0.4}
                    eventHandlers={{
                      click: (e) => {
                        if (isDeletingPath) {
                          removeLink(s.id, targetScene.id);
                          L.DomEvent.stopPropagation(e as any);
                        }
                      }
                    }}
                  />
                );
              }
              return null;
            }))}
          </MapContainer>

          {mode === 'editor' &&
          <div style={{ position: 'absolute', top: 90, left: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {!isMoving && !isRotating && !isLinking && (
              <button 
                onClick={() => setIsPlacing(!isPlacing)}
                style={mapControlButtonStyle(isPlacing, '#d32f2f', '#007acc')}
              >
                {isPlacing ? '❌ Cancel' : '📍 Add'}
              </button>
            )}
            {!isPlacing && !isRotating && !isLinking && (
              <button 
                onClick={() => setIsMoving(!isMoving)}
                style={mapControlButtonStyle(isMoving, '#28a745', '#1e1e1e')}
              >
                {isMoving ? '✅ Validate' : '✋ Move'}
              </button>
            )}
            {!isPlacing && !isMoving && !isLinking && (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <button 
                  onClick={() => setIsRotating(!isRotating)}
                  style={mapControlButtonStyle(isRotating, '#28a745', '#1e1e1e')}
                >
                  {isRotating ? '✅ Validate' : '🔄 Rotate'}
                </button>
                {isRotating && selectedSceneId && (
                  <div style={{ display: 'flex', gap: '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden' }}>
                    <button 
                      onClick={() => rotateSelectedScene(-5)}
                      style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: '#343a40', color: 'white', border: '1px solid #3d3d3d', borderRight: 'none' }}
                      title="Tourner à gauche (Flèche gauche)"
                    >
                      ◀
                    </button>
                    <button 
                      onClick={() => rotateSelectedScene(5)}
                      style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: '#343a40', color: 'white', border: '1px solid #3d3d3d' }}
                      title="Tourner à droite (Flèche droite)"
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>
            )}
            {!isPlacing && !isMoving && !isRotating && (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <button 
                  onClick={() => {
                    if (isLinking) {
                      setIsLinking(false);
                      setIsDeletingPath(false);
                      setLinkStartSceneId(null);
                    } else {
                      setIsLinking(true);
                    }
                  }}
                  style={mapControlButtonStyle(isLinking, '#28a745', '#1e1e1e')}
                >
                  {isLinking ? '✅ Validate' : '🔗 Path'}
                </button>
                {isLinking && (
                  <button 
                    onClick={() => setIsDeletingPath(!isDeletingPath)}
                    style={mapControlButtonStyle(isDeletingPath, '#d32f2f', '#343a40')}
                  >
                    {isDeletingPath ? '✍️ Link' : '🗑️ Delete'}
                  </button>
                )}
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleSceneFileChange} 
            />
          </div>
          }
        </div>
      ) : (
        mode === 'editor' ? (
          <div style={{ 
            height: '100%', 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '20px',
            color: '#ccc',
            background: '#1e1e1e'
          }}>
            <h3 style={{ margin: 0 }}>Configurer le plan de travail</h3>
            <div style={{ display: 'flex', gap: '20px' }}>
              <button 
                onClick={openFileDialog}
                style={{ padding: '15px 25px', fontSize: '1rem', cursor: 'pointer', backgroundColor: '#007acc', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                📍 Charger un plan (Image)
              </button>
              <button 
                onClick={handleUseGeographicMap}
                style={{ padding: '15px 25px', fontSize: '1rem', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                🌍 Carte Géographique (GPS)
              </button>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              ref={mapFileRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
            />
          </div>
        ) : (
          <div style={{ 
            height: '100%', 
            width: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: '#888',
            background: '#1e1e1e',
            fontSize: '0.9rem',
            fontFamily: 'system-ui, sans-serif'
          }}>
            Aucun plan disponible pour cette visite.
          </div>
        )
      )}
    </div>
  );
};

export default ProjectMap;
