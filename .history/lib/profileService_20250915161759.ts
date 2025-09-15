import { uploadToIrys } from './irys';
import { fixedKeyUploader } from './fixedKeyUploadService';
import { uploadInChunks, downloadChunks, uploadChunkManifest } from './chunkUploadService';
import { v4 as uuidv4 } from 'uuid';

export interface UserProfile {
  id: string;
  walletAddress: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  website?: string;
  twitter?: string;
  github?: string;
  createdAt: number;
  updatedAt: number;
  stats?: {
    totalProjects: number;
    totalLikes: number;
    totalFavorites: number;
  };
}

export interface ProjectLike {
  id: string;
  projectId: string;
  userId: string;
  walletAddress: string;
  timestamp: number;
}

export interface ProjectFavorite {
  id: string;
  projectId: string;
  userId: string;
  walletAddress: string;
  timestamp: number;
}

// Local storage keys for mutable references
const PROFILE_MUTABLE_KEY = 'profile_mutable_refs';
const LIKES_MUTABLE_KEY = 'likes_mutable_refs';
const FAVORITES_MUTABLE_KEY = 'favorites_mutable_refs';

/**
 * Save profile mutable reference
 */
function saveProfileMutableReference(walletAddress: string, rootTxId: string): void {
  try {
    const refs = JSON.parse(localStorage.getItem(PROFILE_MUTABLE_KEY) || '{}');
    refs[walletAddress.toLowerCase()] = {
      rootTxId,
      lastUpdated: Date.now()
    };
    localStorage.setItem(PROFILE_MUTABLE_KEY, JSON.stringify(refs));
  } catch (error) {
    console.error('[ProfileService] Error saving mutable reference:', error);
  }
}

/**
 * Get profile mutable reference
 */
export function getProfileMutableReference(walletAddress: string): string | null {
  try {
    const refs = JSON.parse(localStorage.getItem(PROFILE_MUTABLE_KEY) || '{}');
    return refs[walletAddress.toLowerCase()]?.rootTxId || null;
  } catch (error) {
    console.error('[ProfileService] Error getting mutable reference:', error);
    return null;
  }
}

/**
 * Upload profile avatar image
 */
export async function uploadProfileAvatar(
  imageDataUrl: string,
  walletAddress: string,
  onProgress?: (progress: { currentChunk: number; totalChunks: number; percentage: number }) => void
): Promise<string | null> {
  try {
    // Convert data URL to base64 string (without prefix)
    const base64Data = imageDataUrl.split(',')[1];
    
    // Check size
    const sizeInKB = (base64Data.length * 0.75) / 1024; // Approximate size
    console.log(`[ProfileService] Avatar size: ${sizeInKB.toFixed(2)} KB`);
    
    if (sizeInKB < 80) {
      // Direct upload for small images
      const buffer = Buffer.from(base64Data, 'base64');
      const tags = [
        { name: 'Content-Type', value: 'image/jpeg' },
        { name: 'App-Name', value: 'GetClayed' },
        { name: 'Data-Type', value: 'profile-avatar' },
        { name: 'Wallet-Address', value: walletAddress.toLowerCase() }
      ];
      
      const receipt = await fixedKeyUploader.upload(buffer, tags);
      return receipt.id;
    } else {
      // For large images, split base64 data directly
      console.log('[ProfileService] Avatar exceeds 80KB, using chunked upload');
      
      const avatarId = `avatar-${walletAddress}-${Date.now()}`;
      const chunks: string[] = [];
      const chunkSetId = uuidv4();
      const CHUNK_SIZE = 50 * 1024; // 50KB chunks
      
      // Split base64 string into chunks
      for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
        chunks.push(base64Data.slice(i, i + CHUNK_SIZE));
      }
      
      const totalChunks = chunks.length;
      console.log(`[ProfileService] Splitting avatar into ${totalChunks} chunks`);
      
      const transactionIds: string[] = [];
      
      // Upload each chunk
      for (let i = 0; i < chunks.length; i++) {
        if (onProgress) {
          onProgress({
            currentChunk: i + 1,
            totalChunks,
            percentage: ((i + 1) / totalChunks) * 100
          });
        }
        
        // Create chunk metadata for avatar
        const chunkData = {
          chunk: chunks[i],
          metadata: {
            chunkIndex: i,
            totalChunks,
            chunkSetId,
            projectId: avatarId,
            projectName: 'profile-avatar',
            dataType: 'image-base64' // Mark as image data
          }
        };
        
        const chunkBuffer = Buffer.from(JSON.stringify(chunkData), 'utf-8');
        
        const tags = [
          { name: 'App-Name', value: 'GetClayed' },
          { name: 'Data-Type', value: 'avatar-chunk' },
          { name: 'Avatar-ID', value: avatarId },
          { name: 'Chunk-Index', value: i.toString() },
          { name: 'Total-Chunks', value: totalChunks.toString() },
          { name: 'Chunk-Set-ID', value: chunkSetId },
          { name: 'Wallet-Address', value: walletAddress.toLowerCase() }
        ];
        
        const receipt = await fixedKeyUploader.upload(chunkBuffer, tags);
        transactionIds.push(receipt.id);
      }
      
      // Upload manifest
      const manifestData = {
        projectId: avatarId,
        projectName: 'profile-avatar',
        chunkSetId,
        totalChunks,
        chunks: transactionIds,
        createdAt: new Date().toISOString(),
        dataType: 'image-base64'
      };
      
      const manifestBuffer = Buffer.from(JSON.stringify(manifestData), 'utf-8');
      const manifestTags = [
        { name: 'App-Name', value: 'GetClayed' },
        { name: 'Data-Type', value: 'avatar-manifest' },
        { name: 'Avatar-ID', value: avatarId },
        { name: 'Total-Chunks', value: totalChunks.toString() },
        { name: 'Chunk-Set-ID', value: chunkSetId },
        { name: 'Wallet-Address', value: walletAddress.toLowerCase() },
        { name: 'Content-Type', value: 'application/json' }
      ];
      
      const manifestReceipt = await fixedKeyUploader.upload(manifestBuffer, manifestTags);
      console.log(`[ProfileService] Avatar manifest uploaded with ID: ${manifestReceipt.id}`);
      return manifestReceipt.id;
    }
  } catch (error) {
    console.error('[ProfileService] Error uploading avatar:', error);
    return null;
  }
}

/**
 * Download profile avatar
 */
export async function downloadProfileAvatar(avatarId: string): Promise<string | null> {
  try {
    if (!avatarId || avatarId === '') return null;
    
    console.log(`[ProfileService] Attempting to download avatar with ID: ${avatarId}`);
    
    const url = `https://uploader.irys.xyz/tx/${avatarId}/data`;
    console.log(`[ProfileService] Fetching from: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[ProfileService] Failed to download avatar: ${response.status}`);
      return null;
    }
    
    console.log(`[ProfileService] Successfully fetched avatar`);
    const successUrl = url;
    
    // First check if it's a direct image upload (small images)
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('image')) {
      // Direct image data
      const data = await response.arrayBuffer();
      const buffer = Buffer.from(data);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }
    
    // Try to parse as JSON (could be manifest)
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      
      // Check if it's our custom avatar manifest
      if (data.dataType === 'image-base64' && data.chunks) {
        console.log('[ProfileService] Detected chunked avatar, downloading chunks...');
        
        const chunkIds = data.chunks;
        const chunks: string[] = [];
        console.log(`[ProfileService] Downloading ${chunkIds.length} chunks...`);
        
        // Download all chunks
        for (let i = 0; i < chunkIds.length; i++) {
          const chunkUrl = `https://uploader.irys.xyz/tx/${chunkIds[i]}/data`;
          
          try {
            const chunkResponse = await fetch(chunkUrl);
            if (!chunkResponse.ok) {
              console.error(`[ProfileService] Failed to download chunk ${i + 1}: ${chunkResponse.status}`);
              return null;
            }
            const chunkData = await chunkResponse.json();
            chunks.push(chunkData.chunk);
          } catch (error) {
            console.error(`[ProfileService] Error downloading chunk ${i + 1}:`, error);
            return null;
          }
        }
        
        // Reconstruct base64 image
        const fullBase64 = chunks.join('');
        return `data:image/jpeg;base64,${fullBase64}`;
      } else if (data.paths) {
        // Old format compatibility - standard Irys manifest
        const chunkIds = Object.values(data.paths).map((p: any) => p.id);
        const base64Data = await downloadChunks(avatarId, chunkIds.length, chunkIds);
        return `data:image/jpeg;base64,${base64Data}`;
      }
    } catch (e) {
      // Not JSON, treat as direct image data
      console.log('[ProfileService] Avatar is direct upload (non-chunked)');
    }
    
    // Direct download (non-chunked) - use the successful response
    console.log('[ProfileService] Avatar is direct upload (non-chunked)');
    // Response was already consumed as text, need to re-fetch
    const imageResponse = await fetch(successUrl!);
    const data = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(data);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('[ProfileService] Error downloading avatar:', error);
    return null;
  }
}

/**
 * Upload user profile
 */
export async function uploadUserProfile(
  profile: UserProfile,
  rootTxId?: string,
  onProgress?: (progress: { currentChunk: number; totalChunks: number; percentage: number }) => void
): Promise<{ transactionId: string; rootTxId: string; isUpdate: boolean; wasChunked: boolean }> {
  console.log(`[ProfileService] Uploading profile with avatarUrl: ${profile.avatarUrl}`);
  const jsonString = JSON.stringify(profile);
  const data = Buffer.from(jsonString, 'utf-8');
  
  const sizeInKB = data.byteLength / 1024;
  console.log(`[ProfileService] Profile data size: ${sizeInKB.toFixed(2)} KB`);
  
  const isUpdate = !!rootTxId;
  let transactionId: string;
  let wasChunked = false;
  
  // Check if data exceeds 80KB threshold
  if (sizeInKB >= 80) {
    console.log('[ProfileService] Profile exceeds 80KB, using chunked upload');
    
    // Use chunked upload
    const chunkResult = await uploadInChunks(
      fixedKeyUploader,
      jsonString,
      profile.id,
      'user-profile',
      profile.walletAddress,
      '',
      rootTxId,
      onProgress
    );
    
    // Upload manifest
    transactionId = await uploadChunkManifest(
      fixedKeyUploader,
      profile.id,
      'user-profile',
      chunkResult.chunkMetadata[0].chunkSetId,
      chunkResult.transactionIds.length,
      chunkResult.transactionIds,
      profile.walletAddress,
      '',
      rootTxId,
      'user-profile'
    );
    
    wasChunked = true;
  } else {
    // Direct upload for small profiles
    const tags = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'user-profile' },
      { name: 'Wallet-Address', value: profile.walletAddress.toLowerCase() },
      { name: 'Profile-ID', value: profile.id },
      { name: 'Updated-At', value: Date.now().toString() },
      { name: 'Version', value: '1.0' }
    ];
    
    if (isUpdate && rootTxId) {
      tags.push({ name: 'Root-TX', value: rootTxId });
    }
    
    const receipt = await fixedKeyUploader.upload(data, tags);
    transactionId = receipt.id;
  }
  
  // For first upload, use the transaction ID as root
  // For updates, keep the original root ID
  const finalRootTxId = isUpdate ? rootTxId! : transactionId;
  
  // Save mutable reference - root stays the same, latest changes
  saveProfileMutableReference(profile.walletAddress, finalRootTxId);
  
  return {
    transactionId,
    rootTxId: finalRootTxId,
    isUpdate,
    wasChunked
  };
}

/**
 * Download user profile
 */
export async function downloadUserProfile(walletAddress: string): Promise<UserProfile | null> {
  try {
    // Get mutable reference (root transaction ID)
    const rootTxId = getProfileMutableReference(walletAddress);
    if (!rootTxId) {
      console.log('[ProfileService] No profile found for wallet:', walletAddress);
      return null;
    }
    
    // Query for the latest update with this root transaction ID
    const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["user-profile"] },
            { name: "Wallet-Address", values: ["${walletAddress.toLowerCase()}"] },
            { name: "Root-TX", values: ["${rootTxId}"] }
          ],
          first: 1,
          order: DESC
        ) {
          edges {
            node {
              id
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;
    
    // Find the latest transaction
    const response = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const result = await response.json();
    let latestTxId = rootTxId; // Default to root if no updates found
    
    if (result.data?.transactions?.edges?.length > 0) {
      latestTxId = result.data.transactions.edges[0].node.id;
      console.log(`[ProfileService] Found latest profile update: ${latestTxId}`);
    } else {
      console.log(`[ProfileService] No updates found, using root: ${rootTxId}`);
    }
    
    // Download the latest profile data
    const url = `https://uploader.irys.xyz/tx/${latestTxId}/data`;
    console.log(`[ProfileService] Downloading profile from: ${url}`);
    
    const dataResponse = await fetch(url);
    
    if (!dataResponse.ok) {
      console.error(`[ProfileService] Failed to download profile: ${dataResponse.status}`);
      return null;
    }
    
    // Try to parse as JSON first
    const text = await dataResponse.text();
    try {
      const data = JSON.parse(text);
      
      // Check if this is a chunk manifest
      if (data.chunkSetId && data.totalChunks && data.chunks) {
        console.log('[ProfileService] Detected chunked profile, downloading chunks...');
        console.log('[ProfileService] Chunk set ID:', data.chunkSetId);
        console.log('[ProfileService] Total chunks:', data.totalChunks);
        
        // Download chunks
        const profileData = await downloadChunks(data.chunkSetId, data.totalChunks, data.chunks);
        const profile = JSON.parse(profileData);
        return profile;
      } else {
        // Direct profile data
        return data as UserProfile;
      }
    } catch (parseError) {
      console.error('[ProfileService] Failed to parse profile data:', parseError);
      return null;
    }
  } catch (error) {
    console.error('[ProfileService] Error downloading profile:', error);
    return null;
  }
}

/**
 * Find user by display name
 */
export async function findUserByDisplayName(displayName: string): Promise<string | null> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["user-profile"] }
          ],
          first: 1000,
          order: DESC
        ) {
          edges {
            node {
              id
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
    
    // Group by wallet and get latest
    const profileMap = new Map<string, any>();
    
    for (const edge of edges) {
      const tags = edge.node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const walletAddress = tags['Wallet-Address'];
      const rootTx = tags['Root-TX'];
      
      if (!profileMap.has(walletAddress) || !rootTx) {
        profileMap.set(walletAddress, walletAddress);
      }
    }
    
    // Check each profile for matching display name
    for (const [wallet] of profileMap) {
      try {
        const profile = await downloadUserProfile(wallet);
        if (profile?.displayName?.toLowerCase() === displayName.toLowerCase()) {
          return wallet;
        }
      } catch (error) {
        console.error(`[ProfileService] Failed to check profile for ${wallet}:`, error);
      }
    }
    
    return null;
  } catch (error) {
    console.error('[ProfileService] Error finding user by display name:', error);
    return null;
  }
}

/**
 * Query user profiles
 */
export async function queryUserProfiles(): Promise<UserProfile[]> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["user-profile"] }
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
    
    // Group by wallet and get latest
    const profileMap = new Map<string, any>();
    
    for (const edge of edges) {
      const tags = edge.node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const walletAddress = tags['Wallet-Address'];
      const rootTx = tags['Root-TX'];
      
      if (!profileMap.has(walletAddress) || !rootTx) {
        profileMap.set(walletAddress, {
          id: edge.node.id,
          timestamp: edge.node.timestamp,
          tags
        });
      }
    }
    
    // Download actual profiles
    const profiles: UserProfile[] = [];
    for (const [wallet, data] of profileMap) {
      try {
        const profile = await downloadUserProfile(wallet);
        if (profile) {
          profiles.push(profile);
        }
      } catch (error) {
        console.error(`[ProfileService] Failed to download profile for ${wallet}:`, error);
      }
    }
    
    return profiles;
  } catch (error) {
    console.error('[ProfileService] Error querying profiles:', error);
    return [];
  }
}

/**
 * Add like to project
 */
export async function likeProject(
  projectId: string,
  walletAddress: string
): Promise<{ transactionId: string }> {
  const like: ProjectLike = {
    id: uuidv4(),
    projectId,
    userId: walletAddress,
    walletAddress: walletAddress.toLowerCase(),
    timestamp: Date.now()
  };
  
  const data = Buffer.from(JSON.stringify(like), 'utf-8');
  
  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'App-Name', value: 'GetClayed' },
    { name: 'Data-Type', value: 'project-like' },
    { name: 'Project-ID', value: projectId },
    { name: 'Wallet-Address', value: walletAddress.toLowerCase() },
    { name: 'Timestamp', value: like.timestamp.toString() }
  ];
  
  const receipt = await fixedKeyUploader.upload(data, tags);
  
  return { transactionId: receipt.id };
}

/**
 * Check if user liked project
 */
export async function hasUserLikedProject(
  projectId: string,
  walletAddress: string
): Promise<boolean> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-like"] },
            { name: "Project-ID", values: ["${projectId}"] },
            { name: "Wallet-Address", values: ["${walletAddress.toLowerCase()}"] }
          ],
          first: 1
        ) {
          edges {
            node {
              id
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
    return result.data?.transactions?.edges?.length > 0;
  } catch (error) {
    console.error('[ProfileService] Error checking like status:', error);
    return false;
  }
}

/**
 * Get project like count
 */
export async function getProjectLikeCount(projectId: string): Promise<number> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-like"] },
            { name: "Project-ID", values: ["${projectId}"] }
          ],
          first: 1000
        ) {
          edges {
            node {
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
    
    // Count unique wallets
    const uniqueWallets = new Set<string>();
    for (const edge of edges) {
      const walletTag = edge.node.tags.find((t: any) => t.name === 'Wallet-Address');
      if (walletTag) {
        uniqueWallets.add(walletTag.value);
      }
    }
    
    return uniqueWallets.size;
  } catch (error) {
    console.error('[ProfileService] Error getting like count:', error);
    return 0;
  }
}

/**
 * Add project to favorites
 */
export async function favoriteProject(
  projectId: string,
  walletAddress: string
): Promise<{ transactionId: string }> {
  const favorite: ProjectFavorite = {
    id: uuidv4(),
    projectId,
    userId: walletAddress,
    walletAddress: walletAddress.toLowerCase(),
    timestamp: Date.now()
  };
  
  const data = Buffer.from(JSON.stringify(favorite), 'utf-8');
  
  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'App-Name', value: 'GetClayed' },
    { name: 'Data-Type', value: 'project-favorite' },
    { name: 'Project-ID', value: projectId },
    { name: 'Wallet-Address', value: walletAddress.toLowerCase() },
    { name: 'Timestamp', value: favorite.timestamp.toString() }
  ];
  
  const receipt = await fixedKeyUploader.upload(data, tags);
  
  return { transactionId: receipt.id };
}

/**
 * Remove project from favorites
 */
export async function unfavoriteProject(
  projectId: string,
  walletAddress: string
): Promise<{ transactionId: string }> {
  const unfavorite = {
    id: uuidv4(),
    projectId,
    walletAddress: walletAddress.toLowerCase(),
    timestamp: Date.now(),
    action: 'remove'
  };
  
  const data = Buffer.from(JSON.stringify(unfavorite), 'utf-8');
  
  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'App-Name', value: 'GetClayed' },
    { name: 'Data-Type', value: 'project-favorite-remove' },
    { name: 'Project-ID', value: projectId },
    { name: 'Wallet-Address', value: walletAddress.toLowerCase() },
    { name: 'Timestamp', value: unfavorite.timestamp.toString() }
  ];
  
  const receipt = await fixedKeyUploader.upload(data, tags);
  
  return { transactionId: receipt.id };
}

/**
 * Record project view
 */
export async function recordProjectView(projectId: string, viewerAddress?: string): Promise<void> {
  try {
    const viewData = {
      id: uuidv4(),
      projectId,
      viewerAddress: viewerAddress || 'anonymous',
      timestamp: Date.now()
    };
    
    const data = Buffer.from(JSON.stringify(viewData), 'utf-8');
    
    const tags = [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'project-view' },
      { name: 'Project-ID', value: projectId },
      { name: 'Viewer-Address', value: viewerAddress || 'anonymous' },
      { name: 'Timestamp', value: viewData.timestamp.toString() }
    ];
    
    await fixedKeyUploader.upload(data, tags);
  } catch (error) {
    console.error('[ProfileService] Error recording project view:', error);
  }
}

/**
 * Get project view count
 */
export async function getProjectViewCount(projectId: string): Promise<number> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-view"] },
            { name: "Project-ID", values: ["${projectId}"] }
          ],
          first: 1000,
          order: DESC
        ) {
          edges {
            node {
              id
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
    
    return edges.length;
  } catch (error) {
    console.error('[ProfileService] Error getting project view count:', error);
    return 0;
  }
}

/**
 * Get user favorites
 */
export async function getUserFavorites(walletAddress: string): Promise<string[]> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    // Get all favorites
    const addQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-favorite"] },
            { name: "Wallet-Address", values: ["${walletAddress.toLowerCase()}"] }
          ],
          first: 1000,
          order: DESC
        ) {
          edges {
            node {
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
    
    // Get all unfavorites
    const removeQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-favorite-remove"] },
            { name: "Wallet-Address", values: ["${walletAddress.toLowerCase()}"] }
          ],
          first: 1000,
          order: DESC
        ) {
          edges {
            node {
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
    
    const [addResponse, removeResponse] = await Promise.all([
      fetch(IRYS_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: addQuery })
      }),
      fetch(IRYS_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: removeQuery })
      })
    ]);
    
    const [addResult, removeResult] = await Promise.all([
      addResponse.json(),
      removeResponse.json()
    ]);
    
    // Process favorites
    const favoriteMap = new Map<string, { timestamp: number, action: 'add' | 'remove' }>();
    
    // Add favorites
    const addEdges = addResult.data?.transactions?.edges || [];
    for (const edge of addEdges) {
      const projectId = edge.node.tags.find((t: any) => t.name === 'Project-ID')?.value;
      const timestamp = parseInt(edge.node.timestamp);
      
      if (projectId) {
        const existing = favoriteMap.get(projectId);
        if (!existing || existing.timestamp < timestamp) {
          favoriteMap.set(projectId, { timestamp, action: 'add' });
        }
      }
    }
    
    // Remove favorites
    const removeEdges = removeResult.data?.transactions?.edges || [];
    for (const edge of removeEdges) {
      const projectId = edge.node.tags.find((t: any) => t.name === 'Project-ID')?.value;
      const timestamp = parseInt(edge.node.timestamp);
      
      if (projectId) {
        const existing = favoriteMap.get(projectId);
        if (!existing || existing.timestamp < timestamp) {
          favoriteMap.set(projectId, { timestamp, action: 'remove' });
        }
      }
    }
    
    // Return only projects that are currently favorited
    return Array.from(favoriteMap.entries())
      .filter(([_, data]) => data.action === 'add')
      .map(([projectId]) => projectId);
  } catch (error) {
    console.error('[ProfileService] Error getting favorites:', error);
    return [];
  }
}
