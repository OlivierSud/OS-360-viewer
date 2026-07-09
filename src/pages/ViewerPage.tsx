import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjectStore } from '../state/projectStore';
import SphereViewer from '../components/Viewer/SphereViewer';
import ProjectMap from '../components/Map/ProjectMap';
import { loadCloudProject } from '../services/cloudflareApi';

type LayoutState = 'viewer-max' | 'split' | 'map-max';
const ChevronIcon = ({ direction }: { direction: 'up' | 'down' }) => (
  <svg width="40" height="24" viewBox="0 0 40 24" style={{ filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.8))' }}>
    <path
      d={direction === 'down' ? 'M4 4 L20 18 L36 4' : 'M4 20 L20 6 L36 20'}
      fill="rgba(255,255,255,0.2)"
      stroke="white"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ViewerPage: React.FC = () => {
  const setMode = useProjectStore((state) => state.setMode);
  const setProject = useProjectStore((state) => state.setProject);
  const selectScene = useProjectStore((state) => state.selectScene);
  const [searchParams] = useSearchParams();

  const [layout, setLayout] = useState<LayoutState>('split');
  const [viewerHeight, setViewerHeight] = useState(60); // percent
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode('viewer');
  }, [setMode]);

  useEffect(() => {
    const projectId = searchParams.get('id');
    if (!projectId) return;

    void loadCloudProject(projectId).then((record) => {
      setProject(record.project_data);
      selectScene(record.project_data.project.defaultScene ?? record.project_data.scenes[0]?.id ?? null);
    });
  }, [searchParams, selectScene, setProject]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      let percentage = (relativeY / rect.height) * 100;
      percentage = Math.max(15, Math.min(85, percentage));
      setViewerHeight(percentage);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const getHeights = () => {
    if (layout === 'viewer-max') return { viewer: '100%', map: '0%' };
    if (layout === 'map-max') return { viewer: '0%', map: '100%' };
    return { viewer: `${viewerHeight}%`, map: `${100 - viewerHeight}%` };
  };

  const heights = getHeights();
  const showSplitControls = layout === 'split';

  return (
    <div className="viewer-layout">
      <div
        ref={containerRef}
        className="editor-center"
        style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}
      >
        {/* Top Pane: 360 Viewer */}
        <div
          style={{
            height: heights.viewer,
            transition: isDragging ? 'none' : 'height 0.4s ease-in-out',
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <SphereViewer />
          <button
            onClick={() => setLayout(layout === 'viewer-max' ? 'split' : 'viewer-max')}
            style={{
              position: 'absolute',
              bottom: showSplitControls ? '25px' : '15px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '10px',
              display: layout === 'map-max' ? 'none' : 'block',
            }}
            title={layout === 'viewer-max' ? 'Restaurer la carte' : 'Agrandir le panorama 360'}
          >
            <ChevronIcon direction={layout === 'viewer-max' ? 'up' : 'down'} />
          </button>
        </div>

        {/* Interactive Drag Splitter Bar */}
        {showSplitControls && (
          <div
            onMouseDown={startDrag}
            style={{
              height: '8px',
              width: '100%',
              backgroundColor: '#333',
              cursor: 'row-resize',
              position: 'relative',
              zIndex: 1005,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              borderTop: '1px solid #444',
              borderBottom: '1px solid #222',
              boxShadow: '0 0 5px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: '#888',
                borderRadius: '2px',
                pointerEvents: 'none',
              }}
            />
          </div>
        )}

        {/* Bottom Pane: Project Map */}
        <div
          style={{
            height: heights.map,
            transition: isDragging ? 'none' : 'height 0.4s ease-in-out',
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <ProjectMap />
          <button
            onClick={() => setLayout(layout === 'map-max' ? 'split' : 'map-max')}
            style={{
              position: 'absolute',
              top: showSplitControls ? '25px' : '15px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '10px',
              display: layout === 'viewer-max' ? 'none' : 'block',
            }}
            title={layout === 'map-max' ? 'Restaurer le panorama 360' : 'Agrandir la carte'}
          >
            <ChevronIcon direction={layout === 'map-max' ? 'down' : 'up'} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewerPage;
