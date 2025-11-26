'use client'

import { use, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { TrackballControls } from '@react-three/drei'
import * as THREE from 'three'
import { downloadClayProject, restoreClayObjects } from '@/lib/clayStorageService'

export default function OGViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [clayObjects, setClayObjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [bgColor, setBgColor] = useState('#f9fafb')
  
  useEffect(() => {
    loadProject()
  }, [resolvedParams.id])
  
  const loadProject = async () => {
    try {
      const projectData = await downloadClayProject(resolvedParams.id)
      const restored = restoreClayObjects(projectData)
      setClayObjects(restored)
      setBgColor(projectData.backgroundColor || '#f9fafb')
      setLoading(false)
    } catch (error) {
      console.error('Failed to load project:', error)
      setLoading(false)
    }
  }
  
  if (loading) {
    return <div style={{ width: '100%', height: '100vh', background: bgColor }} />
  }
  
  return (
    <div style={{ width: '100%', height: '100vh', background: bgColor }}>
      <Canvas camera={{ position: [12, 5, 12], fov: 50 }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[8, 12, 8]} intensity={1.2} />
        <directionalLight position={[-6, 4, -6]} intensity={0.5} />
        <directionalLight position={[0, -8, 4]} intensity={0.25} />
        
        {clayObjects.map((clay) => (
          <mesh
            key={clay.id}
            geometry={clay.geometry}
            position={clay.position}
            rotation={clay.rotation}
            scale={clay.scale instanceof THREE.Vector3 ? [clay.scale.x, clay.scale.y, clay.scale.z] : clay.scale || 1}
          >
            <meshPhongMaterial color={clay.color} side={THREE.DoubleSide} />
          </mesh>
        ))}
        
        <TrackballControls
          enabled={false}
          rotateSpeed={0}
        />
      </Canvas>
    </div>
  )
}

