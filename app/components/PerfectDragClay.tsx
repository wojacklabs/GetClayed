'use client'

import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { TrackballControls, Environment } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense } from 'react'
import * as THREE from 'three'

interface ClayObject {
  id: string
  geometry: THREE.BufferGeometry
  position: THREE.Vector3
  color: string
}

interface DragAnchor {
  vertexIndex: number
  localOffset: THREE.Vector3
  affectedVertices: Array<{
    index: number
    weight: number
    originalPos: THREE.Vector3
  }>
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
  const dragAnchor = useRef<DragAnchor | null>(null)
  const { camera, gl, size } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
  }, [clay.geometry])
  
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    
    if (tool === 'push' || tool === 'pull') {
      if (!meshRef.current) return
      
      setIsDragging(true)
      onDeformingChange(true)
      
      const geometry = meshRef.current.geometry
      const positions = geometry.attributes.position
      
      // 클릭한 지점을 로컬 좌표로 변환
      const clickPoint = meshRef.current.worldToLocal(e.point.clone())
      
      // 가장 가까운 정점 찾기
      let closestVertexIndex = -1
      let minDistance = Infinity
      
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const distance = vertex.distanceTo(clickPoint)
        if (distance < minDistance) {
          minDistance = distance
          closestVertexIndex = i
        }
      }
      
      // 클릭한 정점 위치
      const closestVertex = new THREE.Vector3(
        positions.getX(closestVertexIndex),
        positions.getY(closestVertexIndex),
        positions.getZ(closestVertexIndex)
      )
      
      // 오프셋 제거 - 정점이 정확히 클릭 지점을 따라가도록
      const localOffset = new THREE.Vector3(0, 0, 0)
      
      // 영향받는 정점들 찾기
      const affectedVertices: DragAnchor['affectedVertices'] = []
      
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const distance = vertex.distanceTo(closestVertex)
        
        if (distance <= brushSize) {
          const weight = 1 - (distance / brushSize)
          affectedVertices.push({
            index: i,
            weight: Math.pow(weight, 0.5),
            originalPos: vertex.clone()
          })
        }
      }
      
      dragAnchor.current = {
        vertexIndex: closestVertexIndex,
        localOffset,
        affectedVertices
      }
    } else if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }
  
  useFrame(() => {
    if (!isDragging || !dragAnchor.current || !meshRef.current) return
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    const anchor = dragAnchor.current
    
    // 마우스의 현재 NDC 좌표 계산
    const pointer = new THREE.Vector2(
      ((gl.domElement as any)['_clientX'] / size.width) * 2 - 1,
      -((gl.domElement as any)['_clientY'] / size.height) * 2 + 1
    )
    
    // Raycaster 업데이트
    raycaster.current.setFromCamera(pointer, camera)
    
    // 원래 정점의 월드 좌표
    const originalVertex = new THREE.Vector3(
      positions.getX(anchor.vertexIndex),
      positions.getY(anchor.vertexIndex),
      positions.getZ(anchor.vertexIndex)
    )
    const worldVertex = meshRef.current.localToWorld(originalVertex.clone())
    
    // 카메라에서 정점까지의 거리
    const distance = camera.position.distanceTo(worldVertex)
    
    // Ray 방향으로 같은 거리에 있는 점 계산
    const direction = raycaster.current.ray.direction.clone()
    const targetWorldPos = camera.position.clone().add(direction.multiplyScalar(distance))
    
    // 로컬 좌표로 변환하고 오프셋 적용
    const targetLocalPos = meshRef.current.worldToLocal(targetWorldPos)
    targetLocalPos.sub(anchor.localOffset)
    
    // 메인 정점 업데이트
    if (tool === 'push') {
      // Push 모드: 메인 정점이 마우스를 정확히 따라감
      positions.setXYZ(anchor.vertexIndex, targetLocalPos.x, targetLocalPos.y, targetLocalPos.z)
      
      // 드래그 벡터 계산
      const dragVector = targetLocalPos.clone().sub(
        anchor.affectedVertices.find(v => v.index === anchor.vertexIndex)?.originalPos || new THREE.Vector3()
      )
      
      // 다른 정점들 업데이트
      for (const vertex of anchor.affectedVertices) {
        if (vertex.index !== anchor.vertexIndex) {
          const scaledDrag = dragVector.clone().multiplyScalar(vertex.weight * vertex.weight)
          const newPos = vertex.originalPos.clone().add(scaledDrag)
          positions.setXYZ(vertex.index, newPos.x, newPos.y, newPos.z)
        }
      }
    } else if (tool === 'pull') {
      // Pull 모드: 정점들이 타겟 위치로 모임
      for (const vertex of anchor.affectedVertices) {
        const newPos = vertex.originalPos.clone().lerp(targetLocalPos, vertex.weight * 0.8)
        positions.setXYZ(vertex.index, newPos.x, newPos.y, newPos.z)
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  })
  
  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false)
      dragAnchor.current = null
      onDeformingChange(false)
    }
  }
  
  // 마우스 위치 추적
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect: DOMRect = gl.domElement.getBoundingClientRect()
      ;(gl.domElement as any)['_clientX'] = e.clientX - rect.left
      ;(gl.domElement as any)['_clientY'] = e.clientY - rect.top
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handlePointerUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [gl, isDragging])
  
  return (
    <mesh
      ref={meshRef}
      position={clay.position}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <meshPhongMaterial
        color={clay.color}
        specular={0x111111}
        shininess={50}
      />
    </mesh>
  )
}

export default function PerfectDragClay() {
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
        <h2 className="text-xl font-bold mb-4">완벽한 드래그 점토</h2>
        
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
          <p className="font-semibold mb-1">핵심 특징:</p>
          <p>✓ 클릭한 정점이 마우스를 정확히 추적</p>
          <p>✓ 도형 밖에서도 자유롭게 이동</p>
          <p>✓ 카메라 거리 기반 3D 계산</p>
          <p className="mt-2">클릭한 지점이 마우스 커서를 정확히 따라갑니다!</p>
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
