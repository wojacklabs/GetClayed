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

function Clay({ clay, tool, brushSize, currentColor, onUpdate, onDeformingChange }: {
  clay: ClayObject
  tool: string
  brushSize: number
  currentColor: string
  onUpdate: (clay: ClayObject) => void
  onDeformingChange: (isDeforming: boolean) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragAnchor = useRef<{ 
    vertices: number[]
    startPositions: Float32Array
    weights: Float32Array
    initialClickPoint: THREE.Vector3
    dragPlane: THREE.Plane
  } | null>(null)
  const { camera, raycaster, pointer } = useThree()
  
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
  }, [clay.geometry])
  
  const handlePointerDown = (e: any) => {
    e.stopPropagation()
    
    if (tool === 'push' || tool === 'pull') {
      if (!meshRef.current) return
      
      setIsDragging(true)
      onDeformingChange(true)
      
      const geometry = meshRef.current.geometry
      const positions = geometry.attributes.position
      
      // Get intersection point in local space
      const localPoint = e.point
      meshRef.current.worldToLocal(localPoint)
      
      // Find vertices within brush radius and calculate weights
      const affectedVertices: number[] = []
      const weights: number[] = []
      const startPositions: number[] = []
      
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const distance = vertex.distanceTo(localPoint)
        
        if (distance <= brushSize) {
          affectedVertices.push(i)
          
          // Weight based on distance (1 at center, 0 at edge)
          const weight = 1 - (distance / brushSize)
          weights.push(Math.pow(weight, 0.5)) // Smoother falloff
          
          // Store original position
          startPositions.push(vertex.x, vertex.y, vertex.z)
        }
      }
      
      // Create drag plane perpendicular to camera
      const dragPlane = new THREE.Plane()
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, e.point)
      
      dragAnchor.current = {
        vertices: affectedVertices,
        startPositions: new Float32Array(startPositions),
        weights: new Float32Array(weights),
        initialClickPoint: e.point.clone(),
        dragPlane: dragPlane
      }
    } else if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }
  
  const handlePointerMove = (e: any) => {
    if (!isDragging || !dragAnchor.current || !meshRef.current) return
    
    e.stopPropagation()
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    const anchor = dragAnchor.current
    
    // Calculate mouse position on drag plane
    const intersectPoint = new THREE.Vector3()
    raycaster.ray.intersectPlane(anchor.dragPlane, intersectPoint)
    
    // If no intersection (mouse outside viewport), use the event point
    if (!intersectPoint.x && !intersectPoint.y && !intersectPoint.z) {
      intersectPoint.copy(e.point)
    }
    
    // Convert to local space
    const localPoint = meshRef.current.worldToLocal(intersectPoint.clone())
    
    // Find the highest weighted vertex (closest to initial click)
    let maxWeightIndex = 0
    let maxWeight = 0
    for (let i = 0; i < anchor.weights.length; i++) {
      if (anchor.weights[i] > maxWeight) {
        maxWeight = anchor.weights[i]
        maxWeightIndex = i
      }
    }
    
    for (let i = 0; i < anchor.vertices.length; i++) {
      const vertexIndex = anchor.vertices[i]
      const weight = anchor.weights[i]
      
      // Get original position
      const originalPos = new THREE.Vector3(
        anchor.startPositions[i * 3],
        anchor.startPositions[i * 3 + 1],
        anchor.startPositions[i * 3 + 2]
      )
      
      if (tool === 'push') {
        // For push: vertices move with the cursor
        if (i === maxWeightIndex) {
          // The vertex that was closest to initial click follows cursor exactly
          positions.setXYZ(vertexIndex, localPoint.x, localPoint.y, localPoint.z)
        } else {
          // Other vertices follow based on their relative position to the main vertex
          const mainVertexOriginal = new THREE.Vector3(
            anchor.startPositions[maxWeightIndex * 3],
            anchor.startPositions[maxWeightIndex * 3 + 1],
            anchor.startPositions[maxWeightIndex * 3 + 2]
          )
          
          // Calculate offset from main vertex
          const offset = originalPos.clone().sub(mainVertexOriginal)
          
          // New position is cursor position plus weighted offset
          const newPos = localPoint.clone().add(offset.multiplyScalar(1 - weight * 0.5))
          positions.setXYZ(vertexIndex, newPos.x, newPos.y, newPos.z)
        }
      } else if (tool === 'pull') {
        // For pull: vertices move toward cursor position
        const newPos = originalPos.clone().lerp(localPoint, weight * 0.8)
        positions.setXYZ(vertexIndex, newPos.x, newPos.y, newPos.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  }
  
  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false)
      dragAnchor.current = null
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

export default function ClayDragSystem() {
  const [clayObject, setClayObject] = useState<ClayObject | null>(null)
  const [tool, setTool] = useState<'rotate' | 'push' | 'pull' | 'paint'>('rotate')
  const [brushSize, setBrushSize] = useState(0.8)
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
        <h2 className="text-xl font-bold mb-4">Clay Drag Sculptor</h2>
        
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
              Push & Drag
            </button>
            <button
              onClick={() => setTool('pull')}
              className={`p-3 rounded text-sm ${
                tool === 'pull' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Pull Together
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
        
        {/* Brush Settings */}
        {(tool === 'push' || tool === 'pull') && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">Brush Settings</h3>
            <div>
              <label className="text-xs">Size: {brushSize.toFixed(2)}</label>
              <input
                type="range"
                min="0.2"
                max="2"
                step="0.1"
                value={brushSize}
                onChange={(e) => setBrushSize(parseFloat(e.target.value))}
                className="w-full"
              />
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
        <div className="mb-4 p-3 bg-gray-100 rounded text-sm mt-4">
          <p className="font-semibold mb-1">Current Tool:</p>
          <p className="text-lg">{
            tool === 'rotate' ? '🔄 Rotate View' :
            tool === 'push' ? '👆 Push & Drag' :
            tool === 'pull' ? '🤏 Pull Together' :
            '🎨 Paint'
          }</p>
        </div>
        
        {/* Instructions */}
        <div className="text-xs text-gray-500">
          <p className="font-semibold mb-1">How it works:</p>
          <p>• Push & Drag: Click and drag</p>
          <p>• Center point follows mouse exactly</p>
          <p>• Surrounding area stretches naturally</p>
          <p className="mt-2 font-semibold">Pro tip:</p>
          <p>• Smaller brush = more precise</p>
          <p>• Larger brush = smoother deform</p>
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
