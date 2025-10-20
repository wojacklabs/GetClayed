'use client'

import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect } from 'react'
import { LogIn, LogOut } from 'lucide-react'

interface ConnectWalletProps {
  onConnect: (address: string) => void
  onDisconnect: () => void
}

export function ConnectWallet({ onConnect, onDisconnect }: ConnectWalletProps) {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { wallets } = useWallets()
  
  // Get the first wallet address
  const walletAddress = wallets[0]?.address
  
  useEffect(() => {
    if (authenticated && walletAddress) {
      onConnect(walletAddress)
    } else {
      onDisconnect()
    }
  }, [authenticated, walletAddress])
  
  const handleConnect = async () => {
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
    
    // Normal login flow
    try {
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
  
  if (authenticated && walletAddress) {
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
      className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
    >
      <LogIn size={18} />
      <span>Connect Wallet</span>
    </button>
  )
}

