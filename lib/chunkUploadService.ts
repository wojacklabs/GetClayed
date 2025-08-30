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

// FIX P1-10: Upload progress tracking
interface UploadProgress {
  projectId: string;
  chunkSetId: string;
  uploadedChunks: Array<{ index: number; txId: string }>;
  totalChunks: number;
  startedAt: number;
  base64Hash: string; // Hash to verify data hasn't changed
}

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
 * Simple hash function for data verification
 */
function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(data.length, 1000); i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Upload data in chunks if it exceeds 100KB
 * FIX P1-10: Supports resuming interrupted uploads
 */
export async function uploadInChunks(
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
  const base64Data = Buffer.from(data, 'utf-8').toString('base64');
  const dataHash = simpleHash(base64Data);
  
  console.log(`[ChunkUpload] Splitting data into ${totalChunks} chunks`);
  
  // FIX P1-10: Check for existing upload progress
  const progressKey = `upload-progress-${projectId}`;
  let progress: UploadProgress | null = null;
  let chunkSetId: string;
  
  try {
    const savedProgress = localStorage.getItem(progressKey);
    if (savedProgress) {
      const parsed: UploadProgress = JSON.parse(savedProgress);
      
      // Verify data hasn't changed
      if (parsed.base64Hash === dataHash && parsed.totalChunks === totalChunks) {
        progress = parsed;
        chunkSetId = parsed.chunkSetId;
        console.log(`[ChunkUpload] Resuming upload: ${parsed.uploadedChunks.length}/${totalChunks} chunks already uploaded`);
      } else {
        console.log('[ChunkUpload] Data changed, starting fresh upload');
        localStorage.removeItem(progressKey);
        chunkSetId = uuidv4();
      }
    } else {
      chunkSetId = uuidv4();
    }
  } catch (error) {
    console.warn('[ChunkUpload] Could not load progress, starting fresh:', error);
    chunkSetId = uuidv4();
  }
  
  // Initialize or use existing progress
  if (!progress) {
    progress = {
      projectId,
      chunkSetId,
      uploadedChunks: [],
      totalChunks,
      startedAt: Date.now(),
      base64Hash: dataHash
    };
  }
  
  const transactionIds: string[] = new Array(totalChunks);
  const chunkMetadata: ChunkMetadata[] = [];
  
  // Build map of already uploaded chunks
  const uploadedMap = new Map<number, string>();
  progress.uploadedChunks.forEach(chunk => {
    uploadedMap.set(chunk.index, chunk.txId);
    transactionIds[chunk.index] = chunk.txId;
  });
  
  for (let i = 0; i < chunks.length; i++) {
    // FIX P1-10: Skip already uploaded chunks
    if (uploadedMap.has(i)) {
      console.log(`[ChunkUpload] Skipping chunk ${i + 1}/${totalChunks} (already uploaded: ${uploadedMap.get(i)})`);
      chunkMetadata.push({
        chunkId: uploadedMap.get(i)!,
        chunkIndex: i,
        totalChunks,
        chunkSetId,
        projectId,
        rootTxId
      });
      
      // Still update progress for user feedback
      if (onProgress) {
        onProgress({
          currentChunk: i + 1,
          totalChunks,
          percentage: ((i + 1) / totalChunks) * 100
        });
      }
      continue;
    }
    
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
    
    transactionIds[i] = receipt.id;
    chunkMetadata.push({
      chunkId: receipt.id,
      chunkIndex,
      totalChunks,
      chunkSetId,
      projectId,
      rootTxId
    });
    
    // FIX P1-10: Save progress after each chunk
    progress!.uploadedChunks.push({ index: i, txId: receipt.id });
    try {
      localStorage.setItem(progressKey, JSON.stringify(progress));
    } catch (storageError) {
      console.warn('[ChunkUpload] Could not save progress:', storageError);
      // Continue anyway - upload is more important than progress tracking
    }
    
    console.log(`[ChunkUpload] Uploaded chunk ${i + 1}/${totalChunks}, TX: ${receipt.id}`);
  }
  
  // FIX P1-10: Clear progress after successful upload
  try {
    localStorage.removeItem(progressKey);
    console.log('[ChunkUpload] Upload complete, progress cleared');
  } catch (error) {
    console.warn('[ChunkUpload] Could not clear progress:', error);
  }
  
  return { transactionIds, chunkMetadata };
}

/**
 * Download and reassemble chunks
 * FIX P1-9: Optimized for large projects with batched downloads and memory management
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
      
      // FIX P1-9: Download in batches to reduce memory pressure
      const BATCH_SIZE = 5; // Download 5 chunks at a time
      
      for (let batchStart = 0; batchStart < chunkIds.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, chunkIds.length);
        const batchIds = chunkIds.slice(batchStart, batchEnd);
        
        console.log(`[ChunkDownload] Downloading batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunkIds.length / BATCH_SIZE)} (chunks ${batchStart + 1}-${batchEnd})`);
        
        // Download batch in parallel
        const batchPromises = batchIds.map(async (txId, batchIndex) => {
          const i = batchStart + batchIndex;
          try {
            const chunkResponse = await fetch(`https://uploader.irys.xyz/tx/${txId}/data`);
            const chunkData = await chunkResponse.json();
            
            if (!chunkData.chunk) {
              throw new Error(`Chunk ${i} data is missing`);
            }
            return { index: i, chunk: chunkData.chunk };
          } catch (error) {
            console.error(`[ChunkDownload] Error downloading chunk ${i}:`, error);
            throw error;
          }
        });
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Store results
        for (const result of batchResults) {
          chunks[result.index] = result.chunk;
          foundChunks++;
          console.log(`[ChunkDownload] Downloaded chunk ${result.index + 1}/${totalChunks} - Length: ${result.chunk.length}`);
          
          // Report progress
          if (onProgress) {
            onProgress({
              currentChunk: foundChunks,
              totalChunks: totalChunks,
              percentage: (foundChunks / totalChunks) * 100
            });
          }
        }
        
        // FIX P1-9: Allow garbage collection between batches
        if (batchEnd < chunkIds.length && typeof window !== 'undefined') {
          await new Promise(resolve => setTimeout(resolve, 100));
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
  projectId: string,
  projectName: string,
  chunkSetId: string,
  totalChunks: number,
  transactionIds: string[],
  walletAddress: string,
  folder: string,
  rootTxId?: string,
  dataType: string = 'clay-project',
  thumbnailId?: string,
  ownershipData?: {
    originalCreator?: string;
    transferredFrom?: string;
    transferredAt?: number;
    transferCount?: number;
  }
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
  
  if (thumbnailId) {
    tags.push({ name: 'Thumbnail-ID', value: thumbnailId });
  }
  
  // Add ownership transfer tags if provided
  if (ownershipData) {
    if (ownershipData.originalCreator) {
      tags.push({ name: 'Original-Creator', value: ownershipData.originalCreator.toLowerCase() });
    }
    if (ownershipData.transferredFrom) {
      tags.push({ name: 'Transferred-From', value: ownershipData.transferredFrom.toLowerCase() });
    }
    if (ownershipData.transferredAt) {
      tags.push({ name: 'Transferred-At', value: ownershipData.transferredAt.toString() });
    }
    if (ownershipData.transferCount) {
      tags.push({ name: 'Transfer-Count', value: ownershipData.transferCount.toString() });
    }
  }
  
  const uploadData = Buffer.from(JSON.stringify(manifest), 'utf-8');
  // Use fixed key uploader for manifest
  const receipt = await fixedKeyUploader.upload(uploadData, tags);
  
  return receipt.id;
}
