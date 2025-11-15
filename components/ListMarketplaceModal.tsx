'use client'

import { useState } from 'react'
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
        provider
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          List on Marketplace
        </h2>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Project</p>
            <p className="text-sm font-medium text-gray-900">{projectName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                disabled={isListing}
              />
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value as 'ETH' | 'USDC')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                disabled={isListing}
              >
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              • Wait for buyers after listing<br/>
              • Cancel listing anytime<br/>
              • 2.5% platform fee on sale
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isListing}
              className="flex-1 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg transition-all text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleList}
              disabled={isListing || !price}
              className="flex-1 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
