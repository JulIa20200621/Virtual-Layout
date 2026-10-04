import * as THREE from 'three';
import { box, cyl, cushion, legs, primary, mat, woodMat, metalMat, darkMat, fabric as upholstery, woodPrimary } from './helpers.js';
import { getFabricTexture } from './textures.js';

/** Bed with frame, mattress, duvet, pillows and headboard (headboard at −Z). */
function bed(width, color, pillowCount) {
  return () => {
    const g = new THREE.Group();
    const L = 2.0;
    const wood = woodMat();
    const fabric = upholstery(color);
    const white = mat('#f6f4ef', { roughness: 0.95, map: getFabricTexture() });
    const duvetMat = mat('#ebe6dc', { roughness: 0.95, map: getFabricTexture() });

    legs(g, width, L, 0.12, 0.06, wood, 0.03);
    box(g, width, 0.2, L, wood, 0, 0.12, 0); // frame
    cushion(g, width - 0.06, 0.22, L - 0.08, white, 0, 0.3, 0.02); // mattress
    cushion(g, width - 0.02, 0.07, L * 0.62, duvetMat, 0, 0.5, L * 0.18); // duvet
    cushion(g, width + 0.02, 0.04, 0.35, fabric, 0, 0.53, L * 0.36); // throw blanket
    const pw = pillowCount === 1 ? width * 0.7 : width / 2 - 0.08;
    for (let i = 0; i < pillowCount; i++) {
      const x = pillowCount === 1 ? 0 : (i === 0 ? -1 : 1) * (width / 4 + 0.01);
      const p = cushion(g, pw, 0.13, 0.4, white, x, 0.5, -L / 2 + 0.32);
      p.rotation.x = -0.25;
    }
    cushion(g, width, 1.0, 0.08, fabric, 0, 0, -L / 2 + 0.04); // upholstered headboard
    return g;
  };
}

export const buildDoubleBed = (color) => bed(1.6, color, 2)();
export const buildSingleBed = (color) => bed(0.9, color, 1)();

/** Wardrobe 1.2 × 0.6 × 2.0 with two doors. */
export function buildWardrobe(color) {
  const g = new THREE.Group();
  const body = primary(color, { roughness: 0.6 });
  const gap = mat('#a59f95');
  const metal = metalMat();
  box(g, 1.2, 0.08, 0.56, mat('#d8d3c9'), 0, 0, -0.01); // plinth
  box(g, 1.2, 1.92, 0.6, body, 0, 0.08, 0);
  box(g, 0.006, 1.86, 0.01, gap, 0, 0.11, 0.3); // center gap between doors
  for (const sx of [-1, 1]) {
    box(g, 0.02, 0.35, 0.03, metal, sx * 0.05, 0.95, 0.31); // handles
  }
  return g;
}

/** Nightstand with a drawer and short legs. Surface. */
export function buildNightstand(color) {
  const g = new THREE.Group();
  const body = primary(color, { roughness: 0.6 });
  const wood = woodMat();
  legs(g, 0.45, 0.4, 0.12, 0.035, wood, 0.03, true);
  box(g, 0.45, 0.38, 0.4, body, 0, 0.12, 0);
  box(g, 0.41, 0.004, 0.005, mat('#a59f95'), 0, 0.31, 0.2);
  cyl(g, 0.012, 0.012, 0.02, wood, 0, 0.21, 0.205, 10).rotation.x = Math.PI / 2;
  return g;
}

/** Desk with four legs and a small drawer. Surface. */
export function buildDesk(color) {
  const g = new THREE.Group();
  const top = woodPrimary(color);
  const frame = mat('#f2f0eb', { roughness: 0.6 });
  cushion(g, 1.2, 0.03, 0.6, top, 0, 0.72, 0); // rounded-edge top
  legs(g, 1.2, 0.6, 0.72, 0.04, frame, 0.03);
  box(g, 0.45, 0.12, 0.5, frame, 0.3, 0.6, 0); // drawer
  box(g, 0.12, 0.015, 0.01, darkMat(), 0.3, 0.655, 0.255);
  return g;
}

/** Office chair: star base, gas lift, seat, backrest at −Z. */
export function buildDeskChair(color) {
  const g = new THREE.Group();
  const seatMat = upholstery(color);
  const black = darkMat();
  const metal = metalMat();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = box(g, 0.04, 0.03, 0.26, metal, Math.sin(a) * 0.12, 0.05, Math.cos(a) * 0.12);
    arm.rotation.y = a;
    const wheel = cyl(g, 0.025, 0.025, 0.03, black, Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25, 10);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = 0.025;
  }
  cyl(g, 0.025, 0.025, 0.36, metal, 0, 0.08, 0, 12);
  cushion(g, 0.48, 0.07, 0.46, seatMat, 0, 0.44, 0.02);
  box(g, 0.04, 0.3, 0.03, metal, 0, 0.47, -0.21);
  const back = cushion(g, 0.44, 0.38, 0.06, seatMat, 0, 0.55, -0.22);
  back.rotation.x = -0.08;
  return g;
}
