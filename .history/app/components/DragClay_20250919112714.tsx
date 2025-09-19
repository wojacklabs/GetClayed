'use client'

import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { TrackballControls, Environment } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense } from 'react'
import * as THREE from 'three'

// Helper to get mouse position in 3D space
function getMousePosition3D(
  mouse: THREE.Vector2,
  camera: THREE.Camera,
  distance: number = 10
): THREE.Vector3 {
  const vec = new THREE.Vector3(mouse.x, mouse.y, 0.5)
  vec.unproject(camera)
  vec.sub(camera.position).normalize()
  const pos = camera.position.clone()
  pos.add(vec.multiplyScalar(distance))
  return pos
}

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
  const dragState = useRef<{
    startPoint: THREE.Vector3
    startMouseNDC: THREE.Vector2
    affectedVertices: {
      index: number
      originalPos: THREE.Vector3
      weight: number
    }[]
    mainVertexIndex: number
    cameraDistance: number
  } | null>(null)
  
  const { camera, gl, size } = useThree()
  
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
      const localPoint = e.point.clone()
      meshRef.current.worldToLocal(localPoint)
      
      // Store initial world point and camera distance
      const worldPoint = e.point.clone()
      const cameraDistance = camera.position.distanceTo(worldPoint)
      
      // Get mouse position in NDC
      const mouseNDC = new THREE.Vector2(
        (e.nativeEvent.offsetX / size.width) * 2 - 1,
        -(e.nativeEvent.offsetY / size.height) * 2 + 1
      )
      
      // Find affected vertices
      const affectedVertices: { index: number; originalPos: THREE.Vector3; weight: number; }[] = []
      let closestDistance = Infinity
      let mainVertexIndex = -1
      
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const distance = vertex.distanceTo(localPoint)
        
        if (distance <= brushSize) {
          const weight = 1 - (distance / brushSize)
          affectedVertices.push({
            index: i,
            originalPos: vertex.clone(),
            weight: Math.pow(weight, 0.5)
          })
          
          if (distance < closestDistance) {
            closestDistance = distance
            mainVertexIndex = affectedVertices.length - 1
          }
        }
      }
      
      dragState.current = {
        startPoint: localPoint.clone(),
        startMouseNDC: mouseNDC,
        affectedVertices,
        mainVertexIndex,
        cameraDistance
      }
    } else if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }
  
  useFrame(() => {
    if (!isDragging || !dragState.current || !meshRef.current) return
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    const state = dragState.current
    
    // Get current mouse position from pointer events
    const rect = gl.domElement.getBoundingClientRect()
    const x = (((gl.domElement as any)['_lastPointerX'] - rect.left) / rect.width) * 2 - 1
    const y = -(((gl.domElement as any)['_lastPointerY'] - rect.top) / rect.height) * 2 + 1
    
    // Get mouse position in 3D
    const mouse3D = getMousePosition3D(
      new THREE.Vector2(x, y),
      camera,
      state.cameraDistance
    )
    
    // Convert to local space
    const localMouse = meshRef.current.worldToLocal(mouse3D)
    
    // Get camera's coordinate system
    const cameraDirection = new THREE.Vector3()
    camera.getWorldDirection(cameraDirection)
    
    const worldUp = new THREE.Vector3(0, 1, 0)
    const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, worldUp).normalize()
    const cameraUp = new THREE.Vector3().crossVectors(cameraRight, cameraDirection).normalize()
    
    // Update vertices
    for (const vertexData of state.affectedVertices) {
      const { index, originalPos, weight } = vertexData
      const isMainVertex = state.affectedVertices.indexOf(vertexData) === state.mainVertexIndex
      
      if (tool === 'push') {
        if (isMainVertex) {
          // Main vertex follows mouse exactly
          positions.setXYZ(index, localMouse.x, localMouse.y, localMouse.z)
        } else {
          // Calculate movement delta
          const mainVertexOriginalPos = state.affectedVertices[state.mainVertexIndex].originalPos
          const delta = localMouse.clone().sub(mainVertexOriginalPos)
          
          // Project delta onto camera coordinates
          const movementRight = delta.dot(cameraRight)
          const movementUp = delta.dot(cameraUp)
          const movementForward = delta.dot(cameraDirection)
          
          // Create screen-based movement
          const screenMovement = new THREE.Vector3()
            .addScaledVector(cameraRight, movementRight * 0.7)
            .addScaledVector(cameraUp, movementUp * 0.7)
            .addScaledVector(cameraDirection, movementForward)
          
          // Apply movement with weight
          const movement = screenMovement.multiplyScalar(weight * weight)
          const newPos = originalPos.clone().add(movement)
          positions.setXYZ(index, newPos.x, newPos.y, newPos.z)
        }
      } else if (tool === 'pull') {
        const targetPos = originalPos.clone().lerp(localMouse, weight * 0.8)
        positions.setXYZ(index, targetPos.x, targetPos.y, targetPos.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  })
  
  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false)
      dragState.current = null
      onDeformingChange(false)
    }
  }
  
  // Track mouse position on canvas
  useEffect(() => {
    const canvas = gl.domElement
    const handleMouseMove = (e: MouseEvent) => {
      (canvas as any)['_lastPointerX'] = e.clientX
      ;(canvas as any)['_lastPointerY'] = e.clientY
    }
    
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('pointermove', handleMouseMove)
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('pointermove', handleMouseMove)
    }
  }, [gl])
  
  return (
    <mesh
      ref={meshRef}
      position={clay.position}
      onPointerDown={handlePointerDown}
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

export default function DragClay() {
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
        <h2 className="text-xl font-bold mb-4">Ultimate Clay Drag</h2>
        
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
            Reset Clay
          </button>
        </div>
        
        {/* Instructions */}
        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">개선된 기능:</p>
          <p>• 도형 밖으로도 자유롭게 드래그</p>
          <p>• 클릭한 지점이 마우스를 정확히 추적</p>
          <p>• 카메라 거리에 관계없이 일관된 동작</p>
          <p className="mt-2 font-semibold">사용법:</p>
          <p>• Push: 클릭하고 드래그로 늘리기</p>
          <p>• Pull: 주변을 모으기</p>
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
