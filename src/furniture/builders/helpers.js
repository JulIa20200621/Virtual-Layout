import * as THREE from 'three';
import { getWoodTexture, getFabricTexture } from './textures.js';

/**
 * Small helpers for assembling furniture out of primitives.
 *
 * Conventions for every furniture builder:
 *  - origin = bottom center of the item's footprint
 *  - width along local X, depth along local Z, height along Y
 *  - FRONT faces +Z, BACK faces −Z (e.g. headboard / sofa back at −Z)
 *  - the "primary" material (the one recolored by the materials panel)
 *    is created with `primary(color)`.
 */

/** Material that follows the item's chosen color. */
export function primary(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
  m.userData.isPrimary = true;
  return m;
}

/** Recolorable upholstery (woven fabric texture). */
export function fabric(color, opts = {}) {
  return primary(color, { roughness: 0.95, map: getFabricTexture(), ...opts });
}

/** Recolorable wood (grain texture), e.g. table tops. */
export function woodPrimary(color, opts = {}) {
  return primary(color, { roughness: 0.55, map: getWoodTexture(), ...opts });
}

/** Regular material. */
export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });
}

/** Common materials, created fresh per item so highlights don't leak between items. */
export function woodMat() {
  return mat('#d6b68c', { roughness: 0.6, map: getWoodTexture() });
}
export function darkMat() {
  return mat('#3b3a38', { roughness: 0.5 });
}
export function metalMat() {
  return mat('#b9b8b4', { roughness: 0.3, metalness: 0.8 });
}

/**
 * Add a box to `parent`. (x, y, z) is the box CENTER except that `y` is the BOTTOM.
 * @returns {THREE.Mesh}
 */
export function box(parent, w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  parent.add(mesh);
  return mesh;
}

/** Add a cylinder; `y` is the bottom. */
export function cyl(parent, rTop, rBottom, h, material, x = 0, y = 0, z = 0, segments = 24, openEnded = false) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, openEnded), material);
  mesh.position.set(x, y + h / 2, z);
  parent.add(mesh);
  return mesh;
}

/** Add a sphere centered at (x, y, z). */
export function sphere(parent, r, material, x = 0, y = 0, z = 0, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, segments, Math.max(8, segments * 0.75)), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Four legs at the corners of a w × d rectangle (inset by `inset`). */
export function legs(parent, w, d, h, thickness, material, inset = 0.04, round = false) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - inset - thickness / 2);
      const z = sz * (d / 2 - inset - thickness / 2);
      if (round) cyl(parent, thickness / 2, thickness / 2 * 0.8, h, material, x, 0, z, 12);
      else box(parent, thickness, h, thickness, material, x, 0, z);
    }
  }
}

/** A box with slightly rounded look: just a box with a smaller box on top (cheap "cushion" feel). */
export function cushion(parent, w, h, d, material, x = 0, y = 0, z = 0) {
  const r = Math.min(0.03, h / 3);
  const mesh = new THREE.Mesh(roundedBoxGeometry(w, h, d, r), material);
  mesh.position.set(x, y + h / 2, z);
  parent.add(mesh);
  return mesh;
}

/**
 * Rounded box geometry (extruded rounded rectangle, beveled).
 * Cheap enough for furniture cushions.
 */
export function roundedBoxGeometry(w, h, d, r) {
  // The bevel grows the outline by `bs` on every side, so draw the shape smaller.
  const bs = r * 0.6;
  w -= 2 * bs;
  h -= 2 * bs;
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
  const shape = new THREE.Shape();
  const x = -w / 2 + r;
  const y = -h / 2 + r;
  const iw = w - 2 * r;
  const ih = h - 2 * r;
  shape.moveTo(x, y - r);
  shape.lineTo(x + iw, y - r);
  shape.quadraticCurveTo(x + iw + r, y - r, x + iw + r, y);
  shape.lineTo(x + iw + r, y + ih);
  shape.quadraticCurveTo(x + iw + r, y + ih + r, x + iw, y + ih + r);
  shape.lineTo(x, y + ih + r);
  shape.quadraticCurveTo(x - r, y + ih + r, x - r, y + ih);
  shape.lineTo(x - r, y);
  shape.quadraticCurveTo(x - r, y - r, x, y - r);
  const bt = bs;
  const depth = Math.max(0.001, d - 2 * bt);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 2, curveSegments: 4,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Make every mesh in the group cast & receive shadows. */
export function enableShadows(group) {
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}
