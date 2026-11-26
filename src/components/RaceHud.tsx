import React, { useMemo, useRef, useState } from 'react';
import { computeJoystickSteer } from '../game/controls';
import { TrackData } from '../game/track';
import { HudSnapshot } from '../game/types';

interface RaceHudProps {
  hud: HudSnapshot;
  track: TrackData;
  showTouchControls: boolean;
  onToggleTouchControls: () => void;
  onToggleAutoGas: () => void;
  onCycleCamera: () => void;
  onToggleMute: () => void;
  onRestart: () => void;
  onPause: () => void;
  onAnalogSteer: (value: number | null) => void;
  onTouchInput: (
    control: 'left' | 'right' | 'gas' | 'brake' | 'drift' | 'boost',
    active: boolean
  ) => void;
}

export function formatRaceTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe * 10) % 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

const SPEED_LINE_ANGLES = [
  12, 24, 36, 144, 156, 168, 192, 204, 216, 324, 336, 348, 52, 128, 232, 308,
];

export const RaceHud: React.FC<RaceHudProps> = ({
  hud,
  track,
  showTouchControls,
  onToggleTouchControls,
  onToggleAutoGas,
  onCycleCamera,
  onToggleMute,
  onRestart,
  onPause,
  onAnalogSteer,
  onTouchInput,
}) => {
  const [pressedTouch, setPressedTouch] = useState<Record<string, boolean>>({});
  const [steerMode, setSteerMode] = useState<'stick' | 'arrows'>('stick');
  const [padActive, setPadActive] = useState(false);
  const [padSteer, setPadSteer] = useState(0);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const steerPointerIdRef = useRef<number | null>(null);

  // Precompute SVG minimap path from actual closed circuit geometry
  const minimapData = useMemo(() => {
    const pad = 18;
    const { minX, maxX, minZ, maxZ } = track.bounds;
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const scale = Math.min((120 - pad * 2) / spanX, (120 - pad * 2) / spanZ);
    const offsetX = (120 - spanX * scale) / 2;
    const offsetZ = (120 - spanZ * scale) / 2;

    const mapX = (wx: number) => 120 - (offsetX + (wx - minX) * scale);
    const mapY = (wz: number) => 120 - (offsetZ + (wz - minZ) * scale);

    const pts: string[] = [];
    for (let i = 0; i < track.samples.length; i += 4) {
      const s = track.samples[i];
      pts.push(`${mapX(s.x).toFixed(1)},${mapY(s.z).toFixed(1)}`);
    }

    // Exact Start/Finish gantry bar perpendicular to track direction
    const fin = track.samples[track.finishLineIndex] ?? track.samples[0];
    const fx = mapX(fin.x);
    const fy = mapY(fin.z);
    const nx = -fin.rx;
    const ny = -fin.rz;
    const nLen = Math.hypot(nx, ny) || 1;
    const tick = 5.2;

    return {
      pathD: `M ${pts.join(' L ')} Z`,
      mapX,
      mapY,
      finishBar: {
        x1: fx - (nx / nLen) * tick,
        y1: fy - (ny / nLen) * tick,
        x2: fx + (nx / nLen) * tick,
        y2: fy + (ny / nLen) * tick,
      },
    };
  }, [track]);

  const updateSteerFromPointer = (clientX: number, clientY: number, el: Element) => {
    const rect = el.getBoundingClientRect();
    if (steerMode === 'stick') {
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const maxR = Math.min(rect.width, rect.height) * 0.36;
      const vec = computeJoystickSteer(clientX - cx, clientY - cy, maxR);
      setPadSteer(vec.steer);
      setKnobOffset({ x: vec.knobX, y: vec.knobY });
      onAnalogSteer(vec.steer);
      return;
    }

    // Dual-zone slide-across arrows fallback
    const raw = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const clamped = Math.max(-1, Math.min(1, raw));
    const val =
      Math.abs(clamped) < 0.08
        ? 0
        : Number((Math.sign(clamped) * Math.min(1, 0.62 + Math.abs(clamped) * 0.55)).toFixed(3));
    setPadSteer(val);
    setKnobOffset({ x: val, y: 0 });
    onAnalogSteer(val);
  };

  const handleSteerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    steerPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPadActive(true);
    updateSteerFromPointer(e.clientX, e.clientY, e.currentTarget);
  };

  const handleSteerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (steerPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    updateSteerFromPointer(e.clientX, e.clientY, e.currentTarget);
  };

  const releaseSteerPad = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e && steerPointerIdRef.current !== null && e.pointerId !== steerPointerIdRef.current) {
      return;
    }
    steerPointerIdRef.current = null;
    setPadActive(false);
    setPadSteer(0);
    setKnobOffset({ x: 0, y: 0 });
    onAnalogSteer(null);
  };

  const bindTouchControl = (ctrl: 'left' | 'right' | 'gas' | 'brake' | 'drift' | 'boost') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setPressedTouch((prev) => ({ ...prev, [ctrl]: true }));
      onTouchInput(ctrl, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      setPressedTouch((prev) => ({ ...prev, [ctrl]: false }));
      onTouchInput(ctrl, false);
    },
    onPointerCancel: () => {
      setPressedTouch((prev) => ({ ...prev, [ctrl]: false }));
      onTouchInput(ctrl, false);
    },
    onLostPointerCapture: () => {
      setPressedTouch((prev) => ({ ...prev, [ctrl]: false }));
      onTouchInput(ctrl, false);
    },
  });

  // Tachometer arc calculation
  const rpmClamped = Math.max(0, Math.min(1, hud.rpm));
  const arcTotalLen = 156;
  const arcOffset = arcTotalLen * (1 - rpmClamped);
  const rpmColor = rpmClamped > 0.86 ? '#ef4444' : rpmClamped > 0.68 ? '#f59e0b' : '#f4efe2';
  const driftTierColor =
    hud.driftTier >= 3 ? '#e879f9' : hud.driftTier === 2 ? '#f59e0b' : '#38bdf8';

  const speedLinesOpacity = Math.min(
    0.58,
    Math.max(0, (hud.speedKmh - 215) / 170) * 0.42 + (hud.isBoosting ? 0.36 : 0)
  );
  const displayedSteer = padActive ? padSteer : hud.analogSteerVisual;
  const ordinal = (n: number) => (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* =====================================================================
          PERIPHERAL HIGH-SPEED / NITRO SVG SPEED LINES (Edge-only)
         ===================================================================== */}
      {speedLinesOpacity > 0.04 && (
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          className="fixed inset-0 w-full h-full pointer-events-none"
          style={{ opacity: speedLinesOpacity }}
          aria-hidden="true"
        >
          {SPEED_LINE_ANGLES.map((deg, idx) => {
            const rad = (deg * Math.PI) / 180;
            const innerR = hud.isBoosting ? 330 : 375;
            const outerR = 640;
            const x1 = 500 + Math.cos(rad) * innerR;
            const y1 = 300 + Math.sin(rad) * innerR * 0.65;
            const x2 = 500 + Math.cos(rad) * outerR;
            const y2 = 300 + Math.sin(rad) * outerR * 0.65;
            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={hud.isBoosting ? '#7dd3fc' : '#ffffff'}
                strokeWidth={idx % 2 === 0 ? 2.4 : 1.4}
                strokeLinecap="round"
                opacity={idx % 3 === 0 ? 0.85 : 0.55}
              />
            );
          })}
        </svg>
      )}

      {/* =====================================================================
          TOP-LEFT: TELEMETRY CLUSTER (Position, Lap, Timer, Mobile Speed Strip)
         ===================================================================== */}
      <div className="fixed top-2.5 left-2.5 sm:top-5 sm:left-5 flex flex-col items-start gap-1.5">
        <div className="flex items-stretch gap-1.5 sm:gap-2">
          {hud.mode === 'grand-prix' && (
            <div
              className="px-2.5 py-1 sm:px-4 sm:py-2 rounded-md border border-white/12 flex flex-col justify-center"
              style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
            >
              <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.16em] uppercase text-[#a8b6c9]">
                POS
              </span>
              <div className="flex items-baseline gap-0.5 leading-none mt-0.5">
                <span
                  className="font-display italic font-extrabold text-2xl sm:text-4xl text-[#f8f4e8] tabular-nums"
                  data-testid="hud-position"
                >
                  {hud.position}
                </span>
                <span className="font-display italic font-bold text-[11px] sm:text-sm text-[#f5c04e]">
                  {ordinal(hud.position)}
                </span>
                <span className="font-display text-xs sm:text-base text-[#8d9cb0] ml-0.5 tabular-nums">
                  /{hud.totalRacers}
                </span>
              </div>
            </div>
          )}

          <div
            className="px-2.5 py-1 sm:px-4 sm:py-2 rounded-md border border-white/12 flex items-center gap-2.5 sm:gap-5"
            style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
          >
            <div className="flex flex-col">
              <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.16em] uppercase text-[#a8b6c9]">
                LAP
              </span>
              <span
                className="font-display italic font-extrabold text-xl sm:text-3xl text-[#f8f4e8] leading-none mt-0.5 tabular-nums"
                data-testid="hud-lap"
              >
                {hud.lap}
                <span className="text-sm sm:text-base text-[#8d9cb0]">/{hud.totalLaps}</span>
              </span>
            </div>

            <div className="hidden sm:block w-px h-7 bg-white/15" />

            <div className="hidden sm:flex flex-col">
              <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.18em] uppercase text-[#a8b6c9]">
                TIME
              </span>
              <span
                className="font-display font-bold text-lg sm:text-2xl text-[#f8f4e8] leading-none mt-0.5 sm:mt-1 tabular-nums"
                data-testid="hud-timer"
              >
                {formatRaceTime(hud.raceTime)}
              </span>
            </div>

            {hud.skillScore > 0 && (
              <>
                <div className="hidden sm:block w-px h-7 bg-white/15" />
                <div className="hidden sm:flex flex-col">
                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#38bdf8]">
                    SKILL
                  </span>
                  <span
                    className="font-display font-bold text-xl text-[#7dd3fc] leading-none mt-1 tabular-nums"
                    data-testid="hud-skill"
                  >
                    {hud.skillScore}
                  </span>
                </div>
              </>
            )}

            {hud.bestLapTime !== null && (
              <>
                <div className="hidden md:block w-px h-7 bg-white/15" />
                <div className="hidden md:flex flex-col">
                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#f5c04e]">
                    BEST
                  </span>
                  <span className="font-display font-bold text-xl text-[#f5c04e] leading-none mt-1 tabular-nums">
                    {formatRaceTime(hud.bestLapTime)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Compact Speed, Gear, Nitro & Time Strip */}
        <div
          className="flex sm:hidden items-center gap-2 px-2.5 py-1.5 rounded-md border border-white/12"
          style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
        >
          <div className="flex items-baseline gap-1 leading-none">
            <span
              className="font-display italic font-extrabold text-xl text-[#f8f4e8] tabular-nums"
              data-testid="hud-speed-mobile"
            >
              {hud.speedKmh}
            </span>
            <span className="text-[9px] font-bold uppercase text-[#9eb0c7]">KM/H</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-[#d92626] font-display font-extrabold text-xs leading-none text-white tabular-nums">
            G{hud.gear}
          </span>
          <div className="w-12 h-2 rounded-sm bg-[#090e17] border border-white/10 overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${hud.nitro}%`,
                backgroundColor: hud.isBoosting ? '#38bdf8' : '#f59e0b',
              }}
            />
          </div>
          <span className="text-[11px] font-display font-bold text-[#d0dae8] tabular-nums">
            {formatRaceTime(hud.raceTime)}
          </span>
          {hud.skillScore > 0 && (
            <span className="text-[10px] font-bold text-[#7dd3fc] tabular-nums">
              +{hud.skillScore}
            </span>
          )}
        </div>
      </div>

      {/* =====================================================================
          TOP-RIGHT: UTILITY BUTTONS & CORNER TRACK MINIMAP
         ===================================================================== */}
      <div className="fixed top-2.5 right-2.5 sm:top-5 sm:right-5 flex flex-col items-end gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Camera View (${hud.cameraMode})`}
            title="Switch Camera (C) — Chase / Inside / Hood / Far"
            data-testid="toggle-camera"
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleCamera();
            }}
            className={`h-10 px-2 sm:h-9 sm:px-2.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer ${
              hud.cameraMode === 'cockpit'
                ? 'border-[#38bdf8] text-[#38bdf8]'
                : 'border-white/15 text-[#f4efe2] hover:bg-[#243247]'
            }`}
            style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 8h4l2-3h4l2 3h4v11H4V8z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span>{hud.cameraMode === 'cockpit' ? 'Inside' : hud.cameraMode}</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={showTouchControls ? 'Hide Touch Buttons' : 'Show Touch Buttons'}
            title="Toggle On-Screen Touch Buttons"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleTouchControls();
            }}
            className={`hidden sm:flex h-9 px-2.5 rounded border text-[11px] font-bold uppercase tracking-wider items-center gap-1 cursor-pointer ${
              showTouchControls
                ? 'border-[#38bdf8] text-[#38bdf8]'
                : 'border-white/15 text-[#c8d2df] hover:text-white'
            }`}
            style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="6" width="18" height="12" rx="3" />
              <path d="M7 12h4M9 10v4M15 11h.01M17 13h.01" />
            </svg>
            <span className="hidden md:inline">Pad</span>
          </button>

          {showTouchControls && (
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Steering Mode: ${steerMode}`}
                title="Switch Steering Style (Joystick / Arrows)"
                data-testid="toggle-steermode"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setSteerMode((m) => (m === 'stick' ? 'arrows' : 'stick'));
                }}
                className="h-10 sm:h-9 px-2 sm:px-2.5 rounded-lg border border-white/15 text-[#e2e8f0] hover:bg-[#243247] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
              >
                {steerMode === 'stick' ? 'Stick' : 'Arrows'}
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label={hud.autoGas ? 'Disable Auto Gas' : 'Enable Auto Gas'}
                title="Toggle Auto-Accelerate"
                data-testid="toggle-autogas"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleAutoGas();
                }}
                className={`h-10 sm:h-9 px-2 sm:px-2.5 rounded-lg border text-[10px] sm:text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                  hud.autoGas
                    ? 'border-[#22c55e] text-[#4ade80]'
                    : 'border-white/15 text-[#c8d2df]'
                }`}
                style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
              >
                Auto
              </button>
            </>
          )}

          <button
            type="button"
            tabIndex={-1}
            aria-label={hud.muted ? 'Unmute Audio' : 'Mute Audio'}
            title="Mute / Unmute (M)"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="hidden sm:flex w-9 h-9 rounded border border-white/15 text-[#f4efe2] hover:bg-[#243247] items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
          >
            {hud.muted ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" />
              </svg>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Restart Race"
            title="Restart Race (R)"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="hidden sm:flex w-9 h-9 rounded border border-white/15 text-[#f4efe2] hover:bg-[#243247] items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Race"
            title="Pause (Esc / P)"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-lg border border-white/15 text-[#f4efe2] hover:bg-[#243247] flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-4 sm:h-4" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>
        </div>

        {/* Live Track Minimap + Track Label */}
        <div
          className="hidden sm:flex flex-col items-center rounded-md border border-white/12 p-1.5"
          style={{ backgroundColor: 'rgba(13, 20, 31, 0.80)' }}
        >
          <svg viewBox="0 0 120 120" className="w-[104px] h-[104px]" aria-label="Circuit Minimap">
            <path
              d={minimapData.pathD}
              fill="none"
              stroke="#0a1018"
              strokeWidth="9"
              strokeLinejoin="round"
            />
            <path
              d={minimapData.pathD}
              fill="none"
              stroke="#d5dde8"
              strokeWidth="4.5"
              strokeLinejoin="round"
              opacity="0.88"
            />
            {/* Exact Start / Finish Line Marker */}
            <line
              x1={minimapData.finishBar.x1}
              y1={minimapData.finishBar.y1}
              x2={minimapData.finishBar.x2}
              y2={minimapData.finishBar.y2}
              stroke="#ffffff"
              strokeWidth="3.4"
              strokeLinecap="butt"
            />
            <line
              x1={minimapData.finishBar.x1}
              y1={minimapData.finishBar.y1}
              x2={minimapData.finishBar.x2}
              y2={minimapData.finishBar.y2}
              stroke="#ef4444"
              strokeWidth="1.8"
              strokeDasharray="2 2"
            />
            {hud.minimapDots.map((dot) => {
              const mx = minimapData.mapX(dot.x);
              const my = minimapData.mapY(dot.z);
              if (!dot.isPlayer) {
                return (
                  <circle
                    key={dot.id}
                    cx={mx}
                    cy={my}
                    r={3.8}
                    fill={dot.color}
                    stroke="#0b111b"
                    strokeWidth={1.2}
                  />
                );
              }
              // Directional player arrow aligned to inverted minimap axes (-X right, -Z down)
              const deg = (Math.atan2(-Math.sin(dot.heading), Math.cos(dot.heading)) * 180) / Math.PI;
              return (
                <g key={dot.id} transform={`translate(${mx.toFixed(1)}, ${my.toFixed(1)}) rotate(${deg.toFixed(1)})`}>
                  <polygon
                    points="0,-6.5 5.0,5.2 0,2.6 -5.0,5.2"
                    fill={dot.color}
                    stroke="#ffffff"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
          </svg>
          <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#a8b6c9] -mt-0.5">
            {hud.trackName}
          </span>
        </div>
      </div>

      {/* =====================================================================
          TRANSIENT CENTER CALLOUTS (Countdown, Race Events & Skill Rewards)
         ===================================================================== */}
      {hud.countdown > 0 && (
        <div className="fixed inset-x-0 top-[11%] flex justify-center">
          <div className="font-display italic font-extrabold text-7xl sm:text-8xl text-[#f8f4e8] hud-stroke">
            {hud.countdown}
          </div>
        </div>
      )}

      {hud.countdown <= 0 && hud.bannerText && (
        <div className="fixed inset-x-0 top-[13%] flex justify-center">
          <div
            className="px-6 py-1.5 rounded border-y-2 border-[#f5c04e] font-display italic font-extrabold text-3xl sm:text-5xl tracking-wider text-[#fffdf5] uppercase hud-stroke"
            style={{ backgroundColor: 'rgba(13, 20, 31, 0.78)' }}
          >
            {hud.bannerText}
          </div>
        </div>
      )}

      {hud.countdown <= 0 && hud.skillCallout && (
        <div className="fixed inset-x-0 top-[23%] flex justify-center">
          <div
            className="px-4 py-1 rounded border border-[#38bdf8]/75 font-display italic font-extrabold text-lg sm:text-2xl tracking-widest uppercase text-[#e0f2fe] hud-stroke"
            style={{ backgroundColor: 'rgba(12, 22, 36, 0.82)' }}
          >
            {hud.skillCallout}
          </div>
        </div>
      )}

      {hud.wrongWay && (
        <div className="fixed inset-x-0 top-[29%] flex justify-center">
          <div className="px-5 py-1.5 rounded bg-[#d92626] border border-white/40 font-display italic font-extrabold text-2xl tracking-widest uppercase text-white">
            WRONG WAY — TURN AROUND
          </div>
        </div>
      )}

      {hud.slipstream && !hud.wrongWay && !hud.skillCallout && !hud.upcomingTurn && (
        <div className="fixed inset-x-0 top-[11%] flex justify-center">
          <div
            className="px-3.5 py-0.5 rounded border border-[#38bdf8]/60 font-display italic font-bold text-sm tracking-[0.2em] uppercase text-[#7dd3fc]"
            style={{ backgroundColor: 'rgba(13, 20, 31, 0.72)' }}
          >
            SLIPSTREAM DRAFTING
          </div>
        </div>
      )}

      {/* Rally-Style Upcoming Sharp Corner Pace-Note Warning */}
      {hud.countdown <= 0 && !hud.wrongWay && !hud.bannerText && hud.upcomingTurn && (
        <div className="fixed inset-x-0 top-[10%] flex justify-center" data-testid="corner-warning">
          <div
            className={`px-3.5 py-1 rounded border-2 flex items-center gap-2 font-display italic font-extrabold text-base sm:text-xl tracking-wider uppercase ${
              hud.upcomingTurnSeverity > 0.55
                ? 'border-[#ef4444] text-[#fecaca]'
                : 'border-[#f59e0b] text-[#fde68a]'
            }`}
            style={{ backgroundColor: 'rgba(13, 20, 31, 0.84)' }}
          >
            {hud.upcomingTurn === 'left' ? (
              <>
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M19 19V9H6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M11 4L6 9l5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{hud.upcomingTurnSeverity > 0.55 ? 'HAIRPIN LEFT' : 'SHARP LEFT'}</span>
              </>
            ) : (
              <>
                <span>{hud.upcomingTurnSeverity > 0.55 ? 'HAIRPIN RIGHT' : 'SHARP RIGHT'}</span>
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 19V9h13" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13 4l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          DESKTOP SPEEDOMETER / TACHOMETER & NITRO GAUGE
         ===================================================================== */}
      <div
        className={`hidden sm:flex fixed z-10 flex-col items-end gap-1.5 ${
          showTouchControls ? 'bottom-[170px] right-5' : 'bottom-6 right-6'
        }`}
      >
        {/* Active Drift Combo & Charge Bar */}
        {hud.isDrifting && hud.driftPoints > 0 && (
          <div
            className="px-3 py-1.5 rounded border flex flex-col gap-1 min-w-[160px]"
            style={{
              backgroundColor: 'rgba(13, 20, 31, 0.88)',
              borderColor: driftTierColor,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="font-display italic font-extrabold text-sm tracking-wider uppercase"
                style={{ color: driftTierColor }}
              >
                {hud.driftTier >= 3
                  ? 'ULTRA DRIFT'
                  : hud.driftTier === 2
                    ? 'SUPER DRIFT'
                    : 'DRIFT'}
              </span>
              <span className="font-display font-extrabold text-xl text-white tabular-nums">
                +{hud.driftPoints}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-sm bg-[#090e17] overflow-hidden">
              <div
                className="h-full transition-all duration-75"
                style={{
                  width: `${Math.min(100, Math.round(hud.driftCharge * 100))}%`,
                  backgroundColor: driftTierColor,
                }}
              />
            </div>
          </div>
        )}

        {/* Motorsport Dial Cluster */}
        <div
          className="px-4 py-3 rounded-lg border border-white/15 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
        >
          <div className="relative w-[126px] h-[74px] flex items-end justify-center">
            <svg viewBox="0 0 130 76" className="absolute inset-0 w-full h-full">
              <path
                d="M 14 66 A 52 52 0 0 1 116 66"
                fill="none"
                stroke="#253143"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M 14 66 A 52 52 0 0 1 116 66"
                fill="none"
                stroke={rpmColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={arcTotalLen}
                strokeDashoffset={arcOffset}
              />
            </svg>
            <div className="relative z-10 flex flex-col items-center leading-none mb-0.5">
              <span
                className="font-display italic font-extrabold text-4xl text-[#f8f4e8] tabular-nums"
                data-testid="hud-speed"
              >
                {hud.speedKmh}
              </span>
              <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#9eb0c7]">
                KM/H
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-[92px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9eb0c7]">
                {hud.carName}
              </span>
              <span
                className="px-1.5 py-0.5 rounded bg-[#d92626] font-display font-extrabold text-sm leading-none text-white tabular-nums"
                data-testid="hud-gear"
              >
                G{hud.gear}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
                <span className={hud.isBoosting ? 'text-[#38bdf8]' : 'text-[#b6c2d2]'}>
                  NITRO
                </span>
                <span className="tabular-nums text-[#f8f4e8]">{hud.nitro}%</span>
              </div>
              <div className="h-2.5 w-full rounded-sm bg-[#090e17] border border-white/10 overflow-hidden">
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${hud.nitro}%`,
                    backgroundColor: hud.isBoosting ? '#38bdf8' : '#f59e0b',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          EFFORTLESS MOBILE TOUCH CONTROLS:
          Left  = Smooth Circular 360° Thumb Steering Joystick (or Arrow Deck)
          Right = Ergonomic Easy-Reach Thumb Arc (Big Nitro + Drift + Clean Brake)
         ===================================================================== */}
      {showTouchControls && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3.5 sm:p-5 flex items-end justify-between pointer-events-none">
          {/* Left Thumb Zone: Tactile Circular Steering Joystick (default) or Dual Arrows */}
          <div className="pointer-events-auto">
            {steerMode === 'stick' ? (
              <div
                role="slider"
                aria-label="Steering Joystick"
                aria-valuemin={-100}
                aria-valuemax={100}
                aria-valuenow={Math.round(displayedSteer * 100)}
                data-testid="touch-steer-pad"
                onPointerDown={handleSteerDown}
                onPointerMove={handleSteerMove}
                onPointerUp={releaseSteerPad}
                onPointerCancel={releaseSteerPad}
                onLostPointerCapture={releaseSteerPad}
                className={`relative w-[152px] h-[152px] sm:w-[172px] sm:h-[172px] rounded-full border-2 touch-none cursor-pointer flex items-center justify-center shadow-2xl transition-colors ${
                  padActive ? 'border-[#38bdf8]' : 'border-white/35'
                }`}
                style={{ backgroundColor: 'rgba(13, 20, 31, 0.82)' }}
              >
                {/* Inner Guide Ring & Subtle Crosshair */}
                <div className="absolute inset-4 rounded-full border border-white/15 pointer-events-none" />
                <div className="absolute inset-x-5 top-1/2 h-px -translate-y-1/2 bg-white/12 pointer-events-none" />
                <div className="absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-white/10 pointer-events-none" />

                {/* Left / Right Directional Indicators */}
                <svg
                  viewBox="0 0 24 24"
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none transition-colors ${
                    displayedSteer < -0.12 ? 'text-[#38bdf8]' : 'text-white/45'
                  }`}
                  fill="currentColor"
                >
                  <path d="M15.5 5l-7 7 7 7V5z" />
                </svg>
                <svg
                  viewBox="0 0 24 24"
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none transition-colors ${
                    displayedSteer > 0.12 ? 'text-[#38bdf8]' : 'text-white/45'
                  }`}
                  fill="currentColor"
                >
                  <path d="M8.5 5l7 7-7 7V5z" />
                </svg>

                {/* Floating Chunky Thumbstick Knob */}
                <div
                  className="relative z-10 w-[64px] h-[64px] sm:w-[72px] sm:h-[72px] rounded-full border-[3px] flex items-center justify-center pointer-events-none shadow-xl"
                  style={{
                    transform: `translate(${(padActive ? knobOffset.x : displayedSteer) * 40}px, ${
                      padActive ? knobOffset.y * 26 : 0
                    }px)`,
                    backgroundColor: padActive ? '#38bdf8' : '#e2e8f0',
                    borderColor: padActive ? '#e0f2fe' : '#ffffff',
                  }}
                >
                  <div className="w-8 h-8 rounded-full border-2 border-[#0d1520]/30 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0d1520]/70" />
                  </div>
                </div>

                <span className="absolute bottom-2.5 inset-x-0 text-center text-[9px] font-bold tracking-[0.18em] uppercase text-[#a8b6c9] pointer-events-none">
                  STEER
                </span>
              </div>
            ) : (
              <div
                role="slider"
                aria-label="Steer Left or Right"
                aria-valuemin={-100}
                aria-valuemax={100}
                aria-valuenow={Math.round(displayedSteer * 100)}
                data-testid="touch-steer-pad"
                onPointerDown={handleSteerDown}
                onPointerMove={handleSteerMove}
                onPointerUp={releaseSteerPad}
                onPointerCancel={releaseSteerPad}
                onLostPointerCapture={releaseSteerPad}
                className="grid grid-cols-2 w-[176px] h-[106px] sm:w-[220px] sm:h-[112px] rounded-2xl border-2 border-white/35 overflow-hidden touch-none cursor-pointer shadow-xl"
                style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
              >
                <div
                  className={`flex flex-col items-center justify-center border-r border-white/20 transition-colors ${
                    displayedSteer < -0.1 ? 'bg-[#38bdf8] text-[#09121e]' : 'text-[#f8f4e8]'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-11 h-11" fill="currentColor">
                    <path d="M15.5 5l-7 7 7 7V5z" />
                  </svg>
                  <span className="text-[11px] font-bold tracking-widest uppercase opacity-90">
                    LEFT
                  </span>
                </div>
                <div
                  className={`flex flex-col items-center justify-center transition-colors ${
                    displayedSteer > 0.1 ? 'bg-[#38bdf8] text-[#09121e]' : 'text-[#f8f4e8]'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-11 h-11" fill="currentColor">
                    <path d="M8.5 5l7 7-7 7V5z" />
                  </svg>
                  <span className="text-[11px] font-bold tracking-widest uppercase opacity-90">
                    RIGHT
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Thumb Zone: Clean Ergonomic Action Arc */}
          <div className="flex flex-col items-end gap-2.5 pointer-events-auto">
            {hud.autoGas ? (
              <>
                {/* Easy-Tap Brake Bar cleanly aligned above Drift + Nitro */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold tracking-wider uppercase text-[#86efac] hud-stroke">
                    AUTO GAS
                  </span>
                  <button
                    type="button"
                    aria-label="Brake"
                    data-testid="touch-brake"
                    {...bindTouchControl('brake')}
                    className={`w-[104px] h-[48px] sm:w-[116px] sm:h-[52px] rounded-xl border-2 font-display italic font-extrabold text-xl tracking-wider touch-none cursor-pointer transition-transform shadow-lg ${
                      pressedTouch.brake
                        ? 'bg-[#dc2626] border-[#fca5a5] text-white scale-95'
                        : 'border-[#ef4444]/80 text-[#fca5a5]'
                    }`}
                    style={
                      pressedTouch.brake ? undefined : { backgroundColor: 'rgba(13, 20, 31, 0.86)' }
                    }
                  >
                    BRAKE
                  </button>
                </div>

                {/* Primary Right-Thumb Buttons: Large DRIFT + Huge Liquid-Fill NITRO */}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    aria-label="Drift"
                    data-testid="touch-drift"
                    {...bindTouchControl('drift')}
                    className={`w-[84px] h-[94px] sm:w-[96px] sm:h-[100px] rounded-2xl border-2 flex flex-col items-center justify-center touch-none cursor-pointer transition-transform shadow-xl ${
                      pressedTouch.drift || hud.isDrifting
                        ? 'bg-[#f59e0b] border-[#fde68a] text-[#0d1520] scale-95'
                        : 'border-[#f59e0b]/85 text-[#fcd34d]'
                    }`}
                    style={
                      pressedTouch.drift || hud.isDrifting
                        ? undefined
                        : { backgroundColor: 'rgba(13, 20, 31, 0.88)' }
                    }
                  >
                    <span className="font-display italic font-extrabold text-2xl leading-none">
                      DRIFT
                    </span>
                    <span className="text-[10px] font-bold tracking-wider uppercase mt-1 opacity-90">
                      HOLD
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label="Nitro Boost"
                    data-testid="touch-boost"
                    {...bindTouchControl('boost')}
                    className={`relative overflow-hidden w-[92px] h-[106px] sm:w-[106px] sm:h-[112px] rounded-2xl border-2 flex flex-col items-center justify-center touch-none cursor-pointer transition-transform shadow-xl ${
                      pressedTouch.boost || hud.isBoosting
                        ? 'border-[#bae6fd] text-white scale-95'
                        : 'border-[#38bdf8]/95 text-[#e0f2fe]'
                    }`}
                    style={{ backgroundColor: 'rgba(13, 20, 31, 0.88)' }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 pointer-events-none transition-all duration-75"
                      style={{
                        height: `${hud.nitro}%`,
                        backgroundColor:
                          pressedTouch.boost || hud.isBoosting
                            ? 'rgba(14, 165, 233, 0.92)'
                            : 'rgba(14, 165, 233, 0.42)',
                      }}
                    />
                    <span className="relative z-10 font-display italic font-extrabold text-2xl leading-none">
                      NITRO
                    </span>
                    <span className="relative z-10 text-xs font-bold tabular-nums mt-1">
                      {hud.nitro}%
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Drift"
                    data-testid="touch-drift"
                    {...bindTouchControl('drift')}
                    className={`w-[84px] h-[56px] sm:w-[94px] sm:h-[62px] rounded-xl border-2 font-display italic font-extrabold text-xl tracking-wider uppercase touch-none cursor-pointer transition-transform shadow-lg ${
                      pressedTouch.drift
                        ? 'bg-[#f59e0b] border-[#fde68a] text-[#0d1520] scale-95'
                        : 'border-[#f59e0b]/80 text-[#fcd34d]'
                    }`}
                    style={
                      pressedTouch.drift ? undefined : { backgroundColor: 'rgba(13, 20, 31, 0.86)' }
                    }
                  >
                    DRIFT
                  </button>

                  <button
                    type="button"
                    aria-label="Nitro Boost"
                    data-testid="touch-boost"
                    {...bindTouchControl('boost')}
                    className={`relative overflow-hidden w-[92px] h-[56px] sm:w-[100px] sm:h-[62px] rounded-xl border-2 font-display italic font-extrabold text-xl tracking-wider uppercase touch-none cursor-pointer transition-transform shadow-lg ${
                      pressedTouch.boost || hud.isBoosting
                        ? 'border-[#bae6fd] text-white scale-95'
                        : 'border-[#38bdf8]/85 text-[#7dd3fc]'
                    }`}
                    style={{ backgroundColor: 'rgba(13, 20, 31, 0.86)' }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 pointer-events-none"
                      style={{
                        height: `${hud.nitro}%`,
                        backgroundColor:
                          pressedTouch.boost || hud.isBoosting
                            ? 'rgba(14, 165, 233, 0.88)'
                            : 'rgba(14, 165, 233, 0.34)',
                      }}
                    />
                    <span className="relative z-10">NITRO</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Brake"
                    data-testid="touch-brake"
                    {...bindTouchControl('brake')}
                    className={`w-[84px] h-[86px] sm:w-[94px] sm:h-[90px] rounded-2xl border-2 flex flex-col items-center justify-center touch-none cursor-pointer transition-transform shadow-xl ${
                      pressedTouch.brake
                        ? 'bg-[#dc2626] border-[#fca5a5] text-white scale-95'
                        : 'border-[#ef4444]/75 text-[#fca5a5]'
                    }`}
                    style={
                      pressedTouch.brake ? undefined : { backgroundColor: 'rgba(13, 20, 31, 0.86)' }
                    }
                  >
                    <span className="font-display italic font-extrabold text-2xl leading-none">
                      BRK
                    </span>
                    <span className="text-[10px] font-bold tracking-wider uppercase mt-1 opacity-90">
                      STOP
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label="Accelerate Gas"
                    data-testid="touch-gas"
                    {...bindTouchControl('gas')}
                    className={`w-[92px] h-[86px] sm:w-[100px] sm:h-[90px] rounded-2xl border-2 flex flex-col items-center justify-center touch-none cursor-pointer transition-transform shadow-xl ${
                      pressedTouch.gas
                        ? 'bg-[#16a34a] border-[#86efac] text-white scale-95'
                        : 'border-[#22c55e]/85 text-[#86efac]'
                    }`}
                    style={
                      pressedTouch.gas ? undefined : { backgroundColor: 'rgba(13, 20, 31, 0.86)' }
                    }
                  >
                    <span className="font-display italic font-extrabold text-2xl leading-none">
                      GAS
                    </span>
                    <span className="text-[10px] font-bold tracking-wider uppercase mt-1 opacity-90">
                      HOLD
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
