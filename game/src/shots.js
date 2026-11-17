// Screenshot scenes: each one stages the real game into a fixed, readable
// frame — the same world, the same rules, steered by a scripted input — so
// `?shot=cover|drive|chase|mission` always shows the game at its best.
export function stageShot(name, game) {
  game.hud.quiet = true;
  const toast = document.getElementById('toast');
  if (toast) toast.style.opacity = '0';
  const driveInput = { forward: true, back: false, left: false, right: false, run: false, jump: false, handbrake: false };
  const walkInput = { forward: true, back: false, left: false, right: false, run: true, jump: false, handbrake: false };
  const stillInput = { forward: false, back: false, left: false, right: false, run: false, jump: false, handbrake: false };

  if (name === 'drive') {
    game.enterCar('sport', 0xd94f3d, -58, -120, 0);
    game.wanted.clear();
    game.scripted = driveInput;
    game.cameraYaw = 0;
    game.cameraPitch = 0.3;
    game.cameraDist = 13;
    return;
  }
  if (name === 'chase') {
    game.enterCar('sedan', 0x3d7dd9, 58, 60, Math.PI);
    game.playerCar.speedCap = 14;
    game.wanted.stars = 3;
    // Two cruisers right behind the player's car, closing in for the frame.
    const cruiserA = game.police.spawnCar(52, 72);
    cruiserA.speed = 22;
    const cruiserB = game.police.spawnCar(66, 76);
    cruiserB.speed = 22;
    game.scripted = driveInput;
    game.cameraYaw = Math.PI;
    game.cameraPitch = 0.18;
    game.cameraDist = 18;
    return;
  }
  if (name === 'mission') {
    game.missions.start(4);
    game.player.reset(156, 174);
    game.player.heading = Math.PI / 2;
    game.wanted.stars = 1;
    // Harbor guards and the gold sedan in frame with the mission beacon.
    game.spawnEnemy([168, 166], 'guard');
    game.spawnEnemy([170, 182], 'guard');
    game.spawnParkedCar('sport', 0xd4af37, 176, 174, true);
    game.scripted = stillInput;
    game.cameraYaw = Math.PI / 2;
    game.cameraPitch = 0.34;
    game.cameraDist = 12;
    return;
  }
  // Cover: on foot at the market square, mission beacon ahead, traffic and
  // one wanted star with a police cruiser on the HUD.
  game.player.reset(0, 52);
  game.player.heading = Math.PI;
  game.wanted.stars = 1;
  game.scripted = stillInput;
  game.cameraYaw = Math.PI;
  game.cameraPitch = 0.3;
  game.cameraDist = 11;
}
