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
  Square,
  Minus,
  Spline,
  Download,
  FilePlus,
  Maximize2,
  RotateCcw,
  User,
  ChevronUp,
  Home,
  PenTool,
  HelpCircle,
  X
} from 'lucide-react'
import SaveButton from '../../components/SaveButton'
import FolderStructure, { FolderStructureHandle } from '../../components/FolderStructure'
import { ConnectWallet } from '../../components/ConnectWallet'
import { AnimatedClayLogo } from '../../components/AnimatedClayLogo'
import { serializeClayProject, uploadClayProject, downloadClayProject, restoreClayObjects, deleteClayProject, uploadProjectThumbnail, downloadProjectThumbnail } from '../../lib/clayStorageService'
import { registerLibraryAsset } from '../../lib/libraryService'
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
  shape?: 'sphere' | 'cube' | 'line' | 'curve' | 'rectangle' | 'circle' | 'freehand'
  rotation?: THREE.Euler
  scale?: number | THREE.Vector3
  controlPoints?: THREE.Vector3[] // For line and curve shapes
  size?: number // Original size parameter
  thickness?: number // Original thickness parameter
  detail?: number // For sphere detail
  groupId?: string // ID of the group this object belongs to
}

interface ClayGroup {
  id: string
  name: string
  objectIds: string[]
  mainObjectId: string
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
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

// Scene background setter component
function SceneBackground({ color }: { color: string }) {
  const { scene } = useThree()
  
  useEffect(() => {
    scene.background = new THREE.Color(color)
  }, [scene, color])
  
  return null
}

// Individual Clay Component
// Thumbnail capture component
function ThumbnailCapture({ captureRequested, onCapture }: { captureRequested: boolean, onCapture: (dataUrl: string) => void }) {
  const { gl, scene, camera } = useThree()
  
  useEffect(() => {
    if (captureRequested) {
      const capture = async () => {
        try {
          console.log('[ThumbnailCapture] Starting thumbnail capture...')
          const thumbnail = await captureSceneThumbnail(gl, scene, camera, 2560, 1920)
          console.log('[ThumbnailCapture] Raw thumbnail captured, size:', thumbnail.length)
          const compressed = await compressImageDataUrl(thumbnail, 1200, 0.92)
          console.log('[ThumbnailCapture] Compressed thumbnail, size:', compressed.length)
          onCapture(compressed)
        } catch (error) {
          console.error('[ThumbnailCapture] Failed to capture thumbnail:', error)
          onCapture('')
        }
      }
      // Add a small delay to ensure the scene is properly rendered
      setTimeout(capture, 100)
    }
  }, [captureRequested, gl, scene, camera, onCapture])
  
  return null
}

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
  onBrushHover,
  selectedForGrouping,
  showGroupingPanel,
  toggleObjectForGrouping,
  isGroupHighlighted,
  clayGroups,
  clayObjects,
  onContextMenu
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
  onContextMenu?: (e: React.MouseEvent, clayId: string) => void
  onHover: () => void
  onHoverEnd: () => void
  onBrushHover?: (point: THREE.Vector3 | null) => void
  selectedForGrouping?: string[]
  showGroupingPanel?: boolean
  toggleObjectForGrouping?: (id: string) => void
  isGroupHighlighted?: boolean
  clayGroups?: ClayGroup[]
  clayObjects?: ClayObject[]
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
  
  // Handle tool-specific mouse events when selected or when rotation tool is active
  useEffect(() => {
    // For rotation tool, we don't need selection; for other tools we do
    if (tool !== 'rotateObject' && !isSelected) return
    
    // Capture clayObjects in the effect scope
    const currentClayObjects = clayObjects
    
    const handleToolMouseMove = (e: MouseEvent | TouchEvent) => {
      if (tool === 'rotateObject' && rotationRef.current.active && meshRef.current) {
        // Get coordinates from mouse or touch
        const point = e.type.includes('touch') && 'touches' in e && e.touches[0] 
          ? e.touches[0] 
          : e as MouseEvent
        const deltaX = (point.clientX - rotationRef.current.startX) * 0.01
        const deltaY = (point.clientY - rotationRef.current.startY) * 0.01
        
        if (rotationRef.current.isGroupRotation && clay.groupId && currentClayObjects) {
          // Group rotation around main object
          const rotationMatrix = new THREE.Matrix4()
          rotationMatrix.makeRotationFromEuler(new THREE.Euler(deltaY, deltaX, 0))
          
          // Collect all updates first
          const updates: typeof currentClayObjects = []
          
          currentClayObjects.forEach(obj => {
            if (obj.groupId === clay.groupId) {
              const initialRotation = rotationRef.current.groupInitialRotations.get(obj.id)
              
              if (obj.id === rotationRef.current.mainObjectId) {
                // Main object: only rotate, don't move
                if (initialRotation) {
                  updates.push({
                    ...obj,
                    rotation: new THREE.Euler(
                      initialRotation.x + deltaY,
                      initialRotation.y + deltaX,
                      initialRotation.z
                    )
                  })
                }
              } else {
                // Other objects: rotate around main object
                const initialRelativePos = rotationRef.current.groupInitialPositions.get(obj.id)
                if (initialRelativePos && initialRotation) {
                  // Rotate the relative position
                  const rotatedPos = initialRelativePos.clone().applyMatrix4(rotationMatrix)
                  const newPosition = new THREE.Vector3().addVectors(rotatedPos, rotationRef.current.groupCenter)
                  
                  updates.push({
                    ...obj,
                    position: newPosition,
                    rotation: new THREE.Euler(
                      initialRotation.x + deltaY,
                      initialRotation.y + deltaX,
                      initialRotation.z
                    )
                  })
                }
              }
            }
          })
          
          // For group rotation, we need to update all objects at once to avoid updateClay's group sync
          // Get the parent component's setClayObjects function
          const parentUpdate = onUpdate
          
          // Instead of calling onUpdate for each object (which triggers group sync),
          // we'll update the entire state at once
          if (updates.length > 0) {
            // Find the AdvancedClay's setClayObjects through a custom update
            parentUpdate({
              ...updates[0],
              _batchUpdates: updates
            } as any)
          }
        } else {
          // Single object rotation
          meshRef.current.rotation.y = rotationRef.current.initialRotation.y + deltaX
          meshRef.current.rotation.x = rotationRef.current.initialRotation.x + deltaY
          
          const newClay = {
            ...clay,
            rotation: meshRef.current.rotation.clone()
          }
          onUpdate(newClay)
        }
      } else if (tool === 'resize' && resizeRef.current.active && groupRef.current) {
        // Calculate current distance from object center to mouse position
        const rect = gl.domElement.getBoundingClientRect()
        const point = e.type.includes('touch') && 'touches' in e && e.touches[0] 
          ? e.touches[0] 
          : e as MouseEvent
        const x = ((point.clientX - rect.left) / rect.width) * 2 - 1
        const y = -((point.clientY - rect.top) / rect.height) * 2 + 1
        
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
        
        // If clay is part of a group, update the scale for all group members
        if (clay.groupId) {
          // Calculate scale ratio for other objects
          const scaleRatio = scaleFactor / resizeRef.current.initialScale
          // We'll handle this in the updateClay function
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
    
    if (tool === 'rotateObject' || (tool === 'resize' && isSelected)) {
      window.addEventListener('mousemove', handleToolMouseMove)
      window.addEventListener('mouseup', handleToolMouseUp)
      window.addEventListener('touchmove', handleToolMouseMove, { passive: false })
      window.addEventListener('touchend', handleToolMouseUp)
      
      return () => {
        window.removeEventListener('mousemove', handleToolMouseMove)
        window.removeEventListener('mouseup', handleToolMouseUp)
        window.removeEventListener('touchmove', handleToolMouseMove)
        window.removeEventListener('touchend', handleToolMouseUp)
      }
    }
  }, [tool, isSelected, clay, onUpdate, gl, camera, clayObjects, clayGroups])
  
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
    
    // Get camera's coordinate system for screen-based deformation
    const cameraDirection = new THREE.Vector3()
    camera.getWorldDirection(cameraDirection)
    
    // Calculate camera's right vector (screen X axis)
    const worldUp = new THREE.Vector3(0, 1, 0)
    const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, worldUp).normalize()
    
    // Calculate camera's up vector (screen Y axis)
    const cameraUp = new THREE.Vector3().crossVectors(cameraRight, cameraDirection).normalize()
    
    // Project movement delta onto camera's coordinate system
    const screenMovement = new THREE.Vector3()
    
    // Get the movement components in screen space
    const movementRight = movementDelta.dot(cameraRight)
    const movementUp = movementDelta.dot(cameraUp)
    const movementForward = movementDelta.dot(cameraDirection)
    
    // For push/pull, we primarily want movement along the camera's forward direction
    // but also preserve some screen-space movement for better control
    screenMovement
      .addScaledVector(cameraRight, movementRight * 0.7)  // Reduce lateral movement
      .addScaledVector(cameraUp, movementUp * 0.7)        // Reduce vertical movement
      .addScaledVector(cameraDirection, movementForward)   // Full forward/backward movement
    
    // Update vertices based on their distance from hit point
    for (const v of dragState.current.vertices) {
      if (tool === 'push' || tool === 'pull') {
        // For pull, reverse the movement direction
        const direction = tool === 'pull' ? -1 : 1
        const movement = screenMovement.clone().multiplyScalar(v.weight * direction)
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
    initialRotation: new THREE.Euler(0, 0, 0),
    groupCenter: new THREE.Vector3(),
    groupInitialPositions: new Map<string, THREE.Vector3>(),
    groupInitialRotations: new Map<string, THREE.Euler>(),
    isGroupRotation: false,
    mainObjectId: null as string | null
  })
  
  return (
    <group ref={groupRef} position={clay.position} rotation={clay.rotation || new THREE.Euler()}>
      <mesh
        ref={meshRef}
        scale={clay.scale instanceof THREE.Vector3 ? [clay.scale.x, clay.scale.y, clay.scale.z] : clay.scale || 1}
        userData={{ clayId: clay.id }}
        onPointerEnter={onHover}
        onPointerLeave={onHoverEnd}
        onPointerMove={(e) => {
          if ((tool === 'push' || tool === 'pull') && onBrushHover) {
            onBrushHover(e.point)
          }
        }}
        onContextMenu={(e) => {
          e.stopPropagation()
          console.log('[ContextMenu] Object right-clicked:', clay.id, 'onContextMenu exists:', !!onContextMenu)
          if (onContextMenu) {
            const mouseEvent = e.nativeEvent as any
            console.log('[ContextMenu] Calling onContextMenu with:', mouseEvent.clientX, mouseEvent.clientY)
            onContextMenu(mouseEvent, clay.id)
          }
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          
          // Check if it's a touch event (button is undefined for touch)
          const isTouch = e.pointerType === 'touch'
          const isLeftClick = e.button === 0 || (isTouch && e.button === undefined)
          
          // Prevent default touch behavior (text selection, etc.)
          if (isTouch && e.nativeEvent) {
            e.nativeEvent.preventDefault()
          }
          
          // If grouping panel is open and this is a left click/touch, toggle selection
          if (showGroupingPanel && isLeftClick) {
            toggleObjectForGrouping?.(clay.id)
            return
          }
          
          if (tool === 'rotateObject' && meshRef.current) {
            // Select the object if not already selected
            if (!isSelected) {
              onSelect()
            }
            
            rotationRef.current.active = true
            // For three.js pointer events, clientX/Y are already available
            rotationRef.current.startX = e.clientX
            rotationRef.current.startY = e.clientY
            rotationRef.current.initialRotation.copy(meshRef.current.rotation)
            
            // Check if this is a group rotation
            if (clay.groupId && clayGroups && clayObjects) {
              const group = clayGroups.find(g => g.id === clay.groupId)
              if (group) {
                rotationRef.current.isGroupRotation = true
                rotationRef.current.mainObjectId = group.mainObjectId
                
                // Use main object position as rotation center
                const mainObject = clayObjects.find(c => c.id === group.mainObjectId)
                if (mainObject) {
                  rotationRef.current.groupCenter.copy(mainObject.position)
                } else {
                  // Fallback to geometric center if main object not found
                  const groupObjects = clayObjects.filter(c => c.groupId === clay.groupId)
                  const center = new THREE.Vector3()
                  groupObjects.forEach(obj => {
                    center.add(obj.position)
                  })
                  center.divideScalar(groupObjects.length)
                  rotationRef.current.groupCenter.copy(center)
                }
                
                // Store initial positions and rotations for all group objects
                const groupObjects = clayObjects.filter(c => c.groupId === clay.groupId)
                rotationRef.current.groupInitialPositions.clear()
                rotationRef.current.groupInitialRotations.clear()
                groupObjects.forEach(obj => {
                  // Store position relative to group center (for non-main objects)
                  const relativePos = obj.position.clone().sub(rotationRef.current.groupCenter)
                  rotationRef.current.groupInitialPositions.set(obj.id, relativePos)
                  
                  // Store initial rotation for each object
                  rotationRef.current.groupInitialRotations.set(obj.id, obj.rotation?.clone() || new THREE.Euler(0, 0, 0))
                })
              }
            } else {
              rotationRef.current.isGroupRotation = false
              rotationRef.current.mainObjectId = null
            }
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
            isSelected && (tool === 'move' || tool === 'rotateObject' || tool === 'resize' || tool === 'rotate')
              ? '#0099ff' 
              : '#000000'
          }
          emissiveIntensity={isSelected ? 0.5 : 0}
        />
      </mesh>
      {/* Unified selection/hover indicator */}
      {((isHovered && (tool === 'paint' || tool === 'rotateObject' || tool === 'resize')) ||
        (selectedForGrouping && selectedForGrouping.includes(clay.id)) ||
        (isGroupHighlighted)) && (
        <mesh
          geometry={clay.geometry}
          scale={clay.scale instanceof THREE.Vector3 ? [clay.scale.x * 1.08, clay.scale.y * 1.08, clay.scale.z * 1.08] : (clay.scale || 1) * 1.08}
          userData={{ isOutline: true }}
        >
          <meshBasicMaterial
            color={
              (selectedForGrouping && selectedForGrouping.includes(clay.id)) || isGroupHighlighted
                ? "#3b82f6"  // Blue for grouping
                : "#ffffff"  // White for hover
            }
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
              
              // Prevent default touch behavior
              if (e.pointerType === 'touch' && e.nativeEvent) {
                e.nativeEvent.preventDefault()
              }
              
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
  shape: 'sphere' | 'cube' | 'line' | 'curve' | 'rectangle' | 'circle' | 'freehand'
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
  const [thirdPointDepth, setThirdPointDepth] = useState(0) // Depth adjustment for third point
  const thirdPointDepthRef = useRef(0) // Use ref for scroll handling
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false)
  const [freehandPoints, setFreehandPoints] = useState<THREE.Vector3[]>([])
  
  // Get camera-distance independent size for guide points
  const getConstantScreenSize = useCallback((position: THREE.Vector3, targetPixelSize: number = 10): number => {
    const distance = camera.position.distanceTo(position);
    const fov = (camera as THREE.PerspectiveCamera).fov || 50;
    const canvas = gl.domElement;
    const height = canvas.clientHeight;
    
    // Calculate world size that appears as targetPixelSize pixels on screen
    const worldSize = (2 * Math.tan((fov * Math.PI) / 360) * distance * targetPixelSize) / height;
    return worldSize;
  }, [camera, gl]);
  
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
      } else if (shape === 'freehand') {
        // Start freehand drawing
        console.log('Starting freehand drawing at', point)
        setIsDrawingFreehand(true)
        setFreehandPoints([point])
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
      } else if (shape === 'rectangle' || shape === 'circle') {
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
        // Cube uses 2 click points + scroll for Z
        if (clickPoints.length === 0) {
          // First click
          setClickPoints([point])
        } else if (clickPoints.length === 1) {
          // Second click - create cube immediately with default Z
          const [p1] = clickPoints
          const p2 = point
          
          // For cube: first two points define XY rectangle, Z from scroll
          if (shape === 'cube') {
            // Use current scroll depth or default
            const z = thirdPointDepthRef.current || 1 // Default depth of 1
            
            // Calculate dimensions - XY from the two points, Z from scroll
            const minX = Math.min(p1.x, p2.x)
            const maxX = Math.max(p1.x, p2.x)
            const minY = Math.min(p1.y, p2.y)
            const maxY = Math.max(p1.y, p2.y)
            
            const width = Math.abs(maxX - minX) || 0.5
            const height = Math.abs(maxY - minY) || 0.5
            const depth = Math.abs(z) || 0.5
            
            // Calculate center
            const center = new THREE.Vector3(
              (minX + maxX) / 2,
              (minY + maxY) / 2,
              p1.z + z / 2 // Base Z + half depth
            )
            
            // Store actual dimensions for BoxGeometry
            const customData = new THREE.Vector3(width, height, depth)
            const size = Math.max(width, height, depth) // This is ignored when using custom dimensions
            onAdd(center, size, 1, new THREE.Euler(), [customData])
          }
          setClickPoints([])
          setThirdPointDepth(0) // Reset depth adjustment
          thirdPointDepthRef.current = 0 // Reset ref too
        }
      }
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      const point = getIntersectionPoint(e)
      
      if (!point) {
        setCurrentPoint(null)
        onHoverPoint?.(null)
        return
      }
      
      // Debug log for freehand
      if (shape === 'freehand' && isDrawingFreehand) {
        console.log('Mouse move in freehand mode, isDrawing:', isDrawingFreehand, 'points:', freehandPoints.length)
      }
      
      // Apply depth adjustment for cube creation preview
      let adjustedPoint = point
      if (shape === 'cube' && clickPoints.length === 1) {
        // Show preview of cube with current scroll depth
        // This is just for visual feedback, actual cube is created on second click
        adjustedPoint = point // Keep the mouse point as is for XY preview
      }
      
      // Update hover point for coordinate display
      onHoverPoint?.(adjustedPoint)
      
      if (shape === 'sphere') {
        if (isDragging && dragStart) {
          setDragEnd(point)
        } else {
          // Show preview when not dragging
          setDragEnd(point)
        }
      } else if (shape === 'freehand' && isDrawingFreehand) {
        // Add points to freehand path
        setFreehandPoints(prev => {
          const lastPoint = prev[prev.length - 1]
          if (lastPoint && point.distanceTo(lastPoint) > 0.01) { // Only add if moved enough
            console.log('Adding freehand point', point, 'total points:', prev.length + 1)
            return [...prev, point]
          }
          return prev
        })
      } else if (shape === 'curve' && isDraggingCurve) {
        // Update curve control point
        setCurveControlPoint(point)
      } else {
        // Show preview for next click point
        setCurrentPoint(adjustedPoint)
        
        // If we have 2 points, update height based on mouse Y position
        if (shape !== 'line' && shape !== 'curve' && clickPoints.length === 2) {
          const baseY = (clickPoints[0].y + clickPoints[1].y) / 2
          const heightFromMouse = Math.max(0.1, Math.abs(adjustedPoint.y - baseY) * 2)
          setShapeHeight(heightFromMouse)
        }
      }
    }
    
    const handleMouseUp = (e: MouseEvent) => {
      if (shape === 'freehand' && isDrawingFreehand && freehandPoints.length > 1) {
        // Create freehand line
        console.log('Completing freehand with', freehandPoints.length, 'points')
        const center = freehandPoints.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(freehandPoints.length)
        
        // Calculate bounding box for size
        const box = new THREE.Box3()
        freehandPoints.forEach(p => box.expandByPoint(p))
        const size = box.getSize(new THREE.Vector3()).length()
        
        onAdd(center, size, lineThickness, undefined, freehandPoints)
        
        setIsDrawingFreehand(false)
        setFreehandPoints([])
      } else if (shape === 'sphere' && isDragging && dragStart && dragEnd) {
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
      // Also cancel freehand drawing if mouse leaves canvas
      if (shape === 'freehand' && isDrawingFreehand) {
        console.log('Mouse leave - cancelling freehand drawing')
        setIsDrawingFreehand(false)
        setFreehandPoints([])
      }
    }
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      
      // Adjust thickness for line, curve, and freehand
      if ((shape === 'line' || shape === 'curve' || shape === 'freehand') && (clickPoints.length > 0 || isDraggingCurve || isDrawingFreehand)) {
        const delta = e.deltaY * -0.0001
        setLineThickness(prev => Math.max(0.01, Math.min(0.5, prev + delta)))
      } else if (shape === 'cube' && clickPoints.length >= 1) {
        // Adjust depth for cube creation (works after first click)
        const scrollSpeed = 0.01
        const depthChange = e.deltaY * scrollSpeed
        thirdPointDepthRef.current += depthChange
        setThirdPointDepth(thirdPointDepthRef.current)
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
  }, [camera, raycaster, gl, dragStart, dragEnd, isDragging, onAdd, shape, clickPoints, shapeHeight, lineThickness, isDraggingCurve, curveControlPoint, currentDepth, thirdPointDepth, getScreenConsistentSize, isDrawingFreehand, freehandPoints])
  
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
          <sphereGeometry args={[getConstantScreenSize(dragEnd, 12), 16, 16]} />
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
            <sphereGeometry args={[getConstantScreenSize(point, 8), 16, 16]} />
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
              <sphereGeometry args={[getConstantScreenSize(curveControlPoint, 12), 16, 16]} />
              <meshBasicMaterial color="#00ff00" />
            </mesh>
          </>
        )}
        
        {/* Show current point preview */}
        {currentPoint && (
          <mesh position={currentPoint}>
            <sphereGeometry args={[getConstantScreenSize(currentPoint, 10), 16, 16]} />
            <meshBasicMaterial color="#0088ff" opacity={0.5} transparent />
          </mesh>
        )}
      </>
    )
  }
  
  // Render for freehand drawing
  else if (shape === 'freehand') {
    return (
      <>
        {/* Show freehand path while drawing */}
        {isDrawingFreehand && freehandPoints.length > 1 && (
          <>
            {console.log('Rendering freehand preview with', freehandPoints.length, 'points')}
            <Line
              points={freehandPoints}
              color="#888888"
              lineWidth={2}
            />
            {/* Also show line segments as backup */}
            <lineSegments>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array(
                    freehandPoints.slice(0, -1).flatMap((p, i) => [
                      p.x, p.y, p.z,
                      freehandPoints[i + 1].x, freehandPoints[i + 1].y, freehandPoints[i + 1].z
                    ])
                  ), 3]}
                  count={Math.max(0, (freehandPoints.length - 1) * 2)}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ff0000" />
            </lineSegments>
          </>
        )}
        
        {/* Show current drawing point */}
        {isDrawingFreehand && freehandPoints.length > 0 && (
          <mesh position={freehandPoints[freehandPoints.length - 1]}>
            <sphereGeometry args={[lineThickness * 2, 16, 16]} />
            <meshBasicMaterial color="#0088ff" opacity={0.5} transparent />
          </mesh>
        )}
      </>
    )
  }
  
  // Render for 2D shapes (rectangle, circle)
  else if (shape === 'rectangle' || shape === 'circle') {
    return (
      <>
        {/* Show existing click points */}
        {clickPoints.map((point, index) => (
          <mesh key={index} position={point}>
            <sphereGeometry args={[getConstantScreenSize(point, 8), 16, 16]} />
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
            <sphereGeometry args={[getConstantScreenSize(currentPoint, 10), 16, 16]} />
            <meshBasicMaterial color="#0088ff" opacity={0.5} transparent />
          </mesh>
        )}
      </>
    )
  }
  
  // Render for cube (click method)
  else {
    return (
      <>
        {/* Show existing click points */}
        {clickPoints.map((point, index) => (
          <mesh key={index} position={point}>
            <sphereGeometry args={[getConstantScreenSize(point, 8), 16, 16]} />
            <meshBasicMaterial color={shape === 'cube' ? "#ff0000" : (index === 0 ? "#ff0000" : "#00ff00")} />
          </mesh>
        ))}
        
        {/* Show preview for cube after first point */}
        {shape === 'cube' && clickPoints.length === 1 && currentPoint && (
          <>
            {(() => {
              // Create preview box with XY from points and Z from scroll
              const p1 = clickPoints[0]
              const p2 = currentPoint
              const z = thirdPointDepthRef.current || 1 // Default depth
              
              const minX = Math.min(p1.x, p2.x)
              const maxX = Math.max(p1.x, p2.x)
              const minY = Math.min(p1.y, p2.y)
              const maxY = Math.max(p1.y, p2.y)
              
              const width = Math.abs(maxX - minX) || 0.1
              const height = Math.abs(maxY - minY) || 0.1
              const depth = Math.abs(z) || 0.1
              
              const center = new THREE.Vector3(
                (minX + maxX) / 2,
                (minY + maxY) / 2,
                p1.z + z / 2 // Base Z + half depth
              )
              
              return (
                <Box
                  args={[width, height, depth]}
                  position={center}
                >
                  <meshBasicMaterial color="#888888" opacity={0.3} transparent wireframe />
                </Box>
              )
            })()}
          </>
        )}
        
        {/* Show preview for other shapes with 2 points */}
        {shape !== 'cube' && clickPoints.length === 2 && currentPoint && (
          <>
            {shape === 'tetrahedron' ? (
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
            ) : (
              /* Height indicator line from base to current mouse position */
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
            )}
          </>
        )}
        
        {/* Show current point preview */}
        {currentPoint && (
          <>
            <mesh position={currentPoint}>
              <sphereGeometry args={[getConstantScreenSize(currentPoint, 10), 16, 16]} />
              <meshBasicMaterial color="#0088ff" opacity={0.5} transparent />
            </mesh>
            {/* Show scroll hint for cube depth */}
            {shape === 'cube' && clickPoints.length === 1 && (
              <Billboard
                follow={true}
                lockX={false}
                lockY={false}
                lockZ={false}
                position={currentPoint.clone().add(new THREE.Vector3(0, 0.5, 0))}
              >
                <Text
                  fontSize={0.15}
                  color="white"
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.02}
                  outlineColor="black"
                >
                  Scroll to adjust depth (Z-axis)
                </Text>
              </Billboard>
            )}
          </>
        )}
      </>
    )
  }
  
  return null
}

// Screen-locked Isometric Grid Helper
function DynamicGridHelper({ tool, selectedClayId, clayObjects, hoveredPoint, onCoordsUpdate, isCapturing }: {
  tool: string
  selectedClayId: string | null
  clayObjects: ClayObject[]
  hoveredPoint: THREE.Vector3 | null
  onCoordsUpdate: (coords: { x: number; y: number; z: number }) => void
  isCapturing?: boolean
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
  
  // Don't render grid during thumbnail capture
  if (isCapturing) return null
  
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
      
      // Prevent default touch behavior
      if (event.pointerType === 'touch') {
        event.preventDefault()
      }
      
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
              // Check if clay is part of a group
              if (clay.groupId) {
                // Update all objects in the group
                clayObjects.forEach(obj => {
                  if (obj.groupId === clay.groupId) {
                    const newClay = { ...obj, color: currentColor }
                    updateClay(newClay)
                  }
                })
              } else {
                const newClay = { ...clay, color: currentColor }
                updateClay(newClay)
              }
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
  const { showPopup } = usePopup()
  const router = useRouter()
  const [clayObjects, setClayObjects] = useState<ClayObject[]>([])
  const [tool, setTool] = useState<'rotate' | 'rotateObject' | 'push' | 'pull' | 'paint' | 'add' | 'move' | 'delete' | 'resize' | 'group'>('rotate')
  const [brushSize, setBrushSize] = useState(0.8)
  const [currentColor, setCurrentColor] = useState('#B8C5D6')
  const [detail, setDetail] = useState(48)
  const [isDeforming, setIsDeforming] = useState(false)
  const [selectedClayId, setSelectedClayId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [hoveredClayId, setHoveredClayId] = useState<string | null>(null)
  const [selectedShape, setSelectedShape] = useState<'sphere' | 'cube' | 'line' | 'curve' | 'rectangle' | 'circle' | 'freehand'>('sphere')
  const [moveSpeed, setMoveSpeed] = useState(0.5)
  const [backgroundColor, setBackgroundColor] = useState('#f0f0f0')
  const [clayGroups, setClayGroups] = useState<ClayGroup[]>([])
  const [showGroupingPanel, setShowGroupingPanel] = useState(false)
  const [selectedForGrouping, setSelectedForGrouping] = useState<string[]>([])
  const [mainObjectForGroup, setMainObjectForGroup] = useState<string | null>(null)
  const clipboardRef = useRef<{ clay: ClayObject | null; mode: 'copy' | 'cut' | null }>({
    clay: null,
    mode: null
  })
  const [showGuide, setShowGuide] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clayId: string | null } | null>(null)
  const [showLibraryModal, setShowLibraryModal] = useState(false)
  const [libraryAssetName, setLibraryAssetName] = useState('')
  const [libraryDescription, setLibraryDescription] = useState('')
  const [libraryPrice, setLibraryPrice] = useState('')
  const [libraryProjectId, setLibraryProjectId] = useState<string | null>(null)
  
  // Tool guide data
  const toolGuides = [
    { tool: 'rotate', title: 'Camera Angle', description: 'Drag to rotate camera view' },
    { tool: 'rotateObject', title: 'Rotate Object', description: 'Drag to rotate selected object' },
    { tool: 'resize', title: 'Resize', description: 'Drag to resize selected object' },
    { tool: 'push', title: 'Push/Pull', description: 'Click and drag to deform surface' },
    { tool: 'paint', title: 'Paint', description: 'Click to change object color' },
    { tool: 'add', title: 'Add Shape', description: 'Click to add new shapes' },
    { tool: 'move', title: 'Move', description: 'Drag or use arrow keys to move objects' },
    { tool: 'group', title: 'Group', description: 'Select multiple objects to group' },
    { tool: 'delete', title: 'Delete', description: 'Click to delete objects' }
  ]
  const [hoveredPoint, setHoveredPoint] = useState<THREE.Vector3 | null>(null)
  const [shapeCategory, setShapeCategory] = useState<'3d' | 'line' | '2d'>('3d')
  const [cameraRelativeCoords, setCameraRelativeCoords] = useState({ x: 0, y: 0, z: 0 })
  const [cameraResetTrigger, setCameraResetTrigger] = useState(0)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportProjectName, setExportProjectName] = useState('')
  const [showNewFileModal, setShowNewFileModal] = useState(false)
  const [captureRequested, setCaptureRequested] = useState(false)
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null)
  const thumbnailResolveRef = useRef<((value: string) => void) | null>(null)
  
  // Track current project
  const [currentProjectInfo, setCurrentProjectInfo] = useState<{
    projectId: string;
    rootTxId?: string;
    name: string;
    isDirty: boolean;
  } | null>(null)
  const [projects, setProjects] = useState<Array<{ id: string; tags: Record<string, string> }>>([])
  const [currentFolder, setCurrentFolder] = useState('')
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
  
  // Auto-save state
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
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
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    if (contextMenu) {
      window.addEventListener('click', handleClick)
      return () => window.removeEventListener('click', handleClick)
    }
  }, [contextMenu])
  
  const { addToHistory, undo, redo, canUndo, canRedo } = useHistory()
  const cameraRef = useRef<THREE.Camera>(null)
  const folderStructureRef = useRef<FolderStructureHandle>(null)
  const toolButtonsRef = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  
  // Guide navigation functions
  const nextGuideStep = () => {
    if (guideStep < toolGuides.length - 1) {
      setGuideStep(prev => prev + 1)
    } else {
      setShowGuide(false)
      setGuideStep(0)
    }
  }
  
  const prevGuideStep = () => {
    if (guideStep > 0) {
      setGuideStep(prev => prev - 1)
    }
  }
  
  const skipGuide = () => {
    setShowGuide(false)
    setGuideStep(0)
  }
  
  const handleAddToLibrary = (projectId: string) => {
    setLibraryProjectId(projectId)
    setShowLibraryModal(true)
  }
  
  const handleLibraryUpload = async () => {
    if (!libraryProjectId || !walletAddress || !libraryAssetName || !libraryPrice) {
      showPopup('Please fill all fields', 'warning')
      return
    }
    
    try {
      const result = await registerLibraryAsset(
        libraryProjectId,
        libraryAssetName,
        libraryDescription,
        parseFloat(libraryPrice),
        walletAddress
      )
      
      if (result.success) {
        showPopup('Asset registered to library!', 'success')
        setShowLibraryModal(false)
        setLibraryAssetName('')
        setLibraryDescription('')
        setLibraryPrice('')
        setLibraryProjectId(null)
      } else {
        showPopup(result.error || 'Registration failed', 'error')
      }
    } catch (error: any) {
      showPopup(error.message || 'Registration failed', 'error')
    }
  }
  
  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentProjectInfo?.isDirty || (clayObjects.length > 0 && !currentProjectInfo)) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [currentProjectInfo, clayObjects])
  
  // Mark project as dirty when clay objects change and auto-save
  useEffect(() => {
    if (currentProjectInfo && clayObjects.length > 0) {
      markProjectDirty(true);
      setCurrentProjectInfo(prev => prev ? {...prev, isDirty: true} : null);
    }
    
    // Auto-save to localStorage
    if (clayObjects.length > 0) {
      // Clear existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
      
      // Set new timeout for auto-save (after 2 seconds of no changes)
      autoSaveTimeoutRef.current = setTimeout(() => {
        try {
          const autoSaveData = {
            clayObjects: clayObjects.map(clay => ({
              id: clay.id,
              position: clay.position,
              rotation: clay.rotation,
              scale: clay.scale instanceof THREE.Vector3 ? clay.scale.x : (clay.scale || 1),
              color: clay.color,
              shape: clay.shape,
              size: clay.size,
              thickness: clay.thickness,
              detail: clay.detail,
              controlPoints: clay.controlPoints,
              groupId: clay.groupId,
              // For push/pull deformed geometries, save vertex data
              vertices: clay.geometry.userData?.deformed ? 
                Array.from(clay.geometry.attributes.position.array) : undefined,
              // Don't save the actual geometry to keep localStorage small
              hasGeometry: true
            })),
            clayGroups: clayGroups.map(group => ({
              id: group.id,
              name: group.name,
              objectIds: group.objectIds,
              mainObjectId: group.mainObjectId,
              position: group.position,
              rotation: group.rotation,
              scale: group.scale
            })),
            backgroundColor,
            selectedShape,
            detail,
            currentProjectInfo,
            timestamp: new Date().toISOString()
          }
          
          localStorage.setItem('clayAutoSave', JSON.stringify(autoSaveData))
          setLastAutoSave(new Date())
          console.log('Auto-saved to localStorage')
        } catch (error) {
          console.error('Failed to auto-save:', error)
        }
      }, 2000) // 2 seconds delay
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [clayObjects, clayGroups, backgroundColor, selectedShape, detail, currentProjectInfo])
  
  // Initialize with one clay or continue from SimpleClay
  useEffect(() => {
    // First check for auto-saved data
    const autoSaveData = localStorage.getItem('clayAutoSave');
    if (autoSaveData && clayObjects.length === 0) {
      try {
        const saved = JSON.parse(autoSaveData);
        const timeDiff = new Date().getTime() - new Date(saved.timestamp).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        // Only restore if less than 24 hours old
        if (hoursDiff < 24) {
          const restoredObjects = saved.clayObjects.map((clayData: any) => {
            // Recreate geometry based on shape
            let geometry: THREE.BufferGeometry;
            
            switch (clayData.shape) {
              case 'cube':
                geometry = createDetailedGeometry('cube', clayData.size || 2, clayData.thickness || 1);
                break;
              case 'sphere':
              default:
                geometry = new THREE.SphereGeometry(clayData.size || 2, clayData.detail || detail, clayData.detail || detail);
                break;
            }
            
            // Restore deformed vertices if available
            if (clayData.vertices && clayData.vertices.length > 0) {
              const positions = new Float32Array(clayData.vertices);
              geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
              geometry.computeVertexNormals();
              geometry.userData = { deformed: true, originalShape: clayData.shape || 'sphere' };
            } else {
              geometry.userData = { deformed: false, originalShape: clayData.shape || 'sphere' };
            }
            
            return {
              ...clayData,
              geometry,
              position: new THREE.Vector3(clayData.position.x, clayData.position.y, clayData.position.z),
              rotation: clayData.rotation ? new THREE.Euler(clayData.rotation.x, clayData.rotation.y, clayData.rotation.z) : new THREE.Euler(),
              scale: typeof clayData.scale === 'object' ? (clayData.scale.x || 1) : (clayData.scale || 1)
            };
          });
          
          setClayObjects(restoredObjects);
          setBackgroundColor(saved.backgroundColor || '#f0f0f0');
          setSelectedShape(saved.selectedShape || 'sphere');
          setDetail(saved.detail || 48);
          
          // Restore groups if available
          if (saved.clayGroups && saved.clayGroups.length > 0) {
            const restoredGroups = saved.clayGroups.map((groupData: any) => ({
              ...groupData,
              position: new THREE.Vector3(groupData.position.x, groupData.position.y, groupData.position.z),
              rotation: new THREE.Euler(groupData.rotation.x, groupData.rotation.y, groupData.rotation.z),
              scale: new THREE.Vector3(groupData.scale.x, groupData.scale.y, groupData.scale.z)
            }));
            setClayGroups(restoredGroups);
          }
          
          if (saved.currentProjectInfo) {
            setCurrentProjectInfo(saved.currentProjectInfo);
          }
          
          showPopup('Auto-saved project restored', 'info');
          addToHistory(restoredObjects);
          return; // Don't check for continued data if auto-save was restored
        }
        } catch (error) {
          console.error('Failed to restore auto-save:', error);
          localStorage.removeItem('clayAutoSave');
          showPopup('Failed to restore auto-saved data. Starting fresh.', 'error');
        }
    }
    
    // Check if there's continued clay data
    const continuedData = sessionStorage.getItem('continueClayData');
    
    if (continuedData) {
      try {
        const clayData = JSON.parse(continuedData);
        sessionStorage.removeItem('continueClayData'); // Clear after use
        
        // Create geometry and apply vertex positions
        const geometry = new THREE.SphereGeometry(2, 48, 48);
        
        if (clayData.positions && clayData.positions.length > 0) {
          const positionAttribute = geometry.getAttribute('position');
          const positions = new Float32Array(clayData.positions);
          
          // Only apply if the vertex count matches
          if (positions.length === positionAttribute.array.length) {
            positionAttribute.array.set(positions);
            positionAttribute.needsUpdate = true;
            geometry.computeVertexNormals();
            geometry.userData = { deformed: true };
          }
        }
        
        const continuedClay: ClayObject = {
          id: 'clay-1',
          geometry: geometry,
          position: new THREE.Vector3(clayData.position.x, clayData.position.y, clayData.position.z),
          color: currentColor,
          shape: clayData.shape || 'sphere',
          scale: clayData.scale || 1,
          size: 2,
          detail: detail
        }
        setClayObjects([continuedClay])
        addToHistory([continuedClay])
        return;
      } catch (error) {
        console.error('Failed to load continued clay data:', error);
      }
    }
    
    // Default initialization
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    // Ensure clean userData
    geometry.userData = { deformed: false };
    
    const initialClay: ClayObject = {
      id: 'clay-1',
      geometry: geometry,
      position: new THREE.Vector3(0, 2, 0), // Start at y=2 so sphere sits on ground
      color: currentColor,
      shape: 'sphere',
      scale: 1,
      size: 2,
      detail: detail
    }
    setClayObjects([initialClay])
    addToHistory([initialClay])
  }, [])

  
  const updateClay = useCallback((updatedClay: ClayObject & { _batchUpdates?: ClayObject[] }) => {
    // Handle batch updates for group rotation
    if (updatedClay._batchUpdates) {
      setClayObjects(prev => {
        const newClays = [...prev]
        updatedClay._batchUpdates!.forEach(update => {
          const index = newClays.findIndex(c => c.id === update.id)
          if (index !== -1) {
            newClays[index] = update
          }
        })
        addToHistory(newClays)
        return newClays
      })
      return
    }
    
    setClayObjects(prev => {
      // Check if the updated clay is part of a group
      if (updatedClay.groupId) {
        const group = clayGroups.find(g => g.id === updatedClay.groupId)
        if (group) {
          const oldClay = prev.find(c => c.id === updatedClay.id)
          if (oldClay) {
            // Handle position changes
            const positionDelta = updatedClay.position.clone().sub(oldClay.position)
            
            // Handle scale changes
            const oldScale = oldClay.scale instanceof THREE.Vector3 ? oldClay.scale.x : (oldClay.scale || 1)
            const newScale = updatedClay.scale instanceof THREE.Vector3 ? updatedClay.scale.x : (updatedClay.scale || 1)
            const scaleRatio = newScale / oldScale
            
            // Apply changes to all objects in the group
            const newClays = prev.map(clay => {
              if (clay.groupId === updatedClay.groupId) {
                if (clay.id === updatedClay.id) {
                  return updatedClay
                } else {
                  // Apply position delta
                  const newPosition = clay.position.clone().add(positionDelta)
                  
                  // Apply scale ratio
                  let newScale: number | THREE.Vector3
                  if (clay.scale instanceof THREE.Vector3) {
                    newScale = clay.scale.clone().multiplyScalar(scaleRatio)
                  } else {
                    newScale = (clay.scale || 1) * scaleRatio
                  }
                  
                  return {
                    ...clay,
                    position: newPosition,
                    scale: newScale
                  }
                }
              }
              return clay
            })
            
            addToHistory(newClays)
            return newClays
          }
        }
      }
      
      // Normal update for non-grouped objects
      const newClays = prev.map(clay => 
        clay.id === updatedClay.id ? updatedClay : clay
      )
      addToHistory(newClays)
      return newClays
    })
  }, [addToHistory, clayGroups])
  
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
  
  // Group-related functions
  const createGroup = useCallback((name: string) => {
    if (selectedForGrouping.length < 2) {
      showPopup('Please select at least 2 objects to group', 'error')
      return
    }
    
    if (!mainObjectForGroup) {
      showPopup('Please select a main object for the group', 'error')
      return
    }
    
    const groupId = `group-${Date.now()}`
    const newGroup: ClayGroup = {
      id: groupId,
      name: name || `Group ${clayGroups.length + 1}`,
      objectIds: [...selectedForGrouping],
      mainObjectId: mainObjectForGroup,
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1)
    }
    
    // Update clay objects to reference the group
    setClayObjects(prev => {
      const newClays = prev.map(clay => 
        selectedForGrouping.includes(clay.id) 
          ? { ...clay, groupId } 
          : clay
      )
      addToHistory(newClays)
      return newClays
    })
    
    setClayGroups(prev => [...prev, newGroup])
    setSelectedForGrouping([])
    setMainObjectForGroup(null)
    setShowGroupingPanel(false)
    showPopup(`Created group: ${newGroup.name}`, 'success')
  }, [selectedForGrouping, mainObjectForGroup, clayGroups, addToHistory, showPopup])
  
  const ungroupObjects = useCallback((groupId: string) => {
    // Remove group reference from objects
    setClayObjects(prev => {
      const newClays = prev.map(clay => 
        clay.groupId === groupId 
          ? { ...clay, groupId: undefined } 
          : clay
      )
      addToHistory(newClays)
      return newClays
    })
    
    // Remove the group
    setClayGroups(prev => prev.filter(g => g.id !== groupId))
    showPopup('Group dissolved', 'success')
  }, [addToHistory, showPopup])
  
  const updateGroup = useCallback((groupId: string, updates: Partial<ClayGroup>) => {
    setClayGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, ...updates } 
        : group
    ))
  }, [])
  
  const toggleObjectForGrouping = useCallback((clayId: string) => {
    setSelectedForGrouping(prev => {
      const newSelection = prev.includes(clayId) 
        ? prev.filter(id => id !== clayId)
        : [...prev, clayId]
      
      // If this is the first object selected, make it the main object
      if (newSelection.length === 1 && !prev.includes(clayId)) {
        setMainObjectForGroup(clayId)
      }
      // If we're removing the main object, clear it
      else if (mainObjectForGroup === clayId && prev.includes(clayId)) {
        setMainObjectForGroup(newSelection.length > 0 ? newSelection[0] : null)
      }
      
      return newSelection
    })
  }, [mainObjectForGroup])
  
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
      
      case 'freehand':
        if (controlPoints && controlPoints.length > 1) {
          // Create a path from freehand points
          const relativeCurves: THREE.Curve<THREE.Vector3>[] = []
          for (let i = 0; i < controlPoints.length - 1; i++) {
            const relativeP1 = controlPoints[i].clone().sub(position)
            const relativeP2 = controlPoints[i + 1].clone().sub(position)
            relativeCurves.push(new THREE.LineCurve3(relativeP1, relativeP2))
          }
          const path = new THREE.CurvePath<THREE.Vector3>()
          relativeCurves.forEach(curve => path.add(curve))
          geometry = new THREE.TubeGeometry(path, controlPoints.length * 2, thickness, 8, false)
        } else {
          // Fallback to a simple line
          geometry = new THREE.CylinderGeometry(thickness, thickness, size, 8)
        }
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
    geometry.userData = { 
      deformed: false,
      originalShape: selectedShape || 'sphere'
    };
    
    const newClay: ClayObject = {
      id: `clay-${Date.now()}`,
      geometry: geometry,
      position: position,
      color: currentColor,
      shape: selectedShape,
      rotation: rotation,
      scale: 1,
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

  const handleSaveProject = async (projectName: string, saveAs: boolean = false, onProgress?: (status: string) => void) => {
    if (!walletAddress) {
      showPopup('Please connect your wallet first', 'warning')
      return
    }
    

    console.log('[Save] Entering handleSaveProject function')
    
    try {
      console.log('[Save] Inside try block')
      console.log('Saving project:', projectName, 'saveAs:', saveAs)
      console.log('Clay objects:', clayObjects)
      console.log('First clay object structure:', clayObjects[0])
      console.log('[Save] Step 1: Starting save process...')
      
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
      
      console.log('[Save] Step 2: Starting serialization...')
      console.log('[Save] About to call serializeClayProject with:', {
        clayObjectsCount: clayObjects.length,
        projectName,
        walletAddress,
        backgroundColor
      })
      
      // Step 1: Serialize the clay objects
      let serialized;
      try {
        serialized = serializeClayProject(
          clayObjects,
          projectName,
          '', // description
          walletAddress,
          [], // tags
          backgroundColor,
          clayGroups
        )
        console.log('[Save] serializeClayProject returned successfully')
      } catch (serializeError) {
        console.error('[Save] ERROR in serializeClayProject:', serializeError)
        showPopup('Failed to serialize project data', 'error')
        return
      }
      
      serialized.id = projectId; // Ensure project has the correct ID
      
      let projectSize = 0;
      try {
        console.log('[Save] Attempting to stringify serialized project...')
        const projectString = JSON.stringify(serialized);
        projectSize = projectString.length;
        console.log('[Save] Step 3: Serialization complete, project size:', projectSize, 'bytes')
      } catch (stringifyError) {
        console.error('[Save] ERROR stringifying project:', stringifyError)
        showPopup('Failed to convert project to JSON', 'error')
        return
      }
      
      // Capture thumbnail
      let thumbnailId: string | undefined = undefined;
      
      // Step 1: Capture thumbnail first
      console.log('[Save] Step 4: Capturing thumbnail...')
      onProgress?.('Capturing thumbnail...')
      
      // Reset previous thumbnail
      setCapturedThumbnail(null);
      
      // Request thumbnail capture and wait for it
      const thumbnailDataUrl = await new Promise<string>((resolve) => {
        // Store the resolve function
        thumbnailResolveRef.current = resolve;
        
        // Request capture
        setCaptureRequested(true);
        
        // Set up timeout
        setTimeout(() => {
          if (thumbnailResolveRef.current === resolve) {
            console.warn('[Save] Thumbnail capture timeout after 10 seconds');
            thumbnailResolveRef.current = null;
            setCaptureRequested(false);
            resolve('');
          }
        }, 10000);
      });
      
      // Step 2: Upload thumbnail if captured successfully
      if (thumbnailDataUrl && thumbnailDataUrl !== '') {
        try {
          console.log('[Save] Step 5: Uploading thumbnail...');
          console.log('[Save] Thumbnail data URL length:', thumbnailDataUrl.length);
          onProgress?.('Uploading thumbnail...')
          const result = await uploadProjectThumbnail(
            thumbnailDataUrl,
            projectId
          );
          thumbnailId = result || undefined;
          console.log('[Save] Step 6: Thumbnail uploaded:', thumbnailId);
        } catch (error) {
          console.error('[Save] Failed to upload thumbnail:', error);
          // Continue without thumbnail
        }
      } else {
        console.log('[Save] Step 5: No thumbnail captured - dataUrl is empty or null')
        console.log('[Save] thumbnailDataUrl value:', thumbnailDataUrl)
      }
      
      // Check project size
      const jsonString = JSON.stringify(serialized);
      const sizeInKB = Buffer.from(jsonString).byteLength / 1024;
      console.log(`Project size: ${sizeInKB.toFixed(2)} KB`);
      

      // Step 2: Pay service fee via smart contract first (only for new projects or save as)
      // Skip payment for projects under 90KB as they are free
      const isNewProject = !rootTxId || saveAs;
      const requiresPayment = isNewProject && sizeInKB >= 90;
      
      if (requiresPayment) {
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
            throw new Error('No wallet provider found. Please install MetaMask, OKX Wallet, or another Ethereum wallet.');
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
            throw new Error('Failed to connect wallet. Please try again.');
            return;
          }
          
          console.log('Paying service fee via smart contract...')
          onProgress?.('Paying 0.1 IRYS...')
          const paymentTx = await payForUpload(provider)
          console.log('Service fee payment transaction:', paymentTx)
          onProgress?.('Payment completed!')
        } catch (error: any) {
          console.error('Service fee payment failed:', error)
          if (error?.message?.includes('User rejected')) {
            // User cancelled - just return without showing popup
            return
          } else if (error?.message?.includes('Not connected to Irys testnet')) {
            throw new Error('Please switch to Irys testnet network in your wallet.')
            return
          } else if (error?.message?.includes('Insufficient funds')) {
            throw new Error('Insufficient funds. 0.1 IRYS required.')
            return
          } else {
            throw new Error('Payment failed. Need 0.1 IRYS.')
            return
          }
        }
      } else {
        console.log('Updating existing project - no service fee required');
      }

      // Step 3: Upload to Irys (no payment needed for free tier)
      console.log('[Save] Step 9: Starting Irys upload...')
      onProgress?.('Uploading project to Irys...')
      console.log('[Save] Step 10: Upload parameters:', {
        projectId: serialized.id,
        currentFolder,
        rootTxId,
        thumbnailId,
        dataSize: JSON.stringify(serialized).length
      })
      
      let uploadResult;
      try {
        console.log('[Save] Step 11: Calling uploadClayProject...')
        uploadResult = await uploadClayProject(
          serialized,
          currentFolder,
          rootTxId,
          (progress: ChunkProgressType) => {
            console.log('[Save] Upload progress:', progress)
            const percent = Math.round(progress.percentage)
            onProgress?.(`Uploading chunks... ${percent}%`)
          },
          thumbnailId
        )
        console.log('[Save] Step 12: Upload completed, result:', uploadResult)
      } catch (uploadError: any) {
        console.error('[Save] Step 12 ERROR: Irys upload failed:', uploadError)
        throw new Error('Failed to upload project to Irys. Please try again.')
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
      
      onProgress?.('Project saved successfully!')
      
      // Clear auto-save data after successful save
      localStorage.removeItem('clayAutoSave')
      
      // Clear cache to refresh projects list
      queryCache.delete(`projects-${walletAddress}`)
      
      // Refresh folder structure to show new project
      folderStructureRef.current?.refreshProjects()
    } catch (error: any) {
      console.error('Failed to save project:', error)
      if (error?.message?.includes('User rejected')) {
        // Transaction cancelled by user
      } else if (error?.message?.includes('Insufficient balance')) {
        throw new Error('Insufficient balance. Your project is over 100KB and requires IRYS tokens.')
      } else if (error?.message?.includes('over 100KB')) {
        throw new Error('Project size exceeds 100KB free tier. Payment is required.')
      } else {
        throw new Error('Failed to save project. Please try again.')
      }
    }
  }

  const handleProjectSelect = async (projectId: string) => {
    try {
      console.log('Loading project:', projectId)
      
      // Initial loading message
      let projectName = 'Loading project...';
      
      // Download project from Irys with progress callback
      const project = await downloadClayProject(projectId, (progress) => {
        setChunkDownloadProgress({
          ...progress,
          isOpen: true,
          projectName: projectName
        });
      })
      console.log('Downloaded project:', project)
      
      // Update with actual project name
      projectName = project.name || 'Untitled';
      setChunkDownloadProgress(prev => ({ ...prev, projectName: `Loading ${projectName} project` }))
      
      // Get mutable reference info
      const mutableRef = getMutableReference(project.id);
      
      // Restore clay objects
      const restoredObjects = restoreClayObjects(project, detail)
      console.log('Restored objects:', restoredObjects)
      
      // Clear current objects and set new ones
      setClayObjects(restoredObjects)
      
      // Restore groups if present
      if (project.groups && project.groups.length > 0) {
        const restoredGroups = project.groups.map(group => ({
          ...group,
          position: new THREE.Vector3(group.position.x, group.position.y, group.position.z),
          rotation: new THREE.Euler(group.rotation.x, group.rotation.y, group.rotation.z),
          scale: new THREE.Vector3(group.scale.x, group.scale.y, group.scale.z)
        }))
        setClayGroups(restoredGroups)
        console.log('Restored groups:', restoredGroups)
      } else {
        setClayGroups([])
      }
      
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
      if (!walletAddress) {
        showPopup('Please connect your wallet first', 'warning')
        return
      }
      
      console.log('Deleting project:', projectId)
      
      // Upload deletion marker
      const deletionId = await deleteClayProject(projectId, walletAddress)
      console.log('Deletion marker created:', deletionId)
      
      // Clear cache to refresh list
      queryCache.delete(`projects-${walletAddress}`)
      
      showPopup('Project deleted successfully!', 'success')
    } catch (error) {
      console.error('Failed to delete project:', error)
      showPopup('Failed to delete project. Please try again.', 'error')
    }
  }

  const handleProjectRename = async (projectId: string, newName: string) => {
    try {
      if (!walletAddress) {
        showPopup('Please connect your wallet first', 'warning')
        return
      }
      
      console.log('Renaming project:', projectId, 'to', newName)
      
      // If this is the current project, update its name and save
      if (currentProjectInfo && currentProjectInfo.projectId === projectId) {
        await handleSaveProject(newName, false);
        showPopup('Project renamed successfully!', 'success');
      } else {
        // For other projects, we need to load, rename, and save
        showPopup('Please open the project to rename it', 'info');
      }
    } catch (error) {
      console.error('Failed to rename project:', error)
      showPopup('Failed to rename project. Please try again.', 'error')
    }
  }

  const handleFolderCreate = (folderPath: string) => {
    // Create folder (update projects with new folder)
    console.log('Creating folder:', folderPath)
  }

  const handleFolderDelete = async (folderPath: string) => {
    if (!walletAddress) {
      showPopup('Please connect your wallet first', 'warning')
      return
    }
    
    console.log('Deleting folder and its contents:', folderPath)
    
    try {
      // Get all projects to find ones in this folder
      const cachedProjects = queryCache.get(`projects-${walletAddress}`)
      
      if (cachedProjects && Array.isArray(cachedProjects)) {
        const projectsToDelete: string[] = []
        
        // Find all projects in this folder and subfolders
        cachedProjects.forEach((project: any) => {
          const projectFolder = project.folderPath || '/'
          
          // Check if project is in this folder or any subfolder
          if (projectFolder === folderPath || 
              (projectFolder.startsWith(folderPath + '/') && folderPath !== '/')) {
            // Use the actual project ID from tags, not the transaction ID
            const actualProjectId = project.tags?.['Project-ID'] || project.projectId || project.id
            projectsToDelete.push(actualProjectId)
          }
        })
        
        console.log(`Found ${projectsToDelete.length} projects to delete in folder ${folderPath}`)
        
        // Delete all projects in the folder
        for (const projectId of projectsToDelete) {
          try {
            await deleteClayProject(projectId, walletAddress)
            console.log(`Deleted project: ${projectId}`)
          } catch (error) {
            console.error(`Failed to delete project ${projectId}:`, error)
          }
        }
        
        // Clear cache to refresh list
        queryCache.delete(`projects-${walletAddress}`)
        
        if (projectsToDelete.length > 0) {
          showPopup(`Folder and ${projectsToDelete.length} project(s) deleted successfully!`, 'success')
        } else {
          showPopup('Folder deleted successfully!', 'success')
        }
      }
    } catch (error) {
      console.error('Failed to delete folder contents:', error)
      showPopup('Failed to delete folder contents. Please try again.', 'error')
    }
  }

  const handleExportGLB = async () => {
    setExportProjectName(currentProjectInfo?.name || 'clay-project')
    setShowExportModal(true)
  }
  
  const handleExportConfirm = async () => {
    const projectName = exportProjectName.trim()
    if (!projectName) return

    try {
      await downloadAsGLB(clayObjects, projectName, {
        author: walletAddress || 'Anonymous',
        description: 'Created with GetClayed'
      })
      showPopup('GLB file exported successfully', 'success')
    } catch (error) {
      console.error('Failed to export GLB:', error)
      showPopup('Failed to export GLB file', 'error')
    }
    
    setShowExportModal(false)
    setExportProjectName('')
  }
  
  const handleNewFile = () => {
    // Always show confirmation if there are any clay objects
    if (clayObjects.length > 0 || currentProjectInfo?.isDirty) {
      setShowNewFileModal(true)
      return
    }
    createNewFile()
  }
  
  const createNewFile = () => {
    
    // Reset to initial state
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    geometry.userData = { deformed: false };
    
    const initialClay: ClayObject = {
      id: 'clay-1',
      geometry: geometry,
      position: new THREE.Vector3(0, 2, 0),
      color: currentColor,
      shape: 'sphere',
      scale: 1,
      size: 2,
      detail: detail
    }
    
    setClayObjects([initialClay])
    addToHistory([initialClay])
    setCurrentProjectInfo(null)
    setCurrentProject(null)
    setBackgroundColor('#f0f0f0')
    setCurrentFolder('')
    setShowNewFileModal(false)
    showPopup('New project created', 'success')
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
      // Don't handle keyboard events when typing in input fields
      const activeElement = document.activeElement
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return
      }
      
      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
      
      // Copy/Cut/Paste objects - use separate if statements instead of else-if
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedClayId) {
        e.preventDefault()
        const selectedClay = clayObjects.find(c => c.id === selectedClayId)
        if (selectedClay) {
          // If group is selected, copy the first object of the group (paste will copy whole group)
          if (selectedGroupId && selectedClay.groupId === selectedGroupId) {
            showPopup('Group copied', 'success')
            console.log('[Clipboard] Copied group:', selectedGroupId)
          } else {
            showPopup('Object copied', 'success')
            console.log('[Clipboard] Copied object:', selectedClay.id)
          }
          clipboardRef.current = { clay: selectedClay, mode: 'copy' }
        }
        return
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'x' && selectedClayId) {
        e.preventDefault()
        const selectedClay = clayObjects.find(c => c.id === selectedClayId)
        if (selectedClay) {
          clipboardRef.current = { clay: selectedClay, mode: 'cut' }
          
          // If group is selected, remove the entire group
          if (selectedGroupId && selectedClay.groupId === selectedGroupId) {
            const newClays = clayObjects.filter(c => c.groupId !== selectedGroupId)
            setClayObjects(newClays)
            setClayGroups(prev => prev.filter(g => g.id !== selectedGroupId))
            addToHistory(newClays)
            setSelectedClayId(null)
            setSelectedGroupId(null)
            showPopup('Group cut', 'success')
            console.log('[Clipboard] Cut group:', selectedGroupId)
          } else {
            // Remove single object
            const newClays = clayObjects.filter(c => c.id !== selectedClayId)
            setClayObjects(newClays)
            addToHistory(newClays)
            setSelectedClayId(null)
            showPopup('Object cut', 'success')
            console.log('[Clipboard] Cut object:', selectedClay.id)
          }
        }
        return
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        console.log('[Clipboard] Paste key pressed, clipboardClay:', clipboardRef.current.clay?.id, 'mode:', clipboardRef.current.mode)
        
        if (clipboardRef.current.clay) {
          e.preventDefault()
          
          const originalClay = clipboardRef.current.clay
          
          // Check if this object is part of a group
          if (originalClay.groupId) {
            const group = clayGroups.find(g => g.id === originalClay.groupId)
            if (group) {
              // Copy the entire group
              const groupObjects = clayObjects.filter(c => c.groupId === originalClay.groupId)
              const newGroupId = `group-${Date.now()}`
              const offset = new THREE.Vector3(0.5, 0, 0.5)
              
              const newGroupObjects = groupObjects.map(obj => {
                const clonedGeometry = obj.geometry.clone()
                return {
                  ...obj,
                  id: `clay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  geometry: clonedGeometry,
                  position: new THREE.Vector3(
                    obj.position.x + offset.x,
                    obj.position.y + offset.y,
                    obj.position.z + offset.z
                  ),
                  rotation: obj.rotation ? new THREE.Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z) : new THREE.Euler(),
                  scale: obj.scale instanceof THREE.Vector3 
                    ? new THREE.Vector3(obj.scale.x, obj.scale.y, obj.scale.z)
                    : obj.scale,
                  groupId: newGroupId
                }
              })
              
              // Create new group
              const newGroup: ClayGroup = {
                id: newGroupId,
                name: group.name ? `${group.name} (copy)` : `Group ${clayGroups.length + 1}`,
                objectIds: newGroupObjects.map(obj => obj.id),
                mainObjectId: newGroupObjects.find(obj => obj.id.includes(group.objectIds.indexOf(group.mainObjectId).toString()))?.id || newGroupObjects[0].id,
                position: new THREE.Vector3(group.position.x + offset.x, group.position.y + offset.y, group.position.z + offset.z),
                rotation: new THREE.Euler(group.rotation.x, group.rotation.y, group.rotation.z),
                scale: new THREE.Vector3(group.scale.x, group.scale.y, group.scale.z)
              }
              
              const newClays = [...clayObjects, ...newGroupObjects]
              setClayObjects(newClays)
              setClayGroups(prev => [...prev, newGroup])
              addToHistory(newClays)
              setSelectedClayId(newGroupObjects[0].id)
              showPopup('Group pasted', 'success')
              console.log('[Clipboard] Pasted group with', newGroupObjects.length, 'objects')
            }
          } else {
            // Copy single object
            const clonedGeometry = originalClay.geometry.clone()
            
            const newClay: ClayObject = {
              ...originalClay,
              id: `clay-${Date.now()}`,
              geometry: clonedGeometry,
              position: new THREE.Vector3(
                originalClay.position.x + 0.5,
                originalClay.position.y,
                originalClay.position.z + 0.5
              ),
              rotation: originalClay.rotation ? new THREE.Euler(
                originalClay.rotation.x,
                originalClay.rotation.y,
                originalClay.rotation.z
              ) : new THREE.Euler(),
              scale: originalClay.scale instanceof THREE.Vector3 
                ? new THREE.Vector3(originalClay.scale.x, originalClay.scale.y, originalClay.scale.z)
                : originalClay.scale,
              groupId: undefined
            }
            
            const newClays = [...clayObjects, newClay]
            setClayObjects(newClays)
            addToHistory(newClays)
            setSelectedClayId(newClay.id)
            showPopup('Object pasted', 'success')
            console.log('[Clipboard] Pasted new object:', newClay.id)
          }
          
          // Clear clipboard if it was cut
          if (clipboardRef.current.mode === 'cut') {
            clipboardRef.current = { clay: null, mode: null }
          }
        } else {
          console.log('[Clipboard] No object in clipboard to paste')
        }
        return
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
          ref={folderStructureRef}
          walletAddress={walletAddress}
          onProjectSelect={handleProjectSelect}
          onProjectMove={handleProjectMove}
          onProjectDelete={handleProjectDelete}
          onFolderCreate={handleFolderCreate}
          onFolderDelete={handleFolderDelete}
          onProjectRename={handleProjectRename}
          currentFolder={currentFolder}
          onFolderChange={(folderPath) => setCurrentFolder(folderPath)}
        />
      )}
      
      {/* Main content area with Canvas */}
      <div 
        className="flex-1 relative overflow-hidden" 
        style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        onContextMenu={(e) => {
          e.preventDefault()
          console.log('[ContextMenu] Div right-clicked, target:', (e.target as HTMLElement).tagName)
          // Only show menu if not clicking on an object
          const target = e.target as HTMLElement
          if (target.tagName === 'CANVAS') {
            console.log('[ContextMenu] Canvas right-clicked, showing menu')
            setContextMenu({ x: e.clientX, y: e.clientY, clayId: null })
          }
        }}
      >
        <Canvas 
        camera={{ position: [5, 5, 5], fov: 50 }}
        style={{ touchAction: 'none', backgroundColor: backgroundColor }}
        className="w-full h-full"
        onContextMenu={(e) => e.preventDefault()}
      >
        <Suspense fallback={null}>
          {/* Set scene background color */}
          <SceneBackground color={backgroundColor} />
          
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
          {clayObjects.map(clay => {
            // Check if this clay is part of a group that contains the selected clay
            const selectedClay = clayObjects.find(c => c.id === selectedClayId)
            const isGroupHighlighted = !!(
              selectedClay?.groupId && 
              clay.groupId === selectedClay.groupId &&
              (tool === 'move' || tool === 'resize' || tool === 'rotateObject')
            )
            
            return (
              <group key={clay.id}>
                <Clay
                  clay={clay}
                  tool={tool}
                  brushSize={brushSize}
                  currentColor={currentColor}
                  onUpdate={updateClay}
                  onDeformingChange={setIsDeforming}
                  isSelected={selectedClayId === clay.id}
                  onSelect={() => {
                    // Group-first selection mechanism
                    if (clay.groupId) {
                      // If group is not selected, select the group first
                      if (selectedGroupId !== clay.groupId) {
                        setSelectedGroupId(clay.groupId)
                        setSelectedClayId(clay.id) // Also set clay ID for operations
                      } else {
                        // Group already selected, now select individual object
                        setSelectedClayId(clay.id)
                      }
                    } else {
                      // No group, just select the object
                      setSelectedGroupId(null)
                      setSelectedClayId(clay.id)
                    }
                  }}
                  onDelete={() => removeClay(clay.id)}
                  onContextMenu={(e: React.MouseEvent, clayId: string) => {
                    e.preventDefault()
                    setContextMenu({ x: e.clientX, y: e.clientY, clayId })
                    setSelectedClayId(clayId)
                  }}
                  isHovered={hoveredClayId === clay.id}
                  onHover={() => setHoveredClayId(clay.id)}
                  onHoverEnd={() => {
                    setHoveredClayId(null)
                    setHoveredPoint(null)
                  }}
                  onBrushHover={setHoveredPoint}
                  selectedForGrouping={selectedForGrouping}
                  showGroupingPanel={showGroupingPanel}
                  toggleObjectForGrouping={toggleObjectForGrouping}
                  isGroupHighlighted={isGroupHighlighted}
                  clayGroups={clayGroups}
                  clayObjects={clayObjects}
                />
              </group>
            )
          })}
          
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
              isCapturing={captureRequested}
            />
          )}
          
          <Environment preset="studio" />
          
          {/* Thumbnail capture component */}
          <ThumbnailCapture 
            captureRequested={captureRequested}
            onCapture={(dataUrl) => {
              setCapturedThumbnail(dataUrl)
              setCaptureRequested(false)
              // Resolve the promise if waiting
              if (thumbnailResolveRef.current) {
                thumbnailResolveRef.current(dataUrl)
                thumbnailResolveRef.current = null
              }
            }}
          />
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
            {/* Profile Button - Only show when wallet is connected */}
            {walletAddress && (
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
                        setShowProfileMenu(false)
                        // Check if user has display name
                        const profile = await downloadUserProfile(walletAddress)
                        if (profile?.displayName) {
                          router.push(`/user/${profile.displayName}`)
                        } else {
                          router.push(`/user/${walletAddress}`)
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
            )}
            
            <ConnectWallet 
              onConnect={async (address) => {
                setWalletAddress(address)
              }}
              onDisconnect={() => {
                setWalletAddress(null)
              }}
            />
            
          </div>
          
          {/* Center - Main tools */}
          <div className="flex items-center justify-center gap-2">
          {/* Main Tools */}
          <div className="flex gap-2 bg-gray-100 rounded-lg p-2">
            <button
              ref={(el) => { toolButtonsRef.current['rotate'] = el }}
              data-tool="rotate"
              onClick={() => {
                setTool('rotate')
                if (tool === 'group') setShowGroupingPanel(false)
              }}
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
                ref={(el) => { toolButtonsRef.current['rotateObject'] = el }}
                onClick={() => {
                  setTool('rotateObject')
                  if (tool === 'group') setShowGroupingPanel(false)
                }}
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
                ref={(el) => { toolButtonsRef.current['resize'] = el }}
                onClick={() => {
                  setTool('resize')
                  if (tool === 'group') setShowGroupingPanel(false)
                }}
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
              ref={(el) => { toolButtonsRef.current['push'] = el }}
              onClick={() => {
                setTool('push')
                if (tool === 'group') setShowGroupingPanel(false)
              }}
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
              ref={(el) => { toolButtonsRef.current['paint'] = el }}
              onClick={() => {
                setTool('paint')
                if (tool === 'group') setShowGroupingPanel(false)
              }}
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
              ref={(el) => { toolButtonsRef.current['add'] = el }}
              onClick={() => {
                setTool('add')
                if (tool === 'group') setShowGroupingPanel(false)
              }}
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
              ref={(el) => { toolButtonsRef.current['move'] = el }}
              onClick={() => {
                setTool('move')
                if (tool === 'group') setShowGroupingPanel(false)
              }}
              className={`p-3 rounded-lg transition-all ${
                tool === 'move' 
                  ? 'bg-gray-800 text-white shadow-md' 
                  : 'bg-white hover:bg-gray-50 text-gray-700'
              }`}
              title="Move Clay"
            >
              <Move size={18} />
            </button>
            <button
              ref={(el) => { toolButtonsRef.current['group'] = el }}
              onClick={() => {
                if (tool === 'group') {
                  setTool('rotate')
                  setShowGroupingPanel(false)
                  setSelectedForGrouping([])
                  setMainObjectForGroup(null)
                } else {
                  setTool('group')
                  setShowGroupingPanel(true)
                }
              }}
              className={`p-3 rounded-lg transition-all ${
                tool === 'group' 
                  ? 'bg-gray-800 text-white shadow-md' 
                  : 'bg-white hover:bg-gray-50 text-gray-700'
              }`}
              title="Group Objects"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <path d="M10 6.5h4M10 17.5h4M6.5 10v4M17.5 10v4" />
              </svg>
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
            ref={(el) => { toolButtonsRef.current['delete'] = el }}
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
          
          {/* Help Guide Button */}
          <button
            onClick={() => {
              setShowGuide(!showGuide)
              setGuideStep(0)
            }}
            className={`p-3 rounded-lg transition-all ${
              showGuide 
                ? 'bg-blue-500 text-white' 
                : 'bg-white hover:bg-gray-50 text-gray-700'
            }`}
            title="Tool Guide"
          >
            <HelpCircle size={20} />
          </button>
          
          {/* Export GLB Button */}
          <button
            onClick={handleExportGLB}
            className="p-3 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-all"
            title="Export as GLB"
          >
            <Download size={20} />
          </button>
        </div>
            {/* Right side - Auto-save indicator */}
            <div className="flex items-center">
              {lastAutoSave && (
                <div className="text-xs text-gray-500">
                  Saved {Math.floor((new Date().getTime() - lastAutoSave.getTime()) / 60000)}m ago
                </div>
              )}
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
          
          {tool === 'paint' && !showGroupingPanel && (
            <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-center gap-2">
              {[
                '#ff6b6b', '#ffd93d', '#6bcf7f', '#4dabf7',
                '#f783ac', '#ffd43b', '#51cf66', '#339af0'
              ].map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setCurrentColor(color)
                    // If an object is selected, apply color immediately
                    if (selectedClayId) {
                      const selectedClay = clayObjects.find(c => c.id === selectedClayId)
                      if (selectedClay) {
                        updateClay({ ...selectedClay, color })
                        showPopup('Color applied', 'success')
                      }
                    }
                  }}
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
              <div className="w-px h-8 bg-gray-300 mx-1" />
              {/* Background color button */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">BG:</span>
                <label className="relative cursor-pointer group">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="sr-only"
                  />
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-gray-300 group-hover:border-gray-500 transition-all shadow-sm"
                    style={{ backgroundColor }}
                    title="Background Color"
                  />
                </label>
              </div>
            </div>
          )}
          
          {tool === 'add' && !showGroupingPanel && (
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
                    <button
                      onClick={() => setSelectedShape('freehand')}
                      className={`p-2 rounded-lg transition-all ${
                        selectedShape === 'freehand'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                      title="Freehand Draw"
                    >
                      <PenTool size={16} />
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
          
          {/* Move Tool Panel */}
          {tool === 'move' && selectedClayId && !showGroupingPanel && (
            <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-center gap-4">
              <span className="text-sm text-gray-600">Position:</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 w-4">X:</span>
                  <input
                    type="number"
                    value={clayObjects.find(c => c.id === selectedClayId)?.position.x.toFixed(2) || 0}
                    onChange={(e) => {
                      const clay = clayObjects.find(c => c.id === selectedClayId)
                      if (clay) {
                        const newPosition = clay.position.clone()
                        newPosition.x = parseFloat(e.target.value) || 0
                        updateClay({ ...clay, position: newPosition })
                      }
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.1"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 w-4">Y:</span>
                  <input
                    type="number"
                    value={clayObjects.find(c => c.id === selectedClayId)?.position.y.toFixed(2) || 0}
                    onChange={(e) => {
                      const clay = clayObjects.find(c => c.id === selectedClayId)
                      if (clay) {
                        const newPosition = clay.position.clone()
                        newPosition.y = parseFloat(e.target.value) || 0
                        updateClay({ ...clay, position: newPosition })
                      }
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.1"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 w-4">Z:</span>
                  <input
                    type="number"
                    value={clayObjects.find(c => c.id === selectedClayId)?.position.z.toFixed(2) || 0}
                    onChange={(e) => {
                      const clay = clayObjects.find(c => c.id === selectedClayId)
                      if (clay) {
                        const newPosition = clay.position.clone()
                        newPosition.z = parseFloat(e.target.value) || 0
                        updateClay({ ...clay, position: newPosition })
                      }
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.1"
                  />
                </label>
              </div>
              <div className="w-px h-8 bg-gray-300" />
              <span className="text-xs text-gray-500">Use arrow keys or drag in 3D view</span>
            </div>
          )}
          
          {/* Grouping Panel */}
          {showGroupingPanel && (
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-center gap-6">
              {/* Shape selection - minimal design */}
              <div className="flex items-center gap-3">
                {clayObjects.filter(clay => !clay.groupId).map((clay, index) => {
                  const isSelected = selectedForGrouping.includes(clay.id)
                  const isMainObject = mainObjectForGroup === clay.id
                  return (
                    <div
                      key={clay.id}
                      className="flex flex-col items-center gap-2"
                    >
                      <button
                        onClick={() => toggleObjectForGrouping(clay.id)}
                        className={`relative transition-all ${
                          isSelected ? 'scale-110' : 'hover:scale-105'
                        }`}
                        title={`Select object ${index + 1}`}
                      >
                        <div 
                          className={`w-10 h-10 rounded-full border-2 transition-all ${
                            isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-300'
                          }`}
                          style={{ 
                            backgroundColor: clay.color,
                          }}
                        />
                        {isSelected && (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                        )}
                      </button>
                      {isSelected && (
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={isMainObject}
                            onChange={() => {
                              if (!isMainObject) {
                                setMainObjectForGroup(clay.id)
                              }
                            }}
                            className="w-3 h-3"
                          />
                          <span>Main</span>
                        </label>
                      )}
                    </div>
                  )
                })}
                {clayObjects.filter(clay => !clay.groupId).length === 0 && (
                  <span className="text-sm text-gray-400">No ungrouped objects</span>
                )}
              </div>
              
              {/* Group controls */}
              {selectedForGrouping.length >= 2 && mainObjectForGroup && (
                <>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Group name (optional)"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          createGroup((e.target as HTMLInputElement).value)
                        }
                      }}
                    />
                    <button
                      onClick={() => createGroup('')}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all"
                    >
                      Create Group
                    </button>
                  </div>
                </>
              )}
              
              {/* Existing groups */}
              {clayGroups.length > 0 && (
                <>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Groups:</span>
                    {clayGroups.map((group, index) => (
                      <button
                        key={group.id}
                        onClick={() => ungroupObjects(group.id)}
                        className="group flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-all"
                        title="Click to ungroup"
                      >
                        <span className="text-gray-700">{group.name || `Group ${index + 1}`}</span>
                        <span className="text-gray-400 group-hover:text-gray-600 text-xs">×</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Coordinate Display Overlay - moved inside Canvas container */}
      
      {/* Export GLB Modal */}
      {showExportModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 pointer-events-auto">
            <h3 className="text-lg font-semibold mb-4">Export as GLB</h3>
            <input
              type="text"
              value={exportProjectName}
              onChange={(e) => setExportProjectName(e.target.value)}
              placeholder="Enter project name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && exportProjectName.trim()) {
                  handleExportConfirm();
                } else if (e.key === 'Escape') {
                  setShowExportModal(false);
                  setExportProjectName('');
                }
              }}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportProjectName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleExportConfirm}
                disabled={!exportProjectName.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* New File Confirmation Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 pointer-events-auto">
            <h3 className="text-lg font-semibold mb-4">Create New Project?</h3>
            <p className="text-gray-600 mb-6">
              Creating a new project will reset all current work. Are you sure you want to continue?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowNewFileModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={createNewFile}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Create New
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-[10001]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.clayId ? (
            <>
              <button
                onClick={() => {
                  const clay = clayObjects.find(c => c.id === contextMenu.clayId)
                  if (clay) {
                    clipboardRef.current = { clay, mode: 'copy' }
                    showPopup('Object copied', 'success')
                  }
                  setContextMenu(null)
                }}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 w-full text-left text-sm"
              >
                Copy
              </button>
              <button
                onClick={() => {
                  const clay = clayObjects.find(c => c.id === contextMenu.clayId)
                  if (clay) {
                    clipboardRef.current = { clay, mode: 'cut' }
                    const newClays = clayObjects.filter(c => c.id !== contextMenu.clayId)
                    setClayObjects(newClays)
                    addToHistory(newClays)
                    setSelectedClayId(null)
                    showPopup('Object cut', 'success')
                  }
                  setContextMenu(null)
                }}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 w-full text-left text-sm"
              >
                Cut
              </button>
              <div className="border-t border-gray-200 my-1" />
              <button
                onClick={() => {
                  removeClay(contextMenu.clayId!)
                  setContextMenu(null)
                }}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 w-full text-left text-sm text-red-600"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              {clipboardRef.current.clay && (
                <button
                  onClick={() => {
                    // Trigger paste
                    const event = new KeyboardEvent('keydown', {
                      key: 'v',
                      metaKey: true,
                      bubbles: true
                    })
                    window.dispatchEvent(event)
                    setContextMenu(null)
                  }}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 w-full text-left text-sm"
                >
                  Paste
                </button>
              )}
              <button
                onClick={() => {
                  setTool('add')
                  setContextMenu(null)
                }}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 w-full text-left text-sm"
              >
                Add Shape
              </button>
            </>
          )}
        </div>
      )}
      
      {/* Tool Guide Tooltip */}
      {showGuide && (() => {
        const currentTool = toolGuides[guideStep].tool
        const buttonElement = toolButtonsRef.current[currentTool]
        
        let tooltipStyle: React.CSSProperties = {
          bottom: '8rem',
          left: '50%',
          transform: 'translateX(-50%)'
        }
        
        if (buttonElement) {
          const rect = buttonElement.getBoundingClientRect()
          tooltipStyle = {
            position: 'fixed',
            left: `${rect.left + rect.width / 2}px`,
            bottom: `${window.innerHeight - rect.top + 10}px`,
            transform: 'translateX(-50%)'
          }
        }
        
        return (
          <div className="fixed inset-0 z-[10000] pointer-events-none">
            <div style={tooltipStyle} className="absolute pointer-events-auto">
              <div className="bg-white rounded-lg shadow-xl border-2 border-blue-500 p-4 min-w-[280px]">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{toolGuides[guideStep].title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{toolGuides[guideStep].description}</p>
                  </div>
                  <button
                    onClick={skipGuide}
                    className="p-1 hover:bg-gray-100 rounded transition-colors ml-2"
                    title="Close guide"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                  <button
                    onClick={prevGuideStep}
                    disabled={guideStep === 0}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Before
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {guideStep + 1} / {toolGuides.length}
                    </span>
                    <button
                      onClick={nextGuideStep}
                      className="px-4 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                    >
                      {guideStep === toolGuides.length - 1 ? 'Done' : 'Next'}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Arrow pointing to button */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-blue-500 transform rotate-45"></div>
            </div>
          </div>
        )
      })()}
      
    </div>
  )
}
