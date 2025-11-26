import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const baseUrl = request.nextUrl.origin;
  
  // HTML page that renders the 3D model
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1200,height=800">
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #f9fafb;
    }
    #canvas-container {
      width: 1200px;
      height: 800px;
      position: relative;
    }
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: system-ui;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div id="canvas-container">
    <div id="loading">Loading 3D model...</div>
    <canvas id="three-canvas"></canvas>
  </div>
  
  <script type="module">
    import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
    
    // Initialize scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf9fafb);
    
    const camera = new THREE.PerspectiveCamera(75, 1200/800, 0.1, 1000);
    camera.position.z = 15;
    
    const renderer = new THREE.WebGLRenderer({ 
      canvas: document.getElementById('three-canvas'),
      antialias: true 
    });
    renderer.setSize(1200, 800);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // Load project data
    async function loadProject() {
      try {
        const response = await fetch('https://uploader.irys.xyz/tx/${id}/data');
        const projectData = await response.json();
        
        // Hide loading
        document.getElementById('loading').style.display = 'none';
        
        // Set background color if available
        if (projectData.backgroundColor) {
          scene.background = new THREE.Color(projectData.backgroundColor);
        }
        
        // Restore clay objects - correct field name is 'clays'
        if (projectData.clays) {
          projectData.clays.forEach(clayData => {
            let geometry;
            
            // Create geometry based on type
            switch(clayData.type) {
              case 'sphere':
                geometry = new THREE.SphereGeometry(1, 32, 32);
                break;
              case 'box':
                geometry = new THREE.BoxGeometry(2, 2, 2);
                break;
              case 'cylinder':
                geometry = new THREE.CylinderGeometry(1, 1, 2, 32);
                break;
              case 'cone':
                geometry = new THREE.ConeGeometry(1, 2, 32);
                break;
              case 'torus':
                geometry = new THREE.TorusGeometry(1, 0.4, 16, 100);
                break;
              default:
                geometry = new THREE.SphereGeometry(1, 32, 32);
            }
            
            const material = new THREE.MeshPhongMaterial({ 
              color: clayData.color || 0x3b82f6,
              side: THREE.DoubleSide 
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Set transform
            if (clayData.position) {
              mesh.position.set(clayData.position.x, clayData.position.y, clayData.position.z);
            }
            if (clayData.rotation) {
              mesh.rotation.set(clayData.rotation.x, clayData.rotation.y, clayData.rotation.z);
            }
            if (clayData.scale) {
              if (typeof clayData.scale === 'number') {
                mesh.scale.setScalar(clayData.scale);
              } else {
                mesh.scale.set(clayData.scale.x, clayData.scale.y, clayData.scale.z);
              }
            }
            
            scene.add(mesh);
          });
        } else {
          // Fallback: show a default clay ball
          const geometry = new THREE.SphereGeometry(3, 32, 32);
          const material = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });
          const sphere = new THREE.Mesh(geometry, material);
          scene.add(sphere);
        }
        
        // Render once
        renderer.render(scene, camera);
        
        // Only signal completion if we're in an iframe context
        try {
          if (window.parent && window.parent !== window && window.location.origin !== 'null') {
        window.parent.postMessage({ type: 'render-complete' }, '*');
          }
        } catch (e) {
          // Silently fail if postMessage is not allowed
          console.log('PostMessage not available or not needed');
        }
        
      } catch (error) {
        console.error('Failed to load project:', error);
        document.getElementById('loading').textContent = 'Failed to load project';
      }
    }
    
    loadProject();
  </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store',
    },
  });
}
