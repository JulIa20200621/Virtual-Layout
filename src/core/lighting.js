import * as THREE from 'three';
import { PLAN, ROOMS } from '../data/floorplan.js';

const DAY = {
  sky: new THREE.Color('#cfe3f2'),
  hemiSky: new THREE.Color('#eef4fa'),
  hemiGround: new THREE.Color('#e3d9c9'),
  hemi: 0.55,
  env: 0.38,
  sun: 6.5,
};
const NIGHT = {
  sky: new THREE.Color('#0b1430'),
  hemiSky: new THREE.Color('#3c4a70'),
  hemiGround: new THREE.Color('#2a2622'),
  hemi: 0.12,
  env: 0.05,
  sun: 0,
};
const CEILING_LIGHT_INTENSITY = 9; // candela (physically based units)
const TRANSITION_SECONDS = 1;

/**
 * Lighting: hemisphere light, a shadow-casting sun through the windows,
 * one ceiling light per room, and day / night switching (smooth ~1 s blend).
 *
 * Only the sun casts shadows. Ceiling and lamp lights exist all the time
 * (intensity 0 during the day) so toggling never forces shader recompiles.
 */
export class Lighting {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Object3D} furnitureRoot  searched for lamp lights every frame
   */
  constructor(scene, furnitureRoot) {
    this.scene = scene;
    this.furnitureRoot = furnitureRoot;
    this.night = 0; // 0 = day, 1 = night (animated)
    this.targetNight = 0;

    this.hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemi);
    scene.add(this.hemi);

    // Warm, low afternoon sun from the south-west: long light patches through the windows.
    const center = new THREE.Vector3(PLAN.width / 2, 0, PLAN.depth / 2);
    this.sun = new THREE.DirectionalLight('#ffd49c', DAY.sun);
    this.sun.position.copy(center).add(new THREE.Vector3(-3.5, 6, 10));
    this.sun.target.position.copy(center);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera;
    sc.left = -11;
    sc.right = 11;
    sc.top = 11;
    sc.bottom = -11;
    sc.near = 1;
    sc.far = 40;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 5; // soft shadow edges (PCF)
    this.sun.shadow.blurSamples = 16;
    scene.add(this.sun, this.sun.target);

    // Ceiling lights: one per room at the room's center.
    this.ceilingLights = [];
    this.ceilingFixtureMat = new THREE.MeshStandardMaterial({ color: '#f7f5f0', emissive: '#ffe7c2', emissiveIntensity: 0, roughness: 0.5 });
    const discGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.04, 32);
    for (const room of ROOMS) {
      const xs = room.polygon.map((p) => p[0]);
      const zs = room.polygon.map((p) => p[1]);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2;
      const z = (Math.min(...zs) + Math.max(...zs)) / 2;
      const light = new THREE.PointLight('#ffd9a8', 0, 0, 2);
      light.position.set(x, PLAN.ceilingHeight - 0.15, z);
      scene.add(light);
      this.ceilingLights.push(light);
      const disc = new THREE.Mesh(discGeo, this.ceilingFixtureMat);
      disc.position.set(x, PLAN.ceilingHeight - 0.02, z);
      scene.add(disc);
    }
    this.apply();
  }

  get isNight() {
    return this.targetNight === 1;
  }

  /** Switch day/night. `instant` skips the transition (used on load). */
  setNight(on, instant = false) {
    this.targetNight = on ? 1 : 0;
    if (instant) {
      this.night = this.targetNight;
      this.apply();
    }
  }

  toggle() {
    this.setNight(!this.isNight);
  }

  update(dt) {
    if (this.night !== this.targetNight) {
      const step = dt / TRANSITION_SECONDS;
      this.night = this.targetNight > this.night ? Math.min(1, this.night + step) : Math.max(0, this.night - step);
    }
    this.apply();
  }

  /** Apply the current day/night blend to every light. */
  apply() {
    const t = this.night;
    const s = t * t * (3 - 2 * t); // smoothstep
    this.scene.background.copy(DAY.sky).lerp(NIGHT.sky, s);
    this.hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, s);
    this.hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, s);
    this.hemi.intensity = THREE.MathUtils.lerp(DAY.hemi, NIGHT.hemi, s);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(DAY.env, NIGHT.env, s);
    this.sun.intensity = THREE.MathUtils.lerp(DAY.sun, NIGHT.sun, s);
    for (const l of this.ceilingLights) l.intensity = CEILING_LIGHT_INTENSITY * s;
    this.ceilingFixtureMat.emissiveIntensity = 1.5 * s;

    // Lamps (table / floor lamps) placed anywhere in the furniture tree.
    this.furnitureRoot.traverse((o) => {
      if (o.isLight && o.userData.lampLight) o.intensity = o.userData.lampLight.intensity * s;
      else if (o.isMesh && o.material?.userData?.lampGlow) o.material.emissiveIntensity = 0.9 * s;
    });
  }
}
