import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Objects on this layer are drawn normally but ignored by ambient occlusion
 * (window glass, the translucent "ghost" of a held item).
 */
export const NO_AO_LAYER = 1;

/**
 * Creates the renderer, scene, camera and post-processing chain
 * (scene → ambient occlusion → tone mapping / sRGB output), and keeps them sized to the window.
 * @param {HTMLElement} container
 */
export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // soft edges come from light.shadow.radius
  // Shadows are refreshed once per frame in render(), not again for every AO pass.
  renderer.shadowMap.autoUpdate = false;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cfe3f2');
  // Soft image-based light so materials (especially metals) don't look flat or black.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 300);
  camera.rotation.order = 'YXZ';
  camera.layers.enable(NO_AO_LAYER);

  // ─── Post-processing ────────────────────────────────────────────────────
  // Multisampled render target = anti-aliasing (the default composer target has none).
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  // The AO pass gets its own camera that only sees layer 0 (so glass / ghosts don't darken things).
  const aoCamera = camera.clone();
  const ao = new GTAOPass(scene, aoCamera, size.x, size.y);
  ao.updateGtaoMaterial({ radius: 0.3, distanceExponent: 1.5, thickness: 0.6, scale: 1.0, samples: 12 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 8, rings: 2, samples: 16 });
  ao.blendIntensity = 0.85;
  composer.addPass(ao);
  composer.addPass(new OutputPass());

  function render() {
    aoCamera.copy(camera);
    aoCamera.layers.set(0);
    renderer.shadowMap.needsUpdate = true; // consumed by the first render of the frame
    composer.render();
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(window.innerWidth, window.innerHeight);
  });
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);

  return { renderer, scene, camera, render };
}
