export interface MapConfig {
  type: 'custom' | 'geographic';
  image?: string;
  width?: number;
  height?: number;
  center?: [number, number];
}

export interface ProjectMetadata {
  title: string;
  author?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  defaultScene?: string;
  splashImage?: string;
  splashDuration?: number;
  /** SHA-256 hash du mot de passe. Absent ou vide = projet sans protection. */
  passwordHash?: string;
}

export interface Project {
  version: number;
  project: ProjectMetadata;
  map?: MapConfig;
  scenes: import('./Scene').Scene[];
}
