'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Search, TrendingUp, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { queryLibraryAssets, LibraryAsset } from '@/lib/libraryService'
import { downloadProjectThumbnail } from '@/lib/clayStorageService'
import { ConnectWallet } from '@/components/ConnectWallet'
import { usePopup } from '@/components/PopupNotification'
import { AnimatedClayLogo } from '@/components/AnimatedClayLogo'
import MiniViewer from '@/components/MiniViewer'

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
        filtered.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'price':
        filtered.sort((a, b) => {
          const priceA = parseFloat(a.royaltyPerImportETH || a.royaltyPerImportUSDC || '0')
          const priceB = parseFloat(b.royaltyPerImportETH || b.royaltyPerImportUSDC || '0')
          return priceA - priceB
        })
        break
    }
    
    setFilteredAssets(filtered)
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
                  className="w-full px-3 py-2 sm:px-4 pr-10 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 border border-gray-200"
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
            {/* Desktop: Button Group, Mobile: Select */}
            <div className="hidden sm:flex items-center gap-2">
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
            {/* Mobile Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'price')}
              className="sm:hidden px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="recent">Recent</option>
              <option value="popular">Popular</option>
              <option value="price">Price</option>
            </select>
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
                  {/* 3D Preview */}
                  <MiniViewer 
                    projectId={asset.tags?.['Transaction-ID'] || asset.projectId}
                    className="aspect-square"
                  />
                  
                  {/* Content */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 truncate mb-1">{asset.name}</h3>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <TrendingUp size={12} />
                        Royalty
                      </span>
                      <div className="text-right text-xs font-semibold text-gray-900">
                        {parseFloat(asset.royaltyPerImportETH || '0') > 0 && <div>{asset.royaltyPerImportETH} ETH</div>}
                        {parseFloat(asset.royaltyPerImportUSDC || '0') > 0 && <div>{asset.royaltyPerImportUSDC} USDC</div>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      
    </div>
  )
}

