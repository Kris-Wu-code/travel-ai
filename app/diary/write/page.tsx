import { Suspense } from 'react'
import DiaryWriteContent from './diary-write-content'

function DiaryWriteLoadingFallback() {
  return <div>加载中...</div>
}

export default function DiaryWritePage() {
  return (
    <Suspense fallback={<DiaryWriteLoadingFallback />}>
      <DiaryWriteContent />
    </Suspense>
  )
}
