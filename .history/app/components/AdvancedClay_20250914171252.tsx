'use client'

import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { TrackballControls, Environment, Box, Line, Text, Billboard } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  Spline,
  Download,
  FilePlus,
  Maximize2,
  RotateCcw,
  User,
  ChevronUp
} from 'lucide-react'
import SaveButton from '../../components/SaveButton'
import FolderStructure from '../../components/FolderStructure'
import { ConnectWallet } from '../../components/ConnectWallet'
import { createIrysUploader, uploadToIrys } from '../../lib/irys'
import { serializeClayProject, uploadClayProject, downloadClayProject, restoreClayObjects, deleteClayProject, uploadProjectThumbnail, downloadProjectThumbnail } from '../../lib/clayStorageService'
import { captureSceneThumbnail, compressImageDataUrl } from '../../lib/thumbnailService'
import { getUploadPrice, payForUpload } from '../../lib/contractService'
import { ethers } from 'ethers'
import { downloadAsGLB } from '../../lib/glbService'
import { queryCache } from '../../lib/queryCache'
import { 
  getCurrentProject, 
  setCurrentProject, 
  markProjectDirty,
  saveMutableReference,
  getMutableReference,
  generateProjectId
} from '../../lib/mutableStorageService'
import { createDetailedGeometry } from '../../lib/geometryUtils'
import { ChunkUploadProgress } from '../../components/ChunkUploadProgress'
import { ChunkUploadProgress as ChunkProgressType } from '../../lib/chunkUploadService'
import { usePopup } from '../../components/PopupNotification'
import ProfilePage from '../../components/ProfilePage'
import ProjectDetailView from '../../components/ProjectDetailView'
import { downloadUserProfile } from '../../lib/profileService'

interface ClayObject {
  id: string
  geometry: THREE.BufferGeometry
  position: THREE.Vector3
  color: string
  shape?: 'sphere' | 'tetrahedron' | 'cube' | 'line' | 'curve' | 'rectangle' | 'triangle' | 'circle'
  rotation?: THREE.Euler
  scale?: THREE.Vector3
  controlPoints?: THREE.Vector3[] // For line and curve shapes
  size?: number // Original size parameter
  thickness?: number // Original thickness parameter
  detail?: number // For sphere detail
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
  // Use absolute size in world units
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshBasicMaterial color="#4dabf7" opacity={0.3} transparent wireframe />
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
  
  // Resize state
  const resizeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    initialScale: clay.scale instanceof THREE.Vector3 ? clay.scale.x : (clay.scale || 1),
    initialDistance: 0
  })
  
  // Drag state
  const dragState = useRef({
    active: false,
    mousePos: new THREE.Vector2(),
    initialMousePos: new THREE.Vector2(),  // Store initial mouse position
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
    currentDepth: 0,  // Store current depth adjustment from scroll
    // For push/pull
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
            dragState.current.initialMousePos.copy(dragState.current.mousePos)  // Store initial mouse position
            dragState.current.currentDepth = 0  // Reset depth adjustment
            
            // Calculate offset from object center to click point
            const worldPos = new THREE.Vector3()
            groupRef.current.getWorldPosition(worldPos)
            dragState.current.dragOffset = intersects[0].point.clone().sub(worldPos)
          }
        }
        return
      }
      
      if (tool !== 'push' && tool !== 'pull') return
      if (!meshRef.current) return
      
      updateMousePosition(e)
      dragState.current.initialMousePos.copy(dragState.current.mousePos)  // Store initial mouse position
      
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
      const centerPos = hitPoint // Use hit point as center, not closest vertex
      
      for (let i = 0; i < positions.count; i++) {
        const pos = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const dist = pos.distanceTo(centerPos)
        // Use absolute brush size in world units
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
      dragState.current.targetVertex = 0 // We don't need a specific vertex anymore
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
          const clonedGeometry = meshRef.current.geometry.clone()
          // Preserve userData flags
          clonedGeometry.userData = { ...meshRef.current.geometry.userData }
          
          const newClay = {
            ...clay,
            geometry: clonedGeometry
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
  
  // Handle tool-specific mouse events when selected
  useEffect(() => {
    if (!isSelected) return
    
    const handleToolMouseMove = (e: MouseEvent) => {
      if (tool === 'rotateObject' && rotationRef.current.active && meshRef.current) {
        const deltaX = (e.clientX - rotationRef.current.startX) * 0.01
        const deltaY = (e.clientY - rotationRef.current.startY) * 0.01
        
        meshRef.current.rotation.y = rotationRef.current.initialRotation.y + deltaX
        meshRef.current.rotation.x = rotationRef.current.initialRotation.x + deltaY
        
        const newClay = {
          ...clay,
          rotation: meshRef.current.rotation.clone()
        }
        onUpdate(newClay)
      } else if (tool === 'resize' && resizeRef.current.active && groupRef.current) {
        // Calculate current distance from object center to mouse position
        const rect = gl.domElement.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        
        // Get object center in screen space
        const objectWorldPos = new THREE.Vector3()
        groupRef.current.getWorldPosition(objectWorldPos)
        const screenPos = objectWorldPos.clone().project(camera)
        
        // Calculate current distance in screen space
        const dx = x - screenPos.x
        const dy = y - screenPos.y
        const currentDistance = Math.sqrt(dx * dx + dy * dy)
        
        // Calculate scale based on distance ratio
        const distanceRatio = currentDistance / (resizeRef.current.initialDistance || 1)
        const scaleFactor = Math.max(0.1, Math.min(5, resizeRef.current.initialScale * distanceRatio))
        
        const newScale = new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor)
        
        const newClay = {
          ...clay,
          scale: newScale
        }
        onUpdate(newClay)
      }
    }
    
    const handleToolMouseUp = () => {
      if (rotationRef.current.active) {
        rotationRef.current.active = false
      }
      if (resizeRef.current.active) {
        resizeRef.current.active = false
      }
    }
    
    if (tool === 'rotateObject' || tool === 'resize') {
      window.addEventListener('mousemove', handleToolMouseMove)
      window.addEventListener('mouseup', handleToolMouseUp)
      
      return () => {
        window.removeEventListener('mousemove', handleToolMouseMove)
        window.removeEventListener('mouseup', handleToolMouseUp)
      }
    }
  }, [tool, isSelected, clay, onUpdate, gl, camera])
  
  // Frame update for dragging
  useFrame(() => {
    if (!dragState.current.active || !meshRef.current) return
    
    // Handle move tool with free 3D dragging
    if (tool === 'move' && isSelected) {
      // Get camera's coordinate system
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      
      // Calculate camera's right vector (screen X axis)
      const worldUp = new THREE.Vector3(0, 1, 0)
      const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, worldUp).normalize()
      
      // Calculate camera's up vector (screen Y axis)
      const cameraUp = new THREE.Vector3().crossVectors(cameraRight, cameraDirection).normalize()
      
      // Get mouse movement in screen space
      const mouseDelta = {
        x: dragState.current.mousePos.x - dragState.current.initialMousePos.x,
        y: dragState.current.mousePos.y - dragState.current.initialMousePos.y
      }
      
      // Convert screen movement to world movement
      // Mouse delta is in [-2, 2] range, so scale appropriately
      const distance = camera.position.distanceTo(dragState.current.initialObjectPos)
      let viewHeight: number
      let viewWidth: number
      
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const perspectiveCamera = camera as THREE.PerspectiveCamera
        const fov = (perspectiveCamera.fov * Math.PI) / 180
        viewHeight = 2 * Math.tan(fov / 2) * distance
        viewWidth = viewHeight * perspectiveCamera.aspect
      } else {
        // OrthographicCamera
        const orthographicCamera = camera as THREE.OrthographicCamera
        viewHeight = orthographicCamera.top - orthographicCamera.bottom
        viewWidth = orthographicCamera.right - orthographicCamera.left
      }
      
      // Scale mouse movement to world units
      const screenX = (mouseDelta.x / 2) * viewWidth
      const screenY = (mouseDelta.y / 2) * viewHeight
      
      // Apply movement in camera coordinate system
      const movement = new THREE.Vector3()
        .addScaledVector(cameraRight, screenX)
        .addScaledVector(cameraUp, screenY)
      
      // Apply depth movement from scroll (along camera forward/backward)
      const depthMovement = cameraDirection.clone().multiplyScalar(dragState.current.currentDepth)
      
      // Calculate final position
      const newPosition = dragState.current.initialObjectPos.clone()
        .add(movement)
        .add(depthMovement)
      
      // Update position
      const newClay = {
        ...clay,
        position: newPosition
      }
      onUpdate(newClay)
      return
    }
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    
    // Create ray from mouse position
    raycaster.setFromCamera(dragState.current.mousePos, camera)
    
    // Get hit point world position
    const hitPointWorld = meshRef.current.localToWorld(dragState.current.hitPoint.clone())
    
    // Create plane perpendicular to camera at hit point
    const cameraDir = new THREE.Vector3()
    camera.getWorldDirection(cameraDir)
    const plane = new THREE.Plane()
    plane.setFromNormalAndCoplanarPoint(cameraDir, hitPointWorld)
    
    // Get intersection point
    const intersection = new THREE.Vector3()
    const hasIntersection = raycaster.ray.intersectPlane(plane, intersection)
    
    if (!hasIntersection) {
      const distance = camera.position.distanceTo(hitPointWorld)
      intersection.copy(raycaster.ray.origin).add(
        raycaster.ray.direction.clone().multiplyScalar(distance)
      )
    }
    
    // Convert to local coordinates
    const targetLocal = meshRef.current.worldToLocal(intersection)
    
    // Calculate movement delta from original hit point
    const movementDelta = targetLocal.clone().sub(dragState.current.hitPoint)
    
    // Update vertices based on their distance from hit point
    for (const v of dragState.current.vertices) {
      if (tool === 'push' || tool === 'pull') {
        // For pull, reverse the movement direction
        const direction = tool === 'pull' ? -1 : 1
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
        scale={clay.scale || 1}
        userData={{ clayId: clay.id }}
        onPointerEnter={onHover}
        onPointerLeave={onHoverEnd}
        onPointerMove={(e) => {
          if ((tool === 'push' || tool === 'pull') && onBrushHover) {
            onBrushHover(e.point)
          }
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          
          if (tool === 'rotateObject' && isSelected && meshRef.current) {
            rotationRef.current.active = true
            rotationRef.current.startX = e.clientX
            rotationRef.current.startY = e.clientY
            rotationRef.current.initialRotation.copy(meshRef.current.rotation)
          } else if (tool === 'resize' && isSelected) {
            resizeRef.current.active = true
            resizeRef.current.startX = e.clientX
            resizeRef.current.startY = e.clientY
            resizeRef.current.initialScale = clay.scale instanceof THREE.Vector3 ? clay.scale.x : (clay.scale || 1)
            
            // Calculate initial distance from object center to mouse position
            const rect = gl.domElement.getBoundingClientRect()
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
            
            // Get object center in screen space
            const objectWorldPos = new THREE.Vector3()
            groupRef.current?.getWorldPosition(objectWorldPos)
            const screenPos = objectWorldPos.clone().project(camera)
            
            // Calculate distance in screen space
            const dx = x - screenPos.x
            const dy = y - screenPos.y
            resizeRef.current.initialDistance = Math.sqrt(dx * dx + dy * dy)
          } else {
            onSelect()
          }
        }}
        frustumCulled={false}
      >
        <meshPhongMaterial
          color={clay.color}
          specular={0x111111}
          shininess={50}
          side={THREE.DoubleSide}
          emissive={
            isSelected && (tool === 'move' || tool === 'rotateObject' || tool === 'resize')
              ? '#0099ff' 
              : '#000000'
          }
          emissiveIntensity={isSelected ? 0.5 : 0}
        />
      </mesh>
      {/* Hover outline */}
      {isHovered && (tool === 'paint' || tool === 'rotateObject' || tool === 'resize') && (
        <mesh
          scale={clay.scale instanceof THREE.Vector3 ? clay.scale.x * 1.02 : (clay.scale || 1) * 1.02}
          userData={{ isOutline: true }}
        >
          <meshBasicMaterial
            color="#ffffff"
            wireframe
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* Size label */}
      {(tool === 'add' || tool === 'push' || tool === 'pull' || tool === 'move' || tool === 'resize') && (
        <Billboard
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
          position={(() => {
            // Calculate actual height of the shape
            if (!clay.geometry.boundingBox) {
              clay.geometry.computeBoundingBox()
            }
            const box = clay.geometry.boundingBox!
            const size = new THREE.Vector3()
            box.getSize(size)
            
            // Apply scale to get actual size
            const scale = clay.scale instanceof THREE.Vector3 ? clay.scale.y : (clay.scale || 1)
            const actualHeight = size.y * scale
            
            // Position text above the shape with fixed offset
            return [0, actualHeight * 0.5 + 0.5, 0]
          })()}
        >
          <Text
            fontSize={0.25}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="black"
          >
            {(() => {
              // Calculate actual size based on bounding box
              if (!clay.geometry.boundingBox) {
                clay.geometry.computeBoundingBox()
              }
              const box = clay.geometry.boundingBox!
              const size = new THREE.Vector3()
              box.getSize(size)
              
              // Apply scale to get actual size
              const scale = clay.scale instanceof THREE.Vector3 ? clay.scale.x : (clay.scale || 1)
              
              // Get the maximum dimension (furthest two points)
              const maxDimension = Math.max(size.x, size.y, size.z) * scale
              return maxDimension.toFixed(2)
            })()}
          </Text>
        </Billboard>
      )}
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
            
            // Apply scale to get actual size
            const scale = clay.scale instanceof THREE.Vector3 ? clay.scale : new THREE.Vector3(clay.scale || 1, clay.scale || 1, clay.scale || 1)
            
            // Add 20% padding
            return [
              size.x * scale.x * 1.2,
              size.y * scale.y * 1.2,
              size.z * scale.z * 1.2
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
            
            // Apply scale to get actual size
            const scale = clay.scale instanceof THREE.Vector3 ? clay.scale : new THREE.Vector3(clay.scale || 1, clay.scale || 1, clay.scale || 1)
            
            // Add 20% padding
            return [
              size.x * scale.x * 1.2,
              size.y * scale.y * 1.2,
              size.z * scale.z * 1.2
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

// Camera Reset Component
function CameraReset({ resetTrigger }: { resetTrigger: number }) {
  const { camera } = useThree()
  
  useEffect(() => {
    if (resetTrigger > 0) {
      // Reset camera to initial position
      camera.position.set(5, 5, 5)
      camera.lookAt(0, 0, 0)
      camera.up.set(0, 1, 0)
      
      // If using perspective camera, reset other properties
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const perspCamera = camera as THREE.PerspectiveCamera
        perspCamera.fov = 50
        perspCamera.updateProjectionMatrix()
      }
    }
  }, [resetTrigger, camera])
  
  return null
}

// Add Clay Helper with drag to size
function AddClayHelper({ 
  onAdd, 
  shape,
  onHoverPoint
}: { 
  onAdd: (position: THREE.Vector3, size: number, thickness: number, rotation?: THREE.Euler, controlPoints?: THREE.Vector3[]) => void
  shape: 'sphere' | 'tetrahedron' | 'cube' | 'line' | 'curve' | 'rectangle' | 'triangle' | 'circle'
  onHoverPoint?: (point: THREE.Vector3 | null) => void
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
  const [currentDepth, setCurrentDepth] = useState(0) // Z-axis depth
  
  // Convert screen-space distance to world-space size
  const getScreenConsistentSize = useCallback((p1: THREE.Vector3, p2: THREE.Vector3): number => {
    // Get canvas dimensions
    const canvas = gl.domElement
    const rect = canvas.getBoundingClientRect()
    
    // Clone points to avoid modifying originals
    const screenP1 = p1.clone()
    const screenP2 = p2.clone()
    
    // Project points to normalized device coordinates
    screenP1.project(camera)
    screenP2.project(camera)
    
    // Convert from NDC (-1 to 1) to pixel coordinates
    const pixelP1 = {
      x: (screenP1.x + 1) * rect.width * 0.5,
      y: (-screenP1.y + 1) * rect.height * 0.5
    }
    const pixelP2 = {
      x: (screenP2.x + 1) * rect.width * 0.5,
      y: (-screenP2.y + 1) * rect.height * 0.5
    }
    
    // Calculate distance in pixels
    const pixelDistance = Math.sqrt(
      Math.pow(pixelP2.x - pixelP1.x, 2) + 
      Math.pow(pixelP2.y - pixelP1.y, 2)
    )
    
    // Get the average world position
    const avgPosition = p1.clone().add(p2).multiplyScalar(0.5)
    const cameraDistance = camera.position.distanceTo(avgPosition)
    
    // Convert pixel distance to world size based on camera type
    let worldSize: number
    
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspCamera = camera as THREE.PerspectiveCamera
      const fov = perspCamera.fov * Math.PI / 180
      const viewHeight = 2 * Math.tan(fov / 2) * cameraDistance
      const pixelsPerWorldUnit = rect.height / viewHeight
      worldSize = pixelDistance / pixelsPerWorldUnit
    } else {
      // For orthographic camera
      const orthoCamera = camera as THREE.OrthographicCamera
      const viewHeight = orthoCamera.top - orthoCamera.bottom
      const pixelsPerWorldUnit = rect.height / viewHeight
      worldSize = pixelDistance / pixelsPerWorldUnit
    }
    
    return worldSize
  }, [camera, gl])
  
  useEffect(() => {
    const canvas = gl.domElement
    
    const getIntersectionPoint = (e: MouseEvent): THREE.Vector3 | null => {
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      
      // Fixed z-depth for all shapes (same as initial sphere)
      const fixedZ = 0
      
      // Method 1: Try raycaster intersection first
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -fixedZ)
      const intersection = new THREE.Vector3()
      
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        // Check if the intersection is reasonable
        const maxDistance = 100
        if (Math.abs(intersection.x) < maxDistance && Math.abs(intersection.y) < maxDistance) {
          intersection.z = fixedZ // Ensure exact z value
          return intersection
        }
      }
      
      // Method 2: If raycaster fails or gives extreme values, use projection method
      // This is more stable for extreme camera angles
      const vector = new THREE.Vector3(x, y, 0.5)
      vector.unproject(camera)
      
      // Direction from camera to unprojected point
      const direction = vector.sub(camera.position).normalize()
      
      // Calculate distance to z-plane
      if (Math.abs(direction.z) > 0.001) {
        const t = (fixedZ - camera.position.z) / direction.z
        
        if (t > 0) {
          const result = new THREE.Vector3(
            camera.position.x + direction.x * t,
            camera.position.y + direction.y * t,
            fixedZ
          )
          
          // Clamp to reasonable values
          const maxCoord = 100
          result.x = Math.max(-maxCoord, Math.min(maxCoord, result.x))
          result.y = Math.max(-maxCoord, Math.min(maxCoord, result.y))
          
          return result
        }
      }
      
      // Last resort: return a point at screen center depth
      return new THREE.Vector3(0, 0, fixedZ)
    }
    
    const handleMouseDown = (e: MouseEvent) => {
      const point = getIntersectionPoint(e)
      if (!point) return
      
      if (shape === 'sphere') {
        // Sphere uses drag method
        setDragStart(point)
        // Simply offset in camera's right direction for consistent initial size
        const cameraDirection = new THREE.Vector3()
        camera.getWorldDirection(cameraDirection)
        
        // Get camera's right vector
        const cameraRight = new THREE.Vector3()
        const cameraUp = new THREE.Vector3(0, 1, 0)
        cameraRight.crossVectors(cameraDirection, cameraUp).normalize()
        
        // Add small offset in camera's right direction
        const initialSize = 0.5 // Initial size in world units
        const offsetPoint = point.clone().add(cameraRight.multiplyScalar(initialSize))
        
        setDragEnd(offsetPoint)
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
          const rawSize = getScreenConsistentSize(p1, p2)
          const size = Math.max(0.5, Math.min(10, rawSize)) // Apply min/max limits
          
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
          // Use screen-consistent size for 2D shapes
          const rawSize = getScreenConsistentSize(p1, p2)
          const size = Math.max(0.5, Math.min(10, rawSize)) // Apply min/max limits
          
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
          // Third click - create shape with position and size based on all three points
          const [p1, p2] = clickPoints
          const p3 = point // Third click point
          
          // For cube: use the three points to define a box
          if (shape === 'cube') {
            // Calculate box dimensions from three points (like preview)
            const width = Math.abs(p3.x - p1.x) || 0.5
            const height = Math.abs(p3.y - p1.y) || 0.5
            const depth = Math.abs(p3.z - p1.z) || 0.5
            
            const center = new THREE.Vector3(
              (p1.x + p3.x) / 2,
              (p1.y + p3.y) / 2,
              (p1.z + p3.z) / 2
            )
            
            // Store actual dimensions for BoxGeometry
            const customData = new THREE.Vector3(width, height, depth)
            const size = Math.max(width, height, depth) // This is ignored when using custom dimensions
            onAdd(center, size, 1, new THREE.Euler(), [customData])
          } else {
            // For tetrahedron: use p1 and p2 as base, p3 as apex
            const baseCenter = new THREE.Vector3(
              (p1.x + p2.x) / 2,
              (p1.y + p2.y) / 2,
              (p1.z + p2.z) / 2
            )
            
            // Calculate size based on the base edge using screen space
            const rawBaseSize = getScreenConsistentSize(p1, p2) * 0.8
            const baseSize = Math.max(0.5, Math.min(10, rawBaseSize))
            
            // Calculate the direction from base center to apex
            const apexVector = p3.clone().sub(baseCenter)
            
            // Calculate proper center (centroid of tetrahedron is at 1/4 height)
            const center = baseCenter.clone().add(apexVector.clone().multiplyScalar(0.25))
            
            // Calculate rotation to orient tetrahedron correctly
            const up = apexVector.normalize()
            const rotation = new THREE.Euler()
            
            // Only rotate if apex is not directly above base
            if (Math.abs(up.dot(new THREE.Vector3(0, 1, 0))) < 0.999) {
              const quaternion = new THREE.Quaternion()
              quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
              rotation.setFromQuaternion(quaternion)
            }
            
            onAdd(center, baseSize, 1, rotation)
          }
          setClickPoints([])
          setShapeHeight(2) // Reset height
        }
      }
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      const point = getIntersectionPoint(e)
      
      // Update hover point for coordinate display
      if (onHoverPoint) {
        onHoverPoint(point)
      }
      
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
        const minSize = 0.5 // Minimum size for visibility
        const maxSize = 10 // Maximum size limit
        const size = Math.max(minSize, Math.min(maxSize, getScreenConsistentSize(dragStart, dragEnd)))
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
        const size = getScreenConsistentSize(p1, p2)
        
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
      e.preventDefault()
      
      // Adjust thickness for line and curve
      if ((shape === 'line' || shape === 'curve') && (clickPoints.length > 0 || isDraggingCurve)) {
        const delta = e.deltaY * -0.0001
        setLineThickness(prev => Math.max(0.01, Math.min(0.5, prev + delta)))
      } else {
        // Don't change depth with scroll - keep shapes at z=0
        // Scroll can be used for other purposes in the future
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
  }, [camera, raycaster, gl, dragStart, dragEnd, isDragging, onAdd, shape, clickPoints, shapeHeight, lineThickness, isDraggingCurve, curveControlPoint, currentDepth, getScreenConsistentSize])
  
  // Render for sphere (drag method)
  if (shape === 'sphere') {
    if (!dragEnd) return null
    
    if (isDragging && dragStart && dragEnd) {
      const size = Math.max(0.1, Math.min(5, getScreenConsistentSize(dragStart, dragEnd)))
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
                <circleGeometry args={[Math.max(0.5, Math.min(10, getScreenConsistentSize(clickPoints[0], currentPoint))), 32]} />
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
        
        {/* Show preview if we have 2 points */}
        {clickPoints.length === 2 && currentPoint && (
          <>
            {shape === 'cube' ? (
              <Box
                args={[
                  Math.abs(currentPoint.x - clickPoints[0].x) || 0.1,
                  Math.abs(currentPoint.y - clickPoints[0].y) || 0.1,
                  Math.abs(currentPoint.z - clickPoints[0].z) || 0.1
                ]}
                position={[
                  (clickPoints[0].x + currentPoint.x) / 2,
                  (clickPoints[0].y + currentPoint.y) / 2,
                  (clickPoints[0].z + currentPoint.z) / 2
                ]}
              >
                <meshBasicMaterial color="#888888" opacity={0.3} transparent wireframe />
              </Box>
            ) : (
              <>
                {/* Base triangle */}
                <Line
                  points={[
                    [clickPoints[0].x, clickPoints[0].y, clickPoints[0].z],
                    [clickPoints[1].x, clickPoints[1].y, clickPoints[1].z],
                    [(clickPoints[0].x + clickPoints[1].x) / 2, (clickPoints[0].y + clickPoints[1].y) / 2, (clickPoints[0].z + clickPoints[1].z) / 2],
                    [clickPoints[0].x, clickPoints[0].y, clickPoints[0].z]
                  ]}
                  color="#888888"
                  lineWidth={1}
                />
                {/* Lines from base to apex */}
                <Line
                  points={[
                    [clickPoints[0].x, clickPoints[0].y, clickPoints[0].z],
                    [currentPoint.x, currentPoint.y, currentPoint.z]
                  ]}
                  color="#888888"
                  lineWidth={1}
                />
                <Line
                  points={[
                    [clickPoints[1].x, clickPoints[1].y, clickPoints[1].z],
                    [currentPoint.x, currentPoint.y, currentPoint.z]
                  ]}
                  color="#888888"
                  lineWidth={1}
                />
                <Line
                  points={[
                    [(clickPoints[0].x + clickPoints[1].x) / 2, (clickPoints[0].y + clickPoints[1].y) / 2, (clickPoints[0].z + clickPoints[1].z) / 2],
                    [currentPoint.x, currentPoint.y, currentPoint.z]
                  ]}
                  color="#888888"
                  lineWidth={1}
                />
              </>
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
function DynamicGridHelper({ tool, selectedClayId, clayObjects, hoveredPoint, onCoordsUpdate }: {
  tool: string
  selectedClayId: string | null
  clayObjects: ClayObject[]
  hoveredPoint: THREE.Vector3 | null
  onCoordsUpdate: (coords: { x: number; y: number; z: number }) => void
}) {
  const { camera } = useThree()
  const [cameraDir, setCameraDir] = useState(new THREE.Vector3())
  const [cameraRight, setCameraRight] = useState(new THREE.Vector3())
  const [cameraUp, setCameraUp] = useState(new THREE.Vector3())
  const [currentCoords, setCurrentCoords] = useState({ x: 0, y: 0, z: 0 })
  const [cameraRelativeCoords, setCameraRelativeCoords] = useState({ x: 0, y: 0, z: 0 })
  const [selectedClayPos, setSelectedClayPos] = useState<THREE.Vector3 | null>(null)
  
  useFrame(() => {
    // Get camera direction and calculate camera-aligned axes
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    setCameraDir(dir)
    
    // Get camera's actual local axes in world space
    const cameraMatrix = camera.matrixWorld
    const right = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 0).normalize()
    const up = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 1).normalize()
    setCameraRight(right)
    setCameraUp(up)
    
    // Update coordinates based on tool
    let worldPos: THREE.Vector3 | null = null
    
    if (tool === 'move' && selectedClayId) {
      const selectedClay = clayObjects.find(c => c.id === selectedClayId)
      if (selectedClay) {
        worldPos = selectedClay.position.clone()
        setCurrentCoords({
          x: selectedClay.position.x,
          y: selectedClay.position.y,
          z: selectedClay.position.z
        })
        setSelectedClayPos(selectedClay.position.clone())
      }
    } else if ((tool === 'add' || tool === 'push' || tool === 'pull') && hoveredPoint) {
      worldPos = hoveredPoint.clone()
      setCurrentCoords({
        x: hoveredPoint.x,
        y: hoveredPoint.y,
        z: hoveredPoint.z
      })
      setSelectedClayPos(null)
    }
    
    // Calculate camera-relative coordinates
    if (worldPos) {
      // Get position relative to camera
      const relativePos = worldPos.clone().sub(camera.position)
      
      // Project onto camera axes
      const cameraX = relativePos.dot(right)
      const cameraY = relativePos.dot(up)
      const cameraZ = -relativePos.dot(dir) // Negative because camera looks along -Z
      
      setCameraRelativeCoords({
        x: cameraX,
        y: cameraY,
        z: cameraZ
      })
      
      // Update parent component
      onCoordsUpdate({
        x: cameraX,
        y: cameraY,
        z: cameraZ
      })
    }
  })
  
  return (
    <group>

      

      {/* XZ Horizontal Planes for all objects in move and rotate tools */}
      {(tool === 'move' || tool === 'rotate') && clayObjects.map((clay) => {
        // Calculate color based on current Z position (real-time)
        const z = clay.position.z
        
        // Define Z range for color mapping (e.g., -10 to 10)
        const minZ = -10
        const maxZ = 10
        const zRange = maxZ - minZ
        
        // Normalize Z position to 0-1 range
        const normalizedZ = Math.max(0, Math.min(1, (z - minZ) / zRange))
        
        // Map to hue range (e.g., blue to red: 240 to 0)
        const hue = 240 - (normalizedZ * 240) // Blue (240) when low, Red (0) when high
        const color = `hsl(${hue}, 70%, 50%)`
        
        return (
          <group key={clay.id} position={clay.position}>
            {/* XZ horizontal plane (Y is fixed, X and Z vary) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[200, 200, 100, 100]} />
              <meshBasicMaterial
                color={color}
                wireframe
                transparent
                opacity={tool === 'move' ? (selectedClayId === clay.id ? 0.3 : 0.1) : 0.1}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )
      })}
      
      {/* XZ Horizontal Plane for push, pull tools */}
      {(tool === 'push' || tool === 'pull') && hoveredPoint && (
        <group position={hoveredPoint}>
          {/* XZ horizontal plane that moves up/down (Y changes) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[200, 200, 100, 100]} />
            <meshBasicMaterial 
              color="#888888" 
              wireframe 
              transparent 
              opacity={0.2} 
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}
      
      {/* XZ Horizontal Plane for add tool */}
      {tool === 'add' && (
        <group position={new THREE.Vector3(0, 0, hoveredPoint?.z || 0)}>
          {/* XZ horizontal plane for add tool at current Z depth */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[200, 200, 100, 100]} />
            <meshBasicMaterial 
              color="#888888" 
              wireframe 
              transparent 
              opacity={0.2} 
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}
      
    </group>
  )
}

// Raycaster component to handle global click events
function RaycasterManager({ 
  tool, 
  currentColor, 
  clayObjects, 
  updateClay,
  setSelectedClayId,
  removeClay
}: {
  tool: string
  currentColor: string
  clayObjects: ClayObject[]
  updateClay: (clay: ClayObject) => void
  setSelectedClayId: (id: string | null) => void
  removeClay: (id: string) => void
}) {
  const { camera, raycaster, gl, scene } = useThree()
  
  useEffect(() => {
    const handlePointerClick = (event: PointerEvent) => {
      if (tool !== 'paint' && tool !== 'delete' && tool !== 'rotateObject') return
      
      // Calculate mouse position in normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      const mouse = new THREE.Vector2(x, y)
      
      // Update the picking ray with the camera and mouse position
      raycaster.setFromCamera(mouse, camera)
      
      // Find all intersections
      const meshes: THREE.Mesh[] = []
      clayObjects.forEach(clay => {
        const mesh = gl.domElement.querySelector(`[data-clay-id="${clay.id}"]`)
        if (mesh && mesh instanceof THREE.Mesh) {
          meshes.push(mesh)
        }
      })
      
      // Get all intersections
      const allIntersects: THREE.Intersection[] = []
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.clayId) {
          const intersects = raycaster.intersectObject(child, false)
          if (intersects.length > 0) {
            allIntersects.push(...intersects)
          }
        }
      })
      
      if (allIntersects.length > 0) {
        // Sort by distance (closest first)
        allIntersects.sort((a, b) => a.distance - b.distance)
        const closest = allIntersects[0]
        const clayId = closest.object.userData.clayId
        
        if (clayId) {
          const clay = clayObjects.find(c => c.id === clayId)
          if (clay) {
            if (tool === 'paint') {
              const newClay = { ...clay, color: currentColor }
              updateClay(newClay)
            } else if (tool === 'delete') {
              setSelectedClayId(clayId)
              removeClay(clayId)
            } else if (tool === 'rotateObject') {
              setSelectedClayId(clayId)
            } else if (tool === 'resize') {
              setSelectedClayId(clayId)
            }
          }
        }
      }
    }
    
    gl.domElement.addEventListener('click', handlePointerClick)
    return () => {
      gl.domElement.removeEventListener('click', handlePointerClick)
    }
  }, [tool, currentColor, clayObjects, updateClay, setSelectedClayId, removeClay, camera, raycaster, gl, scene])
  
  return null
}

export default function AdvancedClay() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const { popupConfig, showPopup, PopupComponent } = usePopup()
  const router = useRouter()
  const [clayObjects, setClayObjects] = useState<ClayObject[]>([])
  const [tool, setTool] = useState<'rotate' | 'rotateObject' | 'push' | 'pull' | 'paint' | 'add' | 'move' | 'delete' | 'resize'>('rotate')
  const [brushSize, setBrushSize] = useState(0.8)
  const [currentColor, setCurrentColor] = useState('#B8C5D6')
  const [detail, setDetail] = useState(48)
  const [isDeforming, setIsDeforming] = useState(false)
  const [selectedClayId, setSelectedClayId] = useState<string | null>(null)
  const [hoveredClayId, setHoveredClayId] = useState<string | null>(null)
  const [selectedShape, setSelectedShape] = useState<'sphere' | 'tetrahedron' | 'cube' | 'line' | 'curve' | 'rectangle' | 'triangle' | 'circle'>('sphere')
  const [moveSpeed, setMoveSpeed] = useState(0.5)
  const [backgroundColor, setBackgroundColor] = useState('#f0f0f0')
  const [hoveredPoint, setHoveredPoint] = useState<THREE.Vector3 | null>(null)
  const [shapeCategory, setShapeCategory] = useState<'3d' | 'line' | '2d'>('3d')
  const [cameraRelativeCoords, setCameraRelativeCoords] = useState({ x: 0, y: 0, z: 0 })
  const [cameraResetTrigger, setCameraResetTrigger] = useState(0)
  
  // Track current project
  const [currentProjectInfo, setCurrentProjectInfo] = useState<{
    projectId: string;
    rootTxId?: string;
    name: string;
    isDirty: boolean;
  } | null>(null)
  const [projects, setProjects] = useState<Array<{ id: string; tags: Record<string, string> }>>([])
  const [currentFolder, setCurrentFolder] = useState('')
  const [irysUploader, setIrysUploader] = useState<any>(null)
  const [chunkUploadProgress, setChunkUploadProgress] = useState<ChunkProgressType & { isOpen: boolean; projectName: string }>({
    currentChunk: 0,
    totalChunks: 0,
    percentage: 0,
    isOpen: false,
    projectName: ''
  })
  
  const [chunkDownloadProgress, setChunkDownloadProgress] = useState<ChunkProgressType & { isOpen: boolean; projectName: string }>({
    currentChunk: 0,
    totalChunks: 0,
    percentage: 0,
    isOpen: false,
    projectName: ''
  })
  
  // Profile states
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  
  // Thumbnail capture ref
  const captureRef = useRef<{ capture: () => Promise<string | null> } | null>(null)
  
  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showProfileMenu) {
        const target = e.target as HTMLElement
        if (!target.closest('.profile-menu-container')) {
          setShowProfileMenu(false)
        }
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showProfileMenu])
  
  const { addToHistory, undo, redo, canUndo, canRedo } = useHistory()
  const cameraRef = useRef<THREE.Camera>(null)
  
  // Mark project as dirty when clay objects change
  useEffect(() => {
    if (currentProjectInfo && clayObjects.length > 0) {
      markProjectDirty(true);
      setCurrentProjectInfo(prev => prev ? {...prev, isDirty: true} : null);
    }
  }, [clayObjects, backgroundColor])
  
  // Initialize with one clay
  useEffect(() => {
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    // Ensure clean userData
    geometry.userData = { deformed: false };
    
    const initialClay: ClayObject = {
      id: 'clay-1',
      geometry: geometry,
      position: new THREE.Vector3(0, 2, 0), // Start at y=2 so sphere sits on ground
      color: currentColor,
      shape: 'sphere',
      scale: new THREE.Vector3(1, 1, 1),
      size: 2,
      detail: detail
    }
    setClayObjects([initialClay])
    addToHistory([initialClay])
  }, [])

  // Initialize Irys when wallet is connected
  useEffect(() => {
    async function initIrys() {
      if (walletAddress) {
        try {
          const provider = (window as any).ethereum || (window as any).okxwallet || ((window as any).web3 && (window as any).web3.currentProvider)
          if (provider) {
            const uploader = await createIrysUploader(provider)
            setIrysUploader(uploader)
          }
        } catch (error) {
          console.error('Failed to initialize Irys:', error)
        }
      }
    }
    initIrys()
  }, [walletAddress])
  
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
        // Create a detailed tetrahedron-like shape with many vertices
        geometry = createDetailedGeometry('tetrahedron', size, thickness)
        break
      case 'cube':
        // Create a detailed cube with actual dimensions
        if (controlPoints && controlPoints.length > 0) {
          // Use custom dimensions passed in controlPoints[0]
          const dimensions = controlPoints[0]
          const segments = 10
          geometry = new THREE.BoxGeometry(
            dimensions.x, 
            dimensions.y, 
            dimensions.z, 
            segments, segments, segments
          )
        } else {
          geometry = createDetailedGeometry('cube', size, thickness)
        }
        break
      
      case 'rectangle':
        if (controlPoints && controlPoints.length === 2) {
          // Use the size passed from AddClayHelper which uses getScreenConsistentSize
          const aspect = Math.abs(controlPoints[1].x - controlPoints[0].x) / Math.abs(controlPoints[1].y - controlPoints[0].y)
          const width = aspect > 1 ? size : size * aspect
          const height = aspect > 1 ? size / aspect : size
          const rectSegments = 20
          geometry = new THREE.PlaneGeometry(width, height, rectSegments, rectSegments)
        } else {
          geometry = createDetailedGeometry('rectangle', size)
        }
        break
      
      case 'triangle':
        if (controlPoints && controlPoints.length === 2) {
          // Use the size passed from AddClayHelper which uses getScreenConsistentSize
          const aspect = Math.abs(controlPoints[1].x - controlPoints[0].x) / Math.abs(controlPoints[1].y - controlPoints[0].y)
          geometry = createDetailedGeometry('triangle', size)
          // Scale to match aspect ratio
          if (aspect > 1) {
            geometry.scale(1, 1 / aspect, 1)
          } else {
            geometry.scale(aspect, 1, 1)
          }
        } else {
          geometry = createDetailedGeometry('triangle', size)
        }
        break
      
      case 'circle':
        // Create a detailed circle
        if (controlPoints && controlPoints.length === 2) {
          // Use the size passed from AddClayHelper which uses getScreenConsistentSize
          geometry = new THREE.CircleGeometry(size, 64)
        } else {
          geometry = createDetailedGeometry('circle', size)
        }
        break
      
      case 'sphere':
      default:
        // size represents the diameter
        geometry = new THREE.SphereGeometry(size, detail, detail)
        break
    }
    
    // Ensure clean userData for new geometries
    geometry.userData = { deformed: false };
    
    const newClay: ClayObject = {
      id: `clay-${Date.now()}`,
      geometry: geometry,
      position: position,
      color: currentColor,
      shape: selectedShape,
      rotation: rotation,
      scale: new THREE.Vector3(1, 1, 1),
      controlPoints: controlPoints,
      size: size,
      thickness: thickness,
      detail: selectedShape === 'sphere' ? detail : undefined
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

  const handleSaveProject = async (projectName: string, saveAs: boolean = false) => {
    if (!walletAddress) {
      showPopup('Please connect your wallet first', 'warning')
      return
    }
    
    // Ensure Irys uploader is initialized
    let uploader = irysUploader
    if (!uploader) {
      try {
        console.log('Irys uploader not ready, initializing...')
        const provider = (window as any).ethereum || (window as any).okxwallet || ((window as any).web3 && (window as any).web3.currentProvider)
        if (!provider) {
          showPopup('No wallet provider found', 'error')
          return
        }
        uploader = await createIrysUploader(provider)
        setIrysUploader(uploader)
      } catch (error) {
        console.error('Failed to initialize Irys uploader:', error)
        showPopup('Failed to initialize Irys uploader. Please try again.', 'error')
        return
      }
    }

    try {
      console.log('Saving project:', projectName, 'saveAs:', saveAs)
      console.log('Clay objects:', clayObjects)
      console.log('First clay object structure:', clayObjects[0])
      
      let projectId: string;
      let rootTxId: string | undefined;
      
      // Check if we're updating an existing project or creating a new one
      if (currentProjectInfo && !saveAs) {
        // Update existing project
        projectId = currentProjectInfo.projectId;
        rootTxId = currentProjectInfo.rootTxId;
        console.log('Updating existing project:', projectId, 'with root:', rootTxId);
      } else {
        // Create new project or save as new
        projectId = generateProjectId();
        rootTxId = undefined;
        console.log('Creating new project:', projectId);
      }
      
      // Step 1: Serialize the clay objects
      const serialized = serializeClayProject(
        clayObjects,
        projectName,
        '', // description
        walletAddress,
        [], // tags
        backgroundColor
      )
      serialized.id = projectId; // Ensure project has the correct ID
      
      // Capture thumbnail will be handled in the ThreeCanvas component
      let thumbnailId: string | undefined;
      
      // Check project size
      const jsonString = JSON.stringify(serialized);
      const sizeInKB = Buffer.from(jsonString).byteLength / 1024;
      console.log(`Project size: ${sizeInKB.toFixed(2)} KB`);
      
      if (sizeInKB >= 90) {
        showPopup(
          `Your project is ${sizeInKB.toFixed(2)} KB, which exceeds the 90KB free tier.\nIt will be split into multiple chunks for upload.`,
          'warning',
          { autoClose: false }
        );
      }

      // Step 2: Pay service fee via smart contract first (like IrysDune)
      try {
        // Get wallet provider (like IrysDune)
        let provider = null;
        if (typeof (window as any).ethereum !== 'undefined') {
          provider = (window as any).ethereum;
        } else if (typeof (window as any).okxwallet !== 'undefined') {
          provider = (window as any).okxwallet;
        } else if (typeof (window as any).web3 !== 'undefined' && (window as any).web3.currentProvider) {
          provider = (window as any).web3.currentProvider;
        }
        
        if (!provider) {
          showPopup('No wallet provider found. Please install MetaMask, OKX Wallet, or another Ethereum wallet.', 'error');
          return;
        }
        
        console.log('[AdvancedClay] Found wallet provider:', provider);
        
        // Request wallet connection if needed
        try {
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (!accounts || accounts.length === 0) {
            console.log('[AdvancedClay] No connected accounts, requesting connection...');
            await provider.request({ method: 'eth_requestAccounts' });
          }
        } catch (connectError) {
          console.error('[AdvancedClay] Wallet connection error:', connectError);
          showPopup('Failed to connect wallet. Please try again.', 'error');
          return;
        }
        
        console.log('Paying service fee via smart contract...')
        const paymentTx = await payForUpload(provider)
        console.log('Service fee payment transaction:', paymentTx)
        
        showPopup(`Service fee paid successfully! TX: ${paymentTx}`, 'success')
      } catch (error: any) {
        console.error('Service fee payment failed:', error)
        if (error?.message?.includes('User rejected')) {
          showPopup('Transaction cancelled by user', 'info')
          return
        } else if (error?.message?.includes('Not connected to Irys testnet')) {
          showPopup('Please switch to Irys testnet network in your wallet.', 'warning')
          return
        } else if (error?.message?.includes('Insufficient funds')) {
          showPopup(error.message, 'error')
          return
        } else {
          showPopup('Service fee payment failed. Please ensure you have enough balance for the 0.1 IRYS service fee.', 'error')
          return
        }
      }

      // Step 3: Upload to Irys (no payment needed for free tier)
      console.log('Starting Irys upload...')
      let uploadResult;
      try {
        uploadResult = await uploadClayProject(
          uploader,
          serialized,
          currentFolder,
          rootTxId,
          (progress: ChunkProgressType) => {
            setChunkUploadProgress({
              ...progress,
              isOpen: true,
              projectName
            })
          },
          thumbnailId
        )
        console.log('Upload result:', uploadResult)
      } catch (uploadError: any) {
        console.error('Irys upload failed:', uploadError)
        showPopup('Failed to upload project to Irys. Please try again.', 'error')
        return
      }

      // Step 4: Save references
      const result = uploadResult;
      
      // Save mutable reference
      saveMutableReference(
        projectId,
        result.rootTxId,
        result.transactionId,
        projectName,
        walletAddress
      );
      
      // Update current project info
      setCurrentProjectInfo({
        projectId,
        rootTxId: result.rootTxId,
        name: projectName,
        isDirty: false
      });
      markProjectDirty(false);
      
      // Close progress dialog if it was open
      setChunkUploadProgress(prev => ({ ...prev, isOpen: false }))
      
      const viewUrl = `https://gateway.irys.xyz/mutable/${result.rootTxId}`;
      if (result.wasChunked) {
        showPopup(
          `Large project ${result.isUpdate ? 'updated' : 'saved'} successfully!\nUploaded in ${chunkUploadProgress.totalChunks} chunks.\nView at: ${viewUrl}`,
          'success',
          { autoClose: false }
        )
      } else {
        showPopup(
          `Project ${result.isUpdate ? 'updated' : 'saved'} successfully!\nView at: ${viewUrl}`,
          'success',
          { autoClose: false }
        )
      }
      
      // Clear cache to refresh projects list
      queryCache.delete(`projects-${walletAddress}`)
    } catch (error: any) {
      console.error('Failed to save project:', error)
      if (error?.message?.includes('User rejected')) {
        showPopup('Transaction cancelled by user', 'info')
      } else if (error?.message?.includes('Insufficient balance')) {
        showPopup('Insufficient balance. Your project is over 100KB and requires IRYS tokens. Please add funds to your wallet.', 'error')
      } else if (error?.message?.includes('over 100KB')) {
        showPopup('Project size exceeds 100KB free tier. Payment is required.', 'warning')
      } else {
        showPopup('Failed to save project. Please try again.', 'error')
      }
    }
  }

  const handleProjectSelect = async (projectId: string) => {
    try {
      console.log('Loading project:', projectId)
      
      // Get project name from metadata if available
      const projectName = projectId.substring(0, 20) + '...'; // Truncate for display
      
      // Download project from Irys with progress callback
      const project = await downloadClayProject(projectId, (progress) => {
        setChunkDownloadProgress({
          ...progress,
          isOpen: true,
          projectName: projectName
        });
      })
      console.log('Downloaded project:', project)
      
      // Get mutable reference info
      const mutableRef = getMutableReference(project.id);
      
      // Restore clay objects
      const restoredObjects = restoreClayObjects(project, detail)
      console.log('Restored objects:', restoredObjects)
      
      // Clear current objects and set new ones
      setClayObjects(restoredObjects)
      
      // Reset history with new state
      addToHistory(restoredObjects)
      
      // Update current folder if project has folder info
      if (project.tags?.includes('Folder')) {
        const folderIndex = project.tags.indexOf('Folder')
        setCurrentFolder(project.tags[folderIndex + 1] || '/')
      }
      
      // Restore background color
      if (project.backgroundColor) {
        setBackgroundColor(project.backgroundColor)
      }
      
      // Set current project info
      setCurrentProjectInfo({
        projectId: project.id,
        rootTxId: mutableRef?.rootTxId || projectId,
        name: project.name,
        isDirty: false
      });
      setCurrentProject({
        projectId: project.id,
        rootTxId: mutableRef?.rootTxId || projectId,
        name: project.name,
        isDirty: false
      });
      
      // Close download progress dialog
      setChunkDownloadProgress(prev => ({ ...prev, isOpen: false }));
      
      showPopup(`Project "${project.name}" loaded successfully!`, 'success')
    } catch (error) {
      console.error('Failed to load project:', error)
      // Close download progress dialog on error
      setChunkDownloadProgress(prev => ({ ...prev, isOpen: false }));
      showPopup('Failed to load project. Please try again.', 'error')
    }
  }

  const handleProjectMove = (projectId: string, folderPath: string) => {
    // Update project folder
    console.log('Moving project:', projectId, 'to', folderPath)
  }

  const handleProjectDelete = async (projectId: string) => {
    try {
      if (!irysUploader || !walletAddress) {
        showPopup('Please connect your wallet first', 'warning')
        return
      }
      
      console.log('Deleting project:', projectId)
      
      // Upload deletion marker
      const deletionId = await deleteClayProject(irysUploader, projectId, walletAddress)
      console.log('Deletion marker created:', deletionId)
      
      // Clear cache to refresh list
      queryCache.delete(`projects-${walletAddress}`)
      
      showPopup('Project deleted successfully!', 'success')
    } catch (error) {
      console.error('Failed to delete project:', error)
      showPopup('Failed to delete project. Please try again.', 'error')
    }
  }

  const handleFolderCreate = (folderPath: string) => {
    // Create folder (update projects with new folder)
    console.log('Creating folder:', folderPath)
  }

  const handleFolderDelete = (folderPath: string) => {
    // Delete folder
    console.log('Deleting folder:', folderPath)
  }

  const handleExportGLB = async () => {
    // TODO: Replace with popup input dialog
    const projectName = prompt('Enter project name for GLB export:')
    if (!projectName) return

    try {
      await downloadAsGLB(clayObjects, projectName, {
        author: walletAddress || 'Anonymous',
        description: 'Created with GetClayed'
      })
    } catch (error) {
      console.error('Failed to export GLB:', error)
      showPopup('Failed to export GLB file', 'error')
    }
  }
  
  const handleNewFile = () => {
    if (currentProjectInfo?.isDirty) {
      if (!confirm('You have unsaved changes. Create a new file anyway?')) {
        return
      }
    }
    
    // Reset to initial state
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    geometry.userData = { deformed: false };
    
    const initialClay: ClayObject = {
      id: 'clay-1',
      geometry: geometry,
      position: new THREE.Vector3(0, 2, 0),
      color: currentColor,
      shape: 'sphere',
      scale: new THREE.Vector3(1, 1, 1),
      size: 2,
      detail: detail
    }
    
    setClayObjects([initialClay])
    addToHistory([initialClay])
    setCurrentProjectInfo(null)
    setCurrentProject(null)
    setBackgroundColor('#f0f0f0')
    setCurrentFolder('')
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
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Chunk upload progress dialog */}
      <ChunkUploadProgress 
        isOpen={chunkUploadProgress.isOpen}
        currentChunk={chunkUploadProgress.currentChunk}
        totalChunks={chunkUploadProgress.totalChunks}
        percentage={chunkUploadProgress.percentage}
        projectName={chunkUploadProgress.projectName}
      />
      
      {/* Chunk download progress dialog */}
      <ChunkUploadProgress 
        isOpen={chunkDownloadProgress.isOpen}
        currentChunk={chunkDownloadProgress.currentChunk}
        totalChunks={chunkDownloadProgress.totalChunks}
        percentage={chunkDownloadProgress.percentage}
        projectName={chunkDownloadProgress.projectName}
        isDownload={true}
      />
      
      {/* Folder Structure - Only show when wallet connected */}
      {walletAddress && (
        <FolderStructure
          walletAddress={walletAddress}
          onProjectSelect={handleProjectSelect}
          onProjectMove={handleProjectMove}
          onProjectDelete={handleProjectDelete}
          onFolderCreate={handleFolderCreate}
          onFolderDelete={handleFolderDelete}
          currentFolder={currentFolder}
        />
      )}
      
      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
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
            zoomSpeed={1.5}
            noPan={true}
            minDistance={1}
            maxDistance={100}
            staticMoving={false}
            dynamicDampingFactor={0.1}
          />
          
          {/* Camera Reset Component */}
          <CameraReset resetTrigger={cameraResetTrigger} />
          
          {/* Raycaster Manager for global click handling */}
          <RaycasterManager 
            tool={tool}
            currentColor={currentColor}
            clayObjects={clayObjects}
            updateClay={updateClay}
            setSelectedClayId={setSelectedClayId}
            removeClay={removeClay}
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
            <AddClayHelper 
              onAdd={addNewClay} 
              shape={selectedShape}
              onHoverPoint={setHoveredPoint}
            />
          )}
          
          {/* Grid for reference */}
          {(tool === 'add' || tool === 'move' || tool === 'push' || tool === 'pull' || tool === 'rotate') && (
            <DynamicGridHelper 
              tool={tool}
              selectedClayId={selectedClayId}
              clayObjects={clayObjects}
              hoveredPoint={hoveredPoint}
              onCoordsUpdate={setCameraRelativeCoords}
            />
          )}
          
          <Environment preset="studio" />
        </Suspense>
      </Canvas>
      
      {/* Coordinate Display Overlay */}
      {(tool === 'move' || tool === 'add' || tool === 'push' || tool === 'pull') && (
        <div className="absolute bottom-4 right-4 bg-black/70 text-white p-2 rounded-md font-mono text-xs z-10">
          <div>X: {cameraRelativeCoords.x.toFixed(2)}</div>
          <div>Y: {cameraRelativeCoords.y.toFixed(2)}</div>
          <div>Z: {cameraRelativeCoords.z.toFixed(2)}</div>
        </div>
      )}
      </div>
      
      {/* Bottom Toolbar */}
      <div className="bg-white shadow-lg border-t border-gray-200">
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4">
          {/* Left side - Profile and Connect Wallet */}
          <div className="flex items-center gap-2">
            {/* Profile Button */}
            <div className="relative profile-menu-container">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="p-3 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-all border border-gray-200"
                title="Profile"
              >
                <User size={20} />
              </button>
              
              {/* Profile Menu */}
              {showProfileMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[160px]">
                  <button
                    onClick={async () => {
                      if (walletAddress) {
                        setShowProfileMenu(false)
                        // Check if user has display name
                        const profile = await downloadUserProfile(walletAddress)
                        if (profile?.displayName) {
                          router.push(`/user/${profile.displayName}`)
                        } else {
                          router.push(`/user/${walletAddress}`)
                        }
                      } else {
                        showPopup('Please connect your wallet first', 'warning')
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded transition-colors text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      My Profile
                    </div>
                  </button>
                </div>
              )}
            </div>
            
            <ConnectWallet 
              onConnect={async (address) => {
                setWalletAddress(address)
                
                // Initialize Irys uploader immediately after wallet connection
                try {
                  console.log('Initializing Irys uploader...')
                  const provider = (window as any).ethereum || (window as any).okxwallet || ((window as any).web3 && (window as any).web3.currentProvider)
                  if (provider) {
                    const uploader = await createIrysUploader(provider)
                    setIrysUploader(uploader)
                    console.log('Irys uploader initialized successfully')
                  }
                } catch (error) {
                  console.error('Failed to initialize Irys uploader:', error)
                }
              }}
              onDisconnect={() => {
                setWalletAddress(null)
                setIrysUploader(null)
              }}
            />
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
                    ? 'bg-gray-800 text-white shadow-md' 
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
                title="Rotate Object"
              >
                <RotateCw size={20} />
              </button>
              <button
                onClick={() => setTool('resize')}
                className={`p-3 rounded-lg transition-all ${
                  tool === 'resize' 
                    ? 'bg-gray-800 text-white shadow-md' 
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
                title="Resize Object"
              >
                <Maximize2 size={20} />
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
          
          
          {/* New File Button */}
          <button
            onClick={handleNewFile}
            className="p-3 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-all"
            title="New File"
          >
            <FilePlus size={20} />
          </button>
          
          {/* Save Button */}
                      <SaveButton 
                        onSave={handleSaveProject} 
                        isConnected={!!walletAddress}
                        currentProjectName={currentProjectInfo?.name}
                        isDirty={currentProjectInfo?.isDirty}
                      />
          
          {/* Export GLB Button */}
          <button
            onClick={handleExportGLB}
            className="p-3 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-all"
            title="Export as GLB"
          >
            <Download size={20} />
          </button>
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
          {tool === 'rotate' && (
            <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  // Trigger camera reset
                  setCameraResetTrigger(prev => prev + 1)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-all"
                title="Reset camera to initial position"
              >
                <RotateCcw size={16} />
                <span className="text-sm">Reset Camera</span>
              </button>
            </div>
          )}
          
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
      
      {/* Coordinate Display Overlay - moved inside Canvas container */}
      
      {/* Popup Notification */}
      <PopupComponent />
    </div>
  )
}
