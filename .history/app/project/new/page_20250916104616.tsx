'use client'

import dynamic from 'next/dynamic'

const AdvancedClay = dynamic(() => import('@/app/components/AdvancedClay'), {
  ssr: false,
  loading: () => (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Canvas Area Skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-96 h-96 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>

      {/* Bottom Toolbar Skeleton */}
      <div className="bg-white shadow-lg border-t border-gray-200">
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4">
            {/* Left side buttons */}
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
            
            {/* Center tools */}
            <div className="flex gap-2 bg-gray-100 rounded-lg p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-10 h-10 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
            
            {/* Right side buttons */}
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
          </div>
          
          {/* Secondary toolbar */}
          <div className="border-t border-gray-100 p-2 flex items-center justify-center gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-10 h-10 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})

export default function NewProjectPage() {
  return <AdvancedClay />
}

