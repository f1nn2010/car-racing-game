import { TrackId } from './types';

export type MedalTier = 'gold' | 'silver' | 'bronze' | 'none';

export interface TrackRecord {
  bestLapSec: number | null;
  bestRaceSec: number | null;
  bestPosition: number | null;
  racesCompleted: number;
}

export type RecordsMap = Record<TrackId, TrackRecord>;

const STORAGE_KEY = 'coastline_apex_records_v1';

export function createEmptyRecords(): RecordsMap {
  return {
    riviera: { bestLapSec: null, bestRaceSec: null, bestPosition: null, racesCompleted: 0 },
    tokyo: { bestLapSec: null, bestRaceSec: null, bestPosition: null, racesCompleted: 0 },
    alps: { bestLapSec: null, bestRaceSec: null, bestPosition: null, racesCompleted: 0 },
  };
}

export function loadTrackRecords(): RecordsMap {
  const base = createEmptyRecords();
  if (typeof window === 'undefined' || !window.localStorage) return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<RecordsMap>;
    for (const id of ['riviera', 'tokyo', 'alps'] as TrackId[]) {
      const rec = parsed[id];
      if (rec && typeof rec === 'object') {
        base[id] = {
          bestLapSec: typeof rec.bestLapSec === 'number' && Number.isFinite(rec.bestLapSec) ? rec.bestLapSec : null,
          bestRaceSec: typeof rec.bestRaceSec === 'number' && Number.isFinite(rec.bestRaceSec) ? rec.bestRaceSec : null,
          bestPosition: typeof rec.bestPosition === 'number' && Number.isFinite(rec.bestPosition) ? rec.bestPosition : null,
          racesCompleted: typeof rec.racesCompleted === 'number' && Number.isFinite(rec.racesCompleted) ? rec.racesCompleted : 0,
        };
      }
    }
  } catch {
    // Ignore storage read failures in restricted iframes
  }
  return base;
}

export function saveTrackRecords(records: RecordsMap): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage write failures
  }
}

export function mergeRaceIntoRecords(
  current: RecordsMap,
  trackId: TrackId,
  opts: {
    bestLapSec: number | null;
    totalRaceSec: number;
    position: number;
    isGrandPrix: boolean;
  }
): { updated: RecordsMap; newBestLap: boolean; newBestRace: boolean } {
  const prev = current[trackId] ?? {
    bestLapSec: null,
    bestRaceSec: null,
    bestPosition: null,
    racesCompleted: 0,
  };

  let newBestLap = false;
  let bestLapSec = prev.bestLapSec;
  if (opts.bestLapSec !== null && opts.bestLapSec > 5) {
    if (bestLapSec === null || opts.bestLapSec < bestLapSec - 0.01) {
      bestLapSec = opts.bestLapSec;
      newBestLap = true;
    }
  }

  let newBestRace = false;
  let bestRaceSec = prev.bestRaceSec;
  if (opts.totalRaceSec > 10) {
    if (bestRaceSec === null || opts.totalRaceSec < bestRaceSec - 0.01) {
      bestRaceSec = opts.totalRaceSec;
      newBestRace = true;
    }
  }

  let bestPosition = prev.bestPosition;
  if (opts.isGrandPrix) {
    if (bestPosition === null || opts.position < bestPosition) {
      bestPosition = opts.position;
    }
  }

  const updated: RecordsMap = {
    ...current,
    [trackId]: {
      bestLapSec,
      bestRaceSec,
      bestPosition,
      racesCompleted: prev.racesCompleted + 1,
    },
  };

  return { updated, newBestLap, newBestRace };
}

export function computeMedalTier(opts: {
  mode: 'grand-prix' | 'time-trial';
  position: number;
  bestLapSec: number | null;
}): MedalTier {
  if (opts.mode === 'grand-prix') {
    if (opts.position === 1) return 'gold';
    if (opts.position === 2) return 'silver';
    if (opts.position === 3) return 'bronze';
    return 'none';
  }
  // Time Trial medal targets for ~2.2km circuits
  if (opts.bestLapSec === null) return 'bronze';
  if (opts.bestLapSec <= 38) return 'gold';
  if (opts.bestLapSec <= 46) return 'silver';
  return 'bronze';
}
