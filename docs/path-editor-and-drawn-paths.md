# 路径编辑器 & 自定义绘制路径 (Drawn Path)

> 创建日期: 2026-04-20
> 关联文件: `path-editor.html`, `path.js`, `levels.js`, `render.js`

## 概述

在 Phase 4 多关卡系统的基础上，我们新增了 **自定义绘制路径 (drawn path)** 系统，允许通过组合 `line`、`arc`、`circle` 三种几何段来自由构建关卡轨道。同时配套开发了 **路径编辑器** (`path-editor.html`)，提供可视化编辑、实时预览和导出功能。

## 架构设计

### 路径段类型 (Segment Types)

```
line:   { type:"line",   x1, y1, x2, y2 }
arc:    { type:"arc",    cx, cy, radius, startAngle, endAngle }
circle: { type:"circle", cx, cy, radius, startAngle, turns }
```

- **line** — 直线段，从 (x1,y1) 到 (x2,y2)
- **arc** — 圆弧段，圆心 (cx,cy)、半径 radius、从 startAngle 到 endAngle（弧度）
- **circle** — 完整/多圈圆，turns 表示圈数（可为负数表示反向）

### 段间自动连接 (Auto-Connect)

路径生成器 (`generateDrawnPath`) 在段之间自动处理间隙：

| 间隙大小 | 处理方式 |
|---------|---------|
| < 15px  | **吸附 (Snap)** — 将下一段起点移到上一段终点 |
| ≥ 15px  | **桥接 (Bridge)** — 自动插入直线连接两段 |

同时对首尾重叠点做去重处理（距离 < 2px 跳过第一个点）。

### 入场段 (Entry Segment)

所有路径类型都有一个从屏幕右侧外部延伸至路径起点的入场段。对于 drawn 路径，使用 **水平直线** 入场（从 `GAME_WIDTH + 100` 到路径首点），保持 y 坐标恒定，避免贝塞尔曲线入场导致的弯曲。

## 路径编辑器 (path-editor.html)

### 功能清单

| 功能 | 说明 |
|-----|------|
| 添加段 | 点击工具栏的 line / arc / circle 按钮，新段自动衔接上一段终点 |
| 拖拽编辑 | 直线端点、圆弧中心/起止角手柄、圆心等均可拖拽 |
| 旋转手柄 | 紫色菱形手柄，旋转圆弧整体（startAngle 和 endAngle 同步偏移） |
| 翻转 | ↔ 水平翻转 / ↕ 垂直翻转（绕起点翻转，不产生间隙） |
| 弧度控制 | 侧栏输入框调整 arc span（以 π 为单位），快捷按钮 0.5π/1π/1.5π/2π |
| 反向弧线 | 保持 startAngle 不变，取反 span（endAngle = startAngle - span） |
| 导出 | 将编辑结果输出为 `levels.js` 可用的 segments 数组 |

### 核心设计决策

#### 1. 增量角度更新 (Delta-based Angle Update)

拖拽角度手柄时不直接用 `Math.atan2` 赋值，而是计算每帧的角度增量 delta：

```javascript
const newAngle = Math.atan2(dy, dx);
const delta = newAngle - lastDragAngle;
seg.startAngle += delta;
lastDragAngle = newAngle;
```

**原因**: 直接赋值在 ±π 边界处会产生跳变（atan2 值域为 [-π, π]），增量更新避免了此问题。

#### 2. 翻转绕起点 (Flip Around Start Point)

翻转弧线时，将圆心镜像到起点的对侧，然后从新圆心重新计算角度：

```javascript
const startX = cx + cos(startAngle) * radius;
const startY = cy + sin(startAngle) * radius;
// 水平翻转：镜像 cy 到 startY 对侧
seg.cy = 2 * startY - seg.cy;
seg.startAngle = atan2(startY - seg.cy, startX - seg.cx);
seg.endAngle = seg.startAngle - span;  // 取反 span
```

**原因**: 绕圆心翻转会改变起点位置，导致与前一段产生间隙；绕起点翻转保持连接点不变。

#### 3. 默认 90° 弧线

新建弧线默认 90°（startAngle=-π/2, endAngle=0），方便制作圆角矩形。圆心自动偏移使弧线起点对齐上一段终点。

## 关卡示例: Level 1 — C 形圆角矩形

```
       ←←←←←←←←←←  (顶部直线: 395→145, y=296)
      ↙               ↖ 入场 (从屏幕右侧水平进入)
     ↓  (左弧: 圆心145,366 半径70)
     ↓
     ↓  (左侧直线: 75, 366→566)
     ↓
     ↓  (左弧: 圆心145,566 半径70)
      ↘
       →→→→→→→→→→  (底部直线: 145→395, y=636)
```

- C 形开口朝右
- 射手位置: (215, 466) — C 形内部居中
- 两个 90° 弧线将直线段连接为圆角

### segments 定义

```javascript
segments: [
  { type:"line", x1:395, y1:296, x2:145, y2:296 },         // 顶部横线
  { type:"arc",  cx:145, cy:366, radius:70,                 // 左上圆角
    startAngle:-Math.PI/2, endAngle:-Math.PI },
  { type:"line", x1:75, y1:366, x2:75, y2:566 },           // 左侧竖线
  { type:"arc",  cx:145, cy:566, radius:70,                 // 左下圆角
    startAngle:Math.PI, endAngle:Math.PI/2 },
  { type:"line", x1:145, y1:636, x2:395, y2:636 },         // 底部横线
]
```

## 渲染支持

### 关卡选择缩略图

`render.js` 中的 `drawPathThumbnail` 函数为 `drawn` 路径类型新增了缩略图渲染逻辑：
- 计算所有段的包围盒
- 等比缩放到缩略图区域
- 逐段绘制（line 直接画线，arc/circle 采样绘制）

### openArc 路径缩略图

同时为 `openArc` 路径类型补充了缺失的缩略图渲染。

## path.js 新增路径类型

| 路径类型 | 函数 | 说明 |
|---------|------|------|
| `"drawn"` | `generateDrawnPath()` | 自由组合 line/arc/circle 段 |
| `"openArc"` | `generateOpenArcPath()` | 椭圆弧螺旋，类似断月形 |

两者都通过 `createPath` 的 `switch` 语句接入。

## 遇到的问题与解决方案

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 弧线拖拽在 ±π 边界跳变 | `atan2` 值域不连续 | 改用增量 delta 更新 |
| 新弧线与前段产生连接线 | 起点未对齐前段终点 | 偏移圆心使起点 = lastPt |
| 反向弧线产生额外连接线 | 交换 start/end 改变了起点 | 保持 startAngle，取反 span |
| 翻转后产生间隙 | 绕圆心翻转改变起点 | 改为绕起点翻转（镜像圆心） |
| 微小间隙产生多余小线段 | 旋转后浮点误差 | < 15px 间隙直接吸附 |
| 入场弯曲 | 贝塞尔曲线入场 | 改为水平直线入场 |
| 页面无法加载 | `entryPts` 作用域错误 | `return` 移入 `if` 块内 |

## 使用路径编辑器的工作流

1. 打开 `path-editor.html`（需 HTTP 服务器）
2. 使用工具栏添加 line/arc/circle 段
3. 拖拽手柄调整形状、使用侧栏精调参数
4. 使用翻转/旋转/弧度调整完善路径
5. 导出 segments 数组
6. 粘贴到 `levels.js` 对应关卡的 `pathParams.segments` 中
7. 设置 `pathType: "drawn"` 和合适的 `shooterPos`
