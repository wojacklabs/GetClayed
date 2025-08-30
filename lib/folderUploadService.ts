/**
 * Folder Upload Service
 * Uploads and syncs folder structures to blockchain
 */

import { fixedKeyUploader } from './fixedKeyUploadService';
import { v4 as uuidv4 } from 'uuid';

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
const FOLDER_MUTABLE_KEY = 'folder_mutable_refs';

interface FolderStructure {
  walletAddress: string;
  folders: string[];
  updatedAt: number;
}

interface FolderMutableRef {
  rootTxId: string;
  latestTxId: string;
  updatedAt: number;
}

/**
 * Get folder mutable reference from local storage
 */
function getFolderMutableReference(walletAddress: string): FolderMutableRef | null {
  try {
    const refs = JSON.parse(localStorage.getItem(FOLDER_MUTABLE_KEY) || '{}');
    return refs[walletAddress.toLowerCase()] || null;
  } catch (error) {
    console.error('[FolderUpload] Error getting mutable reference:', error);
    return null;
  }
}

/**
 * Save folder mutable reference to local storage
 */
function saveFolderMutableReference(walletAddress: string, rootTxId: string, latestTxId: string): void {
  try {
    const refs = JSON.parse(localStorage.getItem(FOLDER_MUTABLE_KEY) || '{}');
    refs[walletAddress.toLowerCase()] = {
      rootTxId,
      latestTxId,
      updatedAt: Date.now()
    };
    localStorage.setItem(FOLDER_MUTABLE_KEY, JSON.stringify(refs));
  } catch (error) {
    console.error('[FolderUpload] Error saving mutable reference:', error);
  }
}

/**
 * Upload folder structure to blockchain
 */
export async function uploadFolderStructure(
  walletAddress: string,
  folders: string[],
  onProgress?: (status: 'uploading' | 'verifying' | 'complete' | 'error') => void
): Promise<{ transactionId: string; rootTxId: string }> {
  try {
    if (onProgress) onProgress('uploading');
    
    // Get existing mutable reference
    const mutableRef = getFolderMutableReference(walletAddress);
    const rootTxId = mutableRef?.rootTxId;
    
    const folderData: FolderStructure = {
      walletAddress: walletAddress.toLowerCase(),
      folders: folders.sort(),
      updatedAt: Date.now()
    };
    
    const jsonString = JSON.stringify(folderData);
    const tags = [
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'folder-structure' },
      { name: 'Wallet-Address', value: walletAddress.toLowerCase() },
      { name: 'Version', value: '1.0' },
      { name: 'Content-Type', value: 'application/json' }
    ];
    
    // Add Root-TX tag if updating
    if (rootTxId) {
      tags.push({ name: 'Root-TX', value: rootTxId });
    }
    
    // Upload to Irys using fixed key uploader
    await fixedKeyUploader.upload(Buffer.from(jsonString), tags);
    
    // Wait for transaction to be queryable
    if (onProgress) onProgress('verifying');
    const transactionId = await waitForTransaction(walletAddress, rootTxId);
    
    if (!transactionId) {
      throw new Error('Failed to verify folder upload');
    }
    
    // Save mutable reference
    const finalRootTxId = rootTxId || transactionId;
    saveFolderMutableReference(walletAddress, finalRootTxId, transactionId);
    
    if (onProgress) onProgress('complete');
    
    return {
      transactionId,
      rootTxId: finalRootTxId
    };
  } catch (error) {
    console.error('[FolderUpload] Error uploading folder structure:', error);
    if (onProgress) onProgress('error');
    throw error;
  }
}

/**
 * Wait for transaction to be queryable
 */
async function waitForTransaction(
  walletAddress: string,
  rootTxId?: string,
  maxAttempts: number = 30,
  delayMs: number = 2000
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const latestTxId = await queryLatestFolderTransaction(walletAddress, rootTxId);
      if (latestTxId) {
        return latestTxId;
      }
    } catch (error) {
      console.log(`[FolderUpload] Query attempt ${attempt + 1} failed:`, error);
    }
    
    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return null;
}

/**
 * Query latest folder transaction
 */
async function queryLatestFolderTransaction(
  walletAddress: string,
  rootTxId?: string
): Promise<string | null> {
  const tags = [
    { name: 'App-Name', values: ['GetClayed'] },
    { name: 'Data-Type', values: ['folder-structure'] },
    { name: 'Wallet-Address', values: [walletAddress.toLowerCase()] }
  ];
  
  if (rootTxId) {
    tags.push({ name: 'Root-TX', values: [rootTxId] });
  }
  
  const query = `
    query {
      transactions(
        tags: [${tags.map(tag => 
          `{ name: "${tag.name}", values: ${JSON.stringify(tag.values)} }`
        ).join(', ')}],
        first: 1,
        order: DESC
      ) {
        edges {
          node {
            id
            timestamp
          }
        }
      }
    }
  `;
  
  const response = await fetch(IRYS_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  
  const result = await response.json();
  const edge = result.data?.transactions?.edges[0];
  
  return edge?.node?.id || null;
}

/**
 * Download folder structure from blockchain
 */
export async function downloadFolderStructure(walletAddress: string): Promise<string[]> {
  try {
    // Get mutable reference
    const mutableRef = getFolderMutableReference(walletAddress);
    let transactionId: string | null = null;
    
    if (mutableRef) {
      // Try to use latest transaction from mutable reference
      transactionId = mutableRef.latestTxId;
    } else {
      // Query for latest transaction
      transactionId = await queryLatestFolderTransaction(walletAddress);
      
      if (transactionId) {
        // Save to local storage for future use
        saveFolderMutableReference(walletAddress, transactionId, transactionId);
      }
    }
    
    if (!transactionId) {
      console.log('[FolderUpload] No folder structure found for wallet:', walletAddress);
      return [];
    }
    
    // Download from Irys
    const url = `https://uploader.irys.xyz/tx/${transactionId}/data`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download folder structure: ${response.statusText}`);
    }
    
    const data: FolderStructure = await response.json();
    return data.folders || [];
  } catch (error) {
    console.error('[FolderUpload] Error downloading folder structure:', error);
    return [];
  }
}

/**
 * Sync folder structure with blockchain
 */
export async function syncFolderStructure(walletAddress: string): Promise<void> {
  try {
    console.log('[FolderUpload] Syncing folder structure for wallet:', walletAddress);
    
    // Query latest transaction
    const latestTxId = await queryLatestFolderTransaction(walletAddress);
    
    if (latestTxId) {
      // Download and check if we need to update local reference
      const url = `https://uploader.irys.xyz/tx/${latestTxId}/data`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data: FolderStructure = await response.json();
        
        // Update local reference
        const mutableRef = getFolderMutableReference(walletAddress);
        if (!mutableRef || mutableRef.latestTxId !== latestTxId) {
          // Determine root TX ID
          const rootTxId = mutableRef?.rootTxId || latestTxId;
          saveFolderMutableReference(walletAddress, rootTxId, latestTxId);
          console.log('[FolderUpload] Updated local folder reference');
        }
      }
    }
  } catch (error) {
    console.error('[FolderUpload] Error syncing folder structure:', error);
  }
}
