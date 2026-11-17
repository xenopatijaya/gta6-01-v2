// Coral Bay city: a sun-soaked 7-avenue grid with a beach, a harbor, a market
// square and Vera's garage. Everything is procedural boxes, planes and canvas
// textures — no image files, no copied map. Builds the meshes and the collision
// boxes the rest of the game drives against.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

const LINES = [-174, -116, -58, 0, 58, 116, 174];
const BLOCK_CENTERS = [-145, -87, -29, 29, 87, 145];

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function windowsTexture(base, lit) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const on = (row * 5 + col * 3) % 4 !== 0;
        ctx.fillStyle = on ? lit : '#2c3542';
        ctx.fillRect(10 + col * 23, 12 + row * 24, 15, 15);
      }
    }
  });
}

function roadTexture() {
  return canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f5d76e';
    ctx.fillRect(w / 2 - 2, 0, 4, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(4, 0, 2, h);
    ctx.fillRect(w - 6, 0, 2, h);
    ctx.fillStyle = '#3a3f46';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 2, y, 4, 32);
    ctx.fillStyle = '#f5d76e';
    for (let y = 32; y < h; y += 64) ctx.fillRect(w / 2 - 2, y, 4, 32);
  });
}

function signTexture(text, bg, fg) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = 'bold 56px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
  });
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const addCollider = (x, z, hw, hd) => colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });

  // Ground, beach and sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 20);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 46),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 233);
  sand.receiveShadow = true;
  group.add(sand);

  const seaMaterial = new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(560, 200), seaMaterial);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, 356);
  group.add(sea);

  // Roads: asphalt strips with a painted centre line, one per avenue.
  const roadTex = roadTexture();
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 14);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const line of LINES) {
    const along = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, 430), roadMat);
    along.rotation.x = -Math.PI / 2;
    along.position.set(line, 0.04, 0);
    along.receiveShadow = true;
    group.add(along);
    const across = new THREE.Mesh(new THREE.PlaneGeometry(430, CITY.road), roadMat.clone());
    across.material.map = roadTex;
    across.rotation.x = -Math.PI / 2;
    across.rotation.z = Math.PI / 2;
    across.position.set(0, 0.04, line);
    across.receiveShadow = true;
    group.add(across);
  }

  // Sidewalk slabs: one raised pad per block.
  const slabMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const slabGeo = new THREE.BoxGeometry(CITY.block, 0.3, CITY.block);
  for (const cx of BLOCK_CENTERS) {
    for (const cz of BLOCK_CENTERS) {
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(cx, 0.1, cz);
      slab.receiveShadow = true;
      group.add(slab);
    }
  }

  // Buildings: pastel towers with lit windows, 1-4 per block.
  const winTex = windowsTexture('#f6e3c8', '#ffd98a');
  winTex.wrapS = THREE.RepeatWrapping;
  winTex.wrapT = THREE.RepeatWrapping;
  for (const cx of BLOCK_CENTERS) {
    for (const cz of BLOCK_CENTERS) {
      if (cx === 0 && cz === 0) continue; // market square stays open
      if (cx === 145 && cz === -145) continue; // Vera's garage lot
      const count = rng.int(1, 3);
      const spots = count === 1 ? [[0, 0, 30, 30]] : count === 2 ? [[-10, 0, 16, 26], [11, 0, 14, 26]] : [[-11, -11, 15, 15], [11, -11, 15, 15], [0, 11, 26, 14]];
      for (const [ox, oz, w, d] of spots) {
        const height = rng.range(9, 38);
        const color = rng.pick(PALETTE.building);
        const mat = new THREE.MeshLambertMaterial({ color, map: winTex });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), mat);
        building.position.set(cx + ox, 0.25 + height / 2, cz + oz);
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.5, 1.2, d * 0.5),
          new THREE.MeshLambertMaterial({ color: 0x8a8f96 }),
        );
        roof.position.set(cx + ox, 0.25 + height + 0.6, cz + oz);
        group.add(roof);
        addCollider(cx + ox, cz + oz, w / 2 + 0.3, d / 2 + 0.3);
      }
    }
  }

  // Vera's garage: low workshop + big sign, at the north-east corner lot.
  const garageMat = new THREE.MeshLambertMaterial({ color: 0xd97b6c, map: winTex });
  const garage = new THREE.Mesh(new THREE.BoxGeometry(34, 9, 22), garageMat);
  garage.position.set(145, 4.75, -145);
  garage.castShadow = true;
  group.add(garage);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 7.5),
    new THREE.MeshBasicMaterial({ map: signTexture("VERA'S GARAGE", '#22262e', '#ffd76e') }),
  );
  sign.position.set(145, 11.5, -133.4);
  group.add(sign);
  addCollider(145, -145, 17.5, 11.5);

  // Market square at the centre: stalls with striped canopies and a fountain.
  const stallColors = [0xe86a5a, 0x4da3a0, 0xf2b134, 0x7d9bdc];
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.cos(angle) * 13;
    const z = Math.sin(angle) * 13;
    const stall = new THREE.Mesh(
      new THREE.BoxGeometry(5, 2.4, 4),
      new THREE.MeshLambertMaterial({ color: stallColors[i % stallColors.length] }),
    );
    stall.position.set(x, 1.45, z);
    stall.castShadow = true;
    group.add(stall);
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.4, 5),
      new THREE.MeshLambertMaterial({ color: 0xfff3d6 }),
    );
    canopy.position.set(x, 3, z);
    group.add(canopy);
    addCollider(x, z, 2.8, 2.3);
  }
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.5, 1.1, 20),
    new THREE.MeshLambertMaterial({ color: 0xcfd8dc }),
  );
  fountain.position.set(0, 0.8, 0);
  group.add(fountain);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 0.3, 20),
    new THREE.MeshLambertMaterial({ color: 0x4db6d6 }),
  );
  water.position.set(0, 1.3, 0);
  group.add(water);
  addCollider(0, 0, 5.5, 5.5);

  // Palms along the beach and the main avenue, lamps at intersections.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palm });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
  const leafGeo = new THREE.ConeGeometry(2.6, 3.2, 7);
  for (let i = 0; i < 26; i += 1) {
    const onBeach = i < 14;
    const x = onBeach ? -190 + i * 30 + rng.range(-4, 4) : rng.pick(LINES);
    const z = onBeach ? 214 + rng.range(-2, 4) : rng.pick(LINES) + (rng.chance(0.5) ? 9 : -9);
    if (Math.abs(x) > 205 || Math.abs(z) > 205) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.2, z);
    trunk.castShadow = true;
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 7.4, z);
    leaves.castShadow = true;
    group.add(leaves);
    addCollider(x, z, 0.5, 0.5);
  }
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c313a });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of LINES) {
    for (const z of LINES) {
      if ((x + z) % 116 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6), lampMat);
      pole.position.set(x + 8.4, 2.7, z + 8.4);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bulbMat);
      bulb.position.set(x + 8.4, 5.5, z + 8.4);
      group.add(bulb);
    }
  }

  // Harbor: containers and crates on the east edge.
  const containerColors = [0xc75b4f, 0x4f7dc7, 0x5aa469, 0xe0a83c];
  for (let i = 0; i < 10; i += 1) {
    const x = 188 + rng.range(-4, 6);
    const z = 120 + i * 11 + rng.range(-3, 3);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(7, 3, 3.4),
      new THREE.MeshLambertMaterial({ color: containerColors[i % containerColors.length] }),
    );
    box.position.set(x, 1.75, z);
    box.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    box.castShadow = true;
    group.add(box);
    addCollider(x, z, 3.8, 3.8);
  }

  // Beach umbrellas.
  for (let i = 0; i < 8; i += 1) {
    const x = -170 + i * 48 + rng.range(-6, 6);
    const z = 222 + rng.range(-2, 5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), lampMat);
    pole.position.set(x, 1.3, z);
    group.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 1.1, 8),
      new THREE.MeshLambertMaterial({ color: stallColors[i % stallColors.length] }),
    );
    top.position.set(x, 3, z);
    group.add(top);
  }

  return { colliders, group, seaMaterial, intersections: LINES };
}

export function collideCircle(colliders, x, z, radius) {
  for (const c of colliders) {
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
      const pushLeft = x + radius - c.minX;
      const pushRight = c.maxX - (x - radius);
      const pushTop = z + radius - c.minZ;
      const pushBottom = c.maxZ - (z - radius);
      const min = Math.min(pushLeft, pushRight, pushTop, pushBottom);
      if (min === pushLeft) return { x: c.minX - radius, z, hit: true };
      if (min === pushRight) return { x: c.maxX + radius, z, hit: true };
      if (min === pushTop) return { x, z: c.minZ - radius, hit: true };
      return { x, z: c.maxZ + radius, hit: true };
    }
  }
  return { x, z, hit: false };
}

export function clampToCity(x, z) {
  return {
    x: Math.max(-208, Math.min(208, x)),
    z: Math.max(-208, Math.min(232, z)),
  };
}
