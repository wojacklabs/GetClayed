import * as THREE from 'three';

/**
 * Create a more detailed version of basic geometries for better deformation
 */
export function createDetailedGeometry(shape: string, size: number, thickness: number = 1, detail: number = 32): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;
  
  switch (shape) {
    case 'tetrahedron':
      // Create a sphere and morph it into tetrahedron shape but keep many vertices
      geometry = new THREE.IcosahedronGeometry(size, 2);
      // Scale to tetrahedron proportions
      geometry.scale(1, thickness, 1);
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

/**
 * Apply subdivision to specific geometry types
 */
export function prepareGeometryForDeformation(geometry: THREE.BufferGeometry, shape: string): THREE.BufferGeometry {
  switch (shape) {
    case 'tetrahedron':
      // Tetrahedron needs heavy subdivision due to very low initial vertex count
      return subdivideGeometry(geometry, 3);
      
    case 'cube':
      // Cube also benefits from subdivision
      return subdivideGeometry(geometry, 2);
      
    case 'rectangle':
    case 'triangle':
    case 'circle':
      // 2D shapes need some subdivision for deformation
      return subdivideGeometry(geometry, 2);
      
    case 'sphere':
      // Spheres already have enough vertices
      return geometry;
      
    default:
      // For other shapes, apply moderate subdivision
      return subdivideGeometry(geometry, 1);
  }
}
