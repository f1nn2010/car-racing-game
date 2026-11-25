import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BARRIER_OFFSET,
  NUM_CHECKPOINTS,
  ROAD_HALF_WIDTH,
  createCoastalTrack,
  createTrack,
  getStartGridTransform,
  groundHeightAt,
  projectPointToTrack,
} from './track';
import { TrackId } from './types';

test('all 3 circuits (riviera, tokyo, alps) generate closed loops with jump ramps, chevrons, and boost pads', () => {
  const ids: TrackId[] = ['riviera', 'tokyo', 'alps'];
  for (const id of ids) {
    const track = createTrack(id, 420);
    assert.equal(track.id, id);
    assert.equal(track.samples.length, 420);
    assert.ok(
      track.totalLength > 600 && track.totalLength < 1600,
      `Unexpected ${id} track length ${track.totalLength}`
    );
    assert.equal(track.checkpointIndices.length, NUM_CHECKPOINTS);
    assert.ok(track.boostPads.length >= 4, `${id} should have boost pads`);
    assert.ok(track.jumpRamps.length >= 2, `${id} should have jump ramps`);
    assert.ok(track.cornerChevrons.length >= 4, `${id} should have corner chevrons`);

    for (const s of track.samples) {
      const tLen = Math.hypot(s.tx, s.ty, s.tz);
      const rLen = Math.hypot(s.rx, s.rz);
      assert.ok(Math.abs(tLen - 1) < 0.01, `${id} tangent should be unit length`);
      assert.ok(Math.abs(rLen - 1) < 0.01, `${id} right vector should be unit length`);
      assert.equal(s.halfWidth, ROAD_HALF_WIDTH);
    }

    // Start grid check on every circuit
    for (let slot = 0; slot < 4; slot++) {
      const grid = getStartGridTransform(track, slot);
      const proj = projectPointToTrack(track, grid.x, grid.z, grid.sampleIndex);
      assert.ok(
        Math.abs(proj.lateralOffset) < BARRIER_OFFSET - 1,
        `${id} car slot ${slot} must spawn inside guardrails`
      );
      const dot = Math.sin(grid.heading) * proj.sample.tx + Math.cos(grid.heading) * proj.sample.tz;
      assert.ok(dot > 0.94, `${id} car slot ${slot} must face cleanly down the road tangent`);
    }
  }
});

test('projectPointToTrack accurately recovers lateral offset and road elevation', () => {
  const track = createCoastalTrack(420);
  const sample = track.samples[100];
  const offsetMeters = 4.2;
  const px = sample.x + sample.rx * offsetMeters;
  const pz = sample.z + sample.rz * offsetMeters;

  const proj = projectPointToTrack(track, px, pz, 96);
  assert.ok(Math.abs(proj.lateralOffset - offsetMeters) < 0.35, `Expected ~4.2, got ${proj.lateralOffset}`);
  assert.ok(Math.abs(proj.y - sample.y) < 0.35);
});

test('groundHeightAt stays below road surface across biomes and shapes coastal ocean & alpine peaks', () => {
  const riviera = createTrack('riviera', 420);
  const s = riviera.samples[40];
  assert.ok(
    groundHeightAt(riviera, s.x, s.z) < s.y,
    'terrain beneath asphalt must stay slightly below road surface'
  );
  assert.ok(groundHeightAt(riviera, -120, 40) < -1.5, 'west coastline should slope below sea level');

  const tokyo = createTrack('tokyo', 420);
  assert.ok(groundHeightAt(tokyo, 0, 0) < -3.0, 'Tokyo bay water sits below viaduct expressway');

  const alps = createTrack('alps', 420);
  const peak = groundHeightAt(alps, 245, 95);
  assert.ok(peak > 45, `Alpen Pass should feature towering alpine peaks, got ${peak}`);
});
