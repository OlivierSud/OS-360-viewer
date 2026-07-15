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
}
