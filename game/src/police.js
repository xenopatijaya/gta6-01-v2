// Wanted level and the Coral Bay PD: stars rise with crimes, decay when the
// player lays low, and police cars and officers hunt the player until the
// heat is gone. Getting caught with no health left means BUSTED.
import * as THREE from 'three';
import { WANTED_RULES } from './config.js';
import { makeCarModel } from './vehicles.js';
import { makePersonModel } from './people.js';

export class WantedSystem {
  constructor() {
    this.stars = 0;
    this.decayTimer = 0;
    this.lastCrimeAt = -999;
    this.time = 0;
  }

  addStars(count, reason) {
    this.stars = Math.min(WANTED_RULES.maxStars, this.stars + count);
    this.decayTimer = 0;
    this.lastCrimeAt = this.time;
    return reason;
  }

  update(dt, hidden) {
    this.time += dt;
    if (this.stars === 0) return;
    if (hidden) {
      this.decayTimer += dt;
      if (this.decayTimer >= WANTED_RULES.decaySeconds) {
        this.stars -= 1;
        this.decayTimer = 0;
      }
    } else {
      this.decayTimer = 0;
    }
  }

  clear() {
    this.stars = 0;
    this.decayTimer = 0;
  }
}

export class PoliceManager {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
    this.officers = [];
    this.bustTimer = 0;
    this.chaseTarget = { x: 0, z: 0 };
  }

  desiredCounts(stars) {
    return { cars: Math.min(stars, 3), officers: stars >= 2 ? Math.min(stars - 1, 3) : 0 };
  }

  spawnCar(x, z) {
    const mesh = makeCarModel(0xf2f2f2, 'police');
    this.scene.add(mesh);
    const car = { mesh, x, z, heading: 0, speed: 0 };
    this.cars.push(car);
    return car;
  }

  spawnOfficer(x, z) {
    const mesh = makePersonModel(0x22344d, 0xf2c9a0);
    this.scene.add(mesh);
    const officer = { mesh, x, z, heading: 0, shootTimer: 1, punchTimer: 0, walkPhase: 0 };
    this.officers.push(officer);
    return officer;
  }

  removeAll() {
    for (const car of this.cars) this.scene.remove(car.mesh);
    for (const officer of this.officers) this.scene.remove(officer.mesh);
    this.cars = [];
    this.officers = [];
    this.bustTimer = 0;
  }

  update(dt, stars, playerX, playerZ, playerInCar, onPlayerHit, onBusted) {
    const want = this.desiredCounts(stars);
    while (this.cars.length < want.cars) {
      const angle = this.rng.range(0, Math.PI * 2);
      this.spawnCar(playerX + Math.sin(angle) * 45, playerZ + Math.cos(angle) * 45);
    }
    while (this.cars.length > want.cars) {
      const car = this.cars.pop();
      this.scene.remove(car.mesh);
    }
    while (this.officers.length < want.officers) {
      const angle = this.rng.range(0, Math.PI * 2);
      this.spawnOfficer(playerX + Math.sin(angle) * 18, playerZ + Math.cos(angle) * 18);
    }
    while (this.officers.length > want.officers) {
      const officer = this.officers.pop();
      this.scene.remove(officer.mesh);
    }
    this.chaseTarget = { x: playerX, z: playerZ };
    for (const car of this.cars) {
      const dx = playerX - car.x;
      const dz = playerZ - car.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const targetSpeed = dist > 6 ? 26 : 12;
      car.speed += (targetSpeed - car.speed) * Math.min(1, 1.6 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.x = Math.max(-208, Math.min(208, car.x));
      car.z = Math.max(-208, Math.min(208, car.z));
      // Hold a visible tail instead of piling onto the player's car.
      const gap = Math.hypot(playerX - car.x, playerZ - car.z);
      if (gap < 5 && gap > 0.01) {
        car.x = playerX + (car.x - playerX) / gap * 5;
        car.z = playerZ + (car.z - playerZ) / gap * 5;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      if (dist < 3.4 && !playerInCar) {
        onPlayerHit(14 * dt, 'rammed');
      }
    }
    let officerNear = false;
    for (const officer of this.officers) {
      const dx = playerX - officer.x;
      const dz = playerZ - officer.z;
      const dist = Math.hypot(dx, dz);
      officer.heading = Math.atan2(dx, dz);
      const speed = dist > 2 ? 6.5 : 0;
      officer.x += Math.sin(officer.heading) * speed * dt;
      officer.z += Math.cos(officer.heading) * speed * dt;
      officer.walkPhase += dt * speed * 2;
      officer.mesh.position.set(officer.x, 0, officer.z);
      officer.mesh.rotation.y = officer.heading;
      officer.mesh.userData.legs[0].rotation.x = Math.sin(officer.walkPhase) * 0.5;
      officer.mesh.userData.legs[1].rotation.x = -Math.sin(officer.walkPhase) * 0.5;
      officer.shootTimer -= dt;
      if (dist < 26 && officer.shootTimer <= 0 && !playerInCar) {
        officer.shootTimer = 1.4;
        if (this.rng.chance(0.55)) onPlayerHit(7, 'shot');
      }
      if (dist < 1.8 && !playerInCar) {
        officerNear = true;
        officer.punchTimer -= dt;
        if (officer.punchTimer <= 0) {
          officer.punchTimer = 0.9;
          onPlayerHit(9, 'punched');
        }
      }
    }
    if (stars > 0 && officerNear && !playerInCar) {
      this.bustTimer += dt;
      if (this.bustTimer >= WANTED_RULES.bustSeconds) {
        this.bustTimer = 0;
        onBusted();
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
  }
}
