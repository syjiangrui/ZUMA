# Path Editor HUD Overlay & Multi-Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add precise HUD wireframe overlays and marquee/Ctrl+A multi-select with batch drag to the path editor.

**Architecture:** All changes are in `tools/path-editor/index.html` — a single-file editor tool. We add a `drawHudOverlay(ctx)` function called from both the editor canvas `render()` and `renderPreview()`, replacing the old crude zone bands. Then we add selection state (`selectedPoints` Set), marquee rectangle drawing, `selectAll()`, and batch drag logic wired into the existing mousedown/mousemove/mouseup handlers.

**Tech Stack:** Vanilla JS, Canvas 2D, single HTML file with inline `<script type="module">`

**Spec:** `docs/superpowers/specs/2026-04-24-path-editor-hud-and-multiselect-design.md`

---

### Task 1: Add HUD overlay toggle checkbox to sidebar HTML

**Files:**
- Modify: `tools/path-editor/index.html:76-77` (between toolbar and waypoint-bar)

- [ ] **Step 1: Add the checkbox HTML**

Insert a new `<div>` between the `#toolbar` div (line 77, after `</div>`) and the `#waypoint-bar` div (line 78). Find the closing `</div>` of `#toolbar` and add after it:

```html
  <div id="hud-overlay-bar" style="padding:4px 16px;border-bottom:1px solid #2a3444;font-size:11px">
    <label style="display:flex;align-items:center;gap:6px;color:#8a9aaa;cursor:pointer">
      <input type="checkbox" id="showHudOverlay" checked style="accent-color:#f0d57a"> 显示 HUD 遮挡
    </label>
  </div>
```

- [ ] **Step 2: Add the state variable and event wiring**

In the script section, near the existing editing mode state variables (around line 247, after `let brushMode = false;`), add:

```javascript
let showHudOverlay = true;
```

Then after the `init()` function (around line 3626), add the checkbox event listener:

```javascript
document.getElementById('showHudOverlay').addEventListener('change', (e) => {
  showHudOverlay = e.target.checked;
  render();
});
```

- [ ] **Step 3: Verify visually**

Run: `npx vite` and open the path editor at `http://localhost:5173/tools/path-editor/`  
Expected: A "显示 HUD 遮挡" checkbox appears between the toolbar and the waypoint bar. Toggling it does nothing yet (the drawing function doesn't exist yet).

- [ ] **Step 4: Commit**

```bash
git add tools/path-editor/index.html
git commit -m "feat(path-editor): add HUD overlay toggle checkbox to sidebar"
```

---

### Task 2: Implement `drawHudOverlay(ctx)` and wire it into both canvases

**Files:**
- Modify: `tools/path-editor/index.html` — add function, replace old bands in `render()`, add call in `renderPreview()`

- [ ] **Step 1: Add the `drawHudOverlay` function**

Insert this function before the `render()` function (around line 806, before `// ─── Render ───`):

```javascript
// ─── HUD overlay wireframes ────────────────────────────────────────
// Draws wireframe outlines of every game HUD element so the path designer
// can see exactly which areas will be occluded at runtime.
// Positions are hardcoded from src/style.css layout values.
function drawHudOverlay(c) {
  if (!showHudOverlay) return;
  c.save();

  const FILL = 'rgba(120, 133, 144, 0.15)';
  const STROKE = 'rgba(180, 190, 200, 0.5)';
  const LABEL_COLOR = 'rgba(180, 190, 200, 0.6)';
  const LINE_WIDTH = 1.5;
  const DASH = [4, 3];
  const FONT = '10px -apple-system, sans-serif';

  c.setLineDash(DASH);
  c.lineWidth = LINE_WIDTH;
  c.strokeStyle = STROKE;
  c.fillStyle = FILL;
  c.font = FONT;
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  // Helper: draw one rounded-rect wireframe with label
  function box(x, y, w, h, r, label) {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fill();
    c.stroke();
    if (label) {
      c.fillStyle = LABEL_COLOR;
      c.fillText(label, x + w / 2, y + h / 2);
      c.fillStyle = FILL;
    }
  }

  // 1. Main HUD panel (top-left)
  box(16, 14, 232, 106, 22, 'HUD 面板');

  // 2. Right-side button group (top-right)
  // CSS: position:absolute; top:16px; right:16px; display:flex; gap:6px
  // Items: next-ball 44x44, sound 36x38, restart 56x38
  // Total width: 44+6+36+6+56 = 148.  Left edge: 430-16-148 = 266
  box(266, 16, 44, 44, 14, '预览');       // next-ball
  box(316, 16, 36, 38, 14, '音');         // sound btn
  box(358, 16, 56, 38, 14, '重开');       // restart btn

  // 3. Back button (bottom-left, position:fixed)
  // CSS: bottom: max(18px, safe-area); left: max(16px, safe-area)
  // Button size ~56x38 (min-width:36 + padding, height:38)
  box(16, 876, 56, 38, 14, '选关');

  // 4. Match feedback popup zone (appears briefly after matches)
  // CSS: top:114px; left:50%; transform:translateX(-50%); width:192px
  c.setLineDash([6, 4]);
  c.strokeStyle = 'rgba(180, 190, 200, 0.25)';
  c.fillStyle = 'rgba(120, 133, 144, 0.08)';
  box(119, 114, 192, 50, 18, '消除反馈');

  c.setLineDash([]);
  c.restore();
}
```

- [ ] **Step 2: Replace the old HUD/button bands in `render()` with `drawHudOverlay(ctx)`**

In the `render()` function, find and **remove** the old HUD zone code (the block from `// HUD top zone (120px)` through the bottom button zone, approximately lines 868-891):

Remove this entire block:
```javascript
  // HUD top zone (120px) — deeper overlay so it's clear this area is obstructed
  ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
  ctx.fillRect(0, 0, GAME_WIDTH, 120);
  ctx.strokeStyle = 'rgba(160, 170, 180, 0.6)';
  ctx.lineWidth = 2 / scale;
  ctx.beginPath(); ctx.moveTo(0, 120); ctx.lineTo(GAME_WIDTH, 120); ctx.stroke();
  // HUD label — centered, larger
  ctx.fillStyle = 'rgba(160, 170, 180, 0.7)';
  ctx.font = `bold ${14/scale}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('HUD 区域', GAME_WIDTH / 2, 65);
  ctx.textAlign = 'start';

  // Bottom button zone (70px) — matches actual game button area
  ctx.fillStyle = 'rgba(10, 14, 20, 0.5)';
  ctx.fillRect(0, GAME_HEIGHT - 70, GAME_WIDTH, 70);
  ctx.strokeStyle = 'rgba(160, 170, 180, 0.4)';
  ctx.lineWidth = 1 / scale;
  ctx.beginPath(); ctx.moveTo(0, GAME_HEIGHT - 70); ctx.lineTo(GAME_WIDTH, GAME_HEIGHT - 70); ctx.stroke();
  ctx.fillStyle = 'rgba(160, 170, 180, 0.5)';
  ctx.font = `bold ${12/scale}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('按钮区域', GAME_WIDTH / 2, GAME_HEIGHT - 35);
  ctx.textAlign = 'start';
```

Replace it with:
```javascript
  // HUD element wireframe overlays (precise positions from game CSS)
  drawHudOverlay(ctx);
```

- [ ] **Step 3: Add `drawHudOverlay` call to `renderPreview()`**

In the `renderPreview()` function, after the `drawShooter(pg, pCtx);` line (approximately line 3582), add:

```javascript
  // HUD wireframe overlay on preview
  drawHudOverlay(pCtx);
```

So the end of `renderPreview()` becomes:
```javascript
  pCtx.drawImage(pg.staticSceneCache, 0, 0);
  drawChain(pg, pCtx);
  drawShooter(pg, pCtx);
  
  // HUD wireframe overlay on preview
  drawHudOverlay(pCtx);
}
```

- [ ] **Step 4: Verify visually**

Run: `npx vite` and open the path editor.  
Expected:
- Editor canvas shows wireframe outlines for the HUD panel (top-left), three right-side buttons, back button (bottom-left), and match feedback zone — all with dashed borders and subtle fill
- The old crude "HUD 区域" and "按钮区域" dark bands are gone
- Preview panel also shows the same wireframe overlays on top of the rendered game scene
- Unchecking "显示 HUD 遮挡" hides all wireframes from both canvases

- [ ] **Step 5: Commit**

```bash
git add tools/path-editor/index.html
git commit -m "feat(path-editor): replace crude HUD bands with precise wireframe overlays

Shows exact HUD element outlines (panel, buttons, back, feedback zone)
on both editor canvas and preview panel. Toggle via sidebar checkbox."
```

---

### Task 3: Add multi-select state variables and utility functions

**Files:**
- Modify: `tools/path-editor/index.html` — add state + helper functions

- [ ] **Step 1: Add state variables**

Near the existing editing mode state variables (around line 247, after the `let showHudOverlay = true;` added in Task 1), add:

```javascript
// ─── Multi-select state ────────────────────────────────────────────
let selectedPoints = new Set();   // Set of string keys, e.g. "curve:0:p1", "shooter", "waypoint:3"
let marqueeRect = null;           // { x1, y1, x2, y2 } in game coords, null when inactive
let marqueeShift = false;         // was Shift held when marquee started?
let multiDragStart = null;        // { gx, gy, snapshots: Map<key, {x,y}> }
```

- [ ] **Step 2: Add point key/position utility functions**

Insert these functions after the `screenToGame` function (around line 1269):

```javascript
// ─── Multi-select helpers ──────────────────────────────────────────

// Generate a unique string key for a selectable point.
function getPointKey(type, index, point) {
  if (type === 'shooter') return 'shooter';
  if (type === 'waypoint') return `waypoint:${index}`;
  return `curve:${index}:${point}`;
}

// Resolve a selection key back to its current {x, y} position.
function getPointPosition(key) {
  const level = LEVELS[currentLevel];
  if (key === 'shooter') return { x: level.shooterPos.x, y: level.shooterPos.y };
  if (key.startsWith('waypoint:')) {
    const idx = parseInt(key.split(':')[1], 10);
    const wp = level.waypoints[idx];
    return wp ? { x: wp.x, y: wp.y } : null;
  }
  if (key.startsWith('curve:')) {
    const parts = key.split(':');
    const idx = parseInt(parts[1], 10);
    const pt = parts[2]; // 'p1', 'p2', 'cp', 'cp1', 'cp2'
    const c = level.curves[idx];
    if (!c) return null;
    const ref = c[pt];
    return ref ? { x: ref.x, y: ref.y } : null;
  }
  return null;
}

// Write a new position for a selection key into the data model.
// For curve endpoints (p1/p2), also syncs the shared endpoint of
// the adjacent curve if they are snapped together (within SNAP_DISTANCE).
function setPointPosition(key, x, y) {
  const level = LEVELS[currentLevel];
  const nx = Math.round(x);
  const ny = Math.round(y);
  if (key === 'shooter') {
    level.shooterPos.x = Math.max(0, Math.min(GAME_WIDTH, nx));
    level.shooterPos.y = Math.max(0, Math.min(GAME_HEIGHT, ny));
    document.getElementById('shX').value = level.shooterPos.x;
    document.getElementById('shY').value = level.shooterPos.y;
    return;
  }
  if (key.startsWith('waypoint:')) {
    const idx = parseInt(key.split(':')[1], 10);
    const wp = level.waypoints[idx];
    if (wp) { wp.x = nx; wp.y = ny; }
    return;
  }
  if (key.startsWith('curve:')) {
    const parts = key.split(':');
    const idx = parseInt(parts[1], 10);
    const pt = parts[2];
    const c = level.curves[idx];
    if (c && c[pt]) {
      const oldX = c[pt].x, oldY = c[pt].y;
      c[pt].x = nx;
      c[pt].y = ny;
      // Sync shared endpoint: if this is p1 or p2, the adjacent curve's
      // matching endpoint was at the same position before the move.
      if (pt === 'p2' && idx + 1 < level.curves.length) {
        const next = level.curves[idx + 1];
        if (Math.hypot(next.p1.x - oldX, next.p1.y - oldY) < 2) {
          next.p1.x = nx; next.p1.y = ny;
        }
      }
      if (pt === 'p1' && idx - 1 >= 0) {
        const prev = level.curves[idx - 1];
        if (Math.hypot(prev.p2.x - oldX, prev.p2.y - oldY) < 2) {
          prev.p2.x = nx; prev.p2.y = ny;
        }
      }
    }
  }
}

// Collect all selectable point keys for the current level and mode.
function getAllPointKeys() {
  const level = LEVELS[currentLevel];
  const keys = [];
  if (waypointMode) {
    for (let i = 0; i < level.waypoints.length; i++) {
      keys.push(getPointKey('waypoint', i));
    }
  } else {
    for (let i = 0; i < level.curves.length; i++) {
      const c = level.curves[i];
      if (isCubicCurve(c)) {
        keys.push(getPointKey('curve', i, 'p1'));
        keys.push(getPointKey('curve', i, 'cp1'));
        keys.push(getPointKey('curve', i, 'cp2'));
        keys.push(getPointKey('curve', i, 'p2'));
      } else {
        keys.push(getPointKey('curve', i, 'p1'));
        keys.push(getPointKey('curve', i, 'cp'));
        keys.push(getPointKey('curve', i, 'p2'));
      }
    }
    keys.push('shooter');
  }
  return keys;
}

// Select all points inside a rectangle (game coords).
function selectPointsInRect(rect, additive) {
  const x1 = Math.min(rect.x1, rect.x2);
  const y1 = Math.min(rect.y1, rect.y2);
  const x2 = Math.max(rect.x1, rect.x2);
  const y2 = Math.max(rect.y1, rect.y2);
  const keys = getAllPointKeys();
  if (!additive) selectedPoints.clear();
  for (const key of keys) {
    const pos = getPointPosition(key);
    if (!pos) continue;
    if (pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2) {
      if (additive && selectedPoints.has(key)) {
        selectedPoints.delete(key);
      } else {
        selectedPoints.add(key);
      }
    }
  }
}

// Select all points in the current level/mode.
function selectAll() {
  const keys = getAllPointKeys();
  selectedPoints.clear();
  for (const key of keys) selectedPoints.add(key);
}

// Clear all selection state.
function clearSelection() {
  selectedPoints.clear();
  marqueeRect = null;
  multiDragStart = null;
}

// Check if a given handle hit result (from findHandle/findWaypointHandle) is in the selection set.
function isHandleSelected(handle) {
  if (!handle) return false;
  const key = getPointKey(handle.type, handle.index, handle.point);
  return selectedPoints.has(key);
}
```

- [ ] **Step 3: Verify (no visual change yet)**

Run: `npx vite` and open the path editor.  
Expected: No visual change. No console errors. The new functions exist but aren't called yet.

- [ ] **Step 4: Commit**

```bash
git add tools/path-editor/index.html
git commit -m "feat(path-editor): add multi-select state and point key utility functions"
```

---

### Task 4: Add selection rendering (glow rings + marquee rect)

**Files:**
- Modify: `tools/path-editor/index.html` — add render functions, call them from `render()`

- [ ] **Step 1: Add `renderSelectionHighlight` and `renderMarquee` functions**

Insert these functions after the `clearSelection()` function added in Task 3:

```javascript
// Draw white glow rings around all selected points.
function renderSelectionHighlight(c) {
  if (selectedPoints.size === 0) return;
  c.save();
  c.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  c.lineWidth = 2 / scale;
  for (const key of selectedPoints) {
    const pos = getPointPosition(key);
    if (!pos) continue;
    c.beginPath();
    c.arc(pos.x, pos.y, (key === 'shooter' ? 10 : 8) / scale, 0, TAU);
    c.stroke();
  }
  c.restore();
}

// Draw the active marquee selection rectangle.
function renderMarquee(c) {
  if (!marqueeRect) return;
  const x = Math.min(marqueeRect.x1, marqueeRect.x2);
  const y = Math.min(marqueeRect.y1, marqueeRect.y2);
  const w = Math.abs(marqueeRect.x2 - marqueeRect.x1);
  const h = Math.abs(marqueeRect.y2 - marqueeRect.y1);
  c.save();
  c.fillStyle = 'rgba(240, 213, 122, 0.12)';
  c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(240, 213, 122, 0.6)';
  c.lineWidth = 1 / scale;
  c.setLineDash([4 / scale, 3 / scale]);
  c.strokeRect(x, y, w, h);
  c.setLineDash([]);
  c.restore();
}
```

- [ ] **Step 2: Call the rendering functions from `render()`**

In the `render()` function, just before the pen preview block (`if (penMode && penPreviewMouse) {`, approximately line 1140), add:

```javascript
  // Multi-select overlays
  renderSelectionHighlight(ctx);
  renderMarquee(ctx);
```

- [ ] **Step 3: Verify visually**

Run: `npx vite`, open the path editor. Manually set `selectedPoints.add('shooter')` in the browser console.  
Expected: A white glow ring appears around the shooter crosshair. (This is temporary verification — proper wiring comes in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add tools/path-editor/index.html
git commit -m "feat(path-editor): add selection highlight glow rings and marquee rect rendering"
```

---

### Task 5: Wire marquee selection into mouse events

**Files:**
- Modify: `tools/path-editor/index.html` — modify mousedown, mousemove, mouseup handlers

- [ ] **Step 1: Modify the `mousedown` handler to start a marquee on empty area**

In the `mousedown` handler (line ~1990), the existing code at the bottom (after checking for waypoint mode and handle hits) has this block:

```javascript
  const handle = findHandle(g.x, g.y);
  if (handle) {
    dragging = handle;
    if (handle.type === 'curve') selectedCurve = handle.index;
    if (handle.type !== 'curve') selectedCurve = -1;
    selectedWaypoint = -1;
  } else {
    selectedCurve = -1;
    selectedWaypoint = -1;
  }
  buildCurveList();
  updateWaypointMeta();
  render();
```

Replace this entire block with:

```javascript
  const handle = findHandle(g.x, g.y);
  if (handle) {
    // Check if clicking a point that's part of a multi-selection for batch drag
    if (selectedPoints.size > 1 && isHandleSelected(handle)) {
      dragging = { type: 'multiDrag' };
      const snapshots = new Map();
      for (const key of selectedPoints) {
        const pos = getPointPosition(key);
        if (pos) snapshots.set(key, { x: pos.x, y: pos.y });
      }
      multiDragStart = { gx: g.x, gy: g.y, snapshots };
    } else {
      // Shift+click: toggle this point in/out of selection
      if (e.shiftKey) {
        const key = getPointKey(handle.type, handle.index, handle.point);
        if (selectedPoints.has(key)) {
          selectedPoints.delete(key);
        } else {
          selectedPoints.add(key);
        }
      } else {
        // Normal click on a handle: clear multi-select, do normal single-point drag
        clearSelection();
        dragging = handle;
      }
      if (handle.type === 'curve') selectedCurve = handle.index;
      if (handle.type !== 'curve') selectedCurve = -1;
      selectedWaypoint = -1;
    }
  } else {
    // Clicked empty area: start marquee selection
    selectedCurve = -1;
    selectedWaypoint = -1;
    dragging = 'marquee';
    marqueeShift = e.shiftKey;
    marqueeRect = { x1: g.x, y1: g.y, x2: g.x, y2: g.y };
  }
  buildCurveList();
  updateWaypointMeta();
  render();
```

- [ ] **Step 2: Similarly modify the waypoint mode mousedown path**

In the waypoint mode block of the mousedown handler, the existing code ends with:

```javascript
    const index = appendWaypointSmart(g);
    dragging = { type: 'waypoint', index };
    render();
    return;
```

We need to intercept the empty-area case for marquee BEFORE the `appendWaypointSmart` call. Replace the full waypoint mode block (from `if (waypointMode && e.button === 0) {` through its closing `return;`) with:

```javascript
  if (waypointMode && e.button === 0) {
    selectedCurve = -1;
    const wp = findWaypointHandle(g.x, g.y);
    if (wp) {
      // Check for batch drag of multi-selected waypoints
      if (selectedPoints.size > 1 && selectedPoints.has(getPointKey('waypoint', wp.index))) {
        dragging = { type: 'multiDrag' };
        const snapshots = new Map();
        for (const key of selectedPoints) {
          const pos = getPointPosition(key);
          if (pos) snapshots.set(key, { x: pos.x, y: pos.y });
        }
        multiDragStart = { gx: g.x, gy: g.y, snapshots };
      } else if (e.shiftKey) {
        const key = getPointKey('waypoint', wp.index);
        if (selectedPoints.has(key)) selectedPoints.delete(key);
        else selectedPoints.add(key);
        dragging = null;
      } else {
        clearSelection();
        dragging = wp;
      }
      selectedWaypoint = wp.index;
      updateWaypointMeta();
      render();
      return;
    }

    // Shift+click on empty area in waypoint mode: start marquee instead of adding point
    if (e.shiftKey) {
      dragging = 'marquee';
      marqueeShift = true;
      marqueeRect = { x1: g.x, y1: g.y, x2: g.x, y2: g.y };
      render();
      return;
    }

    const insertion = findWaypointInsertion(g.x, g.y);
    if (insertion) {
      clearSelection();
      const index = insertWaypoint(insertion.insertIndex, insertion.point);
      dragging = { type: 'waypoint', index };
      render();
      return;
    }

    clearSelection();
    const index = appendWaypointSmart(g);
    dragging = { type: 'waypoint', index };
    render();
    return;
  }
```

- [ ] **Step 3: Add marquee drag and multi-drag to the `mousemove` handler**

In the `mousemove` handler, after the `if (dragging === 'brush') { ... return; }` block (around line 2103) and before `const level = LEVELS[currentLevel];`, add:

```javascript
  if (dragging === 'marquee') {
    marqueeRect.x2 = g.x;
    marqueeRect.y2 = g.y;
    render();
    return;
  }

  if (dragging && dragging.type === 'multiDrag' && multiDragStart) {
    const dx = g.x - multiDragStart.gx;
    const dy = g.y - multiDragStart.gy;
    for (const [key, snap] of multiDragStart.snapshots) {
      setPointPosition(key, snap.x + dx, snap.y + dy);
    }
    previewDirty = true;
    render();
    return;
  }
```

- [ ] **Step 4: Finalize marquee and multi-drag on mouseup**

In the `mouseup` handler (line ~2181), before the `dragging = null;` line, add:

```javascript
  if (dragging === 'marquee') {
    // Finalize marquee selection
    if (marqueeRect) {
      const w = Math.abs(marqueeRect.x2 - marqueeRect.x1);
      const h = Math.abs(marqueeRect.y2 - marqueeRect.y1);
      if (w > 4 || h > 4) {
        selectPointsInRect(marqueeRect, marqueeShift);
      } else if (!marqueeShift) {
        // Tiny marquee = click on empty area: clear selection
        clearSelection();
      }
    }
    marqueeRect = null;
  }
  if (dragging && dragging.type === 'multiDrag') {
    multiDragStart = null;
    previewDirty = true;
    clearFitStats(LEVELS[currentLevel]);
    buildCurveList();
    updateWaypointMeta();
  }
```

Also add the same marquee/multiDrag cleanup in the `mouseleave` handler, before the `dragging = null;` line:

```javascript
  if (dragging === 'marquee') {
    marqueeRect = null;
  }
  if (dragging && dragging.type === 'multiDrag') {
    multiDragStart = null;
  }
```

- [ ] **Step 5: Verify marquee and multi-drag**

Run: `npx vite`, open the path editor with a level that has curves.  
Test sequence:
1. Click and drag on empty canvas area → golden dashed rectangle appears
2. Release → points inside the rectangle get white glow rings
3. Click a second area while holding Shift → additive selection
4. With multiple points selected, click-drag any selected point → all selected points move together
5. Click empty area without Shift → selection clears

- [ ] **Step 6: Commit**

```bash
git add tools/path-editor/index.html
git commit -m "feat(path-editor): wire marquee selection and batch drag into mouse events

Drag on empty area to draw selection rectangle. Shift+drag for additive.
Click-drag any selected point to move all selected points together."
```

---

### Task 6: Add Ctrl+A, Escape, and selection clearing on mode/level switches

**Files:**
- Modify: `tools/path-editor/index.html` — keydown handler + mode switch + destructive ops

- [ ] **Step 1: Add Ctrl+A and Escape to the keydown handler**

In the `keydown` handler (line ~1808), after the `if (isTextInputFocused()) return;` line, and before the `if (e.code === 'Space' ...)` line, add:

```javascript
  // Multi-select: Ctrl/Cmd+A = select all, Escape = clear selection
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA' && !penMode && !brushMode) {
    e.preventDefault();
    selectAll();
    render();
    return;
  }
  if (e.code === 'Escape' && selectedPoints.size > 0 && !penMode && !brushMode && !waypointMode) {
    e.preventDefault();
    clearSelection();
    render();
    return;
  }
```

Also handle Escape in waypoint mode — add right after the existing `if (e.code === 'Escape' && waypointMode) { window.toggleWaypoints(); }` line:

Find this line in the `else` block:
```javascript
    if (e.code === 'Escape' && waypointMode) { window.toggleWaypoints(); }
```

Replace with:
```javascript
    if (e.code === 'Escape' && waypointMode) {
      if (selectedPoints.size > 0) { clearSelection(); render(); }
      else { window.toggleWaypoints(); }
    }
```

- [ ] **Step 2: Clear selection on level switch**

In the `switchLevel` function (line ~2645), after `selectedAnchor = null;`, add:

```javascript
  clearSelection();
```

- [ ] **Step 3: Clear selection on mode switches**

In `window.toggleWaypoints` (line ~2353), after the `dragging = null;` line, add:
```javascript
  clearSelection();
```

In `window.toggleBrush` (line ~2539), at the end of the function body (before the closing `};`), add:
```javascript
  clearSelection();
```

In `window.togglePen` (line ~2548), at the end of the function body (before the closing `};`), add:
```javascript
  clearSelection();
```

- [ ] **Step 4: Clear selection on destructive operations**

In `window.deleteCurve` (line ~2330), after `clearFitStats(level);`, add:
```javascript
  clearSelection();
```

In `window.clearAll` (line ~2341), after `clearFitStats(level);`, add:
```javascript
  clearSelection();
```

In `window.smoothJoints` (line ~2432), after the function modifies curves (before `render();`), add:
```javascript
  clearSelection();
```

In `window.refitPath` (line ~2467), after the function modifies curves (before `render();`), add:
```javascript
  clearSelection();
```

- [ ] **Step 5: Verify keyboard shortcuts and clearing**

Run: `npx vite`, open the path editor.  
Test:
1. Ctrl+A (or Cmd+A on Mac) → all points get white glow rings
2. Escape → selection clears
3. Select some points → switch level tab → selection clears
4. Select some points → click "Waypoint" → selection clears
5. Select some points → click "删除选中" → selection clears
6. In waypoint mode → Ctrl+A → all waypoints selected
7. In waypoint mode with selection → Escape → selection clears (does NOT exit waypoint mode)
8. In waypoint mode without selection → Escape → exits waypoint mode (existing behavior preserved)

- [ ] **Step 6: Commit**

```bash
git add tools/path-editor/index.html
git commit -m "feat(path-editor): add Ctrl+A select-all, Escape clear, and auto-clear on mode/level switch"
```

---

### Task 7: Update hint text and final polish

**Files:**
- Modify: `tools/path-editor/index.html` — hint bar text

- [ ] **Step 1: Update the canvas hint text**

Find the `#hint` div (line ~169):

```html
  <div id="hint">◎ Waypoint：点击布点后再一键拟合 | 拖拽端点和控制点 | ✎ 笔刷模式直接作画 | Ctrl+滚轮缩放 | 空格+拖拽/中键平移 | Alt+拖拽移动参考图</div>
```

Replace with:

```html
  <div id="hint">◎ Waypoint：点击布点后再一键拟合 | 拖拽端点和控制点 | ✎ 笔刷模式直接作画 | 框选多点拖拽平移 | Ctrl+A 全选 | Shift+点击追加 | Ctrl+滚轮缩放 | 空格+拖拽/中键平移 | Alt+拖拽移动参考图</div>
```

- [ ] **Step 2: Verify the complete feature set end-to-end**

Run: `npx vite`, open the path editor.  
Full test checklist:

**HUD overlay:**
- [ ] Editor canvas shows precise wireframe outlines for all 6 HUD elements
- [ ] Preview panel shows the same wireframes on top of the game scene
- [ ] Toggling "显示 HUD 遮挡" checkbox hides/shows all wireframes
- [ ] Wireframe positions match actual game HUD layout

**Marquee selection:**
- [ ] Dragging on empty area creates a golden dashed selection rectangle
- [ ] Points inside the rectangle get white glow rings on mouseup
- [ ] Shift+drag adds to existing selection (toggle behavior)
- [ ] Tiny drag (< 4px) = click → clears selection

**Ctrl+A:**
- [ ] Default mode: selects all curve points + shooter
- [ ] Waypoint mode: selects all waypoints
- [ ] Does nothing in pen/brush mode

**Batch drag:**
- [ ] With multiple points selected, dragging any one moves all
- [ ] Works for curve points, shooter, and waypoints
- [ ] Preview updates during drag

**Selection clearing:**
- [ ] Click empty area clears selection
- [ ] Escape clears selection
- [ ] Level switch clears selection
- [ ] Mode switch (waypoint/brush/pen) clears selection
- [ ] Destructive ops (delete, clear, refit, smooth) clear selection

- [ ] **Step 3: Commit**

```bash
git add tools/path-editor/index.html
git commit -m "feat(path-editor): update hint text with multi-select shortcuts

Completes HUD overlay and multi-select feature set."
```
