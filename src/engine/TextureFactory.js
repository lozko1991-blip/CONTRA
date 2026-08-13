import * as THREE from 'three';

/**
 * TextureFactory — процедурні текстури на canvas.
 *
 * Кожна текстура малюється один раз і кешується.
 * Це дає картам матеріальність (цегла, бетон, дерево, метал)
 * без жодного зовнішнього файлу.
 */

const MATERIAL_PROPS = {
  ground: { roughness: 1, metalness: 0, repeat: 6 },
  grass: { roughness: 1, metalness: 0, repeat: 8 },
  concrete: { roughness: 0.95, metalness: 0, repeat: 2 },
  brick: { roughness: 0.9, metalness: 0, repeat: 2 },
  plaster: { roughness: 0.9, metalness: 0, repeat: 2 },
  wood: { roughness: 0.8, metalness: 0, repeat: 1 },
  crate: { roughness: 0.75, metalness: 0.05, repeat: 1 },
  metal: { roughness: 0.4, metalness: 0.65, repeat: 2 },
  darkMetal: { roughness: 0.45, metalness: 0.7, repeat: 2 },
  roof: { roughness: 0.85, metalness: 0.1, repeat: 3 },
  asphalt: { roughness: 1, metalness: 0, repeat: 6 },
  vent: { roughness: 0.4, metalness: 0.7, repeat: 2 },
  basement: { roughness: 1, metalness: 0, repeat: 2 },
  containerRed: { roughness: 0.6, metalness: 0.4, repeat: 2 },
  containerBlue: { roughness: 0.6, metalness: 0.4, repeat: 2 },
  doorWood: { roughness: 0.7, metalness: 0.05, repeat: 1 },
  doorMetal: { roughness: 0.45, metalness: 0.6, repeat: 1 },
  carBody: { roughness: 0.38, metalness: 0.55, repeat: 2 },
  carBodyBlue: { roughness: 0.38, metalness: 0.55, repeat: 2 },
  carBodyGreen: { roughness: 0.38, metalness: 0.55, repeat: 2 },
  wheel: { roughness: 0.95, metalness: 0, repeat: 1 },
  truckBody: { roughness: 0.55, metalness: 0.45, repeat: 2 },
  truckCab: { roughness: 0.55, metalness: 0.45, repeat: 2 }
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function makeCanvas(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;

  return [canvas, canvas.getContext('2d')];
}

function speckle(
  ctx,
  count,
  colors,
  alphaMin,
  alphaMax,
  sizeMin = 1,
  sizeMax = 3
) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = rand(alphaMin, alphaMax);
    ctx.fillStyle =
      colors[Math.floor(Math.random() * colors.length)];

    ctx.fillRect(
      rand(0, 256),
      rand(0, 256),
      rand(sizeMin, sizeMax),
      rand(sizeMin, sizeMax)
    );
  }

  ctx.globalAlpha = 1;
}

function stains(ctx, count, light, dark) {
  for (let i = 0; i < count; i++) {
    const x = rand(0, 256);
    const y = rand(0, 256);
    const r = rand(18, 70);

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    const color = Math.random() < 0.5 ? light : dark;

    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.globalAlpha = rand(0.04, 0.1);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  ctx.globalAlpha = 1;
}

function cracks(ctx, count, color) {
  ctx.strokeStyle = color;

  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = rand(0.08, 0.2);
    ctx.lineWidth = rand(0.5, 1.4);

    ctx.beginPath();

    let x = rand(0, 256);
    let y = rand(0, 256);

    ctx.moveTo(x, y);

    const steps = 5 + Math.floor(rand(0, 6));

    for (let s = 0; s < steps; s++) {
      x += rand(-28, 28);
      y += rand(-28, 28);
      ctx.lineTo(x, y);
    }

    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function genConcrete(base) {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  stains(ctx, 16, 'rgba(255,255,255,0.5)', 'rgba(20,20,16,0.5)');
  speckle(ctx, 2400, ['#75776f', '#9a9c92', '#66685f'], 0.08, 0.3, 1, 2);
  cracks(ctx, 3, '#3c3d38');

  return canvas;
}

function genBrick() {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = '#6d6862';
  ctx.fillRect(0, 0, 256, 256);

  const brickH = 32;
  const brickW = 64;

  for (let row = 0; row < 8; row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;

    for (let col = -1; col < 5; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;

      const lightness = 34 + Math.floor(rand(-6, 7));

      ctx.fillStyle = `hsl(14, 32%, ${lightness}%)`;
      ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4);

      ctx.globalAlpha = 0.14;
      ctx.fillStyle = Math.random() < 0.5 ? '#000000' : '#ffffff';
      ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4);
      ctx.globalAlpha = 1;

      speckle(ctx, 22, ['#5f443a', '#a06a54', '#7c503f'], 0.1, 0.3, 1, 2);
    }
  }

  speckle(ctx, 500, ['#57534e', '#7a756e'], 0.06, 0.18, 1, 2);

  return canvas;
}

function genPlaster() {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = '#b7a98a';
  ctx.fillRect(0, 0, 256, 256);

  stains(ctx, 12, 'rgba(255,250,235,0.6)', 'rgba(90,75,50,0.5)');

  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = rand(0.03, 0.08);
    ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#6e5c3e';

    ctx.fillRect(rand(0, 256), 0, rand(4, 14), 256);
  }

  ctx.globalAlpha = 1;

  speckle(ctx, 1200, ['#a3946f', '#c9bb99', '#8f8161'], 0.06, 0.2, 1, 2);

  return canvas;
}

function genWood() {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(0, 0, 256, 256);

  let x = 0;

  while (x < 256) {
    const w = rand(2, 7);

    ctx.globalAlpha = rand(0.08, 0.28);
    ctx.fillStyle = Math.random() < 0.5 ? '#5f3d1c' : '#a8743d';
    ctx.fillRect(x, 0, w, 256);

    x += w;
  }

  ctx.globalAlpha = 1;

  for (let y = 0; y < 256; y += 64) {
    ctx.fillStyle = 'rgba(30,18,8,0.55)';
    ctx.fillRect(0, y, 256, 2);

    ctx.fillStyle = 'rgba(255,220,170,0.12)';
    ctx.fillRect(0, y + 2, 256, 1);
  }

  for (let i = 0; i < 3; i++) {
    const kx = rand(20, 236);
    const ky = rand(20, 236);

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#4a2f14';

    ctx.beginPath();
    ctx.ellipse(
      kx,
      ky,
      rand(3, 6),
      rand(5, 9),
      rand(0, Math.PI),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  speckle(ctx, 800, ['#6b4520', '#9c6a35'], 0.05, 0.16, 1, 2);

  return canvas;
}

function genCrate() {
  const canvas = genWood();
  const ctx = canvas.getContext('2d');

  ctx.strokeStyle = '#54371a';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 242, 242);

  ctx.lineWidth = 18;
  ctx.globalAlpha = 0.85;

  ctx.beginPath();
  ctx.moveTo(14, 14);
  ctx.lineTo(242, 242);
  ctx.moveTo(242, 14);
  ctx.lineTo(14, 242);
  ctx.stroke();

  ctx.globalAlpha = 1;

  ctx.fillStyle = '#2c1d0d';

  const nails = [
    [18, 18],
    [238, 18],
    [18, 238],
    [238, 238],
    [128, 128]
  ];

  for (const [nx, ny] of nails) {
    ctx.beginPath();
    ctx.arc(nx, ny, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function genMetal(base) {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  let y = 0;

  while (y < 256) {
    ctx.globalAlpha = rand(0.03, 0.09);
    ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(0, y, 256, 1);

    y += rand(1, 3);
  }

  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, 256, 2);
  ctx.fillRect(0, 128, 256, 2);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';

  for (let rx = 16; rx < 256; rx += 64) {
    for (const ry of [10, 118, 138, 246]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  speckle(ctx, 700, ['#ffffff', '#000000'], 0.03, 0.1, 1, 2);

  return canvas;
}

function genAsphalt() {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = '#3c3f42';
  ctx.fillRect(0, 0, 256, 256);

  stains(ctx, 10, 'rgba(190,195,200,0.4)', 'rgba(10,10,12,0.5)');
  speckle(
    ctx,
    3200,
    ['#565a5e', '#2a2c2e', '#6a6e72', '#484c50'],
    0.1,
    0.3,
    1,
    2
  );
  cracks(ctx, 4, '#1e2022');

  return canvas;
}

function genGrass() {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = '#49663c';
  ctx.fillRect(0, 0, 256, 256);

  speckle(
    ctx,
    4200,
    ['#3d5731', '#557a45', '#41633a', '#5d8a4e', '#33492a'],
    0.14,
    0.36,
    1,
    3
  );

  speckle(ctx, 240, ['#6b5a3e', '#7a6a4a'], 0.08, 0.2, 1, 2);

  return canvas;
}

function genRoof() {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = '#4c5257';
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = x % 32 === 0 ? '#565d63' : '#444a4f';
    ctx.fillRect(x, 0, 16, 256);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, 0, 2, 256);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x + 3, 0, 2, 256);
  }

  speckle(ctx, 900, ['#000000', '#ffffff'], 0.03, 0.09, 1, 2);

  return canvas;
}

function genVent() {
  const canvas = genMetal('#9aa3a8');
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0,0,0,0.3)';

  for (let p = 0; p <= 256; p += 64) {
    ctx.fillRect(p, 0, 2, 256);
    ctx.fillRect(0, p, 256, 2);
  }

  return canvas;
}

function genContainer(base) {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 24) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, 0, 12, 256);

    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + 12, 0, 2, 256);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, 256, 14);
  ctx.fillRect(0, 242, 256, 14);

  stains(ctx, 8, 'rgba(255,255,255,0.3)', 'rgba(0,0,0,0.4)');
  speckle(ctx, 900, ['#000000', '#ffffff'], 0.04, 0.12, 1, 2);
  cracks(ctx, 3, 'rgba(255,255,255,0.25)');

  return canvas;
}

function genCar(baseColor) {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 18) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, 0, 8, 256);

    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x + 8, 0, 2, 256);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 128, 256, 3);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 131, 256, 1);

  stains(ctx, 6, 'rgba(255,255,255,0.2)', 'rgba(0,0,0,0.18)');
  speckle(ctx, 400, ['#000000', '#ffffff'], 0.02, 0.06, 1, 1);

  return canvas;
}

function genWheel() {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = '#1c1c1e';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 8; i++) {
    const y = 16 + i * 28;

    ctx.fillStyle = 'rgba(40,42,44,0.6)';
    ctx.fillRect(0, y, 256, 4);

    ctx.fillStyle = 'rgba(10,10,12,0.5)';
    ctx.fillRect(0, y + 4, 256, 2);
  }

  speckle(ctx, 600, ['#2a2c2e', '#0e0e10'], 0.1, 0.25, 1, 2);

  return canvas;
}

function genTruck(baseColor) {
  const [canvas, ctx] = makeCanvas();

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, 0, 16, 256);

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(x + 16, 0, 2, 256);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 64, 256, 3);
  ctx.fillRect(0, 192, 256, 3);

  stains(ctx, 8, 'rgba(255,255,255,0.15)', 'rgba(0,0,0,0.25)');
  speckle(ctx, 500, ['#000000', '#ffffff'], 0.03, 0.08, 1, 1);

  return canvas;
}

const GENERATORS = {
  ground: () => genConcrete('#575a52'),
  grass: genGrass,
  concrete: () => genConcrete('#8b8d84'),
  brick: genBrick,
  plaster: genPlaster,
  wood: genWood,
  crate: genCrate,
  metal: () => genMetal('#7d8388'),
  darkMetal: () => genMetal('#41474c'),
  roof: genRoof,
  asphalt: genAsphalt,
  vent: genVent,
  basement: () => genConcrete('#35352f'),
  containerRed: () => genContainer('#8d4a3a'),
  containerBlue: () => genContainer('#3f5f86'),
  carBody: () => genCar('#8a3a2f'),
  carBodyBlue: () => genCar('#2f4f7a'),
  carBodyGreen: () => genCar('#3f6f3f'),
  wheel: genWheel,
  truckBody: () => genTruck('#4a6a3a'),
  truckCab: () => genTruck('#3a4a5a'),
  doorWood: genWood,
  doorMetal: () => genMetal('#5a5e64')
};

const cache = new Map();

export function getMaterial(key) {
  const realKey = GENERATORS[key] ? key : 'concrete';

  if (cache.has(realKey)) {
    return cache.get(realKey);
  }

  const canvas = GENERATORS[realKey]();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  const props = MATERIAL_PROPS[realKey] ?? {};
  const repeat = props.repeat ?? 1;

  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: props.roughness ?? 0.9,
    metalness: props.metalness ?? 0
  });

  cache.set(realKey, material);

  return material;
}
