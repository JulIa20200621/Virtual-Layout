import * as THREE from 'three';
import { box, cushion, legs, primary, mat, woodMat, darkMat, fabric as upholstery, woodPrimary } from './helpers.js';
import { getFabricTexture } from './textures.js';
import { seededRandom } from '../../house/materials.js';

/** 3-seat sofa 2.1 × 0.9 × 0.85 (back at −Z). */
export function buildSofa(color) {
  const g = new THREE.Group();
  const fabric = upholstery(color);
  const wood = woodMat();
  const W = 2.1;
  const D = 0.9;
  legs(g, W, D, 0.1, 0.05, wood, 0.06, true);
  cushion(g, W, 0.25, D, fabric, 0, 0.1, 0); // base
  const armW = 0.16;
  for (const sx of [-1, 1]) cushion(g, armW, 0.33, D, fabric, sx * (W / 2 - armW / 2), 0.32, 0); // armrests
  cushion(g, W - 2 * armW, 0.45, 0.2, fabric, 0, 0.33, -D / 2 + 0.1); // backrest
  const seatW = (W - 2 * armW) / 3;
  for (let i = 0; i < 3; i++) {
    const x = -W / 2 + armW + seatW * (i + 0.5);
    cushion(g, seatW - 0.01, 0.13, D - 0.24, fabric, x, 0.33, 0.1); // seat cushions
    const back = cushion(g, seatW - 0.02, 0.38, 0.14, fabric, x, 0.45, -D / 2 + 0.25); // back cushions
    back.rotation.x = -0.12;
  }
  // Two accent throw pillows in the corners
  const pillow = mat('#e9e3d8', { roughness: 1, map: getFabricTexture() });
  for (const sx of [-1, 1]) {
    const p = cushion(g, 0.42, 0.4, 0.13, pillow, sx * (W / 2 - armW - 0.25), 0.44, -D / 2 + 0.38);
    p.rotation.set(-0.25, sx * -0.25, sx * 0.08);
  }
  return g;
}

/** Armchair 0.85 × 0.85 × 0.85. */
export function buildArmchair(color) {
  const g = new THREE.Group();
  const fabric = upholstery(color);
  const wood = woodMat();
  legs(g, 0.8, 0.8, 0.14, 0.04, wood, 0.06, true);
  cushion(g, 0.85, 0.22, 0.85, fabric, 0, 0.14, 0);
  for (const sx of [-1, 1]) cushion(g, 0.13, 0.28, 0.85, fabric, sx * 0.36, 0.34, 0);
  const back = cushion(g, 0.6, 0.48, 0.16, fabric, 0, 0.36, -0.34);
  back.rotation.x = -0.1;
  cushion(g, 0.58, 0.12, 0.62, fabric, 0, 0.35, 0.08);
  return g;
}

/** Coffee table 1.1 × 0.6 × 0.42 with lower shelf. Surface. */
export function buildCoffeeTable(color) {
  const g = new THREE.Group();
  const top = woodPrimary(color);
  const wood = woodMat();
  cushion(g, 1.1, 0.04, 0.6, top, 0, 0.38, 0); // rounded-edge top
  legs(g, 1.1, 0.6, 0.38, 0.045, wood, 0.04, true);
  box(g, 0.96, 0.02, 0.46, wood, 0, 0.12, 0);
  return g;
}

/** TV stand 1.6 × 0.4 × 0.5 with a TV on top (TV is part of the item). Surface. */
export function buildTVStand(color) {
  const g = new THREE.Group();
  const body = primary(color, { roughness: 0.55 });
  const wood = woodMat();
  const black = darkMat();
  legs(g, 1.6, 0.4, 0.1, 0.035, wood, 0.05, true);
  box(g, 1.6, 0.4, 0.4, body, 0, 0.1, 0);
  for (const x of [-0.4, 0.4]) box(g, 0.004, 0.36, 0.005, mat('#a59f95'), x, 0.12, 0.2);
  // TV
  box(g, 0.3, 0.012, 0.18, black, 0, 0.5, -0.1);
  box(g, 0.05, 0.08, 0.03, black, 0, 0.51, -0.1);
  box(g, 1.23, 0.72, 0.04, black, 0, 0.56, -0.1);
  box(g, 1.19, 0.68, 0.005, mat('#0d0f12', { roughness: 0.1, metalness: 0.3 }), 0, 0.58, -0.078); // screen
  return g;
}

/** Dining table 1.4 × 0.8 × 0.75. Surface. */
export function buildDiningTable(color) {
  const g = new THREE.Group();
  const top = woodPrimary(color);
  cushion(g, 1.4, 0.035, 0.8, top, 0, 0.715, 0); // rounded-edge top
  legs(g, 1.4, 0.8, 0.715, 0.05, woodMat(), 0.06, true);
  box(g, 1.2, 0.07, 0.62, woodMat(), 0, 0.645, 0); // apron
  return g;
}

/** Dining chair (back at −Z). */
export function buildDiningChair(color) {
  const g = new THREE.Group();
  const wood = woodMat();
  const seat = upholstery(color);
  legs(g, 0.44, 0.44, 0.43, 0.035, wood, 0.01, true);
  cushion(g, 0.45, 0.05, 0.45, seat, 0, 0.43, 0);
  // back posts + rail
  for (const sx of [-1, 1]) box(g, 0.035, 0.42, 0.035, wood, sx * 0.19, 0.46, -0.2);
  const rail = box(g, 0.42, 0.14, 0.025, wood, 0, 0.7, -0.205);
  rail.rotation.x = -0.05;
  return g;
}

/** Bookshelf 0.8 × 0.3 × 1.8 with books. */
export function buildBookshelf(color) {
  const g = new THREE.Group();
  const body = primary(color, { roughness: 0.6 });
  const t = 0.022;
  box(g, t, 1.8, 0.3, body, -0.4 + t / 2, 0, 0);
  box(g, t, 1.8, 0.3, body, 0.4 - t / 2, 0, 0);
  box(g, 0.8, 1.8, 0.01, body, 0, 0, -0.145);
  const shelfYs = [0.04, 0.4, 0.78, 1.16, 1.54, 1.78];
  for (const y of shelfYs) box(g, 0.8 - 2 * t, t, 0.29, body, 0, y - t / 2, 0.005);
  // Books (deterministic random)
  const rand = seededRandom(42);
  const bookColors = ['#b7c4b0', '#e3c6c1', '#c9d8e3', '#e3d5bd', '#8e918f', '#f4f1ea', '#9b7550', '#4f5a63'];
  for (let s = 0; s < 4; s++) {
    let x = -0.4 + t + 0.01;
    const base = shelfYs[s] + t / 2;
    const maxX = 0.4 - t - 0.01 - (s % 2 ? 0.2 : 0.05);
    while (x < maxX) {
      const bw = 0.025 + rand() * 0.03;
      if (x + bw > maxX) break;
      const bh = 0.2 + rand() * 0.1;
      const book = box(g, bw, bh, 0.2 + rand() * 0.05, mat(bookColors[Math.floor(rand() * bookColors.length)], { roughness: 0.8 }), x + bw / 2, base, 0.02);
      if (rand() > 0.9) book.rotation.z = 0.12;
      x += bw + 0.002;
    }
  }
  return g;
}
