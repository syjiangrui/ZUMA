function clonePoint(pt) {
  return { x: Number(pt.x), y: Number(pt.y) };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function dedupeAdjacent(points, minDist = 0.75) {
  const out = [];
  for (const raw of points) {
    const pt = clonePoint(raw);
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
    if (out.length === 0 || distance(out[out.length - 1], pt) >= minDist) {
      out.push(pt);
    }
  }
  return out;
}

export function sampleQuadraticBezier(p1, cp, p2, numSamples = 50) {
  const points = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const inv = 1 - t;
    points.push({
      x: inv * inv * p1.x + 2 * inv * t * cp.x + t * t * p2.x,
      y: inv * inv * p1.y + 2 * inv * t * cp.y + t * t * p2.y,
    });
  }
  return points;
}

export function sampleCubicBezier(p1, cp1, cp2, p2, numSamples = 50) {
  const points = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const inv = 1 - t;
    const inv2 = inv * inv;
    const t2 = t * t;
    points.push({
      x: inv2 * inv * p1.x + 3 * inv2 * t * cp1.x + 3 * inv * t2 * cp2.x + t2 * t * p2.x,
      y: inv2 * inv * p1.y + 3 * inv2 * t * cp1.y + 3 * inv * t2 * cp2.y + t2 * t * p2.y,
    });
  }
  return points;
}

export function resampleByArcLength(points, step) {
  const src = dedupeAdjacent(points, 0.25);
  if (src.length < 2 || step <= 0) return src;

  const out = [{ x: src[0].x, y: src[0].y }];
  let prev = src[0];
  let carry = 0;

  for (let i = 1; i < src.length; i++) {
    let curr = src[i];
    let segLen = distance(prev, curr);
    while (carry + segLen >= step && segLen > 1e-6) {
      const t = (step - carry) / segLen;
      const nx = lerp(prev.x, curr.x, t);
      const ny = lerp(prev.y, curr.y, t);
      out.push({ x: nx, y: ny });
      prev = { x: nx, y: ny };
      segLen = distance(prev, curr);
      carry = 0;
    }
    carry += segLen;
    prev = curr;
  }

  const tail = out[out.length - 1];
  const last = src[src.length - 1];
  if (distance(tail, last) > step * 0.25) out.push(last);
  return out;
}

export function densifyPolyline(points, step = 6) {
  const src = dedupeAdjacent(points, 0.25);
  if (src.length < 2 || step <= 0) return src;

  const out = [{ x: src[0].x, y: src[0].y }];
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1];
    const b = src[i];
    const len = distance(a, b);
    const count = Math.max(1, Math.ceil(len / step));
    for (let s = 1; s <= count; s++) {
      const t = s / count;
      out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
    }
  }
  return out;
}

export function smoothPolyline(points, passes) {
  let a = points.map(clonePoint);
  for (let pass = 0; pass < passes; pass++) {
    const b = a.map(clonePoint);
    for (let i = 1; i < a.length - 1; i++) {
      b[i].x = (a[i - 1].x + a[i].x * 2 + a[i + 1].x) * 0.25;
      b[i].y = (a[i - 1].y + a[i].y * 2 + a[i + 1].y) * 0.25;
    }
    a = b;
  }
  return a;
}

function evaluateQuadratic(p1, cp, p2, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * p1.x + 2 * inv * t * cp.x + t * t * p2.x,
    y: inv * inv * p1.y + 2 * inv * t * cp.y + t * t * p2.y,
  };
}

function cumulativeLengths(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + distance(points[i - 1], points[i]));
  }
  return cum;
}

function estimateTangents(points, radius) {
  const last = points.length - 1;
  return points.map((_, i) => {
    const lo = Math.max(0, i - radius);
    const hi = Math.min(last, i + radius);
    let dx = points[hi].x - points[lo].x;
    let dy = points[hi].y - points[lo].y;
    let len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      if (i < last) {
        dx = points[i + 1].x - points[i].x;
        dy = points[i + 1].y - points[i].y;
      } else {
        dx = points[i].x - points[i - 1].x;
        dy = points[i].y - points[i - 1].y;
      }
      len = Math.hypot(dx, dy) || 1;
    }
    return { x: dx / len, y: dy / len };
  });
}

function fallbackControlPoint(a, tA, b, tB, segLen) {
  const handle = segLen * 0.35;
  return {
    x: (a.x + tA.x * handle + b.x - tB.x * handle) * 0.5,
    y: (a.y + tA.y * handle + b.y - tB.y * handle) * 0.5,
  };
}

function chordMidpoint(a, b) {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
  };
}

function tangentIntersectionCp(a, tA, b, tB, clampFactor = 1.5) {
  const det = tA.x * tB.y - tA.y * tB.x;
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const segLen = Math.hypot(rx, ry) || 1;
  const chordX = rx / segLen;
  const chordY = ry / segLen;
  const alignA = Math.abs(chordX * tA.x + chordY * tA.y);
  const alignB = Math.abs(chordX * tB.x + chordY * tB.y);

  if (Math.abs(det) < 1e-4) {
    if (alignA > 0.985 && alignB > 0.985) return chordMidpoint(a, b);
    return null;
  }

  const s = (rx * tB.y - ry * tB.x) / det;
  const u = (tA.x * ry - tA.y * rx) / det;
  if (s < 0 || u < 0) return null;

  const clamped = clamp(s, 0, segLen * clampFactor);
  return { x: a.x + tA.x * clamped, y: a.y + tA.y * clamped };
}

function measureSpanError(points, cum, start, end, p1, cp, p2) {
  const spanLen = cum[end] - cum[start] || 1;
  let maxError = 0;
  let splitIndex = Math.floor((start + end) * 0.5);

  for (let i = start + 1; i < end; i++) {
    const t = (cum[i] - cum[start]) / spanLen;
    const q = evaluateQuadratic(p1, cp, p2, t);
    const err = distance(q, points[i]);
    if (err > maxError) {
      maxError = err;
      splitIndex = i;
    }
  }

  return { maxError, splitIndex };
}

function enforceChunkG1(segments, tangents, cum) {
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i];
    const b = segments[i + 1];
    if (a.end !== b.start) continue;

    const joint = a.p2;
    const t = tangents[a.end];
    const tLen = Math.hypot(t.x, t.y) || 1;
    const tx = t.x / tLen;
    const ty = t.y / tLen;
    const segLenA = Math.max(1e-3, cum[a.end] - cum[a.start]);
    const segLenB = Math.max(1e-3, cum[b.end] - cum[b.start]);
    const minSeg = Math.min(segLenA, segLenB);
    const minHandle = Math.min(12, Math.max(0.75, minSeg * 0.18));

    let inLen = distance(a.cp, joint);
    let outLen = distance(b.cp, joint);
    if (inLen < minHandle) inLen = Math.min(segLenA * 0.6, Math.max(minHandle, segLenA * 0.28));
    if (outLen < minHandle) outLen = Math.min(segLenB * 0.6, Math.max(minHandle, segLenB * 0.28));

    a.cp = { x: joint.x - tx * inLen, y: joint.y - ty * inLen };
    b.cp = { x: joint.x + tx * outLen, y: joint.y + ty * outLen };
  }
}

function fitChunk(points, options) {
  const dense = densifyPolyline(points, options.densifyStep);
  if (dense.length < 2) return { curves: [], maxError: 0 };

  const tangentSource = options.smoothingPasses > 0
    ? smoothPolyline(dense, options.smoothingPasses)
    : dense.map(clonePoint);
  const tangents = estimateTangents(tangentSource, options.tangentRadius);
  const cum = cumulativeLengths(dense);
  const segments = [];
  let maxAcceptedError = 0;

  function fitSpan(start, end) {
    if (end <= start) return;

    const p1 = dense[start];
    const p2 = dense[end];
    const spanPointCount = end - start;
    const spanLen = cum[end] - cum[start];
    const canSplit = spanPointCount > options.minSpanPoints && spanLen > options.minSpanLength;

    let cp = tangentIntersectionCp(p1, tangents[start], p2, tangents[end], options.clampFactor);
    if (!cp && canSplit) {
      const split = Math.floor((start + end) * 0.5);
      if (split > start && split < end) {
        fitSpan(start, split);
        fitSpan(split, end);
        return;
      }
    }

    if (!cp) cp = fallbackControlPoint(p1, tangents[start], p2, tangents[end], Math.max(spanLen, 1));

    const errInfo = measureSpanError(dense, cum, start, end, p1, cp, p2);

    if (canSplit && errInfo.maxError > options.errorThreshold) {
      let split = errInfo.splitIndex;
      if (split <= start || split >= end) split = Math.floor((start + end) * 0.5);
      if (split > start && split < end) {
        fitSpan(start, split);
        fitSpan(split, end);
        return;
      }
    }

    maxAcceptedError = Math.max(maxAcceptedError, errInfo.maxError);
    segments.push({
      start,
      end,
      p1: { x: p1.x, y: p1.y },
      cp: { x: cp.x, y: cp.y },
      p2: { x: p2.x, y: p2.y },
    });
  }

  fitSpan(0, dense.length - 1);
  segments.sort((a, b) => a.start - b.start || a.end - b.end);
  enforceChunkG1(segments, tangents, cum);
  return {
    curves: segments.map(({ p1, cp, p2 }) => ({ p1, cp, p2 })),
    maxError: maxAcceptedError,
  };
}

function splitAtCorners(points, smoothness) {
  const src = dedupeAdjacent(points, 0.75);
  if (src.length < 3) return [src];

  const thresholdDeg = 35 + smoothness * 8;
  const thresholdRad = (thresholdDeg * Math.PI) / 180;
  const chunks = [];
  let start = 0;

  for (let i = 1; i < src.length - 1; i++) {
    const a = src[i - 1];
    const b = src[i];
    const c = src[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const bcx = c.x - b.x;
    const bcy = c.y - b.y;
    const abLen = Math.hypot(abx, aby);
    const bcLen = Math.hypot(bcx, bcy);
    if (abLen < 4 || bcLen < 4) continue;
    const dot = clamp((abx * bcx + aby * bcy) / (abLen * bcLen), -1, 1);
    const turn = Math.acos(dot);
    if (turn >= thresholdRad) {
      chunks.push(src.slice(start, i + 1));
      start = i;
    }
  }

  chunks.push(src.slice(start));
  return chunks.filter(chunk => chunk.length >= 2);
}

export function fitQuadraticChain(points, options = {}) {
  const src = dedupeAdjacent(points, 0.75);
  if (src.length < 2) {
    return {
      curves: [],
      stats: { segments: 0, chunks: 0, maxError: 0, sourcePoints: src.length },
    };
  }

  const smoothness = clamp(Math.round(options.smoothness ?? 4), 1, 8);
  const chunks = options.preserveCorners ? splitAtCorners(src, smoothness) : [src];
  const fitOptions = {
    errorThreshold: options.errorThreshold ?? 10,
    densifyStep: options.densifyStep ?? 6,
    tangentRadius: options.tangentRadius ?? (1 + Math.round(smoothness * 0.75)),
    smoothingPasses: options.smoothingPasses ?? Math.max(0, smoothness - 3),
    minSpanPoints: options.minSpanPoints ?? 4,
    minSpanLength: options.minSpanLength ?? 18,
    clampFactor: options.clampFactor ?? 1.5,
  };

  const curves = [];
  let maxError = 0;

  for (const chunk of chunks) {
    const result = fitChunk(chunk, fitOptions);
    if (result.curves.length > 0) {
      result.curves[0]._chunkStart = true;
      result.curves[result.curves.length - 1]._chunkEnd = true;
    }
    curves.push(...result.curves);
    maxError = Math.max(maxError, result.maxError);
  }

  return {
    curves,
    stats: {
      segments: curves.length,
      chunks: chunks.length,
      maxError,
      sourcePoints: src.length,
    },
  };
}

function pointToSegmentDistance(pt, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return distance(pt, a);
  const t = clamp(((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq, 0, 1);
  const proj = { x: a.x + dx * t, y: a.y + dy * t };
  return distance(pt, proj);
}

export function simplifyPolylineRdp(points, epsilon = 10) {
  const src = dedupeAdjacent(points, 0.75);
  if (src.length < 3) return src;

  const keep = new Array(src.length).fill(false);
  keep[0] = true;
  keep[src.length - 1] = true;
  const stack = [[0, src.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let maxDist = 0;
    let split = -1;
    for (let i = start + 1; i < end; i++) {
      const d = pointToSegmentDistance(src[i], src[start], src[end]);
      if (d > maxDist) {
        maxDist = d;
        split = i;
      }
    }
    if (split > start && split < end && maxDist > epsilon) {
      keep[split] = true;
      stack.push([start, split], [split, end]);
    }
  }

  const out = [];
  for (let i = 0; i < src.length; i++) {
    if (keep[i]) out.push(src[i]);
  }
  return out;
}
