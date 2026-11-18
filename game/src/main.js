// Solmar Bay — boot, game loop and screen flow. This file wires the city,
// the player, traffic, pedestrians, police, combat, missions, HUD, audio and
// effects together and owns the title / playing / paused / game-over states.
import * as THREE from 'three';
import { buildCity, districtAt } from './city.js';
import { Player } from './player.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { saveGame, loadSave, hasSave } from './save.js';
import { stageShot, shotAutopilot } from './shots.js';
import { clamp } from './util.js';

class Game {
  constructor() {
    this.screen = 'title';
    this.cash = 0;
    this.shotMode = null;
    this._lastDamageAt = -10;
    this._time = 0;
    this._enemyShootTimer = 0;
    this._trafficHitTimer = 0;

    const params = new URLSearchParams(location.search);
    this.seed = Number(params.get('seed') || 7);
    this.shotName = params.get('shot');

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'webgl';
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
    this.camera.position.set(20, 10, 30);

    this.city = buildCity(this.scene, this.seed);
    this.player = new Player(this.scene);
    this.traffic = new Traffic(this.scene, this.city, this.seed);
    this.peds = new Pedestrians(this.scene, this.seed);
    this.audio = new AudioEngine();
    this.effects = new Effects(this.scene);
    this.police = new Police(this.scene, this.traffic, this.player, this.audio);
    this.combat = new Combat(this.scene, this.camera, this.audio, this.effects);
    this.missions = new Missions(this);
    this.hud = new HUD();
    this.input = new Input();
    this.police.onBusted = () => this.gameOver('BUSTED — The Bay Police took you in. Your crew posts bail, but the job is blown.');

    this._bindUI();
    this._applySaveHint();
    addEventListener('resize', () => this._resize());

    // Title screen orbits the plaza until the player starts.
    this._titleAngle = 0;
    this._clock = new THREE.Clock();
    this._ready = false;
    this._loop();
    document.getElementById('loading').remove();
    this._ready = true;
    window.__solmarReady = true;
    window.__game = this; // debug hook: lets a play-test read live state
    this.showTitle();

    if (this.shotName) {
      stageShot(this, this.shotName);
      this.audio.unlock();
    }
  }

  // -- UI ---------------------------------------------------------------
  _bindUI() {
    const $ = (id) => document.getElementById(id);
    $('playbtn').addEventListener('click', () => { this.audio.unlock(); this.startGame(); });
    $('resumebtn').addEventListener('click', () => this.resume());
    $('savebtn').addEventListener('click', () => {
      if (saveGame(this)) this.toast('Game saved.', 2);
      else this.toast('Save failed — storage unavailable.', 2);
    });
    $('quitbtn').addEventListener('click', () => { this.showTitle(); });
    $('retrybtn').addEventListener('click', () => { this.startGame(); });
  }

  /** Show or hide every HUD element (hidden behind the title screen). */
  _setHudVisible(visible) {
    for (const el of document.querySelectorAll('.hud')) {
      el.style.display = visible ? '' : 'none';
    }
  }

  _applySaveHint() {
    const save = loadSave();
    document.getElementById('continuetxt').textContent = save
      ? `Save found: ${'$' + save.cash} · Mission ${save.missionIndex + 1} — starting fresh overwrites it.`
      : '';
  }

  showTitle() {
    this.screen = 'title';
    this._setHudVisible(false);
    document.getElementById('titlescreen').style.display = 'flex';
    document.getElementById('pausescreen').style.display = 'none';
    document.getElementById('overscreen').style.display = 'none';
    this._applySaveHint();
  }

  hideTitle() {
    document.getElementById('titlescreen').style.display = 'none';
  }

  startGame() {
    this.hideTitle();
    this._setHudVisible(true);
    document.getElementById('pausescreen').style.display = 'none';
    document.getElementById('overscreen').style.display = 'none';
    this.screen = 'playing';
    this.cash = 0;
    this.player.health = 100;
    this.player.x = 12; this.player.z = 12;
    this.player.heading = Math.PI;
    this.player.armed = true;
    this.police.reset();
    this.missions.start();
    this.player.snapCamera();
    this.toast('Welcome to Solmar Bay, Rico.', 4);
  }

  pause() {
    if (this.screen !== 'playing') return;
    this.screen = 'paused';
    document.getElementById('pausescreen').style.display = 'flex';
  }

  resume() {
    document.getElementById('pausescreen').style.display = 'none';
    this.screen = 'playing';
  }

  gameOver(text) {
    this.screen = 'over';
    document.getElementById('overtext').textContent = text;
    document.getElementById('overscreen').style.display = 'flex';
    this.audio.setSiren(false);
  }

  toast(text, seconds = 3) { this.hud.toast(text, seconds); }
  addCash(n) { this.cash += n; }

  nearLandmark(name, radius) {
    const L = this.city.landmarks[name];
    if (!L) return false;
    return Math.hypot(this.player.x - L.x, this.player.z - L.z) < radius;
  }

  // -- per-frame ----------------------------------------------------------
  _resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this._clock.getDelta(), 0.05);
    this._time += dt;
    if (this.screen === 'title') {
      // Slow orbit over Marina Plaza behind the title screen.
      this._titleAngle += dt * 0.05;
      const r = 90;
      this.camera.position.set(Math.sin(this._titleAngle) * r, 42, Math.cos(this._titleAngle) * r);
      this.camera.lookAt(0, 0, 0);
      this.traffic.updateTraffic(dt);
      this.peds.update(dt, this.player.pos, this.city.colliders);
      this.effects.update(dt);
    } else if (this.screen === 'playing') {
      this._update(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  _update(dt) {
    const input = this.input;
    const p = this.player;

    // Global keys.
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) { this.pause(); input.endFrame(); return; }
    if (input.wasPressed('KeyM')) {
      const on = this.audio.toggleMusic();
      this.toast(on ? 'Music on' : 'Music off', 1.5);
    }

    const autopilot = this.shotMode ? shotAutopilot(this, dt) : null;

    // --- driving / on foot ---------------------------------------------
    let speedNow = 0;
    if (p.inCar && p.car) {
      const axes = autopilot ? { x: autopilot.steer, y: autopilot.throttle } : input.moveAxes();
      const brake = input.down('Space');
      speedNow = this.traffic.drivePlayer(dt, axes.y, -axes.x, brake);
      // The player's map position rides with the car: missions, police and
      // the HUD all read player.x / player.z.
      p.x = p.car.x; p.z = p.car.z;
      this.audio.setEngine(Math.abs(speedNow) / 34, true);
      if (Math.abs(speedNow) > 20 && Math.abs(axes.x) > 0.6 && Math.random() < dt * 2) this.audio.skid();
      if (Math.random() < dt * 0.5) this.effects.dust(p.car.x, 0.3, p.car.z);
      // Leaving the car.
      if (input.wasPressed('KeyE')) {
        this.traffic.playerCar = null;
        p.exitCar();
        this.audio.setEngine(0, false);
      }
    } else {
      const axes = input.moveAxes();
      const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
      speedNow = p.moveOnFoot(dt, axes.x, axes.y, sprint, this.city.colliders);
      this.audio.setEngine(0, false);
      if (input.wasPressed('Space')) p.queueJump();
      // Enter the nearest car.
      if (input.wasPressed('KeyE')) {
        const car = this.traffic.nearestCar(p.x, p.z, 6);
        if (car) {
          const wasParked = car.parked;
          car.parked = false;
          if (car.occupied) {
            car.occupied = false;
            this.police.addHeat(15, 'carjacking');
            this.toast(`You jacked a ${car.name}! The driver ran for it.`, 3);
            this.peds.scare(p.x, p.z, 20);
          } else if (!wasParked) {
            this.police.addHeat(8, 'stolen car');
          } else {
            this.police.addHeat(10, 'stolen car');
            this.toast(`You stole a ${car.name}.`, 3);
          }
          car.stolen = true;
          p.enterCar(car);
          this.traffic.playerCar = car;
        }
      }
      // Combat on foot.
      if (input.clicked && p.armed) {
        const hit = this.combat.shoot(p, this.peds, this.police);
        if (hit) this._onShotHit(hit);
      }
      if (input.wasPressed('KeyF')) {
        const hit = this.combat.punch(p, this.peds);
        if (hit) this._onShotHit(hit);
      }
      if (input.wasPressed('KeyR')) this._reload();
    }

    // --- world systems ---------------------------------------------------
    this.traffic.updateTraffic(dt);
    this.peds.update(dt, p.pos, this.city.colliders);
    this.police.update(dt, this.peds);
    this.combat.update(dt);
    this.missions.update(dt);
    this.effects.update(dt);

    // Mission beacon follows the current objective.
    const beacon = this.missions.beaconTarget();
    if (beacon) this.effects.setBeacon(beacon.x, beacon.z);
    else this.effects.setBeacon(null);

    // Traffic cars that hit Rico on foot hurt him.
    this._trafficHitTimer -= dt;
    if (!p.inCar && this._trafficHitTimer <= 0) {
      for (const car of this.traffic.cars) {
        if (car.parked || car === p.car) continue;
        if (Math.hypot(car.x - p.x, car.z - p.z) < 2.6) {
          this._hurt(12, 'traffic');
          this._trafficHitTimer = 1;
          this.peds.scare(p.x, p.z, 15);
          break;
        }
      }
    }

    // Enforcers shoot back.
    this._enemyShootTimer -= dt;
    if (this._enemyShootTimer <= 0) {
      this._enemyShootTimer = 1.1;
      for (const ped of this.peds.list) {
        if (!ped.hostile || ped.dead) continue;
        const d = Math.hypot(ped.x - p.x, ped.z - p.z);
        if (d < 45) {
          const hitPlayer = this.combat.enemyShootAt(ped, p, this.audio);
          if (hitPlayer) this._hurt(8, 'gunfire');
          break;
        }
      }
    }

    // Slow health regen while the heat is off.
    if (this.police.wanted === 0 && this._time - this._lastDamageAt > 6 && p.health < 100) {
      p.health = Math.min(100, p.health + 3 * dt);
    }
    if (p.health <= 0) {
      this.gameOver('WASTED — Rico went down in the streets of Solmar Bay.');
      input.endFrame();
      return;
    }

    // Sun follows the player so shadows stay crisp everywhere.
    this.city.sun.position.set(p.x + 180, 260, p.z + 120);
    this.city.sun.target.position.set(p.x, 0, p.z);

    // Camera + HUD.
    p.updateCamera(dt, this.camera, input.mouseDX, input.mouseDY, p.inCar);
    this.hud.update(dt, this);
    input.endFrame();
  }

  _onShotHit(ped) {
    // Shooting a bystander is a crime; shooting an enforcer is the job.
    if (ped.hostile) {
      if (ped.dead) this.missions.onKill();
    } else {
      this.police.addHeat(12, 'assault');
      this.peds.scare(ped.x, ped.z, 30);
    }
    if (ped.dead) this.peds.prune();
  }

  _reload() {
    const need = 48 - this.combat.ammo;
    const take = Math.min(need, this.combat.ammoReserve);
    if (take > 0) {
      this.combat.ammo += take;
      this.combat.ammoReserve -= take;
      this.audio.pickup();
    }
  }

  _hurt(amount, cause) {
    this.player.health -= amount;
    this._lastDamageAt = this._time;
  }
}

new Game();
