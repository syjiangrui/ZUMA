# ZUMA UI Inventory - Quick Reference

## Canvas-Drawn UI Elements Checklist

### 🎮 HUD (Top Bar) - Y: 0-120
- [x] Stone panel background + speckle texture
- [x] Mayan zigzag trim (decorative)
- [x] Sun/altar icon (title decoration)
- [x] Level name text (gold)
- [x] Level number subtitle
- [x] State indicator dot (green/gold/red)
- [x] State label text ("进行中"/"胜利"/"失败")
- [x] Chain length label + number
- [x] Score label + number (gold)
- [x] Combo text display
- [x] **Next ball preview panel** (interactive ➜ shows sight line direction, visual feedback only)
- [x] **Next ball rotating halo** 
- [x] **Sound button** (interactive ➜ mute/unmute)
- [x] **Restart button** (interactive ➜ "重开")
- [x] **Back button** (interactive ➜ "选关", bottom-left)

### 🏆 Win Card - Y: 162-532 (approx)
- [x] Dim overlay (full-screen)
- [x] Main panel (320×370, centered)
- [x] Stone speckle texture
- [x] Double-ring badge
- [x] Sun icon inside badge
- [x] Title "祭坛告捷" (gold)
- [x] Subtitle "球链已被清空"
- [x] Score label + number
- [x] Combo badge + text
- [x] Mayan zigzag trim (footer)
- [x] **"下一关" button** (interactive, if more levels)
- [x] **"重玩本关" button** (interactive, if more levels)
- [x] **"重新开始" button** (interactive, if no more levels)
- [x] **"返回选关" button** (interactive, below actions)
- [x] Button pulse halo (gold)

### ☠️ Lose Card - Y: 162-532 (approx)
- [x] Dim overlay (full-screen)
- [x] Main panel (320×370, centered)
- [x] Stone speckle texture
- [x] Double-ring badge
- [x] Crack lines inside badge
- [x] Title "试炼中断" (tan)
- [x] Subtitle "球链抵达终点"
- [x] Score label + number
- [x] Combo badge + text
- [x] Mayan zigzag trim (footer)
- [x] **"重试" button** (interactive, centered)
- [x] **"返回选关" button** (interactive, below)
- [x] Button pulse halo (red-tinted)

### 📋 Level Select Screen - Y: 0-932
- [x] Background gradients (3-part)
- [x] Title "祭坛试炼" (gold)
- [x] Subtitle "选择关卡"
- [x] Decorative line separator
- [x] Level buttons grid (2×N)
  - [x] Stone panel per button
  - [x] Level number (large, gold)
  - [x] Level name
  - [x] Status badge ("✓ 已通关" / "未通关" / "🔒 未解锁")
  - [x] High score text (if played)
  - [x] Path thumbnail (5 types: spiral, serpentine, rectangular, openArc, zigzag, drawn)
  - [x] Color palette dots (per level)
  - [x] **All buttons are clickable**
- [x] **Sound button** (interactive)
- [x] **"重置进度" button** (interactive, bottom center)

### 🎆 All-Clear Screen - Y: 74-502 (approx)
- [x] Heavy dim overlay (0.6 alpha)
- [x] Main panel (340×400, centered)
- [x] Concentric circle badge
- [x] Sun icon (12 rays)
- [x] Title "祭坛大捷" (gold)
- [x] Subtitle "全部关卡已通关"
- [x] Per-level score lines (LEVELS.length rows)
- [x] Divider line
- [x] Total score label + number
- [x] **"返回选关" button** (interactive)

### 🎮 Gameplay Scene - Y: 120-862
- [x] Background (canopy + slab gradients)
- [x] Speckle textures (white + dark)
- [x] Radial glows (golden ambient + altar glow)
- [x] Tile decorations (4 corner panels)
- [x] Altar rings (grey + gold strokes)
- [x] Altar shadow (ellipse)
- [x] Track (3 layers: shadow, main, detail)
- [x] Goal marker (aura + ring + core circle)
- [x] Chain balls (clipped to play area)
- [x] Projectile (clipped to play area)
- [x] Aim guide (dashed line)
- [x] Shooter/frog (ground shadow + body layers + mouth ball + belly ball)

### ✨ Particle Effects
- [x] Match debris (6 per eliminated ball)
- [x] Victory burst (40 initial particles)
- [x] Celebration ticks (2 particles per frame)

### 🎬 Transition Effects
- [x] Screen shake (lose state only)
- [x] Fade overlay (level transitions)
- [x] Dim overlay (card backgrounds)
- [x] Match feedback popup (floating "+score" text)

---

## Interactive Element Summary

### HUD Buttons (During Playing)
| Button | Rect Getter | Action | Visual |
|--------|-------------|--------|--------|
| Sound | getHudSoundButtonRect() | toggleSound | Speaker icon/slash |
| Restart | getHudRestartButtonRect() | restart | "重开" text |
| Back | getHudBackButtonRect() | backToSelect | "选关" text |
| Next Preview | getHudNextPreviewRect() | (sight line only) | Ball + halo |

### End Card Buttons (Win State)
| Button | Rect Getter | Action | Conditions |
|--------|-------------|--------|------------|
| Next | getEndCardNextButtonRect() | nextLevel | Only if currentLevel < LEVELS.length |
| Replay | getEndCardRestartButtonRect() | restart | Left of Next (if exists) |
| Back | getEndCardBackButtonRect() | backToSelect | Always present |

### End Card Buttons (Lose State)
| Button | Rect Getter | Action | Conditions |
|--------|-------------|--------|------------|
| Retry | getEndCardRestartButtonRect() | restart | Centered |
| Back | getEndCardBackButtonRect() | backToSelect | Always present |

### Level Select Buttons
| Button | Rect Getter | Action | Conditions |
|--------|-------------|--------|------------|
| Level N | getLevelButtonRect(id) | selectLevel:N | One per level |
| Sound | getHudSoundButtonRect() | toggleSound | Always present |
| Reset | getResetProgressButtonRect() | resetProgress | Bottom center |

---

## State-Based Rendering

```
gameState = "levelSelect"
  ├─ Level select screen
  ├─ Level button grid
  ├─ Sound button
  └─ Reset progress button

gameState = "playing"
  ├─ Gameplay scene (background, track, chain, shooter)
  ├─ HUD panel
  ├─ Match feedback popup
  ├─ Particles
  └─ Aim guide

gameState = "win"
  ├─ Gameplay scene (for background)
  ├─ HUD panel (greyed/inactive)
  ├─ Victory particles
  ├─ Dim overlay
  ├─ Win card (with "Next"/"Replay" buttons)
  └─ Fade overlay (on transition)

gameState = "lose"
  ├─ Gameplay scene (for background)
  ├─ HUD panel (greyed/inactive)
  ├─ Match debris particles
  ├─ Screen shake effect
  ├─ Dim overlay
  ├─ Lose card (with "Retry" button)
  └─ Fade overlay (on transition)

gameState = "win" + currentLevel >= LEVELS.length
  ├─ All-clear screen
  └─ Per-level score summary
```

---

## Hit-Testing Priority

When getUiActionAt(x, y) is called:

1. **If levelSelect:** Check level buttons, then reset button
2. **If win/lose:** Check end-card buttons (next, restart, back)
3. **If playing/win/lose:** Check HUD buttons (back, restart, sound)
4. **Return:** null if no hit

---

## Mobile Layout Features

### Safe-Area Awareness
- `hudShift`: Offsets HUD buttons down (avoids top notch)
- Safe-area insets read from CSS --raw-sa* variables
- Back button adjusted for home indicator (bottom safe-area)

### Viewport Scaling
- Mode 1 (desktop): Fixed 430×932 canvas with DPR scaling
- Mode 2 (mobile): Full-screen 100vw × 100dvh, scaled uniformly to width
- `playShift`: Vertical centering when overflow

### Transformation Stack
1. Identity transform (native resolution clear)
2. Game coordinate transform (scale × DPR)
3. Play-area translate (if playShift > 0)
4. HUD drawn unshifted (stays pinned to top)

---

## Color Palette

### UI Colors
- Gold: #f0d57a, #f5d872, #f1d680, #f4e7c3
- Stone: #7a8590 (top), #636e78 (bottom), #6e7a84 (recessed)
- Green (state): #6cc870
- Red (state/lose): #d45040, #e85050
- Tan: #e0b8a0, #c8bfa8
- Dark: #060a0c, #0a0f10

### Gradients
- Canopy: #17383e → #10272d → #0a1519
- Slab: #7f8990 → #6e7880 → #5b646d
- Stone panels: Linear (top → bottom, varies by usage)

---

## Rendering Order (Within Scene)

1. Static scene cache (background + track + goal)
2. Chain (all visible balls, clipped)
3. Particles (debris, sparkles)
4. Projectile (current shot, clipped)
5. Aim guide (dashed line)
6. Shooter (frog + mouth ball)
7. *(Play-area shift restored)*
8. HUD overlay (panels, text, buttons)
9. Match feedback popup
10. Screen shake (restored)
11. Dim overlay (behind cards)
12. End-game card (win/lose/all-clear)
13. Fade overlay (transitions)

---

## Key Constants

```javascript
GAME_WIDTH = 430
GAME_HEIGHT = 932
HUD_HEIGHT = 120 // Top reserved
BOTTOM_BUTTON_HEIGHT = 70 // Bottom reserved
BALL_RADIUS = 14
BALL_SPACING = 27
AIM_GUIDE_LENGTH = 118
PROJECTILE_SPEED = 820
```

---

## Summary Stats

- **Total UI Elements:** ~80-100 (depending on count method)
- **Interactive Buttons:** 5-7 per state (HUD: 3, End cards: 3, Level select: 1×N+2)
- **Supported Path Shapes:** 6 (spiral, serpentine, rectangular, openArc, zigzag, drawn)
- **Particle Systems:** 3 (debris, victory, celebration)
- **Canvas Render Paths:** 2 (desktop fixed, mobile full-screen)
- **Game States:** 4 (levelSelect, playing, win, lose)
- **Rendering Modules:** 7 files
