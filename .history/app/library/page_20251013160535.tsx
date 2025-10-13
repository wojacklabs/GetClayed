'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ShoppingCart, Eye, TrendingUp, DollarSign, User, X } from 'lucide-react'
import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { queryLibraryAssets, purchaseLibraryAssetWithETH, purchaseLibraryAssetWithUSDC, LibraryAsset } from '@/lib/libraryService'
import { downloadClayProject, restoreClayObjects, downloadProjectThumbnail } from '@/lib/clayStorageService'
import { ConnectWallet } from '@/components/ConnectWallet'
import { usePopup } from '@/components/PopupNotification'
import { AnimatedClayLogo } from '@/components/AnimatedClayLogo'
import { TrackballControls } from '@react-three/drei'
import * as THREE from 'three'

// Simple clay renderer for preview
function PreviewClay({ clay }: { clay: any }) {
  return (
    <mesh
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

export default function LibraryPage() {
  const router = useRouter()
  const [assets, setAssets] = useState<LibraryAsset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<LibraryAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'price'>('recent')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map())
  const { showPopup } = usePopup()
  
  useEffect(() => {
    loadLibraryAssets()
  }, [])
  
  useEffect(() => {
    filterAndSortAssets()
  }, [assets, searchQuery, sortBy])
  
  const loadLibraryAssets = async () => {
    try {
      setLoading(true)
      const libraryAssets = await queryLibraryAssets(100)
      setAssets(libraryAssets)
      
      // Load thumbnails
      const thumbMap = new Map<string, string>()
      for (const asset of libraryAssets) {
        if (asset.thumbnailId) {
          try {
            const thumb = await downloadProjectThumbnail(asset.thumbnailId)
            if (thumb) thumbMap.set(asset.projectId, thumb)
          } catch (error) {
            console.error('Failed to load thumbnail:', error)
          }
        }
      }
      setThumbnails(thumbMap)
    } catch (error) {
      console.error('Failed to load library assets:', error)
      showPopup('Failed to load library', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  const filterAndSortAssets = () => {
    let filtered = [...assets]
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(asset =>
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Sort
    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => b.listedAt - a.listedAt)
        break
      case 'popular':
        filtered.sort((a, b) => b.purchaseCount - a.purchaseCount)
        break
      case 'price':
        filtered.sort((a, b) => {
          const priceA = parseFloat(a.priceETH || a.priceUSDC || '0')
          const priceB = parseFloat(b.priceETH || b.priceUSDC || '0')
          return priceA - priceB
        })
        break
    }
    
    setFilteredAssets(filtered)
  }
  
  const handlePreview = async (asset: LibraryAsset) => {
    setPreviewAsset(asset)
    setPreviewLoading(true)
    try {
      const project = await downloadClayProject(asset.projectId)
      setPreviewProject(project)
    } catch (error) {
      console.error('Failed to load preview:', error)
      showPopup('Failed to load preview', 'error')
    } finally {
      setPreviewLoading(false)
    }
  }
  
  const handlePurchase = async (asset: LibraryAsset, paymentToken: 'ETH' | 'USDC') => {
    if (!walletAddress) {
      showPopup('Please connect your wallet', 'warning')
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
        showPopup('Asset purchased successfully!', 'success')
        setPreviewAsset(null)
        loadLibraryAssets() // Refresh
      } else {
        showPopup(result.error || 'Purchase failed', 'error')
      }
    } catch (error: any) {
      showPopup(error.message || 'Purchase failed', 'error')
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
              <div className="w-10 h-10">
                <Canvas
                  camera={{ position: [0, 0, 2], fov: 50 }}
                  style={{ background: 'transparent' }}
                >
                  <Suspense fallback={null}>
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[5, 5, 5]} intensity={0.5} />
                    <AnimatedClayLogo />
                  </Suspense>
                </Canvas>
              </div>
            </Link>
            
            {/* Search */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search library..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pr-10 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
            
            {/* Connect Wallet */}
            <ConnectWallet
              onConnect={setWalletAddress}
              onDisconnect={() => setWalletAddress(null)}
            />
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Library</h1>
            
            {/* Sort Options */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortBy('recent')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  sortBy === 'recent' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  sortBy === 'popular' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Popular
              </button>
              <button
                onClick={() => setSortBy('price')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  sortBy === 'price' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Price
              </button>
            </div>
          </div>
          
          {/* Assets Grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg overflow-hidden animate-pulse border border-gray-200">
                  <div className="aspect-square bg-gray-200" />
                  <div className="p-3">
                    <div className="h-4 bg-gray-200 rounded mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No assets found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredAssets.map((asset) => (
                <Link 
                  key={asset.projectId} 
                  href={`/library/${asset.projectId}`}
                  className="bg-white rounded-lg overflow-hidden hover:shadow-md transition-shadow border border-gray-200 group block"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {thumbnails.get(asset.projectId) ? (
                      <img
                        src={thumbnails.get(asset.projectId)}
                        alt={asset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-2xl font-bold text-gray-300">3D</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 truncate mb-1">{asset.name}</h3>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        {asset.purchaseCount}
                      </span>
                      <div className="text-right text-xs font-semibold text-gray-900">
                        {parseFloat(asset.priceETH || '0') > 0 && <div>{asset.priceETH} ETH</div>}
                        {parseFloat(asset.priceUSDC || '0') > 0 && <div>{asset.priceUSDC} USDC</div>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      
      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setPreviewAsset(null)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{previewAsset.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{previewAsset.description}</p>
              </div>
              <button
                onClick={() => setPreviewAsset(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Preview Canvas */}
            <div className="flex-1 bg-gray-100 relative min-h-[400px]">
              {previewLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
                </div>
              ) : previewProject ? (
                <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
                  <Suspense fallback={null}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[10, 10, 5]} intensity={0.8} />
                    <directionalLight position={[-10, -10, -5]} intensity={0.3} />
                    
                    {restoreClayObjects(previewProject).map((clay, index) => (
                      <PreviewClay key={index} clay={clay} />
                    ))}
                    
                    <TrackballControls />
                  </Suspense>
                </Canvas>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-gray-500">Failed to load preview</p>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500">Price</p>
                  <div className="space-y-1">
                    {parseFloat(previewAsset.priceETH || '0') > 0 && (
                      <p className="text-lg font-bold text-gray-900">{previewAsset.priceETH} ETH</p>
                    )}
                    {parseFloat(previewAsset.priceUSDC || '0') > 0 && (
                      <p className="text-lg font-bold text-gray-900">{previewAsset.priceUSDC} USDC</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Purchases</p>
                  <p className="text-lg font-semibold text-gray-900">{previewAsset.purchaseCount}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setPreviewAsset(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                {parseFloat(previewAsset.priceETH || '0') > 0 && (
                  <button
                    onClick={() => handlePurchase(previewAsset, 'ETH')}
                    disabled={!walletAddress}
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={16} />
                    Buy with ETH
                  </button>
                )}
                {parseFloat(previewAsset.priceUSDC || '0') > 0 && (
                  <button
                    onClick={() => handlePurchase(previewAsset, 'USDC')}
                    disabled={!walletAddress}
                    className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={16} />
                    Buy with USDC
                  </button>
                )}
              </div>
              
              {!walletAddress && (
                <p className="text-xs text-gray-500 text-center mt-2">Connect wallet to purchase</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

