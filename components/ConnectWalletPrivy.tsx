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
    if (ready && authenticated && walletAddress) {
      console.log('[Privy] Wallet connected:', walletAddress)
      onConnect(walletAddress)
    } else if (ready && !authenticated) {
      console.log('[Privy] Wallet disconnected')
      onDisconnect()
    }
  }, [ready, authenticated, walletAddress, onConnect, onDisconnect])
  
  const handleConnect = async () => {
    try {
      console.log('[Privy] Initiating login...')
      await login()
    } catch (error) {
      console.error('[Privy] Failed to connect:', error)
      // Show user-friendly error message if needed
    }
  }
  
  const handleDisconnect = async () => {
    try {
      console.log('[Privy] Initiating logout...')
      await logout()
      onDisconnect()
    } catch (error) {
      console.error('[Privy] Failed to disconnect:', error)
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
      <div className="flex items-center gap-2">
        <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </div>
        <button
          onClick={handleDisconnect}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          title="Disconnect"
        >
          <LogOut size={20} />
        </button>
      </div>
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

