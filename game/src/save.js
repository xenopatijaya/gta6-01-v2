// Save: one localStorage slot holding cash, story progress, position, health
// and the clock. Saving never touches the network.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: state.cash,
      missionIndex: state.missionIndex,
      completed: state.completed,
      playerX: state.playerX,
      playerZ: state.playerZ,
      health: state.health,
      day: state.day,
      minutes: state.minutes,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* storage unavailable */ }
}

export function hasSave() {
  return loadGame() !== null;
}
