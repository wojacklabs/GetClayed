'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'

// Loading fallback
function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-800 to-red-900">
      <div className="text-white text-2xl font-bold animate-pulse">Loading Library Asset...</div>
    </div>
  )
}

// Simple clay renderer for view-only mode
function ViewOnlyClay({ clay }: { clay: any }) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  return (
    <mesh
      ref={meshRef}
      geometry={clay.geometry}
      position={clay.position}
      rotation={clay.rotation}
      scale={clay.scale instanceof THREE.Vector3 ? [clay.scale.x, clay.scale.y, clay.scale.z] : clay.scale || 1}
    >
      <meshPhongMaterial 
        color={clay.color}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Asset info overlay
function AssetInfoOverlay({ name, author, royaltyETH, royaltyUSDC }: { 
  name: string; 
  author: string;
  royaltyETH?: number;
  royaltyUSDC?: number;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
      <div className="mb-3">
        <span className="bg-pink-500 text-white text-sm font-bold px-3 py-1 rounded-full">
          LIBRARY ASSET
        </span>
      </div>
      <h1 className="text-white text-4xl font-bold mb-2 drop-shadow-lg">{name}</h1>
      <p className="text-gray-300 text-lg drop-shadow-md mb-2">
        by {author.slice(0, 6)}...{author.slice(-4)}
      </p>
      {(royaltyETH || royaltyUSDC) && (
        <div className="flex gap-4 text-white">
          {royaltyETH && <span>💎 {royaltyETH} ETH</span>}
          {royaltyUSDC && <span>💵 {royaltyUSDC} USDC</span>}
        </div>
      )}
    </div>
  )
}

// GetClayed branding
function Branding() {
  return (
    <div className="absolute top-6 right-6 text-white text-xl font-medium opacity-90">
      GetClayed
    </div>
  )
}

export default function OGViewerLibraryPage() {
  const params = useParams()
  const assetId = params.id as string
  
  const [asset, setAsset] = useState<any>(null)
  const [clayObjects, setClayObjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    async function loadAsset() {
      try {
        setLoading(true)
        
        // Fetch asset data from Irys
        const IRYS_DATA_URL = `https://uploader.irys.xyz/tx/${assetId}/data`
        const response = await fetch(IRYS_DATA_URL)
        
        if (!response.ok) {
          throw new Error('Failed to fetch asset data')
        }
        
        const assetData = await response.json()
        setAsset(assetData)
        
        // Reconstruct clay objects with proper geometry - correct field name is 'clays'
        const objects = (assetData.clays || []).map((obj: any) => {
          let geometry: THREE.BufferGeometry
          
          // Reconstruct geometry
          if (obj.geometryData) {
            geometry = new THREE.BufferGeometry()
            
            // Restore attributes
            if (obj.geometryData.attributes) {
              Object.entries(obj.geometryData.attributes).forEach(([name, data]: [string, any]) => {
                geometry.setAttribute(
                  name,
                  new THREE.BufferAttribute(new Float32Array(data.array), data.itemSize)
                )
              })
            }
            
            // Restore index if present
            if (obj.geometryData.index) {
              geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(obj.geometryData.index.array), 1))
            }
            
            geometry.computeVertexNormals()
          } else {
            // Fallback to basic shapes
            switch(obj.type) {
              case 'box':
                geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4)
                break
              case 'cylinder':
                geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 8)
                break
              case 'cone':
                geometry = new THREE.ConeGeometry(0.5, 1, 32, 8)
                break
              case 'torus':
                geometry = new THREE.TorusGeometry(0.7, 0.3, 16, 100)
                break
              case 'sphere':
              default:
                geometry = new THREE.SphereGeometry(1, 32, 32)
                break
            }
          }
          
          return {
            ...obj,
            geometry,
            position: new THREE.Vector3(
              obj.position?.x || 0,
              obj.position?.y || 0,
              obj.position?.z || 0
            ),
            rotation: new THREE.Euler(
              obj.rotation?._x || obj.rotation?.x || 0,
              obj.rotation?._y || obj.rotation?.y || 0,
              obj.rotation?._z || obj.rotation?.z || 0
            ),
            scale: obj.scale || 1,
          }
        })
        
        setClayObjects(objects)
        setLoading(false)
      } catch (err) {
        console.error('Error loading asset:', err)
        setError(err instanceof Error ? err.message : 'Failed to load asset')
        setLoading(false)
      }
    }
    
    loadAsset()
  }, [assetId])
  
  if (loading) {
    return <LoadingFallback />
  }
  
  if (error || !asset) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-800 to-red-900">
        <div className="text-white text-2xl font-bold">
          {error || 'Asset not found'}
        </div>
      </div>
    )
  }
  
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ width: '1200px', height: '630px', margin: 0, padding: 0 }}>
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <Canvas
          camera={{
            position: [10, 10, 10],
            fov: 60,
            near: 0.1,
            far: 1000
          }}
          style={{ background: 'linear-gradient(135deg, #831843 0%, #dc2626 100%)' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} />
          <Environment preset="studio" />
          
          <OrbitControls 
            ref={controlsRef}
            enableZoom={false}
            enablePan={false}
            autoRotate={true}
            autoRotateSpeed={2}
          />
          
          {/* Render clay objects */}
          {clayObjects.map((clay, index) => (
            <ViewOnlyClay key={clay.id || index} clay={clay} />
          ))}
        </Canvas>
      </div>
      
      {/* Asset info overlay */}
      <AssetInfoOverlay 
        name={asset.name || 'Untitled Asset'} 
        author={asset.author || asset.creator || 'Unknown'}
        royaltyETH={asset.royaltyETH}
        royaltyUSDC={asset.royaltyUSDC}
      />
      
      {/* Branding */}
      <Branding />
    </div>
  )
}

