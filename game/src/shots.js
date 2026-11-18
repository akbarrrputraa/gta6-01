// Screenshot scenes behind ?shot=drive|foot|chase|menu. Each one stages the
// real game — no fake renders — then lets the live loop run a few seconds
// with a small autopilot, so the frame is what a short session really looks
// like. The same seed always gives the same frame.
//
// Staging moves real traffic cars and pedestrians into frame and repaints
// Rico's ride red, so the cover shows the city at its busiest: cars ahead
// on the boulevard, cops in the chase, people on the sidewalks.
export function stageShot(game, name) {
  const g = game;
  g.hideTitle();
  if (name === 'menu') {
    g.showTitle();
    g.shotMode = 'menu';
    return;
  }
  g._setHudVisible(true);
  g.screen = 'playing';
  g.shotMode = name;
  if (name === 'drive') {
    // Rico in a red coupe, driving south down Bay Boulevard toward Marina
    // Plaza, with oncoming traffic in the next lane and people on the walks.
    const car = g.traffic.cars.find((c) => c.parked);
    repaintCar(car, 0xd43d2a);
    car.parked = false; car.stolen = true;
    car.x = -3.5; car.z = 150; car.heading = Math.PI; car.speed = 16;
    g.player.enterCar(car);
    g.traffic.playerCar = car;
    g.player.camYaw = 0;
    g.player.camPitch = 0.28;
    g.shotLane = -3.5;
    placeTrafficAhead(g, [110, 80, 50]);
    placePedsNear(g, 12, 120, 3);
    g.player.snapCamera();
    g.missions.index = 0; g.missions.step = 1;
    g.toast('MISSION 1 — FIRST WHEELS: Drive the car to Marina Plaza', 30);
  } else if (name === 'foot') {
    // On foot at the plaza corner, facing north up the boulevard: traffic
    // rolling past the intersection and pedestrians on the sidewalk.
    g.player.x = 10; g.player.z = 52;
    g.player.heading = 0.15;
    g.player.camYaw = g.player.heading + Math.PI;
    g.player.camPitch = 0.3;
    placeTrafficCrossing(g);
    placePedsNear(g, 18, 58, 4);
    g.player.snapCamera();
    g.missions.index = 0; g.missions.step = 0;
    g.toast('Explore Solmar Bay — steal a car with E', 30);
  } else if (name === 'chase') {
    // Three stars, interceptors closing in from ahead and behind, the Big
    // Score on the HUD.
    const car = g.traffic.cars.find((c) => c.parked);
    repaintCar(car, 0xd43d2a);
    car.parked = false; car.stolen = true;
    car.x = 3.5; car.z = 96; car.heading = 0; car.speed = 22;
    g.player.enterCar(car);
    g.traffic.playerCar = car;
    g.player.camYaw = Math.PI;
    g.player.camPitch = 0.3;
    g.shotLane = 3.5;
    g.missions.index = 3; g.missions.step = 2;
    g.missions.bankTimer = 5; g.missions._bankGrabbed = true;
    g.police.addHeat(58, 'bank robbery');
    // One interceptor ahead, coming at Rico; one alongside; one behind.
    const ahead = g.traffic.spawnPolice(-3.5, 260, Math.PI);
    ahead.speed = 20;
    g.police.cars.push(ahead);
    const side = g.traffic.spawnPolice(-10, 175, 0);
    side.speed = 24;
    g.police.cars.push(side);
    const behind = g.traffic.spawnPolice(3.5, 70, 0);
    behind.speed = 27;
    g.police.cars.push(behind);
    g.player.snapCamera();
    g.toast('MISSION 4 — THE BIG SCORE: Escape to the Vega Hideout!', 30);
  } else {
    g.shotMode = 'drive';
  }
}

/** Repaint a car's body panels (the first child mesh is the body). */
function repaintCar(car, color) {
  const body = car.mesh.children[0];
  if (body && body.material) body.material.color.setHex(color);
}

/** Move a few moving traffic cars onto the x=0 boulevard ahead of Rico. */
function placeTrafficAhead(g, zs) {
  const movers = g.traffic.cars.filter((c) => !c.parked && !c.police && c !== g.player.car);
  zs.forEach((z, i) => {
    const car = movers[i];
    if (!car) return;
    // Oncoming lane for a southbound Rico: northbound, right lane x=+3.5.
    car.x = 3.5;
    car.z = z;
    car.heading = 0;
    car.speed = 9;
    car.keepLane = true;
    car.syncMesh();
  });
}

/** Two traffic cars crossing the z=64 road by the plaza, for the foot shot. */
function placeTrafficCrossing(g) {
  const movers = g.traffic.cars.filter((c) => !c.parked && !c.police);
  const spots = [[-46, 67.5, Math.PI / 2, 9], [70, 60.5, -Math.PI / 2, 10]];
  spots.forEach(([x, z, heading, speed], i) => {
    const car = movers[i];
    if (!car) return;
    car.x = x; car.z = z; car.heading = heading; car.speed = speed;
    car.keepLane = true;
    car.syncMesh();
  });
}

/** Gather a few pedestrians onto the sidewalk near (x, z). */
function placePedsNear(g, x, z, count) {
  for (let i = 0; i < count && i < g.peds.list.length; i++) {
    const ped = g.peds.list[i];
    ped.x = x + (i - 1.5) * 4;
    ped.z = z + (i % 2) * 6;
    ped.targetX = ped.x + 30;
    ped.targetZ = ped.z;
    ped.mesh.position.set(ped.x, 0, ped.z);
  }
}

/** Synthetic driving inputs for the staged drive/chase shots. */
export function shotAutopilot(game, dt) {
  const g = game;
  if (g.shotMode !== 'drive' && g.shotMode !== 'chase') return null;
  const car = g.player.car;
  if (!car) return null;
  // Hold the staged lane (southbound -3.5 for the drive shot, northbound
  // +3.5 for the chase), heading wherever the car points.
  const lane = g.shotLane ?? 3.5;
  const laneError = car.x - lane;
  const steer = Math.max(-1, Math.min(1, -laneError * 0.12));
  return { throttle: 1, steer, brake: false };
}
