/**
 * AnimatedClayLogo 프레임 생성 스크립트
 * Three.js 애니메이션을 여러 프레임으로 캡처하여 PNG로 저장
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FRAME_COUNT = 30; // 30 프레임
const FRAME_RATE = 10; // 10 FPS
const OUTPUT_DIR = path.join(__dirname, '..', 'temp_frames');
const SIZE = 512; // 512x512px

// HTML 페이지 생성 (AnimatedClayLogo를 렌더링)
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${SIZE}px;
      height: ${SIZE}px;
    }
    canvas { 
      width: ${SIZE}px !important; 
      height: ${SIZE}px !important; 
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
      }
    }
  </script>
  <script type="module">
    import * as THREE from 'three';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.z = 2;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(${SIZE}, ${SIZE});
    renderer.setClearColor(0x000000, 0);
    document.body.appendChild(renderer.domElement);

    // AnimatedClayLogo 로직 복제
    const geometry = new THREE.SphereGeometry(0.65, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xB8C5D6,
      roughness: 0.4,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // 원본 위치 저장
    const positionAttribute = geometry.getAttribute('position');
    const originalPositions = new Float32Array(positionAttribute.array);

    let startTime = Date.now();
    
    function animate() {
      const time = (Date.now() - startTime) / 1000;
      
      // 회전
      mesh.rotation.y += 0.01;
      
      // 유기적 변형
      const vertex = new THREE.Vector3();
      const originalVertex = new THREE.Vector3();
      
      for (let i = 0; i < positionAttribute.count; i++) {
        originalVertex.fromArray(originalPositions, i * 3);
        
        const wave1 = Math.sin(originalVertex.x * 3 + time * 1.5) * 0.02;
        const wave2 = Math.sin(originalVertex.y * 4 + time * 1.8) * 0.015;
        const wave3 = Math.sin(originalVertex.z * 2 + time * 1.2) * 0.025;
        
        vertex.x = originalVertex.x + wave2 + wave3;
        vertex.y = originalVertex.y + wave1 + wave3;
        vertex.z = originalVertex.z + wave1 + wave2;
        
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      
      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();
      
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    
    animate();

    // 프레임 준비 완료 신호
    window.animationReady = true;
  </script>
</body>
</html>
`;

async function generateFrames() {
  console.log('🎨 AnimatedClayLogo 프레임 생성 시작...');
  
  // 출력 디렉토리 생성
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 브라우저 시작
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: SIZE, height: SIZE });
  
  // HTML 로드
  await page.setContent(HTML_TEMPLATE);
  
  // 애니메이션 준비 대기
  await page.waitForFunction('window.animationReady === true');
  await new Promise(resolve => setTimeout(resolve, 500)); // 추가 대기
  
  console.log('✓ 애니메이션 준비 완료');
  
  // 프레임 캡처
  for (let i = 0; i < FRAME_COUNT; i++) {
    const filename = path.join(OUTPUT_DIR, `frame_${String(i).padStart(3, '0')}.png`);
    
    await page.screenshot({
      path: filename,
      omitBackground: true,
      type: 'png'
    });
    
    console.log(`✓ 프레임 ${i + 1}/${FRAME_COUNT} 저장: ${filename}`);
    
    // 다음 프레임까지 대기
    await new Promise(resolve => setTimeout(resolve, 1000 / FRAME_RATE));
  }
  
  await browser.close();
  
  console.log(`\n✅ 모든 프레임 생성 완료!`);
  console.log(`📁 위치: ${OUTPUT_DIR}`);
  console.log(`\n다음 단계: APNG 생성`);
  console.log(`npm run generate-apng`);
}

generateFrames().catch(console.error);

