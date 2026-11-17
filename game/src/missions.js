// Missions: Vera Solano's five-job story arc for Dario "Daz" Moreno —
// borrow wheels, run a package, collect a debt, shake the heat, and pull the
// harbor heist. A state machine with a 3D beacon marking each objective.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export class MissionManager {
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks;
    this.index = -1;
    this.stepIndex = 0;
    this.active = false;
    this.completed = [];
    this.stepTimer = 0;
    this.fightLeft = 0;
    this.beacon = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd76e }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    this.beacon.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.6, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    );
    beam.position.y = 21;
    this.beacon.add(beam);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.4),
      new THREE.MeshBasicMaterial({ color: 0xffd76e }),
    );
    diamond.position.y = 6;
    this.beacon.add(diamond);
    this.beacon.userData.diamond = diamond;
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.beaconTime = 0;
  }

  current() {
    return this.index >= 0 && this.index < MISSIONS.length ? MISSIONS[this.index] : null;
  }

  currentStep() {
    const mission = this.current();
    return mission ? mission.steps[this.stepIndex] : null;
  }

  start(index) {
    this.index = index;
    this.stepIndex = 0;
    this.active = true;
    this.stepTimer = 0;
    const mission = MISSIONS[index];
    this.hooks.message(`New mission: ${mission.title} — ${mission.brief}`);
    this.hooks.onMissionStart(mission);
    this.enterStep();
  }

  enterStep() {
    const step = this.currentStep();
    if (!step) return;
    this.stepTimer = 0;
    if (step.kind === 'beat') this.hooks.spawnThug([0, 58], 'rocco');
    if (step.kind === 'fight') {
      this.fightLeft = step.count;
      for (let i = 0; i < step.count; i += 1) {
        this.hooks.spawnThug([174 + (i - 1) * 9, 150 + (i % 2) * 10], 'guard');
      }
    }
    if (step.kind === 'heat') this.hooks.setWanted(step.stars);
    if (step.kind === 'steal' && this.current().id === 'harbor-heist') this.hooks.spawnGoldCar([174, 150]);
    this.updateBeacon();
  }

  updateBeacon() {
    const step = this.currentStep();
    if (step && step.kind === 'goto') {
      this.beacon.position.set(step.at[0], 0, step.at[1]);
      this.beacon.visible = true;
    } else {
      this.beacon.visible = false;
    }
  }

  advance() {
    this.stepIndex += 1;
    const mission = this.current();
    if (this.stepIndex >= mission.steps.length) {
      this.completeMission();
      return;
    }
    const step = this.currentStep();
    this.hooks.message(step.text);
    this.enterStep();
  }

  completeMission() {
    const mission = this.current();
    this.active = false;
    this.completed.push(mission.id);
    this.beacon.visible = false;
    this.hooks.onMissionComplete(mission);
    if (this.index + 1 < MISSIONS.length) {
      this.start(this.index + 1);
    } else {
      this.hooks.onStoryComplete();
    }
  }

  failMission(reason) {
    this.hooks.onMissionFailed(reason);
    this.start(this.index);
  }

  notify(event, data) {
    if (!this.active) return;
    const step = this.currentStep();
    if (!step) return;
    if (event === 'steal' && step.kind === 'steal') this.advance();
    if (event === 'beat-done' && step.kind === 'beat') this.advance();
    if (event === 'guard-down' && step.kind === 'fight') {
      this.fightLeft -= 1;
      if (this.fightLeft <= 0) this.advance();
    }
  }

  update(dt, world) {
    if (!this.active) return;
    const step = this.currentStep();
    if (!step) return;
    this.beaconTime += dt;
    if (this.beacon.visible) {
      this.beacon.userData.diamond.position.y = 6 + Math.sin(this.beaconTime * 2.4) * 0.9;
      this.beacon.rotation.y += dt * 0.8;
    }
    if (step.kind === 'goto') {
      const dx = world.playerX - step.at[0];
      const dz = world.playerZ - step.at[1];
      const dist = Math.hypot(dx, dz);
      if (step.timeLimit) {
        this.stepTimer += dt;
        const left = Math.max(0, Math.ceil(step.timeLimit - this.stepTimer));
        world.setTimer(left);
        if (this.stepTimer >= step.timeLimit) {
          this.failMission('Out of time — the package run failed.');
          return;
        }
      }
      if (dist < 8) {
        if (this.current().id === 'heat-wave' && world.wanted > 0) {
          world.setHint('Lose the cops first — hide until the stars are gone!');
          return;
        }
        world.setTimer(0);
        this.advance();
      }
      return;
    }
    if (step.kind === 'heat') {
      this.stepTimer += dt;
      if (this.stepTimer >= 30) this.advance();
    }
  }

  statusText() {
    if (!this.active) return 'No active mission — talk to Vera (press N for the next job).';
    const mission = this.current();
    const step = this.currentStep();
    return `${mission.title}: ${step ? step.text : ''}`;
  }
}
