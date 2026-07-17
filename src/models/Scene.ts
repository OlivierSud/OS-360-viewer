import type { Link } from './Link';
import type { Hotspot } from './Hotspot';

export interface ScenePosition {
  x: number;
  y: number;
}

export interface Scene {
  id: string;
  title: string;
  image: string; // URL only
  thumbnail: string; // URL only
  position: ScenePosition;
  north: number;
  links: Link[];
  hotspots: Hotspot[];
  showTitleInViewer?: boolean;
  type?: 'scene' | 'project-link';
  targetProjectId?: string;
  audio?: string; // URL of an audio track played when this viewpoint loads
  video?: string; // URL of a 360° video used as the panorama instead of an image
}
