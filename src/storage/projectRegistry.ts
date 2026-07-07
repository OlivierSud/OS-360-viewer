/**
 * Multi-project localStorage manager.
 * 
 * Index key  : 'vte_project_index'  → ProjectEntry[]
 * Project key: 'vte_project_<id>'   → serialised Project JSON
 */

export interface ProjectEntry {
  id: string;
  title: string;
  updatedAt: string;
}

const INDEX_KEY = 'vte_project_index';
const projectKey = (id: string) => `vte_project_${id}`;

export function listProjects(): ProjectEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function loadProjectById(id: string): string | null {
  return localStorage.getItem(projectKey(id));
}

export function saveProject(id: string, title: string, data: string): void {
  localStorage.setItem(projectKey(id), data);

  const entries = listProjects();
  const idx = entries.findIndex(e => e.id === id);
  const entry: ProjectEntry = { id, title, updatedAt: new Date().toISOString() };

  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function deleteProject(id: string): void {
  localStorage.removeItem(projectKey(id));
  const entries = listProjects().filter(e => e.id !== id);
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function createProjectId(): string {
  return 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/** One-time migration: if old single-project key exists, import it. */
export function migrateOldProject(): void {
  const OLD_KEY = 'vte_project_data';
  const old = localStorage.getItem(OLD_KEY);
  if (!old) return;

  try {
    const parsed = JSON.parse(old);
    const title: string = parsed?.project?.title ?? 'Projet importé';
    const id = createProjectId();
    saveProject(id, title, old);
    localStorage.removeItem(OLD_KEY);
  } catch {
    // malformed old data – ignore
  }
}
