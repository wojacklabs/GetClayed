'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, useCursor } from '@react-three/drei'
import { useRef, useState, useEffect, useMemo, Suspense, useCallback, forwardRef } from 'react'
import * as THREE from 'three'

interface ClayObject {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  vertices: Float32Array
  originalVertices: Float32Array
  color: string
  type: 'sphere' | 'box' | 'cylinder'
  segments: number
}

interface ClayMeshProps {
  object: ClayObject
  isSelected: boolean
  onSelect: (id: string) => void
  tool: string
  brushSize: number
  brushStrength: number
  onVerticesUpdate: (id: string, vertices: Float32Array) => void
}

// Helper to create initial geometry vertices
function createGeometryVertices(type: string, segments: number): Float32Array {
  let geometry: THREE.BufferGeometry
  
  switch (type) {
    case 'sphere':
      geometry = new THREE.SphereGeometry(1, segments, segments)
      break
    case 'box':
      geometry = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments)
      break
    case 'cylinder':
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, segments, segments)
      break
    default:
      geometry = new THREE.SphereGeometry(1, segments, segments)
  }
  
  const vertices = geometry.attributes.position.array as Float32Array
  geometry.dispose()
  return new Float32Array(vertices)
}

const ClayMesh = forwardRef<THREE.Mesh, ClayMeshProps>(({ 
  object, 
  isSelected, 
  onSelect, 
  tool, 
  brushSize, 
  brushStrength,
  onVerticesUpdate 
}, ref) => {
  const [hovered, setHovered] = useState(false)
  const geometryRef = useRef<THREE.BufferGeometry>(null)
  const { camera, raycaster } = useThree()
  const [isDeforming, setIsDeforming] = useState(false)
  
  useCursor(hovered && tool === 'sculpt')
  
  // Initialize geometry with vertices
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(object.vertices, 3))
    geo.computeVertexNormals()
    return geo
  }, [object.id])
  
  // Update vertices when object changes
  useEffect(() => {
    if (geometryRef.current) {
      geometryRef.current.setAttribute('position', new THREE.BufferAttribute(object.vertices, 3))
      geometryRef.current.computeVertexNormals()
      geometryRef.current.attributes.position.needsUpdate = true
    }
  }, [object.vertices])
  
  // Sculpting logic
  const handlePointerMove = useCallback((e: any) => {
    if (!isDeforming || tool !== 'sculpt' || !geometryRef.current) return
    
    e.stopPropagation()
    
    const mesh = e.object as THREE.Mesh
    const point = e.point
    const localPoint = mesh.worldToLocal(point.clone())
    
    const positions = geometryRef.current.attributes.position
    const vertices = new Float32Array(positions.array)
    
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        vertices[i * 3],
        vertices[i * 3 + 1],
        vertices[i * 3 + 2]
      )
      
      const distance = vertex.distanceTo(localPoint)
      
      if (distance < brushSize) {
        const influence = 1 - (distance / brushSize)
        const smoothInfluence = Math.pow(influence, 2) // Smooth falloff
        
        // Push/pull vertices based on surface normal
        const normal = new THREE.Vector3()
        normal.fromBufferAttribute(geometryRef.current.attributes.normal, i)
        
        const deformStrength = brushStrength * smoothInfluence * 0.05
        
        if (e.buttons === 1) { // Left click - push out
          vertices[i * 3] += normal.x * deformStrength
          vertices[i * 3 + 1] += normal.y * deformStrength
          vertices[i * 3 + 2] += normal.z * deformStrength
        } else if (e.buttons === 2) { // Right click - push in
          vertices[i * 3] -= normal.x * deformStrength
          vertices[i * 3 + 1] -= normal.y * deformStrength
          vertices[i * 3 + 2] -= normal.z * deformStrength
        }
      }
    }
    
    positions.array = vertices
    positions.needsUpdate = true
    geometryRef.current.computeVertexNormals()
    
    onVerticesUpdate(object.id, vertices)
  }, [isDeforming, tool, brushSize, brushStrength, object.id, onVerticesUpdate])
  
  const handlePointerDown = (e: any) => {
    if (tool === 'sculpt') {
      e.stopPropagation()
      setIsDeforming(true)
    } else {
      onSelect(object.id)
    }
  }
  
  const handlePointerUp = () => {
    setIsDeforming(false)
  }
  
  // Smooth animation when selected
  useFrame(() => {
    if (ref && 'current' in ref && ref.current && isSelected && tool === 'transform') {
      ref.current.rotation.y += 0.005
    }
  })
  
  return (
    <mesh
      ref={ref}
      position={object.position}
      rotation={object.rotation}
      geometry={geometry}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => {
        setHovered(false)
        setIsDeforming(false)
      }}
    >
      <bufferGeometry ref={geometryRef} attach="geometry" />
      <meshStandardMaterial 
        color={object.color} 
        roughness={0.6}
        metalness={0.2}
        emissive={isSelected ? object.color : '#000000'}
        emissiveIntensity={isSelected ? 0.1 : 0}
        wireframe={tool === 'sculpt' && hovered}
      />
    </mesh>
  )
})

ClayMesh.displayName = 'ClayMesh'

export default function ClaySceneOrganic() {
  const [clayObjects, setClayObjects] = useState<ClayObject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [currentType, setCurrentType] = useState<ClayObject['type']>('sphere')
  const [tool, setTool] = useState<'add' | 'sculpt' | 'paint' | 'delete' | 'smooth' | 'transform'>('add')
  const [brushSize, setBrushSize] = useState(0.3)
  const [brushStrength, setBrushStrength] = useState(0.5)
  const [segments, setSegments] = useState(32)
  const [projectName, setProjectName] = useState('My Clay Project')
  const meshRefs = useRef<{ [key: string]: THREE.Mesh }>({})
  
  const selectedObject = clayObjects.find(obj => obj.id === selectedId)

  const handleCanvasClick = (event: any) => {
    if (tool === 'add' && event.point) {
      const vertices = createGeometryVertices(currentType, segments)
      const newObject: ClayObject = {
        id: `clay-${Date.now()}`,
        position: [event.point.x, Math.max(event.point.y + 0.5, 0.5), event.point.z],
        rotation: [0, 0, 0],
        vertices: vertices,
        originalVertices: new Float32Array(vertices),
        color: currentColor,
        type: currentType,
        segments: segments
      }
      setClayObjects([...clayObjects, newObject])
    }
  }

  const handleObjectSelect = (id: string) => {
    if (tool === 'delete') {
      setClayObjects(clayObjects.filter(obj => obj.id !== id))
      if (selectedId === id) setSelectedId(null)
    } else if (tool === 'paint') {
      setClayObjects(clayObjects.map(obj => 
        obj.id === id ? { ...obj, color: currentColor } : obj
      ))
    } else if (tool === 'smooth' && selectedId === id) {
      smoothObject(id)
    } else {
      setSelectedId(id)
    }
  }

  const handleVerticesUpdate = (id: string, vertices: Float32Array) => {
    setClayObjects(prevObjects => 
      prevObjects.map(obj => 
        obj.id === id ? { ...obj, vertices: new Float32Array(vertices) } : obj
      )
    )
  }

  const smoothObject = (id: string) => {
    const object = clayObjects.find(obj => obj.id === id)
    if (!object) return

    const vertices = new Float32Array(object.vertices)
    const smoothedVertices = new Float32Array(vertices.length)
    
    // Simple smoothing algorithm
    for (let i = 0; i < vertices.length / 3; i++) {
      let avgX = vertices[i * 3]
      let avgY = vertices[i * 3 + 1]
      let avgZ = vertices[i * 3 + 2]
      let count = 1

      // Find nearby vertices and average them
      for (let j = 0; j < vertices.length / 3; j++) {
        if (i !== j) {
          const dx = vertices[i * 3] - vertices[j * 3]
          const dy = vertices[i * 3 + 1] - vertices[j * 3 + 1]
          const dz = vertices[i * 3 + 2] - vertices[j * 3 + 2]
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
          
          if (distance < brushSize * 0.5) {
            avgX += vertices[j * 3]
            avgY += vertices[j * 3 + 1]
            avgZ += vertices[j * 3 + 2]
            count++
          }
        }
      }

      smoothedVertices[i * 3] = vertices[i * 3] * 0.7 + (avgX / count) * 0.3
      smoothedVertices[i * 3 + 1] = vertices[i * 3 + 1] * 0.7 + (avgY / count) * 0.3
      smoothedVertices[i * 3 + 2] = vertices[i * 3 + 2] * 0.7 + (avgZ / count) * 0.3
    }

    handleVerticesUpdate(id, smoothedVertices)
  }

  const resetObject = (id: string) => {
    const object = clayObjects.find(obj => obj.id === id)
    if (object) {
      handleVerticesUpdate(id, new Float32Array(object.originalVertices))
    }
  }

  // Save project
  const saveProject = useCallback(() => {
    const projectData = {
      name: projectName,
      objects: clayObjects.map(obj => ({
        ...obj,
        vertices: Array.from(obj.vertices),
        originalVertices: Array.from(obj.originalVertices)
      })),
      timestamp: new Date().toISOString()
    }
    
    const jsonString = JSON.stringify(projectData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${projectName}_${new Date().getTime()}.clay`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [projectName, clayObjects])

  // Load project
  const loadProject = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const projectData = JSON.parse(e.target?.result as string)
        setProjectName(projectData.name || 'My Clay Project')
        setClayObjects(projectData.objects.map((obj: any) => ({
          ...obj,
          vertices: new Float32Array(obj.vertices),
          originalVertices: new Float32Array(obj.originalVertices)
        })))
        setSelectedId(null)
      } catch (error) {
        alert('Failed to load file')
      }
    }
    reader.readAsText(file)
  }, [])

  return (
    <div className="w-full h-full flex">
      {/* Toolbar */}
      <div className="w-80 bg-white shadow-lg p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Organic Clay Sculptor</h2>
        
        {/* Project Name */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Project Name</h3>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full p-2 border rounded text-sm"
            placeholder="Enter project name"
          />
        </div>
        
        {/* Tools */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Tools</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTool('add')}
              className={`p-2 rounded text-sm ${
                tool === 'add' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Add Clay
            </button>
            <button
              onClick={() => setTool('sculpt')}
              className={`p-2 rounded text-sm ${
                tool === 'sculpt' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Sculpt
            </button>
            <button
              onClick={() => setTool('smooth')}
              className={`p-2 rounded text-sm ${
                tool === 'smooth' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Smooth
            </button>
            <button
              onClick={() => setTool('paint')}
              className={`p-2 rounded text-sm ${
                tool === 'paint' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Paint
            </button>
            <button
              onClick={() => setTool('transform')}
              className={`p-2 rounded text-sm ${
                tool === 'transform' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Move
            </button>
            <button
              onClick={() => setTool('delete')}
              className={`p-2 rounded text-sm ${
                tool === 'delete' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Delete
            </button>
          </div>
        </div>
        
        {/* Sculpting Settings */}
        {(tool === 'sculpt' || tool === 'smooth') && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">Brush Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs">Brush Size: {brushSize.toFixed(2)}</label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs">Brush Strength: {brushStrength.toFixed(2)}</label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={brushStrength}
                  onChange={(e) => setBrushStrength(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Shape Selection for Add Tool */}
        {tool === 'add' && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">Shape</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={() => setCurrentType('sphere')}
                className={`p-2 rounded text-sm ${
                  currentType === 'sphere' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Sphere
              </button>
              <button
                onClick={() => setCurrentType('box')}
                className={`p-2 rounded text-sm ${
                  currentType === 'box' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Cube
              </button>
              <button
                onClick={() => setCurrentType('cylinder')}
                className={`p-2 rounded text-sm ${
                  currentType === 'cylinder' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Cylinder
              </button>
            </div>
            <div>
              <label className="text-xs">Detail Level: {segments}</label>
              <input
                type="range"
                min="8"
                max="64"
                step="8"
                value={segments}
                onChange={(e) => setSegments(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}
        
        {/* Color Picker */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Color</h3>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setCurrentColor(e.target.value)}
              className="w-full h-10 rounded cursor-pointer"
            />
            <span className="text-xs">{currentColor}</span>
          </div>
          <div className="grid grid-cols-6 gap-1 mt-2">
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
        
        {/* Object Actions */}
        {selectedObject && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">Selected Object</h3>
            <div className="space-y-2">
              <button
                onClick={() => resetObject(selectedObject.id)}
                className="w-full p-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
              >
                Reset Shape
              </button>
              <button
                onClick={() => smoothObject(selectedObject.id)}
                className="w-full p-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
              >
                Smooth All
              </button>
            </div>
          </div>
        )}
        
        {/* File Management */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">File Management</h3>
          <div className="space-y-2">
            <button
              onClick={saveProject}
              className="w-full p-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Save Project
            </button>
            <label className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer text-center block">
              Load Project
              <input
                type="file"
                accept=".clay"
                onChange={loadProject}
                className="hidden"
              />
            </label>
          </div>
        </div>
        
        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              if (confirm('Clear all objects?')) {
                setClayObjects([])
                setSelectedId(null)
              }
            }}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear All
          </button>
        </div>
        
        {/* Instructions */}
        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">Sculpting Tips:</p>
          <p>• Left click: Push outward</p>
          <p>• Right click: Push inward</p>
          <p>• Drag to sculpt continuously</p>
          <p>• Use smooth tool to refine</p>
          <p>• Higher detail = smoother deformation</p>
        </div>
      </div>
      
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [5, 5, 5], fov: 50 }}
          onPointerMissed={() => tool !== 'add' && setSelectedId(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <OrbitControls 
              enableDamping 
              enabled={tool !== 'sculpt'}
              makeDefault
            />
            
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
            
            <mesh 
              rotation={[-Math.PI / 2, 0, 0]} 
              position={[0, -0.01, 0]}
              onClick={handleCanvasClick}
              visible={tool === 'add'}
            >
              <planeGeometry args={[20, 20]} />
              <meshBasicMaterial color="white" opacity={0} transparent />
            </mesh>
            
            {clayObjects.map((obj) => (
              <ClayMesh
                key={obj.id}
                object={obj}
                isSelected={selectedId === obj.id}
                onSelect={handleObjectSelect}
                tool={tool}
                brushSize={brushSize}
                brushStrength={brushStrength}
                onVerticesUpdate={handleVerticesUpdate}
                ref={(el) => {
                  if (el) meshRefs.current[obj.id] = el
                }}
              />
            ))}
            
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
        
        {/* Status Display */}
        <div className="absolute top-4 right-4 bg-white p-2 rounded shadow text-sm">
          <p>Tool: {tool.charAt(0).toUpperCase() + tool.slice(1)}</p>
          {tool === 'sculpt' && (
            <>
              <p>Brush Size: {brushSize.toFixed(2)}</p>
              <p>Strength: {brushStrength.toFixed(2)}</p>
            </>
          )}
          <p>Objects: {clayObjects.length}</p>
        </div>
      </div>
    </div>
  )
}
