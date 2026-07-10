import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { useProjectStore } from '../state/projectStore';
import SphereViewer from '../components/Viewer/SphereViewer';
import ProjectMap from '../components/Map/ProjectMap';
import { loadCloudProject } from '../services/cloudflareApi';

const mapBtnStyle: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(0,122,204,0.95)',
  color: 'white',
  cursor: 'pointer',
  fontSize: '1.2rem',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
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

    const loadWithRetry = async (attempt = 1): Promise<void> => {
      try {
        const record = await loadCloudProject(projectId);
        if (cancelled) return;
        setProject(record.project_data);
        selectScene(record.project_data.project.defaultScene ?? record.project_data.scenes[0]?.id ?? null);
        setStatus('ready');
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
            width: '42px',
            height: '42px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(14,14,16,0.85)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1.1rem',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          🗺️
        </button>
      )}

      {/* Mini map overlay: round plan + external controls */}
      {showMap && !mapExpanded && (
        <div
          style={{
            position: 'absolute',
            top: '65px',
            right: '15px',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          {/* External controls (outside the round plan) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={() => setShowMap(false)}
              title="Fermer le plan"
              style={mapBtnStyle}
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
              onClick={() => setMapExpanded(true)}
              title="Agrandir le plan"
              style={mapBtnStyle}
            >
              ⤢
            </button>
          </div>

          {/* Round plan */}
          <div
            style={{
              width: '240px',
              height: '240px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
              background: '#111',
              position: 'relative',
            }}
          >
            <ProjectMap mapRef={mapRef} hideZoomControl />
          </div>
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
          <ProjectMap mapRef={mapRef} hideZoomControl={false} />
          <button
            onClick={() => setMapExpanded(false)}
            title="Réduire le plan"
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 20,
              ...mapBtnStyle,
            }}
          >
            ⤡
          </button>
        </div>
      )}

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
            color: '#ccc',
            fontSize: '1rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Chargement de la visite…
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
