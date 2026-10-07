import { VERSION } from "./version.js?v=202610070436";
import { AudioSys } from "./audio.js?v=202610070436";
import { Input } from "./input.js?v=202610070436";
import { Game, MODE, PHASE } from "./game.js?v=202610070436";
import { Renderer } from "./render.js?v=202610070436";
import { Render3D } from "./render3d.js?v=202610070436";
import { bindUI } from "./ui.js?v=202610070436";
import { bindViewport } from "./viewport.js?v=202610070436";

const app = document.getElementById("app");
let canvas = document.getElementById("game");
const audio = new AudioSys();
const input = new Input();
const game = new Game(audio);

let renderer;
const r3d = new Render3D();
bindViewport(app, () => { if (renderer) renderer.resize(); });

if (r3d.init(canvas, game)) {
  renderer = r3d;
} else {
  /* Canvas já com contexto WebGL não aceita 2D  -  troca por um canvas novo. */
  try {
    const fresh = canvas.cloneNode(false);
    canvas.replaceWith(fresh);
    canvas = fresh;
  } catch (_) { /* segue no mesmo canvas se der */ }
  renderer = new Renderer(canvas, game);
  r3d.showWebglError(true);
}

const syncUI = bindUI(game, audio);

document.title = `CABANA DE GUERRA v${VERSION}`;
window.__NNC = { game, audio, input, VERSION, sync: syncUI, render3d: r3d.isOk() };

/* Aba/app oculta mid-jogo: pausa pra não continuar "cego" (zumbis, timer). */
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    /* Continuar na pausa: áudio só volta com setMode(PLAY) / Continuar. */
    return;
  }
  try { audio.suspend(); } catch (_) { /* ok */ }
  if (game.mode === MODE.PLAY && !game.showTutorial) {
    if (game.showCraft) game.showCraft = false;
    game.setMode(MODE.PAUSE);
    try { syncUI(); } catch (_) { /* ok */ }
  }
});

/* Wave4: marcadores de zumbi fora da tela (borda segura entre HUD e controles). */
let safeRect = null;
let safeAge = 999;
function measureSafe(W, H) {
  let top = 8;
  let bottom = H - 8;
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el || el.offsetParent === null) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (r.bottom < H * 0.5) { if (sel !== "#banner") top = Math.max(top, r.bottom); }
    else if (r.top > H * 0.5) bottom = Math.min(bottom, r.top);
  };
  [".hud-top", "#hotbar", ".touch-extra", ".touch-actions", ".stick", "#banner"].forEach(pick);
  return { L: 26, R: W - 26, T: top + 24, B: Math.max(top + 120, bottom - 24) };
}
function updateThreats() {
  const g = game;
  const out = [];
  const night = g.phase === PHASE.NIGHT || g.phase === PHASE.DUSK;
  if (!(g.mode === MODE.PLAY && night && !g.showTutorial && !g.showCraft) ||
      typeof renderer.worldToScreen !== "function") {
    g.threats = out;
    return;
  }
  const W = g.viewW || window.innerWidth;
  const H = g.viewH || window.innerHeight;
  if (!safeRect || ++safeAge > 30) {
    safeRect = measureSafe(W, H);
    safeAge = 0;
  }
  const { L, R, T, B } = safeRect;
  const cx = (L + R) / 2;
  const cy = (T + B) / 2;
  const p = g.player;
  const sectors = new Map();
  for (const z of g.zombies) {
    if (!z || z.hp <= 0) continue;
    const s = renderer.worldToScreen(z.x, z.y);
    if (!s) continue;
    if (!s.behind && s.x >= 0 && s.x <= W && s.y >= 0 && s.y <= H) continue;
    let dx = s.x - cx;
    let dy = s.y - cy;
    if (s.behind) { dx = -dx; dy = -dy; }
    if (!dx && !dy) continue;
    const ang = Math.atan2(dy, dx);
    const key = Math.round((ang / (Math.PI * 2)) * 12);
    const d = Math.hypot(z.x - p.x, z.y - p.y);
    const cur = sectors.get(key);
    if (!cur) sectors.set(key, { ang, dx, dy, d, n: 1, bruto: z.kind === "bruto" });
    else {
      cur.n += 1;
      if (z.kind === "bruto") cur.bruto = true;
      if (d < cur.d) Object.assign(cur, { ang, dx, dy, d });
    }
  }
  for (const t of sectors.values()) {
    const kx = t.dx > 0 ? (R - cx) / t.dx : t.dx < 0 ? (L - cx) / t.dx : Infinity;
    const ky = t.dy > 0 ? (B - cy) / t.dy : t.dy < 0 ? (T - cy) / t.dy : Infinity;
    const k = Math.min(kx, ky);
    const near = Math.max(0.35, Math.min(1, 1 - (t.d - 260) / 900));
    out.push({ x: cx + t.dx * k, y: cy + t.dy * k, ang: t.ang, n: t.n, bruto: t.bruto, near, d: t.d });
  }
  out.sort((a, b) => a.d - b.d);
  g.threats = out.slice(0, 6);
}
window.addEventListener("resize", () => { safeAge = 999; });

let last = performance.now();
function frame(now) {
  /* Aba oculta: não simula nem renderiza (dt efetivo = 0). */
  if (document.hidden) {
    last = now;
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.update();
  game.syncPointer(input);
  if (typeof renderer.screenToWorld === "function") {
    const w = renderer.screenToWorld(input.screenX, input.screenY);
    if (w) {
      input.worldX = w.x;
      input.worldY = w.y;
    }
  }
  game.update(dt, input);
  audio.update(dt);
  renderer.draw(dt);
  updateThreats();
  syncUI();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
