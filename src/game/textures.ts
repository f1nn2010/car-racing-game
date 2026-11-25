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

  // 1. High-detail Asphalt + Bump
  const [asphCanvas, aCtx] = makeCanvas(512, 512);
  aCtx.fillStyle = '#333840';
  aCtx.fillRect(0, 0, 512, 512);

  const laneGrad = aCtx.createLinearGradient(0, 0, 512, 0);
  laneGrad.addColorStop(0.0, 'rgba(20, 24, 30, 0.25)');
  laneGrad.addColorStop(0.24, 'rgba(15, 18, 22, 0.35)');
  laneGrad.addColorStop(0.5, 'rgba(65, 70, 78, 0.14)');
  laneGrad.addColorStop(0.76, 'rgba(15, 18, 22, 0.35)');
  laneGrad.addColorStop(1.0, 'rgba(20, 24, 30, 0.25)');
  aCtx.fillStyle = laneGrad;
  aCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 9500; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 24634.6345) % 1;
    const px = Math.abs(x) * 512;
    const py = Math.abs(y) * 512;
    const shade = i % 3 === 0 ? 78 : i % 3 === 1 ? 38 : 60;
    aCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 6}, 0.24)`;
    aCtx.fillRect(px, py, 2, 2);
  }

  aCtx.fillStyle = '#ebe6da';
  aCtx.fillRect(14, 0, 12, 512);
  aCtx.fillRect(512 - 26, 0, 12, 512);

  aCtx.fillStyle = 'rgba(244, 236, 218, 0.74)';
  aCtx.fillRect(252, 48, 8, 176);
  aCtx.fillRect(252, 304, 8, 176);

  const asphaltMap = new THREE.CanvasTexture(asphCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.anisotropy = aniso;

  const [bumpCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6500; i++) {
    const px = Math.abs((Math.sin(i * 41.13) * 91823.1) % 1) * 256;
    const py = Math.abs((Math.sin(i * 19.77) * 51231.7) % 1) * 256;
    const v = 90 + (i % 85);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(px, py, 2, 2);
  }
  const asphaltBump = new THREE.CanvasTexture(bumpCanvas);
  asphaltBump.wrapS = THREE.RepeatWrapping;
  asphaltBump.wrapT = THREE.RepeatWrapping;
  asphaltBump.anisotropy = aniso;

  // 2. Red & Ivory FIA Racing Curb
  const [curbCanvas, cCtx] = makeCanvas(128, 256);
  cCtx.fillStyle = '#d42c28';
  cCtx.fillRect(0, 0, 128, 128);
  cCtx.fillStyle = '#f2ede2';
  cCtx.fillRect(0, 128, 128, 128);
  cCtx.fillStyle = 'rgba(20, 20, 24, 0.16)';
  cCtx.fillRect(0, 0, 14, 256);
  cCtx.fillRect(114, 0, 14, 256);
  const curbMap = new THREE.CanvasTexture(curbCanvas);
  curbMap.colorSpace = THREE.SRGBColorSpace;
  curbMap.wrapS = THREE.RepeatWrapping;
  curbMap.wrapT = THREE.RepeatWrapping;
  curbMap.anisotropy = aniso;

  // 3. Start/Finish Gantry Banner
  const [bannerCanvas, gCtx] = makeCanvas(1024, 256);
  gCtx.fillStyle = '#141923';
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
  gCtx.font = 'italic 800 84px "Barlow Condensed", sans-serif';
  gCtx.textAlign = 'center';
  gCtx.textBaseline = 'middle';
  gCtx.fillText('COASTLINE APEX GP', 512, 130);

  const gantryBannerMap = new THREE.CanvasTexture(bannerCanvas);
  gantryBannerMap.colorSpace = THREE.SRGBColorSpace;
  gantryBannerMap.anisotropy = aniso;

  // 4. Boost Pad Chevron Texture
  const [padCanvas, pCtx] = makeCanvas(256, 512);
  pCtx.fillStyle = '#111926';
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
  for (let i = 0; i < 420; i++) {
    const x = Math.abs((Math.sin(i * 17.3) * 4123.7) % 1) * 256;
    const y = Math.abs((Math.sin(i * 63.1) * 8721.3) % 1) * 256;
    const w = 14 + (i % 24);
    wCtx.fillStyle = i % 2 === 0 ? 'rgba(205,205,205,0.24)' : 'rgba(55,55,55,0.24)';
    wCtx.fillRect(x, y, w, 3);
  }
  const waterBump = new THREE.CanvasTexture(watCanvas);
  waterBump.wrapS = THREE.RepeatWrapping;
  waterBump.wrapT = THREE.RepeatWrapping;
  waterBump.repeat.set(28, 28);

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
  skCtx.fillStyle = '#0e1526';
  skCtx.fillRect(0, 0, 256, 512);
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 10; col++) {
      const seed = Math.abs(Math.sin(row * 17.7 + col * 31.3) * 43758.5) % 1;
      if (seed > 0.36) {
        skCtx.fillStyle =
          seed > 0.86 ? '#38bdf8' : seed > 0.68 ? '#f472b6' : seed > 0.5 ? '#fde68a' : '#fef3c7';
        skCtx.fillRect(10 + col * 24, 6 + row * 16, 14, 9);
      } else {
        skCtx.fillStyle = '#162038';
        skCtx.fillRect(10 + col * 24, 6 + row * 16, 14, 9);
      }
    }
  }
  const skyscraperMap = new THREE.CanvasTexture(skyCanvas);
  skyscraperMap.colorSpace = THREE.SRGBColorSpace;
  skyscraperMap.wrapS = THREE.RepeatWrapping;
  skyscraperMap.wrapT = THREE.RepeatWrapping;
  skyscraperMap.anisotropy = aniso;

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
    },
  };
}
