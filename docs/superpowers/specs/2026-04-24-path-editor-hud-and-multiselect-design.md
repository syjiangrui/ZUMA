# Path Editor: HUD Overlay & Multi-Select Design

**Date**: 2026-04-24  
**Scope**: `tools/path-editor/index.html`  
**Goal**: Two improvements to the path editor — (1) show real HUD element outlines so the designer can see occlusion while editing paths, and (2) add marquee selection + Ctrl+A + batch drag so entire curves can be repositioned without moving points one by one.

---

## 1. HUD Occlusion Overlay

### Problem

The editor canvas shows a crude 120px dark band labeled "HUD 区域" and a 70px "按钮区域" at the bottom. Neither reflects the real shape, position, or extent of the actual game DOM HUD elements. The right-side preview panel renders the game world but has zero HUD representation.

### Solution

Draw wireframe outlines of every HUD element on **both** the editor canvas and the preview panel. A shared `drawHudOverlay(ctx)` function draws all elements at game-coordinate positions.

### HUD Elements to Draw (positions from `src/style.css`)

**Right-side button layout** (CSS: `position: absolute; top: 16px; right: 16px; display: flex; gap: 6px`):
- The flex row starts at `right: 16` and items flow left-to-right.
- Total width: `44 + 6 + 36 + 6 + 56 = 148px`
- Group left edge: `430 - 16 - 148 = 266`

| Element | Position (game coords) | Size | Border-radius | Label |
|---------|----------------------|------|---------------|-------|
| Main panel | `(16, 14)` | `232 x 106` | 22px | "HUD 面板" |
| Next-ball | `(266, 16)` | `44 x 44` | 14px | "预览" |
| Sound btn | `(316, 16)` | `36 x 38` | 14px | "音" |
| Restart btn | `(358, 16)` | `56 x 38` | 14px | "重开" |
| Back btn | `(16, 876)` | `56 x 38` | 14px | "选关" |
| Match feedback | `(119, 114)` centered | `192 x 50` | 18px | "消除反馈" |

### Drawing Style

- **Fill**: `rgba(120, 133, 144, 0.15)` — subtle tint showing occluded area
- **Stroke**: `rgba(180, 190, 200, 0.5)`, 1.5px dashed (`setLineDash([4, 3])`)
- **Label**: centered inside each element, `10px` font, `rgba(180, 190, 200, 0.6)`
- **Rounded rects**: use `ctx.roundRect()` or manual arc corners
- The existing crude 120px band and "HUD 区域" / "按钮区域" text are **replaced** by the new precise outlines.

### Toggle

Add a checkbox in the sidebar (below the toolbar, above the curve list):

```html
<label style="..."><input type="checkbox" id="showHudOverlay" checked> 显示 HUD 遮挡</label>
```

When unchecked, `drawHudOverlay()` is a no-op.

### Integration Points

- **Editor canvas `render()`**: call `drawHudOverlay(ctx)` after drawing curves/handles, before cursor. The existing 120px band and bottom 70px band code blocks are removed and replaced.
- **Preview `renderPreview()`**: call `drawHudOverlay(previewCtx)` as the last draw call (on top of everything).

---

## 2. Multi-Select & Batch Drag

### Problem

Every control point (endpoints, control handles, shooter) must be moved individually. Repositioning an entire curve set requires dragging dozens of points one by one — tedious and error-prone.

### Solution

Add three selection mechanisms and a batch drag operation:

1. **Marquee (box) selection** — drag on empty canvas area to draw a rectangle, all points inside get selected
2. **Ctrl+A** — select all points in the current level
3. **Shift+click / Shift+marquee** — add to existing selection
4. **Batch drag** — click-drag any selected point to move all selected points together

### Data Model

```javascript
// Set of string keys identifying selected points
let selectedPoints = new Set();
// Key format: "curve:<index>:<point>" e.g. "curve:0:p1", "curve:0:cp", "curve:3:cp2"
//             "shooter"
//             "waypoint:<index>"

// Active marquee rectangle (game coordinates), null when not active
let marqueeRect = null;  // { x1, y1, x2, y2 }

// Batch drag state
let multiDragStart = null;  // { gx, gy, snapshots: Map<key, {x, y}> }
```

### Key Encoding

| Point type | Key format | Example |
|-----------|-----------|---------|
| Quadratic endpoint | `curve:<i>:p1` / `curve:<i>:p2` | `curve:0:p1` |
| Quadratic control | `curve:<i>:cp` | `curve:2:cp` |
| Cubic endpoint | `curve:<i>:p1` / `curve:<i>:p2` | `curve:1:p2` |
| Cubic handles | `curve:<i>:cp1` / `curve:<i>:cp2` | `curve:1:cp1` |
| Shooter | `shooter` | `shooter` |
| Waypoint | `waypoint:<i>` | `waypoint:5` |

### Interaction: Marquee Selection

**Trigger**: In default tool mode (not waypoint, not brush, not pen), mousedown on empty area (no handle hit) starts a marquee. In waypoint mode, mousedown on empty area (no waypoint hit and not near a line segment for insertion) also starts a marquee.

**During drag**: Draw a selection rectangle with:
- Fill: `rgba(240, 213, 122, 0.12)`
- Stroke: `rgba(240, 213, 122, 0.6)`, 1px dashed `[4, 3]`

**On mouseup**: Compute which points fall inside the normalized rectangle.
- Default mode: test all curve control points (p1, cp/cp1/cp2, p2) and the shooter position.
- Waypoint mode: test all waypoint positions.
- If **Shift** is NOT held: clear previous selection first, then select enclosed points.
- If **Shift** IS held: add enclosed points to existing selection (toggle: if already selected, deselect).

**Minimum size**: If the marquee is smaller than 4px in both dimensions, treat it as a click (clear selection, don't select anything).

### Interaction: Ctrl+A

- Default mode: select every control point of every curve + shooter
- Waypoint mode: select every waypoint
- Pen/brush mode: no-op (these modes own Ctrl)

### Interaction: Shift+Click

Click on a single handle/point:
- If already selected → deselect it
- If not selected → add to selection
- Does NOT clear other selections

### Interaction: Batch Drag

**Trigger**: mousedown on a point that is in `selectedPoints` AND `selectedPoints.size > 1`.

**On drag start**: Snapshot the current position of every selected point into `multiDragStart.snapshots`.

**During mousemove**: For each selected point, set its position to `snapshot + (currentMouse - dragStartMouse)`. Shared endpoints between adjacent curves: when `curve:i:p2` is selected and `curve:i+1:p1` coincides, moving one moves both (they reference the same geometric position — the code already shares these in the data model).

**On mouseup**: Finalize positions (round to integers), clear `multiDragStart`, set `previewDirty = true`, rebuild curve list.

**Single selected point**: If only one point is selected and the user drags it, fall back to the existing single-point drag behavior (preserving current smooth-handle mirroring logic).

### Selection Rendering

Selected points get an additional visual indicator:
- White glow ring: `ctx.arc(x, y, radius + 4, 0, TAU)` with `strokeStyle = 'rgba(255, 255, 255, 0.7)'`, `lineWidth = 2`
- Drawn in the handle-drawing pass, after the normal handle rendering

### Selection Clearing

Selection is cleared when:
- Click on empty area without Shift (and marquee too small to count)
- Press Escape (when not in pen/brush/waypoint sub-tool)
- Switch to a different level tab
- Switch editing mode (enter/exit waypoint, brush, pen)
- Any destructive operation (delete curve, clear all, refit, smooth joints)

### Keyboard Shortcut Summary

| Key | Action |
|-----|--------|
| Ctrl+A (or Cmd+A) | Select all points in current mode |
| Escape | Clear selection |
| Shift + click | Toggle single point in/out of selection |
| Shift + marquee | Additive marquee selection |

### Compatibility with Existing Modes

- **Default mode**: Full support (curves + shooter)
- **Waypoint mode**: Full support (waypoints only — curve handles are not shown in waypoint mode)
- **Brush mode**: Multi-select disabled (brush owns mousedown for strokes)
- **Pen mode**: Multi-select disabled (pen has its own Ctrl/click semantics)

---

## 3. Implementation Scope

All changes are in a single file: `tools/path-editor/index.html`.

### New Functions

- `drawHudOverlay(ctx)` — draw all HUD wireframes
- `drawRoundedRect(ctx, x, y, w, h, r)` — utility (if not already present)
- `getPointKey(type, index, point)` — generate selection key
- `getPointPosition(key)` — resolve key to `{x, y}`
- `setPointPosition(key, x, y)` — write position back to data model
- `selectPointsInRect(rect, additive)` — marquee resolution
- `selectAll()` — Ctrl+A handler
- `clearSelection()` — reset selectedPoints
- `renderSelectionHighlight(ctx)` — draw glow rings on selected points
- `renderMarquee(ctx)` — draw active selection rectangle

### Modified Functions

- `render()` — call `drawHudOverlay`, `renderSelectionHighlight`, `renderMarquee`; remove old 120px/70px band code
- `renderPreview()` — call `drawHudOverlay` at end
- `mousedown` handler — add marquee start logic, batch drag detection
- `mousemove` handler — add marquee drag, batch drag movement
- `mouseup` handler — add marquee finalize, batch drag finalize
- `keydown` handler — add Ctrl+A, Escape for selection clearing

### New State Variables

```javascript
let selectedPoints = new Set();
let marqueeRect = null;
let multiDragStart = null;
let showHudOverlay = true;
```

### Removed Code

- The existing 120px "HUD 区域" dark band drawing (lines ~868-879)
- The 70px "按钮区域" bottom band drawing (lines ~881-891)
- These are replaced by `drawHudOverlay()`.
