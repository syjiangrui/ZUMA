// Fixed logical resolution. The canvas is CSS-scaled to fit the screen, while
// all gameplay math stays in this coordinate system.
const GAME_WIDTH = 430;
const GAME_HEIGHT = 932;

// Ball geometry and default spacing. BALL_SPACING is intentionally slightly
// smaller than diameter so the chain reads as a continuous packed line.
const BALL_RADIUS = 14;
const BALL_DIAMETER = BALL_RADIUS * 2;
const BALL_SPACING = 27;
const START_CHAIN_COUNT = 30;

// Base movement tuning. CHAIN_SPEED is the normal conveyor speed toward the
// goal. EXIT_GAP lets the whole chain travel a bit past the visible goal before
// the prototype resets.
const CHAIN_SPEED = 72;
const CHAIN_ENTRY_SPEED = 340;
const CHAIN_ENTRY_TAIL_S = -42;
const CHAIN_ENTRY_START_HEAD_S = -32;
const EXIT_GAP = 180;

// Projectile tuning for both mouse and touch play.
const PROJECTILE_SPEED = 820;
const PROJECTILE_MARGIN = 72;
const MUZZLE_OFFSET = 68;
const AIM_GUIDE_LENGTH = 118;

// Transition tuning. INSERT_SETTLE_SPEED controls how quickly an insertion
// "makes room", while GAP_CLOSE_SPEED controls how quickly a broken rear
// segment catches back up after a removal. These are rule-affecting values, not
// just cosmetic easing constants.
const INSERT_SETTLE_SPEED = 180;
const GAP_CLOSE_SPEED = 60;
const SPLIT_CLOSE_SPEED = 84;
const IMPACT_FADE_SPEED = 7;
const INSERT_MATCH_DELAY = 0.11;
const SPLIT_FRONT_PULL_RATIO = 0.5;
const SPLIT_FRONT_PULL_MAX = 42;
const SPLIT_FRONT_PULL_MIN_RATIO = 0.52;
const SPLIT_FRONT_PULL_CURVE = 1.08;
const SPLIT_FRONT_PULL_SPEED = 96;
const SPLIT_MERGE_EPSILON = 1.2;
const MERGE_SETTLE_DURATION = 0.085;
const MERGE_SETTLE_MIN_SPEED_SCALE = 0.34;
const TAU = Math.PI * 2;

// Particle system tuning. Particles spawn on ball elimination and fly outward
// with gravity, shrinking and fading over their lifetime.
const PARTICLE_COUNT_PER_BALL = 6;
const PARTICLE_LIFETIME = 0.55;
const PARTICLE_SPEED_MIN = 60;
const PARTICLE_SPEED_MAX = 220;
const PARTICLE_GRAVITY = 320;
const PARTICLE_MAX_TOTAL = 120;
// Every palette is paired with one temple glyph family. Color remains the
// fastest match-read signal, while glyph silhouette is there to support the
// "ancient relic sphere" mood once the player notices the rolling detail.
const TEMPLE_GLYPH_VARIANTS = ["scarab", "eye", "sun", "mask", "ankh"];

// Programmatic palettes used both for initial chain colors and procedural ball
// textures. The texture generator later combines these into stripes, arcs and
// highlights so the balls read as rolling textured objects instead of flat dots.
const BALL_PALETTES = [
  {
    base: "#d85d5d",
    bright: "#ffd0be",
    dark: "#702723",
    accent: "#fff4c8",
    stripeDark: "rgba(101, 26, 23, 0.58)",
    stripeLight: "rgba(255, 244, 200, 0.7)",
  },
  {
    base: "#40a56f",
    bright: "#d1ffd0",
    dark: "#114f34",
    accent: "#dffdb9",
    stripeDark: "rgba(6, 54, 31, 0.58)",
    stripeLight: "rgba(214, 255, 205, 0.64)",
  },
  {
    base: "#4f84df",
    bright: "#dceaff",
    dark: "#1f366e",
    accent: "#f1f5c5",
    stripeDark: "rgba(19, 45, 104, 0.56)",
    stripeLight: "rgba(235, 241, 255, 0.62)",
  },
  {
    base: "#e0bb4d",
    bright: "#fff5c9",
    dark: "#80561c",
    accent: "#fff4d3",
    stripeDark: "rgba(119, 76, 10, 0.48)",
    stripeLight: "rgba(255, 249, 212, 0.62)",
  },
  {
    base: "#9a63d3",
    bright: "#f0ddff",
    dark: "#4d2679",
    accent: "#fff6c7",
    stripeDark: "rgba(67, 20, 100, 0.52)",
    stripeLight: "rgba(245, 225, 255, 0.6)",
  },
];

// ---------------------------------------------------------------------------
// Procedural Audio — all sound effects synthesized via Web Audio API.
// No external audio files needed. AudioContext is lazily created on first user
// interaction to satisfy mobile browser autoplay policies.
// ---------------------------------------------------------------------------
class SfxEngine {
  constructor() {
    this.ctx = null;    // AudioContext, created on first unlock
    this.muted = true;  // default muted — player opts in via HUD button
  }

  // Must be called from a user gesture (pointerdown / keydown) at least once.
  unlock() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Some browsers suspend the context until a resume inside a gesture.
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // --- Individual sound effects ------------------------------------------

  // Crisp airy pop — frog spits the ball
  playShoot() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Bright tonal pop
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(480, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.09);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.1);
    // Short breathy noise layer for "puff" texture
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.07, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.12, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    src.connect(hp).connect(ng).connect(this.ctx.destination);
    src.start(t);
  }

  // Stone-on-stone click — ball inserts into chain
  playHit() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Short noise burst through a bandpass filter
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.06, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(bp).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  // Crisp stone-shatter chime — balls eliminated. Combo shifts pitch up.
  playMatch(comboLevel = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const baseFreq = 880 + (comboLevel - 1) * 150;
    // Primary tone — short bright ping
    const o1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    o1.type = "sine";
    o1.frequency.setValueAtTime(baseFreq, t);
    g1.gain.setValueAtTime(0.18, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o1.connect(g1).connect(this.ctx.destination);
    o1.start(t);
    o1.stop(t + 0.15);
    // Harmonic overtone — adds sparkle
    const o2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o2.type = "sine";
    o2.frequency.setValueAtTime(baseFreq * 1.5, t);
    g2.gain.setValueAtTime(0.08, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o2.connect(g2).connect(this.ctx.destination);
    o2.start(t);
    o2.stop(t + 0.1);
    // Tiny noise crackle for "stone breaking" texture
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.04, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3000;
    bp.Q.value = 0.8;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.1, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(bp).connect(ng).connect(this.ctx.destination);
    src.start(t);
  }

  // Ascending arpeggio — victory fanfare
  playWin() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const start = t + i * 0.12;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      o.connect(g).connect(this.ctx.destination);
      o.start(start);
      o.stop(start + 0.4);
    });
  }

  // Low rumble — defeat
  playLose() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // Low oscillator
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.5);
    // Noise layer
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 300;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.15, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(lp).connect(ng).connect(this.ctx.destination);
    src.start(t);
  }
}

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
    this.lastTime = 0;

    this.createPath();
    this.createTextures();
    this.resetRound();
    this.bindEvents();
    this.resize();
    requestAnimationFrame((time) => this.loop(time));
  }

  // Build the track as an Archimedean spiral around the central shooter altar.
  // Gameplay still only moves balls by path distance; the spiral is just a more
  // faithful geometric source for the sampled path points.
  createPath() {
    // Spiral tuning notes:
    // - centerX / centerY move the whole spiral on screen
    // - outerRadius controls the outermost ring footprint; if the track clips
    //   the screen edges, reduce this first
    // - innerRadius controls how close the spiral comes to the shooter altar
    // - startAngle rotates the whole spiral and therefore changes where the
    //   incoming outer ring first becomes visible
    // - turnCount controls how many coils the path makes before reaching the
    //   goal; larger values create a denser Zuma-like spiral
    // These constants are intentionally kept together so future path tuning can
    // happen here without touching collision, insertion or render code.
    const centerX = this.shooter.x + 11;
    const centerY = this.shooter.y + 8;
    const outerRadius = 206;
    const innerRadius = 84;
    const startAngle = 0.96;
    const turnCount = 2.6;
    const endAngle = startAngle + TAU * turnCount;
    const spiralSampleCount = 560;
    const spiralPoints = [];

    for (let step = 0; step <= spiralSampleCount; step += 1) {
      const t = step / spiralSampleCount;
      const theta = startAngle + (endAngle - startAngle) * t;
      const radius = outerRadius + (innerRadius - outerRadius) * t;

      spiralPoints.push({
        x: centerX + Math.cos(theta) * radius,
        y: centerY + Math.sin(theta) * radius,
      });
    }

    // Classical Zuma-style paths do not simply "start on the board"; they
    // enter from off-screen and then wrap around the central altar. We prepend
    // a short cubic approach segment that joins the outer spiral tangentially
    // so the first visible track feels like an incoming lane rather than an
    // abruptly cut curve.
    const joinPoint = spiralPoints[0];
    const nextPoint = spiralPoints[1];
    const tangentLength = Math.hypot(
      nextPoint.x - joinPoint.x,
      nextPoint.y - joinPoint.y,
    ) || 1;
    const tangentX = (nextPoint.x - joinPoint.x) / tangentLength;
    const tangentY = (nextPoint.y - joinPoint.y) / tangentLength;

    // Entry segment tuning notes:
    // - entryStart must stay outside the screen so balls visibly enter from
    //   off-board instead of spawning on the first visible arc
    // - entryControl1 controls how long the approach stays near the outer edge
    // - entryControl2 controls how softly the approach bends into the spiral;
    //   it is derived from the spiral tangent so the join does not kink
    // If the first visible segment feels too abrupt, increase the control
    // distances before changing the spiral itself.
    const entryStart = {
      x: GAME_WIDTH + 96,
      y: joinPoint.y + 22,
    };
    const entryControl1 = {
      x: GAME_WIDTH + 42,
      y: joinPoint.y + 18,
    };
    const entryControl2 = {
      x: joinPoint.x - tangentX * 120,
      y: joinPoint.y - tangentY * 120,
    };

    const sampled = [];
    // Sample the entry Bézier separately, then append the spiral samples. The
    // rest of the game only sees one continuous polyline in pathPoints.
    const entrySampleCount = 56;
    for (let step = 0; step < entrySampleCount; step += 1) {
      const t = step / entrySampleCount;
      const inv = 1 - t;
      sampled.push({
        x:
          inv * inv * inv * entryStart.x +
          3 * inv * inv * t * entryControl1.x +
          3 * inv * t * t * entryControl2.x +
          t * t * t * joinPoint.x,
        y:
          inv * inv * inv * entryStart.y +
          3 * inv * inv * t * entryControl1.y +
          3 * inv * t * t * entryControl2.y +
          t * t * t * joinPoint.y,
      });
    }

    sampled.push(...spiralPoints);

    let total = 0;
    // 预采样路径并记录累计弧长；后续所有轨道运动都通过 len 映射到屏幕坐标。
    this.pathPoints = sampled.map((point, index) => {
      if (index > 0) {
        const prev = sampled[index - 1];
        total += Math.hypot(point.x - prev.x, point.y - prev.y);
      }

      return {
        x: point.x,
        y: point.y,
        len: total,
      };
    });

    this.totalPathLength = total;

    // Pre-build a Path2D so drawTrack() can stroke it without rebuilding
    // 616 lineTo calls three times per frame.
    this.cachedTrackPath = new Path2D();
    this.cachedTrackPath.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    for (let i = 1; i < this.pathPoints.length; i += 1) {
      this.cachedTrackPath.lineTo(this.pathPoints[i].x, this.pathPoints[i].y);
    }
  }

  createTextures() {
    this.ballPatterns = BALL_PALETTES.map((palette, index) =>
      this.createBallPatternCanvas(
        palette,
        TEMPLE_GLYPH_VARIANTS[index % TEMPLE_GLYPH_VARIANTS.length],
      ),
    );
    this.createBallRenderCache();
    this.createFrogCache();
    this.createStaticSceneCache();
  }

  // Background, track and goal never change after path creation. Render them
  // once to an offscreen canvas and blit every frame instead of rebuilding
  // ~20 gradients + 1848 lineTo ops each time.
  createStaticSceneCache() {
    const cache = document.createElement("canvas");
    cache.width = GAME_WIDTH;
    cache.height = GAME_HEIGHT;
    const cCtx = cache.getContext("2d");
    this.drawBackground(cCtx);
    this.drawTrack(cCtx);
    this.drawGoal(cCtx);
    this.staticSceneCache = cache;
  }

  // Pre-render each palette's stone-body gradient, edge stroke, matte shading,
  // and worn-bloom highlight to offscreen canvases. At runtime drawBall() just
  // does drawImage instead of creating 5 gradients per ball per frame.
  // Two layers per palette:
  //   ballBaseCache[i]  — body gradient + edge stroke (drawn UNDER the belt)
  //   ballOverCache[i]  — matteShade + wornBloom + worn arc (drawn OVER the belt)
  // Plus one shared impact-aura cache (palette-independent).
  createBallRenderCache() {
    const r = BALL_RADIUS;
    const pad = 4;          // extra pixels for anti-aliased edges
    const size = (r + pad) * 2;
    const cx = r + pad;

    this.ballBaseCache = [];
    this.ballOverCache = [];
    this.ballCachePad = pad;

    for (let i = 0; i < BALL_PALETTES.length; i++) {
      const palette = BALL_PALETTES[i];

      // --- Base layer: body gradient + edge stroke ---
      const base = document.createElement("canvas");
      base.width = size;
      base.height = size;
      const bCtx = base.getContext("2d");
      bCtx.translate(cx, cx);

      const body = bCtx.createRadialGradient(
        -r * 0.32, -r * 0.4, r * 0.28, 0, 0, r,
      );
      body.addColorStop(0, palette.bright);
      body.addColorStop(0.54, palette.base);
      body.addColorStop(0.84, palette.base);
      body.addColorStop(1, palette.dark);
      bCtx.fillStyle = body;
      bCtx.beginPath();
      bCtx.arc(0, 0, r, 0, TAU);
      bCtx.fill();

      this.ballBaseCache[i] = base;
    }

    // --- Overlay layer: matteShade + edge stroke + wornBloom + worn arc ---
    // These gradients only depend on radius, not palette, so one canvas for all.
    const over = document.createElement("canvas");
    over.width = size;
    over.height = size;
    const oCtx = over.getContext("2d");
    oCtx.translate(cx, cx);

    const matteShade = oCtx.createRadialGradient(
      r * 0.34, r * 0.42, r * 0.12, r * 0.24, r * 0.32, r * 1.08,
    );
    matteShade.addColorStop(0, "rgba(58, 40, 26, 0.01)");
    matteShade.addColorStop(0.5, "rgba(58, 40, 26, 0.05)");
    matteShade.addColorStop(1, "rgba(58, 40, 26, 0.1)");
    oCtx.fillStyle = matteShade;
    oCtx.beginPath();
    oCtx.arc(0, 0, r, 0, TAU);
    oCtx.fill();

    oCtx.strokeStyle = "rgba(122, 96, 68, 0.18)";
    oCtx.lineWidth = 1.15;
    oCtx.beginPath();
    oCtx.arc(0, 0, r - 0.8, 0, TAU);
    oCtx.stroke();

    const wornBloom = oCtx.createRadialGradient(
      -r * 0.34, -r * 0.42, r * 0.02, -r * 0.34, -r * 0.42, r * 0.68,
    );
    wornBloom.addColorStop(0, "rgba(252, 236, 192, 0.3)");
    wornBloom.addColorStop(0.38, "rgba(252, 236, 192, 0.16)");
    wornBloom.addColorStop(1, "rgba(252, 236, 192, 0)");
    oCtx.fillStyle = wornBloom;
    oCtx.beginPath();
    oCtx.arc(0, 0, r, 0, TAU);
    oCtx.fill();

    oCtx.strokeStyle = "rgba(234, 206, 144, 0.16)";
    oCtx.lineWidth = 1.1;
    oCtx.beginPath();
    oCtx.arc(0, 0, r - 1.7, -2.48, -1.12);
    oCtx.stroke();

    this.ballOverCache = over;

    // --- Band shading overlay (topBottom + side fade) ---
    // Only depends on radius, shared across all palettes.
    const bandShade = document.createElement("canvas");
    const bsSize = Math.ceil(r * 2.2);
    bandShade.width = bsSize;
    bandShade.height = bsSize;
    const bsCtx = bandShade.getContext("2d");
    const bsR = bsSize / 2;
    bsCtx.translate(bsR, bsR);

    const topBottomShade = bsCtx.createLinearGradient(0, -r * 0.82, 0, r * 0.82);
    topBottomShade.addColorStop(0, "rgba(27, 18, 12, 0.22)");
    topBottomShade.addColorStop(0.16, "rgba(19, 12, 8, 0)");
    topBottomShade.addColorStop(0.84, "rgba(19, 12, 8, 0)");
    topBottomShade.addColorStop(1, "rgba(27, 18, 12, 0.24)");
    bsCtx.fillStyle = topBottomShade;
    bsCtx.fillRect(-bsR, -bsR, bsSize, bsSize);

    const sideShade = bsCtx.createLinearGradient(-r, 0, r, 0);
    sideShade.addColorStop(0, "rgba(34, 22, 14, 0.17)");
    sideShade.addColorStop(0.16, "rgba(26, 15, 9, 0)");
    sideShade.addColorStop(0.84, "rgba(26, 15, 9, 0)");
    sideShade.addColorStop(1, "rgba(34, 22, 14, 0.18)");
    bsCtx.fillStyle = sideShade;
    bsCtx.fillRect(-bsR, -bsR, bsSize, bsSize);

    this.bandShadeCache = bandShade;
  }

  // Pre-render the stone frog to two offscreen canvases so drawShooter() only
  // needs rotate + drawImage instead of rebuilding ~7 gradients every frame.
  // Split into "behind the ball" and "in front of the ball" layers so the
  // upper jaw still overlaps the held ball at runtime.
  createFrogCache() {
    const size = 170;
    const cx = size / 2;
    const cy = size / 2 + 6; // bias downward so the taller head fits

    // --- Layer 1: body + lower jaw + mouth cavity + belly socket ---
    const behind = document.createElement("canvas");
    behind.width = size;
    behind.height = size;
    const bCtx = behind.getContext("2d");
    bCtx.translate(cx, cy);
    this.drawFrogBody(bCtx);
    this.drawFrogJawBehind(bCtx);
    this.drawFrogBellySocket(bCtx);
    this.frogCacheBehind = behind;
    this.frogCacheCx = cx;
    this.frogCacheCy = cy;

    // --- Layer 2: upper jaw + nostrils + bronze accents + eyes ---
    const front = document.createElement("canvas");
    front.width = size;
    front.height = size;
    const fCtx = front.getContext("2d");
    fCtx.translate(cx, cy);
    this.drawFrogJawFront(fCtx);
    this.drawFrogEyes(fCtx);
    this.frogCacheFront = front;
  }

  // Reset the chain itself to a packed line of balls. Round-scoped state such
  // as projectile, palettes and gameState is handled by resetRound().
  createChain() {
    this.chain = Array.from({ length: START_CHAIN_COUNT }, (_, index) =>
      this.createChainBall(index % 4),
    );

    // Zuma-style rounds should begin with the chain still fully outside the
    // visible track, then roll in quickly to the normal opening state. The
    // target still leaves a small portion of the tail off-screen so the chain
    // does not look artificially "pre-laid" on the path.
    const targetHeadS =
      (this.chain.length - 1) * BALL_SPACING + CHAIN_ENTRY_TAIL_S;
    this.chainHeadS = CHAIN_ENTRY_START_HEAD_S;
    this.chainIntro = {
      targetHeadS,
    };
    this.splitState = null;
    this.pendingMatchChecks = [];
    this.syncChainPositions();
  }

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
      } else if (nextState === "lose") {
        this.sfx.playLose();
      }
    }
  }

  isRoundPlaying() {
    return this.gameState === "playing";
  }

  // A round reset must clear every transient gameplay structure that can leak
  // across attempts: projectile, seam state, delayed match checks, palettes and
  // id allocation. This is the single restart path used by the constructor, the
  // prototype tail escape, and future restart UI.
  resetRound() {
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
    this.currentPaletteIndex = this.getRandomPaletteIndex();
    this.nextPaletteIndex = this.getRandomPaletteIndex();
    this.shooter.angle = -Math.PI / 2;
    this.pointer.active = false;
    this.pointer.x = this.shooter.x + 90;
    this.pointer.y = this.shooter.y - 120;
    this.createChain();
  }

  createChainBall(paletteIndex) {
    return {
      id: this.nextBallId++,
      paletteIndex,
      radius: BALL_RADIUS,
      s: 0,
      rotation: 0,
      // offset is a temporary distance correction layered on top of the base
      // chain position. Positive offset pushes a ball toward the goal, negative
      // offset pulls it back toward the start.
      offset: 0,
      // offsetMode selects which speed rule is used when offset settles back to
      // zero. "insert" and "close" are gameplay-relevant states.
      offsetMode: "idle",
      // impact is purely visual: a short pulse used on collisions, merges and
      // seam closures so state transitions are easier to read.
      impact: 0,
      // Keep a fallback link from later delayed checks back to the originating
      // shot action so combo scoring does not silently disappear if an explicit
      // action id is missing further down the chain reaction.
      lastActionId: null,
    };
  }

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
    if (this.gameState === "playing") {
      return null;
    }

    return {
      x: GAME_WIDTH * 0.5 - 84,
      y: GAME_HEIGHT * 0.12 + 114,
      w: 168,
      h: 34,
    };
  }

  // Button hit testing must run before gameplay input so tapping UI on phone
  // does not accidentally start an aiming / firing gesture on the canvas.
  getUiActionAt(x, y) {
    const endCardRestart = this.getEndCardRestartButtonRect();
    if (this.isPointInsideRect(x, y, endCardRestart)) {
      return "restart";
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
    }
  }

  // One fired shot owns an action context. Later seam closures and follow-up
  // removals point back to it so scoring/combo logic can treat them as a
  // single player action instead of isolated events.
  createActionContext(source = "shot") {
    const actionId = this.nextActionId++;
    this.actionContexts.set(actionId, {
      id: actionId,
      source,
      combo: 0,
      totalRemoved: 0,
      totalScore: 0,
    });
    this.trimActionContexts();
    return actionId;
  }

  getActionContext(actionId) {
    if (actionId === null || actionId === undefined) {
      return null;
    }

    let context = this.actionContexts.get(actionId);
    if (!context) {
      context = {
        id: actionId,
        source: "system",
        combo: 0,
        totalRemoved: 0,
        totalScore: 0,
      };
      this.actionContexts.set(actionId, context);
    }
    return context;
  }

  // Delayed seam closures mean action contexts must outlive the shot itself,
  // but the table should still stay bounded once nothing references old ids.
  trimActionContexts() {
    if (this.actionContexts.size <= 64) {
      return;
    }

    const protectedIds = new Set();
    if (this.projectile?.actionId) {
      protectedIds.add(this.projectile.actionId);
    }
    if (this.splitState?.actionId) {
      protectedIds.add(this.splitState.actionId);
    }
    for (const check of this.pendingMatchChecks) {
      if (check.actionId) {
        protectedIds.add(check.actionId);
      }
    }

    for (const actionId of this.actionContexts.keys()) {
      if (this.actionContexts.size <= 64) {
        break;
      }
      if (!protectedIds.has(actionId)) {
        this.actionContexts.delete(actionId);
      }
    }
  }

  recordMatchEvent({ actionId, removedCount, trigger }) {
    const context = this.getActionContext(actionId);
    if (!context) {
      return;
    }

    // One shot can produce multiple removal waves. combo therefore belongs to
    // the action context, not to a single queueMatchCheck invocation.
    context.combo += 1;
    context.totalRemoved += removedCount;

    const baseScore = removedCount * 100;
    const sizeBonus = Math.max(0, removedCount - 3) * 40;
    const comboBonus = Math.max(0, context.combo - 1) * 120;
    const triggerBonus = trigger === "seam" ? 90 : 0;
    const awardedScore = baseScore + sizeBonus + comboBonus + triggerBonus;

    context.totalScore += awardedScore;
    this.score += awardedScore;
    this.bestCombo = Math.max(this.bestCombo, context.combo);
    this.sfx.playMatch(context.combo);

    const tags = [];
    if (context.combo > 1) {
      tags.push(`连击 x${context.combo}`);
      this.recentCombo = {
        combo: context.combo,
        timer: 2.6,
      };
    }
    if (trigger === "seam") {
      tags.push("接缝连锁");
    }
    if (removedCount > 3) {
      tags.push(`消除 ${removedCount}`);
    }

    this.matchFeedback = {
      scoreDelta: awardedScore,
      combo: context.combo,
      removedCount,
      label: tags.join(" · "),
      timer: 1.2,
    };
  }

  // HUD feedback keeps its own timers so score/combo presentation can linger
  // for readability without affecting any gameplay state machine.
  updateHudState(dt) {
    if (this.matchFeedback) {
      this.matchFeedback.timer -= dt;
      if (this.matchFeedback.timer <= 0) {
        this.matchFeedback = null;
      }
    }

    if (this.recentCombo) {
      this.recentCombo.timer -= dt;
      if (this.recentCombo.timer <= 0) {
        this.recentCombo = null;
      }
    }
  }

  loop(time) {
    const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0.016);
    this.lastTime = time;

    this.update(dt);
    this.render();

    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(dt) {
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

  updateChain(dt) {
    if (this.chain.length === 0) {
      return;
    }

    // Merge settle is evaluated before baseline motion. This way a freshly
    // rejoined chain can briefly "land" and then ramp back into normal
    // conveyor motion without fighting the split closure math.
    this.updateMergeSettle(dt);
    if (!this.splitState) {
      this.advanceChainBaseline(dt);
    }
    // Once the chain is broken, keep the shared baseline still and let the rear
    // segment close the gap only through its own "close" offsets. This avoids
    // the old behavior where rear balls advanced at CHAIN_SPEED + GAP_CLOSE_SPEED
    // and visibly sprinted into the frozen front segment.
    // Transition updates happen before positions are recomputed so the current
    // frame already reflects insertion / closure progress.
    this.updateBallTransitions(dt);
    this.updateSplitFrontPull(dt, this.getSplitGap());
    this.updatePendingMatchChecks(dt);
    this.resolveSplitClosure();
    this.syncChainPositions();

    const tailS = this.chain[this.chain.length - 1].s;
    if (tailS > this.totalPathLength + EXIT_GAP) {
      this.setGameState("lose");
      this.screenShake = 1; // trigger screen shake on defeat
    }
  }

  advanceChainBaseline(dt) {
    if (this.chainIntro) {
      // The first few seconds of a round are a dedicated entrance phase: the
      // chain should visibly roll in from off-board before it settles into the
      // normal conveyor pace.
      this.chainHeadS += CHAIN_ENTRY_SPEED * dt;
      if (this.chainHeadS >= this.chainIntro.targetHeadS) {
        this.chainHeadS = this.chainIntro.targetHeadS;
        this.chainIntro = null;
      }
      return;
    }

    this.chainHeadS += CHAIN_SPEED * dt * this.getChainSpeedScale();
  }

  // After a seam rejoins, briefly hold back the shared conveyor so the merge
  // reads as contact/settle rather than an immediate full-speed carry-on.
  getChainSpeedScale() {
    if (!this.mergeSettle) {
      return 1;
    }

    const progress =
      1 - this.mergeSettle.timer / this.mergeSettle.duration;
    const eased = progress * progress * (3 - 2 * progress);
    return (
      MERGE_SETTLE_MIN_SPEED_SCALE +
      (1 - MERGE_SETTLE_MIN_SPEED_SCALE) * eased
    );
  }

  updateMergeSettle(dt) {
    if (!this.mergeSettle) {
      return;
    }

    this.mergeSettle.timer = Math.max(0, this.mergeSettle.timer - dt);
    if (this.mergeSettle.timer <= 0) {
      this.mergeSettle = null;
    }
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

  syncChainPositions() {
    this.chain.forEach((ball, index) => {
      // Final position = shared chain baseline + this ball's temporary offset.
      // During a split, chainHeadS stays frozen and the front segment receives
      // a distributed pullback based on overall seam-closing progress, not just
      // the last few pixels before merge.
      const splitOffset = this.getSplitLocalOffset(index);
      ball.s = this.chainHeadS - index * BALL_SPACING + ball.offset + splitOffset;
      // Rotation is tied to traveled path distance so textured balls look like
      // they are rolling along the track instead of merely sliding.
      ball.rotation = ball.s / ball.radius;
    });
  }

  // Ease per-ball temporary offsets back toward zero. The key point here is
  // that different gameplay situations use different speed caps:
  // - insert: make room for a new ball
  // - close:  gap closes after a removal
  //   - ordinary closure keeps the calmer GAP_CLOSE_SPEED
  //   - split rear chase uses SPLIT_CLOSE_SPEED so it does not feel slower
  //     than the chain's normal conveyor motion
  // This function should stay purely about offset settling, not about chain
  // topology or match logic.
  updateBallTransitions(dt) {
    for (const [index, ball] of this.chain.entries()) {
      // offset 只负责过渡动画，不直接决定球链基础前进。
      const speed =
        ball.offsetMode === "close"
          ? this.splitState && index >= this.splitState.index
            ? SPLIT_CLOSE_SPEED
            : GAP_CLOSE_SPEED
          : ball.offsetMode === "insert"
            ? INSERT_SETTLE_SPEED
            : INSERT_SETTLE_SPEED;
      const step = speed * dt;

      if (ball.offset > 0) {
        ball.offset = Math.max(0, ball.offset - step);
      } else if (ball.offset < 0) {
        ball.offset = Math.min(0, ball.offset + step);
      }

      if (Math.abs(ball.offset) < 0.04) {
        ball.offset = 0;
        ball.offsetMode = "idle";
      }

      ball.impact = Math.max(0, ball.impact - dt * IMPACT_FADE_SPEED);
    }
  }

  updatePendingMatchChecks(dt) {
    if (this.pendingMatchChecks.length === 0) {
      return;
    }

    const dueChecks = [];

    // 插入和重新并链后延迟一小段时间再做三消判定，避免动画还没成立就瞬间消除。
    this.pendingMatchChecks = this.pendingMatchChecks.filter((check) => {
      check.delay -= dt;
      if (check.delay <= 0) {
        dueChecks.push(check);
        return false;
      }

      return true;
    });

    for (const check of dueChecks) {
      const index = this.chain.findIndex((ball) => ball.id === check.ballId);
      if (index >= 0) {
        // The ball may have shifted to a new index while waiting, so delayed
        // checks always resolve by id instead of by the original array index.
        this.resolveMatchesFrom(index, check.actionId, check.trigger);
      }
    }
  }

  // Queue a future "start matching from this ball" request. We use this after
  // insertion and after seam closure so visuals have a moment to communicate
  // what just happened before a group vanishes. actionId keeps later chain
  // reactions attached to the original shot for scoring/combo purposes.
  queueMatchCheck(
    ballId,
    delay = INSERT_MATCH_DELAY,
    actionId = null,
    trigger = "insert",
  ) {
    const existing = this.pendingMatchChecks.find(
      (check) =>
        check.ballId === ballId &&
        check.actionId === actionId &&
        check.trigger === trigger,
    );
    if (existing) {
      existing.delay = Math.min(existing.delay, delay);
      return;
    }

    this.pendingMatchChecks.push({ ballId, delay, actionId, trigger });
  }

  setBallAction(index, actionId) {
    if (
      actionId === null ||
      actionId === undefined ||
      index < 0 ||
      index >= this.chain.length
    ) {
      return;
    }

    this.chain[index].lastActionId = actionId;
  }

  // A closure-triggered re-check must consider both sides of the seam. If we
  // only re-check the left ball, we miss cases where the new removable run
  // starts on the right side after closure.
  queueAdjacentMatchChecks(
    leftIndex,
    rightIndex,
    actionId,
    delay = INSERT_MATCH_DELAY,
    trigger = "chain",
  ) {
    this.setBallAction(leftIndex, actionId);
    this.setBallAction(rightIndex, actionId);

    const queuedIds = new Set();
    const candidates = [leftIndex, rightIndex];
    for (const index of candidates) {
      if (index < 0 || index >= this.chain.length) {
        continue;
      }

      const ballId = this.chain[index].id;
      if (queuedIds.has(ballId)) {
        continue;
      }

      queuedIds.add(ballId);
      this.queueMatchCheck(ballId, delay, actionId, trigger);
    }
  }

  // There is only ever one gameplay gap in the prototype: the break created
  // when a middle group disappears. Matching and chain logic must treat that
  // seam as non-adjacent until the rear segment has physically caught up.
  hasGapBetween(leftIndex, rightIndex) {
    return (
      !!this.splitState &&
      leftIndex === this.splitState.index - 1 &&
      rightIndex === this.splitState.index
    );
  }

  getSplitGap() {
    if (
      !this.splitState ||
      this.splitState.index <= 0 ||
      this.splitState.index >= this.chain.length
    ) {
      return null;
    }

    const frontTail = this.chain[this.splitState.index - 1];
    const rearHead = this.chain[this.splitState.index];
    // A split gap is represented entirely in offset space while chainHeadS is
    // frozen. Once the front tail offset and rear head offset meet, the seam is
    // logically ready to rejoin.
    return Math.max(0, frontTail.offset - rearHead.offset);
  }

  getSplitFrontPullTarget(gap) {
    const initialGap = this.splitState?.initialGap ?? 0;
    if (gap === null || initialGap <= 0) {
      return 0;
    }

    // Drive front pull by total closure progress across the whole break, not
    // just by the final proximity window. This lets the front segment visibly
    // retreat while the rear segment is still covering most of the original
    // gap, which matches the intended "roughly 50/50" merge feel better.
    const closedDistance = Math.max(0, initialGap - gap);
    return Math.min(SPLIT_FRONT_PULL_MAX, closedDistance * SPLIT_FRONT_PULL_RATIO);
  }

  updateSplitFrontPull(dt, gap) {
    if (!this.splitState) {
      return;
    }

    // frontPull is animated toward its target instead of snapping so the whole
    // front segment appears to get drawn back by chain tension, rather than
    // teleporting into a new pose when the seam nears closure.
    const targetPull = this.getSplitFrontPullTarget(gap);
    const currentPull = this.splitState.frontPull ?? 0;
    const step = SPLIT_FRONT_PULL_SPEED * dt;

    if (currentPull < targetPull) {
      this.splitState.frontPull = Math.min(targetPull, currentPull + step);
    } else {
      this.splitState.frontPull = Math.max(targetPull, currentPull - step);
    }
  }

  getSplitLocalOffset(index) {
    if (
      !this.splitState ||
      index >= this.splitState.index ||
      !this.splitState.frontPull
    ) {
      return 0;
    }

    const frontCount = this.splitState.index;
    if (frontCount <= 0) {
      return 0;
    }

    const seamDistance = this.splitState.index - 1 - index;
    const normalized =
      frontCount <= 1 ? 0 : seamDistance / (frontCount - 1);
    // The whole front chain should release pressure a little when the rear
    // segment is about to merge. Keep the largest pull at the seam, but never
    // let the far front balls drop to zero influence, otherwise the recoil
    // reads like a local glitch instead of a chain-wide pullback.
    const falloff =
      SPLIT_FRONT_PULL_MIN_RATIO +
      (1 - SPLIT_FRONT_PULL_MIN_RATIO) *
        Math.pow(Math.max(0, 1 - normalized), SPLIT_FRONT_PULL_CURVE);

    return -this.splitState.frontPull * falloff;
  }

  resolveSplitClosure() {
    if (
      !this.splitState ||
      this.splitState.index <= 0 ||
      this.splitState.index >= this.chain.length
    ) {
      this.splitState = null;
      return;
    }

    const frontTail = this.chain[this.splitState.index - 1];
    const rearHead = this.chain[this.splitState.index];
    // Use the animated front pull for closure so the seam only resolves once
    // the visible bidirectional merge has substantially played out.
    const frontExtra =
      frontTail.offset + this.getSplitLocalOffset(this.splitState.index - 1);

    // The seam should not rejoin the moment the nominal gap is gone. We wait
    // until the rear head has actually met the animated front seam position,
    // otherwise the front pullback would be cut off visually.
    if (rearHead.offset < frontExtra - SPLIT_MERGE_EPSILON) {
      return;
    }

    rearHead.offset = frontExtra;
    if (Math.abs(rearHead.offset) < 0.04) {
      rearHead.offset = 0;
      rearHead.offsetMode = "idle";
    }

    const seamIndex = this.splitState.index - 1;
    const seamActionId = this.splitState.actionId;
    this.absorbSplitState();
    this.triggerMergeSettle(seamIndex);
    this.queueAdjacentMatchChecks(seamIndex, seamIndex + 1, seamActionId, 0.03, "seam");
  }

  absorbSplitState() {
    if (!this.splitState) {
      return;
    }

    // Hand off the merge pose into the regular chain state without creating a
    // short burst of extra forward speed. The seam-side pull becomes a shared
    // baseline shift on chainHeadS, while only the per-ball differences remain
    // as ordinary offsets. That preserves the visible "pulled back" pose and
    // avoids a frame where the front segment jumps or surges forward.
    const absorbedBaseline = this.getSplitLocalOffset(this.splitState.index - 1);
    this.chainHeadS += absorbedBaseline;

    for (let index = 0; index < this.chain.length; index += 1) {
      const localOffset =
        index < this.splitState.index ? this.getSplitLocalOffset(index) : 0;
      const residualOffset = localOffset - absorbedBaseline;
      if (!residualOffset) {
        continue;
      }

      this.chain[index].offset += residualOffset;
      this.chain[index].offsetMode = "close";
    }

    this.splitState = null;
  }

  triggerMergeSettle(seamIndex) {
    // This is intentionally tiny. It is not a new simulation state; it only
    // dampens the first few frames after a seam rejoins so the contact reads as
    // impact/settle instead of an abrupt return to full conveyor speed.
    this.mergeSettle = {
      timer: MERGE_SETTLE_DURATION,
      duration: MERGE_SETTLE_DURATION,
    };

    // The merge should read as a local impact, not a visible bounce. Spread a
    // stronger hit to the seam pair and a much softer falloff to nearby balls.
    const impactProfile = [0.88, 0.58, 0.34];
    for (let distance = 0; distance < impactProfile.length; distance += 1) {
      const frontIndex = seamIndex - distance;
      const rearIndex = seamIndex + 1 + distance;
      const amount = impactProfile[distance];
      this.addImpact(frontIndex, amount);
      this.addImpact(rearIndex, amount);
    }
  }

  addImpact(index, amount) {
    if (index < 0 || index >= this.chain.length) {
      return;
    }

    this.chain[index].impact = Math.max(this.chain[index].impact, amount);
  }

  // --- Particle system ---------------------------------------------------

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

  drawParticles(ctx) {
    for (const p of this.particles) {
      const t = p.age / p.lifetime; // 0→1
      const alpha = 1 - t * t; // fade out (quadratic)
      const scale = 1 - t * 0.5; // shrink to 50%
      const r = p.size * scale;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // --- Round-end effects -------------------------------------------------

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

  updateProjectile(dt) {
    if (!this.projectile) {
      return;
    }

    this.projectile.x += this.projectile.vx * dt;
    this.projectile.y += this.projectile.vy * dt;
    this.projectile.rotation += this.projectile.spin * dt;

    const collision = this.findChainCollision();
    if (collision) {
      // Once the projectile is converted into a chain ball, the airborne object
      // disappears and all further motion is handled by the chain system.
      this.sfx.playHit();
      this.insertProjectile(collision);
      this.projectile = null;
      return;
    }

    if (
      this.projectile.x < -PROJECTILE_MARGIN ||
      this.projectile.x > GAME_WIDTH + PROJECTILE_MARGIN ||
      this.projectile.y < -PROJECTILE_MARGIN ||
      this.projectile.y > GAME_HEIGHT + PROJECTILE_MARGIN
    ) {
      this.projectile = null;
    }
  }

  fireProjectile() {
    if (!this.isRoundPlaying() || this.projectile) {
      return;
    }

    this.sfx.playShoot();
    const actionId = this.createActionContext("shot");
    const angle = this.shooter.angle;
    const startX = this.shooter.x + Math.cos(angle) * MUZZLE_OFFSET;
    const startY = this.shooter.y + Math.sin(angle) * MUZZLE_OFFSET;

    // Airborne projectiles use free x/y motion. They only convert back into a
    // path-based coordinate once they collide with the chain.
    this.projectile = {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * PROJECTILE_SPEED,
      vy: Math.sin(angle) * PROJECTILE_SPEED,
      radius: BALL_RADIUS,
      paletteIndex: this.currentPaletteIndex,
      actionId,
      rotation: 0,
      spin: 7.2,
    };

    this.currentPaletteIndex = this.nextPaletteIndex;
    this.nextPaletteIndex = this.getRandomPaletteIndex();
  }

  findChainCollision() {
    if (!this.projectile || this.chain.length === 0) {
      return null;
    }

    let best = null;

    // The first prototype uses a simple nearest-ball hit test against current
    // chain positions. That is good enough to validate insertion flow before
    // moving to a more exact along-track insertion model.
    for (let index = 0; index < this.chain.length; index += 1) {
      const ball = this.chain[index];
      if (ball.s < 0 || ball.s > this.totalPathLength) {
        continue;
      }

      const point = this.getPointAtDistance(ball.s);
      const distance = Math.hypot(
        this.projectile.x - point.x,
        this.projectile.y - point.y,
      );

      if (distance <= BALL_DIAMETER - 4 && (!best || distance < best.distance)) {
        best = {
          hitIndex: index,
          hitS: ball.s,
          // projectileS is the nearest location on the sampled path to the hit
          // point. We later compare it with hitS to decide whether the new ball
          // lands on the start-side or goal-side of the struck ball.
          projectileS: this.getClosestPathDistance(
            this.projectile.x,
            this.projectile.y,
          ),
          distance,
        };
      }
    }

    return best;
  }

  // Keep the original one-step insertion model, but open a small local pocket
  // around the new ball immediately so the first frame reads less like overlap
  // and more like the chain yielding at the impact point.
  applyInsertSpacingWave(insertIndex) {
    const frontNudgeProfile = [6, 3];
    const rearOpenProfile = [8, 5, 2, 0];

    for (let offsetIndex = 0; offsetIndex < frontNudgeProfile.length; offsetIndex += 1) {
      const chainIndex = insertIndex - 1 - offsetIndex;
      if (chainIndex < 0) {
        break;
      }

      this.chain[chainIndex].offset += frontNudgeProfile[offsetIndex];
      this.chain[chainIndex].offsetMode = "insert";
    }

    for (let offsetIndex = 0; insertIndex + 1 + offsetIndex < this.chain.length; offsetIndex += 1) {
      const chainIndex = insertIndex + 1 + offsetIndex;
      const immediateClearance = rearOpenProfile[offsetIndex] ?? 0;

      this.chain[chainIndex].offset += BALL_SPACING - immediateClearance;
      this.chain[chainIndex].offsetMode = "insert";
    }
  }

  insertProjectile({ hitIndex, hitS, projectileS }) {
    const insertIndex = projectileS > hitS ? hitIndex : hitIndex + 1;
    const safeIndex = Math.max(0, Math.min(this.chain.length, insertIndex));
    const insertedBall = this.createChainBall(this.projectile.paletteIndex);
    // targetS is where the new ball would sit in a perfectly packed chain.
    // insertionOffset then preserves some of the projectile's actual impact
    // position so the ball appears to slide into place instead of teleporting.
    const targetS = this.chainHeadS - safeIndex * BALL_SPACING;
    const insertionOffset = Math.max(
      -BALL_SPACING * 1.25,
      Math.min(BALL_SPACING * 1.25, projectileS - targetS),
    );

    insertedBall.offset = insertionOffset;
    insertedBall.offsetMode = "insert";
    insertedBall.impact = 1;
    // Once the projectile becomes part of the chain, later delayed checks need
    // to preserve its scoring/combo ownership across seam closures.
    insertedBall.lastActionId = this.projectile.actionId ?? null;

    if (this.splitState && safeIndex < this.splitState.index) {
      // Inserting before an existing seam shifts the seam one slot to the right.
      this.splitState.index += 1;
    }

    this.chain.splice(safeIndex, 0, insertedBall);

    this.applyInsertSpacingWave(safeIndex);

    this.addImpact(safeIndex - 1, 0.72);
    this.addImpact(safeIndex + 1, 0.72);
    this.queueMatchCheck(insertedBall.id, INSERT_MATCH_DELAY, this.projectile.actionId, "insert");
    this.syncChainPositions();
  }

  // Expand a same-color run from a given seed index. This function is also
  // responsible for deciding whether a removal creates a split segment or
  // simply shortens an already contiguous chain.
  resolveMatchesFrom(index, actionId = null, trigger = "insert") {
    if (index < 0 || index >= this.chain.length) {
      return;
    }

    const resolvedActionId =
      actionId ?? this.chain[index].lastActionId ?? this.createActionContext("chain");

    // If a split already exists, array indices to the right of the removal may
    // shift and the seam index needs to be corrected after the splice.
    const splitIndexBeforeRemoval = this.splitState ? this.splitState.index : null;
    const color = this.chain[index].paletteIndex;
    let start = index;
    let end = index;

    while (
      start > 0 &&
      // 断链尚未闭合时，匹配搜索不能跨越断口。
      !this.hasGapBetween(start - 1, start) &&
      this.chain[start - 1].paletteIndex === color
    ) {
      start -= 1;
    }

    while (
      end < this.chain.length - 1 &&
      !this.hasGapBetween(end, end + 1) &&
      this.chain[end + 1].paletteIndex === color
    ) {
      end += 1;
    }

    if (end - start + 1 < 3) {
      return;
    }

    const removedCount = end - start + 1;
    this.recordMatchEvent({ actionId: resolvedActionId, removedCount, trigger });

    // Spawn debris particles at each eliminated ball's position BEFORE the
    // splice removes them from the chain array.
    this.spawnMatchParticles(start, removedCount, color);

    this.chain.splice(start, removedCount);

    // Every ball behind the removed group needs temporary negative offset so it
    // can visually travel forward into the new empty space.
    for (let index = start; index < this.chain.length; index += 1) {
      this.chain[index].offset -= removedCount * BALL_SPACING;
      this.chain[index].offsetMode = "close";
      this.chain[index].lastActionId = resolvedActionId;
    }

    if (this.chain.length === 0) {
      this.splitState = null;
      this.pendingMatchChecks = [];
      return;
    }

    const seamIndex = Math.max(0, start - 1);
    this.addImpact(seamIndex, 0.82);
    this.addImpact(Math.min(this.chain.length - 1, seamIndex + 1), 0.82);

    if (splitIndexBeforeRemoval !== null) {
      if (end < splitIndexBeforeRemoval) {
        this.splitState.index = Math.max(0, splitIndexBeforeRemoval - removedCount);
      }

      if (
        this.splitState &&
        (this.splitState.index <= 0 || this.splitState.index >= this.chain.length)
      ) {
        this.splitState = null;
      }
    } else if (start > 0 && start < this.chain.length) {
      this.splitState = {
        index: start,
        frontPull: 0,
        initialGap: 0,
        actionId: resolvedActionId,
      };
      this.splitState.initialGap =
        this.getSplitGap() ?? removedCount * BALL_SPACING;
      // Once a fresh split is created, cross-gap matching is invalid until the
      // rear segment physically reconnects, so we stop here.
      return;
    }

    if (
      seamIndex < this.chain.length - 1 &&
      !this.hasGapBetween(seamIndex, seamIndex + 1)
    ) {
      this.queueAdjacentMatchChecks(
        seamIndex,
        seamIndex + 1,
        resolvedActionId,
        INSERT_MATCH_DELAY * 1.15,
        "chain",
      );
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Screen shake on defeat — offset the entire canvas briefly
    if (this.screenShake > 0) {
      const intensity = this.screenShake * 14;
      const ox = (Math.random() - 0.5) * intensity;
      const oy = (Math.random() - 0.5) * intensity;
      ctx.save();
      ctx.translate(ox, oy);
    }

    // Static scene (background + track + goal) is pre-rendered once
    ctx.drawImage(this.staticSceneCache, 0, 0);
    this.drawChain(ctx);
    this.drawParticles(ctx);
    this.drawProjectile(ctx);
    this.drawAimGuide(ctx);
    this.drawShooter(ctx);
    this.drawOverlay(ctx);
    this.drawMatchFeedback(ctx);

    if (this.screenShake > 0) {
      ctx.restore();
    }

    // Round-end effects and card are drawn outside the shake transform
    if (this.gameState !== "playing") {
      this.drawRoundEndEffect(ctx);
    }
    this.drawRoundStateCard(ctx);
  }

  drawBackground(ctx) {
    const canopy = ctx.createLinearGradient(0, 0, 0, 176);
    canopy.addColorStop(0, "#17383e");
    canopy.addColorStop(0.55, "#10272d");
    canopy.addColorStop(1, "#0a1519");
    ctx.fillStyle = canopy;
    ctx.fillRect(0, 0, GAME_WIDTH, 176);

    const slab = ctx.createLinearGradient(0, 118, 0, GAME_HEIGHT);
    slab.addColorStop(0, "#7f8990");
    slab.addColorStop(0.48, "#6e7880");
    slab.addColorStop(1, "#5b646d");
    ctx.fillStyle = slab;
    ctx.fillRect(0, 108, GAME_WIDTH, GAME_HEIGHT - 108);

    ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
    for (let i = 0; i < 16; i += 1) {
      ctx.beginPath();
      ctx.ellipse(
        28 + i * 26,
        156 + (i % 5) * 118,
        18 + (i % 3) * 11,
        12 + (i % 4) * 6,
        0.22 * (i % 4),
        0,
        TAU,
      );
      ctx.fill();
    }

    ctx.fillStyle = "rgba(43, 51, 57, 0.16)";
    for (let i = 0; i < 12; i += 1) {
      ctx.beginPath();
      ctx.ellipse(
        40 + i * 32,
        214 + (i % 4) * 146,
        22 + (i % 2) * 16,
        10 + (i % 3) * 7,
        0.3,
        0,
        TAU,
      );
      ctx.fill();
    }

    const glow = ctx.createRadialGradient(
      this.shooter.x + 22,
      118,
      14,
      this.shooter.x + 22,
      118,
      268,
    );
    glow.addColorStop(0, "rgba(233, 192, 98, 0.18)");
    glow.addColorStop(1, "rgba(233, 192, 98, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const tileRects = [
      { x: 26, y: 194, w: 56, h: 50 },
      { x: GAME_WIDTH - 82, y: 194, w: 56, h: 50 },
      { x: 28, y: GAME_HEIGHT - 168, w: 48, h: 44 },
      { x: GAME_WIDTH - 78, y: GAME_HEIGHT - 168, w: 48, h: 44 },
    ];
    for (const rect of tileRects) {
      this.drawStonePanel(ctx, rect.x, rect.y, rect.w, rect.h, 12, {
        top: "#8d989f",
        bottom: "#67727a",
        stroke: "rgba(72, 54, 35, 0.5)",
        innerStroke: "rgba(255, 236, 185, 0.12)",
        shadow: "rgba(22, 26, 31, 0.12)",
      });
      ctx.strokeStyle = "rgba(78, 89, 95, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rect.x + rect.w * 0.42, rect.y + rect.h * 0.44, 9, 0.3, 4.9);
      ctx.lineTo(rect.x + rect.w * 0.65, rect.y + rect.h * 0.62);
      ctx.arc(rect.x + rect.w * 0.52, rect.y + rect.h * 0.54, 11, 5.2, 2.4);
      ctx.stroke();
    }

    const altarGlow = ctx.createRadialGradient(
      this.shooter.x,
      this.shooter.y,
      18,
      this.shooter.x,
      this.shooter.y,
      164,
    );
    altarGlow.addColorStop(0, "rgba(239, 212, 126, 0.24)");
    altarGlow.addColorStop(1, "rgba(239, 212, 126, 0)");
    ctx.fillStyle = altarGlow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = "rgba(73, 84, 94, 0.34)";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(this.shooter.x, this.shooter.y + 8, 100, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = "rgba(196, 163, 98, 0.18)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.shooter.x, this.shooter.y + 8, 100, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = "rgba(22, 28, 33, 0.42)";
    ctx.beginPath();
    ctx.ellipse(this.shooter.x, this.shooter.y + 72, 96, 26, 0, 0, TAU);
    ctx.fill();
  }

  drawTrack(ctx) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Keep the track visually simple: one soft carved shadow, one stone groove
    // body, and one thin inner crease. Too many stacked strokes start reading
    // as UI outlines instead of a channel cut into the slab.
    ctx.strokeStyle = "rgba(18, 22, 28, 0.14)";
    ctx.lineWidth = 30;
    this.strokePath(ctx);

    ctx.strokeStyle = "rgba(111, 121, 130, 0.92)";
    ctx.lineWidth = 20;
    this.strokePath(ctx);

    ctx.strokeStyle = "rgba(60, 70, 78, 0.34)";
    ctx.lineWidth = 8;
    this.strokePath(ctx);

    ctx.restore();
  }

  drawGoal(ctx) {
    const goal = this.pathPoints[this.pathPoints.length - 1];
    ctx.save();
    ctx.translate(goal.x, goal.y);

    const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 36);
    aura.addColorStop(0, "rgba(255, 220, 128, 0.28)");
    aura.addColorStop(1, "rgba(255, 220, 128, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#3f2514";
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "#d2a85c";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, TAU);
    ctx.stroke();

    ctx.restore();
  }

  drawChain(ctx) {
    // Only draw balls that are currently on the playable portion of the path.
    for (const ball of this.chain) {
      if (ball.s < 0 || ball.s > this.totalPathLength) {
        continue;
      }

      const point = this.getPointAtDistance(ball.s);
      this.drawBall(
        ctx,
        point.x,
        point.y,
        ball.radius,
        ball.paletteIndex,
        ball.rotation,
        ball.impact,
      );
    }
  }

  drawProjectile(ctx) {
    if (!this.projectile) {
      return;
    }

    this.drawBall(
      ctx,
      this.projectile.x,
      this.projectile.y,
      this.projectile.radius,
      this.projectile.paletteIndex,
      this.projectile.rotation,
      0,
    );
  }

  drawAimGuide(ctx) {
    const startX = this.shooter.x + Math.cos(this.shooter.angle) * 56;
    const startY = this.shooter.y + Math.sin(this.shooter.angle) * 56;
    const endX = startX + Math.cos(this.shooter.angle) * AIM_GUIDE_LENGTH;
    const endY = startY + Math.sin(this.shooter.angle) * AIM_GUIDE_LENGTH;

    ctx.save();
    ctx.setLineDash([9, 10]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(251, 233, 179, 0.42)";
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();
  }

  drawShooter(ctx) {
    const { x, y, angle } = this.shooter;
    const cx = this.frogCacheCx;
    const cy = this.frogCacheCy;

    ctx.save();
    ctx.translate(x, y);

    // --- 1. Ground shadow (stays flat, does not rotate) ---
    ctx.fillStyle = "rgba(18, 21, 24, 0.40)";
    ctx.beginPath();
    ctx.ellipse(0, 42, 56, 14, 0, 0, TAU);
    ctx.fill();

    // --- Rotate entire frog to face the aim direction ---
    ctx.rotate(angle + Math.PI * 0.5);

    // --- Scale down the frog (drawn at large size for detail, shrunk here) ---
    const frogScale = 0.78;
    ctx.scale(frogScale, frogScale);

    // --- 2. Cached layer: body + lower jaw + mouth cavity + belly socket ---
    ctx.drawImage(this.frogCacheBehind, -cx, -cy);

    // --- 3. Live ball inside the mouth (palette/rotation change each frame) ---
    this.drawBall(ctx, 0, -34, BALL_RADIUS, this.currentPaletteIndex, angle * 2.2);

    // --- 4. Cached layer: upper jaw + eyes (overlaps ball top) ---
    ctx.drawImage(this.frogCacheFront, -cx, -cy);

    // --- 5. Live current-ball echo in belly socket (matches mouth ball) ---
    this.drawBall(ctx, 0, 32, BALL_RADIUS - 1, this.currentPaletteIndex, -angle * 1.5);

    ctx.restore();
  }

  // Squat stone-frog body. Green-stone Mayan idol silhouette filled with a
  // moss-toned radial gradient and decorated with carved bands + gold trim.
  drawFrogBody(ctx) {
    // Main body silhouette — squat, wide toad shape
    ctx.beginPath();
    ctx.moveTo(0, -24);
    // right shoulder → haunch (wider, rounder curves)
    ctx.bezierCurveTo(30, -26, 54, -10, 56, 10);
    ctx.bezierCurveTo(56, 28, 46, 42, 34, 46);
    // belly bottom (wider)
    ctx.lineTo(-34, 46);
    // left haunch → shoulder
    ctx.bezierCurveTo(-46, 42, -56, 28, -56, 10);
    ctx.bezierCurveTo(-54, -10, -30, -26, 0, -24);
    ctx.closePath();

    const bodyGrad = ctx.createRadialGradient(-8, 6, 6, 0, 10, 58);
    bodyGrad.addColorStop(0, "#6b8a6e");
    bodyGrad.addColorStop(0.5, "#4a6b4e");
    bodyGrad.addColorStop(1, "#2e4430");
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(20, 36, 22, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Head crest — three small triangular ridges on top (Mayan idol feature)
    ctx.fillStyle = "rgba(82, 120, 84, 0.7)";
    for (const ox of [-14, 0, 14]) {
      ctx.beginPath();
      ctx.moveTo(ox, -24);
      ctx.lineTo(ox - 4, -18);
      ctx.lineTo(ox + 4, -18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(20, 36, 22, 0.3)";
    ctx.lineWidth = 0.8;
    for (const ox of [-14, 0, 14]) {
      ctx.beginPath();
      ctx.moveTo(ox, -24);
      ctx.lineTo(ox - 4, -18);
      ctx.lineTo(ox + 4, -18);
      ctx.closePath();
      ctx.stroke();
    }

    // Carved horizontal bands across the chest (Mayan decorative lines)
    ctx.strokeStyle = "rgba(16, 30, 18, 0.28)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-36, 14);
    ctx.quadraticCurveTo(0, 19, 36, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, 24);
    ctx.quadraticCurveTo(0, 28, 30, 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-22, 33);
    ctx.quadraticCurveTo(0, 36, 22, 33);
    ctx.stroke();

    // Gold ring at the base (sitting on altar)
    ctx.beginPath();
    ctx.ellipse(0, 46, 36, 7, 0, 0, TAU);
    ctx.strokeStyle = "rgba(200, 170, 50, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Front limbs — stone bumps on each side
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.ellipse(side * 46, 32, 13, 8, side * 0.3, 0, TAU);
      const limbGrad = ctx.createRadialGradient(
        side * 44, 30, 2, side * 46, 32, 13,
      );
      limbGrad.addColorStop(0, "#6a826c");
      limbGrad.addColorStop(1, "#3a5038");
      ctx.fillStyle = limbGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(20, 36, 22, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Lower jaw + mouth cavity — drawn BEHIND the ball in the frog cache.
  drawFrogJawBehind(ctx) {
    const headLen = 48;
    const headW = 34;
    const mouthW = 24;
    const ballDist = 34;

    ctx.beginPath();
    ctx.moveTo(-headW, 4);
    ctx.bezierCurveTo(-headW, -14, -mouthW, -headLen + 10, -mouthW + 3, -headLen + 2);
    ctx.lineTo(mouthW - 3, -headLen + 2);
    ctx.bezierCurveTo(mouthW, -headLen + 10, headW, -14, headW, 4);
    ctx.closePath();

    const jawGrad = ctx.createLinearGradient(0, 4, 0, -headLen);
    jawGrad.addColorStop(0, "#5a7a5c");
    jawGrad.addColorStop(1, "#3a5a3c");
    ctx.fillStyle = jawGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(20, 36, 22, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Mouth cavity (wider to match new mouthW)
    ctx.beginPath();
    ctx.ellipse(0, -ballDist, mouthW - 3, 14, 0, 0, TAU);
    ctx.fillStyle = "#0e1a10";
    ctx.fill();
  }

  // Upper jaw / snout + nostrils + gold accents — drawn IN FRONT of the ball.
  drawFrogJawFront(ctx) {
    const headLen = 48;
    const headW = 34;
    const mouthW = 24;

    ctx.beginPath();
    ctx.moveTo(-headW + 2, 2);
    ctx.bezierCurveTo(-headW + 2, -10, -mouthW + 1, -headLen + 14, -mouthW + 5, -headLen + 2);
    ctx.quadraticCurveTo(-3, -headLen - 4, 0, -headLen - 2);
    ctx.quadraticCurveTo(3, -headLen - 4, mouthW - 5, -headLen + 2);
    ctx.bezierCurveTo(mouthW - 1, -headLen + 14, headW - 2, -10, headW - 2, 2);
    ctx.closePath();

    const snoutGrad = ctx.createLinearGradient(0, 2, 0, -headLen);
    snoutGrad.addColorStop(0, "#6a8668");
    snoutGrad.addColorStop(0.6, "#4e6e50");
    snoutGrad.addColorStop(1, "#5a7a5c");
    ctx.fillStyle = snoutGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(20, 36, 22, 0.32)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Nostrils
    ctx.fillStyle = "#1a2c1c";
    ctx.beginPath();
    ctx.arc(-9, -headLen + 6, 2.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9, -headLen + 6, 2.5, 0, TAU);
    ctx.fill();

    // Gold accent lines along jaw edges
    ctx.strokeStyle = "rgba(210, 178, 50, 0.45)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-headW + 5, 0);
    ctx.quadraticCurveTo(-mouthW + 2, -headLen + 14, -mouthW + 6, -headLen + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headW - 5, 0);
    ctx.quadraticCurveTo(mouthW - 2, -headLen + 14, mouthW - 6, -headLen + 4);
    ctx.stroke();

    // Mayan zigzag pattern along snout bridge
    ctx.strokeStyle = "rgba(200, 170, 50, 0.3)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-12, -headLen + 16);
    for (let i = 0; i < 4; i++) {
      const bx = -8 + i * 5;
      ctx.lineTo(bx, -headLen + (i % 2 === 0 ? 13 : 19));
    }
    ctx.stroke();
  }

  // Belly socket only (no ball) — baked into the frog cache.
  drawFrogBellySocket(ctx) {
    ctx.beginPath();
    ctx.arc(0, 32, BALL_RADIUS + 3, 0, TAU);
    ctx.fillStyle = "#1a2c1c";
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 170, 50, 0.5)";
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  // Stone dome eyes — the most iconic part of the Zuma frog. Each eye is a
  // large raised stone hemisphere with a warm golden iris and round pupil.
  // Friendly and calm rather than menacing.
  drawFrogEyes(ctx) {
    const eyeX = 22;
    const eyeY = -20;
    const eyeR = 15;

    for (let side = -1; side <= 1; side += 2) {
      const ex = side * eyeX;

      // Eye dome — green-stone gradient
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeR, 0, TAU);
      const domeGrad = ctx.createRadialGradient(
        ex - 2, eyeY - 3, 2, ex, eyeY, eyeR,
      );
      domeGrad.addColorStop(0, "#7a9a7c");
      domeGrad.addColorStop(0.6, "#4e6e50");
      domeGrad.addColorStop(1, "#344a36");
      ctx.fillStyle = domeGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(20, 36, 22, 0.3)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Gold iris ring — warm but not harsh
      ctx.beginPath();
      ctx.arc(ex, eyeY, 9, 0, TAU);
      ctx.strokeStyle = "rgba(200, 175, 55, 0.75)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Warm amber iris fill (softer gradient)
      ctx.beginPath();
      ctx.arc(ex, eyeY, 7.5, 0, TAU);
      const irisGrad = ctx.createRadialGradient(ex, eyeY, 1, ex, eyeY, 7.5);
      irisGrad.addColorStop(0, "#d4b840");
      irisGrad.addColorStop(0.6, "#b89828");
      irisGrad.addColorStop(1, "#8a7420");
      ctx.fillStyle = irisGrad;
      ctx.fill();

      // Round pupil (friendly, not reptilian slit)
      ctx.beginPath();
      ctx.arc(ex, eyeY, 3.5, 0, TAU);
      ctx.fillStyle = "#12120a";
      ctx.fill();

      // Specular highlight
      ctx.beginPath();
      ctx.arc(ex - 2, eyeY - 2.5, 2.2, 0, TAU);
      ctx.fillStyle = "rgba(255, 252, 225, 0.40)";
      ctx.fill();
    }
  }

  // (drawFrogBellyBall removed — socket is cached, ball drawn live in drawShooter)

  // The top overlay is now a real HUD layer: state, score/combo, next ball and
  // touch-friendly restart all live here instead of temporary prototype text.
  drawOverlay(ctx) {
    // Stone panel backgrounds are pre-rendered; text is drawn live.
    if (!this.hudPanelCache) {
      this.hudPanelCache = document.createElement("canvas");
      this.hudPanelCache.width = GAME_WIDTH;
      this.hudPanelCache.height = 120;
      const hCtx = this.hudPanelCache.getContext("2d");
      this.drawStonePanel(hCtx, 16, 14, 232, 92, 22, {
        top: "#6e7880",
        bottom: "#57626b",
        stroke: "rgba(92, 69, 39, 0.92)",
        innerStroke: "rgba(244, 225, 173, 0.18)",
        shadow: "rgba(12, 15, 18, 0.18)",
      });
      this.drawStonePanel(hCtx, 28, 66, 86, 28, 12, {
        top: "#7a858d",
        bottom: "#616d75",
        stroke: "rgba(86, 64, 37, 0.76)",
        innerStroke: "rgba(246, 229, 183, 0.12)",
        shadow: "rgba(0, 0, 0, 0.1)",
      });
      this.drawStonePanel(hCtx, 120, 66, 118, 28, 12, {
        top: "#7a858d",
        bottom: "#616d75",
        stroke: "rgba(86, 64, 37, 0.76)",
        innerStroke: "rgba(246, 229, 183, 0.12)",
        shadow: "rgba(0, 0, 0, 0.1)",
      });
    }
    ctx.drawImage(this.hudPanelCache, 0, 0);

    ctx.fillStyle = "#f0d57a";
    ctx.font = "600 18px Georgia";
    ctx.fillText("祭坛试炼", 30, 38);

    ctx.fillStyle = "rgba(242, 229, 198, 0.78)";
    ctx.font = "13px Georgia";
    ctx.fillText("石质祭坛 · 青铜机关", 30, 56);

    ctx.fillStyle = "#e8d7ae";
    ctx.font = "600 13px Georgia";
    ctx.fillText(`状态 ${this.getGameStateLabel()}`, 40, 85);
    ctx.fillText(`链长 ${this.chain.length}`, 132, 85);

    ctx.fillStyle = "#f1e5c1";
    ctx.font = "600 13px Georgia";
    ctx.fillText(`分数 ${this.score}`, 30, 103);
    ctx.fillText(this.getComboHudText(), 128, 103);
    this.drawHudNextPreview(ctx);
    this.drawSoundButton(ctx);
    this.drawRestartButton(
      ctx,
      this.getHudRestartButtonRect(),
      "重开",
      this.uiPressAction === "restart" &&
        this.isPointInsideRect(this.pointer.x, this.pointer.y, this.getHudRestartButtonRect()),
    );
  }

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

  // The round-end card doubles as the phone-friendly restart surface until a
  // fuller post-game menu exists.
  drawRoundStateCard(ctx) {
    if (this.gameState === "playing") {
      return;
    }

    ctx.save();
    ctx.fillStyle = "rgba(6, 10, 12, 0.46)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const panelWidth = 266;
    const panelHeight = 164;
    const panelX = (GAME_WIDTH - panelWidth) / 2;
    const panelY = GAME_HEIGHT * 0.115;

    this.drawStonePanel(ctx, panelX, panelY, panelWidth, panelHeight, 26, {
      top: "#707b83",
      bottom: "#59646d",
      stroke:
        this.gameState === "win"
          ? "rgba(124, 92, 47, 0.96)"
          : "rgba(114, 73, 58, 0.96)",
      innerStroke:
        this.gameState === "win"
          ? "rgba(244, 220, 137, 0.26)"
          : "rgba(231, 167, 143, 0.22)",
      shadow: "rgba(8, 10, 12, 0.22)",
    });

    ctx.strokeStyle = "rgba(242, 224, 177, 0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(GAME_WIDTH / 2, panelY + 34, 16, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = "#f0ddb0";
    ctx.textAlign = "center";
    ctx.font = "600 28px Georgia";
    ctx.fillText(this.gameState === "win" ? "祭坛告捷" : "试炼中断", GAME_WIDTH / 2, panelY + 58);

    ctx.fillStyle = "rgba(244, 232, 202, 0.8)";
    ctx.font = "15px Georgia";
    ctx.fillText(
      this.gameState === "win"
        ? `球链已被清空 · 本局得分 ${this.score}`
        : `球链抵达终点 · 本局得分 ${this.score}`,
      GAME_WIDTH / 2,
      panelY + 96,
    );
    ctx.fillText(
      this.bestCombo > 1 ? `最高连击 x${this.bestCombo}` : "本局未触发连击",
      GAME_WIDTH / 2,
      panelY + 118,
    );
    const restartRect = this.getEndCardRestartButtonRect();
    this.drawRestartButton(
      ctx,
      restartRect,
      "重新开始",
      this.uiPressAction === "restart" &&
        this.isPointInsideRect(this.pointer.x, this.pointer.y, restartRect),
    );
    ctx.textAlign = "start";
    ctx.restore();
  }

  // Floating score feedback stays brief, while the persistent HUD keeps the
  // actual score and combo summary visible for longer inspection.
  drawMatchFeedback(ctx) {
    if (!this.matchFeedback) {
      return;
    }

    const fadeWindow = 0.25;
    const alpha =
      this.matchFeedback.timer > fadeWindow
        ? 1
        : Math.max(0, this.matchFeedback.timer / fadeWindow);
    const rise = (1 - Math.min(1, this.matchFeedback.timer / 1.2)) * 18;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";

    this.drawStonePanel(ctx, GAME_WIDTH * 0.5 - 96, 114 - rise, 192, 60, 18, {
      top: "#6f797f",
      bottom: "#5c666e",
      stroke: "rgba(94, 70, 40, 0.9)",
      innerStroke: "rgba(246, 225, 171, 0.2)",
      shadow: "rgba(0, 0, 0, 0.15)",
    });

    ctx.fillStyle = "#f1d680";
    ctx.font = "600 22px Georgia";
    ctx.fillText(`+${this.matchFeedback.scoreDelta}`, GAME_WIDTH * 0.5, 143 - rise);

    ctx.fillStyle = "rgba(244, 229, 189, 0.88)";
    ctx.font = "13px Georgia";
    const detail =
      this.matchFeedback.label || `消除 ${this.matchFeedback.removedCount} 颗`;
    ctx.fillText(detail, GAME_WIDTH * 0.5, 163 - rise);

    ctx.textAlign = "start";
    ctx.restore();
  }

  drawStonePanel(ctx, x, y, width, height, radius, options = {}) {
    const {
      top = "#728087",
      bottom = "#59646c",
      stroke = "rgba(94, 72, 43, 0.88)",
      innerStroke = "rgba(247, 227, 181, 0.16)",
      shadow = "rgba(0, 0, 0, 0.16)",
    } = options;

    ctx.save();

    ctx.fillStyle = shadow;
    this.fillRoundedRect(ctx, x, y + 4, width, height, radius);

    const fill = ctx.createLinearGradient(x, y, x, y + height);
    fill.addColorStop(0, top);
    fill.addColorStop(0.48, bottom);
    fill.addColorStop(1, bottom);
    ctx.fillStyle = fill;
    this.fillRoundedRect(ctx, x, y, width, height, radius);

    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    this.fillRoundedRect(ctx, x + 4, y + 4, width - 8, Math.max(12, height * 0.28), radius - 4);

    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    this.fillRoundedRect(ctx, x, y, width, height, radius);
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = innerStroke;
    this.fillRoundedRect(ctx, x + 3, y + 3, width - 6, height - 6, Math.max(4, radius - 3));
    ctx.stroke();

    ctx.restore();
  }

  drawHudNextPreview(ctx) {
    const rect = this.getHudNextPreviewRect();

    ctx.save();
    this.drawStonePanel(ctx, rect.x, rect.y, rect.w, rect.h, 14, {
      top: "#737f87",
      bottom: "#5f6971",
      stroke: "rgba(90, 67, 39, 0.9)",
      innerStroke: "rgba(247, 228, 187, 0.16)",
      shadow: "rgba(0, 0, 0, 0.16)",
    });

    ctx.strokeStyle = "rgba(228, 193, 108, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rect.x + rect.w / 2, rect.y + 20, 14, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = "rgba(244, 229, 189, 0.78)";
    ctx.font = "9px Georgia";
    ctx.textAlign = "center";
    ctx.fillText("下一个", rect.x + rect.w / 2, rect.y + rect.h - 5);
    this.drawBall(
      ctx,
      rect.x + rect.w / 2,
      rect.y + 20,
      BALL_RADIUS - 2,
      this.nextPaletteIndex,
      -this.shooter.angle * 1.5,
    );
    ctx.textAlign = "start";
    ctx.restore();
  }

  // Small sound toggle button in the HUD. Shows a speaker icon with a slash
  // when muted. Drawn as canvas primitives to avoid external assets.
  drawSoundButton(ctx) {
    const rect = this.getHudSoundButtonRect();
    const isPressed =
      this.uiPressAction === "toggleSound" &&
      this.isPointInsideRect(this.pointer.x, this.pointer.y, rect);

    ctx.save();
    this.drawStonePanel(ctx, rect.x, rect.y, rect.w, rect.h, 14, {
      top: isPressed ? "#876748" : "#94724d",
      bottom: isPressed ? "#64472e" : "#705139",
      stroke: "rgba(242, 217, 151, 0.42)",
      innerStroke: "rgba(255, 240, 210, 0.12)",
      shadow: "rgba(0, 0, 0, 0.18)",
    });

    // Speaker icon (centered in button)
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.translate(cx, cy);

    // Speaker body
    ctx.fillStyle = "#f4e7c3";
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(-2, -4);
    ctx.lineTo(4, -8);
    ctx.lineTo(4, 8);
    ctx.lineTo(-2, 4);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fill();

    if (this.sfx.muted) {
      // Mute slash
      ctx.strokeStyle = "#e85050";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-8, -9);
      ctx.lineTo(8, 9);
      ctx.stroke();
    } else {
      // Sound waves
      ctx.strokeStyle = "#f4e7c3";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(5, 0, 4, -0.6, 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(5, 0, 8, -0.5, 0.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawRestartButton(ctx, rect, label, isPressed = false) {
    ctx.save();

    this.drawStonePanel(ctx, rect.x, rect.y, rect.w, rect.h, 18, {
      top: isPressed ? "#876748" : "#94724d",
      bottom: isPressed ? "#64472e" : "#705139",
      stroke: "rgba(242, 217, 151, 0.42)",
      innerStroke: "rgba(255, 240, 210, 0.12)",
      shadow: "rgba(0, 0, 0, 0.18)",
    });

    ctx.fillStyle = isPressed ? "rgba(54, 35, 20, 0.18)" : "rgba(255, 241, 210, 0.08)";
    this.fillRoundedRect(ctx, rect.x + 5, rect.y + 5, rect.w - 10, Math.max(8, rect.h * 0.36), 13);

    ctx.fillStyle = "#f4e7c3";
    ctx.font = "600 15px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  // Optimized ball renderer. Static gradient layers (body, matte shade, worn
  // bloom, edge strokes) are pre-baked in createBallRenderCache(). Only the
  // rolling band texture is drawn live each frame (it depends on rotation).
  // This reduces per-ball gradient creation from 5 to 0.
  drawBall(ctx, x, y, radius, paletteIndex, rotation, impact = 0) {
    const pattern = this.ballPatterns[paletteIndex];
    const pad = this.ballCachePad;
    const scale = 1 + impact * 0.08;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Impact aura (only when ball is freshly hit — rare, ok to create live)
    if (impact > 0.02) {
      const aura = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 1.55);
      aura.addColorStop(0, "rgba(255, 249, 214, 0)");
      aura.addColorStop(0.55, "rgba(255, 241, 187, 0.18)");
      aura.addColorStop(1, "rgba(255, 241, 187, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.55, 0, TAU);
      ctx.fill();
    }

    // Use cached base if this is the standard ball radius, otherwise fall back
    // to a simple solid fill for non-standard sizes (e.g. preview balls).
    const baseImg = radius === BALL_RADIUS ? this.ballBaseCache[paletteIndex] : null;
    if (baseImg) {
      ctx.drawImage(baseImg, -(radius + pad), -(radius + pad));
    } else {
      const palette = BALL_PALETTES[paletteIndex];
      const body = ctx.createRadialGradient(
        -radius * 0.32, -radius * 0.4, radius * 0.28, 0, 0, radius,
      );
      body.addColorStop(0, palette.bright);
      body.addColorStop(0.54, palette.base);
      body.addColorStop(0.84, palette.base);
      body.addColorStop(1, palette.dark);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();
    }

    // Rolling belt (must be drawn live — rotation changes every frame).
    // The band texture handles its own elliptical clip internally.
    this.drawRollingBandTexture(ctx, pattern, radius, rotation);

    // Overlay shading (cached for standard radius)
    if (radius === BALL_RADIUS && this.ballOverCache) {
      ctx.drawImage(this.ballOverCache, -(radius + pad), -(radius + pad));
    }

    ctx.restore();
  }

  // Rolling belt texture + cached band shading overlay.
  drawRollingBandTexture(ctx, pattern, radius, rotation) {
    const sourceWidth = pattern.width;
    const sourceHeight = pattern.height;
    const sourceY = sourceHeight * 0.18;
    const sourceH = sourceHeight * 0.64;
    const bandWidth = radius * 2.3;
    const bandHeight = radius * 1.42;
    const offset = (((rotation / TAU) % 1 + 1) % 1) * bandWidth;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.98, radius * 0.8, 0, 0, TAU);
    ctx.clip();

    for (let dx = -bandWidth - offset; dx < radius * 1.2; dx += bandWidth) {
      ctx.drawImage(
        pattern, 0, sourceY, sourceWidth, sourceH,
        dx, -bandHeight * 0.5, bandWidth, bandHeight,
      );
    }

    // Band edge shading — use cached canvas instead of creating 2 gradients
    if (radius === BALL_RADIUS && this.bandShadeCache) {
      const bs = this.bandShadeCache;
      ctx.drawImage(bs, -bs.width / 2, -bs.height / 2);
    } else {
      // Fallback for non-standard radius
      const topBottomShade = ctx.createLinearGradient(0, -radius * 0.82, 0, radius * 0.82);
      topBottomShade.addColorStop(0, "rgba(27, 18, 12, 0.22)");
      topBottomShade.addColorStop(0.16, "rgba(19, 12, 8, 0)");
      topBottomShade.addColorStop(0.84, "rgba(19, 12, 8, 0)");
      topBottomShade.addColorStop(1, "rgba(27, 18, 12, 0.24)");
      ctx.fillStyle = topBottomShade;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

      const sideShade = ctx.createLinearGradient(-radius, 0, radius, 0);
      sideShade.addColorStop(0, "rgba(34, 22, 14, 0.17)");
      sideShade.addColorStop(0.16, "rgba(26, 15, 9, 0)");
      sideShade.addColorStop(0.84, "rgba(26, 15, 9, 0)");
      sideShade.addColorStop(1, "rgba(34, 22, 14, 0.18)");
      ctx.fillStyle = sideShade;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    }

    ctx.restore();
  }

  fillRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  strokePath(ctx) {
    ctx.stroke(this.cachedTrackPath);
  }

  getPointAtDistance(s) {
    if (s <= 0) {
      return this.pathPoints[0];
    }

    if (s >= this.totalPathLength) {
      return this.pathPoints[this.pathPoints.length - 1];
    }

    let low = 0;
    let high = this.pathPoints.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.pathPoints[mid].len < s) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const next = this.pathPoints[low];
    const prev = this.pathPoints[Math.max(0, low - 1)];
    const span = next.len - prev.len || 1;
    const t = (s - prev.len) / span;

    // Linear interpolation between neighboring sampled points is enough because
    // the original curve was already oversampled in createPath().
    return {
      x: prev.x + (next.x - prev.x) * t,
      y: prev.y + (next.y - prev.y) * t,
    };
  }

  getClosestPathDistance(x, y) {
    let closest = this.pathPoints[0];
    let bestDistance = Infinity;

    // 采样点数量不大，这里直接线性扫描即可，后续只有路径复杂很多时才需要优化。
    for (const point of this.pathPoints) {
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = point;
      }
    }

    return closest.len;
  }

  getRandomPaletteIndex() {
    // The prototype currently limits itself to the first four colors to keep
    // match density readable while the rules are still being tuned.
    return Math.floor(Math.random() * 4);
  }

  // Catmull-Rom gives us a smooth track through the authored control points
  // without manually defining Bézier tangents.
  catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x:
        0.5 *
        ((2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y:
        0.5 *
        ((2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
  }

  // Generate a horizontally tileable source texture for the rolling belt around
  // each stone ball. This is the current compromise after several experiments:
  // not a tiny center logo, not a fake full-sphere UV, but a broad symbolic
  // band that rotates cleanly on mobile screens.
  createBallPatternCanvas(palette, glyphVariant) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Build the texture as a circumferential band source. The renderer later
    // scrolls the middle belt around the ball. This preserves a wrapped rolling
    // read without bringing back the center-stretch artifact from the earlier
    // pseudo-3D full-sphere projection.
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, size, size);

    const mineral = ctx.createLinearGradient(0, 0, 0, size);
    mineral.addColorStop(0, `${palette.dark}36`);
    mineral.addColorStop(0.24, `${palette.stripeDark.slice(0, -4)}0.18)`);
    mineral.addColorStop(0.5, `${palette.base}14`);
    mineral.addColorStop(0.74, `${palette.stripeLight.slice(0, -4)}0.14)`);
    mineral.addColorStop(1, `${palette.dark}34`);
    ctx.fillStyle = mineral;
    ctx.fillRect(0, 0, size, size);

    // Keep the mineral veining horizontally tile-safe. Any strong diagonal or
    // one-sided gradient makes the seam readable once the band loops around.
    ctx.globalAlpha = 0.18;
    for (let i = -2; i <= 2; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? palette.stripeDark : palette.stripeLight;
      ctx.fillRect(0, size * 0.5 + i * 20 - 4, size, 8);
    }
    ctx.globalAlpha = 1;

    const band = ctx.createLinearGradient(0, size * 0.22, 0, size * 0.78);
    band.addColorStop(0, `${palette.dark}16`);
    band.addColorStop(0.2, `${palette.accent}28`);
    band.addColorStop(0.5, `${palette.stripeLight.slice(0, -4)}0.16)`);
    band.addColorStop(0.8, `${palette.accent}22`);
    band.addColorStop(1, `${palette.dark}16`);
    ctx.fillStyle = band;
    ctx.fillRect(0, size * 0.22, size, size * 0.56);

    ctx.strokeStyle = `${palette.dark}54`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.28);
    ctx.lineTo(size, size * 0.28);
    ctx.moveTo(0, size * 0.72);
    ctx.lineTo(size, size * 0.72);
    ctx.stroke();

    ctx.strokeStyle = `${palette.accent}44`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.39);
    ctx.lineTo(size, size * 0.39);
    ctx.moveTo(0, size * 0.61);
    ctx.lineTo(size, size * 0.61);
    ctx.stroke();

    // Make the glyph span most of the visible front hemisphere. The edge echoes
    // bleed across the seam so the pattern reads as a wrapped symbol belt instead
    // of a small logo sitting on top of the sphere.
    ctx.save();
    ctx.globalAlpha = 0.28;
    this.drawTempleGlyph(ctx, glyphVariant, palette, size, {
      x: -size * 0.5,
      y: size * 0.5,
      scale: 1.78,
      medallion: false,
    });
    this.drawTempleGlyph(ctx, glyphVariant, palette, size, {
      x: size * 1.5,
      y: size * 0.5,
      scale: 1.78,
      medallion: false,
    });
    ctx.restore();

    this.drawTempleGlyph(ctx, glyphVariant, palette, size, {
      x: size * 0.5,
      y: size * 0.5,
      scale: 1.78,
      medallion: false,
    });

    this.makeHorizontalTextureSeamless(ctx, size, size, 10);

    return canvas;
  }

  // Blend both horizontal edges after drawing. Hand-built motifs are rarely
  // perfectly seamless on their own; this post-pass prevents a bright/dark jump
  // when the belt completes a full rotation.
  makeHorizontalTextureSeamless(ctx, width, height, seamWidth) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const original = new Uint8ClampedArray(imageData.data);

    for (let x = 0; x < seamWidth; x += 1) {
      const leftX = x;
      const rightX = width - seamWidth + x;

      for (let y = 0; y < height; y += 1) {
        const leftIndex = (y * width + leftX) * 4;
        const rightIndex = (y * width + rightX) * 4;

        for (let channel = 0; channel < 4; channel += 1) {
          const mixed = Math.round(
            (original[leftIndex + channel] + original[rightIndex + channel]) * 0.5,
          );
          imageData.data[leftIndex + channel] = mixed;
          imageData.data[rightIndex + channel] = mixed;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // Draw a single glyph family. These marks are intentionally softer than HUD
  // icons: on the moving ball they should read like carved ornament lines in
  // stone, not like sharp vector logos pasted on the surface.
  drawTempleGlyph(ctx, variant, palette, size, options = {}) {
    const {
      x = 0,
      y = 0,
      scale = 1,
      medallion = true,
    } = options;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const bronzeFill = "rgba(223, 191, 112, 0.28)";
    const bronzeStroke = "rgba(104, 73, 35, 0.54)";
    const paleStroke = "rgba(249, 236, 190, 0.12)";

    if (medallion) {
      // Shared medallion base is useful for HUD-scale rendering, but inside the
      // rolling belt it reads like a flat coin sticker, so callers can disable it.
      ctx.fillStyle = "rgba(43, 31, 17, 0.28)";
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = "rgba(224, 191, 112, 0.24)";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, TAU);
      ctx.stroke();
    }

    if (variant === "scarab") {
      ctx.fillStyle = bronzeFill;
      ctx.beginPath();
      ctx.ellipse(0, 2, 12, 16, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "rgba(238, 212, 141, 0.2)";
      ctx.beginPath();
      ctx.ellipse(-12, 0, 10, 7, -0.38, 0, TAU);
      ctx.ellipse(12, 0, 10, 7, 0.38, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = bronzeStroke;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 2, 12, 16, 0, 0, TAU);
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 14);
      ctx.moveTo(-16, -4);
      ctx.quadraticCurveTo(-8, -14, 0, -10);
      ctx.moveTo(16, -4);
      ctx.quadraticCurveTo(8, -14, 0, -10);
      ctx.stroke();
    } else if (variant === "eye") {
      ctx.strokeStyle = bronzeStroke;
      ctx.lineWidth = 3.3;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.quadraticCurveTo(0, -16, 22, 0);
      ctx.quadraticCurveTo(0, 16, -22, 0);
      ctx.stroke();

      ctx.fillStyle = bronzeFill;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = paleStroke;
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.arc(0, 0, 13, -0.9, 0.9);
      ctx.stroke();

      ctx.strokeStyle = bronzeStroke;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(-6, 10);
      ctx.quadraticCurveTo(-12, 18, -20, 19);
      ctx.moveTo(6, 9);
      ctx.quadraticCurveTo(14, 12, 20, 8);
      ctx.stroke();
    } else if (variant === "sun") {
      ctx.fillStyle = bronzeFill;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = bronzeStroke;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = "rgba(240, 214, 133, 0.26)";
      ctx.lineWidth = 2.1;
      for (let i = 0; i < 8; i += 1) {
        const angle = (TAU / 8) * i + Math.PI / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
        ctx.lineTo(Math.cos(angle) * 28, Math.sin(angle) * 28);
        ctx.stroke();
      }
    } else if (variant === "mask") {
      ctx.fillStyle = bronzeFill;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.quadraticCurveTo(14, -15, 16, -2);
      ctx.quadraticCurveTo(18, 18, 0, 22);
      ctx.quadraticCurveTo(-18, 18, -16, -2);
      ctx.quadraticCurveTo(-14, -15, 0, -18);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = bronzeStroke;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-2, -1);
      ctx.moveTo(8, -4);
      ctx.lineTo(2, -1);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 10);
      ctx.moveTo(-7, 14);
      ctx.quadraticCurveTo(0, 18, 7, 14);
      ctx.stroke();
    } else if (variant === "ankh") {
      ctx.strokeStyle = bronzeStroke;
      ctx.lineWidth = 3.3;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.quadraticCurveTo(-11, -21, -11, -9);
      ctx.quadraticCurveTo(-11, 2, 0, 4);
      ctx.quadraticCurveTo(11, 2, 11, -9);
      ctx.quadraticCurveTo(11, -21, 0, -22);
      ctx.moveTo(0, 4);
      ctx.lineTo(0, 23);
      ctx.moveTo(-13, 12);
      ctx.lineTo(13, 12);
      ctx.stroke();

      ctx.strokeStyle = paleStroke;
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.arc(0, -8, 8, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
    }

    ctx.restore();
  }
}

window.addEventListener("load", () => {
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) {
    return;
  }

  new ZumaGame(canvas);
});
