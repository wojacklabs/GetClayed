import * as THREE from 'three';

/**
 * Create a more detailed version of basic geometries for better deformation
 */
export function createDetailedGeometry(shape: string, size: number, thickness: number = 1, detail: number = 32): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;
  
  switch (shape) {
    case 'cube':
      // Create a highly subdivided box
      const segments = 10;
      geometry = new THREE.BoxGeometry(size, size, size, segments, segments, segments);
      break;
      
    case 'rectangle':
      // Create a highly subdivided plane
      const rectSegments = 20;
      geometry = new THREE.PlaneGeometry(size, size, rectSegments, rectSegments);
      break;
      
    case 'circle':
      // Already has good vertex density
      geometry = new THREE.CircleGeometry(size, 64);
      break;
      
    default:
      geometry = new THREE.SphereGeometry(size, detail, detail);
      break;
  }
  
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  
  return geometry;
}


