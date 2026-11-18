// Pedestrians: ordinary Bay folk strolling the sidewalks. They follow the
// street grid, chat in place sometimes, and run away from gunfire, speeding
// cars and police chases. A few are hostile enforcers in the later missions.
import * as THREE from 'three';
import { mulberry32, pick, randRange } from './util.js';
import { ROAD_STEP, CITY_HALF } from './city.js';
import { collidePoint } from './player.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xfd79a8, 0x636e72];
const PANTS = [0x2c3e50, 0x5d4037, 0x34495e, 0x7f8c8d];

/** A simple walking figure, reusing one geometry per part. */
function makePedMesh(shirt, pants, hostile = false) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.72, 0.32),
    new THREE.MeshLambertMaterial({ color: hostile ? 0x8e1111 : shirt }),
  );
  torso.position.y = 1.14; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.38),
    new THREE.MeshLambertMaterial({ color: pick(Math.random, [0xc98d64, 0x8a5a3b, 0xe8b98a, 0x6b4423]) }),
  );
  head.position.y = 1.74;
  g.add(head);
  g.userData.legs = [];
  for (const sx of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), new THREE.MeshLambertMaterial({ color: pants }));
    leg.geometry.translate(0, -0.36, 0);
    leg.position.set(sx, 0.72, 0);
    g.add(leg);
    g.userData.legs.push(leg);
  }
  return g;
}

export class Pedestrian {
  constructor(mesh, x, z) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 1.4;
    this.targetX = x; this.targetZ = z;
    this.phase = Math.random() * 6;
    this.fleeing = false;
    this.hostile = false;
    this.health = 100;
    this.dead = false;
    this.idleTimer = 0;
  }
}

export class Pedestrians {
  constructor(scene, seed = 7) {
    this.scene = scene;
    this.rand = mulberry32(seed + 303);
    this.list = [];
    for (let i = 0; i < 26; i++) this.spawnRandom(false);
  }

  spawnRandom(hostile) {
    const x = (Math.floor(this.rand() * 11) - 5) * ROAD_STEP + 12;
    const z = (Math.floor(this.rand() * 11) - 5) * ROAD_STEP + randRange(this.rand, -20, 20);
    return this.spawnAt(x, z, hostile);
  }

  /** Spawn one pedestrian (or enforcer) at a spot. */
  spawnAt(x, z, hostile = false) {
    const mesh = makePedMesh(pick(this.rand, SHIRTS), pick(this.rand, PANTS), hostile);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const ped = new Pedestrian(mesh, x, z);
    ped.hostile = hostile;
    if (hostile) ped.health = 120;
    this._pickTarget(ped);
    this.list.push(ped);
    return ped;
  }

  _pickTarget(ped) {
    const rx = (Math.floor(this.rand() * 11) - 5) * ROAD_STEP + 12;
    const rz = (Math.floor(this.rand() * 11) - 5) * ROAD_STEP + randRange(this.rand, -20, 20);
    ped.targetX = rx; ped.targetZ = rz;
  }

  /** Make every pedestrian within `radius` of (x, z) run away from it. */
  scare(x, z, radius = 30) {
    for (const ped of this.list) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.fleeing = true;
        ped.targetX = ped.x + ((ped.x - x) / (d || 1)) * 60;
        ped.targetZ = ped.z + ((ped.z - z) / (d || 1)) * 60;
        ped.targetX = Math.max(-CITY_HALF, Math.min(CITY_HALF, ped.targetX));
        ped.targetZ = Math.max(-CITY_HALF, Math.min(CITY_HALF, ped.targetZ));
      }
    }
  }

  update(dt, playerPos, colliders) {
    for (const ped of this.list) {
      if (ped.dead) continue;
      const dx = ped.targetX - ped.x, dz = ped.targetZ - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) {
        if (ped.fleeing) { ped.fleeing = false; this._pickTarget(ped); }
        else if (ped.idleTimer > 0) ped.idleTimer -= dt;
        else { this._pickTarget(ped); ped.idleTimer = this.rand() * 4; }
        continue;
      }
      const want = Math.atan2(dx / d, dz / d);
      let diff = want - ped.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.heading += Math.max(-dt * 4, Math.min(dt * 4, diff));
      const speed = ped.fleeing ? 5.5 : ped.hostile ? 3.2 : 1.5;
      let nx = ped.x + Math.sin(ped.heading) * speed * dt;
      let nz = ped.z + Math.cos(ped.heading) * speed * dt;
      const hit = collidePoint(nx, nz, 0.4, colliders);
      if (!hit.hit) { ped.x = nx; ped.z = nz; }
      ped.phase += speed * dt * 2.2;
      const swing = Math.sin(ped.phase) * 0.55;
      ped.mesh.userData.legs[0].rotation.x = swing;
      ped.mesh.userData.legs[1].rotation.x = -swing;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  /** Remove the dead (fallen) after a while, and drop their cash marker. */
  prune() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const ped = this.list[i];
      if (ped.dead && ped.mesh.rotation.x < -Math.PI / 2 + 0.01) {
        this.scene.remove(ped.mesh);
        this.list.splice(i, 1);
      }
    }
  }
}
