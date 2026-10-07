// Browser controller slots can be sparse after a device disconnects.
export function getGamepad() {
  return Array.from(navigator.getGamepads?.() || []).find((pad) => pad?.connected) || null;
}
