// Emberwarden — keyboard and mouse input.
//
// The game reads this one object each frame. Keys are tracked by their
// physical code (KeyW, ArrowUp, Space, ...) so layouts do not matter, and
// the mouse position is reported in canvas pixels, updated on every move.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since the last frame was read
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false; // true for one frame after a click
    this.enabled = true;

    window.addEventListener('keydown', (event) => {
      if (!this.enabled) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });

    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
      this.mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  down(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Movement vector from WASD or the arrow keys, normalised.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  get firing() {
    return this.mouseDown || this.down('Space');
  }

  get dash() {
    return this.wasPressed('ShiftLeft') || this.wasPressed('ShiftRight') || this.wasPressed('KeyJ');
  }

  get confirm() {
    return this.wasPressed('Enter') || this.mouseClicked;
  }

  get pause() {
    return this.wasPressed('KeyP') || this.wasPressed('Escape');
  }

  get restart() {
    return this.wasPressed('KeyR');
  }

  get mute() {
    return this.wasPressed('KeyM');
  }

  // Called at the end of each frame so one-frame flags clear.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
