import * as THREE from 'three';

/**
 * Create a more detailed version of basic geometries for better deformation
 */
export function createDetailedGeometry(shape: string, size: number, thickness: number = 1, detail: number = 32): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;
  
  switch (shape) {
    case 'tetrahedron':
      // Use TetrahedronGeometry with detail level 1
      // This provides enough vertices for deformation while maintaining the tetrahedron shape
      geometry = new THREE.TetrahedronGeometry(size, 1);
      break;
      
    case 'cube':
      // Create a highly subdivided box
      const segments = 10;
      geometry = new THREE.BoxGeometry(size, size * thickness, size, segments, segments, segments);
      break;
      
    case 'rectangle':
      // Create a highly subdivided plane
      const rectSegments = 20;
      geometry = new THREE.PlaneGeometry(size, size, rectSegments, rectSegments);
      break;
      
    case 'triangle':
      // Create a circle and deform it into triangle shape
      geometry = new THREE.CircleGeometry(size, 32);
      // Apply triangle deformation
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const angle = Math.atan2(y, x);
        const radius = Math.sqrt(x * x + y * y);
        
        // Triangle shape function
        const triangleRadius = size / (1.5 + 0.5 * Math.cos(3 * angle));
        const scale = Math.min(1, triangleRadius / size);
        
        positions.setX(i, x * scale);
        positions.setY(i, y * scale);
      }
      geometry.attributes.position.needsUpdate = true;
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


