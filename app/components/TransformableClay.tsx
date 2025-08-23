'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface TransformableClayProps {
  clay: any
  children: React.ReactNode
  isSelected: boolean
  onPositionChange: (position: THREE.Vector3) => void
}

export default function TransformableClay({ 
  clay, 
  children, 
  isSelected, 
  onPositionChange 
}: TransformableClayProps) {
  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)
  const previousPosition = useRef(new THREE.Vector3())
  
  useFrame(() => {
    if (groupRef.current && isSelected) {
      // Check if position has changed
      if (!previousPosition.current.equals(groupRef.current.position)) {
        previousPosition.current.copy(groupRef.current.position)
        onPositionChange(groupRef.current.position.clone())
      }
    }
  })
  
  return (
    <group ref={groupRef} position={clay.position}>
      {children}
      {isSelected && (
        <mesh visible={false}>
          <boxGeometry args={[4, 4, 4]} />
          <meshBasicMaterial wireframe />
        </mesh>
      )}
    </group>
  )
}
