'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { TrackballControls, Environment } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense, useCallback } from 'react'
import * as THREE from 'three'

interface ClayObject {
  id: string
  geometry: THREE.BufferGeometry
  position: THREE.Vector3
  color: string
}

interface DragInfo {
  vertices: number[]
  originalPositions: Float32Array
  weights: Float32Array
  mainVertexIndex: number
  initialWorldPoint: THREE.Vector3
  initialLocalPoint: THREE.Vector3
  dragPlane: THREE.Plane
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
  const dragInfo = useRef<DragInfo | null>(null)
  const raycaster = useRef(new THREE.Raycaster())
  const { camera, gl, size } = useThree()
  
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
  }, [clay.geometry])
  
  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation()
    
    if (tool === 'push' || tool === 'pull') {
      if (!meshRef.current) return
      
      setIsDragging(true)
      onDeformingChange(true)
      
      const geometry = meshRef.current.geometry
      const positions = geometry.attributes.position
      
      // Get click point
      const worldPoint = e.point.clone()
      const localPoint = meshRef.current.worldToLocal(worldPoint.clone())
      
      // Create drag plane perpendicular to camera at click point
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      const dragPlane = new THREE.Plane()
      dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, worldPoint)
      
      // Find affected vertices
      const affectedVertices: number[] = []
      const weights: number[] = []
      const originalPositions: number[] = []
      let mainVertexIndex = -1
      let minDistance = Infinity
      
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const distance = vertex.distanceTo(localPoint)
        
        if (distance <= brushSize) {
          affectedVertices.push(i)
          
          // Store original position
          originalPositions.push(vertex.x, vertex.y, vertex.z)
          
          // Calculate weight (1 at center, 0 at edge)
          const weight = 1 - (distance / brushSize)
          weights.push(Math.pow(weight, 0.5))
          
          // Track closest vertex
          if (distance < minDistance) {
            minDistance = distance
            mainVertexIndex = affectedVertices.length - 1
          }
        }
      }
      
      dragInfo.current = {
        vertices: affectedVertices,
        originalPositions: new Float32Array(originalPositions),
        weights: new Float32Array(weights),
        mainVertexIndex,
        initialWorldPoint: worldPoint,
        initialLocalPoint: localPoint,
        dragPlane
      }
    } else if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }, [tool, brushSize, currentColor, camera, onUpdate, onDeformingChange])
  
  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging || !dragInfo.current || !meshRef.current) return
    
    e.stopPropagation()
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    const info = dragInfo.current
    
    // Calculate mouse position in NDC
    const rect = gl.domElement.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    
    // Update raycaster
    raycaster.current.setFromCamera(new THREE.Vector2(x, y), camera)
    
    // Find intersection with drag plane
    const intersectPoint = new THREE.Vector3()
    raycaster.current.ray.intersectPlane(info.dragPlane, intersectPoint)
    
    // Convert to local space
    const localIntersect = meshRef.current.worldToLocal(intersectPoint.clone())
    
    // Calculate drag vector from initial point
    const dragVector = localIntersect.clone().sub(info.initialLocalPoint)
    
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
    
    // Update vertices
    for (let i = 0; i < info.vertices.length; i++) {
      const vertexIndex = info.vertices[i]
      const weight = info.weights[i]
      const isMainVertex = i === info.mainVertexIndex
      
      // Get original position
      const originalPos = new THREE.Vector3(
        info.originalPositions[i * 3],
        info.originalPositions[i * 3 + 1],
        info.originalPositions[i * 3 + 2]
      )
      
      if (tool === 'push') {
        if (isMainVertex) {
          // Main vertex follows mouse exactly
          const newPos = originalPos.clone().add(dragVector)
          positions.setXYZ(vertexIndex, newPos.x, newPos.y, newPos.z)
        } else {
          // Other vertices follow with falloff using screen-based movement
          const scaledDrag = screenDragVector.clone().multiplyScalar(weight * weight)
          const newPos = originalPos.clone().add(scaledDrag)
          positions.setXYZ(vertexIndex, newPos.x, newPos.y, newPos.z)
        }
      } else if (tool === 'pull') {
        // Pull vertices toward drag position
        const targetPos = localIntersect.clone()
        const newPos = originalPos.clone().lerp(targetPos, weight * 0.8)
        positions.setXYZ(vertexIndex, newPos.x, newPos.y, newPos.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  }, [isDragging, tool, camera, gl])
  
  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      dragInfo.current = null
      onDeformingChange(false)
    }
  }, [isDragging, onDeformingChange])
  
  useEffect(() => {
    // Add global mouse up handler to catch mouse up outside canvas
    const handleGlobalMouseUp = () => {
      handlePointerUp()
    }
    
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('pointerup', handleGlobalMouseUp)
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('pointerup', handleGlobalMouseUp)
    }
  }, [handlePointerUp])
  
  return (
    <mesh
      ref={meshRef}
      position={clay.position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <meshPhongMaterial
        color={clay.color}
        specular={0x111111}
        shininess={50}
      />
    </mesh>
  )
}

export default function FreeDragClay() {
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
        <h2 className="text-xl font-bold mb-4">자유 드래그 점토</h2>
        
        {/* Tools */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">도구</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTool('rotate')}
              className={`p-3 rounded text-sm ${
                tool === 'rotate' ? 'bg-orange-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              화면 회전
            </button>
            <button
              onClick={() => setTool('push')}
              className={`p-3 rounded text-sm ${
                tool === 'push' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              밀기 & 당기기
            </button>
            <button
              onClick={() => setTool('pull')}
              className={`p-3 rounded text-sm ${
                tool === 'pull' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              모으기
            </button>
            <button
              onClick={() => setTool('paint')}
              className={`p-3 rounded text-sm ${
                tool === 'paint' ? 'bg-purple-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              색칠하기
            </button>
          </div>
        </div>
        
        {/* Brush Settings */}
        {(tool === 'push' || tool === 'pull') && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">브러시 설정</h3>
            <div>
              <label className="text-xs">크기: {brushSize.toFixed(2)}</label>
              <input
                type="range"
                min="0.3"
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
          <h3 className="text-sm font-semibold mb-2">색상</h3>
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
          <h3 className="text-sm font-semibold mb-2">점토 설정</h3>
          <div>
            <label className="text-xs">디테일 레벨: {detail}</label>
            <input
              type="range"
              min="32"
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
            점토 초기화
          </button>
        </div>
        
        {/* Instructions */}
        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">핵심 개선:</p>
          <p>✓ 도형 밖으로 자유롭게 드래그</p>
          <p>✓ 드래그 평면 사용으로 정확한 3D 추적</p>
          <p>✓ 클릭한 점이 마우스를 정확히 따라감</p>
          <p className="mt-2 font-semibold">사용법:</p>
          <p>• 밀기 & 당기기: 클릭하고 드래그</p>
          <p>• 모으기: 주변을 끌어모음</p>
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
              enabled={tool === 'rotate' && !isDeforming}
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
