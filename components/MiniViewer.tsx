'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef, useState, useEffect, useMemo } from 'react'
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

function Scene({ clayObjects, backgroundColor }: { clayObjects: any[]; backgroundColor: string }) {
  const groupRef = useRef<THREE.Group>(null)
  
  // Calculate center of all clay objects to center the view
  const center = useMemo(() => {
    if (clayObjects.length === 0) return { x: 0, y: 0, z: 0 }
    
    let minY = Infinity, maxY = -Infinity
    let minX = Infinity, maxX = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    
    clayObjects.forEach(clay => {
      const pos = clay.position
      const size = clay.size || 1
      
      minX = Math.min(minX, pos.x - size)
      maxX = Math.max(maxX, pos.x + size)
      minY = Math.min(minY, pos.y - size)
      maxY = Math.max(maxY, pos.y + size)
      minZ = Math.min(minZ, pos.z - size)
      maxZ = Math.max(maxZ, pos.z + size)
    })
    
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    }
  }, [clayObjects])
  
  // Auto rotate
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3
    }
  })
  
  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <group ref={groupRef} position={[-center.x, -center.y, -center.z]}>
        {clayObjects.map(clay => (
          <Clay key={clay.id} clay={clay} />
        ))}
      </group>
    </>
  )
}

export default function MiniViewer({ projectId, clayObjects: initialClayObjects, className = '' }: MiniViewerProps) {
  const [clayObjects, setClayObjects] = useState<any[]>(initialClayObjects || [])
  const [loading, setLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [backgroundColor, setBackgroundColor] = useState('#f8f9fa')
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  
  // Use Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
          } else {
            // Optionally hide when out of view to save resources
            setIsVisible(false)
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
      }
    )
    
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    
    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current)
      }
    }
  }, [])
  
  useEffect(() => {
    if (isVisible && !initialClayObjects && projectId && clayObjects.length === 0) {
      loadProjectData()
    }
  }, [projectId, initialClayObjects, isVisible])
  
  const loadProjectData = async () => {
    if (!projectId) return
    
    setLoading(true)
    setHasError(false)
    try {
      const projectData = await downloadClayProject(projectId)
      const restored = restoreClayObjects(projectData)
      setClayObjects(restored)
      // Set background color from project data, ensure it's a valid color
      if (projectData.backgroundColor && typeof projectData.backgroundColor === 'string') {
        // Validate the color string
        const validColor = projectData.backgroundColor.startsWith('#') ? projectData.backgroundColor : '#f8f9fa'
        setBackgroundColor(validColor)
      }
    } catch (error: any) {
      console.error('[MiniViewer] Failed to load project:', error)
      // Don't show error for deleted/invalid projects - just show placeholder
      if (error.message && error.message.includes('Transaction not found')) {
        console.log('[MiniViewer] Project not found or deleted, showing placeholder');
      }
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }
  
  // Handle WebGL context lost
  const handleContextLost = (event: any) => {
    event.preventDefault()
    console.warn('[MiniViewer] WebGL context lost, will restore...')
    setHasError(true)
  }
  
  const handleContextRestored = () => {
    console.log('[MiniViewer] WebGL context restored')
    setHasError(false)
  }
  
  if (!isVisible || hasError) {
    return (
      <div ref={containerRef} className={`bg-gray-100 flex items-center justify-center border-b border-gray-200 ${className}`}>
        <div className="text-2xl font-bold text-gray-300">3D</div>
      </div>
    )
  }
  
  if (loading) {
    return (
      <div ref={containerRef} className={`bg-gray-100 flex items-center justify-center border-b border-gray-200 ${className}`}>
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
      </div>
    )
  }
  
  if (!clayObjects || clayObjects.length === 0) {
    return (
      <div ref={containerRef} className={`bg-gray-100 flex items-center justify-center border-b border-gray-200 ${className}`}>
        <div className="text-2xl font-bold text-gray-300">3D</div>
      </div>
    )
  }
  
  return (
    <div ref={containerRef} className={`border-b border-gray-200 ${className}`}>
      <Canvas
        camera={{ position: [10, 8, 10], fov: 45 }}
        style={{ pointerEvents: 'none' }}
        gl={{ 
          preserveDrawingBuffer: true,
          antialias: false,
          alpha: true,
          powerPreference: 'low-power'
        }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement
          canvasRef.current = canvas
          canvas.addEventListener('webglcontextlost', handleContextLost)
          canvas.addEventListener('webglcontextrestored', handleContextRestored)
        }}
        frameloop={isVisible ? 'always' : 'never'}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[8, 12, 8]} intensity={1.2} />
          <directionalLight position={[-6, 4, -6]} intensity={0.5} />
          <directionalLight position={[0, -8, 4]} intensity={0.25} />
          <Scene clayObjects={clayObjects} backgroundColor={backgroundColor} />
        </Suspense>
      </Canvas>
    </div>
  )
}

