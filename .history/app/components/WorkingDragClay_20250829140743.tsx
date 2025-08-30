'use client'

import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { TrackballControls, Environment } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense } from 'react'
import * as THREE from 'three'

interface ClayObject {
  id: string
  geometry: THREE.BufferGeometry
  position: THREE.Vector3
  color: string
}

function Clay({ clay, tool, brushSize, currentColor, onUpdate, onDeformingChange }: {
  clay: ClayObject
  tool: string
  brushSize: number
  currentColor: string
  onUpdate: (clay: ClayObject) => void
  onDeformingChange: (isDeforming: boolean) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera, raycaster, gl, size } = useThree()
  
  // 드래그 상태
  const dragState = useRef({
    active: false,
    mousePos: new THREE.Vector2(),
    targetVertex: -1,
    vertices: [] as Array<{
      index: number
      weight: number
      startPos: THREE.Vector3
    }>
  })
  
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
  }, [clay.geometry])
  
  // Canvas 이벤트 처리
  useEffect(() => {
    const canvas = gl.domElement
    
    const updateMousePosition = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      dragState.current.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      dragState.current.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }
    
    const handleMouseDown = (e: MouseEvent) => {
      if (tool !== 'push' && tool !== 'pull') return
      if (!meshRef.current) return
      
      updateMousePosition(e)
      
      // Raycaster 업데이트 - 양면 검사 활성화
      raycaster.setFromCamera(dragState.current.mousePos, camera)
      
      // Raycaster가 뒷면도 감지하도록 설정
      let originalSide = THREE.FrontSide
      if (!Array.isArray(meshRef.current.material)) {
        originalSide = meshRef.current.material.side || THREE.FrontSide
        meshRef.current.material.side = THREE.DoubleSide
      }
      
      const intersects = raycaster.intersectObject(meshRef.current, false)
      
      // 원래 설정으로 복원
      if (!Array.isArray(meshRef.current.material)) {
        meshRef.current.material.side = originalSide
      }
      
      if (intersects.length === 0) return
      
      const geometry = meshRef.current.geometry
      const positions = geometry.attributes.position
      
      // 교차점을 로컬 좌표로 변환
      const hitPoint = meshRef.current.worldToLocal(intersects[0].point.clone())
      
      // 가장 가까운 정점 찾기 (현재 변형된 상태에서)
      let closestIdx = -1
      let closestDist = Infinity
      
      // Face의 정점들을 우선 확인
      if (intersects[0].face) {
        const face = intersects[0].face
        const indices = [face.a, face.b, face.c]
        
        for (const idx of indices) {
          const v = new THREE.Vector3(
            positions.getX(idx),
            positions.getY(idx),
            positions.getZ(idx)
          )
          const dist = v.distanceTo(hitPoint)
          if (dist < closestDist) {
            closestDist = dist
            closestIdx = idx
          }
        }
      }
      
      // 브러시 범위 내의 모든 정점 찾기
      dragState.current.vertices = []
      const centerPos = new THREE.Vector3(
        positions.getX(closestIdx),
        positions.getY(closestIdx),
        positions.getZ(closestIdx)
      )
      
      for (let i = 0; i < positions.count; i++) {
        const pos = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const dist = pos.distanceTo(centerPos)
        if (dist <= brushSize) {
          const weight = 1 - (dist / brushSize)
          dragState.current.vertices.push({
            index: i,
            weight: Math.pow(weight, 0.6),
            startPos: pos.clone()
          })
        }
      }
      
      dragState.current.active = true
      dragState.current.targetVertex = closestIdx
      onDeformingChange(true)
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.current.active) {
        updateMousePosition(e)
      }
    }
    
    const handleMouseUp = () => {
      if (dragState.current.active) {
        dragState.current.active = false
        dragState.current.targetVertex = -1
        dragState.current.vertices = []
        onDeformingChange(false)
      }
    }
    
    // 이벤트 등록
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseUp)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseUp)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [tool, brushSize, camera, raycaster, gl, onDeformingChange])
  
  // 매 프레임마다 드래그 업데이트
  useFrame(() => {
    if (!dragState.current.active || !meshRef.current) return
    if (dragState.current.targetVertex === -1) return
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    
    // 현재 마우스 위치에서 ray 생성
    raycaster.setFromCamera(dragState.current.mousePos, camera)
    
    // 타겟 정점의 현재 월드 위치
    const targetWorldPos = new THREE.Vector3(
      positions.getX(dragState.current.targetVertex),
      positions.getY(dragState.current.targetVertex),
      positions.getZ(dragState.current.targetVertex)
    )
    meshRef.current.localToWorld(targetWorldPos)
    
    // 카메라 방향의 평면 생성
    const cameraDir = new THREE.Vector3()
    camera.getWorldDirection(cameraDir)
    const plane = new THREE.Plane()
    plane.setFromNormalAndCoplanarPoint(cameraDir, targetWorldPos)
    
    // Ray와 평면의 교차점
    const intersection = new THREE.Vector3()
    const hasIntersection = raycaster.ray.intersectPlane(plane, intersection)
    
    if (!hasIntersection) return
    
    // 교차점을 로컬 좌표로 변환
    const targetLocal = meshRef.current.worldToLocal(intersection)
    
    // 정점들 업데이트
    for (const v of dragState.current.vertices) {
      if (tool === 'push') {
        if (v.index === dragState.current.targetVertex) {
          // 메인 정점은 마우스를 정확히 따라감
          positions.setXYZ(v.index, targetLocal.x, targetLocal.y, targetLocal.z)
        } else {
          // 다른 정점들은 가중치에 따라 이동
          const mainStartPos = dragState.current.vertices.find(
            vertex => vertex.index === dragState.current.targetVertex
          )?.startPos
          
          if (mainStartPos) {
            const delta = targetLocal.clone().sub(mainStartPos)
            const movement = delta.multiplyScalar(v.weight)
            const newPos = v.startPos.clone().add(movement)
            positions.setXYZ(v.index, newPos.x, newPos.y, newPos.z)
          }
        }
      } else if (tool === 'pull') {
        // Pull 모드: 타겟 위치로 당기기
        const newPos = v.startPos.clone().lerp(targetLocal, v.weight * 0.7)
        positions.setXYZ(v.index, newPos.x, newPos.y, newPos.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    
    // 경계 박스 업데이트 - 변형된 형태에 맞게
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  })
  
  // Paint 처리
  const handleClick = () => {
    if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }
  
  return (
    <mesh
      ref={meshRef}
      position={clay.position}
      onClick={handleClick}
    >
      <meshPhongMaterial
        color={clay.color}
        specular={0x111111}
        shininess={50}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default function WorkingDragClay() {
  const [clayObject, setClayObject] = useState<ClayObject | null>(null)
  const [tool, setTool] = useState<'rotate' | 'push' | 'pull' | 'paint'>('rotate')
  const [brushSize, setBrushSize] = useState(0.8)
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [detail, setDetail] = useState(48)
  const [isDeforming, setIsDeforming] = useState(false)
  
  useEffect(() => {
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    setClayObject({
      id: 'main-clay',
      geometry: geometry,
      position: new THREE.Vector3(0, 0, 0),
      color: currentColor
    })
  }, [detail])
  
  const updateClay = (updatedClay: ClayObject) => {
    setClayObject(updatedClay)
  }
  
  const resetClay = () => {
    const geometry = new THREE.SphereGeometry(2, detail, detail)
    setClayObject({
      id: 'main-clay',
      geometry: geometry,
      position: new THREE.Vector3(0, 0, 0),
      color: currentColor
    })
  }
  
  return (
    <div className="w-full h-full flex">
      <div className="w-72 bg-white shadow-lg p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">작동하는 드래그 점토</h2>
        
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">도구</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTool('rotate')}
              className={`p-3 rounded text-sm ${
                tool === 'rotate' ? 'bg-orange-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              화면 회전
            </button>
            <button
              onClick={() => setTool('push')}
              className={`p-3 rounded text-sm ${
                tool === 'push' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              밀고 당기기
            </button>
            <button
              onClick={() => setTool('pull')}
              className={`p-3 rounded text-sm ${
                tool === 'pull' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              모으기
            </button>
            <button
              onClick={() => setTool('paint')}
              className={`p-3 rounded text-sm ${
                tool === 'paint' ? 'bg-purple-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              색칠하기
            </button>
          </div>
        </div>
        
        {(tool === 'push' || tool === 'pull') && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">브러시 설정</h3>
            <div>
              <label className="text-xs">크기: {brushSize.toFixed(2)}</label>
              <input
                type="range"
                min="0.3"
                max="2"
                step="0.1"
                value={brushSize}
                onChange={(e) => setBrushSize(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}
        
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">색상</h3>
          <div className="flex items-center space-x-2 mb-2">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setCurrentColor(e.target.value)}
              className="w-full h-10 rounded cursor-pointer"
            />
            <span className="text-xs">{currentColor}</span>
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">점토 설정</h3>
          <div>
            <label className="text-xs">디테일: {detail}</label>
            <input
              type="range"
              min="32"
              max="96"
              step="16"
              value={detail}
              onChange={(e) => setDetail(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        
        <button
          onClick={resetClay}
          className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600 mb-4"
        >
          점토 초기화
        </button>
        
        <div className="text-xs text-gray-500 p-3 bg-blue-50 rounded">
          <p className="font-semibold mb-1">🎯 핵심 개선:</p>
          <p>• Face 기반 정점 찾기로 정확도 향상</p>
          <p>• 변형된 geometry에서도 작동</p>
          <p>• 시작 위치 기준 상대적 이동</p>
          <p>• 안정적인 이벤트 처리</p>
          <p className="mt-2 text-blue-700 font-semibold">
            당긴 부분도 다시 당길 수 있습니다!
          </p>
        </div>
      </div>
      
      <div className="flex-1 bg-gray-100">
        <Canvas 
          camera={{ position: [5, 5, 5], fov: 50 }}
          style={{ touchAction: 'none' }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 5]} intensity={0.8} />
            <directionalLight position={[-10, -10, -5]} intensity={0.3} />
            
            <TrackballControls 
              enabled={tool === 'rotate' && !isDeforming}
              rotateSpeed={1.5}
              zoomSpeed={1.2}
              noPan={true}
              minDistance={3}
              maxDistance={20}
              staticMoving={false}
              dynamicDampingFactor={0.1}
            />
            
            {clayObject && (
              <Clay
                clay={clayObject}
                tool={tool}
                brushSize={brushSize}
                currentColor={currentColor}
                onUpdate={updateClay}
                onDeformingChange={setIsDeforming}
              />
            )}
            
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}
