// Coral Bay — the game itself: renderer, loop, camera, input, combat, enemies,
// pickups, the clock and the wiring between every system.
import * as THREE from 'three';
import { CITY, MISSIONS, WANTED_RULES, WEAPON, CONTROLS_TEXT } from './config.js';
import { makeRng } from './rng.js';
import { SoundEngine } from './audio.js';
import { buildCity, collideCircle, clampToCity } from './city.js';
import { makeCarModel, carColorFor, PlayerCar, TrafficManager } from './vehicles.js';
import { PedestrianManager, makePersonModel } from './people.js';
import { PlayerController } from './player.js';
import { WantedSystem, PoliceManager } from './police.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

const SHOT_SEED = 7;

export class Game {
  constructor() {
    this.rng = makeRng(SHOT_SEED);
    this.sound = new SoundEngine();
    this.screen = 'title';
    this.cash = 120;
    this.day = 1;
    this.minutes = 17 * 60 + 24;
    this.hint = '';
    this.hintTimer = 0;
    this.timerValue = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.fpsMark = 0;
    this.fpsFrames = 0;
    this.lastNow = 0;
    this.errors = [];
    this.inCar = false;
    this.scripted = null;
    this.shotMode = null;
    this.enemies = [];
    this.pickups = [];
    this.tracers = [];
    this.parkedCars = [];
    this.lastCombatAt = -999;
    this.time = 0;
    this.keys = {};
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.32;
    this.cameraDist = 10;
    this.dragging = false;
    this.lastMouse = { x: 0, y: 0 };
    this.overReason = '';
    this.initRenderer();
    this.initWorld();
    this.initInput();
    this.hud = new HUD({
      onStart: (useSave) => this.startGame(useSave),
      onResume: () => this.resume(),
      onSave: () => this.saveNow(true),
      onRestart: () => this.startGame(false),
      onMenu: () => this.toTitle(),
      onRetry: () => this.respawn(),
      onMute: () => this.toggleMute(),
    });
    this.hud.showContinue(hasSave());
    this.hud.showScreen('start');
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      this.shotMode = shot;
      this.startGame(false);
      stageShot(shot, this);
    }
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  initRenderer() {
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf2c98f);
    this.scene.fog = new THREE.Fog(0xf2c98f, 180, 520);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.sun = new THREE.DirectionalLight(0xffe0b0, 2.6);
    this.sun.position.set(120, 140, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -240;
    this.sun.shadow.camera.right = 240;
    this.sun.shadow.camera.top = 240;
    this.sun.shadow.camera.bottom = -240;
    this.sun.shadow.camera.far = 600;
    this.scene.add(this.sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 1.1));
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('error', (event) => {
      this.errors.push(String(event.message || event.error));
    });
  }

  initWorld() {
    const city = buildCity(this.scene, this.rng);
    this.colliders = city.colliders;
    this.seaMaterial = city.seaMaterial;
    this.traffic = new TrafficManager(this.scene, this.rng);
    this.traffic.spawn(14);
    this.pedestrians = new PedestrianManager(this.scene, this.rng);
    this.pedestrians.spawn(24);
    this.player = new PlayerController(this.scene);
    this.playerCar = new PlayerCar(this.scene, this.colliders);
    this.wanted = new WantedSystem();
    this.police = new PoliceManager(this.scene, this.rng);
    this.missions = new MissionManager(this.scene, {
      message: (text) => this.hud.toast(text, 5),
      onMissionStart: (mission) => this.sound.pickup(),
      onMissionComplete: (mission) => {
        this.cash += mission.reward;
        this.sound.missionDone();
        this.hud.toast(`Mission complete: ${mission.title} — +$${mission.reward}`, 5);
        this.saveNow(false);
      },
      onMissionFailed: (reason) => {
        this.sound.fail();
        this.hud.toast(reason, 5);
      },
      onStoryComplete: () => {
        this.cash += 1000;
        this.hud.toast('Story complete! Vera is paid off — Coral Bay is yours. Free roam!', 8);
        this.saveNow(false);
      },
      spawnThug: (pos, kind) => this.spawnEnemy(pos, kind),
      spawnGoldCar: (pos) => this.spawnParkedCar('sport', 0xd4af37, pos[0], pos[1], true),
      setWanted: (stars) => { this.wanted.stars = stars; },
    });
    this.spawnParkedCars();
    this.spawnPickups();
  }

  spawnParkedCars() {
    const spots = [[-58, -116], [58, 116], [-116, 58], [116, -58], [0, -116], [-174, 0], [58, -174], [-58, 174]];
    spots.forEach(([x, z], i) => {
      this.spawnParkedCar(i % 3 === 0 ? 'sport' : 'sedan', carColorFor(i + 2), x, z, false);
    });
  }

  spawnParkedCar(kind, color, x, z, missionCar) {
    const mesh = makeCarModel(color, kind);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = this.rng.range(0, Math.PI * 2);
    mesh.castShadow = true;
    this.scene.add(mesh);
    const car = { mesh, x, z, kind, color, missionCar: !!missionCar };
    this.parkedCars.push(car);
    return car;
  }

  spawnPickups() {
    const defs = [
      { kind: 'health', at: [29, 29] },
      { kind: 'health', at: [-87, -87] },
      { kind: 'ammo', at: [87, -29] },
      { kind: 'ammo', at: [-29, 87] },
      { kind: 'cash', at: [116, 58] },
      { kind: 'cash', at: [-116, -58] },
    ];
    for (const def of defs) this.addPickup(def.kind, def.at[0], def.at[1]);
  }

  addPickup(kind, x, z) {
    const color = kind === 'health' ? 0x58d68d : kind === 'ammo' ? 0xf2b134 : 0xd4af37;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1, 1.1),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }),
    );
    mesh.position.set(x, 1, z);
    this.scene.add(mesh);
    this.pickups.push({ kind, mesh, x, z, taken: false, respawn: 0 });
  }

  spawnEnemy(pos, kind) {
    const shirt = kind === 'rocco' ? 0x8a2f2f : 0x3a3a3a;
    const mesh = makePersonModel(shirt, 0xc98d5f);
    mesh.position.set(pos[0], 0, pos[1]);
    this.scene.add(mesh);
    const enemy = {
      mesh, x: pos[0], z: pos[1], heading: 0, kind,
      hp: kind === 'rocco' ? 60 : 50, shootTimer: 1.2, walkPhase: 0, dead: false, deadTimer: 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  initInput() {
    const canvas = document.getElementById('game');
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys[event.code] = true;
      if (event.code === 'KeyM') this.toggleMute();
      if (event.code === 'KeyP' || event.code === 'Escape') {
        if (this.screen === 'play') this.pause();
        else if (this.screen === 'pause') this.resume();
      }
      if (event.code === 'KeyE' && this.screen === 'play') this.toggleCar();
      if (event.code === 'KeyR' && this.screen === 'play') {
        if (this.player.tryReload()) this.sound.click();
      }
      if (event.code === 'KeyF' && this.screen === 'play') this.doPunch();
      if (event.code === 'KeyH' && this.screen === 'play' && this.inCar) this.sound.horn();
      if (event.code === 'KeyN' && this.screen === 'play' && !this.missions.active) {
        const next = this.missions.completed.length;
        if (next < MISSIONS.length) this.missions.start(next);
      }
    });
    window.addEventListener('keyup', (event) => { this.keys[event.code] = false; });
    canvas.addEventListener('mousedown', (event) => {
      this.dragging = true;
      this.lastMouse = { x: event.clientX, y: event.clientY };
      if (this.screen === 'play' && !this.inCar && event.button === 0) this.doShoot();
    });
    window.addEventListener('mousemove', (event) => {
      if (!this.dragging) return;
      this.cameraYaw -= (event.clientX - this.lastMouse.x) * 0.005;
      this.cameraPitch = Math.max(-0.1, Math.min(1.1, this.cameraPitch + (event.clientY - this.lastMouse.y) * 0.004));
      this.lastMouse = { x: event.clientX, y: event.clientY };
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    canvas.addEventListener('wheel', (event) => {
      this.cameraDist = Math.max(6, Math.min(20, this.cameraDist + Math.sign(event.deltaY)));
    }, { passive: true });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  toggleMute() {
    this.sound.ensure();
    this.sound.setMuted(!this.sound.muted);
    this.hud.toast(this.sound.muted ? 'Sound muted' : 'Sound on', 2);
  }

  startGame(useSave) {
    this.sound.ensure();
    this.sound.click();
    let data = null;
    if (useSave) data = loadGame();
    if (data) {
      this.cash = data.cash;
      this.player.reset(data.playerX, data.playerZ);
      this.player.health = data.health;
      this.day = data.day;
      this.minutes = data.minutes;
      this.missions.completed = data.completed || [];
      this.missions.index = -1;
      this.missions.active = false;
      this.hud.toast('Save loaded — welcome back to Coral Bay.', 4);
      if (data.missionIndex < MISSIONS.length && !this.missions.completed.includes(MISSIONS[data.missionIndex].id)) {
        this.missions.start(data.missionIndex);
      }
    } else {
      this.cash = 120;
      this.day = 1;
      this.minutes = 17 * 60 + 24;
      this.player.reset(0, 40);
      this.missions.completed = [];
      this.missions.index = -1;
      this.missions.active = false;
      this.missions.start(0);
      this.hud.toast('Dario "Daz" Moreno owes Vera $5,000. Time to work.', 6);
    }
    this.wanted.clear();
    this.police.removeAll();
    this.screen = 'play';
    this.hud.showScreen('play');
  }

  pause() {
    if (this.screen !== 'play') return;
    this.screen = 'pause';
    this.hud.showScreen('pause');
    this.saveNow(false);
  }

  resume() {
    if (this.screen !== 'pause') return;
    this.screen = 'play';
    this.hud.showScreen('play');
  }

  toTitle() {
    this.screen = 'title';
    this.hud.showContinue(hasSave());
    this.hud.showScreen('start');
  }

  respawn() {
    this.cash = Math.max(0, this.cash - 200);
    this.player.reset(145, -130);
    this.wanted.clear();
    this.police.removeAll();
    this.inCar = false;
    if (this.playerCar.mesh) this.playerCar.mesh.visible = false;
    this.playerCar.active = false;
    this.screen = 'play';
    this.hud.showScreen('play');
    this.hud.toast('You wake up at Vera\u2019s garage. Hospital fee: $200.', 4);
    if (this.missions.index >= 0 && !this.missions.completed.includes(MISSIONS[this.missions.index].id)) {
      this.missions.start(this.missions.index);
    }
  }

  gameOver(reason) {
    this.overReason = reason;
    this.screen = 'over';
    this.sound.fail();
    this.sound.setSiren(false);
    this.sound.setEngine(false, 0);
    this.hud.setOverTitle(reason === 'busted' ? 'BUSTED' : 'WASTED', reason === 'busted' ? 'The Coral Bay PD caught you.' : 'You didn\u2019t make it.');
    this.hud.showScreen('over');
  }

  saveNow(announce) {
    const ok = saveGame({
      cash: this.cash,
      missionIndex: this.missions.index < 0 ? this.missions.completed.length : this.missions.index,
      completed: this.missions.completed,
      playerX: this.player.x,
      playerZ: this.player.z,
      health: this.player.health,
      day: this.day,
      minutes: this.minutes,
    });
    if (announce) this.hud.toast(ok ? 'Game saved.' : 'Save failed — storage unavailable.', 3);
  }

  toggleCar() {
    if (this.inCar) {
      const exitX = this.playerCar.x + Math.sin(this.playerCar.heading + Math.PI / 2) * 3;
      const exitZ = this.playerCar.z + Math.cos(this.playerCar.heading + Math.PI / 2) * 3;
      this.spawnParkedCar(this.playerCar.kind, this.playerCar.color || 0xd94f3d, exitX, exitZ, false);
      this.playerCar.active = false;
      if (this.playerCar.mesh) this.playerCar.mesh.visible = false;
      this.player.x = exitX;
      this.player.z = exitZ;
      this.player.mesh.visible = true;
      this.inCar = false;
      this.sound.setEngine(false, 0);
      return;
    }
    const nearTraffic = this.traffic.nearestCar(this.player.x, this.player.z, 4.5);
    if (nearTraffic) {
      const color = nearTraffic.mesh.children[0].material.color.getHex();
      const kind = nearTraffic.mesh.userData.kind || 'sedan';
      this.traffic.removeCar(nearTraffic);
      this.enterCar(kind, color, nearTraffic.x, nearTraffic.z, nearTraffic.mesh.rotation.y);
      return;
    }
    let best = null;
    let bestDist = 4.5;
    for (const car of this.parkedCars) {
      const dist = Math.hypot(car.x - this.player.x, car.z - this.player.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    }
    if (best) {
      this.parkedCars.splice(this.parkedCars.indexOf(best), 1);
      this.scene.remove(best.mesh);
      this.enterCar(best.kind, best.color, best.x, best.z, best.mesh.rotation.y, best.missionCar);
    }
  }

  enterCar(kind, color, x, z, heading, missionCar) {
    this.playerCar.spawn(kind, color, x, z, heading);
    this.playerCar.stolen = true;
    this.player.mesh.visible = false;
    this.inCar = true;
    this.wanted.addStars(WANTED_RULES.stealCar, 'stolen car');
    this.hud.toast(missionCar ? 'The gold sedan is yours — lose the heat!' : 'Car taken! The PD noticed.', 3);
    this.missions.notify('steal');
    this.sound.click();
  }

  readInput() {
    if (this.scripted) return this.scripted;
    return {
      forward: !!(this.keys.KeyW || this.keys.ArrowUp),
      back: !!(this.keys.KeyS || this.keys.ArrowDown),
      left: !!(this.keys.KeyA || this.keys.ArrowLeft),
      right: !!(this.keys.KeyD || this.keys.ArrowRight),
      run: !!this.keys.ShiftLeft || !!this.keys.ShiftRight,
      jump: !!this.keys.Space,
      handbrake: !!this.keys.Space,
    };
  }

  doPunch() {
    if (!this.player.tryPunch()) return;
    this.sound.punch();
    const fx = Math.sin(this.player.heading);
    const fz = Math.cos(this.player.heading);
    const tryHit = (target, damage, onDown) => {
      const dx = target.x - this.player.x;
      const dz = target.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.4) return false;
      const dot = (dx * fx + dz * fz) / Math.max(dist, 0.01);
      if (dot < 0.3) return false;
      onDown(target, damage);
      return true;
    };
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (tryHit(enemy, 20, (t) => this.damageEnemy(t, 20))) return;
    }
    for (const officer of this.police.officers) {
      if (tryHit(officer, 15, () => {
        this.wanted.addStars(1, 'hit officer');
        this.hud.toast('You hit a cop! Wanted level up.', 3);
      })) return;
    }
    const walker = this.pedestrians.nearest(this.player.x, this.player.z, 2.4);
    if (walker) {
      this.pedestrians.scare(this.player.x, this.player.z, 12);
      this.wanted.addStars(WANTED_RULES.hitPedestrian, 'assault');
      this.hud.toast('Assault! Witnesses called the cops.', 3);
    }
  }

  doShoot() {
    if (this.screen !== 'play' || this.inCar) return;
    if (!this.player.tryShoot()) {
      if (this.player.ammo === 0) this.hud.toast('Out of ammo — press R to reload, or find an ammo box.', 3);
      return;
    }
    this.sound.shoot();
    this.lastCombatAt = this.time;
    if (this.wanted.stars === 0) this.wanted.addStars(1, 'shot fired');
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    raycaster.far = WEAPON.range;
    const targets = [];
    for (const enemy of this.enemies) if (!enemy.dead) targets.push(enemy.mesh);
    for (const officer of this.police.officers) targets.push(officer.mesh);
    for (const walker of this.pedestrians.walkers) targets.push(walker.mesh);
    const hits = raycaster.intersectObjects(targets, true);
    const from = new THREE.Vector3(this.player.x, this.player.y + 1.5, this.player.z);
    let end = raycaster.ray.at(WEAPON.range, new THREE.Vector3());
    if (hits.length > 0) {
      end = hits[0].point.clone();
      const hitMesh = hits[0].object;
      let owner = null;
      for (const enemy of this.enemies) if (enemy.mesh === hitMesh || enemy.mesh.children.includes(hitMesh)) owner = { type: 'enemy', ref: enemy };
      for (const officer of this.police.officers) if (officer.mesh === hitMesh || officer.mesh.children.includes(hitMesh)) owner = { type: 'officer', ref: officer };
      if (!owner) {
        for (const walker of this.pedestrians.walkers) {
          if (walker.mesh === hitMesh || walker.mesh.children.includes(hitMesh)) owner = { type: 'walker', ref: walker };
        }
      }
      if (owner && owner.type === 'enemy') this.damageEnemy(owner.ref, WEAPON.damage);
      if (owner && owner.type === 'officer') {
        this.wanted.addStars(WANTED_RULES.killOfficer, 'shot officer');
        this.hud.toast('You shot an officer! Wanted level up.', 3);
        this.police.officers.splice(this.police.officers.indexOf(owner.ref), 1);
        this.scene.remove(owner.ref.mesh);
      }
      if (owner && owner.type === 'walker') {
        this.pedestrians.scare(this.player.x, this.player.z, 30);
        this.wanted.addStars(WANTED_RULES.hitPedestrian, 'shot civilian');
      }
    }
    this.addTracer(from, end);
    this.pedestrians.scare(this.player.x, this.player.z, 25);
  }

  addTracer(from, to) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  damageEnemy(enemy, damage) {
    enemy.hp -= damage;
    this.lastCombatAt = this.time;
    if (enemy.hp > 0) return;
    enemy.dead = true;
    enemy.deadTimer = 2;
    enemy.mesh.rotation.x = -Math.PI / 2;
    enemy.mesh.position.y = 0.4;
    if (enemy.kind === 'rocco') {
      this.cash += 800;
      this.hud.toast('Rocco paid up — $800 collected!', 4);
      this.missions.notify('beat-done');
    } else {
      this.missions.notify('guard-down');
      this.hud.toast('Guard down.', 2);
    }
  }

  updateEnemies(dt) {
    for (const enemy of [...this.enemies]) {
      if (enemy.dead) {
        enemy.deadTimer -= dt;
        if (enemy.deadTimer <= 0) {
          this.scene.remove(enemy.mesh);
          this.enemies.splice(this.enemies.indexOf(enemy), 1);
        }
        continue;
      }
      const pos = this.effectivePos();
      const dx = pos.x - enemy.x;
      const dz = pos.z - enemy.z;
      const dist = Math.hypot(dx, dz);
      enemy.heading = Math.atan2(dx, dz);
      if (dist > 14) {
        const speed = 5;
        enemy.x += Math.sin(enemy.heading) * speed * dt;
        enemy.z += Math.cos(enemy.heading) * speed * dt;
      }
      enemy.walkPhase += dt * 4;
      enemy.mesh.position.set(enemy.x, 0, enemy.z);
      enemy.mesh.rotation.y = enemy.heading;
      enemy.mesh.userData.legs[0].rotation.x = Math.sin(enemy.walkPhase) * 0.4;
      enemy.mesh.userData.legs[1].rotation.x = -Math.sin(enemy.walkPhase) * 0.4;
      enemy.shootTimer -= dt;
      if (dist < 26 && enemy.shootTimer <= 0 && !this.inCar) {
        enemy.shootTimer = 1.6;
        const from = new THREE.Vector3(enemy.x, 1.5, enemy.z);
        const to = new THREE.Vector3(this.player.x, 1.2, this.player.z);
        this.addTracer(from, to);
        if (this.rng.chance(0.45)) {
          this.lastCombatAt = this.time;
          if (this.player.hurt(6)) this.gameOver('wasted');
        }
      }
    }
  }

  updatePickups(dt) {
    for (const pickup of this.pickups) {
      if (pickup.taken) {
        pickup.respawn -= dt;
        if (pickup.respawn <= 0) {
          pickup.taken = false;
          pickup.mesh.visible = true;
        }
        continue;
      }
      pickup.mesh.rotation.y += dt * 1.5;
      pickup.mesh.position.y = 1 + Math.sin(this.time * 2 + pickup.x) * 0.15;
      const dist = Math.hypot(this.player.x - pickup.x, this.player.z - pickup.z);
      if (dist < 2.2 && !this.inCar) {
        pickup.taken = true;
        pickup.mesh.visible = false;
        pickup.respawn = 25;
        this.sound.pickup();
        if (pickup.kind === 'health') {
          this.player.heal(40);
          this.hud.toast('Health +40', 2);
        } else if (pickup.kind === 'ammo') {
          this.player.reserve += 48;
          this.hud.toast('Ammo +48', 2);
        } else {
          this.cash += 50;
          this.hud.toast('Found $50', 2);
        }
      }
    }
  }

  updateTrafficCollision() {
    if (!this.inCar) return;
    for (const car of this.traffic.cars) {
      const dx = this.playerCar.x - car.x;
      const dz = this.playerCar.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4.4 && dist > 0.01) {
        const push = (4.4 - dist) / dist;
        this.playerCar.x += dx * push * 0.5;
        this.playerCar.z += dz * push * 0.5;
        if (Math.abs(this.playerCar.speed) > 6) {
          this.playerCar.speed *= 0.55;
          this.sound.crash();
          this.wanted.addStars(0, 'crash');
        }
      }
    }
    for (const cop of this.police.cars) {
      const dx = this.playerCar.x - cop.x;
      const dz = this.playerCar.z - cop.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4.4 && dist > 0.01) {
        const push = (4.4 - dist) / dist;
        this.playerCar.x += dx * push * 0.6;
        this.playerCar.z += dz * push * 0.6;
        this.playerCar.speed *= 0.6;
        this.sound.crash();
      }
    }
  }

  updateCamera(dt) {
    const target = this.inCar
      ? { x: this.playerCar.x, y: 1.5, z: this.playerCar.z }
      : { x: this.player.x, y: this.player.y + 1.8, z: this.player.z };
    const dist = this.inCar ? this.cameraDist + 3 : this.cameraDist;
    const height = dist * Math.sin(this.cameraPitch) + 2;
    const flat = dist * Math.cos(this.cameraPitch);
    const desired = new THREE.Vector3(
      target.x - Math.sin(this.cameraYaw) * flat,
      target.y + height,
      target.z - Math.cos(this.cameraYaw) * flat,
    );
    const alpha = Math.min(1, 6 * dt);
    this.camera.position.lerp(desired, alpha);
    this.camera.lookAt(target.x, target.y + 0.6, target.z);
  }

  updateSun() {
    const dayFrac = this.minutes / 1440;
    const angle = (dayFrac - 0.25) * Math.PI * 2;
    const elevation = Math.sin(angle);
    this.sun.position.set(Math.cos(angle) * 160, Math.max(30, elevation * 160 + 60), 80);
    const warmth = Math.max(0, 1 - Math.abs(elevation) * 1.4);
    const sky = new THREE.Color(0x87b5d6).lerp(new THREE.Color(0xf2c98f), warmth);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    this.sun.color.setHex(warmth > 0.5 ? 0xffe0b0 : 0xfff2dd);
  }

  clockText() {
    const h = Math.floor(this.minutes / 60) % 24;
    const m = Math.floor(this.minutes % 60);
    return `Day ${this.day} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  loop() {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const realDt = this.lastNow ? Math.min(0.1, Math.max(0, (now - this.lastNow) / 1000)) : 0.016;
    this.lastNow = now;
    this.frameCount += 1;
    this.fpsFrames += 1;
    if (now - this.fpsMark >= 1000) {
      this.fps = Math.round(this.fpsFrames * 1000 / Math.max(1, now - this.fpsMark));
      this.fpsFrames = 0;
      this.fpsMark = now;
    }
    if (this.screen === 'play') {
      this.update(realDt);
      // In screenshot mode the software renderer is slow, so advance the
      // world a few extra steps per frame to stage the scene in real time.
      if (this.shotMode) {
        for (let i = 0; i < 3; i += 1) this.update(realDt);
      }
    } else if (this.screen === 'title') {
      this.updateTitle(realDt);
    }
    this.renderer.render(this.scene, this.camera);
    if (this.shotMode && this.frameCount > 4) window.__shotReady = true;
  }

  updateTitle(dt) {
    this.time += dt;
    const angle = this.time * 0.05;
    this.camera.position.set(Math.sin(angle) * 130, 55, Math.cos(angle) * 130);
    this.camera.lookAt(0, 8, 0);
    this.traffic.update(dt, null);
    this.pedestrians.update(dt);
    this.seaMaterial.color.setHex(0x2e8fa3);
  }

  update(dt) {
    this.time += dt;
    this.minutes += dt * 1.2;
    if (this.minutes >= 1440) {
      this.minutes -= 1440;
      this.day += 1;
    }
    this.updateSun();
    this.seaMaterial.color.setHSL(0.52, 0.62, 0.42 + Math.sin(this.time * 0.5) * 0.03);
    const input = this.readInput();
    if (this.inCar) {
      const hitWall = this.playerCar.drive(dt, input);
      if (hitWall && Math.abs(this.playerCar.speed) > 8) this.sound.crash();
      this.sound.setEngine(true, Math.abs(this.playerCar.speed) / 34);
    } else {
      this.player.update(dt, input, this.cameraYaw, this.colliders);
      this.sound.setEngine(false, 0);
    }
    this.traffic.update(dt, this.inCar ? this.playerCar : null);
    this.pedestrians.update(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateTrafficCollision();
    // Wanted decay: hidden when no police unit is close.
    const pos = this.effectivePos();
    let nearestPolice = Infinity;
    for (const cop of this.police.cars) {
      nearestPolice = Math.min(nearestPolice, Math.hypot(cop.x - pos.x, cop.z - pos.z));
    }
    for (const officer of this.police.officers) {
      nearestPolice = Math.min(nearestPolice, Math.hypot(officer.x - pos.x, officer.z - pos.z));
    }
    const hidden = nearestPolice > 45;
    this.wanted.update(dt, hidden);
    this.police.update(
      dt, this.wanted.stars, pos.x, pos.z, this.inCar,
      (amount) => {
        this.lastCombatAt = this.time;
        if (this.player.hurt(amount)) this.gameOver('wasted');
      },
      () => this.gameOver('busted'),
    );
    this.sound.setSiren(this.wanted.stars > 0 && this.screen === 'play');
    // Slow health regen while the heat is off.
    if (this.wanted.stars === 0 && this.time - this.lastCombatAt > 6) this.player.heal(2 * dt);
    this.missions.update(dt, {
      playerX: pos.x,
      playerZ: pos.z,
      wanted: this.wanted.stars,
      setTimer: (value) => { this.timerValue = value; },
      setHint: (text) => { this.setHint(text); },
    });
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint = '';
    }
    for (const tracer of [...this.tracers]) {
      tracer.life -= dt;
      tracer.line.material.opacity = Math.max(0, tracer.life / 0.09);
      if (tracer.life <= 0) {
        this.scene.remove(tracer.line);
        this.tracers.splice(this.tracers.indexOf(tracer), 1);
      }
    }
    this.updateCamera(dt);
    this.hud.tickToast(dt);
    const missionStep = this.missions.currentStep();
    this.hud.update({
      cash: this.cash,
      health: this.player.health,
      wanted: this.wanted.stars,
      clock: this.clockText(),
      objective: this.missions.statusText(),
      timer: this.timerValue,
      missionLabel: this.missions.active ? `MISSION ${this.missions.index + 1}/5` : 'FREE ROAM',
      ammo: this.player.ammo,
      reserve: this.player.reserve,
      speed: this.playerCar.speed,
      inCar: this.inCar,
      hint: this.hint,
      time: this.time,
      playerX: pos.x,
      playerZ: pos.z,
      heading: this.inCar ? this.playerCar.heading : this.player.heading,
      traffic: this.traffic.cars,
      police: [
        ...this.police.cars.map((c) => ({ x: c.x, z: c.z, kind: 'car' })),
        ...this.police.officers.map((o) => ({ x: o.x, z: o.z, kind: 'officer' })),
      ],
      missionTarget: missionStep && missionStep.kind === 'goto' ? missionStep.at : null,
    });
    this.hud.drawMinimap({
      time: this.time,
      playerX: pos.x,
      playerZ: pos.z,
      heading: this.inCar ? this.playerCar.heading : this.player.heading,
      traffic: this.traffic.cars,
      police: [
        ...this.police.cars.map((c) => ({ x: c.x, z: c.z, kind: 'car' })),
        ...this.police.officers.map((o) => ({ x: o.x, z: o.z, kind: 'officer' })),
      ],
      missionTarget: missionStep && missionStep.kind === 'goto' ? missionStep.at : null,
    });
  }

  setHint(text) {
    this.hint = text;
    this.hintTimer = 3;
  }

  // Where the player is right now: the car when driving, the walker otherwise.
  effectivePos() {
    return this.inCar ? { x: this.playerCar.x, z: this.playerCar.z } : { x: this.player.x, z: this.player.z };
  }

  state() {
    return {
      screen: this.screen,
      cash: this.cash,
      health: Math.round(this.player.health),
      wanted: this.wanted.stars,
      missionIndex: this.missions.index,
      missionActive: this.missions.active,
      completed: [...this.missions.completed],
      inCar: this.inCar,
      playerX: Math.round(this.effectivePos().x),
      playerZ: Math.round(this.effectivePos().z),
      traffic: this.traffic.cars.length,
      pedestrians: this.pedestrians.walkers.length,
      enemies: this.enemies.length,
      policeCars: this.police.cars.length,
      officers: this.police.officers.length,
      fps: Math.round(this.fps),
      errors: [...this.errors],
      ammo: this.player.ammo,
    };
  }
}

window.__game = new Game();
