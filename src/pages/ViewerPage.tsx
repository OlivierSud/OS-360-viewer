import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { useProjectStore } from '../state/projectStore';
import SphereViewer from '../components/Viewer/SphereViewer';
import ProjectMap from '../components/Map/ProjectMap';
import { loadCloudProject } from '../services/cloudflareApi';

const mapBtnStyle: React.CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'linear-gradient(180deg, rgba(0, 136, 255, 0.85) 0%, rgba(0, 85, 204, 0.85) 100%)',
  color: 'white',
  cursor: 'pointer',
  fontSize: '1.3rem',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -1.5px 1px rgba(0,0,0,0.2), 0 0 0 3px rgba(0,122,204,0.35), 0 4px 10px rgba(0,0,0,0.4)',
};

const ViewerPage: React.FC = () => {
  const setMode = useProjectStore((state) => state.setMode);
  const setProject = useProjectStore((state) => state.setProject);
  const selectScene = useProjectStore((state) => state.selectScene);
  const project = useProjectStore((state) => state.project);
  const [searchParams] = useSearchParams();

  const mapRef = useRef<L.Map | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setMode('viewer');
  }, [setMode]);

  useEffect(() => {
    const projectId = searchParams.get('id');
    if (!projectId) {
      setStatus('error');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    const startTime = Date.now();

    const loadWithRetry = async (attempt = 1): Promise<void> => {
      try {
        const record = await loadCloudProject(projectId);
        if (cancelled) return;
        
        // Save the project structure immediately so the 360 viewer loads in the background
        setProject(record.project_data);
        
        const minDuration = (record.project_data.project.splashDuration ?? 0) * 1000;
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minDuration - elapsed);

        setTimeout(() => {
          if (cancelled) return;
          selectScene(record.project_data.project.defaultScene ?? record.project_data.scenes[0]?.id ?? null);
          setStatus('ready');
        }, remaining);
      } catch (err) {
        if (cancelled) return;
        if (attempt < 3) {
          // Transient "Failed to fetch" can happen on first load; retry shortly.
          setTimeout(() => void loadWithRetry(attempt + 1), 500 * attempt);
        } else {
          console.error('Failed to load cloud project', projectId, err);
          setStatus('error');
        }
      }
    };

    void loadWithRetry();
    return () => {
      cancelled = true;
    };
  }, [searchParams, selectScene, setProject]);

  return (
    <div className="viewer-layout" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Fullscreen 360 viewer */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000' }}>
        <SphereViewer />
      </div>

      {/* Title overlay */}
      {project?.project?.title && (
        <div
          style={{
            position: 'absolute',
            top: '15px',
            left: '15px',
            zIndex: 1000,
            background: 'rgba(14,14,16,0.8)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '8px 14px',
            color: 'white',
            fontSize: '0.95rem',
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            maxWidth: '50vw',
          }}
        >
          {project.project.title}
        </div>
      )}

      {/* Reopen map button (shown only when the map is hidden) */}
      {!showMap && (
        <button
          onClick={() => setShowMap(true)}
          title="Afficher le plan"
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            zIndex: 1100,
            ...mapBtnStyle,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
          </svg>
        </button>
      )}

      {/* Mini map overlay: round plan + controls at constant radius */}
      {showMap && !mapExpanded && (
        <div
          style={{
            position: 'absolute',
            top: '65px',
            right: '35px', // Spaced to prevent floating buttons on the right from clipping
            zIndex: 1050,
            width: '320px',
            height: '320px',
          }}
        >
          {/* Circular map container (320px x 320px) */}
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3), 0 0 0 3px rgba(0,122,204,0.35), 0 12px 36px rgba(0,0,0,0.45)',
              background: '#111',
            }}
          >
            <ProjectMap mapRef={mapRef} hideZoomControl isExpanded={false} />
          </div>

          {/* Floating buttons (44px) at constant radius of 198px from center (160px, 160px) to prevent touching */}
          
          {/* 1. Zoom + (Left, 150deg) */}
          <button
            onClick={() => mapRef.current?.zoomIn()}
            title="Zoom avant"
            style={{
              ...mapBtnStyle,
              position: 'absolute',
              left: '-34px',
              top: '39px',
              zIndex: 1100,
            }}
          >
            +
          </button>

          {/* 2. Zoom - (Left, 170deg) */}
          <button
            onClick={() => mapRef.current?.zoomOut()}
            title="Zoom arrière"
            style={{
              ...mapBtnStyle,
              position: 'absolute',
              left: '-57px',
              top: '104px',
              zIndex: 1100,
            }}
          >
            −
          </button>

          {/* 3. Recentrer (Left, 190deg) */}
          <button
            onClick={() => {
              const state = useProjectStore.getState();
              const activeScene = state.scenes.find(s => s.id === state.selectedSceneId);
              if (activeScene && mapRef.current) {
                mapRef.current.panTo([activeScene.position.y, activeScene.position.x]);
              }
            }}
            title="Recentrer sur le viewpoint actif"
            style={{
              ...mapBtnStyle,
              position: 'absolute',
              left: '-57px',
              top: '173px',
              zIndex: 1100,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C8.5 2 5.5 5 5.5 8.5c0 4.5 6.5 10 6.5 10s6.5-5.5 6.5-10C18.5 5 15.5 2 12 2zm0 10c-1.93 0-3.5-1.57-3.5-3.5S10.07 5 12 5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="currentColor" stroke="none" />
              <ellipse cx="12" cy="20" rx="6" ry="2" stroke="currentColor" stroke-width="2" fill="none" />
            </svg>
          </button>

          {/* 4. Agrandir (Left, 210deg) */}
          <button
            onClick={() => setMapExpanded(true)}
            title="Agrandir le plan"
            style={{
              ...mapBtnStyle,
              position: 'absolute',
              left: '-34px',
              top: '237px',
              zIndex: 1100,
            }}
          >
            ⤢
          </button>

          {/* 5. Fermer (✕) (Top-Right, 40deg) */}
          <button
            onClick={() => setShowMap(false)}
            title="Fermer le plan"
            style={{
              ...mapBtnStyle,
              position: 'absolute',
              left: '290px',
              top: '11px',
              zIndex: 1100,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Expanded map overlay (rectangular, full screen) */}
      {showMap && mapExpanded && (
        <div
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            bottom: '15px',
            left: '15px',
            zIndex: 1050,
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
            background: '#111',
          }}
        >
          <ProjectMap mapRef={mapRef} hideZoomControl={true} isExpanded={true} />
          
          {/* Controls column inside the expanded map */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 1100,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <button
              onClick={() => {
                setShowMap(false);
                setMapExpanded(false);
              }}
              title="Fermer le plan"
              style={{
                ...mapBtnStyle,
                borderRadius: '50%',
              }}
            >
              ✕
            </button>
            <button
              onClick={() => mapRef.current?.zoomIn()}
              title="Zoom avant"
              style={mapBtnStyle}
            >
              +
            </button>
            <button
              onClick={() => mapRef.current?.zoomOut()}
              title="Zoom arrière"
              style={mapBtnStyle}
            >
              −
            </button>
            <button
              onClick={() => {
                const state = useProjectStore.getState();
                const activeScene = state.scenes.find(s => s.id === state.selectedSceneId);
                if (activeScene && mapRef.current) {
                  mapRef.current.panTo([activeScene.position.y, activeScene.position.x]);
                }
              }}
              title="Recentrer sur le viewpoint actif"
              style={mapBtnStyle}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2C8.5 2 5.5 5 5.5 8.5c0 4.5 6.5 10 6.5 10s6.5-5.5 6.5-10C18.5 5 15.5 2 12 2zm0 10c-1.93 0-3.5-1.57-3.5-3.5S10.07 5 12 5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="currentColor" stroke="none" />
                <ellipse cx="12" cy="20" rx="6" ry="2" stroke="currentColor" stroke-width="2" fill="none" />
              </svg>
            </button>
            <button
              onClick={() => setMapExpanded(false)}
              title="Réduire le plan"
              style={mapBtnStyle}
            >
              ⤡
            </button>
          </div>
        </div>
      )}

      {/* Status overlays */}
      {/* Status overlays */}
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {project?.project?.splashImage ? (
            <>
              {/* Fullscreen Background Splash Image */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${project.project.splashImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'brightness(0.5)',
                  zIndex: -1,
                }}
              />
              
              {/* Center Content Card */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '20px',
                  textAlign: 'center',
                  padding: '40px',
                  background: 'rgba(20,20,22,0.75)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  maxWidth: '90%',
                  width: '420px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
                }}
              >
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
                  {project.project.title}
                </h1>
                {project.project.description && (
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc', lineHeight: 1.4 }}>
                    {project.project.description}
                  </p>
                )}
                
                {/* 3D themed Spinner & Loading Label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                  <div className="splash-spinner" />
                  <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 500 }}>
                    Chargement de la visite…
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div className="splash-spinner" />
              <span style={{ fontSize: '0.95rem', color: '#bbb' }}>Chargement de la visite…</span>
            </div>
          )}
        </div>
      )}
      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: '#111',
            color: '#ddd',
            fontSize: '1rem',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            padding: '20px',
          }}
        >
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <span>Projet introuvable ou lien invalide.</span>
        </div>
      )}
    </div>
  );
};

export default ViewerPage;
