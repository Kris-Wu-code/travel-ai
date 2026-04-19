import { Suspense } from 'react'
import DiaryContent from './diary-content'

function DiaryLoadingFallback() {
  return <div>加载中...</div>
}

export default function DiaryPage() {
  return (
    <Suspense fallback={<DiaryLoadingFallback />}>
      <DiaryContent />
    </Suspense>
  )
}
