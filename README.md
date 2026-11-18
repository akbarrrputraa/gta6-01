[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/akbarrrputraa/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/akbarrrputraa/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Bay — an open-world crime game

A sun-soaked coastal city you can explore on foot and by car. Steal cars, outrun the Bay Police, and climb the crew's ladder through four story missions — all in the browser, offline, from static files.

**Play it:** serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and click **START THE STORY**.

## The city

Solmar Bay is an original city: Marina Plaza, the Harbour Docks, Coral Park, Palm Heights, Old Town and Solmar Beach, with a pier, gantry cranes, palms, fountains and a full street grid full of traffic and pedestrians.

## What is in the game

- **On foot and by car** — third-person walking with a walk/run cycle and jumping, plus arcade driving: enter any parked or traffic car with `E`, steal it, and drive it.
- **Traffic and pedestrians** — cars cruise the grid and turn at intersections; pedestrians stroll the sidewalks and flee from gunfire and speeding cars.
- **Wanted level** — 5 stars of Bay Police heat. Steal cars, assault bystanders or rob the bank and interceptors chase, ram and try to bust you. Lay low and the heat cools off.
- **4 story missions** — First Wheels, Courier Run (timed), Harbour Heat (take out 3 enforcers) and The Big Score (rob the bank and escape), with beacon markers, objectives on the HUD and cash rewards.
- **Combat** — pistol (click to shoot, `R` reload) and fists (`F`). Enforcers shoot back.
- **HUD with minimap** — wanted stars, cash, health, mission objective, speed, ammo and a live top-down minimap with the player, traffic, police and the mission beacon.
- **Save / load** — progress saves to localStorage from the pause menu; the title screen shows your save.
- **Sound and music** — fully synthesized WebAudio: engine hum, sirens, gunshots, pickups and a coastal Am–F–C–G groove. No audio files.
- **Start screen, pause, game over** — plus day lighting with sun shadows, dust, smoke, blood, sparks and tracer effects.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse drag | Orbit camera |
| E | Enter / exit car |
| Left click | Shoot |
| F | Punch |
| R | Reload |
| Space | Jump / brake |
| Shift | Sprint |
| P / Esc | Pause |
| M | Music on/off |

## Tech

- [three.js](https://threejs.org/) (vendored minified build under `game/vendor/`) for 3D, plain ES modules otherwise — no build step, no network requests at runtime.
- All textures are procedural canvas art; all sound is synthesized WebAudio.
- `main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

## Repo layout

- `game/` — the playable game (`index.html` + `src/*.js` + `vendor/three.module.min.js`)
- `screenshots/` — real renders of the game in a browser
- `main.ts` — the entrypoint that hands the game in
- `serve.ts` — a tiny static server for local play
