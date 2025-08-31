import React, { useState, useEffect } from 'react'
import { ethers, providers } from 'ethers'
import { LogIn, LogOut } from 'lucide-react'

interface ConnectWalletProps {
  onConnect: (address: string) => void
  onDisconnect: () => void
}

// Global type declarations are in app/components/AdvancedClay.tsx

export const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect, onDisconnect }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)

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
    const provider = window.ethereum || window.okxwallet || (window.web3 && window.web3.currentProvider)
    
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
    window.location.reload()
  }

  const handleDisconnect = () => {
    disconnectWallet()
  }

  const checkConnection = async () => {
    const provider = window.ethereum || window.okxwallet || (window.web3 && window.web3.currentProvider)
    
    if (provider) {
      try {
        const ethersProvider = new providers.Web3Provider(provider)
        const accounts = await ethersProvider.listAccounts()
        
        if (accounts.length > 0) {
          const addr = accounts[0].address
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
    const provider = window.ethereum || window.okxwallet || (window.web3 && window.web3.currentProvider)
    
    if (!provider) {
      alert('Please install MetaMask, OKX Wallet, or another Ethereum wallet')
      return
    }

    setIsConnecting(true)
    try {
      const ethersProvider = new ethers.BrowserProvider(provider)
      
      // Switch to Irys testnet
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x4f6' }], // 1270 in hex
        })
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          // Chain not added, add it
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x4f6',
              chainName: 'Irys Testnet',
              nativeCurrency: {
                name: 'IRYS',
                symbol: 'IRYS',
                decimals: 18
              },
              rpcUrls: ['https://testnet-rpc.irys.xyz/v1/execution-rpc'],
              blockExplorerUrls: ['https://testnet-explorer.irys.xyz']
            }],
          })
        }
      }
      
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
      alert('Failed to connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setAddress('')
    setIsConnected(false)
    onDisconnect()
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
}
