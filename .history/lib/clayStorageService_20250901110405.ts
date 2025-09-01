import * as THREE from 'three';
import pako from 'pako';
import { uploadToIrys } from './irys';

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
  
  // Log data size
  const sizeInKB = compressed.byteLength / 1024;
  console.log(`[uploadClayProject] Compressed data size: ${sizeInKB.toFixed(2)} KB`);
  if (sizeInKB < 100) {
    console.log('[uploadClayProject] Data is under 100KB - Irys upload will be free!');
  }
  
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
