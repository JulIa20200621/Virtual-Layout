import * as THREE from 'three';

/**
 * Fixed fixtures: kitchen (L-shaped counter, sink, cooktop, upper cabinets, fridge)
 * and bathroom (bathtub, toilet, vanity + mirror).
 *
 * Fixtures are not movable, but they are collidable, and the countertops / vanity
 * top are "surfaces" small items can be placed on.
 *
 * All coordinates are world meters (see data/floorplan.js).
 */
export function buildFixtures() {
  const group = new THREE.Group();
  group.name = 'fixtures';
  /** Collision boxes. */
  const colliders = [];
  /** Meshes that block aiming / can be targeted. */
  const meshes = [];

  const M = {
    front: new THREE.MeshStandardMaterial({ color: '#eeebe5', roughness: 0.55 }),
    counter: new THREE.MeshStandardMaterial({ color: '#c9a77c', roughness: 0.45 }),
    gap: new THREE.MeshStandardMaterial({ color: '#b9b5ad', roughness: 0.8 }),
    plinth: new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.8 }),
    steel: new THREE.MeshStandardMaterial({ color: '#b8bcbf', roughness: 0.25, metalness: 0.85 }),
    black: new THREE.MeshStandardMaterial({ color: '#1d1e20', roughness: 0.15, metalness: 0.2 }),
    burner: new THREE.MeshStandardMaterial({ color: '#3a3b3e', roughness: 0.5 }),
    fridge: new THREE.MeshStandardMaterial({ color: '#e6e6e3', roughness: 0.3, metalness: 0.25 }),
    ceramic: new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 0.15 }),
    basinIn: new THREE.MeshStandardMaterial({ color: '#e2e3e1', roughness: 0.2 }),
    mirror: new THREE.MeshStandardMaterial({ color: '#dfe7ea', roughness: 0.02, metalness: 1.0 }),
    vanity: new THREE.MeshStandardMaterial({ color: '#cfb48e', roughness: 0.6 }),
  };

  /**
   * Add a box given its world extents.
   * @param {[number,number]} xr  x range
   * @param {[number,number]} yr  y range
   * @param {[number,number]} zr  z range
   * @param {THREE.Material} mat
   * @param {{collide?:boolean, surface?:boolean}} [opts]
   */
  function box(xr, yr, zr, mat, opts = {}) {
    const w = xr[1] - xr[0];
    const h = yr[1] - yr[0];
    const d = zr[1] - zr[0];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set((xr[0] + xr[1]) / 2, (yr[0] + yr[1]) / 2, (zr[0] + zr[1]) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isFixture = true;
    if (opts.surface) {
      // Top of this mesh is a valid surface for small items.
      mesh.userData.surface = {
        y: yr[1],
        box: { cx: mesh.position.x, cz: mesh.position.z, hx: w / 2, hz: d / 2, rot: 0, y0: yr[0], y1: yr[1] },
      };
    }
    group.add(mesh);
    meshes.push(mesh);
    if (opts.collide) {
      colliders.push({ cx: mesh.position.x, cz: mesh.position.z, hx: w / 2, hz: d / 2, rot: 0, y0: yr[0], y1: yr[1], kind: 'fixture' });
    }
    return mesh;
  }

  function cylinder(r, h, x, y0, z, mat, segments = 24) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), mat);
    mesh.position.set(x, y0 + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isFixture = true;
    group.add(mesh);
    meshes.push(mesh);
    return mesh;
  }

  // ═══ KITCHEN ═══════════════════════════════════════════════════════════
  const CT = 0.9; // countertop height

  // East run (along the east wall)
  box([9.36, 9.9], [0, 0.1], [3.85, 6.4], M.plinth);
  box([9.3, 9.9], [0.1, CT - 0.04], [3.85, 6.4], M.front, { collide: false });
  box([9.28, 9.9], [CT - 0.04, CT], [3.85, 6.42], M.counter, { surface: true });
  colliders.push({ cx: 9.59, cz: 5.135, hx: 0.31, hz: 1.285, rot: 0, y0: 0, y1: CT, kind: 'fixture' });

  // North run (along the north wall)
  box([7.4, 9.36], [0, 0.1], [3.85, 4.39], M.plinth);
  box([7.4, 9.3], [0.1, CT - 0.04], [3.85, 4.45], M.front);
  box([7.38, 9.28], [CT - 0.04, CT], [3.85, 4.47], M.counter, { surface: true });
  colliders.push({ cx: 8.33, cz: 4.16, hx: 0.95, hz: 0.31, rot: 0, y0: 0, y1: CT, kind: 'fixture' });

  // Cabinet door gaps + handles on the fronts
  for (let z = 3.85 + 0.6; z < 6.4; z += 0.6) box([9.295, 9.302], [0.12, CT - 0.06], [z - 0.003, z + 0.003], M.gap);
  for (let z = 4.15; z < 6.4; z += 0.6) box([9.27, 9.3], [CT - 0.14, CT - 0.12], [z - 0.12, z + 0.12], M.steel);
  for (let x = 7.4 + 0.6; x < 9.3; x += 0.6) box([x - 0.003, x + 0.003], [0.12, CT - 0.06], [4.448, 4.455], M.gap);
  for (let x = 7.7; x < 9.0; x += 0.6) box([x - 0.12, x + 0.12], [CT - 0.14, CT - 0.12], [4.45, 4.48], M.steel);

  // Sink under the kitchen window
  box([9.42, 9.8], [CT, CT + 0.004], [5.3, 5.9], M.steel);
  box([9.46, 9.76], [CT + 0.004, CT + 0.006], [5.34, 5.86], M.burner);
  cylinder(0.015, 0.28, 9.84, CT, 5.6, M.steel, 12);
  box([9.66, 9.85], [CT + 0.26, CT + 0.28], [5.59, 5.61], M.steel);

  // Cooktop on the north run
  box([8.0, 8.6], [CT, CT + 0.01], [3.92, 4.42], M.black);
  for (const [bx, bz] of [[8.15, 4.04], [8.45, 4.04], [8.15, 4.3], [8.45, 4.3]]) {
    cylinder(0.075, 0.004, bx, CT + 0.01, bz, M.burner, 20);
  }

  // Upper cabinets
  box([7.4, 9.9], [1.45, 2.2], [3.85, 4.2], M.front, { collide: true });
  box([9.55, 9.9], [1.45, 2.2], [4.2, 4.9], M.front, { collide: true });
  for (let x = 7.4 + 0.625; x < 9.9; x += 0.625) box([x - 0.003, x + 0.003], [1.46, 2.19], [4.2, 4.205], M.gap);

  // Fridge
  box([6.65, 7.35], [0, 1.85], [3.85, 4.5], M.fridge, { collide: true });
  box([6.66, 7.34], [1.2, 1.206], [4.5, 4.503], M.gap);
  box([7.25, 7.28], [0.7, 1.15], [4.5, 4.53], M.steel);
  box([7.25, 7.28], [1.3, 1.7], [4.5, 4.53], M.steel);

  // ═══ BATHROOM ══════════════════════════════════════════════════════════

  // Bathtub along the north wall (x 4.05–5.75, z 0.1–0.85)
  const tubTop = 0.55;
  box([4.05, 5.75], [0, 0.12], [0.1, 0.85], M.ceramic);
  box([4.05, 5.75], [0.12, tubTop], [0.1, 0.18], M.ceramic);
  box([4.05, 5.75], [0.12, tubTop], [0.77, 0.85], M.ceramic);
  box([4.05, 4.15], [0.12, tubTop], [0.18, 0.77], M.ceramic);
  box([5.65, 5.75], [0.12, tubTop], [0.18, 0.77], M.ceramic);
  box([4.15, 5.65], [0.12, 0.125], [0.18, 0.77], M.basinIn);
  colliders.push({ cx: 4.9, cz: 0.475, hx: 0.85, hz: 0.375, rot: 0, y0: 0, y1: tubTop, kind: 'fixture' });
  cylinder(0.015, 0.25, 4.1, tubTop, 0.47, M.steel, 12);
  box([4.1, 4.25], [tubTop + 0.23, tubTop + 0.25], [0.46, 0.48], M.steel);

  // Toilet against the west wall
  box([4.05, 4.25], [0.4, 0.8], [1.4, 1.8], M.ceramic, { collide: false });
  const bowl = cylinder(0.17, 0.4, 4.45, 0, 1.6, M.ceramic, 28);
  bowl.scale.set(1.3, 1, 1);
  const seat = cylinder(0.18, 0.03, 4.46, 0.4, 1.6, M.ceramic, 28);
  seat.scale.set(1.3, 1, 1);
  colliders.push({ cx: 4.375, cz: 1.6, hx: 0.325, hz: 0.2, rot: 0, y0: 0, y1: 0.8, kind: 'fixture' });

  // Floating vanity on the east wall with a vessel basin and a mirror
  box([5.67, 6.15], [0.2, 0.82], [1.2, 2.0], M.vanity);
  box([5.65, 6.15], [0.82, 0.86], [1.2, 2.0], M.ceramic, { surface: true });
  colliders.push({ cx: 5.9, cz: 1.6, hx: 0.25, hz: 0.4, rot: 0, y0: 0.2, y1: 0.86, kind: 'fixture' });
  cylinder(0.17, 0.12, 5.9, 0.86, 1.6, M.ceramic, 28);
  cylinder(0.14, 0.003, 5.9, 0.975, 1.6, M.basinIn, 28);
  colliders.push({ cx: 5.9, cz: 1.6, hx: 0.17, hz: 0.17, rot: 0, y0: 0.86, y1: 0.98, kind: 'fixture' });
  cylinder(0.012, 0.22, 6.1, 0.86, 1.6, M.steel, 12);
  box([5.98, 6.1], [1.06, 1.075], [1.594, 1.606], M.steel);
  box([6.13, 6.15], [1.15, 1.95], [1.3, 1.9], M.mirror);

  return { group, colliders, meshes };
}
