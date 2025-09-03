import * as THREE from 'three'

/**
 * Capture a thumbnail from the current Three.js scene
 */
export async function captureSceneThumbnail(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number = 800,
  height: number = 600
): Promise<string> {
  // Store current size
  const currentSize = renderer.getSize(new THREE.Vector2())
  
  // Store current clear color and alpha
  const currentClearColor = renderer.getClearColor(new THREE.Color())
  const currentClearAlpha = renderer.getClearAlpha()
  
  // Create a render target for thumbnail with high quality settings
  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    samples: 4, // Enable multisampling for anti-aliasing
    stencilBuffer: false,
    depthBuffer: true
  })
  
  // Set renderer clear color to match scene background
  if (scene.background && scene.background instanceof THREE.Color) {
    renderer.setClearColor(scene.background, 1)
  } else {
    renderer.setClearColor(0xffffff, 1) // Default white background
  }
  
  // Render to the target
  renderer.setRenderTarget(renderTarget)
  renderer.clear() // Clear with the background color
  renderer.render(scene, camera)
  
  // Read pixels
  const pixels = new Uint8Array(width * height * 4)
  renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels)
  
  // Reset renderer
  renderer.setRenderTarget(null)
  renderer.setSize(currentSize.x, currentSize.y)
  
  // Restore original clear color
  renderer.setClearColor(currentClearColor, currentClearAlpha)
  
  // Dispose render target
  renderTarget.dispose()
  
  // Convert to canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  
  // Create ImageData from pixels (flip Y because WebGL has Y inverted)
  const imageData = ctx.createImageData(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIndex = ((height - y - 1) * width + x) * 4
      const dstIndex = (y * width + x) * 4
      imageData.data[dstIndex] = pixels[srcIndex]
      imageData.data[dstIndex + 1] = pixels[srcIndex + 1]
      imageData.data[dstIndex + 2] = pixels[srcIndex + 2]
      imageData.data[dstIndex + 3] = pixels[srcIndex + 3]
    }
  }
  
  ctx.putImageData(imageData, 0, 0)
  
  // Convert to base64
  return canvas.toDataURL('image/png')
}

/**
 * Compress image data URL to reduce size
 */
export async function compressImageDataUrl(dataUrl: string, maxWidth: number = 400, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      // Calculate new dimensions
      let width = img.width
      let height = img.height
      
      if (width > maxWidth) {
        height = (maxWidth / width) * height
        width = maxWidth
      }
      
      canvas.width = width
      canvas.height = height
      
      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)
      
      // Use PNG for better quality when quality is high
      let compressed: string
      if (quality >= 0.9) {
        compressed = canvas.toDataURL('image/png')
      } else {
        compressed = canvas.toDataURL('image/jpeg', quality)
      }
      resolve(compressed)
    }
    
    img.onerror = reject
    img.src = dataUrl
  })
}
