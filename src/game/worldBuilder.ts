import * as THREE from 'three';
import {
  BARRIER_OFFSET,
  CURB_WIDTH,
  ROAD_HALF_WIDTH,
  TrackData,
  getSampleAtDistance,
  groundHeightAt,
  isClearOfTrack,
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
      fogDensity: 0.00078,
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
      fogDensity: 0.00068,
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
    fogDensity: 0.00072,
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

  const centerX = 180;
  const centerZ = 50;
  const segments = 84;
  const baseRadius = 860;

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
      const r = baseRadius + (i % 5) * 28;
      const h = 55 + Math.abs(Math.sin(i * 3.7)) * 115 + (i % 7 === 0 ? 55 : 0);
      const w = 26 + (i % 4) * 10;
      dummy.position.set(centerX + Math.cos(a) * r, h / 2 - 4, centerZ + Math.sin(a) * r);
      dummy.rotation.set(0, -a, 0);
      dummy.scale.set(w, h, 24);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    ring.add(inst);

    // Starfield & Glowing Moon overhead!
    const starCount = 320;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = (Math.abs(Math.sin(i * 12.9898) * 43758.5) % 1) * Math.PI * 2;
      const phi = 0.2 + (Math.abs(Math.sin(i * 78.233) * 24634.6) % 1) * 1.15;
      const dist = 1120;
      starPositions[i * 3 + 0] = centerX + Math.cos(theta) * Math.cos(phi) * dist;
      starPositions[i * 3 + 1] = Math.sin(phi) * dist;
      starPositions[i * 3 + 2] = centerZ + Math.sin(theta) * Math.cos(phi) * dist;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xe2ecff, size: 3.4, sizeAttenuation: true });
    ring.add(new THREE.Points(starGeo, starMat));

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(32, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff3cf })
    );
    moon.position.set(360, 420, 960);
    ring.add(moon);
    return ring;
  }

  // Sunlit Riviera Headlands or Majestic Jagged Snow-Capped Alpine Peaks Ring
  const peakCount = 64;
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
      dummy.position.set(0, -300, 0);
      dummy.scale.setScalar(0.01);
      dummy.updateMatrix();
      peakInst.setMatrixAt(i, dummy.matrix);
      continue;
    }

    const r = baseRadius - 60 + (i % 4) * 48;
    const h = isAlps
      ? 165 + Math.abs(Math.sin(i * 2.9)) * 185
      : 82 + Math.abs(Math.sin(i * 2.4)) * 96;
    const w = isAlps ? 125 + (i % 5) * 28 : 135 + (i % 4) * 34;
    const px = centerX + Math.cos(a) * r;
    const pz = centerZ + Math.sin(a) * r;

    dummy.position.set(px, h * 0.42 - 12, pz);
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
      dummy.position.set(px, h * 0.42 - 12 + h * 0.29, pz);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.set(w * 1.02, h * 1.02, w * 0.87);
      dummy.updateMatrix();
      snowInst.setMatrixAt(i, dummy.matrix);
    }
  }
  peakInst.instanceMatrix.needsUpdate = true;
  if (peakInst.instanceColor) peakInst.instanceColor.needsUpdate = true;
  peakInst.computeBoundingSphere();
  ring.add(peakInst);
  if (snowInst) {
    snowInst.instanceMatrix.needsUpdate = true;
    snowInst.computeBoundingSphere();
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
  const cloudInst = new THREE.InstancedMesh(puffGeo, cloudMat, 80);
  let ci = 0;
  for (let c = 0; c < 16; c++) {
    const angle = (c / 16) * Math.PI * 2 + 0.2;
    const dist = 420 + (c % 3) * 145;
    const cx = centerX + Math.cos(angle) * dist;
    const cy = 150 + (c % 4) * 22;
    const cz = centerZ + Math.sin(angle) * dist;
    for (let p = 0; p < 5 && ci < 80; p++) {
      const ox = (p - 2) * 20;
      const oy = p === 2 ? 8 : p === 1 || p === 3 ? 4 : 0;
      const oz = ((p % 2) - 0.5) * 12;
      const sx = p === 2 ? 30 : 22;
      const sy = p === 2 ? 13 : 9.5;
      dummy.position.set(cx + ox, cy + oy, cz + oz);
      dummy.rotation.set(0, c * 0.5, 0);
      dummy.scale.set(sx, sy, 16);
      dummy.updateMatrix();
      cloudInst.setMatrixAt(ci++, dummy.matrix);
    }
  }
  cloudInst.instanceMatrix.needsUpdate = true;
  cloudInst.computeBoundingSphere();
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

  const spanHalf = BARRIER_OFFSET + 3.0;
  const towerZs = [125, 255];
  const towerTopY = 54;

  for (const tz of towerZs) {
    for (const side of [-1, 1]) {
      const legLower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 30, 3.2), towerWhiteMat);
      legLower.position.set(side * spanHalf, 13, tz);
      bridge.add(legLower);

      const legUpper = new THREE.Mesh(new THREE.BoxGeometry(2.2, 26, 2.8), towerRedMat);
      legUpper.position.set(side * spanHalf, 41, tz);
      bridge.add(legUpper);

      const topLight = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 10), beaconMat);
      topLight.position.set(side * spanHalf, towerTopY + 1.8, tz);
      bridge.add(topLight);
    }

    for (const cy of [20, 35, 50]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(spanHalf * 2 + 2.6, 2.0, 2.2), towerRedMat);
      beam.position.set(0, cy, tz);
      bridge.add(beam);
    }
  }

  const anchorConcreteMat = new THREE.MeshStandardMaterial({ color: 0x2c3648, roughness: 0.78 });
  for (const side of [-1, 1]) {
    const sx = side * spanHalf;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 3.0, 56),
      new THREE.Vector3(sx, towerTopY, 125),
      new THREE.Vector3(sx, 20.0, 190),
      new THREE.Vector3(sx, towerTopY, 255),
      new THREE.Vector3(sx, 3.4, 324),
    ]);
    bridge.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.40, 8, false), cableGlowMat));

    // Solid concrete cable anchor abutments completely outside guardrails
    for (const az of [56, 324]) {
      const anchor = new THREE.Mesh(new THREE.BoxGeometry(3.2, 12, 5.8), anchorConcreteMat);
      anchor.position.set(sx, -1.8, az);
      bridge.add(anchor);
    }

    // Vertical suspender hanger cables
    for (let z = 72; z <= 310; z += 12) {
      if (Math.abs(z - 125) < 6 || Math.abs(z - 255) < 6) continue;
      const tNorm = (z - 56) / (324 - 56);
      const pt = curve.getPoint(Math.max(0.02, Math.min(0.98, tNorm)));
      const deckY = 2.6;
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
  for (let i = 0; i < track.samples.length; i += 16) {
    const s = track.samples[i];
    const pierH = Math.max(2, s.y + 7.4);
    const pier = new THREE.Mesh(new THREE.BoxGeometry(5.5, pierH, 2.6), pierMat);
    pier.position.set(s.x, s.y - 0.65 - pierH / 2, s.z);
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

  // Span cleanly OUTSIDE BARRIER_OFFSET (inner face at BARRIER_OFFSET + 1.2m -> zero road clipping!)
  const spanHalf = BARRIER_OFFSET + 2.4;
  const n = track.samples.length;
  const startIdx = Math.floor(n * 0.30);
  const endIdx = Math.floor(n * 0.38);
  for (let idx = startIdx; idx <= endIdx; idx += 3) {
    const s = track.samples[idx % n];
    const arch = new THREE.Group();
    arch.position.set(s.x, s.y, s.z);
    arch.rotation.y = Math.atan2(s.tx, s.tz);

    const wallR = new THREE.Mesh(new THREE.BoxGeometry(2.4, 9.2, 9.4), stoneMat);
    wallR.position.set(spanHalf, 4.6, 0);
    arch.add(wallR);

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 9.2, 2.6), stoneMat);
    pillarL.position.set(-spanHalf, 4.6, 0);
    arch.add(pillarL);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(spanHalf * 2 + 3.6, 2.2, 9.6), stoneMat);
    roof.position.set(0, 9.4, 0);
    arch.add(roof);

    const lamp = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 0.9), lightMat);
    lamp.position.set(0, 8.2, 0);
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

  // Legs stand strictly outside BARRIER_OFFSET with generous clearance
  const spanHalf = BARRIER_OFFSET + 1.65;
  const steelMat = new THREE.MeshStandardMaterial({
    color: isTokyo ? 0x2c384f : 0x2a3140,
    metalness: 0.65,
    roughness: 0.38,
  });

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8.8, 1.0), steelMat);
    leg.position.set(side * spanHalf, 4.4, 0);
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
  deck.position.set(0, 7.9, 0);
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

    // High-Visibility Corner Direction Chevron Signboards cleanly behind outer guardrail!
    const signGeo = new THREE.BoxGeometry(2.4, 1.25, 0.16);
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
      dummy.position.set(ch.x, ch.y + 1.75, ch.z);
      // Orient mostly parallel to outer barrier, canted gently toward oncoming drivers -> zero guardrail clipping!
      const yaw = ch.heading + (ch.turnRight ? Math.PI * 0.66 : -Math.PI * 0.66);
      dummy.rotation.set(0, yaw, 0);
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
  const terrainSize = 1560;
  const terrainSegs = 156;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(180, 0, 50);

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
      if (h < 12) tmpColor.copy(c1).lerp(c2, Math.max(0, h / 12));
      else if (h < 25) tmpColor.copy(c2).lerp(c3, (h - 12) / 13);
      else tmpColor.copy(c3).lerp(c4, Math.min(1, (h - 25) / 14));
    } else if (isTokyo) {
      tmpColor.copy(h > 0 ? c2 : c1);
    } else {
      if (h < -0.3) tmpColor.copy(c1);
      else if (h < 5.8) tmpColor.copy(c1).lerp(c2, Math.min(1, ((h + 0.3) / 6.1) * 1.15));
      else if (h < 14.5) tmpColor.copy(c2).lerp(c3, (h - 5.8) / 8.7);
      else tmpColor.copy(c3).lerp(c4, Math.min(1, (h - 14.5) / 12.0));
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
    const waterGeo = new THREE.PlaneGeometry(3400, 3400, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: isTokyo ? 0x071834 : 0x097ca6,
      roughness: isTokyo ? 0.12 : 0.14,
      metalness: isTokyo ? 0.42 : 0.28,
      bumpMap: textures.waterBump,
      bumpScale: 0.14,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(180, -1.65, 50);
    group.add(waterMesh);
  }

  // =========================================================================
  // 3. START / FINISH GANTRY ARCH + 3 OVERHEAD SECTOR BRIDGES
  // =========================================================================
  const startArchSample = track.samples[track.finishLineIndex];
  const archGroup = new THREE.Group();
  archGroup.position.set(startArchSample.x, startArchSample.y, startArchSample.z);
  archGroup.rotation.y = Math.atan2(startArchSample.tx, startArchSample.tz);

  const pillarMat = new THREE.MeshStandardMaterial({
    color: isTokyo ? 0x1e263b : 0xe8e2d5,
    roughness: 0.45,
    metalness: 0.25,
  });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.35, metalness: 0.7 });
  const spanHalf = BARRIER_OFFSET + 1.55;

  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8.8, 1.3), pillarMat);
    pillar.position.set(side * spanHalf, 4.4, 0);
    archGroup.add(pillar);

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.8), steelMat);
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
  banner.position.set(0, 7.9, 0);
  archGroup.add(banner);

  const countdownLights: THREE.MeshStandardMaterial[] = [];
  const podHousing = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.72, 0.55), steelMat);
  podHousing.position.set(0, 6.32, -0.15);
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
    bulb.position.set(-2.0 + i * 1.0, 6.32, -0.15);
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

  // Three Overhead Sector Bridges / Japanese Expressway Gantry Signs along the extended lap!
  group.add(buildOverheadSectorBridge(track, 0.28, isTokyo, textures));
  group.add(buildOverheadSectorBridge(track, 0.55, isTokyo, textures));
  group.add(buildOverheadSectorBridge(track, 0.80, isTokyo, textures));

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
  padGeo.rotateY(Math.PI); // Canvas top (chevron tip ^) now points strictly FORWARD (+Z)!

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
    const slopeAngle = Math.atan2(1.55, ramp.length);
    const deckGeo = new THREE.PlaneGeometry(ramp.width - 0.25, slopeLen);
    deckGeo.rotateX(-Math.PI / 2);
    deckGeo.rotateY(Math.PI); // Chevron tip points forward (+Z) up the ramp!
    const deck = new THREE.Mesh(deckGeo, rampDeckMat);
    deck.rotation.x = -slopeAngle; // +Z end rises to y=1.55 matching wedgeGeo!
    deck.position.set(0, 0.81, 0);
    rGroup.add(deck);

    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, slopeLen), rampGlowEdgeMat);
      rail.rotation.x = -slopeAngle;
      rail.position.set(side * (ramp.width * 0.5 - 0.08), 0.85, 0);
      rGroup.add(rail);
    }

    group.add(rGroup);
  }

  // =========================================================================
  // 5. MAP-SPECIFIC HERO LANDMARKS, ARCHITECTURE & MULTI-TIER FORESTS
  //    EVERY prop passes isClearOfTrack() -> ZERO road overlap guaranteed!
  // =========================================================================
  if (track.id === 'riviera') {
    const lh = buildCoastalLighthouse();
    const lhX = 28;
    const lhZ = 440;
    if (isClearOfTrack(track, lhX, lhZ, BARRIER_OFFSET + 18)) {
      lh.group.position.set(lhX, groundHeightAt(track, lhX, lhZ) - 0.3, lhZ);
      group.add(lh.group);
      lighthouseBeacon = lh.beacon;
    }

    for (const gsSpec of [
      { x: 25, z: 36, accent: 0xd92626 },
      { x: 25, z: 98, accent: 0x0ea5e9 },
      { x: 25, z: -42, accent: 0xf59e0b },
    ]) {
      if (!isClearOfTrack(track, gsSpec.x, gsSpec.z, BARRIER_OFFSET + 12)) continue;
      const gs = buildTracksideGrandstand(gsSpec.accent);
      gs.position.set(gsSpec.x, groundHeightAt(track, gsSpec.x, gsSpec.z) - 0.1, gsSpec.z);
      gs.rotation.y = Math.PI;
      group.add(gs);
    }

    const yachtCoords = [
      { x: -72, z: 65, rot: 0.4 },
      { x: -108, z: 185, rot: -0.6 },
      { x: -86, z: -78, rot: 0.9 },
      { x: -145, z: 18, rot: -0.2 },
      { x: -64, z: 275, rot: 0.7 },
      { x: -120, z: -175, rot: 0.3 },
      { x: -95, z: 360, rot: -0.4 },
    ];
    for (const yc of yachtCoords) {
      if (!isClearOfTrack(track, yc.x, yc.z, BARRIER_OFFSET + 20)) continue;
      const y = buildSailingYacht();
      y.position.set(yc.x, -1.55, yc.z);
      y.rotation.y = yc.rot;
      group.add(y);
      animatedYachts.push(y);
    }

    const villaCoords = [
      { x: 75, z: 135, rot: -0.6, scale: 1.2 },
      { x: 145, z: 220, rot: -1.1, scale: 1.1 },
      { x: 245, z: 270, rot: -1.6, scale: 1.2 },
      { x: 425, z: 255, rot: -1.9, scale: 1.25 },
      { x: 430, z: 110, rot: -2.2, scale: 1.1 },
      { x: 220, z: 115, rot: -0.8, scale: 1.15 },
      { x: 185, z: -55, rot: 0.5, scale: 1.2 },
      { x: 405, z: -145, rot: -2.5, scale: 1.15 },
      { x: 265, z: -180, rot: 0.9, scale: 1.1 },
      { x: 125, z: -215, rot: 0.3, scale: 1.15 },
      { x: 68, z: 30, rot: -1.4, scale: 1.1 },
      { x: 165, z: 455, rot: -2.9, scale: 1.2 },
    ];
    for (const vc of villaCoords) {
      if (!isClearOfTrack(track, vc.x, vc.z, BARRIER_OFFSET + 18 * vc.scale)) continue;
      const v = buildMediterraneanVilla(vc.scale);
      v.position.set(vc.x, groundHeightAt(track, vc.x, vc.z) - 0.35, vc.z);
      v.rotation.y = vc.rot;
      group.add(v);
    }
  } else if (track.id === 'tokyo') {
    group.add(buildTokyoSuspensionBridge(track));

    // Dense Multi-Depth Tokyo Bay Skyscraper Cityscape — EVERY tower checked against track clearance!
    const towerCoords = [
      // Flanking the long Suspension Bridge straight (east & west bay skylines)
      { x: 78, z: 280, w: 22, h: 92, d: 22 },
      { x: 96, z: 185, w: 26, h: 114, d: 24 },
      { x: 82, z: 95, w: 20, h: 86, d: 20 },
      { x: 98, z: 10, w: 26, h: 102, d: 24 },
      { x: 88, z: -90, w: 22, h: 82, d: 22 },
      { x: 138, z: 225, w: 24, h: 106, d: 24 },
      { x: 165, z: 115, w: 26, h: 120, d: 24 },
      { x: 185, z: -15, w: 24, h: 96, d: 22 },
      { x: 155, z: -145, w: 24, h: 88, d: 22 },
      // West Bay Towers
      { x: -78, z: 310, w: 24, h: 98, d: 24 },
      { x: -82, z: 210, w: 22, h: 92, d: 22 },
      { x: -78, z: 115, w: 24, h: 108, d: 24 },
      { x: -84, z: 15, w: 22, h: 86, d: 22 },
      { x: -86, z: -95, w: 22, h: 78, d: 22 },
      { x: -136, z: 255, w: 28, h: 124, d: 26 },
      { x: -132, z: 130, w: 26, h: 112, d: 24 },
      { x: -128, z: -20, w: 24, h: 96, d: 24 },
      // Outer East & North Odaiba Waterfront Towers
      { x: 60, z: 530, w: 28, h: 116, d: 26 },
      { x: 170, z: 525, w: 26, h: 104, d: 24 },
      { x: 295, z: 515, w: 28, h: 118, d: 26 },
      { x: 465, z: 390, w: 26, h: 108, d: 24 },
      { x: 475, z: 240, w: 24, h: 96, d: 24 },
      { x: 495, z: 95, w: 28, h: 122, d: 26 },
      { x: 485, z: -60, w: 26, h: 106, d: 24 },
      { x: 470, z: -195, w: 24, h: 92, d: 22 },
      { x: 375, z: -335, w: 26, h: 102, d: 24 },
      { x: 235, z: -390, w: 28, h: 110, d: 26 },
      { x: 85, z: -375, w: 24, h: 88, d: 22 },
      // Inner Bay Plaza Towers (strictly centered in wide open loop interior)
      { x: 235, z: 295, w: 24, h: 98, d: 24 },
      { x: 235, z: 65, w: 26, h: 112, d: 24 },
      { x: 255, z: -115, w: 24, h: 94, d: 22 },
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
      const footprintRadius = Math.hypot(tc.w, tc.d) * 0.5;
      if (!isClearOfTrack(track, tc.x, tc.z, BARRIER_OFFSET + footprintRadius + 10)) return;

      const bldg = new THREE.Mesh(new THREE.BoxGeometry(tc.w, tc.h, tc.d), towerMat);
      bldg.position.set(tc.x, tc.h / 2 - 2.0, tc.z);
      group.add(bldg);

      const capMat = capMats[idx % capMats.length];
      const neonCap = new THREE.Mesh(new THREE.BoxGeometry(tc.w + 0.6, 1.0, tc.d + 0.6), capMat);
      neonCap.position.set(tc.x, tc.h - 2.0, tc.z);
      group.add(neonCap);

      // Spire antenna on tall skyscrapers
      if (tc.h > 95) {
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.55, 18, 6), capMat);
        spire.position.set(tc.x, tc.h + 7.0, tc.z);
        group.add(spire);
      }
    });

    // Dual-Side Warm Amber Highway Streetlamps strictly outside guardrails!
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfbbf24,
      emissiveIntensity: 3.4,
    });
    for (let i = 0; i < track.samples.length; i += 14) {
      const s = track.samples[i];
      const side = (i / 14) % 2 === 0 ? -1 : 1;
      const off = side * (BARRIER_OFFSET + 1.15);
      const poleGroup = new THREE.Group();
      poleGroup.position.set(s.x + s.rx * off, s.y, s.z + s.rz * off);
      poleGroup.rotation.y = Math.atan2(s.tx, s.tz);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 8.6, 6), poleMat);
      mast.position.y = 4.3;
      poleGroup.add(mast);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 0.24), poleMat);
      arm.position.set(-side * 1.3, 8.45, 0);
      poleGroup.add(arm);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 0.48), lampGlowMat);
      lamp.position.set(-side * 2.2, 8.3, 0);
      poleGroup.add(lamp);
      group.add(poleGroup);
    }
  } else {
    // ALPEN PASS: Carved Stone Avalanche-Gallery Tunnel + Grandstand + Swiss Timber Chalets
    group.add(buildAlpsRockTunnel(track, textures.stoneWallMap));

    if (isClearOfTrack(track, 25, 36, BARRIER_OFFSET + 12)) {
      const gs = buildTracksideGrandstand(0xe8a812);
      gs.position.set(25, groundHeightAt(track, 25, 36) - 0.1, 36);
      gs.rotation.y = Math.PI;
      group.add(gs);
    }

    const chaletCoords = [
      { x: 68, z: 95, rot: -0.9, scale: 1.2 },
      { x: 135, z: 185, rot: -1.4, scale: 1.1 },
      { x: 215, z: 265, rot: -1.2, scale: 1.15 },
      { x: 165, z: -75, rot: 0.6, scale: 1.2 },
      { x: 92, z: -185, rot: 0.2, scale: 1.05 },
      { x: -55, z: 78, rot: 1.2, scale: 1.15 },
      { x: -52, z: -45, rot: 1.5, scale: 1.05 },
      { x: 245, z: -175, rot: 0.9, scale: 1.15 },
      { x: 430, z: 110, rot: -2.1, scale: 1.2 },
      { x: 135, z: 45, rot: -0.6, scale: 1.1 },
    ];
    for (const cc of chaletCoords) {
      if (!isClearOfTrack(track, cc.x, cc.z, BARRIER_OFFSET + 18 * cc.scale)) continue;
      const ch = buildSwissChalet(cc.scale);
      ch.position.set(cc.x, groundHeightAt(track, cc.x, cc.z) - 0.35, cc.z);
      ch.rotation.y = cc.rot;
      group.add(ch);
    }
  }

  // =========================================================================
  // 6. MULTI-TIER SCULPTED TREES & LAYERED CLIFF OUTCROPS (Riviera & Alps)
  //    Strict clearance check guarantees ZERO foliage or rocks touch the road!
  // =========================================================================
  if (!isTokyo) {
    const treeCoords: Array<{ x: number; y: number; z: number; scale: number; isWide: boolean }> = [];
    const maxTrees = 360;
    for (let i = 0; i < maxTrees * 3 && treeCoords.length < maxTrees; i++) {
      const a = i * 2.39996;
      const rad = 28 + Math.sqrt(i) * 21.5;
      const tx = 180 + Math.cos(a) * rad;
      const tz = 50 + Math.sin(a) * rad;

      if (!isAlps && tx < -22) continue;
      // Wide canopy clearance: BARRIER_OFFSET (10.9) + 10.5m = 21.4m from centerline!
      if (!isClearOfTrack(track, tx, tz, BARRIER_OFFSET + 10.5)) continue;

      const ty = groundHeightAt(track, tx, tz);
      if (ty < 0.25 || (isAlps && ty > 44)) continue;

      treeCoords.push({
        x: tx,
        y: ty - 0.2,
        z: tz,
        scale: 0.9 + (i % 6) * 0.16,
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
        tier3Inst.setColorAt(idx, tc.y > 14 ? snowTipColor : paletteMid[(idx + 1) % paletteMid.length]);
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

        dummy.position.set(0, -300, 0);
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

        dummy.position.set(0, -300, 0);
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
    trunkInst.computeBoundingSphere();
    tier1Inst.computeBoundingSphere();
    tier2Inst.computeBoundingSphere();
    tier3Inst.computeBoundingSphere();
    if (tier1Inst.instanceColor) tier1Inst.instanceColor.needsUpdate = true;
    if (tier2Inst.instanceColor) tier2Inst.instanceColor.needsUpdate = true;
    if (tier3Inst.instanceColor) tier3Inst.instanceColor.needsUpdate = true;
    group.add(trunkInst, tier1Inst, tier2Inst, tier3Inst);

    // Textured Layered Cliff Rocks — EVERY boulder verified strictly clear of road!
    const rockCoords: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [];
    for (let i = 0; i < 160 && rockCoords.length < 85; i++) {
      const a = i * 1.91;
      const rad = 45 + Math.sqrt(i) * 32;
      const rx = 180 + Math.cos(a) * rad;
      const rz = 50 + Math.sin(a) * rad;
      const sx = 3.0 + (i % 5) * 1.05;
      const sy = 1.8 + (i % 4) * 0.75;
      const sz = 2.6 + (i % 3) * 1.1;

      if (!isClearOfTrack(track, rx, rz, BARRIER_OFFSET + Math.max(sx, sz) + 8.5)) continue;

      const ryCenter = groundHeightAt(track, rx, rz);
      if (ryCenter < -1.6 || (isAlps && ryCenter > 18)) continue;
      const ryMin = Math.min(
        ryCenter,
        groundHeightAt(track, rx + 5, rz),
        groundHeightAt(track, rx - 5, rz),
        groundHeightAt(track, rx, rz + 5),
        groundHeightAt(track, rx, rz - 5)
      );
      rockCoords.push({
        x: rx,
        y: ryMin - sy * 0.3,
        z: rz,
        sx,
        sy,
        sz,
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
    rockInst.computeBoundingSphere();
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
