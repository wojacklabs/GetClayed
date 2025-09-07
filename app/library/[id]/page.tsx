'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, ShoppingCart, TrendingUp, User, Calendar, DollarSign, Share2 } from 'lucide-react'
import Link from 'next/link'
import { Canvas } from '@react-three/fiber'
import { TrackballControls } from '@react-three/drei'
import * as THREE from 'three'
import { queryLibraryAssets, LibraryAsset } from '@/lib/libraryService'
import { downloadClayProject, restoreClayObjects, downloadProjectThumbnail } from '@/lib/clayStorageService'
import { ConnectWallet } from '@/components/ConnectWallet'
import { usePopup } from '@/components/PopupNotification'
import { AnimatedClayLogo } from '@/components/AnimatedClayLogo'
import { useWallets } from '@privy-io/react-auth'
import { getRoyaltyEvents, RoyaltyEvent, getPendingRoyalties } from '@/lib/royaltyClaimService'
import UpdateLibraryModal from '@/components/UpdateLibraryModal'
import { formatETH, formatUSDC, formatCombinedCurrency } from '@/lib/formatCurrency'

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
  const { wallets } = useWallets()
  
  const [asset, setAsset] = useState<LibraryAsset | null>(null)
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [royaltyHistory, setRoyaltyHistory] = useState<RoyaltyEvent[]>([])
  const [totalEarned, setTotalEarned] = useState({ eth: '0', usdc: '0' })
  const [pendingRoyalties, setPendingRoyalties] = useState({ eth: '0', usdc: '0' })
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const { showPopup } = usePopup()
  
  useEffect(() => {
    loadAssetDetail()
  }, [assetId])
  
  useEffect(() => {
    if (wallets.length > 0) {
      setWalletAddress(wallets[0].address)
    }
  }, [wallets])
  
  const loadAssetDetail = async () => {
    try {
      setLoading(true)
      
      // Find asset - V2 contracts only
      const assets = await queryLibraryAssets(1000)
      const foundAsset = assets.find(a => a.projectId === assetId)
      
      if (!foundAsset) {
        showPopup('Asset not found in V2 contracts', 'error')
        router.push('/library')
        return
      }
      
      setAsset(foundAsset)
      
      // Load project data for PREVIEW - always use latest version via Project-ID
      // The downloadClayProject function will use getProjectLatestTxId to find the latest version
      // Note: Import uses the specific version from registration time (handled separately in import logic)
      const projectData = await downloadClayProject(assetId)
      setProject(projectData)
      
      // Load thumbnail
      if (foundAsset.thumbnailId) {
        const thumb = await downloadProjectThumbnail(foundAsset.thumbnailId)
        if (thumb) setThumbnail(thumb)
      }
      
      // Load royalty history
      loadRoyaltyHistory(foundAsset.originalCreator, assetId, foundAsset, projectData)
    } catch (error) {
      console.error('Failed to load asset:', error)
      showPopup('Failed to load asset', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  const loadRoyaltyHistory = async (creator: string, projectId: string, libraryAsset: LibraryAsset, projectData: any) => {
    try {
      // Get all royalty events for the creator (last 365 days)
      const events = await getRoyaltyEvents(creator, 365, 1000)
      
      // Filter events for this specific library asset
      const libraryEvents = events.filter(event => 
        event.type === 'earned' && event.projectId === projectId
      )
      
      // Calculate total claimed earnings
      let totalETH = 0
      let totalUSDC = 0
      
      libraryEvents.forEach(event => {
        totalETH += parseFloat(event.amountETH || '0')
        totalUSDC += parseFloat(event.amountUSDC || '0')
      })
      
      // Get pending royalties
      let displayEvents = [...libraryEvents]
      
      try {
        const pending = await getPendingRoyalties(creator)
        setPendingRoyalties(pending)
        
        // Calculate this library's share of pending royalties
        // Based on the current registered projects that use this library
        let libraryPendingETH = 0
        let libraryPendingUSDC = 0
        
        // Get all projects that have paid royalties to this library recently
        // This is an estimation based on recent activity
        // We look for projects that registered this library as a dependency
        if (libraryAsset) {
          // For now, we'll estimate based on the library's royalty rate
          // This is a simplified approach - in reality, we'd need to track
          // which projects have used this library but haven't been claimed yet
          
          // Get the library's royalty rates
          const libRoyaltyETH = parseFloat(libraryAsset.royaltyPerImportETH || '0')
          const libRoyaltyUSDC = parseFloat(libraryAsset.royaltyPerImportUSDC || '0')
          
          console.log(`[LibraryPage] Library ${projectId} royalty rates:`, {
            eth: libRoyaltyETH,
            usdc: libRoyaltyUSDC,
            asset: libraryAsset
          })
          
          // If this library has dependencies, subtract their amounts
          let dependencyETH = 0
          let dependencyUSDC = 0
          
          if (projectData?.usedLibraries) {
            const directDeps = projectData.directImports 
              ? projectData.usedLibraries.filter((lib: any) => projectData.directImports.includes(lib.projectId))
              : projectData.usedLibraries
            
            dependencyETH = directDeps.reduce((sum: number, lib: any) => 
              sum + parseFloat(lib.royaltyPerImportETH || '0'), 0)
            dependencyUSDC = directDeps.reduce((sum: number, lib: any) => 
              sum + parseFloat(lib.royaltyPerImportUSDC || '0'), 0)
          }
          
          // Library's profit per use
          const profitETH = Math.max(0, libRoyaltyETH - dependencyETH)
          const profitUSDC = Math.max(0, libRoyaltyUSDC - dependencyUSDC)
          
          // For pending royalties, we need to estimate this library's share
          // Since the contract doesn't track pending per library, we'll use a proportional approach
          if (parseFloat(pending.eth) > 0 || parseFloat(pending.usdc) > 0) {
            const pendingETH = parseFloat(pending.eth)
            const pendingUSDC = parseFloat(pending.usdc)
            
            // Show the full library price as pending for this specific library
            // This represents what users pay when they use this library
            if (libRoyaltyUSDC > 0 && pendingUSDC > 0) {
              // Show the library's full price (including dependencies)
              libraryPendingUSDC = libRoyaltyUSDC
              console.log(`[LibraryPage] Library ${projectId}: Setting pending USDC to ${libraryPendingUSDC} (library price)`)
            }
            
            if (libRoyaltyETH > 0 && pendingETH > 0) {
              // Show the library's full price (including dependencies)
              libraryPendingETH = libRoyaltyETH
              console.log(`[LibraryPage] Library ${projectId}: Setting pending ETH to ${libraryPendingETH} (library price)`)
            }
            
            // Add to display events if there's pending for this library
            if (libraryPendingETH > 0 || libraryPendingUSDC > 0) {
              const pendingEvent = {
                projectId: projectId,
                projectName: libraryAsset.name || 'Unknown',
                recipient: creator,
                amountETH: libraryPendingETH.toFixed(6),
                amountUSDC: libraryPendingUSDC.toFixed(6),
                timestamp: Date.now(),
                type: 'earned' as const,
                source: 'library' as const,
                payerName: 'Pending (unclaimed)'
              }
              
              console.log(`[LibraryPage] Adding pending event:`, {
                libraryId: projectId,
                pendingUSDC: pendingEvent.amountUSDC,
                pendingETH: pendingEvent.amountETH
              })
              
              displayEvents.push(pendingEvent)
              
              // Add to totals
              totalETH += libraryPendingETH
              totalUSDC += libraryPendingUSDC
            }
          }
        }
      } catch (error) {
        console.error('Failed to load pending royalties:', error)
        // Set default values on error
        setPendingRoyalties({ eth: '0', usdc: '0' })
      }
      
      // Update royalty history state with both claimed and pending
      setRoyaltyHistory(displayEvents)
      
      const finalTotals = {
        eth: formatETH(totalETH),
        usdc: formatUSDC(totalUSDC)
      }
      
      setTotalEarned(finalTotals)
    } catch (error) {
      console.error('Failed to load royalty history:', error)
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Preview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden lg:sticky lg:top-6">
            <div className="bg-gray-100 aspect-square">
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
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{asset.name}</h1>
              <p className="text-gray-600 mb-4">{asset.description || 'No description'}</p>
              
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-2">Royalty Per Import</p>
                {parseFloat(asset.royaltyPerImportETH || '0') > 0 && (
                  <p className="text-xl font-bold text-gray-900">{asset.royaltyPerImportETH} ETH</p>
                )}
                {parseFloat(asset.royaltyPerImportUSDC || '0') > 0 && (
                  <p className="text-xl font-bold text-gray-900">{asset.royaltyPerImportUSDC} USDC</p>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-6">
                <span className="flex items-center gap-1">
                  <TrendingUp size={16} />
                  Royalty per import
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={16} />
                  {new Date(asset.listedAt * 1000).toLocaleDateString()}
                </span>
              </div>
              
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-1">Creator</p>
                <Link 
                  href={`/user/${asset.originalCreator}`}
                  className="text-sm text-gray-700 hover:text-gray-900 hover:underline"
                >
                  {asset.originalCreator.slice(0, 6)}...{asset.originalCreator.slice(-4)}
                </Link>
              </div>
              
              {/* Owner Actions */}
              {walletAddress && asset.currentOwner.toLowerCase() === walletAddress.toLowerCase() && (
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => setShowUpdateModal(true)}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                    showPopup('Delete this library from blockchain? This will permanently remove it from the library.', 'warning', {
                      autoClose: false,
                      confirmButton: {
                        text: 'Delete',
                        onConfirm: async () => {
                          try {
                            // Get Privy provider
                            let provider = null;
                            if (wallets && wallets.length > 0) {
                              try {
                                provider = await wallets[0].getEthereumProvider();
                                console.log('[LibraryDetail] Got Privy provider for delete');
                              } catch (error) {
                                console.error('[LibraryDetail] Failed to get provider:', error);
                                showPopup('Failed to connect wallet. Please try again.', 'error');
                                return;
                              }
                            }
                            
                            if (!provider) {
                              showPopup('Please connect your wallet first', 'error');
                              return;
                            }
                            
                            // Verify network before proceeding
                            const { verifyAndSwitchNetwork } = await import('@/lib/networkUtils');
                            const isCorrectNetwork = await verifyAndSwitchNetwork(showPopup, provider);
                            if (!isCorrectNetwork) {
                              showPopup('Please switch to Base network', 'error');
                              return;
                            }
                            
                            showPopup('Sending delete transaction...', 'info');
                            
                            const { deleteLibraryAsset } = await import('@/lib/libraryService');
                            const result = await deleteLibraryAsset(assetId, provider);
                            
                            if (result.success && result.txHash) {
                              showPopup('Library deleted from blockchain!', 'success');
                              setTimeout(() => {
                                router.push('/library');
                              }, 1500);
                            } else if (result.success) {
                              // Already deleted or not registered
                              showPopup('Library already removed or not found', 'info');
                              setTimeout(() => {
                                router.push('/library');
                              }, 1500);
                            } else {
                              showPopup(result.error || 'Failed to delete library', 'error');
                            }
                          } catch (error: any) {
                            console.error('[LibraryDetail] Delete error:', error);
                            showPopup(error.message || 'Failed to delete', 'error');
                          }
                        }
                      },
                      cancelButton: {
                        text: 'Cancel',
                        onCancel: () => {
                          // Do nothing, just close
                        }
                      }
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Delete from Library
                </button>
                </div>
              )}
              
              {/* Info Notice */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 text-center">
                  To purchase ownership, check the <Link href="/marketplace" className="text-gray-900 hover:underline font-medium">Marketplace</Link>
                </p>
              </div>
            </div>
            
            {/* Dependencies with Direct/Indirect Distinction */}
            {project?.usedLibraries && project.usedLibraries.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Imported Libraries</h3>
                <div className="space-y-3">
                  {project.usedLibraries.map((lib: any, idx: number) => {
                    const isDirect = project.directImports ? project.directImports.includes(lib.projectId) : true
                    
                    return (
                      <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${isDirect ? 'bg-gray-50' : 'bg-gray-50/50 ml-4'}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            {!isDirect && <span className="text-xs text-gray-400">└</span>}
                            <p className={`text-sm font-medium ${isDirect ? 'text-gray-900' : 'text-gray-600'}`}>{lib.name}</p>
                          </div>
                          <p className={`text-xs ${isDirect ? 'text-gray-500' : 'text-gray-400'}`}>
                            Royalty: {lib.royaltyPerImportETH && parseFloat(lib.royaltyPerImportETH) > 0 ? `${lib.royaltyPerImportETH} ETH` : 
                                     lib.royaltyPerImportUSDC && parseFloat(lib.royaltyPerImportUSDC) > 0 ? `${lib.royaltyPerImportUSDC} USDC` : ''}
                            {!isDirect && ' (included)'}
                          </p>
                        </div>
                        <Link
                          href={`/library/${lib.projectId}`}
                          className="text-xs text-gray-700 hover:text-gray-900 hover:underline"
                        >
                          View
                        </Link>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  This library pays: {(() => {
                    const directLibs = project.directImports 
                      ? project.usedLibraries.filter((lib: any) => project.directImports.includes(lib.projectId))
                      : project.usedLibraries
                    
                    const totalETH = directLibs.reduce((sum: number, lib: any) => sum + parseFloat(lib.royaltyPerImportETH || '0'), 0);
                    const totalUSDC = directLibs.reduce((sum: number, lib: any) => sum + parseFloat(lib.royaltyPerImportUSDC || '0'), 0);
                    
                    return formatCombinedCurrency(totalETH, totalUSDC);
                  })()}
                </p>
              </div>
            )}
            
            {/* Revenue History - Public information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue History</h3>
                
                {/* Total Earnings with Distribution Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Total ETH Revenue</p>
                    <p className="text-xl font-bold text-gray-900">{totalEarned.eth} ETH</p>
                    {royaltyHistory.some(event => event.payerName === 'Pending (unclaimed)' && parseFloat(event.amountETH || '0') > 0) && (
                      <p className="text-xs text-gray-500 mt-1">
                        (includes {royaltyHistory.find(event => event.payerName === 'Pending (unclaimed)')?.amountETH} ETH pending)
                      </p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Total USDC Revenue</p>
                    <p className="text-xl font-bold text-gray-900">{totalEarned.usdc} USDC</p>
                    {royaltyHistory.some(event => event.payerName === 'Pending (unclaimed)' && parseFloat(event.amountUSDC || '0') > 0) && (
                      <p className="text-xs text-gray-500 mt-1">
                        (includes {royaltyHistory.find(event => event.payerName === 'Pending (unclaimed)')?.amountUSDC} USDC pending)
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Revenue Distribution Info */}
                {project?.usedLibraries && project.usedLibraries.length > 0 && (
                  <div className="mb-6 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-800 font-medium mb-2">Revenue Distribution</p>
                    <p className="text-xs text-yellow-700">
                      When this library is used, royalties are automatically distributed:
                    </p>
                    <div className="mt-2 space-y-1">
                      {(() => {
                        const directDeps = project.directImports 
                          ? project.usedLibraries.filter((lib: any) => project.directImports.includes(lib.projectId))
                          : project.usedLibraries
                        
                        const totalDepETH = directDeps.reduce((sum: number, lib: any) => sum + parseFloat(lib.royaltyPerImportETH || '0'), 0)
                        const totalDepUSDC = directDeps.reduce((sum: number, lib: any) => sum + parseFloat(lib.royaltyPerImportUSDC || '0'), 0)
                        
                        const libraryETH = parseFloat(asset.royaltyPerImportETH || '0')
                        const libraryUSDC = parseFloat(asset.royaltyPerImportUSDC || '0')
                        
                        const profitETH = Math.max(0, libraryETH - totalDepETH)
                        const profitUSDC = Math.max(0, libraryUSDC - totalDepUSDC)
                        
                        return (
                          <>
                            <div className="text-xs text-yellow-700">
                              • Dependencies receive: {formatCombinedCurrency(totalDepETH, totalDepUSDC)}
                            </div>
                            <div className="text-xs text-yellow-700 font-medium">
                              • You keep: {formatCombinedCurrency(profitETH, profitUSDC)}
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
              
              {/* History List - Grouped by version if available */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {royaltyHistory.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">No revenue history yet</p>
                    <p className="text-xs text-gray-400 mt-1">Revenue will appear here when your library assets are used</p>
                  </div>
                ) : (
                  (() => {
                    // Group by version (importedTxId) if available
                    const groupedByVersion = new Map<string, typeof royaltyHistory>();
                    const noVersionEvents: typeof royaltyHistory = [];
                    
                    royaltyHistory.forEach(event => {
                      const version = (event as any).importedTxId;
                      if (version) {
                        if (!groupedByVersion.has(version)) {
                          groupedByVersion.set(version, []);
                        }
                        groupedByVersion.get(version)!.push(event);
                      } else {
                        noVersionEvents.push(event);
                      }
                    });
                    
                    // If no version info, show flat list
                    if (groupedByVersion.size === 0) {
                      return royaltyHistory.map((event, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <DollarSign size={16} className="text-green-600" />
                            <div>
                              <p className="text-sm text-gray-600">
                                {new Date(event.timestamp).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-gray-500">From {event.payerName || 'Unknown project'} ({event.payer ? event.payer.slice(0, 6) + '...' + event.payer.slice(-4) : 'Unknown'})</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {parseFloat(event.amountETH || '0') > 0 && (
                              <p className="text-sm font-medium text-gray-900">{event.amountETH} ETH</p>
                            )}
                            {parseFloat(event.amountUSDC || '0') > 0 && (
                              <p className="text-sm font-medium text-gray-900">{event.amountUSDC} USDC</p>
                            )}
                          </div>
                        </div>
                      ));
                    }
                    
                    // Show grouped by version
                    return (
                      <>
                        {Array.from(groupedByVersion.entries()).map(([version, events], vIdx) => {
                          const versionTotal = events.reduce((acc, e) => ({
                            eth: acc.eth + parseFloat(e.amountETH || '0'),
                            usdc: acc.usdc + parseFloat(e.amountUSDC || '0')
                          }), { eth: 0, usdc: 0 });
                          
                          return (
                            <div key={vIdx} className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-100 px-3 py-2 flex justify-between items-center">
                                <span className="text-xs font-medium text-gray-700">
                                  Version: {version.slice(0, 8)}...
                                </span>
                                <span className="text-xs text-gray-600">
                                  {events.length} payment{events.length > 1 ? 's' : ''} • 
                                  {versionTotal.eth > 0 && ` ${versionTotal.eth.toFixed(6)} ETH`}
                                  {versionTotal.usdc > 0 && ` ${versionTotal.usdc.toFixed(6)} USDC`}
                                </span>
                              </div>
                              <div className="divide-y divide-gray-100">
                                {events.map((event, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-3">
                                    <div className="flex items-center gap-2">
                                      <DollarSign size={14} className="text-green-600" />
                                      <div>
                                        <p className="text-sm text-gray-600">
                                          {new Date(event.timestamp).toLocaleDateString()}
                                        </p>
                                        <p className="text-xs text-gray-500">From {event.payerName || 'Unknown'}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      {parseFloat(event.amountETH || '0') > 0 && (
                                        <p className="text-sm font-medium text-gray-900">{event.amountETH} ETH</p>
                                      )}
                                      {parseFloat(event.amountUSDC || '0') > 0 && (
                                        <p className="text-sm font-medium text-gray-900">{event.amountUSDC} USDC</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Events without version info */}
                        {noVersionEvents.length > 0 && (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-100 px-3 py-2">
                              <span className="text-xs font-medium text-gray-700">Legacy (no version info)</span>
                            </div>
                            <div className="divide-y divide-gray-100">
                              {noVersionEvents.map((event, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3">
                                  <div className="flex items-center gap-2">
                                    <DollarSign size={14} className="text-green-600" />
                                    <div>
                                      <p className="text-sm text-gray-600">
                                        {new Date(event.timestamp).toLocaleDateString()}
                                      </p>
                                      <p className="text-xs text-gray-500">From {event.payerName || 'Unknown'}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    {parseFloat(event.amountETH || '0') > 0 && (
                                      <p className="text-sm font-medium text-gray-900">{event.amountETH} ETH</p>
                                    )}
                                    {parseFloat(event.amountUSDC || '0') > 0 && (
                                      <p className="text-sm font-medium text-gray-900">{event.amountUSDC} USDC</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Update Library Modal */}
      {asset && (
        <UpdateLibraryModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          asset={asset}
          project={project}
          thumbnail={thumbnail}
          walletAddress={walletAddress || ''}
        />
      )}
    </div>
  )
}


