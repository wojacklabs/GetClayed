'use client'

import dynamic from 'next/dynamic'

const AdvancedClay = dynamic(() => import('@/app/components/AdvancedClay'), { 
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-gray-100">
      {/* Header Skeleton */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-32 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-24 h-8 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
      
      {/* Main Content Skeleton */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* Left Sidebar Skeleton */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-full h-10 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
        
        {/* Canvas Area Skeleton */}
        <div className="flex-1 bg-gray-50 flex items-center justify-center">
          <div className="w-96 h-96 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
        
        {/* Right Sidebar Skeleton */}
        <div className="w-64 bg-white border-l border-gray-200 p-4">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-full h-12 bg-gray-200 rounded animate-pulse"></div>
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

