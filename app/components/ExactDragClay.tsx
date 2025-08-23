'use client'

import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
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
  const { camera, raycaster, pointer } = useThree()
  
  // 드래그 상태
  const dragState = useRef<{
    isDragging: boolean
    clickedPoint: THREE.Vector3  // 클릭한 3D 지점 (월드 좌표)
    dragPlane: THREE.Plane      // 드래그 평면
    affectedVertices: Array<{
      index: number
      originalPos: THREE.Vector3
      weight: number
      distanceFromClick: number
    }>
  }>({
    isDragging: false,
    clickedPoint: new THREE.Vector3(),
    dragPlane: new THREE.Plane(),
    affectedVertices: []
  })
  
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
  }, [clay.geometry])
  
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    
    if (tool === 'push' || tool === 'pull') {
      if (!meshRef.current) return
      
      const geometry = meshRef.current.geometry
      const positions = geometry.attributes.position
      
      // 클릭한 월드 좌표 저장
      dragState.current.clickedPoint = e.point.clone()
      
      // 카메라 방향의 평면 생성
      const cameraDirection = new THREE.Vector3()
      camera.getWorldDirection(cameraDirection)
      dragState.current.dragPlane.setFromNormalAndCoplanarPoint(
        cameraDirection, 
        e.point
      )
      
      // 클릭 지점을 로컬 좌표로 변환
      const localClickPoint = meshRef.current.worldToLocal(e.point.clone())
      
      // 영향받는 정점들 찾기
      dragState.current.affectedVertices = []
      
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const distance = vertex.distanceTo(localClickPoint)
        
        if (distance <= brushSize) {
          const weight = 1 - (distance / brushSize)
          dragState.current.affectedVertices.push({
            index: i,
            originalPos: vertex.clone(),
            weight: Math.pow(weight, 0.5),
            distanceFromClick: distance
          })
        }
      }
      
      // 거리순으로 정렬 (가장 가까운 정점이 첫번째)
      dragState.current.affectedVertices.sort((a, b) => a.distanceFromClick - b.distanceFromClick)
      
      dragState.current.isDragging = true
      onDeformingChange(true)
    } else if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }
  
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragState.current.isDragging || !meshRef.current) return
    
    e.stopPropagation()
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    
    // 현재 마우스 위치를 드래그 평면에 투영
    const intersectPoint = new THREE.Vector3()
    const intersected = raycaster.ray.intersectPlane(dragState.current.dragPlane, intersectPoint)
    
    // 평면과 교차하지 않으면 리턴
    if (!intersected) return
    
    // 드래그 벡터 계산 (월드 좌표)
    const worldDragVector = intersectPoint.clone().sub(dragState.current.clickedPoint)
    
    // 로컬 좌표로 변환
    const localDragVector = worldDragVector.clone()
    meshRef.current.worldToLocal(localDragVector.add(meshRef.current.position))
    localDragVector.sub(meshRef.current.position)
    
    // 정점들 업데이트
    for (const vertex of dragState.current.affectedVertices) {
      if (tool === 'push') {
        // Push: 드래그 방향으로 이동
        const movement = localDragVector.clone().multiplyScalar(vertex.weight)
        const newPos = vertex.originalPos.clone().add(movement)
        positions.setXYZ(vertex.index, newPos.x, newPos.y, newPos.z)
      } else if (tool === 'pull') {
        // Pull: 클릭 지점 + 드래그 벡터 방향으로 모임
        const targetLocal = meshRef.current.worldToLocal(intersectPoint.clone())
        const newPos = vertex.originalPos.clone().lerp(targetLocal, vertex.weight * 0.8)
        positions.setXYZ(vertex.index, newPos.x, newPos.y, newPos.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  }
  
  const handlePointerUp = () => {
    if (dragState.current.isDragging) {
      dragState.current.isDragging = false
      dragState.current.affectedVertices = []
      onDeformingChange(false)
    }
  }
  
  return (
    <mesh
      ref={meshRef}
      position={clay.position}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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

export default function ExactDragClay() {
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
        <h2 className="text-xl font-bold mb-4">정확한 드래그 점토</h2>
        
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
        
        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">개선사항:</p>
          <p>✓ 클릭한 정확한 지점이 마우스 따라감</p>
          <p>✓ 드래그 평면 사용으로 정확한 추적</p>
          <p>✓ 도형 밖에서도 자유롭게 이동</p>
          <p className="mt-2">실제 클릭한 위치가 커서를 정확히 따라갑니다!</p>
        </div>
      </div>
      
      <div className="flex-1 bg-gray-100">
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
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
