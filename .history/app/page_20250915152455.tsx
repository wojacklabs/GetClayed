'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, Clock, Heart, Eye, Star, Search, Filter } from 'lucide-react'
import { queryAllProjects, downloadProjectThumbnail } from '@/lib/clayStorageService'
import { getProjectViewCount, getProjectLikeCount } from '@/lib/profileService'
// import ConnectWallet from '@/components/ConnectWallet'
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
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'trending'>('recent')
  const [userLikes, setUserLikes] = useState<string[]>([])
  const [userFavorites, setUserFavorites] = useState<string[]>([])

  useEffect(() => {
    // Check for connected wallet
    const checkWallet = () => {
      if (typeof window !== 'undefined' && (window as any).solana) {
        (window as any).solana.connect({ onlyIfTrusted: true })
          .then((resp: any) => {
            setWalletAddress(resp.publicKey.toString())
          })
          .catch(() => {
            console.log('Wallet not connected')
          })
      }
    }
    checkWallet()
  }, [])

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

    // Sort
    switch (sortBy) {
      case 'popular':
        filtered = [...filtered].sort((a, b) => b.likes - a.likes)
        break
      case 'trending':
        filtered = [...filtered].sort((a, b) => b.views - a.views)
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
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">GetClayed</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 px-3 py-1.5 pr-8 rounded-md bg-gray-800 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              </div>
              <Link
                href="/project/new"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={16} />
                <span>New</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy('recent')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                sortBy === 'recent' 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setSortBy('popular')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                sortBy === 'popular' 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Popular
            </button>
            <button
              onClick={() => setSortBy('trending')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                sortBy === 'trending' 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Trending
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-700" />
                <div className="p-3">
                  <div className="h-4 bg-gray-700 rounded mb-2" />
                  <div className="h-3 bg-gray-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No projects found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-700 relative overflow-hidden">
                  {project.thumbnail ? (
                    <img 
                      src={project.thumbnail} 
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-2xl font-bold text-gray-600">3D</div>
                    </div>
                  )}
                  
                  {/* Hover overlay with stats */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="flex items-center gap-3 text-xs text-white">
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
                  </div>
                </div>

                {/* Content */}
                <div className="p-3">
                  <h4 className="text-sm font-medium text-white mb-1 truncate">{project.name}</h4>
                  <p className="text-xs text-gray-400 truncate">
                    {formatAddress(project.author)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}