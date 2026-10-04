import * as THREE from 'three';
import { PLAN } from '../data/floorplan.js';
import { seededRandom } from './materials.js';

/**
 * What you see through the windows: ground, a few trees close to the house
 * and a ring of simple city buildings in the distance. Purely decorative
 * (not collidable, not raycast).
 */
export function buildSurroundings() {
  const group = new THREE.Group();
  group.name = 'surroundings';
  const rand = seededRandom(2024);
  const cx = PLAN.width / 2;
  const cz = PLAN.depth / 2;

  // Ground: soft green-grey lawn with a paved apron around the house
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#b9c2ad', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.02, cz);
  ground.receiveShadow = true;
  group.add(ground);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(PLAN.width + 6, PLAN.depth + 6), new THREE.MeshStandardMaterial({ color: '#d9d7d1', roughness: 0.95 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(cx, -0.01, cz);
  apron.receiveShadow = true;
  group.add(apron);

  // Trees near the house (they cast soft dappled shadows through the windows)
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6e5440', roughness: 0.9 });
  const leafMats = ['#6f8f5c', '#7e9c68', '#5f7f50'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  const treeSpots = [[-5.5, 10], [8, 12.5], [-5, 3], [13, 10.5], [14, 2], [4, -3.5], [-3, -3]];
  for (const [x, z] of treeSpots) {
    const tree = new THREE.Group();
    const h = 3.5 + rand() * 2.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, h, 8), trunkMat);
    trunk.position.y = h / 2;
    tree.add(trunk);
    for (let i = 0; i < 9; i++) {
      const r = 0.9 + rand() * 0.8;
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMats[i % leafMats.length]);
      leaf.position.set((rand() - 0.5) * 2.4, h - 0.3 + rand() * 1.8, (rand() - 0.5) * 2.4);
      tree.add(leaf);
    }
    tree.position.set(x, 0, z);
    tree.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    group.add(tree);
  }

  // Distant buildings with a window-grid facade
  // One shared facade texture; each building scales its own UVs instead of cloning the texture.
  const facadeTex = new THREE.CanvasTexture(makeFacadeCanvas());
  facadeTex.colorSpace = THREE.SRGBColorSpace;
  facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping;
  const facadeMats = ['#e9e5dd', '#d9d6d0', '#cfd3d6', '#e3ddd2', '#c6c9c9', '#ece9e3'].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, map: facadeTex, roughness: 0.85 }),
  );
  for (let i = 0; i < 34; i++) {
    const ang = (i / 34) * Math.PI * 2 + rand() * 0.12;
    const dist = 38 + rand() * 30;
    const w = 10 + rand() * 14;
    const d = 10 + rand() * 12;
    const h = 12 + rand() * 38;
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * Math.round(w / 3.2), uv.getY(k) * Math.round(h / 3.2)); // ~3.2 m per bay / floor
    const b = new THREE.Mesh(geo, facadeMats[i % facadeMats.length]);
    b.position.set(cx + Math.cos(ang) * dist, h / 2 - 0.02, cz + Math.sin(ang) * dist);
    b.rotation.y = -ang + (rand() - 0.5) * 0.3;
    group.add(b);
  }
  return group;
}

/** One window bay + floor slab, tiled across each building. */
function makeFacadeCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  const g = ctx.createLinearGradient(0, 12, 0, 50);
  g.addColorStop(0, '#9fb2c2');
  g.addColorStop(1, '#7d8f9e');
  ctx.fillStyle = g;
  ctx.fillRect(10, 12, 44, 38);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(31, 12, 2, 38);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 58, 64, 6);
  return c;
}
