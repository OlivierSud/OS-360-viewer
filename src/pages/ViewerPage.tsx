import React, { useEffect } from 'react';
import { useProjectStore } from '../state/projectStore';
import SphereViewer from '../components/Viewer/SphereViewer';

const ViewerPage: React.FC = () => {
  const setMode = useProjectStore((state) => state.setMode);

  useEffect(() => {
    setMode('viewer');
  }, [setMode]);

  return (
    <div className="viewer-layout">
      <SphereViewer />
    </div>
  );
};

export default ViewerPage;
