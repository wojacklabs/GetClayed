'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Grid } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense, useMemo } from 'react'
import * as THREE from 'three'

interface ClayPoint {
  position: THREE.Vector3
  velocity: THREE.Vector3
  isPinned: boolean
  originalNeighbors: string[]
}

interface ClayBlob {
  id: string
  points: Map<string, ClayPoint>
  connections: Array<[string, string]>
  color: string
  centerPosition: THREE.Vector3
}

function ClayMesh({ blob, onUpdate, tool, currentColor }: {
  blob: ClayBlob
  onUpdate: (blob: ClayBlob) => void
  tool: string
  currentColor: string
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [draggedPoints, setDraggedPoints] = useState<Set<string>>(new Set())
  const [dragStart, setDragStart] = useState<THREE.Vector3 | null>(null)
  const { raycaster, camera, pointer } = useThree()
  
  // Create geometry from points
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions: number[] = []
    const indices: number[] = []
    const pointsArray = Array.from(blob.points.entries())
    
    // Add positions
    pointsArray.forEach(([id, point]) => {
      positions.push(point.position.x, point.position.y, point.position.z)
    })
    
    // Create triangulation (simple approach)
    if (pointsArray.length >= 3) {
      // Find center
      const center = new THREE.Vector3()
      pointsArray.forEach(([_, point]) => {
        center.add(point.position)
      })
      center.divideScalar(pointsArray.length)
      
      // Create faces by connecting neighboring points
      for (let i = 0; i < pointsArray.length; i++) {
        for (let j = i + 1; j < pointsArray.length; j++) {
          for (let k = j + 1; k < pointsArray.length; k++) {
            const p1 = pointsArray[i][1].position
            const p2 = pointsArray[j][1].position
            const p3 = pointsArray[k][1].position
            
            // Only create triangles for nearby points
            const d12 = p1.distanceTo(p2)
            const d23 = p2.distanceTo(p3)
            const d31 = p3.distanceTo(p1)
            const maxDist = 1.5
            
            if (d12 < maxDist && d23 < maxDist && d31 < maxDist) {
              // Check if triangle faces outward
              const v1 = p2.clone().sub(p1)
              const v2 = p3.clone().sub(p1)
              const normal = v1.cross(v2).normalize()
              const toCenter = center.clone().sub(p1).normalize()
              
              if (normal.dot(toCenter) < 0) {
                indices.push(i, j, k)
              } else {
                indices.push(i, k, j)
              }
            }
          }
        }
      }
    }
    
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    
    return geo
  }, [blob.points])
  
  // Physics simulation
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.016)
    let updated = false
    
    // Apply forces and constraints
    blob.points.forEach((point, id) => {
      if (!point.isPinned) {
        // Gravity
        point.velocity.y -= 9.8 * dt
        
        // Damping
        point.velocity.multiplyScalar(0.98)
        
        // Update position
        point.position.add(point.velocity.clone().multiplyScalar(dt))
        
        // Ground collision
        if (point.position.y < 0.1) {
          point.position.y = 0.1
          point.velocity.y *= -0.5
          point.velocity.x *= 0.8
          point.velocity.z *= 0.8
        }
        
        updated = true
      }
    })
    
    // Apply spring constraints between connected points
    blob.connections.forEach(([id1, id2]) => {
      const p1 = blob.points.get(id1)
      const p2 = blob.points.get(id2)
      
      if (p1 && p2) {
        const diff = p2.position.clone().sub(p1.position)
        const currentDist = diff.length()
        const restDist = 0.5 // Rest distance between points
        
        if (currentDist > 0.01) {
          const force = diff.normalize().multiplyScalar((currentDist - restDist) * 20)
          
          if (!p1.isPinned) {
            p1.velocity.add(force.clone().multiplyScalar(dt))
          }
          if (!p2.isPinned) {
            p2.velocity.sub(force.clone().multiplyScalar(dt))
          }
        }
      }
    })
    
    // Update center
    blob.centerPosition.set(0, 0, 0)
    blob.points.forEach(point => {
      blob.centerPosition.add(point.position)
    })
    blob.centerPosition.divideScalar(blob.points.size)
    
    // Update geometry if needed
    if (updated && meshRef.current) {
      const positions = meshRef.current.geometry.attributes.position.array as Float32Array
      let i = 0
      blob.points.forEach(point => {
        positions[i++] = point.position.x
        positions[i++] = point.position.y
        positions[i++] = point.position.z
      })
      meshRef.current.geometry.attributes.position.needsUpdate = true
      meshRef.current.geometry.computeVertexNormals()
    }
  })
  
  const handlePointerDown = (e: any) => {
    e.stopPropagation()
    
    if (tool === 'stretch') {
      setDragStart(e.point.clone())
      
      // Find nearby points to drag
      const radius = 0.8
      const nearbyPoints = new Set<string>()
      
      blob.points.forEach((point, id) => {
        if (point.position.distanceTo(e.point) < radius) {
          nearbyPoints.add(id)
          point.isPinned = true
        }
      })
      
      setDraggedPoints(nearbyPoints)
    } else if (tool === 'paint') {
      // Update color
      blob.color = currentColor
      onUpdate({ ...blob })
    }
  }
  
  const handlePointerMove = (e: any) => {
    if (tool === 'stretch' && draggedPoints.size > 0 && dragStart) {
      e.stopPropagation()
      
      const moveVector = e.point.clone().sub(dragStart)
      
      draggedPoints.forEach(id => {
        const point = blob.points.get(id)
        if (point) {
          // Move point with drag
          const distFromDragStart = point.position.distanceTo(dragStart)
          const influence = Math.max(0, 1 - distFromDragStart / 1.5)
          
          point.position.add(moveVector.clone().multiplyScalar(influence * 0.1))
          point.velocity.set(0, 0, 0)
        }
      })
      
      // Add new points if stretching far enough
      const stretchDistance = moveVector.length()
      if (stretchDistance > 1.5) {
        const newPointId = `${blob.id}-p${Date.now()}`
        const newPoint: ClayPoint = {
          position: e.point.clone(),
          velocity: new THREE.Vector3(),
          isPinned: true,
          originalNeighbors: []
        }
        
        blob.points.set(newPointId, newPoint)
        
        // Connect to nearby points
        draggedPoints.forEach(id => {
          blob.connections.push([id, newPointId])
        })
        
        draggedPoints.add(newPointId)
      }
    }
  }
  
  const handlePointerUp = () => {
    if (draggedPoints.size > 0) {
      draggedPoints.forEach(id => {
        const point = blob.points.get(id)
        if (point) {
          point.isPinned = false
        }
      })
      setDraggedPoints(new Set())
      setDragStart(null)
    }
  }
  
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <meshPhongMaterial
        color={blob.color}
        specular={0x111111}
        shininess={100}
        side={THREE.DoubleSide}
        transparent
        opacity={0.9}
      />
    </mesh>
  )
}

function createClayBlob(position: THREE.Vector3, size: number, color: string): ClayBlob {
  const id = `blob-${Date.now()}`
  const points = new Map<string, ClayPoint>()
  const connections: Array<[string, string]> = []
  
  // Create initial sphere of points
  const numPoints = 20
  for (let i = 0; i < numPoints; i++) {
    const phi = Math.acos(1 - 2 * i / numPoints)
    const theta = Math.PI * (1 + Math.sqrt(5)) * i
    
    const x = Math.sin(phi) * Math.cos(theta) * size
    const y = Math.sin(phi) * Math.sin(theta) * size
    const z = Math.cos(phi) * size
    
    const pointId = `${id}-p${i}`
    points.set(pointId, {
      position: position.clone().add(new THREE.Vector3(x, y, z)),
      velocity: new THREE.Vector3(),
      isPinned: false,
      originalNeighbors: []
    })
  }
  
  // Connect nearby points
  const pointIds = Array.from(points.keys())
  for (let i = 0; i < pointIds.length; i++) {
    for (let j = i + 1; j < pointIds.length; j++) {
      const p1 = points.get(pointIds[i])!
      const p2 = points.get(pointIds[j])!
      
      if (p1.position.distanceTo(p2.position) < size * 1.2) {
        connections.push([pointIds[i], pointIds[j]])
        p1.originalNeighbors.push(pointIds[j])
        p2.originalNeighbors.push(pointIds[i])
      }
    }
  }
  
  return {
    id,
    points,
    connections,
    color,
    centerPosition: position.clone()
  }
}

export default function StretchableClaySystem() {
  const [blobs, setBlobs] = useState<ClayBlob[]>([])
  const [tool, setTool] = useState<'add' | 'stretch' | 'pinch' | 'smooth' | 'paint' | 'delete'>('add')
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [blobSize, setBlobSize] = useState(1)
  const [projectName, setProjectName] = useState('Clay Sculpture')
  
  const handleCanvasClick = (event: any) => {
    if (tool === 'add' && event.point) {
      const newBlob = createClayBlob(
        new THREE.Vector3(event.point.x, event.point.y + blobSize, event.point.z),
        blobSize,
        currentColor
      )
      setBlobs([...blobs, newBlob])
    }
  }
  
  const updateBlob = (updatedBlob: ClayBlob) => {
    setBlobs(blobs.map(blob => 
      blob.id === updatedBlob.id ? updatedBlob : blob
    ))
  }
  
  const deleteBlob = (id: string) => {
    setBlobs(blobs.filter(blob => blob.id !== id))
  }
  
  const smoothBlob = (blob: ClayBlob) => {
    // Average positions with neighbors
    const newPositions = new Map<string, THREE.Vector3>()
    
    blob.points.forEach((point, id) => {
      const avgPos = point.position.clone()
      let count = 1
      
      // Find connected points
      blob.connections.forEach(([id1, id2]) => {
        if (id1 === id) {
          const neighbor = blob.points.get(id2)
          if (neighbor) {
            avgPos.add(neighbor.position)
            count++
          }
        } else if (id2 === id) {
          const neighbor = blob.points.get(id1)
          if (neighbor) {
            avgPos.add(neighbor.position)
            count++
          }
        }
      })
      
      avgPos.divideScalar(count)
      newPositions.set(id, avgPos)
    })
    
    // Apply smoothed positions
    newPositions.forEach((pos, id) => {
      const point = blob.points.get(id)
      if (point) {
        point.position.lerp(pos, 0.5)
      }
    })
    
    updateBlob(blob)
  }
  
  // Save/Load functions
  const saveProject = () => {
    const data = {
      name: projectName,
      blobs: blobs.map(blob => ({
        id: blob.id,
        color: blob.color,
        points: Array.from(blob.points.entries()).map(([id, point]) => ({
          id,
          position: point.position.toArray(),
          velocity: point.velocity.toArray()
        })),
        connections: blob.connections
      })),
      timestamp: new Date().toISOString()
    }
    
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(jsonBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${projectName}_${Date.now()}.clay`
    link.click()
    URL.revokeObjectURL(url)
  }
  
  const loadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        setProjectName(data.name)
        
        const loadedBlobs = data.blobs.map((blobData: any) => {
          const points = new Map<string, ClayPoint>()
          
          blobData.points.forEach((pointData: any) => {
            points.set(pointData.id, {
              position: new THREE.Vector3(...pointData.position),
              velocity: new THREE.Vector3(...pointData.velocity),
              isPinned: false,
              originalNeighbors: []
            })
          })
          
          return {
            id: blobData.id,
            points,
            connections: blobData.connections,
            color: blobData.color,
            centerPosition: new THREE.Vector3()
          }
        })
        
        setBlobs(loadedBlobs)
      } catch (error) {
        alert('Failed to load file')
      }
    }
    reader.readAsText(file)
  }
  
  return (
    <div className="w-full h-full flex">
      {/* Toolbar */}
      <div className="w-80 bg-white shadow-lg p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Stretchable Clay Sculptor</h2>
        
        {/* Project Name */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Project Name</h3>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full p-2 border rounded text-sm"
          />
        </div>
        
        {/* Tools */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Tools</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTool('add')}
              className={`p-2 rounded text-sm ${
                tool === 'add' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Add Clay
            </button>
            <button
              onClick={() => setTool('stretch')}
              className={`p-2 rounded text-sm ${
                tool === 'stretch' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Stretch & Pull
            </button>
            <button
              onClick={() => setTool('pinch')}
              className={`p-2 rounded text-sm ${
                tool === 'pinch' ? 'bg-purple-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Pinch
            </button>
            <button
              onClick={() => setTool('smooth')}
              className={`p-2 rounded text-sm ${
                tool === 'smooth' ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Smooth
            </button>
            <button
              onClick={() => setTool('paint')}
              className={`p-2 rounded text-sm ${
                tool === 'paint' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Paint
            </button>
            <button
              onClick={() => setTool('delete')}
              className={`p-2 rounded text-sm ${
                tool === 'delete' ? 'bg-red-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Delete
            </button>
          </div>
        </div>
        
        {/* Clay Properties */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Clay Properties</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs">Initial Size: {blobSize.toFixed(1)}</label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={blobSize}
                onChange={(e) => setBlobSize(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
        
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
        
        {/* File Management */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">File Management</h3>
          <div className="space-y-2">
            <button onClick={saveProject} className="w-full p-2 bg-green-500 text-white rounded hover:bg-green-600">
              Save Project
            </button>
            <label className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer text-center block">
              Load Project
              <input type="file" accept=".clay" onChange={loadProject} className="hidden" />
            </label>
          </div>
        </div>
        
        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              if (confirm('Clear all clay?')) setBlobs([])
            }}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear All
          </button>
        </div>
        
        {/* Stats */}
        <div className="mt-6 p-3 bg-gray-100 rounded text-xs">
          <p>Clay Objects: {blobs.length}</p>
          <p>Total Points: {blobs.reduce((sum, blob) => sum + blob.points.size, 0)}</p>
        </div>
        
        {/* Instructions */}
        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">How to Use:</p>
          <p>• Add: Click to add clay ball</p>
          <p>• Stretch: Drag to pull and deform</p>
          <p>• Pinch: Click to compress area</p>
          <p>• Smooth: Click to smooth surface</p>
          <p>• Paint: Click to change color</p>
          <p className="mt-2 font-semibold">Tips:</p>
          <p>• Pull slowly for smooth stretching</p>
          <p>• Pull fast to create thin parts</p>
        </div>
      </div>
      
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [8, 8, 8], fov: 50 }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />
            
            <OrbitControls enableDamping enabled={tool !== 'stretch'} makeDefault />
            
            <Grid 
              args={[20, 20]} 
              cellSize={1} 
              cellThickness={0.5} 
              cellColor="#6b7280" 
              sectionSize={5} 
              sectionThickness={1} 
              sectionColor="#374151"
              fadeDistance={30}
              fadeStrength={1}
              followCamera={false}
            />
            
            {/* Ground for adding */}
            <mesh 
              rotation={[-Math.PI / 2, 0, 0]} 
              position={[0, -0.01, 0]}
              onClick={handleCanvasClick}
              visible={tool === 'add'}
            >
              <planeGeometry args={[20, 20]} />
              <meshBasicMaterial color="white" opacity={0} transparent />
            </mesh>
            
            {/* Clay blobs */}
            {blobs.map(blob => (
              <ClayMesh
                key={blob.id}
                blob={blob}
                onUpdate={updateBlob}
                tool={tool}
                currentColor={currentColor}
              />
            ))}
            
            {/* Tool interactions */}
            {tool === 'smooth' && blobs.map(blob => (
              <mesh
                key={`smooth-${blob.id}`}
                position={blob.centerPosition}
                onClick={() => smoothBlob(blob)}
              >
                <sphereGeometry args={[blobSize * 2, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            ))}
            
            {tool === 'delete' && blobs.map(blob => (
              <mesh
                key={`delete-${blob.id}`}
                position={blob.centerPosition}
                onClick={() => deleteBlob(blob.id)}
              >
                <sphereGeometry args={[blobSize * 2, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            ))}
            
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
        
        {/* Status */}
        <div className="absolute top-4 right-4 bg-white p-2 rounded shadow text-sm">
          <p>Tool: {tool.charAt(0).toUpperCase() + tool.slice(1)}</p>
          <p>Objects: {blobs.length}</p>
        </div>
      </div>
    </div>
  )
}
