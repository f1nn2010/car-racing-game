import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PhysicsEvent,
  buildRaceCars,
  buildRaceResult,
  computeAiInput,
  computeGearAndRpm,
  detectOvertakeRewards,
  resolveCarCollisions,
  stepCarPhysics,
  updateCheckpointsAndLaps,
} from './physics';
import {
  BARRIER_OFFSET,
  NUM_CHECKPOINTS,
  TOTAL_LAPS,
  WALL_COLLISION_OFFSET,
  createTrack,
} from './track';
import { buildRivalLineup, getCarSpec } from './types';

test('iconic car lineup pairs player car with 3 distinct other iconic models', () => {
  const rivals = buildRivalLineup('gt3rs');
  assert.equal(rivals.length, 3);
  const ids = rivals.map((r) => r.modelId);
  assert.ok(!ids.includes('gt3rs'));
  assert.ok(ids.includes('chiron'));
  assert.ok(ids.includes('f40'));
  assert.ok(ids.includes('svj'));
  assert.ok(getCarSpec('chiron').topSpeedMs > getCarSpec('gt3rs').topSpeedMs);
  assert.ok(getCarSpec('gt3rs').handling > getCarSpec('chiron').handling);
});

test('car accelerates, shifts gears, drifts to charge mini-turbo, and consumes nitro boost', () => {
  const track = createTrack('riviera', 420);
  const cars = buildRaceCars(track, 'time-trial', 'gt3rs', 'weissach', []);
  const player = cars[0];
  const events: PhysicsEvent[] = [];

  for (let i = 0; i < 34; i++) {
    stepCarPhysics(
      player,
      { throttle: 1, brake: 0, steer: 0, drift: false, boost: false },
      track,
      cars,
      0.05,
      i * 0.05,
      true,
      events
    );
  }
  assert.ok(player.speed > 38, `Expected strong acceleration, got ${player.speed}`);
  assert.ok(player.gear >= 3, `Expected gear >= 3, got ${player.gear}`);

  // Initiate drift while turning right with continuous analog steer
  for (let i = 0; i < 16; i++) {
    stepCarPhysics(
      player,
      { throttle: 1, brake: 0, steer: 0.85, drift: true, boost: false },
      track,
      cars,
      0.05,
      1.7 + i * 0.05,
      true,
      events
    );
  }
  assert.equal(player.isDrifting, true);
  assert.ok(player.driftCharge > 0.25, `Expected drift charge > 0.25, got ${player.driftCharge}`);
  assert.ok(player.driftTier >= 1);

  // Release drift -> triggers mini-turbo event!
  stepCarPhysics(
    player,
    { throttle: 1, brake: 0, steer: 0, drift: false, boost: false },
    track,
    cars,
    0.05,
    3.6,
    true,
    events
  );
  assert.equal(player.isDrifting, false);
  assert.ok(player.driftMiniTurboTimer > 0, 'releasing charged drift should trigger mini-turbo');
  assert.ok(events.some((e) => e.type === 'drift-release'));

  // Fire nitro boost
  const nitroBefore = player.nitro;
  stepCarPhysics(
    player,
    { throttle: 1, brake: 0, steer: 0, drift: false, boost: true },
    track,
    cars,
    0.05,
    3.7,
    true,
    events
  );
  assert.equal(player.isBoosting, true);
  assert.ok(player.nitro < nitroBefore);
});

test('jump ramps launch cars airborne and award airtime skill score & nitro on landing', () => {
  const track = createTrack('tokyo', 420);
  const cars = buildRaceCars(track, 'time-trial', 'chiron', 'french-blue', []);
  const player = cars[0];
  const events: PhysicsEvent[] = [];

  const ramp = track.jumpRamps[0];
  player.x = ramp.x;
  player.z = ramp.z;
  player.y = ramp.y;
  player.heading = ramp.heading;
  player.trackSampleIdx = ramp.sampleIndex;
  player.speed = 62;
  player.vx = Math.sin(ramp.heading) * 62;
  player.vz = Math.cos(ramp.heading) * 62;

  // Step through launch and full jump arc until landing
  let sawAirborne = false;
  for (let i = 0; i < 40; i++) {
    stepCarPhysics(
      player,
      { throttle: 1, brake: 0, steer: 0, drift: false, boost: false },
      track,
      cars,
      0.05,
      i * 0.05,
      true,
      events
    );
    if (player.airY > 0.4) sawAirborne = true;
  }

  assert.equal(sawAirborne, true, 'car should launch airborne off jump ramp');
  assert.ok(events.some((e) => e.type === 'jump-launch'));
  assert.ok(events.some((e) => e.type === 'jump-land'));
  assert.ok(player.skillScore > 0, 'airtime landing should award skill score');
});

test('overtaking rivals awards overtake skill score and nitro bonus', () => {
  const track = createTrack('alps', 420);
  const rivals = buildRivalLineup('gt3rs');
  const cars = buildRaceCars(track, 'grand-prix', 'gt3rs', 'weissach', rivals);
  const player = cars.find((c) => c.isPlayer)!;
  const events: PhysicsEvent[] = [];

  player.lastPassedRank = 4;
  player.totalProgress = 500;
  player.speed = 58;
  const nitroBefore = player.nitro;
  detectOvertakeRewards(cars, 4.0, events);

  assert.ok(events.some((e) => e.type === 'overtake'));
  assert.ok(player.skillScore >= 250);
  assert.ok(player.nitro > nitroBefore);
});

test('guardrail clamping keeps full car width inside side walls and car-to-car collisions stay inside barriers', () => {
  const track = createTrack('riviera', 720);
  const rivals = buildRivalLineup('chiron');
  const cars = buildRaceCars(track, 'grand-prix', 'chiron', 'french-blue', rivals);
  const events: PhysicsEvent[] = [];

  const player = cars.find((c) => c.isPlayer)!;
  const s = track.samples[player.trackSampleIdx];
  player.x = s.x + s.rx * (BARRIER_OFFSET + 4.5);
  player.z = s.z + s.rz * (BARRIER_OFFSET + 4.5);
  player.speed = 35;
  stepCarPhysics(
    player,
    { throttle: 1, brake: 0, steer: 0, drift: false, boost: false },
    track,
    cars,
    0.05,
    1.0,
    true,
    events
  );
  // Car center must be strictly inside WALL_COLLISION_OFFSET so fenders/wheels never pass through BARRIER_OFFSET!
  assert.ok(
    Math.abs(player.lateralOffset) <= WALL_COLLISION_OFFSET + 0.05,
    `Expected |lateralOffset| <= ${WALL_COLLISION_OFFSET}, got ${player.lateralOffset}`
  );
  assert.ok(WALL_COLLISION_OFFSET <= BARRIER_OFFSET - 1.3);

  // Overlap two cars right beside the wall and verify collision separation also stays strictly inside the wall!
  const a = cars[0];
  const b = cars[1];
  const sa = track.samples[a.trackSampleIdx];
  a.x = sa.x + sa.rx * (WALL_COLLISION_OFFSET - 0.5);
  a.z = sa.z + sa.rz * (WALL_COLLISION_OFFSET - 0.5);
  b.x = sa.x + sa.rx * (WALL_COLLISION_OFFSET - 0.05);
  b.z = sa.z + sa.rz * (WALL_COLLISION_OFFSET - 0.05);
  a.vx = 15;
  b.vx = -15;
  resolveCarCollisions(cars, events, track);
  assert.ok(
    Math.abs(b.lateralOffset) <= WALL_COLLISION_OFFSET + 0.05,
    `Expected post-collision car inside wall limit, got ${b.lateralOffset}`
  );
});

test('finish line triggers ONLY upon crossing the exact 3D Start/Finish gantry index and never prematurely', () => {
  const track = createTrack('alps', 720);
  const cars = buildRaceCars(track, 'time-trial', 'f40', 'corsa', []);
  const player = cars[0];
  const events: PhysicsEvent[] = [];

  assert.equal(track.checkpointIndices[0], track.finishLineIndex);

  // Crossing finish line immediately from grid (before passing checkpoints 1..7) must NOT advance lap
  player.trackSampleIdx = track.finishLineIndex;
  updateCheckpointsAndLaps(player, track, 12.0, events);
  assert.equal(player.lap, 1);
  assert.equal(player.finished, false);

  let t = 5;
  for (let lap = 1; lap <= TOTAL_LAPS; lap++) {
    // Pass checkpoints 1..7
    for (let cp = 1; cp < NUM_CHECKPOINTS; cp++) {
      player.trackSampleIdx = track.checkpointIndices[cp];
      player.trackS = track.samples[player.trackSampleIdx].s;
      t += 4.2;
      updateCheckpointsAndLaps(player, track, t, events);
    }

    // Position car 10 samples (~30m) BEFORE the visual Start/Finish gantry -> MUST NOT complete lap yet!
    const preFinishIdx = (track.finishLineIndex - 10 + track.samples.length) % track.samples.length;
    player.trackSampleIdx = preFinishIdx;
    player.trackS = track.samples[preFinishIdx].s;
    t += 1.0;
    updateCheckpointsAndLaps(player, track, t, events);
    assert.equal(player.lap, lap, `Should NOT advance lap ${lap} before crossing visual finish gantry`);
    assert.equal(player.finished, false);

    // Now cross the exact Start/Finish gantry index!
    player.trackSampleIdx = track.finishLineIndex;
    player.trackS = track.finishLineS;
    t += 0.6;
    updateCheckpointsAndLaps(player, track, t, events);
  }

  assert.equal(player.finished, true);
  assert.ok(player.bestLapTime !== null && player.bestLapTime > 10);
  assert.ok(events.some((e) => e.type === 'race-finish'));

  const result = buildRaceResult(cars, 'time-trial', track, t);
  assert.equal(result.position, 1);
  assert.equal(result.isPodium, true);
  assert.equal(result.carName, 'Ferrari F40');
  assert.equal(result.trackName, 'Alpen Pass');
});

test('upgraded AI bots race cleanly at high speed around corners without wall-pinballing or stalling', () => {
  const track = createTrack('riviera', 720);
  const rivals = buildRivalLineup('svj');
  const cars = buildRaceCars(track, 'grand-prix', 'svj', 'verde', rivals);
  const events: PhysicsEvent[] = [];

  // Simulate 25 seconds of high-speed wheel-to-wheel AI racing (500 steps @ 0.05s)
  let t = 0;
  for (let step = 0; step < 500; step++) {
    t += 0.05;
    for (const car of cars) {
      const ai = computeAiInput(car, cars, track, t);
      assert.ok(ai.steer >= -1 && ai.steer <= 1);
      assert.ok(ai.throttle >= 0 && ai.throttle <= 1);
      assert.ok(ai.brake >= 0 && ai.brake <= 1);
      stepCarPhysics(car, ai, track, cars, 0.05, t, true, events);
    }
    resolveCarCollisions(cars, events, track);
  }

  // Every bot must cover > 1,350 meters in 25 seconds (> 54 m/s average!) and stay inside guardrails!
  for (const car of cars) {
    assert.ok(
      car.totalProgress > 1350,
      `Expected fast AI bot ${car.name} to cover >1350m in 25s, got ${car.totalProgress.toFixed(1)}m`
    );
    assert.ok(
      Math.abs(car.lateralOffset) <= WALL_COLLISION_OFFSET + 0.05,
      `Expected bot ${car.name} inside guardrails, got lat=${car.lateralOffset.toFixed(2)}`
    );
    assert.equal(car.wrongWay, false, `Bot ${car.name} must never drive wrong way`);
  }

  const wallHits = events.filter((e) => e.type === 'wall-hit').length;
  assert.ok(wallHits <= 6, `Expected clean cornering with minimal wall hits (<=6), got ${wallHits}`);

  const gr = computeGearAndRpm(65, 80);
  assert.ok(gr.gear >= 4 && gr.gear <= 6);
  assert.ok(gr.rpm > 0.3 && gr.rpm <= 1.0);
});
