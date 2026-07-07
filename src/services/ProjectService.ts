import type { Project } from '../models/Project';
import type { StorageProvider } from '../storage/StorageProvider';

export class ProjectService {
  private storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  public async loadProject(): Promise<Project | null> {
    const data = await this.storage.loadProjectData();
    if (!data) return null;
    return this.parseProject(data);
  }

  public async saveProject(project: Project): Promise<void> {
    this.validateProject(project);
    const data = JSON.stringify(project, null, 2);
    await this.storage.saveProjectData(data);
  }

  private parseProject(json: string): Project {
    const parsed = JSON.parse(json);
    if (!parsed.version || !parsed.project || !parsed.scenes) {
      throw new Error('Invalid project.json format');
    }
    return parsed as Project;
  }

  private validateProject(project: Project): void {
    if (!project.version) throw new Error('Missing version');
    if (!project.project) throw new Error('Missing project metadata');
    if (!Array.isArray(project.scenes)) throw new Error('Scenes must be an array');
  }
}
