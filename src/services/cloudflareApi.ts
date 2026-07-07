import type { Project } from '../models/Project';

export const CLOUDFLARE_API_URL =
  import.meta.env.VITE_CLOUDFLARE_API_URL ?? 'https://os360-api.olivier0411.workers.dev';
const LEGACY_R2_PUBLIC_ORIGIN = 'https://pub-8992e41086d04520b3b67be8ab99bc15.r2.dev';

export interface CloudProjectEntry {
  id: string;
  title: string;
  author?: string | null;
  description?: string | null;
  splash_url?: string | null;
  updated_at: string;
}

export interface CloudProjectRecord extends CloudProjectEntry {
  project_data: Project;
  created_at?: string;
}

interface SaveProjectPayload {
  id: string;
  project: Project;
}

const apiUrl = (path: string): string => `${CLOUDFLARE_API_URL}${path}`;

function normalizeCloudAssetUrl(url: string | undefined): string | undefined {
  if (!url?.startsWith(LEGACY_R2_PUBLIC_ORIGIN)) return url;

  const assetUrl = new URL(url);
  return apiUrl(`/assets${assetUrl.pathname}`);
}

function normalizeProjectAssetUrls(project: Project): Project {
  const normalizedProject: Project = structuredClone(project);

  normalizedProject.project.splashImage = normalizeCloudAssetUrl(normalizedProject.project.splashImage);

  if (normalizedProject.map?.image) {
    normalizedProject.map.image = normalizeCloudAssetUrl(normalizedProject.map.image);
  }

  normalizedProject.scenes = normalizedProject.scenes.map((scene) => ({
    ...scene,
    image: normalizeCloudAssetUrl(scene.image) ?? scene.image,
    thumbnail: normalizeCloudAssetUrl(scene.thumbnail) ?? scene.thumbnail,
    hotspots: (scene.hotspots ?? []).map((hotspot) => ({
      ...hotspot,
      content: normalizeCloudAssetUrl(hotspot.content) ?? hotspot.content,
    })),
  }));

  return normalizedProject;
}

export function createViewerUrl(projectId: string): string {
  const basePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  return `${window.location.origin}${basePath}viewer?id=${encodeURIComponent(projectId)}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data && typeof data.error === 'string' ? data.error : 'Erreur Cloudflare';
    throw new Error(message);
  }

  return data as T;
}

export async function listCloudProjects(): Promise<CloudProjectEntry[]> {
  const response = await fetch(apiUrl('/api/projects'));
  return parseJsonResponse<CloudProjectEntry[]>(response);
}

export async function loadCloudProject(id: string): Promise<CloudProjectRecord> {
  const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(id)}`));
  const record = await parseJsonResponse<CloudProjectRecord>(response);
  return {
    ...record,
    project_data: normalizeProjectAssetUrls(record.project_data),
  };
}

export async function saveCloudProject({ id, project }: SaveProjectPayload): Promise<void> {
  const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: project.project.title,
      author: project.project.author,
      description: project.project.description,
      splash_url: project.project.splashImage,
      project_data: project,
    }),
  });

  await parseJsonResponse<{ ok: true }>(response);
}

export async function deleteCloudProject(id: string): Promise<void> {
  const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });

  await parseJsonResponse<{ ok: true }>(response);
}

export async function uploadCloudAsset(file: File, folder: string, filename?: string): Promise<string> {
  const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
  const safeFilename = encodePath(filename ?? file.name);
  const safeFolder = encodePath(folder);
  const response = await fetch(apiUrl(`/api/upload/${safeFolder}/${safeFilename}`), {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  const data = await parseJsonResponse<{ ok: true; url: string }>(response);
  return data.url;
}
