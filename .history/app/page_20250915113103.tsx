'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, Clock, Heart, Eye, Star, Search, Filter } from 'lucide-react'
import { queryAllProjects, downloadProjectThumbnail } from '@/lib/clayStorageService'
import { getUserLikes, getUserFavorites, getProjectViewCount, getProjectLikes, getProjectFavorites } from '@/lib/profileService'
import ConnectWallet from '@/components/ConnectWallet'
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
      if (typeof window !== 'undefined' && window.solana) {
        window.solana.connect({ onlyIfTrusted: true })
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
      const enrichedProjects = allProjects.map(project => ({
        ...project,
        likes: Math.floor(Math.random() * 100), // TODO: Get actual likes
        views: Math.floor(Math.random() * 1000), // TODO: Get actual views
        favorites: Math.floor(Math.random() * 50) // TODO: Get actual favorites
      }))
      
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
      const [likes, favorites] = await Promise.all([
        getUserLikes(walletAddress),
        getUserFavorites(walletAddress)
      ])
      setUserLikes(likes)
      setUserFavorites(favorites)
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">GetClayed</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <Link
                href="/project/new"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                <span>New Project</span>
              </Link>
              <ConnectWallet />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4">What do you want to create?</h2>
          <p className="text-xl opacity-90 mb-8">Start building with a simple prompt. No coding needed.</p>
          
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-gray-900">From the Community</h3>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => setSortBy('recent')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  sortBy === 'recent' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Clock size={16} className="inline mr-2" />
                Recent
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  sortBy === 'popular' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Heart size={16} className="inline mr-2" />
                Popular
              </button>
              <button
                onClick={() => setSortBy('trending')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  sortBy === 'trending' 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <TrendingUp size={16} className="inline mr-2" />
                Trending
              </button>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-200" />
                <div className="p-4">
                  <div className="h-6 bg-gray-200 rounded mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No projects found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 relative">
                  {project.thumbnail ? (
                    <img 
                      src={project.thumbnail} 
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-4xl font-bold text-gray-300">3D</div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h4 className="font-semibold text-gray-900 mb-1 truncate">{project.name}</h4>
                  <p className="text-sm text-gray-500 mb-3">
                    by {formatAddress(project.author)} • {formatTimeAgo(project.timestamp)}
                  </p>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Heart size={14} className={userLikes.includes(project.id) ? 'fill-red-500 text-red-500' : ''} />
                      {project.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={14} />
                      {project.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star size={14} className={userFavorites.includes(project.id) ? 'fill-yellow-500 text-yellow-500' : ''} />
                      {project.favorites}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}