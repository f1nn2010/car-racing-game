import React from 'react';
import {
  CarModelId,
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

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3.5 sm:p-8 lg:p-10">
      {/* Subtle left-edge readability scrim over open sky/road shoulder (no backdrop-filter) */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(95deg, rgba(11, 18, 28, 0.84) 0%, rgba(11, 18, 28, 0.56) 38%, rgba(11, 18, 28, 0.08) 68%, rgba(11, 18, 28, 0.0) 100%)',
        }}
      />

      {/* Main Left-Third Lockup & Garage Selector */}
      <div className="relative z-10 w-full max-w-[400px] sm:max-w-[436px] flex flex-col gap-2.5 sm:gap-4 pointer-events-auto my-auto">
        {/* Bespoke Inline SVG Motorsport Emblem & Title Lockup */}
        <div className="select-none">
          <svg
            viewBox="0 0 420 92"
            className="w-full max-w-[300px] sm:max-w-[385px] h-auto overflow-visible"
            role="img"
            aria-label="Coastline Apex"
          >
            {/* Racing stripe & apex chevron crest */}
            <polygon points="0,10 24,10 14,32 0,32" fill="#d92626" />
            <polygon points="30,10 42,10 32,32 20,32" fill="#f4efe2" />
            <rect x="48" y="18" width="170" height="3" fill={trackMeta.themeColor} opacity="0.8" />
            <text
              x="52"
              y="14"
              fill="#f4efe2"
              opacity="0.92"
              fontSize="11"
              fontWeight="700"
              letterSpacing="3.2"
              fontFamily="DM Sans, sans-serif"
            >
              {trackMeta.name.toUpperCase()} CIRCUIT
            </text>

            {/* Primary Display Title */}
            <text
              x="0"
              y="72"
              fill="#f8f4e8"
              stroke="#0c131f"
              strokeWidth="5"
              paintOrder="stroke fill"
              fontSize="56"
              fontWeight="800"
              fontStyle="italic"
              letterSpacing="1.5"
              fontFamily="Barlow Condensed, sans-serif"
            >
              COASTLINE
            </text>
            <text
              x="244"
              y="72"
              fill="#ef3b32"
              stroke="#0c131f"
              strokeWidth="5"
              paintOrder="stroke fill"
              fontSize="56"
              fontWeight="800"
              fontStyle="italic"
              letterSpacing="1.5"
              fontFamily="Barlow Condensed, sans-serif"
            >
              APEX
            </text>
            {/* Checkered speed underline */}
            <rect x="0" y="82" width="346" height="4" fill="#d92626" />
            <rect x="352" y="82" width="24" height="4" fill="#f4efe2" />
          </svg>
        </div>

        {/* Garage & Circuit Selector Panel (solid rgba, zero backdrop-filter) */}
        <div
          className="rounded-lg border border-[#f4efe2]/15 p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3"
          style={{ backgroundColor: 'rgba(13, 20, 31, 0.90)' }}
        >
          {/* 3-Map Circuit Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase text-[#c7d0dc]">
                Select Circuit
              </span>
              <span className="text-[10px] font-semibold text-[#b8c6d8] truncate max-w-[215px]">
                {trackMeta.subtitle}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Select racing circuit">
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
                    className={`relative text-left px-2 py-1.5 sm:px-2.5 sm:py-2 rounded border transition-colors cursor-pointer overflow-hidden ${
                      active
                        ? 'bg-[#223047] border-white/60 text-white'
                        : 'bg-[#151e2d] border-white/10 text-[#b8c6d8] hover:bg-[#1c273b]'
                    }`}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-[3px]"
                      style={{ backgroundColor: active ? trk.themeColor : 'transparent' }}
                    />
                    <div className="font-display italic font-bold text-sm sm:text-base leading-tight">
                      {trk.shortName}
                    </div>
                    <div
                      className="text-[9px] font-bold tracking-wider uppercase mt-0.5"
                      style={{ color: active ? trk.themeColor : '#7c8da5' }}
                    >
                      {trk.difficulty}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Iconic Models Grid */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase text-[#c7d0dc]">
                Select Machine
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#f5c04e]">
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
                    className={`text-left px-2.5 py-1.5 sm:py-2 rounded border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#d92626] border-[#ff6b63] text-[#fffdf8]'
                        : 'bg-[#1a2434] border-white/10 text-[#d4dce7] hover:bg-[#222f44]'
                    }`}
                  >
                    <div className="font-display italic font-bold text-base sm:text-lg leading-tight tracking-wide">
                      {car.shortName}
                    </div>
                    <div
                      className={`text-[10px] leading-tight mt-0.5 truncate ${
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
          <div className="grid grid-cols-3 gap-2 pt-0.5">
            {[
              { label: 'TOP SPEED', val: spec.statSpeed, color: '#ef4444' },
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
          className="w-full py-3 sm:py-3.5 px-5 sm:px-6 rounded-md bg-[#d92626] hover:bg-[#eb3333] active:bg-[#bd1d1d] border border-[#ff7970]/60 text-[#fffdf8] font-display italic font-extrabold text-2xl tracking-[0.08em] uppercase shadow-lg flex items-center justify-between cursor-pointer transition-colors"
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
          Slide-to-Steer &amp; Auto-Gas Ready for Mobile
        </span>
      </div>
    </div>
  );
};
