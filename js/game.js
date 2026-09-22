import {
  TILE,
  SCALE,
  WEAPONS,
  RECIPES,
  canPay,
  pay,
  dist,
  clamp,
  irand,
  rand,
} from "./data.js?v=1.3.1";
import {
  createWorld,
  T,
  moveWithCollide,
  nearestNode,
  respawnMorning,
  randomEdgeSpawn,
  circleHitsSolid,
} from "./world.js?v=1.3.1";
import { STORAGE_KEY } from "./version.js?v=1.3.1";

export const MODE = {
  MENU: "menu",
  PLAY: "play",
  PAUSE: "pause",
  OVER: "over",
};

export const PHASE = {
  DAY: "day",
  DUSK: "dusk",
  NIGHT: "night",
  DAWN: "dawn",
};

const DAY_LEN = 75;
const NIGHT_BASE = 38;

export class Game {
  constructor(audio) {
    this.audio = audio;
    this.mode = MODE.MENU;
    this.best = Number(localStorage.getItem(STORAGE_KEY) || 0);
    this.seenTutorial = localStorage.getItem("nnc-tutorial") === "1";
    this.showTutorial = false;
    this.showCraft = false;
    this.banner = "";
    this.bannerT = 0;
    this.shake = 0;
    this.flash = 0;
    this.toasts = [];
    this.particles = [];
    this.fog = [];
    this.floaters = [];
    this.cam = { x: 0, y: 0 };
    this.viewW = 800;
    this.viewH = 450;
    this.uiLock = 0;
    this.overSnap = null;
    this.mark = null;
    this.buildGhost = null;
    this.deathBy = "";
    this.resetRun();
  }

  resetRun() {
    this.world = createWorld();
    const door = this.world.cabin;
    this.player = {
      x: door.doorX,
      y: door.doorY + 28 * SCALE,
      vx: 0,
      vy: 0,
      r: Math.round(10 * SCALE),
      hp: 140,
      maxHp: 140,
      facing: 0,
      walk: 0,
      atkCd: 0,
      actCd: 0,
      hurt: 0,
      swinging: 0,
    };
    this.inv = {
      madeira: 6,
      pedra: 4,
      comida: 3,
      ferro: 0,
      sementes: 4,
      tochas: 1,
      cercas: 1,
      armadilhas: 1,
      kits: 0,
    };
    this.weapons = { estaca: true, arco: false, lanca: false };
    this.equipped = "estaca";
    this.hot = 0;
    this.zombies = [];
    this.arrows = [];
    this.phase = PHASE.DAY;
    this.phaseT = DAY_LEN;
    this.phaseMax = DAY_LEN;
    this.nightsSurvived = 0;
    this.wave = 0;
    this.spawnT = 0;
    this.transT = 0;
    this.kills = 0;
    this.nightLight = 0;
    this.particles = [];
    this.fog = [];
    this.floaters = [];
    this.toasts = [];
    this.banner = "";
    this.bannerT = 0;
    this.shake = 0;
    this.flash = 0;
    this.showCraft = false;
    this.uiLock = 0;
    this.overSnap = null;
    this.mark = null;
    this.buildGhost = null;
    this.deathBy = "";
    if (this.audio) this.audio.setNight(false);
  }

  dayNumber() {
    return this.nightsSurvived + 1;
  }

  setMode(mode) {
    this.mode = mode;
    this.uiLock = 0.4;
    try {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    } catch (_) { /* ok */ }
  }

  goMenu() {
    this.setMode(MODE.MENU);
    this.showCraft = false;
    this.loadBest();
  }

  start() {
    this.resetRun();
    this.setMode(MODE.PLAY);
    this.showCraft = false;
    this.showTutorial = !this.seenTutorial;
    if (this.showTutorial) this.uiLock = 0.55;
    this.nightLight = 0;
    this.phase = PHASE.DAY;
    this._banner("O dia começa — colete, plante e fortaleça.");
    this.audio.setNight(false);
  }

  restart() {
    this.start();
  }

  loadBest() {
    this.best = Number(localStorage.getItem(STORAGE_KEY) || 0);
  }

  toast(msg) {
    this.toasts.push({ msg, t: 2.2 });
    if (this.toasts.length > 5) this.toasts.shift();
  }

  _banner(msg) {
    this.banner = msg;
    this.bannerT = 3.2;
  }

  burst(x, y, n, color, speed = 80, opts = {}) {
    const soft = !!opts.soft;
    const grav = opts.grav != null ? opts.grav : 20;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(soft ? 8 : 20, soft ? speed * 0.45 : speed);
      this.particles.push({
        x: x + (soft ? rand(-18, 18) : 0),
        y: y + (soft ? rand(-10, 10) : 0),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - grav,
        life: rand(soft ? 0.8 : 0.25, soft ? 2.2 : 0.7),
        max: soft ? 2.2 : 0.7,
        size: soft ? rand(10, 28) : rand(2, 4.5),
        color,
        soft,
      });
    }
  }

  blood(x, y, n = 8) {
    this.burst(x, y, n, "#a02828", 110);
    this.burst(x, y, Math.max(4, (n / 2) | 0), "#5a1010", 70);
    this.burst(x, y, 3, "#d04040", 50);
  }

  floater(x, y, text, color = "#fff") {
    this.floaters.push({ x, y, text, color, t: 1.1 });
  }

  syncPointer(input) {
    input.worldX = input.screenX + this.cam.x;
    input.worldY = input.screenY + this.cam.y;
  }

  update(dt, input) {
    if (this.uiLock > 0) this.uiLock = Math.max(0, this.uiLock - dt);
    if (this.mark) {
      this.mark.t -= dt;
      if (this.mark.t <= 0) this.mark = null;
    }

    if (this.mode === MODE.MENU || this.mode === MODE.OVER) {
      this._updateFx(dt);
      input.consumePresses();
      return;
    }

    if (input.pausePressed && this.mode === MODE.PLAY && !this.showTutorial && this.uiLock <= 0) {
      if (this.showCraft) {
        this.showCraft = false;
        this.audio.ui();
        input.consumePresses();
        return;
      }
      this.setMode(MODE.PAUSE);
      this.audio.ui();
      input.consumePresses();
      return;
    }
    if (this.mode === MODE.PAUSE) {
      if (input.pausePressed && this.uiLock <= 0) {
        this.setMode(MODE.PLAY);
        this.audio.ui();
      }
      input.consumePresses();
      return;
    }

    if (this.showTutorial) {
      input.consumePresses();
      return;
    }

    if (input.craftPressed && this.uiLock <= 0) {
      this.showCraft = !this.showCraft;
      this.audio.ui();
    }

    if (this.showCraft) {
      this.shake = Math.max(0, this.shake - dt * 18);
      this.flash = Math.max(0, this.flash - dt);
      this._updateFx(dt);
      input.consumePresses();
      return;
    }

    if (input.hotbarKey >= 0) this.hot = input.hotbarKey;

    this.shake = Math.max(0, this.shake - dt * 18);
    // nevoa noturna
    if (this.nightLight > 0.25 && this.mode === MODE.PLAY) {
      if (!this.fog) this.fog = [];
      if (this.fog.length < 14 && Math.random() < dt * 3.5) {
        const cam = this.cam;
        this.fog.push({
          x: cam.x + rand(-40, this.viewW + 40),
          y: cam.y + rand(0, this.viewH),
          vx: rand(-12, 18),
          vy: rand(-4, 4),
          life: rand(2.5, 5),
          max: 5,
          size: rand(28, 64) * SCALE,
          a: rand(0.02, 0.055) * this.nightLight,
        });
      }
      for (const f of this.fog) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.life -= dt;
      }
      this.fog = this.fog.filter((f) => f.life > 0);
    } else if (this.fog && this.fog.length) {
      for (const f of this.fog) f.life -= dt * 2;
      this.fog = this.fog.filter((f) => f.life > 0);
    }

    this.flash = Math.max(0, this.flash - dt);
    if (this.bannerT > 0) this.bannerT -= dt;

    const nightGoal = this.phase === PHASE.NIGHT || this.phase === PHASE.DUSK ? 1 : 0;
    this.nightLight = lerpSafe(this.nightLight, nightGoal, dt * 1.6);

    if (this.phase === PHASE.DUSK) {
      this.transT -= dt;
      if (this.transT <= 0) this._beginNight();
    } else if (this.phase === PHASE.DAWN) {
      this.transT -= dt;
      this._burnZombies(dt);
      if (this.transT <= 0) this._beginDay();
    } else if (this.phase === PHASE.DAY) {
      this.phaseT -= dt;
      if (this.phaseT <= 0 || (input.skipPressed && this.uiLock <= 0)) this._beginDusk();
      this._growCrops(dt);
    } else if (this.phase === PHASE.NIGHT) {
      this.phaseT -= dt;
      this._spawnWaves(dt);
      if (this.phaseT <= 0) this._beginDawn();
    }

    this._updatePlayer(dt, input);
    this._updateZombies(dt);
    this._updateArrows(dt);
    this._updateTraps(dt);
    this._updateFx(dt);
    this._checkOver();

    input.consumePresses();
  }

  _updateFx(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0).slice(-180);
    for (const f of this.floaters) {
      f.t -= dt;
      f.y -= 22 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.t > 0).slice(-24);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
  }

  _updatePlayer(dt, input) {
    const p = this.player;
    const speed = 118 * SCALE;
    const mx = input.moveX;
    const my = input.moveY;
    moveWithCollide(this.world, p, mx * speed * dt, my * speed * dt, p.r, false);
    if (mx || my) {
      p.facing = Math.atan2(my, mx);
      p.walk += dt * 8;
    } else {
      p.walk *= 0.9;
    }

    if (input.hasPointer && !input.touchEnabled && !input._stick.active) {
      p.aim = Math.atan2(input.worldY - p.y, input.worldX - p.x);
    } else {
      p.aim = p.facing;
    }

    p.atkCd = Math.max(0, p.atkCd - dt);
    p.actCd = Math.max(0, p.actCd - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    p.swinging = Math.max(0, p.swinging - dt);

    if (input.eatPressed) this.eat();

    const wantAtk = input.attackPressed || input.attackHeld;
    const wantAct = input.actionPressed || input.actionHeld;

    const building = this.hot >= 1 && this.hot <= 3;
    if (this.hot === 0) {
      if (wantAtk) this._tryAttack(input);
      if (wantAct) this._tryInteract(dt, input.actionPressed);
    } else if (this.hot === 4) {
      if (input.actionPressed) this._tryRepair();
      if (wantAtk) this._tryAttack(input);
      if (wantAct && !input.actionPressed) this._tryInteract(dt, false);
    } else if (building) {
      if (wantAtk) this._tryAttack(input);
      // Perto de recurso/horta: Agir coleta. Longe: constrói.
      if (wantAct && this._resourceInReach()) {
        this._tryInteract(dt, input.actionPressed);
      } else if (input.actionPressed) {
        const placed = this._tryPlace();
        if (!placed) this._tryInteract(dt, true);
      } else if (input.actionHeld) {
        this._tryInteract(dt, false);
      }
    }

    if (input.worldClick) {
      this.mark = { x: input.worldX, y: input.worldY, t: 0.35 };
    }

    this._refreshGhost();
    this.cam.x = clamp(p.x - this.viewW / 2, 0, Math.max(0, this.world.w - this.viewW));
    this.cam.y = clamp(p.y - this.viewH / 2, 0, Math.max(0, this.world.h - this.viewH));
  }

  _refreshGhost() {
    if (this.hot < 1 || this.hot > 3) {
      this.buildGhost = null;
      return;
    }
    const p = this.player;
    const ang = p.aim ?? p.facing ?? 0;
    const tile = this._placeTile(ang);
    this.buildGhost = tile;
  }

  _placeTile(ang) {
    const p = this.player;
    const dirs = [
      [Math.cos(ang) * 1.2, Math.sin(ang) * 1.2],
      [Math.cos(ang) * 0.7, Math.sin(ang) * 0.7],
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [ox, oy] of dirs) {
      const tx = Math.floor(p.x / TILE + ox);
      const ty = Math.floor(p.y / TILE + oy);
      const x = (tx + 0.5) * TILE;
      const y = (ty + 0.5) * TILE;
      const t = this.world.at(tx, ty);
      if (t !== T.GRASS && t !== T.DIRT) continue;
      if (circleHitsSolid(this.world, x, y, 10 * SCALE, { forZombie: false })) continue;
      const occupied =
        this.world.fences.some((f) => f.tx === tx && f.ty === ty && f.hp > 0) ||
        this.world.torches.some((o) => o.tx === tx && o.ty === ty) ||
        this.world.traps.some((o) => o.tx === tx && o.ty === ty && o.uses > 0);
      if (occupied) continue;
      return { tx, ty, x, y, ok: true };
    }
    return {
      tx: Math.floor(p.x / TILE + Math.cos(ang) * 1.2),
      ty: Math.floor(p.y / TILE + Math.sin(ang) * 1.2),
      ok: false,
    };
  }

  _weapon() {
    return WEAPONS[this.equipped];
  }

  _tryAttack(input) {
    const p = this.player;
    if (p.atkCd > 0) return;
    const w = this._weapon();
    p.atkCd = w.cooldown;
    const ang = p.aim ?? p.facing;
    if (w.tipo === "ranged") {
      this.audio.shoot();
      this.arrows.push({
        x: p.x + Math.cos(ang) * 14 * SCALE,
        y: p.y + Math.sin(ang) * 14 * SCALE,
        vx: Math.cos(ang) * w.projSpeed,
        vy: Math.sin(ang) * w.projSpeed,
        life: 1.1,
        dmg: w.dano,
      });
      return;
    }
    this.audio.swing();
    p.swinging = 0.18;
    let hit = false;
    for (const z of this.zombies) {
      if (!z || z === p || z.hp <= 0) continue;
      if (!Number.isFinite(z.x) || !Number.isFinite(z.y)) continue;
      const d = dist(p.x, p.y, z.x, z.y);
      if (!Number.isFinite(d) || d > w.alcance + (z.r || 12 * SCALE) + 22 * SCALE) continue;
      const a = Math.atan2(z.y - p.y, z.x - p.x);
      const diff = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang)));
      if (d > 62 * SCALE && diff > 1.95) continue;
      this._hurtZombie(z, w.dano, Math.cos(ang) * w.knock, Math.sin(ang) * w.knock, "attack");
      hit = true;
    }
    if (hit) {
      this.audio.hit();
      this.shake = Math.max(this.shake, 4);
    }
  }


  _resourceInReach() {
    const p = this.player;
    const reach = 92 * SCALE;
    if (nearestNode(this.world.trees, p.x, p.y, (t) => !t.stump, reach)) return true;
    if (nearestNode(this.world.rocks, p.x, p.y, (r) => !r.gone, reach)) return true;
    if (nearestNode(this.world.veins, p.x, p.y, (v) => !v.gone, reach)) return true;
    if (this._nearPlot(reach)) return true;
    return false;
  }

  _tryInteract(dt, fromPress = true) {
    const p = this.player;
    if (p.actCd > 0) return;
    const reach = 92 * SCALE;
    const tree = nearestNode(this.world.trees, p.x, p.y, (t) => !t.stump, reach);
    if (tree) {
      p.actCd = 0.28;
      if (tree.maxHp == null) tree.maxHp = tree.hp;
      tree.hp -= 1;
      this.audio.chop();
      this.burst(tree.x, tree.y - 8 * SCALE, 8, "#5a4030", 80);
      this.shake = Math.max(this.shake, 1.5);
      const done = Math.max(0, (tree.maxHp || 8) - tree.hp);
      const need = tree.maxHp || 8;
      this.floater(tree.x, tree.y - 18, done + "/" + need, "#c4a574");
      if (tree.hp <= 0) {
        tree.stump = true;
        const n = irand(3, 5);
        this.inv.madeira += n;
        this.burst(tree.x, tree.y, 14, "#3a2818", 100);
        this.floater(tree.x, tree.y - 10, "+" + n + " madeira", "#c4a574");
        this.toast("Cortou uma árvore (+" + n + " madeira)");
      }
      return;
    }
    const rock = nearestNode(this.world.rocks, p.x, p.y, (r) => !r.gone, reach);
    if (rock) {
      p.actCd = 0.34;
      if (rock.maxHp == null) rock.maxHp = rock.hp;
      rock.hp -= 1;
      this.audio.mine();
      this.burst(rock.x, rock.y, 8, "#6a727c", 75);
      this.shake = Math.max(this.shake, 1.2);
      const rDone = Math.max(0, (rock.maxHp || 6) - rock.hp);
      const rNeed = rock.maxHp || 6;
      this.floater(rock.x, rock.y - 18, rDone + "/" + rNeed, "#9aa3ad");
      if (rock.hp <= 0) {
        rock.gone = true;
        const n = irand(2, 4);
        this.inv.pedra += n;
        this.floater(rock.x, rock.y - 8, `+${n} pedra`, "#9aa3ad");
        this.toast("Quebrou uma pedra (+" + n + " pedra)");
      }
      return;
    }
    const vein = nearestNode(this.world.veins, p.x, p.y, (v) => !v.gone, reach);
    if (vein) {
      p.actCd = 0.4;
      if (vein.maxHp == null) vein.maxHp = vein.hp;
      vein.hp -= 1;
      this.audio.mine();
      this.burst(vein.x, vein.y, 9, "#8a9aaa", 85);
      this.shake = Math.max(this.shake, 1.4);
      const vDone = Math.max(0, (vein.maxHp || 10) - vein.hp);
      const vNeed = vein.maxHp || 10;
      this.floater(vein.x, vein.y - 18, vDone + "/" + vNeed, "#d7dee4");
      if (vein.hp <= 0) {
        vein.gone = true;
        const n = irand(1, 2);
        this.inv.ferro += n;
        this.floater(vein.x, vein.y - 8, `+${n} ferro`, "#d7dee4");
        this.toast("Minerou ferro (+" + n + " ferro)");
      }
      return;
    }

    const plot = this._nearPlot(reach);
    if (plot) {
      p.actCd = 0.25;
      if (plot.state === "ready") {
        plot.state = "empty";
        plot.grow = 0;
        const food = irand(1, 2);
        this.inv.comida += food;
        const seedChance = Math.random() < 0.55 ? 1 : 0;
        this.inv.sementes += 1 + seedChance;
        this.audio.harvest();
        this.floater(plot.tx * TILE, plot.ty * TILE, `+${food} comida`, "#e07a5f");
        this.burst((plot.tx + 0.5) * TILE, (plot.ty + 0.5) * TILE, 8, "#8bc34a", 50);
      } else if (plot.state === "empty") {
        if (this.inv.sementes <= 0) {
          this.toast("Sem sementes.");
          return;
        }
        this.inv.sementes -= 1;
        plot.state = "growing";
        plot.grow = 0;
        this.audio.place();
        this.toast("Plantou na horta.");
      } else {
        this.toast("Ainda está crescendo…");
      }
      return;
    }
    if (fromPress) this.toast("Nada ao alcance. Chegue mais perto e use Agir (E).");
    return false;
  }

  _nearPlot(reach) {
    const p = this.player;
    let best = null;
    let bd = reach;
    for (const plot of this.world.plots) {
      const x = (plot.tx + 0.5) * TILE;
      const y = (plot.ty + 0.5) * TILE;
      const d = dist(p.x, p.y, x, y);
      if (d < bd) {
        bd = d;
        best = plot;
      }
    }
    return best;
  }

  _tryPlace() {
    const p = this.player;
    const kinds = { 1: "tocha", 2: "cerca", 3: "armadilha" };
    const kind = kinds[this.hot];
    if (!kind) return;
    const key = { tocha: "tochas", cerca: "cercas", armadilha: "armadilhas" }[kind];
    if (this.inv[key] <= 0) {
      this.toast("Você não tem " + key + ". Crie no menu.");
      return;
    }
    const ang = p.aim ?? p.facing ?? 0;
    const tile = this._placeTile(ang);
    if (!tile || !tile.ok) {
      this.toast("Não dá para construir aqui.");
      return false;
    }
    this.inv[key] -= 1;
    const { x, y, tx, ty } = tile;
    if (kind === "cerca") this.world.fences.push({ x, y, tx, ty, hp: 55, max: 55 });
    if (kind === "tocha") this.world.torches.push({ x, y, tx, ty });
    if (kind === "armadilha") this.world.traps.push({ x, y, tx, ty, uses: 3, cd: 0 });
    this.audio.place();
    this.burst(x, y, 8, "#c4a574", 50);
    this.mark = { x, y, t: 0.45 };
    this.toast(`Colocou ${kind}.`);
    p.actCd = 0.2;
    return true;
  }

  _tryRepair() {
    if (this.inv.kits <= 0) {
      this.toast("Sem kit de reparo.");
      return;
    }
    const c = this.world.cabin;
    if (dist(this.player.x, this.player.y, c.x, c.y) > 90 * SCALE) {
      this.toast("Chegue mais perto da cabana.");
      return;
    }
    if (c.hp >= c.maxHp) {
      this.toast("A cabana já está inteira.");
      return;
    }
    this.inv.kits -= 1;
    c.hp = Math.min(c.maxHp, c.hp + 45);
    this.audio.craft();
    this.floater(c.x, c.y - 20, "+45 cabana", "#f2cc8f");
    this.toast("Cabana reparada.");
  }

  eat() {
    if (this.inv.comida <= 0) {
      this.toast("Sem comida.");
      return;
    }
    if (this.player.hp >= this.player.maxHp) {
      this.toast("Vida cheia.");
      return;
    }
    this.inv.comida -= 1;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 36);
    this.audio.eat();
    this.floater(this.player.x, this.player.y - 16, "+36 vida", "#e07a5f");
  }

  craft(id) {
    const rec = RECIPES.find((r) => r.id === id);
    if (!rec) return false;
    if (rec.tipo === "arma" && this.weapons[id]) {
      this.toast("Você já tem essa arma.");
      this.equipped = id;
      this.hot = 0;
      return false;
    }
    if (!canPay(this.inv, rec.custo)) {
      this.toast("Faltam materiais.");
      return false;
    }
    pay(this.inv, rec.custo);
    if (rec.tipo === "arma") {
      this.weapons[id] = true;
      this.equipped = id;
      this.hot = 0;
      this.toast(`Criou ${rec.nome}!`);
    } else {
      for (const [k, v] of Object.entries(rec.ganha)) this.inv[k] = (this.inv[k] || 0) + v;
      this.toast(`Criou ${rec.nome}.`);
    }
    this.audio.craft();
    return true;
  }

  equip(id) {
    if (this.weapons[id]) this.equipped = id;
  }

  cycleWeapon() {
    const order = ["estaca", "arco", "lanca"];
    const owned = order.filter((id) => this.weapons[id]);
    if (owned.length < 2) return;
    const i = owned.indexOf(this.equipped);
    this.equipped = owned[(i + 1) % owned.length];
    this.toast(`Arma: ${WEAPONS[this.equipped].nome}`);
  }

  _growCrops(dt) {
    for (const p of this.world.plots) {
      if (p.state === "growing") {
        p.grow += dt / 16;
        if (p.grow >= 1) {
          p.state = "ready";
          p.grow = 1;
        }
      }
    }
  }

  _beginDusk() {
    this.phase = PHASE.DUSK;
    this.transT = 2.1;
    this.showCraft = false;
    this._banner("Anoiteceu… eles estão vindo.");
    this.audio.dusk();
    this.audio.setNight(true);
  }

  _beginNight() {
    this.phase = PHASE.NIGHT;
    const n = this.nightsSurvived + 1;
    this.phaseMax = n === 1 ? 44 : NIGHT_BASE + n * 7;
    this.phaseT = this.phaseMax;
    this.wave = 0;
    if (n === 1) {
      this.spawnT = 4.2;
      this._banner("Toque em Atacar quando o zumbi chegar perto");
      this.toast("Fique na porta. Atacar acerta de perto. Coma se a vida baixar.");
    } else {
      this.spawnT = 0;
      this._spawnWaves(0.05);
      this._banner(`Noite ${n} — defenda a cabana!`);
    }
  }

  _beginDawn() {
    this.phase = PHASE.DAWN;
    this.transT = 2.4;
    this.nightsSurvived += 1;
    if (this.nightsSurvived > this.best) {
      this.best = this.nightsSurvived;
      localStorage.setItem(STORAGE_KEY, String(this.best));
    }
    this._banner(`O sol nasceu. Noites sobrevivídas: ${this.nightsSurvived}`);
    this.audio.dawn();
    this.audio.setNight(false);
  }

  _beginDay() {
    this.phase = PHASE.DAY;
    this.phaseMax = DAY_LEN;
    this.phaseT = DAY_LEN;
    this.zombies = [];
    this.nightLight = 0;
    respawnMorning(this.world);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
    this.toast("Dia " + this.dayNumber() + ". Recursos voltaram a crescer.");
  }

  _burnZombies(dt) {
    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      z.hp -= 40 * dt;
      if (Math.random() < 0.08) this.burst(z.x, z.y, 2, "#f4d35e", 30);
      // Sol: conta o nocaute só no cruzamento letal (sem floater de dano a cada frame).
      if (z.hp <= 0) this.kills += 1;
    }
    this.zombies = this.zombies.filter((z) => z.hp > 0);
  }

  _spawnWaves(dt) {
    this.spawnT -= dt;
    const night = this.nightsSurvived + 1;
    if (this.spawnT > 0) return;
    this.wave += 1;
    let count;
    let gap;
    if (night === 1) {
      count = this.wave === 1 ? 2 : 3;
      gap = 14;
    } else if (night === 2) {
      count = 3 + Math.min(2, this.wave);
      gap = 13;
    } else {
      count = 3 + night + Math.min(4, this.wave);
      gap = 11.5;
    }
    for (let i = 0; i < count; i++) this._spawnZombie(night);
    this.spawnT = gap;
    if (this.wave === 1) this.toast("Uma onda se aproxima…");
  }

  _spawnZombie(night) {
    const pos = randomEdgeSpawn(this.world);
    let kind = "andarilho";
    const r = Math.random();
    if (night >= 2 && r < 0.28) kind = "corredor";
    if (night >= 3 && r < 0.16) kind = "bruto";
    if (night >= 5 && r < 0.22) kind = "bruto";
    const hpMul = 1 + (night - 1) * 0.12;
    this.zombies.push({
      kind,
      x: pos.x,
      y: pos.y,
      hp: 1,
      hurt: 0,
      atk: 0,
      stun: 0,
      facing: 0,
      walk: 0,
      hpMul,
      r: (kind === "bruto" ? 15 : kind === "corredor" ? 10 : 12) * SCALE,
    });
    const z = this.zombies[this.zombies.length - 1];
    z.hp = (kind === "bruto" ? 90 : kind === "corredor" ? 20 : 28) * hpMul;
    z.max = z.hp;
    if (this.zombies.length === 1 || Math.random() < 0.12) this.audio.groan();
  }

  _updateZombies(dt) {
    const p = this.player;
    const cabin = this.world.cabin;
    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      z.hurt = Math.max(0, z.hurt - dt);
      z.atk = Math.max(0, z.atk - dt);
      z.stun = Math.max(0, z.stun - dt);
      z.walk += dt * 6;
      if (z.stun > 0) continue;

      const toP = dist(z.x, z.y, p.x, p.y);
      const toC = dist(z.x, z.y, cabin.doorX, cabin.doorY);
      const preferCabin = z.kind === "bruto" || toC + 40 < toP;
      const tx = preferCabin && toP > 70 ? cabin.doorX : toP < 88 ? p.x : cabin.doorX;
      const ty = preferCabin && toP > 70 ? cabin.doorY : toP < 88 ? p.y : cabin.doorY;
      const ang = Math.atan2(ty - z.y, tx - z.x);
      z.facing = ang;
      const night = this.nightsSurvived + 1;
      const nMul = night === 1 ? 0.85 : night === 2 ? 0.92 : 1;
      const spd = (z.kind === "corredor" ? 111 : z.kind === "bruto" ? 36 : 48) * nMul * (z.slow ? 0.55 : 1);
      z.slow = Math.max(0, (z.slow || 0) - dt);
      let dx = Math.cos(ang) * spd * dt;
      let dy = Math.sin(ang) * spd * dt;
      const beforeX = z.x;
      const beforeY = z.y;
      const rad = (z.kind === "bruto" ? 15 : 11) * SCALE;
      moveWithCollide(this.world, z, dx, dy, rad, true);
      if (Math.hypot(z.x - beforeX, z.y - beforeY) < spd * dt * 0.2) {
        const side = ang + (Math.random() < 0.5 ? 1.2 : -1.2);
        moveWithCollide(this.world, z, Math.cos(side) * spd * dt, Math.sin(side) * spd * dt, rad, true);
      }

      if (toP < rad + p.r + 6 && z.atk <= 0) {
        z.atk = 0.85;
        const dmgMul = night === 1 ? 0.62 : 1;
        const dmg = (z.kind === "bruto" ? 18 : z.kind === "corredor" ? 7 : 8) * dmgMul;
        this._hurtPlayer(dmg, "zombie", z.kind || "zumbi");
      }
      if (toC < 38 * SCALE && z.atk <= 0) {
        z.atk = 1.05;
        const dmgMul = night === 1 ? 0.55 : 1;
        const dmg = (z.kind === "bruto" ? 12 : z.kind === "corredor" ? 4 : 5) * dmgMul;
        this._hurtCabin(dmg);
      }

      for (const f of this.world.fences) {
        if (f.hp <= 0) continue;
        if (dist(z.x, z.y, f.x, f.y) < rad + 16 * SCALE && z.atk <= 0) {
          z.atk = 0.7;
          f.hp -= z.kind === "bruto" ? 14 : 8;
          this.burst(f.x, f.y, 4, "#8d6e43", 40);
          if (f.hp <= 0) this.toast("Uma cerca foi destruída!");
        }
      }
    }
    const alive = [];
    for (const z of this.zombies) {
      if (z.hp > 0) alive.push(z);
    }
    this.zombies = alive;
  }

  _updateArrows(dt) {
    for (const a of this.arrows) {
      a.life -= dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (circleHitsSolid(this.world, a.x, a.y, 3, { forZombie: true })) {
        a.life = 0;
        continue;
      }
      for (const z of this.zombies) {
        if (z.hp <= 0) continue;
        const r = (z.kind === "bruto" ? 15 : z.kind === "corredor" ? 10 : 12) * SCALE;
        if (dist(a.x, a.y, z.x, z.y) < r + 14 * SCALE) {
          this._hurtZombie(z, a.dmg, a.vx * 0.15, a.vy * 0.15);
          a.life = 0;
          this.audio.hit();
          break;
        }
      }
    }
    this.arrows = this.arrows.filter((a) => a.life > 0);
  }

  _updateTraps(dt) {
    for (const t of this.world.traps) {
      t.cd = Math.max(0, t.cd - dt);
      if (t.uses <= 0 || t.cd > 0) continue;
      for (const z of this.zombies) {
        if (z.hp <= 0) continue;
        if (dist(z.x, z.y, t.x, t.y) < 18 * SCALE) {
          t.cd = 0.8;
          t.uses -= 1;
          this._hurtZombie(z, 24, 0, 0);
          z.slow = 1.6;
          z.stun = 0.15;
          this.audio.trap();
          this.burst(t.x, t.y, 10, "#c4a574", 90);
          break;
        }
      }
    }
    this.world.traps = this.world.traps.filter((t) => t.uses > 0);
    this.world.fences = this.world.fences.filter((f) => f.hp > 0);
  }

  _hurtZombie(z, dmg, kx, ky, src = "world") {
    if (!z || z === this.player) return;
    if (!Number.isFinite(dmg) || dmg <= 0) return;
    if (z.hp <= 0) return;
    z.hp -= dmg;
    z.hurt = 0.35;
    if (Number.isFinite(kx)) z.x += kx * 0.012;
    if (Number.isFinite(ky)) z.y += ky * 0.012;
    this.blood(z.x, z.y, src === "attack" ? 10 : 6);
    this.floater(z.x, z.y - 14, "-" + Math.round(dmg), "#d4a090");
    if (z.hp <= 0) {
      this.kills += 1;
      this.blood(z.x, z.y, 16);
      this.shake = Math.max(this.shake, 5);
      this.floater(z.x, z.y - 22, "nocaute", "#c4a060");
      if (Math.random() < 0.12) {
        this.inv.comida += 1;
        this.floater(z.x, z.y, "+1 comida", "#c07050");
      }
    }
  }

  _hurtPlayer(dmg, src = "zombie", kind = "") {
    if (src === "attack" || src === "self" || src === "player") return;
    if (!Number.isFinite(dmg) || dmg <= 0) return;
    if (this.player.hurt > 0.05) return;
    dmg = Math.min(dmg, 22);
    this.player.hp -= dmg;
    this.player.hurt = 0.35;
    this.shake = 7;
    this.flash = 0.15;
    this.deathBy = kind || src;
    this.audio.hurt();
    this.blood(this.player.x, this.player.y, 12);
    this.floater(this.player.x, this.player.y - 18, `-${Math.round(dmg)}`, "#e85d4c");
  }

  _hurtCabin(dmg) {
    if (!Number.isFinite(dmg) || dmg <= 0) return;
    this.world.cabin.hp -= dmg;
    this.shake = 9;
    this.audio.cabin();
    const c = this.world.cabin;
    this.burst(c.doorX, c.doorY, 8, "#8d6e43", 70);
  }

  _checkOver() {
    if (this.mode === MODE.OVER) return;
    const dead = this.player.hp <= 0;
    const cabinDown = this.world.cabin.hp <= 0;
    if (!dead && !cabinDown) return;
    this.player.hp = Math.max(0, this.player.hp);
    this.world.cabin.hp = Math.max(0, this.world.cabin.hp);
    const nightReached = this.phase === PHASE.DAY || this.phase === PHASE.DAWN
      ? Math.max(1, this.nightsSurvived)
      : this.nightsSurvived + 1;
    let reason = cabinDown && !dead ? "A cabana foi destruída." : "Você foi derrubado.";
    let detail = `Chegou na noite ${nightReached}.`;
    if (dead && this.deathBy) detail += ` Golpe de ${this.deathBy}.`;
    this.overSnap = {
      nights: this.nightsSurvived,
      kills: this.kills,
      nightReached,
      reason,
      detail,
      wave: this.wave,
    };
    this.setMode(MODE.OVER);
    this.showCraft = false;
    try { this.audio.gameover(); } catch (_) { /* ok */ }
    if (this.nightsSurvived > this.best) {
      this.best = this.nightsSurvived;
      localStorage.setItem(STORAGE_KEY, String(this.best));
    }
  }

  dismissTutorial() {
    if (this.uiLock > 0) return;
    this.showTutorial = false;
    this.seenTutorial = true;
    localStorage.setItem("nnc-tutorial", "1");
  }

  skipToNight() {
    if (this.uiLock > 0) return;
    if (this.mode === MODE.PLAY && this.phase === PHASE.DAY && !this.showTutorial) this._beginDusk();
  }
}

function lerpSafe(a, b, t) {
  return a + (b - a) * Math.min(1, t);
}