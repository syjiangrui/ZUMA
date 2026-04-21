# 贝塞尔曲线路径编辑器 & 路径系统

> 更新日期: 2026-04-21
> 关联文件: `path-editor.html`, `path-fit.js`, `path.js`, `levels.js`, `level-paths.json`

## 概述

关卡路径支持两种曲线族，**每关二选一**：

- **二次贝塞尔**（quadratic，每段 `p1, cp, p2`） — 原有工作流：Waypoint 骨架 + 一键拟合，或笔刷模式自由画线再自动转曲线
- **三次贝塞尔**（cubic，每段 `p1, cp1, cp2, p2`） — 新增 Illustrator 风格钢笔工具直接产出，两个独立切线手柄，能更精确拼接 G1 光滑曲线

quadratic 不会默认升级；只有用户显式进入钢笔模式时才会把当前关整体升级为 cubic（**精确等价升级**，曲线形状像素级不变）。

## 数据流

```
编辑器 (path-editor.html)
    │
    │  保存: pathType + curves + waypoints
    ▼
level-paths.json          ← 编辑器直接读写此文件
    │
    │  quadratic: [{p1, cp, p2}, ...]
    │  cubic:     [{p1, cp1, cp2, p2, smooth}, ...]
    │
    │  fetch (游戏启动时)
    ▼
levels.js initLevels()
    │
    │  按 data[i].pathType 分流（或检测 curves 是否含 cp2 做兜底）
    │  quadratic → 展平为每段 3 点
    │  cubic     → 展平为每段 4 点
    ▼
LEVELS[i].pathParams = { points: [...] }
LEVELS[i].pathType = "bezier" (quadratic 保留旧字符串) | "cubic"
    │
    │  createPath()
    ▼
path.js generateBezierPath() | generateCubicBezierPath()
    │
    │  每段曲线采样 50 个点 + 离屏入场段
    ▼
pathPoints: [{x, y, len}, ...]   ← 游戏运行时使用的密集点数组
cachedTrackPath: Path2D           ← 渲染直接 stroke 原始曲线，不走采样点
```

## 编辑模式

编辑器现在有三个互斥的创作模式：

| 模式 | 适用 | 输出 | 默认曲线族 |
|------|------|------|--------|
| `◎ Waypoint` | 先摆骨架、再算控制点 | 调用 `fitQuadraticChain` 自动分段 | quadratic（cubic 模式下结果会自动升级） |
| `✎ 笔刷` | 自由画线、路径跟随手感 | 调用 `fitBrushStrokeToCurves` 拟合 | quadratic（cubic 模式下结果会自动升级） |
| `✒ 钢笔` | 精确控制 + G1 平滑拼接 | 用户亲手摆每对控制手柄 | **cubic（进入时整关升级）** |

同一关不能混用 quadratic 和 cubic 段；任意模式的输出都会自动归一到当前关的曲线族。

## Waypoint 拟合工作流

1. 开 `◎ Waypoint` 模式，在路径关键转折处点击布点
2. 拖拽点位，把大形先摆准；需要补点时直接点折线附近插入
3. 调 `平滑` 和 `误差`，点击 `⟳ 一键拟合`
4. 如果局部仍不满意，可以继续拖 waypoint 再拟合，或切回曲线模式微调单个 control point

拟合算法在 `path-fit.js`，核心是**带误差控制的自适应二次曲线分段**：

- 先把 waypoint 折线加密成均匀 polyline，避免长边/短边对拟合造成偏置
- 用局部邻域估计每个采样点的切线方向
- 对一段 polyline 两端，求两条切线射线的交点作为二次贝塞尔控制点
- 计算这段曲线对原 polyline 的最大误差
- 若误差超过阈值，就在误差最大的采样点处分裂，再递归拟合
- 对大拐角先按角度阈值切 chunk，尽量保留"祖玛式"明确转弯

**cubic 模式下的拟合**：`fitQuadraticChain` 仍产出二次贝塞尔中间结果，随后立即用精确公式升级为三次贝塞尔，用户无感。

## 钢笔工具（三次贝塞尔）

Illustrator / Figma / Photoshop 风格的钢笔工具，适合"作者对形状有明确预期、希望手动控制每条切线"的场景。进入钢笔模式时：

- 如果当前关是 quadratic 且 `curves.length > 0`，弹窗确认"将本关升级为三次贝塞尔"；用户取消则不进入
- 升级前会保存 `level._preCubicSnapshot`；若整个钢笔会话结束时没有任何修改，自动还原为 quadratic
- 已是 cubic 的关直接进入，不弹窗

### 交互

| 操作 | 行为 |
|------|------|
| **单击**空白 | 放置尖角锚点（cp1=p1 或 cp2=p2 退化） |
| **按下拖拽** | 放置对称手柄（G1 光滑拼接），产生经典"钢笔出手柄"手感 |
| **Alt + 拖拽** | 断开对称，手柄独立（`smooth: false`） |
| **Shift + 拖拽** | 手柄角度吸附到 45° 倍数 |
| **单击已有锚点** | 选中，用于 C 键或拖拽调整 |
| **选中锚点 + C** | 在"尖角 ↔ 平滑"之间切换（见下文算法） |
| **拖拽 cp1 / cp2** | 移动单侧手柄；若 `smooth=true` 且有邻接段，另一侧手柄自动镜像 |
| **拖拽 p1 / p2** | 平移锚点，两侧手柄随之平移（局部形状不变） |
| **Backspace / Delete** | 删除最后一个锚点（或回退到 IDLE） |
| **Enter / Esc** | 结束当前路径，进入 EDITING 子状态 |
| **Ctrl** 按住 | 临时切换为选择工具 |
| **空格** 按住 | 临时切换为画布平移 |

状态机：`IDLE → CREATING → DRAGGING_HANDLE → CREATING → ... → (Enter/Esc) → EDITING`

### C 键平滑算法（角 → 平滑）

用户选中一个尖角锚点（cp1=p1 或 cp2=p2 退化）按 C，算法生成一对对称手柄：

1. **确定两侧的邻居曲线**
   - `incoming`：结束于该锚点（其 cp2 是入手柄），`outgoing`：从该锚点开始（其 cp1 是出手柄）
   - 链首/链尾其中一侧为 null

2. **用弦方向估计切线**
   - `inDir = normalize(anchor - incoming.p1)`
   - `outDir = normalize(outgoing.p2 - anchor)`
   - 弦 = 段两端点 p1→p2 的直线向量，**不考虑当前 cp 的位置**

3. **共享切线 = 两个弦方向的平均**
   - `tangent = normalize(inDir + outDir)`
   - 两侧反向（U 形尖角）时退化 → fallback 为 `outDir`
   - 只有一侧存在时直接用那一侧

4. **手柄长度 = 弦长 × 0.35**（每侧独立，`max(8, ...)` 防零长）

5. **沿切线反向/正向放置**
   - `incoming.cp2 = anchor - tangent × inLen`
   - `outgoing.cp1 = anchor + tangent × outLen`

结果：两手柄共线穿过锚点，曲线在锚点处 **G1 连续**（切线方向一致，长度可不同）。再按一次 C 把两侧手柄都收回到锚点（变回尖角）。

### G1 自动镜像（拖拽时）

钢笔模式下拖手柄（cp1/cp2）时：

- 若 `smooth !== false` 且锚点与相邻段接合（`findCubicJoinNeighbor`），另一侧手柄自动**位置对称**镜像过来 —— 保证 G1 光滑
- Alt 按住：临时破对称，只移动当前手柄，并把 `smooth` 置 false
- 拖动锚点（p1/p2）时，两侧手柄跟随平移（anchor 局部坐标系不变）

## 数据格式

### level-paths.json（quadratic）

```json
[
  {
    "name": "第1关",
    "pathType": "quadratic",
    "curves": [
      { "p1": {"x":395,"y":170}, "cp": {"x":270,"y":170}, "p2": {"x":145,"y":170} },
      { "p1": {"x":145,"y":170}, "cp": {"x":75,"y":170},  "p2": {"x":75,"y":350}  }
    ],
    "waypoints": [
      { "x":395, "y":170 },
      { "x":145, "y":170 },
      { "x":75,  "y":350 }
    ],
    "shooterPos": {"x":215, "y":466}
  }
]
```

- 每段曲线独立存储 `{p1, cp, p2}`，共 3 个点
- 曲线之间不绑定，但编辑时自动同步接合端点和镜像控制点

### level-paths.json（cubic）

```json
[
  {
    "name": "第1关",
    "pathType": "cubic",
    "curves": [
      {
        "p1": {"x":395,"y":170}, "cp1": {"x":335,"y":170},
        "cp2": {"x":205,"y":170}, "p2": {"x":145,"y":170},
        "smooth": true
      }
    ],
    "waypoints": [],
    "shooterPos": {"x":215, "y":466}
  }
]
```

- 每段曲线存储 `{p1, cp1, cp2, p2, smooth}`，共 4 个控制点 + 1 个锚点平滑标志
- `smooth` 描述 **p1 锚点**自身：true = 与前段保持 G1 平滑（拖拽时联动），false = 尖角（拖拽时不联动）
- 相邻段的锚点（`prev.p2` 与 `curr.p1`）在编辑器里会自动对齐

### 向后兼容

旧 `level-paths.json`（无 `pathType` 字段）加载时：

- 若 `curves.some(c => c.cp1 && c.cp2)` → 识别为 cubic
- 否则按 quadratic 解析
- `pathType` 缺省时 levels.js 兜底逻辑同上

保存时 quadratic 文件会比旧版多一个 `"pathType": "quadratic"` 字段，但游戏侧兼容缺失该字段的情况。

### levels.js pathParams.points（游戏使用格式）

```javascript
// quadratic
pathType: "bezier",
pathParams: {
  points: [
    {x:395, y:170}, {x:270, y:170}, {x:145, y:170},  // 每段 3 点
    {x:145, y:170}, {x:75, y:170},  {x:75, y:350},
  ]
}

// cubic
pathType: "cubic",
pathParams: {
  points: [
    {x:395, y:170}, {x:335, y:170}, {x:205, y:170}, {x:145, y:170},  // 每段 4 点
  ]
}
```

- quadratic：`points.length` 是 3 的倍数
- cubic：`points.length` 是 4 的倍数
- 采样时跳过距离 < 1px 的重复点
- **旧的 `"bezier"` 字符串保留为 quadratic 别名**，老关卡无需改动

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

### 工具栏

| 按钮 | 说明 |
|------|------|
| ＋ 添加曲线 | 根据当前 pathType 创建一段新曲线（quadratic 3 点 / cubic 4 点） |
| ✒ 钢笔 | 进入钢笔模式（Illustrator 风格，三次贝塞尔） |
| ◎ Waypoint | 点击布点 → 一键拟合工作流 |
| ✎ 笔刷 | 自由画线 → 自动拟合贝塞尔 |
| ≈ 平滑接头 | 手动触发 G1 接头对齐（quadratic / cubic 分别走不同实现） |
| ⟳ 重拟合 | 全局重采样并重新拟合，段数可能变 |
| ✕ 删除选中 | 删除当前选中曲线或锚点 |
| 清空 | 清空当前关所有曲线与 waypoint |

### 界面标记

| 标记 | 含义 |
|------|------|
| 实心圆圈 `1A` / `1B` | 曲线 1 的入口(p1)和出口(p2)锚点 |
| 菱形 `C1` | quadratic 曲线 1 的控制点(cp) |
| 空心小圆 `H1a` / `H1b` | cubic 曲线 1 的两个手柄(cp1 / cp2) |
| 颜色区分 | 6 色循环：红、蓝、绿、琥珀、紫、青 |
| 绿色 `∿` 接合标记 | 两段曲线接合处已实现 G1 连续（平滑） |
| 橙色 `∠` 接合标记 | 两段曲线接合处未平滑（有折角） |
| 路径底栏文字 | `二次 / 三次  \|  路径长度  \|  球链长度  \|  剩余  \|  曲线段数` |
| 顶部 120px 遮罩 | HUD 区域，路径应避开 |
| 左下角遮罩 | "选关"按钮位置 |

### 命中优先级

钢笔模式下点击锚点 / 手柄时，按**距离最近**命中，锚点有 +3px 优先级（tie 时锚点赢）。这样当 cp1 和 p1 同位重合（尖角态）时，点击会先选中锚点而不是手柄，保证 C 键等锚点快捷操作可用。

非钢笔模式保持旧的"手柄优先"顺序，不破坏 quadratic 旧行为。

### 快捷键

- `Ctrl + 滚轮` / 捏合手势：缩放画布
- 普通滚轮 / 双指滑动：平移画布
- `空格 + 拖拽` / 中键拖拽：平移画布
- `Option / Alt + 拖拽`：移动参考底图（非钢笔模式下）
- `Delete / Backspace`：删除当前选中 waypoint / 曲线 / 钢笔最后锚点
- 钢笔模式额外快捷键：Alt / Shift / C / Ctrl / Enter / Esc（见上文）

### 升级快照机制

进入钢笔模式时，若当前关是 quadratic 且 `curves.length > 0`：

1. 弹出 confirm 确认
2. 保存 `level._preCubicSnapshot = { curves, pathType, waypoints }`
3. 用 `upgradeLevelToCubic()` 精确升级（每段 `cp1 = p1 + 2/3·(cp - p1)`, `cp2 = p2 + 2/3·(cp - p2)`，曲线形状像素级不变）
4. 标志 `penTouched = false`

退出钢笔模式时：

- 若 `penTouched === false`：从快照还原 quadratic 形态
- 若有任何改动（加锚点 / 拖手柄 / C 键 / Backspace）：保留 cubic 形态，丢弃快照

这保证用户误点 ✒ 钢笔按钮且立即退出时，关卡不会被悄悄变更。

## path.js 贝塞尔路径生成

游戏侧 `path.js` 不需要知道 waypoint；它只消费 `curves` 展平后的 `pathParams.points`。

### generateBezierPath(shooterX, shooterY, params)（quadratic）

1. 按每 3 个点读一段曲线（`params.points` 长度必须是 3 的倍数）
2. 每段采样 50 个点：`B(t) = (1-t)²·P1 + 2(1-t)t·CP + t²·P2`
3. 跳过距离前一点 < 1px 的重复点
4. 用 `quadraticCurveTo()` 写入 `Path2D`（渲染侧直接 stroke，不走采样点折线）
5. 添加离屏入场段：水平直线 from `GAME_WIDTH + 100`
6. 返回 `{ sampled, renderPath }`

### generateCubicBezierPath(shooterX, shooterY, params)（cubic）

1. 按每 4 个点读一段曲线（`params.points` 长度必须是 4 的倍数）
2. 每段采样 50 个点：`C(t) = (1-t)³·P1 + 3(1-t)²t·CP1 + 3(1-t)t²·CP2 + t³·P2`
3. 跳过距离前一点 < 1px 的重复点
4. 用 `bezierCurveTo()` 写入 `Path2D`
5. 添加离屏入场段（同 quadratic）
6. 返回 `{ sampled, renderPath }`

两者的输出结构完全一致，交给 `finalizePath()` 计算累计弧长，产出 `{ pathPoints, totalPathLength, cachedTrackPath }`。

**渲染端完全不区分**：`render.js` 只 `ctx.stroke(game.cachedTrackPath)`，Path2D 内部是 `quadraticCurveTo` 还是 `bezierCurveTo` 对它透明。

## 其他路径类型

| pathType | 函数 | 使用关卡 | 说明 |
|----------|------|---------|------|
| `"spiral"` | `generateSpiralPath()` | 3, 8 | 阿基米德螺线 |
| `"rectangular"` | `generateRectangularPath()` | 2, 4, 6, 7 | 圆角矩形螺旋 |
| `"openArc"` | `generateOpenArcPath()` | 5 | 椭圆弧螺旋 |
| `"serpentine"` | `generateSerpentinePath()` | — | S 形蛇形（预留） |
| `"zigzag"` | `generateZigzagPath()` | — | Z 形折线（预留） |
| `"drawn"` | `generateDrawnPath()` | — | 旧版线段/弧线组合（已弃用） |
| `"bezier"` / `"quadratic"` | `generateBezierPath()` | 1 | 二次贝塞尔曲线 |
| `"cubic"` | `generateCubicBezierPath()` | — | 三次贝塞尔曲线（钢笔产出） |

## 回退机制

- `level-paths.json` 存在：游戏启动时 `initLevels()` 加载，覆盖对应关卡路径与射手位置
- `level-paths.json` 不存在或加载失败：使用 `levels.js` 中的硬编码默认值
- 非贝塞尔关卡（spiral, rectangular 等）：不受 `level-paths.json` 影响，始终使用 `levels.js` 参数

## 不支持的功能

- **闭合路径**（绕圈关卡）：钢笔与 quadratic 都不支持 "路径首尾自动相连"，未来若要做绕圈关卡需要在球链循环逻辑里单独支持
- **cubic → quadratic 降级**：不提供。一旦整关变成 cubic 就只能手动清空重做，或从 JSON 手工改回 quadratic 格式
