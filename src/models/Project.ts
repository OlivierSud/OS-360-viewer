export interface MapConfig {
  type: 'custom' | 'geographic';
  image?: string;
  width?: number;
  height?: number;
  center?: [number, number];
  fixedMinimap?: boolean;
  minimapShape?: 'round' | 'rectangular';
  /** Couleur des markers de viewpoint sur la minimap (points de la carte).
   *  Orange par défaut si non renseignée. N'affecte pas les liens de projet
   *  ni les indicateurs de lien en cours (verts/violets). */
  viewpointColor?: string;
  /** Couleur du viewpoint actif (sélectionné / viewpoint courant) sur la
   *  minimap. Bleu par défaut si non renseignée. */
  activeViewpointColor?: string;
  /** Vue enregistrée de la minimap (viewer) : zoom + centre [lat, lng] pour le
   *  mode géographique, [y, x] pour le plan personnalisé. Utilisée comme vue
   *  initiale si la carte est libre, ou comme vue verrouillée si carte fixe. */
  minimapView?: { zoom: number; center: [number, number] };
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
  /** Pista audio jouée pour tout le projet (sauf si un viewpoint en a sa propre). */
  audio?: string;
  /** Active le mode VR sur mobile (gyroscope + bouton plein écran VR). */
  enableVR?: boolean;
}

export interface Project {
  version: number;
  project: ProjectMetadata;
  map?: MapConfig;
  scenes: import('./Scene').Scene[];
}
