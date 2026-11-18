// Combat: Rico's pistol (hitscan raycast from the camera) and his fists.
// Shooting a pedestrian or a cop adds wanted heat and scares the crowd;
// enforcers shoot back in the later missions.
import * as THREE from 'three';
import { clamp } from './util.js';

export class Combat {
  constructor(scene, camera, audio, effects) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.effects = effects;
    this.ammo = 48;
    this.ammoReserve = 120;
    this.cooldown = 0;
    this.punchCooldown = 0;
    this.raycaster = new THREE.Raycaster();
    this._center = new THREE.Vector2(0, 0);
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
  }

  /** Fire the pistol. Returns the pedestrian hit, or null. */
  shoot(player, peds, police) {
    if (this.cooldown > 0 || this.ammo <= 0) return null;
    this.cooldown = 0.28;
    this.ammo -= 1;
    this.audio.gunshot();
    this.raycaster.setFromCamera(this._center, this.camera);
    // Test pedestrians (and their cars are not targets).
    const targets = [];
    for (const ped of peds.list) {
      if (ped.dead) continue;
      targets.push(ped.mesh);
    }
    const hits = this.raycaster.intersectObjects(targets, true);
    let hitPed = null;
    if (hits.length > 0 && hits[0].distance < 70) {
      let obj = hits[0].object;
      while (obj.parent && !obj.userData.isPedRoot) obj = obj.parent;
      hitPed = peds.list.find((p) => p.mesh === obj || p.mesh === hits[0].object.parent) || null;
      // Fallback: nearest ped to the hit point.
      if (!hitPed) {
        const pt = hits[0].point;
        let best = null, bestD = 3;
        for (const ped of peds.list) {
          if (ped.dead) continue;
          const d = Math.hypot(ped.x - pt.x, ped.z - pt.z);
          if (d < bestD) { bestD = d; best = ped; }
        }
        hitPed = best;
      }
    }
    // Muzzle flash + tracer line.
    const from = new THREE.Vector3(player.x, 1.4 + player.y, player.z);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const to = from.clone().add(dir.multiplyScalar(hitPed ? 12 : 45));
    this.effects.tracer(from, to);
    this.effects.muzzle(from);
    if (hitPed) {
      hitPed.health -= 55;
      this.effects.blood(hitPed.x, 1.2, hitPed.z);
      if (hitPed.health <= 0) this._killPed(hitPed);
      return hitPed;
    }
    return null;
  }

  /** A punch: short range, knocks a pedestrian down, no ammo used. */
  punch(player, peds) {
    if (this.punchCooldown > 0) return null;
    this.punchCooldown = 0.45;
    this.audio.punch();
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    let best = null, bestD = 2.4;
    for (const ped of peds.list) {
      if (ped.dead) continue;
      const dx = ped.x - player.x, dz = ped.z - player.z;
      const d = Math.hypot(dx, dz);
      const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 0;
      if (d < bestD && dot > 0.4) { bestD = d; best = ped; }
    }
    if (best) {
      best.health -= 40;
      this.effects.blood(best.x, 1.2, best.z);
      if (best.health <= 0) this._killPed(best);
      return best;
    }
    return null;
  }

  _killPed(ped) {
    ped.dead = true;
    ped.health = 0;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.4;
  }

  /** Enforcers shoot back at Rico; called from the mission update. */
  enemyShootAt(enemy, player, audio) {
    const d = Math.hypot(enemy.x - player.x, enemy.z - player.z);
    if (d > 45) return false;
    audio.gunshot();
    const from = new THREE.Vector3(enemy.x, 1.3, enemy.z);
    const to = new THREE.Vector3(player.x, 1.3, player.z);
    this.effects.tracer(from, to);
    // Hit chance falls with distance.
    if (Math.random() < clamp(0.55 - d * 0.008, 0.08, 0.5)) {
      player.health -= 8;
      return true;
    }
    return false;
  }
}
