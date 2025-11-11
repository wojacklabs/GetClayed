'use client'

import React, { useRef, useState, useEffect, Suspense, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Move3d, MousePointer, SwitchCamera, SplinePointer, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Individual Clay Component from AdvancedClay.tsx
function Clay({ 
  clay, 
  tool, 
  brushSize, 
  onDeformingChange,
  onBrushHover,
  onGeometryUpdate
}: {
  clay: { id: string; geometry: THREE.BufferGeometry; position: THREE.Vector3; scale: number | THREE.Vector3; shape: string }
  tool: string
  brushSize: number
  onDeformingChange: (isDeforming: boolean) => void
  onBrushHover?: (point: THREE.Vector3 | null) => void
  onGeometryUpdate?: (mesh: THREE.Mesh) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const { camera, raycaster, gl } = useThree()
  
  // Drag state
  const dragState = useRef({
    active: false,
    mousePos: new THREE.Vector2(),
    initialMousePos: new THREE.Vector2(),
    targetVertex: -1,
    originalGeometry: null as THREE.BufferGeometry | null,
    vertices: [] as Array<{
      index: number
      weight: number
      startPos: THREE.Vector3
    }>,
    hitPoint: new THREE.Vector3(),
    hitNormal: new THREE.Vector3()
  })
  
  useEffect(() => {
    if (!meshRef.current) return
    
    // Set up geometry
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
    meshRef.current.geometry.computeBoundingBox()
    meshRef.current.geometry.computeBoundingSphere()
    
    // Set up material
    if (meshRef.current.material && !Array.isArray(meshRef.current.material)) {
      meshRef.current.material.side = THREE.DoubleSide
    }
    meshRef.current.frustumCulled = false
  }, [clay.geometry])
  
  // Canvas event handlers
  useEffect(() => {
    const canvas = gl.domElement
    
    const updatePosition = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      dragState.current.mousePos.x = ((clientX - rect.left) / rect.width) * 2 - 1
      dragState.current.mousePos.y = -((clientY - rect.top) / rect.height) * 2 + 1
    }
    
    const updateMousePosition = (e: MouseEvent) => {
      updatePosition(e.clientX, e.clientY)
    }
    
    const updateTouchPosition = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updatePosition(e.touches[0].clientX, e.touches[0].clientY)
      }
    }
    
    const handleWheel = (e: WheelEvent) => {
      // Not used for push/pull tools
    }
    
    const handleStart = (clientX: number, clientY: number) => {
      if (tool !== 'push' && tool !== 'pull' && tool !== 'deform') return
      if (!meshRef.current) return
      
      updatePosition(clientX, clientY)
      dragState.current.initialMousePos.copy(dragState.current.mousePos)
      
      // Store original geometry for undo
      dragState.current.originalGeometry = meshRef.current.geometry.clone()
      
      // Raycaster setup
      raycaster.setFromCamera(dragState.current.mousePos, camera)
      
      // Check intersection only with current mesh
      const intersects = raycaster.intersectObject(meshRef.current, false)
      
      if (intersects.length === 0) return
      
      const intersection = intersects[0]
      const geometry = meshRef.current.geometry
      const positions = geometry.attributes.position
      
      // Convert hit point to local coordinates
      const hitPoint = meshRef.current.worldToLocal(intersection.point.clone())
      
      // Store the exact hit point instead of finding closest vertex
      dragState.current.hitPoint = hitPoint.clone()
      dragState.current.hitNormal = intersection.face ? intersection.face.normal.clone() : new THREE.Vector3(0, 1, 0)
      
      // Find affected vertices based on distance from hit point
      dragState.current.vertices = []
      const centerPos = hitPoint
      
      for (let i = 0; i < positions.count; i++) {
        const pos = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const dist = pos.distanceTo(centerPos)
        const absoluteBrushSize = brushSize
        if (dist <= absoluteBrushSize) {
          const weight = 1 - (dist / absoluteBrushSize)
          dragState.current.vertices.push({
            index: i,
            weight: Math.pow(weight, 0.6),
            startPos: pos.clone()
          })
        }
      }
      
      dragState.current.active = true
      dragState.current.targetVertex = 0
      onDeformingChange(true)
    }
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      handleStart(e.clientX, e.clientY)
    }
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault()
        handleStart(e.touches[0].clientX, e.touches[0].clientY)
      }
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.current.active) {
        updateMousePosition(e)
      }
    }
    
    const handleTouchMove = (e: TouchEvent) => {
      if (dragState.current.active && e.touches.length === 1) {
        e.preventDefault()
        updateTouchPosition(e)
      }
    }
    
    const handleEnd = () => {
      if (dragState.current.active) {
        dragState.current.active = false
        dragState.current.targetVertex = -1
        dragState.current.vertices = []
        onDeformingChange(false)
        
        dragState.current.originalGeometry = null
        
        // Notify geometry update
        if (onGeometryUpdate && meshRef.current) {
          onGeometryUpdate(meshRef.current)
        }
      }
    }
    
    // Register events
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleEnd)
    canvas.addEventListener('mouseleave', handleEnd)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    
    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleEnd)
    canvas.addEventListener('touchcancel', handleEnd)
    
    window.addEventListener('mouseup', handleEnd)
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleEnd)
      canvas.removeEventListener('mouseleave', handleEnd)
      canvas.removeEventListener('wheel', handleWheel)
      
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleEnd)
      canvas.removeEventListener('touchcancel', handleEnd)
      
      window.removeEventListener('mouseup', handleEnd)
    }
  }, [tool, brushSize, camera, raycaster, gl, onDeformingChange, clay])
  
  // Apply deformation in frame
  useFrame(() => {
    if (!dragState.current.active || tool === 'move' || tool === 'delete') return
    if (!meshRef.current) return
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    
    // Use raycaster to project mouse onto invisible plane
    raycaster.setFromCamera(dragState.current.mousePos, camera)
    
    // Create invisible plane at hit point
    const planeNormal = new THREE.Vector3(0, 0, 1).transformDirection(camera.matrixWorld)
    const plane = new THREE.Plane(planeNormal)
    
    // Set plane position to the original hit point in world space
    const worldHitPoint = new THREE.Vector3()
    meshRef.current.localToWorld(worldHitPoint.copy(dragState.current.hitPoint))
    plane.setFromNormalAndCoplanarPoint(planeNormal, worldHitPoint)
    
    // Find intersection with plane
    const intersection = new THREE.Vector3()
    raycaster.ray.intersectPlane(plane, intersection)
    
    if (!intersection) return
    
    // Convert to local coordinates
    const targetLocal = meshRef.current.worldToLocal(intersection)
    
    // Calculate movement delta from original hit point
    const movementDelta = targetLocal.clone().sub(dragState.current.hitPoint)
    
    // Update vertices based on their distance from hit point
    for (const v of dragState.current.vertices) {
      if (tool === 'push' || tool === 'pull' || tool === 'deform') {
        // For deform mode, determine push/pull based on drag direction relative to surface normal
        let direction = 1
        if (tool === 'pull') {
          direction = -1
        } else if (tool === 'deform') {
          // Calculate the surface normal at hit point
          const hitPointWorld = meshRef.current.localToWorld(dragState.current.hitPoint.clone())
          const centerWorld = meshRef.current.localToWorld(new THREE.Vector3(0, 0, 0))
          const normalDirection = hitPointWorld.sub(centerWorld).normalize()
          
          // Calculate drag direction in world space
          const dragDirection = intersection.sub(worldHitPoint).normalize()
          
          // Use dot product to determine push/pull
          // Positive dot = dragging away from center (pull)
          // Negative dot = dragging toward center (push)
          const dot = dragDirection.dot(normalDirection)
          direction = dot > 0 ? -1 : 1
        }
        const movement = movementDelta.clone().multiplyScalar(v.weight * direction)
        const newPos = v.startPos.clone().add(movement)
        positions.setXYZ(v.index, newPos.x, newPos.y, newPos.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    
    // Mark geometry as deformed for serialization
    if (!geometry.userData.originalShape) {
      geometry.userData.originalShape = clay.shape || 'unknown';
    }
    geometry.userData.deformed = true
  })
  
  // Generate color based on Z position
  const color = new THREE.Color()
  const zPos = clay.position.z
  const hue = ((zPos + 5) / 10) * 0.3
  color.setHSL(hue, 0.7, 0.6)
  
  return (
    <group ref={groupRef} position={clay.position}>
      <mesh
        ref={meshRef}
        scale={clay.scale instanceof THREE.Vector3 ? [clay.scale.x, clay.scale.y, clay.scale.z] : clay.scale || 1}
        userData={{ clayId: clay.id }}
        onPointerMove={(e) => {
          if ((tool === 'push' || tool === 'pull' || tool === 'deform') && onBrushHover) {
            onBrushHover(e.point)
          }
        }}
        onPointerLeave={() => {
          if (onBrushHover) onBrushHover(null)
        }}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial 
          color={color}
          roughness={0.4}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

// Brush Guide Component
function BrushGuide({ position, size }: { position: THREE.Vector3; size: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshBasicMaterial color="#4dabf7" opacity={0.3} transparent wireframe />
    </mesh>
  )
}

// Scene Component
function Scene({ tool, brushSize, clayRef }: { tool: string; brushSize: number; clayRef: React.MutableRefObject<any> }) {
  const [isDeforming, setIsDeforming] = useState(false)
  const [hoveredPoint, setHoveredPoint] = useState<THREE.Vector3 | null>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Create initial clay
  const [clay] = useState(() => {
    const geometry = new THREE.SphereGeometry(2, 48, 48)
    geometry.userData = { deformed: false }
    return {
      id: 'demo-clay',
      geometry,
      position: new THREE.Vector3(0, 0, 0),
      scale: 1,
      shape: 'sphere'
    }
  })
  
  // Update clayRef with current mesh state
  const updateClayRef = useCallback((mesh: THREE.Mesh) => {
    clayRef.current = {
      ...clay,
      geometry: mesh.geometry.clone(),
      position: mesh.position.clone(),
      scale: mesh.scale.x,
      shape: 'sphere'
    }
  }, [clay, clayRef])
  
  return (
    <>
      <color attach="background" args={['#f8f9fa']} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      
      <Clay 
        clay={clay}
        tool={tool}
        brushSize={brushSize}
        onDeformingChange={setIsDeforming}
        onBrushHover={setHoveredPoint}
        onGeometryUpdate={updateClayRef}
      />
      
      {/* Brush guide */}
      {(tool === 'push' || tool === 'pull' || tool === 'deform') && hoveredPoint && (
        <BrushGuide position={hoveredPoint} size={brushSize} />
      )}
      
      <OrbitControls 
        enablePan={false}
        enabled={tool === 'rotate' && !isDeforming}
        minDistance={3}
        maxDistance={12}
        enableDamping={false}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN
        }}
      />
    </>
  )
}

export default function SimpleClay() {
  const [tool, setTool] = useState<'rotate' | 'deform'>('rotate')
  const brushSize = 0.8
  const router = useRouter()
  const clayRef = useRef<any>(null)
  
  const handleContinueCreating = () => {
    if (clayRef.current && clayRef.current.geometry) {
      try {
        // Store vertex positions directly
        const positions = clayRef.current.geometry.attributes.position.array;
        const clayData = {
          positions: Array.from(positions),
          position: {
            x: clayRef.current.position.x,
            y: clayRef.current.position.y,
            z: clayRef.current.position.z
          },
          scale: clayRef.current.scale,
          shape: clayRef.current.shape || 'sphere'
        }
        sessionStorage.setItem('continueClayData', JSON.stringify(clayData))
        router.push('/project/new')
      } catch (error) {
        console.error('Failed to save clay data:', error)
        // Navigate anyway
        router.push('/project/new')
      }
    }
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Clay</h2>
          
          {/* Tool toggle */}
          <div className="relative bg-gray-100 rounded-lg p-0.5">
            <div 
              className={`absolute inset-y-0.5 transition-transform duration-200 ease-out ${
                tool === 'rotate' ? 'translate-x-0.5' : 'translate-x-[calc(100%-0.125rem)]'
              } w-[calc(50%-0.125rem)] bg-white rounded-md shadow-sm`}
            />
            <div className="relative flex">
              <button
                onClick={() => setTool('rotate')}
                className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  tool === 'rotate' 
                    ? 'text-gray-900' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Rotate View"
              >
                <SwitchCamera size={14} />
                <span>Rotate</span>
              </button>
              <button
                onClick={() => setTool('deform')}
                className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  tool === 'deform' 
                    ? 'text-gray-900' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Push & Pull"
              >
                <SplinePointer size={14} />
                <span>Sculpt</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Full width canvas */}
      <div className="w-full h-80 relative">
        <Canvas 
          camera={{ position: [0, 0, 5], fov: 50 }}
          shadows
        >
          <Suspense fallback={null}>
            <Scene tool={tool} brushSize={brushSize} clayRef={clayRef} />
          </Suspense>
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
              <span>Click and drag on clay • Drag up to pull, down to push</span>
            </>
          )}
        </div>
        
        {/* Continue creating button */}
        <button
          onClick={handleContinueCreating}
          className="absolute bottom-4 right-4 p-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg shadow-md border border-gray-200 transition-all hover:shadow-lg group"
          title="Continue in editor"
        >
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}