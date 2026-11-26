import React from 'react';
import { computeMedalTier } from '../game/records';
import { RaceResult } from '../game/types';
import { formatRaceTime } from './RaceHud';

interface PauseModalProps {
  trackName: string;
  carName: string;
  lap: number;
  totalLaps: number;
  raceTime: number;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  trackName,
  carName,
  lap,
  totalLaps,
  raceTime,
  onResume,
  onRestart,
  onTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 14, 22, 0.72)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Race Paused"
    >
      <div
        className="w-full max-w-sm rounded-lg border border-white/15 overflow-hidden shadow-2xl"
        style={{ backgroundColor: '#111927' }}
      >
        <div className="h-1.5 w-full bg-[#d92626]" />
        <div className="p-6 flex flex-col gap-5">
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#9eb0c7]">
              {trackName} · {carName}
            </div>
            <h2 className="font-display italic font-extrabold text-4xl tracking-wide text-[#f8f4e8] uppercase mt-0.5">
              RACE PAUSED
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded bg-[#182334] border border-white/10">
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#9eb0c7]">
                LAP
              </div>
              <div className="font-display font-bold text-2xl text-white tabular-nums mt-0.5">
                {lap} / {totalLaps}
              </div>
            </div>
            <div className="p-3 rounded bg-[#182334] border border-white/10">
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#9eb0c7]">
                ELAPSED
              </div>
              <div className="font-display font-bold text-2xl text-white tabular-nums mt-0.5">
                {formatRaceTime(raceTime)}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded bg-[#d92626] hover:bg-[#eb3333] text-white font-display italic font-extrabold text-xl tracking-wider uppercase cursor-pointer transition-colors"
            >
              Resume Race
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-2.5 rounded bg-[#1c283b] hover:bg-[#25354e] border border-white/15 text-[#f4efe2] font-display font-bold text-lg tracking-wider uppercase cursor-pointer transition-colors"
            >
              Restart Grid
            </button>
            <button
              type="button"
              onClick={onTitle}
              className="w-full py-2.5 rounded bg-transparent hover:bg-white/5 border border-white/10 text-[#b4c2d4] font-semibold text-sm tracking-wider uppercase cursor-pointer transition-colors"
            >
              Garage &amp; Circuit Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FinishModalProps {
  result: RaceResult;
  onRestart: () => void;
  onTitle: () => void;
}

export const FinishModal: React.FC<FinishModalProps> = ({ result, onRestart, onTitle }) => {
  const medal = computeMedalTier({
    mode: result.mode,
    position: result.position,
    bestLapSec: result.bestLapTime,
  });
  const medalColors: Record<string, { bg: string; text: string; label: string }> = {
    gold: { bg: '#f5b700', text: '#111824', label: 'GOLD TROPHY' },
    silver: { bg: '#cbd5e1', text: '#111824', label: 'SILVER MEDAL' },
    bronze: { bg: '#d97706', text: '#fffdf8', label: 'BRONZE MEDAL' },
  };
  const medalBadge = medal !== 'none' ? medalColors[medal] : null;

  const headline =
    result.mode === 'time-trial'
      ? 'TIME TRIAL COMPLETE'
      : result.position === 1
        ? 'GRAND PRIX VICTORY'
        : result.position <= 3
          ? `PODIUM FINISH · P${result.position}`
          : `RACE COMPLETE · P${result.position}`;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 14, 22, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Race Results"
    >
      <div
        className="w-full max-w-md rounded-lg border border-white/15 overflow-hidden shadow-2xl"
        style={{ backgroundColor: '#111927' }}
      >
        <div
          className="h-2 w-full"
          style={{ backgroundColor: result.position === 1 ? '#f5b700' : '#d92626' }}
        />
        <div className="p-6 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#f5c04e]">
                {result.trackName} · {result.carName}
              </div>
              {medalBadge && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-display font-extrabold tracking-wider uppercase"
                  style={{ backgroundColor: medalBadge.bg, color: medalBadge.text }}
                >
                  {medalBadge.label}
                </span>
              )}
            </div>
            <h2 className="font-display italic font-extrabold text-4xl tracking-wide text-[#f8f4e8] uppercase mt-0.5">
              {headline}
            </h2>
            {result.newTrackRecord && (
              <div className="mt-1 inline-block px-2 py-0.5 rounded bg-[#22c55e]/20 border border-[#4ade80]/50 text-[11px] font-bold tracking-widest uppercase text-[#86efac]">
                ★ NEW PERSONAL TRACK RECORD
              </div>
            )}
          </div>

          {/* Key Mastery Stat Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded bg-[#182334] border border-white/10">
              <div className="text-[9px] font-bold tracking-wider uppercase text-[#9eb0c7]">
                TOTAL TIME
              </div>
              <div className="font-display font-bold text-xl text-white tabular-nums mt-0.5">
                {formatRaceTime(result.totalTime)}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#182334] border border-white/10">
              <div className="text-[9px] font-bold tracking-wider uppercase text-[#9eb0c7]">
                BEST LAP
              </div>
              <div className="font-display font-bold text-xl text-[#f5c04e] tabular-nums mt-0.5">
                {result.bestLapTime !== null ? formatRaceTime(result.bestLapTime) : '--:--.-'}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#182334] border border-white/10">
              <div className="text-[9px] font-bold tracking-wider uppercase text-[#9eb0c7]">
                TOP SPEED
              </div>
              <div className="font-display font-bold text-xl text-[#38bdf8] tabular-nums mt-0.5">
                {result.topSpeedKmh}
                <span className="text-[10px] ml-0.5 text-[#9eb0c7]">KM/H</span>
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#182334] border border-white/10">
              <div className="text-[9px] font-bold tracking-wider uppercase text-[#9eb0c7]">
                SKILL SCORE
              </div>
              <div className="font-display font-bold text-xl text-[#4ade80] tabular-nums mt-0.5">
                {result.skillScore}
              </div>
            </div>
          </div>

          {/* Standings Classification */}
          {result.mode === 'grand-prix' && (
            <div className="rounded bg-[#0d1420] border border-white/10 divide-y divide-white/10">
              {result.standings.map((row) => (
                <div
                  key={row.id}
                  className={`px-3.5 py-2 flex items-center justify-between text-sm ${
                    row.isPlayer ? 'bg-[#d92626]/20 font-bold text-white' : 'text-[#c4d0e0]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-display italic font-extrabold text-base w-5 tabular-nums text-[#f5c04e]">
                      P{row.position}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span>
                      {row.name}
                      {row.isPlayer ? ' (YOU)' : ''}
                    </span>
                  </div>
                  <span className="font-display font-bold tabular-nums text-base">
                    {formatRaceTime(row.time)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="flex-1 py-3 rounded bg-[#d92626] hover:bg-[#eb3333] text-white font-display italic font-extrabold text-xl tracking-wider uppercase cursor-pointer transition-colors"
            >
              Race Again
            </button>
            <button
              type="button"
              onClick={onTitle}
              className="px-4 py-3 rounded bg-[#1c283b] hover:bg-[#25354e] border border-white/15 text-[#f4efe2] font-display font-bold text-lg tracking-wider uppercase cursor-pointer transition-colors"
            >
              Garage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
