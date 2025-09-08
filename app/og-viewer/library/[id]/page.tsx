'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { downloadClayProject, restoreClayObjects } from '../../../../lib/clayStorageService'

// Loading fallback with canvas so Puppeteer doesn't timeout
function LoadingFallback() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900">
      {/* Hidden canvas for Puppeteer to detect */}
      <canvas style={{ opacity: 0, position: 'absolute' }} />
      <div className="w-full h-full flex items-center justify-center">
      <div className="text-white text-2xl font-bold animate-pulse">Loading Library Asset...</div>
      </div>
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
        console.log('[OG Viewer Library] Loading asset:', assetId)
        
        // Use the same function as ProjectDetailView for consistency
        const assetData = await downloadClayProject(assetId)
        console.log('[OG Viewer Library] Asset loaded:', assetData.name, 'clays:', assetData.clays?.length)
        
        setAsset(assetData)
        
        // Restore clay objects with proper geometry
        const restoredObjects = restoreClayObjects(assetData)
        console.log('[OG Viewer Library] Restored objects:', restoredObjects.length)
        
        setClayObjects(restoredObjects)
        setLoading(false)
      } catch (err) {
        console.error('[OG Viewer Library] Error loading asset:', err)
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
      <div className="w-full h-full flex items-center justify-center bg-slate-800">
        <div className="text-white text-2xl font-bold">
          {error || 'Asset not found'}
        </div>
      </div>
    )
  }
  
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ width: '1200px', height: '800px', margin: 0, padding: 0 }}>
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <Canvas
          camera={{
            position: [14, 7, 14],
            fov: 50,
            near: 0.1,
            far: 1000
          }}
          style={{ background: asset.backgroundColor || '#1e293b' }}
        >
          <ambientLight intensity={0.35} />
          <directionalLight position={[8, 12, 8]} intensity={1.2} />
          <directionalLight position={[-6, 4, -6]} intensity={0.5} />
          <directionalLight position={[0, -8, 4]} intensity={0.25} />
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

