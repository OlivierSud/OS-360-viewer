import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjectStore } from '../state/projectStore';
import SphereViewer from '../components/Viewer/SphereViewer';
import { loadCloudProject } from '../services/cloudflareApi';

const ViewerPage: React.FC = () => {
  const setMode = useProjectStore((state) => state.setMode);
  const setProject = useProjectStore((state) => state.setProject);
  const selectScene = useProjectStore((state) => state.selectScene);
  const [searchParams] = useSearchParams();

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

  return (
    <div className="viewer-layout">
      <SphereViewer />
    </div>
  );
};

export default ViewerPage;
