'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import * as THREE from 'three'

interface MiniViewerProps {
  clayObjects: any[]
  className?: string
}

function Clay({ clay }: { clay: any }) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  return (
    <mesh
      ref={meshRef}
      geometry={clay.geometry}
      position={clay.position}
      rotation={clay.rotation}
      scale={clay.scale instanceof THREE.Vector3 ? [clay.scale.x, clay.scale.y, clay.scale.z] : clay.scale || 1}
    >
      <meshPhongMaterial 
        color={clay.color}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function Scene({ clayObjects }: { clayObjects: any[] }) {
  const groupRef = useRef<THREE.Group>(null)
  
  // Auto rotate
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3
    }
  })
  
  return (
    <group ref={groupRef}>
      {clayObjects.map(clay => (
        <Clay key={clay.id} clay={clay} />
      ))}
    </group>
  )
}

export default function MiniViewer({ clayObjects, className = '' }: MiniViewerProps) {
  if (!clayObjects || clayObjects.length === 0) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="text-2xl font-bold text-gray-300">3D</div>
      </div>
    )
  }
  
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [5, 5, 5], fov: 50 }}
        style={{ background: '#f0f0f0' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <directionalLight position={[-5, -5, -5]} intensity={0.3} />
          <Scene clayObjects={clayObjects} />
        </Suspense>
      </Canvas>
    </div>
  )
}

