/**
 * Simple 2D collision helpers used by the player and by furniture placement.
 *
 * Everything is described as an oriented box in the X/Z plane plus a height range:
 *   { cx, cz, hx, hz, rot, y0, y1 }
 *   cx/cz  center,  hx/hz  half-size along the box's local X/Z,
 *   rot    rotation around Y (radians, same convention as Object3D.rotation.y),
 *   y0/y1  bottom / top height.
 *
 * @typedef {{cx:number, cz:number, hx:number, hz:number, rot:number, y0:number, y1:number}} Box
 */

/** Local X and Z axes of a box rotated by `rot` around Y (in world X/Z). */
function axes(rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  // Object3D rotation.y: local +X → (cos, -sin), local +Z → (sin, cos)
  return [
    [c, -s],
    [s, c],
  ];
}

/** The 4 corners of a box in world X/Z. */
export function boxCorners(b) {
  const [ax, az] = axes(b.rot);
  const pts = [];
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    pts.push([
      b.cx + ax[0] * b.hx * sx + az[0] * b.hz * sz,
      b.cz + ax[1] * b.hx * sx + az[1] * b.hz * sz,
    ]);
  }
  return pts;
}

/** Height ranges overlap? */
export function heightOverlap(a, b, eps = 0.001) {
  return a.y0 < b.y1 - eps && b.y0 < a.y1 - eps;
}

/**
 * Do two boxes overlap (separating axis test in X/Z + height range)?
 * `eps` shrinks both boxes slightly so touching boxes don't count as overlapping.
 */
export function boxesOverlap(a, b, eps = 0.005) {
  if (!heightOverlap(a, b)) return false;
  const axA = axes(a.rot);
  const axB = axes(b.rot);
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  for (const axis of [...axA, ...axB]) {
    const projA = Math.abs(axA[0][0] * axis[0] + axA[0][1] * axis[1]) * a.hx + Math.abs(axA[1][0] * axis[0] + axA[1][1] * axis[1]) * a.hz;
    const projB = Math.abs(axB[0][0] * axis[0] + axB[0][1] * axis[1]) * b.hx + Math.abs(axB[1][0] * axis[0] + axB[1][1] * axis[1]) * b.hz;
    const dist = Math.abs(dx * axis[0] + dz * axis[1]);
    if (dist >= projA + projB - 2 * eps) return false;
  }
  return true;
}

/** Does a circle (player) at (x, z) with radius r overlap the box in X/Z? */
export function circleOverlapsBox(x, z, r, b) {
  const [ax, az] = axes(b.rot);
  const dx = x - b.cx;
  const dz = z - b.cz;
  // into box-local coordinates
  const lx = dx * ax[0] + dz * ax[1];
  const lz = dx * az[0] + dz * az[1];
  const qx = Math.max(-b.hx, Math.min(b.hx, lx));
  const qz = Math.max(-b.hz, Math.min(b.hz, lz));
  const ddx = lx - qx;
  const ddz = lz - qz;
  return ddx * ddx + ddz * ddz < r * r;
}

/** Is the point (x, z) inside box `outer` (X/Z only), with an optional margin? */
export function pointInBox(x, z, b, margin = 0) {
  const [ax, az] = axes(b.rot);
  const dx = x - b.cx;
  const dz = z - b.cz;
  const lx = dx * ax[0] + dz * ax[1];
  const lz = dx * az[0] + dz * az[1];
  return Math.abs(lx) <= b.hx + margin && Math.abs(lz) <= b.hz + margin;
}
