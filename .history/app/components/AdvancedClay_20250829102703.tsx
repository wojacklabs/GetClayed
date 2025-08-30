'use client'

import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { TrackballControls, Environment } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense, useCallback } from 'react'
import * as THREE from 'three'

interface ClayObject {
  id: string
  geometry: THREE.BufferGeometry
  position: THREE.Vector3
  color: string
}

interface HistoryState {
  clayObjects: ClayObject[]
  timestamp: number
}

// History Manager Hook
function useHistory() {
  const [history, setHistory] = useState<HistoryState[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  
  const addToHistory = useCallback((state: ClayObject[]) => {
    setHistory(prev => {
      // Remove any states after current index
      const newHistory = prev.slice(0, currentIndex + 1)
      // Add new state
      const newState: HistoryState = {
        clayObjects: state.map(clay => ({
          ...clay,
          geometry: clay.geometry.clone(),
          position: clay.position.clone()
        })),
        timestamp: Date.now()
      }
      newHistory.push(newState)
      // Limit history to 50 states
      if (newHistory.length > 50) {
        newHistory.shift()
      }
      return newHistory
    })
    setCurrentIndex(prev => Math.min(prev + 1, 49))
  }, [currentIndex])
  
  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      return history[currentIndex - 1].clayObjects
    }
    return null
  }, [currentIndex, history])
  
  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1)
      return history[currentIndex + 1].clayObjects
    }
    return null
  }, [currentIndex, history])
  
  return { addToHistory, undo, redo, canUndo: currentIndex > 0, canRedo: currentIndex < history.length - 1 }
}

// Individual Clay Component
function Clay({ 
  clay, 
  tool, 
  brushSize, 
  currentColor, 
  onUpdate, 
  onDeformingChange,
  isSelected,
  onSelect
}: {
  clay: ClayObject
  tool: string
  brushSize: number
  currentColor: string
  onUpdate: (clay: ClayObject) => void
  onDeformingChange: (isDeforming: boolean) => void
  isSelected: boolean
  onSelect: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const { camera, raycaster, gl } = useThree()
  
  // Drag state
  const dragState = useRef({
    active: false,
    mousePos: new THREE.Vector2(),
    targetVertex: -1,
    originalGeometry: null as THREE.BufferGeometry | null,
    vertices: [] as Array<{
      index: number
      weight: number
      startPos: THREE.Vector3
    }>
  })
  
  useEffect(() => {
    if (!meshRef.current) return
    
    // Set up geometry
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
    meshRef.current.geometry.computeBoundingBox()
    meshRef.current.geometry.computeBoundingSphere()
    
    // Set up material
    if (meshRef.current.material) {
      meshRef.current.material.side = THREE.DoubleSide
      ;(meshRef.current.material as any).frustumCulled = false
    }
    meshRef.current.frustumCulled = false
  }, [clay.geometry])
  
  // Canvas event handlers
  useEffect(() => {
    const canvas = gl.domElement
    
    const updateMousePosition = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      dragState.current.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      dragState.current.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    
    const handleMouseDown = (e: MouseEvent) => {
      if (tool === 'move') {
        // Select clay for moving
        updateMousePosition(e)
        raycaster.setFromCamera(dragState.current.mousePos, camera)
        
        if (meshRef.current) {
          const intersects = raycaster.intersectObject(meshRef.current)
          if (intersects.length > 0) {
            onSelect()
            // Start drag for move
            dragState.current.active = true
            dragState.current.originalGeometry = meshRef.current.geometry.clone()
          }
        }
        return
      }
      
      if (tool !== 'push' && tool !== 'pull') return
      if (!meshRef.current) return
      
      updateMousePosition(e)
      
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
      
      // Find closest vertex
      let closestIdx = -1
      
      if (intersection.face) {
        const face = intersection.face
        const baryCoord = new THREE.Vector3()
        
        THREE.Triangle.getBarycoord(
          hitPoint,
          new THREE.Vector3(positions.getX(face.a), positions.getY(face.a), positions.getZ(face.a)),
          new THREE.Vector3(positions.getX(face.b), positions.getY(face.b), positions.getZ(face.b)),
          new THREE.Vector3(positions.getX(face.c), positions.getY(face.c), positions.getZ(face.c)),
          baryCoord
        )
        
        if (baryCoord.x > baryCoord.y && baryCoord.x > baryCoord.z) {
          closestIdx = face.a
        } else if (baryCoord.y > baryCoord.z) {
          closestIdx = face.b
        } else {
          closestIdx = face.c
        }
      }
      
      if (closestIdx === -1) return
      
      // Find affected vertices
      dragState.current.vertices = []
      const centerPos = new THREE.Vector3(
        positions.getX(closestIdx),
        positions.getY(closestIdx),
        positions.getZ(closestIdx)
      )
      
      for (let i = 0; i < positions.count; i++) {
        const pos = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const dist = pos.distanceTo(centerPos)
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
      dragState.current.targetVertex = closestIdx
      onDeformingChange(true)
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.current.active) {
        updateMousePosition(e)
      }
    }
    
    const handleMouseUp = () => {
      if (dragState.current.active) {
        dragState.current.active = false
        dragState.current.targetVertex = -1
        dragState.current.vertices = []
        onDeformingChange(false)
        
        // Trigger update for history
        if (tool === 'move' && isSelected) {
          // Position update is already handled in useFrame
        } else if (meshRef.current && dragState.current.originalGeometry) {
          // Geometry update for push/pull
          const newClay = {
            ...clay,
            geometry: meshRef.current.geometry.clone()
          }
          onUpdate(newClay)
        }
        
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
  }, [tool, brushSize, camera, raycaster, gl, onDeformingChange, clay, onUpdate, onSelect, isSelected])
  
  // Frame update for dragging
  useFrame(() => {
    if (!dragState.current.active || !meshRef.current) return
    
    // Skip frame update for move tool - using keyboard/buttons instead
    if (tool === 'move') return
    
    if (dragState.current.targetVertex === -1) return
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    
    // Create ray from mouse position
    raycaster.setFromCamera(dragState.current.mousePos, camera)
    
    // Get target vertex world position
    const targetWorldPos = new THREE.Vector3(
      positions.getX(dragState.current.targetVertex),
      positions.getY(dragState.current.targetVertex),
      positions.getZ(dragState.current.targetVertex)
    )
    meshRef.current.localToWorld(targetWorldPos)
    
    // Create plane perpendicular to camera
    const cameraDir = new THREE.Vector3()
    camera.getWorldDirection(cameraDir)
    const plane = new THREE.Plane()
    plane.setFromNormalAndCoplanarPoint(cameraDir, targetWorldPos)
    
    // Get intersection point
    const intersection = new THREE.Vector3()
    const hasIntersection = raycaster.ray.intersectPlane(plane, intersection)
    
    if (!hasIntersection) {
      const distance = camera.position.distanceTo(targetWorldPos)
      intersection.copy(raycaster.ray.origin).add(
        raycaster.ray.direction.clone().multiplyScalar(distance)
      )
    }
    
    // Convert to local coordinates
    const targetLocal = meshRef.current.worldToLocal(intersection)
    
    // Update vertices
    for (const v of dragState.current.vertices) {
      if (tool === 'push') {
        if (v.index === dragState.current.targetVertex) {
          positions.setXYZ(v.index, targetLocal.x, targetLocal.y, targetLocal.z)
        } else {
          const mainStartPos = dragState.current.vertices.find(
            vertex => vertex.index === dragState.current.targetVertex
          )?.startPos
          
          if (mainStartPos) {
            const delta = targetLocal.clone().sub(mainStartPos)
            const movement = delta.multiplyScalar(v.weight)
            const newPos = v.startPos.clone().add(movement)
            positions.setXYZ(v.index, newPos.x, newPos.y, newPos.z)
          }
        }
      } else if (tool === 'pull') {
        const newPos = v.startPos.clone().lerp(targetLocal, v.weight * 0.7)
        positions.setXYZ(v.index, newPos.x, newPos.y, newPos.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  })
  
  // Handle paint
  const handleClick = () => {
    if (tool === 'paint') {
      const newClay = { ...clay, color: currentColor }
      onUpdate(newClay)
    }
  }
  
  return (
    <group ref={groupRef} position={clay.position}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        frustumCulled={false}
      >
        <meshPhongMaterial
          color={clay.color}
          specular={0x111111}
          shininess={50}
          side={THREE.DoubleSide}
          emissive={isSelected ? '#444444' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      {isSelected && tool === 'move' && (
        <mesh>
          <boxGeometry args={[4.5, 4.5, 4.5]} />
          <meshBasicMaterial 
            color="#0088ff" 
            wireframe 
            transparent 
            opacity={0.3} 
          />
        </mesh>
      )}
    </group>
  )
}

// Add Clay Helper with drag to size
function AddClayHelper({ onAdd }: { onAdd: (position: THREE.Vector3, size: number) => void }) {
  const { camera, raycaster, gl } = useThree()
  const [dragStart, setDragStart] = useState<THREE.Vector3 | null>(null)
  const [dragEnd, setDragEnd] = useState<THREE.Vector3 | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  useEffect(() => {
    const canvas = gl.domElement
    
    const getIntersectionPoint = (e: MouseEvent): THREE.Vector3 | null => {
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      
      // Create a plane at y=0
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const intersection = new THREE.Vector3()
      
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        return intersection
      }
      return null
    }
    
    const handleMouseDown = (e: MouseEvent) => {
      const point = getIntersectionPoint(e)
      if (point) {
        setDragStart(point)
        setDragEnd(point)
        setIsDragging(true)
      }
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStart) {
        const point = getIntersectionPoint(e)
        if (point) {
          setDragEnd(point)
        }
      } else {
        // Show preview when not dragging
        const point = getIntersectionPoint(e)
        if (point) {
          setDragEnd(point)
        }
      }
    }
    
    const handleMouseUp = (e: MouseEvent) => {
      if (isDragging && dragStart && dragEnd) {
        const size = Math.max(0.5, Math.min(5, dragStart.distanceTo(dragEnd)))
        const center = dragStart.clone().add(dragEnd).multiplyScalar(0.5)
        center.y = size // Place clay on ground level
        onAdd(center, size)
        
        setDragStart(null)
        setDragEnd(null)
        setIsDragging(false)
      }
    }
    
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', () => {
      setIsDragging(false)
      setDragStart(null)
    })
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
    }
  }, [camera, raycaster, gl, dragStart, dragEnd, isDragging, onAdd])
  
  if (!dragEnd) return null
  
  // Show preview
  if (isDragging && dragStart && dragEnd) {
    const size = Math.max(0.5, Math.min(5, dragStart.distanceTo(dragEnd)))
    const center = dragStart.clone().add(dragEnd).multiplyScalar(0.5)
    center.y = size
    
    return (
      <>
        <mesh position={center}>
          <sphereGeometry args={[size, 32, 32]} />
          <meshPhongMaterial color="#888888" opacity={0.5} transparent />
        </mesh>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                dragStart.x, 0, dragStart.z,
                dragEnd.x, 0, dragEnd.z
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#666666" />
        </lineSegments>
      </>
    )
  } else if (!isDragging && dragEnd) {
    // Show small preview at cursor
    return (
      <mesh position={dragEnd}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshPhongMaterial color="#888888" opacity={0.3} transparent />
      </mesh>
    )
  }
  
  return null
}

export default function AdvancedClay() {
  const [clayObjects, setClayObjects] = useState<ClayObject[]>([])
  const [tool, setTool] = useState<'rotate' | 'push' | 'pull' | 'paint' | 'add' | 'move'>('rotate')
  const [brushSize, setBrushSize] = useState(0.8)
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [detail, setDetail] = useState(48)
  const [isDeforming, setIsDeforming] = useState(false)
  const [selectedClayId, setSelectedClayId] = useState<string | null>(null)
  const [moveSpeed, setMoveSpeed] = useState(0.5)
  
  const { addToHistory, undo, redo, canUndo, canRedo } = useHistory()
  
  // Initialize with one clay
  useEffect(() => {
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    const initialClay: ClayObject = {
      id: 'clay-1',
      geometry: geometry,
      position: new THREE.Vector3(0, 0, 0),
      color: currentColor
    }
    setClayObjects([initialClay])
    addToHistory([initialClay])
  }, [])
  
  const updateClay = useCallback((updatedClay: ClayObject) => {
    setClayObjects(prev => {
      const newClays = prev.map(clay => 
        clay.id === updatedClay.id ? updatedClay : clay
      )
      addToHistory(newClays)
      return newClays
    })
  }, [addToHistory])
  
  const addNewClay = useCallback((position: THREE.Vector3, size: number = 2) => {
    const geometry = new THREE.SphereGeometry(size, detail, detail)
    const newClay: ClayObject = {
      id: `clay-${Date.now()}`,
      geometry: geometry,
      position: position,
      color: currentColor
    }
    setClayObjects(prev => {
      const newClays = [...prev, newClay]
      addToHistory(newClays)
      return newClays
    })
    setTool('rotate')
  }, [detail, currentColor, addToHistory])
  
  const handleUndo = useCallback(() => {
    const previousState = undo()
    if (previousState) {
      setClayObjects(previousState)
    }
  }, [undo])
  
  const handleRedo = useCallback(() => {
    const nextState = redo()
    if (nextState) {
      setClayObjects(nextState)
    }
  }, [redo])
  
  const resetClay = () => {
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    const initialClay: ClayObject = {
      id: 'clay-1',
      geometry: geometry,
      position: new THREE.Vector3(0, 0, 0),
      color: currentColor
    }
    setClayObjects([initialClay])
    addToHistory([initialClay])
  }
  
  // Move selected clay with keyboard/buttons
  const moveSelectedClay = useCallback((direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-') => {
    if (!selectedClayId || tool !== 'move') return
    
    const clay = clayObjects.find(c => c.id === selectedClayId)
    if (!clay) return
    
    const newPosition = clay.position.clone()
    
    switch(direction) {
      case 'x+': newPosition.x += moveSpeed; break;
      case 'x-': newPosition.x -= moveSpeed; break;
      case 'y+': newPosition.y += moveSpeed; break;
      case 'y-': newPosition.y -= moveSpeed; break;
      case 'z+': newPosition.z += moveSpeed; break;
      case 'z-': newPosition.z -= moveSpeed; break;
    }
    
    const updatedClay = { ...clay, position: newPosition }
    updateClay(updatedClay)
  }, [selectedClayId, tool, clayObjects, moveSpeed, updateClay])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
      
      // 3D movement with arrow keys and Q/E
      if (tool === 'move' && selectedClayId) {
        switch(e.key) {
          case 'ArrowLeft':
            e.preventDefault()
            moveSelectedClay('x-')
            break
          case 'ArrowRight':
            e.preventDefault()
            moveSelectedClay('x+')
            break
          case 'ArrowUp':
            e.preventDefault()
            moveSelectedClay(e.shiftKey ? 'y+' : 'z-')
            break
          case 'ArrowDown':
            e.preventDefault()
            moveSelectedClay(e.shiftKey ? 'y-' : 'z+')
            break
          case 'q':
          case 'Q':
            e.preventDefault()
            moveSelectedClay('y-')
            break
          case 'e':
          case 'E':
            e.preventDefault()
            moveSelectedClay('y+')
            break
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo, tool, selectedClayId, moveSelectedClay])
  
  return (
    <div className="w-full h-full flex">
      <div className="w-72 bg-white shadow-lg p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Advanced Clay Studio</h2>
        
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
            <button
              onClick={() => setTool('add')}
              className={`p-3 rounded text-sm ${
                tool === 'add' ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Add Clay
            </button>
            <button
              onClick={() => setTool('move')}
              className={`p-3 rounded text-sm ${
                tool === 'move' ? 'bg-indigo-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Move Clay
            </button>
          </div>
        </div>
        
        {/* History Controls */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">History</h3>
          <div className="flex gap-2">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={`flex-1 p-2 rounded text-sm ${
                canUndo ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-400'
              }`}
            >
              ⟲ Undo
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className={`flex-1 p-2 rounded text-sm ${
                canRedo ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-400'
              }`}
            >
              ⟳ Redo
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Tip: Use Ctrl/Cmd + Z/Y
          </p>
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
        </div>
        
        {/* Clay Settings */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Clay Settings</h3>
          <div>
            <label className="text-xs">Detail: {detail}</label>
            <input
              type="range"
              min="32"
              max="96"
              step="16"
              value={detail}
              onChange={(e) => setDetail(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Active clays: {clayObjects.length}
          </p>
        </div>
        
        {/* 3D Movement Controls */}
        {tool === 'move' && selectedClayId && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">3D Movement</h3>
            <div className="mb-2">
              <label className="text-xs">Speed: {moveSpeed.toFixed(2)}</label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={moveSpeed}
                onChange={(e) => setMoveSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            {/* Position Controls */}
            <div className="grid grid-cols-3 gap-1 mb-2">
              <div className="col-span-3 text-xs text-center text-gray-500 mb-1">Position Controls</div>
              
              {/* Y+ */}
              <div></div>
              <button
                onClick={() => moveSelectedClay('y+')}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded text-xs"
                title="Move Up (E)"
              >
                ↑ Y+
              </button>
              <div></div>
              
              {/* X-, Z-, X+ */}
              <button
                onClick={() => moveSelectedClay('x-')}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded text-xs"
                title="Move Left (←)"
              >
                ← X-
              </button>
              <button
                onClick={() => moveSelectedClay('z-')}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded text-xs"
                title="Move Forward (↑)"
              >
                ↑ Z-
              </button>
              <button
                onClick={() => moveSelectedClay('x+')}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded text-xs"
                title="Move Right (→)"
              >
                X+ →
              </button>
              
              {/* Y-, Z+ */}
              <div></div>
              <button
                onClick={() => moveSelectedClay('y-')}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded text-xs"
                title="Move Down (Q)"
              >
                ↓ Y-
              </button>
              <button
                onClick={() => moveSelectedClay('z+')}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded text-xs"
                title="Move Back (↓)"
              >
                ↓ Z+
              </button>
            </div>
            
            <div className="text-xs text-gray-500 p-2 bg-gray-100 rounded">
              <p className="font-semibold mb-1">Keyboard Shortcuts:</p>
              <p>• Arrow Keys: Move X/Z</p>
              <p>• Q/E: Move Up/Down</p>
              <p>• Shift + ↑↓: Move Y</p>
            </div>
            
            {/* Current Position */}
            {(() => {
              const selectedClay = clayObjects.find(c => c.id === selectedClayId)
              if (selectedClay) {
                return (
                  <div className="text-xs text-gray-600 mt-2">
                    <p className="font-semibold">Current Position:</p>
                    <p>X: {selectedClay.position.x.toFixed(2)}</p>
                    <p>Y: {selectedClay.position.y.toFixed(2)}</p>
                    <p>Z: {selectedClay.position.z.toFixed(2)}</p>
                  </div>
                )
              }
              return null
            })()}
          </div>
        )}
        
        {/* Actions */}
        <button
          onClick={resetClay}
          className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600 mb-4"
        >
          Reset All
        </button>
        
        {/* Instructions */}
        <div className="text-xs text-gray-500 p-3 bg-blue-50 rounded">
          <p className="font-semibold mb-1">Features:</p>
          <p>• Drag to create clay with size</p>
          <p>• Each clay is independent</p>
          <p>• Undo/Redo with Ctrl+Z/Y</p>
          <p>• Move clay with transform</p>
          <p>• All angles clickable</p>
          <p className="mt-2 font-semibold">Add Clay:</p>
          <p>• Click and drag to set size</p>
          <p>• Min size: 0.5, Max size: 5</p>
          <p className="mt-2 text-blue-700 font-semibold">
            Clay objects don't merge!
          </p>
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 bg-gray-100">
        <Canvas 
          camera={{ position: [5, 5, 5], fov: 50 }}
          style={{ touchAction: 'none' }}
        >
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
            
            {/* Clay Objects */}
            {clayObjects.map(clay => (
              <group key={clay.id}>
                <Clay
                  clay={clay}
                  tool={tool}
                  brushSize={brushSize}
                  currentColor={currentColor}
                  onUpdate={updateClay}
                  onDeformingChange={setIsDeforming}
                  isSelected={selectedClayId === clay.id}
                  onSelect={() => setSelectedClayId(clay.id)}
                />
              </group>
            ))}
            
            {/* Add Clay Helper */}
            {tool === 'add' && (
              <AddClayHelper onAdd={addNewClay} />
            )}
            
            {/* Grid for reference */}
            {tool === 'add' && (
              <gridHelper args={[20, 20, '#888888', '#cccccc']} />
            )}
            
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}
