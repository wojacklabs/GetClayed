'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { downloadClayProject, restoreClayObjects } from '../../../../lib/clayStorageService'

// Loading fallback with canvas so Puppeteer doesn't timeout
function LoadingFallback() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900">
      {/* Hidden canvas for Puppeteer to detect */}
      <canvas style={{ opacity: 0, position: 'absolute' }} />
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-white text-2xl font-bold animate-pulse">Loading 3D Project...</div>
      </div>
    </div>
  )
}

// Simple clay renderer for view-only mode
function ViewOnlyClay({ clay }: { clay: any }) {
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

// Project info overlay
function ProjectInfoOverlay({ name, author }: { name: string; author: string }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
      <h1 className="text-white text-4xl font-bold mb-2 drop-shadow-lg">{name}</h1>
      <p className="text-gray-300 text-lg drop-shadow-md">
        by {author.slice(0, 6)}...{author.slice(-4)}
      </p>
    </div>
  )
}

// GetClayed branding
function Branding() {
  return (
    <div className="absolute top-6 right-6 text-white text-xl font-medium opacity-90">
      GetClayed
    </div>
  )
}

export default function OGViewerProjectPage() {
  const params = useParams()
  const projectId = params.id as string
  
  const [project, setProject] = useState<any>(null)
  const [clayObjects, setClayObjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true)
        console.log('[OG Viewer] Loading project:', projectId)
        
        // Use the same function as ProjectDetailView for consistency
        const projectData = await downloadClayProject(projectId)
        console.log('[OG Viewer] Project loaded:', projectData.name, 'clays:', projectData.clays?.length)
        
        setProject(projectData)
        
        // Restore clay objects with proper geometry
        const restoredObjects = restoreClayObjects(projectData)
        console.log('[OG Viewer] Restored objects:', restoredObjects.length)
        
        setClayObjects(restoredObjects)
        setLoading(false)
      } catch (err) {
        console.error('[OG Viewer] Error loading project:', err)
        setError(err instanceof Error ? err.message : 'Failed to load project')
        setLoading(false)
      }
    }
    
    loadProject()
  }, [projectId])
  
  if (loading) {
    return <LoadingFallback />
  }
  
  if (error || !project) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
        <div className="text-white text-2xl font-bold">
          {error || 'Project not found'}
        </div>
      </div>
    )
  }
  
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ width: '1200px', height: '800px', margin: 0, padding: 0 }}>
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <Canvas
          camera={{
            position: [14, 7, 14],
            fov: 50,
            near: 0.1,
            far: 1000
          }}
          style={{ background: project.backgroundColor || '#1e293b' }}
        >
          <ambientLight intensity={0.35} />
          <directionalLight position={[8, 12, 8]} intensity={1.2} />
          <directionalLight position={[-6, 4, -6]} intensity={0.5} />
          <directionalLight position={[0, -8, 4]} intensity={0.25} />
          <Environment preset="studio" />
          
          <OrbitControls 
            ref={controlsRef}
            enableZoom={false}
            enablePan={false}
            autoRotate={true}
            autoRotateSpeed={2}
          />
          
          {/* Render clay objects */}
          {clayObjects.map((clay, index) => (
            <ViewOnlyClay key={clay.id || index} clay={clay} />
          ))}
        </Canvas>
      </div>
      
      {/* Project info overlay */}
      <ProjectInfoOverlay 
        name={project.name || 'Untitled Project'} 
        author={project.author || project.creator || 'Unknown'} 
      />
      
      {/* Branding */}
      <Branding />
    </div>
  )
}

