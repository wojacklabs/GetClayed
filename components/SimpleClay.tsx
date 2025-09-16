'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Minus, Plus } from 'lucide-react'

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
    
    // Gentle rotation
    meshRef.current.rotation.y += delta * 0.3
    
    // Hover effect
    if (hovered) {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.05
    } else {
      meshRef.current.position.y = 0
    }
  })
  
  return (
    <mesh
      ref={meshRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial 
        color={hovered ? "#ff6b6b" : "#ee5a52"}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  )
}

function Scene({ scale }: { scale: number }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#6366f1" />
      <Clay scale={scale} />
      <OrbitControls 
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.5}
      />
    </>
  )
}

export default function SimpleClay() {
  const [scale, setScale] = useState(1)
  const minScale = 0.5
  const maxScale = 2
  
  const handleScaleChange = (delta: number) => {
    setScale(prev => Math.max(minScale, Math.min(maxScale, prev + delta)))
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-900">Clay</h2>
      
      <div className="flex flex-col items-center">
        {/* 3D Canvas */}
        <div className="w-64 h-64 mb-4 rounded-lg overflow-hidden bg-gray-50 border border-gray-200">
          <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
            <Scene scale={scale} />
          </Canvas>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleScaleChange(-0.1)}
            disabled={scale <= minScale}
            className={`p-2 rounded-lg transition-all ${
              scale <= minScale 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
            title="Shrink"
          >
            <Minus size={20} />
          </button>
          
          <div className="text-sm text-gray-600 min-w-[80px] text-center">
            Size: {(scale * 100).toFixed(0)}%
          </div>
          
          <button
            onClick={() => handleScaleChange(0.1)}
            disabled={scale >= maxScale}
            className={`p-2 rounded-lg transition-all ${
              scale >= maxScale 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
            title="Grow"
          >
            <Plus size={20} />
          </button>
        </div>
        
        <p className="text-xs text-gray-500 mt-4 text-center">
          Click and drag to rotate • Use buttons to resize
        </p>
      </div>
    </div>
  )
}
