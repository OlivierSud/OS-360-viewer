import type { Project } from '../models/Project';
import { getTrackedFile } from './mediaRegistry';
import { uploadCloudAsset } from './cloudflareApi';

type AssetKind = 'splash' | 'map' | 'panoramas' | 'thumbs' | 'hotspots' | 'audio';

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();

  const fromType = file.type.split('/').pop();
  return fromType || 'bin';
}

function safeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'asset';
}

async function uploadIfNeeded(url: string | undefined, projectId: string, kind: AssetKind, name: string): Promise<string | undefined> {
  const file = getTrackedFile(url);
  if (!file) return url;

  const filename = `${safeName(name)}.${extensionFor(file)}`;
  return uploadCloudAsset(file, `projects/${projectId}/${kind}`, filename);
}

export async function uploadProjectAssetsToR2(project: Project, projectId: string): Promise<Project> {
  const uploadedProject: Project = structuredClone(project);

  uploadedProject.project.splashImage = await uploadIfNeeded(
    uploadedProject.project.splashImage,
    projectId,
    'splash',
    'splash'
  );

  if (uploadedProject.map?.image) {
    uploadedProject.map.image = await uploadIfNeeded(
      uploadedProject.map.image,
      projectId,
      'map',
      'map'
    );
  }

  uploadedProject.project.audio = await uploadIfNeeded(
    uploadedProject.project.audio,
    projectId,
    'audio',
    'project-audio'
  );

  uploadedProject.scenes = await Promise.all(
    uploadedProject.scenes.map(async (scene) => {
      const image = await uploadIfNeeded(scene.image, projectId, 'panoramas', scene.id);
      const thumbnail = scene.thumbnail === scene.image
        ? image
        : await uploadIfNeeded(scene.thumbnail, projectId, 'thumbs', `${scene.id}-thumb`);
      const hotspots = await Promise.all(
        (scene.hotspots ?? []).map(async (hotspot) => {
          if (hotspot.type !== 'image' && hotspot.type !== 'video') return hotspot;

          const content = await uploadIfNeeded(
            hotspot.content,
            projectId,
            'hotspots',
            `${scene.id}-${hotspot.id}`
          );

          return {
            ...hotspot,
            content: content ?? hotspot.content,
          };
        })
      );

      const audio = await uploadIfNeeded(
        scene.audio,
        projectId,
        'audio',
        `${scene.id}-audio`
      );

      const video = await uploadIfNeeded(
        scene.video,
        projectId,
        'panoramas',
        `${scene.id}-video`
      );
      console.log('[upload] video for', scene.id, {
        hadVideo: Boolean(scene.video),
        tracked: Boolean(getTrackedFile(scene.video)),
        result: video,
      });

      return {
        ...scene,
        image: image ?? scene.image,
        thumbnail: thumbnail ?? scene.thumbnail,
        video: video ?? scene.video,
        audio: audio ?? scene.audio,
        hotspots,
      };
    })
  );

  return uploadedProject;
}
