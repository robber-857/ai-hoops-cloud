'use client'
import { usePoseCopy } from "@/components/Pose2D/poseCopy";
import dynamic from 'next/dynamic'

// 注意：路径不要写成 ../..//components
const PoseCanvas = dynamic(() => import('../../components/PoseCanvas'), { ssr: false })

export default function PosePage() {
  const { t } = usePoseCopy();
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">{t("AI Basketball · Pose (Demo)")}</h1>
      <PoseCanvas />
    </main>
  )
}
