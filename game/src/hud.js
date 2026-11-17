// HUD: the DOM overlay — health, cash, wanted stars, clock, objective, speed,
// toasts, minimap canvas and the start / pause / busted screens.
export class HUD {
  constructor(callbacks) {
    this.cb = callbacks;
    this.el = (id) => document.getElementById(id);
    this.minimap = this.el('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.toastTimer = 0;
    this.quiet = false;
    this.bindButtons();
  }

  bindButtons() {
    const bind = (id, fn) => {
      const node = this.el(id);
      if (node) node.addEventListener('click', () => { fn(); });
    };
    bind('btn-start', () => this.cb.onStart(false));
    bind('btn-continue', () => this.cb.onStart(true));
    bind('btn-resume', () => this.cb.onResume());
    bind('btn-save', () => this.cb.onSave());
    bind('btn-restart', () => this.cb.onRestart());
    bind('btn-menu', () => this.cb.onMenu());
    bind('btn-retry', () => this.cb.onRetry());
    bind('btn-mute', () => this.cb.onMute());
    bind('btn-how', () => {
      const panel = this.el('howto');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
  }

  showScreen(name) {
    for (const id of ['screen-start', 'screen-pause', 'screen-over']) {
      const node = this.el(id);
      if (node) node.style.display = id === `screen-${name}` ? 'flex' : 'none';
    }
    const hud = this.el('hud');
    if (hud) hud.style.display = name === 'play' ? 'block' : 'none';
  }

  setOverTitle(title, subtitle) {
    const t = this.el('over-title');
    if (t) t.textContent = title;
    const s = this.el('over-sub');
    if (s) s.textContent = subtitle;
  }

  showContinue(hasSave) {
    const btn = this.el('btn-continue');
    if (btn) btn.style.display = hasSave ? 'inline-block' : 'none';
  }

  toast(text, seconds) {
    if (this.quiet) return;
    const node = this.el('toast');
    if (!node) return;
    node.textContent = text;
    node.style.opacity = '1';
    this.toastTimer = seconds || 4;
  }

  tickToast(dt) {
    if (this.toastTimer <= 0) return;
    this.toastTimer -= dt;
    if (this.toastTimer <= 0) {
      const node = this.el('toast');
      if (node) node.style.opacity = '0';
    }
  }

  update(state) {
    const setText = (id, value) => {
      const node = this.el(id);
      if (node && node.textContent !== String(value)) node.textContent = value;
    };
    setText('cash', `$${state.cash.toLocaleString('en-US')}`);
    setText('health-num', `${Math.ceil(state.health)}`);
    setText('speed', state.inCar ? `${Math.round(Math.abs(state.speed) * 3.6)} km/h` : '');
    setText('clock', state.clock);
    setText('objective-text', state.objective);
    setText('timer', state.timer > 0 ? `⏱ ${state.timer}s` : '');
    setText('mission-label', state.missionLabel);
    setText('ammo', state.inCar ? '' : `🔫 ${state.ammo} / ${state.reserve}`);
    const healthBar = this.el('health-fill');
    if (healthBar) {
      healthBar.style.width = `${Math.max(0, state.health)}%`;
      healthBar.style.background = state.health > 50 ? '#58d68d' : state.health > 25 ? '#f2b134' : '#e74c3c';
    }
    const stars = this.el('stars');
    if (stars) {
      let html = '';
      for (let i = 0; i < 5; i += 1) html += `<span class="${i < state.wanted ? 'star on' : 'star'}">★</span>`;
      if (stars.innerHTML !== html) stars.innerHTML = html;
    }
    const hint = this.el('hint');
    if (hint) hint.textContent = state.hint || '';
    const cross = this.el('crosshair');
    if (cross) cross.style.display = state.inCar ? 'none' : 'block';
    const vignette = this.el('damage');
    if (vignette) vignette.style.opacity = state.health < 35 ? String(0.55 - state.health / 100) : '0';
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const size = 190;
    const scale = size / 470;
    const toMap = (x, z) => [(x + 215) * scale, (z + 215) * scale];
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(20, 26, 34, 0.85)';
    ctx.fillRect(0, 0, size, size);
    // Sea and beach at the south edge.
    ctx.fillStyle = '#2e8fa3';
    ctx.fillRect(0, (232 + 215) * scale, size, size);
    ctx.fillStyle = '#ecd9a8';
    ctx.fillRect(0, (210 + 215) * scale, size, (232 - 210) * scale);
    // Blocks.
    ctx.fillStyle = '#5a6270';
    for (let bx = -174; bx <= 174; bx += 58) {
      for (let bz = -174; bz <= 174; bz += 58) {
        const [x, y] = toMap(bx - 22, bz - 22);
        ctx.fillRect(x, y, 44 * scale, 44 * scale);
      }
    }
    // Roads.
    ctx.strokeStyle = '#8a929e';
    ctx.lineWidth = 5;
    for (const line of [-174, -116, -58, 0, 58, 116, 174]) {
      const [x1] = toMap(line, -210);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, size);
      ctx.stroke();
      const [, y1] = toMap(-210, line);
      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.lineTo(size, y1);
      ctx.stroke();
    }
    // Mission marker.
    if (state.missionTarget) {
      const [mx, my] = toMap(state.missionTarget[0], state.missionTarget[1]);
      const pulse = 6 + Math.sin(state.time * 4) * 2;
      ctx.fillStyle = '#ffd76e';
      ctx.beginPath();
      ctx.arc(mx, my, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#dfe6ee';
    for (const car of state.traffic) {
      const [cx, cy] = toMap(car.x, car.z);
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    // Police blips.
    for (const cop of state.police) {
      const [cx, cy] = toMap(cop.x, cop.z);
      ctx.fillStyle = cop.kind === 'car' ? '#3d7dd9' : '#ff4d4d';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.heading);
    ctx.fillStyle = '#58d68d';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('N', 4, 12);
  }
}
