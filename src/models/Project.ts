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
  /** Couleur d'accent du viewer (boutons de la carte, liens, hotspots info).
   *  Bleu par défaut si non renseigné. */
  accentColor?: string;
  /** Piste audio jouée pour tout le projet (sauf si un viewpoint en a sa propre). */
  audio?: string;
}

export interface Project {
  version: number;
  project: ProjectMetadata;
  map?: MapConfig;
  scenes: import('./Scene').Scene[];
}
