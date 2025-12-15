'use client'
import dynamic from 'next/dynamic'

// 注意：路径不要写成 ../..//components
const PoseCanvas = dynamic(() => import('../../components/PoseCanvas'), { ssr: false })

export default function PosePage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">AI Basketball · Pose (Demo)</h1>
      <PoseCanvas />
    </main>
  )
}
