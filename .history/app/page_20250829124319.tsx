import AdvancedClay from './components/AdvancedClay'

export default function Home() {
  return (
    <div className="w-full h-screen flex flex-col">
      <header className="bg-white shadow-sm p-4 z-10">
        <h1 className="text-2xl font-bold text-gray-800">3D 점토 조각 스튜디오</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <AdvancedClay />
      </main>
    </div>
  )
}