'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { TrackballControls, Environment, Grid } from '@react-three/drei'
import { EffectComposer } from '@react-three/postprocessing'
import { Heart, Star, ArrowLeft, Eye, RotateCw, Maximize2, Home, Share2, Video } from 'lucide-react'
import Link from 'next/link'
import * as THREE from 'three'
import { Vector2 } from 'three'
import { downloadClayProject, restoreClayObjects } from '../lib/clayStorageService'
import { likeProject, favoriteProject, unfavoriteProject, hasUserLikedProject, getUserFavorites, getProjectLikeCount, recordProjectView, getProjectViewCount, downloadUserProfile } from '../lib/profileService'
import { usePopup } from './PopupNotification'
import { AnimatedClayLogo } from './AnimatedClayLogo'
import RoyaltyTree from './RoyaltyTree'
import { queryMarketplaceListings } from '../lib/marketplaceService'
import { queryLibraryAssets } from '../lib/libraryService'
import { formatCombinedCurrency } from '../lib/formatCurrency'
import { AsciiEffect } from './AsciiEffect'
import MinecraftView from './MinecraftView'

type ViewMode = 'normal' | 'grid' | 'ascii' | 'minecraft'

interface ProjectDetailViewProps {
  projectId: string
  walletAddress: string | null
  onBack: () => void
}

// Simple clay renderer for view-only mode
function ViewOnlyClay({ clay, isFromLibrary, isHighlighted }: { clay: any, isFromLibrary: boolean, isHighlighted: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  
  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={clay.geometry}
        position={clay.position}
        rotation={clay.rotation}
        scale={clay.scale instanceof THREE.Vector3 ? [clay.scale.x, clay.scale.y, clay.scale.z] : clay.scale || 1}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshPhongMaterial 
          color={clay.color}
          side={THREE.DoubleSide}
          emissive={isFromLibrary && (isHighlighted || hovered) ? '#ffff00' : undefined}
          emissiveIntensity={isFromLibrary && (isHighlighted || hovered) ? 0.5 : 0}
        />
      </mesh>
      {isFromLibrary && (isHighlighted || hovered) && (
        <>
          <mesh
            geometry={clay.geometry}
            position={clay.position}
            rotation={clay.rotation}
            scale={clay.scale instanceof THREE.Vector3 ? 
              [clay.scale.x * 1.05, clay.scale.y * 1.05, clay.scale.z * 1.05] : 
              (clay.scale || 1) * 1.05
            }
          >
            <meshBasicMaterial 
              color="#ffd700"
              wireframe
              transparent
              opacity={isHighlighted ? 0.6 : 0.4}
              depthTest={false}
            />
          </mesh>
        </>
      )}
    </group>
  )
}

// Camera controls that only allow rotation
function ViewOnlyControls({ controlsRef, cameraRef }: { controlsRef: any, cameraRef: any }) {
  const { camera, gl } = useThree()
  
  useEffect(() => {
    if (cameraRef) {
      cameraRef.current = camera
    }
  }, [camera, cameraRef])
  
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

// Camera Change Detector - tracks if camera moved from initial position
function CameraChangeDetector({ onCameraChange }: { onCameraChange: (changed: boolean) => void }) {
  const { camera } = useThree()
  const initialPosition = useRef(new THREE.Vector3(14, 7, 14))
  
  useFrame(() => {
    const distance = camera.position.distanceTo(initialPosition.current)
    const hasChanged = distance > 0.5
    onCameraChange(hasChanged)
  })
  
  return null
}

export default function ProjectDetailView({ projectId, walletAddress, onBack }: ProjectDetailViewProps) {
  const [project, setProject] = useState<any>(null)
  const [clayObjects, setClayObjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [viewCount, setViewCount] = useState(0)
  const { showPopup } = usePopup()
  const [hasRecordedView, setHasRecordedView] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('normal')
  const [cameraHasChanged, setCameraHasChanged] = useState(false)
  const [resolution, setResolution] = useState(new Vector2(1920, 1080))
  const [mousePos, setMousePos] = useState(new Vector2(0, 0))
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const controlsRef = useRef<any>(null)
  const [authorProfile, setAuthorProfile] = useState<{ displayName?: string } | null>(null)
  const [marketplaceListing, setMarketplaceListing] = useState<{ price: string; currency: string } | null>(null)
  const [libraryListing, setLibraryListing] = useState<{ royaltyETH: string; royaltyUSDC: string; name: string } | null>(null)
  const [loadingListings, setLoadingListings] = useState(true)
  const [hoveredLibraryId, setHoveredLibraryId] = useState<string | null>(null)
  
  useEffect(() => {
    loadProject()
  }, [projectId])
  
  // Track mouse position and resolution for ASCII effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = rect.height - (e.clientY - rect.top)
        setMousePos(new Vector2(x, y))
      }
    }
    
    const handleResize = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect()
        setResolution(new Vector2(rect.width, rect.height))
      }
    }
    
    const container = canvasContainerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('resize', handleResize)
      handleResize()
      
      return () => {
        container.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [])
  
  useEffect(() => {
    // Only check interactions after project is loaded (need project.id for stable ID)
    if (walletAddress && project) {
      checkUserInteractions()
    }
  }, [project, walletAddress])
  
  const loadProject = async () => {
    setLoading(true)
    try {
      const projectData = await downloadClayProject(projectId)
      setProject(projectData)
      
      // SECURITY: Check for integrity warnings
      if ((projectData as any).__integrityWarning) {
        showPopup(
          `⚠️ Security Warning: ${(projectData as any).__integrityWarning}. This project's library information may have been tampered with.`,
          'error',
          { autoClose: false }
        )
      }
      
      const restoredObjects = restoreClayObjects(projectData)
      setClayObjects(restoredObjects)
      
      // Debug: Log clay objects and their library sources
      console.log('[ProjectDetail] Clay objects:', restoredObjects.map(obj => ({
        id: obj.id,
        librarySourceId: obj.librarySourceId,
        isFromLibrary: !!obj.librarySourceId
      })))
      console.log('[ProjectDetail] Used libraries:', projectData.usedLibraries)
      
      // Use project.id (stable Project-ID) for view/like tracking, not the transaction ID from URL
      const stableProjectId = projectData.id
      console.log('[ProjectDetail] Using stable project ID for stats:', stableProjectId)
      
      const likes = await getProjectLikeCount(stableProjectId)
      setLikeCount(likes)
      
      // Get view count
      const views = await getProjectViewCount(stableProjectId)
      setViewCount(views)
      
      // Load author profile
      if (projectData.author) {
        try {
          const profile = await downloadUserProfile(projectData.author)
          setAuthorProfile(profile)
        } catch (error) {
          console.error('Failed to load author profile:', error)
        }
      }
      
      // Record view if not already recorded - use stable project ID
      if (!hasRecordedView) {
        await recordProjectView(stableProjectId, walletAddress || undefined)
        setViewCount(views + 1)
        setHasRecordedView(true)
      }
      
      // Check if project is listed in marketplace or library
      checkListings()
    } catch (error: any) {
      console.error('Failed to load project:', error)
      
      // Check if this is a corrupted project (image data)
      if (error.message?.includes('image data')) {
        showPopup('This project appears to be corrupted. It contains image data instead of project data.', 'error')
      } else if (error.message?.includes('Transaction not found') || error.message?.includes('not found')) {
        // Project was deleted or doesn't exist
        setNotFound(true)
      } else {
        showPopup('Failed to load project', 'error')
      }
    } finally {
      setLoading(false)
    }
  }
  
  const checkListings = async () => {
    try {
      setLoadingListings(true)
      
      // Check marketplace listing
      const marketplaceListings = await queryMarketplaceListings()
      const marketplaceListing = marketplaceListings.find(l => l.projectId === projectId)
      if (marketplaceListing) {
        setMarketplaceListing({
          price: marketplaceListing.price,
          currency: marketplaceListing.paymentToken
        })
      }
      
      // Check library listing
      const libraryAssets = await queryLibraryAssets(100)
      const libraryAsset = libraryAssets.find(a => a.projectId === projectId)
      if (libraryAsset) {
        setLibraryListing({
          royaltyETH: libraryAsset.royaltyPerImportETH,
          royaltyUSDC: libraryAsset.royaltyPerImportUSDC,
          name: libraryAsset.name
        })
      }
    } catch (error) {
      console.error('Failed to check listings:', error)
    } finally {
      setLoadingListings(false)
    }
  }
  
  // Use stable project ID (from loaded project) for all interactions
  const getStableProjectId = () => project?.id || projectId
  
  const checkUserInteractions = async () => {
    if (!walletAddress || !project) return
    
    const stableId = getStableProjectId()
    try {
      const [liked, favorites] = await Promise.all([
        hasUserLikedProject(stableId, walletAddress),
        getUserFavorites(walletAddress)
      ])
      
      setIsLiked(liked)
      setIsFavorited(favorites.includes(stableId))
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
    
    const stableId = getStableProjectId()
    try {
      await likeProject(stableId, walletAddress)
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
    
    const stableId = getStableProjectId()
    try {
      if (isFavorited) {
        await unfavoriteProject(stableId, walletAddress)
        setIsFavorited(false)
        showPopup('Removed from favorites', 'success')
      } else {
        await favoriteProject(stableId, walletAddress)
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
  
  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    showPopup('URL copied to clipboard', 'success')
  }
  
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-[9998] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
      </div>
    )
  }
  
  if (notFound) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-[9998] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Project not found</h2>
          <p className="text-gray-600 mb-4">This project may have been deleted or doesn't exist.</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="fixed inset-0 bg-gray-100 z-[9998]">
      {/* Minimal Header */}
      <div className="absolute top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="px-4 flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-3 min-w-0 max-w-[40%] sm:max-w-[45%]">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-medium text-gray-900 truncate">{project?.name || 'Untitled'}</h1>
              {project?.author ? (
                <Link 
                  href={`/user/${project.author}`}
                  className="text-xs text-gray-500 hover:text-gray-700 hover:underline transition-colors truncate block"
                >
                  by {authorProfile?.displayName || `${project.author.slice(0, 6)}...${project.author.slice(-4)}`}
                </Link>
              ) : (
                <p className="text-xs text-gray-500">by Unknown</p>
              )}
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
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Stats */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Eye size={14} />
                <span>{viewCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart size={14} className={isLiked ? 'fill-red-500 text-red-500' : ''} />
                <span>{likeCount}</span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleShare}
                className="w-8 h-8 flex items-center justify-center rounded-md transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
                title="Share"
              >
                <Share2 size={16} />
              </button>
              <button
                onClick={handleLike}
                className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                  isLiked 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title={isLiked ? 'Already liked' : 'Like project'}
              >
                <Heart size={16} className={isLiked ? 'fill-current' : ''} />
              </button>
              <button
                onClick={handleFavorite}
                className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
                  isFavorited 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={16} className={isFavorited ? 'fill-current' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 3D Canvas - Normal/Grid/ASCII modes */}
      {viewMode !== 'minecraft' && (
        <div ref={canvasContainerRef} className="absolute inset-0 pt-14">
          <Canvas
            camera={{
              position: [14, 7, 14],
              fov: 50,
              near: 0.1,
              far: 1000
            }}
            style={{ background: project?.backgroundColor || '#f8f8f8' }}
          >
            <ambientLight intensity={0.35} />
            <directionalLight position={[8, 12, 8]} intensity={1.2} />
            <directionalLight position={[-6, 4, -6]} intensity={0.5} />
            <directionalLight position={[0, -8, 4]} intensity={0.25} />
            <Environment preset="studio" />
            
            <ViewOnlyControls controlsRef={controlsRef} cameraRef={cameraRef} />
            <CameraChangeDetector onCameraChange={setCameraHasChanged} />
            
            {/* Render clay objects */}
            {clayObjects.map((clay) => {
              // Calculate color based on Z position (same as AdvancedClay)
              const z = clay.position.z
              
              // Define Z range for color mapping (-10 to 10)
              const minZ = -10
              const maxZ = 10
              const zRange = maxZ - minZ
              
              // Normalize Z position to 0-1 range
              const normalizedZ = Math.max(0, Math.min(1, (z - minZ) / zRange))
              
              // Map to hue range (blue to red: 240 to 0)
              const hue = 240 - (normalizedZ * 240) // Blue (240) when low, Red (0) when high
              const color = `hsl(${hue}, 70%, 50%)`
              
              return (
                <group key={clay.id}>
                  <ViewOnlyClay 
                    clay={clay} 
                    isFromLibrary={!!clay.librarySourceId}
                    isHighlighted={!!clay.librarySourceId && hoveredLibraryId === clay.librarySourceId}
                  />
                  {viewMode === 'grid' && (
                    <group position={clay.position}>
                      {/* XZ horizontal plane with dynamic color based on Z position */}
                      <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[200, 200, 100, 100]} />
                        <meshBasicMaterial
                          color={color}
                          wireframe
                          transparent
                          opacity={0.2}
                          side={THREE.DoubleSide}
                        />
                      </mesh>
                    </group>
                  )}
                </group>
              )
            })}
            
            {/* ASCII Effect */}
            {viewMode === 'ascii' && (
              <EffectComposer>
                <AsciiEffect
                  style="standard"
                  cellSize={8}
                  invert={false}
                  color={true}
                  resolution={resolution}
                  mousePos={mousePos}
                  postfx={{
                    scanlineIntensity: 0,
                    scanlineCount: 200,
                    vignetteIntensity: 0,
                    vignetteRadius: 0.8,
                    colorPalette: 0,
                    brightnessAdjust: 0.4,
                    contrastAdjust: 1.5,
                  }}
                />
              </EffectComposer>
            )}
          </Canvas>
        </div>
      )}
      
      {/* Minecraft View */}
      {viewMode === 'minecraft' && (
        <div className="absolute inset-0 pt-14">
          <MinecraftView 
            clayObjects={clayObjects}
            projectName={project?.name}
            backgroundColor={project?.backgroundColor}
          />
        </div>
      )}
      
      {/* Camera Reset Floating Button - Shows when camera has moved (same as AdvancedClay) */}
      {cameraHasChanged && viewMode !== 'minecraft' && (
        <div className="absolute bottom-24 right-4 z-20 flex flex-col items-center gap-1">
          <button
            onClick={() => {
              handleResetCamera()
              setCameraHasChanged(false)
            }}
            className="p-4 rounded-full bg-gray-800 hover:bg-gray-700 text-white shadow-lg transition-all hover:scale-110"
            title="Reset Camera Angle"
          >
            <Video size={24} />
          </button>
          <span className="text-xs text-gray-600 font-medium bg-white/90 px-2 py-0.5 rounded shadow-sm">
            Reset
          </span>
        </div>
      )}
      
      {/* Bottom UI Controls - Minimal style */}
      {/* Desktop: Center, Mobile: Right to avoid wallet button */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 hidden sm:block">
        {/* Desktop buttons */}
        <div className="flex items-center gap-2 bg-white rounded-md border border-gray-200 p-1">
          <button
            onClick={() => setViewMode('normal')}
            className={`px-3 py-1.5 rounded transition-all text-sm ${
              viewMode === 'normal'
                ? 'bg-gray-800 text-white'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="Normal view"
          >
            <span>Normal</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded transition-all text-sm ${
              viewMode === 'grid'
                ? 'bg-gray-800 text-white'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="Show grid per clay"
          >
            <span>Grid</span>
          </button>
          <button
            onClick={() => setViewMode('ascii')}
            className={`px-3 py-1.5 rounded transition-all text-sm ${
              viewMode === 'ascii'
                ? 'bg-gray-800 text-white'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="ASCII art view"
          >
            <span>ASCII</span>
          </button>
          <button
            onClick={() => setViewMode('minecraft')}
            className={`px-3 py-1.5 rounded transition-all text-sm ${
              viewMode === 'minecraft'
                ? 'bg-green-600 text-white'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="Minecraft style exploration"
          >
            <span>Craft</span>
          </button>
        </div>
      </div>
      
      {/* Mobile select - Right side to avoid wallet button on left */}
      <div className="absolute bottom-4 right-4 z-10 sm:hidden">
        <select
          value={viewMode}
          onChange={(e) => {
            const value = e.target.value
            if (value === 'normal' || value === 'grid' || value === 'ascii' || value === 'minecraft') {
              setViewMode(value)
            } else if (value === 'reset') {
              handleResetCamera()
              setCameraHasChanged(false)
              e.target.value = viewMode
            }
          }}
          className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        >
          <option value="normal">Normal View</option>
          <option value="grid">Grid View</option>
          <option value="ascii">ASCII View</option>
          <option value="minecraft">Craft Mode</option>
          <option value="reset">Reset Camera</option>
        </select>
      </div>
      
      {/* Description - Minimal style (hidden in minecraft mode) */}
      {project?.description && viewMode !== 'minecraft' && (
        <div className="absolute bottom-14 left-4 right-4 max-w-2xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-md border border-gray-200 p-3">
            <p className="text-sm text-gray-700">{project.description}</p>
            {project.tags && project.tags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {project.tags.map((tag: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Left side info panel (hidden in minecraft mode) */}
      {viewMode !== 'minecraft' && <div className="absolute top-20 left-6 space-y-4 z-10">
        {/* Marketplace Info */}
        {marketplaceListing && (
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 p-4 max-w-xs">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3h18v18H3V3z"/>
                <path d="M3 9h18"/>
                <path d="M9 21V9"/>
              </svg>
              Marketplace
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Listed for</p>
                <p className="text-lg font-bold text-gray-900">
                  {marketplaceListing.price} {marketplaceListing.currency}
                </p>
              </div>
              <Link
                href={`/marketplace/${projectId}`}
                className="block w-full text-center px-3 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                View in Marketplace
              </Link>
            </div>
          </div>
        )}
        
        {/* Library Info */}
        {libraryListing && (
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 p-4 max-w-xs">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              Library
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Royalty per import</p>
                <p className="text-lg font-bold text-gray-900">
                  {parseFloat(libraryListing.royaltyETH) > 0 && `${libraryListing.royaltyETH} ETH`}
                  {parseFloat(libraryListing.royaltyUSDC) > 0 && `${libraryListing.royaltyUSDC} USDC`}
                </p>
              </div>
              <Link
                href={`/library/${projectId}`}
                className="block w-full text-center px-3 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                View in Library
              </Link>
            </div>
          </div>
        )}
        
        {/* Imported Libraries with Direct/Indirect Distinction */}
        {project?.usedLibraries && project.usedLibraries.length > 0 && (
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 p-4 max-w-xs">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
              </svg>
              Imported Libraries ({project.usedLibraries.length})
            </h3>
            <div className="space-y-2">
              {project.usedLibraries.map((lib: any, idx: number) => {
                // Check if this is a direct import (for now, we'll need to add this info to the project data)
                const isDirect = project.directImports ? project.directImports.includes(lib.projectId) : true
                
                return (
                  <div
                    key={idx}
                    className={`group p-2 rounded transition-all ${isDirect ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-50/50 hover:bg-gray-100/50 ml-4'}`}
                    onMouseEnter={() => setHoveredLibraryId(lib.projectId)}
                    onMouseLeave={() => setHoveredLibraryId(null)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!isDirect && <span className="text-xs text-gray-400">└</span>}
                          <p className={`text-sm font-medium truncate ${isDirect ? 'text-gray-900' : 'text-gray-600'}`}>
                            {lib.name}
                          </p>
                        </div>
                        <p className={`text-xs ${isDirect ? 'text-gray-500' : 'text-gray-400'}`}>
                          {lib.royaltyPerImportETH && parseFloat(lib.royaltyPerImportETH) > 0 ? `${lib.royaltyPerImportETH} ETH` : 
                           lib.royaltyPerImportUSDC && parseFloat(lib.royaltyPerImportUSDC) > 0 ? `${lib.royaltyPerImportUSDC} USDC` : ''}
                          {!isDirect && ' (included)'}
                        </p>
                      </div>
                      <Link
                        href={`/library/${lib.projectId}`}
                        className="ml-2 px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-800 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="pt-3 mt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                You pay: {(() => {
                  // Only calculate direct imports
                  const directLibs = project.directImports 
                    ? project.usedLibraries.filter((lib: any) => project.directImports.includes(lib.projectId))
                    : project.usedLibraries
                  
                  const totalETH = directLibs.reduce((sum: number, lib: any) => sum + parseFloat(lib.royaltyPerImportETH || '0'), 0);
                  const totalUSDC = directLibs.reduce((sum: number, lib: any) => sum + parseFloat(lib.royaltyPerImportUSDC || '0'), 0);
                  
                  return formatCombinedCurrency(totalETH, totalUSDC);
                })()}
              </p>
            </div>
          </div>
        )}
      </div>}
    </div>
  )
}
