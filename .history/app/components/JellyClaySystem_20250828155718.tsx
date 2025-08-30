'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, Sphere, Line } from '@react-three/drei'
import { useRef, useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import * as THREE from 'three'

interface SoftBodyNode {
  id: string
  position: THREE.Vector3
  velocity: THREE.Vector3
  force: THREE.Vector3
  mass: number
  pinned: boolean
  color: THREE.Color
}

interface Spring {
  nodeA: string
  nodeB: string
  restLength: number
  stiffness: number
  damping: number
}

interface JellyBody {
  id: string
  nodes: SoftBodyNode[]
  springs: Spring[]
  centerPosition: THREE.Vector3
  color: string
}

// Individual jelly blob component
function JellyBlob({ body, onUpdate, tool, isSelected }: {
  body: JellyBody
  onUpdate: (body: JellyBody) => void
  tool: string
  isSelected: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const { raycaster, camera, pointer } = useThree()
  
  // Physics simulation
  useFrame((state, delta) => {
    if (!body.nodes.length) return
    
    const dt = Math.min(delta, 0.016) // Cap at 60fps
    
    // Reset forces
    body.nodes.forEach(node => {
      node.force.set(0, -9.8 * node.mass, 0) // Gravity
    })
    
    // Apply spring forces
    body.springs.forEach(spring => {
      const nodeA = body.nodes.find(n => n.id === spring.nodeA)
      const nodeB = body.nodes.find(n => n.id === spring.nodeB)
      
      if (nodeA && nodeB) {
        const diff = nodeB.position.clone().sub(nodeA.position)
        const distance = diff.length()
        const direction = diff.normalize()
        
        // Spring force
        const springForce = direction.multiplyScalar(
          spring.stiffness * (distance - spring.restLength)
        )
        
        // Damping force
        const relVelocity = nodeB.velocity.clone().sub(nodeA.velocity)
        const dampingForce = relVelocity.multiplyScalar(spring.damping)
        
        // Apply forces
        nodeA.force.add(springForce).add(dampingForce)
        nodeB.force.sub(springForce).sub(dampingForce)
      }
    })
    
    // Update positions
    body.nodes.forEach(node => {
      if (!node.pinned) {
        // Acceleration = force / mass
        const acceleration = node.force.clone().divideScalar(node.mass)
        
        // Update velocity
        node.velocity.add(acceleration.multiplyScalar(dt))
        
        // Damping
        node.velocity.multiplyScalar(0.99)
        
        // Update position
        node.position.add(node.velocity.clone().multiplyScalar(dt))
        
        // Ground collision
        if (node.position.y < 0.1) {
          node.position.y = 0.1
          node.velocity.y *= -0.5
          node.velocity.x *= 0.8
          node.velocity.z *= 0.8
        }
        
        // Bounds
        const bound = 8
        if (Math.abs(node.position.x) > bound) {
          node.position.x = Math.sign(node.position.x) * bound
          node.velocity.x *= -0.5
        }
        if (Math.abs(node.position.z) > bound) {
          node.position.z = Math.sign(node.position.z) * bound
          node.velocity.z *= -0.5
        }
      }
    })
    
    // Update center position
    body.centerPosition.set(0, 0, 0)
    body.nodes.forEach(node => {
      body.centerPosition.add(node.position)
    })
    body.centerPosition.divideScalar(body.nodes.length)
  })
  
  // Handle dragging
  const handlePointerDown = (e: any, nodeId: string) => {
    if (tool === 'grab') {
      e.stopPropagation()
      setDraggedNode(nodeId)
      const node = body.nodes.find(n => n.id === nodeId)
      if (node) {
        node.pinned = true
      }
    }
  }
  
  const handlePointerMove = (e: any) => {
    if (draggedNode && tool === 'grab') {
      const node = body.nodes.find(n => n.id === draggedNode)
      if (node) {
        node.position.copy(e.point)
        node.velocity.set(0, 0, 0)
      }
    }
  }
  
  const handlePointerUp = () => {
    if (draggedNode) {
      const node = body.nodes.find(n => n.id === draggedNode)
      if (node) {
        node.pinned = false
      }
      setDraggedNode(null)
    }
  }
  
  // Create mesh geometry - update every frame
  const meshGeometry = useRef(new THREE.BufferGeometry())
  
  useFrame(() => {
    if (body.nodes.length < 4) return
    
    const positions: number[] = []
    const indices: number[] = []
    
    // Update positions
    body.nodes.forEach(node => {
      positions.push(node.position.x, node.position.y, node.position.z)
    })
    
    // Simple icosphere-like triangulation
    if (meshGeometry.current.index === null || meshGeometry.current.index.count === 0) {
      // Only create indices once
      const n = body.nodes.length
      
      // Create triangles between nearby nodes
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          for (let k = j + 1; k < n; k++) {
            const a = body.nodes[i].position
            const b = body.nodes[j].position
            const c = body.nodes[k].position
            
            // Only create triangles for nearby nodes
            const ab = a.distanceTo(b)
            const bc = b.distanceTo(c)
            const ca = c.distanceTo(a)
            
            if (ab < 2.5 && bc < 2.5 && ca < 2.5) {
              indices.push(i, j, k)
            }
          }
        }
      }
      
      meshGeometry.current.setIndex(indices)
    }
    
    // Update positions
    meshGeometry.current.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    meshGeometry.current.attributes.position.needsUpdate = true
    meshGeometry.current.computeVertexNormals()
  })
  
  return (
    <group 
      ref={groupRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Render springs as lines */}
      {tool === 'grab' && body.springs.map((spring, i) => {
        const nodeA = body.nodes.find(n => n.id === spring.nodeA)
        const nodeB = body.nodes.find(n => n.id === spring.nodeB)
        if (!nodeA || !nodeB) return null
        
        return (
          <Line
            key={i}
            points={[nodeA.position, nodeB.position]}
            color="#666666"
            lineWidth={1}
            opacity={0.3}
            transparent
          />
        )
      })}
      
      {/* Render nodes */}
      {body.nodes.map(node => (
        <Sphere
          key={node.id}
          args={[0.1, 8, 8]}
          position={node.position}
          onPointerDown={(e) => handlePointerDown(e, node.id)}
        >
          <meshPhongMaterial 
            color={node.color}
            transparent
            opacity={tool === 'grab' ? 0.8 : 0}
          />
        </Sphere>
      ))}
      
      {/* Render mesh */}
      {body.nodes.length >= 4 && (
        <mesh geometry={meshGeometry.current}>
          <meshPhongMaterial
            color={body.color}
            specular={0x222222}
            shininess={80}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

export default function JellyClaySystem() {
  const [bodies, setBodies] = useState<JellyBody[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<'add' | 'grab' | 'stretch' | 'merge' | 'split' | 'paint' | 'delete'>('add')
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [bodySize, setBodySize] = useState(1)
  const [stiffness, setStiffness] = useState(50)
  const [projectName, setProjectName] = useState('Jelly Sculpture')
  
  // Create a new jelly body
  const createJellyBody = (position: THREE.Vector3, size: number = 1, color: string = currentColor): JellyBody => {
    const nodes: SoftBodyNode[] = []
    const springs: Spring[] = []
    
    // Create nodes in a roughly spherical arrangement
    const nodeCount = 12
    const id = `body-${Date.now()}`
    
    // Center node
    nodes.push({
      id: `${id}-center`,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      force: new THREE.Vector3(),
      mass: 0.5,
      pinned: false,
      color: new THREE.Color(color)
    })
    
    // Outer nodes
    for (let i = 0; i < nodeCount; i++) {
      const theta = (i / nodeCount) * Math.PI * 2
      const phi = Math.acos(2 * (i / nodeCount) - 1)
      
      const x = Math.sin(phi) * Math.cos(theta) * size
      const y = Math.sin(phi) * Math.sin(theta) * size
      const z = Math.cos(phi) * size
      
      nodes.push({
        id: `${id}-${i}`,
        position: position.clone().add(new THREE.Vector3(x, y, z)),
        velocity: new THREE.Vector3(),
        force: new THREE.Vector3(),
        mass: 0.1,
        pinned: false,
        color: new THREE.Color(color)
      })
    }
    
    // Create springs between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const distance = nodes[i].position.distanceTo(nodes[j].position)
        
        // Only connect nearby nodes
        if (distance < size * 2.5) {
          springs.push({
            nodeA: nodes[i].id,
            nodeB: nodes[j].id,
            restLength: distance,
            stiffness: stiffness,
            damping: 2
          })
        }
      }
    }
    
    return {
      id,
      nodes,
      springs,
      centerPosition: position.clone(),
      color
    }
  }
  
  const handleCanvasClick = (event: any) => {
    if (tool === 'add' && event.point) {
      const newBody = createJellyBody(
        new THREE.Vector3(event.point.x, event.point.y + bodySize, event.point.z),
        bodySize,
        currentColor
      )
      setBodies([...bodies, newBody])
    }
  }
  
  const splitBody = (bodyId: string) => {
    const body = bodies.find(b => b.id === bodyId)
    if (!body) return
    
    const newBodies: JellyBody[] = []
    const halfNodes = Math.floor(body.nodes.length / 2)
    
    // Split nodes into two groups
    const group1Nodes = body.nodes.slice(0, halfNodes)
    const group2Nodes = body.nodes.slice(halfNodes)
    
    // Create two new bodies
    for (const [index, nodeGroup] of [group1Nodes, group2Nodes].entries()) {
      const center = new THREE.Vector3()
      nodeGroup.forEach(node => center.add(node.position))
      center.divideScalar(nodeGroup.length)
      
      // Add some separation force
      const separation = new THREE.Vector3(
        (index === 0 ? -1 : 1) * 0.5,
        0.5,
        (Math.random() - 0.5) * 0.5
      )
      
      nodeGroup.forEach(node => {
        node.velocity.add(separation)
      })
      
      const newBody: JellyBody = {
        id: `${body.id}-split-${index}`,
        nodes: nodeGroup,
        springs: body.springs.filter(spring => 
          nodeGroup.some(n => n.id === spring.nodeA) &&
          nodeGroup.some(n => n.id === spring.nodeB)
        ),
        centerPosition: center,
        color: body.color
      }
      
      newBodies.push(newBody)
    }
    
    setBodies(bodies.filter(b => b.id !== bodyId).concat(newBodies))
  }
  
  const mergeNearbyBodies = useCallback(() => {
    const mergeDistance = 2
    const toMerge: Set<string> = new Set()
    
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const distance = bodies[i].centerPosition.distanceTo(bodies[j].centerPosition)
        if (distance < mergeDistance) {
          toMerge.add(bodies[i].id)
          toMerge.add(bodies[j].id)
        }
      }
    }
    
    if (toMerge.size > 0) {
      const mergedBodies = bodies.filter(b => toMerge.has(b.id))
      const otherBodies = bodies.filter(b => !toMerge.has(b.id))
      
      // Combine all nodes and springs
      const allNodes: SoftBodyNode[] = []
      const allSprings: Spring[] = []
      
      mergedBodies.forEach(body => {
        allNodes.push(...body.nodes)
        allSprings.push(...body.springs)
      })
      
      // Create new springs between bodies
      for (let i = 0; i < mergedBodies.length - 1; i++) {
        const body1 = mergedBodies[i]
        const body2 = mergedBodies[i + 1]
        
        // Connect closest nodes
        let minDist = Infinity
        let closestPair: [SoftBodyNode, SoftBodyNode] | null = null
        
        body1.nodes.forEach(n1 => {
          body2.nodes.forEach(n2 => {
            const dist = n1.position.distanceTo(n2.position)
            if (dist < minDist) {
              minDist = dist
              closestPair = [n1, n2]
            }
          })
        })
        
        if (closestPair) {
          allSprings.push({
            nodeA: closestPair[0].id,
            nodeB: closestPair[1].id,
            restLength: minDist,
            stiffness: stiffness * 0.5,
            damping: 2
          })
        }
      }
      
      const center = new THREE.Vector3()
      allNodes.forEach(node => center.add(node.position))
      center.divideScalar(allNodes.length)
      
      const mergedBody: JellyBody = {
        id: `merged-${Date.now()}`,
        nodes: allNodes,
        springs: allSprings,
        centerPosition: center,
        color: mergedBodies[0].color
      }
      
      setBodies([...otherBodies, mergedBody])
    }
  }, [bodies, stiffness])
  
  // Check for merging periodically
  useEffect(() => {
    if (tool === 'merge') {
      const interval = setInterval(mergeNearbyBodies, 500)
      return () => clearInterval(interval)
    }
  }, [tool, mergeNearbyBodies])
  
  // Save/Load
  const saveProject = () => {
    const data = {
      name: projectName,
      bodies: bodies.map(body => ({
        id: body.id,
        color: body.color,
        nodes: body.nodes.map(node => ({
          id: node.id,
          position: node.position.toArray(),
          velocity: node.velocity.toArray(),
          mass: node.mass,
          color: node.color.getHex()
        })),
        springs: body.springs
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
        setBodies(data.bodies.map((b: any) => ({
          ...b,
          nodes: b.nodes.map((n: any) => ({
            ...n,
            position: new THREE.Vector3(...n.position),
            velocity: new THREE.Vector3(...n.velocity),
            force: new THREE.Vector3(),
            color: new THREE.Color(n.color),
            pinned: false
          })),
          centerPosition: new THREE.Vector3()
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
        <h2 className="text-xl font-bold mb-4">Soft Body Jelly Clay</h2>
        
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
              Grab & Stretch
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
        
        {/* Jelly Settings */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Jelly Properties</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs">Size: {bodySize.toFixed(1)}</label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={bodySize}
                onChange={(e) => setBodySize(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs">Stiffness: {stiffness}</label>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={stiffness}
                onChange={(e) => setStiffness(parseInt(e.target.value))}
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
              if (confirm('Clear all jellies?')) setBodies([])
            }}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear All
          </button>
        </div>
        
        {/* Stats */}
        <div className="mt-6 p-3 bg-gray-100 rounded text-xs">
          <p>Jellies: {bodies.length}</p>
          <p>Total Nodes: {bodies.reduce((sum, b) => sum + b.nodes.length, 0)}</p>
          <p>Physics: Soft Body</p>
        </div>
        
        {/* Instructions */}
        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">How to Use:</p>
          <p>• Add: Click ground to drop jelly</p>
          <p>• Grab: Drag any point to stretch</p>
          <p>• Split: Click jelly to split in two</p>
          <p>• Merge: Jellies auto-merge when close</p>
          <p>• Real soft-body physics!</p>
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
            
            {/* Jelly bodies */}
            {bodies.map(body => (
              <JellyBlob
                key={body.id}
                body={body}
                onUpdate={(updatedBody) => {
                  setBodies(bodies.map(b => b.id === updatedBody.id ? updatedBody : b))
                }}
                tool={tool}
                isSelected={selectedId === body.id}
              />
            ))}
            
            {/* Interaction handlers */}
            {tool === 'split' && bodies.map(body => (
              <mesh
                key={body.id}
                position={body.centerPosition}
                onClick={() => splitBody(body.id)}
              >
                <sphereGeometry args={[bodySize * 1.5, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            ))}
            
            {tool === 'paint' && bodies.map(body => (
              <mesh
                key={body.id}
                position={body.centerPosition}
                onClick={() => {
                  body.color = currentColor
                  body.nodes.forEach(node => {
                    node.color = new THREE.Color(currentColor)
                  })
                  setBodies([...bodies])
                }}
              >
                <sphereGeometry args={[bodySize * 1.5, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            ))}
            
            {tool === 'delete' && bodies.map(body => (
              <mesh
                key={body.id}
                position={body.centerPosition}
                onClick={() => setBodies(bodies.filter(b => b.id !== body.id))}
              >
                <sphereGeometry args={[bodySize * 1.5, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            ))}
            
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
        
        {/* Status */}
        <div className="absolute top-4 right-4 bg-white p-2 rounded shadow text-sm">
          <p>Tool: {tool.charAt(0).toUpperCase() + tool.slice(1)}</p>
          <p>Jellies: {bodies.length}</p>
        </div>
      </div>
    </div>
  )
}
