# Huffman 设计说明

## 目标

这份设计用于游记广场的日记压缩增强页，后续会支撑以下功能：

- Huffman 压缩与解压
- 压缩树可视化
- 原文 / 压缩文对照
- 压缩率与节省比例展示

## 设计原则

- 先定义数据契约，再实现算法与 UI。
- 算法输出必须同时服务“展示”和“回放/验证”。
- 树结构、编码表、对照表三者共享同一份源数据，避免前后端语义漂移。

## 数据分层

### 1. 源 token 层

把输入文本切成 token。默认按字符切分，未来可扩展到按词或按句。

字段：

- `id`：token 的稳定标识
- `value`：token 原文
- `frequency`：频次
- `weight`：构建树时使用的权重

### 2. Huffman 树层

每个节点都可以被唯一引用，便于前端高亮和树视图联动。

字段：

- `id`：节点 ID
- `kind`：`leaf`、`internal`、`root`
- `weight`：节点权重
- `depth`：节点深度
- `tokenId` / `tokenValue`：叶子节点才有值
- `code`：从根到该节点的路径编码前缀
- `leftId` / `rightId` / `parentId`：树关系

### 3. 编码映射层

用于把 token 和 Huffman 编码一一对应起来。

字段：

- `tokenId`
- `tokenValue`
- `code`
- `codeLength`
- `frequency`
- `weight`

### 4. 压缩对照层

用于页面中的“原文 / 压缩文”逐段对照。

字段：

- `index`：片段序号
- `source`：原始片段
- `tokenValue`：对应 token
- `code`：编码结果
- `bitLength`：编码长度
- `cumulativeBitsBefore` / `cumulativeBitsAfter`

### 5. 可视化布局层

用于树图渲染，不参与压缩逻辑本身。

字段：

- `x` / `y`
- `width` / `height`
- `highlight`
- `bit`：边上的 0 / 1

## 核心输出对象

建议后续 Huffman 构建函数返回统一结果：

- `summary`：压缩摘要
- `tokens`：源 token 列表
- `nodes`：完整树节点
- `codeMap`：编码映射
- `segments`：对照片段
- `layout`：树可视化布局
- `encodedText`：压缩串
- `paddingBits`：补位长度

## UI 结构建议

页面分成三块：

1. 压缩摘要
2. 压缩树可视化
3. 原文 / 压缩文对照

### 压缩树可视化

- 根节点置顶
- 叶子节点显示 token 与频次
- 内部节点只显示权重
- 选中某个 token 时，高亮该叶子、到根路径及对应编码边

### 原文 / 压缩文对照

- 左侧显示原文分段
- 中间显示 token 和 Huffman code
- 右侧显示累计 bit 数与节省比例
- 支持逐条展开查看

## 后续实现顺序

1. 先实现 Huffman 构建与编码表
2. 再补树布局和高亮状态
3. 再做对照表和摘要卡片
4. 最后接入日记详情页与写作页

## 约束

- 空文本必须可处理
- 单字符文本必须可处理
- 需要有稳定的节点 ID，避免前端重绘时丢失状态
- 需要保留原始文本和压缩文本的映射关系，便于解码验证
