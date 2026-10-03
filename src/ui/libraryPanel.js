import * as THREE from 'three';
import { CATALOG, CATEGORIES } from '../data/catalog.js';

/**
 * Furniture library (key B): items grouped by category, each with an
 * auto-generated thumbnail (every item is rendered once to an offscreen canvas).
 */
export class LibraryPanel {
  /** @param {(catalogId:string) => void} onPick */
  constructor(onPick) {
    this.el = document.getElementById('library-panel');
    this.onPick = onPick;
    this.thumbs = null;

    let html = `<div class="panel-header"><h2>Furniture Library</h2><button class="close-btn" data-close>✕</button></div>
      <p class="muted" style="margin:0">Pick an item, then click to place it. Small decor can go on tables, nightstands and counters.</p>`;
    for (const cat of CATEGORIES) {
      html += `<h3>${cat}</h3><div class="lib-grid">`;
      for (const def of CATALOG.filter((c) => c.category === cat)) {
        html += `<button class="lib-item" data-id="${def.id}"><div class="thumb-placeholder"></div><span>${def.name}</span></button>`;
      }
      html += `</div>`;
    }
    this.el.innerHTML = html;
    this.el.querySelectorAll('.lib-item').forEach((btn) => {
      btn.addEventListener('click', () => this.onPick(btn.dataset.id));
    });
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open() {
    this.el.classList.remove('hidden');
    if (!this.thumbs) {
      // Let the panel paint first, then render thumbnails.
      requestAnimationFrame(() => this.renderThumbnails());
    }
  }

  close() {
    this.el.classList.add('hidden');
  }

  /** Render each catalog item once with a small temporary renderer. */
  renderThumbnails() {
    this.thumbs = {};
    const size = 192;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      return; // no thumbnails, the names are enough
    }
    renderer.setSize(size, size);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#c8b9a2', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);

    for (const def of CATALOG) {
      const obj = def.build(def.defaultColor);
      scene.add(obj);
      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2;
      const dist = radius / Math.sin(THREE.MathUtils.degToRad(15)) * 0.9;
      const dir = def.placement === 'wall' ? new THREE.Vector3(0.25, 0.1, 1) : new THREE.Vector3(0.8, 0.65, 1);
      camera.position.copy(center).addScaledVector(dir.normalize(), dist);
      camera.lookAt(center);
      renderer.render(scene, camera);
      this.thumbs[def.id] = renderer.domElement.toDataURL('image/png');
      scene.remove(obj);
      obj.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    renderer.dispose();
    renderer.forceContextLoss();

    this.el.querySelectorAll('.lib-item').forEach((btn) => {
      const url = this.thumbs[btn.dataset.id];
      if (!url) return;
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      btn.querySelector('.thumb-placeholder').replaceWith(img);
    });
  }
}
