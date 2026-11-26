import * as THREE from 'three';
import { CarLivery, CarModelId, CarState, getCarSpec } from './types';
import { ProceduralTextureSet } from './textures';

export interface CockpitTelemetry {
  speedKmh: number;
  gear: number;
  rpm: number;
  nitro: number;
  isBoosting: boolean;
  isDrifting: boolean;
  braking: boolean;
  steerAngle: number;
  position: number;
  lap: number;
  totalLaps: number;
  lateralG: number;
  raceTime: number;
  isNight: boolean;
  rearThreat: { left: number; center: number; right: number };
}

export interface CockpitRig {
  root: THREE.Group;
  cabin: THREE.Group;
  steeringWheel: THREE.Group;
  leftPaddle: THREE.Mesh;
  rightPaddle: THREE.Mesh;
  nitroBtnMat: THREE.MeshStandardMaterial;
  shiftLedMats: THREE.MeshStandardMaterial[];
  ambientTrimMat: THREE.MeshStandardMaterial;
  eyeLocalPos: THREE.Vector3;
  lookLocalPos: THREE.Vector3;
  update: (car: CarState, telemetry: CockpitTelemetry, dt: number) => void;
  dispose: () => void;
}

/**
 * High-detail 3D first-person supercar cockpit interior:
 * - Sculpted curved carbon/Alcantara binnacle & dashboard with sport-chrono dial
 * - Crystal-clear live OLED digital instrument cluster (RPM arc, Speed, Gear, Nitro, Pos/Lap)
 *   positioned cleanly inside the steering wheel sightline
 * - Live animated GT3/Hypercar flat-bottom steering wheel with 12-o'clock racing stripe,
 *   model crest, manettino mode dials, glowing Nitro/DRS buttons, animated paddle shifters,
 *   and integrated 8-LED F1 shift-light bar
 * - Paint-matched sculpted front hood, raised fenders, sleek A-pillars, wing mirrors & rearview mirror
 */
export function createCockpitModel(
  modelId: CarModelId,
  livery: CarLivery,
  textures: ProceduralTextureSet
): CockpitRig {
  const root = new THREE.Group();
  const cabin = new THREE.Group();
  root.add(cabin);

  const disposables: Array<{ dispose: () => void }> = [];
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };

  // --- Shared Premium Interior & Paint-Matched Exterior Materials ---
  const paintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: livery.bodyHex,
      metalness: modelId === 'chiron' ? 0.56 : 0.42,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    })
  );
  const stripeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: livery.stripeHex,
      metalness: 0.25,
      roughness: 0.22,
      clearcoat: 0.9,
    })
  );
  const accentColor = livery.caliperHex;
  const stitchMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.42,
      metalness: 0.2,
    })
  );
  const alcantaraMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x151820,
      roughness: 0.92,
      metalness: 0.05,
    })
  );
  const leatherMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1d222c,
      roughness: 0.68,
      metalness: 0.1,
    })
  );
  const carbonMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x262c36,
      map: textures.carbonMap,
      roughness: 0.28,
      metalness: 0.4,
      clearcoat: 0.82,
      clearcoatRoughness: 0.12,
    })
  );
  const brushedAluMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4dce6,
      roughness: 0.22,
      metalness: 0.9,
    })
  );
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x10141c,
      roughness: 0.36,
      metalness: 0.78,
    })
  );
  const mirrorGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x7ea8d4,
      metalness: 0.94,
      roughness: 0.06,
      clearcoat: 1.0,
    })
  );
  const ambientTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.9,
      roughness: 0.28,
    })
  );

  // Driver coordinate frame (+Z forward, +X screen left, -X screen right):
  // Pulled slightly back so the full steering wheel, emblem hub, rotary dials, OLED cluster,
  // sculpted hood & panoramic road ahead all sit in balanced AAA proportions!
  const eyeLocalPos = new THREE.Vector3(0, 1.16, -0.09);
  const lookLocalPos = new THREE.Vector3(0, 0.88, 14.0);

  // =========================================================================
  // 1. PAINT-MATCHED SCULPTED FRONT HOOD & FENDERS (Visible out windshield!)
  // =========================================================================
  const hoodGroup = new THREE.Group();
  cabin.add(hoodGroup);

  const hoodMain = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.78, 0.14, 1.6)), paintMat);
  hoodMain.position.set(-0.22, 0.72, 1.66);
  hoodMain.rotation.x = 0.085;
  hoodGroup.add(hoodMain);

  // Sleek beveled front fender peaks
  const fenderGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.16, 1.54));
  const leftFender = new THREE.Mesh(fenderGeo, paintMat);
  leftFender.position.set(0.68, 0.77, 1.62);
  leftFender.rotation.set(0.08, 0, -0.15);
  hoodGroup.add(leftFender);

  const rightFender = new THREE.Mesh(fenderGeo, paintMat);
  rightFender.position.set(-1.12, 0.77, 1.62);
  rightFender.rotation.set(0.08, 0, 0.15);
  hoodGroup.add(rightFender);

  if (modelId === 'gt3rs') {
    const centerStripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.018, 1.5)), stripeMat);
    centerStripe.position.set(-0.22, 0.8, 1.66);
    centerStripe.rotation.x = 0.085;
    hoodGroup.add(centerStripe);

    for (const sx of [0.12, -0.56]) {
      const vent = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.028, 0.44)), carbonMat);
      vent.position.set(sx, 0.805, 1.68);
      vent.rotation.x = 0.085;
      hoodGroup.add(vent);
    }
  } else if (modelId === 'chiron') {
    const spine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.05, 1.52)), brushedAluMat);
    spine.position.set(-0.22, 0.81, 1.66);
    spine.rotation.x = 0.085;
    hoodGroup.add(spine);
  } else if (modelId === 'f40') {
    for (const sx of [0.08, -0.52]) {
      const duct = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.025, 0.48)), darkMetalMat);
      duct.position.set(sx, 0.8, 1.7);
      duct.rotation.x = 0.085;
      hoodGroup.add(duct);
    }
  } else {
    const ridgeL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.04, 1.48)), carbonMat);
    ridgeL.position.set(0.16, 0.81, 1.66);
    ridgeL.rotation.set(0.085, -0.08, 0);
    hoodGroup.add(ridgeL);
    const ridgeR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.04, 1.48)), carbonMat);
    ridgeR.position.set(-0.6, 0.81, 1.66);
    ridgeR.rotation.set(0.085, 0.08, 0);
    hoodGroup.add(ridgeR);
  }

  // Sleek dark lower windshield cowl
  const cowl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.08, 0.08, 0.24)), darkMetalMat);
  cowl.position.set(-0.22, 0.82, 1.06);
  cabin.add(cowl);

  // =========================================================================
  // 2. SCULPTED CURVED ALCANTARA & CARBON DASHBOARD + AERODYNAMIC BINNACLE
  // =========================================================================
  const dashUpper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.12, 0.22, 0.56)), alcantaraMat);
  dashUpper.position.set(-0.24, 0.74, 0.88);
  dashUpper.rotation.x = 0.07;
  cabin.add(dashUpper);

  // Contrasting double-stitch accent rib across top dash edge
  const dashStitch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.02, 0.011, 0.016)), stitchMat);
  dashStitch.position.set(-0.24, 0.848, 0.64);
  cabin.add(dashStitch);

  // Carbon-fiber horizontal dash fascia
  const dashCarbon = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.04, 0.15, 0.08)), carbonMat);
  dashCarbon.position.set(-0.24, 0.69, 0.63);
  cabin.add(dashCarbon);

  // Ambient cabin LED light blade along dash lip (pulses cyan on boost, amber on drift!)
  const ambientBlade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.98, 0.012, 0.014)), ambientTrimMat);
  ambientBlade.position.set(-0.24, 0.618, 0.59);
  cabin.add(ambientBlade);

  // Sleek modern GT3 RS / Hypercar floating carbon OLED display housing & top anti-glare visor
  const binnacleBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.555, 0.245, 0.04)), carbonMat);
  binnacleBack.position.set(0, 0.902, 0.778);
  cabin.add(binnacleBack);

  // Subtle top carbon overhang visor cleanly ABOVE the OLED cluster (zero RPM bar obstruction!)
  const glareVisor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.565, 0.018, 0.10)), alcantaraMat);
  glareVisor.position.set(0, 1.034, 0.745);
  cabin.add(glareVisor);

  // Sport Chrono Stopwatch Pod on center-right dash with crisp dial face + live rotating sweep hand!
  const chronoCanvas = document.createElement('canvas');
  chronoCanvas.width = 128;
  chronoCanvas.height = 128;
  const chCtx = chronoCanvas.getContext('2d')!;
  const chronoTex = new THREE.CanvasTexture(chronoCanvas);
  chronoTex.colorSpace = THREE.SRGBColorSpace;
  disposables.push(chronoTex);

  const drawChrono = (sec: number) => {
    chCtx.fillStyle = '#090d16';
    chCtx.fillRect(0, 0, 128, 128);
    chCtx.strokeStyle = '#cbd5e1';
    chCtx.lineWidth = 4;
    chCtx.beginPath();
    chCtx.arc(64, 64, 54, 0, Math.PI * 2);
    chCtx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      chCtx.strokeStyle = i % 3 === 0 ? '#f8fafc' : '#64748b';
      chCtx.lineWidth = i % 3 === 0 ? 3 : 2;
      chCtx.beginPath();
      chCtx.moveTo(64 + Math.cos(a) * 42, 64 + Math.sin(a) * 42);
      chCtx.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50);
      chCtx.stroke();
    }
    const needleAngle = -Math.PI / 2 + ((sec % 60) / 60) * Math.PI * 2;
    chCtx.strokeStyle = '#ef4444';
    chCtx.lineWidth = 3.5;
    chCtx.beginPath();
    chCtx.moveTo(64, 64);
    chCtx.lineTo(64 + Math.cos(needleAngle) * 42, 64 + Math.sin(needleAngle) * 42);
    chCtx.stroke();
    chCtx.fillStyle = '#f8fafc';
    chCtx.beginPath();
    chCtx.arc(64, 64, 5, 0, Math.PI * 2);
    chCtx.fill();
    chronoTex.needsUpdate = true;
  };
  drawChrono(0);

  const chronoBezel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.052, 0.056, 0.07, 22)), darkMetalMat);
  chronoBezel.rotation.x = Math.PI / 2;
  chronoBezel.position.set(-0.44, 0.902, 0.782);
  cabin.add(chronoBezel);

  const chronoFace = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.046, 22)),
    trackMat(new THREE.MeshBasicMaterial({ map: chronoTex, toneMapped: false }))
  );
  chronoFace.rotation.y = Math.PI;
  chronoFace.position.set(-0.44, 0.902, 0.744);
  cabin.add(chronoFace);

  // Sculpted Center Console & Carbon Tunnel on driver's right (-X)
  const centerTunnel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.40, 0.94)), leatherMat);
  centerTunnel.position.set(-0.56, 0.45, 0.34);
  cabin.add(centerTunnel);

  const tunnelCarbon = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.29, 0.03, 0.74)), carbonMat);
  tunnelCarbon.position.set(-0.56, 0.652, 0.36);
  cabin.add(tunnelCarbon);

  // Brushed aluminum toggle switches along center console
  for (let i = 0; i < 4; i++) {
    const sw = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.022, 0.022, 0.016)), brushedAluMat);
    sw.position.set(-0.47 - i * 0.056, 0.68, 0.56);
    cabin.add(sw);
  }

  // =========================================================================
  // 3. LIVE HIGH-RES OLED INSTRUMENT CLUSTER + CENTER CONSOLE TELEMETRY SCREEN
  // =========================================================================
  const dashCanvas = document.createElement('canvas');
  dashCanvas.width = 512;
  dashCanvas.height = 256;
  const dashCtx = dashCanvas.getContext('2d')!;
  const dashTex = new THREE.CanvasTexture(dashCanvas);
  dashTex.colorSpace = THREE.SRGBColorSpace;
  disposables.push(dashTex);

  const dashScreenMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: dashTex,
      toneMapped: false,
    })
  );
  // Flush in front of binnacleBack so RPM bar, Speed, Gear & Nitro are 100% visible!
  const dashScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.515, 0.218)), dashScreenMat);
  dashScreen.position.set(0, 0.902, 0.752);
  dashScreen.rotation.y = Math.PI;
  cabin.add(dashScreen);

  // Center console secondary telemetry screen (angled cleanly toward driver)
  const consoleCanvas = document.createElement('canvas');
  consoleCanvas.width = 256;
  consoleCanvas.height = 192;
  const consoleCtx = consoleCanvas.getContext('2d')!;
  const consoleTex = new THREE.CanvasTexture(consoleCanvas);
  consoleTex.colorSpace = THREE.SRGBColorSpace;
  disposables.push(consoleTex);

  const consoleBezel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.036)), darkMetalMat);
  consoleBezel.position.set(-0.56, 0.75, 0.66);
  consoleBezel.rotation.y = -0.24;
  consoleBezel.rotation.x = -0.14;
  cabin.add(consoleBezel);

  const consoleScreen = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.28, 0.185)),
    trackMat(new THREE.MeshBasicMaterial({ map: consoleTex, toneMapped: false }))
  );
  consoleScreen.position.set(-0.555, 0.75, 0.64);
  consoleScreen.rotation.y = Math.PI - 0.24;
  consoleScreen.rotation.x = 0.14;
  cabin.add(consoleScreen);

  // =========================================================================
  // 4. WORKING 3D RACING STEERING WHEEL + PADDLE SHIFTERS + F1 SHIFT LEDS
  // =========================================================================
  const column = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.046, 0.056, 0.24, 16)), darkMetalMat);
  column.rotation.x = Math.PI / 2 - 0.16;
  column.position.set(0, 0.735, 0.585);
  cabin.add(column);

  // Steering wheel positioned so its upper window frames the OLED gauge cluster cleanly
  // while the full rim, center emblem, dials, buttons & paddles stay completely visible!
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(0, 0.768, 0.44);
  wheelPivot.rotation.x = -0.20;
  cabin.add(wheelPivot);

  const steeringWheel = new THREE.Group();
  wheelPivot.add(steeringWheel);

  const wheelRadius = 0.172;
  const rimTube = 0.019;

  // Main stitched Alcantara racing steering wheel rim
  const rimGeo = trackGeo(new THREE.TorusGeometry(wheelRadius, rimTube, 18, 52));
  const rimMesh = new THREE.Mesh(rimGeo, alcantaraMat);
  steeringWheel.add(rimMesh);

  // Sculpted 9-and-3 ergonomic thumb bolsters
  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.022, 0.048, 6, 12)), leatherMat);
    grip.position.set(side * (wheelRadius - 0.002), 0.018, 0);
    grip.rotation.z = side * 0.12;
    steeringWheel.add(grip);
  }

  // Iconic 12-o'clock top-center racing stripe marker
  const topStripeGeo = trackGeo(new THREE.TorusGeometry(wheelRadius, rimTube + 0.0024, 12, 14, 0.17));
  const topStripe = new THREE.Mesh(topStripeGeo, stitchMat);
  topStripe.rotation.z = Math.PI / 2 - 0.085;
  steeringWheel.add(topStripe);

  // Flat-bottom carbon-fiber lower rim grip plate
  const flatBottom = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.135, 0.028, 0.032)), carbonMat);
  flatBottom.position.set(0, -wheelRadius + 0.011, 0);
  steeringWheel.add(flatBottom);

  // Sculpted center carbon & brushed-metal airbag hub
  const hubBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.062, 0.068, 0.052, 24)), leatherMat);
  hubBody.rotation.x = Math.PI / 2;
  hubBody.position.z = -0.004;
  steeringWheel.add(hubBody);

  const hubTrimRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.060, 0.0048, 8, 24)), brushedAluMat);
  hubTrimRing.position.z = -0.030;
  steeringWheel.add(hubTrimRing);

  // Authentic Model Crest Badge on center hub
  const crestColor =
    modelId === 'gt3rs'
      ? 0xd4a428
      : modelId === 'chiron'
        ? 0xdc2626
        : modelId === 'f40'
          ? 0xfacc15
          : 0xca8a04;
  const crest = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.026, 0.034, 0.008)),
    trackMat(new THREE.MeshStandardMaterial({ color: crestColor, metalness: 0.72, roughness: 0.22 }))
  );
  crest.position.set(0, 0.004, -0.032);
  steeringWheel.add(crest);

  // 3 sculpted brushed-aluminum & carbon wheel spokes
  for (const side of [-1, 1]) {
    const spoke = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.118, 0.030, 0.02)), carbonMat);
    spoke.position.set(side * 0.104, -0.006, -0.004);
    steeringWheel.add(spoke);

    const spokeTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.105, 0.008, 0.022)), brushedAluMat);
    spokeTrim.position.set(side * 0.102, -0.016, -0.006);
    steeringWheel.add(spokeTrim);
  }

  for (const sx of [-0.024, 0.024]) {
    const botSpoke = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.020, 0.114, 0.018)), brushedAluMat);
    botSpoke.position.set(sx, -0.104, -0.004);
    botSpoke.rotation.z = sx > 0 ? -0.08 : 0.08;
    steeringWheel.add(botSpoke);
  }

  // Rotary Drive-Mode Dials (GT3 RS / Ferrari Manettino style)
  const redDial = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.016, 16)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32, metalness: 0.45 }))
  );
  redDial.rotation.x = Math.PI / 2;
  redDial.position.set(-0.068, -0.052, -0.020);
  steeringWheel.add(redDial);

  const yellowDial = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.016, 16)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.32, metalness: 0.45 }))
  );
  yellowDial.rotation.x = Math.PI / 2;
  yellowDial.position.set(0.068, -0.052, -0.020);
  steeringWheel.add(yellowDial);

  // Glowing NITRO & DRS thumb buttons on the wheel spokes
  const nitroBtnMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.8,
      roughness: 0.25,
    })
  );
  const nitroBtn = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 14)), nitroBtnMat);
  nitroBtn.rotation.x = Math.PI / 2;
  nitroBtn.position.set(-0.11, 0.005, -0.017);
  steeringWheel.add(nitroBtn);

  const drsBtn = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 14)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.65,
        roughness: 0.25,
      })
    )
  );
  drsBtn.rotation.x = Math.PI / 2;
  drsBtn.position.set(0.11, 0.005, -0.017);
  steeringWheel.add(drsBtn);

  // Brushed Aluminum Shift Paddles behind wheel spokes (kick back on gear shifts!)
  const paddleGeo = trackGeo(new THREE.BoxGeometry(0.042, 0.088, 0.009));
  const leftPaddle = new THREE.Mesh(paddleGeo, brushedAluMat);
  leftPaddle.position.set(0.118, 0.014, 0.032);
  leftPaddle.rotation.z = -0.14;
  steeringWheel.add(leftPaddle);

  const rightPaddle = new THREE.Mesh(paddleGeo, brushedAluMat);
  rightPaddle.position.set(-0.118, 0.014, 0.032);
  rightPaddle.rotation.z = 0.14;
  steeringWheel.add(rightPaddle);

  // Top-Rim Integrated 8-LED F1 Shift Light Bar
  const shiftLedMats: THREE.MeshStandardMaterial[] = [];
  const ledPod = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.126, 0.014, 0.016)), darkMetalMat);
  ledPod.position.set(0, wheelRadius - 0.02, -0.015);
  steeringWheel.add(ledPod);

  for (let i = 0; i < 8; i++) {
    const ledMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e2530,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.2,
      })
    );
    shiftLedMats.push(ledMat);
    const led = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.010, 0.007, 0.007)), ledMat);
    led.position.set(-0.049 + i * 0.014, wheelRadius - 0.02, -0.022);
    steeringWheel.add(led);
  }

  // =========================================================================
  // 5. SLEEK A-PILLARS, HIGH WINDSHIELD HEADER, COMPACT REARVIEW & WING MIRRORS
  // =========================================================================
  const leftPillar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.082, 0.86, 0.095)), alcantaraMat);
  leftPillar.position.set(0.80, 1.21, 0.72);
  leftPillar.rotation.set(-0.60, 0, -0.20);
  cabin.add(leftPillar);

  const rightPillar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.082, 0.86, 0.095)), alcantaraMat);
  rightPillar.position.set(-1.26, 1.21, 0.72);
  rightPillar.rotation.set(-0.60, 0, 0.20);
  cabin.add(rightPillar);

  // Sleek high roof header rail (maximizes sky & road panorama on both desktop and portrait mobile!)
  const roofHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.08, 0.09, 0.24)), alcantaraMat);
  roofHeader.position.set(-0.23, 1.59, 0.44);
  roofHeader.rotation.x = 0.12;
  cabin.add(roofHeader);

  // Compact aerodynamic digital rearview mirror with live Rear Rival Proximity Radar!
  const mirrorCanvas = document.createElement('canvas');
  mirrorCanvas.width = 256;
  mirrorCanvas.height = 64;
  const mirrorCtx = mirrorCanvas.getContext('2d')!;
  const mirrorTex = new THREE.CanvasTexture(mirrorCanvas);
  mirrorTex.colorSpace = THREE.SRGBColorSpace;
  disposables.push(mirrorTex);

  const mirrorStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.075, 8)), darkMetalMat);
  mirrorStem.position.set(-0.24, 1.53, 0.56);
  cabin.add(mirrorStem);

  const rearMirrorHousing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.195, 0.054, 0.026)), darkMetalMat);
  rearMirrorHousing.position.set(-0.24, 1.485, 0.56);
  cabin.add(rearMirrorHousing);

  const rearMirrorGlass = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.178, 0.042)),
    trackMat(new THREE.MeshBasicMaterial({ map: mirrorTex, toneMapped: false }))
  );
  rearMirrorGlass.position.set(-0.24, 1.485, 0.545);
  rearMirrorGlass.rotation.y = Math.PI;
  cabin.add(rearMirrorGlass);

  // Left door card & carbon armrest
  const leftDoorTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.34, 1.15)), leatherMat);
  leftDoorTop.position.set(0.80, 0.62, 0.32);
  cabin.add(leftDoorTop);

  const leftDoorTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.06, 0.85)), carbonMat);
  leftDoorTrim.position.set(0.72, 0.72, 0.36);
  cabin.add(leftDoorTrim);

  // Sculpted Paint-Matched Left & Right Aero Wing Mirrors
  for (const [mx, armSign] of [
    [0.98, 1],
    [-1.44, -1],
  ] as const) {
    const mirrorArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.042, 0.075)), darkMetalMat);
    mirrorArm.position.set(mx - armSign * 0.11, 0.88, 0.84);
    cabin.add(mirrorArm);

    const mirrorShell = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.20, 0.11, 0.13)), paintMat);
    mirrorShell.position.set(mx, 0.92, 0.86);
    cabin.add(mirrorShell);

    const sideGlass = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.17, 0.088)), mirrorGlassMat);
    sideGlass.position.set(mx, 0.92, 0.793);
    sideGlass.rotation.y = Math.PI + armSign * 0.12;
    cabin.add(sideGlass);
  }

  // Subtle translucent tinted windshield glass glint
  const windshield = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(2.04, 0.82)),
    trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xcbe8ff,
        transparent: true,
        opacity: 0.05,
        roughness: 0.05,
        metalness: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    )
  );
  windshield.position.set(-0.23, 1.19, 0.75);
  windshield.rotation.x = -0.60;
  cabin.add(windshield);

  // --- Live OLED Cluster Rendering State ---
  let lastGear = 1;
  let leftPaddleKick = 0;
  let rightPaddleKick = 0;
  let canvasRefreshAccum = 0;
  const spec = getCarSpec(modelId);
  const accentCss = '#' + accentColor.toString(16).padStart(6, '0');

  const drawInstrumentCluster = (t: CockpitTelemetry) => {
    const ctx = dashCtx;
    const w = dashCanvas.width;
    const h = dashCanvas.height;

    ctx.fillStyle = '#060b14';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = t.isBoosting ? '#38bdf8' : 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Top Sweeping RPM Tachometer Bar (ultra crisp above steering rim!)
    const totalBars = 28;
    const activeBars = Math.round(Math.max(0, Math.min(1, t.rpm)) * totalBars);
    const barStartX = 24;
    const barW = (w - 48) / totalBars;

    for (let i = 0; i < totalBars; i++) {
      const frac = i / (totalBars - 1);
      const bx = barStartX + i * barW;
      const arcLift = Math.sin(frac * Math.PI) * 14;
      const barH = 26 + frac * 14;
      const by = 56 - arcLift - barH * 0.35;

      if (i < activeBars) {
        if (t.isBoosting) {
          ctx.fillStyle = frac > 0.8 ? '#e0f2fe' : '#38bdf8';
        } else if (frac > 0.84) {
          ctx.fillStyle = '#ef4444';
        } else if (frac > 0.65) {
          ctx.fillStyle = '#f59e0b';
        } else {
          ctx.fillStyle = '#f8fafc';
        }
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
      }
      ctx.fillRect(bx + 1.5, by, barW - 3.5, barH);
    }

    // Center Gear Readout (raised slightly so it gleams clearly through the steering wheel window!)
    ctx.fillStyle = t.isBoosting ? '#0c2a42' : '#0f172a';
    ctx.fillRect(w / 2 - 44, 78, 88, 108);
    ctx.strokeStyle = t.isBoosting ? '#38bdf8' : t.isDrifting ? '#f59e0b' : accentCss;
    ctx.lineWidth = 3;
    ctx.strokeRect(w / 2 - 44, 78, 88, 108);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GEAR', w / 2, 99);

    ctx.fillStyle = t.isBoosting ? '#38bdf8' : t.isDrifting ? '#fbbf24' : '#ffffff';
    ctx.font = 'italic 900 76px sans-serif';
    ctx.fillText(String(t.gear), w / 2, 172);

    // Left Side: Bold Digital Speedometer (KM/H)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('SPEED', 26, 99);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'italic 900 66px sans-serif';
    ctx.fillText(String(Math.round(t.speedKmh)), 24, 166);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('KM/H', 28, 190);

    // Right Side: Nitro Pressure & Live Race Standing
    ctx.textAlign = 'right';
    ctx.fillStyle = t.isBoosting ? '#38bdf8' : '#f59e0b';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`NITRO ${Math.round(t.nitro)}%`, w - 26, 99);

    const nW = 148;
    const nX = w - 26 - nW;
    ctx.fillStyle = '#111b2b';
    ctx.fillRect(nX, 110, nW, 22);
    ctx.fillStyle = t.isBoosting ? '#38bdf8' : '#f59e0b';
    ctx.fillRect(nX, 110, (nW * Math.max(0, Math.min(100, t.nitro))) / 100, 22);
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 2;
    ctx.strokeRect(nX, 110, nW, 22);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`P${t.position} · L${t.lap}/${t.totalLaps}`, w - 26, 168);

    // Bottom Status Strip
    ctx.fillStyle = '#0c1322';
    ctx.fillRect(16, 212, w - 32, 30);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(spec.shortName.toUpperCase(), 26, 232);

    ctx.textAlign = 'right';
    if (t.braking) {
      ctx.fillStyle = '#ef4444';
      ctx.fillText('ABS BRAKE', w - 26, 232);
    } else if (t.isBoosting) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('NITRO BOOST ACTIVE', w - 26, 232);
    } else if (t.isDrifting) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('DRIFT CHARGE', w - 26, 232);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.fillText('RACE MODE · DRS READY', w - 26, 232);
    }

    dashTex.needsUpdate = true;

    // Secondary Center Console Telemetry Screen (G-Force Radar + Mode)
    const c = consoleCtx;
    c.fillStyle = '#070c16';
    c.fillRect(0, 0, 256, 192);
    c.strokeStyle = 'rgba(148,163,184,0.28)';
    c.lineWidth = 3;
    c.strokeRect(4, 4, 248, 184);

    c.fillStyle = accentCss;
    c.font = 'bold 16px sans-serif';
    c.textAlign = 'center';
    c.fillText('APEX TELEMETRY', 128, 28);

    const gx = 128;
    const gy = 104;
    c.strokeStyle = 'rgba(148,163,184,0.34)';
    c.lineWidth = 1.5;
    for (const r of [22, 44, 62]) {
      c.beginPath();
      c.arc(gx, gy, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(gx - 64, gy);
    c.lineTo(gx + 64, gy);
    c.moveTo(gx, gy - 64);
    c.lineTo(gx, gy + 64);
    c.stroke();

    const dotX = gx + Math.max(-54, Math.min(54, t.lateralG * 44));
    const dotY = gy + (t.braking ? -34 : t.isBoosting ? 36 : 8);
    c.fillStyle = t.isBoosting ? '#38bdf8' : t.braking ? '#ef4444' : '#f59e0b';
    c.beginPath();
    c.arc(dotX, dotY, 8, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#94a3b8';
    c.font = 'bold 13px sans-serif';
    c.fillText(t.isBoosting ? 'TURBO MAX' : t.isDrifting ? 'SLIP ANGLE' : 'TRACK GRIP', 128, 180);

    consoleTex.needsUpdate = true;

    // Live Digital Rearview Mirror with Rear Horizon & Rival Proximity Radar
    const m = mirrorCtx;
    const skyGrad = m.createLinearGradient(0, 0, 0, 32);
    if (t.isNight) {
      skyGrad.addColorStop(0, '#070b18');
      skyGrad.addColorStop(1, '#1c1836');
    } else {
      skyGrad.addColorStop(0, '#1e4a82');
      skyGrad.addColorStop(1, '#6fa5d6');
    }
    m.fillStyle = skyGrad;
    m.fillRect(0, 0, 256, 30);

    // Asphalt road perspective behind car
    m.fillStyle = t.isNight ? '#111622' : '#252e3a';
    m.fillRect(0, 30, 256, 34);
    m.strokeStyle = 'rgba(255,255,255,0.22)';
    m.lineWidth = 2;
    m.beginPath();
    m.moveTo(108, 30);
    m.lineTo(36, 64);
    m.moveTo(148, 30);
    m.lineTo(220, 64);
    m.stroke();

    // Glowing Rival Proximity Zones (Left / Center / Right)
    const drawThreat = (x: number, w: number, intensity: number) => {
      if (intensity <= 0.05) return;
      const hot = intensity > 0.6;
      m.fillStyle = hot
        ? `rgba(239, 68, 68, ${0.35 + intensity * 0.55})`
        : `rgba(245, 158, 11, ${0.28 + intensity * 0.5})`;
      m.fillRect(x, 6, w, 52);
      // Pair of approaching rival LED headlights in the mirror!
      const lampY = 38 + intensity * 12;
      const lampSpread = 10 + intensity * 14;
      const cx = x + w * 0.5;
      m.fillStyle = '#ffffff';
      m.beginPath();
      m.arc(cx - lampSpread * 0.5, lampY, 2.5 + intensity * 2.5, 0, Math.PI * 2);
      m.arc(cx + lampSpread * 0.5, lampY, 2.5 + intensity * 2.5, 0, Math.PI * 2);
      m.fill();
    };
    drawThreat(6, 74, t.rearThreat.left);
    drawThreat(91, 74, t.rearThreat.center);
    drawThreat(176, 74, t.rearThreat.right);

    const anyThreat =
      t.rearThreat.left > 0.05 || t.rearThreat.center > 0.05 || t.rearThreat.right > 0.05;
    m.strokeStyle = anyThreat ? '#ef4444' : 'rgba(148,163,184,0.35)';
    m.lineWidth = 3;
    m.strokeRect(2, 2, 252, 60);
    m.fillStyle = anyThreat ? '#fca5a5' : 'rgba(226,232,240,0.65)';
    m.font = 'bold 10px sans-serif';
    m.textAlign = 'center';
    m.fillText(anyThreat ? 'RIVAL CLOSING' : 'REAR CAM', 128, 15);
    mirrorTex.needsUpdate = true;

    // Live Sport Chrono Sweep
    drawChrono(t.raceTime);
  };

  drawInstrumentCluster({
    speedKmh: 0,
    gear: 1,
    rpm: 0.2,
    nitro: 70,
    isBoosting: false,
    isDrifting: false,
    braking: false,
    steerAngle: 0,
    position: 1,
    lap: 1,
    totalLaps: 3,
    lateralG: 0,
    raceTime: 0,
    isNight: false,
    rearThreat: { left: 0, center: 0, right: 0 },
  });

  const update = (car: CarState, telemetry: CockpitTelemetry, dt: number) => {
    // 1. Live Working Steering Wheel Rotation (+rotation.z turns top clockwise / RIGHT!)
    const wheelAngle = -car.steerAngle * 3.15;
    const roadJitter =
      car.speed > 15 && car.airY <= 0.05
        ? Math.sin(performance.now() * 0.042) * Math.min(0.012, car.speed * 0.00014)
        : 0;
    steeringWheel.rotation.z = wheelAngle + roadJitter;

    // 2. Animated Paddle Shifter Kick on Upshift / Downshift
    if (telemetry.gear > lastGear) {
      rightPaddleKick = 1.0;
    } else if (telemetry.gear < lastGear) {
      leftPaddleKick = 1.0;
    }
    lastGear = telemetry.gear;
    rightPaddleKick = Math.max(0, rightPaddleKick - dt * 6.5);
    leftPaddleKick = Math.max(0, leftPaddleKick - dt * 6.5);
    rightPaddle.position.z = 0.032 - rightPaddleKick * 0.018;
    leftPaddle.position.z = 0.032 - leftPaddleKick * 0.018;

    // 3. Top-Rim 8-LED F1 Shift Light Bar synced to live RPM
    const blinkOn = Math.floor(performance.now() * 0.018) % 2 === 0;
    const redlineFlash = telemetry.rpm > 0.93;
    const litCount = Math.round(Math.max(0, (telemetry.rpm - 0.35) / 0.62) * 8);
    for (let i = 0; i < 8; i++) {
      const m = shiftLedMats[i];
      const active = redlineFlash ? blinkOn : i < litCount;
      if (active) {
        const hex = telemetry.isBoosting
          ? 0x38bdf8
          : i >= 6
            ? 0xef4444
            : i >= 3
              ? 0xf59e0b
              : 0x22c55e;
        m.emissive.setHex(hex);
        m.emissiveIntensity = 3.2;
      } else {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
    }

    // 4. Glowing Nitro Wheel Button & Ambient Cabin Trim Pulse
    nitroBtnMat.emissiveIntensity = telemetry.isBoosting ? 4.0 : 0.8;
    if (telemetry.isBoosting) {
      ambientTrimMat.color.setHex(0x38bdf8);
      ambientTrimMat.emissive.setHex(0x38bdf8);
      ambientTrimMat.emissiveIntensity = 2.6;
    } else if (telemetry.isDrifting) {
      ambientTrimMat.color.setHex(0xf59e0b);
      ambientTrimMat.emissive.setHex(0xf59e0b);
      ambientTrimMat.emissiveIntensity = 1.8;
    } else {
      ambientTrimMat.color.setHex(accentColor);
      ambientTrimMat.emissive.setHex(accentColor);
      ambientTrimMat.emissiveIntensity = 0.9;
    }

    // 5. Refresh OLED Instrument Cluster & Center Telemetry Screen
    canvasRefreshAccum += dt;
    if (canvasRefreshAccum >= 0.033) {
      canvasRefreshAccum = 0;
      drawInstrumentCluster(telemetry);
    }
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return {
    root,
    cabin,
    steeringWheel,
    leftPaddle,
    rightPaddle,
    nitroBtnMat,
    shiftLedMats,
    ambientTrimMat,
    eyeLocalPos,
    lookLocalPos,
    update,
    dispose,
  };
}
