import * as THREE from 'three';
import { CarLivery, CarModelId } from './types';
import { ProceduralTextureSet } from './textures';

export interface CarVisualRig {
  root: THREE.Group;
  chassis: THREE.Group;
  frontWheelPivots: THREE.Group[];
  wheelMeshes: THREE.Object3D[];
  tailLightMat: THREE.MeshStandardMaterial;
  paintMat: THREE.MeshPhysicalMaterial;
  flames: THREE.Mesh[];
  flameMat: THREE.MeshBasicMaterial;
  activeWing: THREE.Object3D | null;
  activeWingBaseRotX: number;
  activeWingBaseY: number;
  headlightBeamMat: THREE.MeshBasicMaterial;
  headlightBeams: THREE.Mesh[];
  dispose: () => void;
}

let cachedHeadlightBeamTex: THREE.CanvasTexture | null = null;
function getHeadlightBeamTexture(): THREE.CanvasTexture {
  if (cachedHeadlightBeamTex) return cachedHeadlightBeamTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0.0, 'rgba(255, 250, 232, 0.92)');
  grad.addColorStop(0.28, 'rgba(244, 248, 255, 0.45)');
  grad.addColorStop(0.68, 'rgba(218, 236, 255, 0.14)');
  grad.addColorStop(1.0, 'rgba(200, 226, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(46, 256);
  ctx.lineTo(82, 256);
  ctx.lineTo(124, 0);
  ctx.lineTo(4, 0);
  ctx.closePath();
  ctx.fill();

  // Soft lateral radial falloff
  ctx.globalCompositeOperation = 'destination-in';
  const sideGrad = ctx.createLinearGradient(0, 0, 128, 0);
  sideGrad.addColorStop(0.0, 'rgba(255,255,255,0)');
  sideGrad.addColorStop(0.22, 'rgba(255,255,255,0.85)');
  sideGrad.addColorStop(0.5, 'rgba(255,255,255,1)');
  sideGrad.addColorStop(0.78, 'rgba(255,255,255,0.85)');
  sideGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = sideGrad;
  ctx.fillRect(0, 0, 128, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedHeadlightBeamTex = tex;
  return tex;
}

function createExtrudedProfile(
  points: Array<[number, number]>, // [zForward, yUp]
  width: number,
  bevelSize = 0.05,
  bevelThickness = 0.06
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize,
    bevelThickness,
  });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

const _spokeUp = new THREE.Vector3(0, 1, 0);
const _spokeStart = new THREE.Vector3();
const _spokeEnd = new THREE.Vector3();
const _spokeDir = new THREE.Vector3();

function buildWheelAssembly(
  modelId: CarModelId,
  radius: number,
  width: number,
  tireMat: THREE.MeshStandardMaterial,
  barrelMat: THREE.MeshStandardMaterial,
  rimMat: THREE.MeshStandardMaterial,
  lipMat: THREE.MeshStandardMaterial,
  rotorFaceMat: THREE.MeshStandardMaterial,
  caliperMat: THREE.MeshStandardMaterial,
  centerCapMat: THREE.MeshStandardMaterial,
  isRightSide: boolean
): { pivot: THREE.Group; spinner: THREE.Group } {
  const pivot = new THREE.Group();
  const spinner = new THREE.Group();
  pivot.add(spinner);

  // Driver right is -X in +Z forward space; outSign points outward from the car body
  const outSign = isRightSide ? -1 : 1;
  const latheRotZ = outSign > 0 ? -Math.PI / 2 : Math.PI / 2;

  // 1. SCULPTED ROUNDED-SHOULDER PERFORMANCE TIRE (LatheGeometry — zero flat hockey-puck edges!)
  const hw = width * 0.5;
  const tirePts = [
    new THREE.Vector2(radius * 0.70, -hw * 0.86),
    new THREE.Vector2(radius * 0.74, -hw * 0.94),
    new THREE.Vector2(radius * 0.85, -hw * 1.0),
    new THREE.Vector2(radius * 0.955, -hw * 0.96),
    new THREE.Vector2(radius * 0.992, -hw * 0.82),
    new THREE.Vector2(radius * 1.0, -hw * 0.44),
    new THREE.Vector2(radius * 1.006, 0),
    new THREE.Vector2(radius * 1.0, hw * 0.44),
    new THREE.Vector2(radius * 0.992, hw * 0.82),
    new THREE.Vector2(radius * 0.955, hw * 0.96),
    new THREE.Vector2(radius * 0.85, hw * 1.0),
    new THREE.Vector2(radius * 0.745, hw * 0.94),
    new THREE.Vector2(radius * 0.715, hw * 0.86),
    new THREE.Vector2(radius * 0.695, hw * 0.74),
  ];
  const tireGeo = new THREE.LatheGeometry(tirePts, 28);
  tireGeo.rotateZ(latheRotZ);
  tireGeo.computeVertexNormals();
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  spinner.add(tire);

  // 2. DEEP CONCAVE 3D FORGED ALLOY BARREL + STEPPED LIP (LatheGeometry)
  const barrelPts = [
    new THREE.Vector2(radius * 0.65, -hw * 0.84),
    new THREE.Vector2(radius * 0.69, -hw * 0.84),
    new THREE.Vector2(radius * 0.695, hw * 0.72),
    new THREE.Vector2(radius * 0.732, hw * 0.86),
    new THREE.Vector2(radius * 0.732, hw * 0.93),
    new THREE.Vector2(radius * 0.688, hw * 0.93),
    new THREE.Vector2(radius * 0.655, hw * 0.72),
    new THREE.Vector2(radius * 0.64, -hw * 0.78),
  ];
  const barrelGeo = new THREE.LatheGeometry(barrelPts, 28);
  barrelGeo.rotateZ(latheRotZ);
  barrelGeo.computeVertexNormals();
  spinner.add(new THREE.Mesh(barrelGeo, barrelMat));

  // Crisp machined outer alloy lip highlight ring
  const lipGeo = new THREE.TorusGeometry(radius * 0.714, radius * 0.028, 10, 28);
  lipGeo.rotateY(Math.PI / 2);
  const lip = new THREE.Mesh(lipGeo, lipMat);
  lip.position.x = outSign * (hw * 0.90);
  spinner.add(lip);

  // 3. CROSS-DRILLED CARBON-CERAMIC BRAKE ROTOR (visible gleaming through the concave spokes!)
  const rotorRadius = radius * 0.57;
  const rotorGeo = new THREE.CylinderGeometry(rotorRadius, rotorRadius, 0.036, 24);
  rotorGeo.rotateZ(Math.PI / 2);
  const rotor = new THREE.Mesh(rotorGeo, [barrelMat, rotorFaceMat, rotorFaceMat]);
  rotor.position.x = outSign * (hw * 0.14);
  spinner.add(rotor);

  // Inner dark rotor hat / hub drum
  const hatGeo = new THREE.CylinderGeometry(radius * 0.24, radius * 0.26, hw * 0.65, 16);
  hatGeo.rotateZ(Math.PI / 2);
  const hat = new THREE.Mesh(hatGeo, barrelMat);
  hat.position.x = outSign * (hw * 0.12);
  spinner.add(hat);

  // 4. MODEL-AUTHENTIC 3D CONCAVE FORGED SPOKES (angling inward from lip to recessed hub!)
  const xHub = outSign * (hw * 0.28);
  const xLip = outSign * (hw * 0.84);
  const addConcaveSpoke = (
    angleStart: number,
    angleEnd: number,
    rStart: number,
    rEnd: number,
    spokeW: number,
    spokeD: number,
    mat: THREE.Material
  ) => {
    _spokeStart.set(xHub, Math.cos(angleStart) * rStart, Math.sin(angleStart) * rStart);
    _spokeEnd.set(xLip, Math.cos(angleEnd) * rEnd, Math.sin(angleEnd) * rEnd);
    _spokeDir.subVectors(_spokeEnd, _spokeStart);
    const len = _spokeDir.length();
    const geo = new THREE.BoxGeometry(spokeD, len, spokeW);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.addVectors(_spokeStart, _spokeEnd).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(_spokeUp, _spokeDir.normalize());
    spinner.add(mesh);
  };

  if (modelId === 'gt3rs') {
    // Porsche 911 GT3 RS Weissach 5x Split-Y Forged Magnesium Center-Lock Wheels
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      addConcaveSpoke(a - 0.13, a - 0.30, radius * 0.18, radius * 0.70, 0.028, 0.032, rimMat);
      addConcaveSpoke(a + 0.13, a + 0.30, radius * 0.18, radius * 0.70, 0.028, 0.032, rimMat);
    }
  } else if (modelId === 'chiron') {
    // Bugatti Chiron 10-Spoke Swept Diamond-Cut Turbine Alloy Wheels
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      addConcaveSpoke(a, a + 0.24, radius * 0.17, radius * 0.70, 0.030, 0.034, i % 2 === 0 ? lipMat : rimMat);
    }
  } else if (modelId === 'f40') {
    // Ferrari F40 Classic Deep-Dish 5-Star Speedline Wheels + Perimeter Split-Rim Bolts
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      addConcaveSpoke(a, a, radius * 0.17, radius * 0.68, 0.072, 0.036, rimMat);
    }
    const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.018, 6);
    boltGeo.rotateZ(Math.PI / 2);
    for (let b = 0; b < 15; b++) {
      const ba = (b / 15) * Math.PI * 2;
      const bolt = new THREE.Mesh(boltGeo, lipMat);
      bolt.position.set(outSign * (hw * 0.85), Math.cos(ba) * radius * 0.665, Math.sin(ba) * radius * 0.665);
      spinner.add(bolt);
    }
  } else {
    // Lamborghini Aventador SVJ 7-Y Forged Leirion Center-Lock Wheels
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      addConcaveSpoke(a, a - 0.20, radius * 0.18, radius * 0.70, 0.026, 0.032, rimMat);
      addConcaveSpoke(a, a + 0.20, radius * 0.18, radius * 0.70, 0.026, 0.032, rimMat);
    }
  }

  // 5. SCULPTED CENTER HUB RING + ANODIZED CENTER-LOCK NUT / CREST CAP
  const hubRingGeo = new THREE.CylinderGeometry(radius * 0.21, radius * 0.23, 0.06, 16);
  hubRingGeo.rotateZ(Math.PI / 2);
  const hubRing = new THREE.Mesh(hubRingGeo, rimMat);
  hubRing.position.x = outSign * (hw * 0.30);
  spinner.add(hubRing);

  const lockNutGeo = new THREE.CylinderGeometry(radius * 0.115, radius * 0.13, 0.085, modelId === 'gt3rs' || modelId === 'svj' ? 6 : 16);
  lockNutGeo.rotateZ(Math.PI / 2);
  const lockNut = new THREE.Mesh(lockNutGeo, centerCapMat);
  lockNut.position.x = outSign * (hw * 0.36);
  spinner.add(lockNut);

  // 6. STATIONARY MULTI-PISTON BREMBO BRAKE CALIPER (hugs upper-rear arc of rotor!)
  const caliperGroup = new THREE.Group();
  const caliperMain = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, radius * 0.36, radius * 0.20),
    caliperMat
  );
  caliperMain.position.set(outSign * (hw * 0.22), radius * 0.22, -radius * 0.42);
  caliperMain.rotation.x = 0.48;
  caliperGroup.add(caliperMain);

  const caliperBridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.092, radius * 0.14, radius * 0.12),
    lipMat
  );
  caliperBridge.position.set(outSign * (hw * 0.23), radius * 0.23, -radius * 0.43);
  caliperBridge.rotation.x = 0.48;
  caliperGroup.add(caliperBridge);
  pivot.add(caliperGroup);

  return { pivot, spinner };
}

function addWheelArchCutouts(
  chassis: THREE.Group,
  frontZ: number,
  rearZ: number,
  halfW: number,
  rF: number,
  rR: number,
  darkMat: THREE.MeshStandardMaterial
) {
  for (const side of [-1, 1]) {
    const fWell = new THREE.Mesh(new THREE.CylinderGeometry(rF + 0.055, rF + 0.055, 0.24, 20), darkMat);
    fWell.rotation.z = Math.PI / 2;
    fWell.position.set(side * (halfW - 0.15), rF + 0.015, frontZ);
    chassis.add(fWell);

    const rWell = new THREE.Mesh(new THREE.CylinderGeometry(rR + 0.055, rR + 0.055, 0.28, 20), darkMat);
    rWell.rotation.z = Math.PI / 2;
    rWell.position.set(side * (halfW - 0.15), rR + 0.015, rearZ);
    chassis.add(rWell);
  }
}

export function createCarModel(
  modelId: CarModelId,
  livery: CarLivery,
  textures: ProceduralTextureSet
): CarVisualRig {
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  root.add(chassis);

  // Calibrated PBR Materials with crisp roughness & metalness contrast
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: livery.bodyHex,
    metalness: 0.44,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });

  const secondaryPaintMat = new THREE.MeshPhysicalMaterial({
    color: livery.secondaryHex,
    metalness: 0.38,
    roughness: 0.22,
    clearcoat: 0.92,
    clearcoatRoughness: 0.10,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.carbonMap,
    roughness: 0.58,
    metalness: 0.32,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1422,
    metalness: 0.22,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xecf2fa,
    metalness: 0.95,
    roughness: 0.12,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: livery.stripeHex,
    metalness: 0.22,
    roughness: 0.32,
  });

  const darkGrilleMat = new THREE.MeshStandardMaterial({
    color: 0x0d1016,
    roughness: 0.86,
    metalness: 0.14,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.tireTreadMap,
    roughness: 0.88,
    metalness: 0.05,
  });

  const barrelMat = new THREE.MeshStandardMaterial({
    color: modelId === 'f40' ? 0x6b7280 : 0x1d232e,
    metalness: 0.82,
    roughness: 0.34,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color:
      modelId === 'gt3rs'
        ? 0xa4acb8
        : modelId === 'chiron'
          ? 0xd6dde8
          : modelId === 'f40'
            ? 0xd8dce4
            : 0x8e8678, // SVJ satin forged bronze-titanium
    metalness: 0.92,
    roughness: 0.22,
  });

  const lipMat = new THREE.MeshStandardMaterial({
    color: 0xeaf0f8,
    metalness: 0.96,
    roughness: 0.12,
  });

  const rotorFaceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.brakeRotorMap,
    metalness: 0.78,
    roughness: 0.36,
  });

  const caliperMat = new THREE.MeshStandardMaterial({
    color: livery.caliperHex,
    roughness: 0.28,
    metalness: 0.35,
  });

  const centerCapMat = new THREE.MeshStandardMaterial({
    color:
      modelId === 'f40'
        ? 0xfacc15
        : modelId === 'chiron'
          ? 0xdc2626
          : livery.caliperHex,
    metalness: 0.65,
    roughness: 0.25,
  });

  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff8e6,
    emissiveIntensity: 2.5,
    roughness: 0.08,
  });

  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1e24,
    emissive: 0xff1016,
    emissiveIntensity: 1.8,
    roughness: 0.12,
  });

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const flames: THREE.Mesh[] = [];
  const addExhaust = (x: number, y: number, z: number, radius = 0.068) => {
    const pipeGeo = new THREE.CylinderGeometry(radius, radius * 1.06, 0.28, 12);
    pipeGeo.rotateX(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, chromeMat);
    pipe.position.set(x, y, z);
    chassis.add(pipe);

    const flameGeo = new THREE.ConeGeometry(radius * 1.18, 0.85, 10);
    flameGeo.rotateX(-Math.PI / 2);
    flameGeo.translate(0, 0, -0.44);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(x, y, z - 0.1);
    flame.visible = false;
    chassis.add(flame);
    flames.push(flame);
  };

  let wheelbaseFrontZ = 1.38;
  let wheelbaseRearZ = -1.34;
  let trackWidth = 0.98;
  let wheelRadiusF = 0.35;
  let wheelRadiusR = 0.38;
  let spokeCount = 5;
  let activeWing: THREE.Object3D | null = null;
  let activeWingBaseRotX = 0.12;
  let activeWingBaseY = 1.2;

  if (modelId === 'gt3rs') {
    // =========================================================================
    // PORSCHE 911 GT3 RS (992 Generation) — True 2-Tier Sculpted Architecture!
    // Lower beltline hull + separate narrower curved 911 teardrop glass cabin
    // + raised frog-eye front fenders + Weissach carbon hood/roof + giant DRS wing
    // =========================================================================
    wheelbaseFrontZ = 1.36;
    wheelbaseRearZ = -1.32;
    trackWidth = 0.99;
    wheelRadiusF = 0.35;
    wheelRadiusR = 0.38;
    spokeCount = 6;

    // 1. LOWER BELTLINE HULL (stops cleanly at waist/hood line y=0.78!)
    const lowerHullGeo = createExtrudedProfile(
      [
        [-2.20, 0.26],
        [-2.16, 0.82], // Rear decklid & ducktail base
        [-1.30, 0.84], // Rear haunch shoulder
        [0.86, 0.78], // Beltline & windshield cowl
        [1.76, 0.62], // Sloping front bonnet
        [2.24, 0.38], // Low 911 nose
        [2.26, 0.24],
        [2.14, 0.19],
        [-2.08, 0.19],
      ],
      1.82,
      0.07,
      0.08
    );
    const lowerHull = new THREE.Mesh(lowerHullGeo, paintMat);
    lowerHull.castShadow = true;
    lowerHull.receiveShadow = true;
    chassis.add(lowerHull);

    // 2. SEPARATE SCULPTED 911 TEARDROP GLASS GREENHOUSE (sits proudly ON TOP of beltline!)
    const cabinGlassGeo = createExtrudedProfile(
      [
        [-1.62, 0.80], // Iconic sloping 911 fastback rear glass
        [-0.78, 1.18], // Curved teardrop rear pillar
        [-0.22, 1.28], // Roof peak
        [0.36, 1.24], // Windshield header
        [1.04, 0.78], // Steep raked 911 windshield base
      ],
      1.36,
      0.06,
      0.08
    );
    const cabinGlass = new THREE.Mesh(cabinGlassGeo, glassMat);
    cabinGlass.castShadow = true;
    chassis.add(cabinGlass);

    // 3. WEISSACH CARBON ROOF CAP + PAINTED SIDE ARCH PILLARS
    const roofCapGeo = createExtrudedProfile(
      [
        [-1.12, 1.13],
        [-0.26, 1.32],
        [0.34, 1.28],
        [0.38, 1.22],
        [-0.26, 1.25],
        [-1.14, 1.07],
      ],
      1.20,
      0.025,
      0.03
    );
    const roofCap = new THREE.Mesh(roofCapGeo, carbonMat);
    chassis.add(roofCap);

    // Sculpted widebody rear fenders & raised front 911 fender humps
    const rearHips = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.42, 1.54), paintMat);
    rearHips.position.set(0, 0.56, -1.16);
    rearHips.castShadow = true;
    chassis.add(rearHips);

    for (const side of [-1, 1]) {
      // Iconic raised 911 front fender crest
      const frontFender = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 1.38), paintMat);
      frontFender.position.set(side * 0.78, 0.63, 1.28);
      frontFender.rotation.x = 0.16;
      frontFender.castShadow = true;
      chassis.add(frontFender);

      // Iconic GT3 RS front fender top carbon louvers
      const louver = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.42), carbonMat);
      louver.position.set(side * 0.78, 0.80, 1.32);
      louver.rotation.x = 0.18;
      chassis.add(louver);

      // SIGNATURE 911 OVAL PDLS HEADLIGHTS (mounted clearly proud on front fender slope!)
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.06, 18), darkGrilleMat);
      bezel.position.set(side * 0.72, 0.66, 1.90);
      bezel.rotation.set(Math.PI / 2 - 0.56, side * 0.12, 0);
      bezel.scale.set(0.86, 1.0, 1.35);
      chassis.add(bezel);

      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.155, 0.075, 18), headLightMat);
      lens.position.set(side * 0.72, 0.67, 1.915);
      lens.rotation.set(Math.PI / 2 - 0.56, side * 0.12, 0);
      lens.scale.set(0.84, 1.0, 1.32);
      chassis.add(lens);

      // Side door intake + GT3 RS red/contrast racing side graphic
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.54), darkGrilleMat);
      intake.position.set(side * 1.02, 0.48, -0.56);
      chassis.add(intake);

      const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.085, 1.65), accentMat);
      sideStripe.position.set(side * 0.99, 0.34, 0.02);
      chassis.add(sideStripe);

      // Front aero canards & side mirrors
      const canard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.32), carbonMat);
      canard.position.set(side * 0.97, 0.34, 1.94);
      canard.rotation.z = side * 0.24;
      chassis.add(canard);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.15), paintMat);
      mirror.position.set(side * 0.96, 0.92, 0.56);
      chassis.add(mirror);
    }

    // 4. WEISSACH CARBON FRONT HOOD + TWIN HOOD NACA NOSTRILS + FRONT RADIATOR GRILLE
    const carbonHood = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.045, 1.04), carbonMat);
    carbonHood.position.set(0, 0.72, 1.44);
    carbonHood.rotation.x = 0.20;
    chassis.add(carbonHood);

    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.38), darkGrilleMat);
      nostril.position.set(side * 0.27, 0.76, 1.40);
      nostril.rotation.x = 0.20;
      chassis.add(nostril);
    }

    const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.20, 0.14), darkGrilleMat);
    frontGrille.position.set(0, 0.32, 2.24);
    chassis.add(frontGrille);

    const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.06, 0.56), carbonMat);
    frontSplitter.position.set(0, 0.19, 2.08);
    chassis.add(frontSplitter);

    const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.07, 2.24), carbonMat);
    sideSkirt.position.set(0, 0.19, 0.0);
    chassis.add(sideSkirt);

    // 5. ICONIC MASSIVE GT3 RS SWAN-NECK DRS REAR WING (Taller than roofline!)
    const wingMain = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.06, 0.42), carbonMat);
    wingMain.position.set(0, 1.44, -2.04);
    wingMain.rotation.x = 0.08;
    wingMain.castShadow = true;
    chassis.add(wingMain);

    const wingFlap = new THREE.Mesh(new THREE.BoxGeometry(2.00, 0.035, 0.15), accentMat);
    wingFlap.position.set(0, 1.50, -2.16);
    wingFlap.rotation.x = 0.20;
    chassis.add(wingFlap);
    activeWing = wingFlap;
    activeWingBaseRotX = 0.20;
    activeWingBaseY = 1.50;

    for (const side of [-1, 1]) {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.68, 0.18), chromeMat);
      upright.position.set(side * 0.42, 1.15, -1.86);
      upright.rotation.x = -0.22;
      chassis.add(upright);

      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.26), chromeMat);
      hook.position.set(side * 0.42, 1.50, -1.96);
      chassis.add(hook);

      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.38, 0.56), paintMat);
      endplate.position.set(side * 1.05, 1.40, -2.04);
      chassis.add(endplate);
    }

    // 6. FULL-WIDTH PORSCHE 992 CRIMSON LED LIGHT BAR + REAR DIFFUSER + DUAL CENTER EXHAUST
    const rearGrille = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.28, 0.10), darkGrilleMat);
    rearGrille.position.set(0, 0.54, -2.23);
    chassis.add(rearGrille);

    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.90, 0.075, 0.09), tailLightMat);
    lightBar.position.set(0, 0.72, -2.25);
    chassis.add(lightBar);

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.24, 0.30), carbonMat);
    diffuser.position.set(0, 0.26, -2.16);
    chassis.add(diffuser);

    addExhaust(-0.14, 0.27, -2.25, 0.065);
    addExhaust(0.14, 0.27, -2.25, 0.065);
    addWheelArchCutouts(chassis, wheelbaseFrontZ, wheelbaseRearZ, 0.96, wheelRadiusF, wheelRadiusR, darkGrilleMat);
  } else if (modelId === 'chiron') {
    // =========================================================================
    // BUGATTI CHIRON — True 2-Tier Sculpted Hypercar!
    // Lower two-tone hull + narrower sleek bubble glass cockpit + bold sweeping
    // chrome C-Line side arc + Horseshoe front grille + Quad-eye LED headlights
    // =========================================================================
    wheelbaseFrontZ = 1.42;
    wheelbaseRearZ = -1.36;
    trackWidth = 1.02;
    wheelRadiusF = 0.36;
    wheelRadiusR = 0.39;
    spokeCount = 8;

    // 1. LOWER FRONT HALF (French Racing Blue / primary paint up to beltline y=0.78)
    const frontHullGeo = createExtrudedProfile(
      [
        [-0.36, 0.20],
        [-0.36, 0.82],
        [0.95, 0.78], // Hood cowl
        [1.92, 0.62], // Muscular sculpted Chiron hood
        [2.32, 0.42], // Chiron prow nose
        [2.34, 0.25],
        [2.20, 0.19],
      ],
      1.92,
      0.08,
      0.09
    );
    const frontHull = new THREE.Mesh(frontHullGeo, paintMat);
    frontHull.castShadow = true;
    chassis.add(frontHull);

    // 2. LOWER REAR W16 HALF (Deep Carbon / two-tone secondary paint up to haunch y=0.88)
    const rearHullGeo = createExtrudedProfile(
      [
        [-2.28, 0.25],
        [-2.26, 0.84], // Tall sculpted rear deck
        [-1.18, 0.90], // Muscular W16 shoulder
        [-0.28, 0.84],
        [-0.28, 0.19],
        [-2.18, 0.19],
      ],
      1.98,
      0.07,
      0.08
    );
    const rearHull = new THREE.Mesh(rearHullGeo, secondaryPaintMat);
    rearHull.castShadow = true;
    chassis.add(rearHull);

    // 3. SEPARATE SLEEK BUBBLE COCKPIT CANOPY (sits cleanly ON TOP of beltline!)
    const canopyGeo = createExtrudedProfile(
      [
        [-1.18, 0.86],
        [-0.42, 1.22], // Sleek curved Chiron roofline
        [0.36, 1.20], // Windshield header
        [1.12, 0.76], // Raked glass windshield
      ],
      1.36,
      0.06,
      0.08
    );
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    canopy.castShadow = true;
    chassis.add(canopy);

    // Two-tone roof cap + iconic Bugatti Type 57 central chrome spine fin!
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.06, 0.92), paintMat);
    roofCap.position.set(0, 1.25, -0.02);
    chassis.add(roofCap);

    const spineFin = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.12, 2.38), chromeMat);
    spineFin.position.set(0, 1.12, -0.92);
    spineFin.rotation.x = 0.15;
    chassis.add(spineFin);

    // Exposed carbon W16 engine louvres behind cabin
    const engineDeck = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.08, 1.12), carbonMat);
    engineDeck.position.set(0, 0.94, -1.48);
    engineDeck.rotation.x = 0.08;
    chassis.add(engineDeck);

    // 4. ICONIC SWEEPING CHROME BUGATTI C-LINE SIDE ARCH (bold & proud outside body!)
    for (const side of [-1, 1]) {
      const cCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 1.04, 0.27, -0.78),
        new THREE.Vector3(side * 1.07, 0.30, 0.24),
        new THREE.Vector3(side * 1.07, 0.62, 0.56),
        new THREE.Vector3(side * 0.96, 1.04, 0.24),
        new THREE.Vector3(side * 0.82, 1.24, -0.34),
        new THREE.Vector3(side * 0.84, 1.10, -1.04),
      ]);
      const cTube = new THREE.Mesh(new THREE.TubeGeometry(cCurve, 28, 0.056, 10, false), chromeMat);
      chassis.add(cTube);

      // Deep dark intake scoop nestled inside the C-line
      const intakeScoop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.68), darkGrilleMat);
      intakeScoop.position.set(side * 1.00, 0.54, -0.20);
      chassis.add(intakeScoop);

      // SIGNATURE BUGATTI QUAD-EYE LED HEADLIGHTS (sleek recessed pod + 4 crisp glowing squares!)
      const lampRecess = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.12, 0.14), darkGrilleMat);
      lampRecess.position.set(side * 0.68, 0.56, 2.28);
      lampRecess.rotation.y = side * -0.15;
      chassis.add(lampRecess);

      for (let q = 0; q < 4; q++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.068, 0.06), headLightMat);
        led.position.set(side * (0.50 + q * 0.115), 0.56, 2.34 - q * 0.015);
        chassis.add(led);
      }

      // Wide front bumper air intakes
      const frontVent = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.20, 0.12), darkGrilleMat);
      frontVent.position.set(side * 0.66, 0.34, 2.34);
      chassis.add(frontVent);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 0.14), paintMat);
      mirror.position.set(side * 1.04, 0.90, 0.64);
      chassis.add(mirror);
    }

    // 5. ICONIC BUGATTI HORSESHOE FRONT GRILLE (bold metallic arch + red EB crest badge!)
    const horseshoeArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.042, 10, 22, Math.PI * 1.32),
      chromeMat
    );
    horseshoeArch.position.set(0, 0.41, 2.41);
    horseshoeArch.rotation.z = -Math.PI * 0.16;
    chassis.add(horseshoeArch);

    const grilleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.18, 0.08, 16), darkGrilleMat);
    grilleMesh.rotation.x = Math.PI / 2;
    grilleMesh.position.set(0, 0.40, 2.37);
    chassis.add(grilleMesh);

    const ebBadge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.04), tailLightMat);
    ebBadge.position.set(0, 0.61, 2.42);
    chassis.add(ebBadge);

    // 6. ACTIVE REAR AIRBRAKE WING + FULL-WIDTH LASER TAILLIGHT BLADE + QUAD EXHAUST
    const chironWing = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.055, 0.36), paintMat);
    chironWing.position.set(0, 1.08, -2.08);
    chironWing.rotation.x = 0.12;
    chironWing.castShadow = true;
    chassis.add(chironWing);
    activeWing = chironWing;
    activeWingBaseRotX = 0.12;
    activeWingBaseY = 1.08;
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.10), chromeMat);
      strut.position.set(side * 0.56, 0.94, -2.04);
      chassis.add(strut);
    }

    const rearCavern = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.52, 0.12), darkGrilleMat);
    rearCavern.position.set(0, 0.55, -2.29);
    chassis.add(rearCavern);

    const laserTail = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.06, 0.09), tailLightMat);
    laserTail.position.set(0, 0.72, -2.35);
    chassis.add(laserTail);

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.90, 0.22, 0.28), carbonMat);
    diffuser.position.set(0, 0.25, -2.24);
    chassis.add(diffuser);

    addExhaust(-0.44, 0.28, -2.35, 0.064);
    addExhaust(-0.22, 0.28, -2.35, 0.064);
    addExhaust(0.22, 0.28, -2.35, 0.064);
    addExhaust(0.44, 0.28, -2.35, 0.064);
    addWheelArchCutouts(chassis, wheelbaseFrontZ, wheelbaseRearZ, 1.0, wheelRadiusF, wheelRadiusR, darkGrilleMat);
  } else if (modelId === 'f40') {
    // =========================================================================
    // FERRARI F40 — Razor-Low Pininfarina Wedge + Separate Short Cabin +
    // Integrated Full-Width Rear Wing + Twin Red V8 Plenums + Quad Round Lamps
    // =========================================================================
    wheelbaseFrontZ = 1.38;
    wheelbaseRearZ = -1.36;
    trackWidth = 0.98;
    wheelRadiusF = 0.34;
    wheelRadiusR = 0.37;
    spokeCount = 5;

    // 1. Lower razor-low wedge hull (stops cleanly at waist/hood line y=0.78)
    const lowerHullGeo = createExtrudedProfile(
      [
        [-2.24, 0.26],
        [-2.20, 0.80],
        [-0.78, 0.84],
        [0.96, 0.74],
        [2.18, 0.45],
        [2.28, 0.28],
        [2.16, 0.19],
        [-2.14, 0.19],
      ],
      1.88,
      0.05,
      0.06
    );
    const lowerHull = new THREE.Mesh(lowerHullGeo, paintMat);
    lowerHull.castShadow = true;
    chassis.add(lowerHull);

    // 2. Separate short tinted F40 greenhouse cabin
    const cabinGeo = createExtrudedProfile(
      [
        [-0.78, 0.82],
        [-0.42, 1.18],
        [0.32, 1.16],
        [1.02, 0.74],
      ],
      1.34,
      0.04,
      0.05
    );
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.castShadow = true;
    chassis.add(cabin);

    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.06, 0.76), paintMat);
    roofCap.position.set(0, 1.19, -0.05);
    chassis.add(roofCap);

    // Iconic black waist rub-strip wrapping around the F40
    const waistStrip = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.045, 4.46), darkGrilleMat);
    waistStrip.position.set(0, 0.50, 0.0);
    chassis.add(waistStrip);

    // Twin red twin-turbo V8 intake plenums under Lexan louvered rear window
    const plenumMat = new THREE.MeshStandardMaterial({ color: 0xcc1818, roughness: 0.38, metalness: 0.32 });
    for (const side of [-1, 1]) {
      const plenum = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.88), plenumMat);
      plenum.position.set(side * 0.25, 0.84, -1.36);
      chassis.add(plenum);
    }
    for (let i = 0; i < 6; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.028, 0.09), glassMat);
      slat.position.set(0, 0.91 - i * 0.012, -0.96 - i * 0.16);
      slat.rotation.x = 0.16;
      chassis.add(slat);
    }

    // Iconic integrated boxy F40 full-width rear wing
    const wingTop = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.075, 0.42), paintMat);
    wingTop.position.set(0, 1.24, -2.02);
    wingTop.castShadow = true;
    chassis.add(wingTop);

    for (const side of [-1, 1]) {
      const wingSide = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.56, 0.48), paintMat);
      wingSide.position.set(side * 0.93, 0.96, -2.02);
      wingSide.castShadow = true;
      chassis.add(wingSide);

      // Recessed clear Lexan front driving light pods
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.16), headLightMat);
      lamp.position.set(side * 0.64, 0.44, 2.22);
      chassis.add(lamp);

      // Side NACA air ducts
      const naca = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.72), darkGrilleMat);
      naca.position.set(side * 0.96, 0.60, -0.52);
      chassis.add(naca);
    }

    const rearGrille = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.36, 0.10), darkGrilleMat);
    rearGrille.position.set(0, 0.58, -2.26);
    chassis.add(rearGrille);

    for (const xOff of [-0.74, -0.48, 0.48, 0.74]) {
      const roundTail = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.08, 16), tailLightMat);
      roundTail.rotation.x = Math.PI / 2;
      roundTail.position.set(xOff, 0.62, -2.31);
      chassis.add(roundTail);
    }

    addExhaust(-0.15, 0.28, -2.29, 0.058);
    addExhaust(0.0, 0.28, -2.29, 0.058);
    addExhaust(0.15, 0.28, -2.29, 0.058);
    addWheelArchCutouts(chassis, wheelbaseFrontZ, wheelbaseRearZ, 0.96, wheelRadiusF, wheelRadiusR, darkGrilleMat);
  } else {
    // =========================================================================
    // LAMBORGHINI AVENTADOR SVJ — Stealth Fighter Wedge + Low Fighter Canopy +
    // Y-Shaped DRL Headlights + Forged Carbon Shark-Fin Wing + High Center Duals
    // =========================================================================
    wheelbaseFrontZ = 1.44;
    wheelbaseRearZ = -1.36;
    trackWidth = 1.02;
    wheelRadiusF = 0.35;
    wheelRadiusR = 0.38;
    spokeCount = 5;

    // 1. Lower razor-angular wedge hull (beltline only!)
    const lowerHullGeo = createExtrudedProfile(
      [
        [-2.26, 0.25],
        [-2.18, 0.84],
        [-0.84, 0.88],
        [1.10, 0.68],
        [2.28, 0.38],
        [2.38, 0.25],
        [2.22, 0.18],
        [-2.16, 0.18],
      ],
      1.96,
      0.04,
      0.05
    );
    const lowerHull = new THREE.Mesh(lowerHullGeo, paintMat);
    lowerHull.castShadow = true;
    chassis.add(lowerHull);

    // 2. Separate dramatically raked fighter-jet tinted glass cabin
    const canopyGeo = createExtrudedProfile(
      [
        [-1.12, 0.86],
        [-0.22, 1.17],
        [0.36, 1.12],
        [1.24, 0.66],
      ],
      1.36,
      0.035,
      0.045
    );
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    canopy.castShadow = true;
    chassis.add(canopy);

    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.05, 0.72), carbonMat);
    roofCap.position.set(0, 1.17, 0.06);
    chassis.add(roofCap);

    // Forged-carbon front ALA splitter & skirts
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.06, 0.56), carbonMat);
    splitter.position.set(0, 0.19, 2.14);
    chassis.add(splitter);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.10, 0.08, 2.32), carbonMat);
    skirt.position.set(0, 0.19, 0.0);
    chassis.add(skirt);

    for (const side of [-1, 1]) {
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.78), carbonMat);
      scoop.position.set(side * 1.03, 0.56, -0.52);
      chassis.add(scoop);

      const frontIntake = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.20, 0.20), darkGrilleMat);
      frontIntake.position.set(side * 0.66, 0.32, 2.28);
      frontIntake.rotation.y = side * -0.18;
      chassis.add(frontIntake);

      // Sharp angled Lamborghini DRL headlight blades (proud of hood!)
      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.18), headLightMat);
      drl.position.set(side * 0.70, 0.52, 2.04);
      drl.rotation.set(0.24, side * -0.35, side * -0.18);
      chassis.add(drl);

      // Rear angular Y-motif taillights
      const tailBlade = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.085, 0.09), tailLightMat);
      tailBlade.position.set(side * 0.64, 0.68, -2.29);
      tailBlade.rotation.z = side * 0.12;
      chassis.add(tailBlade);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.065, 0.14), carbonMat);
      mirror.position.set(side * 1.06, 0.86, 0.52);
      chassis.add(mirror);
    }

    // V12 rear engine louvers
    for (let i = 0; i < 4; i++) {
      const louver = new THREE.Mesh(new THREE.BoxGeometry(0.84 - i * 0.06, 0.055, 0.24), carbonMat);
      louver.position.set(0, 0.94 - i * 0.03, -1.02 - i * 0.28);
      louver.rotation.x = 0.14;
      chassis.add(louver);
    }

    // Signature SVJ Forged-Carbon Rear Wing with Central Shark Fin
    const svjWing = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.06, 0.38), carbonMat);
    svjWing.position.set(0, 1.24, -2.06);
    svjWing.rotation.x = 0.09;
    svjWing.castShadow = true;
    chassis.add(svjWing);
    activeWing = svjWing;
    activeWingBaseRotX = 0.09;
    activeWingBaseY = 1.24;

    const centerFin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.58), carbonMat);
    centerFin.position.set(0, 1.04, -1.96);
    chassis.add(centerFin);

    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.22), carbonMat);
      pylon.position.set(side * 0.72, 1.03, -2.02);
      chassis.add(pylon);

      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.26, 0.44), paintMat);
      endplate.position.set(side * 1.04, 1.22, -2.06);
      chassis.add(endplate);
    }

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.28, 0.28), carbonMat);
    diffuser.position.set(0, 0.28, -2.23);
    chassis.add(diffuser);

    addExhaust(-0.22, 0.54, -2.29, 0.072);
    addExhaust(0.22, 0.54, -2.29, 0.072);
    addWheelArchCutouts(chassis, wheelbaseFrontZ, wheelbaseRearZ, 1.0, wheelRadiusF, wheelRadiusR, darkGrilleMat);
  }

  // 4 Articulated Sculpted Wheels (bottom sits flush on road y = 0!)
  const frontWheelPivots: THREE.Group[] = [];
  const wheelMeshes: THREE.Object3D[] = [];
  const wheelDefs = [
    { x: trackWidth, y: wheelRadiusF, z: wheelbaseFrontZ, isFront: true, isRight: false, r: wheelRadiusF, w: 0.32 },
    { x: -trackWidth, y: wheelRadiusF, z: wheelbaseFrontZ, isFront: true, isRight: true, r: wheelRadiusF, w: 0.32 },
    { x: trackWidth + 0.02, y: wheelRadiusR, z: wheelbaseRearZ, isFront: false, isRight: false, r: wheelRadiusR, w: 0.38 },
    { x: -(trackWidth + 0.02), y: wheelRadiusR, z: wheelbaseRearZ, isFront: false, isRight: true, r: wheelRadiusR, w: 0.38 },
  ];

  for (const wd of wheelDefs) {
    const { pivot, spinner } = buildWheelAssembly(
      modelId,
      wd.r,
      wd.w,
      tireMat,
      barrelMat,
      rimMat,
      lipMat,
      rotorFaceMat,
      caliperMat,
      centerCapMat,
      wd.isRight
    );
    pivot.position.set(wd.x, wd.y, wd.z);
    root.add(pivot);
    if (wd.isFront) frontWheelPivots.push(pivot);
    wheelMeshes.push(spinner);
  }
  void spokeCount;

  // Grounded soft radial contact shadow disc
  const shadowGeo = new THREE.PlaneGeometry(3.2, 5.5);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.set(0, 0.025, 0);
  root.add(shadowPlane);

  // Volumetric LED Headlight Ground Beam Cones (dramatic on Tokyo Night, crisp daytime glint)
  const headlightBeamMat = new THREE.MeshBasicMaterial({
    map: getHeadlightBeamTexture(),
    color: 0xfff8e6,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const headlightBeams: THREE.Mesh[] = [];
  const beamGeo = new THREE.PlaneGeometry(3.9, 18.0);
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.rotateY(Math.PI); // Narrow bright origin sits right at headlights (-Z), widens forward (+Z)!
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(beamGeo, headlightBeamMat);
    beam.position.set(side * 0.76, 0.068, 11.2);
    beam.rotation.y = side * -0.05;
    beam.visible = false;
    root.add(beam);
    headlightBeams.push(beam);
  }

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry?.dispose();
      }
    });
    paintMat.dispose();
    secondaryPaintMat.dispose();
    carbonMat.dispose();
    glassMat.dispose();
    chromeMat.dispose();
    accentMat.dispose();
    darkGrilleMat.dispose();
    tireMat.dispose();
    barrelMat.dispose();
    rimMat.dispose();
    lipMat.dispose();
    rotorFaceMat.dispose();
    caliperMat.dispose();
    centerCapMat.dispose();
    headLightMat.dispose();
    tailLightMat.dispose();
    flameMat.dispose();
    shadowMat.dispose();
    headlightBeamMat.dispose();
  };

  return {
    root,
    chassis,
    frontWheelPivots,
    wheelMeshes,
    tailLightMat,
    paintMat,
    flames,
    flameMat,
    activeWing,
    activeWingBaseRotX,
    activeWingBaseY,
    headlightBeamMat,
    headlightBeams,
    dispose,
  };
}
