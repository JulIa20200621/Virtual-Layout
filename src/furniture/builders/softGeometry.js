import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Procedural "soft" shapes for textiles: draped cloth and plump pillows.
 * All UVs are in meters, so fabric textures keep a consistent scale.
 */

/**
 * A sheet of cloth lying on a rectangular top and falling over its edges.
 *
 * The flat sheet is laid on the rectangle x ∈ [−W/2, W/2], z ∈ [z0, z1] at height `top`.
 * Whatever extends past the rectangle wraps over a rounded edge (radius `r`) and
 * hangs straight down for `hang` meters. The head end (z0) does not hang.
 *
 * @param {object} o
 * @param {number} o.width       W, width of the surface it lies on
 * @param {number} o.z0          start (head end) of the cloth on the surface
 * @param {number} o.z1          end of the surface (foot end); the cloth hangs past it
 * @param {number} o.top         surface height
 * @param {number} o.hang        how far the cloth hangs down
 * @param {number} [o.r]         edge radius
 * @param {number} [o.puff]      extra height in the middle (a duvet is puffy)
 * @param {number} [o.wrinkle]   amplitude of small wrinkles
 * @param {boolean} [o.hangFoot] does it hang past the foot end (default true)
 * @param {number} [o.puffZ0]    head end used for the puff profile (lets a blanket follow a duvet's shape)
 */
export function drapeGeometry({ width, z0, z1, top, hang, r = 0.05, puff = 0, wrinkle = 0.004, hangFoot = true, puffZ0 = z0 }) {
  const quarter = (r * Math.PI) / 2;
  const ext = quarter + Math.max(0, hang - r); // sheet length needed to wrap + hang
  const W2 = width / 2;
  const sheetW = width + 2 * ext;
  const sheetL = z1 - z0 + (hangFoot ? ext : 0);
  const geo = new THREE.PlaneGeometry(sheetW, sheetL, Math.ceil(sheetW * 40), Math.ceil(sheetL * 40));
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    // flat sheet coordinates
    const X = pos.getX(i);
    const Z = z0 + (sheetL / 2 - pos.getY(i)); // PlaneGeometry's +Y becomes the head end
    const qx = Math.max(-W2, Math.min(W2, X));
    const qz = Math.max(z0, Math.min(z1, Z));
    const dx = X - qx;
    const dz = Z - qz;
    const d = Math.hypot(dx, dz);
    let x;
    let y;
    let z;
    if (d < 1e-6) {
      // on top: puffy middle + soft wrinkles
      const nx = X / W2;
      const nz = ((Z - puffZ0) / (z1 - puffZ0)) * 2 - 1;
      const bump = Math.max(0, (1 - nx * nx) * (1 - Math.pow(Math.abs(nz), 6)));
      x = X;
      z = Z;
      y = top + puff * Math.sqrt(bump) + wrinkle * Math.sin(X * 11 + Z * 4) * Math.sin(Z * 7 - X * 3);
    } else {
      const ux = dx / d;
      const uz = dz / d;
      let out;
      let down;
      if (d <= quarter) {
        const a = d / r;
        out = r * Math.sin(a);
        down = r * (1 - Math.cos(a));
      } else {
        out = r;
        down = r + (d - quarter);
      }
      // gentle vertical folds in the hanging part
      const along = Math.abs(ux) > Math.abs(uz) ? Z : X;
      const fold = Math.min(1, Math.max(0, (d - quarter) / 0.1)) * 0.012 * Math.sin(along * 22);
      x = qx + ux * (out + fold);
      z = qz + uz * (out + fold);
      y = top - down;
    }
    pos.setXYZ(i, x, y, z);
    uv.setXY(i, X, Z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * A plump pillow: thick in the middle, thin flat seams at the edges, slightly pinched corners.
 * Centered at the origin; lies flat (thickness along Y).
 */
export function pillowGeometry(w, h, d) {
  let geo = new THREE.BoxGeometry(w, h, d, 16, 6, 12);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const pos = geo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const nx = x / (w / 2);
    const nz = z / (d / 2);
    const puff = (1 - Math.pow(Math.abs(nx), 3)) * (1 - Math.pow(Math.abs(nz), 3));
    y *= 0.12 + 0.88 * Math.sqrt(Math.max(0, puff));
    // pinch the corners inward a little
    const corner = Math.pow(Math.abs(nx * nz), 2);
    x *= 1 - 0.06 * corner;
    z *= 1 - 0.08 * corner;
    // edges bulge out slightly at mid-height
    const side = 1 - Math.pow((2 * y) / h, 2);
    x *= 1 + 0.02 * side * (1 - Math.abs(nz));
    z *= 1 + 0.03 * side * (1 - Math.abs(nx));
    pos.setXYZ(i, x, y, z);
    uvs[i * 2] = x;
    uvs[i * 2 + 1] = z;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}
