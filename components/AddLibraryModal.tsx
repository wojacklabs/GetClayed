'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { usePopup } from './PopupNotification'
import { registerLibraryAsset } from '@/lib/libraryService'
import { downloadClayProject, uploadProjectThumbnail } from '@/lib/clayStorageService'
import { verifyAndSwitchNetwork } from '@/lib/networkUtils'
import { useWallets } from '@privy-io/react-auth'

interface AddLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
  walletAddress: string
}

export default function AddLibraryModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  walletAddress
}: AddLibraryModalProps) {
  const { wallets } = useWallets()
  const { showPopup } = usePopup()
  const [assetName, setAssetName] = useState(projectName)
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState<'ETH' | 'USDC'>('USDC')
  const [isRegistering, setIsRegistering] = useState(false)

  const handleRegister = async () => {
    if (!assetName.trim()) {
      showPopup('Please enter asset name', 'warning')
      return
    }

    if (!price || parseFloat(price) <= 0) {
      showPopup('Please enter a price', 'warning')
      return
    }

    try {
      setIsRegistering(true)

      // Get provider
      let provider = null
      if (wallets && wallets.length > 0) {
        try {
          provider = await wallets[0].getEthereumProvider()
        } catch (error) {
          console.error('[AddLibrary] Failed to get provider:', error)
        }
      }

      // Verify network
      const isCorrectNetwork = await verifyAndSwitchNetwork(showPopup, provider)
      if (!isCorrectNetwork) {
        showPopup('Please switch to Base network', 'error')
        return
      }

      showPopup('Downloading project data...', 'info')
      
      // Download project data
      const project = await downloadClayProject(projectId, (progress) => {
        const percent = Math.round(progress.percentage)
        showPopup(`Downloading: ${percent}%`, 'info')
      })

      if (!project) {
        throw new Error('Failed to download project')
      }

      // Skip thumbnail generation for now
      let thumbnailId = null

      showPopup('Registering to library...', 'info')

      // Register library
      const ethPrice = selectedCurrency === 'ETH' ? parseFloat(price) : 0
      const usdcPrice = selectedCurrency === 'USDC' ? parseFloat(price) : 0

      const result = await registerLibraryAsset(
        projectId,
        assetName,
        description,
        ethPrice,
        usdcPrice,
        walletAddress,
        provider,
        thumbnailId || undefined
      )

      if (result.success) {
        showPopup('Registered to library!', 'success')
        onClose()
      } else {
        throw new Error(result.error || 'Registration failed')
      }
    } catch (error: any) {
      console.error('Failed to register library:', error)
      showPopup(error.message || 'Failed to register to library', 'error')
    } finally {
      setIsRegistering(false)
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
          Add to Library
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asset Name
            </label>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g. Cool 3D Model"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              disabled={isRegistering}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this asset..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              disabled={isRegistering}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Royalty Price (Per Import)
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
                disabled={isRegistering}
              />
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value as 'ETH' | 'USDC')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                disabled={isRegistering}
              >
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              • Earn royalties when others use this asset<br/>
              • Change price anytime<br/>
              • Automatic revenue sharing
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isRegistering}
              className="flex-1 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg transition-all text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRegister}
              disabled={isRegistering || !assetName.trim() || !price}
              className="flex-1 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRegistering ? (
                <>Processing...</>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  Add to Library
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
