'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import ProfilePage from '../../../components/ProfilePage'
import { downloadUserProfile, findUserByDisplayName } from '../../../lib/profileService'

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  
  useEffect(() => {
    const addressOrName = params.address as string
    
    // Check if it's a wallet address (starts with 0x and has 42 characters)
    if (addressOrName.startsWith('0x') && addressOrName.length === 42) {
      setWalletAddress(addressOrName)
    } else {
      // It's a display name, need to find the wallet address
      findWalletByDisplayName(addressOrName)
    }
  }, [params.address])
  
  const findWalletByDisplayName = async (name: string) => {
    setDisplayName(name)
    try {
      const walletAddr = await findUserByDisplayName(name)
      if (walletAddr) {
        setWalletAddress(walletAddr)
      }
    } catch (error) {
      console.error('Error finding user by display name:', error)
    }
  }
  
  const handleProjectSelect = (projectId: string) => {
    // Navigate to project detail page
    router.push(`/project/${projectId}`)
  }
  
  if (!walletAddress && displayName) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-[9998] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">User not found</h2>
          <p className="text-gray-600">No user found with username: {displayName}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }
  
  if (!walletAddress) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-[9998] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  return (
    <ProfilePage
      walletAddress={walletAddress}
      onClose={() => router.push('/')}
      onProjectSelect={handleProjectSelect}
    />
  )
}
