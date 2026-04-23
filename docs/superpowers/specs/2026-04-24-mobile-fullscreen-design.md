# 移动端全屏适配 — 设计文档

**日期**: 2026-04-24
**目标**: 让 ZUMA 在移动设备上真正全屏展示，覆盖刘海/灵动岛/home indicator 区域，同时保持 430:932 游戏世界比例不变。

## 背景与问题

当前布局（`index.html` + `src/style.css`）把 `430×932` 的游戏 Canvas 作为一个带圆角、带阴影、四周有 safe-area 内边距的"仿手机框"居中在屏幕里。这在桌面浏览器的预览中是合理的，但在真实手机上造成两个问题：

1. Canvas 周围有大块不可用的深色边框，游戏只占屏幕大约 70–85% 面积
2. 刘海/灵动岛/home bar 区域因 safe-area 被避开，留下黑色/深色条带

用户期望的体验是：画面像大部分手机游戏一样铺满整个屏幕，比例差值部分由背景自然延伸填充，不出现任何黑边。

## 设计原则

1. **不改游戏世界坐标系**。逻辑画布仍是 `430 × 932`，物理/HUD/路径/碰撞/命中判定完全不动。
2. **改变的只是 Canvas 的物理尺寸 + 一次性的全局仿射变换**。玩法区在屏幕上居中并按比例缩放；比例差值由背景渐变延伸填充。
3. **性能不回归**。既有缓存（`staticSceneCache`、`cachedTrackPath`、`ballBaseCache`、`frogCache*`、`hudPanelCache`）尽量复用；仅背景缓存在 resize 时失效。

## 视口模型（新增 `game.viewport`）

`ZumaGame` 实例新增一个 `viewport` 字段，每次 `resize()` 时重新计算：

```
screenW = window.innerWidth            // CSS 像素
screenH = window.innerHeight           // CSS 像素（等价于 100dvh）
scale   = Math.min(screenW / 430, screenH / 932)
offsetX = (screenW - 430 * scale) / 2
offsetY = (screenH - 932 * scale) / 2
dpr     = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
```

含义：`scale` 是保持 430:932 比例、能完整装下玩法区的最大等比缩放。`offsetX/offsetY` 是玩法区在屏幕上的左上角偏移，用来居中。典型设备下 `offsetY > 0 且 offsetX = 0`（屏幕比玩法区更长），或 `offsetX > 0 且 offsetY = 0`（屏幕比玩法区更短/更胖）。

Canvas 物理后备尺寸 = `screenW * dpr × screenH * dpr`；CSS 尺寸 = `screenW × screenH`。

## 渲染流程改动

`src/render/index.js` 的 `render(game)` 入口改为：

1. **重置变换**：`ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`，进入"屏幕像素"坐标系。
2. **全屏背景**：调用改写后的 `drawBackground(game, ctx)`，目标矩形是 `(0, 0, screenW, screenH)`，而不是 `(0, 0, 430, 932)`。背景逻辑本体（青绿顶 → 墨绿底的径向+线性渐变）不变，只是尺寸变量从常量换成 `viewport.screenW/screenH`。
3. **切入玩法区坐标**：`ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offsetX * dpr, offsetY * dpr)`。此后 `(x=0,y=0)` 对应玩法区左上角，`(430,932)` 对应右下角。
4. **复用既有绘制**：`drawTrack`、`drawGoal`、`drawChain`、`drawProjectile`、`drawShooter`、HUD、末日卡片、关卡选择、匹配反馈 —— **全部原样调用，完全不改坐标**。
5. Per-level 背景图的 clip 仍是 `(0, 0, 430, 932)`；图片只贴玩法区，不跨到延伸的背景带上。

### `staticSceneCache` 的处理

当前 `staticSceneCache` 是一张 `430×932` 的离屏画布，包含背景渐变 + 可选的关卡背景图 + 轨道。全屏后它被拆成两层：

- **新的"屏幕背景缓存"**（`screenBgCache`）：只画全屏的青绿→墨绿渐变，尺寸 = `screenW × screenH`（物理像素乘 dpr）。在 resize 时失效重建。每帧在步骤 2 中 `drawImage` 一次。
- **保留的"玩法区静态缓存"**（继续复用现有 `staticSceneCache` 字段）：画 430×932 内的 goal（终点门） + 可选关卡背景图 + 轨道，尺寸不变、不受 resize 影响。在步骤 4 开始处 `drawImage` 一次。其中原本放在里面的"渐变背景"要从这张缓存中拿掉（背景由新的 `screenBgCache` 全屏承担）。

这样拆分的好处是 resize 时不用重建 goal/轨道/关卡图（昂贵），只重建一张全屏渐变（便宜）。

## 输入映射改动

`updatePointer(event)` 当前逻辑：
```js
const rect = this.canvas.getBoundingClientRect();
const scaleX = GAME_WIDTH / rect.width;
const scaleY = GAME_HEIGHT / rect.height;
this.pointer.x = (event.clientX - rect.left) * scaleX;
this.pointer.y = (event.clientY - rect.top) * scaleY;
```

改为基于 viewport：
```js
const rect = this.canvas.getBoundingClientRect();
const { scale, offsetX, offsetY } = this.viewport;
const screenX = event.clientX - rect.left;
const screenY = event.clientY - rect.top;
this.pointer.x = (screenX - offsetX) / scale;
this.pointer.y = (screenY - offsetY) / scale;
```

当点击落在玩法区外（背景延伸区）时，`pointer.x/y` 会是负数或 > 430/932。所有 HUD 和关卡按钮的热区判定 (`isPointInsideRect`、`getUiActionAt`) 都基于玩法区内坐标，自然不会误命中，无需任何改动。

## CSS / DOM 改动

### `index.html`

- 移除已隐藏的 `<section class="hud">`（仅 DOM 噪声）。
- `<main class="app-shell">` 改为简单容器（也可直接把 `<canvas>` 放到 `<body>` 下）。
- `<meta viewport>` 保留 `viewport-fit=cover`（关键：iOS 下 canvas 才能画到刘海区）。

### `src/style.css`

删除的内容：
- `--shell-pad-*` safe-area 变量
- `.app-shell` 的 `padding`
- `.game-frame` 的 `grid`/`place-items`
- `#gameCanvas` 的 `aspect-ratio`、`border-radius`、`box-shadow`、`background`、`width: min(...)`
- 700px 断点里的 `--shell-pad-top` 覆写
- `.hud` 及其子元素的样式（DOM 已删）

保留/新增的内容：
```css
html, body {
  margin: 0;
  height: 100%;
  background: #000;    /* 防止渲染空隙时闪白 */
  overflow: hidden;
  overscroll-behavior: none;
}

#gameCanvas {
  display: block;
  width: 100vw;
  height: 100dvh;
  touch-action: none;
}
```

### 事件监听

`main.js` 构造函数里追加：
```js
window.addEventListener('resize', () => this.resize());
window.addEventListener('orientationchange', () => this.resize());
```

## `resize()` 重写

```js
resize() {
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const scale = Math.min(screenW / GAME_WIDTH, screenH / GAME_HEIGHT);
  const offsetX = (screenW - GAME_WIDTH * scale) / 2;
  const offsetY = (screenH - GAME_HEIGHT * scale) / 2;

  this.canvas.width = Math.round(screenW * dpr);
  this.canvas.height = Math.round(screenH * dpr);
  this.canvas.style.width = screenW + 'px';
  this.canvas.style.height = screenH + 'px';

  this.viewport = { screenW, screenH, scale, offsetX, offsetY, dpr };
  this.screenBgCache = null;   // 尺寸变了，屏幕背景缓存失效
  // staticSceneCache (玩法区轨道+关卡图) 不失效 —— 尺寸没变
}
```

初次调用在构造函数末尾（现已存在），之后由 `resize`/`orientationchange` 触发。

## 缓存失效矩阵

| 缓存 | resize 时是否失效 | 原因 |
|---|---|---|
| `screenBgCache`（新增） | ✅ 失效 | 屏幕尺寸变了 |
| `staticSceneCache`（玩法区 goal+轨道+关卡图） | ❌ 保留 | 尺寸仍是 430×932 |
| `cachedTrackPath` | ❌ 保留 | 玩法区内坐标 |
| `ballBaseCache`、`ballOverCache`、`bandShadeCache` | ❌ 保留 | 球纹理与屏幕尺寸无关 |
| `frogCacheBehind`、`frogCacheFront` | ❌ 保留 | 同上 |
| `hudPanelCache` | ❌ 保留 | HUD 用玩法区坐标 |

## 不改动的东西（YAGNI）

- 游戏物理、链条、分裂、匹配、计分、抛射物、碰撞 —— 全部不动
- HUD 的 x/y 布局坐标、按钮热区 —— 全部不动（它们都在玩法区 430×932 内）
- 关卡路径生成器接口、关卡配置 schema —— 不动
- 路径编辑器（tools/path-editor） —— 不动
- 音频 `SfxEngine` —— 不动
- 粒子系统 —— 不动

## 验收标准

1. **iPhone 15 Pro Safari（竖屏，灵动岛 3:1 偏瘦）**：画面占满整个屏幕；灵动岛下方是延伸的青绿顶部渐变，home indicator 下方是延伸的墨绿底部渐变；玩法区 430:932 完整居中，顶/底 HUD 元素不被遮挡。
2. **iPad 9.7"（竖屏，4:3，比 430:932 更胖）**：玩法区按高度约束，左右两侧出现延伸渐变，HUD 按钮可点击且位置居中。
3. **iPhone SE 2020（16:9，比 430:932 更扁）**：玩法区按宽度约束，上下出现延伸渐变，玩法区整体略缩。
4. **桌面窗口缩放**：resize 后画面即时重新适配，无拉伸/裁切/残影。
5. **旋转**（若设备允许）：`orientationchange` 后重新计算视口，背景缓存重建一次。
6. **交互**：拖拽瞄准、点击射击、按按钮（声音、重开、下一关、关卡选择）所有热区命中精确；玩法区外的点击不触发任何 UI。
7. **性能**：每帧 `drawImage` 次数不超过改动前（背景从 1 次改为 1 次全屏 + 1 次玩法区静态层，仍是常数级）。DPR 上限仍是 2。

## 风险与回退

- **iOS Safari 地址栏吞高**：用 `window.innerHeight` 等价于 `100dvh`，已是可靠方案；如遇到极端情况再考虑 `visualViewport.height`。
- **Android WebView 超长屏**（例如 21:9 折叠屏展开）：scale 会按宽度约束，上下延伸渐变会很长 —— 视觉上仍可接受，玩法区居中。
- **关卡背景图的视觉边界**：per-level 背景图 clip 在 `(0,0,430,932)`；图的边缘在全屏延伸渐变里会有明显分界。这是可接受的，渐变底色与背景图主色调已接近。如果后续觉得突兀，可以加一圈径向遮罩淡化边界（不在本次范围内）。

## 文件改动清单

| 文件 | 改动性质 |
|---|---|
| `index.html` | 简化（移除隐藏 HUD） |
| `src/style.css` | 大幅精简 |
| `src/main.js` | `resize()` 重写 + `updatePointer()` 重写 + 事件监听 + `viewport` 字段初始化 + `screenBgCache` 字段 |
| `src/render/index.js` | `render()` 入口加两次 `setTransform`；调用新的全屏背景绘制 |
| `src/render/scene.js` | `drawBackground(game, ctx)` 参数化屏幕尺寸（从 `GAME_WIDTH/HEIGHT` 常量改为 `viewport.screenW/screenH`）；可能拆分为 `drawScreenBackground()` 与保留的 `drawTrack()` / per-level 背景图逻辑 |

## 完成后的后续

本次只做全屏适配，不扩展 HUD 安全区避让（用户已选"HUD 随逻辑画面一起缩放"）。如果后续真机测试发现某些按钮被灵动岛/home bar 遮挡，再开一次迭代把关键按钮的 y 坐标加安全区余量。
