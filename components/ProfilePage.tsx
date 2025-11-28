'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Canvas } from '@react-three/fiber'
import { User, Heart, Star, Edit2, Globe, Twitter, Github, Calendar, Eye, ArrowLeft, Wallet, ChevronLeft, ChevronRight, Home, MoreVertical, Trash2, DollarSign, Share2 } from 'lucide-react'
import { UserProfile, downloadUserProfile, uploadUserProfile, getUserFavorites, getProjectLikeCount, getProjectViewCount, uploadProfileAvatar, downloadProfileAvatar, getProfileMutableReference, followUser, unfollowUser, isFollowing, getUserFollowStats } from '../lib/profileService'
import { queryUserProjects, downloadProjectThumbnail } from '../lib/clayStorageService'
import { usePopup } from './PopupNotification'
import { ChunkUploadProgress } from './ChunkUploadProgress'
import { ConnectWallet } from './ConnectWallet'
import { AnimatedClayLogo } from './AnimatedClayLogo'
import RoyaltyDashboard from './RoyaltyDashboard'
import MiniViewer from './MiniViewer'
import Link from 'next/link'
import AddLibraryModal from './AddLibraryModal'
import ListMarketplaceModal from './ListMarketplaceModal'
import { formatETH, formatUSDC } from '../lib/formatCurrency'

interface ProfilePageProps {
  walletAddress: string
  currentUserAddress?: string
  onClose: () => void
  onProjectSelect: (projectId: string) => void
}

interface ProjectStats {
  projectId: string
  likes: number
  views: number
}

interface ProjectWithThumbnail {
  project: any
  thumbnailUrl?: string
}

export default function ProfilePage({ walletAddress, currentUserAddress: initialCurrentUserAddress, onClose, onProjectSelect }: ProfilePageProps) {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [projectThumbnails, setProjectThumbnails] = useState<Map<string, string>>(new Map())
  const [favorites, setFavorites] = useState<string[]>([])
  const [projectStats, setProjectStats] = useState<Map<string, ProjectStats>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(new Set())
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    displayName: '',
    bio: '',
    website: '',
    twitter: '',
    github: ''
  })
  const { showPopup } = usePopup()
  const [activityData, setActivityData] = useState<Array<{ date: Date; count: number; details?: any[] }>>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedDateDetails, setSelectedDateDetails] = useState<any[]>([])
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [loadingProfileImage, setLoadingProfileImage] = useState(false)
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null) // Temporary image before save
  const [isSaving, setIsSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({
    isOpen: false,
    currentChunk: 0,
    totalChunks: 0,
    percentage: 0,
    type: 'profile' as 'profile' | 'avatar'
  })
  const [isFollowingUser, setIsFollowingUser] = useState(false)
  const [followStats, setFollowStats] = useState({ followers: 0, following: 0 })
  const [isProcessingFollow, setIsProcessingFollow] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const projectsPerPage = 12
  const [currentUserAddress, setCurrentUserAddress] = useState<string | undefined>(initialCurrentUserAddress)
  const [totalRevenueETH, setTotalRevenueETH] = useState<number>(0)
  const [totalRevenueUSDC, setTotalRevenueUSDC] = useState<number>(0)
  const [projectMenu, setProjectMenu] = useState<string | null>(null)
  const [showAddLibraryModal, setShowAddLibraryModal] = useState(false)
  const [showListMarketplaceModal, setShowListMarketplaceModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null)
  
  const isOwner = currentUserAddress?.toLowerCase() === walletAddress.toLowerCase()
  
  // Load library revenue (only for own profile)
  useEffect(() => {
    if (currentUserAddress?.toLowerCase() === walletAddress.toLowerCase()) {
      loadLibraryRevenue()
    }
  }, [currentUserAddress, walletAddress])
  
  const loadLibraryRevenue = async () => {
    try {
      const { getUserLibraryAssets } = await import('../lib/libraryService')
      const LIBRARY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS
      
      if (!LIBRARY_CONTRACT_ADDRESS || typeof window === 'undefined' || !window.ethereum) {
        return
      }
      
      const { ethers } = await import('ethers')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contract = new ethers.Contract(
        LIBRARY_CONTRACT_ADDRESS,
        [
          "function getAsset(string projectId) external view returns (tuple(string, string, string, uint256, uint256, address, address, uint256, uint256, uint256, uint256, bool))"
        ],
        provider
      )
      
      const assetIds = await getUserLibraryAssets(walletAddress)
      let totalETH = 0
      let totalUSDC = 0
      
      for (const assetId of assetIds) {
        try {
          const asset = await contract.getAsset(assetId)
          totalETH += parseFloat(ethers.formatEther(asset[7])) // totalRevenueETH
          totalUSDC += parseFloat(ethers.formatUnits(asset[8], 6)) // totalRevenueUSDC
        } catch (error) {
          console.error('Failed to load revenue for', assetId)
        }
      }
      
      setTotalRevenueETH(totalETH)
      setTotalRevenueUSDC(totalUSDC)
    } catch (error) {
      console.error('Failed to load library revenue:', error)
    }
  }
  
  // Generate activity data from projects and interactions
  const generateActivityData = (userProjects: any[], userLikes?: any[], userFavorites?: any[]) => {
    // Create a map of date strings to activity details
    const activityMap = new Map<string, { count: number; details: any[] }>()
    
    console.log('[ProfilePage] Generating activity for', userProjects.length, 'projects')
    
    // Count projects by date
    userProjects.forEach(project => {
      // Validate timestamp
      if (!project.timestamp || isNaN(project.timestamp)) {
        console.warn('[ProfilePage] Invalid timestamp for project:', project.name, 'Timestamp:', project.timestamp)
        return
      }
      
      const date = new Date(project.timestamp)
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('[ProfilePage] Invalid date for project:', project.name, 'Timestamp:', project.timestamp)
        return
      }
      
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format
      console.log('[ProfilePage] Project:', project.name, 'Date:', dateStr, 'Timestamp:', project.timestamp)
      const existing = activityMap.get(dateStr) || { count: 0, details: [] }
      existing.count += 1
      existing.details.push({ type: 'project', name: project.name || 'Untitled Project', id: project.id, timestamp: project.timestamp })
      activityMap.set(dateStr, existing)
    })
    
    // Count likes if provided
    if (userLikes) {
      userLikes.forEach(like => {
        if (!like.timestamp || isNaN(like.timestamp)) return
        const date = new Date(like.timestamp)
        if (isNaN(date.getTime())) return
        
        const dateStr = date.toISOString().split('T')[0]
        const existing = activityMap.get(dateStr) || { count: 0, details: [] }
        existing.count += 1
        existing.details.push({ type: 'like', projectId: like.projectId, timestamp: like.timestamp })
        activityMap.set(dateStr, existing)
      })
    }
    
    // Count favorites if provided
    if (userFavorites) {
      userFavorites.forEach(fav => {
        if (!fav.timestamp || isNaN(fav.timestamp)) return
        const date = new Date(fav.timestamp)
        if (isNaN(date.getTime())) return
        
        const dateStr = date.toISOString().split('T')[0]
        const existing = activityMap.get(dateStr) || { count: 0, details: [] }
        existing.count += 1
        existing.details.push({ type: 'favorite', projectId: fav.projectId, timestamp: fav.timestamp })
        activityMap.set(dateStr, existing)
      })
    }
    
    // Generate last 52 weeks of data
    const weeks = 52
    const daysPerWeek = 7
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const data: Array<{ date: Date; count: number; details?: any[] }> = []
    
    // Calculate the most recent Sunday (could be today)
    const endDate = new Date(today)
    const todayDay = endDate.getDay() // 0 = Sunday, 6 = Saturday
    
    // Calculate the Sunday that starts 52 weeks ago
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (weeks * daysPerWeek - 1) - todayDay)
    
    // Generate all days from start to today
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      const activity = activityMap.get(dateStr)
      
      data.push({
        date: new Date(date),
        count: activity?.count || 0,
        details: activity?.details || []
      })
    }
    
    return data
  }
  
  useEffect(() => {
    loadProfileData()
  }, [walletAddress, currentUserAddress])
  
  const loadProfileData = async () => {
    setLoading(true)
    try {
      // Load profile first (fast)
      let userProfile = await downloadUserProfile(walletAddress)
      
      // Create default profile if not exists
      if (!userProfile) {
        userProfile = {
          id: `profile-${walletAddress}`,
          walletAddress,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
      
      setProfile(userProfile)
      setEditForm({
        displayName: userProfile.displayName || '',
        bio: userProfile.bio || '',
        website: userProfile.website || '',
        twitter: userProfile.twitter || '',
        github: userProfile.github || ''
      })
      
      // Load avatar asynchronously (don't wait)
      if (userProfile.avatarUrl && !tempProfileImage) {
        console.log(`[ProfilePage] Loading avatar with ID: ${userProfile.avatarUrl}`)
        setLoadingProfileImage(true)
        downloadProfileAvatar(userProfile.avatarUrl).then(avatarImage => {
          if (avatarImage) {
            setProfileImage(avatarImage)
          }
        }).catch(error => {
          console.error('Failed to load avatar:', error)
        }).finally(() => {
          setLoadingProfileImage(false)
        })
      }
      
      // Load projects and basic stats in parallel
      console.log('[ProfilePage] Loading projects for wallet:', walletAddress)
      const [userProjects, userFavorites, followStatsData] = await Promise.all([
        queryUserProjects(walletAddress),
        getUserFavorites(walletAddress),
        getUserFollowStats(walletAddress)
      ])
      
      console.log('[ProfilePage] Loaded projects:', userProjects.length, userProjects)
      setProjects(userProjects)
      setFavorites(userFavorites)
      setFollowStats(followStatsData)
      setLoading(false) // Mark main loading as complete
      
      // Generate activity data from projects
      const activity = generateActivityData(userProjects)
      console.log('[ProfilePage] Generated activity data:', activity.filter(d => d.count > 0).length, 'days with activity')
      setActivityData(activity)
      
      // Check if current user is following (async)
      if (currentUserAddress && currentUserAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        isFollowing(currentUserAddress, walletAddress).then(following => {
          setIsFollowingUser(following)
        }).catch(error => {
          console.error('Failed to check following status:', error)
        })
      }
      
      // Load project stats asynchronously using projectId (stable across updates)
      const stats = new Map<string, ProjectStats>()
      const loadStats = async () => {
        for (const project of userProjects) {
          try {
            // Use projectId (stable) instead of id (transaction ID) for view/like tracking
            const stableId = project.projectId || project.id
            const [likes, views] = await Promise.all([
              getProjectLikeCount(stableId),
              getProjectViewCount(stableId)
            ])
            stats.set(stableId, {
              projectId: stableId,
              likes,
              views
            })
            // Update state incrementally
            setProjectStats(new Map(stats))
          } catch (error) {
            console.error('Failed to load stats for project:', project.projectId || project.id, error)
          }
        }
      }
      loadStats()
      
      // Load thumbnails asynchronously (slowest operation)
      const thumbnails = new Map<string, string>()
      const loadingSet = new Set<string>()
      
      const loadThumbnails = async () => {
        // Mark projects with thumbnails as loading
        const projectsWithThumbnails = userProjects.filter(p => p.tags?.['Thumbnail-ID'])
        projectsWithThumbnails.forEach(p => loadingSet.add(p.id))
        setLoadingThumbnails(new Set(loadingSet))
        
        for (const project of projectsWithThumbnails) {
          const thumbnailId = project.tags['Thumbnail-ID']
          try {
            const thumbnailUrl = await downloadProjectThumbnail(thumbnailId)
            if (thumbnailUrl) {
              thumbnails.set(project.id, thumbnailUrl)
              // Update state incrementally
              setProjectThumbnails(new Map(thumbnails))
            }
          } catch (error) {
            console.error('Failed to load thumbnail for project:', project.id, error)
          } finally {
            // Remove from loading set
            loadingSet.delete(project.id)
            setLoadingThumbnails(new Set(loadingSet))
          }
        }
      }
      loadThumbnails()
      
    } catch (error) {
      console.error('Failed to load profile data:', error)
      showPopup('Failed to load profile data', 'error')
      setLoading(false)
    }
  }
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showPopup('Image size must be less than 5MB', 'warning')
      return
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      showPopup('Please select an image file', 'warning')
      return
    }
    
    setUploadingImage(true)
    
    try {
      // Convert to data URL
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        // Just store temporarily, will upload on save
        setTempProfileImage(dataUrl)
        setUploadingImage(false)
        showPopup('Image selected. Save profile to upload.', 'info')
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Failed to upload image:', error)
      showPopup('Failed to upload image', 'error')
      setUploadingImage(false)
    }
  }
  
  const handleSaveProfile = async () => {
    if (!profile || isSaving) return
    
    setIsSaving(true)
    
    try {
      // Upload profile image if there's a new one
      let avatarUrl = profile.avatarUrl
      if (tempProfileImage) {
        setUploadProgress({
          isOpen: true,
          currentChunk: 0,
          totalChunks: 0,
          percentage: 0,
          type: 'avatar'
        })
        
        const avatarId = await uploadProfileAvatar(
          tempProfileImage, 
          walletAddress,
          (progress) => {
            setUploadProgress({
              isOpen: true,
              currentChunk: progress.currentChunk,
              totalChunks: progress.totalChunks,
              percentage: progress.percentage,
              type: 'avatar'
            })
          }
        )
        
        if (avatarId) {
          console.log(`[ProfilePage] Avatar uploaded with ID: ${avatarId}`)
          avatarUrl = avatarId
          setProfileImage(tempProfileImage)
          setTempProfileImage(null)
        } else {
          showPopup('Failed to upload image', 'error')
          setUploadProgress({ ...uploadProgress, isOpen: false })
          setIsSaving(false)
          return
        }
      }
      
      const updatedProfile: UserProfile = {
        ...profile,
        ...editForm,
        avatarUrl: avatarUrl || '', // Empty string if no avatar
        updatedAt: Date.now(),
        stats: {
          totalProjects: projects.length,
          totalLikes: Array.from(projectStats.values()).reduce((sum, stats) => sum + stats.likes, 0),
          totalFavorites: favorites.length
        }
      }
      
      // Set upload progress for profile data
      setUploadProgress({
        isOpen: true,
        currentChunk: 0,
        totalChunks: 0,
        percentage: 0,
        type: 'profile'
      })
      
      // Get existing root transaction ID from profile service
      const rootTxId = getProfileMutableReference(walletAddress) || undefined
      
      const result = await uploadUserProfile(
        updatedProfile, 
        rootTxId,
        (progress) => {
          setUploadProgress({
            isOpen: true,
            currentChunk: progress.currentChunk,
            totalChunks: progress.totalChunks,
            percentage: progress.percentage,
            type: 'profile'
          })
        }
      )
      
      // Root TX ID is now managed by profileService
      
      setProfile(updatedProfile)
      setIsEditing(false)
      setUploadProgress({ ...uploadProgress, isOpen: false })
      showPopup('Profile updated successfully!', 'success')
      
      // Keep the temp image as the current profile image if it was just uploaded
      if (tempProfileImage && avatarUrl !== profile.avatarUrl) {
        setProfileImage(tempProfileImage)
      }
      
      // Update URL if display name changed
      if (updatedProfile.displayName && updatedProfile.displayName !== profile.displayName) {
        router.replace(`/user/${updatedProfile.displayName}`)
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
      showPopup('Failed to update profile', 'error')
      setUploadProgress({ ...uploadProgress, isOpen: false })
    } finally {
      setIsSaving(false)
    }
  }
  
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }
  
  const getActivityLevel = (count: number) => {
    if (count === 0) return 'bg-gray-100'
    if (count === 1) return 'bg-green-200'
    if (count <= 3) return 'bg-green-400'
    if (count <= 5) return 'bg-green-500'
    return 'bg-green-600'
  }
  
  const handleFollow = async () => {
    if (!currentUserAddress || isProcessingFollow) return
    
    setIsProcessingFollow(true)
    try {
      if (isFollowingUser) {
        await unfollowUser(currentUserAddress, walletAddress)
        setIsFollowingUser(false)
        setFollowStats(prev => ({ ...prev, followers: prev.followers - 1 }))
        showPopup('Unfollowed successfully', 'success')
      } else {
        await followUser(currentUserAddress, walletAddress)
        setIsFollowingUser(true)
        setFollowStats(prev => ({ ...prev, followers: prev.followers + 1 }))
        showPopup('Followed successfully', 'success')
      }
    } catch (error) {
      console.error('Failed to follow/unfollow:', error)
      showPopup('Failed to update follow status', 'error')
    } finally {
      setIsProcessingFollow(false)
    }
  }

  const handleAddToLibrary = (projectId: string, projectName: string) => {
    setSelectedProject({ id: projectId, name: projectName })
    setShowAddLibraryModal(true)
  }

  const handleListOnMarketplace = (projectId: string, projectName: string) => {
    setSelectedProject({ id: projectId, name: projectName })
    setShowListMarketplaceModal(true)
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (confirm(`Are you sure you want to delete "${projectName}"?`)) {
      // TODO: 삭제 로직 구현
      showPopup('Delete feature is not implemented yet', 'info')
    }
  }

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = () => setProjectMenu(null)
    if (projectMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [projectMenu])
  
  return (
    <div className="fixed inset-0 bg-gray-100 z-[9998] overflow-auto">
      {/* Minimal Header - Same as Project Detail */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-50">
        <div className="px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-medium text-gray-900">Profile</h1>
              <p className="text-xs text-gray-500">{formatAddress(walletAddress)}</p>
            </div>
          </div>
          
          {/* Home Logo - Center */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <Link
              href="/"
              className="block hover:opacity-80 transition-opacity"
              title="Home"
            >
              <div className="w-10 h-10">
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
            </Link>
          </div>
          
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditForm({
                    displayName: profile?.displayName || '',
                    bio: profile?.bio || '',
                    website: profile?.website || '',
                    twitter: profile?.twitter || '',
                    github: profile?.github || ''
                  })
                  setTempProfileImage(null)
                }}
                disabled={isSaving}
                className="px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-3 py-1.5 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  showPopup('URL copied to clipboard', 'success')
                }}
                className="p-2 rounded-md transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
                title="Share"
              >
                <Share2 size={18} />
              </button>
              {!currentUserAddress ? (
                <ConnectWallet 
                  onConnect={(address) => setCurrentUserAddress(address)}
                  onDisconnect={() => setCurrentUserAddress(undefined)}
                />
              ) : (
                <>
                  {currentUserAddress.toLowerCase() !== walletAddress.toLowerCase() && (
                    <button
                      onClick={handleFollow}
                      disabled={isProcessingFollow}
                      className={`px-3 py-1.5 rounded-md transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                        isFollowingUser
                          ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          : 'bg-gray-800 hover:bg-gray-700 text-white'
                      }`}
                    >
                      {isProcessingFollow ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        isFollowingUser ? 'Following' : 'Follow'
                      )}
                    </button>
                  )}
                  {currentUserAddress.toLowerCase() === walletAddress.toLowerCase() && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors text-sm"
                    >
                      Edit Profile
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0 self-center sm:self-start">
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                  {tempProfileImage ? (
                    <img src={tempProfileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : loadingProfileImage ? (
                    <div className="w-6 h-6 border-3 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                  ) : (
                    <User size={32} className="text-gray-400" />
                  )}
                </div>
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-gray-800 text-white p-1.5 rounded-full cursor-pointer hover:bg-gray-700 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    {uploadingImage ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Edit2 size={14} />
                    )}
                  </label>
                )}
              </div>
            </div>
            
            {/* Profile Info */}
            <div className="flex-grow min-w-0 w-full sm:w-auto">
              {loading ? (
                <div>
                  <div className="h-8 w-48 bg-gray-200 rounded mb-2 animate-pulse"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded mb-4 animate-pulse"></div>
                  <div className="h-4 w-64 bg-gray-200 rounded mb-2 animate-pulse"></div>
                  <div className="flex gap-4 mt-4">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ) : isEditing ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Display Name"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <textarea
                    placeholder="Bio"
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <input
                      type="text"
                      placeholder="Website"
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Twitter"
                      value={editForm.twitter}
                      onChange={(e) => setEditForm({ ...editForm, twitter: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
                    />
                    <input
                      type="text"
                      placeholder="GitHub"
                      value={editForm.github}
                      onChange={(e) => setEditForm({ ...editForm, github: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-2">
                    <h2 className="text-lg sm:text-xl font-medium truncate">
                      {profile?.displayName || formatAddress(walletAddress)}
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 truncate">{formatAddress(walletAddress)}</p>
                  {profile?.bio && <p className="text-sm text-gray-700 mb-3 line-clamp-3">{profile.bio}</p>}
                  <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                    {profile?.website && (
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                        <Globe size={14} />
                        Website
                      </a>
                    )}
                    {profile?.twitter && (
                      <a href={`https://twitter.com/${profile.twitter}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                        <Twitter size={14} />
                        @{profile.twitter}
                      </a>
                    )}
                    {profile?.github && (
                      <a href={`https://github.com/${profile.github}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                        <Github size={14} />
                        {profile.github}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Stats */}
            <div className="flex flex-wrap gap-3 sm:gap-6 w-full sm:w-auto sm:flex-shrink-0">
              {loading ? (
                <>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                </>
              ) : (
                <>
                  <div className="text-xs sm:text-sm">
                    <span className="font-medium text-gray-900">{followStats.followers}</span>
                    <span className="text-gray-500 ml-1">followers</span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-medium text-gray-900">{followStats.following}</span>
                    <span className="text-gray-500 ml-1">following</span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-medium text-gray-900">{projects.length}</span>
                    <span className="text-gray-500 ml-1">projects</span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-medium text-gray-900">
                      {Array.from(projectStats.values()).reduce((sum, stats) => sum + stats.likes, 0)}
                    </span>
                    <span className="text-gray-500 ml-1">likes</span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-medium text-gray-900">{favorites.length}</span>
                    <span className="text-gray-500 ml-1">favorites</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Royalty Dashboard */}
        {currentUserAddress?.toLowerCase() === walletAddress.toLowerCase() && (
          <RoyaltyDashboard walletAddress={walletAddress} />
        )}
        
        {/* Revenue Stats - Public Information */}
        {(totalRevenueETH > 0 || totalRevenueUSDC > 0) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Library Revenue</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {totalRevenueETH > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Total ETH</p>
                  <p className="text-2xl font-bold text-gray-900">{formatETH(totalRevenueETH)} ETH</p>
                </div>
              )}
              {totalRevenueUSDC > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Total USDC</p>
                  <p className="text-2xl font-bold text-gray-900">{formatUSDC(totalRevenueUSDC)} USDC</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Activity Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Activity</h3>
            <div className="text-xs text-gray-500">
              {activityData.reduce((sum, day) => sum + day.count, 0)} contributions
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="inline-block">
              {/* Month labels */}
              <div className="relative h-4 mb-1 ml-8" style={{ width: 'fit-content' }}>
                {(() => {
                  // Use same date calculation as generateActivityData
                  const weeks = 52
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  
                  // Calculate the most recent Sunday (could be today)
                  const endDate = new Date(today)
                  const todayDay = endDate.getDay() // 0 = Sunday, 6 = Saturday
                  
                  // Calculate the Sunday that starts 52 weeks ago
                  const startDate = new Date(endDate)
                  startDate.setDate(startDate.getDate() - (weeks * 7 - 1) - todayDay)
                  
                  const monthPositions: { month: string; startWeek: number; endWeek: number }[] = []
                  let currentMonth = ''
                  let monthStartWeek = 0
                  
                  // Calculate total weeks to display
                  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
                  const totalWeeks = Math.ceil(totalDays / 7)
                  
                  // Go through each week to find month boundaries
                  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
                    // Check all days in this week to determine the dominant month
                    const weekDates = []
                    for (let day = 0; day < 7; day++) {
                      const date = new Date(startDate)
                      date.setDate(date.getDate() + weekIndex * 7 + day)
                      // Don't go past end date
                      if (date <= endDate) {
                        weekDates.push(date)
                      }
                    }
                    
                    // Get the month that appears most in this week
                    const monthCounts = new Map<string, number>()
                    weekDates.forEach(date => {
                      const month = date.toLocaleDateString('en', { month: 'short' })
                      monthCounts.set(month, (monthCounts.get(month) || 0) + 1)
                    })
                    
                    // Find the dominant month
                    let dominantMonth = ''
                    let maxCount = 0
                    monthCounts.forEach((count, month) => {
                      if (count > maxCount) {
                        maxCount = count
                        dominantMonth = month
                      }
                    })
                    
                    if (dominantMonth !== currentMonth) {
                      if (currentMonth !== '') {
                        monthPositions.push({ 
                          month: currentMonth, 
                          startWeek: monthStartWeek,
                          endWeek: weekIndex - 1
                        })
                      }
                      currentMonth = dominantMonth
                      monthStartWeek = weekIndex
                    }
                  }
                  
                  // Add the last month
                  if (currentMonth !== '') {
                    monthPositions.push({ 
                      month: currentMonth, 
                      startWeek: monthStartWeek,
                      endWeek: totalWeeks - 1
                    })
                  }
                  
                  return monthPositions.map((pos, idx) => {
                    const weekCount = pos.endWeek - pos.startWeek + 1
                    
                    // Calculate actual pixel position
                    // Each week is 12px wide + 4px gap, except the last one
                    const pixelPosition = pos.startWeek * 16
                    const pixelWidth = weekCount * 16 - 4 // Subtract the last gap
                    
                    return (
                      <div
                        key={idx}
                        className="text-xs text-gray-600 absolute"
                        style={{ 
                          left: `${pixelPosition}px`,
                          width: `${pixelWidth}px`
                        }}
                      >
                        {pos.month}
                      </div>
                    )
                  })
                })()}
              </div>
              
              {/* Activity grid */}
              <div className="flex gap-1">
                {/* Day labels */}
                <div className="flex flex-col gap-1 text-xs text-gray-600 pr-2">
                  <div className="h-3">Mon</div>
                  <div className="h-3"></div>
                  <div className="h-3">Wed</div>
                  <div className="h-3"></div>
                  <div className="h-3">Fri</div>
                  <div className="h-3"></div>
                  <div className="h-3"></div>
                </div>
                
                {/* Activity squares by week */}
                <div className="flex gap-1">
                  {(() => {
                    // Group activity data by week
                    const weekData: Array<Array<typeof activityData[0] | null>> = []
                    let currentWeek: Array<typeof activityData[0] | null> = []
                    
                    // Pad the first week if it doesn't start on Sunday
                    const firstDay = activityData[0]?.date.getDay() || 0
                    if (firstDay > 0) {
                      for (let i = 0; i < firstDay; i++) {
                        currentWeek.push(null)
                      }
                    }
                    
                    // Group all days into weeks
                    activityData.forEach(day => {
                      currentWeek.push(day)
                      if (currentWeek.length === 7) {
                        weekData.push(currentWeek)
                        currentWeek = []
                      }
                    })
                    
                    // Add the last partial week if any
                    if (currentWeek.length > 0) {
                      // Pad the last week to have 7 days
                      while (currentWeek.length < 7) {
                        currentWeek.push(null)
                      }
                      weekData.push(currentWeek)
                    }
                    
                    return weekData.map((week, weekIndex) => (
                      <div key={weekIndex} className="flex flex-col gap-1">
                        {week.map((day, dayIndex) => {
                          if (!day) return <div key={dayIndex} className="w-3 h-3" />
                          
                          return (
                            <div
                              key={dayIndex}
                              className={`w-3 h-3 rounded-sm cursor-pointer hover:ring-1 hover:ring-gray-400 ${getActivityLevel(day.count)}`}
                              title={`${day.date.toDateString()}: ${day.count} contribution${day.count !== 1 ? 's' : ''}`}
                              onClick={() => {
                                setSelectedDate(day.date)
                                setSelectedDateDetails(day.details || [])
                              }}
                            />
                          )
                        })}
                      </div>
                    ))
                  })()}
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-600">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-gray-100"></div>
                  <div className="w-3 h-3 rounded-sm bg-green-200"></div>
                  <div className="w-3 h-3 rounded-sm bg-green-400"></div>
                  <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                  <div className="w-3 h-3 rounded-sm bg-green-600"></div>
                </div>
                <span>More</span>
              </div>
              
              {/* Selected Date Details */}
              {selectedDate && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">
                    Activity on {selectedDate.toLocaleDateString()} ({selectedDateDetails.length} contribution{selectedDateDetails.length !== 1 ? 's' : ''})
                  </h4>
                  {selectedDateDetails.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDateDetails.map((detail, idx) => (
                        <div key={idx} className="text-sm text-gray-700">
                          {detail.type === 'project' && (
                            <div className="flex items-center gap-2">
                              <span className="text-green-600">●</span>
                              <span>Created project: <strong>{detail.name}</strong></span>
                            </div>
                          )}
                          {detail.type === 'like' && (
                            <div className="flex items-center gap-2">
                              <Heart size={12} className="text-red-500" />
                              <span>Liked a project</span>
                            </div>
                          )}
                          {detail.type === 'favorite' && (
                            <div className="flex items-center gap-2">
                              <Star size={12} className="text-yellow-500" />
                              <span>Added a project to favorites</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No activity found</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Projects Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 overflow-visible">
          <h3 className="text-sm font-medium mb-3 text-gray-900">Projects</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-visible">
            {projects
              .slice((currentPage - 1) * projectsPerPage, currentPage * projectsPerPage)
              .map((project) => {
              // Use projectId (stable) for stats lookup
              const stats = projectStats.get(project.projectId || project.id)
              return (
                <div
                  key={project.id}
                  className="bg-white rounded-lg hover:shadow-md transition-shadow border border-gray-200 relative group"
                >
                  {/* 3D Preview - Link uses stable projectId, MiniViewer uses transaction id for data */}
                  <div className="relative cursor-pointer rounded-t-lg overflow-hidden" onClick={() => router.push(`/project/${project.projectId || project.id}`)}>
                    <MiniViewer 
                      projectId={project.id}
                      className="aspect-square"
                    />
                    <div className="absolute top-2 left-2">
                      <span className="text-xs px-2 py-1 bg-gray-800 bg-opacity-90 text-white rounded">
                        Created
                      </span>
                    </div>
                  </div>
                  
                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <h4 
                        className="text-sm font-medium text-gray-900 mb-1 truncate flex-1 cursor-pointer"
                        onClick={() => router.push(`/project/${project.projectId || project.id}`)}
                      >
                        {project.name}
                      </h4>
                      {isOwner && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setProjectMenu(projectMenu === project.id ? null : project.id)
                            }}
                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical size={16} className="text-gray-500" />
                          </button>
                          {projectMenu === project.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-200/80 py-1.5 z-50 w-48">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Use stable projectId for library registration
                                  handleAddToLibrary(project.projectId || project.id, project.name)
                                  setProjectMenu(null)
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                </svg>
                                Add to Library
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Use stable projectId for marketplace listing
                                  handleListOnMarketplace(project.projectId || project.id, project.name)
                                  setProjectMenu(null)
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <DollarSign size={16} />
                                List on Marketplace
                              </button>
                              <div className="border-t border-gray-100 my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteProject(project.id, project.name)
                                  setProjectMenu(null)
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Heart size={12} />
                        {stats?.likes || 0}
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye size={12} />
                        {stats?.views || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Pagination */}
          {projects.length > projectsPerPage && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: Math.ceil(projects.length / projectsPerPage) }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2.5 py-1 text-sm rounded-lg ${
                      currentPage === page
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(Math.min(Math.ceil(projects.length / projectsPerPage), currentPage + 1))}
                disabled={currentPage === Math.ceil(projects.length / projectsPerPage)}
                className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Upload Progress Popup */}
      <ChunkUploadProgress
        isOpen={uploadProgress.isOpen}
        currentChunk={uploadProgress.currentChunk}
        totalChunks={uploadProgress.totalChunks}
        percentage={uploadProgress.percentage}
        projectName={uploadProgress.type === 'avatar' ? 'Profile Avatar' : 'Profile Data'}
        isDownload={false}
      />

      {/* Add to Library Modal */}
      {selectedProject && (
        <AddLibraryModal
          isOpen={showAddLibraryModal}
          onClose={() => {
            setShowAddLibraryModal(false)
            setSelectedProject(null)
          }}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          walletAddress={currentUserAddress!}
        />
      )}

      {/* List on Marketplace Modal */}
      {selectedProject && (
        <ListMarketplaceModal
          isOpen={showListMarketplaceModal}
          onClose={() => {
            setShowListMarketplaceModal(false)
            setSelectedProject(null)
          }}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
        />
      )}
    </div>
  )
}


