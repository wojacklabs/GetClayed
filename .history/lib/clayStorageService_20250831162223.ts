import * as THREE from 'three';
import pako from 'pako';
import { uploadToIrys } from './irys';

export interface ClayData {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  color: string;
  geometry: {
    vertices: Float32Array;
    normals: Float32Array;
    indices?: Uint16Array;
  };
  shape?: string;
  thickness?: number;
  controlPoints?: THREE.Vector3[];
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
}

/**
 * Serialize clay objects to a compact format for storage
 */
export function serializeClayProject(
  clays: any[], 
  projectName: string,
  description: string = '',
  author: string,
  tags: string[] = []
): ClayProject {
  const serializedClays: ClayData[] = clays.map((clay) => {
    const geometry = clay.geometry;
    
    // Get vertex data
    const vertices = geometry.attributes.position.array;
    const normals = geometry.attributes.normal.array;
    const indices = geometry.index ? geometry.index.array : undefined;
    
    // Safely handle position, rotation, and scale
    const position = clay.position?.clone ? clay.position.clone() : 
                    clay.position ? new THREE.Vector3(clay.position.x, clay.position.y, clay.position.z) :
                    new THREE.Vector3();
    
    const rotation = clay.rotation?.clone ? clay.rotation.clone() :
                    clay.rotation ? new THREE.Euler(clay.rotation.x || 0, clay.rotation.y || 0, clay.rotation.z || 0) :
                    new THREE.Euler();
    
    const scale = clay.scale?.clone ? clay.scale.clone() :
                 clay.scale ? new THREE.Vector3(clay.scale.x || 1, clay.scale.y || 1, clay.scale.z || 1) :
                 new THREE.Vector3(1, 1, 1);
    
    return {
      id: clay.id,
      position,
      rotation,
      scale,
      color: clay.color,
      geometry: {
        vertices: new Float32Array(vertices),
        normals: new Float32Array(normals),
        indices: indices ? new Uint16Array(indices) : undefined
      },
      shape: clay.shape,
      thickness: clay.thickness,
      controlPoints: clay.controlPoints?.map(p => 
        p?.clone ? p.clone() : 
        p ? new THREE.Vector3(p.x, p.y, p.z) : 
        new THREE.Vector3()
      )
    };
  });
  
  const project: ClayProject = {
    id: `clay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: projectName,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    author,
    clays: serializedClays,
    tags
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
  folder?: string
): Promise<string> {
  const compressed = compressClayProject(project);
  
  const tags = [
    { name: 'Content-Type', value: 'application/gzip' },
    { name: 'App-Name', value: 'GetClayed' },
    { name: 'Data-Type', value: 'clay-project' },
    { name: 'Project-Name', value: project.name },
    { name: 'Author', value: project.author },
    { name: 'Created-At', value: project.createdAt.toString() },
    { name: 'Version', value: '1.0' }
  ];
  
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
  
  const receipt = await uploadToIrys(irysUploader, compressed, tags);
  return receipt.id;
}

/**
 * Download clay project from Irys
 */
export async function downloadClayProject(transactionId: string): Promise<ClayProject> {
  const url = `${process.env.NEXT_PUBLIC_IRYS_GATEWAY_URL || 'https://gateway.irys.xyz'}/${transactionId}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download project: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  return decompressClayProject(data);
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
 * Restore clay objects from project data
 */
export function restoreClayObjects(project: ClayProject): any[] {
  return project.clays.map((clayData) => {
    // Create BufferGeometry
    const geometry = new THREE.BufferGeometry();
    
    // Set attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(clayData.geometry.vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(clayData.geometry.normals, 3));
    
    if (clayData.geometry.indices) {
      geometry.setIndex(new THREE.BufferAttribute(clayData.geometry.indices, 1));
    }
    
    // Restore clay object
    return {
      id: clayData.id,
      position: clayData.position?.clone ? clayData.position.clone() : 
               new THREE.Vector3(clayData.position?.x || 0, clayData.position?.y || 0, clayData.position?.z || 0),
      rotation: clayData.rotation?.clone ? clayData.rotation.clone() :
               new THREE.Euler(clayData.rotation?.x || 0, clayData.rotation?.y || 0, clayData.rotation?.z || 0),
      scale: clayData.scale?.clone ? clayData.scale.clone() :
              new THREE.Vector3(clayData.scale?.x || 1, clayData.scale?.y || 1, clayData.scale?.z || 1),
      color: clayData.color,
      geometry,
      shape: clayData.shape,
      thickness: clayData.thickness,
      controlPoints: clayData.controlPoints?.map(p => 
        p?.clone ? p.clone() : 
        p ? new THREE.Vector3(p.x, p.y, p.z) : 
        new THREE.Vector3()
      )
    };
  });
}
