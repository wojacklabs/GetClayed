'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, ShoppingCart, TrendingUp, User, Calendar } from 'lucide-react'
import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { TrackballControls } from '@react-three/drei'
import * as THREE from 'three'
import { queryLibraryAssets, purchaseLibraryAssetWithETH, purchaseLibraryAssetWithUSDC, LibraryAsset } from '@/lib/libraryService'
import { downloadClayProject, restoreClayObjects, downloadProjectThumbnail } from '@/lib/clayStorageService'
import { ConnectWallet } from '@/components/ConnectWallet'
import { usePopup } from '@/components/PopupNotification'
import { AnimatedClayLogo } from '@/components/AnimatedClayLogo'

function PreviewClay({ clay }: { clay: any }) {
  return (
    <mesh
      geometry={clay.geometry}
      position={clay.position}
      rotation={clay.rotation}
      scale={clay.scale instanceof THREE.Vector3 ? [clay.scale.x, clay.scale.y, clay.scale.z] : clay.scale || 1}
    >
      <meshPhongMaterial color={clay.color} side={THREE.DoubleSide} />
    </mesh>
  )
}

export default function LibraryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const assetId = params.id as string
  
  const [asset, setAsset] = useState<LibraryAsset | null>(null)
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const { showPopup } = usePopup()
  
  useEffect(() => {
    loadAssetDetail()
  }, [assetId])
  
  const loadAssetDetail = async () => {
    try {
      setLoading(true)
      
      // Find asset
      const assets = await queryLibraryAssets(1000)
      const foundAsset = assets.find(a => a.projectId === assetId)
      
      if (!foundAsset) {
        showPopup('Asset not found', 'error')
        router.push('/library')
        return
      }
      
      setAsset(foundAsset)
      
      // Load project data
      const projectData = await downloadClayProject(assetId)
      setProject(projectData)
      
      // Load thumbnail
      if (foundAsset.thumbnailId) {
        const thumb = await downloadProjectThumbnail(foundAsset.thumbnailId)
        if (thumb) setThumbnail(thumb)
      }
    } catch (error) {
      console.error('Failed to load asset:', error)
      showPopup('Failed to load asset', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  const handlePurchase = async (paymentToken: 'ETH' | 'USDC') => {
    if (!walletAddress || !asset) {
      showPopup('Please connect wallet', 'warning')
      return
    }
    
    try {
      let result;
      if (paymentToken === 'ETH') {
        result = await purchaseLibraryAssetWithETH(asset.projectId, parseFloat(asset.priceETH))
      } else {
        result = await purchaseLibraryAssetWithUSDC(asset.projectId, parseFloat(asset.priceUSDC))
      }
      
      if (result.success) {
        showPopup('Purchase successful!', 'success')
        loadAssetDetail()
      } else {
        showPopup(result.error || 'Purchase failed', 'error')
      }
    } catch (error: any) {
      showPopup(error.message || 'Purchase failed', 'error')
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
      </div>
    )
  }
  
  if (!asset) {
    return null
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-700 hover:text-gray-900">
              <ArrowLeft size={20} />
            </button>
            
            <Link href="/" className="absolute left-1/2 -translate-x-1/2">
              <div className="w-10 h-10">
                <Canvas camera={{ position: [0, 0, 2], fov: 50 }} style={{ background: 'transparent' }}>
                  <Suspense fallback={null}>
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[5, 5, 5]} intensity={0.5} />
                    <AnimatedClayLogo />
                  </Suspense>
                </Canvas>
              </div>
            </Link>
            
            <ConnectWallet onConnect={setWalletAddress} onDisconnect={() => setWalletAddress(null)} />
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="aspect-square bg-gray-100">
              {project ? (
                <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
                  <Suspense fallback={null}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[10, 10, 5]} intensity={0.8} />
                    {restoreClayObjects(project).map((clay, index) => (
                      <PreviewClay key={index} clay={clay} />
                    ))}
                    <TrackballControls />
                  </Suspense>
                </Canvas>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-2xl font-bold text-gray-300">3D</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{asset.name}</h1>
              <p className="text-gray-600 mb-4">{asset.description || 'No description'}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500">ETH Price</p>
                  <p className="text-xl font-bold text-gray-900">{asset.priceETH || '0'} ETH</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">USDC Price</p>
                  <p className="text-xl font-bold text-gray-900">{asset.priceUSDC || '0'} USDC</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-6">
                <span className="flex items-center gap-1">
                  <TrendingUp size={16} />
                  {asset.purchaseCount} purchases
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={16} />
                  {new Date(asset.listedAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-1">Creator</p>
                <Link 
                  href={`/user/${asset.originalCreator}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {asset.originalCreator.slice(0, 6)}...{asset.originalCreator.slice(-4)}
                </Link>
              </div>
              
              {/* Purchase Buttons */}
              <div className="flex gap-3">
                {parseFloat(asset.priceETH || '0') > 0 && (
                  <button
                    onClick={() => handlePurchase('ETH')}
                    disabled={!walletAddress}
                    className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={20} />
                    Buy with ETH
                  </button>
                )}
                {parseFloat(asset.priceUSDC || '0') > 0 && (
                  <button
                    onClick={() => handlePurchase('USDC')}
                    disabled={!walletAddress}
                    className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={20} />
                    Buy with USDC
                  </button>
                )}
              </div>
              
              {!walletAddress && (
                <p className="text-xs text-gray-500 text-center mt-3">Connect wallet to purchase</p>
              )}
            </div>
            
            {/* Dependencies (if any) */}
            {project?.usedLibraries && project.usedLibraries.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Uses Library Assets</h3>
                <div className="space-y-3">
                  {project.usedLibraries.map((lib: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{lib.name}</p>
                        <p className="text-xs text-gray-500">
                          Royalty: {(parseFloat(lib.priceETH || lib.priceUSDC || '0') * 0.1).toFixed(4)} {lib.priceETH ? 'ETH' : 'USDC'}
                        </p>
                      </div>
                      <Link
                        href={`/library/${lib.projectId}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Total royalties: {(project.usedLibraries.reduce((sum: number, lib: any) => sum + parseFloat(lib.priceETH || '0'), 0) * 0.1).toFixed(4)} ETH
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

