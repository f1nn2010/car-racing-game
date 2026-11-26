import { useCallback, useEffect, useRef, useState } from 'react';
import { FinishModal, PauseModal } from './components/GameModal';
import { RaceHud } from './components/RaceHud';
import { TitleOverlay } from './components/TitleOverlay';
import { RaceEngine } from './game/engine';
import {
  RecordsMap,
  loadTrackRecords,
  mergeRaceIntoRecords,
  saveTrackRecords,
} from './game/records';
import { TOTAL_LAPS } from './game/track';
import {
  CarModelId,
  GameMode,
  GamePhase,
  HudSnapshot,
  RaceResult,
  TrackId,
  getCarSpec,
  getTrackMeta,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  mode: 'grand-prix',
  trackId: 'riviera',
  trackName: 'Amalfi Riviera',
  carModelId: 'gt3rs',
  carName: '911 GT3 RS',
  speedKmh: 0,
  gear: 1,
  rpm: 0.18,
  nitro: 65,
  isBoosting: false,
  isDrifting: false,
  isAirborne: false,
  driftTier: 0,
  driftCharge: 0,
  driftPoints: 0,
  totalDriftPoints: 0,
  skillScore: 0,
  position: 4,
  totalRacers: 4,
  lap: 1,
  totalLaps: TOTAL_LAPS,
  raceTime: 0,
  bestLapTime: null,
  lastLapTime: null,
  countdown: -1,
  wrongWay: false,
  slipstream: false,
  upcomingTurn: null,
  upcomingTurnSeverity: 0,
  bannerText: null,
  skillCallout: null,
  cameraMode: 'chase',
  muted: false,
  autoGas: false,
  analogSteerVisual: 0,
  minimapDots: [],
};

function detectTouchOrMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.innerWidth <= 920 ||
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window
  );
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RaceEngine | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [selectedTrack, setSelectedTrack] = useState<TrackId>('riviera');
  const [selectedCar, setSelectedCar] = useState<CarModelId>('gt3rs');
  const [selectedLivery, setSelectedLivery] = useState<string>('weissach');
  const [selectedMode, setSelectedMode] = useState<GameMode>('grand-prix');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [trackRecords, setTrackRecords] = useState<RecordsMap>(() => loadTrackRecords());
  const trackRecordsRef = useRef<RecordsMap>(trackRecords);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(() =>
    detectTouchOrMobileViewport()
  );

  const userToggledAutoGasRef = useRef(false);

  // Sync mobile viewport changes cleanly so touch controls & Auto-Gas activate automatically on mobile screens
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= 920) {
        setShowTouchControls(true);
        if (!userToggledAutoGasRef.current) {
          engineRef.current?.setAutoGas(true);
        }
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Mount Three.js RaceEngine ONCE in isolated canvas ref
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';
    const trackParam = params.get('track');
    const initialTrack: TrackId =
      trackParam === 'tokyo' || trackParam === 'alps' || trackParam === 'riviera'
        ? trackParam
        : 'riviera';
    if (initialTrack !== 'riviera') {
      setSelectedTrack(initialTrack);
    }
    const camParam = params.get('cam');
    const initialCamera =
      camParam === 'cockpit' || camParam === 'hood' || camParam === 'far' || camParam === 'chase'
        ? camParam
        : undefined;
    const isMobile = detectTouchOrMobileViewport();

    const engine = new RaceEngine(
      mount,
      {
        onHudUpdate: (snapshot) => setHud(snapshot),
        onPhaseChange: (nextPhase) => setPhase(nextPhase),
        onRaceFinish: (result) => {
          const merged = mergeRaceIntoRecords(trackRecordsRef.current, result.trackId, {
            bestLapSec: result.bestLapTime,
            totalRaceSec: result.totalTime,
            position: result.position,
            isGrandPrix: result.mode === 'grand-prix',
          });
          trackRecordsRef.current = merged.updated;
          setTrackRecords(merged.updated);
          saveTrackRecords(merged.updated);
          setRaceResult({
            ...result,
            newTrackRecord: merged.newBestLap || merged.newBestRace,
          });
        },
      },
      {
        autostart,
        autoGasDefault: isMobile,
        initialTrack,
        initialCamera,
      }
    );

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleSelectTrack = useCallback((id: TrackId) => {
    setSelectedTrack(id);
    engineRef.current?.selectTrack(id);
  }, []);

  const handleSelectCar = useCallback((id: CarModelId) => {
    setSelectedCar(id);
    const defLiv = getCarSpec(id).defaultLiveryId;
    setSelectedLivery(defLiv);
    engineRef.current?.selectCarModel(id);
  }, []);

  const handleSelectLivery = useCallback((id: string) => {
    setSelectedLivery(id);
    engineRef.current?.selectLivery(id);
  }, []);

  const handleSelectMode = useCallback((mode: GameMode) => {
    setSelectedMode(mode);
    engineRef.current?.selectMode(mode);
  }, []);

  const handleStart = useCallback(() => {
    setRaceResult(null);
    engineRef.current?.startRace(false);
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeRace();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseRace();
  }, []);

  const handleTitle = useCallback(() => {
    setRaceResult(null);
    engineRef.current?.returnToTitle();
  }, []);

  const handleCycleCamera = useCallback(() => {
    engineRef.current?.cycleCamera();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleToggleAutoGas = useCallback(() => {
    userToggledAutoGasRef.current = true;
    engineRef.current?.setAutoGas(!hud.autoGas);
  }, [hud.autoGas]);

  const handleAnalogSteer = useCallback((value: number | null) => {
    engineRef.current?.setAnalogSteer(value);
  }, []);

  const handleTouchInput = useCallback(
    (control: 'left' | 'right' | 'gas' | 'brake' | 'drift' | 'boost', active: boolean) => {
      engineRef.current?.setTouchInput(control, active);
    },
    []
  );

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0d1520]">
      {/* Isolated WebGL Canvas Container — never re-created on React HUD state updates */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full" />

      {phase === 'title' && (
        <TitleOverlay
          selectedTrack={selectedTrack}
          selectedCar={selectedCar}
          selectedLivery={selectedLivery}
          selectedMode={selectedMode}
          trackRecords={trackRecords}
          onSelectTrack={handleSelectTrack}
          onSelectCar={handleSelectCar}
          onSelectLivery={handleSelectLivery}
          onSelectMode={handleSelectMode}
          onStart={handleStart}
        />
      )}

      {phase === 'playing' && engineRef.current && (
        <RaceHud
          hud={hud}
          track={engineRef.current.track}
          showTouchControls={showTouchControls}
          onToggleTouchControls={() => setShowTouchControls((v) => !v)}
          onToggleAutoGas={handleToggleAutoGas}
          onCycleCamera={handleCycleCamera}
          onToggleMute={handleToggleMute}
          onRestart={handleStart}
          onPause={handlePause}
          onAnalogSteer={handleAnalogSteer}
          onTouchInput={handleTouchInput}
        />
      )}

      {phase === 'paused' && (
        <PauseModal
          trackName={getTrackMeta(selectedTrack).name}
          carName={getCarSpec(selectedCar).name}
          lap={hud.lap}
          totalLaps={hud.totalLaps}
          raceTime={hud.raceTime}
          onResume={handleResume}
          onRestart={handleStart}
          onTitle={handleTitle}
        />
      )}

      {phase === 'gameover' && raceResult && (
        <FinishModal
          result={raceResult}
          onRestart={handleStart}
          onTitle={handleTitle}
        />
      )}
    </main>
  );
}
