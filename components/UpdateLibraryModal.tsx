'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { usePopup } from './PopupNotification'
import { LibraryAsset, registerLibraryAsset, disableLibraryRoyalty } from '@/lib/libraryService'
import { uploadClayProject, uploadProjectThumbnail } from '@/lib/clayStorageService'
import { verifyAndSwitchNetwork } from '@/lib/networkUtils'
import { ethers } from 'ethers'
import { useWallets } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'

interface UpdateLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  asset: LibraryAsset
  project: any
  thumbnail: string | null
  walletAddress: string
}

export default function UpdateLibraryModal({
  isOpen,
  onClose,
  asset,
  project,
  thumbnail,
  walletAddress
}: UpdateLibraryModalProps) {
  const router = useRouter()
  const { wallets } = useWallets()
  const { showPopup } = usePopup()
  const [assetName, setAssetName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState<'ETH' | 'USDC'>('USDC')
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (isOpen && asset) {
      setAssetName(asset.name)
      setDescription(asset.description || '')
      
      // 기존 가격이 있는 통화를 자동으로 선택
      if (parseFloat(asset.royaltyPerImportETH) > 0) {
        setSelectedCurrency('ETH')
        setPrice(asset.royaltyPerImportETH)
      } else if (parseFloat(asset.royaltyPerImportUSDC) > 0) {
        setSelectedCurrency('USDC')
        setPrice(asset.royaltyPerImportUSDC)
      }
    }
  }, [isOpen, asset])

  const handleUpdate = async () => {
    if (!walletAddress || !project) {
      showPopup('No wallet connected or project data missing', 'error')
      return
    }

    try {
      setIsUpdating(true)
      
      // Validate inputs
      if (!assetName.trim()) {
        showPopup('Please enter an asset name', 'warning')
        return
      }

      const priceValue = price ? parseFloat(price) : 0
      
      if (priceValue < 0) {
        showPopup('Price cannot be negative', 'warning')
        return
      }

      if (priceValue === 0) {
        showPopup('Price must be greater than 0', 'warning')
        return
      }

      // 선택한 통화에 따라 가격 설정
      const ethPrice = selectedCurrency === 'ETH' ? priceValue : 0
      const usdcPrice = selectedCurrency === 'USDC' ? priceValue : 0

      showPopup('Creating new version of library...', 'info')

      // Upload the project data (it's already loaded)
      const uploadResult = await uploadClayProject(
        project,
        undefined, // folder
        undefined, // rootTxId
        (progress) => {
          const percent = Math.round(progress.percentage)
          showPopup(`Uploading: ${percent}%`, 'info')
        }
      )

      if (!uploadResult.transactionId) {
        throw new Error('Failed to upload project')
      }

      // Upload thumbnail if exists
      let thumbnailId = null
      if (thumbnail) {
        thumbnailId = await uploadProjectThumbnail(thumbnail, project.id)
      }

      // Get provider
      let provider = null
      if (wallets && wallets.length > 0) {
        try {
          provider = await wallets[0].getEthereumProvider()
        } catch (error) {
          console.error('[UpdateLibrary] Failed to get provider:', error)
        }
      }

      // Verify network before proceeding
      const isCorrectNetwork = await verifyAndSwitchNetwork(showPopup, provider)
      if (!isCorrectNetwork) {
        showPopup('Please switch to Base network to continue', 'error')
        setIsUpdating(false)
        return
      }

      // Register as new library  
      const result = await registerLibraryAsset(
        project.id,
        assetName,
        description,
        ethPrice,
        usdcPrice,
        walletAddress,
        provider,
        thumbnailId || undefined
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to register library')
      }

      // Deactivate old library
      showPopup('Deactivating previous version...', 'info')
      await disableLibraryRoyalty(asset.projectId, provider)

      showPopup('Library updated successfully!', 'success')
      
      // Navigate to new library page
      setTimeout(() => {
        router.push(`/library/${project.id}`)
      }, 1500)

    } catch (error: any) {
      console.error('Failed to update library:', error)
      showPopup(error.message || 'Failed to update library', 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative shadow-xl border border-gray-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Library</h3>
        <p className="text-sm text-gray-600 mb-6">
          This will create a new version of your library with updated details. 
          The previous version will be automatically deactivated.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Asset Name
            </label>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
              placeholder="Enter asset name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
              placeholder="Describe your library asset"
              rows={3}
            />
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Royalty Currency
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value as 'ETH' | 'USDC')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
              >
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Royalty per Import ({selectedCurrency})
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                placeholder="0.0"
                min="0"
                step={selectedCurrency === 'ETH' ? '0.0001' : '0.01'}
              />
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-700">
              <strong>Note:</strong> The library content cannot be changed. 
              Only metadata and pricing can be updated.
            </p>
          </div>
        </div>
        
        <div className="flex gap-3 pt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={!assetName || isUpdating}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Updating...' : 'Update Library'}
          </button>
        </div>
      </div>
    </div>
  )
}
