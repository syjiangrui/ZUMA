import { GAME_WIDTH, TAU } from './config.js';

// Build the track geometry. pathType selects the curve family; pathParams
// tunes it. Returns { pathPoints, totalPathLength, cachedTrackPath }.
export function createPath(shooterX, shooterY, pathType = "spiral", pathParams = {}) {
  let sampled;

  switch (pathType) {
    case "spiral":
      sampled = generateSpiralPath(shooterX, shooterY, pathParams);
      break;
    // Future path types will be added here (serpentine, rectangular, zigzag).
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
