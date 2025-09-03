/**
 * Deform Action Storage - Store push/pull actions instead of vertices
 * This allows for much smaller file sizes and perfect recreation
 */

import * as THREE from 'three';

export interface DeformAction {
  type: 'push' | 'pull';
  point: { x: number; y: number; z: number }; // Hit point in local space
  direction: { x: number; y: number; z: number }; // Movement direction
  distance: number; // Movement distance
  brushSize: number; // Brush size at time of action
  timestamp?: number; // Optional timestamp for undo/redo
}

export interface DeformableClayData {
  originalShape: string;
  originalParams: {
    size?: number;
    detail?: number;
    thickness?: number;
    controlPoints?: Array<{ x: number; y: number; z: number }>;
  };
  deformActions: DeformAction[];
}

/**
 * Record a deform action
 */
export function recordDeformAction(
  type: 'push' | 'pull',
  hitPoint: THREE.Vector3,
  movement: THREE.Vector3,
  brushSize: number
): DeformAction {
  return {
    type,
    point: {
      x: Math.round(hitPoint.x * 1000) / 1000,
      y: Math.round(hitPoint.y * 1000) / 1000,
      z: Math.round(hitPoint.z * 1000) / 1000
    },
    direction: {
      x: Math.round(movement.x * 1000) / 1000,
      y: Math.round(movement.y * 1000) / 1000,
      z: Math.round(movement.z * 1000) / 1000
    },
    distance: Math.round(movement.length() * 1000) / 1000,
    brushSize: Math.round(brushSize * 100) / 100,
    timestamp: Date.now()
  };
}

/**
 * Apply deform actions to recreate geometry
 */
export function applyDeformActions(
  geometry: THREE.BufferGeometry,
  actions: DeformAction[]
): void {
  const positions = geometry.attributes.position;
  
  // Apply each action in sequence
  actions.forEach(action => {
    const hitPoint = new THREE.Vector3(action.point.x, action.point.y, action.point.z);
    const movement = new THREE.Vector3(
      action.direction.x,
      action.direction.y,
      action.direction.z
    ).normalize().multiplyScalar(action.distance);
    
    // Apply deformation based on brush size
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      const distance = vertex.distanceTo(hitPoint);
      if (distance <= action.brushSize) {
        const weight = 1 - (distance / action.brushSize);
        const weightedMovement = movement.clone().multiplyScalar(
          Math.pow(weight, 0.6) * (action.type === 'pull' ? -1 : 1)
        );
        
        vertex.add(weightedMovement);
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
    }
  });
  
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * Calculate approximate data size for actions vs vertices
 */
export function calculateActionDataSize(actions: DeformAction[]): number {
  // Each action is approximately 40-50 bytes when serialized
  return actions.length * 45;
}

export function calculateVertexDataSize(vertexCount: number): number {
  // Each vertex is 3 floats * 4 bytes = 12 bytes minimum
  return vertexCount * 12;
}
