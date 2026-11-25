export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type GameMode = 'grand-prix' | 'time-trial';

export type CameraMode = 'chase' | 'far' | 'hood';

export type AiPolicy = 'apex' | 'blocker' | 'drift';

export type CarModelId = 'gt3rs' | 'chiron' | 'f40' | 'svj';

export type TrackId = 'riviera' | 'tokyo' | 'alps';

export interface TrackMeta {
  id: TrackId;
  name: string;
  shortName: string;
  subtitle: string;
  themeColor: string;
  difficulty: string;
}

export const TRACK_LIST: TrackMeta[] = [
  {
    id: 'riviera',
    name: 'Amalfi Riviera',
    shortName: 'Riviera',
    subtitle: 'Sunlit Seafront & Cliff Hairpins',
    themeColor: '#0ea5e9',
    difficulty: 'FAST FLOW',
  },
  {
    id: 'tokyo',
    name: 'Tokyo Wangan',
    shortName: 'Tokyo Night',
    subtitle: 'Midnight Suspension Bridge & Neon Bay',
    themeColor: '#ec4899',
    difficulty: 'HIGH SPEED',
  },
  {
    id: 'alps',
    name: 'Alpen Pass',
    shortName: 'Alpen Pass',
    subtitle: 'Alpine Switchbacks & Rock Tunnel',
    themeColor: '#f59e0b',
    difficulty: 'TECHNICAL',
  },
];

export function getTrackMeta(id: TrackId): TrackMeta {
  return TRACK_LIST.find((t) => t.id === id) ?? TRACK_LIST[0];
}

export interface CarLivery {
  id: string;
  name: string;
  bodyHex: number;
  secondaryHex: number;
  cssHex: string;
  stripeHex: number;
  accentHex: number;
  caliperHex: number;
}

export interface CarSpec {
  id: CarModelId;
  name: string;
  shortName: string;
  tagline: string;
  topSpeedMs: number;
  accelMs2: number;
  handling: number;
  driftBoostMult: number;
  nitroPower: number;
  speedDisplayScale: number;
  statSpeed: number;
  statHandling: number;
  statNitro: number;
  defaultLiveryId: string;
}

export const ICONIC_CARS: CarSpec[] = [
  {
    id: 'gt3rs',
    name: 'Porsche 911 GT3 RS',
    shortName: '911 GT3 RS',
    tagline: 'Swan-Neck DRS Aero · Razor Apex Grip',
    topSpeedMs: 76,
    accelMs2: 33,
    handling: 1.2,
    driftBoostMult: 1.18,
    nitroPower: 24,
    speedDisplayScale: 3.98,
    statSpeed: 89,
    statHandling: 99,
    statNitro: 88,
    defaultLiveryId: 'weissach',
  },
  {
    id: 'chiron',
    name: 'Bugatti Chiron',
    shortName: 'Chiron W16',
    tagline: 'Quad-Turbo W16 · Unrivaled Top Speed',
    topSpeedMs: 84,
    accelMs2: 35.5,
    handling: 1.03,
    driftBoostMult: 1.04,
    nitroPower: 29,
    speedDisplayScale: 4.38,
    statSpeed: 100,
    statHandling: 87,
    statNitro: 99,
    defaultLiveryId: 'french-blue',
  },
  {
    id: 'f40',
    name: 'Ferrari F40',
    shortName: 'Ferrari F40',
    tagline: 'Featherweight Twin-Turbo · Drift Legend',
    topSpeedMs: 77.5,
    accelMs2: 34,
    handling: 1.13,
    driftBoostMult: 1.32,
    nitroPower: 25,
    speedDisplayScale: 4.08,
    statSpeed: 92,
    statHandling: 94,
    statNitro: 91,
    defaultLiveryId: 'corsa',
  },
  {
    id: 'svj',
    name: 'Lamborghini Aventador SVJ',
    shortName: 'Aventador SVJ',
    tagline: 'Naturally Aspirated V12 · Aero Fury',
    topSpeedMs: 80.5,
    accelMs2: 34.8,
    handling: 1.1,
    driftBoostMult: 1.15,
    nitroPower: 27,
    speedDisplayScale: 4.2,
    statSpeed: 96,
    statHandling: 92,
    statNitro: 95,
    defaultLiveryId: 'verde',
  },
];

export const PLAYER_LIVERIES: CarLivery[] = [
  {
    id: 'weissach',
    name: 'Ice Grey / Pyro Red',
    bodyHex: 0xe6e8eb,
    secondaryHex: 0x1b1e24,
    cssHex: '#dfe3e8',
    stripeHex: 0xd92626,
    accentHex: 0x181b21,
    caliperHex: 0xd92626,
  },
  {
    id: 'french-blue',
    name: 'French Racing Blu',
    bodyHex: 0x1565c8,
    secondaryHex: 0x111722,
    cssHex: '#1565c8',
    stripeHex: 0xdbe6f5,
    accentHex: 0x121824,
    caliperHex: 0xef4444,
  },
  {
    id: 'corsa',
    name: 'Rosso Corsa',
    bodyHex: 0xd61f26,
    secondaryHex: 0x1a1c22,
    cssHex: '#d61f26',
    stripeHex: 0xf7f2e7,
    accentHex: 0x1a1d24,
    caliperHex: 0xf5b700,
  },
  {
    id: 'verde',
    name: 'Verde Mantis',
    bodyHex: 0x4ca91e,
    secondaryHex: 0x171b20,
    cssHex: '#4ca91e',
    stripeHex: 0x14181e,
    accentHex: 0x151920,
    caliperHex: 0xfacc15,
  },
  {
    id: 'giallo',
    name: 'Giallo Modena',
    bodyHex: 0xe8a812,
    secondaryHex: 0x181b22,
    cssHex: '#e8a812',
    stripeHex: 0x181c24,
    accentHex: 0x1a1d24,
    caliperHex: 0xd92626,
  },
];

export function getCarSpec(id: CarModelId): CarSpec {
  return ICONIC_CARS.find((c) => c.id === id) ?? ICONIC_CARS[0];
}

export function getLivery(id: string): CarLivery {
  return PLAYER_LIVERIES.find((l) => l.id === id) ?? PLAYER_LIVERIES[0];
}

export interface RivalSetup {
  id: string;
  name: string;
  modelId: CarModelId;
  policy: AiPolicy;
  livery: CarLivery;
  paceFactor: number;
  preferredOffset: number;
}

export function buildRivalLineup(playerModelId: CarModelId): RivalSetup[] {
  const rivalOrder: CarModelId[] = (['chiron', 'gt3rs', 'f40', 'svj'] as CarModelId[]).filter(
    (m) => m !== playerModelId
  );

  const policies: AiPolicy[] = ['apex', 'blocker', 'drift'];
  const paces = [0.945, 0.915, 0.885];
  const offsets = [-2.0, 1.8, 2.8];

  return rivalOrder.slice(0, 3).map((modelId, idx) => {
    const spec = getCarSpec(modelId);
    const livery = getLivery(spec.defaultLiveryId);
    return {
      id: `ai-${modelId}`,
      name: spec.shortName,
      modelId,
      policy: policies[idx],
      livery,
      paceFactor: paces[idx],
      preferredOffset: offsets[idx],
    };
  });
}

export interface TrackSample {
  index: number;
  s: number;
  t: number;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  rx: number;
  rz: number;
  curvature: number;
  halfWidth: number;
}

export interface BoostPad {
  id: number;
  sampleIndex: number;
  s: number;
  lateralOffset: number;
  x: number;
  y: number;
  z: number;
  heading: number;
}

export interface JumpRamp {
  id: number;
  sampleIndex: number;
  s: number;
  lateralOffset: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  width: number;
  length: number;
  launchVy: number;
}

export interface CornerChevron {
  x: number;
  y: number;
  z: number;
  heading: number;
  turnRight: boolean;
}

export interface InputState {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. +1 (right) continuous analog!
  drift: boolean;
  boost: boolean;
}

export interface CarState {
  id: string;
  name: string;
  modelId: CarModelId;
  isPlayer: boolean;
  policy?: AiPolicy;
  paceFactor: number;
  preferredOffset: number;
  x: number;
  y: number;
  z: number;
  airY: number; // Height above road surface during jumps
  airVy: number; // Vertical velocity during jumps
  airtimeRun: number; // Seconds spent airborne on current jump
  vx: number;
  vz: number;
  heading: number;
  speed: number;
  steerAngle: number;
  wheelSpin: number;
  bodyRoll: number;
  bodyPitch: number;
  driftAngle: number;
  isDrifting: boolean;
  driftTier: number;
  driftCharge: number;
  driftPointsRun: number;
  totalDriftPoints: number;
  skillScore: number;
  nitro: number;
  isBoosting: boolean;
  boostPadTimer: number;
  driftMiniTurboTimer: number;
  braking: boolean;
  gear: number;
  rpm: number;
  trackSampleIdx: number;
  trackS: number;
  lateralOffset: number;
  lap: number;
  nextCheckpoint: number;
  totalProgress: number;
  lapStartTime: number;
  bestLapTime: number | null;
  lastLapTime: number | null;
  topSpeedKmh: number;
  finished: boolean;
  finishTime: number | null;
  wrongWay: boolean;
  hitFlash: number;
  liveryColor: string;
  slipstreamTimer: number;
  lastPassedRank: number;
}

export interface MinimapDot {
  id: string;
  x: number;
  z: number;
  isPlayer: boolean;
  color: string;
}

export interface HudSnapshot {
  phase: GamePhase;
  mode: GameMode;
  trackId: TrackId;
  trackName: string;
  carModelId: CarModelId;
  carName: string;
  speedKmh: number;
  gear: number;
  rpm: number;
  nitro: number;
  isBoosting: boolean;
  isDrifting: boolean;
  isAirborne: boolean;
  driftTier: number;
  driftCharge: number;
  driftPoints: number;
  totalDriftPoints: number;
  skillScore: number;
  position: number;
  totalRacers: number;
  lap: number;
  totalLaps: number;
  raceTime: number;
  bestLapTime: number | null;
  lastLapTime: number | null;
  countdown: number;
  wrongWay: boolean;
  slipstream: boolean;
  bannerText: string | null;
  skillCallout: string | null;
  cameraMode: CameraMode;
  muted: boolean;
  autoGas: boolean;
  analogSteerVisual: number;
  minimapDots: MinimapDot[];
}

export interface RaceResult {
  mode: GameMode;
  trackName: string;
  carName: string;
  position: number;
  totalRacers: number;
  totalTime: number;
  bestLapTime: number | null;
  topSpeedKmh: number;
  totalDriftPoints: number;
  skillScore: number;
  isPodium: boolean;
  standings: Array<{
    id: string;
    name: string;
    isPlayer: boolean;
    position: number;
    time: number;
    color: string;
  }>;
}
