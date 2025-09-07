'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Tag, TrendingUp, Clock, DollarSign, User, X, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { queryMarketplaceListings, getProjectOffers, buyListedAsset, makeAssetOffer, acceptOffer, MarketplaceListing, MarketplaceOffer } from '@/lib/marketplaceService'
import { queryLibraryAssets } from '@/lib/libraryService'
import { downloadProjectThumbnail, downloadClayProject } from '@/lib/clayStorageService'
import { ConnectWallet } from '@/components/ConnectWallet'
import { usePopup } from '@/components/PopupNotification'
import { AnimatedClayLogo } from '@/components/AnimatedClayLogo'
import MiniViewer from '@/components/MiniViewer'

export default function MarketplacePage() {
  const router = useRouter()
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [filteredListings, setFilteredListings] = useState<MarketplaceListing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'price-low' | 'price-high'>('recent')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null)
  const [offers, setOffers] = useState<MarketplaceOffer[]>([])
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [offerPrice, setOfferPrice] = useState('')
  const [offerDuration, setOfferDuration] = useState('24')
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map())
  const { showPopup } = usePopup()
  
  useEffect(() => {
    loadMarketplaceData()
  }, [])
  
  useEffect(() => {
    filterAndSortListings()
  }, [listings, searchQuery, sortBy])
  
  const loadMarketplaceData = async () => {
    try {
      setLoading(true)
      const marketplaceListings = await queryMarketplaceListings()
      
      // Enrich with library data
      const libraryAssets = await queryLibraryAssets(1000)
      const libraryMap = new Map(libraryAssets.map(a => [a.projectId, a]))
      
      // Enrich listings - prefer listing data, then library data
      const enrichedListings = await Promise.all(marketplaceListings.map(async (listing) => {
        const libraryAsset = libraryMap.get(listing.projectId)
        
        // Try to get project name from various sources
        let projectName = listing.assetName?.trim() || libraryAsset?.name
        
        // If still no name, try to fetch from project data
        if (!projectName) {
          try {
            const projectData = await downloadClayProject(listing.projectId)
            projectName = projectData?.name
          } catch (e) {
            console.log('[Marketplace] Could not load project name for', listing.projectId)
          }
        }
        
        return {
          ...listing,
          assetName: projectName || listing.assetName,
          description: listing.description?.trim() || libraryAsset?.description,
          thumbnailId: libraryAsset?.thumbnailId
        }
      }))
      
      setListings(enrichedListings)
      
      // Load thumbnails
      const thumbMap = new Map<string, string>()
      for (const listing of enrichedListings) {
        if (listing.thumbnailId) {
          try {
            const thumb = await downloadProjectThumbnail(listing.thumbnailId)
            if (thumb) thumbMap.set(listing.projectId, thumb)
          } catch (error) {
            console.error('Failed to load thumbnail:', error)
          }
        }
      }
      setThumbnails(thumbMap)
    } catch (error) {
      console.error('Failed to load marketplace data:', error)
      showPopup('Failed to load marketplace', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  const filterAndSortListings = () => {
    let filtered = [...listings]
    
    if (searchQuery) {
      filtered = filtered.filter(listing =>
        listing.assetName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => b.listedAt - a.listedAt)
        break
      case 'price-low':
        filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
        break
      case 'price-high':
        filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
        break
    }
    
    setFilteredListings(filtered)
  }
  
  const handleViewListing = async (listing: MarketplaceListing) => {
    setSelectedListing(listing)
    
    // Load offers
    try {
      const projectOffers = await getProjectOffers(listing.projectId)
      setOffers(projectOffers)
    } catch (error) {
      console.error('Failed to load offers:', error)
    }
  }
  
  const handleBuy = async (listing: MarketplaceListing) => {
    if (!walletAddress) {
      showPopup('Please connect your wallet', 'warning')
      return
    }
    
    try {
      const result = await buyListedAsset(listing.projectId, walletAddress)
      if (result.success) {
        showPopup('Purchase successful! You are now the owner.', 'success')
        setSelectedListing(null)
        loadMarketplaceData()
      } else {
        showPopup(result.error || 'Purchase failed', 'error')
      }
    } catch (error: any) {
      showPopup(error.message || 'Purchase failed', 'error')
    }
  }
  
  const handleMakeOffer = async () => {
    if (!walletAddress || !selectedListing) return
    
    try {
      const result = await makeAssetOffer(
        selectedListing.projectId,
        parseFloat(offerPrice),
        selectedListing.paymentToken, // Use listing's payment token
        parseInt(offerDuration)
      )
      
      if (result.success) {
        showPopup('Offer submitted successfully!', 'success')
        setShowOfferModal(false)
        setOfferPrice('')
        
        // Reload offers
        const projectOffers = await getProjectOffers(selectedListing.projectId)
        setOffers(projectOffers)
      } else {
        showPopup(result.error || 'Offer failed', 'error')
      }
    } catch (error: any) {
      showPopup(error.message || 'Offer failed', 'error')
    }
  }
  
  const handleAcceptOffer = async (offerId: number, offer: MarketplaceOffer) => {
    if (!selectedListing) return
    
    try {
      const result = await acceptOffer(offerId, selectedListing.projectId, offer.buyer)
      if (result.success) {
        showPopup('Offer accepted! Ownership transferred.', 'success')
        setSelectedListing(null)
        loadMarketplaceData()
      } else {
        showPopup(result.error || 'Failed to accept offer', 'error')
      }
    } catch (error: any) {
      showPopup(error.message || 'Failed to accept offer', 'error')
    }
  }
  
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() / 1000) - timestamp)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
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
            
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search marketplace..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 sm:px-4 pr-10 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
            
            <div className="flex-shrink-0">
              <ConnectWallet
                onConnect={setWalletAddress}
                onDisconnect={() => setWalletAddress(null)}
              />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Marketplace</h1>
            
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
                onClick={() => setSortBy('price-low')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  sortBy === 'price-low' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Price ↑
              </button>
              <button
                onClick={() => setSortBy('price-high')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  sortBy === 'price-high' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Price ↓
              </button>
            </div>
            {/* Mobile Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'price-low' | 'price-high')}
              className="sm:hidden px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="recent">Recent</option>
              <option value="price-low">Price ↑</option>
              <option value="price-high">Price ↓</option>
            </select>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg overflow-hidden animate-pulse border border-gray-200">
                  <div className="aspect-square bg-gray-200" />
                  <div className="p-3">
                    <div className="h-4 bg-gray-200 rounded mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-12">
              <Tag size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No listings found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredListings.map((listing) => (
                <Link
                  key={listing.projectId}
                  href={`/marketplace/${listing.projectId}`}
                  className="bg-white rounded-lg overflow-hidden hover:shadow-md transition-shadow border border-gray-200 block"
                >
                  <MiniViewer 
                    projectId={listing.projectId}
                    className="aspect-square"
                  />
                  
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
                      {(listing.assetName && listing.assetName.trim()) || 'Unnamed Asset'}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2">{formatTimeAgo(listing.listedAt)}</p>
                    <p className="text-lg font-bold text-gray-900">{listing.price} {listing.paymentToken}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      
      {/* Listing Detail Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setSelectedListing(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{(selectedListing.assetName && selectedListing.assetName.trim()) || 'Unnamed Asset'}</h2>
                  <p className="text-sm text-gray-500 mt-1">{(selectedListing.description && selectedListing.description.trim()) || 'No description'}</p>
                </div>
                <button onClick={() => setSelectedListing(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedListing.price} {selectedListing.paymentToken}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Seller</p>
                    <Link
                      href={`/user/${selectedListing.seller}`}
                      className="text-sm text-gray-700 hover:text-gray-900 hover:underline"
                    >
                      {selectedListing.seller.slice(0, 6)}...{selectedListing.seller.slice(-4)}
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* Offers Section */}
              {walletAddress === selectedListing.seller && offers.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Offers ({offers.length})</h3>
                  <div className="space-y-2">
                    {offers.map((offer) => (
                      <div key={offer.offerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{offer.offerPrice} {offer.paymentToken}</p>
                          <p className="text-xs text-gray-500">
                            From {offer.buyer.slice(0, 6)}...{offer.buyer.slice(-4)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAcceptOffer(offer.offerId, offer)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded transition-colors"
                        >
                          Accept
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-3">
                {walletAddress !== selectedListing.seller && (
                  <>
                    <button
                      onClick={() => handleBuy(selectedListing)}
                      disabled={!walletAddress}
                      className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      Buy Now
                    </button>
                    <button
                      onClick={() => setShowOfferModal(true)}
                      disabled={!walletAddress}
                      className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      Make Offer
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Make Offer Modal */}
      {showOfferModal && selectedListing && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Make an Offer</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Offer Price ({selectedListing.paymentToken})</label>
                <input
                  type="number"
                  step="0.01"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-700 mb-2">Duration (hours)</label>
                <select
                  value={offerDuration}
                  onChange={(e) => setOfferDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                  <option value="72">72 hours</option>
                  <option value="168">7 days</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowOfferModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMakeOffer}
                  disabled={!offerPrice || parseFloat(offerPrice) <= 0}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Submit Offer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

