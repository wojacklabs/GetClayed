'use client'

import { Canvas, useThree, ThreeEvent, useFrame } from '@react-three/fiber'
import { TrackballControls, Environment, Html } from '@react-three/drei'
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
  const { camera, raycaster, pointer, gl } = useThree()
  const [debugInfo, setDebugInfo] = useState<string>('')
  
  // 단순하고 직접적인 드래그 상태
  const dragRef = useRef({
    isActive: false,
    selectedVertex: -1,
    originalGeometry: null as Float32Array | null,
    startPoint: new THREE.Vector3(),
    affectedVertices: [] as Array<{ idx: number, weight: number, originalPos: THREE.Vector3 }>
  })
  
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
  }, [clay.geometry])
  
  // 매 프레임마다 드래그 처리
  useFrame(() => {
    if (!dragRef.current.isActive || !meshRef.current || dragRef.current.selectedVertex === -1) return
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    
    // Raycaster로 현재 마우스 위치 계산
    raycaster.setFromCamera(pointer, camera)
    
    // 메시와의 교차점 찾기
    const intersects = raycaster.intersectObject(meshRef.current)
    
    let targetPoint: THREE.Vector3
    
    if (intersects.length > 0) {
      // 메시와 교차하면 그 점 사용
      targetPoint = meshRef.current.worldToLocal(intersects[0].point.clone())
    } else {
      // 교차하지 않으면 카메라에서 일정 거리의 점 사용
      const cameraPos = camera.position.clone()
      const direction = raycaster.ray.direction.clone()
      const distance = cameraPos.distanceTo(meshRef.current.position)
      const worldPoint = cameraPos.add(direction.multiplyScalar(distance))
      targetPoint = meshRef.current.worldToLocal(worldPoint)
    }
    
    // 선택된 정점을 타겟 위치로 이동
    if (tool === 'push') {
      positions.setXYZ(dragRef.current.selectedVertex, targetPoint.x, targetPoint.y, targetPoint.z)
      
      // 주변 정점들도 함께 이동
      for (const vertex of dragRef.current.affectedVertices) {
        if (vertex.idx !== dragRef.current.selectedVertex) {
          const dragVector = new THREE.Vector3(
            targetPoint.x - dragRef.current.startPoint.x,
            targetPoint.y - dragRef.current.startPoint.y,
            targetPoint.z - dragRef.current.startPoint.z
          )
          
          const scaledDrag = dragVector.multiplyScalar(vertex.weight)
          const newPos = vertex.originalPos.clone().add(scaledDrag)
          positions.setXYZ(vertex.idx, newPos.x, newPos.y, newPos.z)
        }
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
    
    setDebugInfo(`Dragging vertex ${dragRef.current.selectedVertex} to ${targetPoint.x.toFixed(2)}, ${targetPoint.y.toFixed(2)}, ${targetPoint.z.toFixed(2)}`)
  })
  
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    // 이전 드래그 상태 강제 리셋
    if (dragRef.current.isActive) {
      handlePointerUp()
    }
    
    if (tool === 'push' || tool === 'pull') {
      e.stopPropagation()
      
      if (!meshRef.current) return
      
      setDebugInfo('Click detected')
      
      const geometry = meshRef.current.geometry
      const positions = geometry.attributes.position
      
      // 클릭 지점
      const clickLocal = meshRef.current.worldToLocal(e.point.clone())
      
      // 가장 가까운 정점 찾기
      let minDist = Infinity
      let closestVertex = -1
      
      for (let i = 0; i < positions.count; i++) {
        const vx = positions.getX(i)
        const vy = positions.getY(i)
        const vz = positions.getZ(i)
        
        const dist = Math.sqrt(
          (vx - clickLocal.x) ** 2 +
          (vy - clickLocal.y) ** 2 +
          (vz - clickLocal.z) ** 2
        )
        
        if (dist < minDist) {
          minDist = dist
          closestVertex = i
        }
      }
      
      // 영향받는 정점들 찾기
      const affectedVertices: typeof dragRef.current.affectedVertices = []
      const startPoint = new THREE.Vector3(
        positions.getX(closestVertex),
        positions.getY(closestVertex),
        positions.getZ(closestVertex)
      )
      
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
        
        const dist = vertex.distanceTo(startPoint)
        
        if (dist <= brushSize) {
          const weight = 1 - (dist / brushSize)
          affectedVertices.push({
            idx: i,
            weight: Math.pow(weight, 0.5),
            originalPos: vertex.clone()
          })
        }
      }
      
      // 드래그 상태 설정
      dragRef.current = {
        isActive: true,
        selectedVertex: closestVertex,
        originalGeometry: new Float32Array(positions.array),
        startPoint: startPoint,
        affectedVertices: affectedVertices
      }
      
      onDeformingChange(true)
      setDebugInfo(`Started dragging vertex ${closestVertex}`)
    } else if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }
  
  const handlePointerUp = () => {
    if (dragRef.current.isActive) {
      dragRef.current.isActive = false
      dragRef.current.selectedVertex = -1
      dragRef.current.affectedVertices = []
      dragRef.current.originalGeometry = null
      onDeformingChange(false)
      setDebugInfo('Drag ended')
      
      // 디버그 정보를 2초 후에 지움
      setTimeout(() => setDebugInfo(''), 2000)
    }
  }
  
  // 전역 마우스 업 이벤트
  useEffect(() => {
    const handleGlobalPointerUp = (e: PointerEvent) => {
      handlePointerUp()
    }
    
    const handlePointerLeave = (e: PointerEvent) => {
      if (dragRef.current.isActive) {
        handlePointerUp()
      }
    }
    
    window.addEventListener('pointerup', handleGlobalPointerUp)
    window.addEventListener('pointercancel', handleGlobalPointerUp)
    document.addEventListener('pointerleave', handlePointerLeave)
    
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp)
      window.removeEventListener('pointercancel', handleGlobalPointerUp)
      document.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [onDeformingChange])
  
  return (
    <>
      <mesh
        ref={meshRef}
        position={clay.position}
        onPointerDown={handlePointerDown}
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
      {debugInfo && (
        <Html position={[0, 3, 0]}>
          <div className="bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
            {debugInfo}
          </div>
        </Html>
      )}
    </>
  )
}

export default function DebugDragClay() {
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
        <h2 className="text-xl font-bold mb-4">디버그 드래그 점토</h2>
        
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
        
        <div className="space-y-2">
          <button
            onClick={resetClay}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            점토 초기화
          </button>
        </div>
        
        <div className="text-xs text-gray-500 mt-4 p-3 bg-yellow-50 rounded">
          <p className="font-semibold mb-1">🐛 디버그 모드:</p>
          <p>• useFrame으로 매 프레임 추적</p>
          <p>• 직접적인 정점 이동</p>
          <p>• 실시간 디버그 정보 표시</p>
          <p>• 메시 외부에서도 작동</p>
          <p className="mt-2 text-yellow-700 font-semibold">
            드래그 상태가 화면에 표시됩니다
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
