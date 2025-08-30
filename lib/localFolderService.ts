/**
 * Local folder management service
 * Stores folder structure in localStorage before any files are uploaded
 */

interface LocalFolder {
  path: string;
  createdAt: number;
}

const FOLDER_STORAGE_KEY = 'getclayed-folders';

export function getLocalFolders(walletAddress: string): string[] {
  if (!walletAddress) return [];
  
  const key = `${FOLDER_STORAGE_KEY}-${walletAddress}`;
  const stored = localStorage.getItem(key);
  
  if (!stored) return [];
  
  try {
    const folders: LocalFolder[] = JSON.parse(stored);
    return folders.map(f => f.path).sort();
  } catch (error) {
    console.error('Error parsing local folders:', error);
    return [];
  }
}

export function addLocalFolder(walletAddress: string, folderPath: string): void {
  if (!walletAddress || !folderPath) return;
  
  const key = `${FOLDER_STORAGE_KEY}-${walletAddress}`;
  const stored = localStorage.getItem(key);
  
  let folders: LocalFolder[] = [];
  if (stored) {
    try {
      folders = JSON.parse(stored);
    } catch (error) {
      console.error('Error parsing local folders:', error);
    }
  }
  
  // Check if folder already exists
  if (folders.some(f => f.path === folderPath)) {
    return;
  }
  
  // Add all parent folders if they don't exist
  const parts = folderPath.split('/').filter(Boolean);
  let currentPath = '';
  
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    if (!folders.some(f => f.path === currentPath)) {
      folders.push({
        path: currentPath,
        createdAt: Date.now()
      });
    }
  }
  
  localStorage.setItem(key, JSON.stringify(folders));
}

export function removeLocalFolder(walletAddress: string, folderPath: string): void {
  if (!walletAddress || !folderPath) return;
  
  const key = `${FOLDER_STORAGE_KEY}-${walletAddress}`;
  const stored = localStorage.getItem(key);
  
  if (!stored) return;
  
  try {
    let folders: LocalFolder[] = JSON.parse(stored);
    
    // Remove the folder and all subfolders
    folders = folders.filter(f => !f.path.startsWith(folderPath));
    
    localStorage.setItem(key, JSON.stringify(folders));
  } catch (error) {
    console.error('Error removing local folder:', error);
  }
}

export function renameLocalFolder(walletAddress: string, oldPath: string, newPath: string): void {
  if (!walletAddress || !oldPath || !newPath) return;
  
  const key = `${FOLDER_STORAGE_KEY}-${walletAddress}`;
  const stored = localStorage.getItem(key);
  
  if (!stored) return;
  
  try {
    let folders: LocalFolder[] = JSON.parse(stored);
    
    // Update all folders that start with the old path
    folders = folders.map(f => {
      if (f.path === oldPath) {
        return { ...f, path: newPath };
      } else if (f.path.startsWith(oldPath + '/')) {
        return { ...f, path: f.path.replace(oldPath, newPath) };
      }
      return f;
    });
    
    localStorage.setItem(key, JSON.stringify(folders));
  } catch (error) {
    console.error('Error renaming local folder:', error);
  }
}

export function clearLocalFolders(walletAddress: string): void {
  if (!walletAddress) return;
  
  const key = `${FOLDER_STORAGE_KEY}-${walletAddress}`;
  localStorage.removeItem(key);
}
