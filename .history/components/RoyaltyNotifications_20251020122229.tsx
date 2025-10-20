'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, DollarSign, TrendingUp } from 'lucide-react'
import { getPendingRoyalties, getRoyaltyEvents, RoyaltyEvent } from '../lib/royaltyClaimService'
import Link from 'next/link'

interface RoyaltyNotificationsProps {
  walletAddress: string
}

export default function RoyaltyNotifications({ walletAddress }: RoyaltyNotificationsProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [pendingETH, setPendingETH] = useState('0')
  const [pendingUSDC, setPendingUSDC] = useState('0')
  const [recentEvents, setRecentEvents] = useState<RoyaltyEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [showAllNotifications, setShowAllNotifications] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadNotifications()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [walletAddress])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const loadNotifications = async () => {
    try {
      const [royalties, events] = await Promise.all([
        getPendingRoyalties(walletAddress),
        getRoyaltyEvents(walletAddress)
      ])
      
      setPendingETH(royalties.eth)
      setPendingUSDC(royalties.usdc)
      
      // Filter recent recorded events (last 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
      const recent = events
        .filter(e => e.type === 'recorded' && e.timestamp > oneDayAgo)
        .slice(0, 5)
      
      setRecentEvents(recent)
      
      // Calculate unread (new royalties in last 24h)
      setUnreadCount(recent.length)
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const hasPendingRoyalties = parseFloat(pendingETH) > 0 || parseFloat(pendingUSDC) > 0

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative p-2 hover:bg-gray-100 rounded-md transition-colors"
        >
          <Bell size={20} className="text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-gray-800 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Royalty Notifications</h3>
            </div>
            
            <div className="overflow-y-auto flex-1">
              {/* Pending Royalties Summary */}
              {hasPendingRoyalties && (
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Pending Claim</p>
                  <div className="flex items-center gap-3 mb-2">
                    {parseFloat(pendingETH) > 0 && (
                      <span className="text-sm font-medium text-gray-900">
                        {parseFloat(pendingETH).toFixed(4)} ETH
                      </span>
                    )}
                    {parseFloat(pendingUSDC) > 0 && (
                      <span className="text-sm font-medium text-gray-900">
                        {parseFloat(pendingUSDC).toFixed(2)} USDC
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/user/${walletAddress}`}
                    className="text-xs text-gray-700 hover:text-gray-900 font-medium"
                    onClick={() => setShowDropdown(false)}
                  >
                    Go to Profile to Claim →
                  </Link>
                </div>
              )}
              
              {/* Recent Events */}
              <div className="py-2">
                {recentEvents.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <TrendingUp size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No recent royalties</p>
                  </div>
                ) : (
                  recentEvents.map((event, idx) => (
                    <div key={idx} className="px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          <DollarSign size={16} className="text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-900 font-medium mb-1">
                            New Royalty Earned
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                            {parseFloat(event.amountETH) > 0 && (
                              <span>{parseFloat(event.amountETH).toFixed(4)} ETH</span>
                            )}
                            {parseFloat(event.amountUSDC) > 0 && (
                              <span>{parseFloat(event.amountUSDC).toFixed(2)} USDC</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {getTimeAgo(event.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* More Link */}
              {recentEvents.length > 0 && (
                <div className="p-3 border-t border-gray-200 text-center">
                  <button
                    onClick={() => {
                      setShowAllNotifications(true)
                      setShowDropdown(false)
                    }}
                    className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                  >
                    View All
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* All Notifications Modal */}
      {showAllNotifications && (
        <div className="fixed inset-0 flex items-center justify-center z-[10000] bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">All Notifications</h3>
              <button
                onClick={() => setShowAllNotifications(false)}
                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
                  ))}
                </div>
              ) : recentEvents.length === 0 ? (
                <div className="text-center py-12">
                  <Bell size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No notifications</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEvents.map((event, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign size={16} className="text-green-600" />
                        <span className="text-sm font-medium text-gray-900">New Royalty</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {new Date(event.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {event.projectId && (
                        <p className="text-xs text-gray-600 mb-1">From: {event.projectId.slice(0, 12)}...</p>
                      )}
                      
                      <div className="flex items-center gap-3 text-sm">
                        {parseFloat(event.amountETH) > 0 && (
                          <span className="text-gray-900 font-medium">
                            {parseFloat(event.amountETH).toFixed(4)} ETH
                          </span>
                        )}
                        {parseFloat(event.amountUSDC) > 0 && (
                          <span className="text-gray-900 font-medium">
                            {parseFloat(event.amountUSDC).toFixed(2)} USDC
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowAllNotifications(false)}
                className="w-full px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg transition-all text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

