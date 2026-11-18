// Rico Vega on foot: a low-poly third-person character with a walk/run cycle,
// a jump, and a camera that orbits on mouse drag and trails behind while
// driving. The same file owns the chase camera for both modes.
import * as THREE from 'three';
import { clamp, lerp, angleStep } from './util.js';
import { CITY_HALF } from './city.js';

/** Build Rico: jacket, jeans, cap — boxes and cylinders, no imported art. */
export function makePlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1e6f5c });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const cap = new THREE.MeshLambertMaterial({ color: 0xf2c14e });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), jacket);
  torso.position.y = 1.18; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.82; head.castShadow = true;
  g.add(head);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 10), cap);
  capTop.position.y = 2.05;
  g.add(capTop);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.26), cap);
  brim.position.set(0, 2.0, 0.28);
  g.add(brim);
  g.userData.legs = [];
  for (const sx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), jeans);
    leg.position.set(sx, 0.39, 0);
    leg.geometry.translate(0, -0.39, 0);
    leg.position.y = 0.78;
    g.add(leg);
    g.userData.legs.push(leg);
  }
  g.userData.arms = [];
  for (const sx of [-0.4, 0.4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), jacket);
    arm.position.set(sx, 1.5, 0);
    arm.geometry.translate(0, -0.3, 0);
    g.add(arm);
    g.userData.arms.push(arm);
  }
  // The pistol, hidden until the player draws it.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x181818 }));
  gun.position.set(0.42, 1.15, 0.3);
  gun.visible = false;
  g.add(gun);
  g.userData.gun = gun;
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.x = 12; this.z = 12;
    this.heading = Math.PI;
    this.speed = 0;
    this.health = 100;
    this.inCar = false;
    this.car = null;
    this.walkPhase = 0;
    this.armed = false;
    this.y = 0;
    this.vy = 0;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 8;
    this._camPos = new THREE.Vector3(12, 6, 20);
  }

  get pos() { return { x: this.x, z: this.z }; }

  /** Move on foot. `ax`/`ay` are camera-relative axes, -1..1. Returns speed. */
  moveOnFoot(dt, ax, ay, sprint, colliders) {
    const targetSpeed = sprint ? 9.5 : 5.2;
    const moving = Math.hypot(ax, ay) > 0.1;
    this.speed += ((moving ? targetSpeed : 0) - this.speed) * Math.min(1, dt * 10);
    if (moving) {
      // Movement is relative to the camera yaw.
      const fwdX = Math.sin(this.camYaw), fwdZ = Math.cos(this.camYaw);
      const rightX = Math.sin(this.camYaw - Math.PI / 2), rightZ = Math.cos(this.camYaw - Math.PI / 2);
      const mx = fwdX * ay + rightX * ax;
      const mz = fwdZ * ay + rightZ * ax;
      const len = Math.hypot(mx, mz) || 1;
      const wantHeading = Math.atan2(mx / len, mz / len);
      this.heading = angleStep(this.heading, wantHeading, dt * 10);
      let nx = this.x + (mx / len) * this.speed * dt;
      let nz = this.z + (mz / len) * this.speed * dt;
      nx = clamp(nx, -CITY_HALF - 8, CITY_HALF + 8);
      nz = clamp(nz, -CITY_HALF - 8, CITY_HALF + 8);
      const hit = collidePoint(nx, nz, 0.5, colliders);
      if (!hit.hit) { this.x = nx; this.z = nz; }
    }
    // Jump / gravity.
    if (this.y === 0 && this._jumpQueued) {
      this.vy = 7; this._jumpQueued = false;
    }
    this.vy -= 22 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0) this.vy = 0;
    // Walk cycle.
    this.walkPhase += this.speed * dt * 1.6;
    const swing = Math.sin(this.walkPhase) * clamp(this.speed / 9.5, 0, 1) * 0.7;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
    this.mesh.userData.arms[0].rotation.x = -swing * 0.8;
    this.mesh.userData.arms[1].rotation.x = swing * 0.8;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    return this.speed;
  }

  queueJump() { this._jumpQueued = true; }

  /** Step into a car: hide the character mesh and remember the ride. */
  enterCar(car) {
    this.inCar = true;
    this.car = car;
    this.mesh.visible = false;
    this.x = car.x; this.z = car.z;
  }

  /** Step out beside the car. */
  exitCar() {
    if (!this.car) return;
    this.inCar = false;
    const side = this.car.heading + Math.PI / 2;
    this.x = this.car.x + Math.sin(side) * 3;
    this.z = this.car.z + Math.cos(side) * 3;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.car = null;
  }

  /** Snap the camera to its chase position on the next frame (no fly-through). */
  snapCamera() { this._snapNext = true; }

  /** Chase camera: orbit with the mouse, trail the car, smooth always. */
  updateCamera(dt, camera, mouseDX, mouseDY, driving) {
    this.camYaw -= mouseDX * 0.0042;
    this.camPitch = clamp(this.camPitch + mouseDY * 0.003, 0.08, 1.1);
    if (driving && this.car) {
      // While driving the camera eases behind the car's heading.
      this.camYaw = angleStep(this.camYaw, this.car.heading + Math.PI, dt * 1.4);
    }
    const dist = driving ? 11 : 8;
    const tx = this.inCar && this.car ? this.car.x : this.x;
    const tz = this.inCar && this.car ? this.car.z : this.z;
    const cx = tx + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = tz + Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cy = 2.2 + Math.sin(this.camPitch) * dist;
    if (this._snapNext) {
      this._camPos.set(cx, cy, cz);
      this._snapNext = false;
    } else {
      this._camPos.x = lerp(this._camPos.x, cx, Math.min(1, dt * 6));
      this._camPos.y = lerp(this._camPos.y, cy, Math.min(1, dt * 6));
      this._camPos.z = lerp(this._camPos.z, cz, Math.min(1, dt * 6));
    }
    camera.position.copy(this._camPos);
    camera.lookAt(tx, 1.6, tz);
  }
}

/** Push a point out of building boxes; returns the corrected point + hit flag. */
export function collidePoint(x, z, radius, colliders) {
  for (const c of colliders) {
    if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) {
      const pushL = x - (c.minX - radius), pushR = (c.maxX + radius) - x;
      const pushU = z - (c.minZ - radius), pushD = (c.maxZ + radius) - z;
      const m = Math.min(pushL, pushR, pushU, pushD);
      if (m === pushL) x = c.minX - radius;
      else if (m === pushR) x = c.maxX + radius;
      else if (m === pushU) z = c.minZ - radius;
      else z = c.maxZ + radius;
      return { x, z, hit: true };
    }
  }
  return { x, z, hit: false };
}
