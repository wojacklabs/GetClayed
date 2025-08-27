'use client'

import { useState, useEffect } from 'react'
import { X, DollarSign } from 'lucide-react'
import { usePopup } from './PopupNotification'
import { listAssetForSale } from '@/lib/marketplaceService'
import { verifyAndSwitchNetwork } from '@/lib/networkUtils'
import { useWallets } from '@privy-io/react-auth'

interface ListMarketplaceModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
}

export default function ListMarketplaceModal({
  isOpen,
  onClose,
  projectId,
  projectName
}: ListMarketplaceModalProps) {
  const { wallets } = useWallets()
  const { showPopup } = usePopup()
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState<'ETH' | 'USDC'>('ETH')
  const [isListing, setIsListing] = useState(false)

  const handleList = async () => {
    if (!price || parseFloat(price) <= 0) {
      showPopup('Please enter a price', 'warning')
      return
    }

    try {
      setIsListing(true)

      // Get provider
      let provider = null
      if (wallets && wallets.length > 0) {
        try {
          provider = await wallets[0].getEthereumProvider()
        } catch (error) {
          console.error('[ListMarketplace] Failed to get provider:', error)
        }
      }

      // Verify network
      const isCorrectNetwork = await verifyAndSwitchNetwork(showPopup, provider)
      if (!isCorrectNetwork) {
        showPopup('Please switch to Base network', 'error')
        return
      }

      showPopup('Listing on marketplace...', 'info')

      const result = await listAssetForSale(
        projectId,
        parseFloat(price),
        selectedCurrency,
        provider,
        projectName,
        description
      )

      if (result.success) {
        showPopup('Listed on marketplace!', 'success')
        onClose()
      } else {
        throw new Error(result.error || 'Listing failed')
      }
    } catch (error: any) {
      console.error('Failed to list on marketplace:', error)
      showPopup(error.message || 'Failed to list on marketplace', 'error')
    } finally {
      setIsListing(false)
    }
  }

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPrice('')
      setDescription('')
      setSelectedCurrency('ETH')
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
      <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200/80 max-w-md w-full overflow-hidden pointer-events-auto">
        <div className="absolute left-0 top-0 bottom-0 w-1 border-l-4 border-l-gray-400" />
        <div className="p-6 pl-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">
              List on Marketplace
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Project</p>
              <p className="text-sm font-medium text-gray-900">{projectName}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Sale Price
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  step="0.001"
                  min="0"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 text-sm"
                  disabled={isListing}
                />
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value as 'ETH' | 'USDC')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 text-sm"
                  disabled={isListing}
                >
                  <option value="ETH">ETH</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your artwork..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 text-sm resize-none"
                disabled={isListing}
              />
              <p className="text-xs text-gray-400 mt-1">{description.length}/500</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                • Wait for buyers after listing<br/>
                • Cancel listing anytime<br/>
                • 2.5% platform fee on sale
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={isListing}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleList}
              disabled={isListing || !price}
              className="flex-1 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isListing ? (
                <>Processing...</>
              ) : (
                <>
                  <DollarSign size={16} />
                  List for Sale
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
