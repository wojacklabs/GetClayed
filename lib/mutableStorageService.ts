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
 * FIX P1-8: Handles localStorage quota exceeded with automatic cleanup
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
    
    // FIX P1-8: Auto-cleanup if too many references (limit to 100)
    const refArray = Object.values(refs);
    if (refArray.length >= 100) {
      console.log('[MutableStorage] Reference limit reached, cleaning up old references...');
      // Sort by updatedAt and keep only the most recent 80
      refArray.sort((a, b) => a.updatedAt - b.updatedAt);
      const toDelete = refArray.slice(0, 20);
      toDelete.forEach(ref => delete refs[ref.projectId]);
      console.log(`[MutableStorage] Cleaned up ${toDelete.length} old references`);
    }
    
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
    // FIX P1-8: Handle quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('[MutableStorage] Storage quota exceeded, forcing cleanup...');
      try {
        const refs = getAllMutableReferences();
        const refArray = Object.values(refs).sort((a, b) => a.updatedAt - b.updatedAt);
        const toKeep = refArray.slice(-50); // Keep only most recent 50
        
        const newRefs: Record<string, MutableReference> = {};
        toKeep.forEach(ref => newRefs[ref.projectId] = ref);
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newRefs));
        
        // Try to save current project again
        newRefs[projectId] = {
          projectId,
          rootTxId,
          latestTxId,
          projectName,
          updatedAt: Date.now(),
          author
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newRefs));
        console.log('[MutableStorage] Successfully saved after cleanup');
      } catch (retryError) {
        console.error('[MutableStorage] Failed to save even after cleanup:', retryError);
        throw new Error('Storage full. Please clear some browser data and try again.');
      }
    } else {
      console.error('[MutableStorage] Error saving reference:', error);
      throw error;
    }
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
    setCurrentProject(current, true); // Silent mode to avoid excessive logging
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
