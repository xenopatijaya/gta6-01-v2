// Vehicles: boxy low-poly car models built from primitives, arcade driving
// physics for the player's car, and a traffic manager that cruises the road
// grid, turns at intersections and brakes for the car ahead.
import * as THREE from 'three';
import { CAR_TUNING, CITY } from './config.js';
import { collideCircle, clampToCity } from './city.js';

const CAR_COLORS = [0xd94f3d, 0x3d7dd9, 0xe8c33a, 0x7bc47f, 0xe8e4da, 0x8a6fb8, 0x5a5f66, 0xef8b3a];

export function makeCarModel(color, kind) {
  const group = new THREE.Group();
  group.userData.kind = kind;
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c2126 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.65, 2.2),
    kind === 'taxi' ? paint : dark,
  );
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), lightMat);
    head.position.set(x, 0.7, 2.22);
    group.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.18, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    );
    tail.position.set(x, 0.7, -2.22);
    group.add(tail);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, 1.8, -0.2);
    group.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.72, -0.2);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(0.45, 1.72, -0.2);
    group.add(bar2);
  }
  if (kind === 'sport') {
    body.scale.y = 0.8;
    body.position.y = 0.55;
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.4), dark);
    spoiler.position.set(0, 1.05, -2.1);
    group.add(spoiler);
  }
  group.userData.wheels = wheels;
  return group;
}

export function carColorFor(index) {
  return CAR_COLORS[index % CAR_COLORS.length];
}

export class PlayerCar {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.mesh = null;
    this.active = false;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.kind = 'sedan';
    this.stolen = false;
    this.speedCap = 0;
  }

  spawn(kind, color, x, z, heading) {
    if (this.mesh) this.scene.remove(this.mesh);
    this.mesh = makeCarModel(color, kind);
    this.scene.add(this.mesh);
    this.kind = kind;
    this.color = color;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.speedCap = 0;
    this.active = true;
    this.sync();
  }

  sync() {
    if (!this.mesh) return;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016;
    for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += spin;
  }

  drive(dt, input) {
    if (!this.active) return;
    const forward = input.forward ? 1 : 0;
    const back = input.back ? 1 : 0;
    const accel = forward ? CAR_TUNING.accel : back ? -CAR_TUNING.reverseAccel : 0;
    this.speed += accel * dt;
    if (input.handbrake) this.speed *= Math.max(0, 1 - 3.2 * dt);
    this.speed -= this.speed * CAR_TUNING.drag * dt;
    if (!forward && !back && Math.abs(this.speed) < 0.4) this.speed = 0;
    const maxSpeed = this.speedCap > 0 ? this.speedCap : CAR_TUNING.maxSpeed;
    this.speed = Math.max(-CAR_TUNING.maxReverse, Math.min(maxSpeed, this.speed));
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerAmount = steerInput * CAR_TUNING.steer * dt * Math.min(1, Math.abs(this.speed) / 6) * (this.speed < 0 ? -1 : 1);
    this.heading += steerAmount;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const clamped = clampToCity(nx, nz);
    const hit = collideCircle(this.colliders, clamped.x, clamped.z, 2.1);
    if (hit.hit) this.speed *= 0.45;
    this.x = hit.x;
    this.z = hit.z;
    this.sync();
    return hit.hit;
  }
}

const LANES = [-174, -116, -58, 0, 58, 116, 174];

export class TrafficManager {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
  }

  spawn(count) {
    for (let i = 0; i < count; i += 1) this.addCar();
  }

  addCar() {
    const axis = this.rng.chance(0.5) ? 'x' : 'z';
    const line = this.rng.pick(LANES);
    const along = this.rng.range(-190, 190);
    const dir = this.rng.chance(0.5) ? 1 : -1;
    const kind = this.rng.chance(0.12) ? 'taxi' : this.rng.chance(0.12) ? 'sport' : 'sedan';
    const color = kind === 'taxi' ? 0xf2c230 : carColorFor(this.cars.length + this.rng.int(0, 7));
    const mesh = makeCarModel(color, kind);
    this.scene.add(mesh);
    const car = {
      mesh, axis, line, along, dir,
      speed: this.rng.range(7, 12),
      baseSpeed: 0,
      offset: dir > 0 ? 3.5 : -3.5,
    };
    car.baseSpeed = car.speed;
    this.cars.push(car);
    this.syncCar(car);
    return car;
  }

  syncCar(car) {
    const x = car.axis === 'x' ? car.along : car.line + car.offset;
    const z = car.axis === 'x' ? car.line + car.offset : car.along;
    car.mesh.position.set(x, 0, z);
    let heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.mesh.rotation.y = heading;
    car.x = x;
    car.z = z;
  }

  carAhead(car) {
    for (const other of this.cars) {
      if (other === car || other.axis !== car.axis || other.line !== car.line || other.dir !== car.dir) continue;
      const gap = (other.along - car.along) * car.dir;
      if (gap > 0 && gap < 10) return true;
    }
    return false;
  }

  update(dt, playerCar) {
    for (const car of this.cars) {
      let target = car.baseSpeed;
      if (this.carAhead(car)) target = 0;
      if (playerCar && playerCar.active) {
        const dx = playerCar.x - car.x;
        const dz = playerCar.z - car.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 9) {
          const ahead = car.axis === 'x'
            ? Math.sign(dx) === car.dir && Math.abs(dz) < 4
            : Math.sign(dz) === car.dir && Math.abs(dx) < 4;
          if (ahead) target = 0;
        }
      }
      car.speed += (target - car.speed) * Math.min(1, 2.5 * dt);
      car.along += car.dir * car.speed * dt;
      if (car.along > 196 || car.along < -196) {
        // Turn at the far end: pick a new avenue and direction.
        const newAxis = car.axis === 'x' ? 'z' : 'x';
        const newLine = this.rng.pick(LANES);
        car.axis = newAxis;
        car.line = newLine;
        car.along = car.dir > 0 ? -196 : 196;
        car.dir = this.rng.chance(0.5) ? 1 : -1;
        car.offset = car.dir > 0 ? 3.5 : -3.5;
      } else {
        // At an intersection, sometimes turn onto the crossing avenue.
        const nearest = LANES.reduce((best, line) => (Math.abs(line - car.along) < Math.abs(best - car.along) ? line : best), LANES[0]);
        if (Math.abs(nearest - car.along) < 0.6 && this.rng.chance(0.012)) {
          const oldAxis = car.axis;
          const oldLine = car.line;
          car.axis = oldAxis === 'x' ? 'z' : 'x';
          car.line = nearest;
          car.along = oldLine;
          car.dir = this.rng.chance(0.5) ? 1 : -1;
          car.offset = car.dir > 0 ? 3.5 : -3.5;
        }
      }
      this.syncCar(car);
    }
  }

  nearestCar(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of this.cars) {
      const dist = Math.hypot(car.x - x, car.z - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    }
    return best;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    this.cars.splice(this.cars.indexOf(car), 1);
  }
}
