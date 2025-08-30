import * as THREE from 'three'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

interface MetaballProps {
  balls: Array<{
    position: THREE.Vector3
    strength: number
    radius: number
  }>
  resolution?: number
  threshold?: number
  color?: string
}

export function MetaballMesh({ balls, resolution = 30, threshold = 1, color = '#ff6b6b' }: MetaballProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const size = resolution
    const step = 10 / size
    
    const vertices: number[] = []
    const normals: number[] = []
    
    // Simple metaball field function
    const field = (x: number, y: number, z: number) => {
      let sum = 0
      balls.forEach(ball => {
        const dx = x - ball.position.x
        const dy = y - ball.position.y
        const dz = z - ball.position.z
        const r2 = dx * dx + dy * dy + dz * dz
        if (r2 > 0) {
          sum += (ball.strength * ball.radius * ball.radius) / r2
        }
      })
      return sum
    }
    
    // Generate mesh using marching cubes algorithm (simplified)
    for (let x = -5; x < 5; x += step) {
      for (let y = -5; y < 5; y += step) {
        for (let z = -5; z < 5; z += step) {
          const value = field(x, y, z)
          
          if (value > threshold) {
            // Add a small sphere at this point (simplified visualization)
            const sphereRadius = step * 0.8
            
            // Create sphere vertices
            for (let phi = 0; phi < Math.PI; phi += Math.PI / 8) {
              for (let theta = 0; theta < 2 * Math.PI; theta += Math.PI / 8) {
                const vx = x + sphereRadius * Math.sin(phi) * Math.cos(theta)
                const vy = y + sphereRadius * Math.sin(phi) * Math.sin(theta)
                const vz = z + sphereRadius * Math.cos(phi)
                
                vertices.push(vx, vy, vz)
                
                // Simple normal calculation
                const nx = vx - x
                const ny = vy - y
                const nz = vz - z
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
                normals.push(nx / len, ny / len, nz / len)
              }
            }
          }
        }
      }
    }
    
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    
    return geo
  }, [balls, resolution, threshold])
  
  useFrame(() => {
    if (meshRef.current) {
      // Update geometry if needed
      meshRef.current.geometry = geometry
    }
  })
  
  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshPhongMaterial 
        color={color}
        specular={0x111111}
        shininess={100}
        transparent
        opacity={0.9}
      />
    </mesh>
  )
}
