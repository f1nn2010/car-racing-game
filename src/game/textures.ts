import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  curbMap: THREE.CanvasTexture;
  gantryBannerMap: THREE.CanvasTexture;
  boostPadMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  carbonMap: THREE.CanvasTexture;
  waterBump: THREE.CanvasTexture;
  chevronMap: THREE.CanvasTexture;
  skyscraperMap: THREE.CanvasTexture;
  terrainDetailMap: THREE.CanvasTexture;
  adBoardMap: THREE.CanvasTexture;
  highwaySignMap: THREE.CanvasTexture;
  stoneWallMap: THREE.CanvasTexture;
  tireTreadMap: THREE.CanvasTexture;
  brakeRotorMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(16, Math.max(1, maxAnisotropy));

  // 1. High-detail Motorsport Tarmac + Rubber Racing Line + Micro-Aggregate Bump
  const [asphCanvas, aCtx] = makeCanvas(512, 512);
  aCtx.fillStyle = '#2d323b';
  aCtx.fillRect(0, 0, 512, 512);

  // Subtle worn dual racing-line tire tracks & crown shading
  const laneGrad = aCtx.createLinearGradient(0, 0, 512, 0);
  laneGrad.addColorStop(0.0, 'rgba(18, 22, 28, 0.35)');
  laneGrad.addColorStop(0.18, 'rgba(12, 15, 20, 0.42)');
  laneGrad.addColorStop(0.32, 'rgba(54, 59, 68, 0.16)');
  laneGrad.addColorStop(0.5, 'rgba(72, 78, 88, 0.18)');
  laneGrad.addColorStop(0.68, 'rgba(54, 59, 68, 0.16)');
  laneGrad.addColorStop(0.82, 'rgba(12, 15, 20, 0.42)');
  laneGrad.addColorStop(1.0, 'rgba(18, 22, 28, 0.35)');
  aCtx.fillStyle = laneGrad;
  aCtx.fillRect(0, 0, 512, 512);

  // Fine stone aggregate grain
  for (let i = 0; i < 12000; i++) {
    const x = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1) * 512;
    const y = Math.abs((Math.sin(i * 78.233) * 24634.6345) % 1) * 512;
    const shade = i % 3 === 0 ? 84 : i % 3 === 1 ? 30 : 54;
    aCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 7}, 0.28)`;
    aCtx.fillRect(x, y, 2, 2);
  }

  // Subtle longitudinal tarmac tar seams
  aCtx.fillStyle = 'rgba(12, 14, 18, 0.22)';
  aCtx.fillRect(170, 0, 3, 512);
  aCtx.fillRect(340, 0, 3, 512);

  // Crisp bright FIA track edge lines
  aCtx.fillStyle = '#f2ede2';
  aCtx.fillRect(14, 0, 12, 512);
  aCtx.fillRect(512 - 26, 0, 12, 512);

  // Clean dashed center lane divider
  aCtx.fillStyle = 'rgba(246, 240, 226, 0.80)';
  aCtx.fillRect(252, 42, 8, 178);
  aCtx.fillRect(252, 298, 8, 178);

  const asphaltMap = new THREE.CanvasTexture(asphCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.anisotropy = aniso;

  const [bumpCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 7500; i++) {
    const px = Math.abs((Math.sin(i * 41.13) * 91823.1) % 1) * 256;
    const py = Math.abs((Math.sin(i * 19.77) * 51231.7) % 1) * 256;
    const v = 80 + (i % 98);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(px, py, 2, 2);
  }
  const asphaltBump = new THREE.CanvasTexture(bumpCanvas);
  asphaltBump.wrapS = THREE.RepeatWrapping;
  asphaltBump.wrapT = THREE.RepeatWrapping;
  asphaltBump.anisotropy = aniso;

  // 2. Red & Ivory FIA Racing Curb with subtle rubber scuff
  const [curbCanvas, cCtx] = makeCanvas(128, 256);
  cCtx.fillStyle = '#d92924';
  cCtx.fillRect(0, 0, 128, 128);
  cCtx.fillStyle = '#f4efe2';
  cCtx.fillRect(0, 128, 128, 128);
  cCtx.fillStyle = 'rgba(18, 20, 26, 0.22)';
  cCtx.fillRect(0, 0, 16, 256);
  cCtx.fillRect(112, 0, 16, 256);
  const curbMap = new THREE.CanvasTexture(curbCanvas);
  curbMap.colorSpace = THREE.SRGBColorSpace;
  curbMap.wrapS = THREE.RepeatWrapping;
  curbMap.wrapT = THREE.RepeatWrapping;
  curbMap.anisotropy = aniso;

  // 3. Start/Finish Gantry Banner
  const [bannerCanvas, gCtx] = makeCanvas(1024, 256);
  gCtx.fillStyle = '#111722';
  gCtx.fillRect(0, 0, 1024, 256);
  const sq = 28;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < Math.ceil(1024 / sq); col++) {
      gCtx.fillStyle = (row + col) % 2 === 0 ? '#f4efe2' : '#181d27';
      gCtx.fillRect(col * sq, row * sq, sq, sq);
      gCtx.fillRect(col * sq, 256 - (row + 1) * sq, sq, sq);
    }
  }
  gCtx.fillStyle = '#d92626';
  gCtx.fillRect(0, 56, 1024, 10);
  gCtx.fillRect(0, 190, 1024, 10);
  gCtx.fillStyle = '#f8f4e8';
  gCtx.font = 'italic 800 86px "Barlow Condensed", sans-serif';
  gCtx.textAlign = 'center';
  gCtx.textBaseline = 'middle';
  gCtx.fillText('COASTLINE APEX GP', 512, 130);

  const gantryBannerMap = new THREE.CanvasTexture(bannerCanvas);
  gantryBannerMap.colorSpace = THREE.SRGBColorSpace;
  gantryBannerMap.anisotropy = aniso;

  // 4. Boost Pad Chevron Texture
  const [padCanvas, pCtx] = makeCanvas(256, 512);
  pCtx.fillStyle = '#0e1726';
  pCtx.fillRect(0, 0, 256, 512);
  pCtx.fillStyle = '#0ea5e9';
  pCtx.fillRect(8, 0, 12, 512);
  pCtx.fillRect(236, 0, 12, 512);
  for (let i = 0; i < 3; i++) {
    const baseY = 95 + i * 155;
    pCtx.fillStyle = i === 0 ? '#fbbf24' : '#38bdf8';
    pCtx.beginPath();
    pCtx.moveTo(128, baseY - 56);
    pCtx.lineTo(222, baseY + 18);
    pCtx.lineTo(222, baseY + 62);
    pCtx.lineTo(128, baseY - 12);
    pCtx.lineTo(34, baseY + 62);
    pCtx.lineTo(34, baseY + 18);
    pCtx.closePath();
    pCtx.fill();
  }
  const boostPadMap = new THREE.CanvasTexture(padCanvas);
  boostPadMap.colorSpace = THREE.SRGBColorSpace;
  boostPadMap.wrapS = THREE.ClampToEdgeWrapping;
  boostPadMap.wrapT = THREE.RepeatWrapping;
  boostPadMap.anisotropy = aniso;

  // 5. Soft Radial Contact Shadow Disc
  const [shCanvas, sCtx] = makeCanvas(128, 128);
  const rad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 62);
  rad.addColorStop(0, 'rgba(6, 10, 18, 0.85)');
  rad.addColorStop(0.55, 'rgba(6, 10, 18, 0.55)');
  rad.addColorStop(1, 'rgba(6, 10, 18, 0.0)');
  sCtx.fillStyle = rad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(shCanvas);

  // 6. Satin Carbon Fiber Weave
  const [carbCanvas, cbCtx] = makeCanvas(64, 64);
  cbCtx.fillStyle = '#181b21';
  cbCtx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const shift = (y / 8) % 2 === 0 ? 0 : 4;
      cbCtx.fillStyle = '#252a33';
      cbCtx.fillRect((x + shift) % 64, y, 4, 4);
      cbCtx.fillStyle = '#12151a';
      cbCtx.fillRect((x + shift + 4) % 64, y + 4, 4, 4);
    }
  }
  const carbonMap = new THREE.CanvasTexture(carbCanvas);
  carbonMap.colorSpace = THREE.SRGBColorSpace;
  carbonMap.wrapS = THREE.RepeatWrapping;
  carbonMap.wrapT = THREE.RepeatWrapping;
  carbonMap.repeat.set(6, 6);

  // 7. Water Ripple Bump
  const [watCanvas, wCtx] = makeCanvas(256, 256);
  wCtx.fillStyle = '#808080';
  wCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 480; i++) {
    const x = Math.abs((Math.sin(i * 17.3) * 4123.7) % 1) * 256;
    const y = Math.abs((Math.sin(i * 63.1) * 8721.3) % 1) * 256;
    const w = 14 + (i % 24);
    wCtx.fillStyle = i % 2 === 0 ? 'rgba(210,210,210,0.28)' : 'rgba(50,50,50,0.28)';
    wCtx.fillRect(x, y, w, 3);
  }
  const waterBump = new THREE.CanvasTexture(watCanvas);
  waterBump.wrapS = THREE.RepeatWrapping;
  waterBump.wrapT = THREE.RepeatWrapping;
  waterBump.repeat.set(48, 48);

  // 8. Corner Direction Chevron Signboard Texture
  const [chevCanvas, chCtx] = makeCanvas(256, 128);
  chCtx.fillStyle = '#131822';
  chCtx.fillRect(0, 0, 256, 128);
  chCtx.fillStyle = '#f5b700';
  for (let i = 0; i < 2; i++) {
    const ox = 24 + i * 116;
    chCtx.beginPath();
    chCtx.moveTo(ox, 16);
    chCtx.lineTo(ox + 56, 16);
    chCtx.lineTo(ox + 102, 64);
    chCtx.lineTo(ox + 56, 112);
    chCtx.lineTo(ox, 112);
    chCtx.lineTo(ox + 46, 64);
    chCtx.closePath();
    chCtx.fill();
  }
  const chevronMap = new THREE.CanvasTexture(chevCanvas);
  chevronMap.colorSpace = THREE.SRGBColorSpace;
  chevronMap.anisotropy = aniso;

  // 9. Tokyo Midnight Skyscraper Lit Windows Texture
  const [skyCanvas, skCtx] = makeCanvas(256, 512);
  skCtx.fillStyle = '#0c1222';
  skCtx.fillRect(0, 0, 256, 512);
  for (let row = 0; row < 32; row++) {
    // Structural floor spandrel bands
    skCtx.fillStyle = '#141d34';
    skCtx.fillRect(0, row * 16, 256, 3);
    for (let col = 0; col < 10; col++) {
      const seed = Math.abs(Math.sin(row * 17.7 + col * 31.3) * 43758.5) % 1;
      if (seed > 0.34) {
        skCtx.fillStyle =
          seed > 0.87 ? '#38bdf8' : seed > 0.72 ? '#fb7185' : seed > 0.48 ? '#fde68a' : '#fef3c7';
        skCtx.fillRect(10 + col * 24, 5 + row * 16, 14, 9);
      } else {
        skCtx.fillStyle = '#162038';
        skCtx.fillRect(10 + col * 24, 5 + row * 16, 14, 9);
      }
    }
  }
  const skyscraperMap = new THREE.CanvasTexture(skyCanvas);
  skyscraperMap.colorSpace = THREE.SRGBColorSpace;
  skyscraperMap.wrapS = THREE.RepeatWrapping;
  skyscraperMap.wrapT = THREE.RepeatWrapping;
  skyscraperMap.anisotropy = aniso;

  // 10. Seamless Organic Terrain Micro-Detail Texture (eliminates flat plastic clay hills!)
  const [terCanvas, tCtx] = makeCanvas(512, 512);
  tCtx.fillStyle = '#dcdcdc';
  tCtx.fillRect(0, 0, 512, 512);
  // Subtle organic tonal patches
  for (let i = 0; i < 360; i++) {
    const x = Math.abs((Math.sin(i * 23.1) * 9123.4) % 1) * 512;
    const y = Math.abs((Math.sin(i * 51.7) * 6431.2) % 1) * 512;
    const r = 12 + (i % 34);
    const v = i % 2 === 0 ? 235 : 196;
    tCtx.fillStyle = `rgba(${v},${v},${v},0.22)`;
    tCtx.beginPath();
    tCtx.arc(x, y, r, 0, Math.PI * 2);
    tCtx.fill();
  }
  // Fine meadow/rock speckles & striations
  for (let i = 0; i < 9500; i++) {
    const x = Math.abs((Math.sin(i * 19.31) * 32141.9) % 1) * 512;
    const y = Math.abs((Math.sin(i * 87.17) * 54123.7) % 1) * 512;
    const v = i % 3 === 0 ? 155 : i % 3 === 1 ? 245 : 192;
    tCtx.fillStyle = `rgba(${v},${v},${v},0.28)`;
    tCtx.fillRect(x, y, i % 4 === 0 ? 4 : 2, 2);
  }
  const terrainDetailMap = new THREE.CanvasTexture(terCanvas);
  terrainDetailMap.colorSpace = THREE.SRGBColorSpace;
  terrainDetailMap.wrapS = THREE.RepeatWrapping;
  terrainDetailMap.wrapT = THREE.RepeatWrapping;
  terrainDetailMap.repeat.set(58, 58);
  terrainDetailMap.anisotropy = aniso;

  // 11. Trackside Motorsport Sponsor Ad Boards (FIA Circuit Aesthetic)
  const [adCanvas, adCtx] = makeCanvas(1024, 128);
  const panels = [
    { bg: '#131b2b', stripe: '#d92626', text: 'APEX GT', textCol: '#f8f4e8' },
    { bg: '#f4efe2', stripe: '#131b2b', text: 'WEISSACH', textCol: '#d92626' },
    { bg: '#0c2340', stripe: '#f5b700', text: 'W16 TURBO', textCol: '#f8f4e8' },
    { bg: '#b91c1c', stripe: '#f4efe2', text: 'GRAND PRIX', textCol: '#ffffff' },
  ];
  panels.forEach((p, idx) => {
    const ox = idx * 256;
    adCtx.fillStyle = p.bg;
    adCtx.fillRect(ox, 0, 256, 128);
    adCtx.fillStyle = p.stripe;
    adCtx.fillRect(ox, 0, 256, 14);
    adCtx.fillRect(ox, 114, 256, 14);
    adCtx.fillStyle = p.textCol;
    adCtx.font = 'italic 800 44px "Barlow Condensed", sans-serif';
    adCtx.textAlign = 'center';
    adCtx.textBaseline = 'middle';
    adCtx.fillText(p.text, ox + 128, 66);
  });
  const adBoardMap = new THREE.CanvasTexture(adCanvas);
  adBoardMap.colorSpace = THREE.SRGBColorSpace;
  adBoardMap.wrapS = THREE.RepeatWrapping;
  adBoardMap.wrapT = THREE.ClampToEdgeWrapping;
  adBoardMap.anisotropy = aniso;

  // 12. Tokyo Wangan Green Expressway Overhead Gantry Sign
  const [hwCanvas, hwCtx] = makeCanvas(1024, 256);
  hwCtx.fillStyle = '#0a5c36';
  hwCtx.fillRect(0, 0, 1024, 256);
  hwCtx.strokeStyle = '#f4f6f8';
  hwCtx.lineWidth = 10;
  hwCtx.strokeRect(14, 14, 996, 228);
  hwCtx.fillStyle = '#0e7490';
  hwCtx.fillRect(42, 42, 130, 74);
  hwCtx.fillStyle = '#ffffff';
  hwCtx.font = '800 46px "Barlow Condensed", sans-serif';
  hwCtx.textAlign = 'center';
  hwCtx.textBaseline = 'middle';
  hwCtx.fillText('B', 107, 80);
  hwCtx.textAlign = 'left';
  hwCtx.font = '800 66px "Barlow Condensed", sans-serif';
  hwCtx.fillText('WANGAN BAYSHORE   C1 LOOP', 200, 88);
  hwCtx.font = '700 42px "DM Sans", sans-serif';
  hwCtx.fillStyle = '#fde68a';
  hwCtx.fillText('ODAIBA  ·  RAINBOW BRIDGE  →  1.2 KM', 200, 174);
  const highwaySignMap = new THREE.CanvasTexture(hwCanvas);
  highwaySignMap.colorSpace = THREE.SRGBColorSpace;
  highwaySignMap.anisotropy = aniso;

  // 13. Carved Alpine Stone Ashlar Texture (Rock Tunnel & Coastal Retaining Walls)
  const [stCanvas, stCtx] = makeCanvas(256, 256);
  stCtx.fillStyle = '#6c7076';
  stCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 === 0 ? 0 : 32;
    for (let col = -1; col < 5; col++) {
      const shade = 92 + ((row * 13 + col * 29) & 31);
      stCtx.fillStyle = `rgb(${shade}, ${shade - 1}, ${shade - 4})`;
      stCtx.fillRect(col * 64 + offset + 2, row * 32 + 2, 60, 28);
    }
  }
  const stoneWallMap = new THREE.CanvasTexture(stCanvas);
  stoneWallMap.colorSpace = THREE.SRGBColorSpace;
  stoneWallMap.wrapS = THREE.RepeatWrapping;
  stoneWallMap.wrapT = THREE.RepeatWrapping;
  stoneWallMap.repeat.set(2, 2);
  stoneWallMap.anisotropy = aniso;

  // 14. Motorsport Performance Tire Tread & Sidewall Texture
  const [tireCanvas, tiCtx] = makeCanvas(256, 256);
  tiCtx.fillStyle = '#181b21';
  tiCtx.fillRect(0, 0, 256, 256);
  // Subtle rubber micro-grain
  for (let i = 0; i < 3200; i++) {
    const px = Math.abs((Math.sin(i * 19.1) * 43758.5) % 1) * 256;
    const py = Math.abs((Math.sin(i * 73.7) * 24634.6) % 1) * 256;
    const v = 18 + (i % 16);
    tiCtx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    tiCtx.fillRect(px, py, 2, 2);
  }
  // 3 longitudinal circumferential rain channels across tread band (y = 80..176)
  tiCtx.fillStyle = '#0a0c10';
  for (const gy of [104, 128, 152]) {
    tiCtx.fillRect(0, gy - 3, 256, 6);
  }
  // Angled semi-slick performance shoulder sipes
  tiCtx.strokeStyle = '#0c0e13';
  tiCtx.lineWidth = 3;
  for (let x = 0; x < 256; x += 16) {
    tiCtx.beginPath();
    tiCtx.moveTo(x, 76);
    tiCtx.lineTo(x + 9, 102);
    tiCtx.moveTo(x, 180);
    tiCtx.lineTo(x + 9, 154);
    tiCtx.stroke();
  }
  // Subtle satin sidewall accent band
  tiCtx.fillStyle = 'rgba(42, 47, 56, 0.55)';
  tiCtx.fillRect(0, 34, 256, 12);
  tiCtx.fillRect(0, 210, 256, 12);
  const tireTreadMap = new THREE.CanvasTexture(tireCanvas);
  tireTreadMap.colorSpace = THREE.SRGBColorSpace;
  tireTreadMap.wrapS = THREE.RepeatWrapping;
  tireTreadMap.wrapT = THREE.ClampToEdgeWrapping;
  tireTreadMap.anisotropy = aniso;

  // 15. Cross-Drilled Carbon-Ceramic Brake Rotor Texture
  const [rotCanvas, rCtx] = makeCanvas(256, 256);
  const rCx = 128;
  const rCy = 128;
  const rGrad = rCtx.createRadialGradient(rCx, rCy, 22, rCx, rCy, 126);
  rGrad.addColorStop(0.0, '#1e222a');
  rGrad.addColorStop(0.38, '#282e38');
  rGrad.addColorStop(0.42, '#8b94a3');
  rGrad.addColorStop(0.68, '#b4bdc9');
  rGrad.addColorStop(0.92, '#7d8694');
  rGrad.addColorStop(1.0, '#464d59');
  rCtx.fillStyle = rGrad;
  rCtx.fillRect(0, 0, 256, 256);
  // Fine brushed metallic concentric scoring grooves
  for (let r = 56; r <= 118; r += 4) {
    rCtx.strokeStyle = r % 8 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(20,24,32,0.18)';
    rCtx.lineWidth = 1.2;
    rCtx.beginPath();
    rCtx.arc(rCx, rCy, r, 0, Math.PI * 2);
    rCtx.stroke();
  }
  // Swept cross-drilled ventilation hole clusters (12 curved arms x 4 holes)
  rCtx.fillStyle = '#151922';
  for (let arm = 0; arm < 12; arm++) {
    const baseAngle = (arm / 12) * Math.PI * 2;
    for (let h = 0; h < 4; h++) {
      const dist = 66 + h * 13;
      const a = baseAngle + h * 0.075;
      rCtx.beginPath();
      rCtx.arc(rCx + Math.cos(a) * dist, rCy + Math.sin(a) * dist, 2.7, 0, Math.PI * 2);
      rCtx.fill();
    }
  }
  const brakeRotorMap = new THREE.CanvasTexture(rotCanvas);
  brakeRotorMap.colorSpace = THREE.SRGBColorSpace;
  brakeRotorMap.anisotropy = aniso;

  return {
    asphaltMap,
    asphaltBump,
    curbMap,
    gantryBannerMap,
    boostPadMap,
    contactShadowMap,
    carbonMap,
    waterBump,
    chevronMap,
    skyscraperMap,
    terrainDetailMap,
    adBoardMap,
    highwaySignMap,
    stoneWallMap,
    tireTreadMap,
    brakeRotorMap,
    dispose: () => {
      asphaltMap.dispose();
      asphaltBump.dispose();
      curbMap.dispose();
      gantryBannerMap.dispose();
      boostPadMap.dispose();
      contactShadowMap.dispose();
      carbonMap.dispose();
      waterBump.dispose();
      chevronMap.dispose();
      skyscraperMap.dispose();
      terrainDetailMap.dispose();
      adBoardMap.dispose();
      highwaySignMap.dispose();
      stoneWallMap.dispose();
      tireTreadMap.dispose();
      brakeRotorMap.dispose();
    },
  };
}
