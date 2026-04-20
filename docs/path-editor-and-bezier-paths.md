# 贝塞尔曲线路径编辑器 & 路径系统

> 更新日期: 2026-04-20
> 关联文件: `path-editor.html`, `path.js`, `levels.js`, `level-paths.json`

## 概述

关卡路径使用**二次贝塞尔曲线**定义。每段曲线有2个端点(p1, p2)和1个控制点(cp)，通过编辑器可视化拖拽编辑，保存到 `level-paths.json`，游戏运行时读取并采样为密集点数组。

## 数据流

```
编辑器 (path-editor.html)
    │
    │  保存
    ▼
level-paths.json          ← 编辑器直接读写此文件
    │                        格式: [{name, curves:[{p1,cp,p2},...], shooterPos}, ...]
    │
    │  fetch (游戏启动时)
    ▼
levels.js initLevels()
    │
    │  转换: curves → points 数组 (展平为每段3点)
    ▼
LEVELS[i].pathParams = { points: [...] }
LEVELS[i].pathType = "bezier"
    │
    │  createPath()
    ▼
path.js generateBezierPath()
    │
    │  每段贝塞尔曲线采样 50 个点 + 离屏入场段
    ▼
pathPoints: [{x, y, len}, ...]   ← 游戏运行时使用的密集点数组
```

## 数据格式

### level-paths.json（编辑器保存格式）

```json
[
  {
    "name": "第1关",
    "curves": [
      { "p1": {"x":395,"y":170}, "cp": {"x":270,"y":170}, "p2": {"x":145,"y":170} },
      { "p1": {"x":145,"y":170}, "cp": {"x":75,"y":170},  "p2": {"x":75,"y":350}  }
    ],
    "shooterPos": {"x":215, "y":466}
  }
]
```

- 每段曲线独立存储 `{p1, cp, p2}`，共3个点
- 曲线之间不绑定，但编辑时自动同步接合端点和镜像控制点（见下文）
- 端点吸附时自动对齐位置并镜像控制点实现 G1 连续

### levels.js pathParams.points（游戏使用格式）

```javascript
pathType: "bezier",
pathParams: {
  // 每段曲线固定3个点 (p1, cp, p2)，不去重
  points: [
    {x:395, y:170}, {x:270, y:170}, {x:145, y:170},  // 曲线1: p1, cp, p2
    {x:145, y:170}, {x:75, y:170},  {x:75, y:350},   // 曲线2: p1, cp, p2
  ]
}
```

编码规则：
- 每段曲线固定 3 个点：`[p1, cp, p2]`
- `points.length` 总是 3 的倍数
- 曲线之间可以连续（p2 ≈ 下段 p1）也可以拉开，存储格式不变
- `generateBezierPath` 按每 3 个点读一段曲线，采样时跳过距离 < 1px 的重复点

### 路径方向

```
屏幕右侧外 ──→ p1(第一段入口) ──→ 沿所有曲线 ──→ p2(最后一段出口) ──→ 终点
               ↑                                              ↑
            球入口(绿色)                                    球终点(红色)
```

- 第一段曲线的 **p1** = 球的入口点
- 最后一段曲线的 **p2** = 球的消失口（goal）
- 系统自动在 p1 右侧添加离屏水平入场段（`GAME_WIDTH + 100`）

## 路径编辑器 (path-editor.html)

### 操作

| 操作 | 说明 |
|------|------|
| 添加曲线 | 新曲线 p1 放在上一段 p2 位置，方便连续编辑 |
| 拖拽端点 | p1/p2 可自由拖拽，接合端点会同步移动 |
| 拖拽控制点 | cp 调整曲线弯曲程度，接合处自动镜像相邻 cp 保持平滑 |
| 端点吸附 | 拖拽端点接近另一端点（< 15px）时对齐，同时镜像控制点实现 G1 连续 |
| 删除曲线 | 选中后删除，不影响其他曲线 |
| 保存到文件 | 写入 `level-paths.json`（File System Access API，二次保存无需再选文件） |
| 从文件加载 | 读取 `level-paths.json`，覆盖当前编辑数据 |
| 复制本关 | 将当前关卡的 points 数组复制到剪贴板 |
| 上传参考图 | 选择截图作为半透明底图，方便描路径 |
| 调整参考图透明度 | 滑块控制 0%~100%，默认 40% |
| 调整参考图缩放 | 滑块控制 10%~300%，上传时自动适配游戏区域 |
| 移动参考图 | Option/Alt + 鼠标拖拽移动位置 |
| 重置参考图位置 | 重新居中并适配游戏区域 |
| 移除参考图 | 清除参考底图 |

### 界面标记

| 标记 | 含义 |
|------|------|
| 端点圆圈 `1A` / `1B` | 曲线1的入口(p1)和出口(p2) |
| 菱形 `C1` / `C2` | 曲线1/2的控制点(cp) |
| 颜色区分 | 6色循环：红、蓝、绿、琥珀、紫、青 |
| 绿色 `∿` 接合标记 | 两段曲线接合处已实现 G1 连续（平滑） |
| 橙色 `∠` 接合标记 | 两段曲线接合处未平滑（有折角） |
| 顶部120px遮罩 | HUD区域，路径应避开 |
| 左下角遮罩 | "选关"按钮位置 |

### 快捷键

- Ctrl+滚轮 / 捏合手势：缩放画布
- 普通滚轮/双指滑动：平移画布
- 空格+拖拽 / 中键拖拽：平移画布
- Option/Alt + 拖拽：移动参考底图

### G1 自动平滑

两段二次贝塞尔在接合点默认只有 C0 连续（位置对齐），控制点独立导致切线不连续会产生折角。编辑器通过自动镜像控制点实现 G1 连续：

- **拖拽控制点 (cp)**：若曲线的 p1 或 p2 与相邻曲线端点接合，自动将相邻曲线的 cp 镜像到接合点另一侧（共线且等距）
- **拖拽端点吸附**：吸附到目标端点后，自动镜像当前曲线的 cp 到邻居曲线的 cp
- **拖拽接合端点**：同步移动相邻曲线的对应端点，保持连接不断开
- **不级联**：只影响直接邻居，不会沿接合链传播到间接相连的曲线

## path.js 贝塞尔路径生成

### generateBezierPath(shooterX, shooterY, params)

1. 按每 3 个点读一段曲线（`params.points` 数组长度必须是 3 的倍数）
2. 对每段二次贝塞尔曲线采样 50 个点：`B(t) = (1-t)²·P1 + 2(1-t)t·CP + t²·P2`
3. 采样时跳过距离前一点 < 1px 的重复点（避免段间连接处重复）
4. 添加离屏入场段：水平直线 from `GAME_WIDTH + 100`
5. 返回密集点数组 `[{x, y}, ...]`

输出格式与其他路径类型（spiral, rectangular 等）完全一致，经过 `finalizePath()` 后生成 `{pathPoints, totalPathLength, cachedTrackPath}`。

## 其他路径类型

| pathType | 函数 | 使用关卡 | 说明 |
|----------|------|---------|------|
| `"spiral"` | `generateSpiralPath()` | 3, 8 | 阿基米德螺线 |
| `"rectangular"` | `generateRectangularPath()` | 2, 4, 6, 7 | 圆角矩形螺旋 |
| `"openArc"` | `generateOpenArcPath()` | 5 | 椭圆弧螺旋 |
| `"serpentine"` | `generateSerpentinePath()` | — | S形蛇形（预留） |
| `"zigzag"` | `generateZigzagPath()` | — | Z形折线（预留） |
| `"drawn"` | `generateDrawnPath()` | — | 旧版线段/弧线组合（已弃用） |
| `"bezier"` | `generateBezierPath()` | 1+ | 二次贝塞尔曲线（当前推荐） |

## 回退机制

- `level-paths.json` 存在：游戏启动时 `initLevels()` 加载，覆盖对应关卡的路径和射手位置
- `level-paths.json` 不存在或加载失败：使用 `levels.js` 中的硬编码默认值
- 非贝塞尔关卡（spiral, rectangular 等）：不受 `level-paths.json` 影响，始终使用 `levels.js` 的参数
