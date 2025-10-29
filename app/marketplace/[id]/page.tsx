'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, ShoppingCart, TrendingUp, Tag, Clock, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { TrackballControls } from '@react-three/drei'
import * as THREE from 'three'
import { queryMarketplaceListings, getProjectOffers, buyListedAsset, makeAssetOffer, acceptOffer, MarketplaceListing, MarketplaceOffer } from '@/lib/marketplaceService'
import { queryLibraryAssets } from '@/lib/libraryService'
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

export default function MarketplaceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const listingId = params.id as string
  
  const [listing, setListing] = useState<MarketplaceListing | null>(null)
  const [project, setProject] = useState<any>(null)
  const [offers, setOffers] = useState<MarketplaceOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [offerPrice, setOfferPrice] = useState('')
  const [offerDuration, setOfferDuration] = useState('24')
  const { showPopup } = usePopup()
  
  useEffect(() => {
    loadListingDetail()
  }, [listingId])
  
  const loadListingDetail = async () => {
    try {
      setLoading(true)
      
      const listings = await queryMarketplaceListings()
      const foundListing = listings.find(l => l.projectId === listingId)
      
      if (!foundListing) {
        showPopup('Listing not found', 'error')
        router.push('/marketplace')
        return
      }
      
      setListing(foundListing)
      
      // Load project
      const projectData = await downloadClayProject(listingId)
      setProject(projectData)
      
      // Load offers
      const projectOffers = await getProjectOffers(listingId)
      setOffers(projectOffers)
    } catch (error) {
      console.error('Failed to load listing:', error)
      showPopup('Failed to load listing', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  const handleBuy = async () => {
    if (!walletAddress || !listing) return
    
    try {
      const result = await buyListedAsset(listing.projectId, parseFloat(listing.price), walletAddress)
      if (result.success) {
        showPopup('Purchase successful!', 'success')
        router.push('/marketplace')
      } else {
        showPopup(result.error || 'Purchase failed', 'error')
      }
    } catch (error: any) {
      showPopup(error.message || 'Purchase failed', 'error')
    }
  }
  
  const handleMakeOffer = async () => {
    if (!walletAddress || !listing) return
    
    try {
      const result = await makeAssetOffer(
        listing.projectId,
        parseFloat(offerPrice),
        parseInt(offerDuration)
      )
      
      if (result.success) {
        showPopup('Offer submitted!', 'success')
        setShowOfferModal(false)
        loadListingDetail()
      } else {
        showPopup(result.error || 'Offer failed', 'error')
      }
    } catch (error: any) {
      showPopup(error.message || 'Offer failed', 'error')
    }
  }
  
  const handleAcceptOffer = async (offer: MarketplaceOffer) => {
    if (!listing) return
    
    try {
      const result = await acceptOffer(offer.offerId, listing.projectId, offer.buyer)
      if (result.success) {
        showPopup('Offer accepted!', 'success')
        router.push('/marketplace')
      } else {
        showPopup(result.error || 'Accept failed', 'error')
      }
    } catch (error: any) {
      showPopup(error.message || 'Accept failed', 'error')
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
      </div>
    )
  }
  
  if (!listing) {
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
              <div className="flex items-center gap-2 mb-2">
                <Tag size={20} className="text-gray-400" />
                <h1 className="text-2xl font-bold text-gray-900">{listing.assetName || 'Unnamed Asset'}</h1>
              </div>
              <p className="text-gray-600 mb-6">{listing.description || 'No description'}</p>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-500 mb-1">Listed Price</p>
                <p className="text-3xl font-bold text-gray-900 mb-4">{listing.price} {listing.price.includes('.') ? 'ETH/USDC' : 'ETH'}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Seller</p>
                    <Link 
                      href={`/user/${listing.seller}`}
                      className="text-blue-600 hover:underline truncate block"
                    >
                      {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Listed</p>
                    <p className="text-gray-900">{new Date(listing.listedAt * 1000).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              {walletAddress !== listing.seller ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleBuy}
                    disabled={!walletAddress}
                    className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    Buy Now
                  </button>
                  <button
                    onClick={() => setShowOfferModal(true)}
                    disabled={!walletAddress}
                    className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium disabled:opacity-50"
                  >
                    Make Offer
                  </button>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-3">You own this listing</p>
              )}
            </div>
            
            {/* Offers */}
            {offers.length > 0 && walletAddress === listing.seller && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Offers ({offers.length})</h3>
                <div className="space-y-3">
                  {offers.map((offer) => (
                    <div key={offer.offerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{offer.offerPrice} ETH/USDC</p>
                        <p className="text-xs text-gray-500">
                          From {offer.buyer.slice(0, 6)}...{offer.buyer.slice(-4)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Expires {new Date(offer.expiresAt * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAcceptOffer(offer)}
                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded"
                      >
                        Accept
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Dependencies */}
            {project?.usedLibraries && project.usedLibraries.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Library Dependencies</h3>
                <div className="space-y-3">
                  {project.usedLibraries.map((lib: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{lib.name}</p>
                        <p className="text-xs text-gray-500">
                          Royalty: {(parseFloat(lib.priceETH || lib.priceUSDC || '0') * 0.1).toFixed(4)}
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
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Make an Offer</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Offer Price (ETH/USDC)</label>
                <input
                  type="number"
                  step="0.01"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-700 mb-2">Duration</label>
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
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMakeOffer}
                  disabled={!offerPrice || parseFloat(offerPrice) <= 0}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

