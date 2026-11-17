// Pedestrians: Coral Bay locals strolling the sidewalks, who scatter when a
// gun goes off or a car bears down on them. Simple wander + flee steering.
import * as THREE from 'three';
import { CITY } from './config.js';

const SHIRT_COLORS = [0xe86a5a, 0x4da3a0, 0xf2b134, 0x7d9bdc, 0xe8e4da, 0x9b7dc7, 0x5aa469, 0xd97b6c];

export function makePersonModel(shirtColor, skinColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), shirt);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), skin);
  head.position.y = 1.82;
  head.castShadow = true;
  group.add(head);
  const legs = [];
  for (const x of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
    leg.position.set(x, 0.36, 0);
    leg.geometry.translate(0, -0.36, 0);
    leg.position.y = 0.72;
    group.add(leg);
    legs.push(leg);
  }
  group.userData.legs = legs;
  return group;
}

const SIDEWALKS = [-174, -116, -58, 0, 58, 116, 174];

export class PedestrianManager {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.walkers = [];
  }

  spawn(count) {
    for (let i = 0; i < count; i += 1) {
      const mesh = makePersonModel(
        SHIRT_COLORS[i % SHIRT_COLORS.length],
        [0xf2c9a0, 0xc98d5f, 0x8a5a3b, 0xf7d7b5][i % 4],
      );
      this.scene.add(mesh);
      const alongRoad = this.rng.chance(0.5);
      const line = this.rng.pick(SIDEWALKS);
      const walker = {
        mesh,
        x: alongRoad ? this.rng.range(-190, 190) : line + this.rng.pick([-10, 10]),
        z: alongRoad ? line + this.rng.pick([-10, 10]) : this.rng.range(-190, 190),
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.1, 2.2),
        targetX: 0,
        targetZ: 0,
        fleeing: 0,
        walkPhase: this.rng.range(0, 6),
      };
      this.pickTarget(walker);
      this.walkers.push(walker);
    }
  }

  pickTarget(walker) {
    const line = this.rng.pick(SIDEWALKS);
    if (this.rng.chance(0.5)) {
      walker.targetX = this.rng.range(-190, 190);
      walker.targetZ = line + this.rng.pick([-10, 10]);
    } else {
      walker.targetX = line + this.rng.pick([-10, 10]);
      walker.targetZ = this.rng.range(-190, 190);
    }
  }

  scare(x, z, radius) {
    for (const walker of this.walkers) {
      const dist = Math.hypot(walker.x - x, walker.z - z);
      if (dist < radius) {
        walker.fleeing = 2.5;
        const away = Math.atan2(walker.x - x, walker.z - z);
        walker.targetX = walker.x + Math.sin(away) * 40;
        walker.targetZ = walker.z + Math.cos(away) * 40;
      }
    }
  }

  update(dt) {
    for (const walker of this.walkers) {
      const dx = walker.targetX - walker.x;
      const dz = walker.targetZ - walker.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        if (walker.fleeing > 0) {
          walker.fleeing = 0;
          this.pickTarget(walker);
        } else {
          this.pickTarget(walker);
        }
        continue;
      }
      const wanted = Math.atan2(dx, dz);
      let diff = wanted - walker.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      walker.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
      const speed = walker.fleeing > 0 ? walker.speed * 2.6 : walker.speed;
      walker.fleeing = Math.max(0, walker.fleeing - dt);
      walker.x += Math.sin(walker.heading) * speed * dt;
      walker.z += Math.cos(walker.heading) * speed * dt;
      walker.x = Math.max(-205, Math.min(205, walker.x));
      walker.z = Math.max(-205, Math.min(205, walker.z));
      walker.walkPhase += dt * speed * 4;
      walker.mesh.position.set(walker.x, 0, walker.z);
      walker.mesh.rotation.y = walker.heading;
      const swing = Math.sin(walker.walkPhase) * 0.5;
      walker.mesh.userData.legs[0].rotation.x = swing;
      walker.mesh.userData.legs[1].rotation.x = -swing;
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const walker of this.walkers) {
      const dist = Math.hypot(walker.x - x, walker.z - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = walker;
      }
    }
    return best;
  }
}
