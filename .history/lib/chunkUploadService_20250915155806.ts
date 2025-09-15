import { uploadToIrys } from './irys';
import { v4 as uuidv4 } from 'uuid';
import { fixedKeyUploader } from './fixedKeyUploadService';

export interface ChunkMetadata {
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkSetId: string;
  projectId: string;
  rootTxId?: string;
}

export interface ChunkUploadProgress {
  currentChunk: number;
  totalChunks: number;
  percentage: number;
}

const CHUNK_SIZE = 50 * 1024; // 50KB chunks, will be ~67KB after base64 encoding

/**
 * Split large data into chunks for upload
 * Ensures clean string boundaries to avoid JSON parsing issues
 */
export function splitIntoChunks(data: string): string[] {
  const chunks: string[] = [];
  
  // Convert to base64 first, then chunk
  // This ensures we don't split in the middle of a UTF-8 character
  const base64Data = Buffer.from(data, 'utf-8').toString('base64');
  
  // Split base64 string into chunks
  for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
    chunks.push(base64Data.slice(i, i + CHUNK_SIZE));
  }
  
  console.log(`[ChunkUpload] Created ${chunks.length} chunks from ${data.length} chars (${base64Data.length} base64 chars)`);
  console.log(`[ChunkUpload] Chunk sizes:`, chunks.map(c => c.length));
  
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
    
    // Convert chunk data to buffer and check size
    const chunkBuffer = Buffer.from(JSON.stringify(chunkData), 'utf-8');
    const chunkSizeKB = chunkBuffer.byteLength / 1024;
    console.log(`[ChunkUpload] Chunk ${i + 1}/${totalChunks} size: ${chunkSizeKB.toFixed(2)} KB`);
    
    const tags = [
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'clay-project-chunk' },
      { name: 'Project-ID', value: projectId },
      { name: 'Project-Name', value: projectName },
      { name: 'Author', value: walletAddress.toLowerCase() },
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
    
    // Upload chunk using fixed key uploader
    const receipt = await fixedKeyUploader.upload(chunkBuffer, tags);
    
    transactionIds.push(receipt.id);
    chunkMetadata.push({
      chunkId: receipt.id,
      chunkIndex,
      totalChunks,
      chunkSetId,
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
export async function downloadChunks(
  chunkSetId: string, 
  totalChunks: number, 
  chunkIds?: string[],
  onProgress?: (progress: { currentChunk: number; totalChunks: number; percentage: number }) => void
): Promise<string> {
  const chunks: string[] = new Array(totalChunks);
  let foundChunks = 0;
  
  try {
    // If chunk IDs are provided directly (from manifest), use them
    if (chunkIds && chunkIds.length === totalChunks) {
      console.log(`[ChunkDownload] Using ${chunkIds.length} chunk IDs from manifest`);
      
      for (let i = 0; i < chunkIds.length; i++) {
        const txId = chunkIds[i];
        try {
          const chunkResponse = await fetch(`https://uploader.irys.xyz/tx/${txId}/data`);
          const chunkData = await chunkResponse.json();
          
          if (!chunkData.chunk) {
            throw new Error(`Chunk ${i} data is missing`);
          }
          chunks[i] = chunkData.chunk;
          foundChunks++;
          console.log(`[ChunkDownload] Downloaded chunk ${i + 1}/${totalChunks} - Length: ${chunkData.chunk.length}`);
          
          // Report progress
          if (onProgress) {
            onProgress({
              currentChunk: foundChunks,
              totalChunks: totalChunks,
              percentage: (foundChunks / totalChunks) * 100
            });
          }
        } catch (error) {
          console.error(`[ChunkDownload] Error downloading chunk ${i}:`, error);
        }
      }
    } else {
      // Fallback to GraphQL query
      console.log(`[ChunkDownload] Querying chunks for set ${chunkSetId}`);
      
      const query = `
        query {
          transactions(
            tags: [
              { name: "App-Name", values: ["GetClayed"] }
              { name: "Data-Type", values: ["clay-project-chunk"] }
              { name: "Chunk-Set-ID", values: ["${chunkSetId}"] }
            ]
            first: 100
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
      
    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    const result = await response.json();
    const edges = result.data?.transactions?.edges || [];
    
    console.log(`[ChunkDownload] Found ${edges.length} chunks for set ${chunkSetId}`);
    
    // Download each chunk
    for (const edge of edges) {
      const txId = edge.node.id;
      const chunkIndexTag = edge.node.tags.find((tag: any) => tag.name === 'Chunk-Index');
      
      if (chunkIndexTag) {
        const chunkIndex = parseInt(chunkIndexTag.value);
        
        // Download chunk data
        const chunkResponse = await fetch(`https://uploader.irys.xyz/tx/${txId}/data`);
        const chunkData = await chunkResponse.json();
        
        chunks[chunkIndex] = chunkData.chunk;
        foundChunks++;
      }
    }
    }
    
    if (foundChunks !== totalChunks) {
      throw new Error(`Missing chunks: found ${foundChunks} of ${totalChunks}`);
    }
    
    // Reassemble chunks
    console.log('[ChunkDownload] Reassembling chunks...');
    
    // Check for null/undefined chunks
    for (let i = 0; i < chunks.length; i++) {
      if (!chunks[i]) {
        console.error(`[ChunkDownload] Chunk ${i} is missing!`);
        throw new Error(`Chunk ${i} is missing`);
      }
    }
    
    // Chunks are already base64 strings, just join them
    const reassembled = chunks.join('');
    console.log('[ChunkDownload] Total base64 length:', reassembled.length);
    console.log('[ChunkDownload] Individual chunk lengths:', chunks.map(c => c ? c.length : 0));
    
    // Check if this is old format (each chunk is individually base64 encoded)
    // Old format: each chunk was UTF-8 bytes encoded to base64
    // New format: entire data is base64 encoded then split
    const isOldFormat = chunks.length > 0 && chunks[0].length === 68268; // Old chunk size
    
    try {
      let decoded: string;
      
      if (isOldFormat) {
        console.log('[ChunkDownload] Detected old chunk format, decoding each chunk individually');
        // Old format: decode each chunk and concatenate
        const decodedChunks: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
          try {
            const chunkDecoded = Buffer.from(chunks[i], 'base64').toString('utf-8');
            decodedChunks.push(chunkDecoded);
          } catch (e) {
            console.error(`[ChunkDownload] Failed to decode chunk ${i}:`, e);
            throw e;
          }
        }
        decoded = decodedChunks.join('');
      } else {
        // New format: decode the complete base64 string
        decoded = Buffer.from(reassembled, 'base64').toString('utf-8');
      }
      
      console.log('[ChunkDownload] Decoded length:', decoded.length);
      console.log('[ChunkDownload] First 100 chars:', decoded.substring(0, 100));
      console.log('[ChunkDownload] Last 100 chars:', decoded.substring(decoded.length - 100));
      
      // Validate JSON
      try {
        const parsed = JSON.parse(decoded);
        console.log('[ChunkDownload] JSON validation successful');
      } catch (jsonError) {
        console.error('[ChunkDownload] Invalid JSON after decode:', jsonError);
        console.error('[ChunkDownload] Last 500 chars to check for truncation:', decoded.substring(decoded.length - 500));
        
        // Try to find where JSON ends
        const lastBrace = decoded.lastIndexOf('}');
        if (lastBrace !== decoded.length - 1) {
          console.error('[ChunkDownload] JSON appears truncated. Last } at position:', lastBrace, 'of', decoded.length);
        }
      }
      
      return decoded;
    } catch (decodeError) {
      console.error('[ChunkDownload] Base64 decode error:', decodeError);
      console.error('[ChunkDownload] First chunk sample:', chunks[0]?.substring(0, 100));
      throw new Error('Failed to decode chunks from base64');
    }
    
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
  rootTxId?: string,
  dataType: string = 'clay-project'
): Promise<string> {
  const manifest = {
    projectId,
    projectName,
    chunkSetId,
    totalChunks,
    chunks: transactionIds,
    createdAt: new Date().toISOString()
  };
  
  const manifestDataType = dataType === 'clay-project' ? 'clay-project-manifest' : `${dataType}-manifest`;
  
  const tags = [
    { name: 'App-Name', value: 'GetClayed' },
    { name: 'Data-Type', value: manifestDataType },
    { name: 'Project-ID', value: projectId },
    { name: 'Project-Name', value: projectName },
    { name: 'Author', value: walletAddress.toLowerCase() },
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
  // Use fixed key uploader for manifest
  const receipt = await fixedKeyUploader.upload(uploadData, tags);
  
  return receipt.id;
}
