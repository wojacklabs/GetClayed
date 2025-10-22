'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { downloadClayProject, restoreClayObjects } from '../lib/clayStorageService'

interface MiniViewerProps {
  projectId?: string
  clayObjects?: any[]
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

export default function MiniViewer({ projectId, clayObjects: initialClayObjects, className = '' }: MiniViewerProps) {
  const [clayObjects, setClayObjects] = useState<any[]>(initialClayObjects || [])
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (!initialClayObjects && projectId) {
      loadProjectData()
    }
  }, [projectId, initialClayObjects])
  
  const loadProjectData = async () => {
    if (!projectId) return
    
    setLoading(true)
    try {
      const projectData = await downloadClayProject(projectId)
      const restored = restoreClayObjects(projectData)
      setClayObjects(restored)
    } catch (error) {
      console.error('[MiniViewer] Failed to load project:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
      </div>
    )
  }
  
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
        style={{ background: '#f0f0f0', pointerEvents: 'none' }}
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

