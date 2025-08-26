'use client'

import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect } from 'react'
import { LogIn, LogOut } from 'lucide-react'
import { useFarcasterWallet } from '@/hooks/useFarcasterWallet'

interface ConnectWalletProps {
  onConnect: (address: string) => void
  onDisconnect: () => void
}

export function ConnectWallet({ onConnect, onDisconnect }: ConnectWalletProps) {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { wallets } = useWallets()
  const { isInFarcaster, farcasterAddress, ethereumProvider } = useFarcasterWallet()
  
  // Prefer Farcaster wallet if available, otherwise use Privy wallet
  const walletAddress = farcasterAddress || wallets[0]?.address
  
  useEffect(() => {
    console.log('[ConnectWallet] State:', {
      isInFarcaster,
      farcasterAddress,
      authenticated,
      privyWallet: wallets[0]?.address,
      finalWallet: walletAddress
    })
    
    if (farcasterAddress) {
      // Farcaster wallet has priority
      console.log('[ConnectWallet] Using Farcaster wallet:', farcasterAddress)
      onConnect(farcasterAddress)
    } else if (authenticated && wallets[0]?.address) {
      // Fallback to Privy wallet
      console.log('[ConnectWallet] Using Privy wallet:', wallets[0].address)
      onConnect(wallets[0].address)
    } else {
      onDisconnect()
    }
  }, [authenticated, wallets, farcasterAddress])
  
  const handleConnect = async () => {
    // If in Farcaster, use Farcaster SDK directly
    if (isInFarcaster && ethereumProvider) {
      console.log('[ConnectWallet] Requesting Farcaster wallet connection...')
      try {
        const accounts = await ethereumProvider.request({ 
          method: 'eth_requestAccounts' 
        })
        if (accounts && accounts.length > 0) {
          console.log('[ConnectWallet] Farcaster wallet connected:', accounts[0])
          onConnect(accounts[0])
        }
        return
      } catch (error) {
        console.error('[ConnectWallet] Farcaster wallet connection failed:', error)
        // Fall through to Privy login
      }
    }
    
    // Check if authenticated with wallet
    if (authenticated && walletAddress) {
      console.log('[ConnectWallet] Already connected with wallet:', walletAddress)
      return
    }
    
    // If authenticated but no wallet, logout first and re-login
    if (authenticated && !walletAddress) {
      console.log('[ConnectWallet] Authenticated but no wallet, re-authenticating...')
      try {
        await logout()
        await login()
      } catch (error) {
        console.error('Failed to re-authenticate:', error)
      }
      return
    }
    
    // Normal Privy login flow
    try {
      console.log('[ConnectWallet] Initiating Privy login...')
      await login()
    } catch (error) {
      console.error('Failed to connect:', error)
    }
  }
  
  const handleDisconnect = async () => {
    try {
      await logout()
      onDisconnect()
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }
  
  if (!ready) {
    return (
      <div className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm">
        Loading...
      </div>
    )
  }
  
  // Show disconnect button for both Farcaster and regular wallets
  if (walletAddress) {
    return (
      <button
        onClick={handleDisconnect}
        className="p-3 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-all border border-gray-200"
        title="Disconnect Wallet"
      >
        <LogOut size={20} />
      </button>
    )
  }
  
  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
    >
      <LogIn size={18} />
      <span className="sm:inline hidden">Connect Wallet</span>
      <span className="sm:hidden">Connect</span>
    </button>
  )
}

