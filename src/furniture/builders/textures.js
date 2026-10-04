import * as THREE from 'three';
import { seededRandom } from '../../house/materials.js';

/**
 * Shared procedural textures for furniture.
 * They are near-white so the material color tints them (texture × color),
 * which keeps recoloring from the materials panel working.
 */

let woodTex = null;
let fabricTex = null;

/** Light wood grain running along the texture's X axis. */
export function getWoodTexture() {
  if (woodTex) return woodTex;
  const w = 1024;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const rand = seededRandom(31);
  ctx.fillStyle = '#f4ece0';
  ctx.fillRect(0, 0, w, h);
  // broad color bands
  for (let i = 0; i < 18; i++) {
    const y = rand() * h;
    const g = ctx.createLinearGradient(0, y - 12, 0, y + 12);
    g.addColorStop(0, 'rgba(150,110,70,0)');
    g.addColorStop(0.5, `rgba(150,110,70,${0.05 + rand() * 0.08})`);
    g.addColorStop(1, 'rgba(150,110,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 12, w, 24);
  }
  // fine wavy grain lines (drawn wrapped so the texture tiles)
  for (let i = 0; i < 140; i++) {
    const y0 = rand() * h;
    const amp = 1 + rand() * 4;
    const freq = (Math.PI * 2 * (1 + Math.floor(rand() * 3))) / w;
    const phase = rand() * Math.PI * 2;
    ctx.strokeStyle = `rgba(120,82,48,${0.06 + rand() * 0.14})`;
    ctx.lineWidth = 0.6 + rand() * 1.2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  woodTex = new THREE.CanvasTexture(c);
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.colorSpace = THREE.SRGBColorSpace;
  woodTex.anisotropy = 8;
  return woodTex;
}

/** Soft woven fabric (linen / boucle look). */
export function getFabricTexture() {
  if (fabricTex) return fabricTex;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const rand = seededRandom(57);
  ctx.fillStyle = '#f6f4f0';
  ctx.fillRect(0, 0, s, s);
  // woven threads
  for (let y = 0; y < s; y += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.025 + rand() * 0.04})`;
    ctx.fillRect(0, y, s, 1);
  }
  for (let x = 0; x < s; x += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.035})`;
    ctx.fillRect(x, 0, 1, s);
  }
  // slubs (irregular thicker threads)
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rand() * s, rand() * s, 2 + rand() * 6, 1);
  }
  fabricTex = new THREE.CanvasTexture(c);
  fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping;
  fabricTex.repeat.set(4, 4);
  fabricTex.colorSpace = THREE.SRGBColorSpace;
  fabricTex.anisotropy = 8;
  return fabricTex;
}
