/**
 * Mutable storage service for managing clay project references
 * Inspired by IrysDune's mutable reference system
 */

interface MutableReference {
  projectId: string;
  rootTxId: string;
  latestTxId: string;
  projectName: string;
  updatedAt: number;
  author: string;
}

interface CurrentProject {
  projectId: string;
  rootTxId?: string;
  name: string;
  isDirty: boolean;
}

const STORAGE_KEY = 'clay-mutable-refs';
const CURRENT_PROJECT_KEY = 'clay-current-project';

/**
 * Get all mutable references from local storage
 */
export function getAllMutableReferences(): Record<string, MutableReference> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('[MutableStorage] Error reading references:', error);
    return {};
  }
}

/**
 * Save a mutable reference
 */
export function saveMutableReference(
  projectId: string,
  rootTxId: string,
  latestTxId: string,
  projectName: string,
  author: string
): void {
  try {
    const refs = getAllMutableReferences();
    refs[projectId] = {
      projectId,
      rootTxId,
      latestTxId,
      projectName,
      updatedAt: Date.now(),
      author
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(refs));
    console.log(`[MutableStorage] Saved reference for project ${projectId}: root=${rootTxId}, latest=${latestTxId}`);
  } catch (error) {
    console.error('[MutableStorage] Error saving reference:', error);
  }
}

/**
 * Get a specific mutable reference
 */
export function getMutableReference(projectId: string): MutableReference | null {
  const refs = getAllMutableReferences();
  return refs[projectId] || null;
}

/**
 * Delete a mutable reference
 */
export function deleteMutableReference(projectId: string): void {
  try {
    const refs = getAllMutableReferences();
    delete refs[projectId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(refs));
    console.log(`[MutableStorage] Deleted reference for project ${projectId}`);
  } catch (error) {
    console.error('[MutableStorage] Error deleting reference:', error);
  }
}

/**
 * Get the currently open project
 */
export function getCurrentProject(): CurrentProject | null {
  try {
    const stored = localStorage.getItem(CURRENT_PROJECT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('[MutableStorage] Error reading current project:', error);
    return null;
  }
}

/**
 * Set the currently open project
 */
export function setCurrentProject(project: CurrentProject | null, silent: boolean = false): void {
  try {
    if (project) {
      localStorage.setItem(CURRENT_PROJECT_KEY, JSON.stringify(project));
      if (!silent) {
        console.log(`[MutableStorage] Set current project: ${project.projectId} (${project.name})`);
      }
    } else {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
      if (!silent) {
        console.log('[MutableStorage] Cleared current project');
      }
    }
  } catch (error) {
    console.error('[MutableStorage] Error setting current project:', error);
  }
}

/**
 * Mark the current project as dirty (modified)
 */
export function markProjectDirty(isDirty: boolean = true): void {
  const current = getCurrentProject();
  if (current) {
    current.isDirty = isDirty;
    setCurrentProject(current);
  }
}

/**
 * Check if there's an existing project with the same name for the current user
 */
export function findProjectByName(projectName: string, author: string): MutableReference | null {
  const refs = getAllMutableReferences();
  return Object.values(refs).find(
    ref => ref.projectName === projectName && ref.author === author
  ) || null;
}

/**
 * Generate a unique project ID
 */
export function generateProjectId(): string {
  return `clay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
