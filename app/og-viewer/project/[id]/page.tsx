'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'

// Loading fallback
function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
      <div className="text-white text-2xl font-bold animate-pulse">Loading 3D Project...</div>
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
        
        // Fetch project data from Irys
        const IRYS_DATA_URL = `https://uploader.irys.xyz/tx/${projectId}/data`
        const response = await fetch(IRYS_DATA_URL)
        
        if (!response.ok) {
          throw new Error('Failed to fetch project data')
        }
        
        const projectData = await response.json()
        
        // Check if it's a chunk manifest
        if (projectData.chunkSetId && projectData.totalChunks) {
          // For chunked projects, try to fetch and reassemble
          try {
            const chunks = projectData.chunks || []
            
            if (chunks.length > 0) {
              // Fetch all chunks
              const chunkPromises = chunks.map((chunkId: string) =>
                fetch(`https://uploader.irys.xyz/tx/${chunkId}/data`).then(r => r.text())
              )
              
              const chunkData = await Promise.all(chunkPromises)
              const fullData = chunkData.join('')
              const reassembledProject = JSON.parse(fullData)
              
              setProject(reassembledProject)
              
              // Reconstruct clay objects with proper geometry - correct field name is 'clays'
              const objects = (reassembledProject.clays || []).map((obj: any) => {
                let geometry: THREE.BufferGeometry
                
                // Reconstruct geometry
                if (obj.geometryData) {
                  geometry = new THREE.BufferGeometry()
                  
                  // Restore attributes
                  if (obj.geometryData.attributes) {
                    Object.entries(obj.geometryData.attributes).forEach(([name, data]: [string, any]) => {
                      geometry.setAttribute(
                        name,
                        new THREE.BufferAttribute(new Float32Array(data.array), data.itemSize)
                      )
                    })
                  }
                  
                  // Restore index if present
                  if (obj.geometryData.index) {
                    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(obj.geometryData.index.array), 1))
                  }
                  
                  geometry.computeVertexNormals()
                } else {
                  // Fallback to basic shapes
                  switch(obj.type) {
                    case 'box':
                      geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4)
                      break
                    case 'cylinder':
                      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 8)
                      break
                    case 'cone':
                      geometry = new THREE.ConeGeometry(0.5, 1, 32, 8)
                      break
                    case 'torus':
                      geometry = new THREE.TorusGeometry(0.7, 0.3, 16, 100)
                      break
                    case 'sphere':
                    default:
                      geometry = new THREE.SphereGeometry(1, 32, 32)
                      break
                  }
                }
                
                return {
                  ...obj,
                  geometry,
                  position: new THREE.Vector3(
                    obj.position?.x || 0,
                    obj.position?.y || 0,
                    obj.position?.z || 0
                  ),
                  rotation: new THREE.Euler(
                    obj.rotation?._x || obj.rotation?.x || 0,
                    obj.rotation?._y || obj.rotation?.y || 0,
                    obj.rotation?._z || obj.rotation?.z || 0
                  ),
                  scale: obj.scale || 1,
                }
              })
              
              setClayObjects(objects)
            } else {
              throw new Error('No chunks found in manifest')
            }
          } catch (chunkError) {
            console.error('Failed to reassemble chunks:', chunkError)
            throw new Error('Could not load project chunks')
          }
        } else {
          // Regular project
          setProject(projectData)
          
          // Reconstruct clay objects with proper geometry - correct field name is 'clays'
          const objects = (projectData.clays || []).map((obj: any) => {
            let geometry: THREE.BufferGeometry
            
            // Reconstruct geometry
            if (obj.geometryData) {
              geometry = new THREE.BufferGeometry()
              
              // Restore attributes
              if (obj.geometryData.attributes) {
                Object.entries(obj.geometryData.attributes).forEach(([name, data]: [string, any]) => {
                  geometry.setAttribute(
                    name,
                    new THREE.BufferAttribute(new Float32Array(data.array), data.itemSize)
                  )
                })
              }
              
              // Restore index if present
              if (obj.geometryData.index) {
                geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(obj.geometryData.index.array), 1))
              }
              
              geometry.computeVertexNormals()
            } else {
              // Fallback to basic shapes
              switch(obj.type) {
                case 'box':
                  geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4)
                  break
                case 'cylinder':
                  geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 8)
                  break
                case 'cone':
                  geometry = new THREE.ConeGeometry(0.5, 1, 32, 8)
                  break
                case 'torus':
                  geometry = new THREE.TorusGeometry(0.7, 0.3, 16, 100)
                  break
                case 'sphere':
                default:
                  geometry = new THREE.SphereGeometry(1, 32, 32)
                  break
              }
            }
            
            return {
              ...obj,
              geometry,
              position: new THREE.Vector3(
                obj.position?.x || 0,
                obj.position?.y || 0,
                obj.position?.z || 0
              ),
              rotation: new THREE.Euler(
                obj.rotation?._x || obj.rotation?.x || 0,
                obj.rotation?._y || obj.rotation?.y || 0,
                obj.rotation?._z || obj.rotation?.z || 0
              ),
              scale: obj.scale || 1,
            }
          })
          
          setClayObjects(objects)
        }
        
        setLoading(false)
      } catch (err) {
        console.error('Error loading project:', err)
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
    <div className="relative w-screen h-screen overflow-hidden" style={{ width: '1200px', height: '630px', margin: 0, padding: 0 }}>
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <Canvas
          camera={{
            position: [10, 10, 10],
            fov: 60,
            near: 0.1,
            far: 1000
          }}
          style={{ background: project.backgroundColor || '#1e293b' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} />
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

