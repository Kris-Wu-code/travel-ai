import { Suspense } from 'react'
import PlacesContent from './places-content'

function PlacesLoadingFallback() {
  return <div>加载中...</div>
}

export default function PlacesPage() {
  return (
    <Suspense fallback={<PlacesLoadingFallback />}>
      <PlacesContent />
    </Suspense>
  )
}
