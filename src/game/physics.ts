import {
  NUM_CHECKPOINTS,
  ROAD_HALF_WIDTH,
  TOTAL_LAPS,
  TrackData,
  WALL_COLLISION_OFFSET,
  getSampleAtDistance,
  getStartGridTransform,
  projectPointToTrack,
} from './track';
import {
  AiPolicy,
  CarModelId,
  CarState,
  GameMode,
  InputState,
  RaceResult,
  RivalSetup,
  getCarSpec,
  getLivery,
  getTrackMeta,
} from './types';

export interface PhysicsEvent {
  type:
    | 'wall-hit'
    | 'car-hit'
    | 'boost-pad'
    | 'drift-release'
    | 'jump-launch'
    | 'jump-land'
    | 'overtake'
    | 'lap-complete'
    | 'race-finish';
  intensity: number;
  x: number;
  y: number;
  z: number;
  tier?: number;
  lap?: number;
  points?: number;
  isPlayer: boolean;
}

export function normalizeAngle(a: number): number {
  let res = a;
  while (res > Math.PI) res -= Math.PI * 2;
  while (res < -Math.PI) res += Math.PI * 2;
  return res;
}

export function createInitialCarState(
  track: TrackData,
  opts: {
    id: string;
    name: string;
    modelId: CarModelId;
    isPlayer: boolean;
    gridSlot: number;
    liveryColor: string;
    policy?: AiPolicy;
    paceFactor?: number;
    preferredOffset?: number;
  }
): CarState {
  const grid = getStartGridTransform(track, opts.gridSlot);
  const proj = projectPointToTrack(track, grid.x, grid.z, grid.sampleIndex);

  return {
    id: opts.id,
    name: opts.name,
    modelId: opts.modelId,
    isPlayer: opts.isPlayer,
    policy: opts.policy,
    paceFactor: opts.paceFactor ?? 1.0,
    preferredOffset: opts.preferredOffset ?? 0,
    x: grid.x,
    y: grid.y,
    z: grid.z,
    airY: 0,
    airVy: 0,
    airtimeRun: 0,
    vx: 0,
    vz: 0,
    heading: grid.heading,
    speed: 0,
    steerAngle: 0,
    wheelSpin: 0,
    bodyRoll: 0,
    bodyPitch: 0,
    driftAngle: 0,
    isDrifting: false,
    driftTier: 0,
    driftCharge: 0,
    driftPointsRun: 0,
    totalDriftPoints: 0,
    skillScore: 0,
    nitro: 70,
    isBoosting: false,
    boostPadTimer: 0,
    driftMiniTurboTimer: 0,
    braking: false,
    gear: 1,
    rpm: 0.18,
    trackSampleIdx: proj.sampleIndex,
    trackS: proj.s,
    lateralOffset: proj.lateralOffset,
    lap: 1,
    nextCheckpoint: 1,
    totalProgress: (() => {
      const relS = ((proj.s - track.finishLineS) % track.totalLength + track.totalLength) % track.totalLength;
      return relS > track.totalLength * 0.75 ? relS - track.totalLength : relS;
    })(),
    lapStartTime: 0,
    bestLapTime: null,
    lastLapTime: null,
    topSpeedKmh: 0,
    finished: false,
    finishTime: null,
    wrongWay: false,
    hitFlash: 0,
    liveryColor: opts.liveryColor,
    slipstreamTimer: 0,
    lastPassedRank: opts.gridSlot + 1,
  };
}

export function buildRaceCars(
  track: TrackData,
  mode: GameMode,
  playerModelId: CarModelId,
  playerLiveryId: string,
  rivals: RivalSetup[]
): CarState[] {
  const playerSpec = getCarSpec(playerModelId);
  const playerLivery = getLivery(playerLiveryId);

  if (mode === 'time-trial') {
    return [
      createInitialCarState(track, {
        id: 'player',
        name: playerSpec.shortName,
        modelId: playerModelId,
        isPlayer: true,
        gridSlot: 0,
        liveryColor: playerLivery.cssHex,
      }),
    ];
  }

  const cars: CarState[] = [];
  rivals.forEach((r, idx) => {
    cars.push(
      createInitialCarState(track, {
        id: r.id,
        name: r.name,
        modelId: r.modelId,
        isPlayer: false,
        gridSlot: idx,
        liveryColor: r.livery.cssHex,
        policy: r.policy,
        paceFactor: r.paceFactor,
        preferredOffset: r.preferredOffset,
      })
    );
  });

  cars.push(
    createInitialCarState(track, {
      id: 'player',
      name: playerSpec.shortName,
      modelId: playerModelId,
      isPlayer: true,
      gridSlot: 3,
      liveryColor: playerLivery.cssHex,
    })
  );

  return cars;
}

export function computeGearAndRpm(speedMs: number, maxSpeedMs: number): { gear: number; rpm: number } {
  const absSpd = Math.abs(speedMs);
  const ratio = Math.min(1.18, absSpd / Math.max(1, maxSpeedMs));
  const gearThresholds = [0, 0.17, 0.33, 0.5, 0.68, 0.85, 1.25];
  let gear = 1;
  for (let g = 1; g <= 6; g++) {
    if (ratio >= gearThresholds[g - 1]) gear = g;
  }
  const low = gearThresholds[gear - 1];
  const high = gearThresholds[gear];
  const gearSpan = Math.max(0.05, high - low);
  const localNorm = Math.max(0, Math.min(1, (ratio - low) / gearSpan));
  const rpm = absSpd < 1.5 ? 0.16 + localNorm * 0.15 : 0.34 + localNorm * 0.64;
  return { gear, rpm: Math.min(1, rpm) };
}

export function computeAiInput(
  car: CarState,
  allCars: CarState[],
  track: TrackData,
  raceTime: number
): InputState {
  const spec = getCarSpec(car.modelId);
  const policy = car.policy ?? 'apex';
  const speed = Math.max(15, car.speed);
  const maxSafeLat = WALL_COLLISION_OFFSET - 2.15; // Generous margin so bots hug curbs cleanly without touching guardrails!

  // Speed-adaptive multi-point lookahead (short enough to never chord-cut hairpins into inner walls!)
  const steerLookDist = Math.max(12, Math.min(30, 11 + speed * 0.23));
  const nearSample = getSampleAtDistance(track, car.trackS + steerLookDist * 0.65);
  const targetSample = getSampleAtDistance(track, car.trackS + steerLookDist);

  // Scan curvature profile ahead up to 115m for early braking & out-in-out apex setup
  const probeDists = [16, 32, 52, 78, 108];
  let maxAbsCurve = 0;
  let weightedCurve = 0;
  let weightSum = 0;
  for (let i = 0; i < probeDists.length; i++) {
    const ps = getSampleAtDistance(track, car.trackS + probeDists[i]);
    const ac = Math.abs(ps.curvature);
    if (ac > maxAbsCurve) maxAbsCurve = ac;
    const w = i === 1 ? 1.4 : i === 2 ? 1.15 : 0.7;
    weightedCurve += ps.curvature * w;
    weightSum += w;
  }
  const avgAheadCurve = weightedCurve / weightSum;
  const nearCurve = nearSample.curvature;
  const farSample = getSampleAtDistance(track, car.trackS + Math.min(90, 32 + speed * 0.58));

  // True Out-In-Out Racing Line:
  // curvature > 0 => right turn (+rx is inside apex); curvature < 0 => left turn (-rx is inside apex)
  let targetOffset = car.preferredOffset * 0.4;
  if (Math.abs(nearCurve) > 0.0042) {
    // Inside the corner: hug the inside curb cleanly without grazing the inner guardrail!
    const apexDepth = Math.min(4.6, Math.abs(nearCurve) * 420 + 1.5);
    targetOffset = Math.sign(nearCurve) * (policy === 'drift' ? apexDepth * 0.8 : apexDepth);
  } else if (Math.abs(farSample.curvature) > 0.007) {
    // Approaching a bend: open up toward the outside entry line!
    targetOffset = -Math.sign(farSample.curvature) * Math.min(4.2, Math.abs(farSample.curvature) * 280);
  } else {
    // Straightaway: actively aim for nearby Boost Pads!
    let bestPadDist = 64;
    for (const pad of track.boostPads) {
      const ds = (pad.s - car.trackS + track.totalLength) % track.totalLength;
      if (ds > 8 && ds < bestPadDist && Math.abs(pad.lateralOffset - car.lateralOffset) < 6.0) {
        bestPadDist = ds;
        targetOffset = Math.max(-maxSafeLat, Math.min(maxSafeLat, pad.lateralOffset));
      }
    }

    // Defensive blocker protects inside line cleanly when player closes in from behind
    if (policy === 'blocker') {
      const player = allCars.find((c) => c.isPlayer);
      if (player) {
        const dsBehind = (car.trackS - player.trackS + track.totalLength) % track.totalLength;
        if (dsBehind > 4 && dsBehind < 26) {
          targetOffset = Math.max(-maxSafeLat + 1.0, Math.min(maxSafeLat - 1.0, player.lateralOffset * 0.88));
        }
      }
    }
  }

  // Proactive clean overtaking & wheel-to-wheel spacing
  for (const other of allCars) {
    if (other.id === car.id) continue;
    const dsAhead = (other.trackS - car.trackS + track.totalLength) % track.totalLength;
    const latDiff = other.lateralOffset - car.lateralOffset;

    if (dsAhead > 2.2 && dsAhead < 30 && Math.abs(other.lateralOffset - targetOffset) < 3.4) {
      const spaceRight = maxSafeLat - other.lateralOffset;
      const spaceLeft = maxSafeLat + other.lateralOffset;
      const passDir = spaceRight >= spaceLeft ? 1 : -1;
      targetOffset = other.lateralOffset + passDir * 3.6;
    } else if ((dsAhead <= 2.2 || dsAhead > track.totalLength - 6.5) && Math.abs(latDiff) < 3.4) {
      const nudge = latDiff >= 0 ? -2.2 : 2.2;
      targetOffset += nudge;
    }
  }

  targetOffset = Math.max(-maxSafeLat, Math.min(maxSafeLat, targetOffset));

  // Pure pursuit steering with CORRECT sign (+steer turns right / decreases heading!)
  const tx = targetSample.x + targetSample.rx * targetOffset;
  const tz = targetSample.z + targetSample.rz * targetOffset;
  const desiredHeading = Math.atan2(tx - car.x, tz - car.z);
  const headingErr = normalizeAngle(desiredHeading - car.heading);

  // Curvature feedforward + firm wall-avoidance repulsion so bots NEVER grind guardrails
  const curvFeed = (targetSample.curvature * 0.65 + avgAheadCurve * 0.35) * 16.0;
  let wallRepel = 0;
  if (Math.abs(car.lateralOffset) > maxSafeLat - 0.8) {
    wallRepel = -Math.sign(car.lateralOffset) * (Math.abs(car.lateralOffset) - (maxSafeLat - 0.8)) * 0.85;
  }

  const rawSteer = -headingErr * 2.75 + curvFeed + wallRepel;
  const steer = Math.max(-1, Math.min(1, rawSteer));

  // Compute safe corner target speed from upcoming peak curvature & car grip
  const maxTurnRadPerSec = (policy === 'drift' ? 1.52 : 1.36) * spec.handling;
  const cornerTargetSpeed =
    maxAbsCurve > 0.0055 ? Math.max(36, maxTurnRadPerSec / Math.max(0.0055, maxAbsCurve)) : 140;

  let throttle = 1.0;
  let brake = 0;
  let drift = false;
  let boost = false;

  // Smart braking before tight hairpins
  if (car.speed > cornerTargetSpeed + 3) {
    const excess = Math.min(1, (car.speed - cornerTargetSpeed) / 24);
    throttle = Math.max(0.15, 0.82 - excess * 0.7);
    brake = Math.min(0.75, 0.22 + excess * 0.55);
  } else if (Math.abs(headingErr) > 0.32 && car.speed > 42) {
    throttle = 0.58;
    brake = 0.26;
  }

  // Controlled high-speed drifting through sharp sweepers to earn mini-turbo & nitro!
  const driftThresh = policy === 'drift' ? 0.0095 : 0.013;
  if (
    Math.abs(nearCurve) > driftThresh &&
    car.speed > 42 &&
    Math.abs(steer) > 0.34 &&
    brake < 0.25 &&
    Math.abs(car.lateralOffset) < maxSafeLat - 0.8
  ) {
    drift = true;
    throttle = Math.max(throttle, 0.9);
  }

  // Aggressive smart nitro deployment on straights and corner exits!
  if (
    maxAbsCurve < 0.0085 &&
    Math.abs(headingErr) < 0.16 &&
    car.nitro > 24 &&
    raceTime > 2.2 &&
    brake < 0.05
  ) {
    boost = true;
  }

  return { throttle, brake, steer, drift, boost };
}

export function stepCarPhysics(
  car: CarState,
  input: InputState,
  track: TrackData,
  allCars: CarState[],
  dt: number,
  raceTime: number,
  canDrive: boolean,
  events: PhysicsEvent[]
): void {
  const spec = getCarSpec(car.modelId);
  car.hitFlash = Math.max(0, car.hitFlash - dt * 4.5);

  if (!canDrive) {
    car.speed = 0;
    car.vx = 0;
    car.vz = 0;
    car.airY = 0;
    car.airVy = 0;
    car.braking = false;
    car.isBoosting = false;
    car.isDrifting = false;
    car.rpm = 0.2 + input.throttle * 0.48;
    return;
  }

  let paceMult = car.isPlayer ? 1.0 : car.paceFactor;
  if (!car.isPlayer) {
    const player = allCars.find((c) => c.isPlayer);
    if (player && !player.finished) {
      const gap = car.totalProgress - player.totalProgress;
      if (gap > 85) {
        const ease = Math.min(0.08, ((gap - 85) / 140) * 0.08);
        paceMult *= 1.0 - ease;
      } else if (gap < -35) {
        const push = Math.min(0.11, ((-gap - 35) / 110) * 0.11);
        paceMult *= 1.0 + push;
      }
    }
  }

  // Slipstream detection
  let inSlipstream = false;
  if (car.speed > 26 && car.airY <= 0.1) {
    for (const other of allCars) {
      if (other.id === car.id) continue;
      const ds = (other.trackS - car.trackS + track.totalLength) % track.totalLength;
      if (ds > 6 && ds < 32 && Math.abs(other.lateralOffset - car.lateralOffset) < 2.9) {
        inSlipstream = true;
        break;
      }
    }
  }
  car.slipstreamTimer = inSlipstream
    ? Math.min(2.0, car.slipstreamTimer + dt)
    : Math.max(0, car.slipstreamTimer - dt * 2.5);
  const slipstreamBonus = car.slipstreamTimer > 0.3 ? 7.5 : 0;
  if (inSlipstream) {
    car.nitro = Math.min(100, car.nitro + dt * 8.0);
  }

  // Timers
  car.boostPadTimer = Math.max(0, car.boostPadTimer - dt);
  car.driftMiniTurboTimer = Math.max(0, car.driftMiniTurboTimer - dt);

  const wantsBoost = input.boost && car.nitro > 2 && input.brake < 0.2;
  car.isBoosting = wantsBoost || car.boostPadTimer > 0 || car.driftMiniTurboTimer > 0;
  if (wantsBoost) {
    car.nitro = Math.max(0, car.nitro - dt * 28);
  } else {
    car.nitro = Math.min(100, car.nitro + dt * (car.speed > 20 ? 3.0 : 1.0));
  }

  const boostExtraSpeed =
    (wantsBoost ? spec.nitroPower : 0) +
    (car.boostPadTimer > 0 ? 19 : 0) +
    (car.driftMiniTurboTimer > 0 ? 16 : 0) +
    slipstreamBonus;

  const boostExtraAccel =
    (wantsBoost ? 27 : 0) +
    (car.boostPadTimer > 0 ? 30 : 0) +
    (car.driftMiniTurboTimer > 0 ? 22 : 0);

  const offRoad = Math.abs(car.lateralOffset) > ROAD_HALF_WIDTH + 0.5 && car.airY <= 0.1;
  const surfaceMult = offRoad ? 0.85 : 1.0;

  const maxSpeed = (spec.topSpeedMs * paceMult + boostExtraSpeed) * surfaceMult;
  const maxReverse = -22;

  const accelBase = spec.accelMs2 * paceMult + boostExtraAccel;
  car.braking = false;

  if (input.throttle > 0.02) {
    const speedFrac = Math.max(0, car.speed / Math.max(1, maxSpeed));
    const torque = Math.max(0.3, 1.18 - speedFrac * 0.82);
    car.speed += input.throttle * accelBase * torque * dt;
  }

  if (input.brake > 0.02) {
    if (car.speed > 1.5) {
      car.speed -= input.brake * 50 * dt;
      car.braking = true;
    } else {
      car.speed -= input.brake * 18 * dt;
      car.braking = true;
    }
  }

  const dragCoeff = input.throttle < 0.05 ? 0.52 : 0.13;
  car.speed -= car.speed * dragCoeff * dt;
  if (Math.abs(car.speed) < 0.15 && input.throttle < 0.05 && input.brake < 0.05) {
    car.speed = 0;
  }
  car.speed = Math.max(maxReverse, Math.min(maxSpeed, car.speed));

  // Airborne jump physics!
  const isAirborne = car.airY > 0.02 || car.airVy > 0.05;
  if (isAirborne) {
    car.airY += car.airVy * dt;
    car.airVy -= 26.5 * dt; // Arcade gravity for crisp, hang-time feel
    car.airtimeRun += dt;
    car.nitro = Math.min(100, car.nitro + dt * 16); // Earn Nitro in midair!

    if (car.airY <= 0) {
      car.airY = 0;
      car.airVy = 0;
      if (car.airtimeRun > 0.35) {
        const pts = Math.round(car.airtimeRun * 380);
        car.skillScore += pts;
        car.nitro = Math.min(100, car.nitro + 12);
        events.push({
          type: 'jump-land',
          intensity: Math.min(1, car.airtimeRun),
          x: car.x,
          y: car.y + 0.2,
          z: car.z,
          points: pts,
          isPlayer: car.isPlayer,
        });
      }
      car.airtimeRun = 0;
    }
  }

  // Drift state machine (only grounded!) — super intuitive & controllable
  const clampedSteer = Math.max(-1, Math.min(1, input.steer));
  const canDrift =
    !isAirborne && car.speed > 13 && (input.drift || (car.isDrifting && Math.abs(clampedSteer) > 0.1));
  const enteringDrift = !isAirborne && input.drift && car.speed > 14 && Math.abs(clampedSteer) > 0.06;
  const wasDrifting = car.isDrifting;

  if (enteringDrift || (wasDrifting && canDrift && input.drift)) {
    car.isDrifting = true;
    const chargeRate = (0.46 + Math.abs(clampedSteer) * 0.3) * spec.driftBoostMult;
    car.driftCharge = Math.min(1.0, car.driftCharge + dt * chargeRate);
    car.driftTier =
      car.driftCharge >= 0.85 ? 3 : car.driftCharge >= 0.45 ? 2 : car.driftCharge >= 0.18 ? 1 : 0;
    car.driftPointsRun += Math.round((car.speed * 2.1 + Math.abs(car.driftAngle) * 145) * dt * 10);
    car.nitro = Math.min(100, car.nitro + dt * 15);
    car.speed *= 1 - 0.075 * dt; // Keep thrilling momentum through drifts!
  } else {
    if (wasDrifting && car.driftTier >= 1) {
      const turboDur = car.driftTier === 3 ? 1.7 : car.driftTier === 2 ? 1.15 : 0.65;
      car.driftMiniTurboTimer = Math.max(car.driftMiniTurboTimer, turboDur);
      car.nitro = Math.min(100, car.nitro + car.driftTier * 13);
      const pts = Math.round(car.driftPointsRun);
      car.totalDriftPoints += pts;
      car.skillScore += pts;
      events.push({
        type: 'drift-release',
        intensity: car.driftTier / 3,
        x: car.x,
        y: car.y,
        z: car.z,
        tier: car.driftTier,
        points: pts,
        isPlayer: car.isPlayer,
      });
    } else if (wasDrifting && car.driftPointsRun > 0) {
      const pts = Math.round(car.driftPointsRun);
      car.totalDriftPoints += pts;
      car.skillScore += pts;
    }
    car.isDrifting = false;
    car.driftCharge = Math.max(0, car.driftCharge - dt * 2.6);
    car.driftTier = 0;
    car.driftPointsRun = 0;
  }

  // Smooth speed-sensitive steering (surgical at 320 km/h, agile in hairpins!)
  const speedNorm = Math.min(1, Math.abs(car.speed) / 11);
  const reverseSign = car.speed >= -0.1 ? 1 : -1;
  const airSteerMult = isAirborne ? 0.4 : 1.0;
  const brakeTurnBoost = car.braking && !isAirborne ? 1.16 : 1.0;
  const baseTurnRate = (car.isDrifting ? 2.34 : 1.92) * spec.handling * airSteerMult * brakeTurnBoost;
  const highSpeedStability = 1.0 - Math.min(0.24, (Math.abs(car.speed) / 120) * 0.24);
  const yawDelta = -clampedSteer * baseTurnRate * speedNorm * highSpeedStability * reverseSign * dt;
  car.heading = normalizeAngle(car.heading + yawDelta);

  const targetSteerVisual = -clampedSteer * 0.46;
  car.steerAngle += (targetSteerVisual - car.steerAngle) * Math.min(1, dt * 16);

  const targetDriftVisual = car.isDrifting ? -clampedSteer * 0.34 : 0;
  car.driftAngle += (targetDriftVisual - car.driftAngle) * Math.min(1, dt * 9.5);

  const moveHeading = car.heading - car.driftAngle * 0.38;
  const targetVx = Math.sin(moveHeading) * car.speed;
  const targetVz = Math.cos(moveHeading) * car.speed;

  // Snappier exit grip so releasing drift immediately hooks onto the road!
  const gripLambda = isAirborne ? 2.0 : car.isDrifting ? 5.8 : 14.5 * spec.handling;
  const blend = 1 - Math.exp(-gripLambda * dt);
  car.vx += (targetVx - car.vx) * blend;
  car.vz += (targetVz - car.vz) * blend;

  car.x += car.vx * dt;
  car.z += car.vz * dt;

  // Project onto track
  const proj = projectPointToTrack(track, car.x, car.z, car.trackSampleIdx);
  car.trackSampleIdx = proj.sampleIndex;
  car.trackS = proj.s;
  car.lateralOffset = proj.lateralOffset;
  car.y = proj.y;

  // Tight physical guardrail clamp (accounts for full car width + drift angle so tires/fenders NEVER pass through wall!)
  if (Math.abs(car.lateralOffset) > WALL_COLLISION_OFFSET) {
    const sign = Math.sign(car.lateralOffset);
    const excess = Math.abs(car.lateralOffset) - WALL_COLLISION_OFFSET;
    car.x -= proj.sample.rx * sign * excess;
    car.z -= proj.sample.rz * sign * excess;
    car.lateralOffset = sign * WALL_COLLISION_OFFSET;

    const trackHeading = Math.atan2(proj.sample.tx, proj.sample.tz);
    const angleDiff = normalizeAngle(trackHeading - car.heading);
    car.heading = normalizeAngle(car.heading + angleDiff * Math.min(1, 0.65 + dt * 8));
    car.driftAngle *= 0.62; // Pull tail cleanly back inside guardrail!

    const impactStrength = Math.min(1, (Math.abs(car.speed) / 58) * (0.22 + Math.abs(angleDiff)));
    const scrapeDrag = Math.exp(-(0.35 + Math.abs(angleDiff) * 1.55) * dt);
    car.speed *= scrapeDrag;
    car.vx = Math.sin(car.heading) * car.speed;
    car.vz = Math.cos(car.heading) * car.speed;

    if (impactStrength > 0.22 && car.hitFlash <= 0.1) {
      car.hitFlash = Math.min(1, impactStrength);
      events.push({
        type: 'wall-hit',
        intensity: impactStrength,
        x: car.x,
        y: car.y + 0.5,
        z: car.z,
        isPlayer: car.isPlayer,
      });
    }
  }

  // Trigger Boost Pads
  if (!isAirborne) {
    for (const pad of track.boostPads) {
      const dx = car.x - pad.x;
      const dz = car.z - pad.z;
      if (dx * dx + dz * dz < 15.0 && car.boostPadTimer < 0.7) {
        car.boostPadTimer = 1.3;
        car.nitro = Math.min(100, car.nitro + 26);
        car.speed = Math.min(maxSpeed + 15, car.speed + 13);
        car.skillScore += 150;
        events.push({
          type: 'boost-pad',
          intensity: 0.9,
          x: pad.x,
          y: pad.y + 0.3,
          z: pad.z,
          points: 150,
          isPlayer: car.isPlayer,
        });
      }
    }

    // Trigger Jump Ramps!
    for (const ramp of track.jumpRamps) {
      const dx = car.x - ramp.x;
      const dz = car.z - ramp.z;
      if (dx * dx + dz * dz < 22.0 && car.speed > 26 && car.airY <= 0.05) {
        const speedScale = Math.min(1.25, car.speed / 58);
        car.airVy = ramp.launchVy * speedScale;
        car.airY = 0.22;
        car.airtimeRun = 0.01;
        car.boostPadTimer = Math.max(car.boostPadTimer, 0.7);
        events.push({
          type: 'jump-launch',
          intensity: 0.85,
          x: ramp.x,
          y: ramp.y + 0.5,
          z: ramp.z,
          isPlayer: car.isPlayer,
        });
      }
    }
  }

  // Wheel spin, roll, pitch (including airborne nose-up pitch!)
  car.wheelSpin += (car.speed / 0.36) * dt;
  const targetRoll =
    clampedSteer * Math.min(1, Math.abs(car.speed) / 45) * (car.isDrifting ? 0.09 : 0.055);
  car.bodyRoll += (targetRoll - car.bodyRoll) * Math.min(1, dt * 10);

  const targetPitch = isAirborne
    ? Math.max(-0.24, Math.min(0.18, -car.airVy * 0.02))
    : car.braking
      ? 0.045
      : car.isBoosting
        ? -0.048
        : input.throttle > 0.1
          ? -0.022
          : 0;
  car.bodyPitch += (targetPitch - car.bodyPitch) * Math.min(1, dt * 8);

  const { gear, rpm } = computeGearAndRpm(car.speed, spec.topSpeedMs * 1.15);
  car.gear = gear;
  car.rpm = rpm;
  const displayKmh = Math.round(Math.abs(car.speed) * spec.speedDisplayScale);
  if (displayKmh > car.topSpeedKmh) car.topSpeedKmh = displayKmh;

  const dotForward =
    Math.sin(car.heading) * proj.sample.tx + Math.cos(car.heading) * proj.sample.tz;
  car.wrongWay = car.speed > 4 && dotForward < -0.35;

  updateCheckpointsAndLaps(car, track, raceTime, events);
}

export function updateCheckpointsAndLaps(
  car: CarState,
  track: TrackData,
  raceTime: number,
  events: PhysicsEvent[]
): void {
  if (car.finished) return;

  const n = track.samples.length;
  const cpIdx = track.checkpointIndices[car.nextCheckpoint];

  let diff = car.trackSampleIdx - cpIdx;
  if (diff < -n / 2) diff += n;
  if (diff > n / 2) diff -= n;

  if (diff >= 0 && diff < Math.floor(n / NUM_CHECKPOINTS) + 12) {
    if (car.nextCheckpoint === 0) {
      const lapDuration = raceTime - car.lapStartTime;
      if (lapDuration > 5) {
        car.lastLapTime = lapDuration;
        if (car.bestLapTime === null || lapDuration < car.bestLapTime) {
          car.bestLapTime = lapDuration;
        }
      }
      car.lapStartTime = raceTime;
      car.lap += 1;

      if (car.lap > TOTAL_LAPS) {
        car.lap = TOTAL_LAPS;
        car.finished = true;
        car.finishTime = raceTime;
        events.push({
          type: 'race-finish',
          intensity: 1,
          x: car.x,
          y: car.y,
          z: car.z,
          isPlayer: car.isPlayer,
        });
      } else {
        events.push({
          type: 'lap-complete',
          intensity: 0.85,
          x: car.x,
          y: car.y,
          z: car.z,
          lap: car.lap,
          isPlayer: car.isPlayer,
        });
      }
    }
    car.nextCheckpoint = (car.nextCheckpoint + 1) % NUM_CHECKPOINTS;
  }

  const completedLaps = car.finished ? TOTAL_LAPS : car.lap - 1;
  const relS =
    (((car.trackS - track.finishLineS) % track.totalLength) + track.totalLength) %
    track.totalLength;
  const adjustedS =
    car.nextCheckpoint === 1 && relS > track.totalLength * 0.75
      ? relS - track.totalLength
      : relS;
  car.totalProgress = completedLaps * track.totalLength + adjustedS;
}

export function detectOvertakeRewards(
  cars: CarState[],
  raceTime: number,
  events: PhysicsEvent[]
): void {
  if (raceTime < 1.5 || cars.length <= 1) return;
  const ordered = computeStandings(cars);
  ordered.forEach((car, idx) => {
    const rank = idx + 1;
    if (car.isPlayer && rank < car.lastPassedRank && car.speed > 25) {
      car.skillScore += 250;
      car.nitro = Math.min(100, car.nitro + 14);
      events.push({
        type: 'overtake',
        intensity: 0.8,
        x: car.x,
        y: car.y + 0.6,
        z: car.z,
        points: 250,
        isPlayer: true,
      });
    }
    car.lastPassedRank = rank;
  });
}

export function resolveCarCollisions(
  cars: CarState[],
  events: PhysicsEvent[],
  track?: TrackData
): void {
  const minDist = 2.65;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (Math.abs(a.airY - b.airY) > 1.6) continue; // Can jump right over rivals!
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001 && dist < minDist) {
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = (minDist - dist) * 0.55;

        a.x -= nx * overlap;
        a.z -= nz * overlap;
        b.x += nx * overlap;
        b.z += nz * overlap;

        const rvx = b.vx - a.vx;
        const rvz = b.vz - a.vz;
        const relAlongNormal = rvx * nx + rvz * nz;

        if (relAlongNormal < 0) {
          const impulse = -relAlongNormal * 0.65;
          a.vx -= nx * impulse;
          a.vz -= nz * impulse;
          b.vx += nx * impulse;
          b.vz += nz * impulse;

          a.speed *= 0.94;
          b.speed *= 0.94;

          const intensity = Math.min(1, Math.abs(relAlongNormal) / 28);
          if (intensity > 0.14) {
            a.hitFlash = Math.min(1, intensity);
            b.hitFlash = Math.min(1, intensity);
            events.push({
              type: 'car-hit',
              intensity,
              x: (a.x + b.x) * 0.5,
              y: (a.y + b.y) * 0.5 + 0.6,
              z: (a.z + b.z) * 0.5,
              isPlayer: a.isPlayer || b.isPlayer,
            });
          }
        }
      }
    }
  }

  // Re-clamp all cars strictly inside guardrails after collision separation so side-by-side contact never pushes a car through the wall
  if (track) {
    for (const car of cars) {
      const proj = projectPointToTrack(track, car.x, car.z, car.trackSampleIdx);
      if (Math.abs(proj.lateralOffset) > WALL_COLLISION_OFFSET) {
        const sign = Math.sign(proj.lateralOffset);
        const excess = Math.abs(proj.lateralOffset) - WALL_COLLISION_OFFSET;
        car.x -= proj.sample.rx * sign * excess;
        car.z -= proj.sample.rz * sign * excess;
        car.lateralOffset = sign * WALL_COLLISION_OFFSET;
      }
    }
  }
}

export function computeStandings(cars: CarState[]): CarState[] {
  return [...cars].sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishTime ?? 9999) - (b.finishTime ?? 9999);
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.totalProgress - a.totalProgress;
  });
}

export function buildRaceResult(
  cars: CarState[],
  mode: GameMode,
  track: TrackData,
  raceTime: number
): RaceResult {
  const ordered = computeStandings(cars);
  const playerIdx = ordered.findIndex((c) => c.isPlayer);
  const player = ordered[playerIdx] ?? cars[0];
  const position = playerIdx >= 0 ? playerIdx + 1 : 1;

  const standings = ordered.map((c, idx) => {
    let finalTime = c.finishTime ?? raceTime;
    if (!c.finished) {
      const remaining = Math.max(0, player.totalProgress - c.totalProgress);
      const estSpeed = Math.max(35, Math.abs(c.speed));
      finalTime = raceTime + remaining / estSpeed;
    }
    return {
      id: c.id,
      name: c.name,
      isPlayer: c.isPlayer,
      position: idx + 1,
      time: finalTime,
      color: c.liveryColor,
    };
  });

  const spec = getCarSpec(player.modelId);
  const trackMeta = getTrackMeta(track.id);

  return {
    mode,
    trackName: trackMeta.name,
    carName: spec.name,
    position,
    totalRacers: cars.length,
    totalTime: player.finishTime ?? raceTime,
    bestLapTime: player.bestLapTime,
    topSpeedKmh: player.topSpeedKmh,
    totalDriftPoints: Math.round(player.totalDriftPoints),
    skillScore: Math.round(player.skillScore),
    isPodium: mode === 'time-trial' || position <= 3,
    standings,
  };
}
