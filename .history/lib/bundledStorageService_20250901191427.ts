import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface ClayObjectData {
  id: string;
  shape: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  size: number;
  thickness: number;
  detail: number;
  controlPoints?: Array<[number, number, number]>;
  deformedVertices?: { [key: string]: [number, number, number] };
}

export interface ClayProject {
  id: string;
  name: string;
  description: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  objects: ClayObjectData[];
  tags: string[];
  version: string;
  backgroundColor?: string;
}

// Bundled upload function that will be called from browser
export async function bundledUploadClayProject(
  projectData: ClayProject,
  folder: string = '',
  rootTxId?: string,
  onProgress?: (progress: any) => void
): Promise<{ transactionId: string; rootTxId: string; isUpdate: boolean; wasChunked: boolean }> {
  try {
    // Check if bundled client is available
    const bundledClient = (window as any).irysBundledClient;
    if (!bundledClient) {
      throw new Error('Irys bundled client not loaded');
    }

    // Initialize if needed
    if (!bundledClient.uploader) {
      // Set private key from environment variable
      const privateKey = process.env.NEXT_PUBLIC_IRYS_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('NEXT_PUBLIC_IRYS_PRIVATE_KEY not configured in environment');
      }
      
      bundledClient.setPrivateKey(privateKey);
      const initialized = await bundledClient.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize Irys bundled client');
      }
    }

    // Serialize project
    const jsonString = JSON.stringify(projectData);
    const sizeInKB = Buffer.from(jsonString).byteLength / 1024;
    
    console.log(`[BundledUpload] Project size: ${sizeInKB.toFixed(2)} KB`);
    
    const isUpdate = !!rootTxId;
    let wasChunked = false;
    
    if (sizeInKB < 90) {
      // Single upload for small projects
      console.log('[BundledUpload] Single upload (under 90KB)');
      
      const tags = [
        { name: 'Project-Name', value: projectData.name },
        { name: 'Project-ID', value: projectData.id },
        { name: 'Author', value: projectData.author },
        { name: 'Created-At', value: projectData.createdAt.toString() },
        { name: 'Updated-At', value: Date.now().toString() },
        { name: 'Version', value: '2.0' },
        { name: 'File-Extension', value: '.clay.json' }
      ];
      
      if (isUpdate && rootTxId) {
        tags.push({ name: 'Root-TX', value: rootTxId });
      }
      
      if (folder) {
        tags.push({ name: 'Folder', value: folder });
      }
      
      const result = await bundledClient.uploadClayProject(projectData, tags);
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      const finalRootTxId = rootTxId || result.id;
      
      return {
        transactionId: result.id,
        rootTxId: finalRootTxId,
        isUpdate,
        wasChunked: false
      };
    } else {
      // Chunked upload for large projects
      console.log('[BundledUpload] Chunked upload required');
      wasChunked = true;
      
      // Split into chunks
      const chunks = splitIntoChunks(jsonString);
      const chunkSetId = uuidv4();
      const totalChunks = chunks.length;
      
      console.log(`[BundledUpload] Split into ${totalChunks} chunks`);
      
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
        
        const chunkData = {
          chunk: chunks[i],
          metadata: {
            chunkIndex: i,
            totalChunks,
            chunkSetId,
            projectId: projectData.id,
            projectName: projectData.name
          }
        };
        
        const metadata = {
          projectId: projectData.id,
          projectName: projectData.name,
          author: projectData.author,
          chunkSetId,
          chunkIndex: i,
          totalChunks,
          folder,
          rootTxId
        };
        
        const chunkBuffer = Buffer.from(JSON.stringify(chunkData), 'utf-8');
        const result = await bundledClient.uploadChunk(chunkBuffer, metadata);
        
        if (!result.success) {
          throw new Error(`Failed to upload chunk ${i + 1}: ${result.error}`);
        }
        
        transactionIds.push(result.id);
        console.log(`[BundledUpload] Uploaded chunk ${i + 1}/${totalChunks}, TX: ${result.id}`);
      }
      
      // Upload manifest
      const manifestData = {
        chunkSetId,
        totalChunks,
        transactionIds,
        projectId: projectData.id,
        projectName: projectData.name,
        createdAt: new Date().toISOString()
      };
      
      const manifestMetadata = {
        projectId: projectData.id,
        projectName: projectData.name,
        author: projectData.author,
        chunkSetId,
        totalChunks,
        folder,
        rootTxId
      };
      
      const manifestResult = await bundledClient.uploadManifest(manifestData, manifestMetadata);
      
      if (!manifestResult.success) {
        throw new Error(`Failed to upload manifest: ${manifestResult.error}`);
      }
      
      console.log(`[BundledUpload] Manifest uploaded: ${manifestResult.id}`);
      
      const finalRootTxId = rootTxId || manifestResult.id;
      
      return {
        transactionId: manifestResult.id,
        rootTxId: finalRootTxId,
        isUpdate,
        wasChunked: true
      };
    }
  } catch (error) {
    console.error('[BundledUpload] Error:', error);
    throw error;
  }
}

// Helper function to split data into chunks
function splitIntoChunks(data: string): string[] {
  const CHUNK_SIZE = 50 * 1024; // 50KB chunks
  const chunks: string[] = [];
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  
  // Convert to base64 for safe transport
  const base64 = Buffer.from(bytes).toString('base64');
  
  for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
    chunks.push(base64.slice(i, i + CHUNK_SIZE));
  }
  
  console.log(`[BundledUpload] Split data into ${chunks.length} chunks`);
  return chunks;
}

// Query functions remain the same as they don't need bundling
export async function queryUserProjects(walletAddress: string): Promise<any[]> {
  const query = `
    query getProjectsByAuthor($author: String!) {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] },
          { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] },
          { name: "Author", values: [$author] }
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

  try {
    const response = await axios.post(
      'https://uploader.irys.xyz/graphql',
      {
        query,
        variables: { author: walletAddress }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      }
    );

    const transactions = response.data?.data?.transactions?.edges || [];
    
    // Process and group by project ID
    const projectMap = new Map();
    const rootTxMap = new Map();
    
    for (const edge of transactions) {
      const node = edge.node;
      const tags = node.tags || [];
      
      const projectId = tags.find((tag: any) => tag.name === 'Project-ID')?.value;
      if (!projectId) continue;
      
      const rootTxTag = tags.find((tag: any) => tag.name === 'Root-TX');
      const dataType = tags.find((tag: any) => tag.name === 'Data-Type')?.value;
      
      if (rootTxTag) {
        const rootTx = rootTxTag.value;
        const existing = rootTxMap.get(rootTx);
        if (!existing || existing.timestamp < node.timestamp) {
          rootTxMap.set(rootTx, {
            ...node,
            projectId,
            dataType
          });
        }
      } else {
        projectMap.set(projectId, {
          ...node,
          projectId,
          dataType
        });
      }
    }
    
    // Merge root TX updates
    for (const [rootTx, data] of rootTxMap.entries()) {
      const projectId = data.projectId;
      projectMap.set(projectId, data);
    }
    
    return Array.from(projectMap.values());
  } catch (error) {
    console.error('[QueryProjects] Error:', error);
    return [];
  }
}

export async function downloadClayProject(transactionId: string): Promise<ClayProject | null> {
  try {
    // First try mutable endpoint
    let response = await axios.get(`https://gateway.irys.xyz/mutable/${transactionId}`);
    
    // If not found, try regular endpoint
    if (!response.data) {
      response = await axios.get(`https://gateway.irys.xyz/${transactionId}`);
    }
    
    if (!response.data) {
      throw new Error('No data found');
    }
    
    const data = response.data;
    
    // Check if this is a chunk manifest
    if (data.chunkSetId && data.transactionIds) {
      console.log('[Download] This is a chunk manifest, downloading chunks...');
      
      // Download all chunks
      const chunks: string[] = [];
      for (let i = 0; i < data.transactionIds.length; i++) {
        const chunkResponse = await axios.get(`https://gateway.irys.xyz/${data.transactionIds[i]}`);
        const chunkData = chunkResponse.data;
        chunks.push(chunkData.chunk);
      }
      
      // Reassemble data
      const base64Data = chunks.join('');
      const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
      return JSON.parse(jsonString);
    }
    
    // Regular project data
    return data;
  } catch (error) {
    console.error('[Download] Error:', error);
    return null;
  }
}
