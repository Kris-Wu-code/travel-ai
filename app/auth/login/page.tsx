import { Suspense } from 'react'
import LoginContent from './login-content'

function LoginLoadingFallback() {
  return <div>加载中...</div>
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginContent />
    </Suspense>
  )
}