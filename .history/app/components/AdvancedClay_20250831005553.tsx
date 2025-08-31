'use client'

import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { TrackballControls, Environment, Box, Line } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense, useCallback } from 'react'
import * as THREE from 'three'
import { 
  SwitchCamera,
  Move, 
  Plus,
  Undo,
  Redo,
  Trash2,
  SplinePointer,
  PaintbrushVertical,
  Eraser,
  RotateCw,
  Circle,
  Triangle,
  Square,
  Minus,
  Spline
} from 'lucide-react'
import LoginButton from '../../components/LoginButton'
import ClayStorage from '../../components/ClayStorage'
import SaveButton from '../../components/SaveButton'
import FolderStructure from '../../components/FolderStructure'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { createIrysUploader, uploadToIrys, getBalance } from '../../lib/irys'
import { serializeClayProject, uploadClayProject } from '../../lib/clayStorageService'
import { claimIrysTokens, checkCanClaim } from '../../lib/contractService'

interface ClayObject {
  id: string
  geometry: THREE.BufferGeometry
  position: THREE.Vector3
  color: string
  shape?: 'sphere' | 'tetrahedron' | 'cube' | 'line' | 'curve' | 'rectangle' | 'triangle' | 'circle'
  rotation?: THREE.Euler
  controlPoints?: THREE.Vector3[] // For line and curve shapes
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

// Brush Guide Component
function BrushGuide({ position, size }: { position: THREE.Vector3; size: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshBasicMaterial color="#4dabf7" opacity={0.3} transparent />
    </mesh>
  )
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
  onSelect,
  onDelete,
  isHovered,
  onHover,
  onHoverEnd,
  onBrushHover
}: {
  clay: ClayObject
  tool: string
  brushSize: number
  currentColor: string
  onUpdate: (clay: ClayObject) => void
  onDeformingChange: (isDeforming: boolean) => void
  isSelected: boolean
  onSelect: () => void
  onDelete?: () => void
  isHovered: boolean
  onHover: () => void
  onHoverEnd: () => void
  onBrushHover?: (point: THREE.Vector3 | null) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const [guideHovered, setGuideHovered] = useState(false)
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
    }>,
    // For move tool
    initialClickPoint: new THREE.Vector3(),
    initialObjectPos: new THREE.Vector3(),
    dragOffset: new THREE.Vector3(),
    currentDepth: 0  // Store current depth adjustment from scroll
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
    
    const updateMousePosition = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      dragState.current.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      dragState.current.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    
    const handleWheel = (e: WheelEvent) => {
      if (tool !== 'move' || !isSelected) return
      
      e.preventDefault()
      
      // Get camera direction
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      
      // Adjust depth based on scroll
      const scrollSpeed = 0.01
      const depthChange = e.deltaY * scrollSpeed
      
      if (dragState.current.active) {
        // If dragging, accumulate depth change
        dragState.current.currentDepth += depthChange
      } else {
        // If not dragging, directly move the object
        const depthAdjustment = cameraDirection.clone().multiplyScalar(depthChange)
        const newPosition = clay.position.clone().add(depthAdjustment)
        
        const newClay = {
          ...clay,
          position: newPosition
        }
        onUpdate(newClay)
      }
    }
    
    const handleMouseDown = (e: MouseEvent) => {
      if (tool === 'rotateObject' && isSelected && meshRef.current) {
        // Start rotation
        rotationRef.current.active = true
        rotationRef.current.startX = e.clientX
        rotationRef.current.startY = e.clientY
        rotationRef.current.initialRotation.copy(meshRef.current.rotation)
        return
      }
      
      if (tool === 'move') {
        // Select clay for moving
        updateMousePosition(e)
        raycaster.setFromCamera(dragState.current.mousePos, camera)
        
        if (meshRef.current && groupRef.current) {
          const intersects = raycaster.intersectObject(meshRef.current)
          if (intersects.length > 0) {
            onSelect()
            // Start drag for move tool
            dragState.current.active = true
            dragState.current.initialClickPoint = intersects[0].point.clone()
            dragState.current.initialObjectPos = clay.position.clone()
            dragState.current.currentDepth = 0  // Reset depth adjustment
            
            // Calculate offset from object center to click point
            const worldPos = new THREE.Vector3()
            groupRef.current.getWorldPosition(worldPos)
            dragState.current.dragOffset = intersects[0].point.clone().sub(worldPos)
          }
        }
        return
      }
      
      if (tool !== 'push') return
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
      if (tool === 'rotateObject' && rotationRef.current.active && meshRef.current) {
        // Handle rotation
        const deltaX = (e.clientX - rotationRef.current.startX) * 0.01
        const deltaY = (e.clientY - rotationRef.current.startY) * 0.01
        
        meshRef.current.rotation.y = rotationRef.current.initialRotation.y + deltaX
        meshRef.current.rotation.x = rotationRef.current.initialRotation.x + deltaY
        return
      }
      
      if (dragState.current.active) {
        updateMousePosition(e)
      }
    }
    
    const handleMouseUp = () => {
      if (rotationRef.current.active) {
        rotationRef.current.active = false
      }
      
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
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseUp)
      canvas.removeEventListener('wheel', handleWheel)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [tool, brushSize, camera, raycaster, gl, onDeformingChange, clay, onUpdate, onSelect, isSelected])
  
  // Frame update for dragging
  useFrame(() => {
    if (!dragState.current.active || !meshRef.current) return
    
    // Handle move tool with free 3D dragging
    if (tool === 'move' && isSelected) {
      // Create ray from mouse position
      raycaster.setFromCamera(dragState.current.mousePos, camera)
      
      // Calculate the distance from camera to the initial click point
      const cameraDistance = camera.position.distanceTo(dragState.current.initialClickPoint)
      
      // Create a plane perpendicular to camera at that distance
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      
      // Create plane at the object's depth
      const plane = new THREE.Plane()
      plane.setFromNormalAndCoplanarPoint(cameraDirection, dragState.current.initialClickPoint)
      
      // Find where the ray intersects the plane
      const intersection = new THREE.Vector3()
      const hasIntersection = raycaster.ray.intersectPlane(plane, intersection)
      
      if (hasIntersection) {
        // Calculate the drag delta
        const dragDelta = intersection.clone().sub(dragState.current.initialClickPoint)
        
        // Add depth adjustment from scroll
        const depthAdjustment = cameraDirection.clone().multiplyScalar(dragState.current.currentDepth)
        
        // Apply to original position
        const newPosition = dragState.current.initialObjectPos.clone()
          .add(dragDelta)
          .add(depthAdjustment)
        
        // Update position
        const newClay = {
          ...clay,
          position: newPosition
        }
        onUpdate(newClay)
      }
      return
    }
    
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
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  })
  
  // Handle paint, delete and rotate object
  const handleClick = () => {
    if (tool === 'paint') {
      const newClay = { ...clay, color: currentColor }
      onUpdate(newClay)
    } else if (tool === 'delete') {
      onSelect()
      if (onDelete) {
        onDelete()
      }
    } else if (tool === 'rotateObject') {
      onSelect()
    }
  }
  
  // Rotation state for manual rotation
  const rotationRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    initialRotation: new THREE.Euler(0, 0, 0)
  })
  
  return (
    <group ref={groupRef} position={clay.position} rotation={clay.rotation || new THREE.Euler()}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerEnter={onHover}
        onPointerLeave={onHoverEnd}
        onPointerMove={(e) => {
          if ((tool === 'push' || tool === 'pull') && onBrushHover) {
            onBrushHover(e.point)
          }
        }}
        frustumCulled={false}
      >
        <meshPhongMaterial
          color={clay.color}
          specular={0x111111}
          shininess={50}
          side={THREE.DoubleSide}
          emissive={isSelected || isHovered ? '#444444' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : (isHovered ? 0.15 : 0)}
        />
      </mesh>
      {isSelected && tool === 'move' && (
        <mesh
          onPointerDown={(e) => {
            if (tool === 'move' && meshRef.current && groupRef.current) {
              e.stopPropagation()
              onSelect()
              
              // Start drag for move tool
              dragState.current.active = true
              dragState.current.initialClickPoint = e.point.clone()
              dragState.current.initialObjectPos = clay.position.clone()
              dragState.current.currentDepth = 0
              
              // Calculate offset from object center to click point
              const worldPos = new THREE.Vector3()
              groupRef.current.getWorldPosition(worldPos)
              dragState.current.dragOffset = e.point.clone().sub(worldPos)
            }
          }}
          onPointerEnter={() => setGuideHovered(true)}
          onPointerLeave={() => setGuideHovered(false)}
        >
          <boxGeometry args={(() => {
            // Calculate bounding box size
            if (!clay.geometry.boundingBox) {
              clay.geometry.computeBoundingBox()
            }
            const box = clay.geometry.boundingBox!
            const size = new THREE.Vector3()
            box.getSize(size)
            
            // Add 20% padding
            return [
              size.x * 1.2,
              size.y * 1.2,
              size.z * 1.2
            ]
          })()} />
          <meshBasicMaterial 
            color={guideHovered ? "#00aaff" : "#0088ff"}
            wireframe 
            transparent 
            opacity={guideHovered ? 0.5 : 0.3}
          />
        </mesh>
      )}
      {isSelected && tool === 'delete' && (
        <mesh>
          <boxGeometry args={(() => {
            // Calculate bounding box size
            if (!clay.geometry.boundingBox) {
              clay.geometry.computeBoundingBox()
            }
            const box = clay.geometry.boundingBox!
            const size = new THREE.Vector3()
            box.getSize(size)
            
            // Add 20% padding
            return [
              size.x * 1.2,
              size.y * 1.2,
              size.z * 1.2
            ]
          })()} />
          <meshBasicMaterial 
            color="#ff0000" 
            wireframe 
            transparent 
            opacity={0.5} 
          />
        </mesh>
      )}
    </group>
  )
}

// Add Clay Helper with drag to size
function AddClayHelper({ 
  onAdd, 
  shape 
}: { 
  onAdd: (position: THREE.Vector3, size: number, thickness: number, rotation?: THREE.Euler, controlPoints?: THREE.Vector3[]) => void
  shape: 'sphere' | 'tetrahedron' | 'cube' | 'line' | 'curve' | 'rectangle' | 'triangle' | 'circle'
}) {
  const { camera, raycaster, gl } = useThree()
  const [dragStart, setDragStart] = useState<THREE.Vector3 | null>(null)
  const [dragEnd, setDragEnd] = useState<THREE.Vector3 | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [clickPoints, setClickPoints] = useState<THREE.Vector3[]>([])
  const [currentPoint, setCurrentPoint] = useState<THREE.Vector3 | null>(null)
  const [shapeHeight, setShapeHeight] = useState(2)
  const [isDraggingCurve, setIsDraggingCurve] = useState(false)
  const [curveControlPoint, setCurveControlPoint] = useState<THREE.Vector3 | null>(null)
  const [lineThickness, setLineThickness] = useState(0.05) // Much thinner default
  
  useEffect(() => {
    const canvas = gl.domElement
    
    const getIntersectionPoint = (e: MouseEvent): THREE.Vector3 | null => {
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      
      // Get camera position and direction
      const cameraPosition = new THREE.Vector3()
      camera.getWorldPosition(cameraPosition)
      
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      
      // Position plane in front of camera
      const planeDistance = 5
      const planeCenter = cameraPosition.clone().add(cameraDirection.clone().multiplyScalar(planeDistance))
      
      // Calculate camera-relative tilted plane normal
      const worldUp = new THREE.Vector3(0, 1, 0)
      const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, worldUp).normalize()
      
      // Create 45-degree tilt relative to camera view
      const tiltAngle = Math.PI / 4
      const planeNormal = cameraDirection.clone()
      planeNormal.applyAxisAngle(cameraRight, tiltAngle)
      
      const plane = new THREE.Plane()
      plane.setFromNormalAndCoplanarPoint(planeNormal, planeCenter)
      
      const intersection = new THREE.Vector3()
      
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        return intersection
      }
      return null
    }
    
    const handleMouseDown = (e: MouseEvent) => {
      const point = getIntersectionPoint(e)
      if (!point) return
      
      if (shape === 'sphere') {
        // Sphere uses drag method
        setDragStart(point)
        setDragEnd(point)
        setIsDragging(true)
      } else if (shape === 'line') {
        // Line uses 2 click points
        if (clickPoints.length === 0) {
          setClickPoints([point])
        } else if (clickPoints.length === 1) {
          // Second click - create line
          const p1 = clickPoints[0]
          const p2 = point
          const center = p1.clone().add(p2).multiplyScalar(0.5)
          const size = p1.distanceTo(p2)
          
          onAdd(center, size, lineThickness, undefined, [p1, p2])
          setClickPoints([])
          setLineThickness(0.05) // Reset thickness
        }
      } else if (shape === 'curve') {
        // Curve uses 2 click points + drag for control
        if (clickPoints.length === 0) {
          setClickPoints([point])
        } else if (clickPoints.length === 1) {
          // Second click - start dragging for curve control
          setClickPoints([...clickPoints, point])
          setIsDraggingCurve(true)
          setCurveControlPoint(point)
        }
      } else if (shape === 'rectangle' || shape === 'triangle' || shape === 'circle') {
        // 2D shapes use 2 click points
        if (clickPoints.length === 0) {
          setClickPoints([point])
        } else if (clickPoints.length === 1) {
          // Second click - create 2D shape
          const p1 = clickPoints[0]
          const p2 = point
          const center = p1.clone().add(p2).multiplyScalar(0.5)
          const size = p1.distanceTo(p2)
          
          onAdd(center, size, lineThickness, undefined, [p1, p2])
          setClickPoints([])
          setLineThickness(0.05) // Reset thickness
        }
      } else {
        // Tetrahedron and Cube use 3 click points
        if (clickPoints.length === 0) {
          // First click
          setClickPoints([point])
        } else if (clickPoints.length === 1) {
          // Second click - just store the point, don't create yet
          setClickPoints([...clickPoints, point])
        } else if (clickPoints.length === 2) {
          // Third click - create shape with adjusted height
          const [p1, p2] = clickPoints
          
          // Calculate the size based on the drawn rectangle
          const diagonal = p1.distanceTo(p2)
          const size = diagonal / Math.sqrt(2) // Size for the shape
          
          // Calculate center of the base
          const center = new THREE.Vector3(
            (p1.x + p2.x) / 2,
            (p1.y + p2.y) / 2,
            (p1.z + p2.z) / 2
          )
          
          // Get camera-relative plane basis vectors
          const cameraDirection = new THREE.Vector3()
          camera.getWorldDirection(cameraDirection)
          
          const worldUp = new THREE.Vector3(0, 1, 0)
          const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, worldUp).normalize()
          
          // Calculate tilted plane normal (same as AddClayHelper)
          const tiltAngle = Math.PI / 4
          const planeNormal = cameraDirection.clone()
          planeNormal.applyAxisAngle(cameraRight, tiltAngle)
          
          // Calculate plane basis vectors
          const planeRight = cameraRight
          const planeUp = new THREE.Vector3().crossVectors(planeRight, planeNormal).normalize()
          
          // Adjust position based on height perpendicular to tilted plane
          if (shape === 'tetrahedron' || shape === 'cube') {
            // Move center along plane normal by half the height
            center.add(planeNormal.clone().multiplyScalar(shapeHeight / 2))
          }
          
          const thickness = shapeHeight / size // Relative thickness
          
          // Calculate rotation to align with tilted plane
          const rotation = new THREE.Euler()
          const matrix = new THREE.Matrix4()
          matrix.makeBasis(planeRight, planeUp, planeNormal.clone().negate())
          rotation.setFromRotationMatrix(matrix)
          
          onAdd(center, size, thickness, rotation)
          setClickPoints([])
          setShapeHeight(2) // Reset height
        }
      }
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      const point = getIntersectionPoint(e)
      if (!point) return
      
      if (shape === 'sphere') {
        if (isDragging && dragStart) {
          setDragEnd(point)
        } else {
          // Show preview when not dragging
          setDragEnd(point)
        }
      } else if (shape === 'curve' && isDraggingCurve) {
        // Update curve control point
        setCurveControlPoint(point)
      } else {
        // Show preview for next click point
        setCurrentPoint(point)
        
        // If we have 2 points, update height based on mouse Y position
        if (shape !== 'line' && shape !== 'curve' && clickPoints.length === 2 && point) {
          const baseY = (clickPoints[0].y + clickPoints[1].y) / 2
          const heightFromMouse = Math.max(0.1, Math.abs(point.y - baseY) * 2)
          setShapeHeight(heightFromMouse)
        }
      }
    }
    
    const handleMouseUp = (e: MouseEvent) => {
      if (shape === 'sphere' && isDragging && dragStart && dragEnd) {
        const size = Math.max(0.1, Math.min(5, dragStart.distanceTo(dragEnd)))
        const center = dragStart.clone().add(dragEnd).multiplyScalar(0.5)
        
        // Get camera-relative tilted plane normal
        const cameraDirection = new THREE.Vector3()
        camera.getWorldDirection(cameraDirection)
        
        const worldUp = new THREE.Vector3(0, 1, 0)
        const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, worldUp).normalize()
        
        const tiltAngle = Math.PI / 4
        const planeNormal = cameraDirection.clone()
        planeNormal.applyAxisAngle(cameraRight, tiltAngle)
        
        // Move sphere along plane normal by its radius
        center.add(planeNormal.clone().multiplyScalar(-size))
        
        // Calculate thickness based on vertical drag distance
        const verticalDiff = Math.abs(dragEnd.y - dragStart.y)
        const thickness = Math.max(0.2, Math.min(2, 1 + verticalDiff * 0.3))
        
        onAdd(center, size, thickness)
        
        setDragStart(null)
        setDragEnd(null)
        setIsDragging(false)
      } else if (shape === 'curve' && isDraggingCurve && clickPoints.length === 2 && curveControlPoint) {
        // Create curve with control point
        const p1 = clickPoints[0]
        const p2 = clickPoints[1]
        const center = p1.clone().add(p2).multiplyScalar(0.5)
        const size = p1.distanceTo(p2)
        
        // Create control points array with the dragged control point
        const controlPoints = [p1, curveControlPoint, p2]
        
        onAdd(center, size, lineThickness, undefined, controlPoints)
        
        setClickPoints([])
        setIsDraggingCurve(false)
        setCurveControlPoint(null)
        setLineThickness(0.05) // Reset thickness
      }
    }
    
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    const handleMouseLeave = () => {
      setIsDragging(false)
      setDragStart(null)
    }
    
    const handleWheel = (e: WheelEvent) => {
      // Adjust thickness for line and curve
      if ((shape === 'line' || shape === 'curve') && (clickPoints.length > 0 || isDraggingCurve)) {
        e.preventDefault()
        const delta = e.deltaY * -0.0001
        setLineThickness(prev => Math.max(0.01, Math.min(0.5, prev + delta)))
      }
    }
    
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('wheel', handleWheel)
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [camera, raycaster, gl, dragStart, dragEnd, isDragging, onAdd, shape, clickPoints, shapeHeight, lineThickness, isDraggingCurve, curveControlPoint])
  
  // Render for sphere (drag method)
  if (shape === 'sphere') {
    if (!dragEnd) return null
    
    if (isDragging && dragStart && dragEnd) {
      const size = Math.max(0.1, Math.min(5, dragStart.distanceTo(dragEnd)))
      const center = dragStart.clone().add(dragEnd).multiplyScalar(0.5)
      
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
                args={[new Float32Array([
                  dragStart.x, dragStart.y, dragStart.z,
                  dragEnd.x, dragEnd.y, dragEnd.z
                ]), 3]}
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
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshPhongMaterial color="#888888" opacity={0.3} transparent />
        </mesh>
      )
    }
  }
  
  // Render for line and curve
  else if (shape === 'line' || shape === 'curve') {
    return (
      <>
        {/* Show existing click points */}
        {clickPoints.map((point, index) => (
          <mesh key={index} position={point}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#ff0000" />
          </mesh>
        ))}
        
        {/* Show preview line or curve */}
        {clickPoints.length === 1 && currentPoint && shape === 'line' && (
          <>
            <Line
              points={[clickPoints[0], currentPoint]}
              color="#888888"
              lineWidth={2}
              opacity={0.5}
              transparent
            />
            {/* Thickness indicator at midpoint */}
            <mesh position={clickPoints[0].clone().add(currentPoint).multiplyScalar(0.5)}>
              <cylinderGeometry args={[lineThickness, lineThickness, 0.2, 8]} />
              <meshBasicMaterial color="#00ff00" opacity={0.5} transparent />
            </mesh>
          </>
        )}
        
        {/* Show curve preview when dragging */}
        {shape === 'curve' && clickPoints.length === 2 && curveControlPoint && (
          <>
            {/* Control lines */}
            <Line
              points={[clickPoints[0], curveControlPoint, clickPoints[1]]}
              color="#aaaaaa"
              lineWidth={1}
              opacity={0.3}
              transparent
            />
            {/* Curve preview */}
            <mesh>
              <tubeGeometry args={[
                new THREE.QuadraticBezierCurve3(
                  clickPoints[0],
                  curveControlPoint,
                  clickPoints[1]
                ),
                32, lineThickness, 8, false
              ]} />
              <meshBasicMaterial color="#888888" opacity={0.5} transparent />
            </mesh>
            {/* Control point */}
            <mesh position={curveControlPoint}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshBasicMaterial color="#00ff00" />
            </mesh>
          </>
        )}
        
        {/* Show current point preview */}
        {currentPoint && (
          <mesh position={currentPoint}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#0088ff" opacity={0.5} transparent />
          </mesh>
        )}
      </>
    )
  }
  
  // Render for 2D shapes (rectangle, triangle, circle)
  else if (shape === 'rectangle' || shape === 'triangle' || shape === 'circle') {
    return (
      <>
        {/* Show existing click points */}
        {clickPoints.map((point, index) => (
          <mesh key={index} position={point}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color={index === 0 ? "#ff0000" : "#00ff00"} />
          </mesh>
        ))}
        
        {/* Show preview for 2D shapes */}
        {clickPoints.length === 1 && currentPoint && (
          <>
            {shape === 'rectangle' && (
              <mesh position={clickPoints[0].clone().add(currentPoint).multiplyScalar(0.5)}>
                <planeGeometry args={[
                  Math.abs(currentPoint.x - clickPoints[0].x) || 0.1,
                  Math.abs(currentPoint.y - clickPoints[0].y) || 0.1
                ]} />
                <meshBasicMaterial color="#888888" opacity={0.3} transparent wireframe />
              </mesh>
            )}
            {shape === 'triangle' && (
              <mesh position={clickPoints[0].clone().add(currentPoint).multiplyScalar(0.5)}>
                <shapeGeometry args={[(() => {
                  const width = Math.abs(currentPoint.x - clickPoints[0].x) || 0.1
                  const height = Math.abs(currentPoint.y - clickPoints[0].y) || 0.1
                  const shape = new THREE.Shape()
                  shape.moveTo(0, -height/2)
                  shape.lineTo(-width/2, height/2)
                  shape.lineTo(width/2, height/2)
                  shape.closePath()
                  return shape
                })()]} />
                <meshBasicMaterial color="#888888" opacity={0.3} transparent wireframe />
              </mesh>
            )}
            {shape === 'circle' && (
              <mesh position={clickPoints[0].clone().add(currentPoint).multiplyScalar(0.5)}>
                <circleGeometry args={[clickPoints[0].distanceTo(currentPoint) / 2, 32]} />
                <meshBasicMaterial color="#888888" opacity={0.3} transparent wireframe />
              </mesh>
            )}
          </>
        )}
        
        {/* Show current point preview */}
        {currentPoint && (
          <mesh position={currentPoint}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#0088ff" opacity={0.5} transparent />
          </mesh>
        )}
      </>
    )
  }
  
  // Render for tetrahedron and cube (click method)
  else {
    return (
      <>
        {/* Show existing click points */}
        {clickPoints.map((point, index) => (
          <mesh key={index} position={point}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color={index === 0 ? "#ff0000" : "#00ff00"} />
          </mesh>
        ))}
        
        {/* Show preview box if we have 2 points */}
        {clickPoints.length === 2 && currentPoint && (
          <>
            {shape === 'cube' ? (
              <Box
                args={[
                  Math.abs(clickPoints[1].x - clickPoints[0].x) || 0.1,
                  shapeHeight,
                  Math.abs(clickPoints[1].z - clickPoints[0].z) || 0.1
                ]}
                position={[
                  (clickPoints[0].x + clickPoints[1].x) / 2,
                  (clickPoints[0].y + clickPoints[1].y) / 2 + shapeHeight / 2,
                  (clickPoints[0].z + clickPoints[1].z) / 2
                ]}
              >
                <meshBasicMaterial color="#888888" opacity={0.3} transparent wireframe />
              </Box>
            ) : (
              <mesh 
                position={[
                  (clickPoints[0].x + clickPoints[1].x) / 2,
                  (clickPoints[0].y + clickPoints[1].y) / 2 + shapeHeight / 2,
                  (clickPoints[0].z + clickPoints[1].z) / 2
                ]}
                rotation={[0, Math.PI / 4, 0]}
              >
                <coneGeometry args={[
                  Math.max(
                    Math.abs(clickPoints[1].x - clickPoints[0].x),
                    Math.abs(clickPoints[1].z - clickPoints[0].z)
                  ) / Math.sqrt(2) || 1,
                  shapeHeight,
                  4,
                  1
                ]} />
                <meshBasicMaterial color="#888888" opacity={0.3} transparent wireframe />
              </mesh>
            )}
            {/* Height indicator line from base to current mouse position */}
            <Line
              points={[
                [(clickPoints[0].x + clickPoints[1].x) / 2, (clickPoints[0].y + clickPoints[1].y) / 2, (clickPoints[0].z + clickPoints[1].z) / 2],
                [currentPoint.x, currentPoint.y, currentPoint.z]
              ]}
              color="#00ff00"
              lineWidth={2}
              opacity={0.5}
              transparent
            />
          </>
        )}
        
        {/* Show current point preview */}
        {currentPoint && (
          <mesh position={currentPoint}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#0088ff" opacity={0.5} transparent />
          </mesh>
        )}
      </>
    )
  }
  
  return null
}

// Screen-locked Isometric Grid Helper
function DynamicGridHelper() {
  const { camera } = useThree()
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame(() => {
    if (meshRef.current) {
      // Get camera position and direction
      const cameraPosition = new THREE.Vector3()
      camera.getWorldPosition(cameraPosition)
      
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      
      // Position grid in front of camera
      const planeDistance = 5
      const planeCenter = cameraPosition.clone().add(cameraDirection.clone().multiplyScalar(planeDistance))
      
      // Calculate camera's right and up vectors in world space
      const worldUp = new THREE.Vector3(0, 1, 0)
      const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, worldUp).normalize()
      const cameraUp = new THREE.Vector3().crossVectors(cameraRight, cameraDirection).normalize()
      
      // Create a 45-degree tilt relative to camera's view
      const tiltAngle = Math.PI / 4 // 45 degrees
      const tiltAxis = cameraRight // Tilt around camera's right axis
      
      // Create quaternion that combines camera rotation with tilt
      const quaternion = new THREE.Quaternion()
      quaternion.setFromAxisAngle(cameraRight, -tiltAngle)
      
      // Apply camera's quaternion first, then tilt
      const cameraQuaternion = camera.quaternion.clone()
      quaternion.premultiply(cameraQuaternion)
      
      // Apply position and rotation
      meshRef.current.position.copy(planeCenter)
      meshRef.current.quaternion.copy(quaternion)
    }
  })
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[40, 40, 40, 40]} />
      <meshBasicMaterial 
        color="#888888" 
        wireframe 
        transparent 
        opacity={0.2} 
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default function AdvancedClay() {
  const { authenticated, user } = usePrivy()
  const { wallets } = useWallets()
  const [clayObjects, setClayObjects] = useState<ClayObject[]>([])
  const [tool, setTool] = useState<'rotate' | 'rotateObject' | 'push' | 'pull' | 'paint' | 'add' | 'move' | 'delete'>('rotate')
  const [brushSize, setBrushSize] = useState(0.8)
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [detail, setDetail] = useState(48)
  const [isDeforming, setIsDeforming] = useState(false)
  const [selectedClayId, setSelectedClayId] = useState<string | null>(null)
  const [hoveredClayId, setHoveredClayId] = useState<string | null>(null)
  const [selectedShape, setSelectedShape] = useState<'sphere' | 'tetrahedron' | 'cube' | 'line' | 'curve' | 'rectangle' | 'triangle' | 'circle'>('sphere')
  const [moveSpeed, setMoveSpeed] = useState(0.5)
  const [backgroundColor, setBackgroundColor] = useState('#f0f0f0')
  const [hoveredPoint, setHoveredPoint] = useState<THREE.Vector3 | null>(null)
  const [shapeCategory, setShapeCategory] = useState<'3d' | 'line' | '2d'>('3d')
  const [projects, setProjects] = useState<Array<{ id: string; tags: Record<string, string> }>>([])
  const [currentFolder, setCurrentFolder] = useState('')
  const [irysUploader, setIrysUploader] = useState<any>(null)
  
  const { addToHistory, undo, redo, canUndo, canRedo } = useHistory()
  
  // Initialize with one clay
  useEffect(() => {
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    const initialClay: ClayObject = {
      id: 'clay-1',
      geometry: geometry,
      position: new THREE.Vector3(0, 2, 0), // Start at y=2 so sphere sits on ground
      color: currentColor,
      shape: 'sphere'
    }
    setClayObjects([initialClay])
    addToHistory([initialClay])
  }, [])

  // Initialize Irys when wallet is available
  useEffect(() => {
    async function initIrys() {
      if (authenticated && wallets && wallets.length > 0) {
        try {
          const wallet = wallets[0]
          await wallet.switchChain(80001) // Mumbai testnet
          const provider = await wallet.getEthereumProvider()
          const uploader = await createIrysUploader(provider)
          setIrysUploader(uploader)
        } catch (error) {
          console.error('Failed to initialize Irys:', error)
        }
      }
    }
    initIrys()
  }, [authenticated, wallets])
  
  const updateClay = useCallback((updatedClay: ClayObject) => {
    setClayObjects(prev => {
      const newClays = prev.map(clay => 
        clay.id === updatedClay.id ? updatedClay : clay
      )
      addToHistory(newClays)
      return newClays
    })
  }, [addToHistory])
  
  const removeClay = useCallback((clayId: string) => {
    setClayObjects(prev => {
      const newClays = prev.filter(clay => clay.id !== clayId)
      addToHistory(newClays)
      return newClays
    })
    if (selectedClayId === clayId) {
      setSelectedClayId(null)
    }
  }, [addToHistory, selectedClayId])
  
  const addNewClay = useCallback((position: THREE.Vector3, size: number = 2, thickness: number = 1, rotation?: THREE.Euler, controlPoints?: THREE.Vector3[]) => {
    let geometry: THREE.BufferGeometry
    
    switch (selectedShape) {
      case 'line':
        if (controlPoints && controlPoints.length === 2) {
          // Create a tube geometry for the line with relative coordinates
          const relativeP1 = controlPoints[0].clone().sub(position)
          const relativeP2 = controlPoints[1].clone().sub(position)
          const path = new THREE.LineCurve3(relativeP1, relativeP2)
          geometry = new THREE.TubeGeometry(path, 20, thickness, 8, false)
        } else {
          geometry = new THREE.CylinderGeometry(thickness, thickness, size, 8)
        }
        break
      
      case 'curve':
        if (controlPoints && controlPoints.length >= 3) {
          // Create a curved path using relative control points
          const relativeP1 = controlPoints[0].clone().sub(position)
          const relativeP2 = controlPoints[1].clone().sub(position)
          const relativeP3 = controlPoints[2].clone().sub(position)
          const curve = new THREE.QuadraticBezierCurve3(
            relativeP1,
            relativeP2, // Middle control point from drag
            relativeP3
          )
          geometry = new THREE.TubeGeometry(curve, 32, thickness, 8, false)
        } else {
          geometry = new THREE.TorusGeometry(size/2, thickness, 8, 24, Math.PI)
        }
        break
      
      case 'tetrahedron':
        // Create custom tetrahedron with base at drawn rectangle
        const halfSize = size / 2
        const height = size * thickness
        
        // Define vertices: 4 corners of base + 1 apex
        const vertices = new Float32Array([
          -halfSize, 0, -halfSize,  // 0: back-left
           halfSize, 0, -halfSize,  // 1: back-right
           halfSize, 0,  halfSize,  // 2: front-right
          -halfSize, 0,  halfSize,  // 3: front-left
                  0, height,     0   // 4: apex
        ])
        
        // Define faces (triangles)
        const indices = new Uint16Array([
          0, 3, 1,  // base triangle 1
          1, 3, 2,  // base triangle 2
          0, 1, 4,  // side 1
          1, 2, 4,  // side 2
          2, 3, 4,  // side 3
          3, 0, 4   // side 4
        ])
        
        geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
        geometry.setIndex(new THREE.BufferAttribute(indices, 1))
        geometry.computeVertexNormals()
        break
      case 'cube':
        // For cube, use dimensions directly from click points
        geometry = new THREE.BoxGeometry(size, size * thickness, size)
        break
      
      case 'rectangle':
        if (controlPoints && controlPoints.length === 2) {
          // Create a flat plane for rectangle
          const relativeP1 = controlPoints[0].clone().sub(position)
          const relativeP2 = controlPoints[1].clone().sub(position)
          const width = Math.abs(relativeP1.x - relativeP2.x)
          const height = Math.abs(relativeP1.y - relativeP2.y)
          geometry = new THREE.PlaneGeometry(width || size, height || size)
        } else {
          geometry = new THREE.PlaneGeometry(size, size)
        }
        break
      
      case 'triangle':
        if (controlPoints && controlPoints.length === 2) {
          // Create a triangle shape
          const relativeP1 = controlPoints[0].clone().sub(position)
          const relativeP2 = controlPoints[1].clone().sub(position)
          const width = Math.abs(relativeP1.x - relativeP2.x) || size
          const height = Math.abs(relativeP1.y - relativeP2.y) || size
          
          const shape = new THREE.Shape()
          shape.moveTo(0, -height/2)
          shape.lineTo(-width/2, height/2)
          shape.lineTo(width/2, height/2)
          shape.closePath()
          
          geometry = new THREE.ShapeGeometry(shape)
        } else {
          const shape = new THREE.Shape()
          shape.moveTo(0, -size/2)
          shape.lineTo(-size/2, size/2)
          shape.lineTo(size/2, size/2)
          shape.closePath()
          
          geometry = new THREE.ShapeGeometry(shape)
        }
        break
      
      case 'circle':
        if (controlPoints && controlPoints.length === 2) {
          // Create a circle based on distance
          const relativeP1 = controlPoints[0].clone().sub(position)
          const relativeP2 = controlPoints[1].clone().sub(position)
          const radius = relativeP1.distanceTo(relativeP2) / 2
          geometry = new THREE.CircleGeometry(radius, 32)
        } else {
          geometry = new THREE.CircleGeometry(size/2, 32)
        }
        break
      
      case 'sphere':
      default:
        geometry = new THREE.SphereGeometry(size, detail, detail)
        break
    }
    
    const newClay: ClayObject = {
      id: `clay-${Date.now()}`,
      geometry: geometry,
      position: position,
      color: currentColor,
      shape: selectedShape,
      rotation: rotation,
      controlPoints: controlPoints
    }
    setClayObjects(prev => {
      const newClays = [...prev, newClay]
      addToHistory(newClays)
      return newClays
    })
    setTool('rotate')
  }, [detail, currentColor, addToHistory, selectedShape])
  
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
      position: new THREE.Vector3(0, 2, 0), // Start at y=2 so sphere sits on ground
      color: currentColor,
      shape: 'sphere'
    }
    setClayObjects([initialClay])
    addToHistory([initialClay])
  }

  const handleSaveProject = async (projectName: string) => {
    if (!irysUploader) {
      alert('Please wait for wallet initialization or login first')
      return
    }

    try {
      console.log('Saving project:', projectName, clayObjects)
      
      // Serialize the clay objects
      const serialized = serializeClayProject(
        clayObjects,
        projectName,
        '', // description
        user?.email?.address || user?.wallet?.address || 'Anonymous',
        [] // tags
      )

      // Upload to Irys
      const transactionId = await uploadClayProject(
        irysUploader,
        serialized,
        currentFolder
      )

      console.log('Project saved with ID:', transactionId)
      alert(`Project saved successfully! ID: ${transactionId}`)
      
      // Refresh projects list
      // TODO: Implement project listing
    } catch (error) {
      console.error('Failed to save project:', error)
      alert('Failed to save project. Please try again.')
    }
  }

  const handleProjectSelect = (projectId: string) => {
    // Load project
    console.log('Loading project:', projectId)
  }

  const handleProjectMove = (projectId: string, folderPath: string) => {
    // Update project folder
    console.log('Moving project:', projectId, 'to', folderPath)
  }

  const handleFolderCreate = (folderPath: string) => {
    // Create folder (update projects with new folder)
    console.log('Creating folder:', folderPath)
  }

  const handleFolderDelete = (folderPath: string) => {
    // Delete folder
    console.log('Deleting folder:', folderPath)
  }
  
  // Move selected clay with keyboard
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
    
    const handleWheel = (e: WheelEvent) => {
      if (tool === 'push' || tool === 'pull') {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setBrushSize(prev => Math.max(0.1, Math.min(3, prev + delta)))
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [handleUndo, handleRedo, tool, selectedClayId, moveSelectedClay])
  
  return (
    <div className="h-screen bg-gray-100 relative flex flex-col">
      {/* Folder Structure - Only show when authenticated */}
      {authenticated && (
        <FolderStructure
          projects={projects}
          onProjectSelect={handleProjectSelect}
          onProjectMove={handleProjectMove}
          onFolderCreate={handleFolderCreate}
          onFolderDelete={handleFolderDelete}
          currentFolder={currentFolder}
        />
      )}
      
      {/* Canvas */}
      <div className="flex-1 relative">
      <Canvas 
        camera={{ position: [5, 5, 5], fov: 50 }}
        style={{ touchAction: 'none', backgroundColor: backgroundColor }}
        className="w-full h-full"
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
                onDelete={() => removeClay(clay.id)}
                isHovered={hoveredClayId === clay.id}
                onHover={() => setHoveredClayId(clay.id)}
                onHoverEnd={() => {
                  setHoveredClayId(null)
                  setHoveredPoint(null)
                }}
                onBrushHover={setHoveredPoint}
              />
            </group>
          ))}
          
          {/* Brush Size Guide */}
          {(tool === 'push' || tool === 'pull') && hoveredPoint && (
            <BrushGuide position={hoveredPoint} size={brushSize} />
          )}
          
          {/* Add Clay Helper */}
          {tool === 'add' && (
            <AddClayHelper onAdd={addNewClay} shape={selectedShape} />
          )}
          
          {/* Grid for reference - hidden for now */}
          {/* {tool === 'add' && (
            <DynamicGridHelper />
          )} */}
          
          <Environment preset="studio" />
        </Suspense>
      </Canvas>
      </div>
      
      {/* Bottom Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white backdrop-blur-sm shadow-lg z-50 border-t border-gray-200">
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4">
          {/* Left side - Login */}
          <div className="flex items-center gap-2">
            <LoginButton />
          </div>
          
          {/* Center - Main tools */}
          <div className="flex items-center justify-center gap-2">
          {/* Main Tools */}
          <div className="flex gap-2 bg-gray-100 rounded-lg p-2">
                          <button
                onClick={() => setTool('rotate')}
                className={`p-3 rounded-lg transition-all ${
                  tool === 'rotate' 
                    ? 'bg-gray-800 text-white shadow-md' 
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
                title="Rotate View"
              >
                <SwitchCamera size={20} />
              </button>
              <button
                onClick={() => setTool('rotateObject')}
                className={`p-3 rounded-lg transition-all ${
                  tool === 'rotateObject' 
                    ? 'bg-indigo-500 text-white shadow-md' 
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
                title="Rotate Object"
              >
                <RotateCw size={20} />
              </button>
            <button
              onClick={() => setTool('push')}
              className={`p-3 rounded-lg transition-all ${
                tool === 'push' 
                  ? 'bg-gray-800 text-white shadow-md' 
                  : 'bg-white hover:bg-gray-50 text-gray-700'
              }`}
              title="Push & Drag"
            >
              <SplinePointer size={20} />
            </button>
            <button
              onClick={() => setTool('paint')}
              className={`p-3 rounded-lg transition-all ${
                tool === 'paint' 
                  ? 'bg-gray-800 text-white shadow-md' 
                  : 'bg-white hover:bg-gray-50 text-gray-700'
              }`}
              title="Paint"
            >
              <PaintbrushVertical size={20} />
            </button>
            <button
              onClick={() => setTool('add')}
              className={`p-3 rounded-lg transition-all ${
                tool === 'add' 
                  ? 'bg-gray-800 text-white shadow-md' 
                  : 'bg-white hover:bg-gray-50 text-gray-700'
              }`}
              title="Add Clay"
            >
              <Plus size={20} />
            </button>
            <button
              onClick={() => setTool('move')}
              className={`p-3 rounded-lg transition-all ${
                tool === 'move' 
                  ? 'bg-gray-800 text-white shadow-md' 
                  : 'bg-white hover:bg-gray-50 text-gray-700'
              }`}
              title="Move Clay"
            >
              <Move size={18} />
            </button>
          </div>
          
          <div className="w-px h-10 bg-gray-300" />
          
          {/* History Controls */}
          <div className="flex gap-2">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={`p-3 rounded-lg transition-all ${
                canUndo 
                  ? 'bg-gray-800 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Undo (Ctrl/Cmd+Z)"
            >
              <Undo size={20} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className={`p-3 rounded-lg transition-all ${
                canRedo 
                  ? 'bg-gray-800 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Redo (Ctrl/Cmd+Y)"
            >
              <Redo size={20} />
            </button>
          </div>
          
          <div className="w-px h-10 bg-gray-300" />
          
          {/* Delete Tool */}
          <button
            onClick={() => setTool('delete')}
            className={`p-3 rounded-lg transition-all ${
              tool === 'delete' 
                ? 'bg-red-500 text-white shadow-md' 
                : 'bg-white hover:bg-gray-50 text-gray-700'
            }`}
            title="Delete Clay"
          >
            <Eraser size={20} />
          </button>
          
          {/* Clear All */}
          <button
            onClick={resetClay}
            className="p-3 rounded-lg bg-white hover:bg-red-50 text-red-500 transition-all"
            title="Clear All"
          >
            <Trash2 size={20} />
          </button>
          
          <div className="w-px h-10 bg-gray-300" />
          
          {/* Save Button */}
          <SaveButton onSave={handleSaveProject} />
        </div>
            {/* Right side - Background Color */}
            <div className="flex items-center gap-2 pr-4" style={{ minWidth: '200px' }}>
              <span className="text-sm text-gray-600">Background:</span>
              <label className="relative cursor-pointer group">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="sr-only"
                />
                <div 
                  className="w-8 h-8 rounded-full border-2 border-gray-400 group-hover:border-gray-600 transition-all"
                  style={{ backgroundColor }}
                  title="Background Color"
                />
              </label>
            </div>
          </div>
          
          {/* Context-specific controls */}
          {tool === 'paint' && (
            <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-center gap-2">
              {[
                '#ff6b6b', '#ffd93d', '#6bcf7f', '#4dabf7',
                '#f783ac', '#ffd43b', '#51cf66', '#339af0'
              ].map((color) => (
                <button
                  key={color}
                  onClick={() => setCurrentColor(color)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    currentColor === color ? 'ring-2 ring-gray-800 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <div className="w-px h-8 bg-gray-300 mx-1" />
              <label className="relative cursor-pointer group">
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => setCurrentColor(e.target.value)}
                  className="sr-only"
                />
                <div 
                  className="w-8 h-8 rounded-full border-2 border-gray-400 group-hover:border-gray-600 transition-all"
                  style={{ 
                    background: `${currentColor}`
                  }}
                  title="Custom Color"
                />
              </label>
            </div>
          )}
          
          {tool === 'add' && (
            <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-center gap-4">
              {/* Shape Category Select */}
              <select
                value={shapeCategory}
                onChange={(e) => {
                  setShapeCategory(e.target.value as '3d' | 'line' | '2d')
                  // Set default shape for each category
                  if (e.target.value === '3d') setSelectedShape('sphere')
                  else if (e.target.value === 'line') setSelectedShape('line')
                  else if (e.target.value === '2d') setSelectedShape('rectangle')
                }}
                className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="3d">3D Shapes</option>
                <option value="line">Lines</option>
                <option value="2d">2D Shapes</option>
              </select>
              
              {/* Shape buttons based on category */}
              <div className="flex items-center gap-2">
                {shapeCategory === '3d' && (
                  <>
                    <button
                      onClick={() => setSelectedShape('sphere')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'sphere'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Sphere"
                    >
                      <Circle size={16} />
                    </button>
                    <button
                      onClick={() => setSelectedShape('tetrahedron')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'tetrahedron'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Tetrahedron"
                    >
                      <Triangle size={16} />
                    </button>
                    <button
                      onClick={() => setSelectedShape('cube')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'cube'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Cube"
                    >
                      <Square size={16} />
                    </button>
                  </>
                )}
                
                {shapeCategory === 'line' && (
                  <>
                    <button
                      onClick={() => setSelectedShape('line')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'line'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Line"
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      onClick={() => setSelectedShape('curve')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'curve'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Curve"
                    >
                      <Spline size={16} />
                    </button>
                  </>
                )}
                
                {shapeCategory === '2d' && (
                  <>
                    <button
                      onClick={() => setSelectedShape('rectangle')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'rectangle'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Rectangle"
                    >
                      <Square size={16} />
                    </button>
                    <button
                      onClick={() => setSelectedShape('triangle')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'triangle'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Triangle"
                    >
                      <Triangle size={16} />
                    </button>
                    <button
                      onClick={() => setSelectedShape('circle')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'circle'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Circle"
                    >
                      <Circle size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
