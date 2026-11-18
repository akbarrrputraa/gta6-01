// Solmar Bay itself: a sun-soaked coastal city built from boxes, planes and
// canvas textures. A regular street grid (roads every 64 m) makes traffic,
// pedestrians and missions easy to route, while the beach and ocean on the
// west edge give the city its postcard skyline.
import * as THREE from 'three';
import { mulberry32, pick, randInt, randRange } from './util.js';
import { buildingTexture, roadTexture, sidewalkTexture, sandTexture, grassTexture, umbrellaTexture } from './textures.js';

export const CITY_HALF = 320;      // city spans -320..320 on x and z
export const ROAD_STEP = 64;       // distance between parallel roads
export const ROAD_HALF = 7;        // half width of a road
export const BEACH_X = -288;       // sand starts west of this line

const PALETTE = ['#f2c14e', '#e8845c', '#7fb3d5', '#f5ede0', '#d98880', '#a8c686', '#e8b4b8', '#9fb6c9'];
const TRIMS = ['#ffffff', '#3d4a5c', '#8a6d4b', '#274156'];

/** District names by block, for the HUD location line. */
export function districtAt(x, z) {
  if (x < BEACH_X + 20) return 'Solmar Beach';
  if (z < -160) return 'Harbour Docks';
  if (z > 160) return 'Palm Heights';
  if (x > 160) return 'Old Town';
  if (Math.abs(x) < 70 && Math.abs(z) < 70) return 'Marina Plaza';
  return 'Bay Boulevard';
}

/** Build the whole city into `scene`. Returns colliders, road lines and landmarks. */
export function buildCity(scene, seed = 7) {
  const rand = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'SolmarBayCity';

  // --- sky, sun and fog -------------------------------------------------
  scene.background = new THREE.Color(0x87c5e8);
  scene.fog = new THREE.Fog(0x9fd0e8, 260, 900);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfdcff, 0x8a7a5a, 1.1));
  const sunTarget = new THREE.Object3D();
  sunTarget.position.set(0, 0, 0);
  scene.add(sunTarget); sun.target = sunTarget;
  const city = { group, sun, colliders, rand };

  // --- ground, beach and ocean ------------------------------------------
  const groundMat = new THREE.MeshLambertMaterial({ map: grassTexture() });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  ground.material.map.repeat.set(9, 9);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 700),
    new THREE.MeshLambertMaterial({ map: sandTexture() }),
  );
  sand.material.map.repeat.set(1, 10);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(BEACH_X - 16, 0.05, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 900),
    new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(BEACH_X - 240, 0.02, 0);
  group.add(ocean);

  // --- roads ------------------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTexture() });
  const roads = [];
  for (let c = -320; c <= 320; c += ROAD_STEP) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(660, ROAD_HALF * 2), roadMat.clone());
    h.material.map = roadTexture(); h.material.map.repeat.set(10, 1);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.08, c); h.receiveShadow = true;
    group.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 660), roadMat.clone());
    v.material.map = roadTexture(); v.material.map.repeat.set(1, 10);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.08, 0); v.receiveShadow = true;
    group.add(v);
    roads.push({ axis: 'x', at: c });
    roads.push({ axis: 'z', at: c });
  }
  city.roads = roads;

  // --- sidewalks --------------------------------------------------------
  // Blocks sit BETWEEN roads: road lines are multiples of 64, block centres
  // are 32 + multiples of 64, so no building ever intrudes onto a road.
  const walkMat = new THREE.MeshLambertMaterial({ map: sidewalkTexture() });
  for (let bx = -320; bx <= 256; bx += ROAD_STEP) {
    for (let bz = -320; bz <= 256; bz += ROAD_STEP) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(52, 52), walkMat);
      walk.material.map = sidewalkTexture(); walk.material.map.repeat.set(4, 4);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(bx + 32, 0.06, bz + 32);
      walk.receiveShadow = true;
      group.add(walk);
    }
  }

  // --- buildings --------------------------------------------------------
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const facadeMats = PALETTE.map((base, i) =>
    new THREE.MeshLambertMaterial({ map: buildingTexture(base, TRIMS[i % TRIMS.length], i * 13 + 5) }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5148 });
  let built = 0;
  for (let bx = -320; bx <= 256; bx += ROAD_STEP) {
    for (let bz = -320; bz <= 256; bz += ROAD_STEP) {
      const cx = bx + 32, cz = bz + 32;
      // Keep the central plaza, the park and the docks yard open.
      if (Math.abs(cx) < 40 && Math.abs(cz) < 40) continue;
      if (cx === 96 && cz === -96) continue; // Coral Park
      if (cz < -224) continue; // docks yard
      const n = rand() < 0.35 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const w = randRange(rand, 16, 26), d = randRange(rand, 16, 26);
        const tall = rand() < 0.18;
        const h = tall ? randRange(rand, 55, 95) : randRange(rand, 12, 34);
        const ox = (k === 0 ? -1 : 1) * (n === 1 ? 0 : 10);
        const oz = (k === 0 ? -1 : 1) * (n === 1 ? 0 : 8);
        const mesh = new THREE.Mesh(boxGeo, facadeMats[Math.floor(rand() * facadeMats.length)]);
        mesh.scale.set(w, h, d);
        mesh.position.set(cx + ox, h / 2, cz + oz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        group.add(mesh);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(cx + ox, h + 0.4, cz + oz);
        group.add(roof);
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
        built++;
      }
    }
  }
  city.buildingCount = built;

  // --- Marina Plaza: fountain, benches, flag poles ----------------------
  const plaza = new THREE.Group();
  const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.2, 24), new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }));
  fountainBase.position.set(0, 0.6, 0); fountainBase.castShadow = true;
  plaza.add(fountainBase);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.5, 24), new THREE.MeshLambertMaterial({ color: 0x3fb7d9 }));
  water.position.set(0, 1.1, 0);
  plaza.add(water);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 4, 10), new THREE.MeshLambertMaterial({ color: 0xe8e2d0 }));
  jet.position.set(0, 3, 0);
  plaza.add(jet);
  colliders.push({ minX: 22, maxX: 42, minZ: 22, maxZ: 42 });
  plaza.position.set(32, 0, 32);
  group.add(plaza);

  // --- Coral Park: trees, pond ------------------------------------------
  const park = new THREE.Group();
  const pond = new THREE.Mesh(new THREE.CircleGeometry(14, 24), new THREE.MeshLambertMaterial({ color: 0x2f9ec4 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(96, 0.1, -96);
  park.add(pond);
  group.add(park);

  // --- palms along the boulevards ---------------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6d4b });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  const frondGeo = new THREE.ConeGeometry(2.6, 3.2, 6);
  // Palms on the sidewalk corner of each intersection (8.5 m off both road
  // lines, so they never stand inside a building footprint).
  const palmSpots = [];
  for (let rx = -256; rx <= 256; rx += ROAD_STEP) {
    for (let rz = -256; rz <= 256; rz += ROAD_STEP) {
      if (rx === 0 && rz === 0) continue;
      palmSpots.push([rx + 8.5, rz + 8.5]);
    }
  }
  for (const [px, pz] of palmSpots) {
    if (px < BEACH_X + 8) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(px, 3.5, pz); trunk.castShadow = true;
    group.add(trunk);
    const fronds = new THREE.Mesh(frondGeo, frondMat);
    fronds.position.set(px, 8.2, pz); fronds.castShadow = true;
    group.add(fronds);
  }
  // Park trees (round canopies).
  const canopyGeo = new THREE.SphereGeometry(3.4, 10, 8);
  for (let i = 0; i < 14; i++) {
    const tx = 96 + randRange(rand, -22, 22), tz = -96 + randRange(rand, -22, 22);
    if (dist(tx, tz, 96, -96) < 15) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.scale.y = 0.7; trunk.position.set(tx, 2.4, tz);
    group.add(trunk);
    const canopy = new THREE.Mesh(canopyGeo, frondMat);
    canopy.position.set(tx, 6.4, tz); canopy.castShadow = true;
    group.add(canopy);
  }

  // --- beach umbrellas + pier -------------------------------------------
  const umbMat = new THREE.MeshLambertMaterial({ map: umbrellaTexture('#ff6b6b', '#fff3d6') });
  for (let i = 0; i < 8; i++) {
    const ux = BEACH_X - 14, uz = -200 + i * 58;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), trunkMat);
    pole.position.set(ux, 1.5, uz);
    group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(3, 1.4, 10), umbMat);
    top.position.set(ux, 3.4, uz); top.castShadow = true;
    group.add(top);
  }
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 10), new THREE.MeshLambertMaterial({ color: 0x9a7b52 }));
  pier.position.set(BEACH_X - 46, 0.8, 32); pier.castShadow = true;
  group.add(pier);
  colliders.push({ minX: BEACH_X - 82, maxX: BEACH_X - 10, minZ: 27, maxZ: 37 });

  // --- harbour docks: containers + cranes --------------------------------
  const contColors = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d];
  for (let i = 0; i < 18; i++) {
    const cont = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: contColors[i % 4] }));
    const w = 12, h = 3, d = 3;
    const cx = -160 + (i % 6) * 22, cz = -272 + Math.floor(i / 6) * 12;
    cont.scale.set(w, h, d);
    cont.position.set(cx, 1.5 + (i % 2) * 3, cz);
    cont.castShadow = true;
    group.add(cont);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }
  // Two gantry cranes as simple frames.
  for (const cz of [-256, -232]) {
    const crane = new THREE.Group();
    const legMat = new THREE.MeshLambertMaterial({ color: 0xf39c12 });
    for (const [lx, lz] of [[-8, -4], [8, -4], [-8, 4], [8, 4]]) {
      const leg = new THREE.Mesh(boxGeo, legMat);
      leg.scale.set(1.4, 26, 1.4); leg.position.set(lx, 13, lz);
      crane.add(leg);
    }
    const beam = new THREE.Mesh(boxGeo, legMat);
    beam.scale.set(24, 1.6, 2); beam.position.set(0, 26, 0);
    crane.add(beam);
    crane.position.set(-40, 0, cz);
    group.add(crane);
  }

  // --- street lamps ------------------------------------------------------
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let c = -256; c <= 256; c += ROAD_STEP) {
    for (const [lx, lz] of [[c + 8.5, 264.5], [c + 8.5, -264.5]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 6), lampMat);
      pole.position.set(lx, 3, lz);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
      bulb.position.set(lx, 6.2, lz);
      group.add(bulb);
    }
  }

  scene.add(group);

  // Landmarks the missions use, in world coordinates.
  city.landmarks = {
    plaza: { x: 32, z: 32, name: 'Marina Plaza' },
    docks: { x: -96, z: -256, name: 'Harbour Docks' },
    bank: { x: 192, z: 96, name: 'Bay National Bank' },
    hideout: { x: 224, z: -192, name: 'Vega Hideout' },
    marina: { x: -224, z: 128, name: 'Solmar Marina' },
    park: { x: 96, z: -96, name: 'Coral Park' },
    beach: { x: -272, z: 32, name: 'Solmar Beach' },
    dealership: { x: 128, z: 224, name: 'Palm Auto Row' },
  };
  return city;
}

function dist(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
