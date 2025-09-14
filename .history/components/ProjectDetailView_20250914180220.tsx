'use client'

import { useState, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { TrackballControls, Environment, Grid } from '@react-three/drei'
import { Heart, Star, ArrowLeft, Eye, RotateCw, Maximize2 } from 'lucide-react'
import * as THREE from 'three'
import { downloadClayProject, restoreClayObjects } from '../lib/clayStorageService'
import { likeProject, favoriteProject, unfavoriteProject, hasUserLikedProject, getUserFavorites, getProjectLikeCount, recordProjectView, getProjectViewCount } from '../lib/profileService'
import { usePopup } from './PopupNotification'

interface ProjectDetailViewProps {
  projectId: string
  walletAddress: string | null
  onBack: () => void
}

// Simple clay renderer for view-only mode
function ViewOnlyClay({ clay }: { clay: any }) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  return (
    <mesh
      ref={meshRef}
      geometry={clay.geometry}
      position={clay.position}
      rotation={clay.rotation}
      scale={clay.scale}
    >
      <meshPhongMaterial 
        color={clay.color}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Camera controls that only allow rotation
function ViewOnlyControls() {
  const { camera, gl } = useThree()
  const controlsRef = useRef<any>(null)
  
  return (
    <TrackballControls
      ref={controlsRef}
      noPan={true}
      noZoom={false}
      rotateSpeed={1.0}
      zoomSpeed={1.2}
      minDistance={5}
      maxDistance={50}
    />
  )
}

export default function ProjectDetailView({ projectId, walletAddress, onBack }: ProjectDetailViewProps) {
  const [project, setProject] = useState<any>(null)
  const [clayObjects, setClayObjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [viewCount, setViewCount] = useState(0)
  const { showPopup } = usePopup()
  const [hasRecordedView, setHasRecordedView] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const controlsRef = useRef<any>(null)
  
  useEffect(() => {
    loadProject()
  }, [projectId])
  
  useEffect(() => {
    if (walletAddress) {
      checkUserInteractions()
    }
  }, [projectId, walletAddress])
  
  const loadProject = async () => {
    setLoading(true)
    try {
      const projectData = await downloadClayProject(projectId)
      setProject(projectData)
      
      const restoredObjects = restoreClayObjects(projectData)
      setClayObjects(restoredObjects)
      
      const likes = await getProjectLikeCount(projectId)
      setLikeCount(likes)
      
      // Get view count
      const views = await getProjectViewCount(projectId)
      setViewCount(views)
      
      // Record view if not already recorded
      if (!hasRecordedView) {
        await recordProjectView(projectId, walletAddress || undefined)
        setViewCount(views + 1)
        setHasRecordedView(true)
      }
    } catch (error) {
      console.error('Failed to load project:', error)
      showPopup('Failed to load project', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  const checkUserInteractions = async () => {
    if (!walletAddress) return
    
    try {
      const [liked, favorites] = await Promise.all([
        hasUserLikedProject(projectId, walletAddress),
        getUserFavorites(walletAddress)
      ])
      
      setIsLiked(liked)
      setIsFavorited(favorites.includes(projectId))
    } catch (error) {
      console.error('Failed to check user interactions:', error)
    }
  }
  
  const handleLike = async () => {
    if (!walletAddress) {
      showPopup('Please connect your wallet to like projects', 'warning')
      return
    }
    
    if (isLiked) {
      showPopup('You already liked this project', 'info')
      return
    }
    
    try {
      await likeProject(projectId, walletAddress)
      setIsLiked(true)
      setLikeCount(prev => prev + 1)
      showPopup('Project liked!', 'success')
    } catch (error) {
      console.error('Failed to like project:', error)
      showPopup('Failed to like project', 'error')
    }
  }
  
  const handleFavorite = async () => {
    if (!walletAddress) {
      showPopup('Please connect your wallet to favorite projects', 'warning')
      return
    }
    
    try {
      if (isFavorited) {
        await unfavoriteProject(projectId, walletAddress)
        setIsFavorited(false)
        showPopup('Removed from favorites', 'success')
      } else {
        await favoriteProject(projectId, walletAddress)
        setIsFavorited(true)
        showPopup('Added to favorites!', 'success')
      }
    } catch (error) {
      console.error('Failed to update favorite:', error)
      showPopup('Failed to update favorite', 'error')
    }
  }
  
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      // Reset camera position
      cameraRef.current.position.set(10, 10, 10)
      cameraRef.current.lookAt(0, 0, 0)
      
      // Reset controls
      controlsRef.current.reset()
    }
  }
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-[9998] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  return (
    <div className="fixed inset-0 bg-gray-50 z-[9998]">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-white shadow-sm z-10">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Profile"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{project?.name || 'Untitled'}</h1>
              <p className="text-sm text-gray-600">
                by {project?.author ? `${project.author.slice(0, 6)}...${project.author.slice(-4)}` : 'Unknown'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Eye size={16} />
                {viewCount} views
              </div>
              <div className="flex items-center gap-1">
                <Heart size={16} className={isLiked ? 'fill-red-500 text-red-500' : ''} />
                {likeCount} likes
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleLike}
                className={`p-3 rounded-lg transition-all ${
                  isLiked 
                    ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
                title={isLiked ? 'Already liked' : 'Like project'}
              >
                <Heart size={20} className={isLiked ? 'fill-current' : ''} />
              </button>
              <button
                onClick={handleFavorite}
                className={`p-3 rounded-lg transition-all ${
                  isFavorited 
                    ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' 
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
                title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={20} className={isFavorited ? 'fill-current' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 3D Canvas */}
      <div className="absolute inset-0 pt-20">
        <Canvas
          camera={{
            position: [10, 10, 10],
            fov: 60,
            near: 0.1,
            far: 1000
          }}
          style={{ background: project?.backgroundColor || '#f0f0f0' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={0.4} />
          <Environment preset="studio" />
          
          <ViewOnlyControls />
          
          {/* Render clay objects */}
          {clayObjects.map((clay) => (
            <ViewOnlyClay key={clay.id} clay={clay} />
          ))}
          
          {/* Grid */}
          <gridHelper args={[50, 50, 0x888888, 0xcccccc]} />
        </Canvas>
      </div>
      
      {/* Description */}
      {project?.description && (
        <div className="absolute bottom-0 left-0 right-0 bg-white shadow-lg p-4">
          <div className="max-w-6xl mx-auto">
            <p className="text-gray-700">{project.description}</p>
            {project.tags && project.tags.length > 0 && (
              <div className="flex gap-2 mt-2">
                {project.tags.map((tag: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
