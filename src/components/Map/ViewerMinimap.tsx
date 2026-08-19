import React from 'react';
import L from 'leaflet';
import { useProjectStore } from '../../state/projectStore';
import ProjectMap from './ProjectMap';

/* Shared circular/rectangular minimap used both in the viewer (top-right
   floating) and in the properties preview popup. Keeps the shape, proportions,
   accents and side control buttons perfectly identical in both places. */
export const makeMapBtnStyle = (accent: string, accentDark: string): React.CSSProperties => ({
  width: '44px',
  height: '44px',
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.12)',
  background: `linear-gradient(180deg, ${accent} 0%, ${accentDark} 100%)`,
  color: 'white',
  cursor: 'pointer',
  fontSize: '1.3rem',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: `inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -1.5px 1px rgba(0,0,0,0.2), 0 0 0 3px ${accent}59, 0 4px 10px rgba(0,0,0,0.4)`,
});

export interface MinimapView {
  zoom: number;
  center: [number, number];
}

interface ViewerMinimapProps {
  mapRef: React.MutableRefObject<L.Map | null>;
  accentColor: string;
  accentColorDark: string;
  /** Viewer mode: floating, pinned top-right. Otherwise rendered inline (modal). */
  floating?: boolean;
  /** Show the ✕ close button (calls onClose). */
  onClose?: () => void;
  /** Show the ⤢ expand button (calls onExpand). */
  onExpand?: () => void;
  /** Preview mode: map stays interactive (pan/zoom) even when fixed, and reports
   *  its current view via onViewChange so it can be recorded. */
  previewMode?: boolean;
  onViewChange?: (view: MinimapView) => void;
}

const RecenterIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C8.5 2 5.5 5 5.5 8.5c0 4.5 6.5 10 6.5 10s6.5-5.5 6.5-10C18.5 5 15.5 2 12 2zm0 10c-1.93 0-3.5-1.57-3.5-3.5S10.07 5 12 5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="currentColor" stroke="none" />
    <ellipse cx="12" cy="20" rx="6" ry="2" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const ViewerMinimap: React.FC<ViewerMinimapProps> = ({
  mapRef,
  accentColor,
  accentColorDark,
  floating = true,
  onClose,
  onExpand,
  previewMode = false,
  onViewChange,
}) => {
  const project = useProjectStore((state) => state.project);
  const mapBtnStyle = makeMapBtnStyle(accentColor, accentColorDark);

  const isCustomMap =
    project?.map?.type === 'custom' &&
    Boolean(project?.map?.image) &&
    Boolean(project?.map?.width && project?.map?.height);
  const minimapShape = project?.map?.minimapShape ?? 'round';
  const imgW = project?.map?.width || 1;
  const imgH = project?.map?.height || 1;
  const fixedMinimap = Boolean(project?.map?.fixedMinimap);
  // In preview the map must stay pannable/zoomable so the view can be chosen,
  // even when the "fixed map" option is enabled.
  const interactive = previewMode || !fixedMinimap;

  const mapContainerStyle: React.CSSProperties = {
    position: 'relative',
    border: '1px solid rgba(255,255,255,0.18)',
    overflow: 'hidden',
    boxShadow: `inset 0 1px 3px rgba(0,0,0,0.3), 0 0 0 3px ${accentColor}59, 0 12px 36px rgba(0,0,0,0.45)`,
    background: '#111',
  };

  if (!isCustomMap || minimapShape === 'round') {
    // Round map (or GPS) -> strict 1:1 ratio (perfect circle)
    mapContainerStyle.width = 'min(40vw, 40vh, 320px)';
    mapContainerStyle.height = 'min(40vw, 40vh, 320px)';
    mapContainerStyle.borderRadius = '50%';
  } else {
    // Rectangular map -> exact imported image ratio
    mapContainerStyle.aspectRatio = `${imgW} / ${imgH}`;
    mapContainerStyle.borderRadius = '14px';
    if (imgW >= imgH) {
      mapContainerStyle.width = 'min(42vw, 340px)';
    } else {
      mapContainerStyle.height = 'min(38vh, 320px)';
    }
  }

  const handleRecenter = () => {
    const state = useProjectStore.getState();
    const activeScene = state.scenes.find((s) => s.id === state.selectedSceneId);
    if (activeScene && mapRef.current) {
      mapRef.current.panTo([activeScene.position.y, activeScene.position.x]);
    }
  };

  const wrapperStyle: React.CSSProperties = floating
    ? {
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }
    : {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      };

  return (
    <div className={floating ? 'viewer-minimap' : undefined} style={wrapperStyle}>
      {/* Vertical control buttons column to the LEFT of the minimap */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'center',
          zIndex: 1100,
        }}
      >
        {onClose && (
          <button className="mm-btn mm-close" onClick={onClose} title="Fermer le plan" style={mapBtnStyle}>
            ✕
          </button>
        )}
        {onExpand && (
          <button className="mm-btn mm-expand" onClick={onExpand} title="Agrandir le plan" style={mapBtnStyle}>
            ⤢
          </button>
        )}
        {interactive && (
          <>
            <button
              className="mm-btn mm-zoom-in"
              onClick={() => mapRef.current?.zoomIn()}
              title="Zoom avant"
              style={mapBtnStyle}
            >
              +
            </button>
            <button
              className="mm-btn mm-zoom-out"
              onClick={() => mapRef.current?.zoomOut()}
              title="Zoom arrière"
              style={mapBtnStyle}
            >
              −
            </button>
            <button className="mm-btn mm-recenter" onClick={handleRecenter} title="Recentrer sur le viewpoint actif" style={mapBtnStyle}>
              <RecenterIcon />
            </button>
          </>
        )}
      </div>

      {/* Map container matching image ratio or circular for GPS */}
      <div style={mapContainerStyle}>
        <ProjectMap
          key={`minimap-${project?.map?.image ?? 'gps'}`}
          mapRef={mapRef}
          hideZoomControl
          mode="viewer"
          forceInteractive={previewMode}
          onViewChange={previewMode ? onViewChange : undefined}
        />
      </div>
    </div>
  );
};

export default ViewerMinimap;
