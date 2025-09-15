import * as THREE from 'three';
import pako from 'pako';
import { uploadToIrys, createIrysUploader } from './irys';
import axios from 'axios';
import { uploadInChunks, downloadChunks, uploadChunkManifest, ChunkUploadProgress } from './chunkUploadService';
import { v4 as uuidv4 } from 'uuid';
import { fixedKeyUploader } from './fixedKeyUploadService';

export interface ClayData {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: string;
  shape: string;
  size?: number; // For sphere, tetrahedron, cube
  thickness?: number; // For custom thickness
  controlPoints?: Array<{ x: number; y: number; z: number }>; // For line, curve, shapes
  detail?: number; // For sphere detail level
  vertices?: Array<{ x: number; y: number; z: number }>; // For push/pull deformed vertices
}

export interface ClayProject {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  author: string;
  clays: ClayData[];
  tags?: string[];
  backgroundColor?: string;
  thumbnailId?: string; // Transaction ID for the thumbnail
}

/**
 * Serialize clay objects to a compact format for storage
 */
export function serializeClayProject(
  clays: any[], 
  projectName: string,
  description: string = '',
  author: string,
  tags: string[] = [],
  backgroundColor?: string
): ClayProject {
  const serializedClays: ClayData[] = clays.map((clay) => {
    // Extract only essential data for recreation
    const clayData: ClayData = {
      id: clay.id,
      position: {
        x: Math.round((clay.position?.x || 0) * 10000) / 10000,
        y: Math.round((clay.position?.y || 0) * 10000) / 10000,
        z: Math.round((clay.position?.z || 0) * 10000) / 10000
      },
      rotation: {
        x: Math.round((clay.rotation?.x || 0) * 10000) / 10000,
        y: Math.round((clay.rotation?.y || 0) * 10000) / 10000,
        z: Math.round((clay.rotation?.z || 0) * 10000) / 10000
      },
      scale: {
        x: clay.scale?.x || 1,
        y: clay.scale?.y || 1,
        z: clay.scale?.z || 1
      },
      color: clay.color,
      shape: clay.shape || 'sphere'
    };
    
    // Add shape-specific parameters
    if (clay.size !== undefined) {
      clayData.size = clay.size;
    }
    if (clay.thickness !== undefined) {
      clayData.thickness = clay.thickness;
    }
    if (clay.detail !== undefined) {
      clayData.detail = clay.detail;
    }
    if (clay.controlPoints) {
      clayData.controlPoints = clay.controlPoints.map((p: any) => ({
        x: p.x || 0,
        y: p.y || 0,
        z: p.z || 0
      }));
    }
    
    // Save deformed vertices if geometry has been modified by push/pull
    if (clay.geometry && clay.geometry.attributes && clay.geometry.attributes.position) {
      // Double check if this is truly a deformed geometry
      const isDeformed = clay.geometry.userData?.deformed === true && 
                        clay.geometry.userData?.originalShape !== undefined;
      
      if (isDeformed) {
        console.log(`[serializeClayProject] Clay ${clay.id} is marked as deformed, checking if vertices changed...`);
        
        // Additional check: only save vertices if they're actually different from original
        // For now, trust the deformed flag but log for debugging
        const positions = clay.geometry.attributes.position.array;
        const vertexCount = positions.length / 3;
        
        // Only save vertices for reasonably sized geometries
        if (vertexCount > 10000) {
          console.warn(`[serializeClayProject] Clay ${clay.id} has ${vertexCount} vertices - too large, skipping vertex data`);
          // You might want to implement vertex reduction or compression here
        } else {
          const vertices = [];
          
          // Save vertices with reduced precision
          for (let i = 0; i < positions.length; i += 3) {
            vertices.push({
              x: Math.round(positions[i] * 1000) / 1000,
              y: Math.round(positions[i + 1] * 1000) / 1000,
              z: Math.round(positions[i + 2] * 1000) / 1000
            });
          }
          clayData.vertices = vertices;
          console.log(`[serializeClayProject] Saved ${vertices.length} deformed vertices for clay ${clay.id}`);
        }
      } else {
        // For non-deformed geometries, just save the parameters
        if (clay.geometry.userData?.deformed === true) {
          console.warn(`[serializeClayProject] Clay ${clay.id} has deformed flag but missing originalShape - treating as non-deformed`);
          // Clear the incorrect flag
          clay.geometry.userData.deformed = false;
        }
      }
    }
    
    return clayData;
  });
  
  const project: ClayProject = {
    id: `clay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: projectName,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    author,
    clays: serializedClays,
    tags,
    backgroundColor
  };
  
  return project;
}

/**
 * Compress and prepare clay project for upload
 */
export function compressClayProject(project: ClayProject): Uint8Array {
  const jsonString = JSON.stringify(project);
  const compressed = pako.gzip(jsonString);
  return compressed;
}

/**
 * Decompress clay project data
 */
export function decompressClayProject(data: Uint8Array): ClayProject {
  const decompressed = pako.ungzip(data, { to: 'string' });
  return JSON.parse(decompressed);
}

/**
 * Upload thumbnail to Irys
 */
export async function uploadProjectThumbnail(
  thumbnailDataUrl: string,
  projectId: string
): Promise<string | null> {
  try {
    const uploader = await createIrysUploader();
    if (!uploader) return null;
    
    // Convert data URL to buffer
    const base64Data = thumbnailDataUrl.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Direct upload thumbnails (they should be compressed already)
    const tags = [
      { name: 'Content-Type', value: 'image/jpeg' },
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'project-thumbnail' },
      { name: 'Project-ID', value: projectId }
    ];
    
    const receipt = await uploader.upload(buffer, { tags });
    return receipt.id;
  } catch (error) {
    console.error('[ClayStorage] Error uploading thumbnail:', error);
    return null;
  }
}

/**
 * Download thumbnail from Irys
 */
export async function downloadProjectThumbnail(thumbnailId: string): Promise<string | null> {
  try {
    if (!thumbnailId) return null;
    
    // Direct download (thumbnails are not chunked)
    const url = `https://uploader.irys.xyz/tx/${thumbnailId}/data`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('[ClayStorage] Failed to download thumbnail:', response.status);
      return null;
    }
    
    const data = await response.arrayBuffer();
    const buffer = Buffer.from(data);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('[ClayStorage] Error downloading thumbnail:', error);
    return null;
  }
}

/**
 * Upload clay project to Irys
 */
export async function uploadClayProject(
  irysUploader: any,
  project: ClayProject,
  folder?: string,
  rootTxId?: string,
  onProgress?: (progress: ChunkUploadProgress) => void,
  thumbnailId?: string
): Promise<{ transactionId: string; rootTxId: string; isUpdate: boolean; wasChunked: boolean }> {
  // Convert to JSON without compression
  const jsonString = JSON.stringify(project);
  const data = Buffer.from(jsonString, 'utf-8');
  
  // Log data size
  const sizeInKB = data.byteLength / 1024;
  console.log(`[uploadClayProject] JSON data size: ${sizeInKB.toFixed(2)} KB`);
  
  const isUpdate = !!rootTxId;
  let wasChunked = false;
  
  if (sizeInKB < 90) {
    console.log('[uploadClayProject] Data is under 90KB - Irys upload will be free!');
  
  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'App-Name', value: 'GetClayed' },
    { name: 'Data-Type', value: 'clay-project' },
    { name: 'Project-Name', value: project.name },
    { name: 'Project-ID', value: project.id },
    { name: 'Author', value: project.author.toLowerCase() },
    { name: 'Created-At', value: project.createdAt.toString() },
    { name: 'Updated-At', value: Date.now().toString() },
    { name: 'Version', value: '2.0' },
    { name: 'File-Extension', value: '.clay.json' }
  ];
  
  // Add Root-TX tag if this is an update
  if (isUpdate && rootTxId) {
    tags.push({ name: 'Root-TX', value: rootTxId });
    console.log(`[uploadClayProject] Updating existing project: Root-TX=${rootTxId}`);
  } else {
    console.log('[uploadClayProject] Creating new project');
  }
  
  // Add folder tag if specified
  if (folder) {
    tags.push({ name: 'Folder', value: folder });
  }
  
  // Add thumbnail tag if provided
  if (thumbnailId) {
    tags.push({ name: 'Thumbnail-ID', value: thumbnailId });
  }
  
  // Add project tags
  if (project.tags && project.tags.length > 0) {
    project.tags.forEach((tag, index) => {
      tags.push({ name: `Tag-${index}`, value: tag });
    });
  }
  
  // Use fixed key uploader instead of user's wallet
  const receipt = await fixedKeyUploader.upload(data, tags);
  
  // Return the rootTxId (either existing or new transaction ID)
  const finalRootTxId = rootTxId || receipt.id;
  
    return {
      transactionId: receipt.id,
      rootTxId: finalRootTxId,
      isUpdate,
      wasChunked: false
    };
  } else {
    // Chunked upload for large files (over 90KB)
    wasChunked = true;
    console.log(`[uploadClayProject] Data is ${sizeInKB.toFixed(2)} KB (over 90KB limit) - Using chunked upload`);
    
    // Upload chunks
    const { transactionIds, chunkMetadata } = await uploadInChunks(
      irysUploader,
      jsonString,
      project.id,
      project.name,
      project.author,
      folder || '',
      rootTxId,
      onProgress
    );
    
    // Get chunkSetId from the first chunk metadata
    const chunkSetId = chunkMetadata[0]?.chunkSetId;
    if (!chunkSetId) {
      throw new Error('No chunk set ID found in chunk metadata');
    }
    
    // Upload manifest
    const manifestTxId = await uploadChunkManifest(
      irysUploader,
      project.id,
      project.name,
      chunkSetId,
      chunkMetadata.length,
      transactionIds,
      project.author,
      folder || '',
      rootTxId
    );
    
    const finalRootTxId = rootTxId || manifestTxId;
    
    console.log('[uploadClayProject] Chunked upload successful');
    console.log('[uploadClayProject] Manifest TX:', manifestTxId);
    console.log('[uploadClayProject] Total chunks:', chunkMetadata.length);
    
    return { 
      transactionId: manifestTxId, 
      rootTxId: finalRootTxId,
      isUpdate,
      wasChunked: true
    };
  }
}

/**
 * Download clay project from Irys
 */
export async function downloadClayProject(
  transactionId: string,
  onProgress?: (progress: { currentChunk: number; totalChunks: number; percentage: number }) => void
): Promise<ClayProject> {
  try {
    console.log('[downloadClayProject] Downloading from transaction:', transactionId)
    
    // Import mutable sync service
    const { getProjectLatestTxId } = await import('./mutableSyncService');
    
    // Try to get the latest transaction ID from mutable reference
    const latestTxId = await getProjectLatestTxId(transactionId);
    const txIdToUse = latestTxId || transactionId;
    
    console.log('[downloadClayProject] Using transaction ID:', txIdToUse)
    
    const directUrl = `https://uploader.irys.xyz/tx/${txIdToUse}/data`;
    console.log('[downloadClayProject] Downloading from:', directUrl)
    
    const response = await fetch(directUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download project: ${response.statusText}`);
    }
    
    const jsonString = await response.text();
    const data = JSON.parse(jsonString);
    console.log('[downloadClayProject] Downloaded data:', data)
    
    // Check if this is a chunk manifest
    if (data.chunkSetId && data.totalChunks && data.chunks) {
      console.log('[downloadClayProject] Detected chunk manifest, downloading chunks...');
      console.log('[downloadClayProject] Chunk set ID:', data.chunkSetId);
      console.log('[downloadClayProject] Total chunks:', data.totalChunks);
      
      // Download and reassemble chunks
      // Pass chunk IDs directly to handle indexing delays
      const reassembled = await downloadChunks(data.chunkSetId, data.totalChunks, data.chunks, onProgress);
      
      try {
        const project = JSON.parse(reassembled);
        console.log('[downloadClayProject] Successfully reassembled chunked project');
        return project;
      } catch (parseError) {
        console.error('[downloadClayProject] Failed to parse reassembled JSON:', parseError);
        console.error('[downloadClayProject] Reassembled string length:', reassembled.length);
        console.error('[downloadClayProject] First 200 chars:', reassembled.substring(0, 200));
        
        // Check if this is image data mistakenly uploaded as a project
        if (reassembled.startsWith('iVBORw0KGgo') || reassembled.startsWith('data:image')) {
          console.error('[downloadClayProject] This appears to be image data, not a clay project');
          throw new Error('This transaction contains image data, not a clay project. The project may have been corrupted during upload.');
        }
        
        console.error('[downloadClayProject] Last 200 chars:', reassembled.substring(reassembled.length - 200));
        throw new Error('Failed to parse reassembled project data');
      }
    }
    
    // Regular project data
    return data as ClayProject;
  } catch (error) {
    console.error('[downloadClayProject] Error:', error)
    throw error;
  }
}

/**
 * Query clay projects by tags
 */
export async function queryClayProjects(
  author?: string,
  folder?: string,
  tags?: string[]
): Promise<Array<{ id: string; tags: Record<string, string> }>> {
  const queryUrl = new URL('https://uploader.irys.xyz/graphql');
  
  let tagFilters = [
    { name: 'App-Name', values: ['GetClayed'] },
    { name: 'Data-Type', values: ['clay-project'] }
  ];
  
  if (author) {
    tagFilters.push({ name: 'Author', values: [author] });
  }
  
  if (folder) {
    tagFilters.push({ name: 'Folder', values: [folder] });
  }
  
  if (tags && tags.length > 0) {
    tags.forEach((tag, index) => {
      tagFilters.push({ name: `Tag-${index}`, values: [tag] });
    });
  }
  
  const query = {
    query: `
      query {
        transactions(
          tags: ${JSON.stringify(tagFilters)}
          first: 100
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
    `
  };
  
  const response = await fetch(queryUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(query)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to query projects: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  return result.data.transactions.edges.map((edge: any) => {
    const tags: Record<string, string> = {};
    edge.node.tags.forEach((tag: any) => {
      tags[tag.name] = tag.value;
    });
    
    return {
      id: edge.node.id,
      tags
    };
  });
}

/**
 * Download project as JSON file
 */
export function downloadProjectAsJSON(project: ClayProject) {
  const jsonString = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}.clay.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}

/**
 * Mark project as deleted (soft delete via tags)
 */
export async function deleteClayProject(
  irysUploader: any,
  projectId: string,
  walletAddress: string
): Promise<string> {
  // Create a deletion marker
  const deletionMarker = {
    projectId,
    deletedAt: Date.now(),
    deletedBy: walletAddress
  };
  
  const data = Buffer.from(JSON.stringify(deletionMarker), 'utf-8');
  
  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'App-Name', value: 'GetClayed' },
    { name: 'Data-Type', value: 'clay-project-deletion' },
    { name: 'Project-ID', value: projectId },
    { name: 'Deleted-By', value: walletAddress },
    { name: 'Deleted-At', value: Date.now().toString() }
  ];
  
  const receipt = await uploadToIrys(irysUploader, data, tags);
  return receipt.id;
}

/**
 * Restore clay objects from project data
 */
export function restoreClayObjects(project: ClayProject, detail: number = 48): any[] {
  return project.clays.map((clayData) => {
    let geometry: THREE.BufferGeometry;
    
    // Recreate geometry based on shape
    switch (clayData.shape) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(
          clayData.size || 2,
          clayData.detail || detail,
          clayData.detail || detail
        );
        break;
        
      case 'tetrahedron':
        geometry = new THREE.TetrahedronGeometry(clayData.size || 2);
        break;
        
      case 'cube':
        geometry = new THREE.BoxGeometry(
          clayData.size || 2,
          clayData.size || 2,
          (clayData.size || 2) * (clayData.thickness || 1)
        );
        break;
        
      case 'line':
      case 'curve':
        if (clayData.controlPoints && clayData.controlPoints.length >= 2) {
          const points = clayData.controlPoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
          
          if (clayData.shape === 'line') {
            const curve = new THREE.LineCurve3(points[0], points[1]);
            geometry = new THREE.TubeGeometry(curve, 20, clayData.thickness || 0.1, 8, false);
          } else {
            // Curve
            const midPoint = clayData.controlPoints[2] ? 
              new THREE.Vector3(clayData.controlPoints[2].x, clayData.controlPoints[2].y, clayData.controlPoints[2].z) :
              points[0].clone().add(points[1]).multiplyScalar(0.5);
            const curve = new THREE.QuadraticBezierCurve3(points[0], midPoint, points[1]);
            geometry = new THREE.TubeGeometry(curve, 20, clayData.thickness || 0.1, 8, false);
          }
        } else {
          geometry = new THREE.SphereGeometry(1, detail, detail); // Fallback
        }
        break;
        
      case 'rectangle':
      case 'triangle':
      case 'circle':
        // 2D shapes
        let shape;
        if (clayData.shape === 'rectangle') {
          shape = new THREE.Shape();
          const width = clayData.size || 2;
          const height = clayData.size || 2;
          shape.moveTo(-width/2, -height/2);
          shape.lineTo(width/2, -height/2);
          shape.lineTo(width/2, height/2);
          shape.lineTo(-width/2, height/2);
          shape.closePath();
          geometry = new THREE.ShapeGeometry(shape);
        } else if (clayData.shape === 'triangle') {
          shape = new THREE.Shape();
          const size = clayData.size || 2;
          shape.moveTo(0, -size/2);
          shape.lineTo(-size/2, size/2);
          shape.lineTo(size/2, size/2);
          shape.closePath();
          geometry = new THREE.ShapeGeometry(shape);
        } else {
          geometry = new THREE.CircleGeometry(clayData.size || 1, 32);
        }
        break;
        
      default:
        geometry = new THREE.SphereGeometry(clayData.size || 2, detail, detail);
        break;
    }
    
    // Restore deformed vertices if they exist
    if (clayData.vertices && clayData.vertices.length > 0) {
      console.log(`[restoreClayObjects] Restoring ${clayData.vertices.length} deformed vertices for clay ${clayData.id}`);
      
      const positions = geometry.attributes.position.array;
      const vertexCount = Math.min(clayData.vertices.length, positions.length / 3);
      
      for (let i = 0; i < vertexCount; i++) {
        positions[i * 3] = clayData.vertices[i].x;
        positions[i * 3 + 1] = clayData.vertices[i].y;
        positions[i * 3 + 2] = clayData.vertices[i].z;
      }
      
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      
      // Mark geometry as deformed
      geometry.userData.deformed = true;
    }
    
    // Restore clay object
    return {
      id: clayData.id,
      position: new THREE.Vector3(clayData.position.x, clayData.position.y, clayData.position.z),
      rotation: new THREE.Euler(clayData.rotation.x, clayData.rotation.y, clayData.rotation.z),
      scale: new THREE.Vector3(clayData.scale.x, clayData.scale.y, clayData.scale.z),
      color: clayData.color,
      geometry,
      shape: clayData.shape,
      size: clayData.size,
      thickness: clayData.thickness,
      detail: clayData.detail,
      controlPoints: clayData.controlPoints?.map(p => new THREE.Vector3(p.x, p.y, p.z))
    };
  });
}

/**
 * Query all clay projects from Irys
 */
export async function queryAllProjects(
  limit: number = 100
): Promise<Array<{
  id: string;
  name: string;
  author: string;
  timestamp: number;
  folderPath: string;
  tags: Record<string, string>;
}>> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    console.log('[ClayStorage] Querying all community projects');
    
    const projectTags = [
      { name: 'App-Name', values: ['GetClayed'] },
      { name: 'Data-Type', values: ['clay-project', 'clay-project-manifest'] }
    ];
    
    const projectQuery = `
      query {
        transactions(
          tags: [${projectTags.map(tag => 
            `{ name: "${tag.name}", values: ${JSON.stringify(tag.values)} }`
          ).join(', ')}],
          first: ${limit},
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
    
    const projectResponse = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: projectQuery }),
    });
    
    if (!projectResponse.ok) {
      throw new Error(`GraphQL request failed: ${projectResponse.statusText}`);
    }
    
    const projectData = await projectResponse.json();
    const projectEdges = projectData?.data?.transactions?.edges || [];
    
    // Process projects
    const projectMap = new Map<string, any>();
    
    for (const edge of projectEdges) {
      const node = edge.node;
      const tags = node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      // Skip if it's a chunk
      if (tags['Data-Type'] === 'clay-project-chunk') {
        continue;
      }
      
      const projectId = tags['Project-ID'] || node.id;
      const rootTxId = tags['Root-TX'];
      
      // If this has a Root-TX, it's an update
      if (rootTxId) {
        // Check if we already have the root project
        if (!projectMap.has(rootTxId)) {
          projectMap.set(rootTxId, {
            id: node.id,
            name: tags['Project-Name'] || 'Untitled',
            author: tags['Author'] || '',
            timestamp: node.timestamp,
            folderPath: tags['Folder'] || '/',
            tags: tags
          });
        } else {
          // Update the existing entry if this is newer
          const existing = projectMap.get(rootTxId);
          if (node.timestamp > existing.timestamp) {
            existing.id = node.id;
            existing.name = tags['Project-Name'] || existing.name;
            existing.timestamp = node.timestamp;
            existing.tags = tags;
          }
        }
      } else {
        // This is an original project
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            id: node.id,
            name: tags['Project-Name'] || 'Untitled',
            author: tags['Author'] || '',
            timestamp: node.timestamp,
            folderPath: tags['Folder'] || '/',
            tags: tags
          });
        }
      }
    }
    
    const projects = Array.from(projectMap.values());
    projects.sort((a, b) => b.timestamp - a.timestamp);
    
    return projects;
  } catch (error) {
    console.error('[ClayStorage] Error querying all projects:', error);
    return [];
  }
}

/**
 * Query user's clay projects from Irys
 */
export async function queryUserProjects(
  walletAddress: string,
  folderPath?: string
): Promise<Array<{
  id: string;
  name: string;
  author: string;
  timestamp: number;
  folderPath: string;
  tags: Record<string, string>;
}>> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    console.log('[ClayStorage] Querying projects for wallet:', walletAddress);
    
    // First, query all projects
    const projectTags = [
      { name: 'App-Name', values: ['GetClayed'] },
      { name: 'Data-Type', values: ['clay-project', 'clay-project-manifest'] },
      { name: 'Author', values: [walletAddress.toLowerCase()] }
    ];
    
    if (folderPath && folderPath !== '/') {
      projectTags.push({ name: 'Folder', values: [folderPath] });
    }
    
    const projectQuery = `
      query {
        transactions(
          tags: [${projectTags.map(tag => 
            `{ name: "${tag.name}", values: ${JSON.stringify(tag.values)} }`
          ).join(', ')}],
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
    
    const projectResponse = await axios.post(IRYS_GRAPHQL_URL, { 
      query: projectQuery 
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!projectResponse.data?.data?.transactions?.edges) {
      console.error('[ClayStorage] Invalid response structure:', projectResponse.data);
      return [];
    }
    
    // Then, query all deletions
    const deletionQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project-deletion"] },
            { name: "Deleted-By", values: ["${walletAddress}"] }
          ],
          first: 100,
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
    
    const deletionResponse = await axios.post(IRYS_GRAPHQL_URL, { 
      query: deletionQuery 
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    // Extract deleted project IDs
    const deletedProjectIds = new Set<string>();
    if (deletionResponse.data?.data?.transactions?.edges) {
      deletionResponse.data.data.transactions.edges.forEach((edge: any) => {
        const tags: Record<string, string> = {};
        edge.node.tags.forEach((tag: any) => {
          tags[tag.name] = tag.value;
        });
        if (tags['Project-ID']) {
          deletedProjectIds.add(tags['Project-ID']);
        }
      });
    }
    
    console.log(`[ClayStorage] Found ${deletedProjectIds.size} deleted projects`);
    
    // Group by project ID to find latest versions
    const projectMap = new Map<string, any>();
    
    console.log(`[ClayStorage] Processing ${projectResponse.data.data.transactions.edges.length} transactions`);
    
    projectResponse.data.data.transactions.edges.forEach((edge: any) => {
      const tags: Record<string, string> = {};
      edge.node.tags.forEach((tag: any) => {
        tags[tag.name] = tag.value;
      });
      
      const projectId = tags['Project-ID'];
      const rootTx = tags['Root-TX'];
      const dataType = tags['Data-Type'];
      
      if (!projectId) return; // Skip if no project ID
      
      // Skip deleted projects
      if (deletedProjectIds.has(edge.node.id)) return;
      
      // For manifest files, we need to show them as projects but with manifest indicator
      const isManifest = dataType === 'clay-project-manifest';
      
      if (isManifest) {
        console.log(`[ClayStorage] Found manifest: ${projectId}, TX: ${edge.node.id}`);
      }
      
      let timestamp = parseInt(tags['Created-At'] || edge.node.timestamp || '0');
      if (timestamp < 10000000000) {
        timestamp = timestamp * 1000;
      }
      
      const projectData = {
        id: edge.node.id,
        projectId,
        rootTxId: rootTx || edge.node.id,
        name: tags['Project-Name'] || 'Untitled',
        author: tags['Author'] || '',
        timestamp,
        updatedAt: parseInt(tags['Updated-At'] || tags['Created-At'] || edge.node.timestamp || '0'),
        folderPath: tags['Folder'] || '/',
        tags,
        isManifest // Add manifest indicator
      };
      
      // If this is a root transaction (no Root-TX tag), or if we don't have this project yet
      if (!rootTx || !projectMap.has(projectId)) {
        projectMap.set(projectId, projectData);
      } else {
        // Check if this is a newer version
        const existing = projectMap.get(projectId);
        if (projectData.updatedAt > existing.updatedAt) {
          projectMap.set(projectId, projectData);
        }
      }
    });
    
    // Convert map to array and use the latest transaction ID for each project
    const projects = Array.from(projectMap.values()).map(project => ({
      id: project.rootTxId, // Use root TX ID for mutable reference
      name: project.name,
      author: project.author,
      timestamp: project.timestamp,
      folderPath: project.folderPath,
      tags: project.tags
    }));
    
    console.log(`[ClayStorage] Returning ${projects.length} active projects`);
    return projects;
    
  } catch (error) {
    console.error('[ClayStorage] Error querying projects:', error);
    if (axios.isAxiosError(error)) {
      console.error('[ClayStorage] Response:', error.response?.data);
    }
    return [];
  }
}

/**
 * Get folder structure from user's projects
 */
export async function getUserFolderStructure(
  walletAddress: string
): Promise<{
  folders: Set<string>;
  projects: Array<{
    id: string;
    name: string;
    folderPath: string;
    timestamp: number;
  }>;
}> {
  const projects = await queryUserProjects(walletAddress);
  
  const folders = new Set<string>();
  folders.add('/'); // Root folder
  
  // Extract unique folder paths
  projects.forEach(project => {
    const parts = project.folderPath.split('/').filter(p => p);
    let currentPath = '';
    
    parts.forEach(part => {
      currentPath += '/' + part;
      folders.add(currentPath);
    });
  });
  
  return {
    folders,
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      folderPath: p.folderPath,
      timestamp: p.timestamp
    }))
  };
}
