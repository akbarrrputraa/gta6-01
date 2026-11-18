// The HUD: wanted stars, cash, health, mission objective, speed, ammo, the
// toast line and the minimap — a live top-down canvas of the city with the
// player, cars, police and the mission beacon.
import { fmtCash } from './util.js';
import { CITY_HALF, districtAt } from './city.js';

export class HUD {
  constructor() {
    this.starsEl = document.getElementById('stars');
    this.cashEl = document.getElementById('cash');
    this.healthFill = document.getElementById('healthfill');
    this.objectiveEl = document.getElementById('objective');
    this.speedEl = document.getElementById('speed');
    this.ammoEl = document.getElementById('ammo');
    this.toastEl = document.getElementById('toast');
    this.crosshairEl = document.getElementById('crosshair');
    this.mapCanvas = document.getElementById('mapcanvas');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this._toastTimer = 0;
  }

  toast(text, seconds = 3) {
    this.toastEl.textContent = text;
    this._toastTimer = seconds;
  }

  update(dt, game) {
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < game.police.wanted ? '' : 'off'}">★</span>`;
    this.starsEl.innerHTML = stars;
    this.cashEl.textContent = fmtCash(game.cash);
    this.healthFill.style.width = `${Math.max(0, game.player.health)}%`;
    this.objectiveEl.innerHTML = game.missions.objectiveText();
    const speedKmh = Math.abs(game.player.inCar && game.player.car ? game.player.car.speed : game.player.speed) * 3.6;
    this.speedEl.innerHTML = game.player.inCar
      ? `${Math.round(speedKmh)}<small>km/h · ${game.player.car ? game.player.car.name : ''}</small>`
      : `<small>${districtAt(game.player.x, game.player.z)}</small>`;
    this.ammoEl.textContent = game.player.armed ? `🔫 ${game.combat.ammo} / ${game.combat.ammoReserve}` : '';
    this.crosshairEl.style.display = game.player.armed && !game.player.inCar ? 'block' : 'none';
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.toastEl.textContent = '';
    }
    this._drawMinimap(game);
  }

  _drawMinimap(game) {
    const ctx = this.mapCtx;
    const S = 190;
    const scale = S / (CITY_HALF * 2 + 40);
    const toMap = (x, z) => [(x + CITY_HALF + 20) * scale, (z + CITY_HALF + 20) * scale];
    ctx.clearRect(0, 0, S, S);
    // Sea + land.
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#2c4a34';
    const [lx, ly] = toMap(-288, -CITY_HALF);
    ctx.fillRect(lx, ly, S - lx, S - ly);
    // Roads.
    ctx.strokeStyle = '#555a60';
    ctx.lineWidth = 3;
    for (let c = -320; c <= 320; c += 64) {
      const [x1, y1] = toMap(c, -CITY_HALF);
      const [x2, y2] = toMap(c, CITY_HALF);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(-CITY_HALF, c);
      const [x4, y4] = toMap(CITY_HALF, c);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    // Mission beacon.
    const beacon = game.missions.beaconTarget();
    if (beacon) {
      const [bx, by] = toMap(beacon.x, beacon.z);
      const pulse = 5 + Math.sin(performance.now() / 300) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(bx, by, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // Police cars.
    ctx.fillStyle = '#ff3333';
    for (const car of game.police.cars) {
      const [px, py] = toMap(car.x, car.z);
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }
    // Traffic cars.
    ctx.fillStyle = '#cfe8ff';
    for (const car of game.traffic.cars) {
      if (car.police) continue;
      const [px, py] = toMap(car.x, car.z);
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    // Player arrow.
    const [px, py] = toMap(game.player.x, game.player.z);
    const heading = game.player.inCar && game.player.car ? game.player.car.heading : game.player.heading;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-heading + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S / 2 - 4, 12);
  }
}
