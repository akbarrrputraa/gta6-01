// The Bay Police Department: a wanted level from 0 to 5 stars, patrol cars
// that chase and ram, foot cops that try to arrest Rico, and heat that cools
// off when Rico stays out of sight. Crime adds heat; time and distance cool it.
import { clamp, randRange } from './util.js';
import { CITY_HALF } from './city.js';

export class Police {
  constructor(scene, traffic, player, audio) {
    this.scene = scene;
    this.traffic = traffic;
    this.player = player;
    this.audio = audio;
    this.wanted = 0;          // 0..5 stars shown on the HUD
    this.heat = 0;            // 0..100, drives the star level
    this.cars = [];           // active pursuit cars
    this.spawnTimer = 0;
    this.bustedTimer = 0;
    this._sirenTimer = 0;
  }

  /** A crime just happened: add heat (0..100). */
  addHeat(amount, reason) {
    this.heat = clamp(this.heat + amount, 0, 100);
    const stars = Math.ceil(this.heat / 20);
    if (stars > this.wanted) {
      this.wanted = stars;
      this.audio.wantedUp();
    }
    return this.wanted;
  }

  _starsFor(heat) { return Math.ceil(heat / 20); }

  /** Where the player is (in or out of a car). */
  _playerPos() {
    return { x: this.player.x, z: this.player.z };
  }

  update(dt, peds) {
    // Heat cools when the player is slow and far from police.
    const p = this._playerPos();
    const nearestCop = this.cars.reduce((m, c) => Math.min(m, Math.hypot(c.x - p.x, c.z - p.z)), Infinity);
    if (this.wanted > 0) {
      const hiding = nearestCop > 90;
      this.heat -= dt * (hiding ? 2.2 : 0.5);
      if (this.heat <= 0) { this.heat = 0; this.wanted = 0; this._clearPursuit(); }
      else this.wanted = this._starsFor(this.heat);
    }
    this.audio.setSiren(this.wanted > 0);

    // Keep enough pursuit cars for the wanted level.
    const wantCars = this.wanted === 0 ? 0 : Math.min(4, this.wanted);
    this.spawnTimer -= dt;
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      const angle = Math.random() * Math.PI * 2;
      const car = this.traffic.spawnPolice(
        p.x + Math.sin(angle) * 70,
        p.z + Math.cos(angle) * 70,
        angle + Math.PI,
      );
      this.cars.push(car);
    }

    // Chase: steer toward the player, ram speed scales with stars.
    for (const car of this.cars) {
      const dx = p.x - car.x, dz = p.z - car.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-dt * 2.2, Math.min(dt * 2.2, diff));
      const topSpeed = 13 + this.wanted * 3.5;
      car.speed += (topSpeed - car.speed) * Math.min(1, dt * 1.2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.x = clamp(car.x, -CITY_HALF - 10, CITY_HALF + 10);
      car.z = clamp(car.z, -CITY_HALF - 10, CITY_HALF + 10);
      car.syncMesh();
      // Flash the light bar.
      this._sirenTimer += dt;
      const bars = car.mesh.userData.lightBars;
      if (bars) {
        const on = Math.floor(this._sirenTimer * 4) % 2 === 0;
        bars[0].material.color.setHex(on ? 0xff2222 : 0x550000);
        bars[1].material.color.setHex(on ? 0x000055 : 0x2244ff);
      }
      // Ram the player's car, or bust Rico on foot.
      if (d < 3.2 && this.player.inCar && this.player.car) {
        this.player.car.speed *= 0.85;
        this.addHeat(2, 'rammed');
      }
      if (d < 2.6 && !this.player.inCar) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.6) {
          this.bustedTimer = 0;
          if (this.onBusted) this.onBusted();
        }
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
      }
    }

    // Clean up pursuit cars that fell far behind and are out of sight.
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (this.wanted === 0 || d > 220) {
        this.traffic.removeCar(car);
        this.cars.splice(i, 1);
      }
    }
  }

  _clearPursuit() {
    for (const car of this.cars) this.traffic.removeCar(car);
    this.cars = [];
  }

  /** Drop the wanted level to zero (mission reward / hideout). */
  clearWanted() {
    this.heat = 0;
    this.wanted = 0;
    this._clearPursuit();
  }

  /** Reset everything (new game / retry). */
  reset() {
    this.heat = 0;
    this.wanted = 0;
    this.bustedTimer = 0;
    this._clearPursuit();
  }
}
