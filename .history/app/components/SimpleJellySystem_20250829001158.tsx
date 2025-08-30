'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, Sphere, MeshDistortMaterial } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense } from 'react'
import * as THREE from 'three'

interface JellyBlob {
  id: string
  position: THREE.Vector3
  velocity: THREE.Vector3
  scale: number
  color: string
  distortSpeed: number
  distortAmount: number
}

function Jelly({ blob, onUpdate, tool, onDelete }: {
  blob: JellyBlob
  onUpdate: (id: string, updates: Partial<JellyBlob>) => void
  tool: string
  onDelete: (id: string) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef(new THREE.Vector3())
  const dragOffset = useRef(new THREE.Vector3())
  
  // Physics simulation
  useFrame((state, delta) => {
    if (!meshRef.current || isDragging) return
    
    // Apply gravity
    blob.velocity.y -= 9.8 * delta * 0.3
    
    // Apply velocity
    blob.position.add(blob.velocity.clone().multiplyScalar(delta))
    
    // Ground collision
    if (blob.position.y < blob.scale) {
      blob.position.y = blob.scale
      blob.velocity.y *= -0.6 // Bounce
      blob.velocity.x *= 0.9 // Friction
      blob.velocity.z *= 0.9
    }
    
    // Damping
    blob.velocity.multiplyScalar(0.98)
    
    // Update mesh position
    meshRef.current.position.copy(blob.position)
  })
  
  const handlePointerDown = (e: any) => {
    e.stopPropagation()
    
    if (tool === 'grab') {
      setIsDragging(true)
      dragStartPos.current.copy(blob.position)
      dragOffset.current.copy(e.point).sub(blob.position)
    } else if (tool === 'delete') {
      onDelete(blob.id)
    } else if (tool === 'paint') {
      // Paint is handled by parent
    }
  }
  
  const handlePointerMove = (e: any) => {
    if (isDragging && tool === 'grab') {
      e.stopPropagation()
      const newPos = e.point.clone().sub(dragOffset.current)
      
      // Calculate velocity from movement
      const vel = newPos.clone().sub(blob.position).multiplyScalar(10)
      
      onUpdate(blob.id, {
        position: newPos,
        velocity: vel
      })
      
      if (meshRef.current) {
        meshRef.current.position.copy(newPos)
      }
    }
  }
  
  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false)
    }
  }
  
  return (
    <mesh
      ref={meshRef}
      position={blob.position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      scale={blob.scale}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <MeshDistortMaterial
        color={blob.color}
        speed={blob.distortSpeed}
        distort={blob.distortAmount}
        radius={1}
        transparent
        opacity={0.9}
        roughness={0.1}
        metalness={0.2}
      />
    </mesh>
  )
}

export default function SimpleJellySystem() {
  const [blobs, setBlobs] = useState<JellyBlob[]>([])
  const [tool, setTool] = useState<'add' | 'grab' | 'merge' | 'split' | 'paint' | 'delete'>('add')
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [blobSize, setBlobSize] = useState(1)
  const [wobbliness, setWobbliness] = useState(0.3)
  const [projectName, setProjectName] = useState('Jelly Art')
  
  const createBlob = (position: THREE.Vector3): JellyBlob => ({
    id: `blob-${Date.now()}-${Math.random()}`,
    position: position.clone(),
    velocity: new THREE.Vector3(),
    scale: blobSize,
    color: currentColor,
    distortSpeed: 2,
    distortAmount: wobbliness
  })
  
  const handleCanvasClick = (event: any) => {
    if (tool === 'add' && event.point) {
      const newBlob = createBlob(
        new THREE.Vector3(event.point.x, event.point.y + blobSize, event.point.z)
      )
      setBlobs([...blobs, newBlob])
    }
  }
  
  const updateBlob = (id: string, updates: Partial<JellyBlob>) => {
    setBlobs(prevBlobs => 
      prevBlobs.map(blob => 
        blob.id === id ? { ...blob, ...updates } : blob
      )
    )
  }
  
  const deleteBlob = (id: string) => {
    setBlobs(prevBlobs => prevBlobs.filter(blob => blob.id !== id))
  }
  
  const splitBlob = (id: string) => {
    const blob = blobs.find(b => b.id === id)
    if (!blob || blob.scale < 0.5) return
    
    const newBlobs: JellyBlob[] = []
    const numSplits = 2 + Math.floor(Math.random() * 2)
    
    for (let i = 0; i < numSplits; i++) {
      const angle = (i / numSplits) * Math.PI * 2
      const newBlob = createBlob(blob.position)
      newBlob.scale = blob.scale / Math.sqrt(numSplits)
      newBlob.color = blob.color
      newBlob.velocity = new THREE.Vector3(
        Math.cos(angle) * 3,
        2 + Math.random() * 2,
        Math.sin(angle) * 3
      )
      newBlob.position.add(newBlob.velocity.clone().multiplyScalar(0.1))
      newBlobs.push(newBlob)
    }
    
    setBlobs(prevBlobs => [
      ...prevBlobs.filter(b => b.id !== id),
      ...newBlobs
    ])
  }
  
  // Merge nearby blobs
  useEffect(() => {
    if (tool !== 'merge') return
    
    const interval = setInterval(() => {
      const mergeDistance = 2
      const toMerge: Map<string, string[]> = new Map()
      const processed = new Set<string>()
      
      // Find blobs to merge
      blobs.forEach((blob1, i) => {
        if (processed.has(blob1.id)) return
        
        const group = [blob1.id]
        processed.add(blob1.id)
        
        blobs.forEach((blob2, j) => {
          if (i !== j && !processed.has(blob2.id)) {
            const distance = blob1.position.distanceTo(blob2.position)
            if (distance < (blob1.scale + blob2.scale) * mergeDistance) {
              group.push(blob2.id)
              processed.add(blob2.id)
            }
          }
        })
        
        if (group.length > 1) {
          toMerge.set(group[0], group)
        }
      })
      
      // Perform merging
      if (toMerge.size > 0) {
        const newBlobs: JellyBlob[] = []
        const idsToRemove = new Set<string>()
        
        toMerge.forEach((group) => {
          const mergingBlobs = group.map(id => blobs.find(b => b.id === id)!).filter(Boolean)
          if (mergingBlobs.length < 2) return
          
          // Calculate merged properties
          let totalVolume = 0
          const mergedPos = new THREE.Vector3()
          const mergedVel = new THREE.Vector3()
          
          mergingBlobs.forEach(blob => {
            const volume = Math.pow(blob.scale, 3)
            totalVolume += volume
            mergedPos.add(blob.position.clone().multiplyScalar(volume))
            mergedVel.add(blob.velocity.clone().multiplyScalar(volume))
            idsToRemove.add(blob.id)
          })
          
          mergedPos.divideScalar(totalVolume)
          mergedVel.divideScalar(totalVolume)
          
          const mergedBlob = createBlob(mergedPos)
          mergedBlob.scale = Math.pow(totalVolume, 1/3)
          mergedBlob.velocity = mergedVel
          mergedBlob.color = mergingBlobs[0].color
          
          newBlobs.push(mergedBlob)
        })
        
        setBlobs(prevBlobs => [
          ...prevBlobs.filter(b => !idsToRemove.has(b.id)),
          ...newBlobs
        ])
      }
    }, 100)
    
    return () => clearInterval(interval)
  }, [tool, blobs])
  
  // Save/Load
  const saveProject = () => {
    const data = {
      name: projectName,
      blobs: blobs.map(blob => ({
        id: blob.id,
        position: blob.position.toArray(),
        velocity: blob.velocity.toArray(),
        scale: blob.scale,
        color: blob.color,
        distortSpeed: blob.distortSpeed,
        distortAmount: blob.distortAmount
      })),
      timestamp: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${projectName}_${Date.now()}.jelly`
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
        setBlobs(data.blobs.map((b: any) => ({
          ...b,
          position: new THREE.Vector3(...b.position),
          velocity: new THREE.Vector3(...b.velocity)
        })))
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
        <h2 className="text-xl font-bold mb-4">Wobbly Jelly Creator</h2>
        
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
              Add Jelly
            </button>
            <button
              onClick={() => setTool('grab')}
              className={`p-2 rounded text-sm ${
                tool === 'grab' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Grab & Move
            </button>
            <button
              onClick={() => setTool('merge')}
              className={`p-2 rounded text-sm ${
                tool === 'merge' ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Auto Merge
            </button>
            <button
              onClick={() => setTool('split')}
              className={`p-2 rounded text-sm ${
                tool === 'split' ? 'bg-purple-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Split
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
        
        {/* Jelly Properties */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Jelly Properties</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs">Size: {blobSize.toFixed(1)}</label>
              <input
                type="range"
                min="0.3"
                max="3"
                step="0.1"
                value={blobSize}
                onChange={(e) => setBlobSize(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs">Wobbliness: {wobbliness.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={wobbliness}
                onChange={(e) => setWobbliness(parseFloat(e.target.value))}
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
              <input type="file" accept=".jelly" onChange={loadProject} className="hidden" />
            </label>
          </div>
        </div>
        
        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              if (confirm('Clear all jellies?')) setBlobs([])
            }}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear All
          </button>
        </div>
        
        {/* Stats */}
        <div className="mt-6 p-3 bg-gray-100 rounded text-xs">
          <p>Jellies: {blobs.length}</p>
          <p>Physics: Active</p>
          <p>Tool: {tool}</p>
        </div>
        
        {/* Instructions */}
        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">How to Use:</p>
          <p>• Add: Click to drop jelly</p>
          <p>• Grab: Drag to move & throw</p>
          <p>• Merge: Jellies merge when close</p>
          <p>• Split: Click to break apart</p>
          <p>• Paint: Click to change color</p>
          <p>• Delete: Click to remove</p>
        </div>
      </div>
      
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [8, 8, 8], fov: 50 }}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />
            
            <OrbitControls enableDamping enabled={tool !== 'grab'} makeDefault />
            
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
            
            {/* Jelly blobs */}
            {blobs.map(blob => (
              <Jelly
                key={blob.id}
                blob={blob}
                onUpdate={updateBlob}
                onDelete={deleteBlob}
                tool={tool}
              />
            ))}
            
            {/* Tool-specific interactions */}
            {tool === 'split' && blobs.map(blob => (
              <mesh
                key={`split-${blob.id}`}
                position={blob.position}
                onClick={() => splitBlob(blob.id)}
              >
                <sphereGeometry args={[blob.scale * 1.5, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            ))}
            
            {tool === 'paint' && blobs.map(blob => (
              <mesh
                key={`paint-${blob.id}`}
                position={blob.position}
                onClick={() => updateBlob(blob.id, { color: currentColor })}
              >
                <sphereGeometry args={[blob.scale * 1.5, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            ))}
            
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
        
        {/* Status */}
        <div className="absolute top-4 right-4 bg-white p-2 rounded shadow text-sm">
          <p>Tool: {tool.charAt(0).toUpperCase() + tool.slice(1)}</p>
          <p>Jellies: {blobs.length}</p>
        </div>
      </div>
    </div>
  )
}
