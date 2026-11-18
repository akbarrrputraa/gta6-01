// Procedural canvas textures: every surface in Solmar Bay is painted in code,
// so the game ships no image files at all. Textures are drawn once at boot
// on offscreen canvases and reused by shared materials.
import * as THREE from 'three';

/** Make a canvas of the given size and hand back its 2D context. */
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/** Wrap a canvas into a repeating THREE texture. */
function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A sun-bleached building facade: warm plaster, a grid of lit and dark windows. */
export function buildingTexture(base, trim, seed) {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  // Subtle vertical grime streaks.
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(0,0,0,${0.03 + ((seed * (i + 3)) % 10) / 200})`;
    const x = (seed * 37 + i * 53) % 256;
    g.fillRect(x, 0, 3 + (i % 5), 256);
  }
  // Window grid: 6 columns x 10 rows, some lit gold, some dark glass.
  for (let r = 0; r < 10; r++) {
    for (let col = 0; col < 6; col++) {
      const x = 14 + col * 40, y = 12 + r * 24;
      const lit = ((seed + r * 7 + col * 3) % 9) < 2;
      g.fillStyle = trim; g.fillRect(x - 2, y - 2, 24, 16);
      g.fillStyle = lit ? '#ffd98a' : '#1d3247';
      g.fillRect(x, y, 20, 12);
      if (!lit) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, y, 20, 3); }
    }
  }
  // Roof band.
  g.fillStyle = trim; g.fillRect(0, 0, 256, 8);
  return toTexture(c);
}

/** Asphalt with a dashed centre line and worn edges. */
export function roadTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#2e2f33'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = '#f5c542';
  g.fillRect(61, 8, 6, 34); g.fillRect(61, 86, 6, 34);
  g.fillStyle = '#e8e8e8';
  g.fillRect(4, 0, 3, 128); g.fillRect(121, 0, 3, 128);
  return toTexture(c);
}

/** Pale sidewalk slabs with expansion joints. */
export function sidewalkTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#b8a88f'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 126);
  g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  return toTexture(c);
}

/** Warm sand with a few speckles. */
export function sandTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#e8d5a3'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(120,90,40,${Math.random() * 0.18})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  return toTexture(c);
}

/** Soft grass for the parks and hillside. */
export function grassTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#5da24a'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(20,80,20,${Math.random() * 0.25})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 3);
  }
  return toTexture(c);
}

/** A striped beach umbrella top, used on the pier parasols. */
export function umbrellaTexture(colorA, colorB) {
  const [c, g] = makeCanvas(128, 128);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? colorA : colorB;
    g.beginPath(); g.moveTo(64, 64);
    g.arc(64, 64, 64, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
    g.fill();
  }
  return toTexture(c);
}
