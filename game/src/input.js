// Keyboard + mouse input. Keys are tracked by code (KeyW, Space, …) so the
// layout is stable, and mouse drags orbit the camera. `pressed` is a
// one-frame edge trigger consumed by the game loop each tick.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => {
      if (e.target.closest('button')) return;
      this._dragging = true; this.mouseDown = true;
      this._lastX = e.clientX; this._lastY = e.clientY;
    };
    this._onMouseMove = (e) => {
      if (!this._dragging) return;
      this.mouseDX += e.clientX - this._lastX;
      this.mouseDY += e.clientY - this._lastY;
      this._lastX = e.clientX; this._lastY = e.clientY;
    };
    this._onMouseUp = (e) => {
      this._dragging = false; this.mouseDown = false;
      if (e.target.closest('#app') || e.target.tagName === 'CANVAS') this.clicked = true;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  /** True while the key is held. */
  down(code) { return this.keys.has(code); }

  /** True once, on the frame the key went down. */
  wasPressed(code) { return this.pressed.has(code); }

  /** WASD / arrows as a -1..1 pair, already normalised. */
  moveAxes() {
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }

  /** Clear the one-frame edge state after the game has read it. */
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0; this.mouseDY = 0;
    this.clicked = false;
  }
}
