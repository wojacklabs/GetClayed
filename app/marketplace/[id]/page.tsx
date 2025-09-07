'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, AlertCircle, Share2, Percent } from 'lucide-react'
import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { TrackballControls } from '@react-three/drei'
import * as THREE from 'three'
import { queryMarketplaceListings, getProjectOffers, buyListedAsset, makeAssetOffer, acceptOffer, cancelOfferById, MarketplaceListing, MarketplaceOffer } from '@/lib/marketplaceService'
import { getLibraryCurrentRoyalties } from '@/lib/libraryService'
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
  const [royaltyInfo, setRoyaltyInfo] = useState<{ ethAmount: number; usdcAmount: number; exists: boolean; enabled: boolean } | null>(null)
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
      
      // Load royalty info if available
      try {
        const royalties = await getLibraryCurrentRoyalties([listingId])
        const royalty = royalties.get(listingId)
        if (royalty) {
          setRoyaltyInfo(royalty)
        }
      } catch (e) {
        console.log('[MarketplaceDetail] No royalty info available')
      }
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
      const result = await buyListedAsset(listing.projectId, walletAddress)
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
        listing.paymentToken, // Use same payment token as listing
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
  
  // FIX P1-11: Allow buyers to cancel their expired offers
  const handleCancelOffer = async (offerId: number) => {
    try {
      const result = await cancelOfferById(offerId);
      if (result.success) {
        showPopup('Offer cancelled. Your funds have been refunded.', 'success');
        loadListingDetail(); // Reload to update offers
      } else {
        showPopup(result.error || 'Failed to cancel offer', 'error');
      }
    } catch (error: any) {
      showPopup(error.message || 'Failed to cancel offer', 'error');
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
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  showPopup('URL copied to clipboard', 'success')
                }}
                className="p-2 rounded-md transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
                title="Share"
              >
                <Share2 size={18} />
              </button>
              <ConnectWallet onConnect={setWalletAddress} onDisconnect={() => setWalletAddress(null)} />
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="aspect-square bg-gray-100">
              {project ? (
                <Canvas camera={{ position: [10, 4, 10], fov: 45 }}>
                  <Suspense fallback={null}>
                    <ambientLight intensity={0.35} />
                    <directionalLight position={[8, 12, 8]} intensity={1.2} />
                    <directionalLight position={[-6, 4, -6]} intensity={0.5} />
                    <directionalLight position={[0, -8, 4]} intensity={0.25} />
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
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {(listing.assetName && listing.assetName.trim()) || project?.name || 'Unnamed Asset'}
              </h1>
              <p className="text-gray-600 mb-6">{(listing.description && listing.description.trim()) || 'No description'}</p>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-500 mb-1">Listed Price</p>
                <p className="text-3xl font-bold text-gray-900 mb-4">{listing.price} {listing.paymentToken}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Seller</p>
                    <Link 
                      href={`/user/${listing.seller}`}
                      className="text-gray-900 hover:text-gray-600 hover:underline truncate block"
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
              
              {/* Royalty Info */}
              {royaltyInfo && royaltyInfo.exists && royaltyInfo.enabled && (royaltyInfo.ethAmount > 0 || royaltyInfo.usdcAmount > 0) && (
                <div className="bg-amber-50 rounded-lg p-4 mb-6 border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent size={16} className="text-amber-600" />
                    <p className="text-sm font-medium text-amber-900">Royalty Information</p>
                  </div>
                  <p className="text-xs text-amber-800">
                    This asset is registered in the library with royalties.
                    {royaltyInfo.ethAmount > 0 && <span className="block">• {royaltyInfo.ethAmount} ETH per import</span>}
                    {royaltyInfo.usdcAmount > 0 && <span className="block">• {royaltyInfo.usdcAmount} USDC per import</span>}
                  </p>
                </div>
              )}
              
              {/* Actions */}
              {walletAddress !== listing.seller ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleBuy}
                    disabled={!walletAddress}
                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium disabled:opacity-50"
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
            {offers.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {walletAddress === listing.seller ? 'Received Offers' : 'All Offers'} ({offers.length})
                </h3>
                <div className="space-y-3">
                  {offers.map((offer) => {
                    // FIX P1-11: Calculate time until expiration
                    const timeLeft = offer.expiresAt - Math.floor(Date.now() / 1000);
                    const hoursLeft = timeLeft / 3600;
                    const daysLeft = hoursLeft / 24;
                    const isExpired = timeLeft < 0;
                    const isBuyer = walletAddress?.toLowerCase() === offer.buyer.toLowerCase();
                    const isSeller = walletAddress?.toLowerCase() === listing.seller.toLowerCase();
                    
                    let expiryWarning = '';
                    let expiryColor = 'text-gray-400';
                    
                    if (isExpired) {
                      expiryWarning = 'EXPIRED - Click cancel to refund';
                      expiryColor = 'text-gray-900 font-semibold';
                    } else if (hoursLeft < 1) {
                      expiryWarning = 'Expires in less than 1 hour';
                      expiryColor = 'text-gray-700 font-semibold';
                    } else if (hoursLeft < 24) {
                      expiryWarning = `Expires in ${Math.floor(hoursLeft)} hours`;
                      expiryColor = 'text-gray-600 font-medium';
                    } else if (daysLeft < 3) {
                      expiryWarning = `Expires in ${Math.floor(daysLeft)} days`;
                      expiryColor = 'text-gray-500';
                    } else {
                      expiryWarning = `Expires ${new Date(offer.expiresAt * 1000).toLocaleDateString()}`;
                    }
                    
                    return (
                      <div key={offer.offerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {offer.offerPrice} {offer.paymentToken}
                            {isBuyer && <span className="ml-2 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Your Offer</span>}
                          </p>
                          <p className="text-xs text-gray-500">
                            {isBuyer ? 'You made this offer' : `From ${offer.buyer.slice(0, 6)}...${offer.buyer.slice(-4)}`}
                          </p>
                          <p className={`text-xs ${expiryColor} mt-1`}>
                            {expiryWarning}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {/* Seller: Accept button */}
                          {isSeller && !isBuyer && (
                            <button
                              onClick={() => handleAcceptOffer(offer)}
                              disabled={isExpired}
                              className={`px-3 py-1.5 text-white text-sm rounded ${
                                isExpired 
                                  ? 'bg-gray-400 cursor-not-allowed' 
                                  : 'bg-gray-800 hover:bg-gray-700'
                              }`}
                            >
                              {isExpired ? 'Expired' : 'Accept'}
                            </button>
                          )}
                          {/* Buyer: Cancel button (especially for expired offers) */}
                          {isBuyer && (
                            <button
                              onClick={() => handleCancelOffer(offer.offerId)}
                              className={`px-3 py-1.5 text-sm rounded ${
                                isExpired
                                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                              }`}
                            >
                              {isExpired ? 'Claim Refund' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* FIX P1-11: Help text for expired offers */}
                {offers.some(o => o.expiresAt < Math.floor(Date.now() / 1000)) && (
                  <div className="mt-3 p-3 bg-gray-100 border border-gray-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-gray-600">
                        {walletAddress === listing.seller 
                          ? 'Expired offers cannot be accepted. Buyers can cancel them to get refunds.'
                          : 'Your expired offers are still holding your funds. Click "Claim Refund" to get them back.'}
                      </p>
                    </div>
                  </div>
                )}
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
                          Royalty: {lib.royaltyPerImportETH && parseFloat(lib.royaltyPerImportETH) > 0 
                            ? `${lib.royaltyPerImportETH} ETH` 
                            : lib.royaltyPerImportUSDC && parseFloat(lib.royaltyPerImportUSDC) > 0 
                            ? `${lib.royaltyPerImportUSDC} USDC` 
                            : 'Free'}
                        </p>
                      </div>
                      <Link
                        href={`/library/${lib.projectId}`}
                        className="text-xs text-gray-700 hover:text-gray-900 hover:underline"
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
      {showOfferModal && listing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Make an Offer</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Offer Price ({listing.paymentToken})</label>
                <input
                  type="number"
                  step="0.01"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-700 mb-2">Duration</label>
                <select
                  value={offerDuration}
                  onChange={(e) => setOfferDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
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
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50"
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

