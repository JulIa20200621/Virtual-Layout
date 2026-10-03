import * as THREE from 'three';

/**
 * Procedural textures & material presets.
 * All textures are drawn on <canvas> elements — no image files.
 *
 * Floor UVs are in meters (see buildHouse.js), so `texture.repeat` = 1 / (meters covered by the canvas).
 */

// ─── Small deterministic random generator (so textures look the same every load) ───
export function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/** Shift an [r,g,b] color by `amount` (−255..255) and return a CSS string. */
function shade([r, g, b], amount) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ─── Floor canvases ────────────────────────────────────────────────────────

/** Wooden planks running along X. Canvas covers 2 × 2 m. */
function drawPlanks(base, grainDark, seed) {
  const size = 1024;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rand = seededRandom(seed);
  const pxPerM = size / 2;
  const plankW = 0.2 * pxPerM; // 20 cm wide planks
  const rows = Math.round(size / plankW);

  for (let row = 0; row < rows; row++) {
    const y = row * plankW;
    let x = -rand() * pxPerM; // stagger
    while (x < size) {
      const len = (0.8 + rand() * 0.9) * pxPerM;
      const tone = (rand() - 0.5) * 26;
      // Draw the plank twice when it crosses the right edge, so the texture tiles seamlessly.
      for (const off of [0, -size, size]) {
        const px = x + off;
        if (px + len < 0 || px > size) continue;
        ctx.fillStyle = shade(base, tone);
        ctx.fillRect(px, y, len, plankW);
        // grain lines
        ctx.strokeStyle = shade(grainDark, tone);
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 1;
        const grainRand = seededRandom(Math.floor((x + 1000) * 13 + row * 7));
        for (let g = 0; g < 9; g++) {
          const gy = y + 3 + grainRand() * (plankW - 6);
          const amp = 1 + grainRand() * 2.5;
          const freq = 0.01 + grainRand() * 0.02;
          ctx.beginPath();
          for (let gx = 0; gx <= len; gx += 8) {
            const yy = gy + Math.sin(gx * freq + g) * amp;
            if (gx === 0) ctx.moveTo(px + gx, yy);
            else ctx.lineTo(px + gx, yy);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // plank end gap
        ctx.fillStyle = shade(grainDark, -10);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(px, y, 2, plankW);
        ctx.globalAlpha = 1;
      }
      x += len;
    }
    // long gap between rows
    ctx.fillStyle = shade(grainDark, -20);
    ctx.globalAlpha = 0.45;
    ctx.fillRect(0, y, size, 2);
    ctx.globalAlpha = 1;
  }
  return { canvas: c, meters: 2 };
}

/** Square tiles with grout. Canvas covers 2 × 2 m (0.5 m tiles). */
function drawTiles(base, grout, seed) {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rand = seededRandom(seed);
  const n = 4;
  const t = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = shade(base, (rand() - 0.5) * 10);
      ctx.fillRect(i * t, j * t, t, t);
      // fine speckle
      for (let k = 0; k < 120; k++) {
        ctx.fillStyle = shade(base, (rand() - 0.5) * 30);
        ctx.globalAlpha = 0.25;
        ctx.fillRect(i * t + rand() * t, j * t + rand() * t, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = `rgb(${grout.join(',')})`;
  for (let i = 0; i <= n; i++) {
    ctx.fillRect(i * t - 2, 0, 4, size);
    ctx.fillRect(0, i * t - 2, size, 4);
  }
  return { canvas: c, meters: 2 };
}

/** White marble slabs (1 m) with soft grey veins. Canvas covers 2 × 2 m. */
function drawMarble(seed) {
  const size = 1024;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rand = seededRandom(seed);
  ctx.fillStyle = '#f1efec';
  ctx.fillRect(0, 0, size, size);
  // cloudy patches
  for (let i = 0; i < 40; i++) {
    const g = ctx.createRadialGradient(rand() * size, rand() * size, 0, rand() * size, rand() * size, 80 + rand() * 160);
    g.addColorStop(0, 'rgba(200,198,195,0.18)');
    g.addColorStop(1, 'rgba(200,198,195,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  // veins
  for (let v = 0; v < 14; v++) {
    ctx.strokeStyle = `rgba(120,118,115,${0.15 + rand() * 0.25})`;
    ctx.lineWidth = 0.6 + rand() * 1.8;
    let x = rand() * size;
    let y = rand() * size;
    let ang = rand() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 60; s++) {
      ang += (rand() - 0.5) * 0.6;
      x += Math.cos(ang) * 12;
      y += Math.sin(ang) * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // slab joints
  ctx.fillStyle = 'rgba(180,178,175,0.8)';
  for (let i = 0; i <= 2; i++) {
    ctx.fillRect(i * (size / 2) - 1, 0, 2, size);
    ctx.fillRect(0, i * (size / 2) - 1, size, 2);
  }
  return { canvas: c, meters: 2 };
}

/** Polished concrete: soft mottled noise. Canvas covers 3 × 3 m. */
function drawConcrete(seed) {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rand = seededRandom(seed);
  ctx.fillStyle = '#b9b7b2';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 20 + rand() * 90;
    const dark = rand() > 0.5;
    // draw wrapped copies so the texture tiles seamlessly
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, dark ? 'rgba(90,88,85,0.10)' : 'rgba(235,233,228,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(70,70,70,0.25)' : 'rgba(255,255,255,0.25)';
    ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5);
  }
  return { canvas: c, meters: 3 };
}

/**
 * Floor presets. `draw` returns { canvas, meters } where `meters` is the
 * real-world size covered by one copy of the canvas.
 */
export const FLOOR_PRESETS = {
  lightOak: { name: 'Light Oak', roughness: 0.7, draw: () => drawPlanks([214, 188, 150], [150, 118, 80], 11) },
  walnut: { name: 'Walnut', roughness: 0.6, draw: () => drawPlanks([120, 82, 56], [60, 38, 24], 23) },
  greyTile: { name: 'Grey Tile', roughness: 0.5, draw: () => drawTiles([176, 176, 172], [214, 213, 208], 5) },
  whiteMarble: { name: 'White Marble', roughness: 0.25, draw: () => drawMarble(7) },
  concrete: { name: 'Concrete', roughness: 0.85, draw: () => drawConcrete(3) },
};

/** Wall color swatches. */
export const WALL_SWATCHES = [
  { name: 'Warm White', color: '#f5f2ec' },
  { name: 'Soft Grey', color: '#d9d9d6' },
  { name: 'Sage', color: '#b7c4b0' },
  { name: 'Dusty Pink', color: '#e3c6c1' },
  { name: 'Pale Blue', color: '#c9d8e3' },
  { name: 'Sand', color: '#e3d5bd' },
];

/** Furniture color swatches (Scandinavian neutrals). */
export const FURNITURE_SWATCHES = [
  '#e8e2d6', '#cfc6b6', '#b9b9b4', '#8e918f', '#a9b8a3', '#7f9183',
  '#c9a77c', '#9b7550', '#d9b8b0', '#9fb3c4', '#4f5a63', '#f4f1ea',
];

// Texture cache: each preset is drawn only once.
const floorTextureCache = new Map();

/** @returns {THREE.CanvasTexture} the (shared) texture for a floor preset. */
export function getFloorTexture(presetId) {
  if (floorTextureCache.has(presetId)) return floorTextureCache.get(presetId);
  const preset = FLOOR_PRESETS[presetId] || FLOOR_PRESETS.lightOak;
  const { canvas, meters } = preset.draw();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / meters, 1 / meters);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  floorTextureCache.set(presetId, tex);
  return tex;
}

const previewCache = new Map();
/** Small preview image (data URL) for the materials panel. */
export function getFloorPreviewURL(presetId) {
  if (previewCache.has(presetId)) return previewCache.get(presetId);
  const tex = getFloorTexture(presetId);
  const src = tex.image;
  const c = makeCanvas(96);
  c.getContext('2d').drawImage(src, 0, 0, src.width / 2, src.height / 2, 0, 0, 96, 96);
  previewCache.set(presetId, c.toDataURL());
  return previewCache.get(presetId);
}

/** Apply a floor preset to an existing material (keeps the same material object). */
export function applyFloorPreset(material, presetId) {
  const preset = FLOOR_PRESETS[presetId] || FLOOR_PRESETS.lightOak;
  material.map = getFloorTexture(presetId);
  material.color.set('#ffffff');
  material.roughness = preset.roughness;
  material.needsUpdate = true;
}

/**
 * Keeps one floor material and one wall material per room,
 * and the current material choice for each room.
 */
export class RoomMaterials {
  /** @param {{id:string, defaultFloor:string, defaultWall:string}[]} rooms */
  constructor(rooms) {
    this.rooms = rooms;
    /** @type {Record<string, {floor: THREE.MeshStandardMaterial, wall: THREE.MeshStandardMaterial}>} */
    this.materials = {};
    /** @type {Record<string, {floor:string, wall:string}>} */
    this.state = {};
    for (const room of rooms) {
      this.materials[room.id] = {
        floor: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
        wall: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
      };
    }
    this.setState(this.defaultState());
    /** Called after any change (used by the minimap). */
    this.onChange = () => {};
  }

  defaultState() {
    const s = {};
    for (const r of this.rooms) s[r.id] = { floor: r.defaultFloor, wall: r.defaultWall };
    return s;
  }

  /** @param {'floor'|'wall'} kind */
  set(roomId, kind, value) {
    if (!this.materials[roomId]) return;
    this.state[roomId] = { ...this.state[roomId], [kind]: value };
    if (kind === 'floor') applyFloorPreset(this.materials[roomId].floor, value);
    else this.materials[roomId].wall.color.set(value);
    this.onChange();
  }

  get(roomId, kind) {
    return this.state[roomId]?.[kind];
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /** Apply a full materials state; unknown/missing rooms fall back to defaults. */
  setState(state) {
    const defaults = this.defaultState();
    for (const r of this.rooms) {
      const s = { ...defaults[r.id], ...(state?.[r.id] || {}) };
      if (!FLOOR_PRESETS[s.floor]) s.floor = defaults[r.id].floor;
      this.state[r.id] = s;
      applyFloorPreset(this.materials[r.id].floor, s.floor);
      this.materials[r.id].wall.color.set(s.wall);
    }
    this.onChange?.();
  }
}
