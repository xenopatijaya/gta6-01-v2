# Coral Bay — an open-city crime story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xenopatijaya/gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xenopatijaya/gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![make.fun bounty gta6-01](https://img.shields.io/badge/make.fun-gta6--01-orange)](https://make.fun/c/gta6-01)
[![Playable offline](https://img.shields.io/badge/play-offline%20in%20Chrome-brightgreen)](game/index.html)

**Coral Bay** is an original open-world crime game that runs offline in a desktop browser from static files. Dario "Daz" Moreno is back in Coral Bay and owes fixer Vera Solano $5,000 — steal cars, run packages, collect debts, shake the Coral Bay PD and pull one last harbor heist across **5 story missions** in a living, sun-soaked city.

## Play

Serve `game/` with any static server and open `index.html`, or run `node serve.ts` and open http://localhost:8080.

| Control | Action |
|---|---|
| WASD | Move / drive |
| Mouse drag | Look around (wheel zooms) |
| Shift | Sprint |
| Space | Jump / handbrake |
| E | Enter / exit car |
| Click | Shoot pistol |
| F | Punch |
| R | Reload |
| H | Horn |
| N | Next mission |
| M | Mute |
| P / Esc | Pause (save lives here) |

## What's in the city

- **A 7-avenue coastal city** (three.js): pastel towers, a market square with stalls and a fountain, Vera's garage, a harbor with containers, a beach with palms and umbrellas, and a living sea.
- **On foot and by car**: arcade driving with traffic that cruises the grid, brakes for the car ahead and turns at intersections; parked cars and traffic cars can both be taken.
- **Wanted system (0–5 stars)**: stealing, assault and shooting raise the heat; police cars ram and chase, officers pursue on foot, shoot and try to bust you. Lay low and the stars fade.
- **5 story missions**: Borrowed Wheels, Sunset Courier, Collect the Debt, Heat Wave and Harbor Heist — with a 3D beacon, objective text, a countdown delivery and a final shootout.
- **Combat**: pistol with magazine + reserve ammo, punching, armed harbor guards and a debt target who fights back.
- **HUD + minimap**: health, cash, wanted stars, clock and day, mission label, objective, timer, speed, ammo, toasts, damage vignette and a live minimap (roads, traffic, police blips, mission marker).
- **Save**: progress, cash, story state and position persist in localStorage; continue from the title screen.
- **Sound**: fully synthesised WebAudio — engine hum, sirens, gunshots, a sunset bass groove. No audio files.

## Layout

```
game/
  index.html            HUD + screens + import map
  vendor/three.module.js  three.js 0.187.0 (vendored, official build)
  src/
    config.js           tuning, missions, palette
    rng.js              seeded random
    audio.js            synthesised SFX + music
    city.js             procedural city, beach, harbor, collision
    vehicles.js         car models, driving physics, traffic AI
    people.js           pedestrians (wander + flee)
    player.js           on-foot movement + combat
    police.js           wanted system + PD cars/officers
    missions.js         5-mission story state machine + beacon
    hud.js              HUD, minimap, menus, toasts
    save.js             localStorage save/load
    shots.js            deterministic screenshot scenes (?shot=…)
    main.js             renderer, loop, camera, input, wiring
main.ts                 entry program: copies game/ + screenshots/ to /output
                        and writes /output/dossier.json (make.fun program/v1)
serve.ts                tiny static server for local play
```

## Screenshots

The four screenshots in `screenshots/` are real renders of this game, staged with `?shot=cover|drive|chase|mission` (see `shots.json`).

## Originality

Everything is original: the city, characters, vehicles, names, story, art and sound are made for this game. Nothing is taken from Rockstar Games' Grand Theft Auto series or any other commercial game.

## License

MIT — see [LICENSE](LICENSE).
