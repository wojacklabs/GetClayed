'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function AnimatedClayLogo() {
  const meshRef = useRef<THREE.Mesh>(null)
  const originalPositions = useRef<Float32Array | null>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    
    const geometry = meshRef.current.geometry as THREE.BufferGeometry
    const positionAttribute = geometry.getAttribute('position')
    
    // Store original positions on first frame
    if (!originalPositions.current) {
      originalPositions.current = new Float32Array(positionAttribute.array)
    }
    
    // Rotate slowly
    meshRef.current.rotation.y += 0.01
    
    // Apply organic deformation
    const time = state.clock.elapsedTime
    const vertex = new THREE.Vector3()
    const originalVertex = new THREE.Vector3()
    
    for (let i = 0; i < positionAttribute.count; i++) {
      originalVertex.fromArray(originalPositions.current, i * 3)
      
      // Multiple wave frequencies for organic motion
      const wave1 = Math.sin(originalVertex.x * 3 + time * 1.5) * 0.02
      const wave2 = Math.sin(originalVertex.y * 4 + time * 1.8) * 0.015
      const wave3 = Math.sin(originalVertex.z * 2 + time * 1.2) * 0.025
      
      // Combine waves for organic movement
      vertex.x = originalVertex.x + wave2 + wave3
      vertex.y = originalVertex.y + wave1 + wave3
      vertex.z = originalVertex.z + wave1 + wave2
      
      positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z)
    }
    
    positionAttribute.needsUpdate = true
    geometry.computeVertexNormals()
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.65, 16, 16]} />
      <meshStandardMaterial 
        color="#B8C5D6"
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  )
}

