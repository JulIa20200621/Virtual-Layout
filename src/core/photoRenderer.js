import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WebGLPathTracer, GradientEquirectTexture } from 'three-gpu-pathtracer';

/** Exposure while path tracing (the interior is lit only by real window light, so it's darker). */
const PT_EXPOSURE = 3.2;

/**
 * Realistic renderer for photo mode, based on GPU path tracing.
 *
 * While the camera is still, the image is refined sample by sample with physically
 * based light transport: sunlight and skylight come in through the windows and
 * bounce around the room (soft shadows, color bleeding, natural falloff).
 * As soon as the camera moves, it falls back to the normal real-time renderer.
 *
 * The path tracer gets a simplified copy of the scene: every mesh is baked into world
 * space and merged per material (one mesh per material), plus copies of the lights
 * that are switched on. Ambient light comes from a sky gradient environment.
 */
export class PhotoRenderer {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.PerspectiveCamera} camera
   * @param {() => void} rasterRender  the normal real-time render (used while moving)
   * @param {import('./lighting.js').Lighting} lighting
   */
  constructor(renderer, scene, camera, rasterRender, lighting) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.rasterRender = rasterRender;
    this.lighting = lighting;
    this.active = false;
    this.pathTracer = null;
    this.sky = new GradientEquirectTexture(128);
    this.proxy = null;
    this.proxyLights = new THREE.Group();
    this._savedExposure = 1;
    this._lastCamera = new THREE.Matrix4();
    this._lastProjection = new THREE.Matrix4();
  }

  get samples() {
    return this.pathTracer && this.active ? this.pathTracer.samples : 0;
  }

  /** Start path tracing the current scene (builds the acceleration structure; may take a moment). */
  start() {
    if (!this.pathTracer) {
      const pt = new WebGLPathTracer(this.renderer);
      pt.bounces = 6;
      pt.filterGlossyFactor = 0.5;
      pt.minSamples = 2;
      pt.renderDelay = 150;
      pt.fadeDuration = 400;
      pt.tiles.set(2, 2);
      pt.rasterizeSceneCallback = () => this.rasterRender();
      this.pathTracer = pt;
    }
    this.disposeProxy();
    this.proxy = this.buildProxyScene();
    this.applyLighting();
    this._savedExposure = this.renderer.toneMappingExposure;
    this.renderer.toneMappingExposure = PT_EXPOSURE;
    this.active = true;
    this.pathTracer.setScene(this.proxy, this.camera);
    this._lastCamera.copy(this.camera.matrixWorld);
    this._lastProjection.copy(this.camera.projectionMatrix);
  }

  /** Back to real-time rendering. */
  stop() {
    if (!this.active) return;
    this.active = false;
    this.renderer.toneMappingExposure = this._savedExposure;
  }

  /** Merge every visible mesh of the real scene into one world-space mesh per material. */
  buildProxyScene() {
    const buckets = new Map(); // material → geometries
    this.scene.updateMatrixWorld(true);
    this.scene.traverseVisible((o) => {
      if (!o.isMesh || !o.geometry?.attributes.position) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      const groups = Array.isArray(o.material) && src.groups.length
        ? src.groups
        : [{ start: 0, count: src.attributes.position.count, materialIndex: 0 }];
      for (const grp of groups) {
        const mat = mats[grp.materialIndex] || mats[0];
        if (!mat || mat.visible === false) continue;
        const part = sliceGeometry(src, grp.start, grp.count);
        part.applyMatrix4(o.matrixWorld);
        if (!buckets.has(mat)) buckets.set(mat, []);
        buckets.get(mat).push(part);
      }
    });
    const proxy = new THREE.Scene();
    for (const [mat, geos] of buckets) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (merged) proxy.add(new THREE.Mesh(merged, mat));
    }
    proxy.add(this.proxyLights);
    return proxy;
  }

  disposeProxy() {
    if (!this.proxy) return;
    this.proxy.traverse((o) => o.isMesh && o.geometry.dispose());
    this.proxy.remove(this.proxyLights);
    this.proxy = null;
  }

  /** Sky + copies of the lights that are currently on, for the current time of day. */
  applyLighting() {
    const night = this.lighting.isNight;
    this.sky.topColor.set(night ? '#0b1430' : '#8fb6e6');
    this.sky.bottomColor.set(night ? '#1a1712' : '#cfc6b4');
    this.sky.exponent = 1.5;
    this.sky.update();
    this.proxy.environment = this.sky;
    this.proxy.environmentIntensity = night ? 0.08 : 1.0;
    this.proxy.background = this.scene.background.clone();

    this.proxyLights.clear();
    const p = new THREE.Vector3();
    this.scene.updateMatrixWorld(true);
    this.scene.traverseVisible((o) => {
      if (!o.isLight || o.intensity <= 0.001) return;
      if (o.isDirectionalLight) {
        const l = new THREE.DirectionalLight(o.color, o.intensity);
        l.position.copy(o.getWorldPosition(p));
        l.target.position.copy(o.target.getWorldPosition(p));
        this.proxyLights.add(l, l.target);
      } else if (o.isPointLight) {
        const l = new THREE.PointLight(o.color, o.intensity, o.distance, o.decay);
        l.position.copy(o.getWorldPosition(p));
        this.proxyLights.add(l);
      }
    });
  }

  /** Call after day/night changes while active. */
  refresh() {
    if (!this.active) return;
    this.applyLighting();
    this.pathTracer.updateEnvironment();
    this.pathTracer.updateLights();
    this.pathTracer.updateMaterials(); // emissive lamp shades / ceiling discs
  }

  /** Render one frame: a new path tracing sample, or the real-time view while moving. */
  render() {
    const cam = this.camera;
    cam.updateMatrixWorld();
    if (!cam.matrixWorld.equals(this._lastCamera) || !cam.projectionMatrix.equals(this._lastProjection)) {
      this._lastCamera.copy(cam.matrixWorld);
      this._lastProjection.copy(cam.projectionMatrix);
      this.pathTracer.updateCamera();
    }
    this.pathTracer.renderSample();
  }
}

/**
 * Copy vertices [start, start + count) of a non-indexed geometry into a new geometry
 * with exactly position / normal / uv (the attributes the merge needs to match).
 */
function sliceGeometry(geo, start, count) {
  const out = new THREE.BufferGeometry();
  const pos = geo.attributes.position;
  const slice = (attr, size) => new THREE.BufferAttribute(
    Float32Array.from({ length: count * size }, (_, i) => attr.array[(start + Math.floor(i / size)) * attr.itemSize + (i % size)] ?? 0),
    size,
  );
  out.setAttribute('position', slice(pos, 3));
  if (geo.attributes.normal) out.setAttribute('normal', slice(geo.attributes.normal, 3));
  else out.computeVertexNormals();
  out.setAttribute('uv', geo.attributes.uv ? slice(geo.attributes.uv, 2) : new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  return out;
}
