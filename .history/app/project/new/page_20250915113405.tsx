'use client'

import dynamic from 'next/dynamic'

const AdvancedClay = dynamic(() => import('@/app/components/AdvancedClay'), { 
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading 3D Editor...</div>
    </div>
  )
})

export default function NewProjectPage() {
  return <AdvancedClay />
}
