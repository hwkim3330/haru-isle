/**
 * Painted faces. Each character gets a small atlas of canvases (open, blink, talking) drawn
 * from a face description: eye style and colour, brows, mouth, blush, markings. The face
 * wraps the front of the head as a transparent decal.
 */
import * as THREE from "three";

export type EyeStyle = "dot" | "round" | "sparkle" | "sleepy" | "lash" | "narrow" | "button" | "wide";
export type Mouth = "smile" | "cat" | "flat" | "grin" | "tiny" | "beak" | "none";

export interface FaceDesc {
  eyes: EyeStyle;
  eyeColor: number;
  mouth: Mouth;
  blush: number | null;
  brows: number | null;
  /** Freckles, a stripe across the eyes, whiskers. */
  mark?: "freckle" | "mask" | "whisker" | null;
  markColor?: number;
  /** Eye spacing 0.3–0.6 of the half-width, height 0.4–0.6. */
  spread?: number;
  eyeY?: number;
  mouthY?: number;
}

const CW = 256;
const CH = 128;

function hex(c: number): string {
  return "#" + c.toString(16).padStart(6, "0");
}

/** Draw one face frame. The canvas is an equirect strip of the head's front half. */
function draw(f: FaceDesc, blink: boolean, talk: boolean): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = CW;
  cv.height = CH;
  const g = cv.getContext("2d")!;
  const cx = CW / 2;
  const spread = (f.spread ?? 0.42) * 64;
  const ey = CH * (f.eyeY ?? 0.5);
  const my = CH * (f.mouthY ?? 0.72);
  if (f.mark === "mask") {
    g.fillStyle = hex(f.markColor ?? 0x3a3a3a);
    g.beginPath();
    g.ellipse(cx, ey, spread + 26, 17, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (f.blush !== null) {
    g.fillStyle = hex(f.blush);
    g.globalAlpha = 0.45;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + s * (spread + 10), ey + 18, 12, 7, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  if (f.mark === "freckle") {
    g.fillStyle = hex(f.markColor ?? 0xb07050);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.fillRect(cx + s * (spread + 4 + k * 5) - 1.5, ey + 16 + (k % 2) * 4, 3, 3);
  }
  if (f.mark === "whisker") {
    g.strokeStyle = hex(f.markColor ?? 0x4a3a3a);
    g.lineWidth = 2;
    for (const s of [-1, 1])
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(cx + s * 22, my - 6 + k * 5);
        g.lineTo(cx + s * 48, my - 10 + k * 8);
        g.stroke();
      }
  }
  // Eyes.
  const ink = "#2a1e22";
  for (const s of [-1, 1]) {
    const x = cx + s * spread;
    g.fillStyle = ink;
    g.strokeStyle = ink;
    g.lineCap = "round";
    if (blink || f.eyes === "sleepy") {
      g.lineWidth = 4;
      g.beginPath();
      if (blink && f.eyes !== "sleepy") g.arc(x, ey - 2, 8, 0.15 * Math.PI, 0.85 * Math.PI);
      else {
        g.moveTo(x - 9, ey);
        g.lineTo(x + 9, ey);
      }
      g.stroke();
      continue;
    }
    switch (f.eyes) {
      case "dot":
        g.beginPath();
        g.ellipse(x, ey, 5.5, 7, 0, 0, Math.PI * 2);
        g.fill();
        break;
      case "button":
        g.beginPath();
        g.arc(x, ey, 7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(x - 2, ey - 3, 2.2, 0, Math.PI * 2);
        g.fill();
        break;
      case "narrow":
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(x - 9, ey + s * 0);
        g.quadraticCurveTo(x, ey - 6, x + 9, ey);
        g.stroke();
        g.beginPath();
        g.ellipse(x, ey + 1, 4, 3, 0, 0, Math.PI * 2);
        g.fill();
        break;
      case "wide":
      case "round":
      case "sparkle":
      case "lash": {
        const rx = f.eyes === "wide" ? 10 : 8;
        const ry = f.eyes === "wide" ? 12 : 11;
        g.fillStyle = "#fff";
        g.beginPath();
        g.ellipse(x, ey, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = hex(f.eyeColor);
        g.beginPath();
        g.ellipse(x, ey + 1.5, rx * 0.72, ry * 0.8, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = ink;
        g.beginPath();
        g.ellipse(x, ey + 2, rx * 0.36, ry * 0.42, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(x - rx * 0.3, ey - ry * 0.3, 2.6, 0, Math.PI * 2);
        g.fill();
        if (f.eyes === "sparkle") {
          g.beginPath();
          g.arc(x + rx * 0.3, ey + ry * 0.35, 1.5, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = ink;
        g.lineWidth = 2.5;
        g.beginPath();
        g.ellipse(x, ey, rx, ry, 0, 0, Math.PI * 2);
        g.stroke();
        if (f.eyes === "lash") {
          g.lineWidth = 3;
          for (let k = 0; k < 3; k++) {
            g.beginPath();
            const a = -Math.PI / 2 + s * (0.5 + k * 0.28);
            g.moveTo(x + Math.cos(a) * rx, ey + Math.sin(a) * ry);
            g.lineTo(x + Math.cos(a) * (rx + 6), ey + Math.sin(a) * (ry + 5));
            g.stroke();
          }
        }
        break;
      }
    }
  }
  if (f.brows !== null) {
    g.strokeStyle = hex(f.brows);
    g.lineWidth = 3.5;
    g.lineCap = "round";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * (spread - 8), ey - 17);
      g.lineTo(cx + s * (spread + 8), ey - 19);
      g.stroke();
    }
  }
  // Mouth.
  g.strokeStyle = ink;
  g.fillStyle = "#c83a4a";
  g.lineWidth = 3;
  g.lineCap = "round";
  if (talk && f.mouth !== "beak" && f.mouth !== "none") {
    g.fillStyle = "#7a2a36";
    g.beginPath();
    g.ellipse(cx, my + 2, 8, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e8606a";
    g.beginPath();
    g.ellipse(cx, my + 5, 5, 3, 0, 0, Math.PI * 2);
    g.fill();
  } else
    switch (f.mouth) {
      case "smile":
        g.beginPath();
        g.arc(cx, my - 4, 7, 0.2 * Math.PI, 0.8 * Math.PI);
        g.stroke();
        break;
      case "cat":
        g.beginPath();
        g.arc(cx - 5, my - 2, 5, 0.1 * Math.PI, 0.95 * Math.PI);
        g.arc(cx + 5, my - 2, 5, 0.05 * Math.PI, 0.9 * Math.PI);
        g.stroke();
        break;
      case "flat":
        g.beginPath();
        g.moveTo(cx - 6, my);
        g.lineTo(cx + 6, my);
        g.stroke();
        break;
      case "grin":
        g.fillStyle = "#fff";
        g.beginPath();
        g.moveTo(cx - 10, my - 3);
        g.quadraticCurveTo(cx, my + 12, cx + 10, my - 3);
        g.closePath();
        g.fill();
        g.stroke();
        break;
      case "tiny":
        g.beginPath();
        g.arc(cx, my - 2, 3, 0.1 * Math.PI, 0.9 * Math.PI);
        g.stroke();
        break;
    }
  return cv;
}

export interface Face {
  mat: THREE.MeshBasicMaterial;
  open: THREE.Texture;
  blink: THREE.Texture;
  talk: THREE.Texture;
  set(state: "open" | "blink" | "talk"): void;
}

export function makeFace(f: FaceDesc): Face {
  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const open = tex(draw(f, false, false));
  const blink = tex(draw(f, true, false));
  const talk = tex(draw(f, false, true));
  const mat = new THREE.MeshBasicMaterial({ map: open, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return {
    mat,
    open,
    blink,
    talk,
    set(s) {
      const t = s === "open" ? open : s === "blink" ? blink : talk;
      if (mat.map !== t) {
        mat.map = t;
        mat.needsUpdate = true;
      }
    },
  };
}

/** The decal: the front half of a sphere, matching a head of radius r (scaled like it). */
export function faceGeometry(r: number): THREE.BufferGeometry {
  // Front hemisphere, u across (−90°..90°), v from top to bottom.
  const g = new THREE.SphereGeometry(r * 1.012, 32, 16, 0, Math.PI, Math.PI * 0.12, Math.PI * 0.76);
  return g;
}
