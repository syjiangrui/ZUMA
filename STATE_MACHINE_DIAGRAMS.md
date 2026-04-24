# ZUMA Game State Machine & Flow Diagrams

## Game State Machine

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GAME STATE MACHINE                              │
└─────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │   START      │
                              │   gameState  │
                              │ "levelSelect"│
                              └──────┬───────┘
                                     │
                      User clicks level button
                      loadLevel(levelId)
                             │
                             ▼
                    ┌─────────────────────┐
                    │   FADE OUT (0.33s)  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   setGameState      │
                    │   ("playing")       │
                    │   resetRound()      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   FADE IN (0.33s)   │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │   PLAYING STATE    │
                    │                    │
                    │ • update() runs    │
                    │ • Gameplay logic   │
                    │ • UI interactive   │
                    │ • Particles spawn  │
                    └──────────┬──────────┘
                    ┌──────────┴──────────────────┐
                    │                             │
            ┌───────▼─────────┐        ┌────────▼──────────┐
            │ VICTORY CHECK   │        │ DEFEAT CHECK     │
            │                 │        │                  │
            │ chain.length    │        │ Ball reaches     │
            │   === 0 &&      │        │ goal end point   │
            │ projectile ===  │        │ (checked every   │
            │   null &&       │        │ frame in update) │
            │ no pending      │        │                  │
            │ matches         │        │                  │
            └───────┬─────────┘        └────────┬──────────┘
                    │                           │
                    │ YES                       │ YES
                    ▼                           ▼
         ┌──────────────────┐         ┌─────────────────────┐
         │ setGameState     │         │ setGameState        │
         │ ("win")          │         │ ("lose")            │
         │ ────────────────────      │ ────────────────────│
         │ • pointer.active=false    │ • pointer.active=   │
         │ • projectile=null         │   false             │
         │ • roundEndTimer=0         │ • projectile=null   │
         │ • spawnVictory            │ • roundEndTimer=0   │
         │   Particles()             │ • sfx.playLose()    │
         │ • sfx.playWin()           │ • onLevelLose()     │
         │ • onLevelWin()            │                     │
         │   (save progress)         │ • screenShake       │
         │ • Show Win Card           │   animates down     │
         └──────────┬────────┘       └────────┬────────────┘
                    │                         │
                    │                         │
         ┌──────────┴─────────────┬──────────┴──────────────┐
         │                        │                         │
         ▼                        ▼                         ▼
    ┌─────────────┐         ┌─────────────┐        ┌──────────────────┐
    │ IF MORE     │         │ ALWAYS      │        │ END STATE        │
    │ LEVELS:     │         │ AVAILABLE:  │        │ NO GAMEPLAY      │
    │             │         │             │        │ ──────────────   │
    │ • Next      │         │ • Restart   │        │ • Particles tick │
    │ • Replay    │         │ • Back to   │        │ • Animations run │
    │ • Back      │         │   Select    │        │ • Buttons active │
    │             │         │             │        │                  │
    │ User picks  │         │ User picks  │        │ User picks:      │
    └────┬────────┘         └────┬────────┘        │ • Next Level     │
         │                       │                  │ • Restart        │
         │ IF NO MORE      ┌─────▼──────┐          │ • Back to Select │
         │ LEVELS:         │ goToLevel   │          └────┬─────────────┘
         │ SHOW            │ Select()    │               │
         │ ALL-CLEAR       │             │               │ User choice
         │ SCREEN          │ ┌───────────┴───────────────┼──────────┐
         │ ✓ 祭坛大捷       │ │                           │          │
         │                 │ │                           ▼          │
         │                 └─┼─► levelSelect ◄──────────┐          │
         └─────────────────────►                        │          │
                                 │                      │          │
              ┌──────────────────┘                      │          │
              │                                        │          │
              │ ┌──────────────────────────────────────┘          │
              │ │                                                  │
              │ │ IF currentLevel + 1 exists:                     │
              │ │ nextLevel action invoked                        │
              │ │ → loadLevel(currentLevel + 1)                  │
              │ │                                                  │
              │ └────► Back to FADE OUT ───────► PLAYING ─────────┘
              │
              │ OR
              │
              └────► Back to FADE OUT ───► PLAYING (restart)
                     with same levelId


┌─────────────────────────────────────────────────────────────────────────┐
│                    KEY STATE GUARD FUNCTIONS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  isRoundPlaying():                                                       │
│    Only runs when gameState === "playing"                              │
│    - updateAim(dt)                                                     │
│    - updateChain(dt)                                                   │
│    - updateProjectile(dt)                                              │
│    - updateRoundOutcome()                                              │
│                                                                          │
│  update(dt) guards:                                                     │
│    if (gameState === "levelSelect") return; ← NO logic runs            │
│    if (!isRoundPlaying()) return; ← Animations still tick              │
│                                                                          │
│  render() guards:                                                       │
│    if (gameState === "levelSelect") {                                  │
│      drawLevelSelectScreen() ← ONLY this runs                          │
│      return;                                                           │
│    }                                                                    │
│    if (gameState !== "playing") {                                      │
│      game.drawRoundEndEffect() ← Win/lose visual effects               │
│      drawRoundStateCard()      ← Show end card                        │
│      if (isAllClear()) drawAllClearScreen()                            │
│    }                                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Input Event Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INPUT EVENT FLOW                                 │
└─────────────────────────────────────────────────────────────────────────┘

POINTER DOWN EVENT
│
├─► updatePointer(event) ◄─── Convert screen coords → game coords
│
├─► getUiActionAt(x, y) ◄─── Hit-test interactive elements
│   │
│   ├─ IF levelSelect state: Check level buttons → return "selectLevel:N"
│   ├─ IF win/lose state: Check end-card buttons → return "nextLevel"|"restart"|"backToSelect"
│   ├─ IF any state: Check HUD buttons → return "toggleSound"|"restart"|"backToSelect"
│   └─ IF no hit: return null
│
├─ IF uiAction hit:
│  ├─ uiPressAction = uiAction
│  ├─ setPointerCapture()
│  └─ RETURN (don't start gameplay)
│
└─ ELSE (no UI hit):
   └─ IF gameState === "playing":
      └─ pointer.active = true ◄─── Start gameplay aim


POINTER MOVE EVENT
│
├─ IF uiPressAction:
│  └─ updatePointer() ◄─── Track within UI element
│     └─ BUT DON'T run gameplay aim
│
├─ IF !pointer.active AND mouse (not touch):
│  └─ updatePointer() ◄─── Desktop preview aim (no shoot)
│
└─ IF pointer.active (touch active):
   └─ updatePointer()
      └─ updateAim(dt) ◄─── Smooth rotation toward pointer


POINTER UP EVENT
│
├─ updatePointer(event)
│
├─ IF uiPressAction:
│  ├─ IF still inside same rect:
│  │  └─ triggerUiAction(uiPressAction) ◄─── Execute action
│  │     ├─ "restart" → resetRound()
│  │     ├─ "toggleSound" → sfx.toggleMute()
│  │     ├─ "backToSelect" → goToLevelSelect()
│  │     ├─ "nextLevel" → loadLevel(currentLevel + 1)
│  │     ├─ "resetProgress" → resetProgress()
│  │     └─ "selectLevel:N" → loadLevel(N)
│  │
│  ├─ uiPressAction = null
│  └─ releasePointerCapture()
│
└─ ELSE (was gameplay):
   ├─ pointer.active = false
   ├─ releasePointerCapture()
   └─ IF gameState === "playing":
      └─ fireProjectile() ◄─── Launch shot at current aim angle


POINTER LEAVE EVENT
│
└─ IF no active UI or gameplay:
   └─ Reset pointer to default (upper-right of shooter)


KEYBOARD EVENTS
│
├─ Space key:
│  └─ IF gameState === "playing":
│     └─ fireProjectile()
│
└─ R key:
   └─ resetRound()
```

---

## Hit-Testing Decision Tree

```
getUiActionAt(x, y) → action string OR null
│
├─ gameState === "levelSelect"?
│  │
│  └─ YES
│     ├─ FOR each level:
│     │  ├─ rect = getLevelButtonRect(level.id)
│     │  └─ IF point in rect: return "selectLevel:N"
│     │
│     └─ IF point in getResetProgressButtonRect():
│        └─ return "resetProgress"
│
├─ gameState !== "playing"? (i.e., win/lose)
│  │
│  └─ YES
│     ├─ nextRect = getEndCardNextButtonRect()
│     ├─ IF nextRect && point in nextRect: return "nextLevel"
│     │
│     ├─ restartRect = getEndCardRestartButtonRect()
│     ├─ IF restartRect && point in restartRect: return "restart"
│     │
│     └─ backRect = getEndCardBackButtonRect()
│        └─ IF point in backRect: return "backToSelect"
│
├─ Always check HUD buttons (all states except levelSelect):
│  │
│  ├─ IF point in getHudBackButtonRect(): return "backToSelect"
│  ├─ IF point in getHudRestartButtonRect(): return "restart"
│  ├─ IF point in getHudSoundButtonRect(): return "toggleSound"
│  │
│  └─ return null ◄─── No HUD hit
│
└─ return null ◄─── No UI element hit
```

---

## HUD Button Positioning (Mobile Safe-Area Integration)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HUD LAYOUT (Top of Screen)                           │
│                                                                          │
│  CSS Safe-Area env():  ┌─────────────────────────────────────────┐      │
│  ┌──────────────────┐  │  ┌─────────────────────────────────────┤      │
│  │ notch/status bar │  │  │  y=0 Canvas coordinate system       │      │
│  └──────────────────┘  │  │                                      │      │
│       SAT=20px         │  │  ────────────────────────────────── │      │
│                        │  │     HUD_HEIGHT = 120                │      │
│      (on notched       │  │   (always drawn at y=0)             │      │
│       devices)         │  │     extends behind notch            │      │
│                        │  │                                      │      │
│                        │  │  ┌──────────────────────────────┐    │      │
│  ────────────────────────►│  │ hudShift = 14.3 px (derived) │    │      │
│        huShift offset      │  │ (only applied to buttons)    │    │      │
│        (calculated from    │  │                              │    │      │
│         SAT via JS)        │  │ [Sound] [Restart] [Back]     │    │      │
│                            │  │   y=32.3 (18+14.3)           │    │      │
│                            │  │                              │    │      │
│                            │  │ [Next Ball Preview]          │    │      │
│                            │  │   y=30.3 (16+14.3)           │    │      │
│                            │  │                              │    │      │
│                            │  └──────────────────────────────┘    │      │
│                            │                                      │      │
│                            │  ────────────────────────────────  │      │
│                            │  HUD text and panels               │      │
│                            │  (Score, combo, chain length)      │      │
│                            │                                      │      │
│                            └─────────────────────────────────────┘      │
│                                                                          │
│  Safe-Area on bottom (home indicator):                                 │
│  SAB = 34px  ────► getHudBackButtonRect() adjusts y-position down      │
│  y = GAME_HEIGHT - 54 - cropBottom - (safeBottom/scale)               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## End-Game Card Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      WIN / LOSE CARD (Centered)                         │
│                                                                          │
│  panelY = GAME_HEIGHT * 0.18 = 167.76 ≈ 168                            │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │     FULL-SCREEN DIM OVERLAY (0.52 alpha)                  │         │
│  └────────────────────────────────────────────────────────────┘         │
│                                                                          │
│       ┌────────────────────────────────────────┐                        │
│       │     END-GAME CARD (320×370)            │                        │
│       │       (GAME_WIDTH/2 - 160)             │                        │
│       │                                        │                        │
│       │  ┌────────────────────────────────┐   │                        │
│       │  │  Double-ring badge + icon      │   │                        │
│       │  │  (Sun for win, Cracks for lose)│   │                        │
│       │  └────────────────────────────────┘   │                        │
│       │                                        │                        │
│       │  Title: "祭坛告捷" / "试炼中断"        │                        │
│       │  Subtitle: "球链已被清空" / "球链... │                        │
│       │                                        │                        │
│       │  ┌────────────────────────────────┐   │                        │
│       │  │  Score Label "本局得分"         │   │                        │
│       │  │  Score Number (large, gold)     │   │                        │
│       │  └────────────────────────────────┘   │                        │
│       │                                        │                        │
│       │  ┌────────────────────────────────┐   │                        │
│       │  │  Combo Badge (sub-panel)       │   │                        │
│       │  │  "最高连击 x?" or "未触发连击" │   │                        │
│       │  └────────────────────────────────┘   │                        │
│       │                                        │                        │
│       │  y = panelY + 248:                    │                        │
│       │                                        │                        │
│       │  ┌────────────────────────────────┐   │ (Pulse Halo)          │
│       │  │  IF MORE LEVELS (Win):        │   │   Gold pulse effect   │
│       │  │  ┌──────────┐  ┌──────────┐   │   │                        │
│       │  │  │重玩本关  │  │下一关    │   │   │                        │
│       │  │  │(left)    │  │(right)   │   │   │                        │
│       │  │  └──────────┘  └──────────┘   │   │                        │
│       │  │                               │   │                        │
│       │  │  IF NO MORE LEVELS (Win/Lose):│   │                        │
│       │  │  ┌────────────────────────┐   │   │                        │
│       │  │  │"重新开始" / "重试"    │   │   │                        │
│       │  │  │(centered, large)      │   │   │                        │
│       │  │  └────────────────────────┘   │   │                        │
│       │  └────────────────────────────────┘   │                        │
│       │                                        │                        │
│       │  y = panelY + 248 + 52:                │                        │
│       │  ┌────────────────────────────────┐   │                        │
│       │  │  返回选关 (Always present)     │   │                        │
│       │  └────────────────────────────────┘   │                        │
│       │                                        │                        │
│       │  [Mayan zigzag trim at bottom]         │                        │
│       └────────────────────────────────────────┘                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Mobile Viewport Scaling

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   MOBILE FULL-SCREEN LAYOUT                             │
│                                                                          │
│  Physical Device:  ┌──────────────────────┐                             │
│  300px × 800px     │ ▲ Status Bar (SAT)  │                             │
│                    │                      │ screen coords              │
│  Logical Game:     │◄─── 100vw ────────►│                             │
│  430×932           │                      │ y = 0                      │
│                    │  ◄─ scale=0.7 ──►  │                             │
│  scale = vw / 430  │  [ 300px ÷ 430 ]   │                             │
│      = 0.7         │                      │                             │
│                    │  HUD_HEIGHT = 120   │                             │
│                    │  Rendered: 84px     │ y = 84 (screen)             │
│                    │  Game coords: 0-120 │ (always HUD_HEIGHT)         │
│                    │                      │                             │
│                    │ ╔═════════════════╗ │                             │
│                    │ ║  PLAY AREA      ║ │                             │
│                    │ ║  Game coords:   ║ │ y = 120 (game)              │
│                    │ ║  120 → 862      ║ │ rendered at -playShift       │
│                    │ ║                 ║ │                             │
│                    │ ║ (vertically     ║ │                             │
│                    │ ║  centered if    ║ │                             │
│                    │ ║  space allows)  ║ │                             │
│                    │ ╚═════════════════╝ │                             │
│                    │                      │                             │
│                    │ BOTTOM_BUTTON_HEIGHT │                             │
│                    │ Game coords:        │                             │
│                    │ 862 → 932 (reserve) │                             │
│                    │                      │                             │
│                    │ ▼ Home Indicator    │ y = 800 (screen)            │
│                    └──────────────────────┘ SAB offset                   │
│                                                                          │
│  Rendering Stack:                                                       │
│  1. ctx.setTransform(1,0,0,1, 0,0)                                     │
│     └─ Clear at native resolution (300×800px)                          │
│                                                                          │
│  2. ctx.setTransform(scale*dpr, 0, 0, scale*dpr, 0,0)                  │
│     └─ All game drawing happens in game coords (430×932)              │
│                                                                          │
│  3. IF playShift > 0:                                                   │
│     ctx.translate(0, -playShift)                                       │
│     └─ Shifts play area up to center the path                         │
│                                                                          │
│  4. HUD drawn UNSHIFTED                                                │
│     └─ Stays pinned to top (y=0)                                       │
│                                                                          │
│  5. Fade/dim overlays drawn at identity or with mobile overlay        │
│     └─ Must cover safe-area zones                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Rendering Pipeline (Top-Level)

```
render(game) {
  │
  ├─► Mobile viewport setup
  │   ├─ Clear (identity transform)
  │   ├─ fillMobileBottomGap() [if needed]
  │   └─ Apply game coordinate transform
  │
  ├─ gameState === "levelSelect"?
  │  └─ YES: drawLevelSelectScreen() + RETURN
  │
  ├─ Screen shake transform [if lose]
  │
  ├─ Play-area shift transform [if playShift > 0]
  │
  ├─► Scene rendering (clipped to play area)
  │   ├─ createStaticSceneCache() [if needed]
  │   ├─ drawChain()
  │   ├─ drawParticles()
  │   ├─ drawProjectile()
  │   ├─ drawAimGuide()
  │   └─ drawShooter()
  │
  ├─ Restore play-area shift transform
  │
  ├─► HUD & Feedback
  │   ├─ Mobile notch fill [if needed]
  │   ├─ drawOverlay() [HUD panel, buttons, text]
  │   └─ drawMatchFeedback() [floating score popup]
  │
  ├─ Restore screen shake transform
  │
  ├─► End-game overlays [if gameState !== "playing"]
  │   ├─ game.drawRoundEndEffect() [glow/vignette]
  │   ├─ Dim overlay (mobile: fullscreen, else rect)
  │   └─ drawRoundStateCard() [win/lose card]
  │
  ├─ drawAllClearScreen() [if isAllClear()]
  │
  └─► Fade overlay [if transitioning]
      └─ Full-screen dim rect with alpha animation
}
```

---

## Pointer Coordinate Space Conversion

```
Screen Space (pixels)
     │
     │ event.clientX/Y
     │ (physical screen pixels)
     │
     ▼
     
getBoundingClientRect() → rect {left, top, width, height}

     │
     ├─ DESKTOP/TABLET:
     │  │
     │  └─ scaleX = GAME_WIDTH (430) / rect.width
     │     scaleY = GAME_HEIGHT (932) / rect.height
     │     pointer.x = (event.clientX - rect.left) * scaleX
     │     pointer.y = (event.clientY - rect.top) * scaleY
     │
     └─ MOBILE FULL-SCREEN:
        │
        └─ scale = vw / GAME_WIDTH (e.g., 0.7)
           pointer.x = (event.clientX - rect.left) / scale
           pointer.y = (event.clientY - rect.top) / scale

        │
        ▼
        
Game Coordinate Space (430×932 logical)
     │
     ├─ Used for HIT-TESTING all UI
     │
     └─ Used for GAMEPLAY comparison with shooter.y
        └─ BUT: Add playShift when comparing to shooter.y
           (shooter.y is in play-area-logical space, 
            pointer.y is in screen-logical space)
```

