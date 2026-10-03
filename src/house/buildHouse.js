import * as THREE from 'three';
import { PLAN, WALLS, OPENINGS, ROOMS, roomAt } from '../data/floorplan.js';

/**
 * Builds walls, floors, ceiling, windows and door leaves from the floor plan data.
 *
 * How walls are built:
 *  Each wall is cut into pieces along its length at every opening edge and at
 *  every room corner touching the wall. Each piece is a box; above/below an
 *  opening only the header / the part under the window sill is created.
 *  Each long side of a piece is given the wall material of the room on that side
 *  (or the exterior material), which is what makes per-room wall colors possible.
 *
 * @param {import('./materials.js').RoomMaterials} roomMaterials
 */
export function buildHouse(roomMaterials) {
  const group = new THREE.Group();
  group.name = 'house';

  const H = PLAN.ceilingHeight;
  const trimMat = new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.8 });
  const exteriorMat = new THREE.MeshStandardMaterial({ color: '#e9e8e4', roughness: 0.95 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#fbfbf9', roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#bcd6e8', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const doorMat = new THREE.MeshStandardMaterial({ color: '#f1eee8', roughness: 0.6 });
  const handleMat = new THREE.MeshStandardMaterial({ color: '#9a9a96', roughness: 0.3, metalness: 0.8 });

  /** Meshes the player can aim at (walls). */
  const wallMeshes = [];
  /** Room floor meshes. */
  const floorMeshes = [];
  /** Collision boxes (see core/collision.js). */
  const colliders = [];

  /** Wall material for whatever is at (x, z): a room's wall material or the exterior. */
  const sideMaterial = (x, z) => {
    const room = roomAt(x, z);
    return room ? roomMaterials.materials[room.id].wall : exteriorMat;
  };

  // ─── Walls ───────────────────────────────────────────────────────────────
  for (const wall of WALLS) {
    const horizontal = wall.start[1] === wall.end[1];
    const [sx, sz] = wall.start;
    const len = horizontal ? wall.end[0] - sx : wall.end[1] - sz;
    const t = wall.thickness;
    const openings = OPENINGS.filter((o) => o.wallId === wall.id);

    // Collect cut positions (distance from wall start).
    const cuts = new Set([0, len]);
    for (const o of openings) {
      cuts.add(o.offset - o.width / 2);
      cuts.add(o.offset + o.width / 2);
    }
    for (const room of ROOMS) {
      for (const [vx, vz] of room.polygon) {
        if (horizontal && Math.abs(vz - sz) < t && vx > sx && vx < sx + len) cuts.add(vx - sx);
        if (!horizontal && Math.abs(vx - sx) < t && vz > sz && vz < sz + len) cuts.add(vz - sz);
      }
    }
    const sorted = [...cuts].sort((a, b) => a - b);

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (b - a < 1e-4) continue;
      const mid = (a + b) / 2;
      const opening = openings.find((o) => mid > o.offset - o.width / 2 && mid < o.offset + o.width / 2);
      const spans = opening ? [[0, opening.sill], [opening.sill + opening.height, H]] : [[0, H]];
      for (const [y0, y1] of spans) {
        if (y1 - y0 < 1e-3) continue;
        const cx = horizontal ? sx + mid : sx;
        const cz = horizontal ? sz : sz + mid;
        const pieceLen = b - a;
        const off = t / 2 + 0.05;
        let geo;
        let mats;
        if (horizontal) {
          geo = new THREE.BoxGeometry(pieceLen, y1 - y0, t);
          // material order: +x, -x, +y, -y, +z, -z
          mats = [trimMat, trimMat, trimMat, trimMat, sideMaterial(cx, cz + off), sideMaterial(cx, cz - off)];
        } else {
          geo = new THREE.BoxGeometry(t, y1 - y0, pieceLen);
          mats = [sideMaterial(cx + off, cz), sideMaterial(cx - off, cz), trimMat, trimMat, trimMat, trimMat];
        }
        const mesh = new THREE.Mesh(geo, mats);
        mesh.position.set(cx, (y0 + y1) / 2, cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isWall = true;
        group.add(mesh);
        wallMeshes.push(mesh);
        colliders.push({
          cx, cz, rot: 0, y0, y1,
          hx: horizontal ? pieceLen / 2 : t / 2,
          hz: horizontal ? t / 2 : pieceLen / 2,
          kind: 'wall',
        });
      }
    }

    // ─── Windows & doors in this wall ──────────────────────────────────────
    for (const o of openings) {
      const cx = horizontal ? sx + o.offset : sx;
      const cz = horizontal ? sz : sz + o.offset;
      if (o.type === 'window') addWindow(o, cx, cz, horizontal, t);
      else addDoorLeaf(o, wall, horizontal, t);
    }
  }

  function addWindow(o, cx, cz, horizontal, t) {
    const win = new THREE.Group();
    win.position.set(cx, o.sill + o.height / 2, cz);
    if (!horizontal) win.rotation.y = Math.PI / 2;
    const fw = 0.05; // frame bar width
    const fd = t * 0.7; // frame depth
    const bars = [
      [o.width, fw, 0, o.height / 2 - fw / 2],
      [o.width, fw, 0, -o.height / 2 + fw / 2],
      [fw, o.height, -o.width / 2 + fw / 2, 0],
      [fw, o.height, o.width / 2 - fw / 2, 0],
    ];
    if (o.width > 1.5) bars.push([fw * 0.8, o.height, 0, 0]); // center mullion
    for (const [w, h, x, y] of bars) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, fd), frameMat);
      bar.position.set(x, y, 0);
      bar.castShadow = true;
      win.add(bar);
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(o.width - fw, o.height - fw), glassMat);
    glass.renderOrder = 2;
    win.add(glass);
    // interior / exterior sill board
    if (o.sill > 0.1) {
      const sill = new THREE.Mesh(new THREE.BoxGeometry(o.width + 0.1, 0.03, t + 0.08), frameMat);
      sill.position.set(0, -o.height / 2 - 0.015, 0);
      sill.receiveShadow = true;
      win.add(sill);
    }
    group.add(win);
  }

  function addDoorLeaf(o, wall, horizontal, t) {
    if (!o.swing) return;
    const [sx, sz] = wall.start;
    const dirs = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
    const [nx, nz] = dirs[o.swing.side];
    const leafLen = o.width - 0.03;
    const leafT = 0.04;
    const leafH = o.height - 0.03;
    // position of the leaf along the wall: right next to the hinge edge of the opening
    const along = o.swing.hinge === 'end' ? o.offset + o.width / 2 - leafT / 2 - 0.01 : o.offset - o.width / 2 + leafT / 2 + 0.01;
    const out = t / 2 + leafLen / 2; // distance from wall centerline to leaf center
    let cx;
    let cz;
    let geo;
    if (horizontal) {
      cx = sx + along;
      cz = sz + nz * out;
      geo = new THREE.BoxGeometry(leafT, leafH, leafLen);
    } else {
      cx = sx + nx * out;
      cz = sz + along;
      geo = new THREE.BoxGeometry(leafLen, leafH, leafT);
    }
    const leaf = new THREE.Mesh(geo, doorMat);
    leaf.position.set(cx, leafH / 2 + 0.01, cz);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    leaf.userData.isWall = true;
    leaf.userData.isDoor = true;
    group.add(leaf);
    wallMeshes.push(leaf);

    // handle near the free end of the leaf (both sides)
    const handle = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 0.12 : 0.03, 0.03, horizontal ? 0.03 : 0.12), handleMat);
    const freeOut = t / 2 + leafLen - 0.08;
    handle.position.set(horizontal ? cx : sx + nx * freeOut, 1.0, horizontal ? sz + nz * freeOut : cz);
    group.add(handle);

    colliders.push({
      cx, cz, rot: 0, y0: 0, y1: leafH,
      hx: horizontal ? leafT / 2 : leafLen / 2,
      hz: horizontal ? leafLen / 2 : leafT / 2,
      kind: 'door',
    });
  }

  // ─── Floors (one mesh per room so each room can have its own material) ────
  for (const room of ROOMS) {
    const shape = new THREE.Shape(room.polygon.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2); // shape (x, -z) → world (x, 0, z), facing up; UVs stay in meters
    const mesh = new THREE.Mesh(geo, roomMaterials.materials[room.id].floor);
    mesh.receiveShadow = true;
    mesh.userData.isFloor = true;
    mesh.userData.roomId = room.id;
    group.add(mesh);
    floorMeshes.push(mesh);
  }

  // ─── Ceiling / roof slab ────────────────────────────────────────────────
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(PLAN.width + 0.2, 0.12, PLAN.depth + 0.2),
    new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 0.95 }),
  );
  ceiling.position.set(PLAN.width / 2, H + 0.06, PLAN.depth / 2);
  ceiling.castShadow = true;
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // ─── Exterior ground ────────────────────────────────────────────────────
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: '#d5d6d2', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(PLAN.width / 2, -0.01, PLAN.depth / 2);
  ground.receiveShadow = true;
  group.add(ground);

  return { group, wallMeshes, floorMeshes, colliders };
}
