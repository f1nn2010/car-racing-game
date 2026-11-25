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
  isClearOfTrack,
  projectPointToTrack,
} from './track';
import { TrackId } from './types';

test('all 3 circuits (riviera, tokyo, alps) generate extended closed loops with zero self-overlap, jump ramps, chevrons, and boost pads', () => {
  const ids: TrackId[] = ['riviera', 'tokyo', 'alps'];
  for (const id of ids) {
    const track = createTrack(id, 720);
    assert.equal(track.id, id);
    assert.equal(track.samples.length, 720);
    assert.ok(
      track.totalLength > 1800 && track.totalLength < 2900,
      `Expected extended ${id} track length (1800-2900m), got ${track.totalLength}`
    );
    assert.equal(track.checkpointIndices.length, NUM_CHECKPOINTS);
    assert.ok(track.boostPads.length >= 8, `${id} should have boost pads`);
    assert.ok(track.jumpRamps.length >= 3, `${id} should have 3 jump ramps`);
    assert.ok(track.cornerChevrons.length >= 6, `${id} should have corner chevrons`);

    for (const s of track.samples) {
      const tLen = Math.hypot(s.tx, s.ty, s.tz);
      const rLen = Math.hypot(s.rx, s.rz);
      assert.ok(Math.abs(tLen - 1) < 0.01, `${id} tangent should be unit length`);
      assert.ok(Math.abs(rLen - 1) < 0.01, `${id} right vector should be unit length`);
      assert.equal(s.halfWidth, ROAD_HALF_WIDTH);
    }

    // Verify ZERO self-intersections or confusing narrow parallel road overlaps!
    const n = track.samples.length;
    const minIndexSep = 55; // ~165m apart along track
    for (let i = 0; i < n; i += 4) {
      const a = track.samples[i];
      for (let j = i + minIndexSep; j < n; j += 4) {
        if (n - (j - i) < minIndexSep) continue;
        const b = track.samples[j];
        const dist = Math.hypot(a.x - b.x, a.z - b.z);
        assert.ok(
          dist > 44,
          `${id} non-adjacent road segments (${i}, ${j}) too close (${dist.toFixed(1)}m)`
        );
      }
    }

    // Verify every corner chevron stays strictly outside ALL parts of the road corridor!
    for (const ch of track.cornerChevrons) {
      assert.ok(
        isClearOfTrack(track, ch.x, ch.z, BARRIER_OFFSET + 1.5),
        `${id} corner chevron at (${ch.x.toFixed(1)}, ${ch.z.toFixed(1)}) must not overlap road`
      );
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
  const track = createCoastalTrack(720);
  const sample = track.samples[180];
  const offsetMeters = 4.2;
  const px = sample.x + sample.rx * offsetMeters;
  const pz = sample.z + sample.rz * offsetMeters;

  const proj = projectPointToTrack(track, px, pz, 174);
  assert.ok(Math.abs(proj.lateralOffset - offsetMeters) < 0.35, `Expected ~4.2, got ${proj.lateralOffset}`);
  assert.ok(Math.abs(proj.y - sample.y) < 0.35);
});

test('groundHeightAt stays strictly below road surface everywhere across all 3 circuits', () => {
  const ids: TrackId[] = ['riviera', 'tokyo', 'alps'];
  for (const id of ids) {
    const track = createTrack(id, 720);
    for (let i = 0; i < track.samples.length; i += 6) {
      const s = track.samples[i];
      for (const lat of [-ROAD_HALF_WIDTH, 0, ROAD_HALF_WIDTH]) {
        const px = s.x + s.rx * lat;
        const pz = s.z + s.rz * lat;
        const gh = groundHeightAt(track, px, pz);
        assert.ok(
          gh < s.y - 0.15,
          `${id} terrain (${gh.toFixed(2)}) poked too close to road (${s.y.toFixed(2)}) at idx ${i} lat ${lat}`
        );
      }
    }
  }

  const riviera = createTrack('riviera', 720);
  assert.ok(groundHeightAt(riviera, -140, 40) < -1.5, 'west coastline should slope below sea level');

  const tokyo = createTrack('tokyo', 720);
  assert.ok(groundHeightAt(tokyo, 0, 0) < -3.0, 'Tokyo bay water sits below viaduct expressway');

  const alps = createTrack('alps', 720);
  const peak = groundHeightAt(alps, 495, 220);
  assert.ok(peak > 60, `Alpen Pass should feature towering alpine peaks, got ${peak}`);
});
