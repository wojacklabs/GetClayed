'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { TrackballControls, Environment } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense } from 'react'
import * as THREE from 'three'

interface ClayObject {
  id: string
  geometry: THREE.BufferGeometry
  position: THREE.Vector3
  color: string
}

function Clay({ clay, tool, brushSize, brushStrength, currentColor, onUpdate, onDeformingChange }: {
  clay: ClayObject
  tool: string
  brushSize: number
  brushStrength: number
  currentColor: string
  onUpdate: (clay: ClayObject) => void
  onDeformingChange: (isDeforming: boolean) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [isDeforming, setIsDeforming] = useState(false)
  const [dragStart, setDragStart] = useState<THREE.Vector3 | null>(null)
  const [dragCurrent, setDragCurrent] = useState<THREE.Vector3 | null>(null)
  const [affectedVertices, setAffectedVertices] = useState<number[]>([])
  const { raycaster, pointer, camera } = useThree()
  
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
  }, [clay.geometry])
  
  // No continuous deformation - we'll use drag-based deformation instead
  
  // Store original positions and closest vertex info when starting drag
  const originalPositions = useRef<Float32Array | null>(null)
  const closestVertexIndex = useRef<number>(-1)
  const closestVertexOffset = useRef<THREE.Vector3>(new THREE.Vector3())
  
  const deformMeshByDrag = (startPoint: THREE.Vector3, currentPoint: THREE.Vector3) => {
    if (!meshRef.current || !originalPositions.current) return
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    
    // Convert world points to local space
    const localStart = meshRef.current.worldToLocal(startPoint.clone())
    const localCurrent = meshRef.current.worldToLocal(currentPoint.clone())
    
    // Calculate drag vector
    const dragVector = localCurrent.clone().sub(localStart)
    
    // Get camera's coordinate system
    const cameraDirection = new THREE.Vector3()
    camera.getWorldDirection(cameraDirection)
    
    const worldUp = new THREE.Vector3(0, 1, 0)
    const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, worldUp).normalize()
    const cameraUp = new THREE.Vector3().crossVectors(cameraRight, cameraDirection).normalize()
    
    // Project drag vector onto camera's coordinate system
    const movementRight = dragVector.dot(cameraRight)
    const movementUp = dragVector.dot(cameraUp)
    const movementForward = dragVector.dot(cameraDirection)
    
    // Create screen-based movement vector
    const screenDragVector = new THREE.Vector3()
      .addScaledVector(cameraRight, movementRight * 0.7)
      .addScaledVector(cameraUp, movementUp * 0.7)
      .addScaledVector(cameraDirection, movementForward)
    
    // Debug: check if we have a valid closest vertex
    if (closestVertexIndex.current === -1) {
      console.warn('No closest vertex found!')
      return
    }
    
    // Apply deformation from original positions
    for (let i = 0; i < positions.count; i++) {
      // Start from original position
      const originalVertex = new THREE.Vector3(
        originalPositions.current[i * 3],
        originalPositions.current[i * 3 + 1],
        originalPositions.current[i * 3 + 2]
      )
      
      const distanceToStart = originalVertex.distanceTo(localStart)
      
      if (distanceToStart < brushSize) {
        // Calculate influence based on distance
        const normalizedDistance = distanceToStart / brushSize
        
        // Different falloff for different tools
        let influence: number = 0
        if (tool === 'push') {
          // For push, use a sharper falloff for more precise control
          influence = Math.pow(1 - normalizedDistance, 2)
          
          // The closest point follows the mouse exactly
          if (i === closestVertexIndex.current) {
            influence = 1
          }
        } else if (tool === 'pull') {
          // For pull, use a broader influence
          influence = Math.pow(1 - normalizedDistance, 1.5)
        }
        
        // Calculate new position
        const newVertex = originalVertex.clone()
        
        if (tool === 'push') {
          // Move vertex with the drag
          if (i === closestVertexIndex.current) {
            // This vertex follows the mouse EXACTLY - no limitations
            newVertex.copy(localCurrent).add(closestVertexOffset.current)
          } else {
            // Other vertices follow with falloff using screen-based movement
            const moveAmount = screenDragVector.clone().multiplyScalar(influence)
            newVertex.add(moveAmount)
          }
        } else if (tool === 'pull') {
          // Pull vertices toward the current position
          const toCurrent = localCurrent.clone().sub(originalVertex)
          const pullStrength = Math.min(influence, 0.95) // Almost complete pull
          newVertex.lerp(localCurrent, pullStrength)
        }
        
        positions.setXYZ(i, newVertex.x, newVertex.y, newVertex.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  }
  
  const smoothMesh = (point: THREE.Vector3) => {
    if (!meshRef.current) return
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    
    const localPoint = meshRef.current.worldToLocal(point.clone())
    const smoothedPositions: THREE.Vector3[] = []
    
    // First pass: calculate smoothed positions
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      )
      
      const distance = vertex.distanceTo(localPoint)
      
      if (distance < brushSize) {
        const influence = 1 - (distance / brushSize)
        const smoothInfluence = Math.pow(influence, 2)
        
        // Average with nearby vertices
        let avgVertex = vertex.clone()
        let count = 1
        
        for (let j = 0; j < positions.count; j++) {
          if (i !== j) {
            const otherVertex = new THREE.Vector3(
              positions.getX(j),
              positions.getY(j),
              positions.getZ(j)
            )
            
            if (vertex.distanceTo(otherVertex) < brushSize * 0.5) {
              avgVertex.add(otherVertex)
              count++
            }
          }
        }
        
        avgVertex.divideScalar(count)
        
        // Blend based on influence
        vertex.lerp(avgVertex, smoothInfluence * 0.3)
        smoothedPositions[i] = vertex
      } else {
        smoothedPositions[i] = vertex
      }
    }
    
    // Apply smoothed positions
    for (let i = 0; i < positions.count; i++) {
      if (smoothedPositions[i]) {
        positions.setXYZ(i, smoothedPositions[i].x, smoothedPositions[i].y, smoothedPositions[i].z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  }
  
  const handlePointerDown = (e: any) => {
    e.stopPropagation()
    
    if (tool === 'push' || tool === 'pull') {
      setIsDeforming(true)
      setDragStart(e.point.clone())
      setDragCurrent(e.point.clone())
      onDeformingChange(true)
      
      // Store original positions and find closest vertex
      if (meshRef.current) {
        const geometry = meshRef.current.geometry
        const positions = geometry.attributes.position
        originalPositions.current = new Float32Array(positions.array)
        
        // Find the closest vertex to the click point
        const localPoint = meshRef.current.worldToLocal(e.point.clone())
        let minDistance = Infinity
        closestVertexIndex.current = -1
        
        for (let i = 0; i < positions.count; i++) {
          const vertex = new THREE.Vector3(
            positions.getX(i),
            positions.getY(i),
            positions.getZ(i)
          )
          
          const distance = vertex.distanceTo(localPoint)
          if (distance < minDistance && distance < brushSize) {
            minDistance = distance
            closestVertexIndex.current = i
            // Store offset from vertex to click point
            closestVertexOffset.current = vertex.clone().sub(localPoint)
          }
        }
      }
    } else if (tool === 'smooth') {
      setIsDeforming(true)
      setDragStart(e.point.clone())
      onDeformingChange(true)
      smoothMesh(e.point)
    } else if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }
  
  const handlePointerMove = (e: any) => {
    if (!isDeforming || !dragStart) return
    
    e.stopPropagation()
    setDragCurrent(e.point.clone())
    
    if (tool === 'push' || tool === 'pull') {
      deformMeshByDrag(dragStart, e.point)
    } else if (tool === 'smooth') {
      smoothMesh(e.point)
    }
  }
  
  const handlePointerUp = () => {
    if (isDeforming) {
      setIsDeforming(false)
      setDragStart(null)
      setDragCurrent(null)
      setAffectedVertices([])
      originalPositions.current = null
      closestVertexIndex.current = -1
      onDeformingChange(false)
    }
  }
  
  return (
    <mesh
      ref={meshRef}
      position={clay.position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <meshPhongMaterial
        color={clay.color}
        specular={0x111111}
        shininess={50}
      />
    </mesh>
  )
}

export default function SimpleClaySculptor() {
  const [clayObject, setClayObject] = useState<ClayObject | null>(null)
  const [tool, setTool] = useState<'rotate' | 'push' | 'pull' | 'smooth' | 'paint'>('rotate')
  const [brushSize, setBrushSize] = useState(0.8)
  const [brushStrength, setBrushStrength] = useState(0.8)
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [detail, setDetail] = useState(64)
  const [isDeforming, setIsDeforming] = useState(false)
  
  // Initialize clay object
  useEffect(() => {
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    setClayObject({
      id: 'main-clay',
      geometry: geometry,
      position: new THREE.Vector3(0, 0, 0),
      color: currentColor
    })
  }, [detail])
  
  const updateClay = (updatedClay: ClayObject) => {
    setClayObject(updatedClay)
  }
  
  const resetClay = () => {
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    setClayObject({
      id: 'main-clay',
      geometry: geometry,
      position: new THREE.Vector3(0, 0, 0),
      color: currentColor
    })
  }
  
  return (
    <div className="w-full h-full flex">
      {/* Toolbar */}
      <div className="w-72 bg-white shadow-lg p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Clay Sculptor</h2>
        
        {/* Tools */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Tools</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTool('rotate')}
              className={`p-3 rounded text-sm ${
                tool === 'rotate' ? 'bg-orange-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Rotate View
            </button>
            <button
              onClick={() => setTool('push')}
              className={`p-3 rounded text-sm ${
                tool === 'push' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Push Out
            </button>
            <button
              onClick={() => setTool('pull')}
              className={`p-3 rounded text-sm ${
                tool === 'pull' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Pull In
            </button>
            <button
              onClick={() => setTool('smooth')}
              className={`p-3 rounded text-sm ${
                tool === 'smooth' ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Smooth
            </button>
            <button
              onClick={() => setTool('paint')}
              className={`p-3 rounded text-sm ${
                tool === 'paint' ? 'bg-purple-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Paint
            </button>
          </div>
        </div>
        
        {/* Brush Settings - only show for sculpting tools */}
        {(tool === 'push' || tool === 'pull' || tool === 'smooth') && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">Brush Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs">Size: {brushSize.toFixed(2)}</label>
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.05"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs">Strength: {brushStrength.toFixed(2)}</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={brushStrength}
                  onChange={(e) => setBrushStrength(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Color */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Color</h3>
          <div className="flex items-center space-x-2 mb-2">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setCurrentColor(e.target.value)}
              className="w-full h-10 rounded cursor-pointer"
            />
            <span className="text-xs">{currentColor}</span>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#bb8fce', '#85929e',
              '#ff9ff3', '#54a0ff', '#48dbfb', '#1dd1a1', '#feca57', '#ff6348'].map(color => (
              <button
                key={color}
                onClick={() => setCurrentColor(color)}
                className="w-10 h-10 rounded border-2 border-gray-300 hover:border-gray-500"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        
        {/* Clay Settings */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Clay Settings</h3>
          <div>
            <label className="text-xs">Detail Level: {detail}</label>
            <input
              type="range"
              min="16"
              max="128"
              step="16"
              value={detail}
              onChange={(e) => setDetail(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Higher = more detailed</p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={resetClay}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset Clay
          </button>
        </div>
        
        {/* Status */}
        <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
          <p className="font-semibold mb-1">Current Tool:</p>
          <p className="text-lg">{
            tool === 'rotate' ? '🔄 Rotate View' :
            tool === 'push' ? '⬆️ Push Out' :
            tool === 'pull' ? '⬇️ Pull In' :
            tool === 'smooth' ? '〰️ Smooth' :
            '🎨 Paint'
          }</p>
        </div>
        
        {/* Instructions */}
        <div className="text-xs text-gray-500 mt-6">
          <p className="font-semibold mb-1">How to Use:</p>
          <p>• Rotate View: Drag to rotate camera</p>
          <p>• Push Out: Click & drag outward to stretch</p>
          <p>• Pull In: Click & drag to gather clay</p>
          <p>• Smooth: Click & drag to soften</p>
          <p>• Paint: Click to change color</p>
          <p className="mt-2 font-semibold">Sculpting Tips:</p>
          <p>• Drag direction controls deformation</p>
          <p>• Longer drags = bigger changes</p>
          <p>• Adjust brush size for detail work</p>
        </div>
      </div>
      
      {/* 3D Canvas */}
      <div className="flex-1 bg-gray-100">
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 5]} intensity={0.8} />
            <directionalLight position={[-10, -10, -5]} intensity={0.3} />
            
            <TrackballControls 
              enabled={tool === 'rotate'}
              rotateSpeed={1.5}
              zoomSpeed={1.2}
              panSpeed={0.8}
              noPan={true}
              minDistance={3}
              maxDistance={20}
              staticMoving={false}
              dynamicDampingFactor={0.1}
            />
            
            {/* Clay Object */}
            {clayObject && (
              <Clay
                clay={clayObject}
                tool={tool}
                brushSize={brushSize}
                brushStrength={brushStrength}
                currentColor={currentColor}
                onUpdate={updateClay}
                onDeformingChange={setIsDeforming}
              />
            )}
            
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}
