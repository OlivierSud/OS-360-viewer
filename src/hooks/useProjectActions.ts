import { useCallback, useState } from 'react';
import { createProjectId } from '../storage/projectRegistry';
import { listCloudProjects, loadCloudProject, type CloudProjectEntry } from '../services/cloudflareApi';
import { useProjectStore } from '../state/projectStore';
import type { Project } from '../models/Project';

interface LockedProject {
  id: string;
  data: Project;
}

/**
 * Regroups the project open / create / cloud-list logic shared between the
 * editor landing screen and the toolbar dropdown. Handles the password gate
 * state so both entry points behave consistently.
 */
export function useProjectActions() {
  const storeProject = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);
  const selectScene = useProjectStore((s) => s.selectScene);

  const [cloudProjects, setCloudProjects] = useState<CloudProjectEntry[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [lockedProject, setLockedProject] = useState<LockedProject | null>(null);

  const refreshCloudList = useCallback(async (): Promise<CloudProjectEntry[]> => {
    setIsBusy(true);
    try {
      const entries = await listCloudProjects();
      setCloudProjects(entries);
      setSyncStatus(null);
      return entries;
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Cloudflare indisponible');
      return [];
    } finally {
      setIsBusy(false);
    }
  }, []);

  const createAndOpen = useCallback(() => {
    const id = createProjectId();
    const blank: Project = {
      version: 1,
      project: { title: 'Nouveau Projet', createdAt: new Date().toISOString() },
      scenes: [],
    };
    setProject(blank);
    setCurrentProjectId(id);
    setSyncStatus('Nouveau projet prêt à enregistrer sur Cloudflare');
    return id;
  }, [setCurrentProjectId, setProject]);

  // Opens a cloud project. Returns true when the project is password-locked
  // (so the caller can keep its UI open and show the gate).
  const openCloudProject = useCallback(async (id: string): Promise<boolean> => {
    setIsBusy(true);
    try {
      const record = await loadCloudProject(id);
      if (record.project_data.project.passwordHash) {
        setLockedProject({ id, data: record.project_data });
        return true;
      }
      applyProject(record.project_data, id, setProject, selectScene, setCurrentProjectId);
      setSyncStatus('Projet chargé depuis Cloudflare');
      return false;
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Chargement cloud impossible');
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [selectScene, setCurrentProjectId, setProject]);

  const unlockLockedProject = useCallback(() => {
    if (!lockedProject) return;
    const { id, data } = lockedProject;
    applyProject(data, id, setProject, selectScene, setCurrentProjectId);
    setLockedProject(null);
    setSyncStatus('Projet chargé depuis Cloudflare');
  }, [lockedProject, selectScene, setCurrentProjectId, setProject]);

  return {
    storeProject,
    cloudProjects,
    isBusy,
    syncStatus,
    setSyncStatus,
    lockedProject,
    setLockedProject,
    refreshCloudList,
    createAndOpen,
    openCloudProject,
    unlockLockedProject,
  };
}

function applyProject(
  data: Project,
  id: string,
  setProject: (p: Project) => void,
  selectScene: (id: string | null) => void,
  setCurrentProjectId: (id: string | null) => void,
) {
  setProject(data);
  selectScene(data.project.defaultScene ?? data.scenes[0]?.id ?? null);
  setCurrentProjectId(id);
}
