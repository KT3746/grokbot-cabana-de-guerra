import { VERSION } from "./version.js?v=202610070439";
import { RECIPES, HOTBAR, WEAPONS, canPay } from "./data.js?v=202610070439";
import { MODE, PHASE } from "./game.js?v=202610070439";

function fmtDaily(d) {
  const nights = d && d.nights != null ? d.nights : 0;
  const best = d && d.best != null ? d.best : 0;
  return `Hoje: ${nights} noites · Melhor do dia: ${best}`;
}

export function bindUI(game, audio) {
  const $ = (id) => document.getElementById(id);

  $("ver").textContent = `v${VERSION}`;
  $("best-menu").textContent = String(game.best);
  const dm = $("daily-menu");
  if (dm) dm.textContent = fmtDaily(game.daily);

  const blur = () => {
    try {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    } catch (_) { /* ok */ }
  };

  const safe = (fn) => (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (game.uiLock > 0 && e && e.type === "click") {
      /* ainda deixa Jogar de novo / Menu / Entendi / Começar passarem se o lock já passou */
    }
    try { audio.unlock(); } catch (_) { /* ok */ }
    try { fn(e); } catch (err) { console.error(err); }
    try { audio.ui(); } catch (_) { /* ok */ }
    blur();
    syncScreens(game);
  };

  /* pointerup no rótulo visível - click sozinho no mobile chega
     com coordenada da viewport de layout, não da visual. */
  const bindTap = (id, fn) => {
    const el = $(id);
    if (!el) return;
    let last = 0;
    const run = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const now = performance.now();
      if (now - last < 350) return;
      last = now;
      safe(fn)(e);
    };
    el.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    }, { passive: false });
    el.addEventListener("pointerup", (e) => {
      if (e.button != null && e.button !== 0) return;
      run(e);
    });
    el.addEventListener("click", run);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") run(e);
    });
  };

  bindTap("btn-start", () => {
    game.start();
  });
  bindTap("btn-resume", () => {
    game.setMode(MODE.PLAY);
  });
  bindTap("btn-restart", () => {
    game.restart();
  });
  bindTap("btn-restart-over", () => {
    game.restart();
  });
  bindTap("btn-menu", () => {
    game.goMenu();
  });
  bindTap("btn-menu-over", () => {
    game.goMenu();
  });
  bindTap("btn-craft", () => {
    if (game.mode !== MODE.PLAY || game.showTutorial) return;
    game.showCraft = !game.showCraft;
  });
  bindTap("btn-craft-close", () => {
    game.showCraft = false;
  });
  bindTap("btn-pause", () => {
    if (game.mode === MODE.PLAY) game.setMode(MODE.PAUSE);
    else if (game.mode === MODE.PAUSE) game.setMode(MODE.PLAY);
  });
  bindTap("btn-noite", () => game.skipToNight());
  bindTap("btn-eat-hud", () => game.eat());
  bindTap("btn-mute", () => {
    audio.unlock();
    const m = audio.toggleMute();
    $("btn-mute").textContent = m ? "Som off" : "Som on";
    $("btn-mute").classList.toggle("muted-icon", m);
  });
  $("btn-mute").textContent = audio.muted ? "Som off" : "Som on";
  bindTap("btn-ok-tut", () => {
    game.uiLock = 0;
    game.dismissTutorial();
  });
  const tut = $("screen-tut");
  if (tut) {
    bindTap("screen-tut", () => {
      game.uiLock = 0;
      game.dismissTutorial();
    });
  }

  const unlock = () => { try { audio.unlock(); } catch (_) {} };
  window.addEventListener("pointerdown", unlock, { once: false });
  window.addEventListener("keydown", unlock, { once: false });

  const craft = $("craft");
  const stop = (e) => e.stopPropagation();
  craft.addEventListener("pointerdown", stop);
  craft.addEventListener("pointerup", stop);
  craft.addEventListener("click", stop);
  craft.addEventListener("touchstart", stop, { passive: true });

  const recipes = $("recipes");
  recipes.innerHTML = "";
  for (const rec of RECIPES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "recipe";
    b.dataset.id = rec.id;
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (game.uiLock > 0 || game.mode !== MODE.PLAY) return;
      try { audio.unlock(); } catch (_) {}
      if (rec.tipo === "arma" && game.weapons[rec.id]) game.equip(rec.id);
      else game.craft(rec.id);
      try { audio.ui(); } catch (_) {}
    });
    recipes.appendChild(b);
  }

  const hot = $("hotbar");
  hot.innerHTML = "";
  HOTBAR.forEach((slot, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot";
    b.dataset.i = String(i);
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (game.uiLock > 0) return;
      game.hot = i;
      if (i === 0) game.cycleWeapon();
      try { audio.ui(); } catch (_) {}
    });
    hot.appendChild(b);
  });

  return () => sync(game, audio);
}

function setInert(el, on) {
  if (!el) return;
  const has = el.hasAttribute("inert");
  if (on && !has) el.setAttribute("inert", "");
  if (!on && has) el.removeAttribute("inert");
}

function syncScreens(game) {
  const hide = (id, on) => {
    const el = document.getElementById(id);
    el.classList.toggle("hidden", !on);
    setInert(el, !on);
  };
  hide("screen-start", game.mode === MODE.MENU);
  hide("screen-pause", game.mode === MODE.PAUSE);
  hide("screen-tut", game.mode === MODE.PLAY && game.showTutorial);
  hide("screen-over", game.mode === MODE.OVER);
  hide("hud", game.mode === MODE.PLAY || game.mode === MODE.PAUSE);
  hide(
    "first-tip",
    game.mode === MODE.PLAY && game.showFirstTip && !game.showTutorial && !game.showCraft
  );
  const goalsOn =
    game.mode === MODE.PLAY &&
    !game.showTutorial &&
    !game.showFirstTip &&
    !game.showCraft &&
    game.phase === PHASE.DAY &&
    !game.goalsDone() &&
    game.runAge < 120;
  hide("day-goals", goalsOn);
  hide("craft", game.showCraft && game.mode === MODE.PLAY && !game.showTutorial);
  const coarse = matchMedia("(pointer: coarse)").matches || matchMedia("(max-width: 900px)").matches;
  const touchOn = game.mode === MODE.PLAY && !game.showTutorial && !game.showCraft && (coarse || window.innerWidth <= 900);
  hide("touch", touchOn);
  document.getElementById("app").classList.toggle("craft-open", !!(game.showCraft && game.mode === MODE.PLAY));
}

function sync(game, audio) {
  syncScreens(game);
  syncThreats(game);
  syncDawn(game);
  syncStreak(game);
  syncWaveSplash(game);
  syncResFlash(game);
  const $ = (id) => document.getElementById(id);
  $("ver").textContent = `v${VERSION}`;
  $("best-menu").textContent = String(game.best);
  const dailyMenu = $("daily-menu");
  if (dailyMenu) dailyMenu.textContent = fmtDaily(game.daily);
  $("btn-mute").textContent = audio.muted ? "Som off" : "Som on";

  if (game.mode === MODE.OVER) {
    const snap = game.overSnap || {};
    $("over-reason").textContent = snap.reason || (game.player.hp <= 0 ? "Você foi derrubado." : "A cabana foi destruída.");
    $("over-nights").textContent = String(snap.nights ?? game.nightsSurvived);
    $("over-best").textContent = String(game.best);
    $("over-kills").textContent = String(snap.kills ?? game.kills);
    const dailyOver = $("daily-over");
    if (dailyOver) dailyOver.textContent = fmtDaily(game.daily);
    const extra = $("over-extra");
    if (extra) extra.textContent = snap.detail || "";
  }

  if (game.mode !== MODE.PLAY && game.mode !== MODE.PAUSE) return;

  const nightNum = game.phase === PHASE.DAY
    ? game.nightsSurvived + 1
    : game.phase === PHASE.DAWN
      ? Math.max(1, game.nightsSurvived)
      : game.nightsSurvived + 1;
  const phaseName = {
    [PHASE.DAY]: "Dia",
    [PHASE.DUSK]: "Entardecer",
    [PHASE.NIGHT]: "Noite",
    [PHASE.DAWN]: "Amanhecer",
  }[game.phase];
  const t = Math.max(0, Math.ceil(game.phaseT));
  let phaseTxt = `${phaseName} ${nightNum || 1} · ${fmt(t)}`;
  if (game.phase === PHASE.NIGHT && game.wave > 0) phaseTxt += ` · onda ${game.wave}`;
  if (game.phase === PHASE.NIGHT || game.phase === PHASE.DUSK) {
    const zc = game.aliveZombies ? game.aliveZombies() : 0;
    phaseTxt += ` · ${zc} zumbi${zc === 1 ? "" : "s"}`;
  }
  const chip = $("phase-chip");
  if (chip.textContent !== phaseTxt) chip.textContent = phaseTxt;
  const warn = game.phase === PHASE.DAY && game.phaseT <= 10;
  const cls = "chip phase-clock " + (game.nightLight > 0.45 ? "phase-night" : "phase-day") + (warn ? " phase-warn" : "");
  if (chip.className !== cls) chip.className = cls;
  const left = game.phaseLeft ? game.phaseLeft() : 1;
  chip.style.setProperty("--pp", `${(left * 100).toFixed(1)}%`);


  setBar("hp-bar", game.player.hp / game.player.maxHp);
  setBar("cabin-bar", game.world.cabin.hp / game.world.cabin.maxHp);
  $("hp-txt").textContent = `${Math.ceil(game.player.hp)}`;
  $("cabin-txt").textContent = `${Math.ceil(game.world.cabin.hp)}`;

  const hpChip = $("hp-txt") && $("hp-txt").closest(".chip");
  const cabinChip = $("cabin-txt") && $("cabin-txt").closest(".chip");
  if (hpChip) hpChip.classList.toggle("danger-pulse", !!game.dangerHp);
  if (cabinChip) cabinChip.classList.toggle("danger-pulse", !!game.dangerCabin);
  const app = document.getElementById("app");
  if (app) {
    app.classList.toggle("danger-hp", !!game.dangerHp);
    app.classList.toggle("danger-cabin", !!game.dangerCabin);
  }
  const edge = $("danger-edge");
  if (edge) edge.classList.toggle("hidden", !(game.dangerHp || game.dangerCabin));

  const btnAct = $("btn-act");
  if (btnAct) {
    const label = game.actHint || "Agir";
    if (btnAct.textContent !== label) btnAct.textContent = label;
    btnAct.classList.toggle("hint-ready", label !== "Agir" && label !== "Espera");
  }
  const btnAtk = $("btn-atk");
  if (btnAtk) btnAtk.classList.toggle("atk-ready", !!game.atkReady);

  const btnEat = $("btn-eat");
  const btnEatHud = $("btn-eat-hud");
  const hungry = !!game.dangerHp && (game.inv.comida || 0) > 0;
  if (btnEat) btnEat.classList.toggle("eat-ready", hungry);
  if (btnEatHud) btnEatHud.classList.toggle("eat-ready", hungry);

  const arrow = $("home-arrow");
  if (arrow) {
    const ha = game.homeArrow;
    const show = !!(ha && game.mode === MODE.PLAY && !game.showTutorial && !game.showCraft);
    arrow.classList.toggle("hidden", !show);
    if (show) {
      const deg = (ha.ang * 180) / Math.PI + 90; // ⌂ tip points "up" by default
      arrow.style.setProperty("--ha", `${deg.toFixed(1)}deg`);
    }
  }

  const goals = $("day-goals");
  if (goals) {
    for (const el of goals.querySelectorAll(".goal")) {
      const key = el.dataset.g;
      el.classList.toggle("done", !!(game.goals && game.goals[key]));
    }
  }

  $("res-madeira").textContent = game.inv.madeira;
  $("res-pedra").textContent = game.inv.pedra;
  $("res-comida").textContent = game.inv.comida;
  $("res-ferro").textContent = game.inv.ferro;
  $("res-sementes").textContent = game.inv.sementes;

  $("btn-noite").classList.toggle("hidden", game.phase !== PHASE.DAY || game.showCraft);

  const banner = $("banner");
  const dawnOn = !!(game.dawnCard && !game.showCraft);
  banner.classList.toggle("hidden", game.bannerT <= 0 || dawnOn);
  banner.textContent = game.banner;

  const toasts = $("toasts");
  toasts.innerHTML = game.toasts.map((t) => `<div class="toast">${esc(t.msg)}</div>`).join("");

  const slots = document.querySelectorAll("#hotbar .slot");
  slots.forEach((el, i) => {
    el.classList.toggle("on", game.hot === i);
    if (i === 0) {
      const w = WEAPONS[game.equipped];
      const html = `<span>${w.nome.split(" ")[0]}</span><small>arma</small>`;
      if (el.innerHTML !== html) el.innerHTML = html;
    } else {
      const meta = HOTBAR[i];
      const n = game.inv[meta.inv] || 0;
      const html = `<span>${meta.nome}</span><small>${n}</small>`;
      if (el.innerHTML !== html) el.innerHTML = html;
    }
  });

  let canMake = 0;
  for (const rec of RECIPES) {
    const owned0 = rec.tipo === "arma" && game.weapons[rec.id];
    if (!owned0 && canPay(game.inv, rec.custo)) canMake += 1;
  }
  syncCraftBadge(game, canMake);

  for (const rec of RECIPES) {
    const el = document.querySelector(`#recipes .recipe[data-id="${rec.id}"]`);
    if (!el) continue;
    const custo = Object.entries(rec.custo)
      .map(([k, v]) => `${v} ${k}`)
      .join(" · ");
    const owned = rec.tipo === "arma" && game.weapons[rec.id];
    const miss = owned ? [] : Object.entries(rec.custo)
      .filter(([k, v]) => (game.inv[k] || 0) < v)
      .map(([k, v]) => `${v - (game.inv[k] || 0)} ${k}`);
    const have = rec.ganha ? Object.keys(rec.ganha).map((k) => game.inv[k] || 0)[0] : null;
    const state = owned
      ? `<span class="rstate own">${game.equipped === rec.id ? "Equipada" : "Toque p/ equipar"}</span>`
      : miss.length
        ? `<span class="rstate miss">Falta: ${miss.join(", ")}</span>`
        : `<span class="rstate ok">Pode criar${have != null ? ` · tem ${have}` : ""}</span>`;
    const html = `<strong>${rec.nome}${owned ? " ✓" : ""}</strong><span class="sub">${rec.desc} - ${custo}</span>${state}`;
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
    el.disabled = owned ? false : !canPay(game.inv, rec.custo);
  }
}

let lastCanMake = -1;
let craftNewT = 0;
function syncCraftBadge(game, n) {
  const badge = document.getElementById("craft-badge");
  const btn = document.getElementById("btn-craft");
  if (!badge || !btn) return;
  const day = game.phase === PHASE.DAY;
  if (lastCanMake >= 0 && n > lastCanMake && day && !game.showCraft) craftNewT = performance.now() + 2600;
  lastCanMake = n;
  const show = n > 0 && !game.showCraft;
  badge.classList.toggle("hidden", !show);
  const txt = String(n);
  if (badge.textContent !== txt) badge.textContent = txt;
  btn.classList.toggle("craft-new", show && performance.now() < craftNewT);
}

const threatPool = [];
function syncThreats(game) {
  const box = document.getElementById("threats");
  if (!box) return;
  const list = game.threats || [];
  while (threatPool.length < list.length) {
    const el = document.createElement("div");
    el.className = "threat";
    el.innerHTML = '<i class="tri"></i><b></b>';
    box.appendChild(el);
    threatPool.push(el);
  }
  threatPool.forEach((el, i) => {
    const t = list[i];
    if (!t) {
      if (el.style.display !== "none") el.style.display = "none";
      return;
    }
    el.style.display = "";
    el.style.transform = `translate(${t.x.toFixed(0)}px, ${t.y.toFixed(0)}px)`;
    el.style.setProperty("--ta", `${((t.ang * 180) / Math.PI).toFixed(1)}deg`);
    el.style.setProperty("--tn", t.near.toFixed(2));
    el.classList.toggle("bruto", !!t.bruto);
    const b = el.lastChild;
    const txt = t.n > 1 ? String(t.n) : "";
    if (b.textContent !== txt) b.textContent = txt;
  });
}

function syncDawn(game) {
  const card = document.getElementById("dawn-card");
  if (!card) return;
  const d = game.dawnCard;
  const show = !!(d && game.mode === MODE.PLAY && !game.showCraft && !game.showTutorial);
  card.classList.toggle("hidden", !show);
  if (!show) return;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== v) el.textContent = v;
  };
  set("dawn-night", `Noite ${d.night}`);
  set("dawn-kills", String(d.kills));
  set("dawn-sun", String(d.sun));
  set("dawn-cabin", d.cabin > 0 ? `−${d.cabin}` : "0");
  set("dawn-hp", d.hp > 0 ? `−${d.hp}` : "0");
  const tip = d.cabinPct < 50 ? "faça um kit de reparo" : d.hp > 60 ? "plante comida" : "+15 vida ao amanhecer";
  set("dawn-foot", `Cabana em ${d.cabinPct}% · ${tip}`);
  const rec = document.getElementById("dawn-rec");
  if (rec) rec.classList.toggle("hidden", !d.record);
  card.classList.toggle("fading", d.t < 0.6);
}

function syncStreak(game) {
  const el = document.getElementById("streak-badge");
  if (!el) return;
  const s = game.streak;
  const show = !!(s && s.n >= 2 && game.mode === MODE.PLAY && !game.showCraft && !game.showTutorial);
  el.classList.toggle("hidden", !show);
  if (!show) return;
  const n = document.getElementById("streak-n");
  const txt = `x${s.n}`;
  if (n && n.textContent !== txt) n.textContent = txt;
  el.classList.toggle("hot", s.n >= 5);
  el.style.setProperty("--st", `${Math.max(0, Math.min(1, s.t / 2.8)).toFixed(2)}`);
}

function syncWaveSplash(game) {
  const el = document.getElementById("wave-splash");
  if (!el) return;
  const w = game.waveSplash;
  const show = !!(w && game.mode === MODE.PLAY && !game.showCraft && !game.showTutorial);
  el.classList.toggle("hidden", !show);
  if (!show) return;
  const txt = document.getElementById("wave-splash-txt");
  const label = `Onda ${w.n}`;
  if (txt && txt.textContent !== label) txt.textContent = label;
  el.classList.toggle("fading", w.t < 0.45);
}

const _resPrev = { madeira: -1, pedra: -1, comida: -1, ferro: -1, sementes: -1 };
const _resFlashT = {};
function syncResFlash(game) {
  if (game.mode !== MODE.PLAY && game.mode !== MODE.PAUSE) return;
  const map = {
    madeira: "res-madeira",
    pedra: "res-pedra",
    comida: "res-comida",
    ferro: "res-ferro",
    sementes: "res-sementes",
  };
  const now = performance.now();
  for (const [k, id] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const chip = el.closest(".res");
    if (!chip) continue;
    const cur = game.inv[k] || 0;
    const prev = _resPrev[k];
    if (prev >= 0 && cur !== prev) {
      const delta = cur - prev;
      chip.classList.remove("res-up", "res-down");
      void chip.offsetWidth;
      chip.classList.add(delta > 0 ? "res-up" : "res-down");
      _resFlashT[k] = now + 900;
      let tag = chip.querySelector(".res-delta");
      if (!tag) {
        tag = document.createElement("em");
        tag.className = "res-delta";
        chip.appendChild(tag);
      }
      tag.textContent = delta > 0 ? `+${delta}` : String(delta);
    }
    _resPrev[k] = cur;
    if (_resFlashT[k] && now > _resFlashT[k]) {
      chip.classList.remove("res-up", "res-down");
      const tag = chip.querySelector(".res-delta");
      if (tag) tag.remove();
      delete _resFlashT[k];
    }
  }
}

function setBar(id, ratio) {
  const el = document.getElementById(id);
  el.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}