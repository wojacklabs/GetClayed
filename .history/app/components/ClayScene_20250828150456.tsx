'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment } from '@react-three/drei'
import { useRef, useState } from 'react'
import * as THREE from 'three'

interface ClayBallProps {
  position: [number, number, number]
  color: string
  size: number
  id: string
  onSelect: (id: string) => void
  isSelected: boolean
}

function ClayBall({ position, color, size, id, onSelect, isSelected }: ClayBallProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(id)
      }}
      scale={isSelected ? 1.1 : 1}
    >
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.7}
        metalness={0.1}
      />
    </mesh>
  )
}

export default function ClayScene() {
  const [clayObjects, setClayObjects] = useState<Array<{
    id: string
    position: [number, number, number]
    color: string
    size: number
  }>>([])
  
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [currentColor, setCurrentColor] = useState('#ff6b6b')
  const [currentSize, setCurrentSize] = useState(0.5)
  const [tool, setTool] = useState<'add' | 'sculpt' | 'paint' | 'delete'>('add')

  const handleCanvasClick = (event: any) => {
    if (tool === 'add') {
      const point = event.point
      if (point) {
        const newClayBall = {
          id: `clay-${Date.now()}`,
          position: [point.x, Math.max(point.y + currentSize, currentSize), point.z] as [number, number, number],
          color: currentColor,
          size: currentSize
        }
        setClayObjects([...clayObjects, newClayBall])
      }
    }
  }

  const handleObjectSelect = (id: string) => {
    setSelectedId(id)
    
    if (tool === 'delete') {
      setClayObjects(clayObjects.filter(obj => obj.id !== id))
      setSelectedId(null)
    } else if (tool === 'paint' && selectedId === id) {
      setClayObjects(clayObjects.map(obj => 
        obj.id === id ? { ...obj, color: currentColor } : obj
      ))
    }
  }

  return (
    <div className="w-full h-full flex">
      {/* 툴바 */}
      <div className="w-64 bg-white shadow-lg p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">점토 조각 도구</h2>
        
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
            {['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#bb8fce', '#85929e'].map(color => (
              <button
                key={color}
                onClick={() => setCurrentColor(color)}
                className="w-8 h-8 rounded"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        
        {/* 크기 조절 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2">크기: {currentSize.toFixed(2)}</h3>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={currentSize}
            onChange={(e) => setCurrentSize(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        {/* 액션 버튼 */}
        <div className="space-y-2">
          <button
            onClick={() => {
              setClayObjects([])
              setSelectedId(null)
            }}
            className="w-full p-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            모두 지우기
          </button>
        </div>
      </div>
      
      {/* 3D 캔버스 */}
      <div className="flex-1">
        <Canvas
          camera={{ position: [5, 5, 5], fov: 50 }}
          onPointerMissed={() => setSelectedId(null)}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <OrbitControls enableDamping />
          
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
          
          {clayObjects.map((obj) => (
            <ClayBall
              key={obj.id}
              {...obj}
              onSelect={handleObjectSelect}
              isSelected={selectedId === obj.id}
            />
          ))}
          
          <Environment preset="studio" />
        </Canvas>
      </div>
    </div>
  )
}
