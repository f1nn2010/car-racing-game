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
      skyTop: 0x050916,
      skyMid: 0x121938,
      skyHorizon: 0x2f254f,
      fogHex: 0x1b1a36,
      fogDensity: 0.00145,
      sunColor: 0xffb38a,
      sunIntensity: 1.45,
      hemiSky: 0x5c75d4,
      hemiGround: 0x1e182e,
      hemiIntensity: 1.0,
      exposure: 1.15,
    };
  }
  if (trackId === 'alps') {
    return {
      skyTop: 0x17529b,
      skyMid: 0x62a7df,
      skyHorizon: 0xe8dfca,
      fogHex: 0xd0dae6,
      fogDensity: 0.00135,
      sunColor: 0xffdfa3,
      sunIntensity: 2.35,
      hemiSky: 0x9cd2ff,
      hemiGround: 0x5f6e49,
      hemiIntensity: 0.92,
      exposure: 1.08,
    };
  }
  return {
    skyTop: 0x1a68b4,
    skyMid: 0x70b4ea,
    skyHorizon: 0xe8dfd0,
    fogHex: 0xc2daf0,
    fogDensity: 0.00145,
    sunColor: 0xffe4b5,
    sunIntensity: 2.3,
    hemiSky: 0x9cd1ff,
    hemiGround: 0x876c4d,
    hemiIntensity: 0.92,
    exposure: 1.1,
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

function buildGuardrailGeometry(
  track: TrackData,
  offset: number,
  yBottom = 0.25,
  yTop = 0.96,
  uvVRepeat = 0.045
): THREE.BufferGeometry {
  const { samples, totalLength } = track;
  const n = samples.length;
  const positions = new Float32Array((n + 1) * 2 * 3);
  const uvs = new Float32Array((n + 1) * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const dist = i === n ? totalLength : s.s;
    const gx = s.x + s.rx * offset;
    const gz = s.z + s.rz * offset;

    const vi = i * 2;
    positions[vi * 3 + 0] = gx;
    positions[vi * 3 + 1] = s.y + yBottom;
    positions[vi * 3 + 2] = gz;

    positions[(vi + 1) * 3 + 0] = gx;
    positions[(vi + 1) * 3 + 1] = s.y + yTop;
    positions[(vi + 1) * 3 + 2] = gz;

    const uCoord = offset > 0 ? (totalLength - dist) * uvVRepeat : dist * uvVRepeat;
    uvs[vi * 2 + 0] = uCoord;
    uvs[vi * 2 + 1] = 0;
    uvs[(vi + 1) * 2 + 0] = uCoord;
    uvs[(vi + 1) * 2 + 1] = 1;

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
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 360-degree distant mountain/headland/skyline panorama ring so there is NEVER an empty horizon drop!
 */
function buildHorizonPanoramaRing(trackId: TrackId): THREE.Group {
  const ring = new THREE.Group();
  const isTokyo = trackId === 'tokyo';
  const isAlps = trackId === 'alps';

  const segments = 72;
  const baseRadius = 460;

  if (isTokyo) {
    // Distant illuminated Tokyo Bay skyline silhouette ring around the entire horizon
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x161d36,
      emissive: 0x1b2754,
      emissiveIntensity: 0.55,
      roughness: 0.7,
    });
    const inst = new THREE.InstancedMesh(towerGeo, towerMat, segments);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const r = baseRadius + (i % 5) * 18;
      const h = 34 + Math.abs(Math.sin(i * 3.7)) * 78 + (i % 7 === 0 ? 45 : 0);
      const w = 18 + (i % 4) * 7;
      dummy.position.set(70 + Math.cos(a) * r, h / 2 - 4, 25 + Math.sin(a) * r);
      dummy.rotation.set(0, -a, 0);
      dummy.scale.set(w, h, 18);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    ring.add(inst);

    // Starfield & Glowing Moon overhead!
    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.abs(Math.sin(i * 12.9898) * 43758.5) % 1 * Math.PI * 2;
      const phi = 0.2 + (Math.abs(Math.sin(i * 78.233) * 24634.6) % 1) * 1.15;
      const dist = 620;
      starPositions[i * 3 + 0] = 70 + Math.cos(theta) * Math.cos(phi) * dist;
      starPositions[i * 3 + 1] = Math.sin(phi) * dist;
      starPositions[i * 3 + 2] = 25 + Math.sin(theta) * Math.cos(phi) * dist;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xe2ecff, size: 2.6, sizeAttenuation: true });
    ring.add(new THREE.Points(starGeo, starMat));

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(22, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff3cf })
    );
    moon.position.set(240, 260, 480);
    ring.add(moon);
    return ring;
  }

  // Sunlit Riviera Headlands or Majestic Jagged Snow-Capped Alpine Peaks Ring
  const peakCount = 54;
  const peakGeo = new THREE.ConeGeometry(1, 1, 6);
  const peakMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    flatShading: true,
  });
  const peakInst = new THREE.InstancedMesh(peakGeo, peakMat, peakCount);
  const snowInst = isAlps
    ? new THREE.InstancedMesh(
        new THREE.ConeGeometry(0.48, 0.44, 6),
        new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.72, flatShading: true }),
        peakCount
      )
    : null;

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < peakCount; i++) {
    const a = (i / peakCount) * Math.PI * 2;
    // On Riviera keep western open ocean gap so you see open sea horizon!
    if (!isAlps && Math.cos(a) < -0.35) {
      dummy.position.set(0, -200, 0);
      dummy.scale.setScalar(0.01);
      dummy.updateMatrix();
      peakInst.setMatrixAt(i, dummy.matrix);
      continue;
    }

    const r = baseRadius - 40 + (i % 4) * 32;
    const h = isAlps
      ? 110 + Math.abs(Math.sin(i * 2.9)) * 130
      : 55 + Math.abs(Math.sin(i * 2.4)) * 68;
    const w = isAlps ? 82 + (i % 5) * 18 : 95 + (i % 4) * 24;
    const px = 70 + Math.cos(a) * r;
    const pz = 25 + Math.sin(a) * r;

    dummy.position.set(px, h * 0.42 - 8, pz);
    dummy.rotation.set(0, i * 0.7, 0);
    dummy.scale.set(w, h, w * 0.85);
    dummy.updateMatrix();
    peakInst.setMatrixAt(i, dummy.matrix);

    col.setHex(
      isAlps
        ? i % 2 === 0
          ? 0x6f7f91
          : 0x5c6d7f
        : i % 2 === 0
          ? 0x748f6e
          : 0x879976
    );
    peakInst.setColorAt(i, col);

    if (snowInst) {
      dummy.position.set(px, h * 0.42 - 8 + h * 0.29, pz);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.set(w * 1.02, h * 1.02, w * 0.87);
      dummy.updateMatrix();
      snowInst.setMatrixAt(i, dummy.matrix);
    }
  }
  peakInst.instanceMatrix.needsUpdate = true;
  if (peakInst.instanceColor) peakInst.instanceColor.needsUpdate = true;
  ring.add(peakInst);
  if (snowInst) {
    snowInst.instanceMatrix.needsUpdate = true;
    ring.add(snowInst);
  }

  // Soft Volumetric Layered Sky Clouds (Riviera & Alps)
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xfffaf2,
    roughness: 0.95,
    metalness: 0,
    emissive: 0xffe8cc,
    emissiveIntensity: 0.16,
  });
  const puffGeo = new THREE.DodecahedronGeometry(1, 1);
  const cloudInst = new THREE.InstancedMesh(puffGeo, cloudMat, 60);
  let ci = 0;
  for (let c = 0; c < 12; c++) {
    const angle = (c / 12) * Math.PI * 2 + 0.2;
    const dist = 260 + (c % 3) * 85;
    const cx = 70 + Math.cos(angle) * dist;
    const cy = 115 + (c % 4) * 18;
    const cz = 25 + Math.sin(angle) * dist;
    for (let p = 0; p < 5 && ci < 60; p++) {
      const ox = (p - 2) * 14;
      const oy = p === 2 ? 6 : p === 1 || p === 3 ? 3 : 0;
      const oz = ((p % 2) - 0.5) * 9;
      const sx = p === 2 ? 22 : 16;
      const sy = p === 2 ? 10 : 7.5;
      dummy.position.set(cx + ox, cy + oy, cz + oz);
      dummy.rotation.set(0, c * 0.5, 0);
      dummy.scale.set(sx, sy, 12);
      dummy.updateMatrix();
      cloudInst.setMatrixAt(ci++, dummy.matrix);
    }
  }
  cloudInst.instanceMatrix.needsUpdate = true;
  ring.add(cloudInst);

  return ring;
}

function buildCoastalLighthouse(): { group: THREE.Group; beacon: THREE.Group } {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.75 });
  const redBandMat = new THREE.MeshStandardMaterial({ color: 0xd12c26, roughness: 0.52 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x9b8e7a, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e2836, roughness: 0.42, metalness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfff3cc,
    emissive: 0xffd27a,
    emissiveIntensity: 2.0,
    roughness: 0.15,
  });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.8, 4.5, 14), baseMat);
  plinth.position.y = 2.25;
  group.add(plinth);

  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.5, 8.5, 16), stoneMat);
  seg1.position.y = 8.5;
  group.add(seg1);

  const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.6, 5.5, 16), redBandMat);
  seg2.position.y = 15.5;
  group.add(seg2);

  const seg3 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, 6.0, 16), stoneMat);
  seg3.position.y = 21.2;
  group.add(seg3);

  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 2.8, 1.3, 16), roofMat);
  gallery.position.y = 24.8;
  group.add(gallery);

  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 3.4, 14), glassMat);
  lantern.position.y = 27.1;
  group.add(lantern);

  const dome = new THREE.Mesh(new THREE.ConeGeometry(2.7, 3.6, 14), roofMat);
  dome.position.y = 30.4;
  group.add(dome);

  const beacon = new THREE.Group();
  beacon.position.y = 27.1;
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe4a0,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (const dir of [-1, 1]) {
    const beamGeo = new THREE.ConeGeometry(2.6, 24, 10, 1, true);
    beamGeo.rotateX(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    beamGeo.translate(0, 0, dir * 12);
    beacon.add(new THREE.Mesh(beamGeo, beamMat));
  }
  group.add(beacon);

  const cottage = new THREE.Mesh(new THREE.BoxGeometry(7.8, 4.6, 5.8), stoneMat);
  cottage.position.set(6.8, 2.3, 1.5);
  group.add(cottage);

  const cottageRoof = new THREE.Mesh(new THREE.ConeGeometry(6.0, 2.4, 4), redBandMat);
  cottageRoof.position.set(6.8, 5.8, 1.5);
  cottageRoof.rotation.y = Math.PI / 4;
  group.add(cottageRoof);

  return { group, beacon };
}

function buildSailingYacht(): THREE.Group {
  const yacht = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf8f6f0, roughness: 0.28 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x1e4d7a, roughness: 0.5 });
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xfffaf0,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xd0d6de, metalness: 0.7, roughness: 0.3 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.3, 11.2), hullMat);
  hull.position.y = 0.5;
  yacht.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.3, 4.4, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(0.85, 1, 0.42);
  bow.position.set(0, 0.6, 7.2);
  yacht.add(bow);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 4.6), deckMat);
  cabin.position.set(0, 1.5, -0.8);
  yacht.add(cabin);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 12.2, 8), mastMat);
  mast.position.set(0, 6.8, 0.6);
  yacht.add(mast);

  const mainSailShape = new THREE.Shape();
  mainSailShape.moveTo(0, 0);
  mainSailShape.lineTo(5.6, 0);
  mainSailShape.lineTo(0, 10.6);
  mainSailShape.closePath();
  const mainSail = new THREE.Mesh(new THREE.ShapeGeometry(mainSailShape), sailMat);
  mainSail.rotation.y = Math.PI / 2;
  mainSail.position.set(0, 2.2, 0.4);
  yacht.add(mainSail);

  return yacht;
}

function buildTracksideGrandstand(accentHex: number): THREE.Group {
  const stand = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xccd2da, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.5 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x202836, metalness: 0.65, roughness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.4 });
  const seatColors = [0xd92626, 0xf4efe2, 0x1e40af, 0xf59e0b];

  const base = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.8, 36), concreteMat);
  base.position.set(0, 0.9, 0);
  stand.add(base);

  for (let t = 0; t < 4; t++) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.0, 35.2), concreteMat);
    tier.position.set(3.8 - t * 2.2, 2.2 + t * 1.1, 0);
    stand.add(tier);

    const seats = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.55, 34.4),
      new THREE.MeshStandardMaterial({ color: seatColors[t % seatColors.length], roughness: 0.6 })
    );
    seats.position.set(3.2 - t * 2.2, 2.9 + t * 1.1, 0);
    stand.add(seats);
  }

  for (let z = -15; z <= 15; z += 10) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.4, 0.5), steelMat);
    col.position.set(-4.6, 5.2, z);
    stand.add(col);
  }

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.45, 37.5), roofMat);
  canopy.position.set(0.2, 10.1, 0);
  canopy.rotation.z = -0.14;
  stand.add(canopy);

  const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.15, 37.5), accentMat);
  fascia.position.set(6.2, 9.25, 0);
  stand.add(fascia);

  return stand;
}

function buildMediterraneanVilla(scale = 1.0): THREE.Group {
  const villa = new THREE.Group();
  const stuccoColors = [0xf2dec2, 0xe8c7a3, 0xf5ead8, 0xe9b894];
  const stuccoHex = stuccoColors[Math.floor((scale * 100) % stuccoColors.length)];
  const stuccoMat = new THREE.MeshStandardMaterial({ color: stuccoHex, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb95031, roughness: 0.78 });
  const shutterMat = new THREE.MeshStandardMaterial({ color: 0x2a5440, roughness: 0.65 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x2a3b52,
    emissive: 0xffd27a,
    emissiveIntensity: 0.25,
    roughness: 0.2,
  });

  const main = new THREE.Mesh(new THREE.BoxGeometry(10.5, 6.8, 8.2), stuccoMat);
  main.position.y = 3.4;
  villa.add(main);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(8.1, 2.9, 4), roofMat);
  roof.position.y = 8.2;
  roof.rotation.y = Math.PI / 4;
  villa.add(roof);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.6, 6.2), stuccoMat);
  wing.position.set(7.4, 2.3, 0.8);
  villa.add(wing);

  const wingRoof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.0, 4), roofMat);
  wingRoof.position.set(7.4, 5.5, 0.8);
  wingRoof.rotation.y = Math.PI / 4;
  villa.add(wingRoof);

  for (const wx of [-3.0, 0, 3.0]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.8, 0.2), windowMat);
    win.position.set(wx, 4.4, 4.12);
    villa.add(win);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 0.14), shutterMat);
    frame.position.set(wx, 4.4, 4.08);
    villa.add(frame);
  }

  villa.scale.setScalar(scale);
  return villa;
}

function buildSwissChalet(scale = 1.0): THREE.Group {
  const chalet = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x6a4326, roughness: 0.86 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.9 });
  const snowRoofMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fc, roughness: 0.65 });
  const warmWinMat = new THREE.MeshStandardMaterial({
    color: 0xffe4a0,
    emissive: 0xffb347,
    emissiveIntensity: 1.05,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(10.5, 2.8, 8.6), stoneMat);
  base.position.y = 1.4;
  chalet.add(base);

  const upper = new THREE.Mesh(new THREE.BoxGeometry(10.2, 4.4, 8.2), timberMat);
  upper.position.y = 5.0;
  chalet.add(upper);

  const roofL = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, 10.6), snowRoofMat);
  roofL.position.set(-2.9, 8.3, 0);
  roofL.rotation.z = 0.44;
  chalet.add(roofL);

  const roofR = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, 10.6), snowRoofMat);
  roofR.position.set(2.9, 8.3, 0);
  roofR.rotation.z = -0.44;
  chalet.add(roofR);

  for (const wx of [-2.8, 0, 2.8]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 0.2), warmWinMat);
    win.position.set(wx, 4.8, 4.15);
    chalet.add(win);
  }

  chalet.scale.setScalar(scale);
  return chalet;
}

function buildTokyoSuspensionBridge(track: TrackData): THREE.Group {
  const bridge = new THREE.Group();
  const towerRedMat = new THREE.MeshStandardMaterial({
    color: 0xe02828,
    emissive: 0x550808,
    emissiveIntensity: 0.45,
    roughness: 0.36,
    metalness: 0.55,
  });
  const towerWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf0f4fa,
    emissive: 0x1e293b,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.45,
  });
  const cableGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.75,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff3b3b,
    emissive: 0xff2222,
    emissiveIntensity: 3.4,
  });

  const spanHalf = ROAD_HALF_WIDTH + CURB_WIDTH + 2.4;
  const towerZs = [72, 152];
  const towerTopY = 46;

  for (const tz of towerZs) {
    for (const side of [-1, 1]) {
      const legLower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 26, 3.0), towerWhiteMat);
      legLower.position.set(side * spanHalf, 12, tz);
      bridge.add(legLower);

      const legUpper = new THREE.Mesh(new THREE.BoxGeometry(2.2, 24, 2.6), towerRedMat);
      legUpper.position.set(side * spanHalf, 35, tz);
      bridge.add(legUpper);

      const topLight = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 10), beaconMat);
      topLight.position.set(side * spanHalf, towerTopY + 1.8, tz);
      bridge.add(topLight);
    }

    for (const cy of [18, 31, 43]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(spanHalf * 2 + 2.6, 1.9, 2.1), towerRedMat);
      beam.position.set(0, cy, tz);
      bridge.add(beam);
    }
  }

  const anchorConcreteMat = new THREE.MeshStandardMaterial({ color: 0x2c3648, roughness: 0.78 });
  for (const side of [-1, 1]) {
    const sx = side * spanHalf;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 2.2, 16),
      new THREE.Vector3(sx, towerTopY, 72),
      new THREE.Vector3(sx, 17.5, 112),
      new THREE.Vector3(sx, towerTopY, 152),
      new THREE.Vector3(sx, 2.6, 206),
    ]);
    bridge.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 52, 0.38, 8, false), cableGlowMat));

    // Solid concrete cable anchor abutments at both ends so cables never float in mid-air
    for (const az of [16, 206]) {
      const anchor = new THREE.Mesh(new THREE.BoxGeometry(3.2, 10, 5.2), anchorConcreteMat);
      anchor.position.set(sx, -1.6, az);
      bridge.add(anchor);
    }

    // Vertical suspender hanger cables
    for (let z = 30; z <= 194; z += 10) {
      if (Math.abs(z - 72) < 5 || Math.abs(z - 152) < 5) continue;
      const tNorm = (z - 16) / 190;
      const pt = curve.getPoint(Math.max(0.02, Math.min(0.98, tNorm)));
      const deckY = 1.6;
      const h = Math.max(2, pt.y - deckY);
      const hanger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, h, 5),
        towerWhiteMat
      );
      hanger.position.set(sx, deckY + h / 2, z);
      bridge.add(hanger);
    }
  }

  // Viaduct concrete support piers cleanly underneath elevated Tokyo Bay highway deck
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x353f50, roughness: 0.82 });
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

function buildAlpsRockTunnel(track: TrackData, stoneWallMap: THREE.CanvasTexture): THREE.Group {
  const tunnel = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xd0d4dc,
    map: stoneWallMap,
    roughness: 0.9,
  });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffe4a3,
    emissive: 0xffb347,
    emissiveIntensity: 3.0,
  });

  const spanHalf = ROAD_HALF_WIDTH + CURB_WIDTH + 1.4;
  for (let idx = 120; idx <= 165; idx += 5) {
    const s = track.samples[idx % track.samples.length];
    const arch = new THREE.Group();
    arch.position.set(s.x, s.y, s.z);
    arch.rotation.y = Math.atan2(s.tx, s.tz);

    const wallR = new THREE.Mesh(new THREE.BoxGeometry(2.4, 8.4, 8.0), stoneMat);
    wallR.position.set(spanHalf, 4.2, 0);
    arch.add(wallR);

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1.7, 8.4, 2.2), stoneMat);
    pillarL.position.set(-spanHalf, 4.2, 0);
    arch.add(pillarL);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(spanHalf * 2 + 3.4, 2.2, 8.2), stoneMat);
    roof.position.set(0, 8.8, 0);
    arch.add(roof);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.25, 0.85), lightMat);
    lamp.position.set(0, 7.6, 0);
    arch.add(lamp);

    tunnel.add(arch);
  }
  return tunnel;
}

function buildOverheadSectorBridge(
  track: TrackData,
  frac: number,
  isTokyo: boolean,
  textures: ProceduralTextureSet
): THREE.Group {
  const s = getSampleAtDistance(track, track.totalLength * frac);
  const g = new THREE.Group();
  g.position.set(s.x, s.y, s.z);
  g.rotation.y = Math.atan2(s.tx, s.tz);

  const spanHalf = ROAD_HALF_WIDTH + CURB_WIDTH + 1.2;
  const steelMat = new THREE.MeshStandardMaterial({
    color: isTokyo ? 0x2c384f : 0x2a3140,
    metalness: 0.65,
    roughness: 0.38,
  });

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8.4, 1.0), steelMat);
    leg.position.set(side * spanHalf, 4.2, 0);
    g.add(leg);
  }

  const signMap = isTokyo ? textures.highwaySignMap : textures.adBoardMap;
  const signMat = isTokyo
    ? new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: signMap,
        emissive: 0x22c55e,
        emissiveMap: signMap,
        emissiveIntensity: 0.55,
        roughness: 0.4,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: signMap,
        roughness: 0.45,
      });

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(spanHalf * 2 + 1.6, isTokyo ? 2.5 : 2.1, 0.9),
    [steelMat, steelMat, steelMat, steelMat, signMat, signMat]
  );
  deck.position.set(0, 7.6, 0);
  g.add(deck);

  return g;
}

export function buildWorld(
  track: TrackData,
  textures: ProceduralTextureSet
): WorldHandles {
  const group = new THREE.Group();
  const isTokyo = track.id === 'tokyo';
  const isAlps = track.id === 'alps';
  let lighthouseBeacon: THREE.Group | null = null;
  const animatedYachts: THREE.Group[] = [];

  // =========================================================================
  // 0. 360-DEGREE MAJESTIC HORIZON PANORAMA RING + CLOUDS / STARS
  // =========================================================================
  group.add(buildHorizonPanoramaRing(track.id));

  // =========================================================================
  // 1. ROAD RIBBON, SHOULDERS, CURBS, GUARDRAILS, AD BOARDS & TIRE BARRIERS
  // =========================================================================
  const roadGeo = buildRibbonGeometry(track, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, 0.0, 0.085);
  const roadMat = new THREE.MeshStandardMaterial({
    color: isTokyo ? 0x626b7c : 0xffffff,
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.032,
    roughness: isTokyo ? 0.72 : 0.76,
    metalness: isTokyo ? 0.08 : 0.05,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Outer gravel / asphalt shoulder apron flanking curbs so track blends naturally into terrain!
  const apronMat = new THREE.MeshStandardMaterial({
    color: isTokyo ? 0x242c3d : isAlps ? 0x6c7276 : 0xb5a88f,
    roughness: 0.92,
  });
  const leftApron = new THREE.Mesh(
    buildRibbonGeometry(track, -(BARRIER_OFFSET + 1.6), -(ROAD_HALF_WIDTH + CURB_WIDTH), -0.04, 0.1),
    apronMat
  );
  const rightApron = new THREE.Mesh(
    buildRibbonGeometry(track, ROAD_HALF_WIDTH + CURB_WIDTH, BARRIER_OFFSET + 1.6, -0.04, 0.1),
    apronMat
  );
  group.add(leftApron, rightApron);

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.curbMap,
    roughness: 0.62,
    metalness: 0.04,
  });
  const leftCurb = new THREE.Mesh(
    buildRibbonGeometry(track, -(ROAD_HALF_WIDTH + CURB_WIDTH), -ROAD_HALF_WIDTH, 0.028, 0.22),
    curbMat
  );
  const rightCurb = new THREE.Mesh(
    buildRibbonGeometry(track, ROAD_HALF_WIDTH, ROAD_HALF_WIDTH + CURB_WIDTH, 0.028, 0.22),
    curbMat
  );
  leftCurb.receiveShadow = true;
  rightCurb.receiveShadow = true;
  group.add(leftCurb, rightCurb);

  // Guardrails with crisp motorsport sponsor walls on Riviera/Alps & illuminated blue expressway rails on Tokyo!
  const railMat = isTokyo
    ? new THREE.MeshStandardMaterial({
        color: 0x253350,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.28,
        roughness: 0.45,
        metalness: 0.5,
        side: THREE.DoubleSide,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.adBoardMap,
        roughness: 0.58,
        metalness: 0.18,
        side: THREE.DoubleSide,
      });

  group.add(
    new THREE.Mesh(buildGuardrailGeometry(track, -BARRIER_OFFSET - 0.32, 0.05, 1.02, 0.028), railMat),
    new THREE.Mesh(buildGuardrailGeometry(track, BARRIER_OFFSET + 0.32, 0.05, 1.02, 0.028), railMat)
  );

  // Instanced Guardrail Posts
  const dummy = new THREE.Object3D();
  const postCount = Math.floor(track.samples.length / 4) * 2;
  const postGeo = new THREE.BoxGeometry(0.16, 1.06, 0.16);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x505966, roughness: 0.6, metalness: 0.5 });
  const postInst = new THREE.InstancedMesh(postGeo, postMat, postCount);
  let pIdx = 0;
  for (let i = 0; i < track.samples.length && pIdx < postCount - 1; i += 4) {
    const s = track.samples[i];
    for (const side of [-1, 1]) {
      const off = side * (BARRIER_OFFSET + 0.44);
      dummy.position.set(s.x + s.rx * off, s.y + 0.5, s.z + s.rz * off);
      dummy.rotation.set(0, Math.atan2(s.tx, s.tz), 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postInst.setMatrixAt(pIdx++, dummy.matrix);
    }
  }
  postInst.instanceMatrix.needsUpdate = true;
  postInst.computeBoundingSphere();
  group.add(postInst);

  // Stacked Red & White FIA Tire Barriers at Sharp Corners!
  if (track.cornerChevrons.length > 0) {
    const tireGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.92, 10);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 });
    const tireInst = new THREE.InstancedMesh(tireGeo, tireMat, track.cornerChevrons.length * 2);
    const redC = new THREE.Color(0xd92626);
    const whiteC = new THREE.Color(0xf4efe2);
    let ti = 0;
    track.cornerChevrons.forEach((ch, idx) => {
      for (const offsetAlong of [-0.55, 0.55]) {
        dummy.position.set(
          ch.x + Math.sin(ch.heading) * offsetAlong,
          ch.y + 0.46,
          ch.z + Math.cos(ch.heading) * offsetAlong
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        tireInst.setMatrixAt(ti, dummy.matrix);
        tireInst.setColorAt(ti, (idx + ti) % 2 === 0 ? redC : whiteC);
        ti++;
      }
    });
    tireInst.instanceMatrix.needsUpdate = true;
    if (tireInst.instanceColor) tireInst.instanceColor.needsUpdate = true;
    tireInst.computeBoundingSphere();
    group.add(tireInst);

    // High-Visibility Corner Direction Chevron Signboards above tire stacks!
    const signGeo = new THREE.BoxGeometry(2.7, 1.35, 0.18);
    const signMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.chevronMap,
      emissive: isTokyo ? 0xf472b6 : 0xf5b700,
      emissiveMap: textures.chevronMap,
      emissiveIntensity: isTokyo ? 1.5 : 0.48,
      roughness: 0.35,
    });
    const signInst = new THREE.InstancedMesh(signGeo, signMat, track.cornerChevrons.length);
    track.cornerChevrons.forEach((ch, idx) => {
      dummy.position.set(ch.x, ch.y + 1.85, ch.z);
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
  // 2. TEXTURED CONTINUOUS BIOME TERRAIN & SHIMMERING WATER
  // =========================================================================
  const terrainSize = 840;
  const terrainSegs = 104;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(70, 0, 25);

  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const tmpColor = new THREE.Color();

  const c1 = new THREE.Color(isTokyo ? 0x182034 : isAlps ? 0x3b6930 : 0xdec89c);
  const c2 = new THREE.Color(isTokyo ? 0x26314a : isAlps ? 0x5c6e55 : 0x628243);
  const c3 = new THREE.Color(isTokyo ? 0x35425e : isAlps ? 0x7d848c : 0xa68960);
  const c4 = new THREE.Color(isTokyo ? 0x414e6b : isAlps ? 0xf4f8ff : 0xc6b499);

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const h = groundHeightAt(track, vx, vz);
    posAttr.setY(i, h);

    if (isAlps) {
      if (h < 10) tmpColor.copy(c1).lerp(c2, Math.max(0, h / 10));
      else if (h < 22) tmpColor.copy(c2).lerp(c3, (h - 10) / 12);
      else tmpColor.copy(c3).lerp(c4, Math.min(1, (h - 22) / 12));
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

  // Textured terrain using terrainDetailMap multiplied by vertex colors -> zero flat plastic look!
  const terrainMesh = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: textures.terrainDetailMap,
      roughness: 0.9,
      metalness: 0.02,
    })
  );
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Shimmering Water Plane (Mediterranean turquoise / Tokyo Bay midnight)
  const waterUniforms = { uTime: { value: 0 } };
  if (!isAlps) {
    const waterGeo = new THREE.PlaneGeometry(2000, 2000, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: isTokyo ? 0x071834 : 0x097ca6,
      roughness: isTokyo ? 0.12 : 0.14,
      metalness: isTokyo ? 0.42 : 0.28,
      bumpMap: textures.waterBump,
      bumpScale: 0.14,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(-40, -1.65, 20);
    group.add(waterMesh);
  }

  // =========================================================================
  // 3. START / FINISH GANTRY ARCH + 2 OVERHEAD SECTOR BRIDGES
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

  // Two Overhead Sector Bridges / Japanese Expressway Gantry Signs!
  group.add(buildOverheadSectorBridge(track, 0.36, isTokyo, textures));
  group.add(buildOverheadSectorBridge(track, 0.72, isTokyo, textures));

  // =========================================================================
  // 4. BOOST PADS & 3D ARCADE JUMP RAMPS
  // =========================================================================
  const boostPadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.boostPadMap,
    emissive: 0x38bdf8,
    emissiveMap: textures.boostPadMap,
    emissiveIntensity: 1.25,
    roughness: 0.32,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const padGeo = new THREE.PlaneGeometry(4.2, 8.8);
  padGeo.rotateX(-Math.PI / 2);

  for (const pad of track.boostPads) {
    const mesh = new THREE.Mesh(padGeo, boostPadMat);
    mesh.position.set(pad.x, pad.y + 0.04, pad.z);
    mesh.rotation.y = pad.heading;
    group.add(mesh);
  }

  const rampSideMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });
  const rampDeckMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.boostPadMap,
    emissive: 0xf59e0b,
    emissiveMap: textures.boostPadMap,
    emissiveIntensity: 1.3,
    roughness: 0.35,
  });
  const rampGlowEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.5,
  });

  for (const ramp of track.jumpRamps) {
    const rGroup = new THREE.Group();
    rGroup.position.set(ramp.x, ramp.y, ramp.z);
    rGroup.rotation.y = ramp.heading;

    const rShape = new THREE.Shape();
    rShape.moveTo(-ramp.length * 0.5, 0);
    rShape.lineTo(ramp.length * 0.5, 0);
    rShape.lineTo(ramp.length * 0.5, 1.55);
    rShape.closePath();

    const wedgeGeo = new THREE.ExtrudeGeometry(rShape, { depth: ramp.width, bevelEnabled: false });
    wedgeGeo.translate(0, 0, -ramp.width * 0.5);
    wedgeGeo.rotateY(-Math.PI / 2);
    wedgeGeo.computeVertexNormals();
    rGroup.add(new THREE.Mesh(wedgeGeo, rampSideMat));

    const slopeLen = Math.hypot(ramp.length, 1.55);
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(ramp.width - 0.25, slopeLen), rampDeckMat);
    deck.rotation.x = -Math.PI / 2 + Math.atan2(1.55, ramp.length);
    deck.position.set(0, 0.81, 0);
    rGroup.add(deck);

    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, slopeLen), rampGlowEdgeMat);
      rail.rotation.x = Math.atan2(1.55, ramp.length);
      rail.position.set(side * (ramp.width * 0.5 - 0.08), 0.85, 0);
      rGroup.add(rail);
    }

    group.add(rGroup);
  }

  // =========================================================================
  // 5. MAP-SPECIFIC HERO LANDMARKS, ARCHITECTURE & MULTI-TIER FORESTS
  // =========================================================================
  if (track.id === 'riviera') {
    const lh = buildCoastalLighthouse();
    const lhX = 24;
    const lhZ = 205;
    lh.group.position.set(lhX, groundHeightAt(track, lhX, lhZ) - 0.3, lhZ);
    group.add(lh.group);
    lighthouseBeacon = lh.beacon;

    const gs = buildTracksideGrandstand(0xd92626);
    gs.position.set(19, groundHeightAt(track, 19, 12) - 0.1, 12);
    gs.rotation.y = Math.PI;
    group.add(gs);

    const gs2 = buildTracksideGrandstand(0x0ea5e9);
    gs2.position.set(19, groundHeightAt(track, 19, 64) - 0.1, 64);
    gs2.rotation.y = Math.PI;
    group.add(gs2);

    const yachtCoords = [
      { x: -54, z: 45, rot: 0.4 },
      { x: -86, z: 118, rot: -0.6 },
      { x: -68, z: -48, rot: 0.9 },
      { x: -115, z: 12, rot: -0.2 },
      { x: -45, z: 155, rot: 0.7 },
    ];
    for (const yc of yachtCoords) {
      const y = buildSailingYacht();
      y.position.set(yc.x, -1.55, yc.z);
      y.rotation.y = yc.rot;
      group.add(y);
      animatedYachts.push(y);
    }

    const villaCoords = [
      { x: 58, z: 68, rot: -0.6, scale: 1.15 },
      { x: 86, z: 102, rot: -1.1, scale: 1.0 },
      { x: 192, z: 112, rot: -1.9, scale: 1.2 },
      { x: 164, z: -28, rot: -2.2, scale: 1.05 },
      { x: 66, z: -86, rot: 0.4, scale: 1.1 },
      { x: 42, z: 26, rot: -1.5, scale: 1.0 },
      { x: 74, z: 138, rot: -0.8, scale: 1.1 },
      { x: 145, z: 192, rot: -2.5, scale: 1.15 },
    ];
    for (const vc of villaCoords) {
      const v = buildMediterraneanVilla(vc.scale);
      v.position.set(vc.x, groundHeightAt(track, vc.x, vc.z) - 0.35, vc.z);
      v.rotation.y = vc.rot;
      group.add(v);
    }
  } else if (track.id === 'tokyo') {
    group.add(buildTokyoSuspensionBridge(track));

    // Dense Multi-Depth Tokyo Bay Skyscraper Cityscape (26 unique towers with glowing neon crowns!)
    const towerCoords = [
      { x: 58, z: 130, w: 18, h: 72, d: 18 },
      { x: 82, z: 82, w: 24, h: 98, d: 22 },
      { x: 64, z: 26, w: 16, h: 62, d: 18 },
      { x: 92, z: -30, w: 24, h: 88, d: 22 },
      { x: 58, z: -84, w: 18, h: 64, d: 18 },
      { x: 120, z: 168, w: 20, h: 78, d: 20 },
      { x: 226, z: 156, w: 24, h: 102, d: 24 },
      { x: 232, z: 86, w: 20, h: 82, d: 22 },
      { x: 228, z: -12, w: 26, h: 112, d: 24 },
      { x: 215, z: -86, w: 20, h: 76, d: 20 },
      { x: -64, z: 168, w: 22, h: 84, d: 22 },
      { x: -68, z: 96, w: 20, h: 76, d: 20 },
      { x: -62, z: 18, w: 22, h: 88, d: 22 },
      { x: -72, z: -64, w: 20, h: 70, d: 20 },
      { x: -112, z: 140, w: 26, h: 108, d: 24 },
      { x: -108, z: 45, w: 24, h: 94, d: 22 },
      { x: 48, z: 288, w: 26, h: 98, d: 24 },
      { x: 118, z: 292, w: 22, h: 82, d: 22 },
      { x: 178, z: 262, w: 24, h: 92, d: 22 },
      { x: 105, z: 48, w: 18, h: 68, d: 18 },
      { x: 95, z: -188, w: 24, h: 86, d: 22 },
      { x: 28, z: -198, w: 20, h: 74, d: 20 },
    ];
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.skyscraperMap,
      emissive: 0xffffff,
      emissiveMap: textures.skyscraperMap,
      emissiveIntensity: 0.78,
      roughness: 0.35,
      metalness: 0.5,
    });
    const roofCyan = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.4,
    });
    const roofPink = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xf472b6,
      emissiveIntensity: 2.2,
    });
    const roofGold = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 2.2,
    });
    const capMats = [roofCyan, roofPink, roofGold];

    towerCoords.forEach((tc, idx) => {
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(tc.w, tc.h, tc.d), towerMat);
      bldg.position.set(tc.x, tc.h / 2 - 2.0, tc.z);
      group.add(bldg);

      const capMat = capMats[idx % capMats.length];
      const neonCap = new THREE.Mesh(new THREE.BoxGeometry(tc.w + 0.6, 1.0, tc.d + 0.6), capMat);
      neonCap.position.set(tc.x, tc.h - 2.0, tc.z);
      group.add(neonCap);

      // Spire antenna on tall skyscrapers
      if (tc.h > 85) {
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 16, 6), capMat);
        spire.position.set(tc.x, tc.h + 6.0, tc.z);
        group.add(spire);
      }
    });

    // Dual-Side Warm Amber Highway Streetlamps along the Tokyo expressway!
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfbbf24,
      emissiveIntensity: 3.4,
    });
    for (let i = 0; i < track.samples.length; i += 10) {
      const s = track.samples[i];
      const side = (i / 10) % 2 === 0 ? -1 : 1;
      const off = side * (BARRIER_OFFSET + 0.7);
      const poleGroup = new THREE.Group();
      poleGroup.position.set(s.x + s.rx * off, s.y, s.z + s.rz * off);
      poleGroup.rotation.y = Math.atan2(s.tx, s.tz);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 8.4, 6), poleMat);
      mast.position.y = 4.2;
      poleGroup.add(mast);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 0.24), poleMat);
      arm.position.set(-side * 1.3, 8.25, 0);
      poleGroup.add(arm);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 0.48), lampGlowMat);
      lamp.position.set(-side * 2.2, 8.1, 0);
      poleGroup.add(lamp);
      group.add(poleGroup);
    }
  } else {
    // ALPEN PASS: Carved Stone Avalanche-Gallery Tunnel + Grandstand + Swiss Timber Chalets
    group.add(buildAlpsRockTunnel(track, textures.stoneWallMap));

    const gs = buildTracksideGrandstand(0xe8a812);
    gs.position.set(20, groundHeightAt(track, 20, 10) - 0.1, 10);
    gs.rotation.y = Math.PI;
    group.add(gs);

    const chaletCoords = [
      { x: 46, z: 48, rot: -0.9, scale: 1.15 },
      { x: 88, z: 72, rot: -1.4, scale: 1.05 },
      { x: 102, z: -68, rot: 0.6, scale: 1.2 },
      { x: 38, z: -78, rot: 0.2, scale: 1.0 },
      { x: -32, z: 44, rot: 1.2, scale: 1.1 },
      { x: -28, z: -18, rot: 1.5, scale: 1.0 },
      { x: 74, z: 120, rot: -0.6, scale: 1.1 },
    ];
    for (const cc of chaletCoords) {
      const ch = buildSwissChalet(cc.scale);
      ch.position.set(cc.x, groundHeightAt(track, cc.x, cc.z) - 0.35, cc.z);
      ch.rotation.y = cc.rot;
      group.add(ch);
    }
  }

  // =========================================================================
  // 6. MULTI-TIER SCULPTED TREES & LAYERED CLIFF OUTCROPS (Riviera & Alps)
  // =========================================================================
  if (!isTokyo) {
    const treeCoords: Array<{ x: number; y: number; z: number; scale: number; isWide: boolean }> = [];
    const maxTrees = 240;
    for (let i = 0; i < maxTrees * 2 && treeCoords.length < maxTrees; i++) {
      const a = i * 2.39996;
      const rad = 18 + Math.sqrt(i) * 14.2;
      const tx = 75 + Math.cos(a) * rad;
      const tz = 15 + Math.sin(a) * rad;

      if (!isAlps && tx < -16) continue;
      let tooClose = false;
      for (let k = 0; k < track.samples.length; k += 4) {
        const s = track.samples[k];
        const dx = tx - s.x;
        const dz = tz - s.z;
        if (dx * dx + dz * dz < 16.5 * 16.5) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      const ty = groundHeightAt(track, tx, tz);
      if (ty < 0.2 || (isAlps && ty > 36)) continue;

      treeCoords.push({
        x: tx,
        y: ty - 0.15,
        z: tz,
        scale: 0.85 + (i % 6) * 0.16,
        isWide: !isAlps && i % 2 === 0,
      });
    }

    const trunkInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.22, 0.38, 3.2, 7),
      new THREE.MeshStandardMaterial({ color: 0x5c3e26, roughness: 0.92 }),
      treeCoords.length
    );

    // 3-Tier Layered Foliage InstancedMeshes (ZERO cheap single-cone trees!)
    const tier1Geo = isAlps
      ? new THREE.ConeGeometry(2.8, 4.4, 7)
      : new THREE.DodecahedronGeometry(2.6, 1);
    const tier2Geo = isAlps
      ? new THREE.ConeGeometry(2.15, 4.0, 7)
      : new THREE.DodecahedronGeometry(2.0, 1);
    const tier3Geo = isAlps
      ? new THREE.ConeGeometry(1.35, 3.2, 7)
      : new THREE.ConeGeometry(1.4, 5.2, 7);

    const tier1Inst = new THREE.InstancedMesh(
      tier1Geo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, flatShading: true }),
      treeCoords.length
    );
    const tier2Inst = new THREE.InstancedMesh(
      tier2Geo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, flatShading: true }),
      treeCoords.length
    );
    const tier3Inst = new THREE.InstancedMesh(
      tier3Geo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }),
      treeCoords.length
    );

    const paletteDark = isAlps
      ? [new THREE.Color(0x1b4228), new THREE.Color(0x214d2f), new THREE.Color(0x163822)]
      : [new THREE.Color(0x2d5b2d), new THREE.Color(0x3a6e34), new THREE.Color(0x254b27)];
    const paletteMid = isAlps
      ? [new THREE.Color(0x275736), new THREE.Color(0x2f643e), new THREE.Color(0x224c2f)]
      : [new THREE.Color(0x477d3b), new THREE.Color(0x528842), new THREE.Color(0x3b6e32)];
    const snowTipColor = new THREE.Color(0xdbe8f4);

    treeCoords.forEach((tc, idx) => {
      const sc = tc.scale;
      // Trunk
      dummy.position.set(tc.x, tc.y + 1.5 * sc, tc.z);
      dummy.rotation.set(0, idx * 0.9, 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      if (isAlps) {
        // 3-Tier Sculpted Alpine Spruce (with snow-dusted crown on high slopes!)
        dummy.position.set(tc.x, tc.y + 3.6 * sc, tc.z);
        dummy.rotation.set(0, idx * 1.1, 0);
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        tier1Inst.setMatrixAt(idx, dummy.matrix);
        tier1Inst.setColorAt(idx, paletteDark[idx % paletteDark.length]);

        dummy.position.set(tc.x, tc.y + 5.7 * sc, tc.z);
        dummy.rotation.set(0, idx * 1.1 + 0.5, 0);
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        tier2Inst.setMatrixAt(idx, dummy.matrix);
        tier2Inst.setColorAt(idx, paletteMid[idx % paletteMid.length]);

        dummy.position.set(tc.x, tc.y + 7.6 * sc, tc.z);
        dummy.rotation.set(0, idx * 1.1 + 1.0, 0);
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        tier3Inst.setMatrixAt(idx, dummy.matrix);
        tier3Inst.setColorAt(idx, tc.y > 11 ? snowTipColor : paletteMid[(idx + 1) % paletteMid.length]);
      } else if (tc.isWide) {
        // Mediterranean Umbrella Stone Pine (wide flattened multi-lobe canopy!)
        dummy.position.set(tc.x, tc.y + 4.4 * sc, tc.z);
        dummy.rotation.set(0, idx * 0.7, 0);
        dummy.scale.set(sc * 1.35, sc * 0.52, sc * 1.25);
        dummy.updateMatrix();
        tier1Inst.setMatrixAt(idx, dummy.matrix);
        tier1Inst.setColorAt(idx, paletteDark[idx % paletteDark.length]);

        dummy.position.set(tc.x + 0.7 * sc, tc.y + 5.1 * sc, tc.z - 0.5 * sc);
        dummy.scale.set(sc * 1.05, sc * 0.48, sc * 1.05);
        dummy.updateMatrix();
        tier2Inst.setMatrixAt(idx, dummy.matrix);
        tier2Inst.setColorAt(idx, paletteMid[idx % paletteMid.length]);

        dummy.position.set(0, -200, 0);
        dummy.scale.setScalar(0.01);
        dummy.updateMatrix();
        tier3Inst.setMatrixAt(idx, dummy.matrix);
        tier3Inst.setColorAt(idx, paletteMid[0]);
      } else {
        // Tall Sculpted Tuscan Cypress
        dummy.position.set(tc.x, tc.y + 3.2 * sc, tc.z);
        dummy.scale.set(sc * 0.45, sc * 0.85, sc * 0.45);
        dummy.updateMatrix();
        tier1Inst.setMatrixAt(idx, dummy.matrix);
        tier1Inst.setColorAt(idx, paletteDark[idx % paletteDark.length]);

        dummy.position.set(0, -200, 0);
        dummy.scale.setScalar(0.01);
        dummy.updateMatrix();
        tier2Inst.setMatrixAt(idx, dummy.matrix);
        tier2Inst.setColorAt(idx, paletteMid[0]);

        dummy.position.set(tc.x, tc.y + 5.6 * sc, tc.z);
        dummy.scale.set(sc * 0.78, sc * 1.25, sc * 0.78);
        dummy.updateMatrix();
        tier3Inst.setMatrixAt(idx, dummy.matrix);
        tier3Inst.setColorAt(idx, paletteMid[idx % paletteMid.length]);
      }
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    tier1Inst.instanceMatrix.needsUpdate = true;
    tier2Inst.instanceMatrix.needsUpdate = true;
    tier3Inst.instanceMatrix.needsUpdate = true;
    if (tier1Inst.instanceColor) tier1Inst.instanceColor.needsUpdate = true;
    if (tier2Inst.instanceColor) tier2Inst.instanceColor.needsUpdate = true;
    if (tier3Inst.instanceColor) tier3Inst.instanceColor.needsUpdate = true;
    group.add(trunkInst, tier1Inst, tier2Inst, tier3Inst);

    // Textured Layered Cliff Rocks (flat-shaded granite / Mediterranean limestone with stoneWallMap!)
    const rockCoords: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [];
    for (let i = 0; i < 65; i++) {
      const t = i / 65;
      const rx = -28 + Math.sin(t * 25.1) * 14 + (i % 2 === 0 ? 0 : 215);
      const rz = -150 + t * 340;
      const ryCenter = groundHeightAt(track, rx, rz);
      if (ryCenter < -1.8 || (isAlps && ryCenter > 15)) continue;
      const ryMin = Math.min(
        ryCenter,
        groundHeightAt(track, rx + 4, rz),
        groundHeightAt(track, rx - 4, rz),
        groundHeightAt(track, rx, rz + 4),
        groundHeightAt(track, rx, rz - 4)
      );
      const sy = 1.8 + (i % 4) * 0.8;
      rockCoords.push({
        x: rx,
        y: ryMin - sy * 0.25,
        z: rz,
        sx: 3.0 + (i % 5) * 1.1,
        sy,
        sz: 2.6 + (i % 3) * 1.2,
      });
    }
    const rockInst = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1.0, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.stoneWallMap,
        roughness: 0.92,
        flatShading: true,
      }),
      rockCoords.length
    );
    const rockColors = isAlps
      ? [new THREE.Color(0x9ca4ae), new THREE.Color(0x828a94), new THREE.Color(0xb2b9c2)]
      : [new THREE.Color(0xd1c1a8), new THREE.Color(0xc2ae92), new THREE.Color(0xb39f85)];
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
    group.add(rockInst);
  }

  const dispose = () => {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
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

export const buildCoastalWorld = buildWorld;
