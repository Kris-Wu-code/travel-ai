export function Skeleton({ width, height, radius = 8 }: { width?: number | string; height?: number | string; radius?: number }) {
  return (
    <div className="skeleton" style={{ width: width || '100%', height: height || '20px', borderRadius: radius }} />
  )
}

export function SceneCardSkeleton() {
  return (
    <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <Skeleton height={170} radius={0} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton width={60} height={24} radius={12} />
          <Skeleton width={50} height={14} />
        </div>
        <Skeleton height={22} width="70%" />
        <Skeleton height={16} width="90%" />
        <Skeleton height={14} width={40} />
      </div>
    </div>
  )
}

export function DiaryCardSkeleton() {
  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <Skeleton height={20} width="60%" />
      <Skeleton height={14} width="40%" />
      <Skeleton height={14} width="80%" />
      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
        <Skeleton height={14} width={50} />
        <Skeleton height={14} width={50} />
      </div>
    </div>
  )
}
