import { GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, BOTTOM_BUTTON_HEIGHT, TAU } from './config.js';

// Returns true if the point already sits outside the playable area, meaning
// the path author has already placed the start off-screen (or inside the HUD
// / bottom-button strips, which are visually reserved for UI) and no
// auto-generated entry segment is needed. The editor paints those strips as
// obstructed zones, so the game treats them the same as being fully off-canvas.
function isOffscreen(pt) {
  return (
    pt.x > GAME_WIDTH ||
    pt.x < 0 ||
    pt.y < HUD_HEIGHT ||
    pt.y > GAME_HEIGHT - BOTTOM_BUTTON_HEIGHT
  );
}

// Build the track geometry. pathType selects the curve family; pathParams
// tunes it. Returns { pathPoints, totalPathLength, cachedTrackPath }.
export function createPath(shooterX, shooterY, pathType = "spiral", pathParams = {}) {
  let generated;

  switch (pathType) {
    case "spiral":
      generated = generateSpiralPath(shooterX, shooterY, pathParams);
      break;
    case "serpentine":
      generated = generateSerpentinePath(shooterX, shooterY, pathParams);
      break;
    case "rectangular":
      generated = generateRectangularPath(shooterX, shooterY, pathParams);
      break;
    case "zigzag":
      generated = generateZigzagPath(shooterX, shooterY, pathParams);
      break;
    case "openArc":
      generated = generateOpenArcPath(shooterX, shooterY, pathParams);
      break;
    case "bezier":
    case "quadratic":
      generated = generateBezierPath(shooterX, shooterY, pathParams);
      break;
    case "cubic":
      generated = generateCubicBezierPath(shooterX, shooterY, pathParams);
      break;
    case "drawn":
      generated = generateDrawnPath(shooterX, shooterY, pathParams);
      break;
    default:
      generated = generateSpiralPath(shooterX, shooterY, pathParams);
      break;
  }

  return finalizePath(generated);
}

// Shared post-processing: compute cumulative arc lengths and build Path2D cache.
function finalizePath(generated) {
  const sampled = Array.isArray(generated) ? generated : (generated?.sampled ?? []);
  let total = 0;
  const pathPoints = sampled.map((point, index) => {
    if (index > 0) {
      const prev = sampled[index - 1];
      total += Math.hypot(point.x - prev.x, point.y - prev.y);
    }
    return { x: point.x, y: point.y, len: total };
  });

  const totalPathLength = total;

  if (pathPoints.length === 0) {
    return {
      pathPoints: [],
      totalPathLength: 0,
      cachedTrackPath: new Path2D(),
    };
  }

  if (!Array.isArray(generated) && generated?.renderPath) {
    return {
      pathPoints,
      totalPathLength,
      cachedTrackPath: generated.renderPath,
    };
  }

  // Build a smooth rendering path using Catmull-Rom interpolation between
  // sampled points.  The original pathPoints (used for marble positioning)
  // stay untouched — only the visual Path2D gets the extra smoothing.
  const SMOOTH_SUBDIV = 4; // sub-steps between each pair of original samples
  const cachedTrackPath = new Path2D();
  cachedTrackPath.moveTo(pathPoints[0].x, pathPoints[0].y);

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const p0 = pathPoints[Math.max(0, i - 1)];
    const p1 = pathPoints[i];
    const p2 = pathPoints[Math.min(pathPoints.length - 1, i + 1)];
    const p3 = pathPoints[Math.min(pathPoints.length - 1, i + 2)];

    for (let s = 1; s <= SMOOTH_SUBDIV; s++) {
      const t = s / SMOOTH_SUBDIV;
      const pt = catmullRom(p0, p1, p2, p3, t);
      cachedTrackPath.lineTo(pt.x, pt.y);
    }
  }

  return { pathPoints, totalPathLength, cachedTrackPath };
}

// Archimedean spiral with off-screen entry segment — the original path type.
function generateSpiralPath(shooterX, shooterY, params = {}) {
  const centerX = params.centerX ?? (shooterX + 11);
  const centerY = params.centerY ?? (shooterY + 8);
  const outerRadius = params.outerRadius ?? 206;
  const innerRadius = params.innerRadius ?? 84;
  const startAngle = params.startAngle ?? 0.96;
  const turnCount = params.turnCount ?? 2.6;
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

  // Off-screen entry segment (cubic Bezier approach joining the spiral tangentially).
  // Skip it entirely if the author already placed the start outside the play area.
  const joinPoint = spiralPoints[0];
  if (isOffscreen(joinPoint)) return spiralPoints;
  const nextPoint = spiralPoints[1];
  const tangentLength = Math.hypot(
    nextPoint.x - joinPoint.x,
    nextPoint.y - joinPoint.y,
  ) || 1;
  const tangentX = (nextPoint.x - joinPoint.x) / tangentLength;
  const tangentY = (nextPoint.y - joinPoint.y) / tangentLength;

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
  return sampled;
}

// Open arc path — a mobile-friendly sweeping curve that wraps around the
// center play area without enclosing the shooter.
function generateOpenArcPath(shooterX, shooterY, params = {}) {
  const centerX = params.centerX ?? GAME_WIDTH / 2;
  const centerY = params.centerY ?? shooterY - 340;
  const outerRadiusX = params.outerRadiusX ?? 176;
  const outerRadiusY = params.outerRadiusY ?? 204;
  const innerRadiusX = params.innerRadiusX ?? 96;
  const innerRadiusY = params.innerRadiusY ?? 118;
  const startAngle = params.startAngle ?? -0.2 * Math.PI;
  const endAngle = params.endAngle ?? 1.25 * Math.PI;
  const sampleCount = params.sampleCount ?? 360;

  const arcPoints = [];
  for (let step = 0; step <= sampleCount; step += 1) {
    const t = step / sampleCount;
    const angle = startAngle + (endAngle - startAngle) * t;
    const radiusX = outerRadiusX + (innerRadiusX - outerRadiusX) * t;
    const radiusY = outerRadiusY + (innerRadiusY - outerRadiusY) * t;
    arcPoints.push({
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    });
  }

  const joinPoint = arcPoints[0];
  if (isOffscreen(joinPoint)) return arcPoints;
  const nextPoint = arcPoints[1];
  const tangentLength = Math.hypot(
    nextPoint.x - joinPoint.x,
    nextPoint.y - joinPoint.y,
  ) || 1;
  const tangentX = (nextPoint.x - joinPoint.x) / tangentLength;
  const tangentY = (nextPoint.y - joinPoint.y) / tangentLength;

  const entryStart = {
    x: GAME_WIDTH + 96,
    y: joinPoint.y + 12,
  };
  const entryControl1 = {
    x: GAME_WIDTH + 40,
    y: joinPoint.y + 10,
  };
  const entryControl2 = {
    x: joinPoint.x - tangentX * 108,
    y: joinPoint.y - tangentY * 108,
  };

  const sampled = [];
  const entrySampleCount = 52;
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

  sampled.push(...arcPoints);
  return sampled;
}

// S-shaped serpentine path — the track weaves horizontally back and forth
// down the screen. Each curve is a half-sine wave.
function generateSerpentinePath(shooterX, shooterY, params = {}) {
  const curves = params.curves ?? 5;
  const amplitude = params.amplitude ?? 140;
  const verticalSpan = params.verticalSpan ?? 700;
  const topY = params.topY ?? 100;
  const centerX = params.centerX ?? GAME_WIDTH / 2;
  const samplePerCurve = 80;

  const sampled = [];
  const firstCurveStartY = topY;
  const firstDirection = 1;
  const firstPeakX = centerX + firstDirection * amplitude;

  // Build the main serpentine first — we need its start point to decide
  // whether to prepend an off-screen entry segment.
  const bodyStart = [];
  for (let c = 0; c < curves; c++) {
    const startY = topY + (c / curves) * verticalSpan;
    const endY = topY + ((c + 1) / curves) * verticalSpan;
    const direction = c % 2 === 0 ? 1 : -1;

    for (let s = 0; s <= samplePerCurve; s++) {
      const t = s / samplePerCurve;
      const y = startY + (endY - startY) * t;
      const x = centerX + direction * amplitude * Math.sin(t * Math.PI);
      bodyStart.push({ x, y });
    }
  }

  // Skip the auto entry segment entirely if the author placed the start
  // outside the play area (HUD / bottom-button strips, or off-canvas).
  if (bodyStart.length > 0 && isOffscreen(bodyStart[0])) {
    return bodyStart;
  }

  const entryY = topY - 20;
  sampled.push({ x: GAME_WIDTH + 96, y: entryY });

  // Smooth entry: curve from off-screen into the first sine wave
  const entrySteps = 40;
  for (let s = 0; s <= entrySteps; s++) {
    const t = s / entrySteps;
    const y = entryY + (firstCurveStartY - entryY) * t;
    // Ease into the sine amplitude so the entry blends naturally
    const easedAmp = amplitude * Math.sin(t * Math.PI * 0.5);
    const x = centerX + firstDirection * easedAmp * Math.sin(t * Math.PI * 0.5);
    sampled.push({ x, y });
  }

  sampled.push(...bodyStart);
  return sampled;
}

// Rectangular spiral path — the track spirals inward in rounded rectangles.
function generateRectangularPath(shooterX, shooterY, params = {}) {
  const rings = params.rings ?? 3;
  const outerW = params.outerW ?? 360;
  const outerH = params.outerH ?? 700;
  const shrink = params.shrink ?? 60;
  const cornerRadius = params.cornerRadius ?? 40;
  const topY = params.topY ?? 100;
  const centerX = params.centerX ?? GAME_WIDTH / 2;
  const samplesPerSide = 40;
  const samplesPerCorner = 16;

  const sampled = [];
  const startX = centerX + outerW / 2 + 50;
  const startY = topY;
  // Skip the auto entry segment if the author pushed the rectangular body's
  // top edge into the HUD / button strips (or off-canvas vertically). We
  // intentionally don't inspect startX here because it's the off-screen
  // approach coordinate and is always outside [0, GAME_WIDTH].
  const skipEntry =
    startY < HUD_HEIGHT || startY > GAME_HEIGHT - BOTTOM_BUTTON_HEIGHT;
  if (!skipEntry) {
    sampled.push({ x: GAME_WIDTH + 96, y: startY });
    sampled.push({ x: startX, y: startY });
  }

  for (let ring = 0; ring < rings; ring++) {
    const w = outerW - ring * shrink * 2;
    const h = outerH - ring * shrink * 2;
    if (w < 60 || h < 60) break;

    const left = centerX - w / 2;
    const right = centerX + w / 2;
    const top = topY + ring * shrink;
    const bottom = top + h;
    const r = Math.min(cornerRadius, w / 4, h / 4);

    const cw = ring % 2 === 0;

    const segments = cw ? [
      { type: "line", from: { x: right - r, y: top }, to: { x: left + r, y: top } },
      { type: "corner", cx: left + r, cy: top + r, startA: -Math.PI / 2, endA: Math.PI, r },
      { type: "line", from: { x: left, y: top + r }, to: { x: left, y: bottom - r } },
      { type: "corner", cx: left + r, cy: bottom - r, startA: Math.PI, endA: Math.PI / 2, r },
      { type: "line", from: { x: left + r, y: bottom }, to: { x: right - r, y: bottom } },
      { type: "corner", cx: right - r, cy: bottom - r, startA: Math.PI / 2, endA: 0, r },
      { type: "line", from: { x: right, y: bottom - r }, to: { x: right, y: top + r + (ring < rings - 1 ? shrink : 0) } },
      { type: "corner", cx: right - r, cy: top + r + (ring < rings - 1 ? shrink : 0), startA: 0, endA: -Math.PI / 2, r },
    ] : [
      { type: "line", from: { x: left + r, y: top }, to: { x: right - r, y: top } },
      { type: "corner", cx: right - r, cy: top + r, startA: -Math.PI / 2, endA: 0, r },
      { type: "line", from: { x: right, y: top + r }, to: { x: right, y: bottom - r } },
      { type: "corner", cx: right - r, cy: bottom - r, startA: 0, endA: Math.PI / 2, r },
      { type: "line", from: { x: right - r, y: bottom }, to: { x: left + r, y: bottom } },
      { type: "corner", cx: left + r, cy: bottom - r, startA: Math.PI / 2, endA: Math.PI, r },
      { type: "line", from: { x: left, y: bottom - r }, to: { x: left, y: top + r + (ring < rings - 1 ? shrink : 0) } },
      { type: "corner", cx: left + r, cy: top + r + (ring < rings - 1 ? shrink : 0), startA: Math.PI, endA: -Math.PI / 2, r: Math.min(r, shrink / 2) },
    ];

    for (const seg of segments) {
      if (seg.type === "line") {
        for (let s = 0; s <= samplesPerSide; s++) {
          const t = s / samplesPerSide;
          sampled.push({
            x: seg.from.x + (seg.to.x - seg.from.x) * t,
            y: seg.from.y + (seg.to.y - seg.from.y) * t,
          });
        }
      } else {
        const angSpan = seg.endA - seg.startA;
        for (let s = 0; s <= samplesPerCorner; s++) {
          const t = s / samplesPerCorner;
          const a = seg.startA + angSpan * t;
          sampled.push({
            x: seg.cx + Math.cos(a) * seg.r,
            y: seg.cy + Math.sin(a) * seg.r,
          });
        }
      }
    }
  }

  return sampled;
}

// Zigzag path — the track goes left-right in sharp switchbacks down the screen.
function generateZigzagPath(shooterX, shooterY, params = {}) {
  const rows = params.rows ?? 7;
  const marginX = params.marginX ?? 40;
  const topY = params.topY ?? 80;
  const rowHeight = params.rowHeight ?? 100;
  const turnRadius = params.turnRadius ?? 36;
  const samplesPerRow = 50;
  const samplesPerTurn = 20;

  const left = marginX;
  const right = GAME_WIDTH - marginX;

  const sampled = [];
  // Skip the auto entry segment if the author pushed the first zigzag row
  // into the HUD / button strips (or off-canvas vertically). We only inspect
  // y — the entry approach x is always outside [0, GAME_WIDTH] by design.
  const skipEntry =
    topY < HUD_HEIGHT || topY > GAME_HEIGHT - BOTTOM_BUTTON_HEIGHT;
  if (!skipEntry) {
    sampled.push({ x: GAME_WIDTH + 96, y: topY });
    sampled.push({ x: right + 20, y: topY });
  }

  for (let row = 0; row < rows; row++) {
    const y = topY + row * rowHeight;
    const goingLeft = row % 2 === 0;

    const fromX = goingLeft ? right : left;
    const toX = goingLeft ? left : right;
    for (let s = 0; s <= samplesPerRow; s++) {
      const t = s / samplesPerRow;
      sampled.push({ x: fromX + (toX - fromX) * t, y });
    }

    if (row < rows - 1) {
      const turnCX = toX;
      const nextY = y + rowHeight;
      const midY = (y + nextY) / 2;
      const turnR = Math.min(turnRadius, rowHeight / 2);

      for (let s = 1; s <= samplesPerTurn; s++) {
        const t = s / samplesPerTurn;
        const angle = goingLeft
          ? -Math.PI / 2 + t * Math.PI
          : Math.PI / 2 - t * Math.PI;
        sampled.push({
          x: turnCX + Math.cos(angle) * turnR * (goingLeft ? -1 : 1),
          y: midY + Math.sin(angle) * (rowHeight / 2 - turnR) + Math.sin(t * Math.PI) * turnR,
        });
      }
    }
  }

  return sampled;
}

export function getPointAtDistance(pathPoints, totalPathLength, s) {
  if (s <= 0) {
    return pathPoints[0];
  }

  if (s >= totalPathLength) {
    return pathPoints[pathPoints.length - 1];
  }

  let low = 0;
  let high = pathPoints.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (pathPoints[mid].len < s) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const next = pathPoints[low];
  const prev = pathPoints[Math.max(0, low - 1)];
  const span = next.len - prev.len || 1;
  const t = (s - prev.len) / span;

  // Linear interpolation between neighboring sampled points is enough because
  // the original curve was already oversampled in createPath().
  return {
    x: prev.x + (next.x - prev.x) * t,
    y: prev.y + (next.y - prev.y) * t,
  };
}

export function getClosestPathDistance(pathPoints, x, y) {
  let closest = pathPoints[0];
  let bestDistance = Infinity;

  // 采样点数量不大，这里直接线性扫描即可，后续只有路径复杂很多时才需要优化。
  for (const point of pathPoints) {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = point;
    }
  }

  return closest.len;
}

// Catmull-Rom gives us a smooth track through the authored control points
// without manually defining Bézier tangents.
export function catmullRom(p0, p1, p2, p3, t) {
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

// Bezier path — quadratic Bezier curves defined by a control point array.
// pathParams.points format: [p1, cp, p2, p1, cp, p2, ...] — every curve
// always stores 3 points (no dedup). Curves can be connected or independent.
// The sampler skips duplicate adjacent sample points to keep the dense array clean.
function generateBezierPath(shooterX, shooterY, params = {}) {
  const points = params.points ?? [];
  if (points.length < 3) return [];

  const SAMPLES_PER_CURVE = 50;
  const allPoints = [];
  const firstPoint = points[0];
  const renderPath = new Path2D();
  let renderStarted = false;
  let lastRenderPoint = null;

  if (!isOffscreen(firstPoint)) {
    renderPath.moveTo(GAME_WIDTH + 100, firstPoint.y);
    renderPath.lineTo(firstPoint.x, firstPoint.y);
    renderStarted = true;
    lastRenderPoint = firstPoint;
  }

  for (let idx = 0; idx + 2 < points.length; idx += 3) {
    const p1 = points[idx];
    const cp = points[idx + 1];
    const p2 = points[idx + 2];

     if (!renderStarted) {
      renderPath.moveTo(p1.x, p1.y);
      renderStarted = true;
    } else if (!lastRenderPoint || Math.hypot(p1.x - lastRenderPoint.x, p1.y - lastRenderPoint.y) > 0.5) {
      renderPath.lineTo(p1.x, p1.y);
    }
    renderPath.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y);
    lastRenderPoint = p2;

    for (let s = 0; s <= SAMPLES_PER_CURVE; s++) {
      const t = s / SAMPLES_PER_CURVE;
      const inv = 1 - t;
      const pt = {
        x: inv * inv * p1.x + 2 * inv * t * cp.x + t * t * p2.x,
        y: inv * inv * p1.y + 2 * inv * t * cp.y + t * t * p2.y,
      };
      // Skip duplicates: if this point is within 1px of the previous one, drop it
      if (allPoints.length > 0) {
        const prev = allPoints[allPoints.length - 1];
        if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < 1) continue;
      }
      allPoints.push(pt);
    }
  }

  // Off-screen entry segment: horizontal line from right edge.
  // Skip it entirely if the author already placed the start off-screen.
  if (allPoints.length > 0) {
    const first = allPoints[0];
    if (isOffscreen(first)) {
      return { sampled: allPoints, renderPath };
    }
    const entryStart = { x: GAME_WIDTH + 100, y: first.y };
    const en = 40;
    const entryPts = [];
    for (let s = 0; s <= en; s++) {
      const t = s / en;
      entryPts.push({
        x: entryStart.x + (first.x - entryStart.x) * t,
        y: first.y,
      });
    }
    return { sampled: [...entryPts, ...allPoints], renderPath };
  }

  return { sampled: allPoints, renderPath };
}

// Cubic Bezier path — cubic Bezier curves defined by a 4-point-per-curve array.
// pathParams.points format: [p1, cp1, cp2, p2, p1, cp1, cp2, p2, ...] — every
// curve always stores 4 points (no dedup across segments). Neighbouring curves
// typically share the anchor (prev.p2 == next.p1) for continuity, but the
// sampler accepts any layout. Mirrors generateBezierPath's behavior: dense
// sampling + 1px dedup + off-screen horizontal entry segment.
function generateCubicBezierPath(shooterX, shooterY, params = {}) {
  const points = params.points ?? [];
  if (points.length < 4) return [];

  const SAMPLES_PER_CURVE = 50;
  const allPoints = [];
  const firstPoint = points[0];
  const renderPath = new Path2D();
  let renderStarted = false;
  let lastRenderPoint = null;

  if (!isOffscreen(firstPoint)) {
    renderPath.moveTo(GAME_WIDTH + 100, firstPoint.y);
    renderPath.lineTo(firstPoint.x, firstPoint.y);
    renderStarted = true;
    lastRenderPoint = firstPoint;
  }

  for (let idx = 0; idx + 3 < points.length; idx += 4) {
    const p1 = points[idx];
    const cp1 = points[idx + 1];
    const cp2 = points[idx + 2];
    const p2 = points[idx + 3];

    if (!renderStarted) {
      renderPath.moveTo(p1.x, p1.y);
      renderStarted = true;
    } else if (!lastRenderPoint || Math.hypot(p1.x - lastRenderPoint.x, p1.y - lastRenderPoint.y) > 0.5) {
      renderPath.lineTo(p1.x, p1.y);
    }
    renderPath.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y);
    lastRenderPoint = p2;

    for (let s = 0; s <= SAMPLES_PER_CURVE; s++) {
      const t = s / SAMPLES_PER_CURVE;
      const inv = 1 - t;
      const inv2 = inv * inv;
      const t2 = t * t;
      const pt = {
        x: inv2 * inv * p1.x + 3 * inv2 * t * cp1.x + 3 * inv * t2 * cp2.x + t2 * t * p2.x,
        y: inv2 * inv * p1.y + 3 * inv2 * t * cp1.y + 3 * inv * t2 * cp2.y + t2 * t * p2.y,
      };
      // Skip duplicates: if this point is within 1px of the previous one, drop it
      if (allPoints.length > 0) {
        const prev = allPoints[allPoints.length - 1];
        if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < 1) continue;
      }
      allPoints.push(pt);
    }
  }

  // Off-screen entry segment: horizontal line from right edge. Skip if the
  // author already placed the start off-screen.
  if (allPoints.length > 0) {
    const first = allPoints[0];
    if (isOffscreen(first)) {
      return { sampled: allPoints, renderPath };
    }
    const entryStart = { x: GAME_WIDTH + 100, y: first.y };
    const en = 40;
    const entryPts = [];
    for (let s = 0; s <= en; s++) {
      const t = s / en;
      entryPts.push({
        x: entryStart.x + (first.x - entryStart.x) * t,
        y: first.y,
      });
    }
    return { sampled: [...entryPts, ...allPoints], renderPath };
  }

  return { sampled: allPoints, renderPath };
}

// Drawn path — free combination of lines, arcs, and circles.
// pathParams.segments is an array of segment objects:
//   line:   { type:"line", x1, y1, x2, y2 }
//   arc:    { type:"arc", cx, cy, radius, startAngle, endAngle }
//   circle: { type:"circle", cx, cy, radius, startAngle, turns }
function generateDrawnPath(shooterX, shooterY, params = {}) {
  const segments = params.segments ?? [];
  const SAMPLES_PER_PX = 2;
  const allPoints = [];
  let prevEnd = null;

  for (const seg of segments) {
    let segPoints = [];

    if (seg.type === "line") {
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const len = Math.hypot(dx, dy);
      const n = Math.max(2, Math.round(len * SAMPLES_PER_PX));
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        segPoints.push({ x: seg.x1 + dx * t, y: seg.y1 + dy * t });
      }
    } else if (seg.type === "arc") {
      const { cx, cy, radius, startAngle, endAngle } = seg;
      const span = endAngle - startAngle;
      const n = Math.max(4, Math.round(Math.abs(span) * radius * SAMPLES_PER_PX * 0.3));
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const a = startAngle + span * t;
        segPoints.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
      }
    } else if (seg.type === "circle") {
      const { cx, cy, radius, startAngle, turns } = seg;
      const totalAngle = turns * TAU;
      const n = Math.max(8, Math.round(Math.abs(totalAngle) * radius * SAMPLES_PER_PX * 0.3));
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const a = startAngle + totalAngle * t;
        segPoints.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
      }
    }

    // Auto-connect: snap small gaps, bridge large gaps
    if (prevEnd && segPoints.length > 0) {
      const segStart = segPoints[0];
      const gap = Math.hypot(segStart.x - prevEnd.x, segStart.y - prevEnd.y);
      if (gap < 15) {
        // Small gap: snap first point to prevEnd
        segPoints[0] = { x: prevEnd.x, y: prevEnd.y };
      } else {
        // Large gap: bridge with a line
        const bridgeN = Math.max(2, Math.round(gap * SAMPLES_PER_PX));
        for (let s = 1; s <= bridgeN; s++) {
          const t = s / bridgeN;
          allPoints.push({
            x: prevEnd.x + (segStart.x - prevEnd.x) * t,
            y: prevEnd.y + (segStart.y - prevEnd.y) * t,
          });
        }
      }
    }

    // Deduplicate first point if it matches previous end
    if (allPoints.length > 0 && segPoints.length > 0) {
      const last = allPoints[allPoints.length - 1];
      const first = segPoints[0];
      if (Math.hypot(last.x - first.x, last.y - first.y) < 2) {
        segPoints = segPoints.slice(1);
      }
    }
    allPoints.push(...segPoints);

    if (allPoints.length > 0) {
      prevEnd = allPoints[allPoints.length - 1];
    }
  }

  // Add off-screen entry segment: horizontal line from right edge.
  // Skip it entirely if the author already placed the start off-screen.
  if (allPoints.length > 0) {
    const first = allPoints[0];
    if (isOffscreen(first)) return allPoints;
    const entryStart = { x: GAME_WIDTH + 100, y: first.y };
    const en = 40;
    const entryPts = [];
    for (let s = 0; s <= en; s++) {
      const t = s / en;
      entryPts.push({
        x: entryStart.x + (first.x - entryStart.x) * t,
        y: first.y,
      });
    }
    return [...entryPts, ...allPoints];
  }

  return allPoints;
}
