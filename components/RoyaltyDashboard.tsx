'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, X } from 'lucide-react'
import { getPendingRoyalties, claimETHRoyalties, claimUSDCRoyalties } from '../lib/royaltyClaimService'
import { getRoyaltyReceipts, RoyaltyReceipt } from '../lib/royaltyService'
import { usePopup } from './PopupNotification'
import { useWallets } from '@privy-io/react-auth'
import { formatETH, formatUSDC } from '../lib/formatCurrency'

interface RoyaltyDashboardProps {
  walletAddress: string
}

export default function RoyaltyDashboard({ walletAddress }: RoyaltyDashboardProps) {
  const [pendingETH, setPendingETH] = useState('0')
  const [pendingUSDC, setPendingUSDC] = useState('0')
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<'eth' | 'usdc' | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [royaltyReceipts, setRoyaltyReceipts] = useState<RoyaltyReceipt[]>([])
  const [loadingReceipts, setLoadingReceipts] = useState(false)
  const { showPopup } = usePopup()
  const { wallets } = useWallets()

  useEffect(() => {
    loadPendingRoyalties()
    // Start loading receipts in background
    loadRoyaltyReceipts()
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadPendingRoyalties()
      loadRoyaltyReceipts()
    }, 30000)
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
      // Get Privy provider
      let provider = null
      if (wallets && wallets.length > 0) {
        try {
          provider = await wallets[0].getEthereumProvider()
          console.log('[RoyaltyDashboard] Got Privy provider for ETH claim')
        } catch (error) {
          console.error('[RoyaltyDashboard] Failed to get Privy provider:', error)
        }
      }
      
      const txHash = await claimETHRoyalties(provider)
      showPopup(
        `Successfully claimed ${formatETH(pendingETH)} ETH`,
        'success',
        { title: 'Royalties Claimed!' }
      )
      
      // Refresh pending royalties
      await loadPendingRoyalties()
    } catch (error: any) {
      console.error('Error claiming ETH:', error)
      showPopup(
        error.message || 'Failed to claim royalties',
        'error',
        { title: 'Claim Failed' }
      )
    } finally {
      setClaiming(null)
    }
  }

  const handleClaimUSDC = async () => {
    if (parseFloat(pendingUSDC) === 0) return
    
    setClaiming('usdc')
    try {
      // Get Privy provider
      let provider = null
      if (wallets && wallets.length > 0) {
        try {
          provider = await wallets[0].getEthereumProvider()
          console.log('[RoyaltyDashboard] Got Privy provider for USDC claim')
        } catch (error) {
          console.error('[RoyaltyDashboard] Failed to get Privy provider:', error)
        }
      }
      
      const txHash = await claimUSDCRoyalties(provider)
      showPopup(
        `Successfully claimed ${formatUSDC(pendingUSDC)} USDC`,
        'success',
        { title: 'Royalties Claimed!' }
      )
      
      // Refresh pending royalties
      await loadPendingRoyalties()
    } catch (error: any) {
      console.error('Error claiming USDC:', error)
      showPopup(
        error.message || 'Failed to claim royalties',
        'error',
        { title: 'Claim Failed' }
      )
    } finally {
      setClaiming(null)
    }
  }

  const loadRoyaltyReceipts = async () => {
    try {
      setLoadingReceipts(true)
      console.log('[RoyaltyDashboard] Loading royalty receipts from Irys...')
      
      const receipts = await getRoyaltyReceipts(walletAddress, 100)
      console.log('[RoyaltyDashboard] Loaded', receipts.length, 'receipts')
      
      setRoyaltyReceipts(receipts)
    } catch (error) {
      console.error('[RoyaltyDashboard] Error loading receipts:', error)
    } finally {
      setLoadingReceipts(false)
    }
  }
  
  const handleShowDetails = () => {
    setShowDetails(true)
    // Receipts are already loading in background
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
          <button
            onClick={handleShowDetails}
            className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
          >
            View History
          </button>
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
                <p className="text-2xl font-bold text-gray-900 mb-3">{formatETH(pendingETH)}</p>
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
                <p className="text-2xl font-bold text-gray-900 mb-3">{formatUSDC(pendingUSDC)}</p>
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
        <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4 pointer-events-none">
          <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200/80 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col pointer-events-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Royalty History</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loadingReceipts && royaltyReceipts.length === 0 ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse"></div>
                  ))}
                </div>
              ) : royaltyReceipts.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No royalty history yet</p>
                  <p className="text-xs text-gray-400 mt-1">Payment receipts will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {royaltyReceipts.map((receipt, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{receipt.projectName}</p>
                          <p className="text-xs text-gray-500">{new Date(receipt.timestamp).toLocaleString()}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          receipt.payer.toLowerCase() === walletAddress.toLowerCase()
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {receipt.payer.toLowerCase() === walletAddress.toLowerCase() ? 'Paid' : 'Earned'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        {receipt.libraries.map((lib, libIdx) => (
                          <div key={libIdx} className="text-xs bg-white p-2 rounded border border-gray-200">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-700">{lib.name}</span>
                              <span className="text-gray-900 font-medium">
                                {parseFloat(lib.royaltyETH) > 0 && `${formatETH(lib.royaltyETH)} ETH`}
                                {parseFloat(lib.royaltyUSDC) > 0 && `${formatUSDC(lib.royaltyUSDC)} USDC`}
                              </span>
                            </div>
                            <div className="text-gray-500 mt-1">
                              Owner: {lib.owner.slice(0, 6)}...{lib.owner.slice(-4)}
                            </div>
                            
                            {lib.distributions && lib.distributions.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">Auto-distributed to:</p>
                                {lib.distributions.map((dist, distIdx) => (
                                  <div key={distIdx} className="flex items-center justify-between text-xs text-gray-600 ml-2">
                                    <span>└ {dist.name}</span>
                                    <span>
                                      {parseFloat(dist.amountETH) > 0 && `${formatETH(dist.amountETH)} ETH`}
                                      {parseFloat(dist.amountUSDC) > 0 && `${formatUSDC(dist.amountUSDC)} USDC`}
                                    </span>
                                  </div>
                                ))}
                                {(lib.profitETH || lib.profitUSDC) && (
                                  <div className="flex items-center justify-between text-xs text-gray-700 mt-1 font-medium">
                                    <span>{lib.name} profit:</span>
                                    <span>
                                      {lib.profitETH && parseFloat(lib.profitETH) > 0 && `${formatETH(lib.profitETH)} ETH`}
                                      {lib.profitUSDC && parseFloat(lib.profitUSDC) > 0 && `${formatUSDC(lib.profitUSDC)} USDC`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        <span className="text-sm font-medium text-gray-700">Total:</span>
                        <div className="text-right">
                          {parseFloat(receipt.totalPaidETH) > 0 && (
                            <div className="text-sm font-bold text-gray-900">
                              {formatETH(receipt.totalPaidETH)} ETH
                            </div>
                          )}
                          {parseFloat(receipt.totalPaidUSDC) > 0 && (
                            <div className="text-sm font-bold text-gray-900">
                              {formatUSDC(receipt.totalPaidUSDC)} USDC
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {receipt.txHashes.paymentETH && (
                        <a
                          href={`https://basescan.org/tx/${receipt.txHashes.paymentETH}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:text-gray-700 mt-2 inline-block"
                        >
                          View ETH tx →
                        </a>
                      )}
                      {receipt.txHashes.paymentUSDC && (
                        <a
                          href={`https://basescan.org/tx/${receipt.txHashes.paymentUSDC}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:text-gray-700 mt-2 inline-block ml-4"
                        >
                          View USDC tx →
                        </a>
                      )}
                    </div>
                  ))}
                  
                  {loadingReceipts && (
                    <div className="text-center py-4">
                      <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>
                      <p className="text-xs text-gray-500 mt-2">Loading more...</p>
                    </div>
                  )}
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

