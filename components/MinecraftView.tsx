'use client'

import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sky, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Eye, Box, Move, User } from 'lucide-react'

// Block colors - simple color palette
const BLOCK_COLORS = [
  '#4a7c23', // Green
  '#6B4423', // Brown  
  '#808080', // Gray
  '#8B4513', // Wood
  '#F4D35E', // Sand
  '#4A90D9', // Blue
  '#C4A484', // Clay
  '#E74C3C', // Red
  '#9B59B6', // Purple
  '#1ABC9C', // Teal
  '#F39C12', // Orange
  '#2C3E50', // Dark
] as const

// Keep BLOCK_TYPES for compatibility
const BLOCK_TYPES = {
  grass: { top: '#4a7c23', side: '#3a6c13', bottom: '#2a5c03' },
  dirt: { top: '#6B4423', side: '#5B3413', bottom: '#4B2403' },
  stone: { top: '#808080', side: '#707070', bottom: '#606060' },
  wood: { top: '#8B4513', side: '#7B3503', bottom: '#6B2503' },
  sand: { top: '#F4D35E', side: '#E4C34E', bottom: '#D4B33E' },
  water: { top: '#4A90D9', side: '#3A80C9', bottom: '#2A70B9' },
  clay: { top: '#C4A484', side: '#B49474', bottom: '#A48464' },
} as const

type BlockType = keyof typeof BLOCK_TYPES

interface Block {
  position: [number, number, number]
  type: BlockType
  color?: string // Custom color support
}

interface MinecraftViewProps {
  clayObjects: any[]
  projectName?: string
  backgroundColor?: string
}

// 마인크래프트 스타일 캐릭터 모델
function MinecraftCharacter({ 
  position, 
  rotation,
  isWalking
}: { 
  position: THREE.Vector3
  rotation: number
  isWalking: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const leftArmRef = useRef<THREE.Mesh>(null)
  const rightArmRef = useRef<THREE.Mesh>(null)
  const leftLegRef = useRef<THREE.Mesh>(null)
  const rightLegRef = useRef<THREE.Mesh>(null)
  
  // 걷기 애니메이션
  useFrame((state) => {
    if (!isWalking) return
    
    const time = state.clock.elapsedTime * 8
    const swing = Math.sin(time) * 0.5
    
    if (leftArmRef.current) leftArmRef.current.rotation.x = swing
    if (rightArmRef.current) rightArmRef.current.rotation.x = -swing
    if (leftLegRef.current) leftLegRef.current.rotation.x = -swing
    if (rightLegRef.current) rightLegRef.current.rotation.x = swing
  })
  
  // 캐릭터 색상
  const skinColor = '#D4A574'
  const shirtColor = '#4A90D9'
  const pantsColor = '#3A5BA0'
  const shoeColor = '#333333'
  const hairColor = '#4A3728'
  
  return (
    <group ref={groupRef} position={position} rotation={[0, rotation + Math.PI, 0]}>
      {/* 머리 */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      {/* 머리카락 */}
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[0.52, 0.15, 0.52]} />
        <meshStandardMaterial color={hairColor} />
      </mesh>
      
      {/* 몸통 */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.5, 0.75, 0.3]} />
        <meshStandardMaterial color={shirtColor} />
      </mesh>
      
      {/* 왼팔 */}
      <mesh ref={leftArmRef} position={[-0.375, 0.85, 0]}>
        <boxGeometry args={[0.25, 0.75, 0.25]} />
        <meshStandardMaterial color={shirtColor} />
      </mesh>
      
      {/* 오른팔 */}
      <mesh ref={rightArmRef} position={[0.375, 0.85, 0]}>
        <boxGeometry args={[0.25, 0.75, 0.25]} />
        <meshStandardMaterial color={shirtColor} />
      </mesh>
      
      {/* 왼다리 */}
      <mesh ref={leftLegRef} position={[-0.125, 0.2, 0]}>
        <boxGeometry args={[0.25, 0.5, 0.25]} />
        <meshStandardMaterial color={pantsColor} />
      </mesh>
      {/* 왼발 */}
      <mesh position={[-0.125, -0.05, 0.05]}>
        <boxGeometry args={[0.25, 0.1, 0.35]} />
        <meshStandardMaterial color={shoeColor} />
      </mesh>
      
      {/* 오른다리 */}
      <mesh ref={rightLegRef} position={[0.125, 0.2, 0]}>
        <boxGeometry args={[0.25, 0.5, 0.25]} />
        <meshStandardMaterial color={pantsColor} />
      </mesh>
      {/* 오른발 */}
      <mesh position={[0.125, -0.05, 0.05]}>
        <boxGeometry args={[0.25, 0.1, 0.35]} />
        <meshStandardMaterial color={shoeColor} />
      </mesh>
      
      {/* 눈 */}
      <mesh position={[-0.1, 1.55, 0.26]}>
        <boxGeometry args={[0.08, 0.08, 0.02]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[0.1, 1.55, 0.26]}>
        <boxGeometry args={[0.08, 0.08, 0.02]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  )
}

// Original clay rendering (no conversion, lifted above ground)
function ClayRenderer({ clayObjects }: { clayObjects: any[] }) {
  // Calculate the lowest Y point to lift everything above ground
  const yOffset = useMemo(() => {
    if (clayObjects.length === 0) return 0
    
    let minY = Infinity
    clayObjects.forEach((clay) => {
      const pos = clay.position
      const scale = clay.scale instanceof THREE.Vector3 ? clay.scale.y : (clay.scale || 1)
      // Approximate bottom of object (with extra margin)
      const bottomY = pos.y - scale * 1.5
      if (bottomY < minY) minY = bottomY
    })
    
    // Lift so minimum Y is at ground level (0) + safety padding
    const safePadding = 1.5
    return minY < 0 ? -minY + safePadding : safePadding
  }, [clayObjects])
  
  return (
    <group position={[0, yOffset, 0]}>
      {clayObjects.map((clay) => (
        <mesh
          key={clay.id}
          geometry={clay.geometry}
          position={clay.position}
          rotation={clay.rotation}
          scale={clay.scale instanceof THREE.Vector3 ? [clay.scale.x, clay.scale.y, clay.scale.z] : clay.scale || 1}
        >
          <meshPhongMaterial 
            color={clay.color}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

// Minecraft style block with custom color support
function VoxelBlock({ position, type, color, onRemove, onPlace }: { 
  position: [number, number, number]
  type: BlockType
  color?: string
  onRemove: () => void
  onPlace: (normal: THREE.Vector3) => void
}) {
  // Use custom color if provided, otherwise use type colors
  const baseColor = color || BLOCK_TYPES[type].top
  
  const materials = useMemo(() => {
    const darken = (hex: string, amount: number) => {
      const num = parseInt(hex.replace('#', ''), 16)
      const r = Math.max(0, (num >> 16) - amount)
      const g = Math.max(0, ((num >> 8) & 0x00FF) - amount)
      const b = Math.max(0, (num & 0x0000FF) - amount)
      return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
    }
    
    return [
      new THREE.MeshStandardMaterial({ color: darken(baseColor, 20) }),
      new THREE.MeshStandardMaterial({ color: darken(baseColor, 20) }),
      new THREE.MeshStandardMaterial({ color: baseColor }),
      new THREE.MeshStandardMaterial({ color: darken(baseColor, 40) }),
      new THREE.MeshStandardMaterial({ color: darken(baseColor, 20) }),
      new THREE.MeshStandardMaterial({ color: darken(baseColor, 20) }),
    ]
  }, [baseColor])
  
  return (
    <mesh
      position={position}
      material={materials}
      onClick={(e) => {
        e.stopPropagation()
        // Only allow click placement on desktop (screen width >= 640px)
        if (window.innerWidth < 640) return
        if (e.face?.normal) {
          onPlace(e.face.normal)
        }
      }}
      onContextMenu={(e) => {
        e.stopPropagation()
        // Only allow right-click removal on desktop
        if (window.innerWidth < 640) return
        onRemove()
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  )
}

// Ground with block placement support - Minecraft style grass texture
function Ground({ size = 64, onPlaceBlock }: { size?: number, onPlaceBlock?: (pos: [number, number, number]) => void }) {
  // Create varied grass colors for more natural look
  const grassColors = useMemo(() => {
    const colors: { pos: [number, number, number], color: string }[] = []
    const baseColors = ['#4a7c23', '#3d6b1c', '#52842a', '#458020', '#3f7219', '#4d8526']
    
    for (let x = -size/2; x < size/2; x += 4) {
      for (let z = -size/2; z < size/2; z += 4) {
        const colorIndex = Math.floor(Math.random() * baseColors.length)
        colors.push({
          pos: [x + 2, 0, z + 2],
          color: baseColors[colorIndex]
        })
      }
    }
    return colors
  }, [size])
  
  return (
    <group>
      {/* Base grass layer - click to place only on desktop (>=640px) */}
      <mesh 
        position={[0, -0.5, 0]} 
        receiveShadow
        onClick={(e) => {
          e.stopPropagation()
          // Only allow click placement on desktop (screen width >= 640px)
          if (window.innerWidth < 640) return
          if (onPlaceBlock && e.point) {
            const x = Math.floor(e.point.x) + 0.5
            const z = Math.floor(e.point.z) + 0.5
            onPlaceBlock([x, 0.5, z])
          }
        }}
      >
        <boxGeometry args={[size, 1, size]} />
        <meshStandardMaterial color="#3d6b1c" />
      </mesh>
      
      {/* Grass variation patches */}
      {grassColors.map((patch, i) => (
        <mesh key={i} position={[patch.pos[0], 0.01, patch.pos[2]]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[4, 4]} />
          <meshStandardMaterial color={patch.color} transparent opacity={0.8} />
        </mesh>
      ))}
      
      {/* Dirt layer underneath */}
      <mesh position={[0, -1.5, 0]}>
        <boxGeometry args={[size, 1, size]} />
        <meshStandardMaterial color="#5a3a1a" />
      </mesh>
      
      {/* Subtle grid for depth perception */}
      <gridHelper args={[size, size * 2, '#2d5510', '#2d5510']} position={[0, 0.02, 0]} />
    </group>
  )
}

// Player controller + camera system
function PlayerController({ 
  isFirstPerson,
  playerPosition,
  setPlayerPosition,
  playerRotation,
  setPlayerRotation,
  isWalking,
  setIsWalking,
  isLocked,
  blocks,
  isMobile,
  joystickRef,
  mobileJump,
  setMobileJump
}: { 
  isFirstPerson: boolean
  playerPosition: THREE.Vector3
  setPlayerPosition: (pos: THREE.Vector3) => void
  playerRotation: number
  setPlayerRotation: (rot: number) => void
  isWalking: boolean
  setIsWalking: (walking: boolean) => void
  isLocked: boolean
  blocks: Block[]
  isMobile?: boolean
  joystickRef?: React.MutableRefObject<{ x: number, y: number, active: boolean }>
  mobileJump?: boolean
  setMobileJump?: (v: boolean) => void
}) {
  const { camera } = useThree()
  const velocity = useRef(new THREE.Vector3())
  const moveForward = useRef(false)
  const moveBackward = useRef(false)
  const moveLeft = useRef(false)
  const moveRight = useRef(false)
  const isJumping = useRef(false)
  const jumpVelocity = useRef(0)
  const yaw = useRef(playerRotation)
  const pitch = useRef(0)
  
  // Sync yaw with playerRotation when it changes externally (mobile touch)
  useEffect(() => {
    yaw.current = playerRotation
  }, [playerRotation])
  
  // Check if there's a block at position
  const getBlockAt = useCallback((x: number, y: number, z: number) => {
    return blocks.find(b => 
      Math.abs(b.position[0] - x) < 0.6 &&
      Math.abs(b.position[1] - y) < 0.6 &&
      Math.abs(b.position[2] - z) < 0.6
    )
  }, [blocks])
  
  // Get ground height at position (including blocks)
  const getGroundHeight = useCallback((x: number, z: number) => {
    let maxY = 0
    blocks.forEach(b => {
      if (Math.abs(b.position[0] - x) < 0.6 && Math.abs(b.position[2] - z) < 0.6) {
        const blockTop = b.position[1] + 0.5
        if (blockTop > maxY) maxY = blockTop
      }
    })
    return maxY
  }, [blocks])
  
  // 마우스 이동 핸들링
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isLocked) return
      
      yaw.current -= e.movementX * 0.002
      pitch.current -= e.movementY * 0.002
      pitch.current = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch.current))
      
      setPlayerRotation(yaw.current)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [isLocked, setPlayerRotation])
  
  // 키보드 입력
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveForward.current = true; break
        case 'KeyS': case 'ArrowDown': moveBackward.current = true; break
        case 'KeyA': case 'ArrowLeft': moveLeft.current = true; break
        case 'KeyD': case 'ArrowRight': moveRight.current = true; break
        case 'Space':
          if (!isJumping.current) {
            isJumping.current = true
            jumpVelocity.current = 0.18
          }
          break
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveForward.current = false; break
        case 'KeyS': case 'ArrowDown': moveBackward.current = false; break
        case 'KeyA': case 'ArrowLeft': moveLeft.current = false; break
        case 'KeyD': case 'ArrowRight': moveRight.current = false; break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])
  
  // Falling state for out-of-bounds
  const isFallingOffMap = useRef(false)
  const fallVelocity = useRef(0)
  const isRespawning = useRef(false)
  
  useFrame((_, delta) => {
    if (!isLocked) return
    
    const moveSpeed = 1.8
    const mapBoundary = 32 // Half of ground size (64/2)
    const newPos = playerPosition.clone()
    
    // Check if player went out of bounds (start falling off map)
    // Only trigger when fully off the ground edge
    if (!isFallingOffMap.current && !isRespawning.current) {
      if (Math.abs(newPos.x) > mapBoundary || Math.abs(newPos.z) > mapBoundary) {
        isFallingOffMap.current = true
        fallVelocity.current = 0
        velocity.current.set(0, 0, 0)
      }
    }
    
    // Falling off map animation
    if (isFallingOffMap.current) {
      fallVelocity.current += 0.02 // Accelerate falling
      newPos.y -= fallVelocity.current
      
      // When fallen deep enough, trigger respawn
      if (newPos.y < -30) {
        isFallingOffMap.current = false
        isRespawning.current = true
        newPos.set(0, 25, 5) // Spawn high above
        fallVelocity.current = 0
      }
      
      setPlayerPosition(newPos)
      
      // Camera follows during fall
      if (isFirstPerson) {
        camera.position.set(newPos.x, newPos.y + 1.6, newPos.z)
        camera.rotation.order = 'YXZ'
        camera.rotation.y = yaw.current
        camera.rotation.x = pitch.current
      } else {
        const cameraDistance = 6
        const cameraHeight = 3
        const cameraX = newPos.x + Math.sin(yaw.current) * cameraDistance
        const cameraZ = newPos.z + Math.cos(yaw.current) * cameraDistance
        camera.position.set(cameraX, newPos.y + cameraHeight, cameraZ)
        camera.lookAt(newPos.x, newPos.y + 1.2, newPos.z)
      }
      return
    }
    
    // Respawn falling animation
    if (isRespawning.current) {
      fallVelocity.current += 0.015 // Slightly slower fall for respawn
      newPos.y -= fallVelocity.current
      
      const floorHeight = getGroundHeight(newPos.x, newPos.z)
      if (newPos.y <= floorHeight) {
        newPos.y = floorHeight
        isRespawning.current = false
        fallVelocity.current = 0
        isJumping.current = false
        jumpVelocity.current = 0
      }
      
      setPlayerPosition(newPos)
      
      // Camera follows during respawn
      if (isFirstPerson) {
        camera.position.set(newPos.x, newPos.y + 1.6, newPos.z)
        camera.rotation.order = 'YXZ'
        camera.rotation.y = yaw.current
        camera.rotation.x = pitch.current
      } else {
        const cameraDistance = 6
        const cameraHeight = 3
        const cameraX = newPos.x + Math.sin(yaw.current) * cameraDistance
        const cameraZ = newPos.z + Math.cos(yaw.current) * cameraDistance
        camera.position.set(cameraX, newPos.y + cameraHeight, cameraZ)
        camera.lookAt(newPos.x, newPos.y + 1.2, newPos.z)
      }
      return
    }
    
    // Normal movement
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current)
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current)
    
    velocity.current.x *= 0.85
    velocity.current.z *= 0.85
    
    // Desktop keyboard input
    if (moveForward.current) velocity.current.add(forward.clone().multiplyScalar(moveSpeed * delta))
    if (moveBackward.current) velocity.current.add(forward.clone().multiplyScalar(-moveSpeed * delta))
    if (moveLeft.current) velocity.current.add(right.clone().multiplyScalar(-moveSpeed * delta))
    if (moveRight.current) velocity.current.add(right.clone().multiplyScalar(moveSpeed * delta))
    
    // Mobile joystick input
    if (isMobile && joystickRef?.current.active) {
      const jx = joystickRef.current.x
      const jy = joystickRef.current.y
      velocity.current.add(forward.clone().multiplyScalar(-jy * moveSpeed * delta))
      velocity.current.add(right.clone().multiplyScalar(jx * moveSpeed * delta))
    }
    
    // Mobile jump
    if (isMobile && mobileJump && !isJumping.current) {
      isJumping.current = true
      jumpVelocity.current = 0.18
      setMobileJump?.(false)
    }
    
    const nextX = newPos.x + velocity.current.x
    const nextZ = newPos.z + velocity.current.z
    
    // Collision detection - check if there's a block in the way
    const nextGroundHeight = getGroundHeight(nextX, nextZ)
    const heightDiff = nextGroundHeight - newPos.y
    
    // Block movement if height difference is too high
    const canMove = heightDiff <= 0.6 || isJumping.current
    
    if (canMove) {
      newPos.x = nextX
      newPos.z = nextZ
    } else {
      velocity.current.x = 0
      velocity.current.z = 0
    }
    
    // Walking state
    const keyboardMoving = moveForward.current || moveBackward.current || moveLeft.current || moveRight.current
    const joystickMoving = !!(isMobile && joystickRef?.current.active && (Math.abs(joystickRef.current.x) > 0.1 || Math.abs(joystickRef.current.y) > 0.1))
    const isMoving = keyboardMoving || joystickMoving
    if (isMoving !== isWalking) setIsWalking(isMoving)
    
    // Jump and gravity
    if (isJumping.current) {
      newPos.y += jumpVelocity.current
      jumpVelocity.current -= 0.015 // Gravity during jump
      
      // Check if landed on a block or ground
      const floorHeight = getGroundHeight(newPos.x, newPos.z)
      if (jumpVelocity.current < 0 && newPos.y <= floorHeight) {
        newPos.y = floorHeight
        isJumping.current = false
        jumpVelocity.current = 0
      }
      
      // Check ceiling collision (hitting block from below)
      if (jumpVelocity.current > 0) {
        const headHeight = newPos.y + 1.8
        const ceilingCheck = getGroundHeight(newPos.x, newPos.z)
        // If there's a block at head level, stop upward momentum
        blocks.forEach(b => {
          if (Math.abs(b.position[0] - newPos.x) < 0.6 && 
              Math.abs(b.position[2] - newPos.z) < 0.6 &&
              b.position[1] - 0.5 < headHeight && 
              b.position[1] + 0.5 > newPos.y + 1) {
            jumpVelocity.current = Math.min(jumpVelocity.current, 0)
          }
        })
      }
    } else {
      // Gravity when not jumping - fall to ground level
      const floorHeight = getGroundHeight(newPos.x, newPos.z)
      if (newPos.y > floorHeight + 0.01) {
        // Falling
        newPos.y = Math.max(floorHeight, newPos.y - 0.15)
      } else {
        newPos.y = floorHeight
      }
    }
    
    setPlayerPosition(newPos)
    
    // Camera position update
    if (isFirstPerson) {
      // 1st person: at character head
      camera.position.set(newPos.x, newPos.y + 1.6, newPos.z)
      camera.rotation.order = 'YXZ'
      camera.rotation.y = yaw.current
      camera.rotation.x = pitch.current
    } else {
      // 3rd person: behind character
      const cameraDistance = 6
      const cameraHeight = 3
      const cameraX = newPos.x + Math.sin(yaw.current) * cameraDistance
      const cameraZ = newPos.z + Math.cos(yaw.current) * cameraDistance
      
      camera.position.set(cameraX, newPos.y + cameraHeight, cameraZ)
      camera.lookAt(newPos.x, newPos.y + 1.2, newPos.z)
    }
  })
  
  return null
}

// 메인 씬
function MinecraftScene({ 
  clayObjects, 
  blocks, 
  setBlocks,
  selectedBlockType,
  selectedColor,
  isLocked,
  isFirstPerson,
  isFreeView,
  playerPosition,
  setPlayerPosition,
  playerRotation,
  setPlayerRotation,
  isWalking,
  setIsWalking,
  isMobile,
  joystickRef,
  mobileJump,
  setMobileJump
}: { 
  clayObjects: any[]
  blocks: Block[]
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>
  selectedBlockType: BlockType
  selectedColor: string
  isLocked: boolean
  isFirstPerson: boolean
  isFreeView: boolean
  playerPosition: THREE.Vector3
  setPlayerPosition: (pos: THREE.Vector3) => void
  playerRotation: number
  setPlayerRotation: (rot: number) => void
  isWalking: boolean
  setIsWalking: (walking: boolean) => void
  isMobile: boolean
  joystickRef: React.MutableRefObject<{ x: number, y: number, active: boolean }>
  mobileJump: boolean
  setMobileJump: (v: boolean) => void
}) {
  const handleRemoveBlock = useCallback((index: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== index))
  }, [setBlocks])
  
  // Helper: get stacked Y position at given X, Z
  const getStackedY = useCallback((x: number, z: number) => {
    let maxY = 0.5
    blocks.forEach(b => {
      if (Math.abs(b.position[0] - x) < 0.6 && Math.abs(b.position[2] - z) < 0.6) {
        maxY = Math.max(maxY, b.position[1] + 1)
      }
    })
    return maxY
  }, [blocks])
  
  const handlePlaceBlock = useCallback((clickPosition: [number, number, number], normal: THREE.Vector3) => {
    let newPos: [number, number, number]
    
    // In 3rd person, place block in front of character (stacked)
    if (!isFirstPerson) {
      const distance = 1.2 // 1 block in front
      const frontX = Math.floor(playerPosition.x - Math.sin(playerRotation) * distance) + 0.5
      const frontZ = Math.floor(playerPosition.z - Math.cos(playerRotation) * distance) + 0.5
      const stackY = getStackedY(frontX, frontZ)
      newPos = [frontX, stackY, frontZ]
    } else {
      // 1st person: place adjacent to clicked block using normal
      const adjX = Math.floor(clickPosition[0] + normal.x) + 0.5
      const adjY = clickPosition[1] + normal.y
      const adjZ = Math.floor(clickPosition[2] + normal.z) + 0.5
      newPos = [adjX, adjY, adjZ]
    }
    
    const exists = blocks.some(b => 
      Math.abs(b.position[0] - newPos[0]) < 0.4 && 
      Math.abs(b.position[1] - newPos[1]) < 0.4 && 
      Math.abs(b.position[2] - newPos[2]) < 0.4
    )
    
    if (!exists && newPos[1] >= 0.5) {
      setBlocks(prev => [...prev, { position: newPos, type: selectedBlockType, color: selectedColor }])
    }
  }, [blocks, selectedBlockType, selectedColor, setBlocks, isFirstPerson, playerPosition, playerRotation, getStackedY])
  
  const handlePlaceOnGround = useCallback((clickPosition: [number, number, number]) => {
    let position: [number, number, number]
    
    // In 3rd person, place block in front of character (stacked)
    if (!isFirstPerson) {
      const distance = 1.2 // 1 block in front
      const frontX = Math.floor(playerPosition.x - Math.sin(playerRotation) * distance) + 0.5
      const frontZ = Math.floor(playerPosition.z - Math.cos(playerRotation) * distance) + 0.5
      const stackY = getStackedY(frontX, frontZ)
      position = [frontX, stackY, frontZ]
    } else {
      // 1st person: place at clicked position on ground
      const clickX = Math.floor(clickPosition[0]) + 0.5
      const clickZ = Math.floor(clickPosition[2]) + 0.5
      const stackY = getStackedY(clickX, clickZ)
      position = [clickX, stackY, clickZ]
    }
    
    const exists = blocks.some(b => 
      Math.abs(b.position[0] - position[0]) < 0.4 && 
      Math.abs(b.position[1] - position[1]) < 0.4 && 
      Math.abs(b.position[2] - position[2]) < 0.4
    )
    
    if (!exists) {
      setBlocks(prev => [...prev, { position, type: selectedBlockType, color: selectedColor }])
    }
  }, [blocks, selectedBlockType, selectedColor, setBlocks, isFirstPerson, playerPosition, playerRotation, getStackedY])
  
  return (
    <>
      <Sky sunPosition={[100, 50, 100]} />
      
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[50, 100, 50]} 
        intensity={1.2} 
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-30, 50, -30]} intensity={0.4} />
      
      {/* Player controller - disabled in free view mode */}
      {!isFreeView && (
        <PlayerController 
          isFirstPerson={isFirstPerson}
          playerPosition={playerPosition}
          setPlayerPosition={setPlayerPosition}
          playerRotation={playerRotation}
          setPlayerRotation={setPlayerRotation}
          isWalking={isWalking}
          setIsWalking={setIsWalking}
          isLocked={isLocked}
          blocks={blocks}
          isMobile={isMobile}
          joystickRef={joystickRef}
          mobileJump={mobileJump}
          setMobileJump={setMobileJump}
        />
      )}
      
      <Ground size={64} onPlaceBlock={handlePlaceOnGround} />
      
      {/* 원본 클레이 오브젝트 렌더링 */}
      <ClayRenderer clayObjects={clayObjects} />
      
      {/* 3인칭일 때만 캐릭터 표시 */}
      {!isFirstPerson && isLocked && (
        <MinecraftCharacter 
          position={playerPosition}
          rotation={playerRotation}
          isWalking={isWalking}
        />
      )}
      
      {/* 사용자 배치 블록 */}
      {blocks.map((block, index) => (
        <VoxelBlock
          key={`${block.position.join(',')}-${index}`}
          position={block.position}
          type={block.type}
          color={block.color}
          onRemove={() => handleRemoveBlock(index)}
          onPlace={(normal) => handlePlaceBlock(block.position, normal)}
        />
      ))}
      
      <fog attach="fog" args={['#87CEEB', 40, 100]} />
    </>
  )
}

export default function MinecraftView({ clayObjects, projectName, backgroundColor }: MinecraftViewProps) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [selectedColor, setSelectedColor] = useState<string>(BLOCK_COLORS[0])
  const [selectedBlockType] = useState<BlockType>('stone')
  const [isLocked, setIsLocked] = useState(false)
  // viewMode: 'first' = 1인칭, 'third' = 3인칭, 'free' = 자유시점
  const [viewMode, setViewMode] = useState<'first' | 'third' | 'free'>('first')
  const [playerPosition, setPlayerPosition] = useState(new THREE.Vector3(0, 0, 10))
  const [playerRotation, setPlayerRotation] = useState(0)
  const [isWalking, setIsWalking] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHelp, setShowHelp] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isMobileChecked, setIsMobileChecked] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // For backward compatibility
  const isFirstPerson = viewMode === 'first'
  const isFreeView = viewMode === 'free'
  
  // Mobile joystick state
  const joystickRef = useRef({ x: 0, y: 0, active: false })
  const touchStartRef = useRef<{ x: number, y: number } | null>(null)
  
  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0)
      setIsMobileChecked(true)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // V key to cycle view mode (desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyV') {
        setViewMode(prev => {
          if (prev === 'first') return 'third'
          if (prev === 'third') return 'free'
          return 'first'
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  // Pointer lock state detection (desktop)
  useEffect(() => {
    const handleLockChange = () => {
      const locked = document.pointerLockElement !== null
      setIsLocked(locked)
      if (locked) setShowHelp(false)
    }
    document.addEventListener('pointerlockchange', handleLockChange)
    return () => document.removeEventListener('pointerlockchange', handleLockChange)
  }, [])
  
  // No auto-start - user must click to start (to see controls first)
  
  // Request pointer lock on container click (desktop)
  const handleContainerClick = useCallback(() => {
    if (!isMobile && !isLocked && containerRef.current) {
      const canvas = containerRef.current.querySelector('canvas')
      if (canvas) {
        canvas.requestPointerLock()
      }
    }
  }, [isMobile, isLocked])
  
  // Mobile touch handlers for look around
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return
    const touch = e.touches[0]
    // Right half of screen for looking
    if (touch.clientX > window.innerWidth / 2) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }
  }, [isMobile])
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !touchStartRef.current) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    
    // Update rotation based on swipe
    setPlayerRotation(prev => prev - deltaX * 0.005)
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [isMobile])
  
  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null
  }, [])
  
  // Mobile joystick handlers
  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    joystickRef.current.active = true
  }, [])
  
  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    if (!joystickRef.current.active) return
    e.stopPropagation()
    const touch = e.touches[0]
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    const maxDist = 40
    let dx = touch.clientX - centerX
    let dy = touch.clientY - centerY
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist
      dy = (dy / dist) * maxDist
    }
    
    joystickRef.current.x = dx / maxDist
    joystickRef.current.y = dy / maxDist
  }, [])
  
  const handleJoystickEnd = useCallback(() => {
    joystickRef.current.active = false
    joystickRef.current.x = 0
    joystickRef.current.y = 0
  }, [])
  
  // Mobile place block
  const handleMobilePlaceBlock = useCallback(() => {
    // Place block in front of player
    const distance = 1.2
    const frontX = Math.floor(playerPosition.x - Math.sin(playerRotation) * distance) + 0.5
    const frontZ = Math.floor(playerPosition.z - Math.cos(playerRotation) * distance) + 0.5
    
    // Get stacked Y
    let maxY = 0.5
    blocks.forEach(b => {
      if (Math.abs(b.position[0] - frontX) < 0.6 && Math.abs(b.position[2] - frontZ) < 0.6) {
        maxY = Math.max(maxY, b.position[1] + 1)
      }
    })
    
    const newPos: [number, number, number] = [frontX, maxY, frontZ]
    const exists = blocks.some(b => 
      Math.abs(b.position[0] - newPos[0]) < 0.4 && 
      Math.abs(b.position[1] - newPos[1]) < 0.4 && 
      Math.abs(b.position[2] - newPos[2]) < 0.4
    )
    
    if (!exists) {
      setBlocks(prev => [...prev, { position: newPos, type: selectedBlockType, color: selectedColor }])
    }
  }, [playerPosition, playerRotation, blocks, selectedBlockType, selectedColor])
  
  // Mobile remove block
  const handleMobileRemoveBlock = useCallback(() => {
    // Remove nearest block in front of player
    const distance = 1.5
    const frontX = playerPosition.x - Math.sin(playerRotation) * distance
    const frontZ = playerPosition.z - Math.cos(playerRotation) * distance
    
    let nearestIndex = -1
    let nearestDist = Infinity
    
    blocks.forEach((b, i) => {
      const dx = b.position[0] - frontX
      const dz = b.position[2] - frontZ
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < nearestDist && dist < 2) {
        nearestDist = dist
        nearestIndex = i
      }
    })
    
    if (nearestIndex >= 0) {
      setBlocks(prev => prev.filter((_, i) => i !== nearestIndex))
    }
  }, [playerPosition, playerRotation, blocks])
  
  // Mobile jump
  const [mobileJump, setMobileJump] = useState(false)
  
  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full cursor-pointer select-none" 
      style={{ backgroundColor: '#87CEEB', touchAction: 'none' }}
      onClick={handleContainerClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Canvas
        camera={{
          fov: 75,
          near: 0.1,
          far: 1000,
          position: [0, 1.6, 10]
        }}
        shadows
      >
        <MinecraftScene 
          clayObjects={clayObjects}
          blocks={blocks}
          setBlocks={setBlocks}
          selectedBlockType={selectedBlockType}
          selectedColor={selectedColor}
          isLocked={isLocked || isMobile}
          isFirstPerson={isFirstPerson}
          isFreeView={isFreeView}
          playerPosition={playerPosition}
          setPlayerPosition={setPlayerPosition}
          playerRotation={playerRotation}
          setPlayerRotation={setPlayerRotation}
          isWalking={isWalking}
          setIsWalking={setIsWalking}
          isMobile={isMobile}
          joystickRef={joystickRef}
          mobileJump={mobileJump}
          setMobileJump={setMobileJump}
        />
        
        {/* OrbitControls for free view mode */}
        {isFreeView && <OrbitControls enablePan enableZoom enableRotate />}
      </Canvas>
      
      {/* Crosshair (1st person only) */}
      {(isLocked || isMobile) && isFirstPerson && !isFreeView && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            <div className="absolute w-5 h-0.5 bg-white/70 -translate-x-1/2 -translate-y-1/2" 
                 style={{ boxShadow: '0 0 2px rgba(0,0,0,0.5)' }} />
            <div className="absolute w-0.5 h-5 bg-white/70 -translate-x-1/2 -translate-y-1/2"
                 style={{ boxShadow: '0 0 2px rgba(0,0,0,0.5)' }} />
          </div>
        </div>
      )}
      
      {/* Top left controls - Color & View (canvas top) */}
      <div className="absolute top-2 left-3 flex gap-1.5 z-20">
        {/* Native color picker with label */}
        <div className="relative">
          <label className="block cursor-pointer">
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 w-9 h-9 opacity-0 cursor-pointer"
            />
            <div 
              className="w-9 h-9 rounded-full border-2 border-white/80 shadow-md"
              style={{ backgroundColor: selectedColor }}
            />
          </label>
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] text-white font-medium px-1 bg-black/50 rounded pointer-events-none">
            color
          </span>
        </div>
        
        {/* View toggle button with label - CSS media query: mobile only */}
        <div className="relative sm:hidden">
          <button
            onPointerDown={(e) => { 
              e.stopPropagation()
              e.preventDefault()
              setViewMode(prev => {
                if (prev === 'first') return 'third'
                if (prev === 'third') return 'free'
                return 'first'
              })
            }}
            className="w-9 h-9 rounded-full bg-white/90 border-2 border-white/80 shadow-md active:scale-95 flex items-center justify-center text-gray-700 text-xs font-bold"
          >
            {viewMode === 'first' ? '1' : viewMode === 'third' ? '3' : '∞'}
          </button>
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] text-white font-medium px-1 bg-black/50 rounded">
            view
          </span>
        </div>
      </div>
      
      {/* Mobile controls - CSS media query: shown on mobile (<640px), hidden on desktop */}
      {!isFreeView && (
        <>
          {/* Left: Joystick */}
          <div
            className="sm:hidden absolute bottom-16 left-4 w-24 h-24 rounded-full bg-black/20 border-2 border-white/40 flex items-center justify-center"
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
          >
            <div 
              className="w-11 h-11 rounded-full bg-white/80 border-2 border-white shadow-md"
              style={{
                transform: `translate(${joystickRef.current.x * 24}px, ${joystickRef.current.y * 24}px)`
              }}
            />
          </div>
          
          {/* Right: Action buttons - horizontal: jump, add, del */}
          <div className="sm:hidden absolute bottom-20 right-4 flex gap-2">
            <button
              onTouchStart={(e) => { e.stopPropagation(); setMobileJump(true) }}
              onTouchEnd={() => setMobileJump(false)}
              className="w-12 h-12 rounded-full bg-white/90 border border-gray-300 text-gray-600 text-[10px] font-medium shadow active:bg-gray-100 flex items-center justify-center"
            >
              jump
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleMobilePlaceBlock() }}
              className="w-12 h-12 rounded-full bg-white/90 border border-gray-300 text-gray-600 text-[10px] font-medium shadow active:bg-gray-100 flex items-center justify-center"
            >
              add
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleMobileRemoveBlock() }}
              className="w-12 h-12 rounded-full bg-white/90 border border-gray-300 text-gray-600 text-[10px] font-medium shadow active:bg-gray-100 flex items-center justify-center"
            >
              del
            </button>
          </div>
        </>
      )}
      
      {/* PC Help Modal - CSS media query: hidden on mobile (<640px), shown on desktop */}
      {showHelp && !isLocked && (
        <div 
          className="hidden sm:flex absolute inset-0 items-center justify-center bg-black/40 z-30 cursor-pointer"
          onClick={handleContainerClick}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl p-6 max-w-sm text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Controls</h3>
            <div className="text-left text-gray-600 space-y-1.5 text-sm">
              <p><span className="font-medium text-gray-800">WASD</span> - Move</p>
              <p><span className="font-medium text-gray-800">Mouse</span> - Look around</p>
              <p><span className="font-medium text-gray-800">Space</span> - Jump</p>
              <p><span className="font-medium text-gray-800">V</span> - Toggle view (1st/3rd/free)</p>
              <p><span className="font-medium text-gray-800">Left Click</span> - Place block</p>
              <p><span className="font-medium text-gray-800">Right Click</span> - Remove block</p>
              <p><span className="font-medium text-gray-800">ESC</span> - Release mouse</p>
            </div>
            <div className="mt-5 text-sm text-gray-500">
              Click anywhere to start
            </div>
          </div>
        </div>
      )}
      
      {/* PC locked state hint - CSS media query: hidden on mobile */}
      {isLocked && (
        <div className="hidden sm:block absolute top-2 right-3 px-2 py-1 bg-black/40 rounded text-white text-xs z-20">
          ESC to exit · V to change view
        </div>
      )}
    </div>
  )
}
