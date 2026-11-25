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

// 1. AMALFI RIVIERA: Sweeping sunlit Mediterranean coastline + cliffside hairpins + seafront straight
const RIVIERA_POINTS: ControlPoint[] = [
  { x: 0, y: 0.6, z: -48 },
  { x: 0, y: 0.6, z: 32 },
  { x: 4, y: 1.0, z: 108 },
  { x: 44, y: 3.0, z: 166 },
  { x: 112, y: 5.8, z: 178 },
  { x: 168, y: 8.2, z: 134 },
  { x: 172, y: 7.4, z: 62 },
  { x: 120, y: 4.8, z: 16 },
  { x: 132, y: 5.2, z: -56 },
  { x: 104, y: 3.4, z: -128 },
  { x: 42, y: 1.8, z: -148 },
  { x: -12, y: 0.9, z: -114 },
];

// 2. TOKYO WANGAN MIDNIGHT: High-speed bay expressway, elevated suspension bridge straight & sweeping banked loops!
const TOKYO_POINTS: ControlPoint[] = [
  { x: 0, y: 3.5, z: -70 },
  { x: 0, y: 4.2, z: 24 },
  { x: 0, y: 7.5, z: 135 }, // Soaring Suspension Bridge Straight!
  { x: 18, y: 6.2, z: 222 }, // Fast Bay Sweeper Entry
  { x: 96, y: 3.8, z: 246 }, // Wide Neon Sweeper
  { x: 168, y: 2.5, z: 196 }, // Portside Chicane Entry
  { x: 146, y: 2.5, z: 116 }, // Dockyard Fast Left
  { x: 188, y: 3.2, z: 42 }, // Skyline Long Sweeper
  { x: 166, y: 4.8, z: -58 }, // Elevated Expressway Loop
  { x: 108, y: 5.6, z: -136 }, // Midnight Overpass Curve
  { x: 34, y: 4.2, z: -154 }, // Final High-Speed Exit
  { x: -10, y: 3.6, z: -116 },
];

// 3. ALPEN PASS: Dramatic mountain climb, sweeping switchbacks, alpine tunnel gallery & thrilling downhill descent!
const ALPS_POINTS: ControlPoint[] = [
  { x: 0, y: 1.5, z: -52 },
  { x: 0, y: 2.2, z: 32 },
  { x: 6, y: 5.8, z: 112 }, // Steep Alpine Climb
  { x: 58, y: 11.4, z: 168 }, // Summit Switchback 1
  { x: 130, y: 16.2, z: 158 }, // High Ridge Straight (Tunnel Section!)
  { x: 178, y: 18.0, z: 102 }, // Peak Hairpin
  { x: 132, y: 14.5, z: 46 }, // Alpine S-Curve Downhill
  { x: 174, y: 11.2, z: -22 }, // Sweeping Valley Overlook
  { x: 144, y: 7.6, z: -96 }, // Fast Timberland Descent
  { x: 84, y: 4.8, z: -134 }, // Glacier Creek Bend
  { x: 24, y: 2.6, z: -124 }, // Final Valley Hairpin
  { x: -10, y: 1.6, z: -92 },
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

export function createTrack(trackId: TrackId = 'riviera', sampleCount = 440): TrackData {
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
    const prev = samples[(i - 2 + sampleCount) % sampleCount];
    const next = samples[(i + 2) % sampleCount];
    const cur = samples[i];
    const ds = Math.max(0.5, (next.s - prev.s + totalLength) % totalLength);
    const dtx = next.tx - prev.tx;
    const dtz = next.tz - prev.tz;
    cur.curvature = (dtx * cur.rx + dtz * cur.rz) / ds;
  }

  // Place 6 exciting Apex Boost Pads around each track
  const padSpecs = [
    { frac: 0.11, offset: -1.8 },
    { frac: 0.26, offset: 2.2 },
    { frac: 0.44, offset: -2.4 },
    { frac: 0.60, offset: 2.0 },
    { frac: 0.77, offset: -1.6 },
    { frac: 0.91, offset: 0.6 },
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

  // Place 2 Thrilling Arcade Jump Ramps on fast straights / crests!
  const rampSpecs =
    trackId === 'tokyo'
      ? [
          { frac: 0.17, offset: 0.0, launchVy: 11.5 },
          { frac: 0.68, offset: -1.2, launchVy: 10.5 },
        ]
      : trackId === 'alps'
        ? [
            { frac: 0.19, offset: 0.5, launchVy: 11.0 },
            { frac: 0.73, offset: 0.0, launchVy: 11.5 },
          ]
        : [
            { frac: 0.15, offset: 0.0, launchVy: 10.8 },
            { frac: 0.65, offset: -0.8, launchVy: 10.5 },
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

  // Automatically place high-visibility outer-edge Corner Chevrons on every sharp turn!
  const cornerChevrons: CornerChevron[] = [];
  for (let i = 0; i < sampleCount; i += 6) {
    const smp = samples[i];
    if (Math.abs(smp.curvature) > 0.014) {
      const turnRight = smp.curvature > 0;
      // Outer side of a right turn is LEFT (-rx), outer side of a left turn is RIGHT (+rx)
      const outerSign = turnRight ? -1 : 1;
      const offset = outerSign * (BARRIER_OFFSET + 1.15);
      cornerChevrons.push({
        x: smp.x + smp.rx * offset,
        y: smp.y,
        z: smp.z + smp.rz * offset,
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
export function createCoastalTrack(sampleCount = 440): TrackData {
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
    const windowRadius = 28;
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

  if (bestDistSq > 480) {
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
 * - Riviera: coastal beach sloping into Mediterranean sea + inland terracotta hills
 * - Tokyo: bay water basin + reclaimed concrete waterfront piers/islands on east side
 * - Alps: dramatic alpine valley & towering mountain peaks flanking the circuit
 */
export function groundHeightAt(track: TrackData, x: number, z: number): number {
  const proj = projectPointToTrack(track, x, z);
  const distToCenter = Math.sqrt(proj.distSq);

  if (track.id === 'tokyo') {
    // Elevated bay expressway over Tokyo Bay water (water sits at y = -1.6)
    // Reclaimed waterfront land & skyline islands sit on east (x > 65) and far west (x < -85)
    const eastLand = Math.max(0, Math.min(2.8, (x - 58) * 0.14));
    const westPier = Math.max(0, Math.min(2.2, (-x - 65) * 0.12));
    const naturalH = -3.4 + eastLand * 2.1 + westPier * 1.8;

    // On Tokyo, the road is an elevated highway viaduct, so terrain stays cleanly below road deck
    return Math.min(proj.y - 0.85, naturalH);
  }

  if (track.id === 'alps') {
    const ridge1 = Math.exp(-((x - 245) * (x - 245) + (z - 95) * (z - 95)) / 7800) * 58;
    const ridge2 = Math.exp(-((x + 95) * (x + 95) + (z - 190) * (z - 190)) / 9200) * 64;
    const ridge3 = Math.exp(-((x - 95) * (x - 95) + (z + 230) * (z + 230)) / 10000) * 52;
    const ridge4 = Math.exp(-((x - 82) * (x - 82) + (z - 40) * (z - 40)) / 2600) * 19;
    const alpineNoise =
      Math.sin(x * 0.028) * Math.cos(z * 0.025) * 4.5 +
      Math.abs(Math.sin(x * 0.055 - z * 0.04)) * 3.2;
    const naturalH = 1.5 + ridge1 + ridge2 + ridge3 + ridge4 + alpineNoise;

    const shoulderStart = ROAD_HALF_WIDTH + CURB_WIDTH + 1.0;
    const blendWidth = 20.0;
    if (distToCenter <= shoulderStart) {
      return proj.y - 0.14;
    }
    const t = Math.min(1, (distToCenter - shoulderStart) / blendWidth);
    const smoothT = t * t * (3 - 2 * t);
    return (proj.y - 0.14) * (1 - smoothT) + naturalH * smoothT;
  }

  // Riviera coastal topography
  const seaSlope = Math.max(-5.5, Math.min(0, (x + 12) * 0.14));
  const inlandFactor = Math.max(0, (x - 68) * 0.075);
  const headlandHill =
    Math.exp(-((x - 16) * (x - 16) + (z - 216) * (z - 216)) / 2400) * 15.0;
  const easternRidge =
    Math.exp(-((x - 224) * (x - 224) + (z - 80) * (z - 80)) / 9000) * 26.0;
  const innerKnoll =
    Math.exp(-((x - 74) * (x - 74) + (z - 75) * (z - 75)) / 2400) * 9.0;

  const gentleWaves =
    Math.sin(x * 0.025) * Math.cos(z * 0.022) * 2.2 +
    Math.sin(x * 0.06 + z * 0.04) * 0.8;

  const naturalH = Math.max(
    -5.0,
    -0.5 + seaSlope + inlandFactor + headlandHill + easternRidge + innerKnoll + gentleWaves
  );

  const shoulderStart = ROAD_HALF_WIDTH + CURB_WIDTH + 1.0;
  const blendWidth = 18.0;
  if (distToCenter <= shoulderStart) {
    return proj.y - 0.12;
  }
  const t = Math.min(1, (distToCenter - shoulderStart) / blendWidth);
  const smoothT = t * t * (3 - 2 * t);
  return (proj.y - 0.12) * (1 - smoothT) + naturalH * smoothT;
}

export function getStartGridTransform(
  track: TrackData,
  slotIndex: number
): { x: number; y: number; z: number; heading: number; sampleIndex: number } {
  const startS = track.totalLength * 0.062 - slotIndex * 8.2;
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
