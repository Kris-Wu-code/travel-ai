/**
 * Dijkstra 最短路径算法
 * 用于找到两个节点之间的最短路径
 * 时间复杂度: O((V + E) log V)
 */

import { Graph } from './graph'

interface DijkstraResult<T> {
  distance: number
  path: T[] | null
}

/**
 * 使用 Dijkstra 算法找到最短路径
 * @param graph 图表对象
 * @param start 起点
 * @param end 终点
 * @returns 最短距离和路径
 */
export function dijkstra<T>(graph: Graph<T>, start: T, end: T): DijkstraResult<T> {
  const distances = new Map<T, number>()
  const previous = new Map<T, T | null>()
  const unvisited = new Set<T>()

  // 初始化
  for (const vertex of graph.getVertices()) {
    distances.set(vertex, vertex === start ? 0 : Infinity)
    previous.set(vertex, null)
    unvisited.add(vertex)
  }

  while (unvisited.size > 0) {
    // 找到未访问节点中距离最小的
    let current: T | null = null
    let minDistance = Infinity

    for (const vertex of unvisited) {
      const distance = distances.get(vertex) ?? Infinity
      if (distance < minDistance) {
        minDistance = distance
        current = vertex
      }
    }

    if (current === null || minDistance === Infinity) {
      break
    }

    unvisited.delete(current)

    // 如果到达目标，可以提前退出
    if (current === end) {
      break
    }

    // 更新邻接点的距离
    for (const neighbor of graph.getNeighbors(current)) {
      if (unvisited.has(neighbor)) {
        const alt = (distances.get(current) ?? Infinity) + graph.getEdgeWeight(current, neighbor)
        const neighborDistance = distances.get(neighbor) ?? Infinity

        if (alt < neighborDistance) {
          distances.set(neighbor, alt)
          previous.set(neighbor, current)
        }
      }
    }
  }

  // 构建路径
  const distance = distances.get(end) ?? Infinity
  let path: T[] | null = null

  if (distance !== Infinity) {
    path = []
    let current: T | null = end

    while (current !== null) {
      path.unshift(current)
      current = previous.get(current) ?? null
    }
  }

  return { distance, path }
}
