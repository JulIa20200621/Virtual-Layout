import * as THREE from 'three';
import { box, cyl, sphere, primary, mat, woodMat, darkMat, metalMat } from './helpers.js';
import { seededRandom } from '../../house/materials.js';

const GREENS = ['#6f8f62', '#7fa070', '#5d7d55', '#8aa77a'];

/** Ceramic vase (lathe) with a few green stems and small flowers. Surface item. */
export function buildVase(color) {
  const g = new THREE.Group();
  const profile = [
    [0.0, 0], [0.055, 0], [0.07, 0.03], [0.078, 0.1], [0.07, 0.17], [0.045, 0.23], [0.035, 0.26], [0.042, 0.285], [0.038, 0.29],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const vase = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), primary(color, { roughness: 0.35 }));
  g.add(vase);
  const rand = seededRandom(9);
  const stemMat = mat('#5f7d52');
  const flowerMats = [mat('#f4f1ea'), mat('#e9c9c2'), mat('#f2e3b8')];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand();
    const tilt = 0.12 + rand() * 0.25;
    const len = 0.18 + rand() * 0.14;
    const stem = new THREE.Group();
    stem.position.set(0, 0.24, 0);
    stem.rotation.set(Math.cos(a) * tilt, 0, Math.sin(a) * tilt);
    cyl(stem, 0.004, 0.004, len, stemMat, 0, 0, 0, 6);
    const leaf = sphere(stem, 0.025, mat(GREENS[i % GREENS.length]), 0.015, len * 0.5, 0, 8);
    leaf.scale.set(1, 0.35, 0.5);
    sphere(stem, 0.022 + rand() * 0.01, flowerMats[i % 3], 0, len, 0, 10);
    g.add(stem);
  }
  return g;
}

/** Leaf cluster: a few squashed spheres. */
function foliage(parent, count, radius, spread, y, seed) {
  const rand = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * spread;
    const leaf = sphere(parent, radius * (0.7 + rand() * 0.5), mat(GREENS[Math.floor(rand() * GREENS.length)], { roughness: 0.8 }),
      Math.cos(a) * r, y + (rand() - 0.3) * spread, Math.sin(a) * r, 10);
    leaf.scale.y = 0.8;
  }
}

/** Small potted plant (surface item). */
export function buildSmallPlant(color) {
  const g = new THREE.Group();
  cyl(g, 0.1, 0.075, 0.16, primary(color, { roughness: 0.6 }), 0, 0, 0, 20);
  cyl(g, 0.092, 0.092, 0.01, mat('#4a3b2e'), 0, 0.145, 0, 16);
  foliage(g, 9, 0.07, 0.07, 0.26, 3);
  return g;
}

/** Large floor plant. */
export function buildLargePlant(color) {
  const g = new THREE.Group();
  cyl(g, 0.22, 0.17, 0.42, primary(color, { roughness: 0.6 }), 0, 0, 0, 24);
  cyl(g, 0.2, 0.2, 0.01, mat('#4a3b2e'), 0, 0.4, 0, 16);
  const trunk = mat('#7a5b40');
  cyl(g, 0.02, 0.03, 0.7, trunk, 0, 0.4, 0, 8);
  const branch = cyl(g, 0.012, 0.018, 0.45, trunk, 0.06, 0.75, 0, 8);
  branch.rotation.z = -0.5;
  foliage(g, 12, 0.13, 0.22, 1.15, 17);
  foliage(g, 6, 0.1, 0.12, 0.98, 21);
  return g;
}

/**
 * Warm point light used by lamps; its intensity is controlled by core/lighting.js
 * (off during the day, on at night). Lamp lights never cast shadows (performance).
 */
function lampLight(parent, y, intensity) {
  const light = new THREE.PointLight('#ffcf8f', 0, 6, 2);
  light.position.set(0, y, 0);
  light.castShadow = false;
  light.userData.lampLight = { intensity };
  parent.add(light);
  return light;
}

/** Glowing shade material (emissive at night, controlled by lighting.js). */
function shadeMat(color) {
  const m = primary(color, { roughness: 0.9, side: THREE.DoubleSide, emissive: '#ffcf8f', emissiveIntensity: 0 });
  m.userData.lampGlow = true;
  return m;
}

/** Table lamp (surface item) — emits light at night. */
export function buildTableLamp(color) {
  const g = new THREE.Group();
  cyl(g, 0.07, 0.08, 0.03, woodMat(), 0, 0, 0, 20);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), mat('#e9e4da', { roughness: 0.4 }));
  body.position.y = 0.11;
  body.scale.y = 1.1;
  g.add(body);
  cyl(g, 0.008, 0.008, 0.14, metalMat(), 0, 0.18, 0, 8);
  cyl(g, 0.1, 0.14, 0.17, shadeMat(color), 0, 0.3, 0, 24, true);
  lampLight(g, 0.36, 2.5);
  return g;
}

/** Floor lamp — emits light at night. */
export function buildFloorLamp(color) {
  const g = new THREE.Group();
  const black = darkMat();
  cyl(g, 0.16, 0.17, 0.03, black, 0, 0, 0, 24);
  cyl(g, 0.012, 0.012, 1.35, black, 0, 0.03, 0, 8);
  cyl(g, 0.15, 0.2, 0.25, shadeMat(color), 0, 1.33, 0, 28, true);
  lampLight(g, 1.42, 6);
  return g;
}

// ─── Rugs ──────────────────────────────────────────────────────────────────

let rugTexture = null;
/** Neutral woven pattern; the rug's color tints it (map × color). */
function getRugTexture() {
  if (rugTexture) return rugTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  const rand = seededRandom(77);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.05})`;
    ctx.fillRect(rand() * 512, rand() * 512, 2, 2);
  }
  // borders
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 10;
  ctx.strokeRect(26, 26, 460, 460);
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, 416, 416);
  // simple diamond pattern
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const s = 30 + i * 30;
    ctx.beginPath();
    ctx.moveTo(256, 256 - s);
    ctx.lineTo(256 + s, 256);
    ctx.lineTo(256, 256 + s);
    ctx.lineTo(256 - s, 256);
    ctx.closePath();
    ctx.stroke();
  }
  rugTexture = new THREE.CanvasTexture(c);
  rugTexture.colorSpace = THREE.SRGBColorSpace;
  rugTexture.anisotropy = 8;
  return rugTexture;
}

export function buildRectRug(color) {
  const g = new THREE.Group();
  const m = primary(color, { roughness: 1, map: getRugTexture() });
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.012, 1.4), m);
  rug.position.y = 0.006;
  g.add(rug);
  return g;
}

export function buildRoundRug(color) {
  const g = new THREE.Group();
  const m = primary(color, { roughness: 1, map: getRugTexture() });
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.012, 64), m);
  rug.position.y = 0.006;
  g.add(rug);
  return g;
}

// ─── Wall art ──────────────────────────────────────────────────────────────

const artTextures = new Map();
/** Procedural abstract painting (soft Scandinavian shapes). */
function getArtTexture(seed, aspect) {
  const key = `${seed}-${aspect}`;
  if (artTextures.has(key)) return artTextures.get(key);
  const h = 512;
  const w = Math.round(h * aspect);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const rand = seededRandom(seed);
  const palette = ['#d9b8a6', '#a9b8a3', '#e3d5bd', '#9fb3c4', '#c98f6b', '#4f5a63', '#e8c9a0'];
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.globalAlpha = 0.85;
    const x = rand() * w;
    const y = rand() * h;
    const r = (0.12 + rand() * 0.25) * h;
    ctx.beginPath();
    if (rand() > 0.5) ctx.arc(x, y, r, 0, Math.PI * 2);
    else ctx.arc(x, y, r, Math.PI, Math.PI * 2); // half circles
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#3f3a36';
  ctx.lineWidth = 4;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(rand() * w, rand() * h);
    ctx.bezierCurveTo(rand() * w, rand() * h, rand() * w, rand() * h, rand() * w, rand() * h);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  artTextures.set(key, tex);
  return tex;
}

/** Framed canvas: origin bottom center, picture faces +Z, back at −Z. */
function wallArt(w, h, seed) {
  return (color) => {
    const g = new THREE.Group();
    const d = 0.035;
    const frame = primary(color, { roughness: 0.5 });
    const f = 0.03;
    box(g, w, f, d, frame, 0, 0, 0);
    box(g, w, f, d, frame, 0, h - f, 0);
    box(g, f, h - 2 * f, d, frame, -w / 2 + f / 2, f, 0);
    box(g, f, h - 2 * f, d, frame, w / 2 - f / 2, f, 0);
    box(g, w - 2 * f, h - 2 * f, 0.01, mat('#f7f4ee'), 0, f, -0.008); // passe-partout
    const pic = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 2 * f - 0.08, h - 2 * f - 0.08),
      new THREE.MeshStandardMaterial({ map: getArtTexture(seed, (w - 2 * f - 0.08) / (h - 2 * f - 0.08)), roughness: 0.9 }),
    );
    pic.position.set(0, h / 2, -0.002);
    g.add(pic);
    return g;
  };
}

export const buildWallArtSmall = wallArt(0.5, 0.7, 101);
export const buildWallArtLarge = wallArt(1.0, 0.7, 202);
