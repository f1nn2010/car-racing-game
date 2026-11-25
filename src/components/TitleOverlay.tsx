import React, { useState } from 'react';
import {
  CarModelId,
  GAME_THUMBNAIL_URL,
  GameMode,
  ICONIC_CARS,
  PLAYER_LIVERIES,
  TRACK_LIST,
  TrackId,
  getCarSpec,
  getTrackMeta,
} from '../game/types';

interface TitleOverlayProps {
  selectedTrack: TrackId;
  selectedCar: CarModelId;
  selectedLivery: string;
  selectedMode: GameMode;
  onSelectTrack: (id: TrackId) => void;
  onSelectCar: (id: CarModelId) => void;
  onSelectLivery: (id: string) => void;
  onSelectMode: (mode: GameMode) => void;
  onStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  selectedTrack,
  selectedCar,
  selectedLivery,
  selectedMode,
  onSelectTrack,
  onSelectCar,
  onSelectLivery,
  onSelectMode,
  onStart,
}) => {
  const spec = getCarSpec(selectedCar);
  const trackMeta = getTrackMeta(selectedTrack);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const markImgFailed = (key: string) => {
    setFailedImages((prev) => ({ ...prev, [key]: true }));
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-7 lg:p-9">
      {/* Subtle left-edge readability scrim over open sky/road shoulder (no backdrop-filter) */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(95deg, rgba(10, 16, 26, 0.86) 0%, rgba(10, 16, 26, 0.54) 38%, rgba(10, 16, 26, 0.06) 66%, rgba(10, 16, 26, 0.0) 100%)',
        }}
      />

      {/* Main Left-Third Lockup & Garage Selector */}
      <div className="relative z-10 w-full max-w-[404px] sm:max-w-[438px] flex flex-col gap-2.5 sm:gap-3.5 pointer-events-auto my-auto">
        {/* Square 1:1 Cover Thumbnail + Motorsport Title Lockup */}
        <div className="flex items-center gap-3 select-none">
          <div
            className="w-14 h-14 sm:w-[68px] sm:h-[68px] aspect-square rounded-lg overflow-hidden border border-white/25 shrink-0 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #1b283f 0%, #7f1d1d 100%)',
            }}
          >
            {!failedImages.cover ? (
              <img
                src={GAME_THUMBNAIL_URL}
                alt="Coastline Apex Square Cover Thumbnail"
                referrerPolicy="no-referrer"
                onError={() => markImgFailed('cover')}
                data-testid="square-game-thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display italic font-extrabold text-xl text-white">
                CA
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <svg
              viewBox="0 0 360 76"
              className="w-full max-w-[300px] sm:max-w-[345px] h-auto overflow-visible"
              role="img"
              aria-label="Coastline Apex"
            >
              <polygon points="0,6 18,6 11,22 0,22" fill="#d92626" />
              <polygon points="22,6 32,6 25,22 15,22" fill="#f4efe2" />
              <text
                x="40"
                y="18"
                fill="#e2e8f0"
                fontSize="11"
                fontWeight="700"
                letterSpacing="2.8"
                fontFamily="DM Sans, sans-serif"
              >
                {trackMeta.name.toUpperCase()} CIRCUIT
              </text>

              <text
                x="0"
                y="62"
                fill="#f8f4e8"
                stroke="#0c131f"
                strokeWidth="4.5"
                paintOrder="stroke fill"
                fontSize="50"
                fontWeight="800"
                fontStyle="italic"
                letterSpacing="1.2"
                fontFamily="Barlow Condensed, sans-serif"
              >
                COASTLINE
              </text>
              <text
                x="216"
                y="62"
                fill="#ef3b32"
                stroke="#0c131f"
                strokeWidth="4.5"
                paintOrder="stroke fill"
                fontSize="50"
                fontWeight="800"
                fontStyle="italic"
                letterSpacing="1.2"
                fontFamily="Barlow Condensed, sans-serif"
              >
                APEX
              </text>
              <rect x="0" y="70" width="308" height="3.5" fill="#d92626" />
              <rect x="314" y="70" width="22" height="3.5" fill={trackMeta.themeColor} />
            </svg>
          </div>
        </div>

        {/* Garage & Circuit Selector Panel (solid rgba, zero backdrop-filter) */}
        <div
          className="rounded-lg border border-[#f4efe2]/15 p-3 sm:p-3.5 flex flex-col gap-2.5"
          style={{ backgroundColor: 'rgba(13, 20, 31, 0.91)' }}
        >
          {/* 3-Map Square Thumbnail Circuit Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold tracking-[0.14em] uppercase text-[#c7d0dc]">
                Select Circuit
              </span>
              <span className="font-medium text-[#b4c3d6] truncate max-w-[225px]">
                {trackMeta.subtitle}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Select racing circuit">
              {TRACK_LIST.map((trk) => {
                const active = trk.id === selectedTrack;
                return (
                  <button
                    key={trk.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`track-${trk.id}`}
                    onClick={() => onSelectTrack(trk.id)}
                    className={`group relative aspect-square rounded-md overflow-hidden border-2 transition-transform cursor-pointer text-left ${
                      active
                        ? 'border-white scale-[1.02] shadow-md'
                        : 'border-white/15 opacity-85 hover:opacity-100 hover:border-white/40'
                    }`}
                    style={{ backgroundColor: '#162032' }}
                  >
                    {!failedImages[trk.id] ? (
                      <img
                        src={trk.thumbnailUrl}
                        alt={trk.name}
                        referrerPolicy="no-referrer"
                        onError={() => markImgFailed(trk.id)}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `linear-gradient(135deg, #162032 0%, ${trk.themeColor}55 100%)`,
                        }}
                      />
                    )}
                    {/* Bottom Contrast Scrim for Crisp Title Legibility */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(10,16,26,0.05) 35%, rgba(10,16,26,0.88) 100%)',
                      }}
                    />
                    {active && (
                      <div
                        className="absolute inset-x-0 top-0 h-[3px]"
                        style={{ backgroundColor: trk.themeColor }}
                      />
                    )}
                    <div className="relative z-10 h-full flex flex-col justify-end p-2">
                      <div className="font-display italic font-extrabold text-sm sm:text-base leading-none text-white">
                        {trk.shortName}
                      </div>
                      <div
                        className="text-[9px] font-bold tracking-wider uppercase mt-0.5"
                        style={{ color: active ? '#f8f4e8' : '#cbd5e1' }}
                      >
                        {trk.difficulty}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Iconic Models Grid */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold tracking-[0.14em] uppercase text-[#c7d0dc]">
                Select Machine
              </span>
              <span className="font-semibold text-[#f5c04e]">
                {spec.tagline.split('·')[0].trim()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Select iconic car model">
              {ICONIC_CARS.map((car) => {
                const active = car.id === selectedCar;
                return (
                  <button
                    key={car.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onSelectCar(car.id)}
                    className={`text-left px-2.5 py-1.5 rounded border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#d92626] border-[#ff6b63] text-[#fffdf8]'
                        : 'bg-[#1a2434] border-white/10 text-[#d4dce7] hover:bg-[#222f44]'
                    }`}
                  >
                    <div className="font-display italic font-bold text-base sm:text-[17px] leading-tight tracking-wide">
                      {car.shortName}
                    </div>
                    <div
                      className={`text-[10px] leading-tight truncate ${
                        active ? 'text-white/85' : 'text-[#8f9eb3]'
                      }`}
                    >
                      {car.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Car Specs */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'SPEED', val: spec.statSpeed, color: '#ef4444' },
              { label: 'HANDLING', val: spec.statHandling, color: '#38bdf8' },
              { label: 'NITRO', val: spec.statNitro, color: '#f59e0b' },
            ].map((bar) => (
              <div key={bar.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[9px] sm:text-[10px] font-bold tracking-wider text-[#b6c2d2]">
                  <span>{bar.label}</span>
                  <span className="tabular-nums text-[#f7f4ec]">{bar.val}</span>
                </div>
                <div className="h-1.5 w-full rounded-sm bg-[#0b111b] overflow-hidden">
                  <div
                    className="h-full transition-all duration-200"
                    style={{ width: `${bar.val}%`, backgroundColor: bar.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Paint Swatches + Mode Toggle */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Car paint livery">
              {PLAYER_LIVERIES.map((liv) => {
                const active = liv.id === selectedLivery;
                return (
                  <button
                    key={liv.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`Paint ${liv.name}`}
                    title={liv.name}
                    onClick={() => onSelectLivery(liv.id)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                      active ? 'border-white scale-110' : 'border-white/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: liv.cssHex }}
                  />
                );
              })}
            </div>

            <div className="flex rounded bg-[#0c131e] p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => onSelectMode('grand-prix')}
                className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                  selectedMode === 'grand-prix'
                    ? 'bg-[#f4efe2] text-[#111824]'
                    : 'text-[#9aa8bc] hover:text-white'
                }`}
              >
                Grand Prix
              </button>
              <button
                type="button"
                onClick={() => onSelectMode('time-trial')}
                className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                  selectedMode === 'time-trial'
                    ? 'bg-[#f4efe2] text-[#111824]'
                    : 'text-[#9aa8bc] hover:text-white'
                }`}
              >
                Time Trial
              </button>
            </div>
          </div>
        </div>

        {/* Primary Start CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onStart}
          className="w-full py-3 px-5 rounded-md bg-[#d92626] hover:bg-[#eb3333] active:bg-[#bd1d1d] border border-[#ff7970]/60 text-[#fffdf8] font-display italic font-extrabold text-2xl tracking-[0.08em] uppercase shadow-lg flex items-center justify-between cursor-pointer transition-colors"
        >
          <span>Start Race</span>
          <span className="text-xs sm:text-sm font-sans not-italic font-semibold tracking-wider text-white/85">
            {selectedMode === 'grand-prix' ? '3 LAPS · 4 ICONIC CARS' : 'SOLO HOTLAP'}
          </span>
        </button>
      </div>

      {/* Single flat borderless control-hint line in bottom safe margin */}
      <div className="relative z-10 w-full flex items-center justify-between text-[11px] sm:text-xs font-medium tracking-wide text-[#eef2f8]/85 hud-stroke">
        <span>
          WASD / Arrows Drive · Space Drift · Shift Nitro · C Camera · Esc Pause
        </span>
        <span className="hidden sm:inline text-[#f4efe2]/75">
          Seamless Touch Arrows &amp; Slide Steering Built-In
        </span>
      </div>
    </div>
  );
};
