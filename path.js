import { GAME_WIDTH, TAU } from './config.js';

// Build the track geometry. pathType selects the curve family; pathParams
// tunes it. Returns { pathPoints, totalPathLength, cachedTrackPath }.
export function createPath(shooterX, shooterY, pathType = "spiral", pathParams = {}) {
  let sampled;

  switch (pathType) {
    case "spiral":
      sampled = generateSpiralPath(shooterX, shooterY, pathParams);
      break;
    case "serpentine":
      sampled = generateSerpentinePath(shooterX, shooterY, pathParams);
      break;
    case "rectangular":
      sampled = generateRectangularPath(shooterX, shooterY, pathParams);
      break;
    case "zigzag":
      sampled = generateZigzagPath(shooterX, shooterY, pathParams);
      break;
    default:
      sampled = generateSpiralPath(shooterX, shooterY, pathParams);
      break;
  }

  return finalizePath(sampled);
}

// Shared post-processing: compute cumulative arc lengths and build Path2D cache.
function finalizePath(sampled) {
  let total = 0;
  const pathPoints = sampled.map((point, index) => {
    if (index > 0) {
      const prev = sampled[index - 1];
      total += Math.hypot(point.x - prev.x, point.y - prev.y);
    }
    return { x: point.x, y: point.y, len: total };
  });

  const totalPathLength = total;

  const cachedTrackPath = new Path2D();
  cachedTrackPath.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i += 1) {
    cachedTrackPath.lineTo(pathPoints[i].x, pathPoints[i].y);
  }

  return { pathPoints, totalPathLength, cachedTrackPath };
}

// Archimedean spiral with off-screen entry segment — the original path type.
function generateSpiralPath(shooterX, shooterY, params = {}) {
  const centerX = (params.centerX ?? shooterX) + 11;
  const centerY = (params.centerY ?? shooterY) + 8;
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

  // Off-screen entry segment (cubic Bezier approach joining the spiral tangentially)
  const joinPoint = spiralPoints[0];
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
  const entryY = topY - 20;
  sampled.push({ x: GAME_WIDTH + 96, y: entryY });
  sampled.push({ x: GAME_WIDTH + 40, y: entryY });
  sampled.push({ x: centerX + amplitude + 20, y: entryY });

  for (let c = 0; c < curves; c++) {
    const startY = topY + (c / curves) * verticalSpan;
    const endY = topY + ((c + 1) / curves) * verticalSpan;
    const direction = c % 2 === 0 ? 1 : -1;

    for (let s = 0; s <= samplePerCurve; s++) {
      const t = s / samplePerCurve;
      const y = startY + (endY - startY) * t;
      const x = centerX + direction * amplitude * Math.sin(t * Math.PI);
      sampled.push({ x, y });
    }
  }

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
  sampled.push({ x: GAME_WIDTH + 96, y: startY });
  sampled.push({ x: startX, y: startY });

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
  sampled.push({ x: GAME_WIDTH + 96, y: topY });
  sampled.push({ x: right + 20, y: topY });

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
