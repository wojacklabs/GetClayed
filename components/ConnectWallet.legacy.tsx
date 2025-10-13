import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { ethers } from 'ethers'
import { LogIn, LogOut } from 'lucide-react'
import { usePopup } from './PopupNotification'

interface ConnectWalletProps {
  onConnect: (address: string) => void
  onDisconnect: () => void
}

export interface ConnectWalletRef {
  disconnectWallet: () => Promise<void>
}

// Global type declarations are in app/components/AdvancedClay.tsx

export const ConnectWallet = forwardRef<ConnectWalletRef, ConnectWalletProps>(({ onConnect, onDisconnect }, ref) => {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)
  const { showPopup } = usePopup()

  useImperativeHandle(ref, () => ({
    disconnectWallet
  }))

  useEffect(() => {
    checkConnection()
    setupWalletListeners()
    
    return () => {
      removeWalletListeners()
    }
  }, [])

  const setupWalletListeners = () => {
    const provider = (window as any).ethereum || (window as any).okxwallet || ((window as any).web3 && (window as any).web3.currentProvider)
    
    if (provider && provider.on) {
      provider.on('accountsChanged', handleAccountsChanged)
      provider.on('chainChanged', handleChainChanged)
      provider.on('disconnect', handleDisconnect)
    }
  }

  const removeWalletListeners = () => {
    const provider = (window as any).ethereum || (window as any).okxwallet || ((window as any).web3 && (window as any).web3.currentProvider)
    
    if (provider && provider.removeListener) {
      provider.removeListener('accountsChanged', handleAccountsChanged)
      provider.removeListener('chainChanged', handleChainChanged)
      provider.removeListener('disconnect', handleDisconnect)
    }
  }

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnectWallet()
    } else if (accounts[0] !== address) {
      const newAddress = accounts[0]
      setAddress(newAddress)
      setIsConnected(true)
      onConnect(newAddress)
    }
  }

  const handleChainChanged = () => {
    // Instead of reloading, just show a warning
    showPopup('Network changed. Please ensure you are on the correct network.', 'warning')
  }

  const handleDisconnect = () => {
    disconnectWallet()
  }

  const checkConnection = async () => {
    const provider = (window as any).ethereum || (window as any).okxwallet || ((window as any).web3 && (window as any).web3.currentProvider)
    
    if (provider) {
      try {
        const ethersProvider = new ethers.BrowserProvider(provider)
        const accounts = await provider.request({ method: 'eth_accounts' })
        
        if (accounts.length > 0) {
          const addr = accounts[0]
          setAddress(addr)
          setIsConnected(true)
          onConnect(addr)
        }
      } catch (error) {
        console.error('Error checking connection:', error)
      }
    }
  }

  const connectWallet = async () => {
    const provider = (window as any).ethereum || (window as any).okxwallet || ((window as any).web3 && (window as any).web3.currentProvider)
    
    if (!provider) {
      showPopup('Please install MetaMask, OKX Wallet, or another Ethereum wallet', 'error')
      return
    }

    setIsConnecting(true)
    try {
      const ethersProvider = new ethers.BrowserProvider(provider)
      
      // Don't switch chains - just connect to whatever chain the user is on
      
      // Request account access
      if (provider.request) {
        await provider.request({ method: 'eth_requestAccounts' })
      } else {
        await ethersProvider.send("eth_requestAccounts", [])
      }
      
      const signer = await ethersProvider.getSigner()
      const addr = await signer.getAddress()
      
      setAddress(addr)
      setIsConnected(true)
      onConnect(addr)
      
      setupWalletListeners()
    } catch (error) {
      console.error('Error connecting wallet:', error)
      showPopup('Failed to connect wallet', 'error')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    // Try multiple disconnect methods for better compatibility
    const provider = (window as any).ethereum || (window as any).okxwallet || ((window as any).web3 && (window as any).web3.currentProvider)
    
    let disconnectSuccessful = false
    
    if (provider) {
      try {
        // Method 1: Try wallet_revokePermissions (EIP-2255)
        if (provider.request) {
          try {
            await provider.request({
              method: "wallet_revokePermissions",
              params: [{ eth_accounts: {} }]
            })
            disconnectSuccessful = true
          } catch (error) {
            // Not all wallets support this, continue with other methods
            console.log('wallet_revokePermissions not supported')
          }
        }
        
        // Method 2: Try disconnect if available
        if (!disconnectSuccessful && provider.disconnect && typeof provider.disconnect === 'function') {
          try {
            await provider.disconnect()
            disconnectSuccessful = true
          } catch (error) {
            console.log('disconnect method failed')
          }
        }
        
        // Method 3: Clear any cached connection data
        if (provider.selectedAddress) {
          provider.selectedAddress = null
        }
        if (provider.isConnected && typeof provider.isConnected === 'function') {
          // Some wallets have isConnected as a property, not a function
          try {
            provider.isConnected = false
          } catch (error) {
            // Ignore if read-only
          }
        }
      } catch (error) {
        console.error('Error during disconnect:', error)
      }
    }
    
    // Always clear local state regardless of wallet disconnect success
    setAddress('')
    setIsConnected(false)
    removeWalletListeners()
    onDisconnect()
    
    // Clear any localStorage data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('walletconnect')
      localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE')
      // Clear any other wallet-related localStorage items
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('wagmi') || key.startsWith('wallet')) {
          localStorage.removeItem(key)
        }
      })
    }
    
    // Show info popup if wallet disconnect wasn't fully successful
    if (!disconnectSuccessful && provider) {
      showPopup(
        'Disconnected from app. To fully disconnect, please also disconnect this site in your wallet settings.',
        'info'
      )
    }
  }

  return (
    <>
      {isConnected ? (
        <button
          onClick={disconnectWallet}
          className="p-3 rounded-lg bg-white hover:bg-red-50 text-red-500 transition-all"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      ) : (
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="p-3 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-all"
          title="Connect Wallet"
        >
          {isConnecting ? '...' : <LogIn size={20} />}
        </button>
      )}
    </>
  )
})
