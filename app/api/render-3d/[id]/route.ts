// Server-side 3D rendering service
// This runs in Node.js runtime (not Edge) to use canvas and three.js
import { NextRequest, NextResponse } from 'next/server'
import * as THREE from 'three'
import { createCanvas } from 'canvas'

export const runtime = 'nodejs' // Important: use Node.js runtime, not Edge

interface ClayObject {
  id: string
  type: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number } | number
  color: string
  geometry?: any
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Fetch project data from Irys
    const IRYS_DATA_URL = `https://uploader.irys.xyz/tx/${id}/data`
    const response = await fetch(IRYS_DATA_URL)
    
    if (!response.ok) {
      throw new Error('Failed to fetch project data')
    }
    
    const projectData = await response.json()
    
    // Check if it's a chunk manifest - we'll skip 3D rendering for large projects
    if (projectData.chunkSetId && projectData.totalChunks) {
      // For chunked projects, return a simple placeholder
      return new NextResponse('Chunked projects not supported yet', { status: 501 })
    }
    
    // Get clay objects - correct field name is 'clays'
    const clayObjects: ClayObject[] = projectData.clays || []
    
    if (!clayObjects || clayObjects.length === 0) {
      return new NextResponse('No objects found', { status: 404 })
    }
    
    // Create canvas
    const width = 1200
    const height = 630
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    
    // Fill background
    context.fillStyle = projectData.backgroundColor || '#f9fafb'
    context.fillRect(0, 0, width, height)
    
    // Create Three.js scene
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.z = 15
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)
    
    // Add clay objects to scene
    clayObjects.forEach((clay) => {
      try {
        let geometry: THREE.BufferGeometry
        
        // Create geometry based on type
        if (clay.type === 'sphere' || !clay.type) {
          geometry = new THREE.SphereGeometry(1, 32, 32)
        } else if (clay.type === 'box') {
          geometry = new THREE.BoxGeometry(1, 1, 1)
        } else if (clay.type === 'cylinder') {
          geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
        } else if (clay.geometry) {
          // Use custom geometry if available
          geometry = new THREE.BufferGeometry()
          if (clay.geometry.attributes) {
            Object.entries(clay.geometry.attributes).forEach(([key, value]: [string, any]) => {
              geometry.setAttribute(key, new THREE.BufferAttribute(new Float32Array(value.array), value.itemSize))
            })
          }
        } else {
          geometry = new THREE.SphereGeometry(1, 32, 32)
        }
        
        const material = new THREE.MeshPhongMaterial({
          color: clay.color || '#B8C5D6',
          shininess: 30,
        })
        
        const mesh = new THREE.Mesh(geometry, material)
        
        // Set position
        mesh.position.set(
          clay.position?.x || 0,
          clay.position?.y || 0,
          clay.position?.z || 0
        )
        
        // Set rotation
        if (clay.rotation) {
          mesh.rotation.set(
            clay.rotation.x || 0,
            clay.rotation.y || 0,
            clay.rotation.z || 0
          )
        }
        
        // Set scale
        if (typeof clay.scale === 'number') {
          mesh.scale.setScalar(clay.scale)
        } else if (clay.scale) {
          mesh.scale.set(
            clay.scale.x || 1,
            clay.scale.y || 1,
            clay.scale.z || 1
          )
        }
        
        scene.add(mesh)
      } catch (error) {
        console.error('Error adding clay object to scene:', error)
      }
    })
    
    // TODO: Implement actual 3D rendering with node-canvas
    // For now, return a message
    return new NextResponse(
      JSON.stringify({
        message: 'Server-side 3D rendering is complex. Will use fallback approach.',
        objectCount: clayObjects.length,
        projectName: projectData.name || 'Untitled'
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    )
    
  } catch (error) {
    console.error('Error rendering 3D:', error)
    return new NextResponse('Error rendering 3D', { status: 500 })
  }
}

