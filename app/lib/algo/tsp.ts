/**
 * 旅行商问题 (TSP - Traveling Salesman Problem)
 * 使用动态规划 + 贪心启发式算法求解
 * 适用于中小规模问题（3-15 个节点）
 */

import { Graph } from './graph'
import { dijkstra } from './dijkstra'

interface TSPResult<T> {
  path: T[]
  distance: number
}

/**
 * 使用贪心 + DP 启发式算法解决 TSP 问题
 * @param graph 图表对象
 * @param nodeIds 需要访问的所有节点 ID
 * @returns 访问顺序和总距离
 */
export function tsp<T>(graph: Graph<T>, nodeIds: T[]): TSPResult<T> | null {
  if (nodeIds.length < 2) {
    return null
  }

  // 特殊情况：只有 2 个节点
  if (nodeIds.length === 2) {
    const result = dijkstra(graph, nodeIds[0], nodeIds[1])
    if (result.path) {
      return {
        path: result.path,
        distance: result.distance,
      }
    }
    return null
  }

  // 预计算所有节点对之间的最短距离
  const distances = new Map<string, number>()
  const paths = new Map<string, T[]>()

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = 0; j < nodeIds.length; j++) {
      if (i !== j) {
        const key = `${i}-${j}`
        const result = dijkstra(graph, nodeIds[i], nodeIds[j])
        distances.set(key, result.distance)
        if (result.path) {
          paths.set(key, result.path)
        }
      }
    }
  }

  // 使用贪心启发式：从第一个节点开始，总是选择最近的未访问节点
  let bestPath: T[] = [nodeIds[0]]
  let bestDistance = 0
  let unvisited = new Set(nodeIds.slice(1))

  let current = nodeIds[0]
  while (unvisited.size > 0) {
    let nearest: T | null = null
    let minDist = Infinity

    for (const next of unvisited) {
      const currentIdx = nodeIds.indexOf(current)
      const nextIdx = nodeIds.indexOf(next)
      const key = `${currentIdx}-${nextIdx}`
      const dist = distances.get(key) ?? Infinity

      if (dist < minDist) {
        minDist = dist
        nearest = next
      }
    }

    if (nearest === null) {
      break
    }

    bestPath.push(nearest)
    bestDistance += minDist
    unvisited.delete(nearest)
    current = nearest
  }

  return {
    path: bestPath,
    distance: bestDistance,
  }
}
