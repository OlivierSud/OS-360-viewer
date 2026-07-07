export interface MapConfig {
  type: 'custom' | 'geographic';
  image?: string;
  width?: number;
  height?: number;
}

export interface ProjectMetadata {
  title: string;
  author?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  defaultScene?: string;
  splashImage?: string;
}

export interface Project {
  version: number;
  project: ProjectMetadata;
  map?: MapConfig;
  scenes: import('./Scene').Scene[];
}
