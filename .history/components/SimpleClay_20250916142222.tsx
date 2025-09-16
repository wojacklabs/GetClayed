'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Move3d, MousePointer } from 'lucide-react'

interface ClayProps {
  tool: 'rotate' | 'push' | 'pull'
  brushSize: number
}

function Clay({ tool, brushSize }: ClayProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera, gl, raycaster } = useThree()
  
  const dragState = useRef({
    active: false,
    mousePos: new THREE.Vector2(),
    hitPoint: new THREE.Vector3(),
    vertices: [] as Array<{ index: number; weight: number; startPos: THREE.Vector3 }>,
    originalGeometry: null as THREE.BufferGeometry | null
  })
  
  useEffect(() => {
    const canvas = gl.domElement
    
    const updateMousePosition = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      dragState.current.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      dragState.current.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    
    const handleMouseDown = (e: MouseEvent) => {
      if (tool === 'rotate') return
      if (!meshRef.current) return
      
      updateMousePosition(e)
      
      // Store original geometry for undo
      dragState.current.originalGeometry = meshRef.current.geometry.clone()
      
      // Raycaster setup
      raycaster.setFromCamera(dragState.current.mousePos, camera)
      
      // Check intersection
      const intersects = raycaster.intersectObject(meshRef.current, false)
      
      if (intersects.length === 0) return
      
      const intersection = intersects[0]
      const geometry = meshRef.current.geometry
      const positions = geometry.attributes.position
      
      // Convert hit point to local coordinates
      const hitPoint = meshRef.current.worldToLocal(intersection.point.clone())
      dragState.current.hitPoint = hitPoint.clone()
      
      // Find affected vertices
      dragState.current.vertices = []
      
      for (let i = 0; i < positions.count; i++) {
        const pos = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const dist = pos.distanceTo(hitPoint)
        if (dist <= brushSize) {
          const weight = 1 - (dist / brushSize)
          dragState.current.vertices.push({
            index: i,
            weight: Math.pow(weight, 0.6),
            startPos: pos.clone()
          })
        }
      }
      
      dragState.current.active = true
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.current.active) {
        updateMousePosition(e)
      }
    }
    
    const handleMouseUp = () => {
      if (dragState.current.active) {
        dragState.current.active = false
        dragState.current.vertices = []
        dragState.current.originalGeometry = null
      }
    }
    
    // Register events
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseUp)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseUp)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [tool, brushSize, camera, raycaster, gl])
  
  // Apply deformation in frame
  useFrame(() => {
    if (!dragState.current.active || !meshRef.current) return
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    
    // Raycaster to find current mouse position in 3D
    raycaster.setFromCamera(dragState.current.mousePos, camera)
    const intersects = raycaster.intersectObject(meshRef.current, false)
    
    if (intersects.length === 0) return
    
    const intersection = intersects[0].point
    const targetLocal = meshRef.current.worldToLocal(intersection)
    
    // Calculate movement delta
    const movementDelta = targetLocal.clone().sub(dragState.current.hitPoint)
    
    // Update vertices
    for (const v of dragState.current.vertices) {
      const direction = tool === 'pull' ? -1 : 1
      const movement = movementDelta.clone().multiplyScalar(v.weight * direction * 0.5)
      const newPos = v.startPos.clone().add(movement)
      positions.setXYZ(v.index, newPos.x, newPos.y, newPos.z)
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  })
  
  // Generate color based on position (like project creation page)
  const color = new THREE.Color()
  color.setHSL(0.05, 0.7, 0.6) // Orange-red hue like project page
  
  return (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[1.5, 48, 48]} />
      <meshStandardMaterial 
        color={color}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  )
}

function Scene({ tool, brushSize }: ClayProps) {
  return (
    <>
      {/* Better lighting setup for visible rotation */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} color="#a0a0ff" />
      <pointLight position={[0, 10, 0]} intensity={0.2} />
      
      {/* Grid helper for better depth perception */}
      <gridHelper args={[10, 10, 0x888888, 0xcccccc]} position={[0, -2, 0]} />
      
      <Clay tool={tool} brushSize={brushSize} />
      <OrbitControls 
        enablePan={false}
        enableZoom={false}
        minDistance={3}
        maxDistance={10}
        enabled={tool === 'rotate'}
      />
    </>
  )
}

export default function SimpleClay() {
  const [tool, setTool] = useState<'rotate' | 'push' | 'pull'>('rotate')
  const brushSize = 0.8
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Clay</h2>
          
          {/* Tool selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTool('rotate')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                tool === 'rotate' 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              title="Rotate View"
            >
              Rotate
            </button>
            <button
              onClick={() => setTool('push')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                tool === 'push' 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              title="Push Clay"
            >
              Push
            </button>
            <button
              onClick={() => setTool('pull')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                tool === 'pull' 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              title="Pull Clay"
            >
              Pull
            </button>
          </div>
        </div>
      </div>
      
      {/* Full width canvas */}
      <div className="w-full h-80 bg-gradient-to-b from-gray-50 to-gray-100 relative">
        <Canvas 
          camera={{ position: [4, 3, 5], fov: 50 }}
          shadows
        >
          <Scene tool={tool} brushSize={brushSize} />
        </Canvas>
        
        {/* Instruction overlay */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg">
          {tool === 'rotate' ? (
            <>
              <Move3d size={14} />
              <span>Click and drag to rotate view</span>
            </>
          ) : (
            <>
              <MousePointer size={14} />
              <span>Click and drag on clay to {tool}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}