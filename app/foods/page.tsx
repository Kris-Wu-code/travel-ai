import { Suspense } from 'react'
import FoodsContent from './foods-content'

function FoodsLoadingFallback() {
  return <div>加载中...</div>
}

export default function FoodsPage() {
  return (
    <Suspense fallback={<FoodsLoadingFallback />}>
      <FoodsContent />
    </Suspense>
  )
}
