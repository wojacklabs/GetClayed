import * as THREE from 'three';

/**
 * Subdivide a tetrahedron while preserving its shape
 */
function subdivideTetrahedron(geometry: THREE.BufferGeometry, subdivisions: number): THREE.BufferGeometry {
  // Get the original vertices of the tetrahedron
  const positions = geometry.attributes.position;
  const indices = geometry.index;
  
  if (!indices) return geometry;
  
  // Extract unique vertices
  const vertices: THREE.Vector3[] = [];
  const vertexMap = new Map<string, number>();
  
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    );
    const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
    if (!vertexMap.has(key)) {
      vertexMap.set(key, vertices.length);
      vertices.push(vertex);
    }
  }
  
  // Get faces
  const faces: [number, number, number][] = [];
  for (let i = 0; i < indices.count; i += 3) {
    faces.push([indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)]);
  }
  
  // Subdivide each face
  const newVertices: THREE.Vector3[] = [...vertices];
  const newFaces: [number, number, number][] = [];
  
  for (const face of faces) {
    subdivideFace(face, vertices, newVertices, newFaces, subdivisions);
  }
  
  // Create new geometry
  const newGeometry = new THREE.BufferGeometry();
  const newPositions = new Float32Array(newFaces.length * 3 * 3);
  
  let index = 0;
  for (const face of newFaces) {
    for (const vertexIndex of face) {
      const vertex = newVertices[vertexIndex];
      newPositions[index++] = vertex.x;
      newPositions[index++] = vertex.y;
      newPositions[index++] = vertex.z;
    }
  }
  
  newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  newGeometry.computeVertexNormals();
  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();
  
  return newGeometry;
}

/**
 * Recursively subdivide a triangular face
 */
function subdivideFace(
  face: [number, number, number],
  originalVertices: THREE.Vector3[],
  allVertices: THREE.Vector3[],
  newFaces: [number, number, number][],
  level: number
): void {
  if (level === 0) {
    newFaces.push(face);
    return;
  }
  
  const [a, b, c] = face;
  const va = originalVertices[a] || allVertices[a];
  const vb = originalVertices[b] || allVertices[b];
  const vc = originalVertices[c] || allVertices[c];
  
  // Create midpoints
  const mab = new THREE.Vector3().addVectors(va, vb).multiplyScalar(0.5);
  const mbc = new THREE.Vector3().addVectors(vb, vc).multiplyScalar(0.5);
  const mca = new THREE.Vector3().addVectors(vc, va).multiplyScalar(0.5);
  
  // Add midpoints to vertices array if not already present
  const getOrAddVertex = (vertex: THREE.Vector3): number => {
    const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
    for (let i = 0; i < allVertices.length; i++) {
      const v = allVertices[i];
      if (Math.abs(v.x - vertex.x) < 0.0001 && 
          Math.abs(v.y - vertex.y) < 0.0001 && 
          Math.abs(v.z - vertex.z) < 0.0001) {
        return i;
      }
    }
    allVertices.push(vertex);
    return allVertices.length - 1;
  };
  
  const iab = getOrAddVertex(mab);
  const ibc = getOrAddVertex(mbc);
  const ica = getOrAddVertex(mca);
  
  // Subdivide into 4 triangles
  subdivideFace([a, iab, ica], originalVertices, allVertices, newFaces, level - 1);
  subdivideFace([b, ibc, iab], originalVertices, allVertices, newFaces, level - 1);
  subdivideFace([c, ica, ibc], originalVertices, allVertices, newFaces, level - 1);
  subdivideFace([iab, ibc, ica], originalVertices, allVertices, newFaces, level - 1);
}

/**
 * Create a more detailed version of basic geometries for better deformation
 */
export function createDetailedGeometry(shape: string, size: number, thickness: number = 1, detail: number = 32): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;
  
  switch (shape) {
    case 'tetrahedron':
      // Use IcosahedronGeometry with low detail as a substitute
      // This gives us a shape close to tetrahedron with more vertices
      geometry = new THREE.IcosahedronGeometry(size, 0);
      
      // Scale it to look more like a tetrahedron by squashing it
      const scale = new THREE.Matrix4();
      scale.makeScale(1, 0.8, 1);
      geometry.applyMatrix4(scale);
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


