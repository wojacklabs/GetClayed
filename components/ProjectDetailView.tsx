'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { TrackballControls, Environment, Grid } from '@react-three/drei'
import { Heart, Star, ArrowLeft, Eye, RotateCw, Maximize2, Home } from 'lucide-react'
import Link from 'next/link'
import * as THREE from 'three'
import { downloadClayProject, restoreClayObjects } from '../lib/clayStorageService'
import { likeProject, favoriteProject, unfavoriteProject, hasUserLikedProject, getUserFavorites, getProjectLikeCount, recordProjectView, getProjectViewCount, downloadUserProfile } from '../lib/profileService'
import { usePopup } from './PopupNotification'
import { AnimatedClayLogo } from './AnimatedClayLogo'
import RoyaltyTree from './RoyaltyTree'
import { queryMarketplaceListings } from '../lib/marketplaceService'
import { queryLibraryAssets } from '../lib/libraryService'

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
          emissive={isFromLibrary ? (isHighlighted || hovered ? '#ffff00' : '#ffd700') : undefined}
          emissiveIntensity={isFromLibrary ? (isHighlighted || hovered ? 0.5 : 0.2) : 0}
        />
      </mesh>
      {isFromLibrary && (
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
              opacity={isHighlighted ? 0.6 : 0.3}
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
  const [authorProfile, setAuthorProfile] = useState<{ displayName?: string } | null>(null)
  const [marketplaceListing, setMarketplaceListing] = useState<{ price: string; currency: string } | null>(null)
  const [libraryListing, setLibraryListing] = useState<{ royaltyETH: string; royaltyUSDC: string; name: string } | null>(null)
  const [loadingListings, setLoadingListings] = useState(true)
  const [hoveredLibraryId, setHoveredLibraryId] = useState<string | null>(null)
  
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
      
      const likes = await getProjectLikeCount(projectId)
      setLikeCount(likes)
      
      // Get view count
      const views = await getProjectViewCount(projectId)
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
      
      // Record view if not already recorded
      if (!hasRecordedView) {
        await recordProjectView(projectId, walletAddress || undefined)
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
      <div className="fixed inset-0 bg-gray-100 z-[9998] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
      </div>
    )
  }
  
  return (
    <div className="fixed inset-0 bg-gray-100 z-[9998]">
      {/* Minimal Header */}
      <div className="absolute top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-medium text-gray-900">{project?.name || 'Untitled'}</h1>
              {project?.author ? (
                <Link 
                  href={`/user/${project.author}`}
                  className="text-xs text-gray-500 hover:text-gray-700 hover:underline transition-colors"
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
          
          <div className="flex items-center gap-4">
            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
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
            <div className="flex items-center gap-1">
              <button
                onClick={handleLike}
                className={`p-2 rounded-md transition-all ${
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
                className={`p-2 rounded-md transition-all ${
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
      
      {/* 3D Canvas */}
      <div className="absolute inset-0 pt-14">
        <Canvas
          camera={{
            position: [10, 10, 10],
            fov: 60,
            near: 0.1,
            far: 1000
          }}
          style={{ background: project?.backgroundColor || '#f8f8f8' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={0.4} />
          <Environment preset="studio" />
          
          <ViewOnlyControls controlsRef={controlsRef} cameraRef={cameraRef} />
          
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
                {showGrid && (
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
        </Canvas>
      </div>
      
      {/* Bottom UI Controls - Minimal style */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white rounded-md border border-gray-200 p-1 z-10">
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`px-3 py-1.5 rounded transition-all text-sm ${
            showGrid
              ? 'bg-gray-800 text-white'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          title={showGrid ? 'Hide grid' : 'Show grid per clay'}
        >
          <span>Grid</span>
        </button>
        <button
          onClick={handleResetCamera}
          className="px-3 py-1.5 hover:bg-gray-100 text-gray-700 rounded transition-all text-sm"
          title="Reset camera"
        >
          <span>Reset</span>
        </button>
      </div>
      
      {/* Description - Minimal style */}
      {project?.description && (
        <div className="absolute bottom-16 left-4 right-4 max-w-2xl mx-auto">
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
      
      {/* Left side info panel */}
      <div className="absolute top-20 left-6 space-y-4 z-10">
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
        
        {/* Imported Libraries */}
        {project?.usedLibraries && project.usedLibraries.length > 0 && (
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 p-4 max-w-xs">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
              </svg>
              Imported Libraries ({project.usedLibraries.length})
            </h3>
            <div className="space-y-2">
              {project.usedLibraries.map((lib: any, idx: number) => (
                <div
                  key={idx}
                  className="group p-2 bg-gray-50 rounded hover:bg-gray-100 transition-all"
                  onMouseEnter={() => setHoveredLibraryId(lib.projectId)}
                  onMouseLeave={() => setHoveredLibraryId(null)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {lib.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {lib.royaltyPerImportETH && parseFloat(lib.royaltyPerImportETH) > 0 ? `${lib.royaltyPerImportETH} ETH` : 
                         lib.royaltyPerImportUSDC && parseFloat(lib.royaltyPerImportUSDC) > 0 ? `${lib.royaltyPerImportUSDC} USDC` : ''}
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
              ))}
            </div>
            <div className="pt-3 mt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Total royalty: {(() => {
                  const totalETH = project.usedLibraries.reduce((sum: number, lib: any) => sum + parseFloat(lib.royaltyPerImportETH || '0'), 0);
                  const totalUSDC = project.usedLibraries.reduce((sum: number, lib: any) => sum + parseFloat(lib.royaltyPerImportUSDC || '0'), 0);
                  
                  if (totalETH > 0 && totalUSDC > 0) {
                    return `${totalETH.toFixed(4)} ETH + ${totalUSDC.toFixed(2)} USDC`;
                  } else if (totalETH > 0) {
                    return `${totalETH.toFixed(4)} ETH`;
                  } else if (totalUSDC > 0) {
                    return `${totalUSDC.toFixed(2)} USDC`;
                  }
                  return '0';
                })()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
