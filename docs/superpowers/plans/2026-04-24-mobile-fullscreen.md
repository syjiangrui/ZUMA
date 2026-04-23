# 移动端全屏适配 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让游戏画面真正全屏：Canvas 占满 100vw × 100dvh，背景渐变延伸到刘海/灵动岛/home indicator 区域，430:932 的玩法区居中并按比例缩放。

**Architecture:** 保留 430×932 逻辑坐标系不动；在 `render()` 开头先以屏幕像素坐标画全屏背景渐变，再 `setTransform(dpr*scale, …, offsetX, offsetY)` 切入玩法区坐标画所有既有内容。`updatePointer()` 改用 viewport 字段反算逻辑坐标。把 `drawBackground` 中"纯渐变部分"抽成 `drawScreenGradient()` 给全屏使用，保留"玩法区装饰"（石板、祭坛、altar glow）在 `staticSceneCache` 里。

**Tech Stack:** Vanilla ES modules, Canvas 2D, 无框架，无构建产物（Vite dev server）。

**Spec:** `docs/superpowers/specs/2026-04-24-mobile-fullscreen-design.md`

---

## 文件改动清单

| 文件 | 改动性质 |
|---|---|
| `index.html` | 删除隐藏的 `.hud` DOM 节点 |
| `src/style.css` | 大幅精简为全屏 canvas 样式 |
| `src/render/scene.js` | 新增 `drawScreenGradient(ctx, w, h)` |
| `src/render/index.js` | `render()` 入口两次 `setTransform`；levelSelect/fade 分支同样处理 |
| `src/main.js` | `constructor` 初始化 `viewport` 与 `screenBgCache`；`resize()` 重写；`updatePointer()` 重写；`orientationchange` 监听 |

**不改动**：游戏物理（`chain.js`、`match.js`、`projectile.js`、`path.js`）、HUD 布局（`hud.js`）、末日卡片（`screens.js`）、音频（`sfx.js`）、配置常量（`config.js`）。

---

## 任务顺序原则

按"对画面的可见影响"渐进改动，每步都能直观验证：

1. Task 1–2：准备工作（新函数、新字段），不影响画面。
2. Task 3：CSS 改为全屏 —— 此时 canvas 会被 CSS 撑满，但 backing store 仍是 430×932，画面被 CSS 拉伸（模糊）。
3. Task 4：`resize()` 让 backing store 跟 CSS 尺寸匹配 —— 不再拉伸，但 `render()` 的老 transform 让所有内容挤在左上角。
4. Task 5：`render()` 切入新 transform —— 画面最终正确。
5. Task 6：输入映射修复。
6. Task 7–8：收尾（orientationchange、清理 DOM）。
7. Task 9：完整验收。

---

## 约定

- **验证方式**：无测试框架，靠浏览器手动验证 + 代码检查。每个"验证"步骤的 Expected 说明眼睛应该看到什么。
- **启动命令**：`python3 -m http.server 8000`，然后在浏览器打开 `http://localhost:8000`。
- **提交频率**：每个 Task 末尾单独 commit。
- **DPR 上限**：保持与现有代码一致 = 2。

---

## Task 1: 在 `scene.js` 中新增 `drawScreenGradient()`

**Files:**
- Modify: `src/render/scene.js`

**动机**：当前 `drawBackground()` 混合了"纯渐变"（可延伸到全屏）和"玩法区装饰"（石板、祭坛、altar glow —— 这些基于 `game.shooter` 位置，必须留在玩法区）。全屏背景只需要前者。`drawBackground` 保持不变继续画玩法区装饰。

- [ ] **Step 1: 在 `src/render/scene.js` 顶部新增 `drawScreenGradient` 函数**

在现有 `drawBackground` 函数**上方**新增（即 `import` 之后、`export function drawBackground` 之前）：

```js
// 全屏背景渐变 —— 不依赖玩法区坐标，只铺满 (0,0,w,h)。
// drawBackground 里"基于 shooter 位置的装饰（石板、祭坛环、altar glow）"
// 继续留在 drawBackground 里用于玩法区。
export function drawScreenGradient(ctx, w, h) {
  // 顶部青绿 canopy —— 原本覆盖 0~176 的玩法区高度，全屏时按同比例延伸。
  const canopyH = Math.round(h * 176 / GAME_HEIGHT);
  const canopy = ctx.createLinearGradient(0, 0, 0, canopyH);
  canopy.addColorStop(0, "#17383e");
  canopy.addColorStop(0.55, "#10272d");
  canopy.addColorStop(1, "#0a1519");
  ctx.fillStyle = canopy;
  ctx.fillRect(0, 0, w, canopyH);

  // 底部石板 slab —— 原本从 HUD_HEIGHT 到 GAME_HEIGHT，全屏时从同比例位置到 h。
  const slabStart = Math.round(h * 118 / GAME_HEIGHT);
  const slab = ctx.createLinearGradient(0, slabStart, 0, h);
  slab.addColorStop(0, "#7f8990");
  slab.addColorStop(0.48, "#6e7880");
  slab.addColorStop(1, "#5b646d");
  ctx.fillStyle = slab;
  ctx.fillRect(0, slabStart, w, h - slabStart);
}
```

**注意**：`canopyH` 和 `slabStart` 基于 `GAME_HEIGHT` 按比例换算，确保屏幕比游戏更长时渐变过渡位置看起来一致。此函数**不**需要 `game` 参数（纯数学+渐变）。

- [ ] **Step 2: 验证 scene.js 仍能正确导入**

Run: `python3 -m http.server 8000`，浏览器打开 `http://localhost:8000`。
Expected: 游戏完全不变（函数已定义但还没被调用）。无控制台错误。

- [ ] **Step 3: Commit**

```bash
git add src/render/scene.js
git commit -m "render: add drawScreenGradient helper for fullscreen background

Extracts the pure gradient portion of drawBackground so it can be
painted across the whole physical canvas, while shooter-relative
decorations stay in the play area."
```

---

## Task 2: 在 `ZumaGame` 构造函数初始化 `viewport` 和 `screenBgCache`

**Files:**
- Modify: `src/main.js` (constructor 末尾 `this.resize()` 之前)

- [ ] **Step 1: 在构造函数 `this.resize()` 之前新增字段**

定位：`src/main.js` 的 `constructor(canvas)` 里，紧挨 `this.resize();` 那一行（约 line 115）之前，插入：

```js
    // 屏幕视口（物理像素尺寸 + 玩法区缩放/偏移），由 resize() 重算。
    // screenW/screenH  —— window.innerWidth/innerHeight 的 CSS 像素
    // scale            —— 玩法区到屏幕的等比缩放（保持 430:932）
    // offsetX/offsetY  —— 玩法区在屏幕上的左上角偏移
    // dpr              —— 设备像素比，clamp 到 [1, 2]
    this.viewport = {
      screenW: GAME_WIDTH,
      screenH: GAME_HEIGHT,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      dpr: 1,
    };
    // 全屏背景缓存（只含 drawScreenGradient 结果），resize 时失效重建。
    // staticSceneCache（玩法区 goal+轨道+关卡图+玩法区装饰）仍然独立。
    this.screenBgCache = null;
```

- [ ] **Step 2: 验证不破坏现有游戏**

Run: 浏览器刷新 `http://localhost:8000`。
Expected: 游戏启动正常，控制台无错误。（`viewport` 字段暂时还用不上。）

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "main: add viewport + screenBgCache fields on ZumaGame

Placeholders for the upcoming fullscreen resize logic."
```

---

## Task 3: 清理 CSS —— 变成全屏 canvas

**Files:**
- Modify: `src/style.css`

**预期中间态**：此步完成后，CSS 让 canvas 撑满全屏，但 `resize()` 仍按 430×932 设置 backing store —— 浏览器会把 430×932 像素拉伸到整屏，画面严重模糊/失真。**这是预期的中间状态**，Task 4 会修好。

- [ ] **Step 1: 整体替换 `src/style.css`**

把整个文件内容替换为：

```css
:root {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: #000;
  overflow: hidden;
  overscroll-behavior: none;
  font-family: "Trebuchet MS", "Segoe UI", sans-serif;
  color: #f7f2df;
}

.app-shell {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100dvh;
}

.game-frame {
  width: 100%;
  height: 100%;
}

#gameCanvas {
  display: block;
  width: 100vw;
  height: 100dvh;
  touch-action: none;
}
```

**说明**：
- body 改为纯黑防止 canvas 加载时短暂闪白
- 移除 safe-area padding、aspect-ratio、圆角、阴影、手机框
- 保留 `touch-action: none` 避免浏览器抢手势
- `overscroll-behavior: none` 禁止 iOS 橡皮回弹

- [ ] **Step 2: 浏览器验证（预期会模糊）**

Run: 浏览器刷新。
Expected: canvas 占满整个窗口，但内容**严重模糊/拉伸**（因为 backing store 仍是 430×932）。控制台无错误。手机真机上会看到模糊的全屏画面。

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "style: fullscreen canvas, drop phone-frame padding and radius

CSS no longer constrains the canvas to a centered 430x932 frame.
Canvas fills 100vw x 100dvh. Rendering will look stretched until
resize() and render() are updated in the next tasks."
```

---

## Task 4: 重写 `resize()` 使 backing store 占满屏幕

**Files:**
- Modify: `src/main.js` (现有 `resize()` 方法，约 line 684-689)

**预期中间态**：backing store 尺寸正确了，但 `render()` 还用老 transform，所有玩法区内容会画在屏幕左上角的 430×932 区域里，其余屏幕区域显示 `clearRect` 清出来的透明（实际显示 body 的黑色）。**这是预期的中间状态**，Task 5 会修好。

- [ ] **Step 1: 替换 `resize()` 方法体**

当前代码：

```js
  resize() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    this.canvas.width = GAME_WIDTH * dpr;
    this.canvas.height = GAME_HEIGHT * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
```

替换为：

```js
  resize() {
    const screenW = Math.max(1, window.innerWidth);
    const screenH = Math.max(1, window.innerHeight);
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const scale = Math.min(screenW / GAME_WIDTH, screenH / GAME_HEIGHT);
    const offsetX = (screenW - GAME_WIDTH * scale) / 2;
    const offsetY = (screenH - GAME_HEIGHT * scale) / 2;

    // 物理后备尺寸 = CSS 尺寸 × dpr；CSS 尺寸 = 整屏。
    this.canvas.width = Math.round(screenW * dpr);
    this.canvas.height = Math.round(screenH * dpr);
    this.canvas.style.width = screenW + "px";
    this.canvas.style.height = screenH + "px";

    this.viewport = { screenW, screenH, scale, offsetX, offsetY, dpr };

    // 屏幕尺寸变了，全屏背景缓存必须重建。玩法区缓存不受影响。
    this.screenBgCache = null;

    // 注意：不在这里 setTransform —— 每帧 render() 开头会主动设置，
    //       因为 render() 需要在两套坐标系之间切换。
  }
```

**关键点**：老代码里的 `this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` 在此被移除 —— 下一个 Task 让 `render()` 每帧主动设置 transform。

- [ ] **Step 2: 浏览器验证**

Run: 浏览器刷新。
Expected: canvas 覆盖整屏，但玩法区内容堆在左上角的一个 430×932 像素区域里，其余是黑色。拖拽窗口可见内容位置和尺寸仍锚定在左上角。**这是预期的中间状态**。

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "main: rewrite resize() to match canvas backing store to screen

Canvas backing size now tracks window.innerWidth/dvh × dpr, and
viewport field captures scale + offset for the upcoming render
transform. Intentionally breaks rendering until render() is updated."
```

---

## Task 5: 在 `render()` 开头画全屏背景 + 切入玩法区 transform

**Files:**
- Modify: `src/render/index.js`

- [ ] **Step 1: 更新导入并替换 `render()` 函数**

把 `import { drawChain, … } from './scene.js';` 那一段的 import 列表追加 `drawScreenGradient`：

```js
import {
  drawChain,
  drawParticles,
  drawProjectile,
  drawAimGuide,
  drawShooter,
  createStaticSceneCache,
  drawScreenGradient,
} from './scene.js';
```

然后把整个 `render(game)` 函数替换为：

```js
export function render(game) {
  const ctx = game.ctx;
  const { screenW, screenH, scale, offsetX, offsetY, dpr } = game.viewport;

  // ---- 阶段 1：屏幕坐标系 —— 画全屏背景 ----
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, screenW, screenH);

  if (!game.screenBgCache) {
    const bg = document.createElement("canvas");
    bg.width = Math.round(screenW * dpr);
    bg.height = Math.round(screenH * dpr);
    const bgCtx = bg.getContext("2d");
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScreenGradient(bgCtx, screenW, screenH);
    game.screenBgCache = bg;
  }
  // 离屏缓存是 dpr 物理像素 —— 用 drawImage 的 9 参数形式 blit 回 CSS 尺寸
  ctx.drawImage(
    game.screenBgCache,
    0, 0, game.screenBgCache.width, game.screenBgCache.height,
    0, 0, screenW, screenH,
  );

  // ---- 阶段 2：玩法区坐标系 (430×932) ----
  // 所有既有绘制都在这个坐标下，逻辑不动。
  ctx.setTransform(
    dpr * scale, 0,
    0, dpr * scale,
    offsetX * dpr, offsetY * dpr,
  );

  if (game.gameState === "levelSelect") {
    drawLevelSelectScreen(game, ctx);
    if (game.fadeOverlay && game.fadeOverlay.alpha > 0.01) {
      ctx.fillStyle = `rgba(6, 10, 12, ${game.fadeOverlay.alpha})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    return;
  }

  // Screen shake on defeat —— 仍在玩法区坐标系内偏移，不影响屏幕背景
  if (game.screenShake > 0) {
    const intensity = game.screenShake * 14;
    const ox = (Math.random() - 0.5) * intensity;
    const oy = (Math.random() - 0.5) * intensity;
    ctx.save();
    ctx.translate(ox, oy);
  }

  if (!game.staticSceneCache) {
    createStaticSceneCache(game);
  }
  ctx.drawImage(game.staticSceneCache, 0, 0);
  drawChain(game, ctx);
  drawParticles(game, ctx);
  drawProjectile(game, ctx);
  drawAimGuide(game, ctx);
  drawShooter(game, ctx);
  drawOverlay(game, ctx);
  drawMatchFeedback(game, ctx);

  if (game.screenShake > 0) {
    ctx.restore();
  }

  if (game.gameState !== "playing") {
    game.drawRoundEndEffect(ctx);
  }
  drawRoundStateCard(game, ctx);

  if (game.isAllClear()) {
    drawAllClearScreen(game, ctx);
  }

  if (game.fadeOverlay && game.fadeOverlay.alpha > 0.01) {
    ctx.fillStyle = `rgba(6, 10, 12, ${game.fadeOverlay.alpha})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}
```

**说明**：
- `ctx.setTransform` 每帧两次：先 `(dpr,…)` 画全屏背景，再 `(dpr*scale,…,offsetX*dpr,offsetY*dpr)` 切入玩法区。
- 玩法区坐标下的代码**一行都没改**，只是外面的 transform 变了。
- `fadeOverlay` 的 `fillRect(0,0,GAME_WIDTH,GAME_HEIGHT)` 仍然只覆盖玩法区——这是有意的：fade 作为"玩法区转场"的视觉，不需要覆盖延伸带。

- [ ] **Step 2: 浏览器验证 —— 画面应该正确了**

Run: 浏览器刷新 `http://localhost:8000`。
Expected:
- 整个屏幕铺满背景渐变（顶部青绿→底部墨绿）
- 玩法区居中、按比例缩放、完整显示
- 拖拽浏览器窗口改变大小，画面实时重新适配（玩法区始终居中，比例不变）
- 桌面宽屏窗口：玩法区按高度约束，左右大块延伸渐变带
- 窄高窗口：玩法区按宽度约束，上下小延伸带
- 注意：此时**点击/拖拽瞄准会有坐标偏差**（输入映射还未修复），Task 6 修复。

- [ ] **Step 3: Commit**

```bash
git add src/render/index.js
git commit -m "render: paint fullscreen gradient then transform into play area

render() now draws the screen-wide gradient first (using cached
offscreen canvas), then applies scale+offset transform so every
subsequent draw call works in the existing 430x932 logical space."
```

---

## Task 6: 修复 `updatePointer()` 使输入映射到玩法区坐标

**Files:**
- Modify: `src/main.js` (现有 `updatePointer()`，约 line 692-698)

- [ ] **Step 1: 替换 `updatePointer()` 方法体**

当前代码：

```js
  updatePointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    this.pointer.x = (event.clientX - rect.left) * scaleX;
    this.pointer.y = (event.clientY - rect.top) * scaleY;
  }
```

替换为：

```js
  // 屏幕像素 → 玩法区 (430×932) 坐标。
  // 玩法区外的点击会映射到负数或 > GAME_WIDTH/HEIGHT，所有 HUD/关卡按钮
  // 热区判定天然不命中，无需显式过滤。
  updatePointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = this.viewport;
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    this.pointer.x = (screenX - offsetX) / scale;
    this.pointer.y = (screenY - offsetY) / scale;
  }
```

- [ ] **Step 2: 浏览器验证 —— 交互**

Run: 浏览器刷新，在游戏里测试：
- 拖拽瞄准：瞄准线应该跟随指针
- 点击玩法区空白：无反应
- 点击 HUD 上的声音按钮：声音开关切换
- 点击重开按钮：关卡重置
- 点击"返回"按钮（如果当前在关卡里）：回到关卡选择
- 在关卡选择屏点击某个关卡按钮：进入该关卡
- 点击玩法区**外**的延伸背景带：无任何反应（关键验证点）

Expected: 所有交互精确命中，延伸带点击被安全忽略。

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "main: remap pointer coords via viewport scale + offset

Clicks/drags in the play area now map back to the 430x932 logical
space accurately. Clicks in the extended background fall outside
the play area and are naturally ignored by existing UI hit-tests."
```

---

## Task 7: 添加 `orientationchange` 监听

**Files:**
- Modify: `src/main.js` (`bindEvents()` 方法，约 line 591)

- [ ] **Step 1: 在 `resize` 监听旁添加 `orientationchange`**

定位 `bindEvents()` 里这一行：

```js
    window.addEventListener("resize", () => this.resize());
```

替换为：

```js
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => this.resize());
```

- [ ] **Step 2: 验证（开发环境无法直接测旋转，靠代码检查）**

Run: 浏览器刷新，确认无新报错。
Expected: 控制台无错误；真机旋转后画面应重新居中（该验证留给 Task 9 真机验收）。

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "main: listen to orientationchange for mobile re-layout

Some mobile browsers don't fire 'resize' reliably on rotation.
Handling both events guarantees viewport recompute."
```

---

## Task 8: 删除 `index.html` 中的隐藏 HUD DOM

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 删除隐藏的 `<section class="hud">`**

把 `index.html` 当前的 `<main class="app-shell">` 部分：

```html
    <main class="app-shell">
      <section class="hud" style="display: none;">
        <p class="eyebrow">Mobile Canvas Prototype</p>
        <h1>祖马原型</h1>
        <p class="status">阶段 1：轨道、炮台、纹理滚动球链</p>
      </section>

      <section class="game-frame">
        <canvas id="gameCanvas" aria-label="Zuma game canvas"></canvas>
      </section>
    </main>
```

替换为：

```html
    <main class="app-shell">
      <section class="game-frame">
        <canvas id="gameCanvas" aria-label="Zuma game canvas"></canvas>
      </section>
    </main>
```

**保留**：`<meta viewport content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">` 一字不改（`viewport-fit=cover` 是 iOS 上 canvas 能画到刘海区的关键）。

- [ ] **Step 2: 浏览器验证**

Run: 浏览器刷新。
Expected: 页面结构简化，游戏行为不变。

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "html: remove hidden legacy HUD DOM nodes

All HUD elements are rendered inside the canvas. Keep viewport-fit=cover
so iOS draws the canvas under the notch/dynamic-island."
```

---

## Task 9: 验收 —— 多场景手动验证

无代码改动的验证 task。跑这些场景，把所有不符合预期的问题记录并回到对应 Task 修复。

- [ ] **Step 1: 桌面 Chrome 窗口 resize 测试**

Run: `python3 -m http.server 8000`，打开 `http://localhost:8000`
测试：
- 宽窗口（1920×1080）：玩法区按高度居中缩放，左右大块延伸带
- 窄高窗口（400×1000）：玩法区按宽度撑满，上下小块延伸带
- 正方形窗口（800×800）：玩法区按高度约束（800/932 < 800/430），居中

Expected: 画面始终居中、不变形；HUD 按钮命中准确；背景渐变无缝延伸。

- [ ] **Step 2: 移动尺寸模拟（Chrome DevTools Device Mode）**

在 DevTools 打开 Device Mode：
- iPhone 15 Pro (393×852)：玩法区几乎撑满（393/430 vs 852/932，比例接近），延伸带很薄
- iPad Mini (768×1024)：左右各约 150px 延伸带
- Pixel 7 (412×915)：延伸带几乎无感
- iPhone SE (375×667)：玩法区按宽度约束，上下延伸带约 100px

Expected: 所有尺寸下玩法区 430:932 完整可见、居中。

- [ ] **Step 3: 输入精度**

每种尺寸下验证：
- 拖拽瞄准线跟随鼠标
- 点击声音按钮切换声音
- 点击重开按钮重置关卡
- 进入关卡 1 → 射击 → 匹配 → 得分变化
- 返回关卡选择 → 再进关卡 2

Expected: 所有交互无偏移。

- [ ] **Step 4: 真机验证（如有条件）**

在实际 iPhone / Android 手机打开（需 Vite dev server 或部署到可访问地址）：
- 画面占满整个屏幕
- 灵动岛/刘海区是延伸的青绿渐变（不是黑色）
- home indicator 区是延伸的墨绿渐变
- 触摸射击、拖拽瞄准工作正常
- 横屏旋转后重新居中适配

Expected: 全部通过。

- [ ] **Step 5: 如所有场景通过，无需 commit（此 task 只验证）**

如发现问题，回到对应 Task 修复，并重跑此 Task。

---

## 完成标志

- Task 1–8 已全部 commit
- Task 9 全部场景通过
- 控制台无 error/warning
- `staticSceneCache` 在 resize 时不被无谓重建（玩法区缓存）
- 全屏下整体帧率与改动前无明显回退

---

## 附：回退路径

若全屏适配在某个平台上出现严重问题：

```bash
# 回滚到全屏改动之前
git log --oneline        # 找到 Task 1 之前的 commit hash
git revert <task1>..<task8>
```

Spec 与 plan 文档保留在 repo 里，供下次迭代参考。
