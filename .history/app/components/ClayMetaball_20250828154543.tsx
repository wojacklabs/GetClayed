'use client'

import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { OrbitControls, Environment, Grid } from '@react-three/drei'
import { useRef, useState, useEffect, useMemo, Suspense } from 'react'
import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes'

// Extend Three.js with MarchingCubes
extend({ MarchingCubes })

// TypeScript declaration for MarchingCubes
declare global {
  namespace JSX {
    interface IntrinsicElements {
      marchingCubes: any
    }
  }
}

interface Ball {
  id: string
  position: THREE.Vector3
  strength: number
  radius: number
  velocity: THREE.Vector3
  color: THREE.Color
  isDragging?: boolean
}

function MetaballSystem({ balls, onBallUpdate, tool, brushStrength, currentColor }: {
  balls: Ball[]
  onBallUpdate: (id: string, updates: Partial<Ball>) => void
  tool: string
  brushStrength: number
  currentColor: string
}) {
  const meshRef = useRef<any>(null)
  const { camera, raycaster, pointer } = useThree()
  const [isDragging, setIsDragging] = useState<string | null>(null)
  const [dragOffset] = useState(new THREE.Vector3())
  
  // Update metaball field
  useFrame(() => {
    if (!meshRef.current) return
    
    meshRef.current.reset()
    
    // Add each ball to the field
    balls.forEach((ball) => {
      const strength = ball.strength * (ball.isDragging ? 1.2 : 1)
      meshRef.current.addBall(
        ball.position.x,
        ball.position.y,
        ball.position.z,
        strength,
        ball.radius
      )
    })
    
    // Update material color based on dominant ball
    if (balls.length > 0) {
      const dominantBall = balls.reduce((prev, current) => 
        prev.strength > current.strength ? prev : current
      )
      meshRef.current.material.color.copy(dominantBall.color)
    }
  })
  
  const handlePointerDown = (e: any) => {
    if (tool === 'grab') {
      e.stopPropagation()
      
      // Find which ball is closest to click point
      const clickPoint = e.point
      let closestBall: Ball | null = null
      let minDistance = Infinity
      
      balls.forEach(ball => {
        const distance = ball.position.distanceTo(clickPoint)
        if (distance < ball.radius * 2 && distance < minDistance) {
          minDistance = distance
          closestBall = ball
        }
      })
      
      if (closestBall) {
        setIsDragging(closestBall.id)
        dragOffset.copy(clickPoint).sub(closestBall.position)
        onBallUpdate(closestBall.id, { isDragging: true })
      }
    }
  }
  
  const handlePointerMove = (e: any) => {
    if (isDragging && tool === 'grab') {
      e.stopPropagation()
      
      const ball = balls.find(b => b.id === isDragging)
      if (ball) {
        const newPos = e.point.clone().sub(dragOffset)
        onBallUpdate(isDragging, { 
          position: newPos,
          velocity: newPos.clone().sub(ball.position).multiplyScalar(0.1)
        })
      }
    }
  }
  
  const handlePointerUp = () => {
    if (isDragging) {
      onBallUpdate(isDragging, { isDragging: false })
      setIsDragging(null)
    }
  }
  
  return (
    <marchingCubes
      ref={meshRef}
      args={[32, true, true]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <meshPhongMaterial
        color={currentColor}
        specular={0x111111}
        shininess={100}
        transparent
        opacity={0.9}
      />
    </marchingCubes>
  )
}

function PhysicsSystem({ balls, onBallsUpdate, mergeDistance = 0.5 }: {
  balls: Ball[]
  onBallsUpdate: (balls: Ball[]) => void
  mergeDistance?: number
}) {
  useFrame((state, delta) => {
    const updatedBalls = [...balls]
    const toMerge: Set<number> = new Set()
    
    // Apply physics
    updatedBalls.forEach((ball, i) => {
      if (!ball.isDragging) {
        // Gravity
        ball.velocity.y -= 9.8 * delta * 0.1
        
        // Damping
        ball.velocity.multiplyScalar(0.98)
        
        // Update position
        ball.position.add(ball.velocity.clone().multiplyScalar(delta))
        
        // Ground collision
        if (ball.position.y < ball.radius) {
          ball.position.y = ball.radius
          ball.velocity.y *= -0.5
        }
        
        // Boundaries
        const bound = 5
        if (Math.abs(ball.position.x) > bound) {
          ball.position.x = Math.sign(ball.position.x) * bound
          ball.velocity.x *= -0.5
        }
        if (Math.abs(ball.position.z) > bound) {
          ball.position.z = Math.sign(ball.position.z) * bound
          ball.velocity.z *= -0.5
        }
      }
      
      // Check for merging with other balls
      for (let j = i + 1; j < updatedBalls.length; j++) {
        const otherBall = updatedBalls[j]
        const distance = ball.position.distanceTo(otherBall.position)
        
        if (distance < mergeDistance && !ball.isDragging && !otherBall.isDragging) {
          toMerge.add(i)
          toMerge.add(j)
        }
      }
    })
    
    // Merge balls that are close together
    if (toMerge.size > 0) {
      const mergeGroups: number[][] = []
      const processed = new Set<number>()
      
      toMerge.forEach(index => {
        if (!processed.has(index)) {
          const group = [index]
          processed.add(index)
          
          // Find all connected balls
          toMerge.forEach(otherIndex => {
            if (!processed.has(otherIndex)) {
              const ball = updatedBalls[index]
              const otherBall = updatedBalls[otherIndex]
              if (ball.position.distanceTo(otherBall.position) < mergeDistance) {
                group.push(otherIndex)
                processed.add(otherIndex)
              }
            }
          })
          
          mergeGroups.push(group)
        }
      })
      
      // Create merged balls
      const newBalls: Ball[] = []
      const indicesToRemove = new Set<number>()
      
      mergeGroups.forEach(group => {
        const mergedBall: Ball = {
          id: `ball-${Date.now()}-${Math.random()}`,
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          strength: 0,
          radius: 0,
          color: new THREE.Color(),
          isDragging: false
        }
        
        let totalVolume = 0
        
        group.forEach(index => {
          const ball = updatedBalls[index]
          const volume = Math.pow(ball.radius, 3)
          totalVolume += volume
          
          mergedBall.position.add(ball.position.clone().multiplyScalar(volume))
          mergedBall.velocity.add(ball.velocity.clone().multiplyScalar(volume))
          mergedBall.strength += ball.strength
          
          indicesToRemove.add(index)
        })
        
        mergedBall.position.divideScalar(totalVolume)
        mergedBall.velocity.divideScalar(totalVolume)
        mergedBall.radius = Math.pow(totalVolume, 1/3)
        mergedBall.strength = Math.min(mergedBall.strength, 1.5)
        mergedBall.color.copy(updatedBalls[group[0]].color)
        
        newBalls.push(mergedBall)
      })
      
      // Filter out merged balls and add new ones
      const filteredBalls = updatedBalls.filter((_, index) => !indicesToRemove.has(index))
      onBallsUpdate([...filteredBalls, ...newBalls])
    } else {
      onBallsUpdate(updatedBalls)
    }
  })
  
  return null
}

export default function ClayMetaball() {
  const [balls, setBalls] = useState<Ball[]>([])
  const [tool, setTool] = useState<'add' | 'grab' | 'stretch' | 'split' | 'paint' | 'delete'>('add')
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [brushStrength, setBrushStrength] = useState(0.5)
  const [projectName, setProjectName] = useState('Jelly Sculpture')
  
  const handleCanvasClick = (event: any) => {
    if (tool === 'add' && event.point) {
      const newBall: Ball = {
        id: `ball-${Date.now()}`,
        position: new THREE.Vector3(event.point.x, event.point.y + 0.5, event.point.z),
        velocity: new THREE.Vector3(0, 0, 0),
        strength: brushStrength,
        radius: 0.3 + brushStrength * 0.5,
        color: new THREE.Color(currentColor),
        isDragging: false
      }
      setBalls([...balls, newBall])
    }
  }
  
  const updateBall = (id: string, updates: Partial<Ball>) => {
    setBalls(prevBalls => 
      prevBalls.map(ball => 
        ball.id === id 
          ? { ...ball, ...updates }
          : ball
      )
    )
  }
  
  const splitBall = (id: string) => {
    const ball = balls.find(b => b.id === id)
    if (!ball || ball.radius < 0.3) return
    
    const newBalls: Ball[] = []
    const numSplits = 2 + Math.floor(Math.random() * 2)
    
    for (let i = 0; i < numSplits; i++) {
      const angle = (i / numSplits) * Math.PI * 2
      const offset = new THREE.Vector3(
        Math.cos(angle) * ball.radius,
        Math.random() * 0.5,
        Math.sin(angle) * ball.radius
      )
      
      newBalls.push({
        id: `ball-${Date.now()}-${i}`,
        position: ball.position.clone().add(offset),
        velocity: offset.normalize().multiplyScalar(2),
        strength: ball.strength / numSplits,
        radius: ball.radius / Math.sqrt(numSplits),
        color: ball.color.clone(),
        isDragging: false
      })
    }
    
    setBalls(prevBalls => [
      ...prevBalls.filter(b => b.id !== id),
      ...newBalls
    ])
  }
  
  // Save/Load functions
  const saveProject = () => {
    const projectData = {
      name: projectName,
      balls: balls.map(ball => ({
        id: ball.id,
        position: ball.position.toArray(),
        velocity: ball.velocity.toArray(),
        strength: ball.strength,
        radius: ball.radius,
        color: ball.color.getHex()
      })),
      timestamp: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })
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
        setBalls(data.balls.map((b: any) => ({
          ...b,
          position: new THREE.Vector3(...b.position),
          velocity: new THREE.Vector3(...b.velocity),
          color: new THREE.Color(b.color)
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
        <h2 className="text-xl font-bold mb-4">Jelly Clay Sculptor</h2>
        
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
              Add Blob
            </button>
            <button
              onClick={() => setTool('grab')}
              className={`p-2 rounded text-sm ${
                tool === 'grab' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Grab & Pull
            </button>
            <button
              onClick={() => setTool('split')}
              className={`p-2 rounded text-sm ${
                tool === 'split' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Split
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
        
        {/* Blob Settings */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Blob Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs">Blob Strength: {brushStrength.toFixed(2)}</label>
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
        
        {/* Color Picker */}
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
                accept=".jelly"
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
              if (confirm('Clear all blobs?')) {
                setBalls([])
              }
            }}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear All
          </button>
        </div>
        
        {/* Stats */}
        <div className="mt-6 p-3 bg-gray-100 rounded text-xs">
          <p>Blobs: {balls.length}</p>
          <p>Physics: Active</p>
        </div>
        
        {/* Instructions */}
        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">How to Use:</p>
          <p>• Add: Click to drop new blob</p>
          <p>• Grab: Drag blobs around</p>
          <p>• Split: Click blob to split</p>
          <p>• Paint: Click to change color</p>
          <p>• Blobs merge when close!</p>
        </div>
      </div>
      
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [5, 5, 5], fov: 50 }}
          onPointerMissed={() => {}}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />
            
            <OrbitControls 
              enableDamping 
              enabled={tool !== 'grab'}
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
            
            {/* Ground plane for adding blobs */}
            <mesh 
              rotation={[-Math.PI / 2, 0, 0]} 
              position={[0, -0.01, 0]}
              onClick={handleCanvasClick}
              visible={tool === 'add'}
            >
              <planeGeometry args={[20, 20]} />
              <meshBasicMaterial color="white" opacity={0} transparent />
            </mesh>
            
            {/* Metaball system */}
            <MetaballSystem 
              balls={balls}
              onBallUpdate={updateBall}
              tool={tool}
              brushStrength={brushStrength}
              currentColor={currentColor}
            />
            
            {/* Physics */}
            <PhysicsSystem 
              balls={balls}
              onBallsUpdate={setBalls}
            />
            
            {/* Ball interaction handlers */}
            {tool === 'split' && balls.map(ball => (
              <mesh
                key={ball.id}
                position={ball.position}
                onClick={() => splitBall(ball.id)}
              >
                <sphereGeometry args={[ball.radius * 2, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            ))}
            
            {tool === 'paint' && balls.map(ball => (
              <mesh
                key={ball.id}
                position={ball.position}
                onClick={() => updateBall(ball.id, { color: new THREE.Color(currentColor) })}
              >
                <sphereGeometry args={[ball.radius * 2, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            ))}
            
            {tool === 'delete' && balls.map(ball => (
              <mesh
                key={ball.id}
                position={ball.position}
                onClick={() => setBalls(balls.filter(b => b.id !== ball.id))}
              >
                <sphereGeometry args={[ball.radius * 2, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            ))}
            
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
        
        {/* Status Display */}
        <div className="absolute top-4 right-4 bg-white p-2 rounded shadow text-sm">
          <p>Tool: {tool.charAt(0).toUpperCase() + tool.slice(1)}</p>
          <p>Blobs: {balls.length}</p>
        </div>
      </div>
    </div>
  )
}
