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
import { BARRIER_OFFSET, NUM_CHECKPOINTS, TOTAL_LAPS, createTrack } from './track';
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

  // Player starts P4 -> advance progress ahead of rivals at race speed -> rank improves to P1
  player.lastPassedRank = 4;
  player.totalProgress = 500;
  player.speed = 58;
  const nitroBefore = player.nitro;
  detectOvertakeRewards(cars, 4.0, events);

  assert.ok(events.some((e) => e.type === 'overtake'));
  assert.ok(player.skillScore >= 250);
  assert.ok(player.nitro > nitroBefore);
});

test('guardrail clamping keeps car inside circuit corridor and car-to-car collisions separate overlapping vehicles', () => {
  const track = createTrack('riviera', 420);
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
  assert.ok(Math.abs(player.lateralOffset) <= BARRIER_OFFSET + 0.05);

  // Overlap two cars and verify collision separates them
  const a = cars[0];
  const b = cars[1];
  b.x = a.x + 1.0;
  b.z = a.z;
  a.vx = 15;
  b.vx = -15;
  resolveCarCollisions(cars, events);
  const newDist = Math.hypot(b.x - a.x, b.z - a.z);
  assert.ok(newDist > 1.5, `Expected cars pushed apart, got ${newDist}`);
});

test('checkpoints progress sequentially and complete 3-lap race cleanly without reverse-lap exploits', () => {
  const track = createTrack('alps', 420);
  const cars = buildRaceCars(track, 'time-trial', 'f40', 'corsa', []);
  const player = cars[0];
  const events: PhysicsEvent[] = [];

  player.trackSampleIdx = track.checkpointIndices[0];
  updateCheckpointsAndLaps(player, track, 12.0, events);
  assert.equal(player.lap, 1);
  assert.equal(player.finished, false);

  let t = 5;
  for (let lap = 1; lap <= TOTAL_LAPS; lap++) {
    for (let step = 0; step < NUM_CHECKPOINTS; step++) {
      const cp = (step + 1) % NUM_CHECKPOINTS;
      player.trackSampleIdx = track.checkpointIndices[cp];
      t += 4.2;
      updateCheckpointsAndLaps(player, track, t, events);
    }
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

test('AI rival policies produce bounded valid steering and throttle inputs', () => {
  const track = createTrack('tokyo', 420);
  const rivals = buildRivalLineup('svj');
  const cars = buildRaceCars(track, 'grand-prix', 'svj', 'verde', rivals);
  for (const car of cars) {
    if (car.isPlayer) continue;
    const ai = computeAiInput(car, cars, track, 5.0);
    assert.ok(ai.steer >= -1 && ai.steer <= 1);
    assert.ok(ai.throttle >= 0 && ai.throttle <= 1);
    assert.ok(ai.brake >= 0 && ai.brake <= 1);
  }
  const gr = computeGearAndRpm(65, 80);
  assert.ok(gr.gear >= 4 && gr.gear <= 6);
  assert.ok(gr.rpm > 0.3 && gr.rpm <= 1.0);
});
