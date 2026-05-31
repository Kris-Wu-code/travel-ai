/**
 * 导航系统 - 单元测试
 * 测试 Dijkstra 和 TSP 算法的正确性
 *
 * 运行方法：
 *   npx jest app/lib/algo/__tests__/navigation.test.ts
 */

import { Graph } from '../graph'
import { dijkstra } from '../dijkstra'
import { tsp } from '../tsp'

describe('导航系统 - 图表和算法', () => {
  describe('Graph 类', () => {
    let graph: Graph<string>

    beforeEach(() => {
      graph = new Graph<string>()
    })

    test('应该添加顶点', () => {
      graph.addVertex('A', 'Point A')
      graph.addVertex('B', 'Point B')

      expect(graph.hasVertex('A')).toBe(true)
      expect(graph.hasVertex('B')).toBe(true)
      expect(graph.hasVertex('C')).toBe(false)
    })

    test('应该添加边并计算权重', () => {
      graph.addVertex('A', 'Point A')
      graph.addVertex('B', 'Point B')

      graph.addEdge('A', 'B', 100)

      const neighbors = graph.getNeighbors('A')
      expect(neighbors).toContain('B')
    })

    test('应该获取正确的边权重', () => {
      graph.addVertex('A', 'Point A')
      graph.addVertex('B', 'Point B')
      graph.addVertex('C', 'Point C')

      graph.addEdge('A', 'B', 50)
      graph.addEdge('A', 'C', 100)
      graph.addEdge('B', 'C', 30)

      expect(graph.getEdgeWeight('A', 'B')).toBe(50)
      expect(graph.getEdgeWeight('A', 'C')).toBe(100)
      expect(graph.getEdgeWeight('B', 'C')).toBe(30)
      expect(graph.getEdgeWeight('A', 'D')).toBe(Infinity)
    })

    test('应该处理孤立顶点', () => {
      graph.addVertex('A', 'Point A')
      graph.addVertex('B', 'Point B')
      graph.addVertex('C', 'Point C')

      graph.addEdge('A', 'B', 100)

      const neighborsC = graph.getNeighbors('C')
      expect(neighborsC).toHaveLength(0)
    })
  })

  describe('Dijkstra 最短路径算法', () => {
    let graph: Graph<string>

    beforeEach(() => {
      graph = new Graph<string>()
      // 构建简单的十字形图
      //     D
      //     |
      // A - B - C
      //     |
      //     E
      graph.addVertex('A', 'Point A')
      graph.addVertex('B', 'Point B')
      graph.addVertex('C', 'Point C')
      graph.addVertex('D', 'Point D')
      graph.addVertex('E', 'Point E')

      graph.addEdge('A', 'B', 10)
      graph.addEdge('B', 'A', 10)
      graph.addEdge('B', 'C', 20)
      graph.addEdge('C', 'B', 20)
      graph.addEdge('B', 'D', 30)
      graph.addEdge('D', 'B', 30)
      graph.addEdge('B', 'E', 15)
      graph.addEdge('E', 'B', 15)
    })

    test('应该找到相邻节点的最短路径', () => {
      const result = dijkstra(graph, 'A', 'B')
      expect(result.distance).toBe(10)
      expect(result.path).toEqual(['A', 'B'])
    })

    test('应该找到多跳路径的最短距离', () => {
      const result = dijkstra(graph, 'A', 'C')
      expect(result.distance).toBe(30)
      expect(result.path).toEqual(['A', 'B', 'C'])
    })

    test('应该找到最优路径，而不是最短跳数', () => {
      // 添加更复杂的路由：A -> E 的两条路径
      //   路径 1: A -> B -> E (10 + 15 = 25)
      //   路径 2: A -> B -> D -> B -> C (最短跳数，但距离更长)
      const result = dijkstra(graph, 'A', 'E')
      expect(result.distance).toBe(25) // A -> B -> E
      expect(result.path).toEqual(['A', 'B', 'E'])
    })

    test('应该返回起点到自己的距离为 0', () => {
      const result = dijkstra(graph, 'A', 'A')
      expect(result.distance).toBe(0)
      expect(result.path).toEqual(['A'])
    })

    test('应该返回无法到达的节点为 Infinity', () => {
      // 创建不连通的图
      const disconnected = new Graph<string>()
      disconnected.addVertex('X', 'X')
      disconnected.addVertex('Y', 'Y')
      disconnected.addVertex('Z', 'Z')

      disconnected.addEdge('X', 'Y', 10)

      const result = dijkstra(disconnected, 'X', 'Z')
      expect(result.distance).toBe(Infinity)
      expect(result.path).toBeNull()
    })

    test('应该处理单个节点', () => {
      const single = new Graph<string>()
      single.addVertex('A', 'A')

      const result = dijkstra(single, 'A', 'A')
      expect(result.distance).toBe(0)
      expect(result.path).toEqual(['A'])
    })

    test('应该正确处理多条候选路径', () => {
      const complex = new Graph<string>()
      // 构建钻石形图
      //     B
      //   /   \
      //  A     D
      //   \   /
      //     C
      complex.addVertex('A', 'A')
      complex.addVertex('B', 'B')
      complex.addVertex('C', 'C')
      complex.addVertex('D', 'D')

      complex.addEdge('A', 'B', 1)
      complex.addEdge('A', 'C', 4)
      complex.addEdge('B', 'D', 1)
      complex.addEdge('C', 'D', 1)

      const result = dijkstra(complex, 'A', 'D')
      expect(result.distance).toBe(2) // A -> B -> D 或 A -> C -> D
      expect(result.path).toHaveLength(3)
    })
  })

  describe('TSP 旅行商问题算法', () => {
    let graph: Graph<string>

    beforeEach(() => {
      graph = new Graph<string>()
      // 构建 4 个节点的完全图
      for (const node of ['A', 'B', 'C', 'D']) {
        graph.addVertex(node, node)
      }

      // 添加所有边
      const edges = [
        ['A', 'B', 10],
        ['A', 'C', 15],
        ['A', 'D', 20],
        ['B', 'C', 35],
        ['B', 'D', 25],
        ['C', 'D', 30],
      ]

      for (const [from, to, weight] of edges) {
        graph.addEdge(from as string, to as string, weight as number)
        graph.addEdge(to as string, from as string, weight as number)
      }
    })

    test('应该返回包含所有节点的路径', () => {
      const result = tsp(graph, ['A', 'B', 'C', 'D'])
      expect(result).not.toBeNull()
      expect(result!.path).toHaveLength(4)
      expect(new Set(result!.path)).toEqual(new Set(['A', 'B', 'C', 'D']))
    })

    test('应该计算总距离', () => {
      const result = tsp(graph, ['A', 'B', 'C', 'D'])
      expect(result).not.toBeNull()
      expect(result!.distance).toBeGreaterThan(0)
    })

    test('应该找到接近最优的路径', () => {
      // 对于这个小实例，大多数启发式算法应该找到接近最优的解
      const result = tsp(graph, ['A', 'B', 'C', 'D'])
      expect(result).not.toBeNull()

      // 最优解应该较少于 100
      expect(result!.distance).toBeLessThan(150)
    })

    test('应该处理 3 个节点的情况', () => {
      const result = tsp(graph, ['A', 'B', 'C'])
      expect(result).not.toBeNull()
      expect(result!.path).toHaveLength(3)
    })

    test('应该处理重复请求', () => {
      const result1 = tsp(graph, ['A', 'B', 'C', 'D'])
      const result2 = tsp(graph, ['A', 'B', 'C', 'D'])

      // 两次应该返回相同或相似的结果
      expect(result1).not.toBeNull()
      expect(result2).not.toBeNull()
      expect(result1!.distance).toBe(result2!.distance)
    })
  })

  describe('真实场景模拟', () => {
    let campusGraph: Graph<string>

    beforeEach(() => {
      // 模拟校园场景
      campusGraph = new Graph<string>()

      const locations = ['entrance', 'plaza', 'dorm-a', 'dorm-b', 'canteen', 'library']

      for (const loc of locations) {
        campusGraph.addVertex(loc, loc)
      }

      // 添加路由（距离单位：米）
      const routes = [
        ['entrance', 'plaza', 100],
        ['plaza', 'dorm-a', 150],
        ['plaza', 'dorm-b', 200],
        ['plaza', 'canteen', 250],
        ['plaza', 'library', 300],
        ['dorm-a', 'dorm-b', 100],
        ['dorm-a', 'canteen', 200],
        ['canteen', 'library', 150],
        ['dorm-b', 'library', 250],
      ]

      for (const [from, to, distance] of routes) {
        campusGraph.addEdge(from as string, to as string, distance as number)
        campusGraph.addEdge(to as string, from as string, distance as number)
      }
    })

    test('应该规划从入口到任何地点的路线', () => {
      const destinations = ['dorm-a', 'canteen', 'library']

      for (const dest of destinations) {
        const result = dijkstra(campusGraph, 'entrance', dest)
        expect(result.distance).toBeLessThan(Infinity)
        expect(result.path).not.toBeNull()
        expect(result.path![0]).toBe('entrance')
        expect(result.path![result.path!.length - 1]).toBe(dest)
      }
    })

    test('应该计算合理的校园访问时间', () => {
      // 假设步行速度 1.5 m/s
      const result = dijkstra(campusGraph, 'entrance', 'canteen')
      const walkingSpeed = 1.5 // m/s
      const estimatedTime = result.distance / walkingSpeed

      expect(estimatedTime).toBeGreaterThan(0)
      expect(estimatedTime).toBeLessThan(3600) // < 1 小时是合理的
    })

    test('应该支持多点最优访问顺序', () => {
      const poiIds = ['entrance', 'plaza', 'canteen', 'library']
      const result = tsp(campusGraph, poiIds)

      expect(result).not.toBeNull()
      expect(result!.path).toHaveLength(4)
      expect(result!.distance).toBeGreaterThan(0)
    })
  })

  describe('边界情况', () => {
    test('应该处理空图', () => {
      const empty = new Graph<string>()
      expect(empty.getNeighbors('A')).toEqual([])
    })

    test('应该处理单节点图', () => {
      const single = new Graph<string>()
      single.addVertex('A', 'A')

      const result = dijkstra(single, 'A', 'A')
      expect(result.distance).toBe(0)
    })

    test('应该处理完全连接的图', () => {
      const complete = new Graph<string>()

      for (let i = 0; i < 5; i++) {
        complete.addVertex(String(i), String(i))
      }

      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          complete.addEdge(String(i), String(j), 10)
          complete.addEdge(String(j), String(i), 10)
        }
      }

      const result = dijkstra(complete, '0', '4')
      expect(result.distance).toBe(10) // 直接边
    })

    test('应该处理负权重（警告）', () => {
      // Dijkstra 不支持负权重，但应该不崩溃
      const hasNegative = new Graph<string>()
      hasNegative.addVertex('A', 'A')
      hasNegative.addVertex('B', 'B')
      hasNegative.addEdge('A', 'B', -10) // 不现实但应该处理

      // 不应抛出异常
      expect(() => dijkstra(hasNegative, 'A', 'B')).not.toThrow()
    })
  })
})
