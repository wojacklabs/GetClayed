import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface ClayGLBMetadata {
  id: string;
  name: string;
  description?: string;
  author: string;
  createdAt: number;
  tags?: string[];
  clayData?: {
    shape?: string;
    thickness?: number;
    controlPoints?: any[];
  }[];
}

/**
 * Export clay objects to GLB format
 */
export async function exportToGLB(
  clays: any[],
  metadata: Omit<ClayGLBMetadata, 'id' | 'createdAt' | 'clayData'>
): Promise<Blob> {
  // Create a scene for export
  const exportScene = new THREE.Scene();
  
  // Add metadata as userData
  const clayData: any[] = [];
  
  // Add all clay objects to the scene
  clays.forEach((clay, index) => {
    const material = new THREE.MeshStandardMaterial({
      color: clay.color,
      metalness: 0.1,
      roughness: 0.7,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(clay.geometry, material);
    mesh.position.copy(clay.position);
    mesh.rotation.copy(clay.rotation);
    mesh.scale.copy(clay.scale);
    mesh.name = `Clay_${index}`;
    
    // Store clay-specific data
    mesh.userData = {
      clayId: clay.id,
      shape: clay.shape,
      thickness: clay.thickness,
      controlPoints: clay.controlPoints
    };
    
    clayData.push({
      shape: clay.shape,
      thickness: clay.thickness,
      controlPoints: clay.controlPoints
    });
    
    exportScene.add(mesh);
  });
  
  // Add metadata to scene
  exportScene.userData = {
    ...metadata,
    id: `clay-glb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    clayData,
    generator: 'GetClayed',
    version: '1.0'
  };
  
  // Export to GLB
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    
    exporter.parse(
      exportScene,
      (result) => {
        // result is ArrayBuffer for binary GLB
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
        resolve(blob);
      },
      (error) => {
        reject(error);
      },
      {
        binary: true, // Export as GLB (binary glTF)
        embedImages: true,
        forceIndices: true,
        truncateDrawRange: false
      }
    );
  });
}

/**
 * Import clay objects from GLB file
 */
export async function importFromGLB(file: File): Promise<{
  clays: any[];
  metadata: ClayGLBMetadata;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const loader = new GLTFLoader();
        
        loader.parse(
          arrayBuffer,
          '',
          (gltf) => {
            const scene = gltf.scene;
            const metadata = scene.userData as ClayGLBMetadata;
            const clays: any[] = [];
            
            // Extract clay objects from the scene
            scene.traverse((child) => {
              if (child instanceof THREE.Mesh && child.name.startsWith('Clay_')) {
                const material = child.material as THREE.MeshStandardMaterial;
                
                // Clone geometry to avoid modifying the original
                const geometry = child.geometry.clone();
                
                // Apply transformations to geometry
                geometry.applyMatrix4(child.matrix);
                
                const clay = {
                  id: child.userData.clayId || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  geometry,
                  position: child.position.clone(),
                  rotation: child.rotation.clone(),
                  scale: child.scale.clone(),
                  color: material.color ? `#${material.color.getHexString()}` : '#ff6b6b',
                  shape: child.userData.shape,
                  thickness: child.userData.thickness,
                  controlPoints: child.userData.controlPoints
                };
                
                clays.push(clay);
              }
            });
            
            resolve({ clays, metadata });
          },
          (error) => {
            reject(new Error(`Failed to parse GLB: ${error.message}`));
          }
        );
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Download GLB file
 */
export function downloadGLB(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.glb') ? filename : `${filename}.glb`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Upload GLB to Irys
 */
export async function uploadGLBToIrys(
  irysUploader: any,
  blob: Blob,
  metadata: ClayGLBMetadata,
  folder?: string
): Promise<string> {
  const tags = [
    { name: 'Content-Type', value: 'model/gltf-binary' },
    { name: 'App-Name', value: 'GetClayed' },
    { name: 'Data-Type', value: 'clay-glb' },
    { name: 'Project-Name', value: metadata.name },
    { name: 'Author', value: metadata.author },
    { name: 'Created-At', value: metadata.createdAt.toString() },
    { name: 'Version', value: '1.0' }
  ];
  
  // Add folder tag if specified
  if (folder) {
    tags.push({ name: 'Folder', value: folder });
  }
  
  // Add project tags
  if (metadata.tags && metadata.tags.length > 0) {
    metadata.tags.forEach((tag, index) => {
      tags.push({ name: `Tag-${index}`, value: tag });
    });
  }
  
  // Convert blob to File for Irys upload
  const file = new File([blob], `${metadata.name}.glb`, { type: 'model/gltf-binary' });
  
  const { uploadToIrys } = await import('./irys');
  const receipt = await uploadToIrys(irysUploader, file, tags);
  
  return receipt.id;
}

/**
 * Download GLB from Irys
 */
export async function downloadGLBFromIrys(transactionId: string): Promise<Blob> {
  const url = `${process.env.NEXT_PUBLIC_IRYS_GATEWAY_URL || 'https://uploader.irys.xyz/tx'}/${transactionId}/data`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download GLB: ${response.statusText}`);
  }
  
  return await response.blob();
}

/**
 * Query GLB files from Irys
 */
export async function queryGLBProjects(
  author?: string,
  folder?: string,
  tags?: string[]
): Promise<Array<{ id: string; tags: Record<string, string> }>> {
  const queryUrl = new URL('https://uploader.irys.xyz/graphql');
  
  let tagFilters = [
    { name: 'App-Name', values: ['GetClayed'] },
    { name: 'Data-Type', values: ['clay-glb'] }
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
    throw new Error(`Failed to query GLB projects: ${response.statusText}`);
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
 * Download clay objects as GLB file
 */
export async function downloadAsGLB(
  clays: any[],
  projectName: string,
  metadata?: Partial<ClayGLBMetadata>
) {
  try {
    // Export to GLB
    const blob = await exportToGLB(clays, {
      name: projectName,
      description: metadata?.description || '',
      author: metadata?.author || 'Anonymous',
      tags: metadata?.tags || []
    });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}.glb`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    console.log(`Downloaded ${projectName}.glb (${(blob.size / 1024).toFixed(2)} KB)`);
  } catch (error) {
    console.error('Failed to download GLB:', error);
    throw error;
  }
}
