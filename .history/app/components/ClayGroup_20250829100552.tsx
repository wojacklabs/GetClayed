'use client'

import { useRef } from 'react'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'

interface ClayGroupProps {
  clay: any
  children: React.ReactNode
  tool: string
  isSelected: boolean
  onUpdate: (clay: any) => void
}

export default function ClayGroup({ clay, children, tool, isSelected, onUpdate }: ClayGroupProps) {
  const groupRef = useRef<THREE.Group>(null)
  
  return (
    <group ref={groupRef} position={clay.position}>
      {children}
      {tool === 'move' && isSelected && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode="translate"
          onObjectChange={() => {
            if (groupRef.current) {
              const updatedClay = {
                ...clay,
                position: groupRef.current.position.clone()
              }
              onUpdate(updatedClay)
            }
          }}
        />
      )}
    </group>
  )
}
