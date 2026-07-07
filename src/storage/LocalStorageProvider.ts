import type { StorageProvider } from './StorageProvider';

export class LocalStorageProvider implements StorageProvider {
  private static PROJECT_KEY = 'vte_project_data';

  public async loadProjectData(): Promise<string | null> {
    return localStorage.getItem(LocalStorageProvider.PROJECT_KEY);
  }

  public async saveProjectData(data: string): Promise<void> {
    localStorage.setItem(LocalStorageProvider.PROJECT_KEY, data);
  }

  public async uploadAsset(file: File): Promise<string> {
    // In a real V1 offline, we might use IndexedDB to store Blobs.
    // For immediate simple offline support without DB, we can use ObjectURLs,
    // though they don't persist across reloads. 
    // To strictly support persistent offline mode, we would ideally write an IndexedDB provider.
    // For now, this returns a temporary ObjectURL.
    return URL.createObjectURL(file);
  }

  public async deleteAsset(url: string): Promise<void> {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}
