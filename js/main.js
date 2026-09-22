import { VERSION } from "./version.js?v=1.3.0";
import { AudioSys } from "./audio.js?v=1.3.0";
import { Input } from "./input.js?v=1.3.0";
import { Game } from "./game.js?v=1.3.0";
import { Renderer } from "./render.js?v=1.3.0";
import { bindUI } from "./ui.js?v=1.3.0";
import { bindViewport } from "./viewport.js?v=1.3.0";

const app = document.getElementById("app");
const canvas = document.getElementById("game");
const audio = new AudioSys();
const input = new Input();
const game = new Game(audio);
let renderer;
bindViewport(app, () => { if (renderer) renderer.resize(); });
renderer = new Renderer(canvas, game);
const syncUI = bindUI(game, audio);

document.title = `CABANA DE GUERRA v${VERSION}`;
window.__NNC = { game, audio, input, VERSION, sync: syncUI };

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.update();
  game.syncPointer(input);
  game.update(dt, input);
  audio.update(dt);
  renderer.draw(dt);
  syncUI();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);