/**
 * The screen furniture: a clock card, the purse, the held item, action prompts, "got it!"
 * toasts, the talk box (typewriter text with a speaker tag and answers), list menus for
 * shops and the workbench, the pockets grid, and touch controls. Modal parts take the keys
 * while open.
 */
import { item, type ItemDef } from "../data/items";
import type { Pockets, Slot } from "../game/pockets";
import { icon } from "./icons";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export interface MenuItem {
  label: string;
  sub?: string;
  icon?: string;
  disabled?: boolean;
  right?: string;
}

export class UI {
  readonly root: HTMLElement;
  private clockEl!: HTMLElement;
  private moneyEl!: HTMLElement;
  private heldEl!: HTMLElement;
  private promptEl!: HTMLElement;
  private toastsEl!: HTMLElement;
  private talkEl!: HTMLElement;
  private layer!: HTMLElement;
  /** Something modal is open (talk, menu, bag): the game should not move. */
  modal = 0;
  onVoice: ((text: string, pitch: number) => void) | null = null;
  onClick: ((what: string) => void) | null = null;

  constructor() {
    this.root = document.getElementById("ui")!;
    this.root.innerHTML = `
      <div id="hud">
        <div class="clock" id="clock"></div>
        <div class="money" id="money"></div>
        <div class="held" id="held"></div>
        <div class="prompt" id="prompt" hidden></div>
        <div class="toasts" id="toasts"></div>
        <div class="corner">
          <button class="pill" data-ui="bag">가방 <kbd>Tab</kbd></button>
          <button class="pill" data-ui="phone">섬폰 <kbd>P</kbd></button>
        </div>
      </div>
      <div id="talk" hidden><div class="tag"></div><div class="text"></div><div class="choices"></div><div class="next">▼</div></div>
      <div id="layer"></div>
      <div id="touch">
        <div class="stick" id="stick"><div class="knob" id="knob"></div></div>
        <div class="btns">
          <button data-btn="act" class="b-act">A</button>
          <button data-btn="pick" class="b-pick">줍기</button>
          <button data-btn="tool" class="b-tool">도구</button>
          <button data-btn="run" class="b-run">달리기</button>
        </div>
      </div>`;
    this.clockEl = this.$("clock");
    this.moneyEl = this.$("money");
    this.heldEl = this.$("held");
    this.promptEl = this.$("prompt");
    this.toastsEl = this.$("toasts");
    this.talkEl = this.$("talk");
    this.layer = this.$("layer");
    for (const b of this.root.querySelectorAll<HTMLElement>("[data-ui]")) b.addEventListener("click", () => this.onClick?.(b.dataset.ui!));
    if (matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  setClock(d: Date, weather: string, place: string): void {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h < 12 ? "오전" : "오후";
    const hh = h % 12 === 0 ? 12 : h % 12;
    const w = { sun: "☀️", cloud: "⛅", rain: "🌧️", snow: "❄️", storm: "⛈️" }[weather] ?? "☀️";
    const html = `<b>${ampm} ${hh}:${String(m).padStart(2, "0")}</b><span>${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]}) ${w}</span><i>${place}</i>`;
    if (this.clockEl.innerHTML !== html) this.clockEl.innerHTML = html;
  }

  setMoney(n: number): void {
    const t = `<i class="acorn"></i>${n.toLocaleString()}`;
    if (this.moneyEl.innerHTML !== t) this.moneyEl.innerHTML = t;
  }

  setHeld(s: Slot | null): void {
    const key = s ? `${s.id}:${s.n}:${s.wear}` : "";
    if (this.heldEl.dataset.k === key) return;
    this.heldEl.dataset.k = key;
    if (!s) {
      this.heldEl.innerHTML = `<span class="none">맨손 <kbd>Q</kbd></span>`;
      return;
    }
    const d = item(s.id);
    const wear = d.uses ? `<em style="width:${Math.round(((s.wear ?? d.uses) / d.uses) * 100)}%"></em>` : "";
    this.heldEl.innerHTML = `<img src="${icon(s.id)}"><span>${d.name}</span><kbd>Q</kbd><div class="wear">${wear}</div>`;
  }

  prompt(text: string | null): void {
    if (!text) {
      this.promptEl.hidden = true;
      return;
    }
    this.promptEl.hidden = false;
    if (this.promptEl.textContent !== text) this.promptEl.textContent = text;
  }

  toast(text: string, iconId?: string): void {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `${iconId ? `<img src="${icon(iconId)}">` : ""}<span>${text}</span>`;
    this.toastsEl.appendChild(el);
    setTimeout(() => el.classList.add("out"), 2600);
    setTimeout(() => el.remove(), 3100);
    while (this.toastsEl.children.length > 5) this.toastsEl.firstElementChild?.remove();
  }

  /**
   * Talk: show lines one by one with a typewriter; the last line can offer choices.
   * Resolves with the chosen index (or -1 when there were none).
   */
  say(name: string, lines: string[], o: { choices?: string[]; color?: string; pitch?: number } = {}): Promise<number> {
    this.modal++;
    const el = this.talkEl;
    el.hidden = false;
    const tag = el.querySelector(".tag") as HTMLElement;
    const text = el.querySelector(".text") as HTMLElement;
    const ch = el.querySelector(".choices") as HTMLElement;
    const next = el.querySelector(".next") as HTMLElement;
    tag.textContent = name;
    tag.style.background = o.color ?? "#f8b84a";
    tag.hidden = !name;
    return new Promise((resolve) => {
      let li = 0;
      let shown = 0;
      let timer = 0;
      let sel = 0;
      const typing = () => shown < lines[li].length;
      const render = () => {
        text.textContent = lines[li].slice(0, shown);
        const last = li === lines.length - 1;
        next.hidden = typing() || (last && !!o.choices);
        ch.innerHTML = "";
        if (last && o.choices && !typing()) {
          o.choices.forEach((c, k) => {
            const b = document.createElement("button");
            b.textContent = c;
            b.className = k === sel ? "on" : "";
            b.onclick = (e) => {
              e.stopPropagation();
              finish(k);
            };
            ch.appendChild(b);
          });
        }
      };
      const step = () => {
        if (typing()) {
          shown = Math.min(lines[li].length, shown + 1);
          const c = lines[li][shown - 1];
          if (shown % 2 === 0 && c && c.trim()) this.onVoice?.(c, o.pitch ?? 1);
          render();
          timer = window.setTimeout(step, 28);
        }
      };
      const advance = () => {
        if (typing()) {
          shown = lines[li].length;
          render();
          return;
        }
        if (li < lines.length - 1) {
          li++;
          shown = 0;
          render();
          step();
          return;
        }
        if (!o.choices) finish(-1);
      };
      const key = (e: KeyboardEvent) => {
        if (["Space", "Enter", "KeyE"].includes(e.code)) {
          e.preventDefault();
          if (o.choices && li === lines.length - 1 && !typing()) finish(sel);
          else advance();
        } else if (o.choices && li === lines.length - 1 && !typing()) {
          if (e.code === "ArrowUp" || e.code === "KeyW") sel = (sel + o.choices.length - 1) % o.choices.length;
          if (e.code === "ArrowDown" || e.code === "KeyS") sel = (sel + 1) % o.choices.length;
          if (e.code === "Escape") finish(o.choices.length - 1);
          render();
        }
      };
      const click = () => advance();
      const finish = (k: number) => {
        clearTimeout(timer);
        window.removeEventListener("keydown", key, true);
        el.removeEventListener("click", click);
        el.hidden = true;
        this.modal--;
        resolve(k);
      };
      // Wait a frame so the key that opened the talk doesn't also skip it.
      setTimeout(() => {
        window.addEventListener("keydown", key, true);
        el.addEventListener("click", click);
      }, 60);
      render();
      step();
    });
  }

  /** A scrolling list to pick from (shop, bench, museum). Resolves with the index or -1. */
  menu(title: string, items: MenuItem[], o: { foot?: string; keep?: boolean; onPick?: (i: number) => boolean | void } = {}): Promise<number> {
    this.modal++;
    const box = document.createElement("div");
    box.className = "panel menu";
    box.innerHTML = `<h2>${title}</h2><div class="list"></div><div class="foot">${o.foot ?? ""}<span><kbd>Space</kbd> 고르기 <kbd>Esc</kbd> 닫기</span></div>`;
    const list = box.querySelector(".list") as HTMLElement;
    this.layer.appendChild(box);
    let sel = Math.max(0, items.findIndex((x) => !x.disabled));
    let pick: () => void = () => {};
    const draw = () => {
      list.innerHTML = "";
      items.forEach((it, k) => {
        const r = document.createElement("div");
        r.className = "row" + (k === sel ? " on" : "") + (it.disabled ? " off" : "");
        r.innerHTML = `${it.icon ? `<img src="${icon(it.icon)}">` : ""}<div><b>${it.label}</b>${it.sub ? `<small>${it.sub}</small>` : ""}</div>${it.right ? `<span class="r">${it.right}</span>` : ""}`;
        r.onclick = () => {
          sel = k;
          pick();
        };
        list.appendChild(r);
      });
      (list.children[sel] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
    };
    return new Promise((resolve) => {
      const done = (k: number) => {
        window.removeEventListener("keydown", key, true);
        box.remove();
        this.modal--;
        resolve(k);
      };
      pick = () => {
        if (items[sel]?.disabled) return;
        if (o.onPick) {
          const close = o.onPick(sel);
          draw();
          if (close) done(sel);
          return;
        }
        done(sel);
      };
      const key = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === "Escape" || e.code === "Backspace" || e.code === "Tab") return done(-1);
        if (e.code === "ArrowDown" || e.code === "KeyS") sel = Math.min(items.length - 1, sel + 1);
        if (e.code === "ArrowUp" || e.code === "KeyW") sel = Math.max(0, sel - 1);
        if (e.code === "PageDown") sel = Math.min(items.length - 1, sel + 8);
        if (e.code === "PageUp") sel = Math.max(0, sel - 8);
        if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") return pick();
        draw();
      };
      setTimeout(() => window.addEventListener("keydown", key, true), 60);
      const close = document.createElement("button");
      close.className = "x";
      close.textContent = "✕";
      close.onclick = () => done(-1);
      box.appendChild(close);
      draw();
    });
  }

  /** The pockets: a grid of slots; picking one opens its actions. Resolves when closed. */
  bag(p: Pockets, actions: (s: Slot, i: number) => { label: string; run: () => void | Promise<void> }[], title = "주머니"): Promise<void> {
    this.modal++;
    const box = document.createElement("div");
    box.className = "panel bag";
    this.layer.appendChild(box);
    let sel = 0;
    let sub: { label: string; run: () => void | Promise<void> }[] | null = null;
    let subSel = 0;
    const cols = 10;
    const draw = () => {
      const s = p.slots[sel];
      const d: ItemDef | null = s ? item(s.id) : null;
      box.innerHTML = `<h2>${title}</h2><div class="grid"></div><div class="info">${d ? `<img src="${icon(s!.id)}"><div><b>${d.name}${s!.n > 1 ? ` ×${s!.n}` : ""}</b><small>${d.desc ?? ""}${d.sell ? ` · 팔면 ${d.sell.toLocaleString()} 도토리` : ""}</small></div>` : "<small>빈 칸</small>"}</div><div class="money"><i class="acorn"></i>${p.money.toLocaleString()}</div>`;
      const grid = box.querySelector(".grid") as HTMLElement;
      p.slots.forEach((x, k) => {
        const c = document.createElement("div");
        c.className = "slot" + (k === sel ? " on" : "");
        if (x) c.innerHTML = `<img src="${icon(x.id)}">${x.n > 1 ? `<b>${x.n}</b>` : ""}`;
        c.onclick = () => {
          sel = k;
          open();
        };
        grid.appendChild(c);
      });
      if (sub) {
        const m = document.createElement("div");
        m.className = "sub";
        sub.forEach((a, k) => {
          const b = document.createElement("button");
          b.textContent = a.label;
          b.className = k === subSel ? "on" : "";
          b.onclick = (e) => {
            e.stopPropagation();
            subSel = k;
            runSub();
          };
          m.appendChild(b);
        });
        (grid.children[sel] as HTMLElement).appendChild(m);
      }
      const x = document.createElement("button");
      x.className = "x";
      x.textContent = "✕";
      x.onclick = () => done();
      box.appendChild(x);
    };
    const open = () => {
      const s = p.slots[sel];
      if (!s) return;
      sub = [...actions(s, sel), { label: "그만두기", run: () => {} }];
      subSel = 0;
      draw();
    };
    let resolveFn: () => void = () => {};
    const done = () => {
      window.removeEventListener("keydown", key, true);
      box.remove();
      this.modal--;
      resolveFn();
    };
    const runSub = async () => {
      const a = sub![subSel];
      sub = null;
      // Actions that talk or move the player close the bag first.
      done();
      await a.run();
    };
    const key = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (sub) {
        if (e.code === "ArrowDown" || e.code === "KeyS") subSel = Math.min(sub.length - 1, subSel + 1);
        if (e.code === "ArrowUp" || e.code === "KeyW") subSel = Math.max(0, subSel - 1);
        if (e.code === "Escape" || e.code === "Backspace") sub = null;
        if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") return void runSub();
        return draw();
      }
      if (e.code === "Escape" || e.code === "Tab" || e.code === "KeyI" || e.code === "Backspace") return done();
      if (e.code === "ArrowRight" || e.code === "KeyD") sel = Math.min(p.size - 1, sel + 1);
      if (e.code === "ArrowLeft" || e.code === "KeyA") sel = Math.max(0, sel - 1);
      if (e.code === "ArrowDown" || e.code === "KeyS") sel = Math.min(p.size - 1, sel + cols);
      if (e.code === "ArrowUp" || e.code === "KeyW") sel = Math.max(0, sel - cols);
      if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") open();
      draw();
    };
    return new Promise((resolve) => {
      resolveFn = resolve;
      setTimeout(() => window.addEventListener("keydown", key, true), 60);
      draw();
    });
  }

  /** Ask for a line of text (a friend's code, a message). */
  ask(title: string, placeholder = "", max = 20): Promise<string | null> {
    this.modal++;
    const box = document.createElement("div");
    box.className = "panel menu ask";
    box.innerHTML = `<h2>${title}</h2><input maxlength="${max}" placeholder="${placeholder}"><div class="foot"><button class="pill ok">확인</button><button class="pill no">취소</button></div>`;
    this.layer.appendChild(box);
    const inp = box.querySelector("input") as HTMLInputElement;
    setTimeout(() => inp.focus(), 50);
    return new Promise((resolve) => {
      const done = (v: string | null) => {
        box.remove();
        this.modal--;
        resolve(v);
      };
      inp.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.code === "Enter") done(inp.value.trim() || null);
        if (e.code === "Escape") done(null);
      });
      (box.querySelector(".ok") as HTMLElement).onclick = () => done(inp.value.trim() || null);
      (box.querySelector(".no") as HTMLElement).onclick = () => done(null);
    });
  }

  /** A full-screen card (title screen, big news). */
  card(html: string, cls = ""): HTMLElement {
    const el = document.createElement("div");
    el.className = "panel card " + cls;
    el.innerHTML = html;
    this.layer.appendChild(el);
    return el;
  }

  fade(on: boolean): Promise<void> {
    let f = document.getElementById("fade");
    if (!f) {
      f = document.createElement("div");
      f.id = "fade";
      document.body.appendChild(f);
    }
    f.classList.toggle("on", on);
    return new Promise((r) => setTimeout(r, 380));
  }
}
