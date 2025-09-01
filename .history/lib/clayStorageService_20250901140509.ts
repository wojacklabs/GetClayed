import * as THREE from 'three';
import pako from 'pako';
import { uploadToIrys } from './irys';
import axios from 'axios';

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
        x: clay.position?.x || 0,
        y: clay.position?.y || 0,
        z: clay.position?.z || 0
      },
      rotation: {
        x: clay.rotation?.x || 0,
        y: clay.rotation?.y || 0,
        z: clay.rotation?.z || 0
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
    
    // Save deformed vertices if geometry has been modified
    if (clay.geometry && clay.geometry.attributes && clay.geometry.attributes.position) {
      // Check if this is a deformed geometry by looking for userData flag
      const isDeformed = clay.geometry.userData?.deformed === true;
      
      if (isDeformed) {
        const positions = clay.geometry.attributes.position.array;
        const vertices = [];
        for (let i = 0; i < positions.length; i += 3) {
          vertices.push({
            x: positions[i],
            y: positions[i + 1],
            z: positions[i + 2]
          });
        }
        clayData.vertices = vertices;
        console.log(`[serializeClayProject] Saved ${vertices.length} deformed vertices for clay ${clay.id}`);
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
 * Upload clay project to Irys
 */
export async function uploadClayProject(
  irysUploader: any,
  project: ClayProject,
  folder?: string,
  rootTxId?: string
): Promise<{ transactionId: string; rootTxId: string; isUpdate: boolean }> {
  // Convert to JSON without compression
  const jsonString = JSON.stringify(project);
  const data = Buffer.from(jsonString, 'utf-8');
  
  // Log data size
  const sizeInKB = data.byteLength / 1024;
  console.log(`[uploadClayProject] JSON data size: ${sizeInKB.toFixed(2)} KB`);
  if (sizeInKB < 100) {
    console.log('[uploadClayProject] Data is under 100KB - Irys upload will be free!');
  }
  
  const isUpdate = !!rootTxId;
  
  const tags = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'App-Name', value: 'GetClayed' },
    { name: 'Data-Type', value: 'clay-project' },
    { name: 'Project-Name', value: project.name },
    { name: 'Project-ID', value: project.id },
    { name: 'Author', value: project.author },
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
  
  // Add project tags
  if (project.tags && project.tags.length > 0) {
    project.tags.forEach((tag, index) => {
      tags.push({ name: `Tag-${index}`, value: tag });
    });
  }
  
  const receipt = await uploadToIrys(irysUploader, data, tags);
  
  // Return the rootTxId (either existing or new transaction ID)
  const finalRootTxId = rootTxId || receipt.id;
  
  return {
    transactionId: receipt.id,
    rootTxId: finalRootTxId,
    isUpdate
  };
}

/**
 * Download clay project from Irys
 */
export async function downloadClayProject(transactionId: string): Promise<ClayProject> {
  try {
    console.log('[downloadClayProject] Downloading from transaction:', transactionId)
    
    // Try mutable reference first
    const mutableUrl = `https://gateway.irys.xyz/mutable/${transactionId}`;
    console.log('[downloadClayProject] Trying mutable URL:', mutableUrl)
    
    let response = await fetch(mutableUrl, {
      redirect: 'follow'
    });
    
    // If mutable reference fails, try direct transaction ID
    if (!response.ok) {
      console.log('[downloadClayProject] Mutable reference failed, trying direct URL')
      const directUrl = `${process.env.NEXT_PUBLIC_IRYS_GATEWAY_URL || 'https://gateway.irys.xyz'}/${transactionId}`;
      response = await fetch(directUrl);
    }
    
    if (!response.ok) {
      throw new Error(`Failed to download project: ${response.statusText}`);
    }
    
    const jsonString = await response.text();
    const data = JSON.parse(jsonString);
    console.log('[downloadClayProject] Downloaded data:', data)
    
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
  const queryUrl = new URL('https://gateway.irys.xyz/graphql');
  
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
    console.log('[ClayStorage] Folder path:', folderPath || 'root');
    
    // First, query all projects
    const projectTags = [
      { name: 'App-Name', values: ['GetClayed'] },
      { name: 'Data-Type', values: ['clay-project'] },
      { name: 'Author', values: [walletAddress] }
    ];
    
    // Also try with Type tag for backward compatibility
    const projectTagsLegacy = [
      { name: 'App-Name', values: ['GetClayed'] },
      { name: 'Type', values: ['clay-project'] },
      { name: 'Author', values: [walletAddress] }
    ];
    
    if (folderPath && folderPath !== '/') {
      projectTags.push({ name: 'Folder', values: [folderPath] });
    }
    
    // Try both queries to support old and new projects
    const projectQuery = `
      query {
        current: transactions(
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
        legacy: transactions(
          tags: [${projectTagsLegacy.map(tag => 
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
    
    // Combine results from both queries
    const allEdges = [
      ...(projectResponse.data?.data?.current?.edges || []),
      ...(projectResponse.data?.data?.legacy?.edges || [])
    ];
    
    if (allEdges.length === 0) {
      console.log('[ClayStorage] No transactions found');
      return [];
    }
    
    console.log(`[ClayStorage] Query returned ${allEdges.length} total transactions`);
    
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
    
    projectResponse.data.data.transactions.edges.forEach((edge: any, index: number) => {
      const tags: Record<string, string> = {};
      edge.node.tags.forEach((tag: any) => {
        tags[tag.name] = tag.value;
      });
      
      // Log first transaction for debugging
      if (index === 0) {
        console.log(`[ClayStorage] Sample transaction tags:`, tags);
      }
      
      const projectId = tags['Project-ID'] || edge.node.id; // Use transaction ID as fallback
      const rootTx = tags['Root-TX'];
      
      // Skip deleted projects
      if (deletedProjectIds.has(edge.node.id)) return;
      
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
        tags
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
