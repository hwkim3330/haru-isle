/**
 * Input: keys, mouse and a touch joystick with buttons, folded into one state the game reads
 * each frame. "act" is the main button (use the tool, talk, open); "pick" picks up; "tool"
 * cycles the held tool; "bag" opens the pockets; "phone" the phone.
 */
export interface Pad {
  x: number;
  z: number;
  run: boolean;
  act: boolean;
  pick: boolean;
  tool: number;
  bag: boolean;
  phone: boolean;
  map: boolean;
  back: boolean;
  num: number;
  emote: boolean;
}

export class Input {
  private readonly down = new Set<string>();
  private pressed = new Set<string>();
  private stick = { x: 0, z: 0, on: false };
  private touchBtns = new Set<string>();
  private touchPressed = new Set<string>();
  enabled = true;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());
  }

  /** A touch joystick on the left half, buttons from the DOM (data-btn). */
  bindTouch(stickEl: HTMLElement, knob: HTMLElement): void {
    let id: number | null = null;
    let ox = 0;
    let oy = 0;
    const R = 50;
    stickEl.addEventListener("pointerdown", (e) => {
      id = e.pointerId;
      const r = stickEl.getBoundingClientRect();
      ox = r.left + r.width / 2;
      oy = r.top + r.height / 2;
      stickEl.setPointerCapture(e.pointerId);
      this.stick.on = true;
      move(e);
    });
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox;
      let dy = e.clientY - oy;
      const l = Math.hypot(dx, dy);
      if (l > R) {
        dx = (dx / l) * R;
        dy = (dy / l) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / R;
      this.stick.z = dy / R;
    };
    stickEl.addEventListener("pointermove", move);
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      this.stick = { x: 0, z: 0, on: false };
      knob.style.transform = "";
    };
    stickEl.addEventListener("pointerup", up);
    stickEl.addEventListener("pointercancel", up);
    for (const b of document.querySelectorAll<HTMLElement>("[data-btn]")) {
      const k = b.dataset.btn!;
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.touchBtns.add(k);
        this.touchPressed.add(k);
      });
      const off = () => this.touchBtns.delete(k);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointerleave", off);
    }
  }

  /** Press a virtual button from code (tests, UI). */
  tap(k: string): void {
    this.touchPressed.add(k);
  }

  read(): Pad {
    const d = this.down;
    const p = this.pressed;
    const tp = this.touchPressed;
    let x = (d.has("KeyD") || d.has("ArrowRight") ? 1 : 0) - (d.has("KeyA") || d.has("ArrowLeft") ? 1 : 0);
    let z = (d.has("KeyS") || d.has("ArrowDown") ? 1 : 0) - (d.has("KeyW") || d.has("ArrowUp") ? 1 : 0);
    if (this.stick.on) {
      x = this.stick.x;
      z = this.stick.z;
    }
    const l = Math.hypot(x, z);
    if (l > 1) {
      x /= l;
      z /= l;
    }
    let num = -1;
    for (let k = 1; k <= 9; k++) if (p.has(`Digit${k}`)) num = k - 1;
    const pad: Pad = {
      x: this.enabled ? x : 0,
      z: this.enabled ? z : 0,
      run: d.has("ShiftLeft") || d.has("ShiftRight") || this.touchBtns.has("run") || (this.stick.on && l > 0.92),
      act: p.has("Space") || p.has("Enter") || tp.has("act"),
      pick: p.has("KeyE") || tp.has("pick"),
      tool: p.has("KeyQ") || tp.has("tool") ? 1 : p.has("KeyZ") ? -1 : 0,
      bag: p.has("Tab") || p.has("KeyI") || tp.has("bag"),
      phone: p.has("KeyP") || tp.has("phone"),
      map: p.has("KeyM") || tp.has("map"),
      back: p.has("Escape") || p.has("Backspace") || tp.has("back"),
      num,
      emote: p.has("KeyR") || tp.has("emote"),
    };
    this.pressed = new Set();
    this.touchPressed = new Set();
    return pad;
  }
}
