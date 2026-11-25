import * as THREE from 'three';
import {
  BARRIER_OFFSET,
  CURB_WIDTH,
  ROAD_HALF_WIDTH,
  TrackData,
  getSampleAtDistance,
  groundHeightAt,
} from './track';
import { ProceduralTextureSet } from './textures';
import { TrackId } from './types';

export interface WorldTheme {
  skyTop: number;
  skyMid: number;
  skyHorizon: number;
  fogHex: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  exposure: number;
}

export function getWorldTheme(trackId: TrackId): WorldTheme {
  if (trackId === 'tokyo') {
    return {
      skyTop: 0x070c1e,
      skyMid: 0x1a1e44,
      skyHorizon: 0x3b2c5e,
      fogHex: 0x241f42,
      fogDensity: 0.0018,
      sunColor: 0xffb38a,
      sunIntensity: 1.55,
      hemiSky: 0x5c72c8,
      hemiGround: 0x261d38,
      hemiIntensity: 1.05,
      exposure: 1.18,
    };
  }
  if (trackId === 'alps') {
    return {
      skyTop: 0x1e5ea8,
      skyMid: 0x6eaee0,
      skyHorizon: 0xe6decb,
      fogHex: 0xd5dce6,
      fogDensity: 0.0016,
      sunColor: 0xffe0aa,
      sunIntensity: 2.4,
      hemiSky: 0x9cd2ff,
      hemiGround: 0x6a7852,
      hemiIntensity: 0.95,
      exposure: 1.1,
    };
  }
  return {
    skyTop: 0x206db8,
    skyMid: 0x76b6e8,
    skyHorizon: 0xdce8f4,
    fogHex: 0xbad9f2,
    fogDensity: 0.0019,
    sunColor: 0xffe7c2,
    sunIntensity: 2.35,
    hemiSky: 0x9dd1ff,
    hemiGround: 0x8d7253,
    hemiIntensity: 0.95,
    exposure: 1.12,
  };
}

export interface WorldHandles {
  group: THREE.Group;
  countdownLights: THREE.MeshStandardMaterial[];
  lighthouseBeacon: THREE.Group | null;
  animatedYachts: THREE.Group[];
  boostPadMat: THREE.MeshStandardMaterial;
  waterUniforms: { uTime: { value: number } };
  dispose: () => void;
}

function buildRibbonGeometry(
  track: TrackData,
  innerOffset: number,
  outerOffset: number,
  yOffset: number,
  uvVRepeatPerMeter: number
): THREE.BufferGeometry {
  const { samples, totalLength } = track;
  const n = samples.length;
  const positions = new Float32Array((n + 1) * 2 * 3);
  const uvs = new Float32Array((n + 1) * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const dist = i === n ? totalLength : s.s;

    const lx = s.x + s.rx * innerOffset;
    const ly = s.y + yOffset;
    const lz = s.z + s.rz * innerOffset;

    const rx = s.x + s.rx * outerOffset;
    const ry = s.y + yOffset;
    const rz = s.z + s.rz * outerOffset;

    const vi = i * 2;
    positions[vi * 3 + 0] = lx;
    positions[vi * 3 + 1] = ly;
    positions[vi * 3 + 2] = lz;

    positions[(vi + 1) * 3 + 0] = rx;
    positions[(vi + 1) * 3 + 1] = ry;
    positions[(vi + 1) * 3 + 2] = rz;

    const vCoord = dist * uvVRepeatPerMeter;
    uvs[vi * 2 + 0] = 0;
    uvs[vi * 2 + 1] = vCoord;
    uvs[(vi + 1) * 2 + 0] = 1;
    uvs[(vi + 1) * 2 + 1] = vCoord;

    if (i < n) {
      const a = vi;
      const b = vi + 1;
      const c = vi + 2;
      const d = vi + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildGuardrailGeometry(track: TrackData, lateralOffset: number): THREE.BufferGeometry {
  const { samples } = track;
  const n = samples.length;
  const railBottom = 0.25;
  const railTop = 0.9;
  const positions = new Float32Array((n + 1) * 2 * 3);
  const indices: number[] = [];

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const px = s.x + s.rx * lateralOffset;
    const pz = s.z + s.rz * lateralOffset;
    const vi = i * 2;

    positions[vi * 3 + 0] = px;
    positions[vi * 3 + 1] = s.y + railBottom;
    positions[vi * 3 + 2] = pz;

    positions[(vi + 1) * 3 + 0] = px;
    positions[(vi + 1) * 3 + 1] = s.y + railTop;
    positions[(vi + 1) * 3 + 2] = pz;

    if (i < n) {
      const a = vi;
      const b = vi + 1;
      const c = vi + 2;
      const d = vi + 3;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildCoastalLighthouse(): { group: THREE.Group; beacon: THREE.Group } {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xede5d4, roughness: 0.78 });
  const redBandMat = new THREE.MeshStandardMaterial({ color: 0xc9312b, roughness: 0.55 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x9b8e7a, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e2836, roughness: 0.45, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfff3cc,
    emissive: 0xffd27a,
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.2, 4.0, 12), baseMat);
  plinth.position.y = 2.0;
  plinth.castShadow = true;
  group.add(plinth);

  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.3, 8.0, 14), stoneMat);
  seg1.position.y = 8.0;
  seg1.castShadow = true;
  group.add(seg1);

  const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.4, 5.2, 14), redBandMat);
  seg2.position.y = 14.6;
  seg2.castShadow = true;
  group.add(seg2);

  const seg3 = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.9, 5.6, 14), stoneMat);
  seg3.position.y = 20.0;
  seg3.castShadow = true;
  group.add(seg3);

  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 2.6, 1.2, 14), roofMat);
  gallery.position.y = 23.2;
  group.add(gallery);

  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 3.2, 12), glassMat);
  lantern.position.y = 25.4;
  group.add(lantern);

  const dome = new THREE.Mesh(new THREE.ConeGeometry(2.5, 3.4, 12), roofMat);
  dome.position.y = 28.6;
  group.add(dome);

  const beacon = new THREE.Group();
  beacon.position.y = 25.4;
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe4a0,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (const dir of [-1, 1]) {
    const beamGeo = new THREE.ConeGeometry(2.4, 20, 10, 1, true);
    beamGeo.rotateX(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    beamGeo.translate(0, 0, dir * 10);
    beacon.add(new THREE.Mesh(beamGeo, beamMat));
  }
  group.add(beacon);

  const cottage = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.4, 5.4), stoneMat);
  cottage.position.set(6.4, 2.2, 1.5);
  cottage.castShadow = true;
  group.add(cottage);

  const cottageRoof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.2, 4), redBandMat);
  cottageRoof.position.set(6.4, 5.5, 1.5);
  cottageRoof.rotation.y = Math.PI / 4;
  group.add(cottageRoof);

  return { group, beacon };
}

function buildSailingYacht(): THREE.Group {
  const yacht = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf8f6f0, roughness: 0.3 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x1e4d7a, roughness: 0.5 });
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xfffaf0,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.7, roughness: 0.3 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 11.0), hullMat);
  hull.position.y = 0.7;
  yacht.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.6, 4), hullMat);
  bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  bow.position.set(0, 0.75, 7.2);
  yacht.add(bow);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.2), deckMat);
  cabin.position.set(0, 1.75, -0.5);
  yacht.add(cabin);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 13.5, 8), mastMat);
  mast.position.set(0, 7.8, 0.5);
  yacht.add(mast);

  // Main triangular sail
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0);
  sailShape.lineTo(5.6, 0.8);
  sailShape.lineTo(0, 11.5);
  sailShape.closePath();
  const sailGeo = new THREE.ShapeGeometry(sailShape);
  sailGeo.rotateY(Math.PI / 2);
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.position.set(0, 2.2, 0.5);
  yacht.add(sail);

  return yacht;
}

function buildTracksideGrandstand(accentHex: number): THREE.Group {
  const gs = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xdcd7cd, roughness: 0.82 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x263042, metalness: 0.6, roughness: 0.35 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.5 });

  // Stepped seating tiers
  for (let t = 0; t < 4; t++) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 28), concreteMat);
    tier.position.set(t * 1.9, 0.5 + t * 0.95, 0);
    tier.castShadow = true;
    gs.add(tier);
  }
  // Support pillars & cantilevered sun canopy roof
  for (const zOff of [-12, 0, 12]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7.2, 0.45), steelMat);
    pillar.position.set(6.4, 3.6, zOff);
    gs.add(pillar);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.35, 30), canopyMat);
  roof.position.set(3.2, 7.2, 0);
  roof.rotation.z = 0.12;
  roof.castShadow = true;
  gs.add(roof);
  return gs;
}

function buildMediterraneanVilla(scale = 1): THREE.Group {
  const villa = new THREE.Group();
  const stuccoColors = [0xf2e4cc, 0xecd2b2, 0xe8c7a3, 0xf5ebd8];
  const stuccoHex = stuccoColors[Math.floor(Math.abs(Math.sin(scale * 91.3) * 4)) % stuccoColors.length];
  const wallMat = new THREE.MeshStandardMaterial({ color: stuccoHex, roughness: 0.82 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb85233, roughness: 0.72 });
  const shutterMat = new THREE.MeshStandardMaterial({ color: 0x2b5548, roughness: 0.6 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf7f2e8, roughness: 0.65 });

  const main = new THREE.Mesh(new THREE.BoxGeometry(10, 6.2, 7.6), wallMat);
  main.position.y = 3.1;
  main.castShadow = true;
  villa.add(main);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 2.8, 4), roofMat);
  roof.position.y = 7.6;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.05, 1, 0.85);
  villa.add(roof);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(4.4, 8.2, 4.4), wallMat);
  tower.position.set(5.4, 4.1, -1.0);
  villa.add(tower);

  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.0, 4), roofMat);
  towerRoof.position.set(5.4, 9.2, -1.0);
  towerRoof.rotation.y = Math.PI / 4;
  villa.add(towerRoof);

  for (const xOff of [-2.8, 0, 2.8]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.8, 0.16), shutterMat);
    win.position.set(xOff, 3.8, 3.85);
    villa.add(win);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.28), trimMat);
    sill.position.set(xOff, 2.85, 3.88);
    villa.add(sill);
  }
  villa.scale.setScalar(scale);
  return villa;
}

function buildSwissChalet(scale = 1): THREE.Group {
  const chalet = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xc9c2b6, roughness: 0.88 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.82 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3b2c26, roughness: 0.78 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.65 });
  const glowWinMat = new THREE.MeshStandardMaterial({
    color: 0xffe4a0,
    emissive: 0xffb347,
    emissiveIntensity: 0.85,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 8.4), stoneMat);
  base.position.y = 1.6;
  chalet.add(base);

  const upper = new THREE.Mesh(new THREE.BoxGeometry(10.6, 3.6, 9.0), timberMat);
  upper.position.y = 5.0;
  chalet.add(upper);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(8.2, 3.8, 4), roofMat);
  roof.position.y = 8.6;
  roof.rotation.y = Math.PI / 4;
  chalet.add(roof);

  const snowCap = new THREE.Mesh(new THREE.ConeGeometry(7.9, 3.6, 4), snowMat);
  snowCap.position.y = 8.85;
  snowCap.rotation.y = Math.PI / 4;
  chalet.add(snowCap);

  for (const xOff of [-2.8, 0, 2.8]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.2), glowWinMat);
    w.position.set(xOff, 5.0, 4.55);
    chalet.add(w);
  }
  chalet.scale.setScalar(scale);
  return chalet;
}

function buildTokyoSuspensionBridge(track: TrackData): THREE.Group {
  const bridge = new THREE.Group();
  const towerRedMat = new THREE.MeshStandardMaterial({
    color: 0xd92e2e,
    roughness: 0.38,
    metalness: 0.55,
  });
  const towerWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf0f4fa,
    roughness: 0.35,
    metalness: 0.45,
  });
  const cableGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.5,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff3b3b,
    emissive: 0xff2222,
    emissiveIntensity: 3.0,
  });

  // Two monumental bridge towers straddling the Tokyo Wangan main straight!
  const spanHalf = ROAD_HALF_WIDTH + CURB_WIDTH + 2.2;
  const towerZs = [72, 152];
  const towerTopY = 44;

  for (const tz of towerZs) {
    for (const side of [-1, 1]) {
      const legLower = new THREE.Mesh(new THREE.BoxGeometry(2.4, 24, 2.8), towerWhiteMat);
      legLower.position.set(side * spanHalf, 12, tz);
      bridge.add(legLower);

      const legUpper = new THREE.Mesh(new THREE.BoxGeometry(2.0, 22, 2.4), towerRedMat);
      legUpper.position.set(side * spanHalf, 34, tz);
      bridge.add(legUpper);

      const topLight = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 10), beaconMat);
      topLight.position.set(side * spanHalf, towerTopY + 1.5, tz);
      bridge.add(topLight);
    }

    // Crossbeams connecting twin legs above road
    for (const cy of [18, 30, 41]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(spanHalf * 2 + 2.4, 1.8, 2.0), towerRedMat);
      beam.position.set(0, cy, tz);
      bridge.add(beam);
    }
  }

  // Glowing illuminated suspension catenary cables sweeping between towers and anchor points!
  for (const side of [-1, 1]) {
    const sx = side * spanHalf;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 7.0, 12),
      new THREE.Vector3(sx, towerTopY, 72),
      new THREE.Vector3(sx, 17.0, 112),
      new THREE.Vector3(sx, towerTopY, 152),
      new THREE.Vector3(sx, 8.5, 208),
    ]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 44, 0.36, 8, false), cableGlowMat);
    bridge.add(cable);
  }

  // Viaduct concrete support piers cleanly underneath elevated Tokyo Bay highway deck
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x3b4454, roughness: 0.82 });
  for (let i = 0; i < track.samples.length; i += 14) {
    const s = track.samples[i];
    const pierH = Math.max(2, s.y + 7.4);
    const pier = new THREE.Mesh(new THREE.BoxGeometry(5.5, pierH, 2.6), pierMat);
    pier.position.set(s.x, s.y - 0.55 - pierH / 2, s.z);
    pier.rotation.y = Math.atan2(s.tx, s.tz);
    bridge.add(pier);
  }

  return bridge;
}

function buildAlpsRockTunnel(track: TrackData): THREE.Group {
  const tunnel = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7b7873, roughness: 0.92 });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffe0a3,
    emissive: 0xffb347,
    emissiveIntensity: 2.6,
  });

  // Span the high ridge straight (samples ~120..162) with monumental stone avalanche-gallery arches
  const spanHalf = ROAD_HALF_WIDTH + CURB_WIDTH + 1.4;
  for (let idx = 122; idx <= 162; idx += 5) {
    const s = track.samples[idx % track.samples.length];
    const arch = new THREE.Group();
    arch.position.set(s.x, s.y, s.z);
    arch.rotation.y = Math.atan2(s.tx, s.tz);

    // Solid mountain-side right wall & pillared valley-side left wall (classic Swiss gallery!)
    const wallR = new THREE.Mesh(new THREE.BoxGeometry(2.2, 8.2, 7.6), stoneMat);
    wallR.position.set(spanHalf, 4.1, 0);
    arch.add(wallR);

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8.2, 2.0), stoneMat);
    pillarL.position.set(-spanHalf, 4.1, 0);
    arch.add(pillarL);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(spanHalf * 2 + 3.2, 2.0, 8.0), stoneMat);
    roof.position.set(0, 8.6, 0);
    arch.add(roof);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.25, 0.8), lightMat);
    lamp.position.set(0, 7.45, 0);
    arch.add(lamp);

    tunnel.add(arch);
  }
  return tunnel;
}

export function buildWorld(
  track: TrackData,
  textures: ProceduralTextureSet
): WorldHandles {
  const group = new THREE.Group();
  const animatedYachts: THREE.Group[] = [];
  let lighthouseBeacon: THREE.Group | null = null;
  const isTokyo = track.id === 'tokyo';
  const isAlps = track.id === 'alps';

  // =========================================================================
  // 1. ROAD RIBBON, CURBS, GUARDRAILS & CORNER CHEVRON SIGNBOARDS
  // =========================================================================
  const roadGeo = buildRibbonGeometry(track, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, 0.0, 0.085);
  const roadMat = new THREE.MeshStandardMaterial({
    color: isTokyo ? 0x626b7c : 0xffffff,
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.03,
    roughness: isTokyo ? 0.74 : 0.78,
    metalness: isTokyo ? 0.08 : 0.05,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.curbMap,
    roughness: 0.65,
    metalness: 0.04,
  });
  const leftCurb = new THREE.Mesh(
    buildRibbonGeometry(track, -(ROAD_HALF_WIDTH + CURB_WIDTH), -ROAD_HALF_WIDTH, 0.025, 0.22),
    curbMat
  );
  const rightCurb = new THREE.Mesh(
    buildRibbonGeometry(track, ROAD_HALF_WIDTH, ROAD_HALF_WIDTH + CURB_WIDTH, 0.025, 0.22),
    curbMat
  );
  leftCurb.receiveShadow = true;
  rightCurb.receiveShadow = true;
  group.add(leftCurb, rightCurb);

  const railMat = new THREE.MeshStandardMaterial({
    color: isTokyo ? 0x26324d : 0xd8d5cc,
    emissive: isTokyo ? 0x0ea5e9 : 0x000000,
    emissiveIntensity: isTokyo ? 0.22 : 0,
    roughness: 0.48,
    metalness: 0.48,
    side: THREE.DoubleSide,
  });
  group.add(
    new THREE.Mesh(buildGuardrailGeometry(track, -BARRIER_OFFSET - 0.35), railMat),
    new THREE.Mesh(buildGuardrailGeometry(track, BARRIER_OFFSET + 0.35), railMat)
  );

  // Instanced Guardrail Posts (plus overhead streetlamps on Tokyo!)
  const dummy = new THREE.Object3D();
  const postCount = Math.floor(track.samples.length / 4) * 2;
  const postGeo = new THREE.BoxGeometry(0.16, 0.96, 0.16);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5c6470, roughness: 0.6, metalness: 0.5 });
  const postInst = new THREE.InstancedMesh(postGeo, postMat, postCount);
  let pIdx = 0;
  for (let i = 0; i < track.samples.length && pIdx < postCount - 1; i += 4) {
    const s = track.samples[i];
    for (const side of [-1, 1]) {
      const off = side * (BARRIER_OFFSET + 0.42);
      dummy.position.set(s.x + s.rx * off, s.y + 0.46, s.z + s.rz * off);
      dummy.rotation.set(0, Math.atan2(s.tx, s.tz), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postInst.setMatrixAt(pIdx++, dummy.matrix);
    }
  }
  postInst.instanceMatrix.needsUpdate = true;
  postInst.computeBoundingSphere();
  group.add(postInst);

  // Corner Direction Chevron Signboards (high readability for fast driving!)
  if (track.cornerChevrons.length > 0) {
    const signGeo = new THREE.BoxGeometry(2.6, 1.35, 0.18);
    const signMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.chevronMap,
      emissive: isTokyo ? 0xf472b6 : 0xf5b700,
      emissiveMap: textures.chevronMap,
      emissiveIntensity: isTokyo ? 1.5 : 0.45,
      roughness: 0.35,
    });
    const signInst = new THREE.InstancedMesh(signGeo, signMat, track.cornerChevrons.length);
    track.cornerChevrons.forEach((ch, idx) => {
      dummy.position.set(ch.x, ch.y + 1.55, ch.z);
      // Orient sign facing oncoming traffic, flipping Z scale if left turn so arrows point in turn direction!
      dummy.rotation.set(0, ch.heading + Math.PI, 0);
      dummy.scale.set(ch.turnRight ? 1 : -1, 1, 1);
      dummy.updateMatrix();
      signInst.setMatrixAt(idx, dummy.matrix);
    });
    signInst.instanceMatrix.needsUpdate = true;
    signInst.computeBoundingSphere();
    group.add(signInst);
  }

  // =========================================================================
  // 2. CONTINUOUS MAP-SPECIFIC TERRAIN & WATER
  // =========================================================================
  const terrainSize = 760;
  const terrainSegs = 96;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(70, 0, 25);

  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const tmpColor = new THREE.Color();

  const c1 = new THREE.Color(isTokyo ? 0x1e2538 : isAlps ? 0x4b7438 : 0xe0cfa9);
  const c2 = new THREE.Color(isTokyo ? 0x2c344d : isAlps ? 0x6f7a6e : 0x7c9350);
  const c3 = new THREE.Color(isTokyo ? 0x3b4560 : isAlps ? 0x8f9499 : 0xb89668);
  const c4 = new THREE.Color(isTokyo ? 0x45506d : isAlps ? 0xf2f6fc : 0xc5b299);

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const h = groundHeightAt(track, vx, vz);
    posAttr.setY(i, h);

    if (isAlps) {
      if (h < 10) tmpColor.copy(c1).lerp(c2, Math.max(0, h / 10));
      else if (h < 25) tmpColor.copy(c2).lerp(c3, (h - 10) / 15);
      else tmpColor.copy(c3).lerp(c4, Math.min(1, (h - 25) / 14));
    } else if (isTokyo) {
      tmpColor.copy(h > 0 ? c2 : c1);
    } else {
      if (h < -0.3) tmpColor.copy(c1);
      else if (h < 5.2) tmpColor.copy(c1).lerp(c2, Math.min(1, ((h + 0.3) / 5.5) * 1.15));
      else if (h < 13.0) tmpColor.copy(c2).lerp(c3, (h - 5.2) / 7.8);
      else tmpColor.copy(c3).lerp(c4, Math.min(1, (h - 13.0) / 10.0));
    }
    colors[i * 3 + 0] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMesh = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 })
  );
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Shimmering Water Plane (Mediterranean turquoise / Tokyo Bay midnight / Alpine lake)
  const waterUniforms = { uTime: { value: 0 } };
  if (!isAlps) {
    const waterGeo = new THREE.PlaneGeometry(1800, 1800, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: isTokyo ? 0x091c3a : 0x0b7ba3,
      roughness: isTokyo ? 0.1 : 0.14,
      metalness: isTokyo ? 0.45 : 0.28,
      bumpMap: textures.waterBump,
      bumpScale: 0.12,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(-40, -1.65, 20);
    group.add(waterMesh);
  }

  // =========================================================================
  // 3. CHECKERED START / FINISH GANTRY ARCH & COUNTDOWN LIGHTS
  // =========================================================================
  const startArchSample = getSampleAtDistance(track, track.totalLength * 0.085);
  const archGroup = new THREE.Group();
  archGroup.position.set(startArchSample.x, startArchSample.y, startArchSample.z);
  archGroup.rotation.y = Math.atan2(startArchSample.tx, startArchSample.tz);

  const pillarMat = new THREE.MeshStandardMaterial({
    color: isTokyo ? 0x1e263b : 0xe8e2d5,
    roughness: 0.45,
    metalness: 0.25,
  });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.35, metalness: 0.7 });
  const spanHalf = ROAD_HALF_WIDTH + CURB_WIDTH + 0.9;

  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8.6, 1.3), pillarMat);
    pillar.position.set(side * spanHalf, 4.3, 0);
    pillar.castShadow = true;
    archGroup.add(pillar);

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.8), steelMat);
    base.position.set(side * spanHalf, 0.55, 0);
    archGroup.add(base);
  }

  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.gantryBannerMap,
    emissive: isTokyo ? 0x223355 : 0x000000,
    emissiveIntensity: isTokyo ? 0.6 : 0,
    roughness: 0.42,
    metalness: 0.15,
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(spanHalf * 2 + 1.4, 2.35, 0.9), [
    steelMat,
    steelMat,
    steelMat,
    steelMat,
    bannerMat,
    bannerMat,
  ]);
  banner.position.set(0, 7.8, 0);
  banner.castShadow = true;
  archGroup.add(banner);

  const countdownLights: THREE.MeshStandardMaterial[] = [];
  const podHousing = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.72, 0.55), steelMat);
  podHousing.position.set(0, 6.22, -0.15);
  archGroup.add(podHousing);

  for (let i = 0; i < 5; i++) {
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0x262930,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.2,
    });
    countdownLights.push(lightMat);
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.62, 14), lightMat);
    bulb.rotation.x = Math.PI / 2;
    bulb.position.set(-2.0 + i * 1.0, 6.22, -0.15);
    archGroup.add(bulb);
  }

  const sfCanvas = document.createElement('canvas');
  sfCanvas.width = 512;
  sfCanvas.height = 64;
  const sfCtx = sfCanvas.getContext('2d')!;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 16; c++) {
      sfCtx.fillStyle = (r + c) % 2 === 0 ? '#f5f1e6' : '#191d24';
      sfCtx.fillRect(c * 32, r * 32, 32, 32);
    }
  }
  const sfTex = new THREE.CanvasTexture(sfCanvas);
  sfTex.colorSpace = THREE.SRGBColorSpace;
  const sfLine = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2 - 0.6, 2.6),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sfTex,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  sfLine.rotation.x = -Math.PI / 2;
  sfLine.position.set(0, 0.03, 0);
  archGroup.add(sfLine);
  group.add(archGroup);

  // =========================================================================
  // 4. APEX BOOST PADS & THRILLING ARCADE JUMP RAMPS
  // =========================================================================
  const boostPadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.boostPadMap,
    emissive: isTokyo ? 0xec4899 : 0x0ea5e9,
    emissiveMap: textures.boostPadMap,
    emissiveIntensity: 1.35,
    roughness: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const padGeo = new THREE.PlaneGeometry(3.3, 6.5);
  padGeo.rotateX(-Math.PI / 2);

  for (const pad of track.boostPads) {
    const padMesh = new THREE.Mesh(padGeo, boostPadMat);
    padMesh.position.set(pad.x, pad.y + 0.035, pad.z);
    padMesh.rotation.y = pad.heading;
    group.add(padMesh);
  }

  // Sculpted Wedge Jump Ramps with glowing amber launch edge!
  const rampBodyMat = new THREE.MeshStandardMaterial({ color: 0x222938, roughness: 0.5, metalness: 0.4 });
  const rampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.8,
  });
  for (const ramp of track.jumpRamps) {
    const rampGroup = new THREE.Group();
    rampGroup.position.set(ramp.x, ramp.y, ramp.z);
    rampGroup.rotation.y = ramp.heading;

    const wedgeShape = new THREE.Shape();
    wedgeShape.moveTo(-ramp.length / 2, 0);
    wedgeShape.lineTo(ramp.length / 2, 0);
    wedgeShape.lineTo(ramp.length / 2, 1.05);
    wedgeShape.closePath();

    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
      depth: ramp.width,
      bevelEnabled: false,
    });
    wedgeGeo.translate(0, 0, -ramp.width / 2);
    wedgeGeo.rotateY(-Math.PI / 2);
    const wedge = new THREE.Mesh(wedgeGeo, rampBodyMat);
    rampGroup.add(wedge);

    const lip = new THREE.Mesh(new THREE.BoxGeometry(ramp.width + 0.1, 0.16, 0.45), rampGlowMat);
    lip.position.set(0, 1.05, ramp.length / 2 - 0.15);
    rampGroup.add(lip);

    // Side chevron rails on ramp
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, ramp.length * 0.9), rampGlowMat);
      rail.position.set(side * (ramp.width / 2), 0.42, 0);
      rail.rotation.x = -0.11;
      rampGroup.add(rail);
    }
    group.add(rampGroup);
  }

  // =========================================================================
  // 5. MAP-SPECIFIC HERO LANDMARKS, ARCHITECTURE & FOLIAGE
  // =========================================================================
  if (track.id === 'riviera') {
    // Coastal Lighthouse
    const lh = buildCoastalLighthouse();
    const lhX = 18;
    const lhZ = 212;
    lh.group.position.set(lhX, groundHeightAt(track, lhX, lhZ) - 0.3, lhZ);
    group.add(lh.group);
    lighthouseBeacon = lh.beacon;

    // Trackside Grandstand beside start straight
    const gs = buildTracksideGrandstand(0xd92626);
    gs.position.set(19, groundHeightAt(track, 19, 10) - 0.1, 10);
    gs.rotation.y = Math.PI;
    group.add(gs);

    // Sailing Yachts floating in the turquoise Mediterranean bay!
    const yachtCoords = [
      { x: -58, z: 45, rot: 0.4 },
      { x: -92, z: 118, rot: -0.6 },
      { x: -74, z: -48, rot: 0.9 },
      { x: -120, z: 12, rot: -0.2 },
    ];
    for (const yc of yachtCoords) {
      const y = buildSailingYacht();
      y.position.set(yc.x, -1.55, yc.z);
      y.rotation.y = yc.rot;
      group.add(y);
      animatedYachts.push(y);
    }

    // Amalfi Terracotta Villas
    const villaCoords = [
      { x: 64, z: 72, rot: -0.6, scale: 1.1 },
      { x: 88, z: 102, rot: -1.1, scale: 0.95 },
      { x: 192, z: 112, rot: -1.9, scale: 1.15 },
      { x: 164, z: -28, rot: -2.2, scale: 1.0 },
      { x: 66, z: -86, rot: 0.4, scale: 1.05 },
      { x: 42, z: 26, rot: -1.5, scale: 1.0 },
    ];
    for (const vc of villaCoords) {
      const v = buildMediterraneanVilla(vc.scale);
      v.position.set(vc.x, groundHeightAt(track, vc.x, vc.z) - 0.35, vc.z);
      v.rotation.y = vc.rot;
      group.add(v);
    }
  } else if (track.id === 'tokyo') {
    // Monumental Illuminated Suspension Bridge over the main straight!
    group.add(buildTokyoSuspensionBridge(track));

    // Glowing Tokyo Bay Skyscraper Skyline flanking the expressway!
    const towerCoords = [
      { x: 66, z: 120, w: 18, h: 68, d: 18 },
      { x: 88, z: 78, w: 22, h: 92, d: 20 },
      { x: 74, z: 22, w: 16, h: 58, d: 18 },
      { x: 96, z: -32, w: 24, h: 84, d: 22 },
      { x: 64, z: -84, w: 18, h: 62, d: 18 },
      { x: 226, z: 156, w: 24, h: 96, d: 24 },
      { x: 232, z: 86, w: 20, h: 78, d: 22 },
      { x: 228, z: -12, w: 26, h: 104, d: 24 },
      { x: 215, z: -86, w: 20, h: 72, d: 20 },
      { x: -96, z: 175, w: 24, h: 88, d: 22 },
      { x: -102, z: 92, w: 20, h: 74, d: 20 },
      { x: -98, z: -18, w: 22, h: 82, d: 22 },
      { x: 48, z: 288, w: 26, h: 95, d: 24 },
      { x: 118, z: 292, w: 22, h: 78, d: 22 },
    ];
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.skyscraperMap,
      emissive: 0xffffff,
      emissiveMap: textures.skyscraperMap,
      emissiveIntensity: 0.72,
      roughness: 0.35,
      metalness: 0.5,
    });
    const roofTrimMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.2,
    });
    for (const tc of towerCoords) {
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(tc.w, tc.h, tc.d), towerMat);
      bldg.position.set(tc.x, tc.h / 2 - 2.0, tc.z);
      group.add(bldg);

      const neonCap = new THREE.Mesh(new THREE.BoxGeometry(tc.w + 0.5, 0.9, tc.d + 0.5), roofTrimMat);
      neonCap.position.set(tc.x, tc.h - 2.0, tc.z);
      group.add(neonCap);
    }

    // Overhead Highway Streetlamp Poles along the Tokyo circuit
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfbbf24,
      emissiveIntensity: 3.0,
    });
    for (let i = 0; i < track.samples.length; i += 12) {
      const s = track.samples[i];
      const off = -(BARRIER_OFFSET + 0.6);
      const poleGroup = new THREE.Group();
      poleGroup.position.set(s.x + s.rx * off, s.y, s.z + s.rz * off);
      poleGroup.rotation.y = Math.atan2(s.tx, s.tz);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 8.2, 6), poleMat);
      mast.position.y = 4.1;
      poleGroup.add(mast);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 0.25), poleMat);
      arm.position.set(1.3, 8.1, 0);
      poleGroup.add(arm);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.45), lampGlowMat);
      lamp.position.set(2.2, 7.95, 0);
      poleGroup.add(lamp);
      group.add(poleGroup);
    }
  } else {
    // ALPEN PASS: Carved Swiss Rock Tunnel Gallery + Chalets + Trackside Grandstand
    group.add(buildAlpsRockTunnel(track));

    const gs = buildTracksideGrandstand(0xe8a812);
    gs.position.set(20, groundHeightAt(track, 20, 8) - 0.1, 8);
    gs.rotation.y = Math.PI;
    group.add(gs);

    const chaletCoords = [
      { x: 46, z: 48, rot: -0.9, scale: 1.1 },
      { x: 88, z: 72, rot: -1.4, scale: 1.0 },
      { x: 102, z: -68, rot: 0.6, scale: 1.15 },
      { x: 38, z: -78, rot: 0.2, scale: 0.95 },
      { x: -32, z: 44, rot: 1.2, scale: 1.05 },
    ];
    for (const cc of chaletCoords) {
      const ch = buildSwissChalet(cc.scale);
      ch.position.set(cc.x, groundHeightAt(track, cc.x, cc.z) - 0.35, cc.z);
      ch.rotation.y = cc.rot;
      group.add(ch);
    }
  }

  // =========================================================================
  // 6. INSTANCED FOLIAGE (Riviera Cypresses / Alps Pine Forest) & ROCKS
  // =========================================================================
  if (!isTokyo) {
    const treePositions: Array<{ x: number; y: number; z: number; scale: number; tint: number }> = [];
    const targetCount = isAlps ? 280 : 220;
    for (let i = 0; i < targetCount; i++) {
      const angle = i * 2.39996;
      const rad = 28 + ((i * 37) % 195);
      const tx = 72 + Math.cos(angle) * rad * 1.15;
      const tz = 18 + Math.sin(angle) * rad * 1.15;

      let minRoadDistSq = Infinity;
      for (let s = 0; s < track.samples.length; s += 3) {
        const smp = track.samples[s];
        const d2 = (tx - smp.x) * (tx - smp.x) + (tz - smp.z) * (tz - smp.z);
        if (d2 < minRoadDistSq) minRoadDistSq = d2;
      }
      if (minRoadDistSq < 16.0 * 16.0) continue;
      const ty = groundHeightAt(track, tx, tz);
      if (ty < 0.2 || (isAlps && ty > 34)) continue;

      treePositions.push({
        x: tx,
        y: ty,
        z: tz,
        scale: 0.85 + ((i * 19) % 38) / 100,
        tint: i % 3,
      });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.36, 2.4, 7);
    trunkGeo.translate(0, 1.2, 0);
    const trunkInst = new THREE.InstancedMesh(
      trunkGeo,
      new THREE.MeshStandardMaterial({ color: 0x5c4330, roughness: 0.92 }),
      treePositions.length
    );

    const foliageGeo = isAlps
      ? new THREE.ConeGeometry(2.4, 9.2, 7)
      : new THREE.ConeGeometry(1.55, 8.2, 8);
    foliageGeo.translate(0, 6.2, 0);
    const foliageInst = new THREE.InstancedMesh(
      foliageGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84 }),
      treePositions.length
    );
    foliageInst.castShadow = true;

    const tints = isAlps
      ? [new THREE.Color(0x1f4b32), new THREE.Color(0x285c3a), new THREE.Color(0x193f2b)]
      : [new THREE.Color(0x2f5a34), new THREE.Color(0x3a6a38), new THREE.Color(0x274d2e)];

    treePositions.forEach((tp, idx) => {
      dummy.position.set(tp.x, tp.y - 0.15, tp.z);
      dummy.rotation.set(0, idx * 1.1, 0);
      dummy.scale.set(tp.scale, tp.scale * (0.95 + (idx % 4) * 0.08), tp.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);
      foliageInst.setMatrixAt(idx, dummy.matrix);
      foliageInst.setColorAt(idx, tints[tp.tint]);
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    foliageInst.instanceMatrix.needsUpdate = true;
    if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    foliageInst.computeBoundingSphere();
    group.add(trunkInst, foliageInst);

    // Coastal boulders / Alpine granite outcrops
    const rockCoords: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [];
    for (let i = 0; i < 65; i++) {
      const t = i / 65;
      const rx = -24 + Math.sin(t * 25.1) * 14 + (i % 2 === 0 ? 0 : 210);
      const rz = -150 + t * 340;
      const ry = groundHeightAt(track, rx, rz);
      if (ry < -1.8) continue;
      rockCoords.push({
        x: rx,
        y: ry - 0.25,
        z: rz,
        sx: 2.2 + (i % 5) * 0.9,
        sy: 1.5 + (i % 4) * 0.7,
        sz: 2.0 + (i % 3) * 1.1,
      });
    }
    const rockInst = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1.0, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
      rockCoords.length
    );
    const rockColors = isAlps
      ? [new THREE.Color(0x8c9096), new THREE.Color(0x757a82), new THREE.Color(0x9ca1a8)]
      : [new THREE.Color(0xc2b299), new THREE.Color(0xb39f84), new THREE.Color(0x9f927f)];
    rockCoords.forEach((rc, idx) => {
      dummy.position.set(rc.x, rc.y, rc.z);
      dummy.rotation.set(idx * 0.4, idx * 1.3, idx * 0.2);
      dummy.scale.set(rc.sx, rc.sy, rc.sz);
      dummy.updateMatrix();
      rockInst.setMatrixAt(idx, dummy.matrix);
      rockInst.setColorAt(idx, rockColors[idx % rockColors.length]);
    });
    rockInst.instanceMatrix.needsUpdate = true;
    if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
    rockInst.computeBoundingSphere();
    group.add(rockInst);
  }

  const dispose = () => {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    sfTex.dispose();
  };

  return {
    group,
    countdownLights,
    lighthouseBeacon,
    animatedYachts,
    boostPadMat,
    waterUniforms,
    dispose,
  };
}

// Backwards-compatible alias
export const buildCoastalWorld = buildWorld;
