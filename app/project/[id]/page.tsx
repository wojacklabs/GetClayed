'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import ProjectDetailView from '../../../components/ProjectDetailView'
import { ConnectWallet } from '../../../components/ConnectWallet'

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  
  const projectId = params.id as string
  
  // Check if wallet is connected
  useEffect(() => {
    const checkWallet = async () => {
      const provider = (window as any).ethereum || (window as any).okxwallet
      if (provider) {
        try {
          const accounts = await provider.request({ method: 'eth_accounts' })
          if (accounts && accounts.length > 0) {
            setWalletAddress(accounts[0])
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error)
        }
      }
    }
    checkWallet()
  }, [])
  
  return (
    <>
      <ProjectDetailView
        projectId={projectId}
        walletAddress={walletAddress}
        onBack={() => router.back()}
      />
      
      {/* Wallet connection in corner */}
      <div className="fixed bottom-4 left-4 z-[9999]">
        <ConnectWallet
          onConnect={setWalletAddress}
          onDisconnect={() => setWalletAddress(null)}
        />
      </div>
    </>
  )
}
