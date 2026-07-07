export interface StorageProvider {
  loadProjectData(): Promise<string | null>;
  saveProjectData(data: string): Promise<void>;
  uploadAsset(file: File): Promise<string>; // Returns the URL to the asset
  deleteAsset(url: string): Promise<void>;
}
