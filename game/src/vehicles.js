// Cars: a box-built car factory, arcade driving physics for the player's
// car, and traffic that cruises the street grid. Cars collide with building
// boxes and with each other by circle tests.
import * as THREE from 'three';
import { mulberry32, pick, randRange, clamp, angleDiff, angleStep } from './util.js';
import { ROAD_STEP, CITY_HALF } from './city.js';

const CAR_COLORS = [0xd43d2a, 0x2a6fd4, 0xf2c14e, 0x7dd87d, 0xe8e8e8, 0x222831, 0x9b59b6, 0x16a085, 0xff8c42];
const CAR_NAMES = ['Comet GT', 'Bay Runner', 'Sunset Coupe', 'Harbour Van', 'Palm Sedan', 'Dune Buggy'];

/** Build one low-poly car mesh. `police` gives it the black-and-white livery. */
export function makeCarMesh(color, police = false) {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0x111111 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55; body.castShadow = true;
  car.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.58, 2.1),
    new THREE.MeshLambertMaterial({ color: police ? 0xf5f5f5 : 0x1d3247 }),
  );
  cabin.position.set(0, 1.1, -0.25); cabin.castShadow = true;
  car.add(cabin);
  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
    stripe.position.y = 0.62;
    car.add(stripe);
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0xff2222 }));
    lightBar.position.set(0, 1.48, -0.25);
    car.add(lightBar);
    const lightBar2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0x2244ff }));
    lightBar2.position.set(0, 1.48, 0.25);
    car.add(lightBar2);
    car.userData.lightBars = [lightBar, lightBar2];
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  car.userData.wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    car.add(wheel);
    car.userData.wheels.push(wheel);
  }
  // Headlights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const hx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headMat);
    head.position.set(hx, 0.62, 2.22);
    car.add(head);
  }
  return car;
}

/** One traffic or parked car in the world. */
export class Car {
  constructor(mesh, x, z, heading, name, parked = false) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.name = name;
    this.parked = parked;
    this.police = false;
    this.steer = 0;
    this.occupied = false; // a traffic driver sits inside
    this.stolen = false;
    this.targetRoad = null;
    this.waitTimer = 0;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.9;
    for (const w of this.mesh.userData.wheels || []) w.rotation.x += spin * 0.016;
  }
}

/** All cars in the city: the player's ride, parked cars to steal, traffic. */
export class Traffic {
  constructor(scene, city, seed = 7) {
    this.scene = scene;
    this.city = city;
    this.rand = mulberry32(seed + 101);
    this.cars = [];
    this.playerCar = null;
    this._spawnInitial();
  }

  _roadCoord() {
    return (Math.floor(this.rand() * 11) - 5) * ROAD_STEP;
  }

  _spawnInitial() {
    // Parked cars along the boulevards, ready to be stolen.
    for (let i = 0; i < 14; i++) {
      const along = this._roadCoord();
      const cross = this._roadCoord() + (this.rand() < 0.5 ? 8 : -8);
      const heading = this.rand() < 0.5 ? 0 : Math.PI / 2;
      const mesh = makeCarMesh(pick(this.rand, CAR_COLORS));
      this.scene.add(mesh);
      this.cars.push(new Car(mesh, cross, along, heading, pick(this.rand, CAR_NAMES), true));
    }
    // Moving traffic.
    for (let i = 0; i < 16; i++) {
      const horizontal = this.rand() < 0.5;
      const road = this._roadCoord();
      const pos = randRange(this.rand, -280, 280);
      const heading = horizontal ? (this.rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (this.rand() < 0.5 ? 0 : Math.PI);
      const mesh = makeCarMesh(pick(this.rand, CAR_COLORS));
      this.scene.add(mesh);
      const car = new Car(mesh, horizontal ? pos : road + 3.5, horizontal ? road + 3.5 : pos, heading, pick(this.rand, CAR_NAMES));
      car.speed = randRange(this.rand, 7, 11);
      car.occupied = true;
      car.targetRoad = road;
      this.cars.push(car);
    }
  }

  /** Spawn a police interceptor near (x, z). */
  spawnPolice(x, z, heading = 0) {
    const mesh = makeCarMesh(0x111111, true);
    this.scene.add(mesh);
    const car = new Car(mesh, x, z, heading, 'Interceptor');
    car.police = true;
    car.speed = 0;
    this.cars.push(car);
    return car;
  }

  /** Remove a car from the world entirely. */
  removeCar(car) {
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    if (this.playerCar === car) this.playerCar = null;
  }

  /** Nearest stealable car within `range` of (x, z). */
  nearestCar(x, z, range = 6) {
    let best = null, bestD = range;
    for (const car of this.cars) {
      if (car === this.playerCar) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  /** Circle-vs-building collision: push a point out of every collider it is inside. */
  _collide(x, z, radius) {
    for (const c of this.city.colliders) {
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

  /** Drive the player's car with arcade physics. Returns actual speed. */
  drivePlayer(dt, throttle, steerInput, braking) {
    const car = this.playerCar;
    if (!car) return 0;
    const maxSpeed = 34;
    const maxReverse = 10;
    if (throttle > 0) car.speed += 22 * dt;
    else if (throttle < 0) car.speed -= 18 * dt;
    else car.speed -= Math.sign(car.speed) * 8 * dt;
    if (braking) car.speed -= Math.sign(car.speed) * 30 * dt;
    if (Math.abs(car.speed) < 0.15 && throttle === 0) car.speed = 0;
    car.speed = clamp(car.speed, -maxReverse, maxSpeed);
    const steerTarget = steerInput * 0.55 * (car.speed >= 0 ? 1 : -1);
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
    const turnRate = car.steer * clamp(Math.abs(car.speed) / 12, 0, 1) * 2.0;
    car.heading += turnRate * dt * (car.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const hit = this._collide(nx, nz, 2.2);
    if (hit.hit) {
      car.speed *= 0.35;
      car.x = hit.x; car.z = hit.z;
    } else {
      car.x = clamp(nx, -CITY_HALF - 10, CITY_HALF + 10);
      car.z = clamp(nz, -CITY_HALF - 10, CITY_HALF + 10);
    }
    // Gentle push away from other cars.
    for (const other of this.cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) * 0.5;
        car.x -= ((other.x - car.x) / d) * push;
        car.z -= ((other.z - car.z) / d) * push;
        car.speed *= 0.92;
      }
    }
    car.syncMesh();
    return car.speed;
  }

  /** Step traffic: cruise their road, turn at intersections, slow for cars ahead. */
  updateTraffic(dt) {
    for (const car of this.cars) {
      if (car === this.playerCar || car.police || car.parked) continue;
      const ahead = this._carAhead(car);
      const targetSpeed = ahead ? 4 : 9;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      // At an intersection, sometimes turn onto the crossing road.
      // Staged cars (screenshot scenes) hold their lane instead.
      const onGridX = Math.abs(((car.x % ROAD_STEP) + ROAD_STEP) % ROAD_STEP - 0) < 3;
      const onGridZ = Math.abs(((car.z % ROAD_STEP) + ROAD_STEP) % ROAD_STEP - 0) < 3;
      if (!car.keepLane && (onGridX || onGridZ) && this.rand() < dt * 0.25) {
        car.heading += (this.rand() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      if (car.x > CITY_HALF) car.x = -CITY_HALF;
      if (car.x < -CITY_HALF) car.x = CITY_HALF;
      if (car.z > CITY_HALF) car.z = -CITY_HALF;
      if (car.z < -CITY_HALF) car.z = CITY_HALF;
      const hit = this._collide(car.x, car.z, 2.2);
      if (hit.hit) { car.heading += Math.PI / 2; car.x = hit.x; car.z = hit.z; }
      car.syncMesh();
    }
  }

  _carAhead(car) {
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d > 12 || d < 0.01) continue;
      const dot = (dx * Math.sin(car.heading) + dz * Math.cos(car.heading)) / d;
      if (dot > 0.92) return true;
    }
    return false;
  }
}
