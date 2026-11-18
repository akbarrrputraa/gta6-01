// The story: four missions for Rico Vega, chained in order, each with an
// objective line, a beacon marker, a timer where it matters, and a cash
// reward. Completing all four ends the story arc with a finale screen.
import { fmtCash } from './util.js';

export const MISSION_DEFS = [
  {
    id: 'wheels',
    title: 'MISSION 1 — FIRST WHEELS',
    giver: 'Donna Marisol',
    brief: 'The crew needs a wheelman. Steal any parked car and bring it to Marina Plaza.',
    steps: [
      { text: 'Steal a car (walk up to a parked car and press E)', done: (g) => g.player.inCar },
      { text: 'Drive the car to Marina Plaza', done: (g) => g.nearLandmark('plaza', 14) },
    ],
    reward: 250,
  },
  {
    id: 'courier',
    title: 'MISSION 2 — COURIER RUN',
    giver: 'Donna Marisol',
    brief: 'Packages for the crew. Pick up the parcel at the Harbour Docks, then drop it at Coral Park and Palm Auto Row — before the clock runs out.',
    steps: [
      { text: 'Pick up the parcel at the Harbour Docks', done: (g) => g.nearLandmark('docks', 12) },
      { text: 'Deliver to Coral Park', done: (g) => g.nearLandmark('park', 12) },
      { text: 'Deliver to Palm Auto Row', done: (g) => g.nearLandmark('dealership', 12) },
    ],
    reward: 600,
    timeLimit: 150,
  },
  {
    id: 'heat',
    title: 'MISSION 3 — HARBOUR HEAT',
    giver: 'The Crew',
    brief: 'Rival enforcers are shaking down the docks. Take out 3 enforcers at the Harbour Docks — the police will notice, so be ready to run.',
    steps: [
      { text: 'Go to the Harbour Docks', done: (g) => g.nearLandmark('docks', 16) },
      { text: 'Take out 3 enforcers (0/3)', done: (g) => g.kills >= 3 },
    ],
    reward: 900,
    enforcers: 3,
  },
  {
    id: 'score',
    title: 'MISSION 4 — THE BIG SCORE',
    giver: 'Donna Marisol',
    brief: 'The big one. Hit Bay National Bank, grab the cash, and lose the heat at the Vega Hideout. The whole Bay Police will be on you.',
    steps: [
      { text: 'Reach Bay National Bank', done: (g) => g.nearLandmark('bank', 12) },
      { text: 'Grab the cash inside (stay 5 seconds)', done: (g) => g.bankTimer >= 5 },
      { text: 'Escape to the Vega Hideout — lose the cops', done: (g) => g.nearLandmark('hideout', 14) && g.police.wanted === 0 },
    ],
    reward: 2500,
  },
];

export class Missions {
  constructor(game) {
    this.game = game;
    this.index = 0;          // which mission is active
    this.step = 0;           // which step inside it
    this.finished = false;   // the whole arc is done
    this.timeLeft = 0;
    this.bankTimer = 0;
    this.kills = 0;
    this.enforcersSpawned = false;
    this._stepToastShown = false;
  }

  get current() { return MISSION_DEFS[this.index]; }

  /** The active objective text for the HUD. */
  objectiveText() {
    if (this.finished) return '<b>STORY COMPLETE</b><br>Solmar Bay is yours, Rico. Free roam — keep the engine warm.';
    const m = this.current;
    const step = m.steps[this.step];
    let text = step.text;
    if (m.id === 'heat' && this.step === 1) text = `Take out 3 enforcers (${Math.min(3, this.kills)}/3)`;
    let out = `<b>${m.title}</b><br>${text}`;
    if (m.timeLimit) out += `<br>⏱ ${Math.max(0, Math.ceil(this.timeLeft))}s left`;
    return out;
  }

  /** Where the beacon should point right now, or null. */
  beaconTarget() {
    if (this.finished) return null;
    const m = this.current;
    const L = this.game.city.landmarks;
    if (m.id === 'wheels') return this.step === 0 ? null : L.plaza;
    if (m.id === 'courier') return [L.docks, L.park, L.dealership][this.step];
    if (m.id === 'heat') return L.docks;
    if (m.id === 'score') return [L.bank, L.bank, L.hideout][this.step];
    return null;
  }

  start() {
    this.index = 0; this.step = 0; this.finished = false;
    this.kills = 0; this.bankTimer = 0;
    this._armMission();
    this.game.toast(`${this.current.title} — ${this.current.giver}: ${this.current.brief}`, 6);
  }

  _armMission() {
    const m = this.current;
    this.timeLeft = m.timeLimit || 0;
    this.bankTimer = 0;
    this.enforcersSpawned = false;
    if (m.id === 'heat') this.kills = 0;
  }

  /** Called when Rico takes out a hostile. */
  onKill() {
    this.kills += 1;
    this.game.addCash(50);
    this.game.toast(`Enforcer down — +$50`, 2);
  }

  update(dt) {
    if (this.finished) return;
    const g = this.game;
    const m = this.current;
    // Mission timer.
    if (m.timeLimit) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = m.timeLimit;
        this.step = 0;
        g.toast('Too slow — the courier run restarts.', 4);
        g.audio.wantedUp();
        return;
      }
    }
    // Bank grab timer: stand inside the bank marker.
    if (m.id === 'score' && this.step === 1 && g.nearLandmark('bank', 12)) {
      this.bankTimer += dt;
      if (this.bankTimer >= 5 && !this._bankGrabbed) {
        this._bankGrabbed = true;
        g.police.addHeat(55, 'bank robbery');
        g.toast('Cash grabbed! The whole Bay Police is coming — RUN!', 4);
      }
    }
    // Spawn enforcers when Rico reaches the docks in mission 3.
    if (m.id === 'heat' && this.step === 1 && !this.enforcersSpawned) {
      this.enforcersSpawned = true;
      const L = g.city.landmarks.docks;
      for (let i = 0; i < 3; i++) {
        g.peds.spawnAt(L.x + (i - 1) * 8, L.z + 10 + i * 4, true);
      }
      g.toast('Enforcers at the docks — take them out!', 4);
    }
    // Step completion.
    const ctx = {
      player: g.player,
      police: g.police,
      kills: this.kills,
      bankTimer: this.bankTimer,
      nearLandmark: (name, r) => g.nearLandmark(name, r),
    };
    const step = m.steps[this.step];
    if (step && step.done(ctx)) this._advanceStep();
  }

  _advanceStep() {
    const g = this.game;
    this.step += 1;
    g.audio.pickup();
    const m = this.current;
    if (this.step >= m.steps.length) {
      // Mission complete.
      g.addCash(m.reward);
      g.audio.missionDone();
      g.toast(`${m.title} COMPLETE — +${fmtCash(m.reward)}`, 5);
      this.index += 1;
      this.step = 0;
      if (this.index >= MISSION_DEFS.length) {
        this.finished = true;
        g.toast('🏆 STORY COMPLETE — Solmar Bay is yours!', 8);
        g.effects.setBeacon(null);
        return;
      }
      this._armMission();
      g.toast(`${this.current.title} — ${this.current.brief}`, 6);
    }
  }
}
