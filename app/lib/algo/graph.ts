/**
 * 图表数据结构 - 用于导航系统
 * 支持加权有向图，适用于路由规划和最短路径算法
 */

export class Graph<T> {
  private vertices: Map<T, string> = new Map()
  private adjacencyList: Map<T, Map<T, number>> = new Map()

  /**
   * 添加顶点到图表
   * @param vertex 顶点标识符
   * @param label 顶点标签（如地点名称）
   */
  addVertex(vertex: T, label?: string): void {
    if (!this.vertices.has(vertex)) {
      this.vertices.set(vertex, label || String(vertex))
      this.adjacencyList.set(vertex, new Map())
    }
  }

  /**
   * 添加加权边
   * @param from 起点
   * @param to 终点
   * @param weight 权重（距离）
   */
  addEdge(from: T, to: T, weight: number): void {
    if (!this.adjacencyList.has(from)) {
      this.addVertex(from)
    }
    if (!this.adjacencyList.has(to)) {
      this.addVertex(to)
    }

    this.adjacencyList.get(from)!.set(to, weight)
  }

  /**
   * 检查顶点是否存在
   */
  hasVertex(vertex: T): boolean {
    return this.vertices.has(vertex)
  }

  /**
   * 获取顶点的所有邻接点
   */
  getNeighbors(vertex: T): T[] {
    return Array.from(this.adjacencyList.get(vertex)?.keys() || [])
  }

  /**
   * 获取边的权重
   */
  getEdgeWeight(from: T, to: T): number {
    return this.adjacencyList.get(from)?.get(to) ?? Infinity
  }

  /**
   * 获取所有顶点
   */
  getVertices(): T[] {
    return Array.from(this.vertices.keys())
  }

  /**
   * 获取顶点标签
   */
  getVertexLabel(vertex: T): string {
    return this.vertices.get(vertex) ?? String(vertex)
  }
}
