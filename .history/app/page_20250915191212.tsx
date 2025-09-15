'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, Clock, Heart, Eye, Star, Search, Filter, User, Wallet } from 'lucide-react'
import { queryAllProjects, downloadProjectThumbnail } from '@/lib/clayStorageService'
import { getProjectViewCount, getProjectLikeCount, downloadUserProfile, downloadProfileAvatar, getUserFollowing } from '@/lib/profileService'
import { syncProjectMutableReferences } from '@/lib/mutableSyncService'
import { ConnectWallet } from '@/components/ConnectWallet'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  author: string
  timestamp: number
  thumbnail?: string
  likes: number
  views: number
  favorites: number
}

export default function HomePage() {
  const router = useRouter()
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

  // Remove automatic wallet check - rely on ConnectWallet component instead

  useEffect(() => {
    loadProjects()
    if (walletAddress) {
      loadUserPreferences()
    }
  }, [walletAddress])

  useEffect(() => {
    filterAndSortProjects()
  }, [projects, searchQuery, sortBy])

  const loadProjects = async () => {
    try {
      setLoading(true)
      // Query all projects from the community
      const allProjects = await queryAllProjects()
      
      // Transform and enrich project data
      const enrichedProjects = await Promise.all(
        allProjects.map(async (project) => {
          // Get actual stats
          const [views, likes] = await Promise.all([
            getProjectViewCount(project.id),
            getProjectLikeCount(project.id)
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
            }
          } catch (error) {
            console.error(`Failed to load profile for ${author}:`, error)
          }
        })
      )
      
      setUserProfiles(profileMap)
      
      // Load following users and sync mutable references if wallet is connected
      if (walletAddress) {
        try {
          // Sync project mutable references from blockchain
          await syncProjectMutableReferences(walletAddress)
          
          // Load following users
          const following = await getUserFollowing(walletAddress)
          setFollowingUsers(following)
        } catch (error) {
          console.error('Failed to load user data:', error)
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserPreferences = async () => {
    if (!walletAddress) return
    
    try {
      // TODO: Implement user likes and favorites loading
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
              <h1 className="text-xl font-bold text-gray-900">GetClayed</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 px-3 py-1.5 pr-8 rounded-md bg-gray-50 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-200"
                />
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              </div>
              
              {walletAddress ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                  <Link
                    href="/project/new"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                  >
                    <Plus size={16} />
                    <span>New</span>
                  </Link>
                </div>
              ) : (
                <ConnectWallet 
                  onConnect={(address) => setWalletAddress(address)}
                  onDisconnect={() => setWalletAddress(null)}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Featured Authors Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Featured Authors</h2>
          {loading ? (
            <div className="flex gap-4 overflow-x-auto">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-shrink-0">
                  <div className="w-20 h-20 bg-gray-200 rounded-full animate-pulse mb-2" />
                  <div className="w-20 h-3 bg-gray-200 rounded animate-pulse mx-auto" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-6 overflow-x-auto pb-2">
              {Array.from(userProfiles.entries())
                .slice(0, 10)
                .map(([address, profile]) => (
                  <Link
                    key={address}
                    href={`/user/${address}`}
                    className="flex-shrink-0 text-center group"
                  >
                    <div className="w-20 h-20 rounded-full bg-gray-200 mb-2 group-hover:ring-2 group-hover:ring-gray-400 transition-all relative">
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
                ))}
            </div>
          )}
        </div>

        {/* Projects Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
            <div className="flex items-center gap-2">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg overflow-hidden hover:shadow-md transition-shadow group border border-gray-200">
                <Link
                  href={`/project/${project.id}`}
                  className="block"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {project.thumbnail ? (
                      <img 
                        src={project.thumbnail} 
                        alt={project.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-2xl font-bold text-gray-300">3D</div>
                      </div>
                    )}
                  </div>

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
          )}
        </div>
      </main>
    </div>
  )
}