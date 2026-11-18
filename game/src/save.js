// Save / load through localStorage: cash, mission progress, health and
// position. Nothing leaves the player's own browser.
const SAVE_KEY = 'solmar-bay-save-v1';

export function saveGame(game) {
  try {
    const data = {
      cash: game.cash,
      missionIndex: game.missions.index,
      missionStep: game.missions.step,
      health: game.player.health,
      x: game.player.x,
      z: game.player.z,
      kills: game.missions.kills,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
