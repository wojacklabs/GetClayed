'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import ProfilePage from '../../../components/ProfilePage'
import { downloadUserProfile, findUserByDisplayName } from '../../../lib/profileService'

declare global {
  interface Window {
    solana?: any
    ethereum?: any
  }
}

// Skeleton component for loading state
function ProfileSkeleton() {
  return (
    <div className="fixed inset-0 bg-gray-50 z-[9998] overflow-auto">
      {/* Close button skeleton */}
      <div className="absolute top-4 right-4 z-10">
        <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
      
      <div className="max-w-6xl mx-auto p-8">
        {/* Profile header skeleton */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-start gap-8">
            {/* Avatar skeleton */}
            <div className="w-24 h-24 bg-gray-200 rounded-full animate-pulse"></div>
            
            {/* Info skeleton */}
            <div className="flex-1">
              <div className="h-8 w-48 bg-gray-200 rounded mb-2 animate-pulse"></div>
              <div className="h-4 w-32 bg-gray-200 rounded mb-4 animate-pulse"></div>
              <div className="flex gap-4">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
            
            {/* Stats skeleton */}
            <div className="flex gap-8">
              <div className="text-center">
                <div className="h-8 w-12 bg-gray-200 rounded mb-1 animate-pulse mx-auto"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="text-center">
                <div className="h-8 w-12 bg-gray-200 rounded mb-1 animate-pulse mx-auto"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="text-center">
                <div className="h-8 w-12 bg-gray-200 rounded mb-1 animate-pulse mx-auto"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Activity chart skeleton */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="h-6 w-32 bg-gray-200 rounded mb-4 animate-pulse"></div>
          <div className="h-32 bg-gray-100 rounded animate-pulse"></div>
        </div>
        
        {/* Projects grid skeleton */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="h-6 w-24 bg-gray-200 rounded mb-6 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <div className="h-48 bg-gray-200 animate-pulse"></div>
                <div className="p-4">
                  <div className="h-5 w-32 bg-gray-200 rounded mb-2 animate-pulse"></div>
                  <div className="flex gap-4">
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [userNotFound, setUserNotFound] = useState(false)
  const [currentUserAddress, setCurrentUserAddress] = useState<string | null>(null)
  
  useEffect(() => {
    // Check for connected wallet
    const checkWallet = async () => {
      if (typeof window !== 'undefined') {
        console.log('[UserProfilePage] Checking wallet connection...')
        
        // Check for Phantom wallet specifically
        const isPhantomInstalled = window.solana && window.solana.isPhantom
        
        if (isPhantomInstalled) {
          console.log('[UserProfilePage] Phantom wallet detected')
          
          // First check if already connected
          if (window.solana.isConnected) {
            try {
              const publicKey = window.solana.publicKey
              if (publicKey) {
                const address = publicKey.toString()
                console.log('[UserProfilePage] Phantom wallet already connected:', address)
                setCurrentUserAddress(address)
                return
              }
            } catch (error) {
              console.log('[UserProfilePage] Error accessing publicKey:', error)
            }
          }
          
          // Try to connect with onlyIfTrusted
          try {
            const resp = await window.solana.connect({ onlyIfTrusted: true })
            const address = resp.publicKey.toString()
            console.log('[UserProfilePage] Phantom wallet connected:', address)
            setCurrentUserAddress(address)
          } catch (error) {
            console.log('[UserProfilePage] Phantom wallet not connected:', error)
          }
        } else if (window.ethereum) {
          console.log('[UserProfilePage] Ethereum wallet detected')
          // Ethereum wallet detected
          try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' })
            if (accounts.length > 0) {
              console.log('[UserProfilePage] Ethereum wallet connected:', accounts[0])
              setCurrentUserAddress(accounts[0])
            } else {
              console.log('[UserProfilePage] No Ethereum accounts found')
            }
          } catch (error) {
            console.log('[UserProfilePage] Ethereum wallet error:', error)
          }
        } else {
          console.log('[UserProfilePage] No wallet detected')
        }
      }
    }
    
    // Add a small delay to ensure wallet extension is loaded
    setTimeout(checkWallet, 100)
  }, [])
  
  useEffect(() => {
    const loadUser = async () => {
      setLoading(true)
      setUserNotFound(false)
      
      const addressOrName = params.address as string
      
      try {
        // Check if it's a wallet address (Solana or Ethereum)
        // Ethereum addresses start with 0x and are 42 characters
        // Solana addresses are base58 encoded and typically 32-44 characters
        const isEthereumAddress = addressOrName.startsWith('0x') && addressOrName.length === 42
        const isSolanaAddress = addressOrName.length >= 32 && addressOrName.length <= 44 && !addressOrName.includes(' ') && !addressOrName.startsWith('0x')
        
        if (isEthereumAddress || isSolanaAddress) {
          // Verify the user exists by trying to load their profile
          const profile = await downloadUserProfile(addressOrName)
          if (profile || true) { // Allow access even if no profile exists yet
            setWalletAddress(addressOrName)
          } else {
            setUserNotFound(true)
          }
        } else {
          // It's a display name, need to find the wallet address
          const walletAddr = await findUserByDisplayName(addressOrName)
          if (walletAddr) {
            setWalletAddress(walletAddr)
          } else {
            setUserNotFound(true)
          }
        }
      } catch (error) {
        console.error('Error loading user:', error)
        setUserNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    
    loadUser()
  }, [params.address])
  
  const handleProjectSelect = (projectId: string) => {
    router.push(`/project/${projectId}`)
  }
  
  // Show skeleton while loading
  if (loading) {
    return <ProfileSkeleton />
  }
  
  // Show not found if user doesn't exist
  if (userNotFound) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-[9998] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">User not found</h2>
          <p className="text-gray-600">No user found: {params.address}</p>
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
  
  // Show profile page
  if (walletAddress) {
    console.log('[UserProfilePage] Rendering ProfilePage with:', {
      walletAddress,
      currentUserAddress,
      currentUserAddressType: typeof currentUserAddress
    })
    return (
      <ProfilePage
        walletAddress={walletAddress}
        currentUserAddress={currentUserAddress || undefined}
        onClose={() => router.push('/')}
        onProjectSelect={handleProjectSelect}
      />
    )
  }
  
  // Fallback (should not reach here)
  return null
}
