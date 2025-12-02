'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, Clock, Heart, Eye, Star, Search, Filter, User, Wallet, ChevronDown, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { queryAllProjects, downloadProjectThumbnail } from '@/lib/clayStorageService'
import { getProjectViewCount, getProjectLikeCount, downloadUserProfile, downloadProfileAvatar, getUserFollowing } from '@/lib/profileService'
import { syncProjectMutableReferences } from '@/lib/mutableSyncService'
import { ConnectWallet } from '@/components/ConnectWallet'
import { usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AnimatedClayLogo } from '@/components/AnimatedClayLogo'
import RoyaltyNotifications from '@/components/RoyaltyNotifications'
import MiniViewer from '@/components/MiniViewer'
import { restoreClayObjects } from '@/lib/clayStorageService'

const SimpleClay = dynamic(() => import('@/components/SimpleClay'), { 
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Try it!</h2>
          <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="w-full h-80 bg-gray-100 animate-pulse" />
    </div>
  )
})

// AnimatedClayLogo is now imported from components

interface Project {
  id: string
  projectId: string // Stable Project-ID (persists across updates)
  name: string
  author: string
  timestamp: number
  thumbnail?: string
  clayObjects?: any[]
  likes: number
  views: number
  favorites: number
}

export default function HomePage() {
  const router = useRouter()
  const { logout } = usePrivy()
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'trending' | 'following'>('recent')
  const [userLikes, setUserLikes] = useState<string[]>([])
  const [userFavorites, setUserFavorites] = useState<string[]>([])
  const [userProfiles, setUserProfiles] = useState<Map<string, { displayName: string; avatarUrl?: string }>>(new Map())
  const [followingUsers, setFollowingUsers] = useState<string[]>([])
  const [currentUserProfile, setCurrentUserProfile] = useState<{ displayName?: string; avatarUrl?: string } | null>(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const projectsPerPage = 10 // Changed to 10 per page to ensure all canvases are visible

  // Remove automatic wallet check - rely on ConnectWallet component instead

  // Load projects only once on initial mount
  useEffect(() => {
    loadProjects()
  }, [])

  // Load user-specific data when wallet connects
  useEffect(() => {
    if (walletAddress) {
      loadUserPreferences()
      loadUserSpecificData()
    }
  }, [walletAddress])

  useEffect(() => {
    filterAndSortProjects()
    setCurrentPage(1) // Reset to first page when filter/sort changes
  }, [projects, searchQuery, sortBy, followingUsers])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const loadProjects = async () => {
    try {
      setLoading(true)
      // Query all projects from the community
      const allProjects = await queryAllProjects()
      
      // Transform and enrich project data
      const enrichedProjects = await Promise.all(
        allProjects.map(async (project) => {
          // Get actual stats using projectId (stable across updates), not transaction id
          const [views, likes] = await Promise.all([
            getProjectViewCount(project.projectId),
            getProjectLikeCount(project.projectId)
          ])
          
          // Get thumbnail if available
          let thumbnail: string | undefined
          if (project.tags['Thumbnail-ID']) {
            try {
              const result = await downloadProjectThumbnail(project.tags['Thumbnail-ID'])
              if (result) thumbnail = result
            } catch (error) {
              console.error('Failed to load thumbnail:', error)
            }
          }
          
          return {
            ...project,
            thumbnail,
            likes,
            views,
            favorites: 0 // TODO: Implement favorites count
          }
        })
      )
      
      setProjects(enrichedProjects)
      
      // Load user profiles for display names and avatars
      const uniqueAuthors = [...new Set(enrichedProjects.map(p => p.author))]
      const profileMap = new Map<string, { displayName: string; avatarUrl?: string }>()
      
      await Promise.all(
        uniqueAuthors.map(async (author) => {
          try {
            const profile = await downloadUserProfile(author)
            if (profile) {
              let avatarDataUrl: string | undefined
              if (profile.avatarUrl) {
                const avatar = await downloadProfileAvatar(profile.avatarUrl)
                if (avatar) avatarDataUrl = avatar
              }
              profileMap.set(author, {
                displayName: profile.displayName || formatAddress(author),
                avatarUrl: avatarDataUrl
              })
            } else {
              // No profile found, but still show the author with default values
              profileMap.set(author, {
                displayName: formatAddress(author),
                avatarUrl: undefined
              })
            }
          } catch (error) {
            console.error(`Failed to load profile for ${author}:`, error)
            // Even on error, show the author with default values
            profileMap.set(author, {
              displayName: formatAddress(author),
              avatarUrl: undefined
            })
          }
        })
      )
      
      setUserProfiles(profileMap)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserSpecificData = async () => {
    if (!walletAddress) return
    
    try {
      // Sync project mutable references from blockchain
      await syncProjectMutableReferences(walletAddress)
      
      // Load following users
      const following = await getUserFollowing(walletAddress)
      setFollowingUsers(following)
      
      // Load current user's profile
      try {
        const profile = await downloadUserProfile(walletAddress)
        if (profile) {
          let avatarUrl: string | undefined
          if (profile.avatarUrl) {
            const avatar = await downloadProfileAvatar(profile.avatarUrl)
            if (avatar) avatarUrl = avatar
          }
          setCurrentUserProfile({
            displayName: profile.displayName,
            avatarUrl
          })
        }
      } catch (error) {
        console.error('Failed to load current user profile:', error)
      }
    } catch (error) {
      console.error('Failed to load user-specific data:', error)
    }
  }

  const loadUserPreferences = async () => {
    if (!walletAddress) return
    
    try {
      // TODO: Implement user likes and favorites loading from blockchain or storage
      // For now, just initialize empty arrays
      setUserLikes([])
      setUserFavorites([])
    } catch (error) {
      console.error('Failed to load user preferences:', error)
    }
  }

  const filterAndSortProjects = () => {
    let filtered = projects

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.author.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Following filter
    if (sortBy === 'following' && followingUsers.length > 0) {
      filtered = filtered.filter(project => 
        followingUsers.includes(project.author.toLowerCase())
      )
    }

    // Sort
    switch (sortBy) {
      case 'popular':
        filtered = [...filtered].sort((a, b) => b.likes - a.likes)
        break
      case 'trending':
        filtered = [...filtered].sort((a, b) => b.views - a.views)
        break
      case 'following':
        // For following, sort by recent
        filtered = [...filtered].sort((a, b) => b.timestamp - a.timestamp)
        break
      case 'recent':
      default:
        filtered = [...filtered].sort((a, b) => b.timestamp - a.timestamp)
    }

    setFilteredProjects(filtered)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    return `${months}mo ago`
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center">
              <div className="w-12 h-12">
                <Canvas
                  camera={{ position: [0, 0, 2], fov: 50 }}
                  style={{ background: 'transparent' }}
                >
                  <Suspense fallback={null}>
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[5, 5, 5]} intensity={0.5} />
                    <AnimatedClayLogo />
                  </Suspense>
                </Canvas>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-32 sm:w-48 px-2.5 sm:px-3 py-1.5 pr-8 rounded-md bg-gray-50 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-200"
                />
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              </div>
              
              {/* Always render ConnectWallet but hide it when connected */}
              <div style={{ display: walletAddress ? 'none' : 'block' }}>
                <ConnectWallet 
                  onConnect={(address) => setWalletAddress(address)}
                  onDisconnect={() => {
                    setWalletAddress(null)
                    setCurrentUserProfile(null)
                    setUserLikes([])
                    setUserFavorites([])
                  }}
                />
              </div>
              
              {walletAddress && (
                <div className="flex items-center gap-2">
                  <Link
                    href="/project/new"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                  >
                    <Plus size={16} />
                    <span className="sm:inline hidden">New</span>
                  </Link>
                  
                  {/* Royalty Notifications */}
                  <RoyaltyNotifications walletAddress={walletAddress} />
                  
                  {/* Profile Button with Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                      className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                        {currentUserProfile?.avatarUrl ? (
                          <img 
                            src={currentUserProfile.avatarUrl} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={16} className="text-gray-400" />
                        )}
                      </div>
                      <ChevronDown size={16} className="text-gray-600" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {showProfileDropdown && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">
                            {currentUserProfile?.displayName || walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)}
                          </p>
                          <p className="text-xs text-gray-500">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
                        </div>
                        
                        <Link
                          href={`/user/${walletAddress}`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={() => setShowProfileDropdown(false)}
                        >
                          My Profile
                        </Link>
                        
                        <button
                          onClick={async () => {
                            setShowProfileDropdown(false)
                            
                            try {
                              // Privy logout first
                              await logout()
                              
                              // Clear local state
                              setWalletAddress(null)
                              setCurrentUserProfile(null)
                              setUserLikes([])
                              setUserFavorites([])
                              setFollowingUsers([])
                              
                              // Clear session storage
                              sessionStorage.clear()
                            } catch (error) {
                              console.error('Disconnect error:', error)
                            }
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors border-t border-gray-100"
                        >
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Clay Demo Section */}
        <SimpleClay />
        
        {/* Featured Authors Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Authors</h2>
          {loading ? (
            <div className="flex gap-6 overflow-x-auto pb-4 px-2 -mx-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-shrink-0">
                  <div className="w-20 h-20 bg-gray-200 rounded-full animate-pulse mb-2" />
                  <div className="w-20 h-3 bg-gray-200 rounded animate-pulse mx-auto" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-6 overflow-x-auto pb-4 px-2 -mx-2">
              {userProfiles.size === 0 ? (
                <div className="w-full text-center py-8">
                  <User size={48} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No authors yet</p>
                </div>
              ) : (
                Array.from(userProfiles.entries())
                  .slice(0, 10)
                  .map(([address, profile]) => (
                    <Link
                      key={address}
                      href={`/user/${address}`}
                      className="flex-shrink-0 text-center group"
                    >
                      <div className="w-20 h-20 rounded-full bg-gray-200 mb-2 group-hover:shadow-md group-hover:shadow-gray-300 transition-all relative">
                        {profile.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt={profile.displayName}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center rounded-full">
                            <User size={32} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 truncate w-20">
                        {profile.displayName || formatAddress(address)}
                      </p>
                    </Link>
                  ))
              )}
            </div>
          )}
        </div>

        {/* Library & Marketplace Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Library */}
          <Link href="/library" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Library</h2>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-gray-600 transition-colors">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <p className="text-sm text-gray-600">Browse and purchase reusable 3D assets</p>
          </Link>
          
          {/* Marketplace */}
          <Link href="/marketplace" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Marketplace</h2>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-gray-600 transition-colors">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </div>
            <p className="text-sm text-gray-600">Buy and sell unique 3D creations</p>
          </Link>
        </div>

        {/* Projects Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
            {/* Desktop: Button Group, Mobile: Select */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => setSortBy('recent')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  sortBy === 'recent' 
                    ? 'bg-gray-800 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  sortBy === 'popular' 
                    ? 'bg-gray-800 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Popular
              </button>
              <button
                onClick={() => setSortBy('trending')}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  sortBy === 'trending' 
                    ? 'bg-gray-800 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Trending
              </button>
              {walletAddress && (
                <button
                  onClick={() => setSortBy('following')}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    sortBy === 'following' 
                      ? 'bg-gray-800 text-white' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Following
                </button>
              )}
            </div>
            {/* Mobile Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'trending' | 'following')}
              className="sm:hidden px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="recent">Recent</option>
              <option value="popular">Popular</option>
              <option value="trending">Trending</option>
              {walletAddress && <option value="following">Following</option>}
            </select>
          </div>

          {/* Projects Grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg overflow-hidden animate-pulse shadow-sm">
                <div className="aspect-square bg-gray-200" />
                <div className="p-3">
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {sortBy === 'following' && followingUsers.length === 0 
                ? 'You are not following anyone yet' 
                : sortBy === 'following'
                ? 'No projects from users you follow'
                : 'No projects found'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProjects
                .slice((currentPage - 1) * projectsPerPage, currentPage * projectsPerPage)
                .map((project) => (
              <div key={project.projectId} className="bg-white rounded-lg overflow-hidden hover:shadow-md transition-shadow group border border-gray-200">
                <Link
                  href={`/project/${project.projectId}`}
                  className="block"
                >
                  {/* 3D Preview - use transaction id for actual data loading */}
                  <MiniViewer 
                    projectId={project.id}
                    className="aspect-square"
                  />

                  {/* Content */}
                  <div className="p-3">
                    <h4 className="text-sm font-medium text-gray-900 truncate mb-1">{project.name}</h4>
                    <div className="flex items-center justify-end gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Heart size={12} />
                        {project.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {project.views}
                      </span>
                    </div>
                  </div>
                </Link>
                
                {/* Author Profile - Outside the project link */}
                <Link 
                  href={`/user/${project.author}`}
                  className="flex items-center gap-2 p-3 border-t border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {userProfiles.get(project.author)?.avatarUrl ? (
                    <img 
                      src={userProfiles.get(project.author)?.avatarUrl} 
                      alt={userProfiles.get(project.author)?.displayName}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                      <User size={16} className="text-gray-400" />
                    </div>
                  )}
                  <p className="text-xs text-gray-600 truncate flex-1">
                    {userProfiles.get(project.author)?.displayName || formatAddress(project.author)}
                  </p>
                </Link>
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {filteredProjects.length > projectsPerPage && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: Math.ceil(filteredProjects.length / projectsPerPage) }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg ${
                      currentPage === page
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(Math.min(Math.ceil(filteredProjects.length / projectsPerPage), currentPage + 1))}
                disabled={currentPage === Math.ceil(filteredProjects.length / projectsPerPage)}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
          </>
        )}
        </div>
      </main>
    </div>
  )
}