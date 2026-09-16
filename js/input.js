/**
 * Teclado, mouse e toque (joystick + botões).
 * Space/Enter nunca disparam clique em botão focado (isso matava a run).
 */
export class Input {
  constructor() {
    this.moveX = 0;
    this.moveY = 0;
    this.aimX = 0;
    this.aimY = 0;
    this.screenX = 0;
    this.screenY = 0;
    this.worldX = 0;
    this.worldY = 0;
    this.hasPointer = false;
    this.pointerDown = false;
    this.attackHeld = false;
    this.attackPressed = false;
    this.actionHeld = false;
    this.actionPressed = false;
    this.eatPressed = false;
    this.craftPressed = false;
    this.pausePressed = false;
    this.skipPressed = false;
    this.hotbarKey = -1;
    this.worldClick = false;

    this._keys = new Set();
    this._just = new Set();
    this._stick = { active: false, x: 0, y: 0, id: null };
    this._atkBtn = false;
    this._actBtn = false;
    this.touchEnabled = false;
    this._docMove = null;
    this._docUp = null;

    window.addEventListener("keydown", (e) => this._down(e), true);
    window.addEventListener("keyup", (e) => this._up(e), true);

    const canvas = () => document.getElementById("game");
    const onPtr = (e) => {
      const c = canvas();
      if (!c) return;
      const r = c.getBoundingClientRect();
      this.screenX = e.clientX - r.left;
      this.screenY = e.clientY - r.top;
      this.hasPointer = true;
    };
    window.addEventListener("pointermove", onPtr);
    window.addEventListener("pointerdown", (e) => {
      onPtr(e);
      if (e.target && e.target.id === "game") {
        this.pointerDown = true;
        this.worldClick = true;
        // clique so mira / marca o chao; coleta = E ou botao Agir
      }
    });
    window.addEventListener("pointerup", () => {
      this.pointerDown = false;
    });
    window.addEventListener("contextmenu", (e) => {
      if (e.target && (e.target.id === "game" || e.target.closest(".touch"))) e.preventDefault();
    });

    this._bindTouch();
  }

  _blockBrowserBtn(e) {
    if (e.code === "Space") {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    return false;
  }

  _down(e) {
    const blocked = this._blockBrowserBtn(e);
    if (e.repeat) return;
    this._keys.add(e.code);
    this._just.add(e.code);
    if (e.code === "Space") this.attackPressed = true;
    if (e.code === "KeyE") this.actionPressed = true;
    if (e.code === "KeyC") this.craftPressed = true;
    if (e.code === "KeyF" || e.code === "KeyQ") this.eatPressed = true;
    if (e.code === "Escape" || e.code === "KeyP") this.pausePressed = true;
    if (e.code === "KeyN") this.skipPressed = true;
    const nums = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];
    const i = nums.indexOf(e.code);
    if (i >= 0) this.hotbarKey = i;
    if (blocked && e.code === "Enter") {
      /* Enter em overlay visível segue o botão; no jogo não */
    }
  }

  _up(e) {
    this._blockBrowserBtn(e);
    this._keys.delete(e.code);
  }

  _bindTouch() {
    const stick = document.getElementById("stick");
    const knob = document.getElementById("stick-knob");
    if (!stick) return;

    const setKnob = (dx, dy) => {
      if (!knob) return;
      const r = stick.getBoundingClientRect();
      const x = r.width / 2 + dx;
      const y = r.height / 2 + dy;
      knob.style.left = `${x}px`;
      knob.style.top = `${y}px`;
      knob.style.transform = "translate(-50%, -50%)";
    };

    const setFrom = (clientX, clientY) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const max = Math.max(18, r.width * 0.42);
      const len = Math.hypot(dx, dy) || 1;
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      this._stick.active = true;
      this._stick.x = dx / max;
      this._stick.y = dy / max;
      stick.classList.add("is-active");
      setKnob(dx, dy);
    };

    const unbindDoc = () => {
      if (this._docMove) {
        window.removeEventListener("pointermove", this._docMove, true);
        window.removeEventListener("pointerup", this._docUp, true);
        window.removeEventListener("pointercancel", this._docUp, true);
        this._docMove = null;
        this._docUp = null;
      }
    };

    const endStick = (e) => {
      if (!this._stick.active) return;
      if (this._stick.id != null && e && e.pointerId != null && e.pointerId !== this._stick.id) return;
      this._stick.active = false;
      this._stick.x = 0;
      this._stick.y = 0;
      this._stick.id = null;
      stick.classList.remove("is-active");
      setKnob(0, 0);
      unbindDoc();
    };

    const onMove = (e) => {
      if (!this._stick.active) return;
      if (this._stick.id != null && e.pointerId !== this._stick.id) return;
      if (e.cancelable) e.preventDefault();
      setFrom(e.clientX, e.clientY);
    };

    stick.addEventListener("pointerdown", (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      this.touchEnabled = true;
      this._stick.id = e.pointerId;
      try {
        stick.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ok */
      }
      setFrom(e.clientX, e.clientY);
      unbindDoc();
      this._docMove = onMove;
      this._docUp = endStick;
      window.addEventListener("pointermove", onMove, { capture: true, passive: false });
      window.addEventListener("pointerup", endStick, { capture: true });
      window.addEventListener("pointercancel", endStick, { capture: true });
    }, { passive: false });

    stick.addEventListener("pointermove", onMove, { passive: false });
    stick.addEventListener("pointerup", endStick);
    stick.addEventListener("pointercancel", endStick);

    const onTouchMove = (e) => {
      if (!this._stick.active || !e.touches || !e.touches.length) return;
      if (e.cancelable) e.preventDefault();
      const t = [...e.touches].find((x) => x.identifier === this._stick.id) || e.touches[0];
      setFrom(t.clientX, t.clientY);
    };
    stick.addEventListener("touchstart", (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      const t = e.changedTouches[0];
      this.touchEnabled = true;
      this._stick.id = t.identifier;
      setFrom(t.clientX, t.clientY);
    }, { passive: false });
    stick.addEventListener("touchmove", onTouchMove, { passive: false });
    stick.addEventListener("touchend", (e) => endStick(e));
    stick.addEventListener("touchcancel", (e) => endStick(e));

    const hold = (id, propHeld, propPress) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        this.touchEnabled = true;
        this[propHeld] = true;
        if (propPress) this[propPress] = true;
        if (id === "btn-atk") this._atkBtn = true;
        if (id === "btn-act") this._actBtn = true;
      };
      const end = () => {
        this[propHeld] = false;
        if (id === "btn-atk") this._atkBtn = false;
        if (id === "btn-act") this._actBtn = false;
      };
      el.addEventListener("pointerdown", start, { passive: false });
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("pointerleave", end);
    };
    hold("btn-atk", "attackHeld", "attackPressed");
    hold("btn-act", "actionHeld", "actionPressed");

    const tap = (id, prop) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("pointerdown", (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        this.touchEnabled = true;
        this[prop] = true;
      }, { passive: false });
    };
    tap("btn-eat", "eatPressed");
    tap("btn-pause-touch", "pausePressed");
    tap("btn-noite-touch", "skipPressed");
  }

  update() {
    let kx = 0;
    let ky = 0;
    if (this._keys.has("KeyA") || this._keys.has("ArrowLeft")) kx -= 1;
    if (this._keys.has("KeyD") || this._keys.has("ArrowRight")) kx += 1;
    if (this._keys.has("KeyW") || this._keys.has("ArrowUp")) ky -= 1;
    if (this._keys.has("KeyS") || this._keys.has("ArrowDown")) ky += 1;
    const keyMoving = kx !== 0 || ky !== 0;
    const stickPow = Math.hypot(this._stick.x, this._stick.y);
    // Teclado tem prioridade: joystick preso/zerado nao engole WASD no desktop
    if (keyMoving) {
      const len = Math.hypot(kx, ky) || 1;
      this.moveX = kx / len;
      this.moveY = ky / len;
    } else if (this._stick.active && stickPow > 0.08) {
      this.moveX = this._stick.x;
      this.moveY = this._stick.y;
    } else {
      this.moveX = 0;
      this.moveY = 0;
      if (this._stick.active && stickPow <= 0.08 && this._stick.id == null) {
        this._stick.active = false;
      }
    }
    this.attackHeld = this._atkBtn || this._keys.has("Space");
    // clique no canvas mira/seleciona; Agir fica em E ou botao Agir (nao mouse hold)
    this.actionHeld = this._actBtn || this._keys.has("KeyE");
  }

  consumePresses() {
    this.attackPressed = false;
    this.actionPressed = false;
    this.eatPressed = false;
    this.craftPressed = false;
    this.pausePressed = false;
    this.skipPressed = false;
    this.hotbarKey = -1;
    this.worldClick = false;
    this._just.clear();
  }
}