/**
 * CABANA DE GUERRA — cena Three.js baixo-poli (mobile-first).
 * API espelha o Renderer 2D: init / resize / draw.
 * Se o WebGL falhar, o main.js cai no canvas 2D.
 */
import * as THREE from "three";
import { TILE, SCALE, hash2, WEAPONS } from "./data.js?v=202609241820";
import { T } from "./world.js?v=202609241820";
import { MODE } from "./game.js?v=202609241820";

const DAY_FOG = 0x87a090;
const DUSK_FOG = 0x4a2818;
const NIGHT_FOG = 0x050810;
const ZOMBIE_MAX = 48;
const ARROW_MAX = 24;
const PARTICLE_MAX = 64;
const FENCE_MAX = 48;
const TORCH_MAX = 24;
const TRAP_MAX = 24;
const FLOATER_MAX = 12;

function probeWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
    return !!gl;
  } catch (_) {
    return false;
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export class Render3D {
  constructor() {
    this.ok = false;
    this.canvas = null;
    this.game = null;
    this.t = 0;
    this.lowFx = false;
    this.reduceMotion = false;
    this._world = null;
    this._look = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._fogA = new THREE.Color();
    this._fogB = new THREE.Color();
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._hit = new THREE.Vector3();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this._fwd = new THREE.Vector3();
  }

  isOk() {
    return this.ok;
  }

  _refreshFx() {
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.matchMedia("(max-width: 900px)").matches;
    this.lowFx = this.reduceMotion || coarse || narrow;
    this._coarse = coarse;
    this._narrow = narrow;
  }

  init(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this._refreshFx();
    try {
      window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => this._refreshFx());
      window.matchMedia("(pointer: coarse)").addEventListener("change", () => this._refreshFx());
    } catch (_) { /* ok */ }

    if (!probeWebGL()) return false;
    if (!THREE || !THREE.WebGLRenderer) return false;

    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(DAY_FOG);
      scene.fog = new THREE.FogExp2(DAY_FOG, this.lowFx ? 0.042 : 0.032);

      const camera = new THREE.PerspectiveCamera(46, 1, 0.12, 90);

      const antialias = !this.lowFx;
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias,
        powerPreference: "high-performance",
        alpha: false,
      });
      const dprCap = (this._coarse || this._narrow) ? 1 : 1.5;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
      if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;

      this.scene = scene;
      this.camera = camera;
      this.renderer = renderer;

      this.ambient = new THREE.AmbientLight(0xc8d4c0, 0.32);
      scene.add(this.ambient);
      this.hemi = new THREE.HemisphereLight(0xc8e0f0, 0x3a2a18, 0.7);
      scene.add(this.hemi);
      this.sun = new THREE.DirectionalLight(0xfff0d0, 1.15);
      this.sun.position.set(18, 28, 10);
      scene.add(this.sun);
      scene.add(this.sun.target);

      this.playerGlow = new THREE.PointLight(0xffe0a0, 0.2, 7, 2);
      scene.add(this.playerGlow);
      this.cabinGlow = new THREE.PointLight(0xffc060, 0, 9, 1.8);
      scene.add(this.cabinGlow);

      this.torchLights = [];
      const torchBudget = this.lowFx ? 3 : 6;
      for (let i = 0; i < torchBudget; i++) {
        const L = new THREE.PointLight(0xff9030, 0, 6.5, 2);
        scene.add(L);
        this.torchLights.push(L);
      }

      this._makeShared();
      this._makePlayer();
      this._makePools();
      this._makeOverlays();

      this.worldRoot = new THREE.Group();
      scene.add(this.worldRoot);

      this.ok = true;
      this.resize();
      window.addEventListener("resize", () => this.resize());
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => this.resize());
      }
      return true;
    } catch (err) {
      console.error("CABANA WebGL init failed", err);
      this.ok = false;
      this._teardown();
      return false;
    }
  }

  _makeShared() {
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      tile: new THREE.BoxGeometry(1, 0.1, 1),
      water: new THREE.BoxGeometry(1, 0.08, 1),
      sphere: new THREE.SphereGeometry(0.5, 7, 6),
      cone: new THREE.ConeGeometry(0.55, 1.2, 6),
      coneSm: new THREE.ConeGeometry(0.38, 0.7, 6),
      cyl: new THREE.CylinderGeometry(0.18, 0.22, 1, 6),
      stump: new THREE.CylinderGeometry(0.28, 0.32, 0.22, 7),
      ico: new THREE.IcosahedronGeometry(0.55, 0),
      cap: new THREE.CapsuleGeometry(0.22, 0.38, 3, 6),
      capZ: new THREE.CapsuleGeometry(0.24, 0.42, 3, 6),
      torus: new THREE.TorusGeometry(0.42, 0.045, 6, 16),
      plane: new THREE.PlaneGeometry(1, 1),
      prism: new THREE.ConeGeometry(0.72, 0.55, 4),
    };
    this.mat = {
      grass: new THREE.MeshStandardMaterial({ color: 0x3a5a34, roughness: 0.95, metalness: 0 }),
      dirt: new THREE.MeshStandardMaterial({ color: 0x3d2a1c, roughness: 0.96 }),
      soil: new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.97 }),
      water: new THREE.MeshStandardMaterial({
        color: 0x1a3a48, roughness: 0.35, metalness: 0.08, emissive: 0x0a2030, emissiveIntensity: 0.12,
      }),
      floor: new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 0.9 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x241810, roughness: 0.92 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x3d2a1c, roughness: 0.88 }),
      woodHi: new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.86 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x3a1a16, roughness: 0.9 }),
      roofDark: new THREE.MeshStandardMaterial({ color: 0x1a1010, roughness: 0.92 }),
      bark: new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.95 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x1c3a1c, roughness: 0.9 }),
      leafHi: new THREE.MeshStandardMaterial({ color: 0x245024, roughness: 0.88 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.92, metalness: 0.08 }),
      rockHi: new THREE.MeshStandardMaterial({ color: 0x7a828c, roughness: 0.85, metalness: 0.12 }),
      iron: new THREE.MeshStandardMaterial({
        color: 0xa8b8c4, roughness: 0.4, metalness: 0.55, emissive: 0x607080, emissiveIntensity: 0.15,
      }),
      crop: new THREE.MeshStandardMaterial({ color: 0x3d5c2e, roughness: 0.9 }),
      fruit: new THREE.MeshStandardMaterial({ color: 0x8b3a2a, roughness: 0.7 }),
      fence: new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 }),
      torchPole: new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.9 }),
      flame: new THREE.MeshBasicMaterial({ color: 0xff9020 }),
      flameCore: new THREE.MeshBasicMaterial({ color: 0xffe080 }),
      trap: new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.85, metalness: 0.15 }),
      spike: new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.45, metalness: 0.4 }),
      playerBody: new THREE.MeshStandardMaterial({ color: 0x2a3530, roughness: 0.7 }),
      playerSkin: new THREE.MeshStandardMaterial({ color: 0xc4a07a, roughness: 0.65 }),
      playerHat: new THREE.MeshStandardMaterial({ color: 0x1a221c, roughness: 0.85 }),
      playerPants: new THREE.MeshStandardMaterial({ color: 0x1e1a14, roughness: 0.85 }),
      weapon: new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.7 }),
      blade: new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.4, metalness: 0.45 }),
      zBody: new THREE.MeshStandardMaterial({ color: 0x3e4838, roughness: 0.85 }),
      zRun: new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.85 }),
      zBrute: new THREE.MeshStandardMaterial({ color: 0x3a4a30, roughness: 0.85 }),
      zHead: new THREE.MeshStandardMaterial({ color: 0x5a6050, roughness: 0.8 }),
      eye: new THREE.MeshBasicMaterial({ color: 0xff4028 }),
      eyeHot: new THREE.MeshBasicMaterial({ color: 0xffe080 }),
      arrow: new THREE.MeshBasicMaterial({ color: 0x5c4030 }),
      ghostOk: new THREE.MeshBasicMaterial({ color: 0xc4a060, transparent: true, opacity: 0.35, depthWrite: false }),
      ghostBad: new THREE.MeshBasicMaterial({ color: 0xb83030, transparent: true, opacity: 0.4, depthWrite: false }),
      ring: new THREE.MeshBasicMaterial({ color: 0xe8c878, transparent: true, opacity: 0.7, depthWrite: false }),
      hpBack: new THREE.MeshBasicMaterial({ color: 0x111111 }),
      hpOk: new THREE.MeshBasicMaterial({ color: 0x6a8a40 }),
      hpBad: new THREE.MeshBasicMaterial({ color: 0xa02828 }),
      cabinHp: new THREE.MeshBasicMaterial({ color: 0xc4a060 }),
      particle: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      winGlass: new THREE.MeshStandardMaterial({
        color: 0x1a1410, emissive: 0xd4a24a, emissiveIntensity: 0, roughness: 0.4, metalness: 0.1,
      }),
      door: new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.9 }),
      voidGround: new THREE.MeshStandardMaterial({ color: 0x142018, roughness: 1 }),
    };
  }

  _mesh(geo, mat, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (sx != null) m.scale.set(sx, sy, sz);
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }

  _makePlayer() {
    const g = new THREE.Group();
    const shadow = this._mesh(this.geo.sphere, new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false,
    }), 0, 0.04, 0, 0.7, 0.08, 0.7);
    g.add(shadow);
    const body = this._mesh(this.geo.cap, this.mat.playerBody, 0, 0.52, 0, 1, 1, 1);
    g.add(body);
    const pants = this._mesh(this.geo.box, this.mat.playerPants, 0, 0.22, 0, 0.42, 0.28, 0.36);
    g.add(pants);
    const head = this._mesh(this.geo.box, this.mat.playerSkin, 0, 0.95, 0, 0.38, 0.32, 0.34);
    g.add(head);
    const hat = this._mesh(this.geo.box, this.mat.playerHat, 0, 1.14, 0, 0.46, 0.12, 0.42);
    g.add(hat);
    const brim = this._mesh(this.geo.box, this.mat.playerHat, 0, 1.08, -0.08, 0.52, 0.06, 0.18);
    g.add(brim);
    const eyeL = this._mesh(this.geo.box, new THREE.MeshBasicMaterial({ color: 0x0a0a08 }), -0.08, 0.96, 0.16, 0.06, 0.06, 0.04);
    const eyeR = this._mesh(this.geo.box, new THREE.MeshBasicMaterial({ color: 0x0a0a08 }), 0.08, 0.96, 0.16, 0.06, 0.06, 0.04);
    g.add(eyeL, eyeR);
    const lantern = this._mesh(this.geo.sphere, this.mat.flameCore, 0.28, 0.55, 0.12, 0.14, 0.14, 0.14);
    lantern.visible = false;
    g.add(lantern);
    const weapon = new THREE.Group();
    const shaft = this._mesh(this.geo.box, this.mat.weapon, 0, 0, 0.35, 0.07, 0.07, 0.7);
    const blade = this._mesh(this.geo.box, this.mat.blade, 0, 0, 0.72, 0.1, 0.12, 0.18);
    weapon.add(shaft, blade);
    weapon.position.set(0.28, 0.55, 0);
    g.add(weapon);
    const bow = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.03, 4, 8, Math.PI),
      this.mat.weapon,
    );
    bow.rotation.y = Math.PI / 2;
    bow.position.set(0.32, 0.55, 0.2);
    bow.visible = false;
    g.add(bow);
    this.scene.add(g);
    this.playerRoot = g;
    this.playerWeapon = weapon;
    this.playerBow = bow;
    this.playerLantern = lantern;
    this.playerBody = body;
  }

  _makeZombie() {
    const g = new THREE.Group();
    const shadow = this._mesh(this.geo.sphere, new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false,
    }), 0, 0.03, 0, 0.8, 0.08, 0.8);
    g.add(shadow);
    const bodyMat = this.mat.zBody.clone();
    const body = this._mesh(this.geo.capZ, bodyMat, 0, 0.55, 0, 1, 1, 1);
    g.add(body);
    const head = this._mesh(this.geo.box, this.mat.zHead, 0, 1.02, 0, 0.42, 0.34, 0.38);
    g.add(head);
    const eyeL = this._mesh(this.geo.box, this.mat.eye, -0.1, 1.05, 0.2, 0.1, 0.08, 0.06);
    const eyeR = this._mesh(this.geo.box, this.mat.eye, 0.1, 1.05, 0.2, 0.1, 0.08, 0.06);
    g.add(eyeL, eyeR);
    const hpBack = this._mesh(this.geo.box, this.mat.hpBack, 0, 1.38, 0, 0.7, 0.06, 0.06);
    const hpFill = this._mesh(this.geo.box, this.mat.hpOk, 0, 1.38, 0.01, 0.68, 0.05, 0.05);
    g.add(hpBack, hpFill);
    g.visible = false;
    this.scene.add(g);
    return { root: g, body, bodyMat, head, eyeL, eyeR, hpBack, hpFill, shadow };
  }

  _makeFence() {
    const g = new THREE.Group();
    g.add(this._mesh(this.geo.box, this.mat.fence, -0.28, 0.38, 0, 0.12, 0.76, 0.12));
    g.add(this._mesh(this.geo.box, this.mat.fence, 0.28, 0.38, 0, 0.12, 0.76, 0.12));
    g.add(this._mesh(this.geo.box, this.mat.woodHi, 0, 0.48, 0, 0.72, 0.1, 0.08));
    g.add(this._mesh(this.geo.box, this.mat.woodHi, 0, 0.28, 0, 0.72, 0.1, 0.08));
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  _makeTorch() {
    const g = new THREE.Group();
    g.add(this._mesh(this.geo.cyl, this.mat.torchPole, 0, 0.4, 0, 0.55, 0.8, 0.55));
    const flame = this._mesh(this.geo.coneSm, this.mat.flame, 0, 0.95, 0, 0.55, 0.7, 0.55);
    const core = this._mesh(this.geo.sphere, this.mat.flameCore, 0, 0.92, 0, 0.28, 0.36, 0.28);
    g.add(flame, core);
    g.userData.flame = flame;
    g.userData.core = core;
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  _makeTrap() {
    const g = new THREE.Group();
    g.add(this._mesh(this.geo.box, this.mat.trap, 0, 0.08, 0, 0.7, 0.1, 0.7));
    g.add(this._mesh(this.geo.coneSm, this.mat.spike, -0.16, 0.28, 0.08, 0.35, 0.45, 0.35));
    g.add(this._mesh(this.geo.coneSm, this.mat.spike, 0.14, 0.3, -0.1, 0.32, 0.5, 0.32));
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  _makeFloater() {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(2.2, 0.55, 1);
    s.visible = false;
    s.userData.canvas = c;
    s.userData.ctx = c.getContext("2d");
    s.userData.tex = tex;
    this.scene.add(s);
    return s;
  }

  _makePools() {
    this.zombies3d = [];
    for (let i = 0; i < ZOMBIE_MAX; i++) this.zombies3d.push(this._makeZombie());
    this.arrows3d = [];
    for (let i = 0; i < ARROW_MAX; i++) {
      const m = this._mesh(this.geo.box, this.mat.arrow, 0, 0.4, 0, 0.06, 0.06, 0.55);
      m.visible = false;
      this.scene.add(m);
      this.arrows3d.push(m);
    }
    const pMax = this.lowFx ? 28 : PARTICLE_MAX;
    this.particles3d = [];
    for (let i = 0; i < pMax; i++) {
      const m = this._mesh(this.geo.box, this.mat.particle.clone(), 0, 0.3, 0, 0.12, 0.12, 0.12);
      m.visible = false;
      this.scene.add(m);
      this.particles3d.push(m);
    }
    this.fences3d = [];
    for (let i = 0; i < FENCE_MAX; i++) this.fences3d.push(this._makeFence());
    this.torches3d = [];
    for (let i = 0; i < TORCH_MAX; i++) this.torches3d.push(this._makeTorch());
    this.traps3d = [];
    for (let i = 0; i < TRAP_MAX; i++) this.traps3d.push(this._makeTrap());
    this.floaters3d = [];
    for (let i = 0; i < FLOATER_MAX; i++) this.floaters3d.push(this._makeFloater());
  }

  _makeOverlays() {
    this.ghostMesh = this._mesh(this.geo.box, this.mat.ghostOk, 0, 0.4, 0, 0.92, 0.8, 0.92);
    this.ghostMesh.visible = false;
    this.scene.add(this.ghostMesh);

    this.focusRing = this._mesh(this.geo.torus, this.mat.ring, 0, 0.12, 0, 1.15, 1.15, 1.15);
    this.focusRing.rotation.x = -Math.PI / 2;
    this.focusRing.visible = false;
    this.scene.add(this.focusRing);

    this.markRing = this._mesh(this.geo.torus, this.mat.ring.clone(), 0, 0.1, 0, 1, 1, 1);
    this.markRing.rotation.x = -Math.PI / 2;
    this.markRing.visible = false;
    this.scene.add(this.markRing);

    const flashGeo = new THREE.PlaneGeometry(2, 2);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0x5a0808, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
    });
    this.flashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.flashMesh.frustumCulled = false;
    this.flashMesh.renderOrder = 999;
    this.flashMesh.visible = false;
    this.flashMesh.position.set(0, 0, -0.45);
    this.camera.add(this.flashMesh);
    this.scene.add(this.camera);
  }

  _wx(x) { return x / TILE; }
  _wz(y) { return y / TILE; }

  _clearWorld() {
    if (!this.worldRoot) return;
    const dump = [];
    this.worldRoot.traverse((o) => {
      if (o !== this.worldRoot) dump.push(o);
    });
    for (const o of dump) {
      if (o.parent) o.parent.remove(o);
    }
    this.trees3d = [];
    this.rocks3d = [];
    this.veins3d = [];
    this.plots3d = [];
    this.cabin3d = null;
    this.waterMesh = null;
    this.tileMesh = null;
  }

  _buildWorld(world) {
    this._clearWorld();
    const root = this.worldRoot;
    const cols = world.cols;
    const rows = world.rows;

    const voidPlane = this._mesh(this.geo.box, this.mat.voidGround, cols / 2, -0.2, rows / 2, cols + 18, 0.15, rows + 18);
    root.add(voidPlane);

    const landPos = [];
    const waterPos = [];
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const tile = world.at(tx, ty);
        if (tile === T.WATER) waterPos.push({ tx, ty });
        else landPos.push({ tx, ty, tile, n: hash2(tx, ty) });
      }
    }

    const land = new THREE.InstancedMesh(this.geo.tile, this.mat.grass, Math.max(1, landPos.length));
    land.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < landPos.length; i++) {
      const { tx, ty, tile, n } = landPos[i];
      this._dummy.position.set(tx + 0.5, 0, ty + 0.5);
      this._dummy.rotation.set(0, 0, 0);
      this._dummy.scale.set(1, 1, 1);
      this._dummy.updateMatrix();
      land.setMatrixAt(i, this._dummy.matrix);
      if (tile === T.DIRT) this._color.setRGB(0.24 + n * 0.04, 0.16, 0.1);
      else if (tile === T.SOIL) this._color.setRGB(0.16, 0.1, 0.06);
      else if (tile === T.FLOOR) this._color.setRGB(0.29, 0.2, 0.14);
      else if (tile === T.WALL || tile === T.DOOR) this._color.setRGB(0.12, 0.08, 0.05);
      else this._color.setRGB(0.16 + n * 0.05, 0.28 + n * 0.1, 0.14 + n * 0.04);
      land.setColorAt(i, this._color);
    }
    land.instanceMatrix.needsUpdate = true;
    if (land.instanceColor) land.instanceColor.needsUpdate = true;
    root.add(land);
    this.tileMesh = land;

    const water = new THREE.InstancedMesh(this.geo.water, this.mat.water, Math.max(1, waterPos.length));
    water.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._waterPos = waterPos;
    for (let i = 0; i < waterPos.length; i++) {
      const { tx, ty } = waterPos[i];
      this._dummy.position.set(tx + 0.5, -0.06, ty + 0.5);
      this._dummy.rotation.set(0, 0, 0);
      this._dummy.scale.set(1, 1, 1);
      this._dummy.updateMatrix();
      water.setMatrixAt(i, this._dummy.matrix);
      const n = hash2(tx, ty);
      water.setColorAt(i, this._color.setRGB(0.08, 0.18 + n * 0.08, 0.24 + n * 0.08));
    }
    water.instanceMatrix.needsUpdate = true;
    if (water.instanceColor) water.instanceColor.needsUpdate = true;
    root.add(water);
    this.waterMesh = water;

    this.trees3d = world.trees.map((t) => this._makeTree(t));
    this.rocks3d = world.rocks.map((r) => this._makeRock(r, false));
    this.veins3d = world.veins.map((v) => this._makeRock(v, true));
    this.plots3d = world.plots.map((p) => this._makePlot(p));
    this.cabin3d = this._makeCabin(world.cabin);
  }

  _makeTree(t) {
    const g = new THREE.Group();
    g.position.set(this._wx(t.x), 0, this._wz(t.y));
    const n = hash2(t.tx, t.ty);
    const trunk = this._mesh(this.geo.cyl, this.mat.bark, 0, 0.55, 0, 1, 1.1, 1);
    const stump = this._mesh(this.geo.stump, this.mat.bark, 0, 0.12, 0, 1, 1, 1);
    const leaf1 = this._mesh(this.geo.cone, this.mat.leaf, 0, 1.35, 0, 1.15 + n * 0.2, 1.1, 1.15 + n * 0.2);
    const leaf2 = this._mesh(this.geo.coneSm, this.mat.leafHi, 0.15, 1.85, -0.1, 1.1, 1, 1.1);
    g.add(trunk, stump, leaf1, leaf2);
    g.userData = { trunk, stump, leaf1, leaf2, src: t };
    this.worldRoot.add(g);
    return g;
  }

  _makeRock(r, vein) {
    const g = new THREE.Group();
    g.position.set(this._wx(r.x), 0, this._wz(r.y));
    const n = hash2(r.tx || 0, r.ty || 0);
    const rock = this._mesh(this.geo.ico, this.mat.rock, 0, 0.28, 0, 0.7 + n * 0.25, 0.45 + n * 0.15, 0.65);
    rock.rotation.y = n * 6;
    g.add(rock);
    if (vein) {
      g.add(this._mesh(this.geo.box, this.mat.iron, 0.08, 0.34, 0.06, 0.22, 0.18, 0.18));
      g.add(this._mesh(this.geo.box, this.mat.rockHi, -0.1, 0.38, -0.08, 0.14, 0.12, 0.14));
    }
    g.userData.src = r;
    this.worldRoot.add(g);
    return g;
  }

  _makePlot(p) {
    const g = new THREE.Group();
    g.position.set(p.tx + 0.5, 0.08, p.ty + 0.5);
    const s1 = this._mesh(this.geo.box, this.mat.crop, -0.12, 0.12, 0, 0.08, 0.28, 0.08);
    const s2 = this._mesh(this.geo.box, this.mat.crop, 0.1, 0.1, 0.08, 0.07, 0.22, 0.07);
    const fruit = this._mesh(this.geo.sphere, this.mat.fruit, 0.02, 0.28, 0, 0.22, 0.18, 0.22);
    g.add(s1, s2, fruit);
    g.userData = { s1, s2, fruit, src: p };
    this.worldRoot.add(g);
    return g;
  }

  _makeCabin(c) {
    const g = new THREE.Group();
    const cx = c.tx + 2.5;
    const cz = c.ty + 2.5;
    g.position.set(cx, 0, cz);

    g.add(this._mesh(this.geo.box, this.mat.wood, 0, 0.95, 0, 4.6, 1.7, 4.2));
    g.add(this._mesh(this.geo.box, this.mat.woodHi, 0, 0.95, 0, 4.35, 1.55, 3.95));

    const roof = this._mesh(this.geo.prism, this.mat.roof, 0, 2.05, 0, 4.4, 1.35, 4.6);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const roofCap = this._mesh(this.geo.prism, this.mat.roofDark, 0, 2.18, 0, 4.55, 0.35, 4.75);
    roofCap.rotation.y = Math.PI / 4;
    g.add(roofCap);

    g.add(this._mesh(this.geo.box, this.mat.door, 0, 0.55, 2.08, 0.7, 1.05, 0.12));
    const winL = this._mesh(this.geo.box, this.mat.winGlass, -1.35, 1.15, 2.08, 0.7, 0.5, 0.08);
    const winR = this._mesh(this.geo.box, this.mat.winGlass, 1.35, 1.15, 2.08, 0.7, 0.5, 0.08);
    g.add(winL, winR);
    g.add(this._mesh(this.geo.box, this.mat.wood, 1.55, 2.35, -0.4, 0.28, 0.7, 0.28));

    const hpBack = this._mesh(this.geo.box, this.mat.hpBack, 0, 2.72, 0, 2.4, 0.08, 0.08);
    const hpFill = this._mesh(this.geo.box, this.mat.cabinHp, 0, 2.72, 0.02, 2.32, 0.06, 0.06);
    g.add(hpBack, hpFill);

    g.userData = { winL, winR, hpFill, hpBack };
    this.worldRoot.add(g);
    this.cabinGlow.position.set(cx, 1.4, cz + 1.2);
    return g;
  }

  resize() {
    if (!this.ok || !this.renderer || !this.camera) return;
    const app = document.getElementById("app");
    const w = (app && app.clientWidth) || this.canvas.clientWidth || window.innerWidth;
    const h = (app && app.clientHeight) || this.canvas.clientHeight || window.innerHeight;
    this.game.viewW = w;
    this.game.viewH = h;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  screenToWorld(sx, sy) {
    if (!this.ok || !this.camera) return null;
    const w = this.game.viewW || 1;
    const h = this.game.viewH || 1;
    this._ndc.set((sx / w) * 2 - 1, -(sy / h) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    const hit = this._ray.ray.intersectPlane(this._plane, this._hit);
    if (!hit) return null;
    return { x: hit.x * TILE, y: hit.z * TILE };
  }

  draw(dt = 0.016) {
    if (!this.ok) return;
    this.t += dt;
    this.syncFromGame(dt);
    this.renderer.render(this.scene, this.camera);
  }

  syncFromGame(dt) {
    const g = this.game;
    if (!g || !g.world) return;
    if (this._world !== g.world) {
      this._world = g.world;
      this._buildWorld(g.world);
      this._look.set(this._wx(g.player.x), 0.35, this._wz(g.player.y));
    }
    if (g.mode === MODE.PLAY && this._lastMode === MODE.MENU) {
      this._look.set(this._wx(g.player.x), 0.35, this._wz(g.player.y));
    }
    this._lastMode = g.mode;
    this._syncLighting(g);
    this._syncStaticProps(g);
    this._syncBuildings(g);
    this._syncActors(g);
    this._syncFx(g);
    this._syncCamera(g, dt);
  }

  _syncLighting(g) {
    const night = clamp01(g.nightLight || 0);
    const day = 1 - night;
    const dusk = Math.sin(night * Math.PI) * (night > 0.02 && night < 0.98 ? 1 : 0);

    this.ambient.color.setRGB(lerp(0.78, 0.18, night), lerp(0.83, 0.22, night), lerp(0.75, 0.32, night));
    this.ambient.intensity = 0.3 * day + 0.08 * night + 0.06 * dusk;
    this.hemi.color.setRGB(lerp(0.78, 0.12, night), lerp(0.88, 0.18, night), lerp(0.94, 0.32, night));
    this.hemi.groundColor.setRGB(lerp(0.23, 0.05, night), lerp(0.16, 0.04, night), lerp(0.09, 0.06, night));
    this.hemi.intensity = 0.72 * day + 0.14 * night;
    this.sun.color.setRGB(lerp(1, 0.35, night), lerp(0.94, 0.42, night), lerp(0.82, 0.7, night));
    this.sun.intensity = 1.18 * day + 0.05 * night + 0.25 * dusk;
    this.sun.position.set(18 - night * 8, 28 - night * 16, 10);

    this._fogA.setHex(DAY_FOG);
    this._fogB.setHex(night > 0.55 ? NIGHT_FOG : DUSK_FOG);
    this.scene.fog.color.copy(this._fogA).lerp(this._fogB, Math.max(night, dusk * 0.65));
    this.scene.background.copy(this.scene.fog.color);
    this.scene.fog.density = (this.lowFx ? 0.038 : 0.028) + night * 0.018;

    const p = g.player;
    this.playerGlow.position.set(this._wx(p.x), 0.7, this._wz(p.y));
    this.playerGlow.intensity = 0.15 + night * 1.15;
    this.playerGlow.distance = 4.5 + night * 3.5;
    this.playerGlow.color.setHex(night > 0.4 ? 0xffd080 : 0xe8f0e0);
    this.playerLantern.visible = night > 0.35;
    this.cabinGlow.intensity = night * 1.35;
    this.mat.winGlass.emissiveIntensity = night * 0.95;
    this.mat.winGlass.color.setHex(night > 0.3 ? 0xd4a24a : 0x1a1410);

    const torches = g.world.torches || [];
    for (let i = 0; i < this.torchLights.length; i++) {
      const L = this.torchLights[i];
      const t = torches[i];
      if (t && night > 0.12) {
        const flick = 0.75 + Math.sin(this.t * 14 + t.x) * 0.25;
        L.position.set(this._wx(t.x), 1.05, this._wz(t.y));
        L.intensity = (0.85 + night * 0.7) * flick;
        L.distance = 6.2;
      } else {
        L.intensity = 0;
      }
    }
  }

  _syncStaticProps(g) {
    for (const tree of this.trees3d) {
      const t = tree.userData.src;
      const stump = !!(t && t.stump);
      tree.userData.trunk.visible = !stump;
      tree.userData.leaf1.visible = !stump;
      tree.userData.leaf2.visible = !stump;
      tree.userData.stump.visible = stump;
    }
    for (const rock of this.rocks3d) {
      const r = rock.userData.src;
      rock.visible = r && !r.gone;
    }
    for (const vein of this.veins3d) {
      const v = vein.userData.src;
      vein.visible = v && !v.gone;
    }
    for (const plot of this.plots3d) {
      const p = plot.userData.src;
      if (!p || p.state === "empty") {
        plot.userData.s1.visible = false;
        plot.userData.s2.visible = false;
        plot.userData.fruit.visible = false;
      } else if (p.state === "growing") {
        const h = 0.35 + p.grow * 0.85;
        plot.userData.s1.visible = true;
        plot.userData.s2.visible = true;
        plot.userData.fruit.visible = false;
        plot.userData.s1.scale.y = h;
        plot.userData.s1.position.y = 0.08 * h;
        plot.userData.s2.scale.y = h * 0.75;
      } else {
        plot.userData.s1.visible = true;
        plot.userData.s2.visible = true;
        plot.userData.fruit.visible = true;
        plot.userData.s1.scale.y = 1.1;
        plot.userData.s2.scale.y = 0.9;
      }
    }
    if (this.cabin3d) {
      const c = g.world.cabin;
      const ratio = clamp01(c.hp / c.maxHp);
      this.cabin3d.userData.hpFill.scale.x = Math.max(0.04, ratio);
      this.cabin3d.userData.hpFill.position.x = (ratio - 1) * 1.16;
      this.cabin3d.userData.hpFill.material = ratio > 0.35 ? this.mat.cabinHp : this.mat.hpBad;
    }
    if (this.waterMesh && this._waterPos && !this.lowFx) {
      for (let i = 0; i < this._waterPos.length; i++) {
        const { tx, ty } = this._waterPos[i];
        const wob = Math.sin(this.t * 1.5 + tx * 0.35 + ty * 0.28) * 0.03;
        this._dummy.position.set(tx + 0.5, -0.05 + wob, ty + 0.5);
        this._dummy.rotation.set(0, 0, 0);
        this._dummy.scale.set(1, 1, 1);
        this._dummy.updateMatrix();
        this.waterMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.waterMesh.instanceMatrix.needsUpdate = true;
    }
  }

  _syncBuildings(g) {
    const fences = g.world.fences || [];
    for (let i = 0; i < this.fences3d.length; i++) {
      const mesh = this.fences3d[i];
      const f = fences[i];
      if (!f || f.hp <= 0) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(this._wx(f.x), 0, this._wz(f.y));
      mesh.rotation.y = ((f.tx || 0) + (f.ty || 0)) * 0.7;
    }
    const torches = g.world.torches || [];
    for (let i = 0; i < this.torches3d.length; i++) {
      const mesh = this.torches3d[i];
      const t = torches[i];
      if (!t) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(this._wx(t.x), 0, this._wz(t.y));
      const flick = 0.7 + Math.sin(this.t * 16 + t.x) * 0.3;
      mesh.userData.flame.scale.setScalar(0.9 + flick * 0.25);
      mesh.userData.core.material.opacity = 1;
    }
    const traps = g.world.traps || [];
    for (let i = 0; i < this.traps3d.length; i++) {
      const mesh = this.traps3d[i];
      const t = traps[i];
      if (!t || t.uses <= 0) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(this._wx(t.x), 0, this._wz(t.y));
    }
  }

  _faceY(facing) {
    return Math.PI / 2 - facing;
  }

  _syncActors(g) {
    const p = g.player;
    const bob = Math.sin((p.walk || 0) * 2) * 0.04;
    this.playerRoot.position.set(this._wx(p.x), bob, this._wz(p.y));
    const ang = p.aim != null ? p.aim : p.facing;
    this.playerRoot.rotation.y = this._faceY(ang || 0);
    this.playerRoot.visible = true;
    if (this.mat.playerBody.emissive) {
      this.mat.playerBody.emissive.setHex(p.hurt > 0 && Math.sin(this.t * 40) > 0 ? 0x401010 : 0x000000);
    }

    const swinging = p.swinging > 0;
    this.playerWeapon.visible = swinging || g.equipped !== "arco";
    this.playerBow.visible = g.equipped === "arco" && !swinging;
    if (swinging) {
      const w = WEAPONS[g.equipped] || WEAPONS.estaca;
      this.playerWeapon.rotation.x = 0.6 - p.swinging * 4;
      this.playerWeapon.scale.set(1, 1, w.id === "lanca" ? 1.35 : 1);
    } else {
      this.playerWeapon.rotation.x = 0.15;
      this.playerWeapon.scale.set(1, 1, 1);
    }

    const zs = g.zombies || [];
    for (let i = 0; i < this.zombies3d.length; i++) {
      const z3 = this.zombies3d[i];
      const z = zs[i];
      if (!z || z.hp <= 0) {
        z3.root.visible = false;
        continue;
      }
      z3.root.visible = true;
      const brute = z.kind === "bruto";
      const run = z.kind === "corredor";
      const bobZ = Math.sin((z.walk || 0) * 2) * 0.05;
      z3.root.position.set(this._wx(z.x), bobZ, this._wz(z.y));
      const face = Math.atan2(p.y - z.y, p.x - z.x);
      z3.root.rotation.y = this._faceY(z.facing != null ? z.facing : face);
      const sc = brute ? 1.35 : run ? 0.82 : 1;
      z3.root.scale.setScalar(sc);
      z3.bodyMat.color.setHex(brute ? 0x3a4a30 : run ? 0x4a4038 : 0x3e4838);
      const wind = Math.min(1, z.windup || 0) / 0.32;
      const eyeMat = wind > 0.2 ? this.mat.eyeHot : this.mat.eye;
      z3.eyeL.material = eyeMat;
      z3.eyeR.material = eyeMat;
      z3.eyeL.scale.setScalar(1 + wind * 0.6);
      z3.eyeR.scale.setScalar(1 + wind * 0.6);
      const max = z.max || 28;
      const ratio = clamp01(z.hp / max);
      const showHp = z.hurt > 0 || ratio < 0.99;
      z3.hpBack.visible = showHp;
      z3.hpFill.visible = showHp;
      if (showHp) {
        z3.hpFill.scale.x = Math.max(0.05, ratio);
        z3.hpFill.position.x = (ratio - 1) * 0.34;
        z3.hpFill.material = ratio > 0.4 ? this.mat.hpOk : this.mat.hpBad;
      }
      z3.bodyMat.emissive.setHex(z.hurt > 0 ? 0x442222 : 0x000000);
    }

    const arrows = g.arrows || [];
    for (let i = 0; i < this.arrows3d.length; i++) {
      const m = this.arrows3d[i];
      const a = arrows[i];
      if (!a) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.set(this._wx(a.x), 0.55, this._wz(a.y));
      this._fwd.set(a.vx, 0, a.vy).normalize();
      m.lookAt(m.position.x + this._fwd.x, 0.55, m.position.z + this._fwd.z);
    }
  }

  _syncFx(g) {
    const ghost = g.buildGhost;
    if (ghost) {
      this.ghostMesh.visible = true;
      this.ghostMesh.position.set(ghost.tx + 0.5, 0.42, ghost.ty + 0.5);
      this.ghostMesh.material = ghost.ok ? this.mat.ghostOk : this.mat.ghostBad;
    } else {
      this.ghostMesh.visible = false;
    }

    const n = g.focusNode;
    if (n && n.x != null && g.mode === MODE.PLAY) {
      this.focusRing.visible = true;
      this.focusRing.position.set(this._wx(n.x), 0.14, this._wz(n.y));
      const pulse = 0.95 + Math.sin(this.t * 6) * 0.12;
      this.focusRing.scale.setScalar(pulse);
      this.focusRing.material.opacity = 0.45 + Math.sin(this.t * 6) * 0.2;
    } else {
      this.focusRing.visible = false;
    }

    const mark = g.mark;
    if (mark) {
      const a = clamp01(mark.t / 0.35);
      this.markRing.visible = true;
      this.markRing.position.set(this._wx(mark.x), 0.1, this._wz(mark.y));
      this.markRing.scale.setScalar(0.7 + (1 - a) * 0.7);
      this.markRing.material.opacity = a * 0.8;
    } else {
      this.markRing.visible = false;
    }

    const parts = g.particles || [];
    for (let i = 0; i < this.particles3d.length; i++) {
      const m = this.particles3d[i];
      const p = parts[i];
      if (!p) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.set(this._wx(p.x), 0.25 + (1 - clamp01(p.life / p.max)) * 0.4, this._wz(p.y));
      const s = (p.size || 3) * 0.012 * SCALE;
      m.scale.setScalar(p.soft ? s * 2.2 : Math.max(0.08, s));
      m.material.color.set(p.color || "#ffffff");
      m.material.transparent = true;
      m.material.opacity = clamp01(p.life / p.max) * (p.soft ? 0.35 : 0.9);
    }

    const floats = g.floaters || [];
    for (let i = 0; i < this.floaters3d.length; i++) {
      const s = this.floaters3d[i];
      const f = floats[i];
      if (!f) {
        s.visible = false;
        continue;
      }
      s.visible = true;
      s.position.set(this._wx(f.x), 1.35, this._wz(f.y));
      s.material.opacity = clamp01(f.t);
      if (s.userData.last !== f.text) {
        s.userData.last = f.text;
        const ctx = s.userData.ctx;
        ctx.clearRect(0, 0, 256, 64);
        ctx.font = "700 28px Source Sans 3, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.strokeText(f.text, 128, 42);
        ctx.fillStyle = f.color || "#fff";
        ctx.fillText(f.text, 128, 42);
        s.userData.tex.needsUpdate = true;
      }
    }

    const flash = g.flash || 0;
    const vig = g.vignette || 0;
    const menu = g.mode === MODE.MENU;
    if (flash > 0.01 || vig > 0.04 || menu) {
      this.flashMesh.visible = true;
      if (flash > 0.01) {
        this.flashMesh.material.color.setHex(0x5a0808);
        this.flashMesh.material.opacity = flash * 0.45;
      } else if (vig > 0.04) {
        this.flashMesh.material.color.setHex(0x280404);
        this.flashMesh.material.opacity = Math.min(0.42, vig * 0.55);
      } else {
        this.flashMesh.material.color.setHex(0x04060c);
        this.flashMesh.material.opacity = 0.28;
      }
    } else {
      this.flashMesh.visible = false;
      this.flashMesh.material.opacity = 0;
    }
  }

  _syncCamera(g, dt) {
    const p = g.player;
    const c = g.world.cabin;
    let tx = this._wx(p.x);
    let tz = this._wz(p.y);
    if (g.mode === MODE.MENU) {
      tx = this._wx(c.x);
      tz = this._wz(c.y + 40);
    }
    const lerpAmt = Math.min(1, (g.mode === MODE.MENU ? 2 : 10) * dt);
    this._look.x = lerp(this._look.x, tx, lerpAmt);
    this._look.y = 0.35;
    this._look.z = lerp(this._look.z, tz, lerpAmt);

    const aspect = (g.viewW || 16) / Math.max(1, g.viewH || 9);
    const span = aspect < 0.8 ? 15.5 : 17.5;
    const fov = (this.camera.fov * Math.PI) / 180;
    const camH = (span * 0.52) / Math.tan(fov / 2);
    const back = camH * 0.48;

    let ox = 0;
    let oy = 0;
    if (g.shake > 0 && !this.reduceMotion) {
      const amp = this.lowFx ? 0.04 : 0.09;
      ox = (Math.random() - 0.5) * g.shake * amp;
      oy = (Math.random() - 0.5) * g.shake * amp;
    }
    this.camera.position.set(this._look.x + ox, camH, this._look.z + back + oy);
    this.camera.lookAt(this._look.x, 0.45, this._look.z);
  }

  showWebglError(fallback2d) {
    const el = document.getElementById("webgl-fail");
    const msg = fallback2d
      ? "Seu aparelho não suportou o gráfico 3D. O jogo segue em 2D. Tente outro navegador para o visual novo."
      : "Seu aparelho não suportou o gráfico 3D. Tente outro navegador.";
    if (el) {
      el.textContent = msg;
      el.classList.remove("hidden");
    } else {
      const card = document.querySelector("#screen-start .card");
      if (!card) return;
      const p = document.createElement("p");
      p.id = "webgl-fail";
      p.className = "webgl-fail";
      p.setAttribute("role", "alert");
      p.textContent = msg;
      const tag = card.querySelector(".tagline");
      if (tag) tag.after(p);
      else card.insertBefore(p, card.querySelector(".row"));
    }
  }

  _teardown() {
    try {
      if (this.renderer) this.renderer.dispose();
    } catch (_) { /* ok */ }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }
}
