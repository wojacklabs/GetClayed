'use client'

import { useRef, useState, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface MoveGizmoProps {
  position: THREE.Vector3
  onMove: (newPosition: THREE.Vector3) => void
  size?: number
  parentPosition?: THREE.Vector3
}

export default function MoveGizmo({ position, onMove, size = 1, parentPosition = new THREE.Vector3() }: MoveGizmoProps) {
  const { camera, raycaster, gl } = useThree()
  const [draggingAxis, setDraggingAxis] = useState<'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | null>(null)
  const dragStart = useRef(new THREE.Vector3())
  const positionStart = useRef(new THREE.Vector3())
  
  // Handle axis colors
  const axisColors = {
    x: '#ff0000',
    y: '#00ff00', 
    z: '#0000ff',
    xy: '#ffff00',
    xz: '#ff00ff',
    yz: '#00ffff'
  }
  
  const handlePointerDown = (axis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz') => (e: any) => {
    e.stopPropagation()
    setDraggingAxis(axis)
    dragStart.current.copy(e.point)
    positionStart.current.copy(parentPosition)
  }
  
  useFrame(() => {
    if (!draggingAxis) return
    
    const canvas = gl.domElement
    const rect = canvas.getBoundingClientRect()
    const x = (((gl.domElement as any)['_clientX'] || 0) / rect.width) * 2 - 1
    const y = -(((gl.domElement as any)['_clientY'] || 0) / rect.height) * 2 + 1
    
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    
    // Create appropriate plane based on axis
    const plane = new THREE.Plane()
    const normal = new THREE.Vector3()
    
    if (draggingAxis === 'x') {
      // For X axis, use YZ plane
      camera.getWorldDirection(normal)
      normal.x = 0
      normal.normalize()
      if (normal.length() < 0.1) normal.set(0, 0, 1)
    } else if (draggingAxis === 'y') {
      // For Y axis, use XZ plane
      camera.getWorldDirection(normal)
      normal.y = 0
      normal.normalize()
      if (normal.length() < 0.1) normal.set(1, 0, 0)
    } else if (draggingAxis === 'z') {
      // For Z axis, use XY plane
      camera.getWorldDirection(normal)
      normal.z = 0
      normal.normalize()
      if (normal.length() < 0.1) normal.set(0, 1, 0)
    } else if (draggingAxis === 'xy') {
      normal.set(0, 0, 1)
    } else if (draggingAxis === 'xz') {
      normal.set(0, 1, 0)
    } else if (draggingAxis === 'yz') {
      normal.set(1, 0, 0)
    }
    
    // Use world position for plane
    const worldPos = position.clone().add(parentPosition)
    plane.setFromNormalAndCoplanarPoint(normal, worldPos)
    
    const intersection = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(plane, intersection)) {
      const delta = intersection.clone().sub(dragStart.current)
      const newPos = positionStart.current.clone().add(parentPosition)
      
      // Apply movement based on axis
      if (draggingAxis.includes('x')) newPos.x += delta.x
      if (draggingAxis.includes('y')) newPos.y += delta.y
      if (draggingAxis.includes('z')) newPos.z += delta.z
      
      onMove(newPos)
    }
  })
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      (gl.domElement as any)['_clientX'] = e.clientX
      ;(gl.domElement as any)['_clientY'] = e.clientY
    }
    
    const handleMouseUp = () => {
      setDraggingAxis(null)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [gl])
  
  return (
    <group position={position}>
      {/* X Axis */}
      <group>
        <mesh
          onPointerDown={handlePointerDown('x')}
          position={[size * 0.5, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <coneGeometry args={[size * 0.15, size * 0.3, 8]} />
          <meshBasicMaterial color={axisColors.x} />
        </mesh>
        <mesh
          onPointerDown={handlePointerDown('x')}
          position={[size * 0.5, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[size * 0.05, size * 0.05, size, 8]} />
          <meshBasicMaterial color={axisColors.x} />
        </mesh>
      </group>
      
      {/* Y Axis */}
      <group>
        <mesh
          onPointerDown={handlePointerDown('y')}
          position={[0, size * 0.5, 0]}
        >
          <coneGeometry args={[size * 0.15, size * 0.3, 8]} />
          <meshBasicMaterial color={axisColors.y} />
        </mesh>
        <mesh
          onPointerDown={handlePointerDown('y')}
          position={[0, size * 0.5, 0]}
        >
          <cylinderGeometry args={[size * 0.05, size * 0.05, size, 8]} />
          <meshBasicMaterial color={axisColors.y} />
        </mesh>
      </group>
      
      {/* Z Axis */}
      <group>
        <mesh
          onPointerDown={handlePointerDown('z')}
          position={[0, 0, size * 0.5]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <coneGeometry args={[size * 0.15, size * 0.3, 8]} />
          <meshBasicMaterial color={axisColors.z} />
        </mesh>
        <mesh
          onPointerDown={handlePointerDown('z')}
          position={[0, 0, size * 0.5]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[size * 0.05, size * 0.05, size, 8]} />
          <meshBasicMaterial color={axisColors.z} />
        </mesh>
      </group>
      
      {/* XY Plane */}
      <mesh
        onPointerDown={handlePointerDown('xy')}
        position={[size * 0.3, size * 0.3, 0]}
      >
        <planeGeometry args={[size * 0.3, size * 0.3]} />
        <meshBasicMaterial 
          color={axisColors.xy} 
          transparent 
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* XZ Plane */}
      <mesh
        onPointerDown={handlePointerDown('xz')}
        position={[size * 0.3, 0, size * 0.3]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[size * 0.3, size * 0.3]} />
        <meshBasicMaterial 
          color={axisColors.xz} 
          transparent 
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* YZ Plane */}
      <mesh
        onPointerDown={handlePointerDown('yz')}
        position={[0, size * 0.3, size * 0.3]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[size * 0.3, size * 0.3]} />
        <meshBasicMaterial 
          color={axisColors.yz} 
          transparent 
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
