import { uploadToIrys } from './irys';
import { v4 as uuidv4 } from 'uuid';

export interface ChunkMetadata {
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
  projectId: string;
  rootTxId?: string;
}

export interface ChunkUploadProgress {
  currentChunk: number;
  totalChunks: number;
  percentage: number;
}

const CHUNK_SIZE = 90 * 1024; // 90KB chunks to stay well under 100KB

/**
 * Split large data into chunks for upload
 */
export function splitIntoChunks(data: string): string[] {
  const chunks: string[] = [];
  const dataBytes = Buffer.from(data, 'utf-8');
  
  for (let i = 0; i < dataBytes.length; i += CHUNK_SIZE) {
    const chunk = dataBytes.slice(i, i + CHUNK_SIZE);
    chunks.push(chunk.toString('base64'));
  }
  
  return chunks;
}

/**
 * Upload data in chunks if it exceeds 100KB
 */
export async function uploadInChunks(
  irysUploader: any,
  data: string,
  projectId: string,
  projectName: string,
  walletAddress: string,
  folder: string,
  rootTxId?: string,
  onProgress?: (progress: ChunkUploadProgress) => void
): Promise<{ transactionIds: string[]; chunkMetadata: ChunkMetadata[] }> {
  const chunks = splitIntoChunks(data);
  const totalChunks = chunks.length;
  const chunkSetId = uuidv4(); // Unique ID for this chunk set
  
  console.log(`[ChunkUpload] Splitting data into ${totalChunks} chunks`);
  
  const transactionIds: string[] = [];
  const chunkMetadata: ChunkMetadata[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkIndex = i;
    
    // Update progress
    if (onProgress) {
      onProgress({
        currentChunk: i + 1,
        totalChunks,
        percentage: ((i + 1) / totalChunks) * 100
      });
    }
    
    // Prepare chunk data
    const chunkData = {
      chunk,
      metadata: {
        chunkIndex,
        totalChunks,
        chunkSetId,
        projectId,
        projectName
      }
    };
    
    const tags = [
      { name: 'Data-Type', value: 'clay-project-chunk' },
      { name: 'Project-ID', value: projectId },
      { name: 'Project-Name', value: projectName },
      { name: 'Author', value: walletAddress },
      { name: 'Chunk-Set-ID', value: chunkSetId },
      { name: 'Chunk-Index', value: chunkIndex.toString() },
      { name: 'Total-Chunks', value: totalChunks.toString() },
      { name: 'Created-At', value: new Date().toISOString() }
    ];
    
    if (folder) {
      tags.push({ name: 'Folder', value: folder });
    }
    
    if (rootTxId) {
      tags.push({ name: 'Root-TX', value: rootTxId });
    }
    
    // Upload chunk
    const uploadData = Buffer.from(JSON.stringify(chunkData), 'utf-8');
    const receipt = await uploadToIrys(irysUploader, uploadData, tags);
    
    transactionIds.push(receipt.id);
    chunkMetadata.push({
      chunkId: receipt.id,
      chunkIndex,
      totalChunks,
      projectId,
      rootTxId
    });
    
    console.log(`[ChunkUpload] Uploaded chunk ${i + 1}/${totalChunks}, TX: ${receipt.id}`);
  }
  
  return { transactionIds, chunkMetadata };
}

/**
 * Download and reassemble chunks
 */
export async function downloadChunks(chunkSetId: string, totalChunks: number): Promise<string> {
  const chunks: string[] = new Array(totalChunks);
  let foundChunks = 0;
  
  // Query all chunks for this set
  const query = `
    query {
      transactions(
        tags: [
          { name: "Data-Type", values: ["clay-project-chunk"] }
          { name: "Chunk-Set-ID", values: ["${chunkSetId}"] }
        ]
        order: ASC
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
  
  try {
    const response = await fetch('https://arweave.net/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    const result = await response.json();
    const edges = result.data?.transactions?.edges || [];
    
    // Download each chunk
    for (const edge of edges) {
      const txId = edge.node.id;
      const chunkIndexTag = edge.node.tags.find((tag: any) => tag.name === 'Chunk-Index');
      
      if (chunkIndexTag) {
        const chunkIndex = parseInt(chunkIndexTag.value);
        
        // Download chunk data
        const chunkResponse = await fetch(`https://gateway.irys.xyz/${txId}`);
        const chunkData = await chunkResponse.json();
        
        chunks[chunkIndex] = chunkData.chunk;
        foundChunks++;
      }
    }
    
    if (foundChunks !== totalChunks) {
      throw new Error(`Missing chunks: found ${foundChunks} of ${totalChunks}`);
    }
    
    // Reassemble chunks
    const reassembled = chunks.join('');
    return Buffer.from(reassembled, 'base64').toString('utf-8');
    
  } catch (error) {
    console.error('[ChunkDownload] Error downloading chunks:', error);
    throw error;
  }
}

/**
 * Create a manifest for chunked upload
 */
export async function uploadChunkManifest(
  irysUploader: any,
  projectId: string,
  projectName: string,
  chunkSetId: string,
  totalChunks: number,
  transactionIds: string[],
  walletAddress: string,
  folder: string,
  rootTxId?: string
): Promise<string> {
  const manifest = {
    projectId,
    projectName,
    chunkSetId,
    totalChunks,
    chunks: transactionIds,
    createdAt: new Date().toISOString()
  };
  
  const tags = [
    { name: 'Data-Type', value: 'clay-project-manifest' },
    { name: 'Project-ID', value: projectId },
    { name: 'Project-Name', value: projectName },
    { name: 'Author', value: walletAddress },
    { name: 'Chunk-Set-ID', value: chunkSetId },
    { name: 'Total-Chunks', value: totalChunks.toString() },
    { name: 'Created-At', value: new Date().toISOString() }
  ];
  
  if (folder) {
    tags.push({ name: 'Folder', value: folder });
  }
  
  if (rootTxId) {
    tags.push({ name: 'Root-TX', value: rootTxId });
    tags.push({ name: 'Updated-At', value: new Date().toISOString() });
  }
  
  const uploadData = Buffer.from(JSON.stringify(manifest), 'utf-8');
  const receipt = await uploadToIrys(irysUploader, uploadData, tags);
  
  return receipt.id;
}
