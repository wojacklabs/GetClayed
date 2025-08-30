'use client'

import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
import { TrackballControls, Environment } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense, useCallback } from 'react'
import * as THREE from 'three'

interface ClayObject {
  id: string
  geometry: THREE.BufferGeometry
  position: THREE.Vector3
  color: string
}

interface DragInfo {
  originalPositions: Float32Array
  affectedVertices: Array<{
    index: number
    weight: number
    distance: number
  }>
  clickWorldPoint: THREE.Vector3
  clickLocalPoint: THREE.Vector3
  dragPlane: THREE.Plane
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
  const [isDragging, setIsDragging] = useState(false)
  const dragInfo = useRef<DragInfo | null>(null)
  const { camera, raycaster } = useThree()
  
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
  }, [clay.geometry])
  
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (tool === 'push' || tool === 'pull') {
      e.stopPropagation()
      
      if (!meshRef.current) return
      
      const geometry = meshRef.current.geometry
      const positions = geometry.attributes.position
      
      // 현재 정점 위치를 저장
      const originalPositions = new Float32Array(positions.array)
      
      // 클릭 지점
      const clickWorldPoint = e.point.clone()
      const clickLocalPoint = meshRef.current.worldToLocal(clickWorldPoint.clone())
      
      // 드래그 평면 생성
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      const dragPlane = new THREE.Plane()
      dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, clickWorldPoint)
      
      // 영향받는 정점들 찾기
      const affectedVertices: DragInfo['affectedVertices'] = []
      
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const distance = vertex.distanceTo(clickLocalPoint)
        
        if (distance <= brushSize) {
          const weight = 1 - (distance / brushSize)
          affectedVertices.push({
            index: i,
            weight: Math.pow(weight, 0.7), // 더 부드러운 falloff
            distance
          })
        }
      }
      
      // 거리순 정렬
      affectedVertices.sort((a, b) => a.distance - b.distance)
      
      if (affectedVertices.length > 0) {
        dragInfo.current = {
          originalPositions,
          affectedVertices,
          clickWorldPoint,
          clickLocalPoint,
          dragPlane
        }
        
        setIsDragging(true)
        onDeformingChange(true)
      }
    } else if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }, [tool, brushSize, currentColor, camera, onUpdate, onDeformingChange])
  
  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !dragInfo.current || !meshRef.current) return
    
    e.stopPropagation()
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    const info = dragInfo.current
    
    // 마우스 위치를 드래그 평면에 투영
    const intersectPoint = new THREE.Vector3()
    const hasIntersection = raycaster.ray.intersectPlane(info.dragPlane, intersectPoint)
    
    if (!hasIntersection) return
    
    // 드래그 벡터 계산
    const dragWorldVector = intersectPoint.clone().sub(info.clickWorldPoint)
    
    // 로컬 좌표계에서의 드래그 벡터
    const currentLocalPoint = meshRef.current.worldToLocal(intersectPoint.clone())
    const dragLocalVector = currentLocalPoint.clone().sub(info.clickLocalPoint)
    
    // 각 정점 업데이트
    for (const vertex of info.affectedVertices) {
      const originalPos = new THREE.Vector3(
        info.originalPositions[vertex.index * 3],
        info.originalPositions[vertex.index * 3 + 1],
        info.originalPositions[vertex.index * 3 + 2]
      )
      
      if (tool === 'push') {
        // 가장 가까운 정점은 마우스를 정확히 따라감
        if (vertex.distance < 0.01) {
          positions.setXYZ(vertex.index, currentLocalPoint.x, currentLocalPoint.y, currentLocalPoint.z)
        } else {
          // 다른 정점들은 가중치에 따라 이동
          const movement = dragLocalVector.clone().multiplyScalar(vertex.weight)
          const newPos = originalPos.clone().add(movement)
          positions.setXYZ(vertex.index, newPos.x, newPos.y, newPos.z)
        }
      } else if (tool === 'pull') {
        // Pull: 현재 마우스 위치로 당김
        const newPos = originalPos.clone().lerp(currentLocalPoint, vertex.weight * 0.8)
        positions.setXYZ(vertex.index, newPos.x, newPos.y, newPos.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  }, [isDragging, tool, raycaster])
  
  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      dragInfo.current = null
      onDeformingChange(false)
    }
  }, [isDragging, onDeformingChange])
  
  // 전역 이벤트 핸들러
  useEffect(() => {
    const handleGlobalUp = () => {
      handlePointerUp()
    }
    
    window.addEventListener('pointerup', handleGlobalUp)
    window.addEventListener('pointercancel', handleGlobalUp)
    
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp)
      window.removeEventListener('pointercancel', handleGlobalUp)
    }
  }, [handlePointerUp])
  
  return (
    <mesh
      ref={meshRef}
      position={clay.position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <meshPhongMaterial
        color={clay.color}
        specular={0x111111}
        shininess={50}
      />
    </mesh>
  )
}

export default function StableDragClay() {
  const [clayObject, setClayObject] = useState<ClayObject | null>(null)
  const [tool, setTool] = useState<'rotate' | 'push' | 'pull' | 'paint'>('rotate')
  const [brushSize, setBrushSize] = useState(0.8)
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [detail, setDetail] = useState(64)
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
        <h2 className="text-xl font-bold mb-4">안정적인 드래그 점토</h2>
        
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
            <div className="mb-2">
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
            <div className="text-xs text-gray-500">
              팁: 작은 브러시로 정밀하게, 큰 브러시로 부드럽게
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
          <div className="grid grid-cols-6 gap-1">
            {['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#bb8fce', '#85929e',
              '#ff9ff3', '#54a0ff', '#48dbfb', '#1dd1a1', '#feca57', '#ff6348'].map(color => (
              <button
                key={color}
                onClick={() => setCurrentColor(color)}
                className="w-10 h-10 rounded border-2 border-gray-300 hover:border-gray-500"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">점토 설정</h3>
          <div className="mb-2">
            <label className="text-xs">디테일: {detail}</label>
            <input
              type="range"
              min="32"
              max="128"
              step="16"
              value={detail}
              onChange={(e) => setDetail(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          <p className="text-xs text-gray-500">
            높은 디테일 = 더 부드러운 변형
          </p>
        </div>
        
        <div className="space-y-2">
          <button
            onClick={resetClay}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            점토 초기화
          </button>
        </div>
        
        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">🎯 문제 해결:</p>
          <p>✓ 드래그 후에도 안정적으로 작동</p>
          <p>✓ 이벤트 핸들러 최적화</p>
          <p>✓ 상태 관리 개선</p>
          <p>✓ 전역 이벤트로 안정성 향상</p>
          <p className="mt-2 font-semibold">사용법:</p>
          <p>• 클릭한 곳이 마우스를 정확히 따라감</p>
          <p>• 여러 번 반복해도 안정적으로 작동</p>
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
