export type HotspotType = 'info' | 'text' | 'image' | 'video' | 'audio' | 'link';

export interface Hotspot {
  id: string;
  type: HotspotType;
  yaw: number;
  pitch: number;
  content: string;
}
