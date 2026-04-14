export type SceneType = 'scenic_spot' | 'campus'

export type SceneRecord = {
  id: string
  name: string
  scene_type: SceneType
  city: string | null
  description: string | null
  center_lat: number | null
  center_lng: number | null
  cover_image_url: string | null
  available_transports: string[] | null
  status: string
}

export function getSceneTypeLabel(sceneType: SceneType) {
  return sceneType === 'scenic_spot' ? '景区' : '校园'
}

export function formatTransportList(transports: string[] | null | undefined) {
  if (!transports || transports.length === 0) {
    return '待补充'
  }

  return transports.join(' / ')
}
