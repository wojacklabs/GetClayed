'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Heart, Star, Edit2, Globe, Twitter, Github, Calendar, Activity } from 'lucide-react'
import { UserProfile, downloadUserProfile, uploadUserProfile, getUserFavorites, getProjectLikeCount, getProjectViewCount, uploadProfileAvatar, downloadProfileAvatar } from '../lib/profileService'
import { queryUserProjects, downloadProjectThumbnail } from '../lib/clayStorageService'
import { usePopup } from './PopupNotification'
import { ChunkUploadProgress } from './ChunkUploadProgress'

interface ProfilePageProps {
  walletAddress: string
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

export default function ProfilePage({ walletAddress, onClose, onProjectSelect }: ProfilePageProps) {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [projectThumbnails, setProjectThumbnails] = useState<Map<string, string>>(new Map())
  const [favorites, setFavorites] = useState<string[]>([])
  const [projectStats, setProjectStats] = useState<Map<string, ProjectStats>>(new Map())
  const [loading, setLoading] = useState(true)
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
  const [tempProfileImage, setTempProfileImage] = useState<string | null>(null) // Temporary image before save
  const [isSaving, setIsSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({
    isOpen: false,
    currentChunk: 0,
    totalChunks: 0,
    percentage: 0,
    type: 'profile' as 'profile' | 'avatar'
  })
  
  // Generate activity data from projects and interactions
  const generateActivityData = (userProjects: any[], userLikes?: any[], userFavorites?: any[]) => {
    // Create a map of date strings to activity details
    const activityMap = new Map<string, { count: number; details: any[] }>()
    
    // Count projects by date
    userProjects.forEach(project => {
      const date = new Date(project.timestamp)
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format
      const existing = activityMap.get(dateStr) || { count: 0, details: [] }
      existing.count += 1
      existing.details.push({ type: 'project', name: project.name || 'Untitled Project', id: project.id, timestamp: project.timestamp })
      activityMap.set(dateStr, existing)
    })
    
    // Count likes if provided
    if (userLikes) {
      userLikes.forEach(like => {
        const date = new Date(like.timestamp)
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
        const date = new Date(fav.timestamp)
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
    const totalDays = weeks * daysPerWeek
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const data: Array<{ date: Date; count: number; details?: any[] }> = []
    
    // Start from Sunday of the first week
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - totalDays + 1)
    const startDay = startDate.getDay()
    if (startDay !== 0) {
      startDate.setDate(startDate.getDate() - startDay)
    }
    
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
  }, [walletAddress])
  
  const loadProfileData = async () => {
    setLoading(true)
    try {
      // Load profile
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
      
      // Load avatar if exists
      if (userProfile.avatarUrl) {
        const avatarImage = await downloadProfileAvatar(userProfile.avatarUrl)
        if (avatarImage) {
          setProfileImage(avatarImage)
        }
      }
      
      // Load projects
      const userProjects = await queryUserProjects(walletAddress)
      setProjects(userProjects)
      
      // Generate activity data from projects
      const activity = generateActivityData(userProjects)
      setActivityData(activity)
      
      // Load favorites
      const userFavorites = await getUserFavorites(walletAddress)
      setFavorites(userFavorites)
      
      // Load project stats and thumbnails
      const stats = new Map<string, ProjectStats>()
      const thumbnails = new Map<string, string>()
      
      for (const project of userProjects) {
        const [likes, views] = await Promise.all([
          getProjectLikeCount(project.id),
          getProjectViewCount(project.id)
        ])
        stats.set(project.id, {
          projectId: project.id,
          likes,
          views
        })
        
        // Load thumbnail if available
        const thumbnailId = project.tags?.['Thumbnail-ID']
        if (thumbnailId) {
          try {
            const thumbnailUrl = await downloadProjectThumbnail(thumbnailId)
            if (thumbnailUrl) {
              thumbnails.set(project.id, thumbnailUrl)
            }
          } catch (error) {
            console.error('Failed to load thumbnail for project:', project.id, error)
          }
        }
      }
      setProjectStats(stats)
      setProjectThumbnails(thumbnails)
      
    } catch (error) {
      console.error('Failed to load profile data:', error)
      showPopup('Failed to load profile data', 'error')
    } finally {
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
        avatarUrl,
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
      
      const rootTxId = localStorage.getItem(`profile_mutable_${walletAddress}`) || undefined
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
      
      if (!rootTxId) {
        localStorage.setItem(`profile_mutable_${walletAddress}`, result.rootTxId)
      }
      
      setProfile(updatedProfile)
      setIsEditing(false)
      setUploadProgress({ ...uploadProgress, isOpen: false })
      showPopup('Profile updated successfully!', 'success')
      
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
  
  return (
    <div className="fixed inset-0 bg-gray-50 z-[9998] overflow-auto">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Profile</h1>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
        
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-start gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center overflow-hidden">
            {tempProfileImage ? (
              <img src={tempProfileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : profileImage ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={48} className="text-white" />
            )}
                </div>
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    {uploadingImage ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Edit2 size={16} />
                    )}
                  </label>
                )}
              </div>
            </div>
            
            {/* Profile Info */}
            <div className="flex-grow">
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
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Website"
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Twitter"
                      value={editForm.twitter}
                      onChange={(e) => setEditForm({ ...editForm, twitter: e.target.value })}
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="GitHub"
                      value={editForm.github}
                      onChange={(e) => setEditForm({ ...editForm, github: e.target.value })}
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSaving && (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false)
                        setTempProfileImage(null) // Reset temporary image
                      }}
                      disabled={isSaving}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <h2 className="text-2xl font-bold">
                      {profile?.displayName || formatAddress(walletAddress)}
                    </h2>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Edit Profile"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                  <p className="text-gray-600 mb-4">{formatAddress(walletAddress)}</p>
                  {profile?.bio && <p className="text-gray-700 mb-4">{profile.bio}</p>}
                  <div className="flex gap-4 text-sm">
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
            <div className="flex gap-8 text-center">
              {loading ? (
                <>
                  <div>
                    <div className="h-8 w-12 bg-gray-200 rounded mb-1 animate-pulse mx-auto"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div>
                    <div className="h-8 w-12 bg-gray-200 rounded mb-1 animate-pulse mx-auto"></div>
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div>
                    <div className="h-8 w-12 bg-gray-200 rounded mb-1 animate-pulse mx-auto"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-2xl font-bold">{projects.length}</div>
                    <div className="text-sm text-gray-600">Projects</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {Array.from(projectStats.values()).reduce((sum, stats) => sum + stats.likes, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Total Likes</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{favorites.length}</div>
                    <div className="text-sm text-gray-600">Favorites</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Activity Chart */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Activity size={20} />
              Activity
            </h3>
            <div className="text-sm text-gray-600">
              {activityData.reduce((sum, day) => sum + day.count, 0)} contributions in the last year
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="inline-block">
              {/* Month labels */}
              <div className="relative h-4 mb-1 ml-8" style={{ width: `${52 * 16 - 4}px` }}>
                {(() => {
                  // Use same date calculation as generateActivityData
                  const weeks = 52
                  const totalDays = weeks * 7
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  
                  // Start from Sunday of the first week (same as activity data)
                  const startDate = new Date(today)
                  startDate.setDate(startDate.getDate() - totalDays + 1)
                  const startDay = startDate.getDay()
                  if (startDay !== 0) {
                    startDate.setDate(startDate.getDate() - startDay)
                  }
                  
                  const monthPositions: { month: string; startWeek: number; endWeek: number }[] = []
                  let currentMonth = ''
                  let monthStartWeek = 0
                  
                  // Go through each week to find month boundaries
                  for (let weekIndex = 0; weekIndex < 52; weekIndex++) {
                    // Check all days in this week to determine the dominant month
                    const weekDates = []
                    for (let day = 0; day < 7; day++) {
                      const date = new Date(startDate)
                      date.setDate(date.getDate() + weekIndex * 7 + day)
                      weekDates.push(date)
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
                      endWeek: 51
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
                  {Array.from({ length: 52 }, (_, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-1">
                      {Array.from({ length: 7 }, (_, dayIndex) => {
                        const dataIndex = weekIndex * 7 + dayIndex
                        const day = activityData[dataIndex]
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
                  ))}
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
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h3 className="text-xl font-bold mb-6">Projects</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const stats = projectStats.get(project.id)
              return (
                <div
                  key={project.id}
                  className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/project/${project.id}`)}
                >
                  {/* Thumbnail */}
                  <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
                    {projectThumbnails.has(project.id) ? (
                      <img 
                        src={projectThumbnails.get(project.id)} 
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-400">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                          <path d="M12 2 L12 12 L20 8" strokeWidth="1.5" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-4">
                    <h4 className="font-semibold mb-2">{project.name}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Heart size={14} />
                        {stats?.likes || 0}
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity size={14} />
                        {stats?.views || 0} views
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(project.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
