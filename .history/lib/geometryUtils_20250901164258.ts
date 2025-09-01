import * as THREE from 'three';

/**
 * Create a more detailed version of basic geometries for better deformation
 */
export function createDetailedGeometry(shape: string, size: number, thickness: number = 1, detail: number = 32): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;
  
  switch (shape) {
    case 'tetrahedron':
      // Create a basic tetrahedron first
      geometry = new THREE.TetrahedronGeometry(size);
      
      // Subdivide the geometry to add more vertices for smooth deformation
      // We'll use a custom subdivision approach to maintain the tetrahedron shape
      const positionAttribute = geometry.attributes.position;
      const positions: number[] = [];
      const subdivisionLevel = 3; // Higher = more vertices
      
      // Get the original vertices
      const vertices = [];
      for (let i = 0; i < positionAttribute.count; i++) {
        vertices.push(new THREE.Vector3(
          positionAttribute.getX(i),
          positionAttribute.getY(i),
          positionAttribute.getZ(i)
        ));
      }
      
      // Get faces (tetrahedron has 4 triangular faces)
      const indices = geometry.index ? geometry.index.array : [];
      const faces = [];
      for (let i = 0; i < indices.length; i += 3) {
        faces.push([indices[i], indices[i + 1], indices[i + 2]]);
      }
      
      // Subdivide each face
      const newVertices: THREE.Vector3[] = [];
      const newFaces: number[][] = [];
      
      faces.forEach(face => {
        subdivideTriangle(
          vertices[face[0]],
          vertices[face[1]], 
          vertices[face[2]],
          subdivisionLevel,
          newVertices,
          newFaces
        );
      });
      
      // Create new geometry from subdivided vertices
      const newPositions = new Float32Array(newVertices.length * 3);
      newVertices.forEach((v, i) => {
        newPositions[i * 3] = v.x;
        newPositions[i * 3 + 1] = v.y;
        newPositions[i * 3 + 2] = v.z;
      });
      
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
      
      // Apply thickness scaling
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


