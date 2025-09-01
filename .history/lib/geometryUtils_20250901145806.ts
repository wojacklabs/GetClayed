import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Subdivide a geometry to increase vertex density for better deformation
 * This is essential for push/pull operations on low-poly geometries
 */
export function subdivideGeometry(geometry: THREE.BufferGeometry, iterations: number = 2): THREE.BufferGeometry {
  // For shapes that need subdivision
  let subdividedGeometry = geometry.clone();
  
  // Apply subdivision iterations
  for (let i = 0; i < iterations; i++) {
    const positions = subdividedGeometry.attributes.position;
    const newPositions: number[] = [];
    const newIndices: number[] = [];
    
    if (subdividedGeometry.index) {
      const indices = subdividedGeometry.index.array;
      const vertexMap = new Map<string, number>();
      
      // Process each triangle
      for (let j = 0; j < indices.length; j += 3) {
        const a = indices[j];
        const b = indices[j + 1];
        const c = indices[j + 2];
        
        // Get vertices
        const vA = new THREE.Vector3(
          positions.getX(a),
          positions.getY(a),
          positions.getZ(a)
        );
        const vB = new THREE.Vector3(
          positions.getX(b),
          positions.getY(b),
          positions.getZ(b)
        );
        const vC = new THREE.Vector3(
          positions.getX(c),
          positions.getY(c),
          positions.getZ(c)
        );
        
        // Calculate midpoints
        const mAB = vA.clone().add(vB).multiplyScalar(0.5);
        const mBC = vB.clone().add(vC).multiplyScalar(0.5);
        const mCA = vC.clone().add(vA).multiplyScalar(0.5);
        
        // Add vertices
        const addVertex = (v: THREE.Vector3): number => {
          const key = `${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`;
          if (vertexMap.has(key)) {
            return vertexMap.get(key)!;
          }
          const index = newPositions.length / 3;
          newPositions.push(v.x, v.y, v.z);
          vertexMap.set(key, index);
          return index;
        };
        
        // Add all vertices
        const iA = addVertex(vA);
        const iB = addVertex(vB);
        const iC = addVertex(vC);
        const iAB = addVertex(mAB);
        const iBC = addVertex(mBC);
        const iCA = addVertex(mCA);
        
        // Create 4 new triangles
        newIndices.push(iA, iAB, iCA);
        newIndices.push(iB, iBC, iAB);
        newIndices.push(iC, iCA, iBC);
        newIndices.push(iAB, iBC, iCA);
      }
      
      // Create new geometry
      const newGeometry = new THREE.BufferGeometry();
      newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
      newGeometry.setIndex(newIndices);
      subdividedGeometry = newGeometry;
    }
  }
  
  // Merge vertices and compute normals
  subdividedGeometry = mergeVertices(subdividedGeometry);
  subdividedGeometry.computeVertexNormals();
  subdividedGeometry.computeBoundingBox();
  subdividedGeometry.computeBoundingSphere();
  
  return subdividedGeometry;
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
