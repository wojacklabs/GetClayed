'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, X } from 'lucide-react'
import { getPendingRoyalties, claimETHRoyalties, claimUSDCRoyalties, getRoyaltyEvents, RoyaltyEvent } from '../lib/royaltyClaimService'
import { usePopup } from './PopupNotification'

interface RoyaltyDashboardProps {
  walletAddress: string
}

export default function RoyaltyDashboard({ walletAddress }: RoyaltyDashboardProps) {
  const [pendingETH, setPendingETH] = useState('0')
  const [pendingUSDC, setPendingUSDC] = useState('0')
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<'eth' | 'usdc' | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [royaltyEvents, setRoyaltyEvents] = useState<RoyaltyEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const { showPopup } = usePopup()

  useEffect(() => {
    loadPendingRoyalties()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadPendingRoyalties, 30000)
    return () => clearInterval(interval)
  }, [walletAddress])

  const loadPendingRoyalties = async () => {
    try {
      const royalties = await getPendingRoyalties(walletAddress)
      setPendingETH(royalties.eth)
      setPendingUSDC(royalties.usdc)
    } catch (error) {
      console.error('Error loading royalties:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClaimETH = async () => {
    if (parseFloat(pendingETH) === 0) return
    
    setClaiming('eth')
    try {
      const txHash = await claimETHRoyalties()
      showPopup({
        title: 'Royalties Claimed!',
        message: `Successfully claimed ${parseFloat(pendingETH).toFixed(4)} ETH`,
        type: 'success'
      })
      
      // Refresh pending royalties
      await loadPendingRoyalties()
    } catch (error: any) {
      console.error('Error claiming ETH:', error)
      showPopup({
        title: 'Claim Failed',
        message: error.message || 'Failed to claim ETH royalties',
        type: 'error'
      })
    } finally {
      setClaiming(null)
    }
  }

  const handleClaimUSDC = async () => {
    if (parseFloat(pendingUSDC) === 0) return
    
    setClaiming('usdc')
    try {
      const txHash = await claimUSDCRoyalties()
      showPopup({
        title: 'Royalties Claimed!',
        message: `Successfully claimed ${parseFloat(pendingUSDC).toFixed(2)} USDC`,
        type: 'success'
      })
      
      // Refresh pending royalties
      await loadPendingRoyalties()
    } catch (error: any) {
      console.error('Error claiming USDC:', error)
      showPopup({
        title: 'Claim Failed',
        message: error.message || 'Failed to claim USDC royalties',
        type: 'error'
      })
    } finally {
      setClaiming(null)
    }
  }

  const handleShowDetails = async () => {
    setShowDetails(true)
    setLoadingEvents(true)
    try {
      const events = await getRoyaltyEvents(walletAddress)
      setRoyaltyEvents(events)
    } catch (error) {
      console.error('Error loading royalty events:', error)
    } finally {
      setLoadingEvents(false)
    }
  }

  const hasPendingRoyalties = parseFloat(pendingETH) > 0 || parseFloat(pendingUSDC) > 0

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
        <div className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Pending Royalties</h3>
          {hasPendingRoyalties && (
            <button
              onClick={handleShowDetails}
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              View Details
            </button>
          )}
        </div>
        
        {!hasPendingRoyalties ? (
          <div className="text-center py-8">
            <DollarSign size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No pending royalties</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ETH Royalties */}
            {parseFloat(pendingETH) > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">ETH</p>
                <p className="text-2xl font-bold text-gray-900 mb-3">{parseFloat(pendingETH).toFixed(4)}</p>
                <button
                  onClick={handleClaimETH}
                  disabled={claiming !== null}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claiming === 'eth' ? 'Claiming...' : 'Claim ETH'}
                </button>
              </div>
            )}
            
            {/* USDC Royalties */}
            {parseFloat(pendingUSDC) > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">USDC</p>
                <p className="text-2xl font-bold text-gray-900 mb-3">{parseFloat(pendingUSDC).toFixed(2)}</p>
                <button
                  onClick={handleClaimUSDC}
                  disabled={claiming !== null}
                  className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claiming === 'usdc' ? 'Claiming...' : 'Claim USDC'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Royalty Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 flex items-center justify-center z-[10000] bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Royalty History</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loadingEvents ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
                  ))}
                </div>
              ) : royaltyEvents.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No royalty history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {royaltyEvents.map((event, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          event.type === 'recorded' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                        }`}>
                          {event.type === 'recorded' ? 'Earned' : 'Claimed'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {event.projectId && (
                        <p className="text-sm text-gray-700 mb-1">Project: {event.projectId.slice(0, 12)}...</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm">
                        {parseFloat(event.amountETH) > 0 && (
                          <span className="text-gray-900 font-medium">
                            {parseFloat(event.amountETH).toFixed(4)} ETH
                          </span>
                        )}
                        {parseFloat(event.amountUSDC) > 0 && (
                          <span className="text-gray-900 font-medium">
                            {parseFloat(event.amountUSDC).toFixed(2)} USDC
                          </span>
                        )}
                      </div>
                      
                      <a
                        href={`https://basescan.org/tx/${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-700 mt-2 inline-block"
                      >
                        View tx →
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowDetails(false)}
                className="w-full px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg transition-all text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

