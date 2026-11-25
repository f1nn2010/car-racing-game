import { BoostPad, CornerChevron, JumpRamp, TrackId, TrackSample } from './types';

export const ROAD_HALF_WIDTH = 9.2; // Generous 18.4m racing surface for thrilling overtakes & drifts
export const CURB_WIDTH = 1.15;
export const BARRIER_OFFSET = ROAD_HALF_WIDTH + CURB_WIDTH + 0.55;
export const NUM_CHECKPOINTS = 8;
export const TOTAL_LAPS = 3;

interface ControlPoint {
  x: number;
  y: number;
  z: number;
}

// 1. AMALFI RIVIERA (~2,150m): Long sunlit seafront straight, sweeping headland hairpin,
// hillside villa esses, elevated belvedere straight & dramatic southern bay carousel!
const RIVIERA_POINTS: ControlPoint[] = [
  { x: 0, y: 0.6, z: -120 },
  { x: 0, y: 0.6, z: 30 },
  { x: 0, y: 0.8, z: 185 },
  { x: 18, y: 2.2, z: 315 },
  { x: 105, y: 4.8, z: 395 },
  { x: 235, y: 7.4, z: 390 },
  { x: 355, y: 9.6, z: 305 },
  { x: 385, y: 8.8, z: 165 },
  { x: 295, y: 6.4, z: 65 },
  { x: 355, y: 7.0, z: -65 },
  { x: 335, y: 5.4, z: -205 },
  { x: 225, y: 3.6, z: -290 },
  { x: 90, y: 2.0, z: -295 },
  { x: -12, y: 1.0, z: -225 },
];

// 2. TOKYO WANGAN MIDNIGHT (~2,350m): Massive illuminated Rainbow Suspension Bridge straight,
// wide Odaiba bay loop, neon dockside esses, blazing expressway backstretch & C1 harbor sweeper!
const TOKYO_POINTS: ControlPoint[] = [
  { x: 0, y: 3.6, z: -130 },
  { x: 0, y: 4.4, z: 45 },
  { x: 0, y: 7.8, z: 215 }, // Long soaring Suspension Bridge Straight!
  { x: 4, y: 6.8, z: 355 }, // Bridge descent into bay sweeper
  { x: 92, y: 4.2, z: 455 }, // Wide Odaiba Neon Sweeper
  { x: 245, y: 3.0, z: 445 }, // Bayfront High-Speed Arc
  { x: 385, y: 2.6, z: 345 }, // Portside Chicane Entry
  { x: 330, y: 2.8, z: 195 }, // Dockyard Fast Left
  { x: 425, y: 3.6, z: 50 }, // Skyline Long Sweeper
  { x: 405, y: 4.8, z: -115 }, // Elevated Expressway Backstretch
  { x: 315, y: 5.6, z: -255 }, // Midnight Interchange Curve
  { x: 175, y: 5.0, z: -315 }, // Harbor Overpass Arc
  { x: 38, y: 4.0, z: -290 }, // Final High-Speed Exit
  { x: -10, y: 3.6, z: -215 },
];

// 3. ALPEN PASS (~2,180m): Valley launch, dramatic mountain climb, high-ridge rock tunnel gallery,
// summit overlook hairpin, exhilarating downhill switchbacks & glacier valley return!
const ALPS_POINTS: ControlPoint[] = [
  { x: 0, y: 1.6, z: -120 },
  { x: 0, y: 2.4, z: 40 },
  { x: 8, y: 6.8, z: 195 }, // Steep Alpine Climb
  { x: 68, y: 13.5, z: 330 }, // Summit Switchback Entry
  { x: 195, y: 19.8, z: 385 }, // Alpine Overlook Crest
  { x: 335, y: 22.8, z: 325 }, // High Ridge Straight (Tunnel Gallery!)
  { x: 385, y: 21.0, z: 185 }, // Peak Hairpin
  { x: 280, y: 15.8, z: 85 }, // Mountain S-Curve Downhill
  { x: 365, y: 12.2, z: -55 }, // Valley Overlook Sweeper
  { x: 325, y: 8.6, z: -195 }, // Fast Timberland Descent
  { x: 205, y: 5.6, z: -280 }, // Glacier Creek Bend
  { x: 75, y: 3.4, z: -275 }, // Alpine Meadow Curve
  { x: -14, y: 1.9, z: -205 },
];

function getControlPoints(trackId: TrackId): ControlPoint[] {
  if (trackId === 'tokyo') return TOKYO_POINTS;
  if (trackId === 'alps') return ALPS_POINTS;
  return RIVIERA_POINTS;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export interface TrackData {
  id: TrackId;
  samples: TrackSample[];
  totalLength: number;
  boostPads: BoostPad[];
  jumpRamps: JumpRamp[];
  cornerChevrons: CornerChevron[];
  checkpointIndices: number[];
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

/**
 * Exact minimum 2D horizontal distance from world point (x, z) to track centerline.
 * Used to guarantee ZERO scenery/buildings/rocks/trees ever overlap onto the road!
 */
export function minDistToTrack(track: TrackData, x: number, z: number, step = 1): number {
  let minSq = Infinity;
  const samples = track.samples;
  for (let i = 0; i < samples.length; i += step) {
    const s = samples[i];
    const dx = x - s.x;
    const dz = z - s.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < minSq) minSq = d2;
  }
  return Math.sqrt(minSq);
}

export function isClearOfTrack(
  track: TrackData,
  x: number,
  z: number,
  minClearance: number
): boolean {
  return minDistToTrack(track, x, z, 2) >= minClearance;
}

export function createTrack(trackId: TrackId = 'riviera', sampleCount = 720): TrackData {
  const ctrl = getControlPoints(trackId);
  const nCtrl = ctrl.length;
  const rawPts: ControlPoint[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const u = (i / sampleCount) * nCtrl;
    const seg = Math.floor(u) % nCtrl;
    const localT = u - Math.floor(u);

    const p0 = ctrl[(seg - 1 + nCtrl) % nCtrl];
    const p1 = ctrl[seg];
    const p2 = ctrl[(seg + 1) % nCtrl];
    const p3 = ctrl[(seg + 2) % nCtrl];

    rawPts.push({
      x: catmullRom(p0.x, p1.x, p2.x, p3.x, localT),
      y: catmullRom(p0.y, p1.y, p2.y, p3.y, localT),
      z: catmullRom(p0.z, p1.z, p2.z, p3.z, localT),
    });
  }

  const arcLengths: number[] = [0];
  let totalLength = 0;
  for (let i = 1; i < sampleCount; i++) {
    const prev = rawPts[i - 1];
    const cur = rawPts[i];
    totalLength += Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z);
    arcLengths.push(totalLength);
  }
  totalLength += Math.hypot(
    rawPts[0].x - rawPts[sampleCount - 1].x,
    rawPts[0].y - rawPts[sampleCount - 1].y,
    rawPts[0].z - rawPts[sampleCount - 1].z
  );

  const samples: TrackSample[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < sampleCount; i++) {
    const prev = rawPts[(i - 1 + sampleCount) % sampleCount];
    const cur = rawPts[i];
    const next = rawPts[(i + 1) % sampleCount];

    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const tx = dx / len;
    const ty = dy / len;
    const tz = dz / len;

    const hLen = Math.hypot(tx, tz) || 1;
    const rx = -tz / hLen;
    const rz = tx / hLen;

    if (cur.x < minX) minX = cur.x;
    if (cur.x > maxX) maxX = cur.x;
    if (cur.z < minZ) minZ = cur.z;
    if (cur.z > maxZ) maxZ = cur.z;

    samples.push({
      index: i,
      s: arcLengths[i],
      t: arcLengths[i] / totalLength,
      x: cur.x,
      y: cur.y,
      z: cur.z,
      tx,
      ty,
      tz,
      rx,
      rz,
      curvature: 0,
      halfWidth: ROAD_HALF_WIDTH,
    });
  }

  for (let i = 0; i < sampleCount; i++) {
    const prev = samples[(i - 3 + sampleCount) % sampleCount];
    const next = samples[(i + 3) % sampleCount];
    const cur = samples[i];
    const ds = Math.max(0.5, (next.s - prev.s + totalLength) % totalLength);
    const dtx = next.tx - prev.tx;
    const dtz = next.tz - prev.tz;
    cur.curvature = (dtx * cur.rx + dtz * cur.rz) / ds;
  }

  // Place 10 exciting Apex Boost Pads around each extended circuit
  const padSpecs = [
    { frac: 0.09, offset: -1.8 },
    { frac: 0.18, offset: 2.0 },
    { frac: 0.28, offset: -2.2 },
    { frac: 0.38, offset: 2.2 },
    { frac: 0.49, offset: -2.0 },
    { frac: 0.59, offset: 1.8 },
    { frac: 0.69, offset: -2.2 },
    { frac: 0.78, offset: 2.0 },
    { frac: 0.87, offset: -1.6 },
    { frac: 0.95, offset: 0.8 },
  ];

  const boostPads: BoostPad[] = padSpecs.map((spec, id) => {
    const idx = Math.floor(spec.frac * sampleCount) % sampleCount;
    const smp = samples[idx];
    return {
      id,
      sampleIndex: idx,
      s: smp.s,
      lateralOffset: spec.offset,
      x: smp.x + smp.rx * spec.offset,
      y: smp.y,
      z: smp.z + smp.rz * spec.offset,
      heading: Math.atan2(smp.tx, smp.tz),
    };
  });

  // Place 3 Thrilling Arcade Jump Ramps on fast straights / crests!
  const rampSpecs =
    trackId === 'tokyo'
      ? [
          { frac: 0.14, offset: 0.0, launchVy: 11.5 },
          { frac: 0.47, offset: -1.0, launchVy: 10.8 },
          { frac: 0.76, offset: 0.5, launchVy: 11.2 },
        ]
      : trackId === 'alps'
        ? [
            { frac: 0.14, offset: 0.4, launchVy: 11.0 },
            { frac: 0.52, offset: -0.6, launchVy: 11.4 },
            { frac: 0.81, offset: 0.0, launchVy: 11.0 },
          ]
        : [
            { frac: 0.13, offset: 0.0, launchVy: 10.8 },
            { frac: 0.46, offset: -0.8, launchVy: 10.6 },
            { frac: 0.77, offset: 0.4, launchVy: 10.8 },
          ];

  const jumpRamps: JumpRamp[] = rampSpecs.map((rs, id) => {
    const idx = Math.floor(rs.frac * sampleCount) % sampleCount;
    const smp = samples[idx];
    return {
      id,
      sampleIndex: idx,
      s: smp.s,
      lateralOffset: rs.offset,
      x: smp.x + smp.rx * rs.offset,
      y: smp.y,
      z: smp.z + smp.rz * rs.offset,
      heading: Math.atan2(smp.tx, smp.tz),
      width: 5.4,
      length: 9.5,
      launchVy: rs.launchVy,
    };
  });

  // Automatically place high-visibility outer-edge Corner Chevrons cleanly BEHIND the guardrail!
  const cornerChevrons: CornerChevron[] = [];
  for (let i = 0; i < sampleCount; i += 8) {
    const smp = samples[i];
    if (Math.abs(smp.curvature) > 0.0085) {
      const turnRight = smp.curvature > 0;
      // Outer side of a right turn is LEFT (-rx), outer side of a left turn is RIGHT (+rx)
      const outerSign = turnRight ? -1 : 1;
      const offset = outerSign * (BARRIER_OFFSET + 2.35);
      const cx = smp.x + smp.rx * offset;
      const cz = smp.z + smp.rz * offset;

      // Guarantee chevron & tire barrier stay strictly outside ALL parts of the road corridor
      let clear = true;
      for (let k = 0; k < sampleCount; k += 4) {
        const other = samples[k];
        const dx = cx - other.x;
        const dz = cz - other.z;
        if (dx * dx + dz * dz < (BARRIER_OFFSET + 1.75) * (BARRIER_OFFSET + 1.75)) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;

      cornerChevrons.push({
        x: cx,
        y: smp.y,
        z: cz,
        heading: Math.atan2(smp.tx, smp.tz),
        turnRight,
      });
    }
  }

  const checkpointIndices: number[] = [];
  for (let c = 0; c < NUM_CHECKPOINTS; c++) {
    checkpointIndices.push(Math.floor((c / NUM_CHECKPOINTS) * sampleCount));
  }

  return {
    id: trackId,
    samples,
    totalLength,
    boostPads,
    jumpRamps,
    cornerChevrons,
    checkpointIndices,
    bounds: { minX, maxX, minZ, maxZ },
  };
}

// Keep backwards-compatible alias for existing tests/imports
export function createCoastalTrack(sampleCount = 720): TrackData {
  return createTrack('riviera', sampleCount);
}

export interface TrackProjection {
  sampleIndex: number;
  sample: TrackSample;
  s: number;
  lateralOffset: number;
  y: number;
  distSq: number;
}

export function projectPointToTrack(
  track: TrackData,
  x: number,
  z: number,
  hintIndex?: number
): TrackProjection {
  const { samples, totalLength } = track;
  const n = samples.length;
  let bestIdx = 0;
  let bestDistSq = Infinity;

  if (hintIndex !== undefined && hintIndex >= 0 && hintIndex < n) {
    const windowRadius = 42;
    for (let offset = -windowRadius; offset <= windowRadius; offset++) {
      const idx = (hintIndex + offset + n) % n;
      const s = samples[idx];
      const dx = x - s.x;
      const dz = z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = idx;
      }
    }
  }

  if (bestDistSq > 520) {
    bestDistSq = Infinity;
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const dx = x - s.x;
      const dz = z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = i;
      }
    }
  }

  const smp = samples[bestIdx];
  const dx = x - smp.x;
  const dz = z - smp.z;

  const along = dx * smp.tx + dz * smp.tz;
  const lateralOffset = dx * smp.rx + dz * smp.rz;

  const s = ((smp.s + along) % totalLength + totalLength) % totalLength;
  const y = smp.y + along * smp.ty;

  return {
    sampleIndex: bestIdx,
    sample: smp,
    s,
    lateralOffset,
    y,
    distSq: bestDistSq,
  };
}

export function getSampleAtDistance(track: TrackData, s: number): TrackSample {
  const { samples, totalLength } = track;
  const wrapped = ((s % totalLength) + totalLength) % totalLength;
  const approxIdx = Math.floor((wrapped / totalLength) * samples.length) % samples.length;
  return samples[approxIdx];
}

/**
 * Map-aware continuous terrain heightfield!
 * Generous flat roadbed clearance (BARRIER_OFFSET + 6.5m) guarantees ZERO hill/terrain triangles
 * can ever poke through the asphalt, curbs, or track shoulders!
 */
export function groundHeightAt(track: TrackData, x: number, z: number): number {
  const proj = projectPointToTrack(track, x, z);
  const distToCenter = Math.sqrt(proj.distSq);

  if (track.id === 'tokyo') {
    // Elevated bay expressway over Tokyo Bay water (water sits at y = -1.65)
    // Reclaimed waterfront land & skyline islands sit far east (x > 105) and far west (x < -95)
    const eastLand = Math.max(0, Math.min(2.8, (x - 95) * 0.1));
    const westPier = Math.max(0, Math.min(2.2, (-x - 95) * 0.1));
    const naturalH = -3.6 + eastLand * 2.0 + westPier * 1.8;

    return Math.min(proj.y - 1.1, naturalH);
  }

  if (track.id === 'alps') {
    const ridge1 = Math.exp(-((x - 495) * (x - 495) + (z - 220) * (z - 220)) / 24000) * 76;
    const ridge2 = Math.exp(-((x + 150) * (x + 150) + (z - 340) * (z - 340)) / 28000) * 82;
    const ridge3 = Math.exp(-((x - 190) * (x - 190) + (z + 420) * (z + 420)) / 28000) * 68;
    const ridge4 = Math.exp(-((x - 165) * (x - 165) + (z - 80) * (z - 80)) / 9500) * 28;
    const alpineNoise =
      Math.sin(x * 0.016) * Math.cos(z * 0.015) * 5.2 +
      Math.abs(Math.sin(x * 0.032 - z * 0.024)) * 3.6;
    const naturalH = 1.6 + ridge1 + ridge2 + ridge3 + ridge4 + alpineNoise;

    const shoulderStart = BARRIER_OFFSET + 6.5;
    const blendWidth = 34.0;
    if (distToCenter <= shoulderStart) {
      return proj.y - 0.55;
    }
    const t = Math.min(1, (distToCenter - shoulderStart) / blendWidth);
    const smoothT = t * t * (3 - 2 * t);
    return (proj.y - 0.55) * (1 - smoothT) + naturalH * smoothT;
  }

  // Riviera coastal topography scaled cleanly for the extended coastal circuit
  const seaSlope = Math.max(-5.5, Math.min(0, (x + 18) * 0.12));
  const inlandFactor = Math.max(0, (x - 120) * 0.045);
  const headlandHill =
    Math.exp(-((x - 28) * (x - 28) + (z - 445) * (z - 445)) / 7800) * 20.0;
  const easternRidge =
    Math.exp(-((x - 485) * (x - 485) + (z - 120) * (z - 120)) / 26000) * 38.0;
  const innerKnoll =
    Math.exp(-((x - 165) * (x - 165) + (z - 115) * (z - 115)) / 8200) * 14.0;

  const gentleWaves =
    Math.sin(x * 0.015) * Math.cos(z * 0.014) * 2.6 +
    Math.sin(x * 0.035 + z * 0.025) * 0.9;

  const naturalH = Math.max(
    -5.2,
    -0.5 + seaSlope + inlandFactor + headlandHill + easternRidge + innerKnoll + gentleWaves
  );

  const shoulderStart = BARRIER_OFFSET + 6.5;
  const blendWidth = 32.0;
  if (distToCenter <= shoulderStart) {
    return proj.y - 0.52;
  }
  const t = Math.min(1, (distToCenter - shoulderStart) / blendWidth);
  const smoothT = t * t * (3 - 2 * t);
  return (proj.y - 0.52) * (1 - smoothT) + naturalH * smoothT;
}

export function getStartGridTransform(
  track: TrackData,
  slotIndex: number
): { x: number; y: number; z: number; heading: number; sampleIndex: number } {
  const startS = track.totalLength * 0.056 - slotIndex * 8.4;
  const wrappedS = ((startS % track.totalLength) + track.totalLength) % track.totalLength;
  const smp = getSampleAtDistance(track, wrappedS);
  const lateral = slotIndex % 2 === 0 ? -2.7 : 2.7;

  return {
    x: smp.x + smp.rx * lateral,
    y: smp.y,
    z: smp.z + smp.rz * lateral,
    heading: Math.atan2(smp.tx, smp.tz),
    sampleIndex: smp.index,
  };
}
