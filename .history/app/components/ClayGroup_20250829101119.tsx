'use client'

import { useRef, useEffect, useState } from 'react'
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
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const handleObjectChange = () => {
    if (groupRef.current && !groupRef.current.userData.updating) {
      groupRef.current.userData.updating = true
      
      const updatedClay = {
        ...clay,
        position: groupRef.current.position.clone()
      }
      onUpdate(updatedClay)
      
      // Reset flag after a short delay
      setTimeout(() => {
        if (groupRef.current) {
          groupRef.current.userData.updating = false
        }
      }, 100)
    }
  }
  
  return (
    <group ref={groupRef} position={clay.position}>
      {children}
      {tool === 'move' && isSelected && mounted && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode="translate"
          onObjectChange={handleObjectChange}
          enabled={true}
          showX={true}
          showY={true}
          showZ={true}
        />
      )}
    </group>
  )
}
