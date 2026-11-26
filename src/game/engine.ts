import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RaceAudioEngine } from './audio';
import { CarVisualRig, createCarModel } from './carModel';
import { CockpitRig, createCockpitModel } from './cockpitModel';
import {
  PhysicsEvent,
  buildRaceCars,
  buildRaceResult,
  computeAiInput,
  computeRearProximity,
  computeStandings,
  detectOvertakeRewards,
  detectUpcomingCorner,
  resolveCarCollisions,
  stepCarPhysics,
} from './physics';
import { ProceduralTextureSet, createProceduralTextures } from './textures';
import { TOTAL_LAPS, TrackData, createTrack } from './track';
import {
  CameraMode,
  CarModelId,
  CarState,
  GameMode,
  GamePhase,
  HudSnapshot,
  InputState,
  RaceResult,
  TrackId,
  buildRivalLineup,
  getCarSpec,
  getLivery,
  getTrackMeta,
} from './types';
import { WorldHandles, buildWorld, getWorldTheme } from './worldBuilder';

interface Particle {
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  grow: number;
  r: number;
  g: number;
  b: number;
}

export interface RaceEngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onPhaseChange: (phase: GamePhase) => void;
  onRaceFinish: (result: RaceResult) => void;
}

const MAX_PARTICLES = 240;
const MAX_SKID_MARKS = 260;

// Scratch objects at module scope (zero GC inside animation loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class RaceEngine {
  public track: TrackData;
  private container: HTMLElement;
  private callbacks: RaceEngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private skyUniforms: {
    uTop: { value: THREE.Color };
    uMid: { value: THREE.Color };
    uHorizon: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
  };
  private textures: ProceduralTextureSet;
  private world: WorldHandles | null = null;
  private audio = new RaceAudioEngine();

  // State
  private phase: GamePhase = 'title';
  private mode: GameMode = 'grand-prix';
  private trackId: TrackId = 'riviera';
  private playerModelId: CarModelId = 'gt3rs';
  private playerLiveryId = 'weissach';
  private cameraMode: CameraMode = 'chase';
  private autoGas = false;

  private cars: CarState[] = [];
  private carRigs = new Map<string, CarVisualRig>();
  private cockpitRig: CockpitRig | null = null;
  private cockpitLight: THREE.PointLight | null = null;
  private raceTime = 0;
  private countdownTimer = 0; // > 0 during 3-2-1 launch
  private lastCountdownStep = 4;
  private bannerText: string | null = null;
  private bannerTimer = 0;
  private skillCallout: string | null = null;
  private skillCalloutTimer = 0;
  private hitstopTimer = 0;
  private shakeTrauma = 0;
  private titleOrbitAngle = 0.52;
  private pointerParallaxX = 0;
  private pointerParallaxY = 0;
  private garageDragging = false;
  private garageLastPtrX = 0;
  private garageLastPtrY = 0;
  private garageUserYaw = 0;
  private garageUserPitch = 0;
  private lastPlayerGear = 1;
  private shiftPopTimer = 0;
  private finishDelayTimer = -1;

  // Camera smoothed state
  private camPos = new THREE.Vector3(0, 6, -12);
  private camLook = new THREE.Vector3(0, 1.2, 10);
  private camRoll = 0;
  private camInitialized = false;

  // Pooled particles
  private particles: Particle[] = [];
  private particleCursor = 0;
  private particleMesh: THREE.InstancedMesh;

  // Pooled tire skid marks ring buffer
  private skidMesh: THREE.InstancedMesh;
  private skidCursor = 0;
  private skidEmitTimer = 0;

  // Unified input state
  private keysHeld = new Set<string>();
  private analogSteer: number | null = null;
  private smoothedDigitalSteer = 0;
  private analogSteerVisual = 0;
  private touchState = {
    left: false,
    right: false,
    gas: false,
    brake: false,
    drift: false,
    boost: false,
  };

  // Loop & timing
  private disposed = false;
  private frameId = 0;
  private lastTimeMs = 0;
  private hudThrottleAccum = 0;
  private resizeObserver: ResizeObserver;
  private physicsEvents: PhysicsEvent[] = [];

  constructor(
    container: HTMLElement,
    callbacks: RaceEngineCallbacks,
    initialOpts: {
      autostart: boolean;
      autoGasDefault: boolean;
      initialTrack?: TrackId;
      initialCamera?: CameraMode;
    }
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.autoGas = initialOpts.autoGasDefault;
    this.trackId = initialOpts.initialTrack ?? 'riviera';
    if (initialOpts.initialCamera) {
      this.cameraMode = initialOpts.initialCamera;
    }
    this.track = createTrack(this.trackId, 720);

    // Detect software WebGL strictly from renderer string
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.setAttribute('data-testid', 'game-canvas');
    container.appendChild(this.renderer.domElement);

    // Scene, sky horizon & matched atmospheric fog
    this.scene = new THREE.Scene();

    // Mandatory studio/outdoor PMREM reflection map on every device
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Dynamic Multi-Biome Sky Dome
    this.skyUniforms = {
      uTop: { value: new THREE.Color(0x206db8) },
      uMid: { value: new THREE.Color(0x76b6e8) },
      uHorizon: { value: new THREE.Color(0xdce8f4) },
      uSunDir: { value: new THREE.Vector3(-0.45, 0.42, 0.78).normalize() },
    };
    const skyGeo = new THREE.SphereGeometry(1850, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
          col = mix(col, uTop, smoothstep(0.28, 0.85, h));
          float sunDot = max(dot(normalize(vDir), uSunDir), 0.0);
          col += vec3(1.0, 0.88, 0.66) * pow(sunDot, 48.0) * 0.58;
          col += vec3(1.0, 0.82, 0.56) * pow(sunDot, 6.0) * 0.14;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.06, 2800);

    // Hemisphere + Directional sun lights (updated per map theme)
    this.hemiLight = new THREE.HemisphereLight(0x9dd1ff, 0x8d7253, 0.95);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffe7c2, 2.35);
    this.sunLight.position.set(-48, 72, 65);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 220;
    const d = 55;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Apply initial theme & build procedural textures + 3D circuit world
    this.applyWorldTheme(this.trackId);
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.world = buildWorld(this.track, this.textures);
    this.scene.add(this.world.group);

    // Pooled Zero-GC Particle InstancedMesh
    const pGeo = new THREE.DodecahedronGeometry(0.24, 0);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, MAX_PARTICLES);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        life: 0,
        maxLife: 0.5,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0.1,
        grow: 0,
        r: 1,
        g: 1,
        b: 1,
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.setRGB(1, 1, 1));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;

    // Pooled Zero-GC Tire Skid Marks InstancedMesh
    const skidGeo = new THREE.PlaneGeometry(0.32, 1.35);
    skidGeo.rotateX(-Math.PI / 2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x0a0d12,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    this.skidMesh = new THREE.InstancedMesh(skidGeo, skidMat, MAX_SKID_MARKS);
    this.skidMesh.frustumCulled = false;
    this.scene.add(this.skidMesh);
    this.clearSkidMarks();

    // Build initial cars on grid
    this.rebuildCarsOnGrid();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind events & resize observer
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    // Start state
    if (initialOpts.autostart) {
      this.startRace(true);
    } else {
      this.setPhase('title');
      this.snapTitleCamera();
    }

    this.lastTimeMs = performance.now();
    this.emitHud();
    this.tick();
  }

  private applyWorldTheme(trackId: TrackId): void {
    const theme = getWorldTheme(trackId);
    this.skyUniforms.uTop.value.setHex(theme.skyTop);
    this.skyUniforms.uMid.value.setHex(theme.skyMid);
    this.skyUniforms.uHorizon.value.setHex(theme.skyHorizon);
    if (trackId === 'tokyo') {
      this.skyUniforms.uSunDir.value.set(0.35, 0.16, 0.92).normalize();
    } else if (trackId === 'alps') {
      this.skyUniforms.uSunDir.value.set(-0.55, 0.36, 0.75).normalize();
    } else {
      this.skyUniforms.uSunDir.value.set(-0.45, 0.42, 0.78).normalize();
    }

    this.scene.background = new THREE.Color(theme.fogHex);
    this.scene.fog = new THREE.FogExp2(theme.fogHex, theme.fogDensity);
    this.sunLight.color.setHex(theme.sunColor);
    this.sunLight.intensity = theme.sunIntensity;
    this.hemiLight.color.setHex(theme.hemiSky);
    this.hemiLight.groundColor.setHex(theme.hemiGround);
    this.hemiLight.intensity = theme.hemiIntensity;
    this.renderer.toneMappingExposure = theme.exposure;
  }

  private clearSkidMarks(): void {
    _dummy.position.set(0, -100, 0);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.setScalar(0.001);
    _dummy.updateMatrix();
    for (let i = 0; i < MAX_SKID_MARKS; i++) {
      this.skidMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
    this.skidCursor = 0;
  }

  private placeSkidMark(x: number, y: number, z: number, heading: number): void {
    _dummy.position.set(x, y + 0.038, z);
    _dummy.rotation.set(0, heading, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    this.skidMesh.setMatrixAt(this.skidCursor, _dummy.matrix);
    this.skidCursor = (this.skidCursor + 1) % MAX_SKID_MARKS;
    this.skidMesh.instanceMatrix.needsUpdate = true;
  }

  private vibrate(pattern: number | number[]): void {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore unsupported environments
    }
  }

  private triggerSkillCallout(text: string): void {
    this.skillCallout = text;
    this.skillCalloutTimer = 1.35;
  }

  private setPhase(next: GamePhase): void {
    this.phase = next;
    document.body.dataset.state = next;
    this.callbacks.onPhaseChange(next);
  }

  public getPhase(): GamePhase {
    return this.phase;
  }

  public selectTrack(trackId: TrackId): void {
    if (this.trackId === trackId) return;
    this.trackId = trackId;
    this.track = createTrack(trackId, 720);

    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }

    this.applyWorldTheme(trackId);
    this.world = buildWorld(this.track, this.textures);
    this.scene.add(this.world.group);

    this.clearSkidMarks();
    this.rebuildCarsOnGrid();
    if (this.phase === 'title') {
      this.snapTitleCamera();
    } else {
      this.snapGameplayCamera();
    }
    this.emitHud();
  }

  public selectCarModel(modelId: CarModelId): void {
    this.playerModelId = modelId;
    const spec = getCarSpec(modelId);
    this.playerLiveryId = spec.defaultLiveryId;
    this.audio.setCarModel(modelId);
    this.rebuildCarsOnGrid();
    this.emitHud();
  }

  public selectLivery(liveryId: string): void {
    this.playerLiveryId = liveryId;
    this.rebuildCarsOnGrid();
    this.emitHud();
  }

  public selectMode(mode: GameMode): void {
    this.mode = mode;
    this.rebuildCarsOnGrid();
    this.emitHud();
  }

  public setAutoGas(enabled: boolean): void {
    this.autoGas = enabled;
    this.emitHud();
  }

  public toggleMute(): void {
    this.audio.unlock();
    this.audio.setMuted(!this.audio.isMuted());
    this.emitHud();
  }

  public cycleCamera(): void {
    const order: CameraMode[] = ['chase', 'cockpit', 'hood', 'far'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    this.syncCarVisuals(0);
    this.emitHud();
  }

  public setAnalogSteer(value: number | null): void {
    if (value !== null) {
      this.audio.unlock();
      this.analogSteer = Math.max(-1, Math.min(1, value));
      this.analogSteerVisual = this.analogSteer;
    } else {
      this.analogSteer = null;
      this.analogSteerVisual = 0;
    }
  }

  public setTouchInput(
    control: 'left' | 'right' | 'gas' | 'brake' | 'drift' | 'boost',
    active: boolean
  ): void {
    if (active) {
      this.audio.unlock();
      if (control === 'boost' || control === 'drift') {
        this.vibrate(12);
      }
    }
    this.touchState[control] = active;
  }

  public clearInputs(): void {
    this.keysHeld.clear();
    this.analogSteer = null;
    this.smoothedDigitalSteer = 0;
    this.analogSteerVisual = 0;
    this.touchState.left = false;
    this.touchState.right = false;
    this.touchState.gas = false;
    this.touchState.brake = false;
    this.touchState.drift = false;
    this.touchState.boost = false;
  }

  public startRace(skipCountdown = false): void {
    if (!skipCountdown) {
      this.audio.unlock();
    }
    this.clearInputs();
    this.clearSkidMarks();
    this.rebuildCarsOnGrid();
    this.raceTime = 0;
    this.finishDelayTimer = -1;
    this.hitstopTimer = 0;
    this.shakeTrauma = 0;
    this.camRoll = 0;
    this.bannerText = null;
    this.bannerTimer = 0;
    this.skillCallout = null;
    this.skillCalloutTimer = 0;
    this.lastPlayerGear = 1;
    this.shiftPopTimer = 0;
    this.audio.setCarModel(this.playerModelId);
    this.countdownTimer = skipCountdown ? 0 : 0.75; // Ultra-snappy 3-2-1-GO arcade launch
    this.lastCountdownStep = skipCountdown ? 0 : 4;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.setPhase('playing');
    this.snapGameplayCamera();
    this.emitHud();
  }

  public pauseRace(): void {
    if (this.phase !== 'playing') return;
    this.clearInputs();
    this.audio.updateContinuous(0, false, false, false);
    this.setPhase('paused');
    this.emitHud();
  }

  public resumeRace(): void {
    if (this.phase !== 'paused') return;
    this.clearInputs();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.setPhase('playing');
    this.lastTimeMs = performance.now();
    this.emitHud();
  }

  public returnToTitle(): void {
    this.clearInputs();
    this.clearSkidMarks();
    this.audio.updateContinuous(0, false, false, false);
    this.rebuildCarsOnGrid();
    this.setPhase('title');
    this.snapTitleCamera();
    this.emitHud();
  }

  private rebuildCarsOnGrid(): void {
    this.carRigs.forEach((rig) => {
      this.scene.remove(rig.root);
      rig.dispose();
    });
    this.carRigs.clear();

    const rivals = buildRivalLineup(this.playerModelId);
    this.cars = buildRaceCars(
      this.track,
      this.mode,
      this.playerModelId,
      this.playerLiveryId,
      rivals
    );

    if (this.cockpitRig) {
      this.scene.remove(this.cockpitRig.root);
      this.cockpitRig.dispose();
      this.cockpitRig = null;
      this.cockpitLight = null;
    }

    for (const car of this.cars) {
      const livery = car.isPlayer
        ? getLivery(this.playerLiveryId)
        : rivals.find((r) => r.id === car.id)?.livery ??
          getLivery(getCarSpec(car.modelId).defaultLiveryId);
      const rig = createCarModel(car.modelId, livery, this.textures);
      this.scene.add(rig.root);
      this.carRigs.set(car.id, rig);

      if (car.isPlayer) {
        const cockpit = createCockpitModel(car.modelId, livery, this.textures);
        const cabinLight = new THREE.PointLight(0xeef6ff, 1.35, 3.2, 1.6);
        cabinLight.position.set(-0.18, 1.34, 0.32);
        cockpit.cabin.add(cabinLight);
        cockpit.root.visible = false;
        this.scene.add(cockpit.root);
        this.cockpitRig = cockpit;
        this.cockpitLight = cabinLight;
      }
    }
    this.syncCarVisuals(0);
  }

  private getPlayerCar(): CarState {
    return this.cars.find((c) => c.isPlayer) ?? this.cars[0];
  }

  private snapTitleCamera(): void {
    const player = this.getPlayerCar();
    const dist = 6.9;
    // Frame hero car from dramatic rear-right 3/4 so the suspension bridge / alpine peaks / lighthouse shine right behind it!
    const angle = player.heading + Math.PI - 0.56;
    this.camPos.set(
      player.x + Math.sin(angle) * dist,
      player.y + 2.35,
      player.z + Math.cos(angle) * dist
    );
    const fwdX = Math.sin(player.heading);
    const fwdZ = Math.cos(player.heading);
    const rightX = -Math.cos(player.heading);
    const rightZ = Math.sin(player.heading);
    this.camLook.set(
      player.x + fwdX * 4.5 - rightX * 1.45,
      player.y + 1.2,
      player.z + fwdZ * 4.5 - rightZ * 1.45
    );
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.fov = 54;
    this.camera.updateProjectionMatrix();
    this.camInitialized = true;
  }

  private snapGameplayCamera(): void {
    this.syncCarVisuals(0);
    if (this.cameraMode === 'cockpit' && this.cockpitRig) {
      this.updateCamera(0.016);
      this.camInitialized = true;
      return;
    }
    const player = this.getPlayerCar();
    const backX = -Math.sin(player.heading);
    const backZ = -Math.cos(player.heading);
    this.camPos.set(player.x + backX * 8.4, player.y + 3.45, player.z + backZ * 8.4);
    this.camLook.set(
      player.x + Math.sin(player.heading) * 14,
      player.y + 1.35,
      player.z + Math.cos(player.heading) * 14
    );
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
    this.camInitialized = true;
  }

  private samplePlayerInput(dt: number): InputState {
    const k = this.keysHeld;
    const up = k.has('KeyW') || k.has('ArrowUp') || this.touchState.gas;
    const down = k.has('KeyS') || k.has('ArrowDown') || this.touchState.brake;
    const left = k.has('KeyA') || k.has('ArrowLeft') || this.touchState.left;
    const right = k.has('KeyD') || k.has('ArrowRight') || this.touchState.right;
    const drift = k.has('Space') || this.touchState.drift;
    const boost =
      k.has('ShiftLeft') ||
      k.has('ShiftRight') ||
      k.has('KeyN') ||
      k.has('KeyE') ||
      this.touchState.boost;

    const throttle = up ? 1 : this.autoGas && !down ? 1 : 0;
    const brake = down ? 1 : 0;

    // Smooth progressive digital steering ramp (snappy return to center, surgical high-speed taps!)
    const rawDigital = (right ? 1 : 0) - (left ? 1 : 0);
    const rate = rawDigital === 0 ? 15.0 : 10.5;
    this.smoothedDigitalSteer +=
      (rawDigital - this.smoothedDigitalSteer) * Math.min(1, dt * rate);
    if (Math.abs(this.smoothedDigitalSteer) < 0.01 && rawDigital === 0) {
      this.smoothedDigitalSteer = 0;
    }

    let steer = this.smoothedDigitalSteer;
    if (this.analogSteer !== null) {
      steer = this.analogSteer;
      this.smoothedDigitalSteer = steer;
    }
    this.analogSteerVisual = steer;

    return { throttle, brake, steer, drift, boost };
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    maxLife: number,
    r: number,
    g: number,
    b: number,
    grow = 0.8
  ): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
    p.active = true;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.size = size;
    p.grow = grow;
    p.r = r;
    p.g = g;
    p.b = b;
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    r: number,
    g: number,
    b: number,
    speed = 8
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.spawnParticle(
        x,
        y,
        z,
        Math.cos(a) * spd,
        2.0 + Math.random() * 4.5,
        Math.sin(a) * spd,
        0.22 + Math.random() * 0.25,
        0.25 + Math.random() * 0.28,
        r,
        g,
        b,
        -0.4
      );
    }
  }

  private updateParticles(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 5.0 * dt;
      const frac = p.life / p.maxLife;
      const scale = Math.max(0.02, p.size * (1 + (1 - frac) * p.grow) * frac);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 4, p.life * 3, 0);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _color.setRGB(p.r, p.g, p.b));
    }
    if (anyChanged) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private syncCarVisuals(dt: number): void {
    const timeSec = performance.now() * 0.001;
    this.skidEmitTimer = Math.max(0, this.skidEmitTimer - dt);
    const emitSkids = this.skidEmitTimer <= 0;
    if (emitSkids) {
      this.skidEmitTimer = 0.042;
    }

    const inCockpit = this.phase !== 'title' && this.cameraMode === 'cockpit';
    const standings = inCockpit ? computeStandings(this.cars) : null;

    for (const car of this.cars) {
      const rig = this.carRigs.get(car.id);
      if (!rig) continue;

      rig.root.position.set(car.x, car.y + car.airY, car.z);
      rig.root.rotation.set(0, car.heading + car.driftAngle, 0);

      rig.chassis.rotation.z = car.bodyRoll;
      rig.chassis.rotation.x = car.bodyPitch;

      // In cockpit view, hide player exterior cabin hull & reveal ultra-detailed working 3D interior!
      rig.root.visible = !(car.isPlayer && inCockpit);

      if (car.isPlayer && this.cockpitRig) {
        this.cockpitRig.root.visible = inCockpit;
        if (this.cockpitLight) {
          this.cockpitLight.intensity = this.trackId === 'tokyo' ? 1.85 : 1.15;
        }
        if (inCockpit) {
          this.cockpitRig.root.position.set(car.x, car.y + car.airY, car.z);
          this.cockpitRig.root.rotation.set(0, car.heading + car.driftAngle, 0);
          this.cockpitRig.cabin.rotation.z = car.bodyRoll * 0.72;
          this.cockpitRig.cabin.rotation.x = car.bodyPitch * 0.65;

          const spec = getCarSpec(car.modelId);
          const posIdx = standings ? standings.findIndex((c) => c.id === car.id) : 0;
          this.cockpitRig.update(
            car,
            {
              speedKmh: Math.abs(car.speed) * spec.speedDisplayScale,
              gear: car.gear,
              rpm: car.rpm,
              nitro: car.nitro,
              isBoosting: car.isBoosting,
              isDrifting: car.isDrifting,
              braking: car.braking,
              steerAngle: car.steerAngle,
              position: posIdx >= 0 ? posIdx + 1 : 1,
              lap: car.lap,
              totalLaps: TOTAL_LAPS,
              lateralG: -car.steerAngle * Math.min(1.4, Math.abs(car.speed) / 42),
              raceTime: this.raceTime,
              isNight: this.trackId === 'tokyo',
              rearThreat: computeRearProximity(car, this.cars, this.track),
            },
            dt
          );
          this.cockpitRig.root.updateMatrixWorld(true);
        }
      }

      // Steer front wheels & spin all 4 wheels synced to speed
      for (const pivot of rig.frontWheelPivots) {
        pivot.rotation.y = car.steerAngle;
      }
      for (const w of rig.wheelMeshes) {
        w.rotation.x = car.wheelSpin;
      }

      // Active Hydraulic DRS Rear Wing / Airbrake Animation (GT3 RS / Chiron / SVJ)
      if (rig.activeWing) {
        const wingTargetRotX =
          car.braking && car.speed > 18
            ? rig.activeWingBaseRotX + 0.52 // Steep airbrake pitch-up!
            : car.isBoosting || car.speed > 62
              ? rig.activeWingBaseRotX - 0.14 // DRS low-drag flat!
              : rig.activeWingBaseRotX;
        const wingTargetY =
          car.braking && car.speed > 18 ? rig.activeWingBaseY + 0.08 : rig.activeWingBaseY;
        const wLerp = dt > 0 ? Math.min(1, dt * 11) : 1;
        rig.activeWing.rotation.x += (wingTargetRotX - rig.activeWing.rotation.x) * wLerp;
        rig.activeWing.position.y += (wingTargetY - rig.activeWing.position.y) * wLerp;
      }

      // Volumetric Headlight Ground Beam Pools (shining bright on Tokyo Night & subtle alpine glint)
      const beamOpacity =
        this.trackId === 'tokyo' ? 0.58 : this.trackId === 'alps' ? 0.14 : 0.0;
      const showBeams = beamOpacity > 0.01 && car.airY < 0.35;
      rig.headlightBeamMat.opacity = beamOpacity;
      for (const beam of rig.headlightBeams) {
        beam.visible = showBeams;
      }

      // Dynamic brake light glow
      rig.tailLightMat.emissiveIntensity = car.braking ? 5.6 : this.trackId === 'tokyo' ? 2.6 : 1.6;

      // Hit flash visual feedback
      if (car.hitFlash > 0.05) {
        rig.paintMat.emissive.setHex(0xffffff);
        rig.paintMat.emissiveIntensity = car.hitFlash * 0.7;
      } else {
        rig.paintMat.emissiveIntensity = 0;
      }

      // Dynamic Nitro afterburner flames + orange-amber gear-shift backfire flame pops!
      const showShiftPop = car.isPlayer && this.shiftPopTimer > 0 && !car.isBoosting;
      if (car.isBoosting) {
        rig.flameMat.color.setHex(0x38bdf8);
      } else if (showShiftPop) {
        rig.flameMat.color.setHex(0xff8c1a);
      }
      for (const flame of rig.flames) {
        flame.visible = car.isBoosting || showShiftPop;
        if (car.isBoosting) {
          const pulse = 0.88 + Math.sin(timeSec * 45 + car.x) * 0.35;
          flame.scale.set(1, 1, pulse);
        } else if (showShiftPop) {
          const popScale = Math.min(1, this.shiftPopTimer / 0.11);
          flame.scale.set(0.85, 0.85, 0.55 * popScale);
        }
      }

      // Emit drift tire smoke, asphalt rubber skid marks & tier sparks while grounded
      if (
        this.phase === 'playing' &&
        dt > 0 &&
        car.airY < 0.08 &&
        car.isDrifting &&
        Math.abs(car.speed) > 14
      ) {
        const visualHeading = car.heading + car.driftAngle;
        const backX = -Math.sin(visualHeading);
        const backZ = -Math.cos(visualHeading);
        const rightX = -Math.cos(visualHeading);
        const rightZ = Math.sin(visualHeading);

        for (const side of [-0.9, 0.9]) {
          const wx = car.x + backX * 1.42 + rightX * side;
          const wz = car.z + backZ * 1.42 + rightZ * side;

          if (emitSkids) {
            this.placeSkidMark(wx, car.y, wz, visualHeading);
          }

          // Tire smoke
          this.spawnParticle(
            wx,
            car.y + 0.16,
            wz,
            (Math.random() - 0.5) * 1.8,
            1.4 + Math.random() * 0.8,
            (Math.random() - 0.5) * 1.8,
            0.35,
            0.35,
            0.92,
            0.93,
            0.95,
            1.8
          );
          // Colored Drift-Tier sparks!
          if (car.driftTier >= 1) {
            const sr = car.driftTier === 3 ? 1.0 : car.driftTier === 2 ? 1.0 : 0.22;
            const sg = car.driftTier === 3 ? 0.25 : car.driftTier === 2 ? 0.72 : 0.78;
            const sb = car.driftTier === 3 ? 0.95 : car.driftTier === 2 ? 0.1 : 1.0;
            this.spawnParticle(
              wx,
              car.y + 0.12,
              wz,
              backX * 7 + (Math.random() - 0.5) * 3,
              2.2 + Math.random() * 2.0,
              backZ * 7 + (Math.random() - 0.5) * 3,
              0.18,
              0.22,
              sr,
              sg,
              sb,
              -0.3
            );
          }
        }
      }
    }
  }

  private updateWorldEffects(dt: number): void {
    if (!this.world) return;
    this.world.waterUniforms.uTime.value += dt;
    const t = this.world.waterUniforms.uTime.value;
    this.textures.waterBump.offset.x = (this.textures.waterBump.offset.x + dt * 0.03) % 1;
    this.textures.waterBump.offset.y = (this.textures.waterBump.offset.y + dt * 0.02) % 1;

    if (this.world.lighthouseBeacon) {
      this.world.lighthouseBeacon.rotation.y += dt * 0.85;
    }

    // Gentle ocean bob for Riviera sailing yachts
    for (let i = 0; i < this.world.animatedYachts.length; i++) {
      const yacht = this.world.animatedYachts[i];
      yacht.rotation.z = Math.sin(t * 1.25 + i * 1.7) * 0.045;
      yacht.rotation.x = Math.cos(t * 0.95 + i * 2.3) * 0.025;
    }

    this.world.boostPadMat.emissiveIntensity = 1.15 + Math.sin(performance.now() * 0.008) * 0.4;
    this.textures.boostPadMap.offset.y = (this.textures.boostPadMap.offset.y - dt * 1.15 + 1) % 1;

    // Update gantry countdown lights
    const step = this.countdownTimer > 0 ? Math.ceil(this.countdownTimer / 0.25) : 0;
    this.world.countdownLights.forEach((mat, idx) => {
      if (this.phase !== 'playing') {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      } else if (step > 0) {
        const lit = idx < 4 - step + 2;
        mat.emissive.setHex(lit ? 0xef4444 : 0x000000);
        mat.emissiveIntensity = lit ? 3.2 : 0;
      } else if (this.raceTime < 2.2) {
        mat.emissive.setHex(0x22c55e);
        mat.emissiveIntensity = 3.5;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });
  }

  private updateCamera(dt: number): void {
    const player = this.getPlayerCar();

    if (this.phase === 'title') {
      // Gentle cinematic hero sway + interactive user drag-to-orbit inspection!
      if (!this.garageDragging) {
        this.titleOrbitAngle += dt * 0.42;
      }
      const dist = 6.9;
      const sway = Math.sin(this.titleOrbitAngle) * 0.24;
      const orbitA =
        player.heading +
        Math.PI -
        0.56 +
        sway +
        this.garageUserYaw +
        this.pointerParallaxX * 0.14;
      const desiredX = player.x + Math.sin(orbitA) * dist;
      const desiredY =
        player.y +
        Math.max(1.25, Math.min(4.6, 2.35 + this.garageUserPitch + this.pointerParallaxY * 0.35));
      const desiredZ = player.z + Math.cos(orbitA) * dist;

      // Offset look target slightly so car sits cleanly on the right while landmarks fill the horizon!
      const fwdX = Math.sin(player.heading);
      const fwdZ = Math.cos(player.heading);
      const rightX = -Math.cos(player.heading);
      const rightZ = Math.sin(player.heading);
      const lookX = player.x + fwdX * 4.5 - rightX * 1.45;
      const lookY = player.y + 1.25;
      const lookZ = player.z + fwdZ * 4.5 - rightZ * 1.45;

      const damp = 1 - Math.exp(-5.0 * dt);
      if (!this.camInitialized) {
        this.camPos.set(desiredX, desiredY, desiredZ);
        this.camLook.set(lookX, lookY, lookZ);
        this.camInitialized = true;
      } else {
        this.camPos.x += (desiredX - this.camPos.x) * damp;
        this.camPos.y += (desiredY - this.camPos.y) * damp;
        this.camPos.z += (desiredZ - this.camPos.z) * damp;
        this.camLook.x += (lookX - this.camLook.x) * damp;
        this.camLook.y += (lookY - this.camLook.y) * damp;
        this.camLook.z += (lookZ - this.camLook.z) * damp;
      }
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      return;
    }

    // Gameplay camera modes
    const fwdX = Math.sin(player.heading);
    const fwdZ = Math.cos(player.heading);
    const speedFrac = Math.min(1, Math.abs(player.speed) / 80);

    const isPortrait = this.camera.aspect < 0.85;

    // FIRST-PERSON INSIDE-CAR COCKPIT CAMERA (World-locked to driver's seat!)
    if (this.cameraMode === 'cockpit' && this.cockpitRig) {
      this.cockpitRig.root.updateMatrixWorld(true);

      // Subtle authentic driver head G-force lean & micro road feel
      const speedVibY =
        player.speed > 14 && player.airY <= 0.05
          ? Math.sin(performance.now() * 0.036) * Math.min(0.008, player.speed * 0.0001)
          : 0;
      const headSwayX = -player.steerAngle * 0.045;
      const headDiveZ = player.braking ? 0.035 : player.isBoosting ? -0.04 : 0;

      // Frame full steering wheel, OLED gauge cluster & panoramic windshield cleanly on both desktop and portrait mobile
      _vec3A.copy(this.cockpitRig.eyeLocalPos);
      _vec3A.x += headSwayX;
      _vec3A.y += speedVibY + (isPortrait ? 0.02 : 0.01);
      _vec3A.z += headDiveZ + (isPortrait ? -0.10 : -0.02);
      this.cockpitRig.cabin.localToWorld(_vec3A);

      // Look slightly down into the road horizon so full wheel & gauges sit cleanly in the lower third
      _vec3B.copy(this.cockpitRig.lookLocalPos);
      _vec3B.x += player.steerAngle * 2.1 - player.driftAngle * 3.8;
      _vec3B.y += isPortrait ? -1.45 : -0.85;
      this.cockpitRig.cabin.localToWorld(_vec3B);

      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.3);
      const shake = this.shakeTrauma * this.shakeTrauma;
      const shakeX = (Math.random() - 0.5) * shake * 0.14;
      const shakeY = (Math.random() - 0.5) * shake * 0.11;

      this.camPos.copy(_vec3A);
      this.camLook.copy(_vec3B);
      this.camera.position.set(_vec3A.x + shakeX, _vec3A.y + shakeY, _vec3A.z);
      this.camera.lookAt(_vec3B);

      const targetRoll = -player.bodyRoll * 0.45 - player.driftAngle * 0.05;
      this.camRoll += (targetRoll - this.camRoll) * (1 - Math.exp(-9.0 * dt));
      this.camera.rotateZ(this.camRoll);

      const cockpitBaseFov = isPortrait ? 80 : 66;
      const targetFov =
        cockpitBaseFov + speedFrac * 6.5 + (player.isBoosting ? 7.5 : 0);
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-8 * dt));
        this.camera.updateProjectionMatrix();
      }

      this.sunLight.position.set(player.x - 45, player.y + 68, player.z + 55);
      this.sunLight.target.position.set(player.x, player.y, player.z);
      return;
    }

    let desiredDist = isPortrait ? 10.4 : 7.6;
    let desiredHeight = isPortrait ? 4.35 : 3.15;
    let lookAhead = 14.0;
    let posLambda = 9.5;
    let baseFov = isPortrait ? 65 : 62;

    if (this.cameraMode === 'far') {
      desiredDist = isPortrait ? 13.0 : 10.6;
      desiredHeight = isPortrait ? 5.5 : 4.55;
      lookAhead = 17.0;
      posLambda = 7.5;
      baseFov = 64;
    } else if (this.cameraMode === 'hood') {
      desiredDist = -0.35;
      desiredHeight = 1.48;
      lookAhead = 26.0;
      posLambda = 28.0;
      baseFov = 68;
    }

    // Pull back gently on speed, nitro boost & jumps
    const boostExtraDist = player.isBoosting ? 1.25 : 0;
    const airExtraDist = player.airY > 0.1 ? Math.min(2.2, player.airY * 0.45) : 0;
    const totalDist =
      this.cameraMode === 'hood'
        ? desiredDist
        : desiredDist + speedFrac * 0.95 + boostExtraDist + airExtraDist;

    const carTotalY = player.y + player.airY;
    _vec3A.set(
      player.x - fwdX * totalDist,
      carTotalY + desiredHeight + player.airY * 0.25,
      player.z - fwdZ * totalDist
    );
    _vec3B.set(
      player.x + fwdX * lookAhead,
      carTotalY + (this.cameraMode === 'hood' ? 1.15 : isPortrait ? 0.35 : 1.3),
      player.z + fwdZ * lookAhead
    );

    const pDamp = 1 - Math.exp(-posLambda * dt);
    const lDamp = 1 - Math.exp(-14.0 * dt);
    this.camPos.lerp(_vec3A, pDamp);
    this.camLook.lerp(_vec3B, lDamp);

    // Trauma-squared decaying camera shake
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.1);
    const shake = this.shakeTrauma * this.shakeTrauma;
    const shakeX = (Math.random() - 0.5) * shake * 0.75;
    const shakeY = (Math.random() - 0.5) * shake * 0.55;

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camera.lookAt(this.camLook);

    // Subtle exhilarating horizon bank into drifts & high-G corners
    const targetRoll =
      this.cameraMode === 'hood'
        ? -player.driftAngle * 0.08
        : -player.driftAngle * 0.13 - player.steerAngle * 0.045 * speedFrac;
    this.camRoll += (targetRoll - this.camRoll) * (1 - Math.exp(-7.5 * dt));
    this.camera.rotateZ(this.camRoll);

    // Speed & Nitro FOV kick
    const targetFov =
      baseFov +
      speedFrac * 7.0 +
      (player.isBoosting ? 8.0 : 0) +
      (player.airY > 0.2 ? 3.5 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-8 * dt));
      this.camera.updateProjectionMatrix();
    }

    // Keep tight directional shadow frustum centered around player car
    this.sunLight.position.set(player.x - 45, player.y + 68, player.z + 55);
    this.sunLight.target.position.set(player.x, player.y, player.z);
  }

  private stepSimulation(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);
    this.updateWorldEffects(dt);

    if (this.phase === 'title') {
      this.updateCamera(dt);
      this.updateParticles(dt);
      return;
    }

    if (this.phase === 'paused') {
      return;
    }

    // Banner & skill callout timers
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerText = null;
    }
    if (this.skillCalloutTimer > 0) {
      this.skillCalloutTimer -= dt;
      if (this.skillCalloutTimer <= 0) this.skillCallout = null;
    }

    // Sim-level Hitstop on heavy impacts (camera shake & visuals keep ticking!)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateCamera(dt);
      this.updateParticles(dt);
      return;
    }

    // Launch countdown (0.25s per step: 3, 2, 1, GO!) + Perfect Launch detection
    let canDrive = true;
    if (this.countdownTimer > 0) {
      this.countdownTimer = Math.max(0, this.countdownTimer - dt);
      const step = Math.ceil(this.countdownTimer / 0.25);
      if (step !== this.lastCountdownStep) {
        this.lastCountdownStep = step;
        if (step >= 1 && step <= 3) {
          this.audio.playCountdownBeep(false);
        } else if (step === 0) {
          this.audio.playCountdownBeep(true);
          this.bannerText = 'GO!';
          this.bannerTimer = 0.9;
          // Perfect Launch reward when revving throttle on GO!
          const launchInput = this.samplePlayerInput(dt);
          const playerCar = this.getPlayerCar();
          if (launchInput.throttle > 0.5 || launchInput.boost) {
            playerCar.speed = Math.max(playerCar.speed, 16);
            playerCar.boostPadTimer = Math.max(playerCar.boostPadTimer, 0.72);
            playerCar.skillScore += 150;
            this.shiftPopTimer = 0.16;
            this.audio.playBoostSurge(2);
            this.triggerSkillCallout('PERFECT LAUNCH! +150');
          }
        }
      }
      canDrive = this.countdownTimer <= 0;
    }

    if (this.phase === 'playing' && canDrive) {
      this.raceTime += dt;
    }

    this.physicsEvents.length = 0;

    // Step all cars
    for (const car of this.cars) {
      const input =
        car.isPlayer && this.phase === 'playing' && !car.finished
          ? this.samplePlayerInput(dt)
          : computeAiInput(car, this.cars, this.track, this.raceTime);

      stepCarPhysics(
        car,
        input,
        this.track,
        this.cars,
        dt,
        this.raceTime,
        canDrive,
        this.physicsEvents
      );
    }

    resolveCarCollisions(this.cars, this.physicsEvents, this.track);
    if (canDrive && this.phase === 'playing') {
      detectOvertakeRewards(this.cars, this.raceTime, this.physicsEvents);
    }

    // Handle weight-scaled juice events
    for (const ev of this.physicsEvents) {
      if (ev.type === 'wall-hit' || ev.type === 'car-hit') {
        this.spawnBurst(ev.x, ev.y, ev.z, ev.isPlayer ? 16 : 8, 1.0, 0.78, 0.25, 10);
        if (ev.isPlayer) {
          this.shakeTrauma = Math.min(1, this.shakeTrauma + ev.intensity * 0.72);
          if (ev.intensity > 0.48) {
            this.hitstopTimer = 0.035;
          }
          this.audio.playCollision(ev.intensity);
          this.vibrate(Math.round(18 + ev.intensity * 30));
        }
      } else if (ev.type === 'boost-pad') {
        this.spawnBurst(ev.x, ev.y, ev.z, 12, 0.2, 0.85, 1.0, 9);
        if (ev.isPlayer) {
          this.audio.playBoostSurge(2);
          this.vibrate(18);
          this.bannerText = 'APEX BOOST!';
          this.bannerTimer = 0.85;
        }
      } else if (ev.type === 'jump-launch') {
        this.spawnBurst(ev.x, ev.y + 0.3, ev.z, 14, 1.0, 0.75, 0.2, 9);
        if (ev.isPlayer) {
          this.audio.playBoostSurge(1);
          this.vibrate(20);
          this.triggerSkillCallout('AIRBORNE!');
        }
      } else if (ev.type === 'jump-land') {
        this.spawnBurst(ev.x, ev.y + 0.2, ev.z, 18, 0.95, 0.88, 0.55, 10);
        if (ev.isPlayer) {
          this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.32);
          this.audio.playBoostSurge(2);
          this.vibrate([15, 22, 24]);
          this.triggerSkillCallout(`AIRTIME! +${ev.points ?? 150}`);
        }
      } else if (ev.type === 'overtake') {
        this.spawnBurst(ev.x, ev.y + 0.7, ev.z, 14, 0.25, 0.92, 1.0, 8);
        if (ev.isPlayer) {
          this.audio.playBoostSurge(2);
          this.vibrate(22);
          this.triggerSkillCallout(`OVERTAKE! +${ev.points ?? 250}`);
        }
      } else if (ev.type === 'drift-release') {
        this.spawnBurst(ev.x, ev.y + 0.3, ev.z, 14, 1.0, 0.55, 0.15, 9);
        if (ev.isPlayer) {
          this.audio.playBoostSurge(ev.tier ?? 1);
          this.vibrate(18);
          const labels = ['', 'DRIFT BOOST!', 'SUPER DRIFT!', 'ULTRA APEX DRIFT!'];
          this.bannerText = labels[ev.tier ?? 1] ?? 'DRIFT BOOST!';
          this.bannerTimer = 0.95;
          if (ev.points && ev.points > 40) {
            this.triggerSkillCallout(`CLEAN DRIFT +${ev.points}`);
          }
        }
      } else if (ev.type === 'lap-complete' && ev.isPlayer) {
        this.audio.playLapChime(false);
        this.bannerText = ev.lap === TOTAL_LAPS ? 'FINAL LAP!' : `LAP ${ev.lap} / ${TOTAL_LAPS}`;
        this.bannerTimer = 1.6;
      } else if (ev.type === 'race-finish' && ev.isPlayer && this.finishDelayTimer < 0) {
        this.audio.playLapChime(true);
        this.bannerText = 'FINISH!';
        this.bannerTimer = 1.2;
        this.finishDelayTimer = 0.65;
      }
    }

    // Delayed immutable race finish transition
    if (this.finishDelayTimer >= 0) {
      this.finishDelayTimer -= dt;
      if (this.finishDelayTimer <= 0 && this.phase === 'playing') {
        this.finishDelayTimer = -1;
        this.audio.updateContinuous(0, false, false, false);
        const result = buildRaceResult(this.cars, this.mode, this.track, this.raceTime);
        this.setPhase('gameover');
        this.callbacks.onRaceFinish(result);
        this.emitHud();
      }
    }

    // Gear-shift exhaust crackle & backfire flame pop detection
    const player = this.getPlayerCar();
    this.shiftPopTimer = Math.max(0, this.shiftPopTimer - dt);
    if (this.phase === 'playing' && canDrive && player.speed > 10 && player.gear !== this.lastPlayerGear) {
      const upshift = player.gear > this.lastPlayerGear;
      this.audio.playGearShift(upshift);
      this.shiftPopTimer = upshift ? 0.12 : 0.09;
    }
    this.lastPlayerGear = player.gear;

    // Continuous engine, turbo spool, tire screech & high-speed aerodynamic wind audio
    const playerSpec = getCarSpec(player.modelId);
    this.audio.updateContinuous(
      player.rpm,
      player.isDrifting && player.airY < 0.1,
      player.isBoosting,
      this.phase === 'playing',
      Math.abs(player.speed) / Math.max(1, playerSpec.topSpeedMs)
    );

    this.syncCarVisuals(dt);
    this.updateCamera(dt);
    this.updateParticles(dt);

    // Throttled HUD updates (~14Hz for snappy speedometer without 60Hz React churn)
    this.hudThrottleAccum += dt;
    if (this.hudThrottleAccum >= 0.07) {
      this.hudThrottleAccum = 0;
      this.emitHud();
    }
  }

  private emitHud(): void {
    const player = this.getPlayerCar();
    const spec = getCarSpec(player.modelId);
    const trackMeta = getTrackMeta(this.trackId);
    const ordered = computeStandings(this.cars);
    const posIdx = ordered.findIndex((c) => c.isPlayer);
    const countdownVal =
      this.phase === 'playing' && this.countdownTimer > 0
        ? Math.ceil(this.countdownTimer / 0.25)
        : this.phase === 'playing' &&
            this.raceTime < 0.7 &&
            this.countdownTimer <= 0 &&
            this.lastCountdownStep === 0
          ? 0
          : -1;

    const upcoming =
      this.phase === 'playing' && !player.wrongWay
        ? detectUpcomingCorner(this.track, player.trackS, player.speed)
        : { direction: null, severity: 0 };

    const snapshot: HudSnapshot = {
      phase: this.phase,
      mode: this.mode,
      trackId: this.trackId,
      trackName: trackMeta.name,
      carModelId: player.modelId,
      carName: spec.shortName,
      speedKmh: Math.round(Math.abs(player.speed) * spec.speedDisplayScale),
      gear: player.gear,
      rpm: player.rpm,
      nitro: Math.round(player.nitro),
      isBoosting: player.isBoosting,
      isDrifting: player.isDrifting,
      isAirborne: player.airY > 0.2,
      driftTier: player.driftTier,
      driftCharge: player.driftCharge,
      driftPoints: Math.round(player.driftPointsRun),
      totalDriftPoints: Math.round(player.totalDriftPoints),
      skillScore: Math.round(player.skillScore),
      position: posIdx >= 0 ? posIdx + 1 : 1,
      totalRacers: this.cars.length,
      lap: Math.min(TOTAL_LAPS, player.lap),
      totalLaps: TOTAL_LAPS,
      raceTime: this.raceTime,
      bestLapTime: player.bestLapTime,
      lastLapTime: player.lastLapTime,
      countdown: countdownVal,
      wrongWay: player.wrongWay,
      slipstream: player.slipstreamTimer > 0.35,
      upcomingTurn: upcoming.direction,
      upcomingTurnSeverity: upcoming.severity,
      bannerText: this.bannerText,
      skillCallout: this.skillCallout,
      cameraMode: this.cameraMode,
      muted: this.audio.isMuted(),
      autoGas: this.autoGas,
      analogSteerVisual: this.analogSteerVisual,
      minimapDots: this.cars.map((c) => ({
        id: c.id,
        x: c.x,
        z: c.z,
        heading: c.heading,
        isPlayer: c.isPlayer,
        color: c.liveryColor,
      })),
    };

    this.callbacks.onHudUpdate(snapshot);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastTimeMs) / 1000);
    this.lastTimeMs = now;

    this.stepSimulation(rawDt);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.render(this.scene, this.camera);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    if (this.phase === 'title') {
      if ((code === 'Enter' || code === 'Space') && !e.repeat) {
        this.startRace(false);
      }
      return;
    }

    if (this.phase === 'playing') {
      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        this.pauseRace();
        return;
      }
      if (code === 'KeyC' && !e.repeat) {
        this.cycleCamera();
        return;
      }
      if (code === 'KeyM' && !e.repeat) {
        this.toggleMute();
        return;
      }
      if (code === 'KeyR' && !e.repeat) {
        this.startRace(false);
        return;
      }
    } else if (this.phase === 'paused') {
      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        this.resumeRace();
        return;
      }
    } else if (this.phase === 'gameover') {
      if ((code === 'Enter' || code === 'Space') && !e.repeat) {
        this.startRace(false);
        return;
      }
    }

    this.audio.unlock();
    this.keysHeld.add(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private onBlur = (): void => {
    this.clearInputs();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearInputs();
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'title') return;
    // Allow dragging anywhere on the open 3D garage canvas (not over UI buttons) to orbit around the car!
    if (e.target !== this.renderer.domElement) return;
    this.garageDragging = true;
    this.garageLastPtrX = e.clientX;
    this.garageLastPtrY = e.clientY;
  };

  private onPointerUp = (): void => {
    this.garageDragging = false;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.phase !== 'title') return;
    if (this.garageDragging) {
      const dx = e.clientX - this.garageLastPtrX;
      const dy = e.clientY - this.garageLastPtrY;
      this.garageLastPtrX = e.clientX;
      this.garageLastPtrY = e.clientY;
      this.garageUserYaw -= dx * 0.0085;
      this.garageUserPitch = Math.max(-0.9, Math.min(1.8, this.garageUserPitch + dy * 0.007));
      return;
    }
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    this.pointerParallaxX = (e.clientX / w - 0.5) * 2;
    this.pointerParallaxY = (e.clientY / h - 0.5) * 2;
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
  }

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    this.resizeObserver.disconnect();

    this.carRigs.forEach((rig) => rig.dispose());
    this.carRigs.clear();
    if (this.cockpitRig) {
      this.cockpitRig.dispose();
      this.cockpitRig = null;
      this.cockpitLight = null;
    }
    this.world?.dispose();
    this.textures.dispose();
    this.audio.dispose();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.skidMesh.geometry.dispose();
    (this.skidMesh.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
