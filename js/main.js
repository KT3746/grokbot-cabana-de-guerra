import { VERSION } from "./version.js?v=202609241825";
import { AudioSys } from "./audio.js?v=202609241825";
import { Input } from "./input.js?v=202609241825";
import { Game } from "./game.js?v=202609241825";
import { Renderer } from "./render.js?v=202609241825";
import { Render3D } from "./render3d.js?v=202609241825";
import { bindUI } from "./ui.js?v=202609241825";
import { bindViewport } from "./viewport.js?v=202609241825";

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
  /* Canvas já com contexto WebGL não aceita 2D — troca por um canvas novo. */
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

let last = performance.now();
function frame(now) {
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
  syncUI();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
