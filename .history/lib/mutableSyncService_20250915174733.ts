/**
 * Mutable Sync Service
 * Synchronizes local mutable references with blockchain data
 */

import { getMutableReference, saveMutableReference } from './mutableStorageService';

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

interface ProjectMutableInfo {
  projectId: string;
  rootTxId: string;
  latestTxId: string;
  projectName: string;
  author: string;
  timestamp: number;
}

/**
 * Sync project mutable references from GraphQL
 */
export async function syncProjectMutableReferences(walletAddress: string): Promise<void> {
  try {
    console.log('[MutableSync] Starting sync for wallet:', walletAddress);
    
    // Query all projects by this wallet
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] },
            { name: "Author", values: ["${walletAddress}"] }
          ],
          first: 1000,
          order: DESC
        ) {
          edges {
            node {
              id
              timestamp
              tags {
                name
                value
              }
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

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const result = await response.json();
    const edges = result.data?.transactions?.edges || [];
    
    // Group transactions by project
    const projectMap = new Map<string, ProjectMutableInfo>();
    
    for (const edge of edges) {
      const tags = edge.node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const projectId = tags['Project-ID'];
      const rootTxId = tags['Root-TX'];
      const projectName = tags['Project-Name'] || 'Untitled';
      
      if (!projectId) continue;
      
      // If this has a Root-TX, it's an update
      if (rootTxId) {
        const existing = projectMap.get(rootTxId);
        if (!existing || edge.node.timestamp > existing.timestamp) {
          projectMap.set(rootTxId, {
            projectId,
            rootTxId,
            latestTxId: edge.node.id,
            projectName,
            author: walletAddress,
            timestamp: edge.node.timestamp
          });
        }
      } else {
        // This is an original project (root)
        const existing = projectMap.get(edge.node.id);
        if (!existing) {
          projectMap.set(edge.node.id, {
            projectId,
            rootTxId: edge.node.id,
            latestTxId: edge.node.id,
            projectName,
            author: walletAddress,
            timestamp: edge.node.timestamp
          });
        }
      }
    }
    
    // Sync with local storage
    let syncedCount = 0;
    for (const [_, projectInfo] of projectMap) {
      const localRef = getMutableReference(projectInfo.projectId);
      
      // Only update if local doesn't exist or blockchain is newer
      if (!localRef || projectInfo.timestamp > (localRef.updatedAt || 0)) {
        saveMutableReference(
          projectInfo.projectId,
          projectInfo.rootTxId,
          projectInfo.latestTxId,
          projectInfo.projectName,
          projectInfo.author
        );
        syncedCount++;
      }
    }
    
    console.log(`[MutableSync] Synced ${syncedCount} project references`);
  } catch (error) {
    console.error('[MutableSync] Error syncing mutable references:', error);
    throw error;
  }
}

/**
 * Get project's latest transaction ID
 * First checks local storage, then queries GraphQL if not found
 */
export async function getProjectLatestTxId(projectId: string): Promise<string | null> {
  // Check local storage first
  const localRef = getMutableReference(projectId);
  if (localRef) {
    return localRef.latestTxId;
  }
  
  // Query GraphQL for the project
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Project-ID", values: ["${projectId}"] }
          ],
          first: 100,
          order: DESC
        ) {
          edges {
            node {
              id
              timestamp
              tags {
                name
                value
              }
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
    const edges = result.data?.transactions?.edges || [];
    
    let rootTxId: string | null = null;
    let latestTxId: string | null = null;
    let latestTimestamp = 0;
    let projectName = 'Untitled';
    let author = '';
    
    for (const edge of edges) {
      const tags = edge.node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const txRootId = tags['Root-TX'];
      
      if (txRootId) {
        // This is an update
        if (edge.node.timestamp > latestTimestamp) {
          rootTxId = txRootId;
          latestTxId = edge.node.id;
          latestTimestamp = edge.node.timestamp;
          projectName = tags['Project-Name'] || projectName;
          author = tags['Author'] || author;
        }
      } else {
        // This is the root transaction
        if (!rootTxId) {
          rootTxId = edge.node.id;
          latestTxId = edge.node.id;
          latestTimestamp = edge.node.timestamp;
          projectName = tags['Project-Name'] || projectName;
          author = tags['Author'] || author;
        }
      }
    }
    
    if (latestTxId && rootTxId && author) {
      // Save to local storage for future use
      saveMutableReference(projectId, rootTxId, latestTxId, projectName, author);
      return latestTxId;
    }
    
    return null;
  } catch (error) {
    console.error('[MutableSync] Error getting project latest tx:', error);
    return null;
  }
}
