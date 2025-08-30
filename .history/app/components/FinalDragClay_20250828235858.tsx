'use client'

import { Canvas, useThree, ThreeEvent, extend } from '@react-three/fiber'
import { TrackballControls, Environment } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense } from 'react'
import * as THREE from 'three'

// Three.js 확장
extend(THREE)

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
  const { camera, raycaster, pointer, gl, size } = useThree()
  
  // 드래그 상태 관리
  const dragStateRef = useRef({
    isDragging: false,
    clickPoint: new THREE.Vector3(),
    dragPlane: new THREE.Plane(),
    originalPositions: null as Float32Array | null,
    affectedVertices: [] as Array<{
      index: number
      weight: number
      originalPos: THREE.Vector3
    }>,
    closestVertexIndex: -1,
    clickOffset: new THREE.Vector3()
  })
  
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
  }, [clay.geometry])
  
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (tool === 'push' || tool === 'pull') {
      e.stopPropagation()
      
      if (!meshRef.current) return
      
      const geometry = meshRef.current.geometry
      const positions = geometry.attributes.position
      
      // 현재 정점 위치 저장
      dragStateRef.current.originalPositions = new Float32Array(positions.array)
      
      // 클릭 지점 (월드 좌표)
      const clickWorldPoint = e.point.clone()
      dragStateRef.current.clickPoint = clickWorldPoint
      
      // 카메라 방향의 드래그 평면 생성
      const cameraDir = new THREE.Vector3()
      camera.getWorldDirection(cameraDir)
      dragStateRef.current.dragPlane.setFromNormalAndCoplanarPoint(cameraDir, clickWorldPoint)
      
      // 로컬 좌표로 변환
      const clickLocalPoint = meshRef.current.worldToLocal(clickWorldPoint.clone())
      
      // 영향받는 정점들과 가장 가까운 정점 찾기
      dragStateRef.current.affectedVertices = []
      let minDistance = Infinity
      dragStateRef.current.closestVertexIndex = -1
      
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const distance = vertex.distanceTo(clickLocalPoint)
        
        // 가장 가까운 정점 찾기
        if (distance < minDistance) {
          minDistance = distance
          dragStateRef.current.closestVertexIndex = i
        }
        
        // 브러시 범위 내의 정점들
        if (distance <= brushSize) {
          const weight = 1 - (distance / brushSize)
          dragStateRef.current.affectedVertices.push({
            index: i,
            weight: Math.pow(weight, 0.5),
            originalPos: vertex.clone()
          })
        }
      }
      
      // 클릭 지점과 가장 가까운 정점 사이의 오프셋
      if (dragStateRef.current.closestVertexIndex >= 0) {
        const closestVertex = new THREE.Vector3(
          positions.getX(dragStateRef.current.closestVertexIndex),
          positions.getY(dragStateRef.current.closestVertexIndex),
          positions.getZ(dragStateRef.current.closestVertexIndex)
        )
        dragStateRef.current.clickOffset = clickLocalPoint.clone().sub(closestVertex)
      }
      
      dragStateRef.current.isDragging = true
      onDeformingChange(true)
    } else if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }
  
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragStateRef.current.isDragging || !meshRef.current) return
    
    e.stopPropagation()
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    const state = dragStateRef.current
    
    // 마우스 위치를 드래그 평면에 투영
    const mousePoint = new THREE.Vector3()
    const hasIntersection = raycaster.ray.intersectPlane(state.dragPlane, mousePoint)
    
    if (!hasIntersection) return
    
    // 마우스의 로컬 좌표
    const mouseLocalPoint = meshRef.current.worldToLocal(mousePoint.clone())
    
    // 드래그 벡터 계산
    const dragVector = mouseLocalPoint.clone().sub(
      meshRef.current.worldToLocal(state.clickPoint.clone())
    )
    
    // 각 정점 업데이트
    for (const vertex of state.affectedVertices) {
      if (tool === 'push') {
        // 가장 가까운 정점인 경우
        if (vertex.index === state.closestVertexIndex) {
          // 마우스 위치 - 클릭 오프셋 = 정점이 가야 할 위치
          const targetPos = mouseLocalPoint.clone().sub(state.clickOffset)
          positions.setXYZ(vertex.index, targetPos.x, targetPos.y, targetPos.z)
        } else {
          // 다른 정점들은 드래그 벡터에 가중치 적용
          const movement = dragVector.clone().multiplyScalar(vertex.weight)
          const newPos = vertex.originalPos.clone().add(movement)
          positions.setXYZ(vertex.index, newPos.x, newPos.y, newPos.z)
        }
      } else if (tool === 'pull') {
        // Pull 모드: 마우스 위치로 당기기
        const newPos = vertex.originalPos.clone().lerp(mouseLocalPoint, vertex.weight * 0.8)
        positions.setXYZ(vertex.index, newPos.x, newPos.y, newPos.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  }
  
  const handlePointerUp = () => {
    if (dragStateRef.current.isDragging) {
      dragStateRef.current.isDragging = false
      dragStateRef.current.affectedVertices = []
      dragStateRef.current.originalPositions = null
      onDeformingChange(false)
    }
  }
  
  // 전역 이벤트로 안정성 확보
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
  }, [])
  
  return (
    <mesh
      ref={meshRef}
      position={clay.position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <meshPhongMaterial
        color={clay.color}
        specular={0x111111}
        shininess={50}
      />
    </mesh>
  )
}

export default function FinalDragClay() {
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
        <h2 className="text-xl font-bold mb-4">최종 완성 드래그 점토</h2>
        
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
          <div>
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
        </div>
        
        <div className="space-y-2">
          <button
            onClick={resetClay}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            점토 초기화
          </button>
        </div>
        
        <div className="text-xs text-gray-500 mt-4 p-3 bg-blue-50 rounded">
          <p className="font-semibold mb-1">✨ 핵심 기능:</p>
          <p>• 클릭한 지점이 마우스를 정확히 추적</p>
          <p>• 클릭 오프셋 보정으로 자연스러운 드래그</p>
          <p>• 안정적인 상태 관리로 반복 작업 가능</p>
          <p>• useRef로 렌더링 최적화</p>
          <p className="mt-2 text-blue-600 font-semibold">
            🎯 클릭한 곳이 정확히 마우스를 따라갑니다!
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
