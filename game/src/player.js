// The player on foot: camera-relative movement, jumping, punching and the
// pistol. Driving lives in vehicles.js; this class only walks Coral Bay.
import { PLAYER_TUNING, WEAPON } from './config.js';
import { collideCircle, clampToCity } from './city.js';
import { makePersonModel } from './people.js';

export class PlayerController {
  constructor(scene) {
    this.scene = scene;
    this.mesh = makePersonModel(0x2e6fb0, 0xf2c9a0);
    this.mesh.scale.set(1.05, 1.05, 1.05);
    scene.add(this.mesh);
    this.x = 0;
    this.y = 0;
    this.z = 40;
    this.heading = Math.PI;
    this.velX = 0;
    this.velZ = 0;
    this.velY = 0;
    this.onGround = true;
    this.health = PLAYER_TUNING.maxHealth;
    this.ammo = WEAPON.magSize;
    this.reserve = WEAPON.reserveStart;
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.reloadTimer = 0;
    this.walkPhase = 0;
    this.moving = false;
  }

  reset(x, z) {
    this.x = x;
    this.z = z;
    this.y = 0;
    this.velX = 0;
    this.velZ = 0;
    this.velY = 0;
    this.health = PLAYER_TUNING.maxHealth;
    this.ammo = WEAPON.magSize;
    this.reserve = WEAPON.reserveStart;
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
  }

  update(dt, input, cameraYaw, colliders) {
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.shootTimer = Math.max(0, this.shootTimer - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0 && this.reserve > 0) {
        const need = WEAPON.magSize - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
      }
    }
    const forward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const speed = input.run ? PLAYER_TUNING.runSpeed : PLAYER_TUNING.walkSpeed;
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const wishX = (sin * forward + cos * strafe) * speed;
    const wishZ = (cos * forward - sin * strafe) * speed;
    const accel = PLAYER_TUNING.accel;
    this.velX += (wishX - this.velX) * Math.min(1, accel * dt / speed);
    this.velZ += (wishZ - this.velZ) * Math.min(1, accel * dt / speed);
    this.moving = Math.hypot(this.velX, this.velZ) > 0.8;
    if (this.moving) {
      this.heading = Math.atan2(this.velX, this.velZ);
      this.walkPhase += dt * Math.hypot(this.velX, this.velZ) * 1.4;
    }
    let nx = this.x + this.velX * dt;
    let nz = this.z + this.velZ * dt;
    const clamped = clampToCity(nx, nz);
    nx = clamped.x;
    nz = clamped.z;
    const hit = collideCircle(colliders, nx, nz, PLAYER_TUNING.radius);
    this.x = hit.x;
    this.z = hit.z;
    if (input.jump && this.onGround) {
      this.velY = PLAYER_TUNING.jumpSpeed;
      this.onGround = false;
    }
    this.velY -= PLAYER_TUNING.gravity * dt;
    this.y += this.velY * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.velY = 0;
      this.onGround = true;
    }
    this.sync();
  }

  tryPunch() {
    if (this.punchTimer > 0) return false;
    this.punchTimer = PLAYER_TUNING.punchCooldown;
    return true;
  }

  tryShoot() {
    if (this.shootTimer > 0 || this.reloadTimer > 0 || this.ammo <= 0) return false;
    this.shootTimer = WEAPON.fireCooldown;
    this.ammo -= 1;
    return true;
  }

  tryReload() {
    if (this.reloadTimer > 0 || this.ammo === WEAPON.magSize || this.reserve <= 0) return false;
    this.reloadTimer = WEAPON.reloadSeconds;
    return true;
  }

  heal(amount) {
    this.health = Math.min(PLAYER_TUNING.maxHealth, this.health + amount);
  }

  hurt(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }
}
