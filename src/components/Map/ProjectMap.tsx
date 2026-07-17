import React, { useMemo, useRef, useEffect, useState } from 'react';
import { MapContainer, ImageOverlay, Marker, Popup, TileLayer, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useProjectStore } from '../../state/projectStore';
import type { Scene } from '../../models/Scene';
import { createTrackedObjectUrl } from '../../services/mediaRegistry';

const FitBounds: React.FC<{ bounds: L.LatLngBoundsExpression; isExpanded?: boolean }> = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    // Calculate fitZoom with a safety padding
    const fitZoom = map.getBoundsZoom(bounds, false, L.point(30, 30));
    // Allow zooming out 3 levels further than the fit zoom to see the surroundings
    const minZoomLevel = fitZoom - 3;
    map.setMinZoom(minZoomLevel);
    map.setMaxZoom(Math.max(2, fitZoom + 2));
    
    const center = L.latLngBounds(bounds as any).getCenter();
    // Always start fitted perfectly to the container bounds
    map.setView(center, fitZoom);
  }, [map, bounds]);
  return null;
};

const FitGeoBounds: React.FC<{ scenes: Scene[]; isExpanded?: boolean }> = ({ scenes }) => {
  const map = useMap();
  useEffect(() => {
    if (scenes.length === 0) {
      map.setMinZoom(1);
      map.setMaxZoom(18);
      return;
    }

    const lats = scenes.map(s => s.position.y);
    const lons = scenes.map(s => s.position.x);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // If there is only one viewpoint, or all viewpoints are at the same spot
    if (minLat === maxLat && minLon === maxLon) {
      map.setView([minLat, minLon], 15);
      map.setMinZoom(8);
      map.setMaxZoom(17);
      return;
    }

    const bounds = L.latLngBounds([minLat, minLon], [maxLat, maxLon]);
    const fitZoom = map.getBoundsZoom(bounds, false, L.point(50, 50));
    // Allow zooming out 5 levels further than the viewpoints bounds for geographic map
    const minZoomLevel = Math.max(1, fitZoom - 5);
    // Don't zoom in closer than fitZoom + 2, cap at 17 to prevent zooming into empty space
    const maxZoomLevel = Math.min(17, Math.max(12, fitZoom + 2));

    map.setMinZoom(minZoomLevel);
    map.setMaxZoom(maxZoomLevel);
    
    // Always start fitted perfectly to the container bounds
    map.setView(bounds.getCenter(), fitZoom);
  }, [map, scenes]);
  return null;
};

const MapRefBridge: React.FC<{ mapRef: React.MutableRefObject<L.Map | null> }> = ({ mapRef }) => {
  mapRef.current = useMap();
  return null;
};

const CenterOnSelected: React.FC = () => {
  const map = useMap();
  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);
  const firstRun = useRef(true);

  useEffect(() => {
    // Skip the very first selection (initial load) so that the initial overview
    // showing the entire map at minZoom is not immediately overridden.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!selectedSceneId) return;
    const scene = useProjectStore.getState().scenes.find(s => s.id === selectedSceneId);
    if (scene) {
      map.panTo([scene.position.y, scene.position.x]);
    }
  }, [map, selectedSceneId]);

  return null;
};

const GeoSearch: React.FC = () => {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const runSearch = async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const onType = (value: string) => {
    setQuery(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void runSearch(value), 400);
  };

  const select = (r: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    map.setView([lat, lon], 16);
    const current = useProjectStore.getState().project?.map;
    if (current) {
      useProjectStore.getState().setMapConfig({ ...current, center: [lat, lon] });
    }
    setOpen(false);
    setQuery(r.display_name.split(',')[0]);
  };

  const [fixed, setFixed] = useState(false);

  const fixHere = () => {
    const c = map.getCenter();
    const current = useProjectStore.getState().project?.map;
    if (current) {
      useProjectStore.getState().setMapConfig({ ...current, center: [c.lat, c.lng] });
    }
    setFixed(true);
    window.setTimeout(() => setFixed(false), 1600);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        left: '54px',
        zIndex: 1100,
        width: '300px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => onType(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Rechercher un lieu…"
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: 'border-box',
            padding: '8px 10px',
            borderRadius: '6px',
            border: '1px solid #3d3d3d',
            background: 'rgba(20,20,20,0.92)',
            color: 'white',
            fontSize: '0.82rem',
            outline: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        />
        <button
          onClick={fixHere}
          title="Fixer la position de départ sur la carte"
          style={{
            flexShrink: 0,
            padding: '8px 10px',
            borderRadius: '6px',
            border: '1px solid #3d3d3d',
            background: fixed ? '#2e7d32' : '#007acc',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          {fixed ? '✓' : '📍'}
        </button>
      </div>
      {fixed && (
        <div
          style={{
            marginTop: '6px',
            padding: '5px 8px',
            borderRadius: '6px',
            background: 'rgba(46,125,50,0.95)',
            color: 'white',
            fontSize: '0.75rem',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          Position de départ enregistrée ✓
        </div>
      )}
      {/* ⚠️ C'est ici que se trouvait le </div> en trop qui cassait le code ! Je l'ai retiré. */}
      {open && (loading || results.length > 0) && (
        <div
          style={{
            marginTop: '4px',
            background: '#fff',
            color: '#111',
            borderRadius: '6px',
            overflow: 'hidden',
            maxHeight: '240px',
            overflowY: 'auto',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            fontSize: '0.8rem',
          }}
        >
          {loading && <div style={{ padding: '8px 10px', color: '#666' }}>Recherche…</div>}
          {!loading && results.length === 0 && (
            <div style={{ padding: '8px 10px', color: '#666' }}>Aucun résultat</div>
          )}
          {results.map((r, i) => (
            <div
              key={i}
              onClick={() => select(r)}
              title={r.display_name}
              style={{
                padding: '7px 10px',
                cursor: 'pointer',
                borderBottom: i < results.length - 1 ? '1px solid #eee' : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              {r.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};



interface ProjectMapProps {
  mapRef?: React.MutableRefObject<L.Map | null>;
  hideZoomControl?: boolean;
  isExpanded?: boolean;
}

const ProjectMap: React.FC<ProjectMapProps> = ({ mapRef, hideZoomControl, isExpanded }) => {
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
  const removeScene = useProjectStore((state) => state.removeScene);
  const mode = useProjectStore((state) => state.mode);
  
  const [isPlacing, setIsPlacing] = useState(false);
  const [isPlacingProjectLink, setIsPlacingProjectLink] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isDeletingPath, setIsDeletingPath] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmSceneId, setDeleteConfirmSceneId] = useState<string | null>(null);
  const [linkStartSceneId, setLinkStartSceneId] = useState<string | null>(null);
  const [isDraggingAngle, setIsDraggingAngle] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{x: number, y: number} | null>(null);
  const [travelPos, setTravelPos] = useState<[number, number] | null>(null);
  const prevSceneIdRef = useRef<string | null>(selectedSceneId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapFileRef = useRef<HTMLInputElement>(null);

  const mapControlButtonStyle = (isActive: boolean, activeColor = '#d32f2f', inactiveColor = 'rgba(0,0,0,0.55)') => ({
    width: '130px',
    padding: '7px 14px 7px 10px',
    cursor: 'pointer',
    backgroundColor: isActive ? activeColor : inactiveColor,
    color: 'white',
    border: isActive ? `1px solid ${activeColor}` : '1px solid rgba(255,255,255,0.12)',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: 600 as const,
    letterSpacing: '0.02em',
    boxShadow: isActive
      ? `0 0 0 2px ${activeColor}55, 0 4px 12px rgba(0,0,0,0.5)`
      : '0 2px 8px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '7px',
    transition: 'all 0.18s ease',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  });

  // SVG icons for editor buttons
  const Icon360 = () => (
    <svg width="18" height="18" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Camera body */}
      <rect x="2" y="4" width="18" height="13" rx="2.5"/>
      {/* Top bump */}
      <path d="M7 4V3h5v1"/>
      {/* Lens outer */}
      <circle cx="11" cy="10.5" r="4"/>
      {/* Lens inner */}
      <circle cx="11" cy="10.5" r="1.5" fill="currentColor" stroke="none"/>
      {/* Viewfinder dot */}
      <circle cx="3.8" cy="7" r="0.7" fill="currentColor" stroke="none"/>
      {/* Left rotation arrow */}
      <path d="M3 20.5c2-4 5-5.5 8-5.5"/>
      <polyline points="3.5 23 3 20.5 6 20.5"/>
      {/* Right rotation arrow */}
      <path d="M19 20.5c-2-4-5-5.5-8-5.5"/>
      <polyline points="18.5 23 19 20.5 16 20.5"/>
    </svg>
  );

  const IconPortal = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Door/bracket */}
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      {/* Arrow pointing right */}
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );

  const IconMove = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 9 2 12 5 15"/>
      <polyline points="9 5 12 2 15 5"/>
      <polyline points="15 19 12 22 9 19"/>
      <polyline points="19 9 22 12 19 15"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="12" y1="2" x2="12" y2="22"/>
    </svg>
  );

  const IconRotate = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6"/>
      <path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/>
    </svg>
  );

  const IconPath = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2"/>
      <circle cx="18" cy="19" r="2"/>
      <path d="M6 7c0 4 3 5 6 6s6 2 6 6"/>
    </svg>
  );

  const IconCancel = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );

  const IconTrash = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );

  const IconCheck = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );

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
    const isVideo = file.type.startsWith('video/');

    const newScene: Scene = {
      id: sceneId,
      title: file.name.replace(/\.[^/.]+$/, ""),
      image: isVideo ? '' : url,
      thumbnail: isVideo ? '' : url,
      video: isVideo ? url : undefined,
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
        } else if (isPlacingProjectLink) {
          const sceneId = `project_link_${Date.now()}`;
          const newScene: Scene = {
            id: sceneId,
            title: "Lien Projet",
            image: "",
            thumbnail: "",
            position: { x: e.latlng.lng, y: e.latlng.lat },
            north: 0,
            links: [],
            hotspots: [],
            type: 'project-link'
          };
          addScene(newScene);
          selectScene(newScene.id);
          setIsPlacingProjectLink(false);
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

  // Animate the active marker along the path (straight line between the
  // previous and the new viewpoint) while a scene is loading. The travel
  // marker reaches its destination exactly when the scene is loaded.
  useEffect(() => {
    const prevId = prevSceneIdRef.current;
    prevSceneIdRef.current = selectedSceneId;
    if (!prevId || prevId === selectedSceneId) return;

    const fromScene = scenes.find((s) => s.id === prevId);
    const toScene = scenes.find((s) => s.id === selectedSceneId);
    if (!fromScene || !toScene) return;

    const from: [number, number] = [fromScene.position.y, fromScene.position.x];
    const to: [number, number] = [toScene.position.y, toScene.position.x];

    let raf = 0;
    let start = performance.now();
    const FIXED = 650; // ms — minimum travel time for a smooth animation
    const step = (now: number) => {
      const loading = useProjectStore.getState().isSceneLoading;
      const t = (now - start) / FIXED;
      if (!loading && t >= 1) {
        // Scene loaded and travel time elapsed: arrive at destination.
        setTravelPos([to[0], to[1]]);
        setTravelPos(null);
        return;
      }
      const c = Math.max(0, Math.min(1, t));
      const lat = from[0] + (to[0] - from[0]) * c;
      const lng = from[1] + (to[1] - from[1]) * c;
      setTravelPos([lat, lng]);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [selectedSceneId, scenes]);

  const renderMarkerIcon = (scene: Scene) => {
    const isSelected = scene.id === selectedSceneId;
    const isRotateMode = isRotating && isSelected;
    const isLinkStart = scene.id === linkStartSceneId;
    const isProjectLink = scene.type === 'project-link';
    // Yaw is in radians. Convert to degrees.
    const angle = isSelected ? (currentYaw * 180 / Math.PI) + scene.north : 0;
    
    let html = '';
    if (isSelected) {
      if (isProjectLink) {
        html = `
          <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 3px solid #9c27b0; border-radius: 50%; pointer-events: none; background: rgba(156, 39, 176, 0.25); box-shadow: 0 0 8px rgba(156, 39, 176, 0.6);"></div>
            <div style="font-size: 1.1rem; z-index: 2; pointer-events: none; line-height: 1;">🔗</div>
          </div>
        `;
      } else {
        html = `
          <div style="position: relative; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;">
            ${isRotateMode ? `
              <div style="position: absolute; top: 10px; left: 10px; right: 10px; bottom: 10px; border: 2px dashed #007acc; border-radius: 50%; pointer-events: none; box-shadow: 0 0 6px rgba(0,122,204,0.4); animation: rotate-dash 20s linear infinite;"></div>
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
      }
    } else {
      if (isProjectLink) {
        html = `
          <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
            <div style="width: 18px; height: 18px; background: #9c27b0; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 0.62rem; color: white; line-height: 1;">🔗</div>
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
    }

    return L.divIcon({
      html,
      className: 'custom-scene-marker',
      iconSize: isSelected && !isProjectLink ? [100, 100] : isSelected && isProjectLink ? [40, 40] : [30, 30],
      iconAnchor: isSelected && !isProjectLink ? [50, 50] : isSelected && isProjectLink ? [20, 20] : [15, 15]
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
            <FitBounds bounds={bounds} isExpanded={isExpanded} />
            <CenterOnSelected />
            <ImageOverlay
              url={mapConfig.image!}
              bounds={bounds}
            />
            {scenes.map(scene => (
              <Marker 
                key={scene.id} 
                position={scene.id === selectedSceneId && travelPos ? travelPos : [scene.position.y, scene.position.x]} 
                icon={renderMarkerIcon(scene)}
                draggable={isMoving}
                eventHandlers={{ 
                  click: () => {
                    if (isDeleting) {
                      setDeleteConfirmSceneId(scene.id);
                    } else if (isLinking) {
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
                {!isLinking && !isMoving && !isRotating && !isDeleting && <Popup>{scene.title}</Popup>}
                {isDeleting && deleteConfirmSceneId === scene.id && (
                  <Popup autoClose={false} closeOnClick={false}>
                    <div style={{ fontFamily: 'system-ui, sans-serif', minWidth: '180px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '8px', color: '#d32f2f', fontSize: '0.9rem' }}>
                        🗑️ Supprimer ce point ?
                      </div>
                      <div style={{ fontSize: '0.82rem', marginBottom: '10px', color: '#444' }}>
                        <strong>{scene.title || 'Sans titre'}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => { removeScene(scene.id); setDeleteConfirmSceneId(null); }}
                          style={{ flex: 1, padding: '5px 0', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          Supprimer
                        </button>
                        <button
                          onClick={() => setDeleteConfirmSceneId(null)}
                          style={{ flex: 1, padding: '5px 0', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  </Popup>
                )}
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
          <div className="map-controls" style={{ position: 'absolute', top: 90, left: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {!isMoving && !isRotating && !isLinking && !isPlacingProjectLink && (
              <button 
                onClick={() => setIsPlacing(!isPlacing)}
                style={mapControlButtonStyle(isPlacing, '#d32f2f', '#007acc')}
              >
                {isPlacing ? <><IconCancel /> Cancel</> : <><Icon360 /> Add 360</>}
              </button>
            )}
            {!isMoving && !isRotating && !isLinking && !isPlacing && (
              <button 
                onClick={() => setIsPlacingProjectLink(!isPlacingProjectLink)}
                style={mapControlButtonStyle(isPlacingProjectLink, '#d32f2f', '#0c8554')}
              >
                {isPlacingProjectLink ? <><IconCancel /> Cancel</> : <><IconPortal /> Add Portal</>}
              </button>
            )}
            {!isPlacing && !isPlacingProjectLink && !isRotating && !isLinking && (
              <button 
                onClick={() => setIsMoving(!isMoving)}
                style={mapControlButtonStyle(isMoving, '#28a745', 'rgba(0,0,0,0.55)')}
              >
                {isMoving ? <><IconCheck /> Done</> : <><IconMove /> Move</>}
              </button>
            )}
            {!isPlacing && !isPlacingProjectLink && !isMoving && !isLinking && (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <button 
                  onClick={() => setIsRotating(!isRotating)}
                  style={mapControlButtonStyle(isRotating, '#28a745', 'rgba(0,0,0,0.55)')}
                >
                  {isRotating ? <><IconCheck /> Done</> : <><IconRotate /> Rotate</>}
                </button>
                {isRotating && selectedSceneId && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      onClick={() => rotateSelectedScene(-5)}
                      style={{ padding: '7px 11px', cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '999px', backdropFilter: 'blur(8px)' }}
                      title="Tourner à gauche"
                    >
                      ◀
                    </button>
                    <button 
                      onClick={() => rotateSelectedScene(5)}
                      style={{ padding: '7px 11px', cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '999px', backdropFilter: 'blur(8px)' }}
                      title="Tourner à droite"
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
                  style={mapControlButtonStyle(isLinking, '#28a745', 'rgba(0,0,0,0.55)')}
                >
                  {isLinking ? <><IconCheck /> Done</> : <><IconPath /> Path</>}
                </button>
                {isLinking && (
                  <button 
                    onClick={() => setIsDeletingPath(!isDeletingPath)}
                    style={mapControlButtonStyle(isDeletingPath, '#d32f2f', 'rgba(0,0,0,0.55)')}
                  >
                    {isDeletingPath ? '✍️ Link' : '🗑️ Delete'}
                  </button>
                )}
              </div>
            )}
            {!isPlacing && !isPlacingProjectLink && !isMoving && !isRotating && !isLinking && (
              <button
                onClick={() => { setIsDeleting(!isDeleting); setDeleteConfirmSceneId(null); }}
                style={mapControlButtonStyle(isDeleting, '#d32f2f', 'rgba(189, 1, 1, 0.76)')}
              >
                {isDeleting ? <><IconCancel /> Cancel</> : <><IconTrash /> Delete</>}
              </button>
            )}
            <input 
              type="file" 
              accept="image/*,video/*" 
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
            center={mapConfig.center ?? [48.8566, 2.3522]}
            zoom={13}
            minZoom={1}
            style={{ height: '100%', width: '100%' }}
            zoomControl={!hideZoomControl}
          >
            {mapRef && <MapRefBridge mapRef={mapRef} />}
            <MapEvents />
            <FitGeoBounds scenes={scenes} isExpanded={isExpanded} />
            <CenterOnSelected />
            {mode === 'editor' && <GeoSearch />}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {scenes.map(scene => (
              <Marker
                key={scene.id}
                position={scene.id === selectedSceneId && travelPos ? travelPos : [scene.position.y, scene.position.x]}
                icon={renderMarkerIcon(scene)}
                draggable={isMoving}
                eventHandlers={{ 
                  click: () => {
                    if (isDeleting) {
                      setDeleteConfirmSceneId(scene.id);
                    } else if (isLinking) {
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
                {!isLinking && !isMoving && !isRotating && !isDeleting && <Popup>{scene.title}</Popup>}
                {isDeleting && deleteConfirmSceneId === scene.id && (
                  <Popup autoClose={false} closeOnClick={false}>
                    <div style={{ fontFamily: 'system-ui, sans-serif', minWidth: '180px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '8px', color: '#d32f2f', fontSize: '0.9rem' }}>
                        🗑️ Supprimer ce point ?
                      </div>
                      <div style={{ fontSize: '0.82rem', marginBottom: '10px', color: '#444' }}>
                        <strong>{scene.title || 'Sans titre'}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => { removeScene(scene.id); setDeleteConfirmSceneId(null); }}
                          style={{ flex: 1, padding: '5px 0', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          Supprimer
                        </button>
                        <button
                          onClick={() => setDeleteConfirmSceneId(null)}
                          style={{ flex: 1, padding: '5px 0', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  </Popup>
                )}
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
          <div className="map-controls" style={{ position: 'absolute', top: 90, left: 10, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {!isMoving && !isRotating && !isLinking && !isPlacingProjectLink && (
              <button 
                onClick={() => setIsPlacing(!isPlacing)}
                style={mapControlButtonStyle(isPlacing, '#d32f2f', '#007acc')}
              >
                {isPlacing ? <><IconCancel /> Cancel</> : <><Icon360 /> Add 360</>}
              </button>
            )}
            {!isMoving && !isRotating && !isLinking && !isPlacing && (
              <button 
                onClick={() => setIsPlacingProjectLink(!isPlacingProjectLink)}
                style={mapControlButtonStyle(isPlacingProjectLink, '#d32f2f', '#9c27b0')}
              >
                {isPlacingProjectLink ? <><IconCancel /> Cancel</> : <><IconPortal /> Add Portal</>}
              </button>
            )}
            {!isPlacing && !isPlacingProjectLink && !isRotating && !isLinking && (
              <button 
                onClick={() => setIsMoving(!isMoving)}
                style={mapControlButtonStyle(isMoving, '#28a745', 'rgba(0,0,0,0.55)')}
              >
                {isMoving ? <><IconCheck /> Done</> : <><IconMove /> Move</>}
              </button>
            )}
            {!isPlacing && !isPlacingProjectLink && !isMoving && !isLinking && (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <button 
                  onClick={() => setIsRotating(!isRotating)}
                  style={mapControlButtonStyle(isRotating, '#28a745', 'rgba(0,0,0,0.55)')}
                >
                  {isRotating ? <><IconCheck /> Done</> : <><IconRotate /> Rotate</>}
                </button>
                {isRotating && selectedSceneId && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      onClick={() => rotateSelectedScene(-5)}
                      style={{ padding: '7px 11px', cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '999px', backdropFilter: 'blur(8px)' }}
                      title="Tourner à gauche"
                    >
                      ◀
                    </button>
                    <button 
                      onClick={() => rotateSelectedScene(5)}
                      style={{ padding: '7px 11px', cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '999px', backdropFilter: 'blur(8px)' }}
                      title="Tourner à droite"
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
                  style={mapControlButtonStyle(isLinking, '#28a745', 'rgba(0,0,0,0.55)')}
                >
                  {isLinking ? <><IconCheck /> Done</> : <><IconPath /> Path</>}
                </button>
                {isLinking && (
                  <button 
                    onClick={() => setIsDeletingPath(!isDeletingPath)}
                    style={mapControlButtonStyle(isDeletingPath, '#d32f2f', 'rgba(0,0,0,0.55)')}
                  >
                    {isDeletingPath ? '✍️ Link' : '🗑️ Delete'}
                  </button>
                )}
              </div>
            )}
            {!isPlacing && !isPlacingProjectLink && !isMoving && !isRotating && !isLinking && (
              <button
                onClick={() => { setIsDeleting(!isDeleting); setDeleteConfirmSceneId(null); }}
                style={mapControlButtonStyle(isDeleting, '#d32f2f', 'rgba(0,0,0,0.55)')}
              >
                {isDeleting ? <><IconCancel /> Cancel</> : <><IconTrash /> Delete</>}
              </button>
            )}
            <input 
              type="file" 
              accept="image/*,video/*" 
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
              accept="image/*,video/*" 
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
