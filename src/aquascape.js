import { loadAquascapeRock } from "./rock-model.js";
import { installCapture } from "./capture.js";
import { createAquariumLight } from "./aquarium-light.js";
import { createVegetation } from "./vegetation.js";
import { updateHairgrass } from "./hairgrass-flow.js";
import { updatePearlPlants } from "./pearl-plants.js";
import { updateAmbuliaPlants } from "./ambulia-plants.js";
import { advanceSchool, startleSchool } from "./schooling.js";
import { installTankClicks } from "./tank-clicks.js";
import { loadTetra } from "./tetra-model.js";
import { createFlowField } from "./flow-field.js";
import { createLeafFlex, advanceLeafFlex, leafOffset } from "./leaf-flex.js";
import { sampleFishFlow, advancePlant } from "./plant-flow.js";
import { injectFishWakes } from "./fish-water.js";
import { createSurfaceRippleDriver } from "./surface-ripples.js";
import { installRayWater } from "./ray-water.js";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const canvas = document.querySelector("canvas"),
  r = new T.WebGLRenderer({ canvas, antialias: true });
r.setPixelRatio(Math.min(devicePixelRatio, 2));
r.setSize(innerWidth, innerHeight);
r.setClearColor(0x000000);
r.toneMapping = T.ACESFilmicToneMapping;
r.toneMappingExposure = 1.1;
r.shadowMap.enabled = false;
r.shadowMap.type = T.PCFShadowMap;
r.shadowMap.autoUpdate = false;
r.shadowMap.needsUpdate = true;
const scene = new T.Scene(),
  camera = new T.PerspectiveCamera(37, innerWidth / innerHeight, 0.05, 80),
  controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.55, 0);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 32;
controls.maxPolarAngle = Math.PI * 0.49;
function home() {
  camera.position
    .set(7, 4.6, 10)
    .multiplyScalar(Math.max(1, 0.98 / camera.aspect));
}
home();
scene.add(new T.HemisphereLight(0xd8e4dd, 0x191c16, 0.75));
const key = new T.SpotLight(0xf4fff0, 115, 20, 0.65, 0.7, 1.4);
key.position.set(0, 4.05, 0);
key.target.position.set(0, 0, 0);
key.castShadow = false;
key.shadow.mapSize.set(512, 512);
key.shadow.radius = 3;
key.shadow.bias = -0.001;
key.shadow.normalBias = 0.015;
scene.add(key, key.target);
const fill = new T.DirectionalLight(0xc7d5df, 0.45);
fill.position.set(4, 3, -3);
scene.add(fill);
const W = 6,
  D = 3,
  H = 3.1,
  waterY = 2.86;
function mesh(g, m, p, scale) {
  const o = new T.Mesh(g, m);
  if (p) o.position.set(...p);
  if (scale) o.scale.set(...scale);
  scene.add(o);
  return o;
}
function box(size, p, m) {
  return mesh(new T.BoxGeometry(...size), m, p);
}
const aquariumLight = createAquariumLight({ scene, width: W, height: H });
key.position.copy(aquariumLight.emitterPosition);
// A single slab of timber, with continuous grain and no plank divisions.
const c = document.createElement("canvas");
c.width = 1024;
c.height = 512;
const cx = c.getContext("2d");
cx.fillStyle = "#79502d";
cx.fillRect(0, 0, 1024, 512);
let seed = 18;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
for (let i = 0; i < 2800; i++) {
  let y = rand() * 512;
  cx.strokeStyle = `rgba(${rand() > 0.4 ? "36,20,9" : "199,146,86"},${0.03 + rand() * 0.13})`;
  cx.lineWidth = 0.3 + rand() * 1.3;
  cx.beginPath();
  for (let x = 0; x <= 1024; x += 8) {
    let yy =
      y + Math.sin(x * 0.006 + y * 0.02) * 5 + Math.sin(x * 0.021 + y) * 1.2;
    if (x === 0) cx.moveTo(x, yy);
    else cx.lineTo(x, yy);
  }
  cx.stroke();
}
const wood = new T.CanvasTexture(c);
wood.colorSpace = T.SRGBColorSpace;
wood.anisotropy = 8;
const table = box(
  [9, 0.28, 5.8],
  [0, -0.33, 0],
  new T.MeshStandardMaterial({ map: wood, roughness: 0.42 }),
);
table.receiveShadow = true;
table.castShadow = true;
box(
  [6.09, 0.065, 3.09],
  [0, -0.1, 0],
  new T.MeshStandardMaterial({ color: 0x111417, roughness: 0.7 }),
);
const glass = new T.MeshPhysicalMaterial({
  color: 0xf0ffff,
  roughness: 0.035,
  metalness: 0,
  transparent: true,
  opacity: 0.035,
  side: T.DoubleSide,
  depthWrite: false,
  ior: 1.52,
  clearcoat: 1,
  clearcoatRoughness: 0.02,
});
box([6.08, 0.06, 3.08], [0, -0.035, 0], glass);
for (const [size, p] of [
  [
    [0.045, H, D],
    [-W / 2, H / 2, 0],
  ],
  [
    [0.045, H, D],
    [W / 2, H / 2, 0],
  ],
  [
    [W, H, 0.045],
    [0, H / 2, -D / 2],
  ],
  [
    [W, H, 0.045],
    [0, H / 2, D / 2],
  ],
]) {
  const o = box(size, p, glass);
  o.renderOrder = 5;
}
const edgeMat = new T.LineBasicMaterial({
  color: 0xbce0dd,
  transparent: true,
  opacity: 0.36,
});
const edges = new T.LineSegments(
  new T.EdgesGeometry(new T.BoxGeometry(W + 0.04, H, D + 0.04)),
  edgeMat,
);
edges.position.y = H / 2;
scene.add(edges);
const seam = new T.MeshStandardMaterial({
  color: 0xacc5bb,
  transparent: true,
  opacity: 0.35,
  roughness: 0.2,
});
for (const x of [-3, 3])
  for (const z of [-1.5, 1.5]) box([0.023, H, 0.023], [x, H / 2, z], seam);
function soilHeight(x, z) {
  return (
    0.18 +
    (0.17 * (z + 1.5)) / 3 +
    0.18 * Math.exp(-((x + 1.6) ** 2 + (z + 0.5) ** 2))
  );
}
const soilGeo = new T.PlaneGeometry(5.92, 2.92, 100, 60);
soilGeo.rotateX(-Math.PI / 2);
let a = soilGeo.attributes.position;
for (let i = 0; i < a.count; i++) {
  const x = a.getX(i),
    z = a.getZ(i);
  a.setY(i, soilHeight(x, z) + (rand() - 0.5) * 0.023);
}
soilGeo.computeVertexNormals();
const soil = mesh(
  soilGeo,
  new T.MeshStandardMaterial({ color: 0x261d15, roughness: 1 }),
);
soil.receiveShadow = true;
soil.userData.substrateSurface = true;
box(
  [5.94, 0.2, 2.94],
  [0, 0.1, 0],
  new T.MeshStandardMaterial({ color: 0x201710, roughness: 1 }),
);
const grains = new T.InstancedMesh(
    new T.IcosahedronGeometry(0.023, 0),
    new T.MeshStandardMaterial({ color: 0x39291c, roughness: 1 }),
    8000,
  ),
  dummy = new T.Object3D();
for (let i = 0; i < 8000; i++) {
  const x = (rand() - 0.5) * 5.9,
    z = (rand() - 0.5) * 2.9;
  dummy.position.set(x, soilHeight(x, z), z);
  dummy.scale.setScalar(0.65 + rand() * 0.7);
  dummy.updateMatrix();
  grains.setMatrixAt(i, dummy.matrix);
}
scene.add(grains);
const obstacles = [],
  rockAsset = await loadAquascapeRock();
function rock(x, z, sx, sy, sz, turn, lean = 0) {
  const o = mesh(
    rockAsset.geometry,
    rockAsset.material,
    [x, soilHeight(x, z) + sy * 0.77, z],
    [sx, sy, sz],
  );
  o.rotation.set(0.04, turn, lean);
  o.userData.rockSurface = true;
  obstacles.push({ p: o.position.clone(), r: Math.max(sx, sz) + 0.18, h: sy });
}
rock(-1.5, -0.35, 0.74, 0.9, 0.6, 0.3, 0.14);
rock(-2.05, 0.12, 0.34, 0.36, 0.32, 2.9, 0.21);
rock(1.55, -0.65, 0.5, 0.49, 0.43, 2.2, -0.1);
// Irregular rooted clumps, young central leaves and arching older leaves.
const { batches: leafBatches } = createVegetation({
  scene,
  soilHeight,
  obstacles,
  random: rand,
  lightPosition: aquariumLight.emitterPosition,
  viewPosition: camera.position,
});

// Finite-difference heightfield, adapted from Evan Wallace's MIT WebGL Water solver.
const N = 64,
  h = new Float32Array(N * N),
  velocity = new Float32Array(N * N),
  next = new Float32Array(N * N);
const surfaceRipples = createSurfaceRippleDriver({
  size: N,
  width: W,
  depth: D,
});
function drop(x, z) {
  const u = (x / W + 0.5) * (N - 1),
    v = (0.5 - z / D) * (N - 1);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let d = Math.hypot(x - u, y - v) / 3;
      if (d < 1) h[y * N + x] += (Math.cos(d * Math.PI) + 1) * 0.025;
    }
}
function step() {
  surfaceRipples.inject(velocity, 1 / 60);
  for (let y = 1; y < N - 1; y++)
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      velocity[i] =
        (velocity[i] +
          ((h[i - 1] + h[i + 1] + h[i - N] + h[i + N]) * 0.25 - h[i]) * 2) *
        0.995;
      next[i] = h[i] + velocity[i];
    }
  h.set(next);
}
drop(-1.2, 0.3);
drop(1.1, -0.4);
const waterGeo = new T.PlaneGeometry(W - 0.06, D - 0.06, N - 1, N - 1);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new T.MeshPhysicalMaterial({
  color: 0xb8e5db,
  roughness: 0.12,
  transparent: true,
  opacity: 0.15,
  metalness: 0.16,
  side: T.DoubleSide,
  depthWrite: false,
  clearcoat: 1,
});
const surface = mesh(waterGeo, waterMat, [0, waterY, 0]);
surface.renderOrder = 3;
const waterline = new T.LineSegments(
  new T.EdgesGeometry(new T.BoxGeometry(W - 0.03, 0.008, D - 0.03)),
  new T.LineBasicMaterial({
    color: 0xc4e9dc,
    transparent: true,
    opacity: 0.35,
  }),
);
waterline.position.y = waterY;
scene.add(waterline);
// Imported textured, animated neon tetra; keep the smaller school scale.
const tetra = await loadTetra(),
  fish = [];
for (let i = 0; i < 38; i++) {
  const group = new T.Group(),
    body = new T.Mesh(tetra.geometry, tetra.material);
  body.castShadow = false;
  group.add(body);
  scene.add(group);
  group.scale.setScalar((0.72 + rand() * 0.3) * 0.75);
  const p = new T.Vector3(
    (rand() - 0.5) * 3,
    1.2 + rand() * 0.9,
    (rand() - 0.5) * 1.6,
  );
  group.position.copy(p);
  fish.push({
    group,
    body,
    p,
    v: new T.Vector3(0.5 + rand() * 0.3, 0, (rand() - 0.5) * 0.2),
    phase: rand() * 6.28,
  });
}
const clock = new T.Clock();
let elapsed = 0,
  acc = 0;
function boids(dt) {
  advanceSchool(fish, obstacles, elapsed, dt);
}
installTankClicks({
  canvas,
  camera,
  fish,
  width: W,
  depth: D,
  waterY,
  surface,
  onTap: (point) => startleSchool(fish, point, obstacles, elapsed),
  onRipple: (point) => drop(point.x, point.z),
});
addEventListener("resize", () => {
  if (capturePaused) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  r.setSize(innerWidth, innerHeight);
});

let plantTick = 0;
const flowField = createFlowField();
function updatePlantFlow(dt) {
  plantTick += dt;
  if (plantTick < 1 / 24) return false;
  const step = Math.min(plantTick, 0.1);
  plantTick = 0;
  flowField.update(fish, elapsed);
  let changed = false;
  for (const batch of leafBatches) {
    if (batch.hairgrass) {
      changed = updateHairgrass(batch, flowField, step) || changed;
      continue;
    }
    if (batch.ambulia) {
      changed = updateAmbuliaPlants(batch, flowField, step) || changed;
      continue;
    }
    if (batch.pearl) {
      changed = updatePearlPlants(batch, flowField, step) || changed;
      continue;
    }
    const pos = batch.mesh.geometry.attributes.position;
    let batchChanged = false;
    for (const leaf of batch.leaves) {
      for (let k = 0; k < leaf.samples.length; k++) {
        leafOffset(leaf.flex, (k + 1) / 5, leaf.offset);
        leaf.point.copy(leaf.samples[k]);
        leaf.point.x += leaf.offset.x;
        leaf.point.z += leaf.offset.z;
        flowField.sample(leaf.point, leaf.flows[k]);
      }
      if (!advanceLeafFlex(leaf.flex, leaf.flows, step)) continue;
      batchChanged = true;
      for (let row = 0; row <= leaf.segments; row++) {
        leafOffset(leaf.flex, row / leaf.segments, leaf.offset);
        for (let cross = 0; cross < leaf.columns; cross++) {
          const j = row * leaf.columns + cross,
            rest = leaf.rest[j];
          pos.setXYZ(
            leaf.start + j,
            rest.x + leaf.offset.x,
            rest.y,
            rest.z + leaf.offset.z,
          );
        }
      }
    }
    if (batchChanged) {
      pos.needsUpdate = true;
      batch.mesh.geometry.computeVertexNormals();
      changed = true;
    }
  }
  return changed;
}

const rayWater = installRayWater({
  scene,
  surface,
  glass,
  fish,
  tetra,
  wood,
  rockMap: rockAsset.map,
  rockDetail: rockAsset.detail,
  rockTint: rockAsset.material.color,
  aquariumLight,
  waterY,
  heightfield: h,
  fieldSize: N,
});
let capturePaused = false;
installCapture({
  renderer: r,
  camera,
  controls,
  render: () => r.render(scene, camera),
  pause: () => {
    capturePaused = true;
    return () => {
      capturePaused = false;
      clock.getDelta();
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      r.setSize(innerWidth, innerHeight);
    };
  },
  startle: () =>
    startleSchool(
      fish,
      fish[Math.floor(fish.length / 2)].p.clone(),
      obstacles,
      elapsed,
    ),
});

function frame() {
  requestAnimationFrame(frame);
  if (capturePaused) return;
  let dt = Math.min(clock.getDelta(), 0.04);
  elapsed += dt;
  acc += dt;
  while (acc > 1 / 60) {
    step();
    acc -= 1 / 60;
  }
  injectFishWakes(fish, velocity, {
    size: N,
    width: W,
    depth: D,
    waterY,
    time: elapsed,
    dt,
  });
  const pos = waterGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, h[i]);
  pos.needsUpdate = true;
  waterGeo.computeVertexNormals();
  boids(dt);
  const plantsMoved = updatePlantFlow(dt);
  tetra.update(fish);
  rayWater.update(plantsMoved);
  controls.update();
  r.render(scene, camera);
}
frame();
