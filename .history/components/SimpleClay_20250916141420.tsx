'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Move3d, ZoomIn, ZoomOut } from 'lucide-react'

function Clay({ scale }: { scale: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const targetScale = useRef(scale)
  const currentScale = useRef(scale)
  
  useEffect(() => {
    targetScale.current = scale
  }, [scale])
  
  useFrame((state, delta) => {
    if (!meshRef.current) return
    
    // Smooth scale transition
    currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale.current, 0.1)
    meshRef.current.scale.setScalar(currentScale.current)
  })
  
  // Generate color based on position (like project creation page)
  const color = new THREE.Color()
  color.setHSL(0.05, 0.7, 0.6) // Orange-red hue like project page
  
  return (
    <mesh
      ref={meshRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      castShadow
      receiveShadow
    >
      <sphereGeometry args={[1, 48, 48]} />
      <meshStandardMaterial 
        color={color}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  )
}

function Scene({ scale }: { scale: number }) {
  return (
    <>
      {/* Better lighting setup for visible rotation */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} color="#a0a0ff" />
      <pointLight position={[0, 10, 0]} intensity={0.2} />
      
      {/* Grid helper for better depth perception */}
      <gridHelper args={[10, 10, 0x888888, 0xcccccc]} position={[0, -2, 0]} />
      
      <Clay scale={scale} />
      <OrbitControls 
        enablePan={false}
        enableZoom={false}
        minDistance={3}
        maxDistance={10}
      />
    </>
  )
}

export default function SimpleClay() {
  const [scale, setScale] = useState(1)
  const minScale = 0.3
  const maxScale = 3
  
  const handleScaleChange = (delta: number) => {
    setScale(prev => Math.max(minScale, Math.min(maxScale, prev + delta)))
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Clay</h2>
          
          {/* Controls in header */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 mr-2">Push / Pull:</span>
            <button
              onClick={() => handleScaleChange(-0.2)}
              disabled={scale <= minScale}
              className={`p-1.5 rounded transition-all ${
                scale <= minScale 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              title="Push (Shrink)"
            >
              <ZoomOut size={16} />
            </button>
            
            <span className="text-xs text-gray-600 min-w-[50px] text-center font-mono">
              {(scale * 100).toFixed(0)}%
            </span>
            
            <button
              onClick={() => handleScaleChange(0.2)}
              disabled={scale >= maxScale}
              className={`p-1.5 rounded transition-all ${
                scale >= maxScale 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
              title="Pull (Grow)"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Full width canvas */}
      <div className="w-full h-80 bg-gradient-to-b from-gray-50 to-gray-100 relative">
        <Canvas 
          camera={{ position: [4, 3, 5], fov: 50 }}
          shadows
        >
          <Scene scale={scale} />
        </Canvas>
        
        {/* Instruction overlay */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg">
          <Move3d size={14} />
          <span>Click and drag to rotate</span>
        </div>
      </div>
    </div>
  )
}
