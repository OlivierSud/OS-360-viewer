import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { useProjectStore } from '../state/projectStore';
import SphereViewer from '../components/Viewer/SphereViewer';
import PasswordGate from '../components/Viewer/PasswordGate';
import ProjectMap from '../components/Map/ProjectMap';
import ViewerErrorBoundary from '../components/Viewer/ViewerErrorBoundary';
import { loadCloudProject } from '../services/cloudflareApi';
import { getAccentColor, darkenHex } from '../utils/theme';
import ViewerMinimap, { makeMapBtnStyle } from '../components/Map/ViewerMinimap';

const ViewerPage: React.FC = () => {
  const setMode = useProjectStore((state) => state.setMode);
  const setProject = useProjectStore((state) => state.setProject);
  const selectScene = useProjectStore((state) => state.selectScene);
  const setCurrentProjectId = useProjectStore((state) => state.setCurrentProjectId);
  const project = useProjectStore((state) => state.project);
  const accentColor = getAccentColor(project);
  const accentColorDark = darkenHex(accentColor);
  const mapBtnStyle = makeMapBtnStyle(accentColor, accentColorDark);
  const selectedSceneId = useProjectStore((state) => state.selectedSceneId);
  const scenes = useProjectStore((state) => state.scenes);
  const [searchParams, setSearchParams] = useSearchParams();

  const mapRef = useRef<L.Map | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [status, setStatus] = useState<'loading' | 'password-required' | 'ready' | 'error'>('loading');
  useEffect(() => {
    setMode('viewer');
  }, [setMode]);

  // Handle project link navigation in the viewer
  useEffect(() => {
    if (!selectedSceneId) return;
    const scene = scenes.find((s) => s.id === selectedSceneId);
    if (scene?.type === 'project-link' && scene.targetProjectId) {
      setSearchParams({ id: scene.targetProjectId });
    }
  }, [selectedSceneId, scenes, setSearchParams]);

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
          // A protected project shows the password gate before revealing the tour.
          if (record.project_data.project.passwordHash) {
            setCurrentProjectId(projectId);
            setStatus('password-required');
            return;
          }
          setCurrentProjectId(projectId);
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

  const handleUnlocked = () => {
    const state = useProjectStore.getState();
    const meta = state.project?.project;
    const projectId = searchParams.get('id');
    if (projectId) setCurrentProjectId(projectId);
    selectScene(meta?.defaultScene ?? state.scenes[0]?.id ?? null);
    setStatus('ready');
  };

  return (
    <div className="viewer-layout" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Fullscreen 360 viewer */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000' }}>
        <ViewerErrorBoundary>
          <SphereViewer />
        </ViewerErrorBoundary>
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

       {/* Mini map overlay: round plan pinned top-right, with its
           controls beside it. Reuses the exact same component as the
           properties preview popup so the two are always identical. */}
        {showMap && !mapExpanded && (
          <ViewerMinimap
            mapRef={mapRef}
            accentColor={accentColor}
            accentColorDark={accentColorDark}
            floating
            onClose={() => setShowMap(false)}
            onExpand={() => setMapExpanded(true)}
          />
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
          <ProjectMap 
            key={`expanded-${project?.map?.image ?? 'gps'}`}
            mapRef={mapRef} 
            hideZoomControl={true} 
            mode="viewer"
            fixedMinimapOverride={false}
          />
          
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
            {!project?.map?.fixedMinimap && (
              <>
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
              </>
            )}
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

      {status === 'password-required' && project?.project?.passwordHash && (
        <PasswordGate
          expectedHash={project.project.passwordHash}
          title={project.project.title}
          description={project.project.description}
          splashImage={project.project.splashImage}
          onUnlocked={handleUnlocked}
        />
      )}
    </div>
  );
};

export default ViewerPage;
