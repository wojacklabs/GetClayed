'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, TransformControls, useCursor, useGLTF } from '@react-three/drei'
import { useRef, useState, useMemo, Suspense, useCallback, forwardRef } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'

interface ClayObject {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string
  type: 'sphere' | 'box' | 'cylinder' | 'torus'
  radius?: number
}

interface ClayMeshProps {
  object: ClayObject
  isSelected: boolean
  onSelect: (id: string) => void
  tool: string
}

const ClayMesh = forwardRef<THREE.Mesh, ClayMeshProps>(({ object, isSelected, onSelect, tool }, ref) => {
  const [hovered, setHovered] = useState(false)
  
  useCursor(hovered && tool !== 'transform')
  
  useFrame(() => {
    if (ref && 'current' in ref && ref.current && isSelected && tool === 'sculpt') {
      ref.current.scale.x = object.scale[0] + Math.sin(Date.now() * 0.001) * 0.02
      ref.current.scale.y = object.scale[1] + Math.sin(Date.now() * 0.001) * 0.02
      ref.current.scale.z = object.scale[2] + Math.sin(Date.now() * 0.001) * 0.02
    }
  })
  
  const geometry = useMemo(() => {
    switch (object.type) {
      case 'sphere':
        return <sphereGeometry args={[object.radius || 0.5, 32, 32]} />
      case 'box':
        return <boxGeometry args={[1, 1, 1]} />
      case 'cylinder':
        return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
      case 'torus':
        return <torusGeometry args={[0.5, 0.2, 16, 32]} />
      default:
        return <sphereGeometry args={[0.5, 32, 32]} />
    }
  }, [object.type, object.radius])
  
  return (
    <mesh
      ref={ref}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(object.id)
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {geometry}
      <meshStandardMaterial 
        color={object.color} 
        roughness={0.7}
        metalness={0.1}
        emissive={isSelected ? object.color : '#000000'}
        emissiveIntensity={isSelected ? 0.2 : 0}
      />
    </mesh>
  )
})

ClayMesh.displayName = 'ClayMesh'

export default function ClaySceneComplete() {
  const [clayObjects, setClayObjects] = useState<ClayObject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [currentType, setCurrentType] = useState<ClayObject['type']>('sphere')
  const [tool, setTool] = useState<'add' | 'sculpt' | 'paint' | 'delete' | 'transform' | 'merge'>('add')
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate')
  const [projectName, setProjectName] = useState('내 작품')
  const meshRefs = useRef<{ [key: string]: THREE.Mesh }>({})
  
  const selectedObject = clayObjects.find(obj => obj.id === selectedId)

  const handleCanvasClick = (event: any) => {
    if (tool === 'add' && event.point) {
      const newObject: ClayObject = {
        id: `clay-${Date.now()}`,
        position: [event.point.x, Math.max(event.point.y + 0.5, 0.5), event.point.z],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: currentColor,
        type: currentType,
        radius: 0.5
      }
      setClayObjects([...clayObjects, newObject])
    }
  }

  const handleObjectSelect = (id: string) => {
    if (tool === 'delete') {
      setClayObjects(clayObjects.filter(obj => obj.id !== id))
      if (selectedId === id) setSelectedId(null)
    } else if (tool === 'paint') {
      setClayObjects(clayObjects.map(obj => 
        obj.id === id ? { ...obj, color: currentColor } : obj
      ))
    } else if (tool === 'merge' && selectedId && selectedId !== id) {
      const obj1 = clayObjects.find(obj => obj.id === selectedId)
      const obj2 = clayObjects.find(obj => obj.id === id)
      
      if (obj1 && obj2) {
        const newPosition: [number, number, number] = [
          (obj1.position[0] + obj2.position[0]) / 2,
          (obj1.position[1] + obj2.position[1]) / 2,
          (obj1.position[2] + obj2.position[2]) / 2
        ]
        
        const newScale: [number, number, number] = [
          (obj1.scale[0] + obj2.scale[0]) * 0.8,
          (obj1.scale[1] + obj2.scale[1]) * 0.8,
          (obj1.scale[2] + obj2.scale[2]) * 0.8
        ]
        
        const mergedObject: ClayObject = {
          id: `clay-${Date.now()}`,
          position: newPosition,
          rotation: [0, 0, 0],
          scale: newScale,
          color: obj1.color,
          type: 'sphere',
          radius: 0.5
        }
        
        setClayObjects(clayObjects.filter(obj => obj.id !== selectedId && obj.id !== id).concat(mergedObject))
        setSelectedId(null)
      }
    } else {
      setSelectedId(id)
    }
  }

  const updateSelectedObject = (updates: Partial<ClayObject>) => {
    if (selectedId) {
      setClayObjects(clayObjects.map(obj => 
        obj.id === selectedId ? { ...obj, ...updates } : obj
      ))
    }
  }

  // 저장 기능
  const saveProject = useCallback(() => {
    const projectData = {
      name: projectName,
      objects: clayObjects,
      timestamp: new Date().toISOString()
    }
    
    const jsonString = JSON.stringify(projectData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${projectName}_${new Date().getTime()}.clay`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [projectName, clayObjects])

  // 불러오기 기능
  const loadProject = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const projectData = JSON.parse(e.target?.result as string)
        setProjectName(projectData.name || '내 작품')
        setClayObjects(projectData.objects || [])
        setSelectedId(null)
      } catch (error) {
        alert('파일을 불러오는데 실패했습니다.')
      }
    }
    reader.readAsText(file)
  }, [])

  return (
    <div className="w-full h-full flex">
      {/* 툴바 */}
      <div className="w-80 bg-white shadow-lg p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">점토 조각 도구</h2>
        
        {/* 프로젝트 이름 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">프로젝트 이름</h3>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full p-2 border rounded text-sm"
            placeholder="작품 이름을 입력하세요"
          />
        </div>
        
        {/* 도구 선택 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">도구</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTool('add')}
              className={`p-2 rounded text-sm ${
                tool === 'add' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              추가
            </button>
            <button
              onClick={() => setTool('transform')}
              className={`p-2 rounded text-sm ${
                tool === 'transform' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              변형
            </button>
            <button
              onClick={() => setTool('sculpt')}
              className={`p-2 rounded text-sm ${
                tool === 'sculpt' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              조각
            </button>
            <button
              onClick={() => setTool('paint')}
              className={`p-2 rounded text-sm ${
                tool === 'paint' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              색칠
            </button>
            <button
              onClick={() => setTool('merge')}
              className={`p-2 rounded text-sm ${
                tool === 'merge' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              합치기
            </button>
            <button
              onClick={() => setTool('delete')}
              className={`p-2 rounded text-sm ${
                tool === 'delete' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              삭제
            </button>
          </div>
        </div>
        
        {/* 변형 모드 */}
        {tool === 'transform' && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">변형 모드</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setTransformMode('translate')}
                className={`p-2 rounded text-xs ${
                  transformMode === 'translate' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                이동
              </button>
              <button
                onClick={() => setTransformMode('rotate')}
                className={`p-2 rounded text-xs ${
                  transformMode === 'rotate' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                회전
              </button>
              <button
                onClick={() => setTransformMode('scale')}
                className={`p-2 rounded text-xs ${
                  transformMode === 'scale' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                크기
              </button>
            </div>
          </div>
        )}
        
        {/* 도형 선택 */}
        {tool === 'add' && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">도형 선택</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCurrentType('sphere')}
                className={`p-2 rounded text-sm ${
                  currentType === 'sphere' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                구
              </button>
              <button
                onClick={() => setCurrentType('box')}
                className={`p-2 rounded text-sm ${
                  currentType === 'box' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                정육면체
              </button>
              <button
                onClick={() => setCurrentType('cylinder')}
                className={`p-2 rounded text-sm ${
                  currentType === 'cylinder' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                원기둥
              </button>
              <button
                onClick={() => setCurrentType('torus')}
                className={`p-2 rounded text-sm ${
                  currentType === 'torus' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                도넛
              </button>
            </div>
          </div>
        )}
        
        {/* 색상 선택 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">색상</h3>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setCurrentColor(e.target.value)}
              className="w-full h-10 rounded cursor-pointer"
            />
            <span className="text-xs">{currentColor}</span>
          </div>
          <div className="grid grid-cols-6 gap-1 mt-2">
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
        
        {/* 조각 컨트롤 */}
        {selectedObject && tool === 'sculpt' && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-2">조각 설정</h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs">크기 X: {selectedObject.scale[0].toFixed(2)}</label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={selectedObject.scale[0]}
                  onChange={(e) => updateSelectedObject({ 
                    scale: [parseFloat(e.target.value), selectedObject.scale[1], selectedObject.scale[2]] 
                  })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs">크기 Y: {selectedObject.scale[1].toFixed(2)}</label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={selectedObject.scale[1]}
                  onChange={(e) => updateSelectedObject({ 
                    scale: [selectedObject.scale[0], parseFloat(e.target.value), selectedObject.scale[2]] 
                  })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs">크기 Z: {selectedObject.scale[2].toFixed(2)}</label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={selectedObject.scale[2]}
                  onChange={(e) => updateSelectedObject({ 
                    scale: [selectedObject.scale[0], selectedObject.scale[1], parseFloat(e.target.value)] 
                  })}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* 파일 관리 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">파일 관리</h3>
          <div className="space-y-2">
            <button
              onClick={saveProject}
              className="w-full p-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              저장하기
            </button>
            <label className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer text-center block">
              불러오기
              <input
                type="file"
                accept=".clay"
                onChange={loadProject}
                className="hidden"
              />
            </label>
          </div>
        </div>
        
        {/* 액션 버튼 */}
        <div className="space-y-2">
          <button
            onClick={() => {
              if (confirm('정말로 모든 작업을 지우시겠습니까?')) {
                setClayObjects([])
                setSelectedId(null)
              }
            }}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            모두 지우기
          </button>
        </div>
        
        {/* 통계 정보 */}
        <div className="mt-6 p-3 bg-gray-100 rounded text-xs">
          <p>오브젝트 수: {clayObjects.length}개</p>
          {selectedObject && (
            <>
              <p>선택된 오브젝트: {selectedObject.type}</p>
              <p>위치: ({selectedObject.position.map(v => v.toFixed(1)).join(', ')})</p>
            </>
          )}
        </div>
        
        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">사용법</p>
          <p>• 추가: 바닥을 클릭해 새 점토 추가</p>
          <p>• 변형: 오브젝트 선택 후 조작</p>
          <p>• 조각: 슬라이더로 형태 변경</p>
          <p>• 색칠: 클릭으로 색상 변경</p>
          <p>• 합치기: 두 오브젝트 순서대로 클릭</p>
          <p>• 삭제: 오브젝트 클릭으로 제거</p>
        </div>
      </div>
      
      {/* 3D 캔버스 */}
      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [5, 5, 5], fov: 50 }}
          onPointerMissed={() => tool !== 'add' && setSelectedId(null)}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <OrbitControls 
              enableDamping 
              enabled={tool !== 'transform' || !selectedId}
              makeDefault
            />
            
            <Grid 
              args={[20, 20]} 
              cellSize={1} 
              cellThickness={0.5} 
              cellColor="#6b7280" 
              sectionSize={5} 
              sectionThickness={1} 
              sectionColor="#374151"
              fadeDistance={30}
              fadeStrength={1}
              followCamera={false}
            />
            
            <mesh 
              rotation={[-Math.PI / 2, 0, 0]} 
              position={[0, -0.01, 0]}
              onClick={handleCanvasClick}
              visible={tool === 'add'}
            >
              <planeGeometry args={[20, 20]} />
              <meshBasicMaterial color="white" opacity={0} transparent />
            </mesh>
            
            {clayObjects.map((obj) => {
              if (selectedId === obj.id && tool === 'transform') return null
              return (
                <ClayMesh
                  key={obj.id}
                  object={obj}
                  isSelected={selectedId === obj.id}
                  onSelect={handleObjectSelect}
                  tool={tool}
                  ref={(el) => {
                    if (el) meshRefs.current[obj.id] = el
                  }}
                />
              )
            })}
            
            {selectedObject && tool === 'transform' && selectedId && (
              <TransformControls
                mode={transformMode}
                onObjectChange={() => {
                  const obj = clayObjects.find(o => o.id === selectedId)
                  if (obj && meshRefs.current[selectedId]) {
                    const mesh = meshRefs.current[selectedId]
                    updateSelectedObject({
                      position: mesh.position.toArray() as [number, number, number],
                      rotation: mesh.rotation.toArray().slice(0, 3) as [number, number, number],
                      scale: mesh.scale.toArray() as [number, number, number]
                    })
                  }
                }}
              >
                <ClayMesh
                  key={selectedId}
                  object={selectedObject}
                  isSelected={true}
                  onSelect={handleObjectSelect}
                  tool={tool}
                  ref={(el) => {
                    if (el) meshRefs.current[selectedId] = el
                  }}
                />
              </TransformControls>
            )}
            
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
        
        {/* 상태 표시 */}
        <div className="absolute top-4 right-4 bg-white p-2 rounded shadow text-sm">
          <p>현재 도구: {
            tool === 'add' ? '추가' :
            tool === 'transform' ? '변형' :
            tool === 'sculpt' ? '조각' :
            tool === 'paint' ? '색칠' :
            tool === 'merge' ? '합치기' :
            '삭제'
          }</p>
        </div>
      </div>
    </div>
  )
}
