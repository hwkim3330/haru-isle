/**
 * Procedural animation for the chibi rig: walking and running cycles from speed, one-shot
 * actions (swinging a tool, digging, casting, a happy hop), held poses (sitting, fishing,
 * sleeping), blinking and talking mouths.
 */
import type { Rig } from "./body";

export type Act = "swing" | "chop" | "dig" | "net" | "cast" | "pick" | "shake" | "water" | "wave" | "joy" | "surprise" | "sad" | "eat" | "slingshot" | "bow" | "dance";
export type Hold = "none" | "sit" | "sleep" | "fish" | "read" | "sing" | "exercise" | "carry" | "net";

const DUR: Record<Act, number> = { swing: 0.42, chop: 0.5, dig: 0.7, net: 0.45, cast: 0.6, pick: 0.45, shake: 0.9, water: 0.9, wave: 1.1, joy: 0.9, surprise: 0.8, sad: 1.4, eat: 1.2, slingshot: 0.5, bow: 1.0, dance: 2.4 };

export class Animator {
  private t = 0;
  private phase = 0;
  act: Act | null = null;
  private actT = 0;
  hold: Hold = "none";
  talking = false;
  private blinkIn = 2 + Math.random() * 3;
  private blinkT = 0;
  /** Extra height the rig floats (hops), read by the owner. */
  hop = 0;

  constructor(readonly rig: Rig) {}

  play(a: Act): void {
    this.act = a;
    this.actT = 0;
  }

  get busy(): boolean {
    return this.act !== null;
  }

  /** Progress through the current action 0..1. */
  get actP(): number {
    return this.act ? this.actT / DUR[this.act] : 0;
  }

  update(dt: number, speed: number, running = false): void {
    const r = this.rig;
    this.t += dt;
    const moving = speed > 0.05;
    this.phase += dt * (running ? 13 : 9) * Math.min(1.4, speed / (running ? 5 : 2.6) + 0.35) * (moving ? 1 : 0);
    const s = Math.sin(this.phase);
    const amp = moving ? (running ? 0.9 : 0.6) : 0;
    let legL = s * amp;
    let legR = -s * amp;
    let armLx = -s * amp * 0.8;
    let armRx = s * amp * 0.8;
    let armLz = 0.25;
    let armRz = -0.25;
    let bodyY = moving ? Math.abs(Math.cos(this.phase)) * (running ? 0.07 : 0.04) : Math.sin(this.t * 2) * 0.008;
    let lean = moving ? (running ? 0.2 : 0.06) : 0;
    let headX = moving ? 0 : Math.sin(this.t * 1.1) * 0.03;
    let headZ = 0;
    let bodyRY = 0;
    this.hop = 0;
    // Held poses.
    switch (this.hold) {
      case "sit":
        legL = legR = -1.4;
        bodyY = -0.14;
        armLx = armRx = -0.3;
        break;
      case "sleep":
        headX = 0.35;
        headZ = 0.25;
        armLx = armRx = -0.2;
        break;
      case "fish":
        armRx = -1.1 + Math.sin(this.t * 1.5) * 0.03;
        armLx = -0.9;
        armLz = -0.3;
        break;
      case "net":
        armRx = -0.5;
        armLx = -0.5;
        armLz = -0.4;
        break;
      case "read":
        armLx = armRx = -1.1;
        armLz = -0.35;
        armRz = 0.35;
        headX = 0.25;
        break;
      case "sing":
        headZ = Math.sin(this.t * 3) * 0.12;
        armLz = 0.9 + Math.sin(this.t * 3) * 0.2;
        armRz = -0.9 - Math.sin(this.t * 3) * 0.2;
        break;
      case "exercise": {
        const e = Math.sin(this.t * 5);
        armLz = 0.25 + (e * 0.5 + 0.5) * 2.6;
        armRz = -armLz;
        bodyY = Math.abs(e) * 0.05;
        break;
      }
      case "carry":
        armLx = armRx = -1.3;
        armLz = -0.2;
        armRz = 0.2;
        break;
    }
    // One-shot actions.
    if (this.act) {
      this.actT += dt;
      const p = Math.min(1, this.actT / DUR[this.act]);
      const ease = (x: number) => x * x * (3 - 2 * x);
      switch (this.act) {
        case "swing":
        case "chop": {
          // Raise, then bring it down in front.
          const up = p < 0.45 ? ease(p / 0.45) : 1 - ease((p - 0.45) / 0.55);
          armRx = -2.6 * up + (p > 0.45 ? 0.3 : 0);
          armLx = -1.0 * up;
          lean = 0.1 * (1 - up);
          if (this.act === "chop") bodyRY = -0.5 * up;
          break;
        }
        case "dig": {
          const k = Math.sin(p * Math.PI * 2);
          armRx = armLx = -0.9 + k * 0.6;
          lean = 0.25 + k * 0.08;
          break;
        }
        case "net": {
          const k = p < 0.3 ? ease(p / 0.3) : 1 - ease((p - 0.3) / 0.7);
          armRx = -2.2 * k - 0.3;
          armLx = -1.5 * k;
          bodyRY = 0.6 * k - 0.3 * (1 - k);
          break;
        }
        case "cast": {
          const k = p < 0.4 ? ease(p / 0.4) : 1 - ease((p - 0.4) / 0.6);
          armRx = -2.4 * k - 1.0 * (1 - k);
          armLx = -0.8;
          break;
        }
        case "pick":
          armRx = armLx = -0.8 * Math.sin(p * Math.PI);
          lean = 0.45 * Math.sin(p * Math.PI);
          headX = 0.3 * Math.sin(p * Math.PI);
          break;
        case "shake": {
          const k = Math.sin(p * Math.PI * 8) * (1 - p);
          armRx = armLx = -1.2;
          lean = 0.12 * k;
          bodyRY = 0.2 * k;
          break;
        }
        case "water":
          armRx = -1.0;
          armLx = -0.9;
          lean = 0.15;
          break;
        case "wave":
          armRz = -2.7 + Math.sin(p * Math.PI * 6) * 0.3;
          armRx = 0;
          break;
        case "joy":
          this.hop = Math.max(0, Math.sin(p * Math.PI * 2)) * 0.22;
          armLz = 2.6;
          armRz = -2.6;
          break;
        case "surprise":
          this.hop = Math.max(0, Math.sin(p * Math.PI)) * 0.12;
          armLz = 1.4;
          armRz = -1.4;
          headX = -0.2;
          break;
        case "sad":
          headX = 0.4;
          armLz = armRz = 0;
          lean = 0.1;
          break;
        case "eat":
          armRx = -1.8 - Math.sin(p * Math.PI * 6) * 0.3;
          armRz = 0.3;
          break;
        case "slingshot":
          armRx = -2.0;
          armLx = -2.2;
          headX = -0.3;
          break;
        case "bow":
          lean = 0.5 * Math.sin(p * Math.PI);
          break;
        case "dance": {
          const k = Math.sin(p * Math.PI * 8);
          bodyRY = k * 0.4;
          armLz = 1.2 + k * 0.6;
          armRz = -1.2 + k * 0.6;
          this.hop = Math.abs(Math.sin(p * Math.PI * 8)) * 0.08;
          break;
        }
      }
      if (this.actT >= DUR[this.act]) this.act = null;
    }
    r.legL.rotation.x = legL;
    r.legR.rotation.x = legR;
    r.armL.rotation.set(armLx, 0, armLz);
    r.armR.rotation.set(armRx, 0, armRz);
    r.body.position.y = bodyY + this.hop;
    r.legL.position.y = r.legR.position.y = 0.2 + this.hop;
    r.body.rotation.set(lean, bodyRY, 0);
    r.head.rotation.set(headX, 0, headZ);
    if (r.tail) r.tail.rotation.z = Math.sin(this.t * (moving ? 10 : 3)) * (moving ? 0.35 : 0.15);
    // Face.
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.13;
      this.blinkIn = 2.5 + Math.random() * 3.5;
    }
    if (this.blinkT > 0) this.blinkT -= dt;
    if (this.hold === "sleep") r.face.set("blink");
    else if (this.blinkT > 0) r.face.set("blink");
    else if (this.talking && Math.sin(this.t * 22) > 0) r.face.set("talk");
    else r.face.set("open");
  }
}
