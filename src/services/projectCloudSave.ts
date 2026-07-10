import { useProjectStore } from '../state/projectStore';
import { uploadProjectAssetsToR2 } from './projectAssetUpload';
import { saveCloudProject, createViewerUrl } from './cloudflareApi';
import { createProjectId } from '../storage/projectRegistry';
import type { Project } from '../models/Project';

/**
 * Ensures the current editor project is saved to Cloudflare (with all media
 * uploaded to R2) and returns its cloud id. If the project has no id yet, a new
 * one is generated. This guarantees any viewer link points to valid cloud data.
 */
export async function saveCurrentProjectToCloud(): Promise<string> {
  const state = useProjectStore.getState();
  const project = state.project;
  if (!project) throw new Error('Aucun projet à enregistrer');

  const id = state.currentProjectId ?? createProjectId();
  const updated: Project = {
    ...project,
    project: { ...project.project, updatedAt: new Date().toISOString() },
  };

  const withAssets = await uploadProjectAssetsToR2(updated, id);
  await saveCloudProject({ id, project: withAssets });

  useProjectStore.getState().setProject(withAssets);
  useProjectStore.getState().setCurrentProjectId(id);

  return id;
}

/** Saves the project (uploading assets) and returns a shareable viewer URL. */
export async function getViewerUrlForCurrentProject(): Promise<string> {
  const id = await saveCurrentProjectToCloud();
  return createViewerUrl(id);
}
