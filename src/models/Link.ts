export interface Link {
  target: string; // Target scene ID
  yaw: number;
  pitch: number;
  isCustom?: boolean; // Whether the link marker position was custom-dragged in 360
  customYaw?: number;
  customPitch?: number;
}
