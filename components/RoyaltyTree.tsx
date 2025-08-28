'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, ChevronRight } from 'lucide-react'
import { ethers } from 'ethers'

interface RoyaltyTreeProps {
  projectId: string
}

interface Dependency {
  projectId: string
  royaltyPercentage: number
}

export default function RoyaltyTree({ projectId }: RoyaltyTreeProps) {
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    loadDependencies()
  }, [projectId])

  const loadDependencies = async () => {
    try {
      const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS
      
      if (!ROYALTY_CONTRACT_ADDRESS || typeof window === 'undefined' || !window.ethereum) {
        setLoading(false)
        return
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(
        ROYALTY_CONTRACT_ADDRESS,
        ['function getProjectDependencies(string projectId) external view returns (tuple(string dependencyProjectId, uint256 royaltyPercentage)[])'],
        provider
      )
      
      const deps = await contract.getProjectDependencies(projectId)
      
      const formatted = deps.map((dep: any) => ({
        projectId: dep.dependencyProjectId,
        royaltyPercentage: Number(dep.royaltyPercentage)
      }))
      
      setDependencies(formatted)
    } catch (error) {
      console.error('Error loading dependencies:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
      </div>
    )
  }

  if (dependencies.length === 0) {
    return null // No dependencies, don't show anything
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-4"
      >
        <h3 className="text-lg font-semibold text-gray-900">Uses Libraries</h3>
        <ChevronRight 
          size={20} 
          className={`text-gray-600 transition-transform ${expanded ? 'rotate-90' : ''}`} 
        />
      </button>
      
      {expanded && (
        <div className="space-y-3">
          <p className="text-xs text-gray-600 mb-4">
            This project uses {dependencies.length} librar{dependencies.length === 1 ? 'y' : 'ies'}. 
            When purchased, royalties are paid to library owners.
          </p>
          
          {dependencies.map((dep, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <TrendingUp size={16} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 mb-1 truncate">
                    {dep.projectId.slice(0, 20)}...
                  </p>
                  <p className="text-xs text-gray-600">
                    Royalty: {dep.royaltyPercentage / 100}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

