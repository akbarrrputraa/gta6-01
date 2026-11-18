// Cheap visual effects: point-particle bursts (blood, smoke, sparks), a
// tracer line for gunfire, a muzzle flash, and the glowing mission beacon.
// All effects are pooled meshes so the frame never allocates mid-play.
import * as THREE from 'three';

const MAX_PARTICLES = 240;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.particles.push({ mesh, life: 0, vx: 0, vy: 0, vz: 0, grav: 0 });
    }
    this._cursor = 0;
    this.tracers = [];
    const tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    for (let i = 0; i < 6; i++) {
      const line = new THREE.Line(tGeo.clone(), new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true }));
      line.visible = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }
    this._tracerCursor = 0;
    // Mission beacon: a tall glowing pillar + a pulsing ring on the ground.
    this.beacon = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    pillar.position.y = 30;
    this.beacon.add(pillar);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.2, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    this.beacon.add(ring);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this._beaconPulse = 0;
  }

  _spawn(x, y, z, color, count, speed, life, grav) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this._cursor];
      this._cursor = (this._cursor + 1) % MAX_PARTICLES;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * speed;
      p.vx = Math.cos(a) * speed * 0.6;
      p.vz = Math.sin(a) * speed * 0.6;
      p.vy = up;
      p.life = life * (0.6 + Math.random() * 0.6);
      p.grav = grav;
    }
  }

  blood(x, y, z) { this._spawn(x, y, z, 0xb3122e, 14, 3, 0.5, -9); }
  smoke(x, y, z) { this._spawn(x, y, z, 0x888888, 10, 1.4, 1.1, 1.5); }
  sparks(x, y, z) { this._spawn(x, y, z, 0xffc93c, 12, 5, 0.4, -12); }
  dust(x, y, z) { this._spawn(x, y, z, 0xcbb98a, 6, 1.2, 0.7, 0.5); }

  muzzle(from) {
    this._spawn(from.x, from.y, from.z, 0xffe27a, 5, 2, 0.12, 0);
  }

  tracer(from, to) {
    const t = this.tracers[this._tracerCursor];
    this._tracerCursor = (this._tracerCursor + 1) % this.tracers.length;
    const pos = t.line.geometry.getAttribute('position');
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.line.visible = true;
    t.line.material.opacity = 1;
    t.life = 0.09;
  }

  /** Show the mission beacon at (x, z); hide it with null. */
  setBeacon(x, z) {
    if (x === null) { this.beacon.visible = false; return; }
    this.beacon.visible = true;
    this.beacon.position.set(x, 0, z);
  }

  update(dt) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vy += p.grav * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.material.opacity = Math.min(1, p.life * 2);
    }
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09);
      if (t.life <= 0) t.line.visible = false;
    }
    if (this.beacon.visible) {
      this._beaconPulse += dt;
      const s = 1 + Math.sin(this._beaconPulse * 3) * 0.12;
      this.beacon.children[1].scale.set(s, s, 1);
    }
  }
}
