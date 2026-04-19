import { Suspense } from 'react'
import ScenesContent from './scenes-content'

function ScenesLoadingFallback() {
  return <div>加载中...</div>
}

export default function ScenesPage() {
  return (
    <Suspense fallback={<ScenesLoadingFallback />}>
      <ScenesContent />
    </Suspense>
  )
}
