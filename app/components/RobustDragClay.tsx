'use client'

import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { TrackballControls, Environment } from '@react-three/drei'
import { useRef, useState, useEffect, Suspense, useCallback } from 'react'
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
  
  // 마우스 상태를 직접 추적
  const mouseState = useRef({
    isDown: false,
    position: new THREE.Vector2(),
    draggedVertex: -1,
    originalPositions: null as Float32Array | null,
    affectedVertices: [] as Array<{
      index: number
      weight: number 
      originalPos: THREE.Vector3
    }>
  })
  
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry = clay.geometry
    meshRef.current.geometry.computeVertexNormals()
  }, [clay.geometry])
  
  // 마우스 이벤트를 canvas에 직접 등록
  useEffect(() => {
    const canvas = gl.domElement
    
    const handleMouseDown = (e: MouseEvent) => {
      if (tool !== 'push' && tool !== 'pull') return
      
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      
      mouseState.current.position.set(x, y)
      
      // Raycaster로 클릭 지점 확인
      raycaster.setFromCamera(mouseState.current.position, camera)
      
      if (!meshRef.current) return
      
      const intersects = raycaster.intersectObject(meshRef.current)
      
      if (intersects.length > 0) {
        const geometry = meshRef.current.geometry
        const positions = geometry.attributes.position
        
        // 현재 정점 위치 저장 (변형된 상태 그대로)
        mouseState.current.originalPositions = new Float32Array(positions.array)
        
        // 클릭 지점을 로컬 좌표로
        const clickLocal = meshRef.current.worldToLocal(intersects[0].point.clone())
        
        // face index를 사용해서 더 정확한 정점 찾기
        const face = intersects[0].face
        let closestVertex = -1
        
        if (face) {
          // face의 정점들 중에서 가장 가까운 것 선택
          const vertices = [face.a, face.b, face.c]
          let minDist = Infinity
          
          for (const idx of vertices) {
            const vertex = new THREE.Vector3(
              positions.getX(idx),
              positions.getY(idx),
              positions.getZ(idx)
            )
            const dist = vertex.distanceTo(clickLocal)
            if (dist < minDist) {
              minDist = dist
              closestVertex = idx
            }
          }
        } else {
          // fallback: 전체 정점에서 찾기
          let minDist = Infinity
          
          for (let i = 0; i < positions.count; i++) {
            const vertex = new THREE.Vector3(
              positions.getX(i),
              positions.getY(i),
              positions.getZ(i)
            )
            
            const dist = vertex.distanceTo(clickLocal)
            
            if (dist < minDist) {
              minDist = dist
              closestVertex = i
            }
          }
        }
        
        // 영향받는 정점들 찾기
        mouseState.current.affectedVertices = []
        const centerVertex = new THREE.Vector3(
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
          
          const dist = vertex.distanceTo(centerVertex)
          
          if (dist <= brushSize) {
            const weight = 1 - (dist / brushSize)
            mouseState.current.affectedVertices.push({
              index: i,
              weight: Math.pow(weight, 0.7),
              originalPos: vertex.clone()
            })
          }
        }
        
        mouseState.current.isDown = true
        mouseState.current.draggedVertex = closestVertex
        onDeformingChange(true)
      }
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseState.current.isDown) return
      
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      
      mouseState.current.position.set(x, y)
    }
    
    const handleMouseUp = () => {
      if (mouseState.current.isDown) {
        mouseState.current.isDown = false
        mouseState.current.draggedVertex = -1
        mouseState.current.affectedVertices = []
        mouseState.current.originalPositions = null
        onDeformingChange(false)
      }
    }
    
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
  
  // 매 프레임마다 드래그 처리
  useFrame(() => {
    if (!mouseState.current.isDown || !meshRef.current || mouseState.current.draggedVertex === -1) return
    
    const geometry = meshRef.current.geometry
    const positions = geometry.attributes.position
    
    // 현재 마우스 위치로 ray 생성
    raycaster.setFromCamera(mouseState.current.position, camera)
    
    // 가상의 평면 생성 (카메라를 향하는)
    const cameraDirection = new THREE.Vector3()
    camera.getWorldDirection(cameraDirection)
    
    // 드래그 중인 정점의 현재 월드 위치
    const draggedVertexWorld = new THREE.Vector3(
      positions.getX(mouseState.current.draggedVertex),
      positions.getY(mouseState.current.draggedVertex),
      positions.getZ(mouseState.current.draggedVertex)
    )
    meshRef.current.localToWorld(draggedVertexWorld)
    
    // 평면 생성
    const dragPlane = new THREE.Plane()
    dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, draggedVertexWorld)
    
    // Ray와 평면의 교차점
    const intersectPoint = new THREE.Vector3()
    raycaster.ray.intersectPlane(dragPlane, intersectPoint)
    
    // 로컬 좌표로 변환
    const targetLocal = meshRef.current.worldToLocal(intersectPoint)
    
    // 카메라의 좌표계 계산
    const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize()
    const cameraUp = new THREE.Vector3().crossVectors(cameraRight, cameraDirection).normalize()
    
    if (tool === 'push') {
      // 메인 정점은 타겟 위치로
      positions.setXYZ(mouseState.current.draggedVertex, targetLocal.x, targetLocal.y, targetLocal.z)
      
      // 주변 정점들 업데이트
      for (const vertex of mouseState.current.affectedVertices) {
        if (vertex.index !== mouseState.current.draggedVertex) {
          const mainVertex = mouseState.current.affectedVertices.find(v => v.index === mouseState.current.draggedVertex)
          const dragVector = new THREE.Vector3(
            targetLocal.x - (mainVertex?.originalPos.x || 0),
            targetLocal.y - (mainVertex?.originalPos.y || 0),
            targetLocal.z - (mainVertex?.originalPos.z || 0)
          )
          
          // 화면 좌표계로 변환
          const movementRight = dragVector.dot(cameraRight)
          const movementUp = dragVector.dot(cameraUp)
          const movementForward = dragVector.dot(cameraDirection)
          
          const screenMovement = new THREE.Vector3()
            .addScaledVector(cameraRight, movementRight * 0.7)
            .addScaledVector(cameraUp, movementUp * 0.7)
            .addScaledVector(cameraDirection, movementForward)
          
          const movement = screenMovement.multiplyScalar(vertex.weight)
          const newPos = vertex.originalPos.clone().add(movement)
          positions.setXYZ(vertex.index, newPos.x, newPos.y, newPos.z)
        }
      }
    }
    
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  })
  
  // Paint 도구 처리
  const handleClick = useCallback(() => {
    if (tool === 'paint') {
      clay.color = currentColor
      onUpdate({ ...clay })
    }
  }, [tool, currentColor, clay, onUpdate])
  
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
      />
    </mesh>
  )
}

export default function RobustDragClay() {
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
        <h2 className="text-xl font-bold mb-4">강력한 드래그 점토</h2>
        
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
        
        <div className="text-xs text-gray-500 p-3 bg-green-50 rounded">
          <p className="font-semibold mb-1">✅ 안정적인 시스템:</p>
          <p>• Canvas에 직접 이벤트 등록</p>
          <p>• Three.js 이벤트 시스템 우회</p>
          <p>• 마우스 상태 직접 추적</p>
          <p>• 드래그 평면으로 정확한 3D 위치</p>
          <p className="mt-2 text-green-700 font-semibold">
            이제 안정적으로 작동합니다!
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
