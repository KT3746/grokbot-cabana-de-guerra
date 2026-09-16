import { TILE, SCALE, hash2, lerp, WEAPONS } from "./data.js?v=1.2.2";
import { T } from "./world.js?v=1.2.2";
import { MODE } from "./game.js?v=1.2.2";

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.game = game;
    this.light = document.createElement("canvas");
    this.lctx = this.light.getContext("2d");
    this.t = 0;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => this.resize());
      window.visualViewport.addEventListener("scroll", () => this.resize());
    }
  }

  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const app = document.getElementById("app");
    const w = (app && app.clientWidth) || this.canvas.clientWidth || window.innerWidth;
    const h = (app && app.clientHeight) || this.canvas.clientHeight || window.innerHeight;
    const bw = Math.floor(w * dpr);
    const bh = Math.floor(h * dpr);
    if (this.canvas.width === bw && this.canvas.height === bh && this.game.viewW === w && this.game.viewH === h) {
      return;
    }
    this.canvas.width = bw;
    this.canvas.height = bh;
    this.light.width = this.canvas.width;
    this.light.height = this.canvas.height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.game.viewW = w;
    this.game.viewH = h;
  }

  draw(dt = 0.016) {
    this.t += dt;
    const g = this.game;
    const ctx = this.ctx;
    const w = g.viewW;
    const h = g.viewH;
    ctx.clearRect(0, 0, w, h);

    let sx = 0;
    let sy = 0;
    if (g.shake > 0) {
      sx = (Math.random() - 0.5) * g.shake;
      sy = (Math.random() - 0.5) * g.shake;
    }

    ctx.save();
    ctx.translate(-g.cam.x + sx, -g.cam.y + sy);
    this._world();
    this._plots();
    this._resources();
    this._buildings();
    this._cabin();
    ctx.restore();

    this._lighting(sx, sy);

    ctx.save();
    ctx.translate(-g.cam.x + sx, -g.cam.y + sy);
    this._fog();
    this._zombies();
    this._player();
    this._arrows();
    this._ghost();
    this._mark();
    this._particles();
    this._floaters();
    ctx.restore();

    if (g.flash > 0) {
      ctx.fillStyle = "rgba(90,8,8," + g.flash * 0.45 + ")";
      ctx.fillRect(0, 0, w, h);
    }

    if (g.mode === MODE.MENU) this._menuBackdrop();
  }

  _world() {
    const { world, cam, viewW, viewH } = this.game;
    const ctx = this.ctx;
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const x1 = Math.min(world.cols - 1, Math.floor((cam.x + viewW) / TILE) + 1);
    const y1 = Math.min(world.rows - 1, Math.floor((cam.y + viewH) / TILE) + 1);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const tile = world.at(tx, ty);
        const x = tx * TILE;
        const y = ty * TILE;
        const n = hash2(tx, ty);
        if (tile === T.WATER) {
          const wob = Math.sin(this.t * 1.6 + tx * 0.35 + ty * 0.28) * 4;
          const g = ctx.createLinearGradient(x, y, x, y + TILE);
          g.addColorStop(0, "rgb(" + (18 + wob) + "," + (36 + n * 10) + "," + (48 + n * 14) + ")");
          g.addColorStop(1, "rgb(" + (10 + wob) + "," + (24 + n * 8) + "," + (34 + n * 10) + ")");
          ctx.fillStyle = g;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = "rgba(120,160,170,0.08)";
          ctx.fillRect(x + 4, y + 10 + Math.sin(this.t + tx) * 2, TILE - 10, 2);
        } else if (tile === T.DIRT) {
          ctx.fillStyle = n > 0.5 ? "#3d2a1c" : "#342316";
          ctx.fillRect(x, y, TILE, TILE);
          if (n > 0.7) {
            ctx.fillStyle = "rgba(0,0,0,0.18)";
            ctx.fillRect(x + n * 20, y + n * 16, 3, 2);
          }
        } else if (tile === T.SOIL) {
          ctx.fillStyle = "#2a1a10";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = "#1a1008";
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        } else if (tile === T.FLOOR) {
          ctx.fillStyle = "#4a3424";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = "#3a2818";
          ctx.fillRect(x + 1, y + TILE * 0.45, TILE - 2, 2);
        } else if (tile === T.WALL || tile === T.DOOR) {
          ctx.fillStyle = "#241810";
          ctx.fillRect(x, y, TILE, TILE);
        } else {
          const g1 = 48 + n * 18;
          ctx.fillStyle = "rgb(" + (28 + n * 10) + "," + g1 + "," + (30 + n * 8) + ")";
          ctx.fillRect(x, y, TILE, TILE);
          if (n > 0.82) {
            ctx.fillStyle = n > 0.92 ? "rgba(90,70,40,0.45)" : "rgba(40,70,35,0.35)";
            ctx.fillRect(x + 6 + n * 18, y + 8 + n * 14, 2, 5);
          }
          if (n > 0.95) {
            ctx.fillStyle = "rgba(90,20,20,0.35)";
            ctx.beginPath();
            ctx.arc(x + 12 + n * 10, y + 14, 1.4, 0, 7);
            ctx.fill();
          }
        }
      }
    }
  }

  _plots() {
    const ctx = this.ctx;
    const s = SCALE;
    for (const p of this.game.world.plots) {
      const x = p.tx * TILE;
      const y = p.ty * TILE;
      if (p.state === "growing") {
        ctx.fillStyle = "#3d5c2e";
        const h = (6 + p.grow * 10) * s;
        ctx.fillRect(x + 13 * s, y + 20 * s - h, 4 * s, h);
        ctx.fillRect(x + 8 * s, y + 22 * s - h * 0.7, 3 * s, h * 0.7);
        ctx.fillStyle = "#2a4020";
        ctx.fillRect(x + 18 * s, y + 21 * s - h * 0.55, 3 * s, h * 0.55);
      } else if (p.state === "ready") {
        ctx.fillStyle = "#2f4a24";
        ctx.beginPath();
        ctx.ellipse(x + 16 * s, y + 18 * s, 11 * s, 8 * s, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#8b3a2a";
        ctx.beginPath();
        ctx.arc(x + 12 * s, y + 14 * s, 2.2 * s, 0, 7);
        ctx.arc(x + 20 * s, y + 17 * s, 2.2 * s, 0, 7);
        ctx.fill();
      }
    }
  }

  _resources() {
    const ctx = this.ctx;
    const s = SCALE;
    for (const t of this.game.world.trees) {
      if (t.stump) {
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(t.x, t.y + 5 * s, 10 * s, 4 * s, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#3a2818";
        ctx.beginPath();
        ctx.ellipse(t.x, t.y + 2 * s, 9 * s, 5 * s, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#2a1c10";
        ctx.beginPath();
        ctx.ellipse(t.x, t.y + 1 * s, 5 * s, 2.5 * s, 0, 0, 7);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.beginPath();
      ctx.ellipse(t.x, t.y + 12 * s, 14 * s, 5 * s, 0, 0, 7);
      ctx.fill();
      const tg = ctx.createLinearGradient(t.x - 5 * s, t.y, t.x + 5 * s, t.y);
      tg.addColorStop(0, "#2a1a10");
      tg.addColorStop(0.5, "#4a3220");
      tg.addColorStop(1, "#24160e");
      ctx.fillStyle = tg;
      ctx.fillRect(t.x - 4 * s, t.y - 2 * s, 8 * s, 16 * s);
      ctx.fillStyle = "#142414";
      blob(ctx, t.x, t.y - 16 * s, 17 * s);
      ctx.fillStyle = "#1c3a1c";
      blob(ctx, t.x - 7 * s, t.y - 11 * s, 12 * s);
      ctx.fillStyle = "#245024";
      blob(ctx, t.x + 6 * s, t.y - 18 * s, 9 * s);
      ctx.fillStyle = "rgba(60,90,50,0.35)";
      blob(ctx, t.x + 2 * s, t.y - 22 * s, 6 * s);
    }
    for (const r of this.game.world.rocks) {
      if (r.gone) continue;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(r.x, r.y + 7 * s, 12 * s, 4.5 * s, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#4a5058";
      ctx.beginPath();
      ctx.moveTo(r.x - 13 * s, r.y + 6 * s);
      ctx.lineTo(r.x - 7 * s, r.y - 9 * s);
      ctx.lineTo(r.x + 3 * s, r.y - 11 * s);
      ctx.lineTo(r.x + 13 * s, r.y + 5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#6a727c";
      ctx.beginPath();
      ctx.moveTo(r.x - 6 * s, r.y - 6 * s);
      ctx.lineTo(r.x + 2 * s, r.y - 9 * s);
      ctx.lineTo(r.x + 6 * s, r.y - 2 * s);
      ctx.lineTo(r.x - 2 * s, r.y);
      ctx.closePath();
      ctx.fill();
    }
    for (const v of this.game.world.veins) {
      if (v.gone) continue;
      ctx.fillStyle = "#3a4048";
      ctx.beginPath();
      ctx.moveTo(v.x - 13 * s, v.y + 7 * s);
      ctx.lineTo(v.x - 4 * s, v.y - 10 * s);
      ctx.lineTo(v.x + 10 * s, v.y - 7 * s);
      ctx.lineTo(v.x + 13 * s, v.y + 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8a9aaa";
      ctx.fillRect(v.x - 3 * s, v.y - 2 * s, 5 * s, 5 * s);
      ctx.fillStyle = "#c0d0dc";
      ctx.fillRect(v.x + 2 * s, v.y, 3 * s, 3 * s);
    }
  }

  _buildings() {
    const ctx = this.ctx;
    const s = SCALE;
    for (const f of this.game.world.fences) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(f.x - 14 * s, f.y + 8 * s, 28 * s, 3 * s);
      ctx.fillStyle = "#3a2818";
      ctx.fillRect(f.x - 12 * s, f.y - 8 * s, 5 * s, 18 * s);
      ctx.fillRect(f.x + 7 * s, f.y - 8 * s, 5 * s, 18 * s);
      ctx.fillStyle = "#4a3420";
      ctx.fillRect(f.x - 14 * s, f.y - 4 * s, 28 * s, 4 * s);
      ctx.fillRect(f.x - 14 * s, f.y + 4 * s, 28 * s, 4 * s);
      if (f.hp < f.max * 0.4) {
        ctx.fillStyle = "#1a1008";
        ctx.fillRect(f.x - 1 * s, f.y - 6 * s, 2 * s, 14 * s);
        ctx.fillStyle = "rgba(90,20,20,0.45)";
        ctx.fillRect(f.x + 4 * s, f.y, 3 * s, 2 * s);
      }
    }
    for (const t of this.game.world.torches) {
      ctx.fillStyle = "#2a1c10";
      ctx.fillRect(t.x - 2 * s, t.y - 2 * s, 4 * s, 14 * s);
      const flick = 0.65 + Math.sin(this.t * 14 + t.x) * 0.35;
      ctx.fillStyle = "rgba(255,120,30," + 0.22 * flick + ")";
      ctx.beginPath();
      ctx.arc(t.x, t.y - 9 * s, 14 * s, 0, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(255,200,80," + 0.85 * flick + ")";
      ctx.beginPath();
      ctx.arc(t.x, t.y - 9 * s, 3.5 * s, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#ff6a20";
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - 14 * s);
      ctx.lineTo(t.x - 3 * s, t.y - 7 * s);
      ctx.lineTo(t.x + 3 * s, t.y - 7 * s);
      ctx.closePath();
      ctx.fill();
    }
    for (const t of this.game.world.traps) {
      ctx.fillStyle = "#2a1c14";
      ctx.fillRect(t.x - 12 * s, t.y - 6 * s, 24 * s, 12 * s);
      ctx.strokeStyle = "#6a5040";
      ctx.lineWidth = 1.5 * s;
      ctx.strokeRect(t.x - 11 * s, t.y - 5 * s, 22 * s, 10 * s);
      ctx.fillStyle = "#8a8a90";
      ctx.beginPath();
      ctx.moveTo(t.x - 8 * s, t.y + 4 * s);
      ctx.lineTo(t.x - 5 * s, t.y - 7 * s);
      ctx.lineTo(t.x - 2 * s, t.y + 4 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(t.x + 2 * s, t.y + 4 * s);
      ctx.lineTo(t.x + 6 * s, t.y - 8 * s);
      ctx.lineTo(t.x + 9 * s, t.y + 4 * s);
      ctx.fill();
    }
  }

  _cabin() {
    const c = this.game.world.cabin;
    const ctx = this.ctx;
    const x = c.tx * TILE;
    const y = c.ty * TILE;
    const s = SCALE;
    const night = this.game.nightLight;
    const ratio = clamp01(c.hp / c.maxHp);

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + 80 * s, y + 168 * s, 78 * s, 14 * s, 0, 0, 7);
    ctx.fill();

    const wall = ctx.createLinearGradient(x, y, x + 160 * s, y);
    wall.addColorStop(0, "#2e2016");
    wall.addColorStop(0.5, "#3d2a1c");
    wall.addColorStop(1, "#261810");
    ctx.fillStyle = wall;
    ctx.fillRect(x, y + 24 * s, 160 * s, 136 * s);
    ctx.fillStyle = "#1e140e";
    ctx.fillRect(x + 5 * s, y + 30 * s, 150 * s, 124 * s);
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const py = y + (40 + i * 18) * s;
      ctx.beginPath();
      ctx.moveTo(x + 8 * s, py);
      ctx.lineTo(x + 152 * s, py);
      ctx.stroke();
    }

    ctx.fillStyle = "#1a1010";
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, y + 36 * s);
    ctx.lineTo(x + 80 * s, y - 22 * s);
    ctx.lineTo(x + 172 * s, y + 36 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a1a16";
    ctx.beginPath();
    ctx.moveTo(x + 6 * s, y + 32 * s);
    ctx.lineTo(x + 80 * s, y - 10 * s);
    ctx.lineTo(x + 154 * s, y + 32 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#14100c";
    ctx.fillRect(x + 118 * s, y - 10 * s, 14 * s, 28 * s);

    ctx.fillStyle = "#120c08";
    ctx.fillRect(x + 64 * s, y + 108 * s, 32 * s, 52 * s);
    ctx.fillStyle = "#6a5040";
    ctx.fillRect(x + 88 * s, y + 132 * s, 3 * s, 3 * s);

    const win = lerpColor("#1a1410", "#d4a24a", night * 0.85);
    ctx.fillStyle = win;
    ctx.fillRect(x + 22 * s, y + 56 * s, 26 * s, 22 * s);
    ctx.fillRect(x + 112 * s, y + 56 * s, 26 * s, 22 * s);
    ctx.strokeStyle = "#0c0806";
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(x + 22 * s, y + 56 * s, 26 * s, 22 * s);
    ctx.strokeRect(x + 112 * s, y + 56 * s, 26 * s, 22 * s);
    ctx.beginPath();
    ctx.moveTo(x + 35 * s, y + 56 * s);
    ctx.lineTo(x + 35 * s, y + 78 * s);
    ctx.moveTo(x + 125 * s, y + 56 * s);
    ctx.lineTo(x + 125 * s, y + 78 * s);
    ctx.stroke();

    if (ratio < 0.45) {
      ctx.fillStyle = "rgba(90,10,10," + (0.35 + (0.45 - ratio)) + ")";
      ctx.fillRect(x + 10 * s, y + 90 * s, 18 * s, 8 * s);
      ctx.fillRect(x + 130 * s, y + 70 * s, 12 * s, 20 * s);
    }

    ctx.fillStyle = "#00000088";
    ctx.fillRect(x + 20 * s, y + 8 * s, 120 * s, 6 * s);
    ctx.fillStyle = ratio > 0.35 ? "#c4a060" : "#a82828";
    ctx.fillRect(x + 20 * s, y + 8 * s, 120 * s * ratio, 6 * s);
  }

  _player() {
    const p = this.game.player;
    const ctx = this.ctx;
    const bob = Math.sin(p.walk * 2) * 1.4 * SCALE;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(SCALE, SCALE);
    if (p.hurt > 0) ctx.globalAlpha = 0.55 + Math.sin(this.t * 40) * 0.2;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 9, 9, 3.2, 0, 0, 7);
    ctx.fill();

    ctx.fillStyle = "#2a3530";
    ctx.fillRect(-9, -5 + bob, 18, 13);
    ctx.fillStyle = "#1e1a14";
    ctx.fillRect(-8, 7 + bob, 6, 8);
    ctx.fillRect(2, 7 + bob, 6, 8);
    ctx.fillStyle = "#3a2a18";
    ctx.fillRect(-9, 4 + bob, 18, 2);
    ctx.fillStyle = "#c4a07a";
    ctx.fillRect(-6, -15 + bob, 12, 10);
    ctx.fillStyle = "#1a221c";
    ctx.fillRect(-8, -19 + bob, 16, 5);
    ctx.fillRect(-9, -15 + bob, 4, 5);
    ctx.fillStyle = "#0a0a08";
    ctx.fillRect(-3, -11 + bob, 2, 2);
    ctx.fillRect(2, -11 + bob, 2, 2);

    if (p.swinging > 0) {
      const w = WEAPONS[this.game.equipped];
      ctx.save();
      ctx.rotate((p.aim || p.facing) + 0.6 - p.swinging * 4);
      ctx.fillStyle = "#6a5a48";
      ctx.fillRect(6, -2, w.id === "lanca" ? 28 : 18, 3);
      ctx.fillStyle = "#8a9098";
      ctx.fillRect(6 + (w.id === "lanca" ? 22 : 14), -3, 6, 5);
      ctx.restore();
    } else if (this.game.equipped === "arco") {
      ctx.save();
      ctx.rotate(p.aim || p.facing);
      ctx.strokeStyle = "#3a2a18";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, 0, 7, -1.2, 1.2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  _zombies() {
    const ctx = this.ctx;
    for (const z of this.game.zombies) {
      const brute = z.kind === "bruto";
      const run = z.kind === "corredor";
      const bob = Math.sin(z.walk * 2) * 1.3 * SCALE;
      const w = (brute ? 26 : run ? 17 : 20) * SCALE;
      const h = (brute ? 30 : run ? 22 : 24) * SCALE;
      ctx.save();
      ctx.translate(z.x, z.y);

      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 11, w * 0.5, 4, 0, 0, 7);
      ctx.fill();

      const body = brute ? "#3a4a30" : run ? "#4a4038" : "#3e4838";
      ctx.fillStyle = body;
      ctx.fillRect(-w / 2, -h / 2 + bob, w, h);
      ctx.fillStyle = "#2a2218";
      ctx.fillRect(-w / 2 + 2, -h / 2 + h * 0.35 + bob, w - 4, h * 0.45);
      ctx.fillStyle = "#5a6050";
      ctx.fillRect(-w * 0.28, -h / 2 - 3 + bob, w * 0.56, h * 0.38);
      ctx.fillStyle = "#4a2018";
      ctx.fillRect(-w * 0.12, -h / 2 + h * 0.18 + bob, w * 0.24, 3);
      ctx.fillStyle = brute ? "#c04020" : "#a03018";
      ctx.fillRect(-w * 0.18, -h / 2 + 4 + bob, 3 * SCALE, 2.5 * SCALE);
      ctx.fillRect(w * 0.06, -h / 2 + 4 + bob, 3 * SCALE, 2.5 * SCALE);

      if (z.hurt > 0) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#fff";
        ctx.fillRect(-w / 2, -h / 2 + bob, w, h);
        ctx.globalAlpha = 1;
      }
      const max = z.max || 28;
      const ratio = Math.max(0, Math.min(1, z.hp / max));
      if (z.hurt > 0 || ratio < 0.99) {
        ctx.fillStyle = "#00000099";
        ctx.fillRect(-w / 2, -h / 2 - 8 + bob, w, 3);
        ctx.fillStyle = ratio > 0.4 ? "#6a8a40" : "#a02828";
        ctx.fillRect(-w / 2, -h / 2 - 8 + bob, w * ratio, 3);
      }
      ctx.restore();
    }
  }

  _arrows() {
    const ctx = this.ctx;
    ctx.strokeStyle = "#5c4030";
    ctx.lineWidth = 2;
    for (const a of this.game.arrows) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x - a.vx * 0.04, a.y - a.vy * 0.04);
      ctx.stroke();
    }
  }

  _ghost() {
    const g = this.game.buildGhost;
    if (!g) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = g.ok ? "#c4a060" : "#b83030";
    ctx.lineWidth = 2;
    ctx.strokeRect(g.tx * TILE + 2, g.ty * TILE + 2, TILE - 4, TILE - 4);
    ctx.restore();
  }

  _mark() {
    const m = this.game.mark;
    if (!m) return;
    const ctx = this.ctx;
    const a = Math.max(0, m.t / 0.35);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#c4a060";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, (12 + (1 - a) * 10) * SCALE, 0, 7);
    ctx.stroke();
    ctx.restore();
  }

  _particles() {
    const ctx = this.ctx;
    for (const p of this.game.particles) {
      const a = clamp01(p.life / p.max);
      ctx.globalAlpha = p.soft ? a * 0.35 : a;
      ctx.fillStyle = p.color;
      if (p.soft) {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.45, 0, 0, 7);
        ctx.fill();
      } else {
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  _fog() {
    const fog = this.game.fog;
    if (!fog || !fog.length) return;
    const ctx = this.ctx;
    for (const f of fog) {
      const a = clamp01(f.life / f.max) * (f.a || 0.08);
      ctx.globalAlpha = a;
      ctx.fillStyle = "#9aa8b4";
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.size, f.size * 0.38, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#6a7888";
      ctx.beginPath();
      ctx.ellipse(f.x + f.size * 0.2, f.y + 4, f.size * 0.65, f.size * 0.28, 0, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _floaters() {
    const ctx = this.ctx;
    ctx.font = "700 " + Math.round(13 * SCALE) + "px \"Source Sans 3\", sans-serif";
    ctx.textAlign = "center";
    for (const f of this.game.floaters) {
      ctx.globalAlpha = clamp01(f.t);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  _lighting(sx, sy) {
    const g = this.game;
    const amt = g.nightLight;
    if (amt < 0.02) return;
    const ctx = this.lctx;
    const w = g.viewW;
    const h = g.viewH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.light.width, this.light.height);
    const dpr = this.canvas.width / w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "rgba(4, 6, 14, " + 0.72 * amt + ")";
    ctx.fillRect(0, 0, w, h);
    if (amt > 0.15 && amt < 0.85) {
      const dusk = Math.sin(amt * Math.PI) * 0.14;
      ctx.fillStyle = "rgba(60, 18, 8, " + dusk + ")";
      ctx.fillRect(0, 0, w, h);
    }
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0," + 0.45 * amt + ")");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "destination-out";
    const lights = [];
    lights.push({ x: g.player.x, y: g.player.y, r: 150 * SCALE, p: 0.82 });
    const c = g.world.cabin;
    lights.push({ x: c.x, y: c.y + 10, r: 160 * SCALE, p: 0.88 });
    for (const t of g.world.torches) lights.push({ x: t.x, y: t.y, r: 130 * SCALE, p: 0.95 });
    for (const z of g.zombies) lights.push({ x: z.x, y: z.y, r: 40 * SCALE, p: 0.45 });

    for (const L of lights) {
      const gx = L.x - g.cam.x + sx;
      const gy = L.y - g.cam.y + sy;
      const rad = ctx.createRadialGradient(gx, gy, 4, gx, gy, L.r);
      rad.addColorStop(0, "rgba(255,255,255," + L.p + ")");
      rad.addColorStop(0.55, "rgba(255,255,255," + L.p * 0.35 + ")");
      rad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(gx, gy, L.r, 0, 7);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    this.ctx.drawImage(this.light, 0, 0, w, h);

    if (amt > 0.2) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = "multiply";
      this.ctx.fillStyle = "rgba(28, 14, 10, " + (0.22 * amt) + ")";
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.restore();
    }
  }

  _menuBackdrop() {
    const ctx = this.ctx;
    const w = this.game.viewW;
    const h = this.game.viewH;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(4,6,12,0.55)");
    g.addColorStop(1, "rgba(12,8,6,0.4)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function blob(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerpColor(a, b, t) {
  t = clamp01(t);
  const pa = hex(a);
  const pb = hex(b);
  const r = (lerp(pa[0], pb[0], t)) | 0;
  const g = (lerp(pa[1], pb[1], t)) | 0;
  const bl = (lerp(pa[2], pb[2], t)) | 0;
  return "rgb(" + r + "," + g + "," + bl + ")";
}

function hex(h) {
  const n = h.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}