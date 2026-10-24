import assert from "node:assert/strict";
import * as T from "three";
import { createVegetation } from "../src/vegetation.js";
import { createFlowField } from "../src/flow-field.js";
import { updateHairgrass } from "../src/hairgrass-flow.js";
import { advanceSchool, createSchoolGroups } from "../src/schooling.js";
let seed = 18;
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const soilHeight = (x, z) =>
  0.18 +
  (0.17 * (z + 1.5)) / 3 +
  0.18 * Math.exp(-((x + 1.6) ** 2 + (z + 0.5) ** 2));
const obstacles = [
  [-1.5, -0.35, 0.92, 0.9],
  [-2.05, 0.12, 0.52, 0.36],
  [1.55, -0.65, 0.68, 0.49],
].map(([x, z, r, h]) => ({
  p: new T.Vector3(x, soilHeight(x, z) + h * 0.77, z),
  r,
  h,
}));
const plants = createVegetation({
    scene: new T.Scene(),
    soilHeight,
    obstacles,
    random,
  }),
  lawn = plants.batches.find((b) => b.hairgrass),
  field = createFlowField();
const fish = Array.from({ length: 38 }, () => ({
  p: new T.Vector3(
    (random() - 0.5) * 3,
    1.2 + random() * 0.9,
    (random() - 0.5) * 1.6,
  ),
  v: new T.Vector3(0.5 + random() * 0.3, 0, (random() - 0.5) * 0.2),
  group: new T.Group(),
  phase: random() * 6.28,
}));
createSchoolGroups(fish, random);
let movingFrames = 0,
  maxTip = 0,
  maxActive = 0;
for (let i = 0; i < 1440; i++) {
  advanceSchool(fish, obstacles, i / 24, 1 / 24);
  field.update(fish, i / 24);
  if (updateHairgrass(lawn, field, 1 / 24)) movingFrames++;
  if (i % 24 === 0) {
    let active = 0;
    for (const leaf of lawn.leaves) {
      if (!leaf.flex.sleeping) active++;
      maxTip = Math.max(maxTip, Math.hypot(leaf.flex.q[0], leaf.flex.q[1]));
    }
    maxActive = Math.max(maxActive, active);
  }
}
assert(
  movingFrames > 0 && maxTip > 0.0001,
  "normal swimming must produce a meaningful lawn response",
);
assert(maxTip < 0.006, "movement stays tiny");
assert(
  maxActive < lawn.leaves.length * 0.25,
  "no school-wide synchronized lawn motion",
);
console.log("PASS: normal school produces local micro-sway over 60 seconds.", {
  movingFrames,
  maxActive,
  maxTip,
});
