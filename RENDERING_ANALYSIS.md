# ZUMA Game Rendering Pipeline - Thorough Analysis

## Executive Summary

The ZUMA game is a canvas-based puzzle game with a sophisticated rendering architecture that manages:
- **Multiple game states** (levelSelect, playing, win, lose)
- **Dynamic UI elements** drawn on canvas (HUD, buttons, score displays, end-game cards)
- **Mobile-responsive layout** with safe-area awareness and screen shake effects
- **Canvas scaling/viewport system** that handles both mobile full-screen and desktop windowed modes
- **Hierarchical rendering** organized across separate modules (hud.js, screens.js, scene.js)

---

## 1. COMPLETE INVENTORY OF CANVAS-DRAWN UI ELEMENTS

### 1.1 HUD (Top Bar) - Always Visible During Gameplay

#### Location: `src/render/hud.js::drawOverlay()`
**Y-position:** Always at y=0 to y=120 (extends behind notch on mobile)
**Visibility:** Shown during levelSelect AND playing/win/lose states

**Components drawn:**

| Element | Type | Purpose | Interactivity |
|---------|------|---------|---------------|
| Main Stone Panel | Rounded panel w/ gradient | Background for HUD | Non-interactive |
| Stone Speckle | Procedural texture (18 ellipses) | Visual detail on panel | Non-interactive |
| Mayan Zigzag Trim | Path trim at bottom of panel | Decorative border | Non-interactive |
| Sun/Altar Icon | Nested circles + rays (8 rays) | Title decoration (top-left) | Non-interactive |
| Level Name Text | Text ("祭坛试炼") | Title in gold | Non-interactive |
| Level Number Text | Text (subtitle) | "第 X 关 · 祭坛试炼" | Non-interactive |
| State Indicator Dot | Colored circle (3px radius) | Green/Gold/Red status | Non-interactive |
| State Label | Text | "进行中"/"胜利"/"失败" | Non-interactive |
| Chain Length Label | Text ("链长") | Shows current ball count | Non-interactive |
| Chain Length Number | Number text (gold) | Dynamic count display | Non-interactive |
| Score Label | Text ("分数") | Score prefix | Non-interactive |
| Score Number | Large gold number | Current score | Non-interactive |
| Combo Text | Text ("连击: x? / 最高连击: x? / 连击: -") | Combo display | Non-interactive |
| **Next Ball Preview** | Stone panel + rotating halo + ball | Shows next shot color | **Clickable** (interacts with sight line) |
| Next Arrow | Text ("▸") | "Ready" indicator | Non-interactive |
| Rotating Halo | Dashed arc | Rotating indicator ring | Non-interactive |
| **Sound Button** | Stone panel + speaker icon/slash | Mutes/unmutes audio | **Clickable** |
| Speaker Body | Icon path | Visual feedback | Non-interactive |
| Sound Waves/Mute Slash | Icon strokes | Muted state indicator | Non-interactive |
| **Restart Button** | Stone panel + text "重开" | Restarts current level | **Clickable** |
| Button Highlight | Rounded rect | Press state visual | Non-interactive |
| **Back Button** | Stone panel + text "选关" | Return to level select | **Clickable** (bottom-left) |

**Sub-panels (recessed):**
- Left panel: Houses score info
- Right panel: Houses combo info
- Both have micro-speckle texture overlay

**HUD Scaling on Mobile:**
- `hudShift` property: Offsets interactive elements down to avoid notch
- Panel background always drawn at y=0 (extends behind notch)
- Interactive buttons shift down by `hudShift` value
- Uses safe-area-inset-top to calculate `hudShift`

---

### 1.2 Round-End State Cards (Win/Lose)

#### Location: `src/render/screens.js::drawRoundStateCard()`
**Y-position:** y = GAME_HEIGHT * 0.18 to y = GAME_HEIGHT * 0.18 + 370
**Visibility:** Shown when `gameState !== "playing"`

**WIN Card Components:**

| Element | Type | Purpose | Interactivity |
|---------|------|---------|---------------|
| Dim Overlay | Full-screen dark rect | Backdrop darkening | Non-interactive |
| Main Card Panel | Large stone panel (320×370) | Card background | Non-interactive |
| Stone Speckle | Procedural texture (14 ellipses) | Detail overlay | Non-interactive |
| Badge - Double Ring | Two concentric circles | Decoration | Non-interactive |
| Badge - Sun Icon | Circle + 8 rays | Win indicator | Non-interactive |
| Title Text | "祭坛告捷" (gold text) | Large heading | Non-interactive |
| Subtitle Text | "球链已被清空" | Descriptive text | Non-interactive |
| Score Label | Text ("本局得分") | Score heading | Non-interactive |
| Score Number | Large gold number | Final score display | Non-interactive |
| Combo Badge | Inset stone sub-panel | Combo summary | Non-interactive |
| Combo Text | Text ("最高连击 x?" or "本局未触发连击") | Best combo achieved | Non-interactive |
| Mayan Zigzag Trim | Path trim at panel bottom | Decorative footer | Non-interactive |
| **Next Button** (if more levels) | Stone panel + "下一关" | Advance to next level | **Clickable** |
| Pulse Halo | Rounded rect pulse | Button attraction | Non-interactive |
| **Replay Button** | Stone panel + "重玩本关" | Restart current level | **Clickable** |
| **Back Button** | Stone panel + "返回选关" | Return to level select | **Clickable** |

**LOSE Card Components:**

| Element | Type | Purpose | Interactivity |
|---------|------|---------|---------------|
| Dim Overlay | Full-screen dark rect | Backdrop darkening | Non-interactive |
| Main Card Panel | Large stone panel (320×370) | Card background | Non-interactive |
| Badge - Double Ring | Two concentric circles | Decoration | Non-interactive |
| Badge - Crack Lines | 3 cracked path segments | Lose indicator | Non-interactive |
| Title Text | "试炼中断" (tan text) | Large heading | Non-interactive |
| Subtitle Text | "球链抵达终点" | Descriptive text | Non-interactive |
| Score Label & Number | Score display (tan/gold) | Final score | Non-interactive |
| Combo Badge & Text | Combo summary | Best combo achieved | Non-interactive |
| Mayan Zigzag Trim | Path trim at panel bottom | Decorative footer | Non-interactive |
| **Restart Button** | Stone panel + "重试" (centered) | Retry current level | **Clickable** |
| Pulse Halo | Rounded rect pulse (red-tinted) | Button attraction | Non-interactive |
| **Back Button** | Stone panel + "返回选关" | Return to level select | **Clickable** |

**Card Animations:**
- `roundEndTimer` drives pulse effect on buttons: `0.08 + 0.06 * Math.sin(roundEndTimer * 2.5)`
- Win halo is gold; Lose halo is red-tinted
- Badge styling changes (gold vs tan)

---

### 1.3 Level Select Screen

#### Location: `src/render/screens.js::drawLevelSelectScreen()`
**Y-position:** Full screen (0 to GAME_HEIGHT)
**Visibility:** Shown when `gameState === "levelSelect"`

**Background:**
- Linear gradient: #17383e → #10272d → #0a1519
- Slab gradient overlay: #7f8990 → #6e7880 → #5b646d (from y=120 downward)

**Header:**
- Title: "祭坛试炼" (gold text with shadow)
- Subtitle: "选择关卡" (tan text)
- Decorative line separator (1.5px stroke)

**Level Buttons (Grid: 2 columns):**

Per level button:

| Element | Type | Purpose | Interactivity |
|---------|------|---------|---------------|
| Stone Panel Background | Rounded panel | Button body | **Clickable** |
| Level Number | Large gold text | "1", "2", "3", etc. | Non-interactive |
| Level Name | Medium text | Custom name per level | Non-interactive |
| Status Badge | Small text | "✓ 已通关"/"未通关"/"🔒 未解锁" | Non-interactive |
| High Score | Text | "最高分: XXXX" (if played) | Non-interactive |
| Path Thumbnail | Simplified path drawing | Visual preview | Non-interactive |
| Color Dots | Colored circles | Shows available colors | Non-interactive |

**Path Thumbnail Types:**
- Spiral: 60-point Archimedean spiral
- Serpentine: Wavy sine pattern
- Rectangular: Box-within-box pattern
- OpenArc: Arc segment
- Zigzag: 5-row zigzag pattern
- Drawn: Custom segments (line/arc/circle types)

**Button Grid Layout:**
- Columns: 2
- Grid X: 40, Column spacing: 22
- Grid Y: 180, Row spacing: 18
- Button size: 164×120 per level

**Button State Colors:**
- Unlocked, not cleared: Gray tone
- Cleared: Green-toned panel
- Unlocked, not cleared: Default stone color
- Press state: y+1 offset

**Sound Button** (appears on level select):
- Stone panel + speaker icon
- Same as HUD version
- **Clickable**

**Reset Progress Button:**

| Element | Type | Purpose | Interactivity |
|---------|------|---------|---------------|
| Stone Panel | Recessed panel (120×32) | Button body | **Clickable** |
| Text | "重置进度" | Reset label | Non-interactive |

**Position:** Bottom center (y = GAME_HEIGHT - 60)

---

### 1.4 All-Clear Screen (Bonus: Ultimate Victory)

#### Location: `src/render/screens.js::drawAllClearScreen()`
**Y-position:** Centered in viewport
**Visibility:** Shown when player clears ALL levels AND wins final level

**Components:**

| Element | Type | Purpose | Interactivity |
|---------|------|---------|---------------|
| Dim Overlay | Full-screen dark rect (0.6 alpha) | Heavy darkening | Non-interactive |
| Main Panel | Large stone panel (340×400) | Card background (centered) | Non-interactive |
| Badge - Circle + Ring | Concentric circles | Outer frame | Non-interactive |
| Badge - Sun Icon | Circle + 12 rays | Victory marker | Non-interactive |
| Title Text | "祭坛大捷" (gold) | "All Dungeons Conquered" | Non-interactive |
| Subtitle Text | "全部关卡已通关" | Completion message | Non-interactive |
| Per-Level Score Line | Multiple rows of text | Level # + Name + Score | Non-interactive |
| Divider Line | Thin stroke | Separator before total | Non-interactive |
| Total Score Label | Text ("总分") | Sum heading | Non-interactive |
| Total Score Number | Large gold number | Sum of all levels | Non-interactive |
| **Back Button** | Stone panel + "返回选关" | Return to level select | **Clickable** |

**Layout:**
- Panel positioned at panelY = GAME_HEIGHT * 0.08
- Per-level scores start at panelY + 138
- Each score line: 22px apart
- Total shown at startY + (LEVELS.length * 22 + 16)
- Back button adjusted to panelY + panelH - 50

---

### 1.5 Gameplay Elements (Scene Layer)

#### Location: `src/render/scene.js`
**Visibility:** Shown when gameState is "playing", "win", or "lose"

**Background:**

| Element | Type | Purpose |
|---------|------|---------|
| Canopy Gradient | Linear gradient top | Sky gradient |
| Slab Gradient | Linear gradient middle-bottom | Stone surface gradient |
| Speckle Texture (white) | 16 procedural ellipses | Surface detail highlight |
| Speckle Texture (dark) | 12 procedural ellipses | Surface detail shadow |
| Radial Glow | Radial gradient centered at shooter | Golden ambient light |
| Tile Decorations | 4 corner stone panels | Decorative corner elements |
| Altar Glow | Radial gradient from shooter center | Glowing aura effect |
| Altar Ring Outline | Two strokes (grey + gold) | Circular marker around altar |
| Altar Shadow | Dark ellipse | Depth shadow under frog |

**Track/Path:**

| Element | Type | Purpose |
|---------|------|---------|
| Shadow Layer | Thick stroke (16px) | Depth shadow |
| Main Track | Medium stroke (10px) | Primary path line |
| Detail Layer | Thin stroke (4px) | Shading detail |

**Goal Marker (at path end):**

| Element | Type | Purpose |
|---------|------|---------|
| Aura Glow | Radial gradient | Golden halo |
| Center Circle | Filled circle | Dark core |
| Ring | Stroke circle | Gold outline |

**Chain (Ball Sequence):**

| Element | Type | Purpose |
|---------|------|---------|
| Individual Balls | Textured circles | Each ball in chain |
| Clipping Rect | Play area bounds | Hides balls in HUD/button zones |

**Projectile (Player's Shot):**

| Element | Type | Purpose |
|---------|------|---------|
| Ball | Textured circle | Current shot ball |
| Same clip | Play area bounds | Hides in UI zones |

**Aim Guide:**

| Element | Type | Purpose |
|---------|------|---------|
| Dashed Line | Stroke path | Aiming assistance line |
| Dash pattern | [9, 10] | Intermittent visibility |

**Shooter/Frog:**

| Element | Type | Purpose |
|---------|------|---------|
| Ground Shadow | Flat ellipse | Depth indicator |
| Frog Body Layers (cached) | Stone carving graphics | Squat toad silhouette |
| Current Ball | Live textured sphere | Ball in frog's mouth |
| Belly Socket Ball | Live textured sphere | Reflected ball preview |
| Rotation | Angle-based transform | Frog aims with pointer |

**Particles:**

| Element | Type | Purpose |
|---------|------|---------|
| Match Debris | 6 particles per eliminated ball | Debris burst effect |
| Victory Particles | 40 initial golden particles | Win celebration |
| Celebration Ticks | 2 particles every frame (~1.5s) | Ongoing sparkles |

**Rendering Order (inside play-area clip):**
1. Static scene cache (background + track + goal)
2. Chain (all visible balls)
3. Particles (debris, celebration)
4. Projectile (current shot)
5. Aim guide (dashed line)
6. Shooter (frog + mouth ball)

---

### 1.6 Overlay Effects (on top of scene)

#### Screen Shake
- Applied when `gameState === "lose"`
- Intensity: `screenShake * 14` pixels max
- Applies random x/y translate to entire scene

#### Fade Overlay
- Full-screen dark rect
- Used for level transition animations
- Alpha animates in/out at speed 3.0
- Drawn on top of everything

#### Mobile Play-Area Shift
- Translate entire play-area up by `playShift` pixels
- Centers path vertically in viewport
- Does NOT affect HUD or bottom buttons
- Applied only on mobile with tall phones

---

## 2. RENDERING ORGANIZATION ACROSS FILES

### File Structure & Responsibilities:

```
src/render/
├── index.js              (Main render dispatcher + mobile viewport setup)
├── hud.js                (HUD panel + buttons + match feedback floating text)
├── screens.js            (Level select, end cards, all-clear screen)
├── scene.js              (Background, track, chain, projectile, shooter, particles)
├── ball-textures.js      (Ball texture generation, frog caching, drawBall)
├── draw-utils.js         (Utility: rounded rects, stone panels, texture seaming)
```

### Call Graph:

```
main.js::ZumaGame.render()
  └─ render/index.js::render(game)
     ├─ [Mobile viewport setup]
     │  ├─ clearRect (identity transform)
     │  ├─ fillMobileBottomGap() [if needed]
     │  └─ applyMobileTransform()
     │
     ├─ [Level Select State]
     │  └─ screens.js::drawLevelSelectScreen()
     │     ├─ Background gradients
     │     ├─ Title text
     │     ├─ Level buttons (loop)
     │     │  └─ drawPathThumbnail()
     │     ├─ drawSoundButton()
     │     └─ Reset progress button
     │
     ├─ [Playing/End State - Main Render]
     │  ├─ Screen shake transform [if gameState === "lose"]
     │  ├─ Play-area shift transform [if mobile playShift > 0]
     │  │
     │  ├─ scene.js::createStaticSceneCache() [if needed]
     │  │  ├─ scene.js::drawBackground()
     │  │  ├─ scene.js::drawTrack()
     │  │  └─ scene.js::drawGoal()
     │  │
     │  ├─ scene.js::drawChain()
     │  ├─ scene.js::drawParticles()
     │  ├─ scene.js::drawProjectile()
     │  ├─ scene.js::drawAimGuide()
     │  ├─ scene.js::drawShooter()
     │  │  └─ ball-textures.js::drawBall() [x2: mouth + belly]
     │  │
     │  ├─ [Restore play-area shift]
     │  │
     │  ├─ [HUD & Feedback]
     │  │  ├─ Mobile notch fill [if needed]
     │  │  ├─ hud.js::drawOverlay()
     │  │  │  ├─ HUD panel cache (if first frame)
     │  │  │  ├─ Text overlays (live each frame)
     │  │  │  ├─ hud.js::drawHudNextPreview()
     │  │  │  ├─ hud.js::drawSoundButton()
     │  │  │  └─ hud.js::drawRestartButton() [x2]
     │  │  │
     │  │  └─ hud.js::drawMatchFeedback()
     │  │     └─ Floating score popups
     │  │
     │  ├─ [Restore screen shake]
     │  │
     │  ├─ [End-Game Overlays]
     │  │  ├─ game.drawRoundEndEffect() [custom glow/vignette]
     │  │  ├─ Dim overlay (mobile: fullscreen fill)
     │  │  └─ screens.js::drawRoundStateCard()
     │  │     ├─ Win/Lose badges
     │  │     ├─ End-game buttons
     │  │     └─ Score/combo display
     │  │
     │  ├─ screens.js::drawAllClearScreen() [if applicable]
     │  │
     │  └─ [Fade overlay]
     │     └─ Full-screen dim rect
```

### Key Design Patterns:

1. **Caching:** 
   - `hudPanelCache`: Pre-rendered HUD stone panels (rebuild on hudShift change)
   - `staticSceneCache`: Background + track + goal (rebuild on path change)
   - `frogCacheBehind/Front`: Frog layers split for live ball insertion

2. **Mobile Transforms:**
   - Identity transform for native resolution
   - Mobile coordinate transform applied after clearing
   - HUD drawn in game coords but buttons positioned with hudShift offset

3. **Clipping:**
   - Play-area clip (HUD_HEIGHT to GAME_HEIGHT - BOTTOM_BUTTON_HEIGHT)
   - Applied to: chain, projectile, track, goal
   - Prevents UI overlap from gameplay content

4. **State-Based Rendering:**
   - gameState gates entire render path
   - Different screens drawn exclusively
   - Overlays (fade, dim, screen shake) composed on top

---

## 3. INPUT & HIT-TESTING FOR CANVAS-DRAWN UI

### 3.1 Hit-Testing System

#### Overview:
All UI hit-testing happens in **logical game coordinates** (430×932), even on mobile where physical canvas is full-screen.

#### Event Flow:

```
pointerdown (any button)
  ↓
updatePointer(event) [convert screen coords → game coords]
  ↓
getUiActionAt(x, y) [hit-test all UI rects]
  ↓
If hit: uiPressAction = action string, capture pointer
If miss & gameState === "playing": pointer.active = true
  
pointermove
  ↓
updatePointer(event)
  ↓
If uiPressAction: stay on uiPressAction (no gameplay aim)
If pointer.active: update aim (smooth rotation)
  
pointerup
  ↓
If uiPressAction: 
  - Check if still inside same rect
  - If yes: triggerUiAction(action)
  - Release capture
If pointer.active:
  - Fire projectile()
  - Release capture
```

#### Coordinate Conversion:

**Desktop/Tablet (no mobile layout):**
```javascript
const scaleX = GAME_WIDTH / rect.width;
const scaleY = GAME_HEIGHT / rect.height;
this.pointer.x = (event.clientX - rect.left) * scaleX;
this.pointer.y = (event.clientY - rect.top) * scaleY;
```

**Mobile Full-Screen:**
```javascript
const { scale } = mobileLayout; // e.g., 0.7 for 300px phone
this.pointer.x = (event.clientX - rect.left) / scale;
this.pointer.y = (event.clientY - rect.top) / scale;
```

**Note:** Pointer Y is in **screen-logical space** (not shifted by playShift). When comparing to shooter.y (which is in play-area-logical space), add playShift.

### 3.2 Interactive Element Rects

All rects are dynamically calculated (no hardcoding) so they stay aligned with rendered positions even with safe-area shifts.

#### HUD Buttons (During Playing State):

**Back Button (Bottom-Left):**
```javascript
getHudBackButtonRect() {
  const m = this.mobileLayout;
  const safeShift = m?.safeBottom / m?.scale || 0;
  const cropOffset = m?.cropBottom || 0;
  return {
    x: 16,
    y: GAME_HEIGHT - 54 - cropOffset - safeShift,
    w: 80,
    h: 36
  };
}
```

**Restart Button (Top-Right):**
```javascript
getHudRestartButtonRect() {
  const s = this.mobileLayout?.hudShift || 0;
  return { x: GAME_WIDTH - 78, y: 18 + s, w: 64, h: 38 };
}
```

**Sound Button (Top-Right, Left of Restart):**
```javascript
getHudSoundButtonRect() {
  const s = this.mobileLayout?.hudShift || 0;
  return { x: GAME_WIDTH - 120, y: 18 + s, w: 36, h: 38 };
}
```

**Next Preview (Top-Right, Left of Sound):**
```javascript
getHudNextPreviewRect() {
  const s = this.mobileLayout?.hudShift || 0;
  return { x: GAME_WIDTH - 170, y: 16 + s, w: 44, h: 44 };
}
```

All incorporate `hudShift` to avoid iOS notch.

#### End Card Buttons (Win/Lose State):

**Next Level Button (If more levels, right side):**
```javascript
getEndCardNextButtonRect() {
  if (this.gameState !== "win" || this.currentLevel >= LEVELS.length) return null;
  return {
    x: GAME_WIDTH * 0.5 + 16,
    y: GAME_HEIGHT * 0.18 + 248,
    w: 140,
    h: 38,
  };
}
```

**Restart Button (Left of next, or center if no next):**
```javascript
getEndCardRestartButtonRect() {
  if (this.gameState === "playing" || this.gameState === "levelSelect") return null;
  if (this.gameState === "win" && this.currentLevel < LEVELS.length) {
    // Left of next button
    return {
      x: GAME_WIDTH * 0.5 - 156,
      y: GAME_HEIGHT * 0.18 + 248,
      w: 140,
      h: 38,
    };
  }
  // Centered alone
  return {
    x: GAME_WIDTH * 0.5 - 100,
    y: GAME_HEIGHT * 0.18 + 248,
    w: 200,
    h: 40,
  };
}
```

**Back Button (Below action buttons):**
```javascript
getEndCardBackButtonRect() {
  return {
    x: GAME_WIDTH * 0.5 - 100,
    y: GAME_HEIGHT * 0.18 + 248 + 52,
    w: 200,
    h: 36,
  };
}
```

#### Level Select Screen Buttons:

**Level Button Grid:**
```javascript
getLevelButtonRect(levelId) {
  const col = (levelId - 1) % 2;
  const row = Math.floor((levelId - 1) / 2);
  const gridX = 40;
  const gridY = 180;
  const btnW = 164;
  const btnH = 120;
  const gapX = 22;
  const gapY = 18;
  return {
    x: gridX + col * (btnW + gapX),
    y: gridY + row * (btnH + gapY),
    w: btnW,
    h: btnH,
  };
}
```

**Reset Progress Button:**
```javascript
getResetProgressButtonRect() {
  return { x: GAME_WIDTH * 0.5 - 60, y: GAME_HEIGHT - 60, w: 120, h: 32 };
}
```

### 3.3 Hit-Testing Logic

#### Core Method:

```javascript
isPointInsideRect(x, y, rect) {
  return (
    !!rect &&
    x >= rect.x &&
    x <= rect.x + rect.w &&
    y >= rect.y &&
    y <= rect.y + rect.h
  );
}
```

Simple AABB check with null-safety.

#### Main Dispatcher:

```javascript
getUiActionAt(x, y) {
  // Level Select State
  if (this.gameState === "levelSelect") {
    for (const level of LEVELS) {
      const rect = this.getLevelButtonRect(level.id);
      if (this.isPointInsideRect(x, y, rect)) {
        return `selectLevel:${level.id}`;
      }
    }
    if (this.isPointInsideRect(x, y, this.getResetProgressButtonRect())) {
      return "resetProgress";
    }
    return null;
  }

  // End Card State (win/lose)
  if (this.gameState !== "playing") {
    const nextBtn = this.getEndCardNextButtonRect();
    if (this.isPointInsideRect(x, y, nextBtn)) {
      return "nextLevel";
    }
    const endCardRestart = this.getEndCardRestartButtonRect();
    if (this.isPointInsideRect(x, y, endCardRestart)) {
      return "restart";
    }
    const backBtn = this.getEndCardBackButtonRect();
    if (this.isPointInsideRect(x, y, backBtn)) {
      return "backToSelect";
    }
  }

  // HUD Buttons (all states except levelSelect)
  if (this.isPointInsideRect(x, y, this.getHudBackButtonRect())) {
    return "backToSelect";
  }
  if (this.isPointInsideRect(x, y, this.getHudRestartButtonRect())) {
    return "restart";
  }
  if (this.isPointInsideRect(x, y, this.getHudSoundButtonRect())) {
    return "toggleSound";
  }
  return null;
}
```

**Priority:**
1. Level select buttons (if in that state)
2. End card buttons (if win/lose)
3. HUD buttons (always available unless level select)

This prevents accidental clicks on HUD when clicking end-card buttons.

### 3.4 Button Press Feedback

Buttons show visual feedback while pressed:

```javascript
const isPressed =
  game.uiPressAction === "toggleSound" &&
  game.isPointInsideRect(game.pointer.x, game.pointer.y, rect);

// In rendering:
ctx.translate(cx, cy + (isPressed ? 1 : 0)); // Subtle drop shadow effect
```

Each button draws itself slightly offset (y+1) when pressed to simulate depression.

---

## 4. GAME STATE MACHINE

### 4.1 State Definition

```javascript
this.gameState = "playing" | "levelSelect" | "win" | "lose"
```

**Single, game-wide gate for all logic paths.**

### 4.2 State Transition Diagram

```
[Initial Load]
  ↓
levelSelect
  ├─ User clicks level button
  ├─ loadLevel(levelId)
  │  ├─ startFade("out", callback)
  │  ├─ Callback: gameState = "playing", resetRound()
  │  └─ startFade("in")
  ↓
playing
  ├─ update() runs game simulation
  ├─ Player fires projectile, matches occur
  ├─ Chain advances toward goal
  │
  ├─ Victory condition: chain.length === 0 && projectile === null
  │  └─ setGameState("win")
  │     ├─ pointer.active = false
  │     ├─ projectile = null
  │     ├─ spawnVictoryParticles()
  │     ├─ sfx.playWin()
  │     └─ onLevelWin()
  │
  ├─ Defeat condition: any ball reaches goal end (checked in updateRoundOutcome)
  │  └─ setGameState("lose")
  │     ├─ pointer.active = false
  │     ├─ projectile = null
  │     ├─ sfx.playLose()
  │     └─ onLevelLose()
  │
  └─ Gameplay inputs ONLY processed when gameState === "playing"
     ├─ pointerdown/up → fireProjectile()
     ├─ space key → fireProjectile()
     ├─ R key → resetRound()
     └─ pointermove → updateAim()

win / lose
  ├─ NO gameplay updates occur
  ├─ Animations tick: roundEndTimer, particles, screen shake
  ├─ End-game buttons available
  │
  ├─ User clicks "Next Level" (win only, if levels remain)
  │  └─ loadLevel(currentLevel + 1)
  │     └─ → back to playing
  │
  ├─ User clicks "Restart"
  │  └─ resetRound()
  │     └─ → back to playing
  │
  ├─ User clicks "Back to Level Select"
  │  └─ goToLevelSelect()
  │     ├─ gameState = "levelSelect"
  │     ├─ startFade("out", callback)
  │     └─ Callback: clear gameplay (chain, projectile, particles)
  │
  └─ Special: if all levels won (currentLevel >= LEVELS.length)
     ├─ drawAllClearScreen() displayed
     └─ "Back" button returns to level select

[Loop continues]
```

### 4.3 State Guards in Update Loop

```javascript
update(dt) {
  this.updateFade(dt); // Runs in all states
  
  if (this.gameState === "levelSelect") {
    return; // Stop all game logic
  }
  
  this.updateHudState(dt);
  this.updateParticles(dt);
  
  // Round-end animations tick even when not playing
  if (this.gameState !== "playing") {
    this.roundEndTimer += dt;
    this.screenShake decay...
    this.spawnCelebrationTick(); // If win
  }
  
  if (!this.isRoundPlaying()) {
    return; // Stop gameplay logic
  }

  // ONLY in "playing" state:
  this.updateAim(dt);
  this.updateChain(dt);
  this.syncShooterPalettes();
  this.updateProjectile(dt);
  this.updateRoundOutcome();
}

isRoundPlaying() {
  return this.gameState === "playing";
}
```

### 4.4 setGameState() - The Centralizer

All state transitions **must** funnel through this one method:

```javascript
setGameState(nextState) {
  this.gameState = nextState;
  if (nextState !== "playing") {
    this.pointer.active = false;
    this.projectile = null;
    this.roundEndTimer = 0;
    if (nextState === "win") {
      this.spawnVictoryParticles();
      this.sfx.playWin();
      this.onLevelWin();
    } else if (nextState === "lose") {
      this.sfx.playLose();
      this.onLevelLose();
    }
  }
}
```

Benefits:
- All cleanup guaranteed (no stale projectiles, active pointers)
- SFX triggered at right moment
- Progress saved on win/lose
- State invariants maintained

### 4.5 Fade Transitions

Level transitions use a fade-in/out pattern:

```javascript
startFade(direction, callback) {
  this.fadeOverlay = { alpha: direction === "out" ? 0 : 1, direction, callback };
}

updateFade(dt) {
  if (!this.fadeOverlay) return;
  const speed = 3.0; // ~0.33s fade
  
  if (this.fadeOverlay.direction === "out") {
    this.fadeOverlay.alpha = Math.min(1, this.fadeOverlay.alpha + speed * dt);
    if (this.fadeOverlay.alpha >= 1) {
      const cb = this.fadeOverlay.callback;
      this.fadeOverlay = null;
      if (cb) cb(); // Execute state change
    }
  } else {
    this.fadeOverlay.alpha = Math.max(0, this.fadeOverlay.alpha - speed * dt);
    if (this.fadeOverlay.alpha <= 0) {
      this.fadeOverlay = null;
    }
  }
}
```

Usage in `loadLevel()`:
```javascript
loadLevel(levelId) {
  this.startFade("out", () => {
    this.currentLevel = levelId;
    this.levelConfig = getLevelById(levelId);
    this.resetRound(); // gameState set to "playing" here
    this.startFade("in", null);
  });
}
```

---

## 5. CANVAS SCALING & VIEWPORT SYSTEM

### 5.1 Two Render Modes

#### Mode 1: Desktop/Tablet (width ≥ 700px OR not touch)

- Fixed 430×932 canvas
- DPR scaling only (device pixel ratio)
- Letterboxed in center of screen
- Border radius + shadow for frame effect

```javascript
// In resize():
this.canvas.width = GAME_WIDTH * dpr;
this.canvas.height = GAME_HEIGHT * dpr;
this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
this.mobileLayout = null;
```

#### Mode 2: Mobile Full-Screen (width < 700px AND touch)

- Canvas fills 100vw × 100dvh
- Content scaled uniformly to fit width
- Play-area vertically centered if viewport is tall enough
- HUD pinned to top, bottom buttons extend below screen

```javascript
// In resize():
const vw = window.innerWidth;
const vh = window.innerHeight;
this.canvas.width = Math.round(vw * dpr);
this.canvas.height = Math.round(vh * dpr);

const scale = vw / GAME_WIDTH; // e.g., 0.7 on 300px phone
this.ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);

this.mobileLayout = {
  active: true,
  scale, dpr,
  cropTop: 0,
  cropBottom, // How many game-pixels hidden below screen
  offsetX: 0, offsetY: 0,
  hudShift, // Notch avoidance offset
  playShift, // Vertical centering offset
  safeTop, safeBottom, // Safe-area insets (px)
  screenWidth: vw, screenHeight: vh,
};
```

### 5.2 Mobile Viewport Calculation

**Step 1: Compute scale**
```javascript
const scale = vw / GAME_WIDTH; // Fills width uniformly
```

**Step 2: Compute vertical crop**
```javascript
const gameScreenH = GAME_HEIGHT * scale; // Rendered height in screen pixels
const cropBottom = gameScreenH > vh ? (gameScreenH - vh) / scale : 0;
// How many game-pixels are hidden below the screen
```

**Step 3: Compute HUD shift (notch avoidance)**
```javascript
const safeTop = this.getSafeAreaInset('top'); // Read from CSS --raw-sat
const hudShift = safeTop > 0
  ? Math.max(0, safeTop / scale - 14)
  : 0;
// Push HUD interactive elements below notch
```

**Step 4: Compute play-area shift (path centering)**
```javascript
if (cropBottom > 0 && this.pathYBounds) {
  const pathMidY = (this.pathYBounds.minY + this.pathYBounds.maxY) / 2;
  const hudHeight = HUD_HEIGHT + hudShift;
  const visiblePlayH = vh / scale - hudHeight;
  const desiredVisibleY = hudHeight + visiblePlayH / 2;
  playShift = pathMidY - desiredVisibleY;
  
  // Clamp to buffer zones only (don't crop gameplay area or HUD)
  playShift = Math.min(playShift, cropBottom);
  playShift = Math.max(0, playShift);
}
```

**Effect:** If the phone is so short that all 932 game pixels don't fit, shift the play area UP so the middle of the path sits at the center of the visible region. This replaces pure bottom-cropping with balanced visibility.

### 5.3 Rendering with Mobile Layout

**In render():**

```javascript
if (mobile) {
  // 1. Clear at native resolution
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 2. Fill bottom gap if needed
  fillMobileBottomGap();
  
  // 3. Apply game coordinate transform
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}

// ... All rendering in game coords (430×932) ...

if (playShift > 0) {
  ctx.save();
  ctx.translate(0, -playShift); // Shift play area up
}

// Draw scene (background, track, chain, projectile, shooter)

if (playShift > 0) {
  ctx.restore();
}

// HUD drawn unshifted (stays pinned to top)
```

### 5.4 Pointer Event Conversion

**Must convert screen coords → game coords for hit-testing:**

```javascript
updatePointer(event) {
  const rect = this.canvas.getBoundingClientRect();
  if (this.mobileLayout) {
    const { scale } = this.mobileLayout;
    this.pointer.x = (event.clientX - rect.left) / scale;
    this.pointer.y = (event.clientY - rect.top) / scale;
  } else {
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    this.pointer.x = (event.clientX - rect.left) * scaleX;
    this.pointer.y = (event.clientY - rect.top) * scaleY;
  }
}
```

**Important:** Pointer Y is **not adjusted for playShift** because:
- playShift is a rendering offset (affects where content appears on screen)
- Pointer events come in screen space
- Hit-tests for HUD buttons need screen-logical coordinates
- Only when comparing to shooter.y (which is in play-area-logical space) must you add playShift

```javascript
// When aiming:
const playShift = this.mobileLayout?.playShift || 0;
const targetAngle = Math.atan2(
  (this.pointer.y + playShift) - this.shooter.y, // Add playShift here
  this.pointer.x - this.shooter.x,
);
```

### 5.5 Safe-Area Integration

**Safe-area insets** are applied via CSS and read by JavaScript:

```css
:root {
  --raw-sat: env(safe-area-inset-top, 0px);
  --raw-sab: env(safe-area-inset-bottom, 0px);
  --raw-sal: env(safe-area-inset-left, 0px);
  --raw-sar: env(safe-area-inset-right, 0px);
}
```

```javascript
getSafeAreaInset(side) {
  const prop = `--raw-sa${side[0]}`; // 't' → '--raw-sat'
  const val = getComputedStyle(document.documentElement).getPropertyValue(prop);
  return parseFloat(val) || 0;
}
```

**Usage:**
- HUD buttons shifted down by `hudShift` (derived from top inset)
- Back button shifted up by safe-area inset (home indicator)
- Canvas width/height padding calculated (shell margins)

---

## 6. DOM ELEMENTS OUTSIDE CANVAS

### 6.1 HTML Structure

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Zuma Prototype</title>
  <link rel="stylesheet" href="/src/style.css">
</head>
<body>
  <main class="app-shell">
    <!-- Inline-hidden HUD (legacy, not used) -->
    <section class="hud" style="display: none;">
      <p class="eyebrow">Mobile Canvas Prototype</p>
      <h1>祖马原型</h1>
      <p class="status">阶段 1：轨道、炮台、纹理滚动球链</p>
    </section>

    <!-- Game container -->
    <section class="game-frame">
      <canvas id="gameCanvas" aria-label="Zuma game canvas"></canvas>
    </section>
  </main>

  <!-- Orientation hint (shown on landscape on short phones) -->
  <div class="rotate-hint" aria-hidden="true">
    <div class="rotate-hint__card">
      <div class="rotate-hint__icon">&#8635;</div>
      <p class="rotate-hint__text">请竖屏使用</p>
    </div>
  </div>

  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

### 6.2 Key DOM Elements

| Element | Class | Purpose | State |
|---------|-------|---------|-------|
| `<main>` | `app-shell` | Root flex container | Normal |
| `<section>` | `hud` | Legacy HUD text | `display: none` |
| `<section>` | `game-frame` | Canvas wrapper | Flex grid center |
| `<canvas>` | `#gameCanvas` | Main game rendering surface | Active |
| `<div>` | `rotate-hint` | Landscape warning overlay | Shown on landscape <520px height |

### 6.3 CSS Responsive Layout

#### Desktop/Tablet (width ≥ 700px):

```css
.app-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: max(12px, env(safe-area-inset-top, 12px))
           max(12px, env(safe-area-inset-right, 12px))
           max(12px, env(safe-area-inset-bottom, 12px))
           max(12px, env(safe-area-inset-left, 12px));
}

.game-frame {
  flex: 1;
  display: grid;
  place-items: center;
}

#gameCanvas {
  width: min(100%, calc((100dvh - shellPadding) * 430/932), 500px);
  aspect-ratio: 430/932;
  border-radius: 28px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.42), inset...;
}
```

**Result:** Canvas letterboxed with frame, centered on desktop.

#### Mobile (width < 700px AND touch):

```css
@media (max-width: 699px) and (pointer: coarse) {
  .app-shell {
    padding: 0;
  }

  .game-frame {
    position: fixed;
    inset: 0;
    display: block;
  }

  #gameCanvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100dvh;
    aspect-ratio: auto;
    border-radius: 0;
    box-shadow: none;
    background: none;
  }
}
```

**Result:** Canvas fills entire viewport, no frame.

### 6.4 Rotate Hint (Landscape Lock)

```css
.rotate-hint {
  display: none; /* Hidden by default */
}

@media (pointer: coarse) and (orientation: landscape) and (max-height: 520px) {
  .rotate-hint {
    display: grid; /* Show on landscape <520px */
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(6, 10, 12, 0.92);
    place-items: center;
  }
  
  #gameCanvas {
    display: none; /* Hide game during landscape */
  }
}
```

**Effect:** On folded phones or landscape tablets under 520px tall, shows a rotation prompt instead of a stretched game.

### 6.5 CSS Variables for Safe-Area

```css
:root {
  --raw-sat: env(safe-area-inset-top, 0px);
  --raw-sab: env(safe-area-inset-bottom, 0px);
  --raw-sal: env(safe-area-inset-left, 0px);
  --raw-sar: env(safe-area-inset-right, 0px);
  
  --shell-pad-top: max(12px, env(safe-area-inset-top, 12px));
  --shell-pad-bottom: max(12px, env(safe-area-inset-bottom, 12px));
  --shell-pad-left: max(12px, env(safe-area-inset-left, 12px));
  --shell-pad-right: max(12px, env(safe-area-inset-right, 12px));
}
```

JavaScript reads `--raw-sa*` values (no fallback) to get exact safe-area insets for HUD positioning. CSS uses versions with fallbacks for shell padding.

---

## 7. SUMMARY TABLE: UI ELEMENTS BY STATE

| Element | Level Select | Playing | Win | Lose | All Clear | Notes |
|---------|--------------|---------|-----|------|-----------|-------|
| **Background Gradients** | ✓ | ✓ | - | - | - | Different gradients per state |
| **HUD Panel** | - | ✓ | ✓ | ✓ | - | Cached, reused every frame |
| **HUD Text** (score, combo, chain) | - | ✓ | - | - | - | Live-rendered every frame |
| **Next Preview Ball** | - | ✓ | - | - | - | Rotating halo + ball |
| **Sound Button** | ✓ | ✓ | - | - | - | Always available |
| **Restart Button (HUD)** | - | ✓ | - | - | - | Top-right, below sound |
| **Back Button (HUD)** | - | ✓ | - | - | - | Bottom-left |
| **Level Buttons (Grid)** | ✓ | - | - | - | - | 2×N grid |
| **Reset Progress Button** | ✓ | - | - | - | - | Bottom center |
| **Win/Lose Card** | - | - | ✓ | ✓ | - | 320×370 centered panel |
| **Card Badges** | - | - | ✓ | ✓ | - | Sun (win) / cracks (lose) |
| **Card Score Display** | - | - | ✓ | ✓ | - | Large gold numbers |
| **Card Combo Display** | - | - | ✓ | ✓ | - | Best combo or "none" |
| **Next Level Button** | - | - | ✓* | - | - | *Only if more levels exist |
| **Replay Button** | - | - | ✓ | ✓ | - | Centered if no "next" |
| **Back Button (Card)** | - | - | ✓ | ✓ | - | Below action buttons |
| **All Clear Panel** | - | - | - | - | ✓ | Victory screen |
| **All Clear Scores** | - | - | - | - | ✓ | Per-level breakdown |
| **Dim Overlay** | - | - | ✓ | ✓ | ✓ | Dark background behind cards |
| **Fade Overlay** | ✓ | ✓ | ✓ | ✓ | ✓ | Level transitions |
| **Screen Shake** | - | - | - | ✓ | - | Only on lose |
| **Gameplay Scene** | - | ✓ | ✓ | ✓ | - | Background, track, chain, shooter |
| **Match Feedback Popup** | - | ✓ | - | - | - | Floating "+score" text |
| **Particles** | - | ✓ | ✓ | ✓ | - | Match debris, victory sparkles |

---

## 8. KEY CONSTANTS & CONFIGURATION

From `src/config.js`:

```javascript
export const GAME_WIDTH = 430;
export const GAME_HEIGHT = 932;
export const HUD_HEIGHT = 120; // Top strip
export const BOTTOM_BUTTON_HEIGHT = 70; // Bottom strip (reserved)
export const BALL_RADIUS = 14;
export const BALL_SPACING = 27;
export const AIM_GUIDE_LENGTH = 118;
export const PROJECTILE_SPEED = 820;
```

From `src/style.css`:

```css
--shell-pad-top: max(12px, env(safe-area-inset-top, 12px));
--shell-pad-bottom: max(12px, env(safe-area-inset-bottom, 12px));
--shell-pad-left: max(12px, env(safe-area-inset-left, 12px));
--shell-pad-right: max(12px, env(safe-area-inset-right, 12px));
--raw-sat: env(safe-area-inset-top, 0px); /* For JS */
```

---

## 9. RENDERING PERFORMANCE NOTES

### 9.1 Caching Strategy

- **HUD Panel Cache** (`hudPanelCache`):
  - Pre-rendered stone panel backgrounds
  - Rebuilt only when `hudShift` changes (on notch detection)
  - Text overlaid live each frame

- **Static Scene Cache** (`staticSceneCache`):
  - Background + track + goal
  - Rebuilt when path changes (level load)
  - Rebuilt when level config background image loads

- **Frog Cache** (`frogCacheBehind`, `frogCacheFront`):
  - Split frog layers for live ball insertion
  - Generated once at texture creation time
  - Used every frame for shooter render

### 9.2 Clipping Optimization

- Play-area clip (HUD_HEIGHT to GAME_HEIGHT - BOTTOM_BUTTON_HEIGHT)
- Applied to: chain, projectile, track, goal
- Prevents off-screen rendering from accumulating

### 9.3 Mobile-Specific

- Canvas width/height adjusted to native viewport resolution
- Transform matrix applied at rendering (efficient scaling)
- Fill bottom gap with gradient only if needed
- Safe-area calculations run once per resize

---

## 10. QUICK REFERENCE: HOW TO ADD A NEW BUTTON

**Example: Add a "Settings" button to HUD**

1. **Add getter for rect:**
   ```javascript
   getHudSettingsButtonRect() {
     const s = this.mobileLayout?.hudShift || 0;
     return { x: GAME_WIDTH - 180, y: 18 + s, w: 36, h: 38 };
   }
   ```

2. **Add to hit-testing:**
   ```javascript
   // In getUiActionAt()
   if (this.isPointInsideRect(x, y, this.getHudSettingsButtonRect())) {
     return "toggleSettings";
   }
   ```

3. **Add render call:**
   ```javascript
   // In hud.js::drawOverlay()
   drawSettingsButton(game, ctx);
   ```

4. **Implement drawing function:**
   ```javascript
   export function drawSettingsButton(game, ctx) {
     const rect = game.getHudSettingsButtonRect();
     const isPressed = game.uiPressAction === "toggleSettings" && 
                       game.isPointInsideRect(game.pointer.x, game.pointer.y, rect);
     // ... draw stone panel + gear icon
   }
   ```

5. **Add action handler:**
   ```javascript
   // In triggerUiAction()
   } else if (action === "toggleSettings") {
     this.gameState = "settings"; // or similar
   }
   ```

The system automatically:
- ✓ Applies hudShift to avoid notch
- ✓ Detects press state from pointer position
- ✓ Prevents gameplay input when pressing UI
- ✓ Releases capture on pointerup

---

## Conclusion

The ZUMA rendering pipeline is a well-organized, state-driven system that separates concerns across modules:

- **Canvas** is the only UI medium (no DOM buttons)
- **Mobile responsiveness** is baked into the architecture (safe-area, viewport shift, scaling)
- **State machine** prevents invalid UI states (e.g., gameplay buttons during level select)
- **Hit-testing** is coordinate-space aware and centralized
- **Performance** is optimized through caching and clipping

Every UI element is drawn procedurally (no images for buttons), allowing full control over press states, colors, and animations. The system scales from phones to tablets seamlessly.
