'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Heart, Star, Edit2, Globe, Twitter, Github, Calendar, Activity } from 'lucide-react'
import { UserProfile, downloadUserProfile, uploadUserProfile, getUserFavorites, getProjectLikeCount } from '../lib/profileService'
import { queryUserProjects } from '../lib/clayStorageService'
import { usePopup } from './PopupNotification'

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

export default function ProfilePage({ walletAddress, onClose, onProjectSelect }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [projects, setProjects] = useState<any[]>([])
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
  const [activityData, setActivityData] = useState<Array<{ date: Date; count: number }>>([])
  
  // Generate activity data from projects and interactions
  const generateActivityData = (userProjects: any[], userLikes?: any[], userFavorites?: any[]) => {
    // Create a map of date strings to counts
    const activityMap = new Map<string, number>()
    
    // Count projects by date
    userProjects.forEach(project => {
      const date = new Date(project.timestamp)
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format
      activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1)
    })
    
    // Count likes if provided
    if (userLikes) {
      userLikes.forEach(like => {
        const date = new Date(like.timestamp)
        const dateStr = date.toISOString().split('T')[0]
        activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1)
      })
    }
    
    // Count favorites if provided
    if (userFavorites) {
      userFavorites.forEach(fav => {
        const date = new Date(fav.timestamp)
        const dateStr = date.toISOString().split('T')[0]
        activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1)
      })
    }
    
    // Generate last 52 weeks of data
    const weeks = 52
    const daysPerWeek = 7
    const totalDays = weeks * daysPerWeek
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const data: Array<{ date: Date; count: number }> = []
    
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
      
      data.push({
        date: new Date(date),
        count: activityMap.get(dateStr) || 0
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
      
      // Load projects
      const userProjects = await queryUserProjects(walletAddress)
      setProjects(userProjects)
      
      // Generate activity data from projects
      const activity = generateActivityData(userProjects)
      setActivityData(activity)
      
      // Load favorites
      const userFavorites = await getUserFavorites(walletAddress)
      setFavorites(userFavorites)
      
      // Load project stats
      const stats = new Map<string, ProjectStats>()
      for (const project of userProjects) {
        const likes = await getProjectLikeCount(project.id)
        stats.set(project.id, {
          projectId: project.id,
          likes,
          views: Math.floor(Math.random() * 1000) // Mock views for now
        })
      }
      setProjectStats(stats)
      
    } catch (error) {
      console.error('Failed to load profile data:', error)
      showPopup('Failed to load profile data', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  const handleSaveProfile = async () => {
    if (!profile) return
    
    try {
      const updatedProfile: UserProfile = {
        ...profile,
        ...editForm,
        updatedAt: Date.now(),
        stats: {
          totalProjects: projects.length,
          totalLikes: Array.from(projectStats.values()).reduce((sum, stats) => sum + stats.likes, 0),
          totalFavorites: favorites.length
        }
      }
      
      const rootTxId = localStorage.getItem(`profile_mutable_${walletAddress}`) || undefined
      const result = await uploadUserProfile(updatedProfile, rootTxId)
      
      if (!rootTxId) {
        localStorage.setItem(`profile_mutable_${walletAddress}`, result.rootTxId)
      }
      
      setProfile(updatedProfile)
      setIsEditing(false)
      showPopup('Profile updated successfully!', 'success')
    } catch (error) {
      console.error('Failed to update profile:', error)
      showPopup('Failed to update profile', 'error')
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
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
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
              <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                <User size={48} className="text-white" />
              </div>
            </div>
            
            {/* Profile Info */}
            <div className="flex-grow">
              {isEditing ? (
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
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
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
              <div className="flex gap-1 mb-1 ml-8">
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date()
                  date.setMonth(date.getMonth() - (11 - i))
                  return (
                    <div key={i} className="w-[52px] text-xs text-gray-600">
                      {date.toLocaleDateString('en', { month: 'short' })}
                    </div>
                  )
                })}
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
                  onClick={() => onProjectSelect(project.id)}
                >
                  {/* Thumbnail */}
                  <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <div className="text-gray-400">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                        <path d="M12 2 L12 12 L20 8" strokeWidth="1.5" />
                      </svg>
                    </div>
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
