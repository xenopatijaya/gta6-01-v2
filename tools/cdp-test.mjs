// Coral Bay headless play-test + screenshot driver (Node 22+ stdlib only).
// Drives the real Chromium over CDP: loads game/, asserts 21 behaviours,
// then captures the 4 ?shot= scenes as screenshots/*.jpg.
// Usage: node tools/cdp-test.mjs [--shots-only] [--no-shots]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const PORT = 9222;
const SERVER_PORT = 8091;
const shotsOnly = process.argv.includes('--shots-only');
const noShots = process.argv.includes('--no-shots');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  return res.json();
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }

  async call(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.call('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(`eval failed: ${expression}\n${JSON.stringify(result.exceptionDetails)}`);
    return result.result.value;
  }

  consoleErrors() {
    return this.events.filter(
      (e) => (e.method === 'Runtime.exceptionThrown')
        || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'),
    );
  }

  async screenshot(path) {
    const shot = await this.call('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    writeFileSync(path, Buffer.from(shot.data, 'base64'));
    return statSync(path).size;
  }
}

async function openPage(url) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
      const page = targets.find((t) => t.type === 'page');
      if (page) {
        const cdp = new CDP(page.webSocketDebuggerUrl);
        await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
        await cdp.call('Page.enable');
        await cdp.call('Runtime.enable');
        await cdp.call('Page.navigate', { url });
        return cdp;
      }
    } catch (e) { /* chrome not up yet */ }
    await sleep(500);
  }
  throw new Error('could not connect to chrome DevTools');
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail ?? '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(SERVER_PORT)], { cwd: ROOT, stdio: 'ignore' });
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${PORT}`, '--window-size=1280,720', '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    await sleep(1500);
    if (!shotsOnly) {
      const cdp = await openPage(`http://127.0.0.1:${SERVER_PORT}/index.html`);
      await sleep(4000);
      const hasGame = await cdp.eval(`!!window.__game`);
      check('game boots', hasGame);
      const title = await cdp.eval(`window.__game.screen`);
      check('title screen shown', title === 'title', `screen=${title}`);
      const webgl = await cdp.eval(`(() => { const c = document.createElement('canvas'); return !!c.getContext('webgl2'); })()`);
      check('webgl2 available', webgl);
      await cdp.eval(`document.getElementById('btn-start').click()`);
      await sleep(1200);
      let st = await cdp.eval(`window.__game.state()`);
      check('start begins play, mission 1 active', st.screen === 'play' && st.missionActive && st.missionIndex === 0, JSON.stringify(st));
      check('traffic + pedestrians spawned', st.traffic === 14 && st.pedestrians === 24, `traffic=${st.traffic} peds=${st.pedestrians}`);
      check('HUD visible', await cdp.eval(`getComputedStyle(document.getElementById('hud')).display === 'block'`));
      check('minimap draws', await cdp.eval(`(() => { const c = document.getElementById('minimap'); const d = c.getContext('2d').getImageData(0,0,190,190).data; let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i] > 0) n++; return n > 10; })()`));
      // Walk forward.
      const before = await cdp.eval(`({x: window.__game.player.x, z: window.__game.player.z})`);
      await cdp.eval(`window.__game.keys.KeyW = true`);
      await sleep(4000);
      await cdp.eval(`window.__game.keys.KeyW = false`);
      const after = await cdp.eval(`({x: window.__game.player.x, z: window.__game.player.z})`);
      const moved = Math.hypot(after.x - before.x, after.z - before.z);
      check('player walks with WASD', moved > 1.2, `moved=${moved.toFixed(1)}m`);
      // Enter a parked car: teleport next to one.
      await cdp.eval(`(() => { const g = window.__game; const c = g.parkedCars[0]; g.player.x = c.x + 2; g.player.z = c.z; })()`);
      await sleep(300);
      await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))`);
      await sleep(500);
      st = await cdp.eval(`window.__game.state()`);
      check('enter car with E', st.inCar === true, `inCar=${st.inCar}`);
      check('stealing raises wanted', st.wanted >= 1, `wanted=${st.wanted}`);
      await cdp.eval(`window.__game.keys.KeyW = true`);
      await sleep(3000);
      await cdp.eval(`window.__game.keys.KeyW = false`);
      st = await cdp.eval(`window.__game.state()`);
      check('car drives', Math.abs(await cdp.eval(`window.__game.playerCar.speed`)) > 1.5, `speed=${(await cdp.eval(`window.__game.playerCar.speed`)).toFixed(1)}`);
      await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))`);
      await sleep(400);
      st = await cdp.eval(`window.__game.state()`);
      check('exit car with E', st.inCar === false);
      // Shoot: ammo drops, wanted rises.
      const ammoBefore = await cdp.eval(`window.__game.player.ammo`);
      await cdp.eval(`document.getElementById('game').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))`);
      await sleep(400);
      const ammoAfter = await cdp.eval(`window.__game.player.ammo`);
      check('shooting spends ammo', ammoAfter === ammoBefore - 1, `${ammoBefore} -> ${ammoAfter}`);
      // Police respond to wanted.
      await cdp.eval(`window.__game.wanted.stars = 3`);
      await sleep(4000);
      st = await cdp.eval(`window.__game.state()`);
      check('police cars + officers chase at 3 stars', st.policeCars >= 2 && st.officers >= 1, `cars=${st.policeCars} officers=${st.officers}`);
      // Mission 1 while DRIVING: re-enter the car, drive it to Vera's garage.
      await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))`);
      await sleep(500);
      await cdp.eval(`(() => { const g = window.__game; g.playerCar.x = 174; g.playerCar.z = -168; g.playerCar.heading = Math.PI; g.playerCar.speed = 0; })()`);
      await cdp.eval(`window.__game.keys.KeyW = true`);
      await sleep(4000);
      await cdp.eval(`window.__game.keys.KeyW = false`);
      const missionAfterDrive = await cdp.eval(`window.__game.missions.index`);
      check('mission completes while driving to marker', missionAfterDrive >= 1, `mission=${missionAfterDrive}`);
      // Police must chase the CAR, not the stale on-foot position.
      await cdp.eval(`window.__game.police.removeAll()`);
      await cdp.eval(`window.__game.wanted.stars = 3`);
      await sleep(6000);
      const chaseDist = await cdp.eval(`(() => { const g = window.__game; let m = 1e9; for (const c of g.police.cars) m = Math.min(m, Math.hypot(c.x - g.playerCar.x, c.z - g.playerCar.z)); return Math.round(m); })()`);
      check('police chase the driven car', chaseDist < 25, `nearest cruiser ${chaseDist}m from car`);
      // Save / load round-trip.
      await cdp.eval(`window.__game.saveNow(false)`);
      const saved = await cdp.eval(`!!localStorage.getItem('coral-bay-save-v1')`);
      check('save writes localStorage', saved);
      // Pause / resume.
      await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }))`);
      await sleep(300);
      const paused = await cdp.eval(`window.__game.screen`);
      await cdp.eval(`document.getElementById('btn-resume').click()`);
      await sleep(300);
      const resumed = await cdp.eval(`window.__game.screen`);
      check('pause and resume', paused === 'pause' && resumed === 'play', `${paused} -> ${resumed}`);
      st = await cdp.eval(`window.__game.state()`);
      check('render loop alive (SwiftShader-bound fps)', st.fps >= 1, `fps=${st.fps} headless SwiftShader`);
      check('no game errors', st.errors.length === 0, st.errors.join('; '));
      const consoleErrs = cdp.consoleErrors();
      check('no console errors', consoleErrs.length === 0, consoleErrs.slice(0, 2).map((e) => JSON.stringify(e.params).slice(0, 200)).join(' | '));
      cdp.ws.close();
    }
    if (!noShots) {
      const shots = [
        ['cover', '1-cover.jpg'],
        ['drive', '2-drive.jpg'],
        ['chase', '3-chase.jpg'],
        ['mission', '4-mission.jpg'],
      ];
      mkdirSync(join(ROOT, 'screenshots'), { recursive: true });
      for (const [name, file] of shots) {
        const cdp = await openPage(`http://127.0.0.1:${SERVER_PORT}/index.html?shot=${name}`);
        let ready = false;
        for (let i = 0; i < 40; i += 1) {
          await sleep(500);
          ready = await cdp.eval(`!!window.__shotReady`).catch(() => false);
          if (ready) break;
        }
        await sleep(2500);
        const size = await cdp.screenshot(join(ROOT, 'screenshots', file));
        const errs = await cdp.eval(`window.__game.errors.length`);
        check(`screenshot ${name}`, ready && size > 20000 && size <= 262144 && errs === 0, `${file} ${size}B ready=${ready} errors=${errs}`);
        cdp.ws.close();
      }
    }
  } finally {
    chrome.kill();
    server.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} PASS`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('DRIVER FAILED', e);
  process.exit(1);
});
