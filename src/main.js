import {
  GAME_WIDTH, GAME_HEIGHT, TAU,
  PARTICLE_COUNT_PER_BALL, PARTICLE_LIFETIME, PARTICLE_SPEED_MIN,
  PARTICLE_SPEED_MAX, PARTICLE_GRAVITY, PARTICLE_MAX_TOTAL,
  BALL_PALETTES,
} from './config.js';
import { SfxEngine } from './sfx.js';
import {
  createPath as createPathFn,
  getPointAtDistance as getPointAtDistanceFn,
  getClosestPathDistance as getClosestPathDistanceFn,
} from './path.js';
import {
  createActionContext as createActionContextFn,
  getActionContext as getActionContextFn,
  trimActionContexts as trimActionContextsFn,
  recordMatchEvent as recordMatchEventFn,
  updateHudState as updateHudStateFn,
  updatePendingMatchChecks as updatePendingMatchChecksFn,
  queueMatchCheck as queueMatchCheckFn,
  setBallAction as setBallActionFn,
  queueAdjacentMatchChecks as queueAdjacentMatchChecksFn,
  resolveMatchesFrom as resolveMatchesFromFn,
} from './match.js';
import {
  createChain as createChainFn,
  createChainBall as createChainBallFn,
  updateChain as updateChainFn,
  syncChainPositions as syncChainPositionsFn,
  hasGapBetween as hasGapBetweenFn,
  getSplitGap as getSplitGapFn,
  addImpact as addImpactFn,
  applyInsertSpacingWave as applyInsertSpacingWaveFn,
} from './chain.js';
import {
  updateProjectile as updateProjectileFn,
  fireProjectile as fireProjectileFn,
} from './projectile.js';
import {
  render as renderFn,
  createTextures as createTexturesFn,
} from './render/index.js';
import { LEVELS, getLevelById, initLevels } from './levels.js';
import { loadProgress, saveProgress, recordLevelClear, updateHighScore, resetProgress } from './save.js';

class ZumaGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sfx = new SfxEngine();
    this.pathPoints = [];
    this.totalPathLength = 0;
    this.ballPatterns = [];
    this.chain = [];
    // chainHeadS is the shared baseline distance for the whole chain. Each
    // ball derives its visible position from:
    //   chainHeadS - index * BALL_SPACING + offset + splitOffset
    // This lets us keep one stable "chain conveyor" value and layer temporary
    // insertion / gap-closing animation on top.
    this.chainHeadS = 0;
    // gameState is the round-level gate for all gameplay simulation. Phase 2
    // starts by introducing this even before win/lose logic is fully wired, so
    // later work can stop updates cleanly instead of scattering booleans.
    this.gameState = "playing";
    // splitState 表示球链被中段消除后，当前临时分成前后两段。
    this.splitState = null;
    this.projectile = null;
    this.nextBallId = 1;
    this.pendingMatchChecks = [];
    this.particles = [];
    this.roundEndTimer = 0;
    this.screenShake = 0;
    this.currentPaletteIndex = 0;
    this.nextPaletteIndex = 0;
    this.shooter = {
      x: GAME_WIDTH * 0.5,
      y: GAME_HEIGHT * 0.58,
      angle: -Math.PI / 2,
    };
    this.pointer = {
      active: false,
      x: GAME_WIDTH * 0.5 + 90,
      y: GAME_HEIGHT * 0.58 - 120,
    };
    this.uiPressAction = null;
    // Score/combo are not derived from chain length deltas. They are driven by
    // explicit match events, each attached to the shot action that caused them.
    this.score = 0;
    this.nextActionId = 1;
    this.actionContexts = new Map();
    this.matchFeedback = null;
    this.recentCombo = null;
    this.bestCombo = 0;
    // mergeSettle is a tiny post-merge dampening window. It gives the seam a
    // moment to "land" before the chain resumes full conveyor speed.
    this.mergeSettle = null;
    this.chainIntro = null;
    this.fadeOverlay = null; // { alpha, direction: "in"|"out", callback }
    // Level management — added in Phase 4.
    this.levelProgress = loadProgress();
    this.currentLevel = 1;
    this.levelConfig = getLevelById(1);
    this.lastTime = 0;

    this.createTextures();
    // Background images are authored per-level (see path editor's "保存为本关
    // 背景"). We preload them eagerly so the first frame of a level can use the
    // image instead of flashing the procedural gradient fallback. Individual
    // loads are async — as each image resolves, it nulls the active
    // staticSceneCache so the next frame rebakes with the real artwork.
    this.backgroundImages = {};
    this.preloadBackgroundImages();
    this.goToLevelSelect();
    this.bindEvents();
    this.resize();
    requestAnimationFrame((time) => this.loop(time));
  }

  // --- Fade transition helpers --------------------------------------------

  startFade(direction, callback) {
    this.fadeOverlay = { alpha: direction === "out" ? 0 : 1, direction, callback };
  }

  updateFade(dt) {
    if (!this.fadeOverlay) {
      return;
    }
    const speed = 3.0; // ~0.33s fade
    if (this.fadeOverlay.direction === "out") {
      this.fadeOverlay.alpha = Math.min(1, this.fadeOverlay.alpha + speed * dt);
      if (this.fadeOverlay.alpha >= 1) {
        const cb = this.fadeOverlay.callback;
        this.fadeOverlay = null;
        if (cb) cb();
      }
    } else {
      this.fadeOverlay.alpha = Math.max(0, this.fadeOverlay.alpha - speed * dt);
      if (this.fadeOverlay.alpha <= 0) {
        this.fadeOverlay = null;
      }
    }
  }

  // --- Path delegation wrappers -------------------------------------------

  // Build the track as an Archimedean spiral around the central shooter altar.
  // Gameplay still only moves balls by path distance; the spiral is just a more
  // faithful geometric source for the sampled path points.
  createPath() {
    const cfg = this.levelConfig;
    const pathType = cfg?.pathType ?? "spiral";
    const pathParams = cfg?.pathParams ?? {};
    const pathData = createPathFn(this.shooter.x, this.shooter.y, pathType, pathParams);
    this.pathPoints = pathData.pathPoints;
    this.totalPathLength = pathData.totalPathLength;
    this.cachedTrackPath = pathData.cachedTrackPath;
  }

  getPointAtDistance(s) {
    return getPointAtDistanceFn(this.pathPoints, this.totalPathLength, s);
  }

  getClosestPathDistance(x, y) {
    return getClosestPathDistanceFn(this.pathPoints, x, y);
  }

  // --- Render delegation wrappers -----------------------------------------

  createTextures() {
    createTexturesFn(this);
  }

  // Preload every level's background image into `this.backgroundImages`,
  // keyed by the image's `src` string. Duplicates are collapsed so the
  // same URL is fetched once even if multiple levels share it. Failed
  // loads are dropped silently — rendering falls back to the procedural
  // gradient path.
  preloadBackgroundImages() {
    const seen = new Set();
    for (const level of LEVELS) {
      const src = level && level.background && level.background.src;
      if (!src || seen.has(src)) continue;
      seen.add(src);
      const img = new Image();
      img.onload = () => {
        this.backgroundImages[src] = img;
        // Only invalidate if the currently active level uses this image —
        // avoids needlessly rebaking the cache for off-screen levels.
        const activeSrc = this.levelConfig
          && this.levelConfig.background
          && this.levelConfig.background.src;
        if (activeSrc === src) {
          this.staticSceneCache = null;
        }
      };
      img.onerror = () => {
        // Leave `this.backgroundImages[src]` undefined so render falls back.
      };
      img.src = src;
    }
  }

  render() {
    renderFn(this);
  }

  // Overlay effects drawn on top of the dimmed background in drawRoundStateCard.
  drawRoundEndEffect(ctx) {
    if (this.gameState === "win") {
      // Golden radial glow behind the card
      const t = Math.min(1, this.roundEndTimer / 0.6);
      const alpha = t * 0.15;
      const glow = ctx.createRadialGradient(
        GAME_WIDTH / 2, GAME_HEIGHT * 0.2, 20,
        GAME_WIDTH / 2, GAME_HEIGHT * 0.3, GAME_WIDTH * 0.7,
      );
      glow.addColorStop(0, `rgba(245, 216, 98, ${alpha})`);
      glow.addColorStop(1, "rgba(245, 216, 98, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else if (this.gameState === "lose") {
      // Red vignette flash that fades over ~0.8s
      const t = Math.min(1, this.roundEndTimer / 0.8);
      const alpha = (1 - t * t) * 0.35;
      if (alpha > 0.01) {
        const vig = ctx.createRadialGradient(
          GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.15,
          GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.6,
        );
        vig.addColorStop(0, "rgba(0, 0, 0, 0)");
        vig.addColorStop(0.6, `rgba(100, 20, 15, ${alpha * 0.5})`);
        vig.addColorStop(1, `rgba(140, 30, 20, ${alpha})`);
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      }
    }
  }

  // --- Match/scoring delegation wrappers ----------------------------------

  // One fired shot owns an action context. Later seam closures and follow-up
  // removals point back to it so scoring/combo logic can treat them as a
  // single player action instead of isolated events.
  createActionContext(source = "shot") {
    return createActionContextFn(this, source);
  }

  getActionContext(actionId) {
    return getActionContextFn(this, actionId);
  }

  trimActionContexts() {
    trimActionContextsFn(this);
  }

  recordMatchEvent(info) {
    recordMatchEventFn(this, info);
  }

  updateHudState(dt) {
    updateHudStateFn(this, dt);
  }

  updatePendingMatchChecks(dt) {
    updatePendingMatchChecksFn(this, dt);
  }

  queueMatchCheck(ballId, delay, actionId, trigger) {
    queueMatchCheckFn(this, ballId, delay, actionId, trigger);
  }

  setBallAction(index, actionId) {
    setBallActionFn(this, index, actionId);
  }

  queueAdjacentMatchChecks(leftIndex, rightIndex, actionId, delay, trigger) {
    queueAdjacentMatchChecksFn(this, leftIndex, rightIndex, actionId, delay, trigger);
  }

  // Expand a same-color run from a given seed index. This function is also
  // responsible for deciding whether a removal creates a split segment or
  // simply shortens an already contiguous chain.
  resolveMatchesFrom(index, actionId = null, trigger = "insert") {
    resolveMatchesFromFn(this, index, actionId, trigger);
  }

  // --- Chain delegation wrappers ------------------------------------------

  // Reset the chain itself to a packed line of balls. Round-scoped state such
  // as projectile, palettes and gameState is handled by resetRound().
  createChain() {
    createChainFn(this);
  }

  createChainBall(paletteIndex) {
    return createChainBallFn(this, paletteIndex);
  }

  updateChain(dt) {
    updateChainFn(this, dt);
  }

  syncChainPositions() {
    syncChainPositionsFn(this);
  }

  // There is only ever one gameplay gap in the prototype: the break created
  // when a middle group disappears. Matching and chain logic must treat that
  // seam as non-adjacent until the rear segment has physically caught up.
  hasGapBetween(leftIndex, rightIndex) {
    return hasGapBetweenFn(this, leftIndex, rightIndex);
  }

  getSplitGap() {
    return getSplitGapFn(this);
  }

  addImpact(index, amount) {
    addImpactFn(this, index, amount);
  }

  applyInsertSpacingWave(insertIndex) {
    applyInsertSpacingWaveFn(this, insertIndex);
  }

  // --- Projectile delegation wrappers -------------------------------------

  updateProjectile(dt) {
    updateProjectileFn(this, dt);
  }

  fireProjectile() {
    fireProjectileFn(this);
  }

  // --- Core game loop -----------------------------------------------------

  loop(time) {
    const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0.016);
    this.lastTime = time;

    this.update(dt);
    this.render();

    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(dt) {
    this.updateFade(dt);
    if (this.gameState === "levelSelect") {
      return;
    }
    this.updateHudState(dt);
    this.updateParticles(dt);
    // Round-end animations tick even after gameplay stops
    if (this.gameState !== "playing") {
      this.roundEndTimer += dt;
      // Lose: screen shake decays over time
      if (this.screenShake > 0) {
        this.screenShake = Math.max(0, this.screenShake - dt * 3);
      }
      // Win: spawn celebration particles over the first ~1.5 seconds
      if (this.gameState === "win" && this.roundEndTimer < 1.5) {
        this.spawnCelebrationTick();
      }
    }
    if (!this.isRoundPlaying()) {
      return;
    }

    // Order matters:
    // 1. Aim updates the shooter direction.
    // 2. Chain state advances and may consume delayed match checks.
    // 3. Projectile moves last so collisions are evaluated against the latest
    //    chain layout for this frame.
    this.updateAim(dt);
    this.updateChain(dt);
    if (!this.isRoundPlaying()) {
      return;
    }
    this.syncShooterPalettes();
    this.updateProjectile(dt);
    this.updateRoundOutcome();
  }

  // Smooth aim toward the current pointer. With the shooter in the middle of
  // the board we need near-360-degree rotation, so interpolation follows the
  // shortest angular path instead of clamping to an upper arc.
  updateAim(dt) {
    const targetAngle = Math.atan2(
      this.pointer.y - this.shooter.y,
      this.pointer.x - this.shooter.x,
    );
    const delta = Math.atan2(
      Math.sin(targetAngle - this.shooter.angle),
      Math.cos(targetAngle - this.shooter.angle),
    );
    this.shooter.angle += delta * Math.min(1, dt * 12);
  }

  // Win/loss evaluation runs after both chain and projectile updates so a
  // frame cannot simultaneously consume a match, move a projectile, and then
  // misreport the round result from stale intermediate state.
  updateRoundOutcome() {
    if (!this.isRoundPlaying()) {
      return;
    }

    if (
      this.chain.length === 0 &&
      !this.projectile &&
      this.pendingMatchChecks.length === 0
    ) {
      this.setGameState("win");
    }
  }

  // --- State management ---------------------------------------------------

  // All round-end side effects funnel through this setter so update/input code
  // only needs to ask whether the round is still in the "playing" state.
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

  isRoundPlaying() {
    return this.gameState === "playing";
  }

  isAllClear() {
    return this.gameState === "win" && this.currentLevel >= LEVELS.length;
  }

  // A round reset must clear every transient gameplay structure that can leak
  // across attempts: projectile, seam state, delayed match checks, palettes and
  // id allocation. This is the single restart path used by the constructor, the
  // prototype tail escape, and future restart UI.
  resetRound() {
    // Apply level config (or fall back to defaults for backward compatibility).
    const cfg = this.levelConfig;
    if (cfg && cfg.shooterPos) {
      this.shooter.x = cfg.shooterPos.x;
      this.shooter.y = cfg.shooterPos.y;
    }

    this.setGameState("playing");
    this.projectile = null;
    this.splitState = null;
    this.pendingMatchChecks = [];
    this.nextBallId = 1;
    this.nextActionId = 1;
    this.actionContexts.clear();
    this.matchFeedback = null;
    this.recentCombo = null;
    this.bestCombo = 0;
    this.mergeSettle = null;
    this.chainIntro = null;
    this.particles = [];
    this.roundEndTimer = 0;
    this.screenShake = 0;
    this.score = 0;
    this.shooter.angle = -Math.PI / 2;
    this.pointer.active = false;
    this.pointer.x = this.shooter.x + 90;
    this.pointer.y = this.shooter.y - 120;

    // Rebuild path for this level (path shape/params may differ per level).
    this.createPath();
    // Invalidate cached rendering that depends on the path.
    this.hudPanelCache = null;
    this.staticSceneCache = null;

    this.createChain();
    this.currentPaletteIndex = this.getRandomPaletteIndex();
    this.nextPaletteIndex = this.getRandomPaletteIndex();
  }

  // Switch to a specific level and start a fresh round.
  loadLevel(levelId) {
    const cfg = getLevelById(levelId);
    if (!cfg) {
      return;
    }
    this.startFade("out", () => {
      this.currentLevel = levelId;
      this.levelConfig = cfg;
      this.resetRound();
      this.startFade("in", null);
    });
  }

  // Enter the level-select screen. Clears gameplay state.
  goToLevelSelect() {
    this.gameState = "levelSelect"; // Prevent game logic from running during fade
    this.startFade("out", () => {
      this.projectile = null;
      this.chain = [];
      this.particles = [];
      this.splitState = null;
      this.pendingMatchChecks = [];
      this.pointer.active = false;
      this.hudPanelCache = null;
      this.startFade("in", null);
    });
  }

  // Called when the player wins a level.
  onLevelWin() {
    recordLevelClear(this.levelProgress, this.currentLevel, this.score);
  }

  // Called when the player loses a level.
  onLevelLose() {
    updateHighScore(this.levelProgress, this.currentLevel, this.score);
  }

  getActivePaletteIndices() {
    const visiblePalettes = [];
    const allChainPalettes = [];
    const visibleSeen = new Set();
    const allSeen = new Set();

    for (const ball of this.chain) {
      if (!allSeen.has(ball.paletteIndex)) {
        allSeen.add(ball.paletteIndex);
        allChainPalettes.push(ball.paletteIndex);
      }

      if (
        ball.s >= 0 &&
        ball.s <= this.totalPathLength &&
        !visibleSeen.has(ball.paletteIndex)
      ) {
        visibleSeen.add(ball.paletteIndex);
        visiblePalettes.push(ball.paletteIndex);
      }
    }

    if (visiblePalettes.length > 0) {
      return visiblePalettes;
    }

    if (allChainPalettes.length > 0) {
      return allChainPalettes;
    }

    const colorCount = this.levelConfig?.colorCount ?? 4;
    return Array.from({ length: colorCount }, (_, index) => index);
  }

  getRandomPaletteIndex() {
    const activePalettes = this.getActivePaletteIndices();
    return activePalettes[(Math.random() * activePalettes.length) | 0];
  }

  syncShooterPalettes() {
    if (this.chain.length === 0) {
      return;
    }

    const activePalettes = this.getActivePaletteIndices();
    const activeSet = new Set(activePalettes);

    if (!activeSet.has(this.currentPaletteIndex)) {
      this.currentPaletteIndex = this.getRandomPaletteIndex();
    }

    if (!activeSet.has(this.nextPaletteIndex)) {
      this.nextPaletteIndex = this.getRandomPaletteIndex();
    }
  }

  // --- Input & UI ---------------------------------------------------------

  // Pointer events are used for both touch and mouse. The current prototype
  // fires on pointerup so players can drag to aim, then release to shoot.
  bindEvents() {
    window.addEventListener("resize", () => this.resize());

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }

      this.sfx.unlock();
      this.updatePointer(event);
      const uiAction = this.getUiActionAt(this.pointer.x, this.pointer.y);
      if (uiAction) {
        this.uiPressAction = uiAction;
        this.canvas.setPointerCapture?.(event.pointerId);
        return;
      }

      if (!this.isRoundPlaying()) {
        return;
      }

      this.pointer.active = true;
      this.canvas.setPointerCapture?.(event.pointerId);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (this.uiPressAction) {
        this.updatePointer(event);
        return;
      }

      if (!this.pointer.active && event.pointerType === "mouse") {
        this.updatePointer(event);
        return;
      }

      if (this.pointer.active) {
        this.updatePointer(event);
      }
    });

    this.canvas.addEventListener("pointerup", (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }

      this.updatePointer(event);
      if (this.uiPressAction) {
        const action = this.uiPressAction;
        this.uiPressAction = null;
        this.canvas.releasePointerCapture?.(event.pointerId);
        if (this.getUiActionAt(this.pointer.x, this.pointer.y) === action) {
          this.triggerUiAction(action);
        }
        return;
      }

      this.pointer.active = false;
      this.canvas.releasePointerCapture?.(event.pointerId);
      if (this.isRoundPlaying()) {
        this.fireProjectile();
      }
    });

    this.canvas.addEventListener("pointercancel", (event) => {
      this.uiPressAction = null;
      this.pointer.active = false;
      this.canvas.releasePointerCapture?.(event.pointerId);
    });

    this.canvas.addEventListener("pointerleave", () => {
      if (!this.pointer.active && !this.uiPressAction) {
        this.pointer.x = this.shooter.x + 90;
        this.pointer.y = this.shooter.y - 120;
      }
    });

    window.addEventListener("keydown", (event) => {
      this.sfx.unlock();
      if (event.code === "Space") {
        event.preventDefault();
        if (this.isRoundPlaying()) {
          this.fireProjectile();
        }
      }

      if (event.code === "KeyR") {
        event.preventDefault();
        this.resetRound();
      }
    });
  }

  resize() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    this.canvas.width = GAME_WIDTH * dpr;
    this.canvas.height = GAME_HEIGHT * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Convert screen coordinates back into the fixed logical canvas space.
  updatePointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    this.pointer.x = (event.clientX - rect.left) * scaleX;
    this.pointer.y = (event.clientY - rect.top) * scaleY;
  }

  isPointInsideRect(x, y, rect) {
    return (
      !!rect &&
      x >= rect.x &&
      x <= rect.x + rect.w &&
      y >= rect.y &&
      y <= rect.y + rect.h
    );
  }

  getHudRestartButtonRect() {
    return { x: GAME_WIDTH - 78, y: 18, w: 64, h: 38 };
  }

  getHudSoundButtonRect() {
    return { x: GAME_WIDTH - 120, y: 18, w: 36, h: 38 };
  }

  getHudNextPreviewRect() {
    return { x: GAME_WIDTH - 170, y: 16, w: 44, h: 44 };
  }

  // HUD and modal buttons share the same source rects for drawing and hit
  // testing, which keeps mobile touch targets aligned with their visuals.
  getEndCardRestartButtonRect() {
    if (this.gameState === "playing" || this.gameState === "levelSelect") {
      return null;
    }
    if (this.gameState === "win" && this.currentLevel < LEVELS.length) {
      // Win with more levels: "重玩本关" sits left of "下一关"
      return {
        x: GAME_WIDTH * 0.5 - 156,
        y: GAME_HEIGHT * 0.18 + 248,
        w: 140,
        h: 38,
      };
    }
    return {
      x: GAME_WIDTH * 0.5 - 100,
      y: GAME_HEIGHT * 0.18 + 248,
      w: 200,
      h: 40,
    };
  }

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

  getHudBackButtonRect() {
    return { x: 16, y: GAME_HEIGHT - 54, w: 80, h: 36 };
  }

  getEndCardNextButtonRect() {
    if (this.gameState !== "win" || this.currentLevel >= LEVELS.length) {
      return null;
    }
    return {
      x: GAME_WIDTH * 0.5 + 16,
      y: GAME_HEIGHT * 0.18 + 248,
      w: 140,
      h: 38,
    };
  }

  getEndCardBackButtonRect() {
    const baseY = GAME_HEIGHT * 0.18 + 248;
    return {
      x: GAME_WIDTH * 0.5 - 100,
      y: baseY + 52,
      w: 200,
      h: 36,
    };
  }

  getResetProgressButtonRect() {
    return { x: GAME_WIDTH * 0.5 - 60, y: GAME_HEIGHT - 60, w: 120, h: 32 };
  }

  // Button hit testing must run before gameplay input so tapping UI on phone
  // does not accidentally start an aiming / firing gesture on the canvas.
  getUiActionAt(x, y) {
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

  // Centralize HUD actions so future buttons can reuse one dispatch path.
  triggerUiAction(action) {
    if (action === "restart") {
      this.resetRound();
    } else if (action === "toggleSound") {
      this.sfx.unlock();
      this.sfx.toggleMute();
    } else if (action === "backToSelect") {
      this.goToLevelSelect();
    } else if (action === "nextLevel") {
      this.loadLevel(this.currentLevel + 1);
    } else if (action === "resetProgress") {
      this.levelProgress = resetProgress();
    } else if (action.startsWith("selectLevel:")) {
      const levelId = parseInt(action.split(":")[1], 10);
      this.loadLevel(levelId);
    }
  }

  // --- HUD text helpers ---------------------------------------------------

  getGameStateLabel() {
    if (this.gameState === "win") {
      return "胜利";
    }

    if (this.gameState === "lose") {
      return "失败";
    }

    return "进行中";
  }

  // Keep combo feedback readable for longer than the floating +score bubble so
  // players can still confirm a combo happened after the popup fades.
  getComboHudText() {
    if (this.recentCombo) {
      return `连击: x${this.recentCombo.combo}`;
    }

    if (this.bestCombo > 1) {
      return `最高连击: x${this.bestCombo}`;
    }

    return "连击: -";
  }

  // --- Particle system ----------------------------------------------------

  // Spawn debris particles at the screen position of each eliminated ball.
  // Called from resolveMatchesFrom() just before the chain splice.
  spawnMatchParticles(startIndex, count, paletteIndex) {
    const palette = BALL_PALETTES[paletteIndex];
    const colors = [palette.base, palette.bright, palette.accent];

    for (let i = 0; i < count; i++) {
      const ball = this.chain[startIndex + i];
      const pt = this.getPointAtDistance(ball.s);

      for (let j = 0; j < PARTICLE_COUNT_PER_BALL; j++) {
        if (this.particles.length >= PARTICLE_MAX_TOTAL) {
          // Evict the oldest particle to stay within budget
          this.particles.shift();
        }
        const angle = Math.random() * TAU;
        const speed =
          PARTICLE_SPEED_MIN +
          Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
        this.particles.push({
          x: pt.x,
          y: pt.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40, // slight upward bias
          age: 0,
          lifetime: PARTICLE_LIFETIME * (0.7 + Math.random() * 0.6),
          size: 2.5 + Math.random() * 3,
          color: colors[(j + i) % colors.length],
        });
      }
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.lifetime) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += PARTICLE_GRAVITY * dt;
    }
  }

  // Initial burst of golden particles from the center when winning.
  spawnVictoryParticles() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT * 0.4;
    const goldColors = ["#f5d862", "#ffe08a", "#c8a828", "#fff4c8", "#e8c44a"];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * TAU;
      const speed = 80 + Math.random() * 200;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        age: 0,
        lifetime: 0.8 + Math.random() * 0.8,
        size: 2 + Math.random() * 4,
        color: goldColors[i % goldColors.length],
      });
    }
  }

  // Continuous trickle of rising gold sparkles during victory screen.
  spawnCelebrationTick() {
    const goldColors = ["#f5d862", "#ffe08a", "#fff4c8"];
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: Math.random() * GAME_WIDTH,
        y: GAME_HEIGHT + 10,
        vx: (Math.random() - 0.5) * 40,
        vy: -(120 + Math.random() * 160),
        age: 0,
        lifetime: 1.2 + Math.random() * 1.0,
        size: 1.5 + Math.random() * 3,
        color: goldColors[(Math.random() * 3) | 0],
      });
    }
  }
}

ZumaGame._LEVELS = LEVELS;

window.addEventListener("load", async () => {
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) {
    return;
  }

  await initLevels();
  new ZumaGame(canvas);
});
